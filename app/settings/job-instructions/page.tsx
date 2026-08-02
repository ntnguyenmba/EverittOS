'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsShell } from '@/components/settings/settings-shell';
import { useTranslation } from '@/components/locale-provider';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type LocaleCode = 'en' | 'es' | 'vi';

type StepDraft = {
  key: string;
  required: boolean;
  photoRequired: boolean;
  text: Record<LocaleCode, string>;
};

type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  applies_to_all_jobs: boolean;
  active: boolean;
};

const COPY = {
  en: {
    title: 'Job instructions',
    description: 'Create instructions once and reuse them on jobs.',
    newInstructions: 'New instructions',
    askEveritt: 'Ask Everitt',
    askHelp: 'Answer three questions and Everitt will start the checklist for you.',
    service: 'What service is this for?',
    size: 'How detailed should it be?',
    special: 'Anything important?',
    short: 'Short',
    standard: 'Standard',
    detailed: 'Detailed',
    start: 'Start checklist',
    name: 'Instruction name',
    applies: 'Use for',
    everyJob: 'Every job',
    selectedCustomers: 'Selected customers',
    selectedJobs: 'Selected jobs',
    language: 'Editing language',
    addStep: 'Add step',
    stepPlaceholder: 'Write one clear action',
    required: 'Required',
    photo: 'Photo required',
    remove: 'Remove',
    save: 'Save instructions',
    saving: 'Saving...',
    saved: 'Instructions saved.',
    empty: 'No instructions yet.',
    existing: 'Saved instructions',
    active: 'Active',
    inactive: 'Inactive',
    drag: 'Drag to reorder',
    chooseStarter: 'Start with an example',
    house: 'Standard house cleaning',
    deep: 'Deep cleaning',
    airbnb: 'Airbnb turnover',
    office: 'Office cleaning',
    moveout: 'Move-out cleaning',
    noBlank: 'Add a name and at least one step.',
    loadError: 'Instructions could not be loaded.',
    saveError: 'Instructions could not be saved.'
  },
  es: {
    title: 'Instrucciones de trabajo',
    description: 'Cree instrucciones una vez y reutilícelas en los trabajos.',
    newInstructions: 'Nuevas instrucciones',
    askEveritt: 'Preguntar a Everitt',
    askHelp: 'Responda tres preguntas y Everitt iniciará la lista.',
    service: '¿Para qué servicio son?',
    size: '¿Qué nivel de detalle necesita?',
    special: '¿Algo importante?',
    short: 'Corta',
    standard: 'Normal',
    detailed: 'Detallada',
    start: 'Crear lista',
    name: 'Nombre de las instrucciones',
    applies: 'Usar para',
    everyJob: 'Todos los trabajos',
    selectedCustomers: 'Clientes seleccionados',
    selectedJobs: 'Trabajos seleccionados',
    language: 'Idioma de edición',
    addStep: 'Agregar paso',
    stepPlaceholder: 'Escriba una acción clara',
    required: 'Obligatorio',
    photo: 'Foto obligatoria',
    remove: 'Eliminar',
    save: 'Guardar instrucciones',
    saving: 'Guardando...',
    saved: 'Instrucciones guardadas.',
    empty: 'Aún no hay instrucciones.',
    existing: 'Instrucciones guardadas',
    active: 'Activa',
    inactive: 'Inactiva',
    drag: 'Arrastre para ordenar',
    chooseStarter: 'Comience con un ejemplo',
    house: 'Limpieza estándar de casa',
    deep: 'Limpieza profunda',
    airbnb: 'Cambio de Airbnb',
    office: 'Limpieza de oficina',
    moveout: 'Limpieza de mudanza',
    noBlank: 'Agregue un nombre y al menos un paso.',
    loadError: 'No se pudieron cargar las instrucciones.',
    saveError: 'No se pudieron guardar las instrucciones.'
  },
  vi: {
    title: 'Hướng dẫn công việc',
    description: 'Tạo một lần và dùng lại cho nhiều công việc.',
    newInstructions: 'Hướng dẫn mới',
    askEveritt: 'Hỏi Everitt',
    askHelp: 'Trả lời ba câu hỏi và Everitt sẽ tạo danh sách ban đầu.',
    service: 'Hướng dẫn này dành cho dịch vụ nào?',
    size: 'Bạn cần mức độ chi tiết nào?',
    special: 'Có điều gì quan trọng?',
    short: 'Ngắn',
    standard: 'Tiêu chuẩn',
    detailed: 'Chi tiết',
    start: 'Tạo danh sách',
    name: 'Tên hướng dẫn',
    applies: 'Áp dụng cho',
    everyJob: 'Mọi công việc',
    selectedCustomers: 'Khách hàng đã chọn',
    selectedJobs: 'Công việc đã chọn',
    language: 'Ngôn ngữ đang sửa',
    addStep: 'Thêm bước',
    stepPlaceholder: 'Viết một hành động rõ ràng',
    required: 'Bắt buộc',
    photo: 'Bắt buộc chụp ảnh',
    remove: 'Xóa',
    save: 'Lưu hướng dẫn',
    saving: 'Đang lưu...',
    saved: 'Đã lưu hướng dẫn.',
    empty: 'Chưa có hướng dẫn.',
    existing: 'Hướng dẫn đã lưu',
    active: 'Đang dùng',
    inactive: 'Ngừng dùng',
    drag: 'Kéo để sắp xếp',
    chooseStarter: 'Bắt đầu bằng mẫu',
    house: 'Vệ sinh nhà tiêu chuẩn',
    deep: 'Vệ sinh sâu',
    airbnb: 'Dọn phòng Airbnb',
    office: 'Vệ sinh văn phòng',
    moveout: 'Vệ sinh chuyển nhà',
    noBlank: 'Thêm tên và ít nhất một bước.',
    loadError: 'Không tải được hướng dẫn.',
    saveError: 'Không lưu được hướng dẫn.'
  }
} as const;

