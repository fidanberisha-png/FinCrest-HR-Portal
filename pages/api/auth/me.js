import { getCurrentUser } from '../../../lib/auth';

export default async function handler(req, res) {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in' });
  return res.status(200).json(user);
}
