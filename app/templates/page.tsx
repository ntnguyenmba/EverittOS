'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { LocalizedEmptyState } from '@/components/localized-empty-state';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useAsyncAction } from '@/hooks/use-async-action';
import { FEEDBACK } from '@/lib/feedback-labels';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import type { EverittTemplate, TemplateCategory } from '@/lib/os-types';

export default function TemplatesPage() {
  const router = useRouter();
  const feedback = useAppFeedback();
  const { busy: saving, runResponse, buttonLabel } = useAsyncAction();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [templates, setTemplates] = useState<EverittTemplate[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [filter, setFilter] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('sop');
  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [schemaReady, setSchemaReady] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const org = await fetchOrganizationContext(user.id);
    const userRole = normalizeRole(org?.role || profile?.role);
    setPlan(normalizePlan(profile?.plan));
    setRole(userRole);
    setCanManage(isManagerRole(userRole));

    const url = filter ? `/api/templates?category=${filter}` : '/api/templates';
    const res = await fetch(url);
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      feedback.error(json.error || 'Unable to load templates');
      setSchemaReady(true);
      return;
    }
    setSchemaReady(json.schemaReady !== false);
    setTemplates(json.templates || []);
    setCategories(json.categories || []);
  }, [feedback, filter, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveTemplate() {
    if (!title.trim() || saving) return;
    const isEdit = Boolean(editingId);
    const res = await runResponse(
      () =>
        fetch(isEdit ? `/api/templates/${editingId}` : '/api/templates', {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim(), category, body })
        }),
      isEdit ? 'updated' : 'created'
    );
    if (!res) return;
    setTitle('');
    setBody('');
    setEditingId(null);
    setShowCreateForm(false);
    void load();
  }

  async function duplicateTemplate(id: string) {
    const res = await runResponse(() => fetch(`/api/templates/${id}`, { method: 'POST' }), 'created');
    if (res) void load();
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this template?')) return;
    const res = await runResponse(() => fetch(`/api/templates/${id}`, { method: 'DELETE' }), 'deleted');
    if (res) void load();
  }

  function startEdit(t: EverittTemplate) {
    setEditingId(t.id);
    setShowCreateForm(true);
    setTitle(t.title);
    setCategory(t.category);
    setBody(t.body);
  }

  function openCreateForm() {
    setEditingId(null);
    setTitle('');
    setBody('');
    setCategory('sop');
    setShowCreateForm(true);
  }

  return (
    <AppShell plan={plan} role={role}>
      <header className="page-header">
        <h1>Template Library</h1>
        <p className="page-subtitle">SOPs, proposals, contracts, emails, and checklists for your organization.</p>
      </header>

      {!schemaReady ? (
        <div className="card" style={{ marginBottom: 16 }} role="status">
          <p className="muted">
            Template tables are not set up yet. Run <code>supabase/manual_schema_repair.sql</code> in the Supabase SQL
            Editor, then refresh.
          </p>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <label>
          Category filter
          <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {canManage && schemaReady && !showCreateForm && !editingId ? (
        <div className="card" style={{ marginBottom: 18 }}>
          <button type="button" className="btn btn-primary" onClick={openCreateForm}>
            New template
          </button>
        </div>
      ) : null}

      {canManage && schemaReady && (showCreateForm || editingId) ? (
        <div className="card form" style={{ marginBottom: 18 }}>
          <h3>{editingId ? 'Edit template' : 'New template'}</h3>
          <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value as TemplateCategory)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <textarea
            className="input"
            rows={8}
            placeholder="Template body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="settings-actions">
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveTemplate()}>
              {buttonLabel(editingId ? 'Update' : 'Create', FEEDBACK.loading)}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setEditingId(null);
                setShowCreateForm(false);
                setTitle('');
                setBody('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {loading ? <p>Loading…</p> : null}
      {!loading && templates.length === 0 && !showCreateForm ? (
        <LocalizedEmptyState
          emptyKey="templates"
          compact
          onPrimaryClick={canManage ? openCreateForm : undefined}
        />
      ) : null}

      <div className="card-list">
        {templates.map((t) => (
          <div key={t.id} className="card">
            <div className="card-link-head">
              <strong>{t.title}</strong>
              <span className="muted">v{t.version} · {t.category}</span>
            </div>
            <p className="muted template-preview">{t.body.slice(0, 160)}{t.body.length > 160 ? '…' : ''}</p>
            {canManage ? (
              <div className="settings-actions" style={{ marginTop: 8 }}>
                <button type="button" className="btn" disabled={saving} onClick={() => startEdit(t)}>
                  Edit
                </button>
                <button type="button" className="btn" disabled={saving} onClick={() => void duplicateTemplate(t.id)}>
                  Duplicate
                </button>
                <button type="button" className="btn btn-danger" disabled={saving} onClick={() => void deleteTemplate(t.id)}>
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