const STARTERS: Record<string, Record<LocaleCode, string[]>> = {
  house: {
    en: ['Confirm access and special requests', 'Dust reachable surfaces', 'Clean kitchen surfaces and sink', 'Clean bathrooms', 'Vacuum and mop floors', 'Check doors and lights before leaving'],
    es: ['Confirmar acceso y solicitudes especiales', 'Quitar el polvo de las superficies accesibles', 'Limpiar superficies y fregadero de la cocina', 'Limpiar los baños', 'Aspirar y trapear los pisos', 'Revisar puertas y luces antes de salir'],
    vi: ['Xác nhận cách vào nhà và yêu cầu đặc biệt', 'Lau bụi các bề mặt có thể với tới', 'Lau bề mặt bếp và bồn rửa', 'Vệ sinh phòng tắm', 'Hút bụi và lau sàn', 'Kiểm tra cửa và đèn trước khi rời đi']
  },
  deep: {
    en: ['Confirm rooms and priorities', 'Dust high and low surfaces', 'Clean cabinet fronts and baseboards', 'Deep clean kitchen', 'Deep clean bathrooms', 'Vacuum and mop all floors', 'Take final photos'],
    es: ['Confirmar habitaciones y prioridades', 'Quitar el polvo de superficies altas y bajas', 'Limpiar frentes de gabinetes y zócalos', 'Limpiar profundamente la cocina', 'Limpiar profundamente los baños', 'Aspirar y trapear todos los pisos', 'Tomar fotos finales'],
    vi: ['Xác nhận phòng và việc ưu tiên', 'Lau bụi bề mặt cao và thấp', 'Lau mặt tủ và chân tường', 'Vệ sinh sâu khu bếp', 'Vệ sinh sâu phòng tắm', 'Hút bụi và lau toàn bộ sàn', 'Chụp ảnh hoàn thành']
  },
  airbnb: {
    en: ['Take arrival photos', 'Collect and start laundry', 'Clean kitchen and restock supplies', 'Clean bathrooms and replace towels', 'Make beds with clean linens', 'Vacuum and mop', 'Check guest-ready details', 'Take final photos and lock the property'],
    es: ['Tomar fotos al llegar', 'Recoger e iniciar la lavandería', 'Limpiar la cocina y reponer suministros', 'Limpiar baños y cambiar toallas', 'Hacer las camas con ropa limpia', 'Aspirar y trapear', 'Revisar los detalles para huéspedes', 'Tomar fotos finales y cerrar la propiedad'],
    vi: ['Chụp ảnh khi đến', 'Thu gom và bắt đầu giặt đồ', 'Vệ sinh bếp và bổ sung vật dụng', 'Vệ sinh phòng tắm và thay khăn', 'Thay ga và dọn giường', 'Hút bụi và lau sàn', 'Kiểm tra mọi thứ sẵn sàng đón khách', 'Chụp ảnh hoàn thành và khóa nhà']
  },
  office: {
    en: ['Check access and alarm instructions', 'Empty trash and replace liners', 'Wipe desks and shared surfaces', 'Clean break room', 'Clean restrooms', 'Vacuum and mop floors', 'Secure doors and set alarm'],
    es: ['Revisar acceso e instrucciones de alarma', 'Vaciar basura y cambiar bolsas', 'Limpiar escritorios y superficies compartidas', 'Limpiar la sala de descanso', 'Limpiar los baños', 'Aspirar y trapear los pisos', 'Cerrar puertas y activar la alarma'],
    vi: ['Kiểm tra cách vào và hướng dẫn báo động', 'Đổ rác và thay túi', 'Lau bàn và bề mặt dùng chung', 'Vệ sinh khu nghỉ', 'Vệ sinh nhà vệ sinh', 'Hút bụi và lau sàn', 'Khóa cửa và bật báo động']
  },
  moveout: {
    en: ['Confirm the property is empty', 'Clean inside cabinets and drawers', 'Clean appliances inside and outside', 'Deep clean bathrooms', 'Clean baseboards, doors, and trim', 'Vacuum and mop all floors', 'Take final photos'],
    es: ['Confirmar que la propiedad esté vacía', 'Limpiar dentro de gabinetes y cajones', 'Limpiar electrodomésticos por dentro y por fuera', 'Limpiar profundamente los baños', 'Limpiar zócalos, puertas y molduras', 'Aspirar y trapear todos los pisos', 'Tomar fotos finales'],
    vi: ['Xác nhận nhà đã trống', 'Vệ sinh bên trong tủ và ngăn kéo', 'Vệ sinh thiết bị cả trong và ngoài', 'Vệ sinh sâu phòng tắm', 'Lau chân tường, cửa và nẹp', 'Hút bụi và lau toàn bộ sàn', 'Chụp ảnh hoàn thành']
  }
};

