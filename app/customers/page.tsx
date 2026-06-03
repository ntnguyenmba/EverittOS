'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { customerLimitReached, fetchUsageCounts, limitMessage } from '@/lib/everittos-usage';
import { isOwnerOrAdmin, normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string | null;
};

export default function CustomersPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [canManage, setCanManage] = useState(false);

  async function load() {
    setLoading(true);
    setMessage('');

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    setPlan(normalizePlan(profile?.plan));
    setCanManage(isOwnerOrAdmin(normalizeRole(profile?.role)));

    const { data, error } = await supabase
      .from('customers')
      .select('id, name, phone, email, address, notes, created_at')
      .order('created_at', { ascending: false });

    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setCustomers(data || []);
  }

  async function addCustomer() {
    if (!name.trim() || saving) return;

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);
    setMessage('');

    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
    const userPlan = normalizePlan(profile?.plan);
    const usage = await fetchUsageCounts(user.id);

    if (customerLimitReached(userPlan, usage)) {
      setSaving(false);
      setMessage(limitMessage('customers', userPlan));
      return;
    }

    const { error } = await supabase.from('customers').insert({
      user_id: user.id,
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null
    });

    setSaving(false);

    if (error) {
      if (error.message.includes('PLAN_LIMIT_CUSTOMERS')) {
        setMessage(limitMessage('customers', userPlan));
      } else {
        setMessage(error.message);
      }
      return;
    }

    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setNotes('');
    load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="dashboard-shell">
      <Sidebar plan={plan} />
      <main className="main">
        <div className="page-head">
          <div>
            <h2>Customers</h2>
            <p>Customer records linked to your jobs.</p>
          </div>
        </div>

        {!canManage && (
          <div className="card">
            <p>Only owners and admins can manage customer records.</p>
          </div>
        )}

        {canManage && (
          <div className="card form" style={{ marginBottom: 18 }}>
            <h3>Add customer</h3>
            <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input className="input" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="input" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
            <textarea className="input" rows={3} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <button className="btn btn-primary" type="button" onClick={addCustomer} disabled={saving}>
              {saving ? 'Saving...' : 'Save customer'}
            </button>
          </div>
        )}

        <div className="card">
          {loading && <p>Loading customers...</p>}
          {message && <p>{message}</p>}
          {!loading && customers.length === 0 && <p>No customers yet.</p>}
          {!loading &&
            customers.map((customer) => (
              <div key={customer.id} className="card" style={{ marginTop: 12 }}>
                <h3>{customer.name}</h3>
                <p>{customer.phone || 'No phone'}</p>
                <p>{customer.email || 'No email'}</p>
                <p>{customer.address || 'No address'}</p>
                <Link className="btn" href={`/customers/${customer.id}`}>
                  View customer
                </Link>
                <Link className="btn" href={`/jobs?customer=${customer.id}`}>
                  View jobs
                </Link>
              </div>
            ))}
        </div>
      </main>
    </div>
  );
}
