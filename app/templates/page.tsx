'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { EmptyState } from '@/components/empty-state';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import type { EverittTemplate, TemplateCategory } from '@/lib/os-types';

export default function TemplatesPage() {
  const router = useRouter();
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
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [canManage, setCanManage] = useState(false);

  async function load() {
    setLoading(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const userRole = normalizeRole(profile?.role);
    setPlan(normalizePlan(profile?.plan));
    setRole(userRole);
    setCanManage(isManagerRole(userRole));

    const url = filter ? `/api/templates?category=${filter}` : '/api/templates';
    const res = await fetch(url);
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(json.error || 'Unable to load templates');
      return;
    }
    setTemplates(json.templates || []);
    setCategories(json.categories || []);
  }

  useEffect(() => {
    void load();
  }, [router, filter]);

  async function saveTemplate() {
    if (!title.trim() || saving) return;
    setSaving(true);
    setMessage('');
    const isEdit = Boolean(editingId);
    const res = await fetch(isEdit ? `/api/templates/${editingId}` : '/api/templates', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), category, body })
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(json.error || 'Save failed');
      return;
    }
    setTitle('');
    setBody('');
    setEditingId(null);
    void load();
  }

  async function duplicateTemplate(id: string) {
    const res = await fetch(`/api/templates/${id}`, { method: 'POST' });
    if (!res.ok) {
      const json = await res.json();
      setMessage(json.error || 'Duplicate failed');
      return;
    }
    void load();
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this template?')) return;
    const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json();
      setMessage(json.error || 'Delete failed');
      return;
    }
    void load();
  }

  function startEdit(t: EverittTemplate) {
    setEditingId(t.id);
    setTitle(t.title);
    setCategory(t.category);
    setBody(t.body);
  }

  return (
    <AppShell plan={plan} role={role}>
      <header className="page-header">
        <h1>Template Library</h1>
        <p className="page-subtitle">SOPs, proposals, contracts, emails, and checklists for your organization.</p>
      </header>

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

      {canManage ? (
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
              {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
            </button>
            {editingId ? (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setEditingId(null);
                  setTitle('');
                  setBody('');
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {message ? <p className="auth-message auth-message-error">{message}</p> : null}
      {loading ? <p>Loading…</p> : null}
      {!loading && templates.length === 0 ? (
        <EmptyState compact title="No templates" description="Create reusable templates for proposals, SOPs, and emails." />
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
                <button type="button" className="btn" onClick={() => startEdit(t)}>
                  Edit
                </button>
                <button type="button" className="btn" onClick={() => void duplicateTemplate(t.id)}>
                  Duplicate
                </button>
                <button type="button" className="btn btn-danger" onClick={() => void deleteTemplate(t.id)}>
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
