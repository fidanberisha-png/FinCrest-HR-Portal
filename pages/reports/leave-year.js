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
  const list = row?.typeBreakdowns || [];

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

function emptyMonths() {
  return Array(12).fill(0);
}

function addMonths(target, source) {
  source.forEach(function (value, index) {
    target[index] += Number(value || 0);
  });
}

export default function LeaveYearReport() {
  const router = useRouter();

  const [me, setMe] = useState(null);
  const [yearRows, setYearRows] = useState({});
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [openRows, setOpenRows] = useState({});

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

              if (!res.ok) {
                throw new Error('Failed to load ' + year);
              }

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
          <p className="muted" style={{ margin: 0 }}>
            This report is available to administrators and approvers only.
          </p>
        </div>
      </Layout>
    );
  }

  /*
   * Merge the employees from all years into one employee list.
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

  /*
   * One table only.
   *
   * Employee row:
   *   - shows the totals for all leave types combined
   *   - click the row to open/close the leave-type rows
   *
   * Expanded rows:
   *   - PTO
   *   - Sick Leave
   *   - Unpaid Leave
   *   - Parental Leave
   *   - Other
   */
  return (
    <Layout user={me} wide>
      <h1 style={{ marginBottom: 6 }}>
        Leave calendar
      </h1>

      <p className="muted" style={{ marginTop: 0 }}>
        Days per month for every leave type, taken live from approved
        requests. Visible to administrators and approvers only.
      </p>

      <div className="card">
        <p className="muted" style={{ margin: 0 }}>
          {employees.length} employees on the company roster
        </p>
      </div>

      {loading ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Building the report...
          </p>
        </div>
      ) : (
        <div
          className="card"
          style={{
            padding: 0,
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              width: '100%',
              overflowX: 'auto',
              overflowY: 'hidden'
            }}
          >
            <table
              style={{
                fontSize: 13,
                minWidth: 2750,
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
                      zIndex: 10,
                      background: '#fff',
                      minWidth: 120,
                      width: 120
                    }}
                  >
                    First name
                  </th>

                  <th
                    rowSpan={2}
                    style={{
                      position: 'sticky',
                      left: 120,
                      zIndex: 10,
                      background: '#fff',
                      minWidth: 120,
                      width: 120
                    }}
                  >
                    Last name
                  </th>

                  <th
                    rowSpan={2}
                    style={{
                      position: 'sticky',
                      left: 240,
                      zIndex: 10,
                      background: '#fff',
                      minWidth: 120,
                      width: 120,
                      boxShadow: '4px 0 6px rgba(0,0,0,0.08)'
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
                          borderLeft: '1px solid #dfe3e8',
                          borderRight: '1px solid #dfe3e8'
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
                      borderLeft: '1px solid #dfe3e8'
                    }}
                  >
                    TOTAL
                  </th>
                </tr>

                {/* MONTH HEADER */}
                <tr>
                  {YEARS.map(function (year) {
                    return MONTH_LABELS.map(function (label, index) {
                      return (
                        <th
                          key={year + '-' + index}
                          style={{
                            textAlign: 'center',
                            minWidth: 50,
                            width: 50,
                            whiteSpace: 'nowrap',
                            background: '#fff'
                          }}
                        >
                          {label}
                        </th>
                      );
                    });
                  })}

                  <th
                    style={{
                      textAlign: 'center',
                      minWidth: 90,
                      background: '#fff'
                    }}
                  >
                    Used
                  </th>

                  <th
                    style={{
                      textAlign: 'center',
                      minWidth: 90,
                      background: '#fff'
                    }}
                  >
                    Planned
                  </th>

                  <th
                    style={{
                      textAlign: 'center',
                      minWidth: 90,
                      background: '#fff'
                    }}
                  >
                    Remaining
                  </th>
                </tr>
              </thead>

              <tbody>
                {employees.map(function (employee) {
                  const employeeKey = getEmployeeKey(employee);
                  const isOpen = !!openRows[employeeKey];

                  /*
                   * Totals for the employee.
                   *
                   * These are all leave types combined.
                   */
                  const combinedMonths = {};

                  YEARS.forEach(function (year) {
                    combinedMonths[year] = emptyMonths();
                  });

                  let totalUsed = 0;
                  let totalPlanned = 0;
                  let totalRemaining = 0;
                  let hasRemaining = false;

                  YEARS.forEach(function (year) {
                    const row = employee.years[year];

                    if (!row) return;

                    LEAVE_TYPES.forEach(function (type) {
                      const b = breakdownFor(row, type.value);

                      addMonths(
                        combinedMonths[year],
                        b.months
                      );

                      totalUsed += Number(b.used || 0);
                      totalPlanned += Number(b.planned || 0);

                      if (b.remaining !== null && b.remaining !== undefined) {
                        totalRemaining += Number(b.remaining || 0);
                        hasRemaining = true;
                      }
                    });
                  });

                  return (
                    <>
                      {/* =========================
                          EMPLOYEE TOTAL ROW
                          ========================= */}
                      <tr
                        key={employeeKey}
                        onClick={function () {
                          setOpenRows(function (previous) {
                            return {
                              ...previous,
                              [employeeKey]: !previous[employeeKey]
                            };
                          });
                        }}
                        style={{
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        <td
                          style={{
                            position: 'sticky',
                            left: 0,
                            zIndex: 5,
                            background: '#fff',
                            minWidth: 120,
                            width: 120,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-block',
                              width: 18
                            }}
                          >
                            {isOpen ? '▼' : '▶'}
                          </span>
                          {employee.firstName}
                        </td>

                        <td
                          style={{
                            position: 'sticky',
                            left: 120,
                            zIndex: 5,
                            background: '#fff',
                            minWidth: 120,
                            width: 120,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {employee.lastName}
                        </td>

                        <td
                          style={{
                            position: 'sticky',
                            left: 240,
                            zIndex: 5,
                            background: '#fff',
                            minWidth: 120,
                            width: 120,
                            whiteSpace: 'nowrap',
                            boxShadow: '4px 0 6px rgba(0,0,0,0.08)'
                          }}
                        >
                          {pretty(employee.startDate)}
                        </td>

                        {/* Combined monthly totals for the employee */}
                        {YEARS.map(function (year) {
                          return combinedMonths[year].map(function (value, index) {
                            return (
                              <td
                                key={
                                  employeeKey +
                                  '-' +
                                  year +
                                  '-' +
                                  index
                                }
                                style={{
                                  textAlign: 'center',
                                  minWidth: 50,
                                  width: 50
                                }}
                              >
                                {value ? value : ''}
                              </td>
                            );
                          });
                        })}

                        <td
                          style={{
                            textAlign: 'center',
                            fontWeight: 700,
                            minWidth: 90
                          }}
                        >
                          {totalUsed}
                        </td>

                        <td
                          style={{
                            textAlign: 'center',
                            fontWeight: 700,
                            minWidth: 90
                          }}
                        >
                          {totalPlanned}
                        </td>

                        <td
                          style={{
                            textAlign: 'center',
                            fontWeight: 700,
                            minWidth: 90
                          }}
                        >
                          {hasRemaining ? totalRemaining : '-'}
                        </td>
                      </tr>

                      {/* =========================
                          DROPDOWN LEAVE TYPES
                          ========================= */}
                      {isOpen &&
                        LEAVE_TYPES.map(function (type) {
                          /*
                           * Each leave type has its own row.
                           */
                          let typeUsed = 0;
                          let typePlanned = 0;
                          let typeRemaining = null;

                          YEARS.forEach(function (year) {
                            const row = employee.years[year];

                            if (!row) return;

                            const b = breakdownFor(
                              row,
                              type.value
                            );

                            typeUsed += Number(b.used || 0);
                            typePlanned += Number(b.planned || 0);

                            /*
                             * Use the latest available remaining
                             * value for this leave type.
                             */
                            if (
                              b.remaining !== null &&
                              b.remaining !== undefined
                            ) {
                              typeRemaining = b.remaining;
                            }
                          });

                          return (
                            <tr
                              key={
                                employeeKey +
                                '-' +
                                type.value
                              }
                              style={{
                                background: '#fafbfc'
                              }}
                            >
                              <td
                                colSpan={3}
                                style={{
                                  position: 'sticky',
                                  left: 0,
                                  zIndex: 4,
                                  background: '#fafbfc',
                                  minWidth: 360,
                                  boxShadow: '4px 0 6px rgba(0,0,0,0.05)',
                                  paddingLeft: 34,
                                  fontWeight: 500
                                }}
                              >
                                {type.label}
                              </td>

                              {YEARS.map(function (year) {
                                const row =
                                  employee.years[year];

                                const b = row
                                  ? breakdownFor(
                                      row,
                                      type.value
                                    )
                                  : blankBreakdown();

                                return b.months.map(function (
                                  value,
                                  index
                                ) {
                                  return (
                                    <td
                                      key={
                                        employeeKey +
                                        '-' +
                                        type.value +
                                        '-' +
                                        year +
                                        '-' +
                                        index
                                      }
                                      style={{
                                        textAlign: 'center',
                                        minWidth: 50,
                                        width: 50
                                      }}
                                    >
                                      {value ? value : ''}
                                    </td>
                                  );
                                });
                              })}

                              <td
                                style={{
                                  textAlign: 'center',
                                  minWidth: 90
                                }}
                              >
                                {typeUsed}
                              </td>

                              <td
                                style={{
                                  textAlign: 'center',
                                  minWidth: 90
                                }}
                              >
                                {typePlanned}
                              </td>

                              <td
                                style={{
                                  textAlign: 'center',
                                  fontWeight: 600,
                                  minWidth: 90
                                }}
                              >
                                {typeRemaining === null
                                  ? '-'
                                  : typeRemaining}
                              </td>
                            </tr>
                          );
                        })}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p
        className="muted"
        style={{ marginTop: 8 }}
      >
        Click an employee row to expand or collapse the individual leave
        types. The employee row shows the combined totals of all leave
        types. Use the horizontal scroll to move through 2024, 2025, 2026,
        2027 and TOTAL.
      </p>
    </Layout>
  );
}
