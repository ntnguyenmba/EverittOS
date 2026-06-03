'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { EVERITTOS_STRIPE_LINKS, normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { fetchOrganizationContext } from '@/lib/organization';
import { supabase } from '@/lib/supabase';

export default function SettingsPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [bookingUrl, setBookingUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState('');
  const [notifyAssignments, setNotifyAssignments] = useState(true);
  const [notifyDueDates, setNotifyDueDates] = useState(true);
  const [notifyCompletions, setNotifyCompletions] = useState(true);
  const [notifyReports, setNotifyReports] = useState(true);
  const [logoUploading, setLogoUploading] = useState(false);

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
      const { data: biz } = await supabase.from('business_profiles').select('*').eq('user_id', user.id).maybeSingle();

      setPlan(normalizePlan(profile?.plan));
      setBusinessName(biz?.business_name || profile?.business_name || '');
      setPhone(biz?.phone || '');
      setServiceType(biz?.service_type || '');
      setBookingUrl(biz?.booking_url || '');
      setEmail(user.email || '');

      const org = await fetchOrganizationContext(user.id);
      if (org) {
        setOrgId(org.organizationId);
        const { data: settings } = await supabase
          .from('organization_settings')
          .select('*')
          .eq('organization_id', org.organizationId)
          .maybeSingle();
        if (settings) {
          setServiceType(settings.service_type || serviceType);
          setBookingUrl(settings.booking_url || bookingUrl);
          setNotifyAssignments(settings.notification_assignments ?? true);
          setNotifyDueDates(settings.notification_due_dates ?? true);
          setNotifyCompletions(settings.notification_completions ?? true);
          setNotifyReports(settings.notification_reports ?? true);
        }
      }

      setLoading(false);
    }

    load();
  }, [router]);

  async function saveProfile() {
    if (saving) return;

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);
    setMessage('');

    const { error } = await supabase
      .from('profiles')
      .update({ business_name: businessName.trim() || null })
      .eq('id', user.id);

    if (error) {
      setSaving(false);
      setMessage(error.message);
      return;
    }

    await supabase.from('business_profiles').upsert({
      user_id: user.id,
      business_name: businessName.trim() || null,
      phone: phone.trim() || null,
      service_type: serviceType.trim() || null,
      booking_url: bookingUrl.trim() || null,
      email
    });

    if (orgId) {
      await supabase.from('organization_settings').upsert({
        organization_id: orgId,
        company_phone: phone.trim() || null,
        company_email: email,
        service_type: serviceType.trim() || null,
        booking_url: bookingUrl.trim() || null,
        notification_assignments: notifyAssignments,
        notification_due_dates: notifyDueDates,
        notification_completions: notifyCompletions,
        notification_reports: notifyReports
      });
      await supabase.from('organizations').update({ name: businessName.trim() || 'My Business' }).eq('id', orgId);
    }

    setSaving(false);
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

  async function uploadLogo(file: File | null) {
    if (!file || !orgId) return;
    setLogoUploading(true);
    const path = `${orgId}/logo-${Date.now()}.${file.name.split('.').pop() || 'png'}`;
    const { error } = await supabase.storage.from('org-logos').upload(path, file, { upsert: true });
    if (error) {
      setMessage(error.message);
      setLogoUploading(false);
      return;
    }
    await supabase.from('organization_settings').upsert({ organization_id: orgId, logo_path: path });
    setLogoUploading(false);
    setMessage('Logo uploaded.');
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
        <main className="main">
          <p>Loading settings...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <Sidebar plan={plan} />
      <main className="main">
        <h2>Settings</h2>
        <div className="card form">
          <p>
            Current plan: <strong>{plan}</strong>
          </p>
          <p>
            Upgrade:{' '}
            <a href={EVERITTOS_STRIPE_LINKS.pro} target="_blank" rel="noopener noreferrer">
              Pro
            </a>
            {' · '}
            <a href={EVERITTOS_STRIPE_LINKS.business} target="_blank" rel="noopener noreferrer">
              Business
            </a>
          </p>
          <input className="input" placeholder="Business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className="input" placeholder="Service type" value={serviceType} onChange={(e) => setServiceType(e.target.value)} />
          <input
            className="input"
            placeholder="External booking URL"
            value={bookingUrl}
            onChange={(e) => setBookingUrl(e.target.value)}
          />
          <input className="input" placeholder="Email" value={email} disabled />
          <h3>Logo</h3>
          <input type="file" accept="image/*" disabled={!orgId || logoUploading} onChange={(e) => uploadLogo(e.target.files?.[0] || null)} />
          <h3>Notification preferences</h3>
          <label>
            <input type="checkbox" checked={notifyAssignments} onChange={(e) => setNotifyAssignments(e.target.checked)} /> Assignments
          </label>
          <label>
            <input type="checkbox" checked={notifyDueDates} onChange={(e) => setNotifyDueDates(e.target.checked)} /> Due dates
          </label>
          <label>
            <input type="checkbox" checked={notifyCompletions} onChange={(e) => setNotifyCompletions(e.target.checked)} /> Completions
          </label>
          <label>
            <input type="checkbox" checked={notifyReports} onChange={(e) => setNotifyReports(e.target.checked)} /> Reports
          </label>
          <button className="btn btn-primary" type="button" onClick={saveProfile} disabled={saving}>
            {saving ? 'Saving...' : 'Save settings'}
          </button>
          <hr />
          <h3>Change password</h3>
          <input className="input" placeholder="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="btn btn-primary" type="button" onClick={changePassword}>
            Update password
          </button>
          <button className="btn" type="button" onClick={logout}>
            Log out
          </button>
          <p style={{ marginTop: 16 }}>
            <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/disclaimer">Disclaimer</Link>
          </p>
          {message && <p>{message}</p>}
        </div>
      </main>
    </div>
  );
}
