import prisma from './prisma';
import { parseDate, businessDays } from './dates';
import { getLeaveRequest, cleanId } from './notionLeave';

// ---------------------------------------------------------------------------
// Copies a leave request from Notion into the portal database, so it shows
// up in the employee's "My requests" (Pending -> Approved / Rejected) and in
// the Leave calendar, where approved days are deducted from the balance.
//
// Called:
//  - by Notion automations ("Send webhook") when a request is added or its
//    Status changes -> /api/notion-intake
//  - right after Pajazit approves / rejects on /leave-decision
//  - when Pajazit opens the decision link (safety net)
// It is idempotent: the Notion page id is stored on the LeaveRequest row.
// ---------------------------------------------------------------------------

const TYPE_MAP = {
  'Vacation / PTO': 'VACATION',
  'Sick leave': 'SICK',
  'Unpaid leave': 'UNPAID',
  'Parental leave': 'PARENTAL',
  'Other (special circumstances)': 'OTHER'
};

const STATUS_MAP = {
  Pending: 'PENDING',
  Approved: 'APPROVED',
  Rejected: 'REJECTED'
};

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ë/g, 'e')
    .replace(/ç/g, 'c')
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

// Finds the portal account of the employee: by email first, then by name.
async function findEmployee(email, name) {
  const mail = String(email || '').trim().toLowerCase();
  if (mail) {
    const byMail = await prisma.user.findFirst({ where: { email: { equals: mail, mode: 'insensitive' } } });
    if (byMail) return byMail;
  }
  const key = normalize(name);
  if (!key) return null;
  const all = await prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, email: true } });
  return (
    all.filter(function (u) {
      return normalize(u.name) === key;
    })[0] || null
  );
}

export async function syncNotionPage(pageId, decider) {
  const id = cleanId(pageId);
  if (!id) return { skipped: 'invalid id' };

  const r = await getLeaveRequest(id);
  if (!r) return { skipped: 'not a leave request' };

  const employee = await findEmployee(r.email, r.employee);
  if (!employee) {
    console.warn('[notion-sync] no portal account for ' + (r.email || r.employee) + ' - skipped');
    return { skipped: 'no portal account for ' + (r.email || r.employee) };
  }

  const start = parseDate(r.start);
  const end = parseDate(r.end || r.start);
  if (!start || !end) return { skipped: 'missing dates' };

  const status = STATUS_MAP[r.status] || 'PENDING';
  const decided = status !== 'PENDING';

  let deciderId = null;
  if (decided) {
    const approver =
      decider ||
      (await prisma.user.findFirst({ where: { role: 'APPROVER', active: true }, orderBy: { createdAt: 'asc' } })) ||
      (await prisma.user.findFirst({ where: { role: 'ADMIN', active: true }, orderBy: { createdAt: 'asc' } }));
    deciderId = approver ? approver.id : null;
  }

  const data = {
    userId: employee.id,
    type: TYPE_MAP[r.type] || 'VACATION',
    startDate: start,
    endDate: end,
    days: Math.max(1, businessDays(start, end)),
    reason: r.reason || null,
    status: status,
    decisionNote: r.note || null,
    decidedById: deciderId,
    decidedAt: decided ? new Date() : null
  };

  const existing = await prisma.leaveRequest.findFirst({ where: { notionPageId: id } });
  if (existing) {
    // Keep the original decision time if nothing changed.
    if (existing.status === status && existing.decidedAt) data.decidedAt = existing.decidedAt;
    await prisma.leaveRequest.update({ where: { id: existing.id }, data: data });
  } else {
    await prisma.leaveRequest.create({ data: Object.assign({ notionPageId: id }, data) });
  }
  console.log('[notion-sync] ' + id + ' -> ' + employee.email + ' ' + status);
  return { ok: true, status: status, employee: employee.email };
}
