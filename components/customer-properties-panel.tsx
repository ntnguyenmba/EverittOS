'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AddressAutocomplete } from '@/components/address-autocomplete';
import { useTranslation } from '@/components/locale-provider';
import type { StructuredAddress } from '@/lib/address/types';
import {
  PROPERTY_TYPE_LABELS,
  PROPERTY_TYPES,
  type CustomerPropertyRecord,
  type PropertyType
} from '@/lib/customer-property';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';

type JobSummary = {
  id: string;
  title: string;
  status: string | null;
  property_id?: string | null;
  scheduled_start?: string | null;
  start_date?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
};

type CustomerPropertiesPanelProps = {
  customerId: string;
  customerName: string;
  canEdit: boolean;
  jobs: JobSummary[];
};

type DraftProperty = {
  name: string;
  property_type: PropertyType;
  address: string;
  structured: StructuredAddress | null;
  timezone: string;
  access_instructions: string;
  gate_code: string;
  lockbox_code: string;
  default_price: string;
  is_primary: boolean;
};

const emptyDraft = (): DraftProperty => ({
  name: '',
  property_type: 'home',
  address: '',
  structured: null,
  timezone: '',
  access_instructions: '',
  gate_code: '',
  lockbox_code: '',
  default_price: '',
  is_primary: false
});

const copy = {
  en: {
    archiveConfirm: 'Archive this property? Existing jobs keep their saved address snapshot.', loadError: 'Unable to load properties.',
    nameRequired: 'Property name is required.', saveError: 'Unable to save property.', archiveError: 'Unable to archive property.',
    archivedSuccess: 'Property archived.', primaryError: 'Unable to set primary property.', similarJobError: 'Unable to create a similar job.',
    properties: 'Properties', loading: 'Loading properties…', add: 'Add property', intro: (name: string) => `Homes, rentals, offices, and other service locations for ${name}.`,
    empty: 'No properties yet.', noAddress: 'No address', primary: 'Primary', archived: 'Archived', property: 'Property',
    newJob: 'New job', creating: 'Creating…', bookAgain: 'Book again', nextJob: 'Next job', noneScheduled: 'None scheduled',
    lastCompleted: 'Last completed', noneYet: 'None yet', defaultPrice: 'Default price', timezone: 'Timezone', edit: 'Edit',
    setPrimary: 'Set primary', archive: 'Archive', editProperty: 'Edit property', propertyName: 'Property name',
    propertyType: 'Property type', address: 'Address', accessCodes: 'Access codes and instructions',
    accessInstructions: 'Access instructions', gateCode: 'Gate code', lockboxCode: 'Lockbox code', primaryProperty: 'Primary property',
    saving: 'Saving…', save: 'Save property', cancel: 'Cancel'
  },
  es: {
    archiveConfirm: '¿Archivar esta propiedad? Los trabajos existentes conservarán la dirección guardada.', loadError: 'No se pudieron cargar las propiedades.',
    nameRequired: 'El nombre de la propiedad es obligatorio.', saveError: 'No se pudo guardar la propiedad.', archiveError: 'No se pudo archivar la propiedad.',
    archivedSuccess: 'Propiedad archivada.', primaryError: 'No se pudo establecer la propiedad principal.', similarJobError: 'No se pudo crear un trabajo similar.',
    properties: 'Propiedades', loading: 'Cargando propiedades…', add: 'Agregar propiedad', intro: (name: string) => `Casas, alquileres, oficinas y otros lugares de servicio de ${name}.`,
    empty: 'Aún no hay propiedades.', noAddress: 'Sin dirección', primary: 'Principal', archived: 'Archivada', property: 'Propiedad',
    newJob: 'Nuevo trabajo', creating: 'Creando…', bookAgain: 'Reservar de nuevo', nextJob: 'Próximo trabajo', noneScheduled: 'Ninguno programado',
    lastCompleted: 'Último completado', noneYet: 'Aún ninguno', defaultPrice: 'Precio predeterminado', timezone: 'Zona horaria', edit: 'Editar',
    setPrimary: 'Establecer como principal', archive: 'Archivar', editProperty: 'Editar propiedad', propertyName: 'Nombre de la propiedad',
    propertyType: 'Tipo de propiedad', address: 'Dirección', accessCodes: 'Códigos e instrucciones de acceso',
    accessInstructions: 'Instrucciones de acceso', gateCode: 'Código de puerta', lockboxCode: 'Código de caja', primaryProperty: 'Propiedad principal',
    saving: 'Guardando…', save: 'Guardar propiedad', cancel: 'Cancelar'
  },
  vi: {
    archiveConfirm: 'Lưu trữ địa điểm này? Các công việc hiện có vẫn giữ bản sao địa chỉ đã lưu.', loadError: 'Không thể tải bất động sản.',
    nameRequired: 'Tên bất động sản là bắt buộc.', saveError: 'Không thể lưu bất động sản.', archiveError: 'Không thể lưu trữ bất động sản.',
    archivedSuccess: 'Đã lưu trữ bất động sản.', primaryError: 'Không thể đặt bất động sản chính.', similarJobError: 'Không thể tạo công việc tương tự.',
    properties: 'Bất động sản', loading: 'Đang tải bất động sản…', add: 'Thêm bất động sản', intro: (name: string) => `Nhà ở, nơi cho thuê, văn phòng và các địa điểm dịch vụ khác của ${name}.`,
    empty: 'Chưa có bất động sản.', noAddress: 'Chưa có địa chỉ', primary: 'Chính', archived: 'Đã lưu trữ', property: 'Bất động sản',
    newJob: 'Công việc mới', creating: 'Đang tạo…', bookAgain: 'Đặt lại', nextJob: 'Công việc tiếp theo', noneScheduled: 'Chưa lên lịch',
    lastCompleted: 'Hoàn thành gần nhất', noneYet: 'Chưa có', defaultPrice: 'Giá mặc định', timezone: 'Múi giờ', edit: 'Sửa',
    setPrimary: 'Đặt làm chính', archive: 'Lưu trữ', editProperty: 'Sửa bất động sản', propertyName: 'Tên bất động sản',
    propertyType: 'Loại bất động sản', address: 'Địa chỉ', accessCodes: 'Mã và hướng dẫn ra vào',
    accessInstructions: 'Hướng dẫn ra vào', gateCode: 'Mã cổng', lockboxCode: 'Mã hộp khóa', primaryProperty: 'Bất động sản chính',
    saving: 'Đang lưu…', save: 'Lưu bất động sản', cancel: 'Hủy'
  }
} as const;

