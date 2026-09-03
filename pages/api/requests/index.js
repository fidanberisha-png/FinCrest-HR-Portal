import prisma from '../../../lib/prisma';
import { requireUser, hasRole } from '../../../lib/auth';
import { parseDate, businessDays } from '../../../lib/dates';
import { notifyNewRequest } from '../../../lib/mailer';

const TYPES = ['VACATION', 'SICK', 'UNPAID', 'PARENTAL', 'OTHER'];

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    const scope = req.query.scope === 'all' && hasRole(user, ['ADMIN', 'APPROVER']) ? 'all' : 'mine';
    const where = scope === 'all' ? {} : { userId: user.id };
    if (req.query.status) where.status = req.query.status;
    const requests = await prisma.leaveRequest.findMany({
      where: where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: { select: { id: true, name: true, email: true, department: true } },
        decidedBy: { select: { name: true } }
      }
    });
    return res.status(200).json({ scope: scope, requests: requests });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const type = TYPES.indexOf(body.type) !== -1 ? body.type : 'VACATION';
    const start = parseDate(body.startDate);
    const end = parseDate(body.endDate);
    const reason = String(body.reason || '').trim();

    if (!start || !end) return res.status(400).json({ error: 'Please choose a valid start and end date' });
    if (end.getTime() < start.getTime()) return res.status(400).json({ error: 'The end date cannot be before the start date' });

    const days = businessDays(start, end);
    if (days < 1) return res.status(400).json({ error: 'That range contains no working days' });

    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        userId: user.id,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: end },
        endDate: { gte: start }
      }
    });
    if (overlap) return res.status(409).json({ error: 'You already have a request that overlaps those dates' });

    try {
      const created = await prisma.leaveRequest.create({
        data: {
          userId: user.id,
          type: type,
          startDate: start,
          endDate: end,
          days: days,
          reason: reason || null
        }
      });

      notifyNewRequest(created, user).catch(function (err) {
        console.error('[requests] notification failed: ' + err.message);
      });

      return res.status(201).json(created);
    } catch (err) {
      console.error('[requests] ' + err.message);
      return res.status(500).json({ error: 'Could not save the request' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
