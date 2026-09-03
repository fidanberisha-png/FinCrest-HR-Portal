import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import prisma from '../lib/prisma';
import { getCurrentUser, hasRole } from '../lib/auth';
import { ymd } from '../lib/dates';

export async function getServerSideProps(ctx) {
  const user = await getCurrentUser(ctx.req);
  if (!user) return { redirect: { destination: '/login', permanent: false } };
  if (!hasRole(user, ['ADMIN', 'APPROVER'])) {
    return { redirect: { destination: '/dashboard', permanent: false } };
  }

  const pending = await prisma.leaveRequest.findMany({
    where: { status: 'PENDING' },
    orderBy: { startDate: 'asc' },
    include: { user: { select: { name: true, email: true, department: true } } }
  });
  const decided = await prisma.leaveRequest.findMany({
    where: { status: { in: ['APPROVED', 'REJECTED', 'CANCELLED'] } },
    orderBy: { decidedAt: 'desc' },
    take: 40,
    include: {
      user: { select: { name: true, email: true } },
      decidedBy: { select: { name: true } }
    }
  });

  return {
    props: {
      user: user,
      pending: JSON.parse(JSON.stringify(pending)),
      decided: JSON.parse(JSON.stringify(decided))
    }
  };
}

export default function Approvals(props) {
  const router = useRouter();
  const [notes, setNotes] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');

  function noteFor(id) {
    return notes[id] || '';
  }

  function setNote(id) {
    return function (e) {
      const next = Object.assign({}, notes);
      next[id] = e.target.value;
      setNotes(next);
    };
  }

  async function decide(id, action) {
    setError('');
    setNotice('');
    setBusyId(id);
    const res = await fetch('/api/requests/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action, note: noteFor(id) })
    });
    const data = await res.json().catch(function () {
      return {};
    });
    setBusyId('');
    if (!res.ok) {
      setError(data.error || 'Could not update the request');
      return;
    }
    setNotice('Request ' + action + 'd. The employee has been emailed.');
    router.replace(router.asPath);
  }

  return (
    <Layout user={props.user}>
      <h1>Approvals</h1>
      {error ? <div className="err">{error}</div> : null}
      {notice ? <div className="ok-msg">{notice}</div> : null}

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Pending requests ({props.pending.length})</h2>
        {props.pending.length === 0 ? (
          <p className="muted">Nothing waiting for review.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Dates</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Decision note</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {props.pending.map(function (r) {
                return (
                  <tr key={r.id}>
                    <td>
                      {r.user.name}
                      <div className="muted">{r.user.department || r.user.email}</div>
                    </td>
                    <td>{r.type}</td>
                    <td>
                      {ymd(r.startDate)} to {ymd(r.endDate)}
                    </td>
                    <td>{r.days}</td>
                    <td className="muted">{r.reason || ''}</td>
                    <td>
                      <input value={noteFor(r.id)} onChange={setNote(r.id)} placeholder="optional" />
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button
                        className="ok sm"
                        disabled={busyId === r.id}
                        onClick={function () {
                          decide(r.id, 'approve');
                        }}
                      >
                        Approve
                      </button>{' '}
                      <button
                        className="bad sm"
                        disabled={busyId === r.id}
                        onClick={function () {
                          decide(r.id, 'reject');
                        }}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Recently decided</h2>
        {props.decided.length === 0 ? (
          <p className="muted">No decisions yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Dates</th>
                <th>Status</th>
                <th>Reviewed by</th>
              </tr>
            </thead>
            <tbody>
              {props.decided.map(function (r) {
                return (
                  <tr key={r.id}>
                    <td>{r.user.name}</td>
                    <td>{r.type}</td>
                    <td>
                      {ymd(r.startDate)} to {ymd(r.endDate)}
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="muted">{r.decidedBy ? r.decidedBy.name : '-'}</td>
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
