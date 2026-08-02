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
type StarterKey = 'inspection' | 'maintenance' | 'landscaping' | 'repair' | 'turnover' | 'cleaning' | 'junk';

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
    title: 'Job instructions', description: 'Create instructions once and reuse them for any property service.',
    newInstructions: 'New instructions', askEveritt: 'Ask Everitt', askHelp: 'Answer three questions and Everitt will set up a simple checklist for you.',
    service: 'What service is this for?', servicePlaceholder: 'Example: lawn care, inspection, repair, turnover', size: 'How detailed should it be?', special: 'What must the team remember?',
    short: 'Short', standard: 'Standard', detailed: 'Detailed', start: 'Start checklist', name: 'Instruction name', applies: 'Use for', everyJob: 'Every job',
    selectedCustomers: 'Selected customers', selectedJobs: 'Selected jobs', language: 'Editing language', addStep: 'Add step', stepPlaceholder: 'Write one clear action', required: 'Required',
    photo: 'Photo required', remove: 'Remove', save: 'Save instructions', saving: 'Saving...', saved: 'Instructions saved.', empty: 'No instructions yet.', existing: 'Saved instructions',
    active: 'Active', inactive: 'Inactive', drag: 'Drag to reorder', chooseStarter: 'Start with an example', noBlank: 'Add a name and at least one step.',
    loadError: 'Instructions could not be loaded.', saveError: 'Instructions could not be saved.',
    inspection: 'Property inspection', maintenance: 'Routine maintenance', landscaping: 'Lawn and landscaping', repair: 'Repair visit', turnover: 'Property turnover', cleaning: 'Cleaning service', junk: 'Junk removal'
  },
  es: {
    title: 'Instrucciones de trabajo', description: 'Cree instrucciones una vez y reutilícelas para cualquier servicio de propiedad.',
    newInstructions: 'Nuevas instrucciones', askEveritt: 'Preguntar a Everitt', askHelp: 'Responda tres preguntas y Everitt preparará una lista sencilla.',
    service: '¿Para qué servicio son?', servicePlaceholder: 'Ejemplo: jardinería, inspección, reparación, entrega', size: '¿Qué nivel de detalle necesita?', special: '¿Qué debe recordar el equipo?',
    short: 'Corta', standard: 'Normal', detailed: 'Detallada', start: 'Crear lista', name: 'Nombre de las instrucciones', applies: 'Usar para', everyJob: 'Todos los trabajos',
    selectedCustomers: 'Clientes seleccionados', selectedJobs: 'Trabajos seleccionados', language: 'Idioma de edición', addStep: 'Agregar paso', stepPlaceholder: 'Escriba una acción clara', required: 'Obligatorio',
    photo: 'Foto obligatoria', remove: 'Eliminar', save: 'Guardar instrucciones', saving: 'Guardando...', saved: 'Instrucciones guardadas.', empty: 'Aún no hay instrucciones.', existing: 'Instrucciones guardadas',
    active: 'Activa', inactive: 'Inactiva', drag: 'Arrastre para ordenar', chooseStarter: 'Comience con un ejemplo', noBlank: 'Agregue un nombre y al menos un paso.',
    loadError: 'No se pudieron cargar las instrucciones.', saveError: 'No se pudieron guardar las instrucciones.',
    inspection: 'Inspección de propiedad', maintenance: 'Mantenimiento rutinario', landscaping: 'Césped y jardinería', repair: 'Visita de reparación', turnover: 'Entrega de propiedad', cleaning: 'Servicio de limpieza', junk: 'Retiro de basura'
  },
  vi: {
    title: 'Hướng dẫn công việc', description: 'Tạo một lần và dùng lại cho mọi dịch vụ bất động sản.',
    newInstructions: 'Hướng dẫn mới', askEveritt: 'Hỏi Everitt', askHelp: 'Trả lời ba câu hỏi và Everitt sẽ tạo danh sách đơn giản.',
    service: 'Hướng dẫn này dành cho dịch vụ nào?', servicePlaceholder: 'Ví dụ: chăm sóc sân, kiểm tra, sửa chữa, bàn giao', size: 'Bạn cần mức độ chi tiết nào?', special: 'Nhóm cần nhớ điều gì?',
    short: 'Ngắn', standard: 'Tiêu chuẩn', detailed: 'Chi tiết', start: 'Tạo danh sách', name: 'Tên hướng dẫn', applies: 'Áp dụng cho', everyJob: 'Mọi công việc',
    selectedCustomers: 'Khách hàng đã chọn', selectedJobs: 'Công việc đã chọn', language: 'Ngôn ngữ đang sửa', addStep: 'Thêm bước', stepPlaceholder: 'Viết một hành động rõ ràng', required: 'Bắt buộc',
    photo: 'Bắt buộc chụp ảnh', remove: 'Xóa', save: 'Lưu hướng dẫn', saving: 'Đang lưu...', saved: 'Đã lưu hướng dẫn.', empty: 'Chưa có hướng dẫn.', existing: 'Hướng dẫn đã lưu',
    active: 'Đang dùng', inactive: 'Ngừng dùng', drag: 'Kéo để sắp xếp', chooseStarter: 'Bắt đầu bằng mẫu', noBlank: 'Thêm tên và ít nhất một bước.',
    loadError: 'Không tải được hướng dẫn.', saveError: 'Không lưu được hướng dẫn.',
    inspection: 'Kiểm tra bất động sản', maintenance: 'Bảo trì định kỳ', landscaping: 'Chăm sóc sân vườn', repair: 'Lịch sửa chữa', turnover: 'Bàn giao bất động sản', cleaning: 'Dịch vụ vệ sinh', junk: 'Dọn đồ bỏ đi'
  }
} as const;

