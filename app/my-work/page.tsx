'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { StatusPill } from '@/components/status-pill';
import { useTranslation } from '@/components/locale-provider';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type JobRow = {
  id: string;
  title: string;
  customer_name: string | null;
  address: string | null;
  status: string | null;
  due_date: string | null;
  assigned_to: string | null;
};

type ShareRow = {
  id: string;
  record_type: string;
  record_id: string;
  access_level: string;
  created_at: string | null;
};

const copy = {
  en: {
    title: 'My Work', subtitle: 'Assigned jobs are work you are responsible for. Shared records only give you access to view or edit information.',
    notifications: 'Notifications', assignedTitle: 'Jobs assigned to me', assignedHelp: 'These jobs count as your assigned work and appear in your personal metrics.',
    loading: 'Loading…', noAssigned: 'No jobs are assigned to you yet.', noCustomer: 'No customer', noAddress: 'No address',
    due: 'Due', noDueDate: 'No due date', open: 'Open', sharedTitle: 'Records shared with me',
    sharedHelp: 'Shared access does not assign the job to you and does not add it to your assigned-job metrics.',
    noShared: 'No records have been shared with you yet.', sharedAccess: 'Shared access', canEdit: 'Can edit',
    viewOnly: 'View only', shared: 'Shared', recently: 'recently', openShared: 'Open shared record'
  },
  es: {
    title: 'Mi trabajo', subtitle: 'Los trabajos asignados son su responsabilidad. Los registros compartidos solo permiten ver o editar información.',
    notifications: 'Notificaciones', assignedTitle: 'Trabajos asignados a mí', assignedHelp: 'Estos trabajos cuentan como trabajo asignado y aparecen en sus métricas personales.',
    loading: 'Cargando…', noAssigned: 'Aún no tiene trabajos asignados.', noCustomer: 'Sin cliente', noAddress: 'Sin dirección',
    due: 'Vence', noDueDate: 'Sin fecha límite', open: 'Abrir', sharedTitle: 'Registros compartidos conmigo',
    sharedHelp: 'El acceso compartido no le asigna el trabajo ni lo agrega a sus métricas de trabajos asignados.',
    noShared: 'Aún no se ha compartido ningún registro con usted.', sharedAccess: 'Acceso compartido', canEdit: 'Puede editar',
    viewOnly: 'Solo lectura', shared: 'Compartido', recently: 'recientemente', openShared: 'Abrir registro compartido'
  },
  vi: {
    title: 'Công việc của tôi', subtitle: 'Công việc được giao là phần bạn chịu trách nhiệm. Bản ghi được chia sẻ chỉ cho phép xem hoặc chỉnh sửa thông tin.',
    notifications: 'Thông báo', assignedTitle: 'Công việc được giao cho tôi', assignedHelp: 'Các công việc này được tính vào phần việc và số liệu cá nhân của bạn.',
    loading: 'Đang tải…', noAssigned: 'Bạn chưa được giao công việc nào.', noCustomer: 'Chưa có khách hàng', noAddress: 'Chưa có địa chỉ',
    due: 'Hạn', noDueDate: 'Chưa có hạn', open: 'Mở', sharedTitle: 'Bản ghi được chia sẻ với tôi',
    sharedHelp: 'Quyền truy cập được chia sẻ không giao công việc cho bạn và không thêm vào số liệu công việc được giao.',
    noShared: 'Chưa có bản ghi nào được chia sẻ với bạn.', sharedAccess: 'Quyền truy cập được chia sẻ', canEdit: 'Có thể chỉnh sửa',
    viewOnly: 'Chỉ xem', shared: 'Đã chia sẻ', recently: 'gần đây', openShared: 'Mở bản ghi được chia sẻ'
  }
} as const;

