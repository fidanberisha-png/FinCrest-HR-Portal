import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';

const LEAVE_TYPES = [
  { value: 'VACATION', label: 'Vacation / PTO' },
  { value: 'SICK', label: 'Sick leave' },
  { value: 'UNPAID', label: 'Unpaid leave' },
  { value: 'PARENTAL', label: 'Parental leave' },
  { value: 'OTHER', label: 'Other (special circumstances)' }
];

const POLICY = [
  ['Annual leave / PTO', '20 paid working days / year', 'Standard yearly entitlement.'],
  ['Sick leave', '20 paid days / year', '1-2 days: no approval needed, notification only, no medical certificate required. From day 3 onward: approval required and a medical certificate is needed.'],
  ['Unpaid leave', 'No fixed limit', 'Subject to agreement with your manager.'],
  ['Parental leave', 'Maternity up to 12 months; paternity/childbirth leave paid days', 'Maternity: 6 months full pay, 3 months partial pay, 3 months unpaid extension. Paternity: a few paid days around childbirth.'],
  ['Other (special circumstances)', '5 paid days (default)', 'Covers events such as marriage, voluntary blood donation (1 paid day per donation), and bereavement.']
];

const MIN_SERVICE_MONTHS = 6;

function isoDay(date) {
  const d = new Date(date);
  const m = String(d.getMonth() + 1);
  const day = String(d.getDate());
  return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
}

function tomorrowIso() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return isoDay(new Date(t.getTime() + 24 * 60 * 60 * 1000));
}

function pretty(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString();
}

function eligibleFromDate(startDate) {
  if (!startDate) return null;
  const from = new Date(startDate);
  if (isNaN(from.getTime())) return null;
  from.setMonth(from.getMonth() + MIN_SERVICE_MONTHS);
  from.setHours(0, 0, 0, 0);
  return from;
}

const cardStyle = {
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
  padding: '18px',
  textAlign: 'center'
};

const panelStyle = {
  background: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
  padding: '20px',
  marginBottom: '20px'
};

const thStyle = {
  padding: '10px',
  textAlign: 'left',
  borderBottom: '2px solid #e5e7eb',
  fontWeight: '600',
  fontSize: '12px',
  letterSpacing: '0.04em',
  color: '#6b7280',
  textTransform: 'uppercase'
};

const tdStyle = { padding: '10px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' };

