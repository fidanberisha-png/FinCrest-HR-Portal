import prisma from '../../../lib/prisma';
import { requireUser } from '../../../lib/auth';
import { resolveStartDate } from '../../../lib/roster';
import { vacationYear, balancesByType } from '../../../lib/leave';

// Yearly vacation (PTO) report for administrators and approvers.
// One row per employee, one column per month, plus total used, total planned
// and remaining days. Built live from the approved and pending requests.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireUser(req, res, ['ADMIN', 'APPROVER']);
  if (!user) return;

  const year = Number(req.query.year) || new Date().getFullYear();

  try {
    const people = await prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        position: true,
        allowance: true,
        startDate: true
      },
      orderBy: { startDate: 'asc' }
    });

    const requests = await prisma.leaveRequest.findMany({
      where: {
        status: { in: ['APPROVED', 'PENDING'] },
        startDate: { lte: new Date(Date.UTC(year, 11, 31, 23, 59, 59)) },
        endDate: { gte: new Date(Date.UTC(year, 0, 1, 0, 0, 0)) }
      },
      select: { userId: true, type: true, status: true, startDate: true, endDate: true }
    });

    const byUser = {};
    requests.forEach(function (item) {
      if (!byUser[item.userId]) byUser[item.userId] = [];
      byUser[item.userId].push(item);
    });

    const rows = people.map(function (person) {
      const mine = byUser[person.id] || [];
      const pto = vacationYear(mine, year, person.allowance);
      const parts = String(person.name || '').trim().split(' ');
      const firstName = parts.shift() || '';
      const lastName = parts.join(' ');
      return {
        id: person.id,
        firstName: firstName,
        lastName: lastName,
        name: person.name,
        email: person.email,
        department: person.department,
        position: person.position,
        startDate: person.startDate || (resolveStartDate(person.name, person.email) || null),
        months: pto.months,
        used: pto.used,
        planned: pto.planned,
        pending: pto.pending,
        allowance: pto.allowance,
        remaining: pto.remaining,
        balances: balancesByType(mine, year, person.allowance)
      };
    });

    return res.status(200).json({ year: year, rows: rows, count: rows.length });
  } catch (error) {
    console.error('[leave-year] ' + error.message);
    return res.status(500).json({ error: 'Could not build the yearly leave report' });
  }
}
