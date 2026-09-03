import prisma from '../../../lib/prisma';
import { requireUser, hasRole } from '../../../lib/auth';
import { notifyDecision } from '../../../lib/mailer';

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const id = String(req.query.id || '');
  const request = await prisma.leaveRequest.findUnique({
    where: { id: id },
    include: { user: { select: { id: true, name: true, email: true } } }
  });
  if (!request) return res.status(404).json({ error: 'Request not found' });

  if (req.method === 'PATCH') {
    const action = String((req.body || {}).action || '');
    const note = String((req.body || {}).note || '').trim();

    if (action === 'cancel') {
      const ownsIt = request.userId === user.id;
      if (!ownsIt && !hasRole(user, ['ADMIN'])) {
        return res.status(403).json({ error: 'You can only cancel your own requests' });
      }
      if (request.status !== 'PENDING') {
        return res.status(409).json({ error: 'Only pending requests can be cancelled' });
      }
      const updated = await prisma.leaveRequest.update({
        where: { id: id },
        data: { status: 'CANCELLED', decisionNote: note || null }
      });
      return res.status(200).json(updated);
    }

    if (action === 'approve' || action === 'reject') {
      if (!hasRole(user, ['ADMIN', 'APPROVER'])) {
        return res.status(403).json({ error: 'Only approvers and admins can decide requests' });
      }
      if (request.status !== 'PENDING') {
        return res.status(409).json({ error: 'This request has already been decided' });
      }
      const updated = await prisma.leaveRequest.update({
        where: { id: id },
        data: {
          status: action === 'approve' ? 'APPROVED' : 'REJECTED',
          decidedById: user.id,
          decidedAt: new Date(),
          decisionNote: note || null
        }
      });

      notifyDecision(updated, request.user, user).catch(function (err) {
        console.error('[requests] decision email failed: ' + err.message);
      });

      return res.status(200).json(updated);
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  res.setHeader('Allow', 'PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}
