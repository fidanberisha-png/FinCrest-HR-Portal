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
  {
    type: 'Annual leave / PTO',
    entitlement: '20 paid working days / year',
    notes: 'Standard yearly entitlement.'
  },
  {
    type: 'Sick leave',
    entitlement: '20 paid days / year',
    notes: '1-2 days: no approval needed, notification only, no medical certificate required. From day 3 onward: approval required and a medical certificate is needed.'
  },
  {
    type: 'Unpaid leave',
    entitlement: 'No fixed limit',
    notes: 'Subject to agreement with your manager.'
  },
  {
    type: 'Parental leave',
    entitlement: 'Maternity up to 12 months; paternity/childbirth leave paid days',
    notes: 'Maternity: 6 months full pay, 3 months partial pay, 3 months unpaid extension. Paternity: a few paid days around childbirth.'
  },
  {
    type: 'Other (special circumstances)',
    entitlement: '5 paid days (default)',
    notes: 'Covers events such as marriage, voluntary blood donation (1 paid day per donation), and bereavement.'
  }
];

// Kosovo Labour Law: annual leave entitlement is earned after 6 months of
// service. This is shown for information only - leave requests are never
// blocked for anyone.
const MIN_SERVICE_MONTHS = 6;

function tomorrowIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function pretty(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString();
}

function entitlementStart(startDate) {
  if (!startDate) return null;
  const d = new Date(startDate);
  if (isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + MIN_SERVICE_MONTHS);
  d.setHours(0, 0, 0, 0);
  return d;
}

function hasEntitlement(startDate) {
  const from = entitlementStart(startDate);
  if (!from) return true;
  return Date.now() >= from.getTime();
}

function daysWithStatus(list, status) {
  const year = new Date().getFullYear();
  let total = 0;
  list.forEach(function (item) {
    if (item.status !== status) return;
    const when = new Date(item.startDate);
    if (when.getFullYear() !== year) return;
    total += item.days || 0;
  });
  return total;
}

function Stat(props) {
  return (
    <div className="stat">
      <div className="n">{props.n}</div>
      <div className="l">{props.l}</div>
    </div>
  );
}