const STARTERS: Record<StarterKey, Record<LocaleCode, string[]>> = {
  inspection: {
    en: ['Confirm property access', 'Photograph the exterior', 'Check visible damage and safety issues', 'Check utilities and major systems', 'Record needed repairs', 'Secure the property before leaving'],
    es: ['Confirmar acceso a la propiedad', 'Fotografiar el exterior', 'Revisar daños visibles y riesgos de seguridad', 'Revisar servicios y sistemas principales', 'Registrar reparaciones necesarias', 'Cerrar la propiedad antes de salir'],
    vi: ['Xác nhận cách vào bất động sản', 'Chụp ảnh bên ngoài', 'Kiểm tra hư hỏng và vấn đề an toàn', 'Kiểm tra tiện ích và hệ thống chính', 'Ghi lại việc cần sửa', 'Khóa bất động sản trước khi rời đi']
  },
  maintenance: {
    en: ['Review the work request', 'Confirm access and shutoff locations', 'Inspect the affected area', 'Complete the maintenance task', 'Test the result', 'Clean the work area', 'Take completion photos'],
    es: ['Revisar la solicitud de trabajo', 'Confirmar acceso y ubicaciones de cierre', 'Inspeccionar el área afectada', 'Completar el mantenimiento', 'Probar el resultado', 'Limpiar el área de trabajo', 'Tomar fotos finales'],
    vi: ['Xem yêu cầu công việc', 'Xác nhận cách vào và vị trí van ngắt', 'Kiểm tra khu vực liên quan', 'Hoàn thành việc bảo trì', 'Kiểm tra kết quả', 'Dọn khu vực làm việc', 'Chụp ảnh hoàn thành']
  },
  landscaping: {
    en: ['Confirm service area and special requests', 'Inspect the yard for hazards', 'Mow or service the assigned areas', 'Trim edges and vegetation', 'Remove debris', 'Check gates and irrigation concerns', 'Take completion photos'],
    es: ['Confirmar el área de servicio y solicitudes especiales', 'Revisar el jardín por riesgos', 'Cortar o atender las áreas asignadas', 'Recortar bordes y vegetación', 'Retirar residuos', 'Revisar portones y riego', 'Tomar fotos finales'],
    vi: ['Xác nhận khu vực làm việc và yêu cầu đặc biệt', 'Kiểm tra nguy hiểm trong sân', 'Cắt cỏ hoặc chăm sóc khu vực được giao', 'Tỉa mép và cây', 'Thu dọn rác', 'Kiểm tra cổng và vấn đề tưới nước', 'Chụp ảnh hoàn thành']
  },
  repair: {
    en: ['Confirm the reported problem', 'Protect nearby surfaces', 'Document the condition before work', 'Complete the approved repair', 'Test for proper operation', 'Clean the work area', 'Explain any follow-up needed'],
    es: ['Confirmar el problema reportado', 'Proteger las superficies cercanas', 'Documentar la condición antes del trabajo', 'Completar la reparación aprobada', 'Probar el funcionamiento', 'Limpiar el área de trabajo', 'Explicar cualquier seguimiento necesario'],
    vi: ['Xác nhận vấn đề đã báo', 'Bảo vệ bề mặt xung quanh', 'Ghi lại tình trạng trước khi làm', 'Hoàn thành sửa chữa đã duyệt', 'Kiểm tra hoạt động', 'Dọn khu vực làm việc', 'Giải thích việc cần theo dõi']
  },
  turnover: {
    en: ['Take arrival photos', 'Check for damage or missing items', 'Complete the assigned service work', 'Restock approved supplies', 'Test lights, locks, and basic equipment', 'Set the property for the next occupant', 'Take final photos and secure the property'],
    es: ['Tomar fotos al llegar', 'Revisar daños o artículos faltantes', 'Completar el servicio asignado', 'Reponer suministros aprobados', 'Probar luces, cerraduras y equipo básico', 'Preparar la propiedad para el próximo ocupante', 'Tomar fotos finales y cerrar la propiedad'],
    vi: ['Chụp ảnh khi đến', 'Kiểm tra hư hỏng hoặc đồ thiếu', 'Hoàn thành dịch vụ được giao', 'Bổ sung vật dụng đã duyệt', 'Kiểm tra đèn, khóa và thiết bị cơ bản', 'Chuẩn bị nhà cho người tiếp theo', 'Chụp ảnh hoàn thành và khóa nhà']
  },
  cleaning: {
    en: ['Confirm access and special requests', 'Complete the assigned rooms or areas', 'Clean high-touch surfaces', 'Clean kitchens and bathrooms when included', 'Vacuum or mop assigned floors', 'Remove approved waste', 'Check doors and lights before leaving'],
    es: ['Confirmar acceso y solicitudes especiales', 'Completar las habitaciones o áreas asignadas', 'Limpiar superficies de alto contacto', 'Limpiar cocinas y baños cuando estén incluidos', 'Aspirar o trapear los pisos asignados', 'Retirar residuos aprobados', 'Revisar puertas y luces antes de salir'],
    vi: ['Xác nhận cách vào và yêu cầu đặc biệt', 'Hoàn thành các phòng hoặc khu vực được giao', 'Lau bề mặt thường chạm', 'Vệ sinh bếp và phòng tắm nếu có', 'Hút bụi hoặc lau sàn được giao', 'Bỏ rác theo yêu cầu', 'Kiểm tra cửa và đèn trước khi rời đi']
  },
  junk: {
    en: ['Confirm approved items for removal', 'Photograph items before moving them', 'Protect walls, floors, and doors', 'Load approved items safely', 'Sweep the cleared area', 'Confirm no requested items were left behind', 'Take final photos'],
    es: ['Confirmar los artículos aprobados para retirar', 'Fotografiar los artículos antes de moverlos', 'Proteger paredes, pisos y puertas', 'Cargar los artículos aprobados de forma segura', 'Barrer el área despejada', 'Confirmar que no queden artículos solicitados', 'Tomar fotos finales'],
    vi: ['Xác nhận đồ được phép mang đi', 'Chụp ảnh trước khi di chuyển', 'Bảo vệ tường, sàn và cửa', 'Chất đồ an toàn', 'Quét khu vực đã dọn', 'Xác nhận không bỏ sót đồ cần mang đi', 'Chụp ảnh hoàn thành']
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
    const { data, error } = await supabase.from('job_instruction_templates').select('id, name, description, applies_to_all_jobs, active').eq('organization_id', organizationId).order('created_at', { ascending: false });
    if (error) { setMessage(copy.loadError); return; }
    setTemplates((data || []) as TemplateRow[]);
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login?next=/settings/job-instructions'); return; }
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

  function useStarter(kind: StarterKey) {
    const starter = STARTERS[kind];
    setName(copy[kind]);
    setSteps(starter.en.map((_, index) => ({ key: crypto.randomUUID(), required: true, photoRequired: false, text: { en: starter.en[index], es: starter.es[index], vi: starter.vi[index] } })));
    setMessage('');
  }

  function startFromGuide() {
    const count = detail === 'short' ? 4 : detail === 'detailed' ? 8 : 6;
    setName(service.trim() || copy.newInstructions);
    setSteps(Array.from({ length: count }, (_, index) => ({
      key: crypto.randomUUID(), required: true, photoRequired: false,
      text: {
        en: index === 0 && special.trim() ? special.trim() : `Add step ${index + 1}`,
        es: index === 0 && special.trim() ? special.trim() : `Agregue el paso ${index + 1}`,
        vi: index === 0 && special.trim() ? special.trim() : `Thêm bước ${index + 1}`
      }
    })));
    setGuideOpen(false);
  }

  function updateStep(index: number, patch: Partial<StepDraft>) {
    setSteps((current) => current.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step));
  }

  function dropStep(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return;
    setSteps((current) => { const next = [...current]; const [moved] = next.splice(dragIndex, 1); next.splice(targetIndex, 0, moved); return next; });
    setDragIndex(null);
  }

  async function save() {
    if (!orgId || saving) return;
    if (!name.trim() || validSteps.length === 0) { setMessage(copy.noBlank); return; }
    setSaving(true);
    setMessage('');
    const { data: { user } } = await supabase.auth.getUser();
    const { data: template, error: templateError } = await supabase.from('job_instruction_templates').insert({ organization_id: orgId, created_by: user?.id || null, name: name.trim(), description: scope, applies_to_all_jobs: scope === 'all', active: true }).select('id').single();
    if (templateError || !template) { setSaving(false); setMessage(copy.saveError); return; }

    for (let index = 0; index < validSteps.length; index += 1) {
      const step = validSteps[index];
      const { data: savedStep, error: stepError } = await supabase.from('job_instruction_steps').insert({ template_id: template.id, position: index, required: step.required, photo_required: step.photoRequired }).select('id').single();
      if (stepError || !savedStep) continue;
      const translations = (['en', 'es', 'vi'] as LocaleCode[]).filter((language) => step.text[language].trim()).map((language) => ({ step_id: savedStep.id, locale: language, instruction: step.text[language].trim() }));
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

        {guideOpen ? <div className="form" style={{ marginTop: 16 }}>
          <p className="muted">{copy.askHelp}</p>
          <label>{copy.service}<input className="input" placeholder={copy.servicePlaceholder} value={service} onChange={(event) => setService(event.target.value)} /></label>
          <label>{copy.size}<select className="input" value={detail} onChange={(event) => setDetail(event.target.value as typeof detail)}><option value="short">{copy.short}</option><option value="standard">{copy.standard}</option><option value="detailed">{copy.detailed}</option></select></label>
          <label>{copy.special}<textarea className="input" rows={2} value={special} onChange={(event) => setSpecial(event.target.value)} /></label>
          <button type="button" className="btn btn-primary" onClick={startFromGuide}>{copy.start}</button>
        </div> : null}

        <div style={{ marginTop: 20 }}>
          <strong>{copy.chooseStarter}</strong>
          <div className="button-row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {(Object.keys(STARTERS) as StarterKey[]).map((kind) => <button key={kind} type="button" className="btn" onClick={() => useStarter(kind)}>{copy[kind]}</button>)}
          </div>
        </div>

        <div className="form" style={{ marginTop: 20 }}>
          <label>{copy.name}<input className="input" value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>{copy.applies}<select className="input" value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}><option value="all">{copy.everyJob}</option><option value="customers">{copy.selectedCustomers}</option><option value="jobs">{copy.selectedJobs}</option></select></label>
          <label>{copy.language}<select className="input" value={editLocale} onChange={(event) => setEditLocale(event.target.value as LocaleCode)}><option value="en">English</option><option value="es">Español</option><option value="vi">Tiếng Việt</option></select></label>
          <p className="muted">{copy.drag}</p>

          {steps.map((step, index) => <div key={step.key} className="card" draggable onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropStep(index)} style={{ marginBottom: 10, cursor: 'grab' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><span aria-hidden="true">☰</span><textarea className="input" rows={2} placeholder={copy.stepPlaceholder} value={step.text[editLocale]} onChange={(event) => updateStep(index, { text: { ...step.text, [editLocale]: event.target.value } })} style={{ flex: 1 }} /></div>
            <div className="button-row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
              <label><input type="checkbox" checked={step.required} onChange={(event) => updateStep(index, { required: event.target.checked })} /> {copy.required}</label>
              <label><input type="checkbox" checked={step.photoRequired} onChange={(event) => updateStep(index, { photoRequired: event.target.checked })} /> {copy.photo}</label>
              <button type="button" className="btn btn-sm" onClick={() => setSteps((current) => current.filter((_, stepIndex) => stepIndex !== index))}>{copy.remove}</button>
            </div>
          </div>)}

          <button type="button" className="btn" onClick={() => setSteps((current) => [...current, blankStep()])}>{copy.addStep}</button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>{saving ? copy.saving : copy.save}</button>
          {message ? <p className="muted" role="status">{message}</p> : null}
        </div>
      </section>

      <section className="settings-card" style={{ marginTop: 18 }}>
        <h3>{copy.existing}</h3>
        {templates.length === 0 ? <p className="muted">{copy.empty}</p> : null}
        {templates.map((template) => <div key={template.id} className="list-row compact"><div><strong>{template.name}</strong><p className="muted">{template.applies_to_all_jobs ? copy.everyJob : template.description === 'customers' ? copy.selectedCustomers : copy.selectedJobs} · {template.active ? copy.active : copy.inactive}</p></div></div>)}
      </section>
    </SettingsShell>
  );
}
