import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import prisma from '../lib/prisma';
import { getCurrentUser } from '../lib/auth';
import { ymd } from '../lib/dates';

const LEAVE_TYPES = ['VACATION', 'SICK', 'UNPAID', 'PARENTAL', 'OTHER'];

export async function getServerSideProps(ctx) {
const user = await getCurrentUser(ctx.req);
if (!user) {
return { redirect: { destination: '/login', permanent: false } };
}

const rows = await prisma.leaveRequest.findMany({
where: { userId: user.id },
orderBy: { startDate: 'desc' },
take: 100
});

const year = new Date().getUTCFullYear();
let usedDays = 0;
let pendingDays = 0;
const usedByType = {};
const pendingByType = {};
LEAVE_TYPES.forEach(function (t) {
usedByType[t] = 0;
pendingByType[t] = 0;
});
rows.forEach(function (r) {
if (new Date(r.startDate).getUTCFullYear() !== year) return;
if (r.status === 'APPROVED' && r.type === 'VACATION') usedDays += r.days;
if (r.status === 'PENDING') pendingDays += r.days;
if (r.status === 'APPROVED') usedByType[r.type] = (usedByType[r.type] || 0) + r.days;
if (r.status === 'PENDING') pendingByType[r.type] = (pendingByType[r.type] || 0) + r.days;
});

return {
props: {
user: user,
requests: JSON.parse(JSON.stringify(rows)),
usedDays: usedDays,
pendingDays: pendingDays,
usedByType: usedByType,
pendingByType: pendingByType
}
};
}

const POLICY = [
{ name: 'Annual leave / PTO', days: '20 paid working days / year', note: 'Standard yearly entitlement.' },
{ name: 'Sick leave', days: '20 paid days / year', note: '1-2 days: no approval needed, notification only, no medical certificate required. From day 3 onward: approval required and a medical certificate is needed.' },
{ name: 'Unpaid leave', days: 'No fixed limit', note: 'Subject to agreement with your manager.' },
{ name: 'Parental leave', days: 'Maternity up to 12 months; paternity/childbirth leave paid days', note: 'Maternity: 6 months full pay, 3 months partial pay, 3 months unpaid extension. Paternity: a few paid days around childbirth.' },
{ name: 'Other (special circumstances)', days: '5 paid days (default)', note: 'Covers events such as marriage, voluntary blood donation (1 paid day per donation), and bereavement.' }
];

const TYPE_LABELS = {
VACATION: 'Vacation / PTO',
SICK: 'Sick leave',
UNPAID: 'Unpaid leave',
PARENTAL: 'Parental leave',
OTHER: 'Other'
};

const TYPE_TOTALS = {
SICK: 20,
OTHER: 5
};

export default function Dashboard(props) {
const router = useRouter();
const [form, setForm] = useState({ type: 'VACATION', startDate: '', endDate: '', reason: '' });
const [error, setError] = useState('');
const [notice, setNotice] = useState('');
const [busy, setBusy] = useState(false);

function update(key) {
return function (e) {
const next = Object.assign({}, form);
next[key] = e.target.value;
setForm(next);
};
}

async function submit(e) {
e.preventDefault();
setError('');
setNotice('');
setBusy(true);
const res = await fetch('/api/requests', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(form)
});
const data = await res.json().catch(function () {
return {};
});
setBusy(false);
if (!res.ok) {
setError(data.error || 'Could not submit the request');
return;
}
if (data.status === 'APPROVED') {
setNotice('Sick leave (1-2 days) recorded automatically - no approval needed. A confirmation email has been sent.');
} else {
setNotice('Request submitted. Your approver has been notified by email.');
}
setForm({ type: 'VACATION', startDate: '', endDate: '', reason: '' });
router.replace(router.asPath);
}

async function cancel(id) {
setError('');
setNotice('');
const res = await fetch('/api/requests/' + id, {
method: 'PATCH',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ action: 'cancel' })
});
const data = await res.json().catch(function () {
return {};
});
if (!res.ok) {
setError(data.error || 'Could not cancel the request');
return;
}
setNotice('Request cancelled.');
router.replace(router.asPath);
}

const remaining = props.user.allowance - props.usedDays;

