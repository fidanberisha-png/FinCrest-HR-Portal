import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { MONTH_LABELS, LEAVE_TYPES } from '../../lib/leave';

function pretty(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString();
}

const YEARS = [2024, 2025, 2026, 2027, 2028];

function blankBreakdown() {
  return { months: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], used: 0, planned: 0, remaining: null };
}

function breakdownFor(row, type) {
  const list = row.typeBreakdowns || [];
  for (let i = 0; i < list.length; i++) {
    if (list[i].type === type) return list[i];
  }
  return blankBreakdown();
}

export default function LeaveYearReport() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(function () {
    let cancelled = false;

    async function loadUser() {
      const res = await fetch('/api/auth/me');
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      const user = await res.json().catch(function () {
        return null;
      });
      if (cancelled || !user) return;
      setMe(user);
      if (user.role !== 'ADMIN' && user.role !== 'APPROVER') {
        setDenied(true);
        setLoading(false);
      }
    }

    loadUser();
    return function () {
      cancelled = true;
    };
  }, []);

  useEffect(
    function () {
      if (!me || denied) return;
      let cancelled = false;
      setLoading(true);

      fetch('/api/reports/leave-year?year=' + year)
        .then(function (res) {
          return res.json();
        })
        .then(function (data) {
          if (cancelled) return;
          setRows(data.rows || []);
          setLoading(false);
        })
        .catch(function () {
          if (!cancelled) setLoading(false);
        });

      return function () {
        cancelled = true;
      };
    },
    [me, year, denied]
  );

  if (!me) {
    return (
      <Layout user={{}}>
        <p className="muted">Loading...</p>
      </Layout>
    );
  }

  if (denied) {
    return (
      <Layout user={me}>
        <h1>Leave calendar</h1>
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            This report is available to administrators and approvers only.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={me} wide>
      <h1 style={{ marginBottom: 6 }}>Leave calendar {year}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Days per month for every leave type, taken live from approved requests. Visible to
        administrators and approvers only.
      </p>

      <div className="card">
        <p className="muted" style={{ margin: '0 0 10px 0' }}>
          {rows.length} employees on the company roster
        </p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {YEARS.map(function (item) {
            const active = item === year;
            return (
              <button
                key={item}
                type="button"
                onClick={function () {
                  setYear(item);
                }}
                className={active ? 'year-tab year-tab-active' : 'year-tab'}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      {loading
        ? (
          <div className="card">
            <p className="muted" style={{ margin: 0 }}>
              Building the report...
            </p>
          </div>
        )
        : LEAVE_TYPES.map(function (type) {
          let totalUsed = 0;
          let totalPlanned = 0;
          const monthTotals = [];
          for (let i = 0; i < 12; i++) monthTotals.push(0);
          rows.forEach(function (row) {
            const b = breakdownFor(row, type.value);
            totalUsed += b.used;
            totalPlanned += b.planned;
            b.months.forEach(function (n, index) {
              monthTotals[index] += n;
            });
          });

          return (
            <div className="card" key={type.value} style={{ overflowX: 'auto' }}>
              <h2 style={{ marginTop: 0, marginBottom: 4 }}>{type.label}</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                {totalUsed} days already taken &middot; {totalPlanned} days planned
              </p>
              <table style={{ fontSize: 13, minWidth: 1150 }}>
                <thead>
                  <tr>
                    <th>First name</th>
                    <th>Last name</th>
                    <th>Start date</th>
                    {MONTH_LABELS.map(function (label) {
                      return (
                        <th key={label} style={{ textAlign: 'center' }}>
                          {label}
                        </th>
                      );
                    })}
                    <th style={{ textAlign: 'center' }}>Total used</th>
                    <th style={{ textAlign: 'center' }}>Total planned</th>
                    <th style={{ textAlign: 'center' }}>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(function (row) {
                    const b = breakdownFor(row, type.value);
                    return (
                      <tr key={row.id}>
                        <td>{row.firstName}</td>
                        <td>{row.lastName}</td>
                        <td>{pretty(row.startDate)}</td>
                        {b.months.map(function (n, index) {
                          return (
                            <td key={index} style={{ textAlign: 'center' }}>
                              {n ? n : ''}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'center' }}>{b.used}</td>
                        <td style={{ textAlign: 'center' }}>{b.planned}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>
                          {b.remaining === null ? '-' : b.remaining}
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <th colSpan={3} style={{ textAlign: 'right' }}>
                      All employees
                    </th>
                    {monthTotals.map(function (n, index) {
                      return (
                        <th key={index} style={{ textAlign: 'center' }}>
                          {n ? n : ''}
                        </th>
                      );
                    })}
                    <th style={{ textAlign: 'center' }}>{totalUsed}</th>
                    <th style={{ textAlign: 'center' }}>{totalPlanned}</th>
                    <th></th>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}

      <p className="muted" style={{ marginTop: 4 }}>
        Total used = approved days that have already passed. Total planned = approved days
        still in the future. Remaining = allowance minus used and planned; leave types with no
        fixed limit show &quot;-&quot;. Every leave type keeps its own separate balance.
      </p>
    </Layout>
  );
}