function Stat(props) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: '28px', fontWeight: 'bold', color: props.color || '#2563eb' }}>{props.value}</div>
      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {props.label}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState({ type: 'VACATION', startDate: '', endDate: '', reason: '' });

  useEffect(function () {
    let cancelled = false;

    async function load() {
      try {
        const meRes = await fetch('/api/auth/me');
        if (!meRes.ok) {
          router.push('/login');
          return;
        }
        const me = await meRes.json();
        if (cancelled) return;
        setUser(me);

        const reqRes = await fetch('/api/requests');
        const reqData = reqRes.ok ? await reqRes.json() : { requests: [] };
        if (cancelled) return;
        setRequests(reqData.requests || []);

        if (me.role === 'ADMIN' || me.role === 'APPROVER') {
          const empRes = await fetch('/api/employees');
          if (empRes.ok) {
            const empData = await empRes.json();
            if (!cancelled) setEmployees(empData.employees || []);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return function () {
      cancelled = true;
    };
  }, []);

  function update(e) {
    const next = Object.assign({}, form);
    next[e.target.name] = e.target.value;
    setForm(next);
  }

  async function refreshRequests() {
    const res = await fetch('/api/requests');
    if (res.ok) {
      const data = await res.json();
      setRequests(data.requests || []);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setMessage(null);

    if (!form.startDate || !form.endDate) {
      setMessage({ kind: 'error', text: 'Please choose a first and last day.' });
      return;
    }
    if (form.startDate < tomorrowIso()) {
      setMessage({
        kind: 'error',
        text: 'Politika e brendshme e kompanise nuk e lejon kerkesen ne timeframe 1 dite. Kerkesa duhet te filloje nga dita e neserme ose me vone.'
      });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        setMessage({ kind: 'error', text: data.error || 'The request could not be saved.' });
        setBusy(false);
        return;
      }
      setForm({ type: 'VACATION', startDate: '', endDate: '', reason: '' });
      setMessage({ kind: 'ok', text: 'Your leave request has been submitted.' });
      await refreshRequests();
    } catch (err) {
      setMessage({ kind: 'error', text: 'Something went wrong. Please try again.' });
    }
    setBusy(false);
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', color: '#6b7280' }}>Loading your dashboard...</div>
    );
  }
  if (!user) return null;

  const canSeeDirectory = user.role === 'ADMIN' || user.role === 'APPROVER';
  const eligibleFrom = eligibleFromDate(user.startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eligible = !eligibleFrom || today.getTime() >= eligibleFrom.getTime();

  const mine = requests || [];
  const usedDays = mine.filter(function (r) { return r.status === 'APPROVED'; })
    .reduce(function (sum, r) { return sum + (r.days || 0); }, 0);
  const pendingDays = mine.filter(function (r) { return r.status === 'PENDING'; })
    .reduce(function (sum, r) { return sum + (r.days || 0); }, 0);
  const allowance = user.allowance || 0;
  const remaining = allowance - usedDays - pendingDays;
  const beyond = remaining < 0 ? Math.abs(remaining) : 0;

  return (
    <Layout user={user}>
      <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '20px' }}>
        <h1 style={{ marginBottom: '4px' }}>My dashboard</h1>

        <div style={{ color: '#374151', marginBottom: '20px', fontSize: '14px' }}>
          <strong>{user.name}</strong>
          {user.position ? ' \u00b7 ' + user.position : ''}
          {user.department ? ' \u00b7 ' + user.department : ''}
          <div style={{ color: '#6b7280', fontSize: '13px', marginTop: '2px' }}>
            Employed since: {pretty(user.startDate)}
            {eligibleFrom ? ' \u00b7 leave entitlement from ' + pretty(eligibleFrom) : ''}
          </div>
        </div>

        {!eligible ? (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '6px', padding: '14px 16px', marginBottom: '20px', fontSize: '14px' }}>
            <strong>Nuk mund te kerkoni pushim edhe.</strong> Kerkohen 6 muaj pune ne kompani para se te
            aplikoni per pushim. You need 6 months of employment before you can request leave.
            {eligibleFrom ? ' Ju behet e mundur nga ' + pretty(eligibleFrom) + '.' : ''}
          </div>
        ) : null}

        {eligible && beyond > 0 ? (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: '6px', padding: '12px 16px', marginBottom: '20px', fontSize: '14px' }}>
            <strong>{beyond} day{beyond === 1 ? '' : 's'} beyond allowance.</strong> You have gone past your
            annual entitlement; the extra days are recorded as negative balance.
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '25px' }}>
          <Stat value={allowance} label="Annual allowance" />
          <Stat value={usedDays} label="Approved days used" />
          <Stat value={pendingDays} label="Days pending" />
          <Stat
            value={remaining}
            label={remaining < 0 ? 'Days beyond allowance' : 'Days remaining'}
            color={remaining < 0 ? '#dc2626' : '#2563eb'}
          />
        </div>

        <div style={panelStyle}>
          <h2 style={{ fontSize: '16px', margin: 0 }}>Leave policy (Kosovo Labour Law - Law No. 03/L-212)</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
            <thead>
              <tr>
                <th style={thStyle}>Leave type</th>
                <th style={thStyle}>Entitlement</th>
                <th style={thStyle}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {POLICY.map(function (row) {
                return (
                  <tr key={row[0]}>
                    <td style={tdStyle}>{row[0]}</td>
                    <td style={tdStyle}>{row[1]}</td>
                    <td style={Object.assign({}, tdStyle, { color: '#6b7280', fontSize: '13px' })}>{row[2]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '12px', marginBottom: 0 }}>
            This summary is provided for internal reference and is not legal advice. Please confirm specifics
            with HR or a labour law professional if needed.
          </p>
        </div>

        <div style={panelStyle}>
          <h2 style={{ fontSize: '16px', marginTop: 0 }}>New leave request</h2>
          <p style={{ color: '#6b7280', fontSize: '13px', marginTop: 0 }}>
            Company policy requires at least one full day of notice - the earliest day you can pick is
            {' ' + pretty(tomorrowIso()) + '.'}
          </p>
          <form onSubmit={submit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
              <div>
                <label htmlFor="type" style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Type</label>
                <select id="type" name="type" value={form.type} onChange={update} disabled={!eligible} style={{ width: '100%' }}>
                  {LEAVE_TYPES.map(function (t) {
                    return <option key={t.value} value={t.value}>{t.label}</option>;
                  })}
                </select>
              </div>
              <div>
                <label htmlFor="startDate" style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>First day</label>
                <input
                  id="startDate"
                  name="startDate"
                  type="date"
                  min={tomorrowIso()}
                  value={form.startDate}
                  onChange={update}
                  disabled={!eligible}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label htmlFor="endDate" style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Last day</label>
                <input
                  id="endDate"
                  name="endDate"
                  type="date"
                  min={form.startDate || tomorrowIso()}
                  value={form.endDate}
                  onChange={update}
                  disabled={!eligible}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div style={{ marginTop: '15px' }}>
              <label htmlFor="reason" style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Reason (optional)</label>
              <input id="reason" name="reason" value={form.reason} onChange={update} disabled={!eligible} style={{ width: '100%' }} />
            </div>
            {message ? (
              <div style={{ marginTop: '15px', padding: '10px 12px', borderRadius: '6px', fontSize: '14px', background: message.kind === 'ok' ? '#ecfdf5' : '#fef2f2', border: '1px solid ' + (message.kind === 'ok' ? '#a7f3d0' : '#fecaca'), color: message.kind === 'ok' ? '#065f46' : '#991b1b' }}>
                {message.text}
              </div>
            ) : null}
            <p style={{ marginTop: '18px', marginBottom: 0 }}>
              <button type="submit" disabled={busy || !eligible}>
                {busy ? 'Submitting...' : 'Submit request'}
              </button>
            </p>
          </form>
        </div>

        {canSeeDirectory ? (
          <div style={panelStyle}>
            <h2 style={{ fontSize: '16px', marginTop: 0 }}>Employee directory</h2>
            <p style={{ color: '#6b7280', fontSize: '13px', marginTop: 0 }}>
              {employees.length} active {employees.length === 1 ? 'person' : 'people'} - visible to administrators and approvers only. Select a row for details.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Full name</th>
                  <th style={thStyle}>Department</th>
                  <th style={thStyle}>Position</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Start date</th>
                  <th style={thStyle}>Leave eligible</th>
                </tr>
              </thead>
              <tbody>
                {employees.length > 0 ? employees.map(function (emp) {
                  return (
                    <tr
                      key={emp.id}
                      onClick={function () { setSelected(selected && selected.id === emp.id ? null : emp); }}
                      style={Object.assign({ cursor: 'pointer' }, selected && selected.id === emp.id ? { background: '#eff6ff' } : {})}
                    >
                      <td style={Object.assign({}, tdStyle, { fontWeight: '500' })}>{emp.name}</td>
                      <td style={tdStyle}>{emp.department || '-'}</td>
                      <td style={tdStyle}>{emp.position || '-'}</td>
                      <td style={Object.assign({}, tdStyle, { color: '#2563eb' })}>{emp.email}</td>
                      <td style={tdStyle}>{pretty(emp.startDate)}</td>
                      <td style={Object.assign({}, tdStyle, { color: emp.leaveEligible ? '#065f46' : '#991b1b', fontSize: '13px' })}>
                        {emp.leaveEligible ? 'Yes' : 'No - from ' + pretty(emp.leaveEligibleFrom)}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>
                      No active employees found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {selected ? (
              <div style={{ marginTop: '18px', padding: '16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '15px' }}>{selected.name}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 20px', fontSize: '13px', color: '#374151' }}>
                  <div><strong>Position:</strong> {selected.position || '-'}</div>
                  <div><strong>Department:</strong> {selected.department || '-'}</div>
                  <div><strong>Email:</strong> {selected.email}</div>
                  <div><strong>Role:</strong> {selected.role}</div>
                  <div><strong>Employed since:</strong> {pretty(selected.startDate)}</div>
                  <div><strong>Annual allowance:</strong> {selected.allowance} days</div>
                  <div>
                    <strong>Leave entitlement:</strong>{' '}
                    {selected.leaveEligible ? 'active' : 'starts ' + pretty(selected.leaveEligibleFrom)}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={panelStyle}>
          <h2 style={{ fontSize: '16px', marginTop: 0 }}>My requests</h2>
          {mine.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Dates</th>
                  <th style={thStyle}>Days</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {mine.map(function (req) {
                  return (
                    <tr key={req.id}>
                      <td style={tdStyle}>{req.type}</td>
                      <td style={tdStyle}>{pretty(req.startDate)} - {pretty(req.endDate)}</td>
                      <td style={tdStyle}>{req.days}</td>
                      <td style={tdStyle}><StatusBadge status={req.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p style={{ color: '#9ca3af', marginBottom: 0 }}>No requests yet.</p>
          )}
        </div>
      </div>
    </Layout>
  );
}
