import prisma from '../../../lib/prisma';
import { checkPassword, signToken, sessionCookie, normalizeEmail } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = normalizeEmail((req.body || {}).email);
  const password = String((req.body || {}).password || '');

  try {
    const user = await prisma.user.findUnique({ where: { email: email } });
    if (!user || !user.active) return res.status(401).json({ error: 'Invalid email or password' });

    const good = await checkPassword(password, user.passwordHash);
    if (!good) return res.status(401).json({ error: 'Invalid email or password' });

    res.setHeader('Set-Cookie', sessionCookie(signToken(user)));
    return res.status(200).json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (err) {
    console.error('[login] ' + err.message);
    return res.status(500).json({ error: 'Sign in failed. Please try again.' });
  }
}
