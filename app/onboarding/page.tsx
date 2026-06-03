'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function OnboardingPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [bookingUrl, setBookingUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: biz } = await supabase.from('business_profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (biz?.onboarding_completed) {
        router.push('/dashboard');
        return;
      }

      setBusinessName(biz?.business_name || '');
      setPhone(biz?.phone || '');
      setServiceType(biz?.service_type || '');
      setBookingUrl(biz?.booking_url || '');
      setLoading(false);
    }

    load();
  }, [router]);

  async function finish() {
    if (saving) return;

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);
    setMessage('');

    const { error } = await supabase.from('business_profiles').upsert({
      user_id: user.id,
      business_name: businessName.trim() || null,
      phone: phone.trim() || null,
      service_type: serviceType.trim() || null,
      booking_url: bookingUrl.trim() || null,
      onboarding_completed: true
    });

    if (!error) {
      await supabase.from('profiles').update({ business_name: businessName.trim() || null }).eq('id', user.id);
    }

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  if (loading) {
    return (
      <main className="section">
        <div className="container">
          <p>Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 520 }}>
        <h2>Set up your business</h2>
        <p>Add basic details for your EverittOS workspace.</p>

        <div className="card form" style={{ marginTop: 24 }}>
          <input className="input" placeholder="Business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className="input" placeholder="Service type" value={serviceType} onChange={(e) => setServiceType(e.target.value)} />
          <input
            className="input"
            placeholder="External booking URL (optional)"
            value={bookingUrl}
            onChange={(e) => setBookingUrl(e.target.value)}
          />
          <button className="btn btn-primary" type="button" onClick={finish} disabled={saving}>
            {saving ? 'Saving...' : 'Continue to dashboard'}
          </button>
          {message && <p>{message}</p>}
        </div>
      </div>
    </main>
  );
}
