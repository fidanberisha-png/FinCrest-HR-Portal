import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { getCurrentUser } from '../lib/auth';

export async function getServerSideProps(ctx) {
  const user = await getCurrentUser(ctx.req);
  if (user) {
    return { redirect: { destination: '/dashboard', permanent: false } };
  }
  return { props: {} };
}

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    });
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      setError(data.error || 'Sign in failed');
      setBusy(false);
      return;
    }
    router.push('/dashboard');
  }

  return (
    <div className="auth-wrap">
      <h1>FinCrest HR Portal</h1>
      <div className="card">
        <h2>Sign in</h2>
        <form onSubmit={submit}>
          <label htmlFor="email">Work email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={function (e) {
              setEmail(e.target.value);
            }}
            required
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={function (e) {
              setPassword(e.target.value);
            }}
            required
          />
          {error ? <div className="err">{error}</div> : null}
          <p style={{ marginTop: 18 }}>
            <button type="submit" disabled={busy}>
              {busy ? 'Signing in...' : 'Sign in'}
            </button>
          </p>
        </form>
        <p className="muted" style={{ marginBottom: 4 }}>
          Forgot your password? <Link href="/forgot-password">Reset it here</Link>
        </p>
        <p className="muted">
          No account yet? <Link href="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
