import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import { LEAVE_TYPES, balancesByType, balanceFor } from '../lib/leave';

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

// One row per leave type - every type keeps its own separate pool of days.
function BalanceTable(props) {
  const balances = props.balances || [];
  const entitled = props.entitled;
  return (
    <table>
      <thead>
        <tr>
          <th>Leave type</th>
          <th style={{ textAlign: 'center' }}>Allowance</th>
          <th style={{ textAlign: 'center' }}>Used</th>
          <th style={{ textAlign: 'center' }}>Planned</th>
          <th style={{ textAlign: 'center' }}>Pending</th>
          <th style={{ textAlign: 'center' }}>Remaining</th>
        </tr>
      </thead>
      <tbody>
        {balances.map(function (row) {
          const unlimited = row.allowance === null;
          const negative = !unlimited && row.remaining < 0;
          return (
            <tr key={row.type}>
              <td>{row.label}</td>
              <td style={{ textAlign: 'center' }}>
                {unlimited ? 'No fixed limit' : row.allowance}
              </td>
              <td style={{ textAlign: 'center' }}>{row.used}</td>
              <td style={{ textAlign: 'center' }}>{row.planned}</td>
              <td style={{ textAlign: 'center' }}>{row.pending}</td>
              <td
                style={{
                  textAlign: 'center',
                  fontWeight: 700,
                  color: negative ? '#b42318' : unlimited ? '#6b7280' : '#0f7b3f'
                }}
              >
                {unlimited ? '-' : row.remaining}
                {negative && entitled ? (
                  <span className="badge REJECTED" style={{ marginLeft: 6 }}>
                    {Math.abs(row.remaining)} beyond allowance
                  </span>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// Name, department, position, employment date, the six month notice and the
// separate balance of every leave type. Nothing else.
function Summary(props) {
  const person = props.person;
  const from = entitlementStart(person.startDate);
  const entitled = hasEntitlement(person.startDate);
  const year = new Date().getFullYear();

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

      <div className="card">
        <h2>Leave balances {year}</h2>
        <p className="muted" style={{ marginTop: -8 }}>
          Every leave type has its own separate pool of days. Days taken from one type
          never reduce the balance of another type.
        </p>
        <BalanceTable balances={person.balances} entitled={entitled} />
      </div>
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

  async function reloadAll() {
    const res = await fetch('/api/requests?scope=mine');
    const data = await res.json().catch(function () {
      return {};
    });
    setRequests(data.requests || []);
    if (me && (me.role === 'ADMIN' || me.role === 'APPROVER')) {
      const empRes = await fetch('/api/employees');
      const empData = await empRes.json().catch(function () {
        return {};
      });
      setEmployees(empData.employees || []);
    }
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
    reloadAll();
  }

  if (loading || !me) {
    return (
      <Layout user={me || {}}>
        <p className="muted">Loading...</p>
      </Layout>
    );
  }

  const canSeeDirectory = me.role === 'ADMIN' || me.role === 'APPROVER';
  const year = new Date().getFullYear();
  const myBalances = balancesByType(requests, year, me.allowance);
  const selectedBalance = balanceFor(myBalances, form.type);

  const mySummary = {
    name: me.name,
    department: me.department,
    position: me.position,
    startDate: me.startDate,
    balances: myBalances
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
        balances: picked.balances || []
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

        {selectedBalance ? (
          <p className="note" style={{ marginTop: 12 }}>
            <strong>{selectedBalance.label}:</strong>{' '}
            {selectedBalance.allowance === null
              ? 'no fixed limit for this type.'
              : selectedBalance.remaining +
                ' of ' +
                selectedBalance.allowance +
                ' days still available this year (' +
                selectedBalance.used +
                ' used, ' +
                selectedBalance.planned +
                ' planned, ' +
                selectedBalance.pending +
                ' pending). This pool is separate from every other leave type.'}
          </p>
        ) : null}

        <p className="note soft" style={{ marginTop: 10 }}>
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
      <div>
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