export function CustomerPropertiesPanel({ customerId, customerName, canEdit, jobs }: CustomerPropertiesPanelProps) {
  const appFeedback = useAppFeedback();
  const { locale } = useTranslation();
  const c = copy[locale];
  const [properties, setProperties] = useState<CustomerPropertyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftProperty>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [duplicatingJobId, setDuplicatingJobId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/customers/${customerId}/properties?includeArchived=1`);
    const json = (await res.json().catch(() => ({}))) as { properties?: CustomerPropertyRecord[]; error?: string };
    if (!res.ok) {
      appFeedback.error(json.error || c.loadError);
      setLoading(false);
      return;
    }
    setProperties(json.properties || []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // Reload whenever the customer changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional customerId-scoped reload
  }, [customerId]);

  function jobsForProperty(propertyId: string) {
    return jobs.filter((job) => job.property_id === propertyId);
  }

  function nextJob(propertyId: string) {
    const now = Date.now();
    return jobsForProperty(propertyId)
      .filter((job) => {
        const stamp = job.scheduled_start || job.start_date;
        if (!stamp) return false;
        if (['completed', 'cancelled'].includes(String(job.status || '').toLowerCase())) return false;
        return new Date(stamp).getTime() >= now - 1000 * 60 * 60 * 12;
      })
      .sort((a, b) => String(a.scheduled_start || a.start_date).localeCompare(String(b.scheduled_start || b.start_date)))[0];
  }

  function lastCompleted(propertyId: string) {
    return jobsForProperty(propertyId)
      .filter((job) => String(job.status || '').toLowerCase() === 'completed' || job.completed_at)
      .sort((a, b) => String(b.completed_at || b.created_at || '').localeCompare(String(a.completed_at || a.created_at || '')))[0];
  }

  function beginCreate() {
    setEditingId(null);
    setDraft({ ...emptyDraft(), is_primary: properties.filter((p) => !p.is_archived).length === 0 });
    setShowForm(true);
  }

  function beginEdit(property: CustomerPropertyRecord) {
    setEditingId(property.id);
    setDraft({
      name: property.name,
      property_type: (property.property_type as PropertyType) || 'home',
      address: property.formatted_address || property.address || '',
      structured: null,
      timezone: property.timezone || '',
      access_instructions: property.access_instructions || '',
      gate_code: property.gate_code || '',
      lockbox_code: property.lockbox_code || '',
      default_price: property.default_price != null ? String(property.default_price) : '',
      is_primary: Boolean(property.is_primary)
    });
    setShowForm(true);
  }

  async function saveProperty() {
    if (!draft.name.trim()) {
      appFeedback.error(c.nameRequired);
      return;
    }
    setSaving(true);
    const payload = {
      name: draft.name.trim(),
      property_type: draft.property_type,
      formatted_address: draft.structured?.formattedAddress || draft.address,
      address_line_1: draft.structured?.addressLine1 || draft.address,
      address_line_2: draft.structured?.addressLine2 || null,
      city: draft.structured?.city || null,
      county: draft.structured?.county || null,
      state: draft.structured?.state || null,
      state_code: draft.structured?.stateCode || null,
      postal_code: draft.structured?.postalCode || null,
      country: draft.structured?.country || null,
      country_code: draft.structured?.countryCode || null,
      latitude: draft.structured?.latitude ?? null,
      longitude: draft.structured?.longitude ?? null,
      timezone: draft.timezone || null,
      access_instructions: draft.access_instructions || null,
      gate_code: draft.gate_code || null,
      lockbox_code: draft.lockbox_code || null,
      default_price:
        draft.default_price === null || draft.default_price === undefined || String(draft.default_price).trim() === ''
          ? null
          : Number(draft.default_price),
      is_primary: draft.is_primary
    };

    if (draft.structured?.latitude != null && draft.structured?.longitude != null && !draft.timezone) {
      const tzRes = await fetch(
        `/api/address/timezone?lat=${draft.structured.latitude}&lng=${draft.structured.longitude}`
      );
      const tzJson = (await tzRes.json().catch(() => ({}))) as { timezone?: string };
      if (tzJson.timezone) payload.timezone = tzJson.timezone;
    }

    const res = await fetch(
      editingId ? `/api/customers/${customerId}/properties/${editingId}` : `/api/customers/${customerId}/properties`,
      {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      appFeedback.error(json.error || c.saveError);
      return;
    }
    appFeedback.saved();
    setShowForm(false);
    setEditingId(null);
    setDraft(emptyDraft());
    void load();
  }

  async function archiveProperty(propertyId: string) {
    if (!window.confirm(c.archiveConfirm)) return;
    const res = await fetch(`/api/customers/${customerId}/properties/${propertyId}`, { method: 'DELETE' });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      appFeedback.error(json.error || c.archiveError);
      return;
    }
    appFeedback.success(c.archivedSuccess);
    void load();
  }

  async function setPrimary(propertyId: string) {
    const res = await fetch(`/api/customers/${customerId}/properties/${propertyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_primary: true })
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      appFeedback.error(json.error || c.primaryError);
      return;
    }
    appFeedback.saved();
    void load();
  }

  async function bookAgain(jobId: string) {
    setDuplicatingJobId(jobId);
    const res = await fetch(`/api/jobs/${jobId}/duplicate`, { method: 'POST' });
    const json = (await res.json().catch(() => ({}))) as { job?: { id: string }; redirectTo?: string; error?: string };
    setDuplicatingJobId(null);
    if (!res.ok || !json.job?.id) {
      appFeedback.error(json.error || c.similarJobError);
      return;
    }
    window.location.href = json.redirectTo || `/jobs/${json.job.id}?confirmSchedule=1`;
  }

  if (loading) {
    return (
      <div className="card" style={{ marginBottom: 18 }}>
        <h3>{c.properties}</h3>
        <p className="muted">{c.loading}</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="dashboard-section-head">
        <h3>{c.properties}</h3>
        {canEdit ? (
          <button type="button" className="dashboard-section-link btn" onClick={beginCreate}>
            {c.add}
          </button>
        ) : null}
      </div>
      <p className="muted">{c.intro(customerName)}</p>

      {properties.length === 0 ? <p className="muted">{c.empty}</p> : null}

      <div className="stack" style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        {properties.map((property) => {
          const upcoming = nextJob(property.id);
          const completed = lastCompleted(property.id);
          const address = property.formatted_address || property.address || c.noAddress;
          const type = (property.property_type || 'home') as PropertyType;
          return (
            <article
              key={property.id}
              style={{
                border: '1px solid var(--line)',
                borderRadius: 12,
                padding: 14,
                opacity: property.is_archived ? 0.7 : 1
              }}
            >
              <div className="customer-card-row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h4 style={{ margin: 0 }}>
                    {property.name}
                    {property.is_primary ? <span className="muted"> · {c.primary}</span> : null}
                    {property.is_archived ? <span className="muted"> · {c.archived}</span> : null}
                  </h4>
                  <p className="muted" style={{ margin: '4px 0' }}>
                    {PROPERTY_TYPE_LABELS[type] || c.property} · {customerName}
                  </p>
                  <p style={{ margin: 0 }}>{address}</p>
                </div>
                <div className="button-row" style={{ flexWrap: 'wrap' }}>
                  {!property.is_archived ? (
                    <Link
                      className="btn btn-primary"
                      href={`/jobs/new?customerId=${customerId}&propertyId=${property.id}`}
                    >
                      {c.newJob}
                    </Link>
                  ) : null}
                  {completed ? (
                    <button
                      type="button"
                      className="btn"
                      disabled={duplicatingJobId === completed.id}
                      onClick={() => void bookAgain(completed.id)}
                    >
                      {duplicatingJobId === completed.id ? c.creating : c.bookAgain}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="grid-2" style={{ marginTop: 10, gap: 8 }}>
                <p className="muted" style={{ margin: 0 }}>
                  {c.nextJob}:{' '}
                  {upcoming ? <Link href={`/jobs/${upcoming.id}`}>{upcoming.title}</Link> : c.noneScheduled}
                </p>
                <p className="muted" style={{ margin: 0 }}>
                  {c.lastCompleted}:{' '}
                  {completed ? <Link href={`/jobs/${completed.id}`}>{completed.title}</Link> : c.noneYet}
                </p>
                <p className="muted" style={{ margin: 0 }}>
                  {c.defaultPrice}: {property.default_price != null ? `$${Number(property.default_price).toFixed(2)}` : '—'}
                </p>
                <p className="muted" style={{ margin: 0 }}>
                  {c.timezone}: {property.timezone || '—'}
                </p>
              </div>
              {canEdit ? (
                <div className="button-row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                  <button type="button" className="btn" onClick={() => beginEdit(property)}>
                    {c.edit}
                  </button>
                  {!property.is_primary && !property.is_archived ? (
                    <button type="button" className="btn" onClick={() => void setPrimary(property.id)}>
                      {c.setPrimary}
                    </button>
                  ) : null}
                  {!property.is_archived ? (
                    <button type="button" className="btn" onClick={() => void archiveProperty(property.id)}>
                      {c.archive}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {showForm && canEdit ? (
        <div className="form" style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
          <h4>{editingId ? c.editProperty : c.add}</h4>
          <label>{c.propertyName}</label>
          <input className="input" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          <label>{c.propertyType}</label>
          <select
            className="input"
            value={draft.property_type}
            onChange={(e) => setDraft((d) => ({ ...d, property_type: e.target.value as PropertyType }))}
          >
            {PROPERTY_TYPES.map((type) => (
              <option key={type} value={type}>
                {PROPERTY_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <AddressAutocomplete
            label={c.address}
            value={draft.address}
            onChange={(formatted, structured) => setDraft((d) => ({ ...d, address: formatted, structured }))}
            onSelect={(suggestion) => {
              void fetch(`/api/address/timezone?lat=${suggestion.latitude}&lng=${suggestion.longitude}`)
                .then((r) => r.json())
                .then((json: { timezone?: string }) => {
                  if (json.timezone) setDraft((d) => ({ ...d, timezone: json.timezone || '' }));
                })
                .catch(() => undefined);
            }}
          />
          <label>{c.timezone}</label>
          <input className="input" value={draft.timezone} onChange={(e) => setDraft((d) => ({ ...d, timezone: e.target.value }))} placeholder="America/Chicago" />
          <label>{c.defaultPrice}</label>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            value={draft.default_price}
            onChange={(e) => setDraft((d) => ({ ...d, default_price: e.target.value }))}
          />
          <details>
            <summary>{c.accessCodes}</summary>
            <label style={{ marginTop: 8 }}>{c.accessInstructions}</label>
            <textarea
              className="input"
              rows={3}
              value={draft.access_instructions}
              onChange={(e) => setDraft((d) => ({ ...d, access_instructions: e.target.value }))}
            />
            <label>{c.gateCode}</label>
            <input className="input" value={draft.gate_code} onChange={(e) => setDraft((d) => ({ ...d, gate_code: e.target.value }))} />
            <label>{c.lockboxCode}</label>
            <input className="input" value={draft.lockbox_code} onChange={(e) => setDraft((d) => ({ ...d, lockbox_code: e.target.value }))} />
          </details>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <input
              type="checkbox"
              checked={draft.is_primary}
              onChange={(e) => setDraft((d) => ({ ...d, is_primary: e.target.checked }))}
            />
            {c.primaryProperty}
          </label>
          <div className="button-row" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveProperty()}>
              {saving ? c.saving : c.save}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
            >
              {c.cancel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
