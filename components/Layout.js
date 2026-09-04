import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Layout(props) {
  const router = useRouter();
  const user = props.user || {};
  const isAdmin = user.role === 'ADMIN';
  const canApprove = isAdmin || user.role === 'APPROVER';

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div>
      <div className="nav">
        <span className="brand">FinCrest HR</span>
        <Link href="/dashboard">Dashboard</Link>
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