const totals = Object.assign({ VACATION: props.user.allowance }, TYPE_TOTALS);
const selType = form.type;
const selUsed = (props.usedByType && props.usedByType[selType]) || 0;
const selPending = (props.pendingByType && props.pendingByType[selType]) || 0;
const selTotal = totals[selType];
const selRemaining = selTotal != null ? selTotal - selUsed - selPending : null;

return (
<Layout user={props.user}>
<h1>My dashboard</h1>

<div className="stats">
<div className="stat">
<div className="n">{props.user.allowance}</div>
<div className="l">Annual allowance</div>
</div>
<div className="stat">
<div className="n">{props.usedDays}</div>
<div className="l">Approved days used</div>
</div>
<div className="stat">
<div className="n">{props.pendingDays}</div>
<div className="l">Days pending</div>
</div>
<div className="stat">
<div className="n">{remaining}</div>
<div className="l">Days remaining</div>
</div>
</div>

<div className="card" style={{ marginTop: 20 }}>
<h2>Leave policy (Kosovo Labour Law - Law No. 03/L-212)</h2>
<table>
<thead>
<tr>
<th>Leave type</th>
<th>Entitlement</th>
<th>Notes</th>
</tr>
</thead>
<tbody>
{POLICY.map(function (p) {
return (
<tr key={p.name}>
<td>{p.name}</td>
<td>{p.days}</td>
<td className="muted">{p.note}</td>
</tr>
);
})}
</tbody>
</table>
<p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
This summary is provided for internal reference and is not legal advice. Please confirm specifics with HR or a labour law professional if needed.
</p>
</div>

<div className="card" style={{ marginTop: 20 }}>
<h2>New leave request</h2>
<form onSubmit={submit}>
<div className="row">
<div>
<label htmlFor="type">Type</label>
<select id="type" value={form.type} onChange={update('type')}>
<option value="VACATION">Vacation / PTO</option>
<option value="SICK">Sick leave</option>
<option value="UNPAID">Unpaid leave</option>
<option value="PARENTAL">Parental leave</option>
<option value="OTHER">Other (marriage, blood donation, bereavement)</option>
</select>
</div>
<div>
<label htmlFor="startDate">First day</label>
<input id="startDate" type="date" value={form.startDate} onChange={update('startDate')} required />
</div>
<div>
<label htmlFor="endDate">Last day</label>
<input id="endDate" type="date" value={form.endDate} onChange={update('endDate')} required />
</div>
</div>

<div className="stats" style={{ marginTop: 12, marginBottom: 16 }}>
<div className="stat">
<div className="n">{selTotal != null ? selTotal : 'No limit'}</div>
<div className="l">{TYPE_LABELS[selType]} - total/year</div>
</div>
<div className="stat">
<div className="n">{selUsed}</div>
<div className="l">Used this year</div>
</div>
<div className="stat">
<div className="n">{selPending}</div>
<div className="l">Pending</div>
</div>
<div className="stat">
<div className="n">{selRemaining != null ? selRemaining : 'No limit'}</div>
<div className="l">Remaining</div>
</div>
</div>

<label htmlFor="reason">Reason / notes (optional)</label>
<textarea id="reason" value={form.reason} onChange={update('reason')} />
{error ? <div className="err">{error}</div> : null}
{notice ? <div className="ok-msg">{notice}</div> : null}
<p style={{ marginTop: 16, marginBottom: 0 }}>
<button type="submit" disabled={busy}>
{busy ? 'Submitting...' : 'Submit request'}
</button>
</p>
</form>
</div>

<div className="card">
<h2>My requests</h2>
{props.requests.length === 0 ? (
<p className="muted">You have not submitted any requests yet.</p>
) : (
<table>
<thead>
<tr>
<th>Type</th>
<th>Dates</th>
<th>Days</th>
<th>Status</th>
<th>Note</th>
<th />
</tr>
</thead>
<tbody>
{props.requests.map(function (r) {
return (
<tr key={r.id}>
<td>{r.type}</td>
<td>
{ymd(r.startDate)} to {ymd(r.endDate)}
</td>
<td>{r.days}</td>
<td>
<StatusBadge status={r.status} />
</td>
<td className="muted">{r.decisionNote || r.reason || ''}</td>
<td>
{r.status === 'PENDING' ? (
<button
className="ghost sm"
onClick={function () {
cancel(r.id);
}}
>
Cancel
</button>
) : null}
</td>
</tr>
);
})}
</tbody>
</table>
)}
</div>
</Layout>
);
}
