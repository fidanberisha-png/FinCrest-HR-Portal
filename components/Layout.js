import Link from 'next/link';
import { useRouter } from 'next/router';

// Views that only administrators and approvers can reach.
const MANAGER_VIEWS = [
  { value: '/dashboard', label: 'My dashboard' },
  { value: '/reports/leave-year', label: 'Leave calendar (summary)' },
  { value: '/approvals', label: 'Approvals' }
];

export default function Layout(props) {
  const router = useRouter();
  const user = props.user || {};
  const isAdmin = user.role === 'ADMIN';
  const canApprove = isAdmin || user.role === 'APPROVER';

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const current = MANAGER_VIEWS.filter(function (item) {
    return item.value === router.pathname;
  })[0];

  return (
    <div>
      <div className="nav">
        <span className="brand">FinCrest HR</span>
        <Link href="/dashboard">Dashboard</Link>
        {canApprove ? (
          <select
            aria-label="Manager views"
            value={current ? current.value : ''}
            onChange={function (e) {
              if (e.target.value) router.push(e.target.value);
            }}
            style={{
              width: 'auto',
              padding: '4px 8px',
              fontSize: 13,
              borderRadius: 6
            }}
          >
            {current ? null : <option value="">Select a view...</option>}
            {MANAGER_VIEWS.map(function (item) {
              return (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              );
            })}
          </select>
        ) : null}
        {canApprove ? <Link href="/approvals">Approvals</Link> : null}
        {isAdmin ? <Link href="/admin/users">Users</Link> : null}
        {isAdmin ? <Link href="/admin/settings">Settings</Link> : null}
        <span className="spacer" />
        <span className="who">
          {user.name} &middot; {user.role}
        </span>
        <button className="ghost sm" onClick={signOut}>
          Sign out
        </button>
      </div>
      <div className={props.wide ? 'wrap wrap-wide' : 'wrap'}>{props.children}</div>
    </div>
  );
}
