'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type DirectoryMember = {
  userId: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};

type MemberRow = {
  user_id: string;
  role: string;
  active: boolean;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

function roleLabel(role: string) {
  const normalized = normalizeRole(role);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).replaceAll('_', ' ');
}

export function TeamDirectory() {
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) {
          setError('Sign in to view your team.');
          setLoading(false);
        }
        return;
      }

      const workspace = await ensureOrganizationForUser(user.id);
      if (!workspace) {
        if (!cancelled) {
          setError('Your company is still setting up.');
          setLoading(false);
        }
        return;
      }

      const { data: memberRows, error: memberError } = await supabase
        .from('organization_members')
        .select('user_id, role, active')
        .eq('organization_id', workspace.organizationId)
        .in('role', ['owner', 'admin', 'manager', 'employee', 'contractor'])
        .order('role');

      if (memberError) {
        if (!cancelled) {
          setError(memberError.message);
          setLoading(false);
        }
        return;
      }

      const rows = (memberRows || []) as MemberRow[];
      const ids = rows.map((row) => row.user_id);
      const { data: profileRows } = ids.length
        ? await supabase.from('profiles').select('id, full_name, email').in('id', ids)
        : { data: [] as ProfileRow[] };

      const profiles = new Map<string, ProfileRow>();
      for (const profile of (profileRows || []) as ProfileRow[]) profiles.set(profile.id, profile);

      const next = rows.map((row) => {
        const profile = profiles.get(row.user_id);
        const email = profile?.email?.trim() || '';
        const name = profile?.full_name?.trim() || email || 'Team member';
        return {
          userId: row.user_id,
          name,
          email,
          role: normalizeRole(row.role),
          active: row.active
        };
      });

      if (!cancelled) {
        setMembers(next);
        setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return members.filter((member) => {
      if (roleFilter !== 'all' && member.role !== roleFilter) return false;
      if (!text) return true;
      return [member.name, member.email, member.role].some((value) => value.toLowerCase().includes(text));
    });
  }, [members, query, roleFilter]);

  return (
    <section className="card" style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>Team directory</h2>
          <p className="muted" style={{ margin: '6px 0 0' }}>Find managers, staff, and contractors, then assign them when creating a job.</p>
        </div>
        <Link className="btn btn-primary" href="/jobs/new">Create job</Link>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <label>
          Search team
          <input className="input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, email, or role" />
        </label>
        <label>
          Role
          <select className="input" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="all">All assignable team</option>
            <option value="owner">Owners</option>
            <option value="admin">Admins</option>
            <option value="manager">Managers</option>
            <option value="employee">Staff</option>
            <option value="contractor">Contractors</option>
          </select>
        </label>
      </div>

      {loading ? <p className="loading-state">Loading team...</p> : null}
      {error ? <p className="auth-message auth-message-error">{error}</p> : null}
      {!loading && !error && filtered.length === 0 ? <p className="muted">No matching team members.</p> : null}

      <div className="customer-list" style={{ marginTop: 14 }}>
        {filtered.map((member) => (
          <article key={member.userId} className="list-row customer-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>{member.name}</strong>
              <p className="muted" style={{ margin: '3px 0 0' }}>{roleLabel(member.role)} · {member.active ? 'Active' : 'Inactive'}</p>
              {member.email ? <p className="muted" style={{ margin: 0, overflowWrap: 'anywhere' }}>{member.email}</p> : null}
            </div>
            {member.active ? (
              <Link className="btn btn-sm" href={`/jobs/new?assigned_to=${encodeURIComponent(member.userId)}`}>
                Assign to job
              </Link>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
