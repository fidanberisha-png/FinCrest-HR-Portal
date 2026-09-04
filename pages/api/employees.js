import prisma from '../../lib/prisma';
import { requireUser, leaveEligibleFrom, isLeaveEligible } from '../../lib/auth';

// Employee directory. Only administrators and approvers are allowed to see the
// roster of colleagues - regular employees receive a 403.
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

    const employees = rows.map(function (row) {
      const eligibleFrom = leaveEligibleFrom(row.startDate);
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        department: row.department,
        position: row.position,
        role: row.role,
        allowance: row.allowance,
        startDate: row.startDate,
        createdAt: row.createdAt,
        leaveEligible: isLeaveEligible(row.startDate),
        leaveEligibleFrom: eligibleFrom ? eligibleFrom.toISOString() : null
      };
    });

    return res.status(200).json({ employees: employees, count: employees.length });
  } catch (error) {
    console.error('[employees] ' + error.message);
    return res.status(500).json({ error: 'Could not load the employee directory' });
  }
}
