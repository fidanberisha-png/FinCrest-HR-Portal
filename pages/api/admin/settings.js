import prisma from '../../../lib/prisma';
import { requireUser } from '../../../lib/auth';

const ALLOWED = ['companyName', 'notifyEmail', 'defaultAllowance', 'minNoticeDays'];

export default async function handler(req, res) {
  const admin = await requireUser(req, res, ['ADMIN']);
  if (!admin) return;

  if (req.method === 'GET') {
    const rows = await prisma.setting.findMany();
    const settings = {};
    rows.forEach(function (r) {
      settings[r.key] = r.value;
    });
    return res.status(200).json({ settings: settings });
  }

  if (req.method === 'PUT') {
    const body = req.body || {};
    const keys = Object.keys(body).filter(function (k) {
      return ALLOWED.indexOf(k) !== -1;
    });
    if (keys.length === 0) return res.status(400).json({ error: 'No valid settings supplied' });

    for (const key of keys) {
      const value = String(body[key] === null || body[key] === undefined ? '' : body[key]);
      await prisma.setting.upsert({
        where: { key: key },
        update: { value: value },
        create: { key: key, value: value }
      });
    }
    return res.status(200).json({ ok: true, updated: keys });
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'Method not allowed' });
}
