import { requireUser } from '../../../lib/auth';
import { sendTestMail } from '../../../lib/mailer';

export default async function handler(req, res) {
  const admin = await requireUser(req, res, ['ADMIN']);
  if (!admin) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const to = String((req.body || {}).to || admin.email);
  const result = await sendTestMail(to);
  if (result.skipped) return res.status(400).json({ error: 'SMTP is not configured on the server' });
  if (result.ok) return res.status(200).json({ ok: true, to: to });
  return res.status(500).json({ error: result.error || 'Email failed' });
}
