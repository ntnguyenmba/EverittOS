'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
};

export default function ProjectsPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const org = await fetchOrganizationContext(user.id);
    setPlan(normalizePlan(profile?.plan));
    setRole(normalizeRole(org?.role || profile?.role));
    if (!org) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('os_tasks')
      .select('id, title, status, priority, due_date')
      .eq('organization_id', org.organizationId)
      .order('created_at', { ascending: false })
      .limit(100);

    setTasks(data || []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTask() {
    if (!title.trim()) return;
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;
    const org = await fetchOrganizationContext(user.id);
    if (!org) return;

    const { error } = await supabase.from('os_tasks').insert({
      organization_id: org.organizationId,
      title: title.trim(),
      created_by: user.id
    });

    if (error) {
      setMessage(error.message);
      return;
    }
    setTitle('');
    void load();
  }

  return (
    <AppShell plan={plan} role={role}>
      <header className="page-header">
        <h1>Projects & Tasks</h1>
        <p className="page-subtitle">Tasks, checklists, and project work across your organization.</p>
      </header>

      {isManagerRole(role) ? (
        <div className="card form" style={{ marginBottom: 18 }}>
          <h3>New task</h3>
          <input className="input" placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button type="button" className="btn btn-primary" onClick={() => void createTask()}>
            Add task
          </button>
        </div>
      ) : null}

      {message ? <p className="auth-message auth-message-error">{message}</p> : null}

      <div className="card">
        <h3>Tasks</h3>
        {loading ? <p>Loading...</p> : null}
        {!loading && tasks.length === 0 ? <p className="muted">No tasks yet. Create one above or from a job.</p> : null}
        {tasks.map((task) => (
          <div key={task.id} className="dashboard-today-row">
            <span>{task.title}</span>
            <span className="muted">{task.status}{task.due_date ? ` · ${task.due_date}` : ''}</span>
          </div>
        ))}
      </div>

      <p className="muted" style={{ marginTop: 16 }}>
        Board and calendar views are coming next. Jobs with checklists remain under <Link href="/jobs">Jobs</Link>.
      </p>
    </AppShell>
  );
}
