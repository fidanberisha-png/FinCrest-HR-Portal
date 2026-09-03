import { useState } from 'react';
import Layout from '../../components/Layout';
import prisma from '../../lib/prisma';
import { getCurrentUser, hasRole } from '../../lib/auth';

const FIELDS = [
{ key: 'companyName', label: 'Company name', placeholder: 'FinCrest' },
{ key: 'notifyEmail', label: 'Extra notification inbox (optional)', placeholder: 'hr@fincrest.com' },
{ key: 'defaultAllowance', label: 'Default annual allowance (days)', placeholder: '25' },
{ key: 'minNoticeDays', label: 'Minimum notice for vacation (days)', placeholder: '3' }
];

export async function getServerSideProps(ctx) {
const user = await getCurrentUser(ctx.req);
if (!user) return { redirect: { destination: '/login', permanent: false } };
if (!hasRole(user, ['ADMIN'])) return { redirect: { destination: '/dashboard', permanent: false } };

const rows = await prisma.setting.findMany();
const settings = {};
rows.forEach(function (r) {
settings[r.key] = r.value;
});

return { props: { user: user, settings: settings } };
}

export default function AdminSettings(props) {
const [values, setValues] = useState(props.settings || {});
const [error, setError] = useState('');
const [notice, setNotice] = useState('');
const [busy, setBusy] = useState(false);
const [resetBusy, setResetBusy] = useState(false);

function update(key) {
return function (e) {
const next = Object.assign({}, values);
next[key] = e.target.value;
setValues(next);
};
}

async function save(e) {
e.preventDefault();
setError('');
setNotice('');
setBusy(true);
const res = await fetch('/api/admin/settings', {
method: 'PUT',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(values)
});
const data = await res.json().catch(function () {
return {};
});
setBusy(false);
if (!res.ok) {
setError(data.error || 'Could not save settings');
return;
}
setNotice('Settings saved.');
}

async function testEmail() {
setError('');
setNotice('');
const res = await fetch('/api/admin/test-email', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ to: props.user.email })
});
const data = await res.json().catch(function () {
return {};
});
if (!res.ok) {
setError(data.error || 'Test email failed');
return;
}
setNotice('Test email sent to ' + props.user.email + '.');
}

async function resetTestData() {
const sure = window.confirm(
'This will permanently delete ALL leave requests for ALL users, so you can start testing again from a clean state. It does not delete any accounts. Continue?'
);
if (!sure) return;
setError('');
setNotice('');
setResetBusy(true);
const res = await fetch('/api/admin/reset-test-data', { method: 'POST' });
const data = await res.json().catch(function () {
return {};
});
setResetBusy(false);
if (!res.ok) {
setError(data.error || 'Could not reset data');
return;
}
setNotice('Deleted ' + data.deleted + ' leave request(s). Test data has been reset.');
}

return (
<Layout user={props.user}>
<h1>Settings</h1>
<div className="card" style={{ marginTop: 16 }}>
<form onSubmit={save}>
{FIELDS.map(function (f) {
return (
<div key={f.key}>
<label htmlFor={f.key}>{f.label}</label>
<input
id={f.key}
value={values[f.key] || ''}
placeholder={f.placeholder}
onChange={update(f.key)}
/>
</div>
);
})}
{error ? <div className="err">{error}</div> : null}
{notice ? <div className="ok-msg">{notice}</div> : null}
<p style={{ marginTop: 18, marginBottom: 0 }}>
<button type="submit" disabled={busy}>
{busy ? 'Saving...' : 'Save settings'}
</button>{' '}
<button type="button" className="ghost" onClick={testEmail}>
Send test email
</button>
</p>
</form>
</div>
<div className="card">
<h2>Reset test data</h2>
<p className="muted">
Use this while you are testing the portal. It permanently deletes all submitted leave requests for every
user so balances go back to zero. It does not delete any user accounts, and cannot be undone.
</p>
<p style={{ marginTop: 12, marginBottom: 0 }}>
<button type="button" className="ghost" onClick={resetTestData} disabled={resetBusy}>
{resetBusy ? 'Resetting...' : 'Reset all leave requests'}
</button>
</p>
</div>
<div className="card">
<h2>Backups</h2>
<p className="muted">
The GitHub Actions workflow in .github/workflows/backup.yml calls /api/backup every night using the
BACKUP_TOKEN secret and stores the JSON export as a workflow artifact.
</p>
</div>
</Layout>
);
}
