'use client';

import Link from 'next/link';
import { StatusPill } from './status-pill';
import { useTranslation } from '@/components/locale-provider';

const copy = {
  en: { noAddress: 'No address added yet', justCreated: 'Just created', noCustomer: 'No customer', photo: 'photo', photos: 'photos' },
  es: { noAddress: 'Aún no hay dirección', justCreated: 'Recién creado', noCustomer: 'Sin cliente', photo: 'foto', photos: 'fotos' },
  vi: { noAddress: 'Chưa có địa chỉ', justCreated: 'Vừa tạo', noCustomer: 'Chưa có khách hàng', photo: 'ảnh', photos: 'ảnh' }
} as const;

export type SupabaseJobCard = {
  id: string;
  title: string;
  customer_name?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  status?: string | null;
  created_at?: string | null;
  photo_count?: number;
};

export function JobCard({ job }: { job: SupabaseJobCard }) {
  const { locale } = useTranslation();
  const c = copy[locale];
  const status = job.status || 'new';
  const subtitle = job.address || job.customer_name || c.noAddress;
  const created = job.created_at ? new Date(job.created_at).toLocaleString() : c.justCreated;

  return (
    <Link href={'/jobs/' + job.id} className="card" style={{ display: 'block' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <h3>{job.title}</h3>
        <StatusPill status={status} />
      </div>
      <p>{subtitle}</p>
      <p>
        {job.customer_name || c.noCustomer} · {created}
        {typeof job.photo_count === 'number' ? ` · ${job.photo_count} ${job.photo_count === 1 ? c.photo : c.photos}` : ''}
      </p>
    </Link>
  );
}
