import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { MONTH_LABELS, LEAVE_TYPES } from '../../lib/leave';

const YEARS = [2024, 2025, 2026, 2027];

function pretty(value) {
  if (!value) return '-';

  const d = new Date(value);

  if (isNaN(d.getTime())) return '-';

  return d.toLocaleDateString();
}

function blankBreakdown() {
  return {
    months: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    used: 0,
    planned: 0,
    remaining: null
  };
}

function breakdownFor(row, type) {
  const list = row.typeBreakdowns || [];

  for (let i = 0; i < list.length; i++) {
    if (list[i].type === type) {
      return list[i];
    }
  }

  return blankBreakdown();
}

function getEmployeeKey(row) {
  return row.id || (
    String(row.firstName || '') +
    '-' +
    String(row.lastName || '')
  );
}

export default function LeaveYearReport() {
  const router = useRouter();

  const [me, setMe] = useState(null);
  const [yearRows, setYearRows] = useState({});
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  /*
   * Load logged-in user
   */
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
  }, [router]);

  /*
   * Load all years
   */
  useEffect(
    function () {
      if (!me || denied) return;

      let cancelled = false;

      async function loadAllYears() {
        setLoading(true);

        try {
          const results = await Promise.all(
            YEARS.map(async function (year) {
              const res = await fetch(
                '/api/reports/leave-year?year=' + year
              );

              const data = await res.json();

              return {
                year: year,
                rows: data.rows || []
              };
            })
          );

          if (cancelled) return;

          const result = {};

          results.forEach(function (item) {
            result[item.year] = item.rows;
          });

          setYearRows(result);
          setLoading(false);
        } catch (error) {
          if (!cancelled) {
            setLoading(false);
          }
        }
      }

      loadAllYears();

      return function () {
        cancelled = true;
      };
    },
    [me, denied]
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
          <p
            className="muted"
            style={{ margin: 0 }}
          >
            This report is available to administrators and approvers only.
          </p>
        </div>
      </Layout>
    );
  }

  /*
   * Get all employees from all years.
   *
   * This makes sure that an employee still appears
   * even if they don't have data in one particular year.
   */
  const employeesMap = {};

  YEARS.forEach(function (year) {
    const rows = yearRows[year] || [];

    rows.forEach(function (row) {
      const key = getEmployeeKey(row);

      if (!employeesMap[key]) {
        employeesMap[key] = {
          id: row.id,
          firstName: row.firstName,
          lastName: row.lastName,
          startDate: row.startDate,
          years: {}
        };
      }

      employeesMap[key].years[year] = row;
    });
  });

  const employees = Object.keys(employeesMap).map(function (key) {
    return employeesMap[key];
  });

  return (
    <Layout user={me} wide>
      <h1 style={{ marginBottom: 6 }}>
        Leave calendar
      </h1>

      <p
        className="muted"
        style={{ marginTop: 0 }}
      >
        Days per month for every leave type, taken live from approved
        requests. Visible to administrators and approvers only.
      </p>

      <div className="card">
        <p
          className="muted"
          style={{ margin: 0 }}
        >
          {employees.length} employees on the company roster
        </p>
      </div>

      {loading ? (
        <div className="card">
          <p
            className="muted"
            style={{ margin: 0 }}
          >
            Building the report...
          </p>
        </div>
      ) : (
        LEAVE_TYPES.map(function (type) {
          /*
           * Calculate totals for every year
           */
          const yearlyTotals = {};

          YEARS.forEach(function (year) {
            let used = 0;
            let planned = 0;

            const months = [];

            for (let i = 0; i < 12; i++) {
              months.push(0);
            }

            employees.forEach(function (employee) {
              const row = employee.years[year];

              if (!row) return;

              const b = breakdownFor(
                row,
                type.value
              );

              used += Number(b.used || 0);
              planned += Number(b.planned || 0);

              b.months.forEach(function (value, index) {
                months[index] += Number(value || 0);
              });
            });

            yearlyTotals[year] = {
              used: used,
              planned: planned,
              months: months
            };
          });

          /*
           * Grand totals across 2024-2027
           */
          let grandUsed = 0;
          let grandPlanned = 0;

          YEARS.forEach(function (year) {
            grandUsed += yearlyTotals[year].used;
            grandPlanned += yearlyTotals[year].planned;
          });

          /*
           * Remaining is based on the latest/current
           * available year for each employee.
           */
          return (
            <div
              className="card"
              key={type.value}
              style={{
                overflowX: 'auto',
                overflowY: 'hidden'
              }}
            >
              <h2
                style={{
                  marginTop: 0,
                  marginBottom: 4
                }}
              >
                {type.label}
              </h2>

              <p
                className="muted"
                style={{ marginTop: 0 }}
              >
                {grandUsed} days already taken &middot;{' '}
                {grandPlanned} days planned
              </p>

              <div
                style={{
                  width: '100%',
                  overflowX: 'auto',
                  overflowY: 'visible'
                }}
              >
                <table
                  style={{
                    fontSize: 13,
                    minWidth: 2550,
                    borderCollapse: 'separate',
                    borderSpacing: 0
                  }}
                >
                  <thead>
                    {/* YEAR HEADER */}
                    <tr>
                      <th
                        rowSpan={2}
                        style={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 5,
                          background: '#fff',
                          minWidth: 110,
                          width: 110
                        }}
                      >
                        First name
                      </th>

                      <th
                        rowSpan={2}
                        style={{
                          position: 'sticky',
                          left: 110,
                          zIndex: 5,
                          background: '#fff',
                          minWidth: 110,
                          width: 110
                        }}
                      >
                        Last name
                      </th>

                      <th
                        rowSpan={2}
                        style={{
                          position: 'sticky',
                          left: 220,
                          zIndex: 5,
                          background: '#fff',
                          minWidth: 110,
                          width: 110,
                          boxShadow:
                            '3px 0 5px rgba(0,0,0,0.08)'
                        }}
                      >
                        Start date
                      </th>

                      {YEARS.map(function (year) {
                        return (
                          <th
                            key={year}
                            colSpan={12}
                            style={{
                              textAlign: 'center',
                              fontWeight: 700,
                              fontSize: 14,
                              minWidth: 600,
                              background: '#f5f7fa',
                              borderLeft:
                                '1px solid #dfe3e8',
                              borderRight:
                                '1px solid #dfe3e8'
                            }}
                          >
                            {year}
                          </th>
                        );
                      })}

                      <th
                        colSpan={3}
                        style={{
                          textAlign: 'center',
                          fontWeight: 700,
                          fontSize: 14,
                          minWidth: 270,
                          background: '#f5f7fa',
                          borderLeft:
                            '1px solid #dfe3e8'
                        }}
                      >
                        TOTAL
                      </th>
                    </tr>

                    {/* MONTH HEADER */}
                    <tr>
                      {YEARS.map(function (year) {
                        return MONTH_LABELS.map(
                          function (label) {
                            return (
                              <th
                                key={
                                  year + '-' + label
                                }
                                style={{
                                  textAlign: 'center',
                                  minWidth: 50,
                                  width: 50,
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {label}
                              </th>
                            );
                          }
                        );
                      })}

                      <th
                        style={{
                          textAlign: 'center',
                          minWidth: 90
                        }}
                      >
                        Used
                      </th>

                      <th
                        style={{
                          textAlign: 'center',
                          minWidth: 90
                        }}
                      >
                        Planned
                      </th>

                      <th
                        style={{
                          textAlign: 'center',
                          minWidth: 90
                        }}
                      >
                        Remaining
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {employees.map(function (employee) {
                      let totalUsed = 0;
                      let totalPlanned = 0;

                      /*
                       * Calculate total remaining.
                       *
                       * We use the latest available remaining
                       * value for the employee.
                       */
                      let remaining = null;

                      YEARS.forEach(function (year) {
                        const row =
                          employee.years[year];

                        if (!row) return;

                        const b = breakdownFor(
                          row,
                          type.value
                        );

                        totalUsed += Number(
                          b.used || 0
                        );

                        totalPlanned += Number(
                          b.planned || 0
                        );

                        if (b.remaining !== null) {
                          remaining = b.remaining;
                        }
                      });

                      return (
                        <tr
                          key={getEmployeeKey(
                            employee
                          )}
                        >
                          {/* FROZEN FIRST NAME */}
                          <td
                            style={{
                              position: 'sticky',
                              left: 0,
                              zIndex: 2,
                              background: '#fff',
                              minWidth: 110,
                              width: 110
                            }}
                          >
                            {employee.firstName}
                          </td>

                          {/* FROZEN LAST NAME */}
                          <td
                            style={{
                              position: 'sticky',
                              left: 110,
                              zIndex: 2,
                              background: '#fff',
                              minWidth: 110,
                              width: 110
                            }}
                          >
                            {employee.lastName}
                          </td>

                          {/* FROZEN START DATE */}
                          <td
                            style={{
                              position: 'sticky',
                              left: 220,
                              zIndex: 2,
                              background: '#fff',
                              minWidth: 110,
                              width: 110,
                              boxShadow:
                                '3px 0 5px rgba(0,0,0,0.08)'
                            }}
                          >
                            {pretty(
                              employee.startDate
                            )}
                          </td>

                          {/* YEARS */}
                          {YEARS.map(function (year) {
                            const row =
                              employee.years[year];

                            const b = row
                              ? breakdownFor(
                                  row,
                                  type.value
                                )
                              : blankBreakdown();

                            return b.months.map(
                              function (
                                n,
                                index
                              ) {
                                return (
                                  <td
                                    key={
                                      year +
                                      '-' +
                                      index
                                    }
                                    style={{
                                      textAlign:
                                        'center',
                                      minWidth: 50,
                                      width: 50
                                    }}
                                  >
                                    {n ? n : ''}
                                  </td>
                                );
                              }
                            );
                          })}

                          {/* TOTAL USED */}
                          <td
                            style={{
                              textAlign: 'center',
                              fontWeight: 600,
                              minWidth: 90
                            }}
                          >
                            {totalUsed}
                          </td>

                          {/* TOTAL PLANNED */}
                          <td
                            style={{
                              textAlign: 'center',
                              fontWeight: 600,
                              minWidth: 90
                            }}
                          >
                            {totalPlanned}
                          </td>

                          {/* REMAINING */}
                          <td
                            style={{
                              textAlign: 'center',
                              fontWeight: 600,
                              minWidth: 90
                            }}
                          >
                            {remaining === null
                              ? '-'
                              : remaining}
                          </td>
                        </tr>
                      );
                    })}

                    {/* ALL EMPLOYEES */}
                    <tr>
                      <th
                        colSpan={3}
                        style={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 2,
                          background: '#fff',
                          textAlign: 'right',
                          boxShadow:
                            '3px 0 5px rgba(0,0,0,0.08)'
                        }}
                      >
                        All employees
                      </th>

                      {YEARS.map(function (year) {
                        return yearlyTotals[
                          year
                        ].months.map(
                          function (n, index) {
                            return (
                              <th
                                key={
                                  year +
                                  '-total-' +
                                  index
                                }
                                style={{
                                  textAlign:
                                    'center',
                                  minWidth: 50
                                }}
                              >
                                {n ? n : ''}
                              </th>
                            );
                          }
                        );
                      })}

                      <th
                        style={{
                          textAlign: 'center'
                        }}
                      >
                        {grandUsed}
                      </th>

                      <th
                        style={{
                          textAlign: 'center'
                        }}
                      >
                        {grandPlanned}
                      </th>

                      <th></th>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}

      <p
        className="muted"
        style={{ marginTop: 4 }}
      >
        Total used = approved days that have already
        passed. Total planned = approved days still in
        the future. Remaining = allowance minus used
        and planned. Every leave type keeps its own
        separate balance.
      </p>
    </Layout>
  );
}
