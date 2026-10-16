import { decideLeaveRequest, cleanId } from '../../lib/notionLeave';
import { syncNotionPage } from '../../lib/notionSync';

// POST { id, action: 'approve' | 'reject', note } - called by the
// /leave-decision page that the link in Pajazit's email opens.
// Writes the decision into the Notion "Leave Requests" database.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const body = req.body || {};
  const id = cleanId(body.id);
  const action = body.action === 'approve' || body.action === 'reject' ? body.action : null;
  if (!id || !action) return res.status(400).json({ error: 'Invalid request' });

  try {
    const out = await decideLeaveRequest(id, action, body.note);
    if (out.error) return res.status(out.code || 400).json({ error: out.error });
    console.log('[leave-decision] ' + id + ' -> ' + out.request.status);
    // Mirror into the portal: My requests + Leave calendar (days deducted).
    try {
      await syncNotionPage(id);
    } catch (err) {
      console.error('[leave-decision] portal sync failed: ' + err.message);
    }
    return res.status(200).json({ ok: true, status: out.request.status });
  } catch (err) {
    console.error('[leave-decision] ' + err.message);
    return res.status(500).json({ error: 'Could not save the decision in Notion. Please try again or contact HR.' });
  }
}
