'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OsModulePage } from '@/components/os-module-page';
import { canAccessFeature } from '@/lib/plan-access';
import { fetchOrganizationContext } from '@/lib/organization';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type Proposal = { id: string; title: string; status: string; amount: number | null };

export default function ProposalsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Proposal[]>([]);
  const [title, setTitle] = useState('');
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
      .from('proposals')
      .select('id, title, status, amount')
      .eq('organization_id', org.organizationId)
      .order('created_at', { ascending: false });
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [router]);

  async function createProposal() {
    if (!title.trim() || !isManagerRole(role)) return;
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;
    const org = await fetchOrganizationContext(user.id);
    if (!org) return;
    await supabase.from('proposals').insert({
      organization_id: org.organizationId,
      title: title.trim(),
      created_by: user.id
    });
    setTitle('');
    void load();
  }

  return (
    <OsModulePage
      title="Proposal Center"
      description="Create, track, and convert proposals to jobs and invoices."
      requiredPlan="pro"
      requiredFeature="Proposals"
      featureCheck={(plan) => canAccessFeature(plan, 'pdfReports')}
      actions={[{ label: 'Ask Everitt to draft', href: '/dashboard' }]}
    >
      {isManagerRole(role) ? (
        <div className="card form" style={{ marginBottom: 18 }}>
          <input className="input" placeholder="Proposal title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button type="button" className="btn btn-primary" onClick={() => void createProposal()}>
            Create proposal
          </button>
        </div>
      ) : null}
      <div className="card">
        {loading ? <p>Loading...</p> : null}
        {!loading && rows.length === 0 ? (
          <p className="muted">No proposals yet. PDF export and e-signature architecture are ready to extend.</p>
        ) : null}
        {rows.map((row) => (
          <div key={row.id} className="dashboard-today-row">
            <span>{row.title}</span>
            <span className="muted">{row.status}{row.amount != null ? ` · $${row.amount}` : ''}</span>
          </div>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 16 }}>
        Link proposals to <Link href="/customers">CRM records</Link> and <Link href="/jobs">jobs</Link> from detail pages.
      </p>
    </OsModulePage>
  );
}
