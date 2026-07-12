'use client';

import { useCallback, useEffect, useState } from 'react';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type AuditItem = {
  id: string;
  action: string;
  message: string | null;
  actor_name: string | null;
  created_at: string | null;
};

type TeamAuditHistoryPanelProps = {
  role: UserRole;
};

function formatDate(value: string | null | undefined) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function TeamAuditHistoryPanel({ role }: TeamAuditHistoryPanelProps) {
  const normalizedRole = normalizeRole(role);
  const canView = normalizedRole === 'owner' || normalizedRole === 'admin';
  const [items, setItems] = useState<AuditItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!canView || loading || items.length > 0) return;
    setLoading(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const org = await ensureOrganizationForUser(user.id);
    if (!org) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('activity_logs')
      .select('id, action, message, actor_name, created_at')
      .eq('organization_id', org.organizationId)
      .in('entity_type', ['member', 'invitation', 'organization', 'team'])
      .order('created_at', { ascending: false })
      .limit(25);

    setItems((data || []) as AuditItem[]);
    setLoading(false);
  }, [canView, items.length, loading]);

  useEffect(() => {
    if (open) void load();
  }, [load, open]);

  if (!canView) return null;

  return (
    <div className="settings-card">
      <button
        type="button"
        className="btn"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {open ? 'Hide team audit history' : 'Show team audit history'}
      </button>
      <p className="muted">Owner and admin only. Hidden from managers, workers, contractors, viewers, and clients.</p>

      {open ? (
        <div style={{ marginTop: 12 }}>
          {loading ? <p className="loading-state">Loading audit history...</p> : null}
          {!loading && items.length === 0 ? <p className="muted">No audit history yet.</p> : null}
          {items.map((item) => (
            <div key={item.id} className="list-row compact">
              <div>
                <strong>{item.message || item.action}</strong>
                <p className="muted">
                  {item.actor_name || 'System'} · {formatDate(item.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
