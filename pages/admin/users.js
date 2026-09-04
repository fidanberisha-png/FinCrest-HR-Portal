import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import prisma from '../../lib/prisma';
import { getCurrentUser, hasRole, leaveEligibleFrom, isLeaveEligible } from '../../lib/auth';
import { ymd } from '../../lib/dates';

export async function getServerSideProps(ctx) {
  const user = await getCurrentUser(ctx.req);
  if (!user) return { redirect: { destination: '/login', permanent: false } };
  if (!hasRole(user, ['ADMIN'])) return { redirect: { destination: '/dashboard', permanent: false } };

  const rows = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      department: true,
      position: true,
      startDate: true,
      allowance: true,
      active: true,
      createdAt: true,
      _count: { select: { requests: true } }
    }
  });

  const users = rows.map(function (row) {
    const from = leaveEligibleFrom(row.startDate);
    return Object.assign({}, row, {
      leaveEligible: isLeaveEligible(row.startDate),
      leaveEligibleFrom: from ? from.toISOString() : null
    });
  });

  return { props: { user: user, users: JSON.parse(JSON.stringify(users)) } };
}

function dateInputValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export default function AdminUsers(props) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function patch(id, body) {
    setError('');
    setNotice('');
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ id: id }, body))
    });
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      setError(data.error || 'Update failed');
      return;
    }
    setNotice('Saved.');
    router.replace(router.asPath);
  }

  return (
    <Layout user={props.user}>
      <h1>Users ({props.users.length})</h1>
      <p className="muted">
        Position and employment start date drive the employee directory and the 6-month leave
        eligibility rule. Employees with less than 6 months of service cannot submit leave requests.
      </p>
      {error ? <div className="err">{error}</div> : null}
      {notice ? <div className="ok-msg">{notice}</div> : null}

      <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Position</th>
              <th>Start date</th>
              <th>Leave eligible</th>
              <th>Role</th>
              <th>Allowance</th>
              <th>Requests</th>
              <th>Joined</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {props.users.map(function (u) {
              return (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td className="muted">{u.email}</td>
                  <td>
                    <input
                      defaultValue={u.department || ''}
                      placeholder="-"
                      style={{ width: 110 }}
                      onBlur={function (e) {
                        if (e.target.value !== (u.department || '')) patch(u.id, { department: e.target.value });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      defaultValue={u.position || ''}
                      placeholder="-"
                      style={{ width: 140 }}
                      onBlur={function (e) {
                        if (e.target.value !== (u.position || '')) patch(u.id, { position: e.target.value });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      defaultValue={dateInputValue(u.startDate)}
                      style={{ width: 140 }}
                      onChange={function (e) {
                        patch(u.id, { startDate: e.target.value });
                      }}
                    />
                  </td>
                  <td style={{ color: u.leaveEligible ? '#065f46' : '#991b1b', fontSize: 12 }}>
                    {u.startDate
                      ? u.leaveEligible
                        ? 'Yes'
                        : 'From ' + ymd(new Date(u.leaveEligibleFrom))
                      : 'No start date'}
                  </td>
                  <td>
                    <select
                      value={u.role}
                      onChange={function (e) {
                        patch(u.id, { role: e.target.value });
                      }}
                    >
                      <option value="EMPLOYEE">EMPLOYEE</option>
                      <option value="APPROVER">APPROVER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      defaultValue={u.allowance}
                      style={{ width: 70 }}
                      onBlur={function (e) {
                        if (String(e.target.value) !== String(u.allowance)) patch(u.id, { allowance: e.target.value });
                      }}
                    />
                  </td>
                  <td className="muted">{u._count.requests}</td>
                  <td className="muted">{ymd(new Date(u.createdAt))}</td>
                  <td>
                    <button
                      className="ghost sm"
                      onClick={function () {
                        patch(u.id, { active: !u.active });
                      }}
                    >
                      {u.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
