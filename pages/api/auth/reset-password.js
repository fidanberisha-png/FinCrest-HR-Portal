import prisma from '../../../lib/prisma';
import { hashPassword, normalizeEmail } from '../../../lib/auth';

// Simple self-service password reset: the person gives their work email and
// the new password twice. The old password is not needed.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const confirm = String(body.confirm || '');

  if (!email || email.indexOf('@') === -1) {
    return res.status(400).json({ error: 'Please enter your work email address' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'The new password must be at least 8 characters' });
  }
  if (password !== confirm) {
    return res.status(400).json({ error: 'The two passwords do not match' });
  }

  try {
    const account = await prisma.user.findUnique({ where: { email: email } });
    if (!account) {
      return res.status(404).json({ error: 'No account was found with that email address' });
    }
    if (!account.active) {
      return res.status(403).json({ error: 'That account is not active. Please contact HR.' });
    }

    await prisma.user.update({
      where: { id: account.id },
      data: { passwordHash: await hashPassword(password) }
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[reset-password] ' + err.message);
    return res.status(500).json({ error: 'Could not reset the password. Please try again.' });
  }
}
