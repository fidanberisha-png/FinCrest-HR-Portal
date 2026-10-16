import { useState } from 'react';
import { getLeaveRequest, APPROVER_NAME } from '../lib/notionLeave';
import { syncNotionPage } from '../lib/notionSync';

// Opened from the link in the approver's email:
//   /leave-decision?id=<Notion page id>
// Shows the leave request (read live from Notion) with Approve / Reject.
// The decision is only saved when a button is pressed, so email link
// scanners that "open" the link can never approve or reject anything.
export async function getServerSideProps(ctx) {
  try {
    const request = await getLeaveRequest(ctx.query.id);
    if (!request) return { props: { notFound: true } };
    // Safety net: make sure the request exists in the portal (as Pending).
    syncNotionPage(request.id).catch(function (err) {
      console.error('[leave-decision page] portal sync failed: ' + err.message);
    });
    return { props: { request: request } };
  } catch (err) {
    console.error('[leave-decision page] ' + err.message);
    return { props: { failed: true } };
  }
}

function Shell(props) {
  return (
    <div className="auth-wrap" style={{ maxWidth: 560 }}>
      <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>
        FinCrest HR &middot; Leave approval
      </p>
      <div className="card">{props.children}</div>
    </div>
  );
}

function Row(props) {
  if (props.value === null || props.value === undefined || props.value === '') return null;
  return (
    <p style={{ margin: '0 0 8px' }}>
      <span className="muted" style={{ display: 'inline-block', width: 130 }}>
        {props.label}
      </span>
      {props.value}
    </p>
  );
}

export default function LeaveDecision(props) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  if (props.notFound) {
    return (
      <Shell>
        <h1>Request not found</h1>
        <p className="muted">This link is not valid, or the request was deleted. Please contact HR.</p>
      </Shell>
    );
  }
  if (props.failed) {
    return (
      <Shell>
        <h1>Something went wrong</h1>
        <p className="muted">The request could not be loaded from Notion right now. Please try again in a minute.</p>
      </Shell>
    );
  }

  const r = props.request;
  const decided = done || (r.status !== 'Pending' ? r.status : '');

  async function submit(action) {
    if (action === 'reject' && !window.confirm('Reject this leave request?')) return;
    setBusy(action);
    setError('');
    const res = await fetch('/api/leave-decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, action: action, note: note })
    });
    const data = await res.json().catch(function () {
      return {};
    });
    setBusy('');
    if (!res.ok) {
      setError(data.error || 'Could not save the decision.');
      return;
    }
    setDone(data.status);
  }

  return (
    <Shell>
      <h1 style={{ marginBottom: 14 }}>Leave request</h1>
      <Row label="Employee" value={r.employee} />
      <Row label="Email" value={r.email} />
      <Row label="Department" value={r.department} />
      <Row label="Type" value={r.type} />
      <Row label="Dates" value={r.start === r.end ? r.start : r.start + ' to ' + r.end} />
      <Row label="Working days" value={r.days} />
      <Row label="Reason" value={r.reason} />
      {r.type === 'Sick leave' && r.days >= 3 ? (
        <Row label="Med. certificate" value={r.hasCertificate ? 'Attached in Notion' : 'Not attached (required from day 3)'} />
      ) : null}

      {decided ? (
        <div className={decided === 'Approved' ? 'ok-msg' : 'err'} style={{ marginTop: 18 }}>
          {done
            ? 'Saved - the request is ' + decided.toLowerCase() + '. It is updated in Notion and the employee will be notified by email.'
            : 'This request has already been ' + decided.toLowerCase() + '.' + (r.note ? ' Note: ' + r.note : '')}
        </div>
      ) : (
        <div style={{ marginTop: 18 }}>
          <label htmlFor="note">Note to the employee (optional)</label>
          <textarea
            id="note"
            rows={3}
            value={note}
            onChange={function (e) {
              setNote(e.target.value);
            }}
          />
          {error ? <div className="err">{error}</div> : null}
          <p style={{ marginTop: 16, marginBottom: 0 }}>
            <button
              className="ok"
              disabled={Boolean(busy)}
              onClick={function () {
                submit('approve');
              }}
            >
              {busy === 'approve' ? 'Saving...' : 'Approve'}
            </button>{' '}
            <button
              className="bad"
              disabled={Boolean(busy)}
              onClick={function () {
                submit('reject');
              }}
            >
              {busy === 'reject' ? 'Saving...' : 'Reject'}
            </button>
          </p>
          <p className="muted" style={{ marginTop: 14, marginBottom: 0, fontSize: 12 }}>
            Approver: {APPROVER_NAME}. Rules: Kosovo Labour Law No. 03/L-212.
          </p>
        </div>
      )}
    </Shell>
  );
}
