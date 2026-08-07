'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OsModulePage } from '@/components/os-module-page';
import { useTranslation } from '@/components/locale-provider';
import { useTeamOptions } from '@/lib/team-options-client';
import { fetchOrganizationContext } from '@/lib/organization';
import { limitsForPlan } from '@/lib/everittos-limits';
import {
  getPlaybookCopy,
  type PlaybookDocumentType,
  type PlaybookStarterBlock,
  type PlaybookTrade
} from '@/lib/i18n/playbook-copy';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type Doc = {
  id: string;
  title: string;
  category: string;
  body: string | null;
  tags: string[] | null;
  updated_at: string | null;
};

type BuilderBlock = PlaybookStarterBlock & { id: string };

const DOCUMENT_TYPES: PlaybookDocumentType[] = ['policy', 'sop', 'instruction'];
const TRADES: PlaybookTrade[] = ['cleaning', 'junk_removal', 'painting', 'landscaping', 'handyman', 'moving', 'general'];
const BLOCK_SEPARATOR = '\n\n---\n\n';

function makeBlock(block?: PlaybookStarterBlock): BuilderBlock {
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    title: block?.title || '',
    body: block?.body || ''
  };
}

function serializeBlocks(blocks: BuilderBlock[]): string {
  return blocks
    .filter((block) => block.title.trim() || block.body.trim())
    .map((block) => `${block.title.trim()}\n${block.body.trim()}`.trim())
    .join(BLOCK_SEPARATOR);
}

function parseBlocks(body: string | null): BuilderBlock[] {
  if (!body?.trim()) return [makeBlock()];
  return body.split(BLOCK_SEPARATOR).map((part) => {
    const [first, ...rest] = part.split('\n');
    return makeBlock({ title: first?.trim() || '', body: rest.join('\n').trim() });
  });
}

function tradeFromTags(tags: string[] | null): PlaybookTrade {
  const value = tags?.find((tag) => tag.startsWith('trade:'))?.slice('trade:'.length);
  return TRADES.includes(value as PlaybookTrade) ? (value as PlaybookTrade) : 'general';
}

const sectionStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10
};

const assignmentCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  minWidth: 0,
  minHeight: 52,
  padding: '12px 14px',
  border: '1px solid var(--border)',
  borderRadius: 12,
  cursor: 'pointer',
  boxSizing: 'border-box'
};

