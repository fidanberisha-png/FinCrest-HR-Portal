import prisma from '../../../lib/prisma';
import { requireUser, leaveEligibleFrom, isLeaveEligible } from '../../../lib/auth';

const ROLES = ['EMPLOYEE', 'APPROVER', 'ADMIN'];

export default async function handler(req, res) {
  const admin = await requireUser(req, res, ['ADMIN']);
  if (!admin) return;

  if (req.method === 'GET') {
    const rows = await prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        position: true,
        startDate: true,
        allowance: true,
        usedBeyondAllowance: true,
        active: true,
        createdAt: true,
        _count: { select: { requests: true } }
      }
    });
    const users = rows.map(function (row) {
      const from = leaveEligibleFrom(row.startDate);
      return Object.assign({}, row, {
        leaveEligible: isLeaveEligible(row.startDate),
        leaveEligibleFrom: from ? from.toISOString() : null
      });
    });
    return res.status(200).json({ users: users });
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const id = String(body.id || '');
    if (!id) return res.status(400).json({ error: 'Missing user id' });

    const data = {};
    if (body.role !== undefined) {
      if (ROLES.indexOf(body.role) === -1) return res.status(400).json({ error: 'Unknown role' });
      if (id === admin.id && body.role !== 'ADMIN') {
        return res.status(409).json({ error: 'You cannot remove your own admin role' });
      }
      data.role = body.role;
    }
    if (body.allowance !== undefined) {
      const n = parseInt(body.allowance, 10);
      if (isNaN(n) || n < 0 || n > 365) return res.status(400).json({ error: 'Allowance must be between 0 and 365' });
      data.allowance = n;
    }
    if (body.active !== undefined) {
      if (id === admin.id && body.active === false) {
        return res.status(409).json({ error: 'You cannot deactivate your own account' });
      }
      data.active = Boolean(body.active);
    }
    if (body.department !== undefined) {
      data.department = String(body.department).trim() || null;
    }
    if (body.position !== undefined) {
      data.position = String(body.position).trim() || null;
    }
    if (body.startDate !== undefined) {
      const raw = String(body.startDate).trim();
      if (!raw) {
        data.startDate = null;
      } else {
        const parsed = new Date(raw.length === 10 ? raw + 'T00:00:00.000Z' : raw);
        if (isNaN(parsed.getTime())) return res.status(400).json({ error: 'Invalid employment start date' });
        data.startDate = parsed;
      }
    }
    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Nothing to update' });

    const updated = await prisma.user.update({
      where: { id: id },
      data: data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        allowance: true,
        active: true,
        department: true,
        position: true,
        startDate: true
      }
    });
    const from = leaveEligibleFrom(updated.startDate);
    return res.status(200).json(Object.assign({}, updated, {
      leaveEligible: isLeaveEligible(updated.startDate),
      leaveEligibleFrom: from ? from.toISOString() : null
    }));
  }

  res.setHeader('Allow', 'GET, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}
