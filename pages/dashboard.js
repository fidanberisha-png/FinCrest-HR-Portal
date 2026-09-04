import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';

const LEAVE_TYPES = ['VACATION', 'SICK', 'UNPAID', 'PARENTAL', 'OTHER'];

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ type: 'VACATION', startDate: '', endDate: '', reason: '' });

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/requests').then(r => r.json()),
      fetch('/api/employees').then(r => r.json()),
    ])
      .then(([userData, requestsData, employeesData]) => {
        if (!userData.user) {
          router.push('/login');
          return;
        }
        setUser(userData.user);
        setRequests(requestsData.requests || []);
        setEmployees(employeesData.employees || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [router]);

  const handleUpdate = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.startDate || !form.endDate) return alert('Please select dates');
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error || 'Failed');
      alert('Request submitted!');
      setForm({ type: 'VACATION', startDate: '', endDate: '', reason: '' });
      const newRequests = await fetch('/api/requests').then(r => r.json());
      setRequests(newRequests.requests || []);
    } catch (err) {
      alert('Error');
    }
  };

  if (loading) return <Layout><div style={{ padding: '20px' }}>Loading...</div></Layout>;
  if (!user) return null;

  const usedDays = (requests || []).filter(r => r.status === 'APPROVED').reduce((sum, r) => sum + r.days, 0);
  const pendingDays = (requests || []).filter(r => r.status === 'PENDING').reduce((sum, r) => sum + r.days, 0);
  const remaining = user.allowance - usedDays - pendingDays;

  return (
    <Layout>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
        <h1>My dashboard</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '30px' }}>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2563eb' }}>{user.allowance}</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>ANNUAL ALLOWANCE</div>
          </div>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2563eb' }}>{usedDays}</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>APPROVED DAYS USED</div>
          </div>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2563eb' }}>{pendingDays}</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>DAYS PENDING</div>
          </div>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2563eb' }}>{Math.max(remaining, 0)}</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>DAYS REMAINING</div>
          </div>
        </div>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '20px', marginBottom: '20px' }}>
          <h2>Employee Directory</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
            <thead>
              <tr><th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: '600' }}>Full Name</th><th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: '600' }}>Department</th><th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: '600' }}>Position</th><th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: '600' }}>Email</th></tr>
            </thead>
            <tbody>
              {employees.length > 0 ? employees.map(emp => <tr key={emp.id} style={{ borderBottom: '1px solid #e5e7eb' }}><td style={{ padding: '10px', fontWeight: '500' }}>{emp.name}</td><td style={{ padding: '10px' }}>{emp.department || 'N/A'}</td><td style={{ padding: '10px' }}>{emp.position || 'N/A'}</td><td style={{ padding: '10px', color: '#2563eb' }}>{emp.email}</td></tr>) : <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>No employees</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '20px', marginBottom: '20px' }}>
          <h2>My requests</h2>
          {requests.length > 0 ? <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
            <thead>
              <tr><th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: '600' }}>TYPE</th><th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: '600' }}>DATES</th><th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: '600' }}>DAYS</th><th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: '600' }}>STATUS</th></tr>
            </thead>
            <tbody>
              {requests.map(req => <tr key={req.id} style={{ borderBottom: '1px solid #e5e7eb' }}><td style={{ padding: '10px' }}>{req.type}</td><td style={{ padding: '10px' }}>{new Date(req.startDate).toLocaleDateString()} to {new Date(req.endDate).toLocaleDateString()}</td><td style={{ padding: '10px' }}>{req.days}</td><td style={{ padding: '10px' }}><StatusBadge status={req.status} /></td></tr>)}
            </tbody>
          </table> : <p style={{ color: '#999' }}>No requests yet.</p>}
        </div>
      </div>
    </Layout>
  );
}
