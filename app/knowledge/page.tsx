'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OsModulePage } from '@/components/os-module-page';
import { useTranslation } from '@/components/locale-provider';
import { fetchOrganizationContext } from '@/lib/organization';
import { limitsForPlan } from '@/lib/everittos-limits';
import { getPlaybookCopy, type PlaybookDocumentType } from '@/lib/i18n/playbook-copy';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type Doc = {
  id: string;
  title: string;
  category: string;
  body: string | null;
  updated_at: string | null;
};

const DOCUMENT_TYPES: PlaybookDocumentType[] = ['policy', 'sop', 'instruction'];

export default function KnowledgePage() {
  const router = useRouter();
  const { locale } = useTranslation();
  const copy = getPlaybookCopy(locale);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<PlaybookDocumentType>('sop');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [role, setRole] = useState(normalizeRole('employee'));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login?next=/knowledge');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    setRole(normalizeRole(profile?.role));

    const org = await fetchOrganizationContext(user.id);
    if (!org) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('knowledge_documents')
      .select('id, title, category, body, updated_at')
      .eq('organization_id', org.organizationId)
      .order('updated_at', { ascending: false });

    if (error) setMessage(copy.loadError);
    setDocs((data || []) as Doc[]);
    setLoading(false);
  }, [copy.loadError, router]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setTitle('');
    setBody('');
    setCategory('sop');
    setEditingId(null);
  }

  function useStarter(type: PlaybookDocumentType) {
    setCategory(type);
    setTitle(copy.starterTitles[type]);
    setBody(copy.starterBodies[type]);
    setEditingId(null);
    setMessage('');
  }

  function editDoc(doc: Doc) {
    const nextCategory = DOCUMENT_TYPES.includes(doc.category as PlaybookDocumentType)
      ? (doc.category as PlaybookDocumentType)
      : 'instruction';
    setEditingId(doc.id);
    setCategory(nextCategory);
    setTitle(doc.title);
    setBody(doc.body || '');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveDoc() {
    if (!title.trim() || !body.trim() || !isManagerRole(role)) {
      setMessage(copy.requiredError);
      return;
    }

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    const org = await fetchOrganizationContext(user.id);
    if (!org) return;

    setSaving(true);
    setMessage('');
    const payload = {
      organization_id: org.organizationId,
      title: title.trim(),
      category,
      body: body.trim(),
      created_by: user.id,
      updated_at: new Date().toISOString()
    };

    const result = editingId
      ? await supabase
          .from('knowledge_documents')
          .update({ title: payload.title, category: payload.category, body: payload.body, updated_at: payload.updated_at })
          .eq('id', editingId)
          .eq('organization_id', org.organizationId)
      : await supabase.from('knowledge_documents').insert(payload);

    setSaving(false);
    if (result.error) {
      setMessage(copy.saveError);
      return;
    }

    resetForm();
    setMessage(copy.saved);
    await load();
  }

  async function deleteDoc(doc: Doc) {
    if (!isManagerRole(role) || !window.confirm(copy.deleteConfirm)) return;
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;
    const org = await fetchOrganizationContext(user.id);
    if (!org) return;

    const { error } = await supabase
      .from('knowledge_documents')
      .delete()
      .eq('id', doc.id)
      .eq('organization_id', org.organizationId);

    if (error) {
      setMessage(copy.deleteError);
      return;
    }
    if (editingId === doc.id) resetForm();
    setMessage(copy.deleted);
    await load();
  }

  return (
    <OsModulePage
      title={copy.title}
      description={copy.description}
      requiredPlan="pro"
      requiredFeature={copy.title}
      featureCheck={(plan) => limitsForPlan(plan).pdfReports}
    >
      {isManagerRole(role) ? (
        <section className="card form" style={{ marginBottom: 18 }}>
          <div>
            <h2 style={{ marginBottom: 6 }}>{copy.createTitle}</h2>
            <p className="muted" style={{ marginTop: 0 }}>{copy.createHelp}</p>
          </div>

          <div className="form-grid">
            <label>
              <span>{copy.typeLabel}</span>
              <select className="input" value={category} onChange={(event) => setCategory(event.target.value as PlaybookDocumentType)}>
                {DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{copy.types[type]}</option>)}
              </select>
            </label>
            <label>
              <span>{copy.titleLabel}</span>
              <input className="input" placeholder={copy.titlePlaceholder} value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
          </div>

          <label>
            <span>{copy.bodyLabel}</span>
            <textarea className="input" rows={10} placeholder={copy.bodyPlaceholder} value={body} onChange={(event) => setBody(event.target.value)} />
          </label>

          {!editingId ? (
            <div>
              <p className="muted" style={{ marginBottom: 8 }}>{copy.starterLabel}</p>
              <div className="settings-actions">
                {DOCUMENT_TYPES.map((type) => (
                  <button key={type} type="button" className="btn" onClick={() => useStarter(type)}>
                    {copy.starterAction}: {copy.types[type]}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="settings-actions">
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveDoc()}>
              {saving ? copy.saving : editingId ? copy.update : copy.save}
            </button>
            {editingId ? <button type="button" className="btn" disabled={saving} onClick={resetForm}>{copy.cancel}</button> : null}
          </div>
          {message ? <p className="muted" role="status">{message}</p> : null}
        </section>
      ) : null}

      <section className="card">
        {loading ? <p>{copy.loading}</p> : null}
        {!loading && docs.length === 0 ? (
          <div>
            <h3>{copy.emptyTitle}</h3>
            <p className="muted">{copy.emptyBody}</p>
          </div>
        ) : null}
        {docs.map((doc) => {
          const type = DOCUMENT_TYPES.includes(doc.category as PlaybookDocumentType)
            ? (doc.category as PlaybookDocumentType)
            : 'instruction';
          return (
            <article key={doc.id} className="dashboard-today-row" style={{ alignItems: 'flex-start', gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="muted" style={{ marginBottom: 4 }}>{copy.types[type]}</div>
                <strong>{doc.title}</strong>
                {doc.body ? <p className="muted" style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{doc.body}</p> : null}
              </div>
              {isManagerRole(role) ? (
                <div className="settings-actions" style={{ flexShrink: 0 }}>
                  <button type="button" className="btn btn-sm" onClick={() => editDoc(doc)}>{copy.edit}</button>
                  <button type="button" className="btn btn-sm" onClick={() => void deleteDoc(doc)}>{copy.delete}</button>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </OsModulePage>
  );
}
