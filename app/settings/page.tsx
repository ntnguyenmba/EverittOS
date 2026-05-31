'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { EVERITTOS_STRIPE_LINKS, normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { supabase } from '@/lib/supabase';

export default function SettingsPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan));
      setBusinessName(profile?.business_name || '');
      setEmail(user.email || '');
      setLoading(false);
    }

    load();
  }, [router]);

  async function saveProfile() {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ business_name: businessName.trim() || null })
      .eq('id', user.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from('business_profiles').upsert({
      user_id: user.id,
      business_name: businessName.trim() || null,
      email
    });

    setMessage('Settings saved.');
  }

  async function changePassword() {
    if (!password) return;
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage('Password updated.');
    setPassword('');
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  if (loading) {
    return (
      <div className="dashboard-shell">
        <Sidebar plan={plan} />
        <main className="main"><p>Loading settings...</p></main>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <Sidebar plan={plan} />
      <main className="main">
        <h2>Settings</h2>
        <div className="card form">
          <p>Current plan: <strong>{plan}</strong></p>
          <p>
            Upgrade: <a href={EVERITTOS_STRIPE_LINKS.pro} target="_blank" rel="noopener noreferrer">Pro</a>
            {' · '}
            <a href={EVERITTOS_STRIPE_LINKS.business} target="_blank" rel="noopener noreferrer">Business</a>
          </p>
          <input className="input" placeholder="Business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          <input className="input" placeholder="Email" value={email} disabled />
          <button className="btn btn-primary" type="button" onClick={saveProfile}>Save settings</button>
          <hr />
          <h3>Change password</h3>
          <input className="input" placeholder="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="btn btn-primary" type="button" onClick={changePassword}>Update password</button>
          <button className="btn" type="button" onClick={logout}>Log out</button>
          {message && <p>{message}</p>}
        </div>
      </main>
    </div>
  );
}
