import prisma from '../../../lib/prisma';
import { requireUser } from '../../../lib/auth';

// Deletes all leave requests so an admin can reset the system to a clean
// state while testing. This does not delete any user accounts.
export default async function handler(req, res) {
  const admin = await requireUser(req, res, ['ADMIN']);
  if (!admin) return;

if (req.method === 'POST') {
  const result = await prisma.leaveRequest.deleteMany({});
  return res.status(200).json({ ok: true, deleted: result.count });
}

res.setHeader('Allow', 'POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
