import prisma from '../../lib/prisma';
import { requireUser, leaveEligibleFrom, isLeaveEligible } from '../../lib/auth';
import { resolveStartDate } from '../../lib/roster';

// Employee directory. Only administrators and approvers are allowed to see the
// roster of colleagues - regular employees receive a 403.
//
// Employment start dates are always taken from the official company roster
// (lib/roster.js), never from what a user typed. Any account whose stored date
// does not match the roster is corrected automatically here.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireUser(req, res, ['ADMIN', 'APPROVER']);
  if (!user) return;

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

    // Leave usage for the current calendar year, per employee.
    const year = new Date().getFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
    const usage = {};
    try {
      const requests = await prisma.leaveRequest.findMany({
        where: { startDate: { gte: yearStart, lte: yearEnd } },
        select: { userId: true, status: true, days: true }
      });
      requests.forEach(function (item) {
        if (!usage[item.userId]) usage[item.userId] = { used: 0, pending: 0 };
        if (item.status === 'APPROVED') usage[item.userId].used += item.days;
        if (item.status === 'PENDING') usage[item.userId].pending += item.days;
      });
    } catch (e) {
      console.error('[employees] could not load leave usage: ' + e.message);
    }

    const employees = rows.map(function (row) {
      const eligibleFrom = leaveEligibleFrom(row.startDate);
      const stats = usage[row.id] || { used: 0, pending: 0 };
      const allowance = row.allowance || 0;
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        department: row.department,
        position: row.position,
        role: row.role,
        allowance: allowance,
        startDate: row.startDate,
        createdAt: row.createdAt,
        usedDays: stats.used,
        pendingDays: stats.pending,
        remainingDays: allowance - stats.used - stats.pending,
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
