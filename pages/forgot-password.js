import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function ForgotPassword() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

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
    if (form.password !== form.confirm) {
      setError('The two passwords do not match');
      return;
    }
    setBusy(true);
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const data = await res.json().catch(function () {
      return {};
    });
    setBusy(false);
    if (!res.ok) {
      setError(data.error || 'Could not reset the password');
      return;
    }
    setDone(true);
    setTimeout(function () {
      router.push('/login');
    }, 1800);
  }

  return (
    <div className="auth-wrap">
      <h1>Reset your password</h1>
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          Forgot your password? Enter your work email and choose a new one. You do not
          need your old password.
        </p>
        <form onSubmit={submit}>
          <label htmlFor="email">Work email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={update('email')}
            required
          />
          <label htmlFor="password">New password (min 8 characters)</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={form.password}
            onChange={update('password')}
            required
          />
          <label htmlFor="confirm">Re-type new password</label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={form.confirm}
            onChange={update('confirm')}
            required
          />
          {error ? <div className="err">{error}</div> : null}
          {done ? (
            <div className="ok-msg">
              Your password has been changed. Taking you to the sign in page...
            </div>
          ) : null}
          <p style={{ marginTop: 18 }}>
            <button type="submit" disabled={busy || done}>
              {busy ? 'Saving...' : 'Set new password'}
            </button>
          </p>
        </form>
        <p className="muted">
          Remembered it? <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
