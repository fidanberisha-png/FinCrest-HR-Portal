import { syncNotionPage } from '../../lib/notionSync';

// Webhook for the Notion "Leave Requests" automations ("Send webhook" action):
//  - when a request is added            -> shows as Pending in the portal
//  - when Status changes (Approved/...) -> updates the portal + Leave calendar
// URL to put in Notion:
//   https://fincrest-hr-portal.onrender.com/api/notion-intake?key=<NOTION_WEBHOOK_KEY>
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.NOTION_WEBHOOK_KEY || '';
  const given = String(req.query.key || req.headers['x-webhook-key'] || '');
  if (!secret || given !== secret) return res.status(401).json({ error: 'Unauthorized' });

  const body = req.body || {};
  const pageId =
    (body.data && body.data.id) || body.id || body.page_id || (body.entity && body.entity.id) || req.query.id;
  if (!pageId) return res.status(400).json({ error: 'No page id in payload' });

  try {
    const out = await syncNotionPage(pageId);
    return res.status(200).json(out);
  } catch (err) {
    console.error('[notion-intake] ' + err.message);
    return res.status(500).json({ error: 'Sync failed' });
  }
}
