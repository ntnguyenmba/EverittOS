'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OsModulePage } from '@/components/os-module-page';
import { fetchOrganizationContext } from '@/lib/organization';
import { limitsForPlan } from '@/lib/everittos-limits';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type Doc = { id: string; title: string; category: string; updated_at: string | null };

export default function KnowledgePage() {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [title, setTitle] = useState('');
  const [role, setRole] = useState(normalizeRole('employee'));
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
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
      .from('knowledge_documents')
      .select('id, title, category, updated_at')
      .eq('organization_id', org.organizationId)
      .order('updated_at', { ascending: false });

    setDocs((data || []) as Doc[]);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addDoc() {
    if (!title.trim() || !isManagerRole(role)) return;
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    const org = await fetchOrganizationContext(user.id);
    if (!org) return;

    await supabase.from('knowledge_documents').insert({
      organization_id: org.organizationId,
      title: title.trim(),
      category: 'document',
      created_by: user.id
    });

    setTitle('');
    void load();
  }

  return (
    <OsModulePage
      title="Knowledge Vault"
      description="Documents, SOPs, contracts, templates, and notes for your team."
      requiredPlan="pro"
      requiredFeature="Knowledge Vault"
      featureCheck={(plan) => limitsForPlan(plan).pdfReports}
    >
      {isManagerRole(role) ? (
        <div className="card form" style={{ marginBottom: 18 }}>
          <input className="input" placeholder="Document title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button type="button" className="btn btn-primary" onClick={() => void addDoc()}>
            Add document
          </button>
        </div>
      ) : null}

      <div className="card">
        {loading ? <p>Loading...</p> : null}
        {!loading && docs.length === 0 ? <p className="muted">No documents yet. Uploads and rich text editing are next.</p> : null}
        {docs.map((doc) => (
          <div key={doc.id} className="dashboard-today-row">
            <span>{doc.title}</span>
            <span className="muted">{doc.category}</span>
          </div>
        ))}
      </div>
    </OsModulePage>
  );
}
