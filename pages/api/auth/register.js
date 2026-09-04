import prisma from '../../../lib/prisma';
import { hashPassword, signToken, sessionCookie, normalizeEmail } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const email = normalizeEmail(body.email);
  const name = String(body.name || '').trim();
  const password = String(body.password || '');
  const department = String(body.department || '').trim();
  const position = String(body.position || '').trim();
  const startDateRaw = String(body.startDate || '').trim();

  if (!name || name.length < 2) return res.status(400).json({ error: 'Please enter your full name' });
  if (!email || email.indexOf('@') === -1) return res.status(400).json({ error: 'Please enter a valid email address' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  // The employment start date drives the 6-month leave eligibility rule, so it
  // is a required field on registration.
  if (!startDateRaw) return res.status(400).json({ error: 'Please enter your employment start date' });
  const startDate = new Date(startDateRaw + 'T00:00:00.000Z');
  if (isNaN(startDate.getTime())) return res.status(400).json({ error: 'Please enter a valid employment start date' });

  try {
    const existing = await prisma.user.findUnique({ where: { email: email } });
    if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

    const user = await prisma.user.create({
      data: {
        email: email,
        name: name,
        passwordHash: await hashPassword(password),
        department: department || null,
        position: position || null,
        startDate: startDate,
        role: 'EMPLOYEE'
      }
    });

    res.setHeader('Set-Cookie', sessionCookie(signToken(user)));
    return res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (err) {
    console.error('[register] ' + err.message);
    return res.status(500).json({ error: 'Could not create the account. Please try again.' });
  }
}