function blankStep(): StepDraft {
  return { key: crypto.randomUUID(), required: true, photoRequired: false, text: { en: '', es: '', vi: '' } };
}

export default function JobInstructionsPage() {
  const router = useRouter();
  const { locale } = useTranslation();
  const copy = COPY[locale];
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [orgId, setOrgId] = useState('');
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'all' | 'customers' | 'jobs'>('all');
  const [editLocale, setEditLocale] = useState<LocaleCode>(locale);
  const [steps, setSteps] = useState<StepDraft[]>([blankStep()]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const [service, setService] = useState('');
  const [detail, setDetail] = useState<'short' | 'standard' | 'detailed'>('standard');
  const [special, setSpecial] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  async function loadTemplates(organizationId: string) {
    const { data, error } = await supabase
      .from('job_instruction_templates')
      .select('id, name, description, applies_to_all_jobs, active')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    if (error) {
      setMessage(copy.loadError);
      return;
    }
    setTemplates((data || []) as TemplateRow[]);
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/settings/job-instructions');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan));
      setRole(normalizeRole(profile?.role));
      const workspace = await ensureOrganizationForUser(user.id);
      if (!workspace) return;
      setOrgId(workspace.organizationId);
      await loadTemplates(workspace.organizationId);
    }
    void load();
  }, [router]);

  useEffect(() => { setEditLocale(locale); }, [locale]);

  const validSteps = useMemo(() => steps.filter((step) => step.text.en.trim() || step.text.es.trim() || step.text.vi.trim()), [steps]);

  function useStarter(kind: keyof typeof STARTERS) {
    const starter = STARTERS[kind];
    setName(copy[kind]);
    setSteps(starter.en.map((_, index) => ({
      key: crypto.randomUUID(),
      required: true,
      photoRequired: false,
      text: { en: starter.en[index], es: starter.es[index], vi: starter.vi[index] }
    })));
    setMessage('');
  }

  function startFromGuide() {
    const count = detail === 'short' ? 4 : detail === 'detailed' ? 8 : 6;
    const base = service.trim() || copy.newInstructions;
    setName(base);
    const generated = Array.from({ length: count }, (_, index) => {
      const suffix = index === 0 && special.trim() ? special.trim() : '';
      return {
        key: crypto.randomUUID(),
        required: true,
        photoRequired: false,
        text: {
          en: suffix || `Step ${index + 1}`,
          es: suffix || `Paso ${index + 1}`,
          vi: suffix || `Bước ${index + 1}`
        }
      };
    });
    setSteps(generated);
    setGuideOpen(false);
  }

  function updateStep(index: number, patch: Partial<StepDraft>) {
    setSteps((current) => current.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step));
  }

  function dropStep(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return;
    setSteps((current) => {
      const next = [...current];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDragIndex(null);
  }

  async function save() {
    if (!orgId || saving) return;
    if (!name.trim() || validSteps.length === 0) {
      setMessage(copy.noBlank);
      return;
    }
    setSaving(true);
    setMessage('');
    const { data: { user } } = await supabase.auth.getUser();
    const { data: template, error: templateError } = await supabase
      .from('job_instruction_templates')
      .insert({
        organization_id: orgId,
        created_by: user?.id || null,
        name: name.trim(),
        description: scope,
        applies_to_all_jobs: scope === 'all',
        active: true
      })
      .select('id')
      .single();

    if (templateError || !template) {
      setSaving(false);
      setMessage(copy.saveError);
      return;
    }

    for (let index = 0; index < validSteps.length; index += 1) {
      const step = validSteps[index];
      const { data: savedStep, error: stepError } = await supabase
        .from('job_instruction_steps')
        .insert({ template_id: template.id, position: index, required: step.required, photo_required: step.photoRequired })
        .select('id')
        .single();
      if (stepError || !savedStep) continue;
      const translations = (['en', 'es', 'vi'] as LocaleCode[])
        .filter((language) => step.text[language].trim())
        .map((language) => ({ step_id: savedStep.id, locale: language, instruction: step.text[language].trim() }));
      if (translations.length) await supabase.from('job_instruction_step_translations').insert(translations);
    }

    setSaving(false);
    setMessage(copy.saved);
    setName('');
    setScope('all');
    setSteps([blankStep()]);
    await loadTemplates(orgId);
  }

  return (
    <SettingsShell plan={plan} role={role} title={copy.title} description={copy.description}>
      <section className="settings-card">
        <div className="button-row" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={() => setGuideOpen(false)}>{copy.newInstructions}</button>
          <button type="button" className="btn" onClick={() => setGuideOpen((open) => !open)}>{copy.askEveritt}</button>
        </div>

        {guideOpen ? (
          <div className="form" style={{ marginTop: 16 }}>
            <p className="muted">{copy.askHelp}</p>
            <label>{copy.service}<input className="input" value={service} onChange={(event) => setService(event.target.value)} /></label>
            <label>{copy.size}<select className="input" value={detail} onChange={(event) => setDetail(event.target.value as typeof detail)}><option value="short">{copy.short}</option><option value="standard">{copy.standard}</option><option value="detailed">{copy.detailed}</option></select></label>
            <label>{copy.special}<textarea className="input" rows={2} value={special} onChange={(event) => setSpecial(event.target.value)} /></label>
            <button type="button" className="btn btn-primary" onClick={startFromGuide}>{copy.start}</button>
          </div>
        ) : null}

        <div style={{ marginTop: 20 }}>
          <strong>{copy.chooseStarter}</strong>
          <div className="button-row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {(['house', 'deep', 'airbnb', 'office', 'moveout'] as const).map((kind) => <button key={kind} type="button" className="btn" onClick={() => useStarter(kind)}>{copy[kind]}</button>)}
          </div>
        </div>

        <div className="form" style={{ marginTop: 20 }}>
          <label>{copy.name}<input className="input" value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>{copy.applies}<select className="input" value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}><option value="all">{copy.everyJob}</option><option value="customers">{copy.selectedCustomers}</option><option value="jobs">{copy.selectedJobs}</option></select></label>
          <label>{copy.language}<select className="input" value={editLocale} onChange={(event) => setEditLocale(event.target.value as LocaleCode)}><option value="en">English</option><option value="es">Español</option><option value="vi">Tiếng Việt</option></select></label>

          <p className="muted">{copy.drag}</p>
          {steps.map((step, index) => (
            <div key={step.key} className="card" draggable onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropStep(index)} style={{ marginBottom: 10, cursor: 'grab' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span aria-hidden="true">☰</span>
                <textarea className="input" rows={2} placeholder={copy.stepPlaceholder} value={step.text[editLocale]} onChange={(event) => updateStep(index, { text: { ...step.text, [editLocale]: event.target.value } })} style={{ flex: 1 }} />
              </div>
              <div className="button-row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                <label><input type="checkbox" checked={step.required} onChange={(event) => updateStep(index, { required: event.target.checked })} /> {copy.required}</label>
                <label><input type="checkbox" checked={step.photoRequired} onChange={(event) => updateStep(index, { photoRequired: event.target.checked })} /> {copy.photo}</label>
                <button type="button" className="btn btn-sm" onClick={() => setSteps((current) => current.filter((_, stepIndex) => stepIndex !== index))}>{copy.remove}</button>
              </div>
            </div>
          ))}

          <button type="button" className="btn" onClick={() => setSteps((current) => [...current, blankStep()])}>{copy.addStep}</button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>{saving ? copy.saving : copy.save}</button>
          {message ? <p className="muted" role="status">{message}</p> : null}
        </div>
      </section>

      <section className="settings-card" style={{ marginTop: 18 }}>
        <h3>{copy.existing}</h3>
        {templates.length === 0 ? <p className="muted">{copy.empty}</p> : null}
        {templates.map((template) => (
          <div key={template.id} className="list-row compact">
            <div><strong>{template.name}</strong><p className="muted">{template.applies_to_all_jobs ? copy.everyJob : template.description === 'customers' ? copy.selectedCustomers : copy.selectedJobs} · {template.active ? copy.active : copy.inactive}</p></div>
          </div>
        ))}
      </section>
    </SettingsShell>
  );
}