export default function KnowledgePage() {
  const router = useRouter();
  const { locale } = useTranslation();
  const copy = getPlaybookCopy(locale);
  const { teamOptions, teamOptionsLoading } = useTeamOptions();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<PlaybookDocumentType>('sop');
  const [trade, setTrade] = useState<PlaybookTrade>('cleaning');
  const [blocks, setBlocks] = useState<BuilderBlock[]>(() => [makeBlock()]);
  const [assignEveryone, setAssignEveryone] = useState(false);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [role, setRole] = useState(normalizeRole('employee'));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const manager = isManagerRole(role);
  const serializedBody = useMemo(() => serializeBlocks(blocks), [blocks]);

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
      .select('id, title, category, body, tags, updated_at')
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
    setCategory('sop');
    setTrade('cleaning');
    setBlocks([makeBlock()]);
    setAssignEveryone(false);
    setAssignedIds([]);
    setEditingId(null);
  }

  function applyTradeStarter(nextTrade: PlaybookTrade) {
    setTrade(nextTrade);
    setBlocks(copy.tradeStarters[nextTrade].map((block) => makeBlock(block)));
    if (!title.trim()) setTitle(copy.trades[nextTrade]);
    setMessage('');
  }

  function applyStarter(type: PlaybookDocumentType) {
    setCategory(type);
    setTitle(copy.starterTitles[type]);
    setBlocks([makeBlock({ title: copy.types[type], body: copy.starterBodies[type] })]);
    setEditingId(null);
    setMessage('');
  }

  function updateBlock(id: string, patch: Partial<PlaybookStarterBlock>) {
    setBlocks((current) => current.map((block) => (block.id === id ? { ...block, ...patch } : block)));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= blocks.length) return;
    setBlocks((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  }

  function dropBlock(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return setDragIndex(null);
    setBlocks((current) => {
      const next = [...current];
      const [item] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
    setDragIndex(null);
  }

  function toggleAssignee(userId: string) {
    setAssignEveryone(false);
    setAssignedIds((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]);
  }

  function editDoc(doc: Doc) {
    const nextCategory = DOCUMENT_TYPES.includes(doc.category as PlaybookDocumentType)
      ? (doc.category as PlaybookDocumentType)
      : 'instruction';
    setEditingId(doc.id);
    setCategory(nextCategory);
    setTrade(tradeFromTags(doc.tags));
    setTitle(doc.title);
    setBlocks(parseBlocks(doc.body));
    setAssignEveryone(Boolean(doc.tags?.includes('assigned:all')));
    setAssignedIds((doc.tags || []).filter((tag) => tag.startsWith('assigned:') && tag !== 'assigned:all').map((tag) => tag.slice('assigned:'.length)));
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveDoc() {
    if (!title.trim() || !serializedBody.trim() || !manager) {
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
    const tags = [
      `trade:${trade}`,
      ...(assignEveryone ? ['assigned:all'] : assignedIds.map((id) => `assigned:${id}`))
    ];
    const payload = {
      organization_id: org.organizationId,
      title: title.trim(),
      category,
      body: serializedBody,
      tags,
      created_by: user.id,
      updated_at: new Date().toISOString()
    };

    const result = editingId
      ? await supabase
          .from('knowledge_documents')
          .update({ title: payload.title, category: payload.category, body: payload.body, tags: payload.tags, updated_at: payload.updated_at })
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
    if (!manager || !window.confirm(copy.deleteConfirm)) return;
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

  async function shareDoc(doc: Doc) {
    const text = `${doc.title}\n\n${doc.body || ''}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: doc.title, text });
        setMessage(copy.shared);
        return;
      } catch {
        return;
      }
    }
    await navigator.clipboard.writeText(text);
    setMessage(copy.copied);
  }

  async function copyDoc(doc: Doc) {
    await navigator.clipboard.writeText(`${doc.title}\n\n${doc.body || ''}`);
    setMessage(copy.copied);
  }

  function emailDoc(doc: Doc) {
    const subject = encodeURIComponent(doc.title);
    const body = encodeURIComponent(`${doc.title}\n\n${doc.body || ''}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  return (
    <OsModulePage
      title={copy.title}
      description={copy.description}
      requiredPlan="pro"
      requiredFeature={copy.title}
      featureCheck={(plan) => limitsForPlan(plan).pdfReports}
    >
      {manager ? (
        <section
          className="card form"
          style={{
            marginBottom: 24,
            display: 'grid',
            gap: 26,
            padding: 'clamp(18px, 3vw, 28px)'
          }}
        >
          <div style={{ ...sectionStyle, gap: 6 }}>
            <h2 style={{ margin: 0 }}>{copy.createTitle}</h2>
            <p className="muted" style={{ margin: 0, maxWidth: 760, lineHeight: 1.55 }}>{copy.createHelp}</p>
          </div>

          <div style={sectionStyle}>
            <div>
              <strong>{copy.chooseTrade}</strong>
              <p className="muted" style={{ margin: '5px 0 0', lineHeight: 1.5 }}>{copy.chooseTradeHelp}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 12 }}>
              {TRADES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={trade === item ? 'btn btn-primary' : 'btn'}
                  onClick={() => applyTradeStarter(item)}
                  style={{ minHeight: 48, whiteSpace: 'normal', lineHeight: 1.25, padding: '10px 12px' }}
                >
                  {copy.trades[item]}
                </button>
              ))}
            </div>
          </div>

          <div className="form-grid" style={{ gap: 16, alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: 7 }}>
              <span>{copy.typeLabel}</span>
              <select className="input" value={category} onChange={(event) => setCategory(event.target.value as PlaybookDocumentType)}>
                {DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{copy.types[type]}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 7 }}>
              <span>{copy.titleLabel}</span>
              <input className="input" placeholder={copy.titlePlaceholder} value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
          </div>

          <div style={sectionStyle}>
            <div>
              <strong>{copy.buildFromStarter}</strong>
              <p className="muted" style={{ margin: '5px 0 0', lineHeight: 1.5 }}>{copy.buildFromStarterHelp}</p>
              <p className="muted" style={{ margin: '4px 0 0', lineHeight: 1.5 }}>{copy.dragHint}</p>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              {blocks.map((block, index) => (
                <article
                  key={block.id}
                  className="card"
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropBlock(index)}
                  style={{ padding: '16px', cursor: 'grab' }}
                >
                  <div style={{ display: 'grid', gap: 14 }}>
                    <label style={{ display: 'grid', gap: 7 }}>
                      <span>{copy.blockTitle}</span>
                      <input className="input" value={block.title} onChange={(event) => updateBlock(block.id, { title: event.target.value })} />
                    </label>
                    <label style={{ display: 'grid', gap: 7 }}>
                      <span>{copy.blockBody}</span>
                      <textarea className="input" rows={4} value={block.body} onChange={(event) => updateBlock(block.id, { body: event.target.value })} />
                    </label>
                    <div className="settings-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
                      <button type="button" className="btn btn-sm" disabled={index === 0} onClick={() => moveBlock(index, -1)}>{copy.moveUp}</button>
                      <button type="button" className="btn btn-sm" disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)}>{copy.moveDown}</button>
                      <button type="button" className="btn btn-sm" disabled={blocks.length === 1} onClick={() => setBlocks((current) => current.filter((item) => item.id !== block.id))}>{copy.removeBlock}</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="settings-actions" style={{ flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
              <button type="button" className="btn" onClick={() => setBlocks((current) => [...current, makeBlock()])}>{copy.addBlock}</button>
              {!editingId ? DOCUMENT_TYPES.map((type) => (
                <button key={type} type="button" className="btn" onClick={() => applyStarter(type)}>{copy.starterAction}: {copy.types[type]}</button>
              )) : null}
            </div>
          </div>

          <div style={{ ...sectionStyle, gap: 12 }}>
            <div>
              <strong>{copy.assignTitle}</strong>
              <p className="muted" style={{ margin: '5px 0 0', maxWidth: 760, lineHeight: 1.5 }}>{copy.assignHelp}</p>
            </div>

            <label style={assignmentCardStyle}>
              <input
                type="checkbox"
                checked={assignEveryone}
                onChange={(event) => {
                  setAssignEveryone(event.target.checked);
                  if (event.target.checked) setAssignedIds([]);
                }}
                style={{ flex: '0 0 auto', margin: 0 }}
              />
              <span style={{ minWidth: 0, lineHeight: 1.4 }}>{copy.assignEveryone}</span>
            </label>

            {!assignEveryone && !teamOptionsLoading ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: 10,
                  width: '100%',
                  alignItems: 'start'
                }}
              >
                {teamOptions.map((person) => (
                  <label key={person.userId} style={assignmentCardStyle}>
                    <input
                      type="checkbox"
                      checked={assignedIds.includes(person.userId)}
                      onChange={() => toggleAssignee(person.userId)}
                      style={{ flex: '0 0 auto', margin: 0 }}
                    />
                    <span
                      style={{
                        display: 'block',
                        flex: '1 1 auto',
                        minWidth: 0,
                        lineHeight: 1.4,
                        whiteSpace: 'normal',
                        overflowWrap: 'anywhere'
                      }}
                    >
                      {person.label}
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <div className="settings-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveDoc()}>
                {saving ? copy.saving : editingId ? copy.update : copy.save}
              </button>
              {editingId ? <button type="button" className="btn" disabled={saving} onClick={resetForm}>{copy.cancel}</button> : null}
            </div>
            {message ? <p className="muted" role="status" style={{ margin: 0 }}>{message}</p> : null}
          </div>
        </section>
      ) : null}

      <section className="card" style={{ padding: 'clamp(18px, 3vw, 26px)' }}>
        {loading ? <p style={{ margin: 0 }}>{copy.loading}</p> : null}
        {!loading && docs.length === 0 ? (
          <div style={{ display: 'grid', gap: 6 }}>
            <h3 style={{ margin: 0 }}>{copy.emptyTitle}</h3>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>{copy.emptyBody}</p>
          </div>
        ) : null}
        <div style={{ display: 'grid', gap: 14 }}>
          {docs.map((doc) => {
            const type = DOCUMENT_TYPES.includes(doc.category as PlaybookDocumentType)
              ? (doc.category as PlaybookDocumentType)
              : 'instruction';
            const itemTrade = tradeFromTags(doc.tags);
            return (
              <article
                key={doc.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 18,
                  flexWrap: 'wrap',
                  padding: '16px 0',
                  borderBottom: '1px solid var(--border)'
                }}
              >
                <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                  <div className="muted" style={{ marginBottom: 5, lineHeight: 1.4 }}>{copy.types[type]} · {copy.trades[itemTrade]}{!manager ? ` · ${copy.assignedToYou}` : ''}</div>
                  <strong>{doc.title}</strong>
                  {doc.body ? <p className="muted" style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0', overflowWrap: 'anywhere', lineHeight: 1.55 }}>{doc.body}</p> : null}
                </div>
                <div className="settings-actions" style={{ flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
                  <button type="button" className="btn btn-sm" onClick={() => void shareDoc(doc)}>{copy.share}</button>
                  <button type="button" className="btn btn-sm" onClick={() => emailDoc(doc)}>{copy.shareEmail}</button>
                  <button type="button" className="btn btn-sm" onClick={() => void copyDoc(doc)}>{copy.shareCopy}</button>
                  {manager ? <button type="button" className="btn btn-sm" onClick={() => editDoc(doc)}>{copy.edit}</button> : null}
                  {manager ? <button type="button" className="btn btn-sm" onClick={() => void deleteDoc(doc)}>{copy.delete}</button> : null}
                </div>
              </article>
            );
          })}
        </div>
        {!manager && message ? <p className="muted" role="status" style={{ marginBottom: 0 }}>{message}</p> : null}
      </section>
    </OsModulePage>
  );
}
