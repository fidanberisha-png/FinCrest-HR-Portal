import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import prisma from '../../lib/prisma';
import { getCurrentUser, hasRole } from '../../lib/auth';
import { ymd } from '../../lib/dates';

export async function getServerSideProps(ctx) {
  const user = await getCurrentUser(ctx.req);
  if (!user) return { redirect: { destination: '/login', permanent: false } };
  if (!hasRole(user, ['ADMIN'])) return { redirect: { destination: '/dashboard', permanent: false } };

  const users = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      department: true,
      allowance: true,
      active: true,
      createdAt: true,
      _count: { select: { requests: true } }
    }
  });

  return { props: { user: user, users: JSON.parse(JSON.stringify(users)) } };
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
      {error ? <div className="err">{error}</div> : null}
      {notice ? <div className="ok-msg">{notice}</div> : null}

      <div className="card" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
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
                  <td className="muted">{u.department || '-'}</td>
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
                      style={{ width: 78 }}
                      onBlur={function (e) {
                        if (parseInt(e.target.value, 10) !== u.allowance) {
                          patch(u.id, { allowance: e.target.value });
                        }
                      }}
                    />
                  </td>
                  <td>{u._count.requests}</td>
                  <td className="muted">{ymd(u.createdAt)}</td>
                  <td>
                    <button
                      className="ghost sm"
                      onClick={function () {
                        patch(u.id, { active: !u.active });
                      }}
                    >
                      {u.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted" style={{ marginTop: 14 }}>
          Roles: ADMIN manages users, settings and approvals. APPROVER can approve or reject requests.
          EMPLOYEE can submit and track their own requests.
        </p>
      </div>
    </Layout>
  );
}