function formatDate(value: string | null, locale: string, noDueDate: string) {
  if (!value) return noDueDate;
  return new Date(value).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

function recordHref(recordType: string, recordId: string) {
  if (recordType === 'job') return `/jobs/${recordId}`;
  if (recordType === 'customer') return `/customers/${recordId}`;
  if (recordType === 'report') return '/reports';
  return '#';
}

export default function MyWorkPage() {
  const router = useRouter();
  const { locale } = useTranslation();
  const c = copy[locale];
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('employee');
  const [assignedJobs, setAssignedJobs] = useState<JobRow[]>([]);
  const [sharedRecords, setSharedRecords] = useState<ShareRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login?next=/my-work');
      return;
    }

    const [{ data: profile }, org] = await Promise.all([
      supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle(),
      fetchOrganizationContext(user.id)
    ]);
    setPlan(normalizePlan(profile?.plan));
    setRole(normalizeRole(org?.role || profile?.role));

    if (!org?.organizationId) {
      setAssignedJobs([]);
      setSharedRecords([]);
      setLoading(false);
      return;
    }

    const { data: workerRows } = await supabase
      .from('workers')
      .select('id')
      .eq('organization_id', org.organizationId)
      .eq('auth_user_id', user.id);
    const assignedIds = Array.from(
      new Set([user.id, ...((workerRows || []) as { id: string }[]).map((worker) => worker.id)].filter(Boolean))
    );

    const jobsQuery = supabase
      .from('jobs')
      .select('id, title, customer_name, address, status, due_date, assigned_to')
      .eq('organization_id', org.organizationId)
      .order('due_date', { ascending: true, nullsFirst: false });

    const [{ data: jobs }, { data: shares }] = await Promise.all([
      assignedIds.length ? jobsQuery.in('assigned_to', assignedIds) : jobsQuery.eq('assigned_to', user.id),
      supabase
        .from('record_shares')
        .select('id, record_type, record_id, access_level, created_at')
        .eq('organization_id', org.organizationId)
        .eq('shared_with_user_id', user.id)
        .order('created_at', { ascending: false })
    ]);

    setAssignedJobs((jobs || []) as JobRow[]);
    setSharedRecords((shares || []) as ShareRow[]);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell plan={plan} role={role}>
      <div className="page-head">
        <div>
          <h1>{c.title}</h1>
          <p className="muted">{c.subtitle}</p>
        </div>
        <Link className="btn" href="/notifications">
          {c.notifications}
        </Link>
      </div>

      <div className="grid-2" style={{ marginTop: 18 }}>
        <div className="card">
          <h3>{c.assignedTitle}</h3>
          <p className="muted">{c.assignedHelp}</p>
          {loading ? <p className="loading-state">{c.loading}</p> : null}
          {!loading && assignedJobs.length === 0 ? <p className="muted">{c.noAssigned}</p> : null}
          {assignedJobs.map((job) => (
            <div key={job.id} className="list-row">
              <div>
                <strong>{job.title}</strong>
                <p className="muted">{job.customer_name || c.noCustomer} · {job.address || c.noAddress}</p>
                <p className="muted">{c.due} {formatDate(job.due_date, locale, c.noDueDate)}</p>
              </div>
              <div className="inline-actions">
                <StatusPill status={job.status} />
                <Link className="btn" href={`/jobs/${job.id}`}>
                  {c.open}
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3>{c.sharedTitle}</h3>
          <p className="muted">{c.sharedHelp}</p>
          {loading ? <p className="loading-state">{c.loading}</p> : null}
          {!loading && sharedRecords.length === 0 ? <p className="muted">{c.noShared}</p> : null}
          {sharedRecords.map((share) => (
            <div key={share.id} className="list-row">
              <div>
                <strong>{share.record_type.replace('_', ' ')}</strong>
                <p className="muted">{c.sharedAccess} · {share.access_level === 'edit' ? c.canEdit : c.viewOnly}</p>
                <p className="muted">{c.shared} {share.created_at ? new Date(share.created_at).toLocaleString(locale) : c.recently}</p>
              </div>
              <Link className="btn" href={recordHref(share.record_type, share.record_id)}>
                {c.openShared}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
