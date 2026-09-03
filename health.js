import prisma from '../../lib/prisma';

export default async function handler(req, res) {
  try {
    const users = await prisma.user.count();
    return res.status(200).json({ status: 'ok', users: users, time: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
}
