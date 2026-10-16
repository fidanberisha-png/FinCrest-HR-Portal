// ---------------------------------------------------------------------------
// Leave decisions from the approver's email, saved straight into Notion.
//
// Flow:
//  1. Employee submits the "Request Leave" form in Notion (FinCrest > HR).
//  2. Notion emails Pajazit (Approver) a link:
//       https://fincrest-hr-portal.onrender.com/leave-decision?id=<notion page id>
//  3. That page (this app, on Render) reads the request from Notion and shows
//     Approve / Reject buttons with an optional note.
//  4. The click writes Status, Decision Note, Decided On and Decided By back to
//     the Notion row. Notion's own automation then emails the employee.
//
// Render environment variables:
//   NOTION_TOKEN        - secret of a Notion internal integration. In Notion open
//                         the "Leave Requests" database > ... > Connections and
//                         add that integration, otherwise the API returns 404.
//   NOTION_LEAVE_DB_ID  - optional, defaults to the FinCrest Leave Requests DB.
// ---------------------------------------------------------------------------

const API = 'https://api.notion.com/v1';
const VERSION = '2022-06-28';
const DEFAULT_DB = 'd5f2572d945f4444837e20d523f53119';

export const APPROVER_NAME = 'Pajazit Shkurti';

function dbId() {
  return String(process.env.NOTION_LEAVE_DB_ID || DEFAULT_DB).replace(/-/g, '').toLowerCase();
}

export function cleanId(value) {
  const s = String(value || '').replace(/-/g, '').toLowerCase();
  return /^[0-9a-f]{32}$/.test(s) ? s : null;
}

async function notion(method, path, body) {
  if (!process.env.NOTION_TOKEN) throw new Error('NOTION_TOKEN is not set on the server');
  const res = await fetch(API + path, {
    method: method,
    headers: {
      Authorization: 'Bearer ' + process.env.NOTION_TOKEN,
      'Notion-Version': VERSION,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(function () {
    return {};
  });
  if (!res.ok) {
    const err = new Error('Notion HTTP ' + res.status + ': ' + (data.message || 'request failed'));
    err.status = res.status;
    throw err;
  }
  return data;
}

function text(prop) {
  if (!prop) return '';
  const parts = prop.title || prop.rich_text || [];
  return parts
    .map(function (p) {
      return p.plain_text || '';
    })
    .join('')
    .trim();
}

function formulaValue(prop) {
  if (!prop || !prop.formula) return null;
  const f = prop.formula;
  return f.number !== undefined ? f.number : f.string !== undefined ? f.string : null;
}

// Reads one leave request. Returns null when the id is not a page of the
// Leave Requests database (so the link cannot be used on any other page).
export async function getLeaveRequest(pageId) {
  const id = cleanId(pageId);
  if (!id) return null;
  let page;
  try {
    page = await notion('GET', '/pages/' + id);
  } catch (err) {
    if (err.status === 404 || err.status === 400) return null;
    throw err;
  }
  const parent = page.parent && page.parent.database_id ? page.parent.database_id.replace(/-/g, '') : '';
  if (parent !== dbId() || page.archived || page.in_trash) return null;

  const p = page.properties || {};
  const dates = p.Dates && p.Dates.date ? p.Dates.date : null;
  const status = p.Status && p.Status.status ? p.Status.status.name : p.Status && p.Status.select ? p.Status.select.name : '';
  return {
    id: id,
    url: page.url,
    employee: text(p['Employee Name']),
    email: p['Employee Email'] ? p['Employee Email'].email || '' : '',
    department: text(p.Department),
    type: p.Type && p.Type.select ? p.Type.select.name : '',
    start: dates ? dates.start : '',
    end: dates ? dates.end || dates.start : '',
    days: formulaValue(p['Working Days']),
    reason: text(p.Reason),
    status: status || 'Pending',
    note: text(p['Decision Note']),
    hasCertificate: Boolean(p['Medical Certificate'] && (p['Medical Certificate'].files || []).length)
  };
}

// Saves the decision to Notion. Only a Pending request can be decided.
export async function decideLeaveRequest(pageId, action, note) {
  const current = await getLeaveRequest(pageId);
  if (!current) return { error: 'Request not found', code: 404 };
  if (current.status !== 'Pending') {
    return { error: 'This request has already been ' + current.status.toLowerCase() + '.', code: 409, request: current };
  }
  const status = action === 'approve' ? 'Approved' : 'Rejected';
  const today = new Date().toISOString().slice(0, 10);
  const cleanNote = String(note || '').trim().slice(0, 1900);
  await notion('PATCH', '/pages/' + current.id, {
    properties: {
      Status: { status: { name: status } },
      'Decision Note': { rich_text: cleanNote ? [{ type: 'text', text: { content: cleanNote } }] : [] },
      'Decided On': { date: { start: today } }
    }
  });
  return { request: Object.assign({}, current, { status: status, note: cleanNote }) };
}
