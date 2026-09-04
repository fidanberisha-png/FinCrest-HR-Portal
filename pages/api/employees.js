import prisma from '../../lib/prisma';
import { requireUser, leaveEligibleFrom, isLeaveEligible } from '../../lib/auth';
import { resolveStartDate } from '../../lib/roster';
import { balancesByType } from '../../lib/leave';

// Employee directory. Administrators AND approvers see exactly the same data:
// every colleague with their own independent balance for each leave type.
//
// Employment start dates always come from the official company roster
// (lib/roster.js), never from what a user typed.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireUser(req, res, ['ADMIN', 'APPROVER']);
  if (!user) return;

  const year = Number(req.query.year) || new Date().getFullYear();

  try {
    const rows = await prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        position: true,
        role: true,
        allowance: true,
        startDate: true,
        createdAt: true
      },
      orderBy: { name: 'asc' }
    });

    // Keep the stored start dates in sync with the official roster.
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const official = resolveStartDate(row.name, row.email);
      if (!official) continue;
      const stored = row.startDate ? new Date(row.startDate).toISOString().slice(0, 10) : null;
      if (stored === official) continue;
      const fixed = new Date(official + 'T00:00:00.000Z');
      try {
        await prisma.user.update({ where: { id: row.id }, data: { startDate: fixed } });
        row.startDate = fixed;
      } catch (e) {
        console.error('[employees] could not sync start date for ' + row.email + ': ' + e.message);
      }
    }

    // All leave that touches the requested year, grouped per person.
    const byUser = {};
    try {
      const requests = await prisma.leaveRequest.findMany({
        where: {
          status: { in: ['APPROVED', 'PENDING'] },
          startDate: { lte: new Date(Date.UTC(year, 11, 31, 23, 59, 59)) },
          endDate: { gte: new Date(Date.UTC(year, 0, 1, 0, 0, 0)) }
        },
        select: { userId: true, type: true, status: true, startDate: true, endDate: true }
      });
      requests.forEach(function (item) {
        if (!byUser[item.userId]) byUser[item.userId] = [];
        byUser[item.userId].push(item);
      });
    } catch (e) {
      console.error('[employees] could not load leave: ' + e.message);
    }

    const employees = rows.map(function (row) {
      const eligibleFrom = leaveEligibleFrom(row.startDate);
      const balances = balancesByType(byUser[row.id] || [], year, row.allowance);
      let totalUsed = 0;
      let totalPending = 0;
      balances.forEach(function (b) {
        totalUsed += b.used + b.planned;
        totalPending += b.pending;
      });
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        department: row.department,
        position: row.position,
        role: row.role,
        allowance: row.allowance || 20,
        startDate: row.startDate,
        createdAt: row.createdAt,
        balances: balances,
        usedDays: totalUsed,
        pendingDays: totalPending,
        leaveEligible: isLeaveEligible(row.startDate),
        leaveEligibleFrom: eligibleFrom ? eligibleFrom.toISOString() : null,
        onRoster: Boolean(resolveStartDate(row.name, row.email))
      };
    });

    return res.status(200).json({ employees: employees, count: employees.length, year: year });
  } catch (error) {
    console.error('[employees] ' + error.message);
    return res.status(500).json({ error: 'Could not load the employee directory' });
  }
}
