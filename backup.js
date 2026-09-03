import prisma from '../../lib/prisma';

function authorized(req) {
  const expected = process.env.BACKUP_TOKEN;
  if (!expected) return false;
  const header = req.headers.authorization || '';
  const bearer = header.indexOf('Bearer ') === 0 ? header.slice(7) : '';
  const supplied = bearer || req.headers['x-backup-token'] || req.query.token || '';
  return String(supplied) === String(expected);
}

export default async function handler(req, res) {
  if (!authorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        allowance: true,
        active: true,
        createdAt: true
      }
    });
    const requests = await prisma.leaveRequest.findMany({ orderBy: { createdAt: 'asc' } });
    const settings = await prisma.setting.findMany();

    const payload = {
      generatedAt: new Date().toISOString(),
      counts: { users: users.length, requests: requests.length, settings: settings.length },
      users: users,
      leaveRequests: requests,
      settings: settings
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="hr-backup-' + new Date().toISOString().slice(0, 10) + '.json"'
    );
    return res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error('[backup] ' + err.message);
    return res.status(500).json({ error: 'Backup failed' });
  }
}
