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

export default function Register() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    department: '',
    position: '',
    password: '',
    confirm: ''
  });
  const [error, setError] = useState('');
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
    if (!form.name.trim() || !form.department.trim() || !form.position.trim()) {
      setError('Full name, department and position are all required');
      return;
    }
    setBusy(true);
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        department: form.department,
        position: form.position,
        password: form.password
      })
    });
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      setError(data.error || 'Registration failed');
      setBusy(false);
      return;
    }
    router.push('/dashboard');
  }

  return (
    <div className="auth-wrap">
      <h1>Create your account</h1>
      <div className="card">
        <form onSubmit={submit}>
          <label htmlFor="name">Full name</label>
          <input id="name" value={form.name} onChange={update('name')} required />
          <label htmlFor="email">Work email</label>
          <input id="email" type="email" value={form.email} onChange={update('email')} required />
          <label htmlFor="department">Department</label>
          <input
            id="department"
            value={form.department}
            onChange={update('department')}
            placeholder="e.g. Finance"
            required
          />
          <label htmlFor="position">Position / job title</label>
          <input
            id="position"
            value={form.position}
            onChange={update('position')}
            placeholder="e.g. Financial Analyst"
            required
          />
          <p className="muted" style={{ marginTop: 4, fontSize: 12 }}>
            Your employment start date is taken automatically from the official company
            records, so you do not need to enter it here.
          </p>
          <label htmlFor="password">Password (min 8 characters)</label>
          <input
            id="password"
            type="password"
            minLength={8}
            value={form.password}
            onChange={update('password')}
            required
          />
          <label htmlFor="confirm">Confirm password</label>
          <input
            id="confirm"
            type="password"
            minLength={8}
            value={form.confirm}
            onChange={update('confirm')}
            required
          />
          {error ? <div className="err">{error}</div> : null}
          <p style={{ marginTop: 18 }}>
            <button type="submit" disabled={busy}>
              {busy ? 'Creating account...' : 'Create account'}
            </button>
          </p>
        </form>
        <p className="muted" style={{ marginTop: 12 }}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