// The summary card - name, department, position, employment date, the six
// month notice and the four counters. Nothing else.
function Summary(props) {
  const person = props.person;
  const from = entitlementStart(person.startDate);
  const entitled = hasEntitlement(person.startDate);
  const beyond = person.allowance - person.used;

  return (
    <div>
      <h1 style={{ marginBottom: 6 }}>My dashboard</h1>
      <p style={{ margin: '0 0 2px' }}>
        <strong>{person.name}</strong>
        {person.department ? ' \u00b7 ' + person.department : ''}
        {person.position ? ' \u00b7 ' + person.position : ''}
      </p>
      <p className="muted" style={{ margin: '0 0 14px' }}>
        Employed since: {pretty(person.startDate)}
        {from ? ' \u00b7 annual leave entitlement from ' + pretty(from) : ''}
      </p>

      {!entitled && from ? (
        <div
          style={{
            background: '#fdeceb',
            color: '#b42318',
            padding: '11px 13px',
            borderRadius: 8,
            fontSize: 14,
            marginBottom: 16
          }}
        >
          <strong>Paid annual leave has not started yet.</strong> Under the Kosovo Labour
          Law, an employee earns annual leave entitlement after six months of service.
          This entitlement begins on {pretty(from)}. Leave requests can still be
          submitted at any time and are sent to the manager for approval.
        </div>
      ) : null}

      <div className="stats">
        <Stat n={person.allowance} l="Annual allowance" />
        <Stat n={person.used} l="Approved days used" />
        <Stat n={person.pending} l="Days pending" />
        <Stat n={beyond} l="Days remaining" />
      </div>

      {entitled && beyond < 0 ? (
        <p style={{ marginTop: 12 }}>
          <span className="badge REJECTED">
            {Math.abs(beyond)} days taken beyond the annual allowance
          </span>
        </p>
      ) : null}
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [requests, setRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [form, setForm] = useState({
    type: 'VACATION',
    startDate: '',
    endDate: '',
    reason: ''
  });

  useEffect(function () {
    let cancelled = false;

    async function load() {
      const meRes = await fetch('/api/auth/me');
      if (meRes.status === 401) {
        router.replace('/login');
        return;
      }
      const user = await meRes.json().catch(function () {
        return null;
      });
      if (cancelled || !user) return;
      setMe(user);

      const reqRes = await fetch('/api/requests?scope=mine');
      const reqData = await reqRes.json().catch(function () {
        return {};
      });
      if (!cancelled) setRequests(reqData.requests || []);

      if (user.role === 'ADMIN' || user.role === 'APPROVER') {
        const empRes = await fetch('/api/employees');
        const empData = await empRes.json().catch(function () {
          return {};
        });
        if (!cancelled) setEmployees(empData.employees || []);
      }

      if (!cancelled) setLoading(false);
    }

    load().catch(function (err) {
      if (!cancelled) {
        setError(err.message);
        setLoading(false);
      }
    });

    return function () {
      cancelled = true;
    };
  }, []);

  async function reloadRequests() {
    const res = await fetch('/api/requests?scope=mine');
    const data = await res.json().catch(function () {
      return {};
    });
    setRequests(data.requests || []);
  }

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
    setOkMsg('');
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
      setError(data.error || 'The request could not be saved');
      return;
    }
    setOkMsg(data.note || 'Your leave request has been submitted.');
    setForm({ type: 'VACATION', startDate: '', endDate: '', reason: '' });
    reloadRequests();
  }

  if (loading || !me) {
    return (
      <Layout user={me || {}}>
        <p className="muted">Loading...</p>
      </Layout>
    );
  }

  const canSeeDirectory = me.role === 'ADMIN' || me.role === 'APPROVER';
  const used = daysWithStatus(requests, 'APPROVED');
  const pending = daysWithStatus(requests, 'PENDING');
  const myAllowance = me.allowance || 0;

  const mySummary = {
    name: me.name,
    department: me.department,
    position: me.position,
    startDate: me.startDate,
    allowance: myAllowance,
    used: used,
    pending: pending
  };

  const picked = employees.filter(function (row) {
    return row.id === selected;
  })[0];

  const pickedSummary = picked
    ? {
        name: picked.name,
        department: picked.department,
        position: picked.position,
        startDate: picked.startDate,
        allowance: picked.allowance || 0,
        used: picked.usedDays || 0,
        pending: picked.pendingDays || 0
      }
    : null;

  const directory = (
    <div className="card">
      <h2>Employee directory</h2>
      <p className="muted" style={{ marginTop: -8 }}>
        {employees.length} active people - visible to administrators and approvers only.
        Select a row to see that person on the dashboard, click it again to go back to
        your own.
      </p>
      <table>
        <thead>
          <tr>
            <th>Full name</th>
            <th>Department</th>
            <th>Position</th>
            <th>Start date</th>
          </tr>
        </thead>
        <tbody>
          {employees.map(function (row) {
            const on = row.id === selected;
            return (
              <tr
                key={row.id}
                className={on ? 'pick on' : 'pick'}
                onClick={function () {
                  setSelected(on ? '' : row.id);
                }}
              >
                <td>
                  <strong>{row.name}</strong>
                </td>
                <td>{row.department || '-'}</td>
                <td>{row.position || '-'}</td>
                <td>{pretty(row.startDate)}</td>
              </tr>
            );
          })}
          {employees.length === 0 ? (
            <tr>
              <td colSpan={4} className="muted">
                No active employees found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {picked ? (
        <div
          style={{
            marginTop: 16,
            borderTop: '1px solid #e3e6ea',
            paddingTop: 14,
            fontSize: 14
          }}
        >
          <p style={{ margin: '0 0 8px' }}>
            <strong>{picked.name}</strong>
          </p>
          <p style={{ margin: '0 0 4px' }}>Position: {picked.position || '-'}</p>
          <p style={{ margin: '0 0 4px' }}>Department: {picked.department || '-'}</p>
          <p style={{ margin: '0 0 4px' }}>Email: {picked.email}</p>
          <p style={{ margin: '0 0 4px' }}>Role: {picked.role}</p>
          <p style={{ margin: '0 0 4px' }}>Employed since: {pretty(picked.startDate)}</p>
          <p style={{ margin: '0 0 4px' }}>Annual allowance: {picked.allowance} days</p>
          <p style={{ margin: 0 }}>
            Leave entitlement:{' '}
            {picked.leaveEligible
              ? 'active'
              : 'starts ' + pretty(picked.leaveEligibleFrom)}
          </p>
        </div>
      ) : null}
    </div>
  );

  const policyCard = (
    <div className="card">
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
          {POLICY.map(function (row) {
            return (
              <tr key={row.type}>
                <td>{row.type}</td>
                <td>{row.entitlement}</td>
                <td className="muted">{row.notes}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted" style={{ marginTop: 12 }}>
        This summary is provided for internal reference and is not legal advice. Please
        confirm specifics with HR or a labour law professional if needed.
      </p>
    </div>
  );

  const requestCard = (
    <div className="card">
      <h2>New leave request</h2>
      <form onSubmit={submit}>
        <div className="row">
          <div>
            <label htmlFor="type">Type</label>
            <select id="type" value={form.type} onChange={update('type')}>
              {LEAVE_TYPES.map(function (item) {
                return (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label htmlFor="startDate">First day</label>
            <input
              id="startDate"
              type="date"
              min={tomorrowIso()}
              value={form.startDate}
              onChange={update('startDate')}
              required
            />
          </div>
          <div>
            <label htmlFor="endDate">Last day</label>
            <input
              id="endDate"
              type="date"
              min={form.startDate || tomorrowIso()}
              value={form.endDate}
              onChange={update('endDate')}
              required
            />
          </div>
        </div>
        <p className="note" style={{ marginTop: 12 }}>
          Reminder: a leave request must start tomorrow or later. The internal company
          policy does not allow a request within a one day timeframe.
        </p>
        <label htmlFor="reason">Reason (optional)</label>
        <textarea id="reason" value={form.reason} onChange={update('reason')} />
        {error ? <div className="err">{error}</div> : null}
        {okMsg ? <div className="ok-msg">{okMsg}</div> : null}
        <p style={{ marginTop: 16 }}>
          <button type="submit" disabled={busy}>
            {busy ? 'Submitting...' : 'Submit request'}
          </button>
        </p>
      </form>
    </div>
  );

  const myRequestsCard = (
    <div className="card">
      <h2>My requests</h2>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Dates</th>
            <th>Days</th>
            <th>Status</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {requests.map(function (row) {
            return (
              <tr key={row.id}>
                <td>{row.type}</td>
                <td>
                  {pretty(row.startDate)} - {pretty(row.endDate)}
                </td>
                <td>{row.days}</td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td className="muted">{row.decisionNote || row.reason || '-'}</td>
              </tr>
            );
          })}
          {requests.length === 0 ? (
            <tr>
              <td colSpan={5} className="muted">
                You have no leave requests yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );

  const rightColumn = pickedSummary ? (
    <Summary person={pickedSummary} />
  ) : (
    <div>
      <Summary person={mySummary} />
      <div style={{ marginTop: 20 }}>
        {policyCard}
        {requestCard}
        {myRequestsCard}
      </div>
    </div>
  );

  return (
    <Layout user={me} wide={canSeeDirectory}>
      {canSeeDirectory ? (
        <div className="split">
          <div className="side">{directory}</div>
          <div className="main">{rightColumn}</div>
        </div>
      ) : (
        rightColumn
      )}
    </Layout>
  );
}
