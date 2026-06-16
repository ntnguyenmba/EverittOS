'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OsModulePage } from '@/components/os-module-page';
import { canAccessFeature } from '@/lib/plan-access';
import { fetchOrganizationContext } from '@/lib/organization';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type Automation = { id: string; name: string; trigger_type: string; action_type: string; active: boolean };

export default function AutomationsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Automation[]>([]);
  const [name, setName] = useState('');
  const [role, setRole] = useState(normalizeRole('employee'));
  const [loading, setLoading] = useState(true);

  async function load() {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    setRole(normalizeRole(profile?.role));
    const org = await fetchOrganizationContext(user.id);
    if (!org) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('automations')
      .select('id, name, trigger_type, action_type, active')
      .eq('organization_id', org.organizationId)
      .order('created_at', { ascending: false });
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [router]);

  async function createAutomation() {
    if (!name.trim() || !isManagerRole(role)) return;
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;
    const org = await fetchOrganizationContext(user.id);
    if (!org) return;
    await supabase.from('automations').insert({
      organization_id: org.organizationId,
      name: name.trim(),
      trigger_type: 'lead_created',
      action_type: 'create_task',
      created_by: user.id
    });
    setName('');
    void load();
  }

  return (
    <OsModulePage
      title="Automation Center"
      description="Trigger, condition, and action workflows for your business."
      requiredPlan="business"
      requiredFeature="Automations"
      featureCheck={(plan) => canAccessFeature(plan, 'aiAccess')}
      actions={[{ label: 'Job workflows', href: '/workflows' }]}
    >
      {isManagerRole(role) ? (
        <div className="card form" style={{ marginBottom: 18 }}>
          <input className="input" placeholder="Automation name" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="button" className="btn btn-primary" onClick={() => void createAutomation()}>
            Create automation
          </button>
        </div>
      ) : null}
      <div className="card">
        {loading ? <p>Loading...</p> : null}
        {!loading && rows.length === 0 ? (
          <p className="muted">No automations yet. Start with Lead Created → Create Task.</p>
        ) : null}
        {rows.map((row) => (
          <div key={row.id} className="dashboard-today-row">
            <span>{row.name}</span>
            <span className="muted">
              {row.trigger_type} → {row.action_type}
            </span>
          </div>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 16 }}>
        Advanced job workflows live under <Link href="/workflows">Workflows</Link> on Growth and higher.
      </p>
    </OsModulePage>
  );
}
