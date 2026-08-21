'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useTranslation } from '@/components/locale-provider';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useAsyncAction } from '@/hooks/use-async-action';
import { DEFAULT_ESTIMATE_SETTINGS, normalizeEstimateSettings, type EstimateSettings } from '@/lib/estimate-engine';
import { FEEDBACK } from '@/lib/feedback-labels';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import type { EverittForm, EverittFormField } from '@/lib/os-types';

type FormDetail = EverittForm & { settings?: Record<string, unknown>; everitt_form_fields?: EverittFormField[] };

const copy = {
  en: { loading:'Loading…', notFound:'Form not found', share:'Share this form publicly or embed it on your site.', helper:'Estimate helper', helperText:'Set your starting prices once. EverittOS shows customers a range, never a locked final price.', currency:'Currency', minimum:'Minimum charge', standard:'Standard cleaning starting price', deep:'Deep cleaning starting price', move:'Move-in / Move-out starting price', bedroom:'Extra bedroom', bathroom:'Extra bathroom', range:'Range on each side (%)', save:'Save pricing', saved:'Estimate pricing saved.', publicLink:'Public link', deactivate:'Deactivate', activate:'Activate', website:'Put it on your website', copyEmbed:'Copy embed', answers:'What customers answer', noFields:'No fields configured.', required:'required', copyError:'Copy the embed code manually.' },
  es: { loading:'Cargando…', notFound:'Formulario no encontrado', share:'Comparte este formulario públicamente o insértalo en tu sitio web.', helper:'Ayuda para estimados', helperText:'Configura tus precios iniciales una vez. EverittOS muestra un rango al cliente, no un precio final fijo.', currency:'Moneda', minimum:'Cargo mínimo', standard:'Precio inicial de limpieza estándar', deep:'Precio inicial de limpieza profunda', move:'Precio inicial de mudanza entrada / salida', bedroom:'Dormitorio adicional', bathroom:'Baño adicional', range:'Rango a cada lado (%)', save:'Guardar precios', saved:'Precios del estimado guardados.', publicLink:'Enlace público', deactivate:'Desactivar', activate:'Activar', website:'Ponlo en tu sitio web', copyEmbed:'Copiar código', answers:'Lo que responde el cliente', noFields:'No hay campos configurados.', required:'obligatorio', copyError:'Copia el código manualmente.' },
  vi: { loading:'Đang tải…', notFound:'Không tìm thấy biểu mẫu', share:'Chia sẻ biểu mẫu này công khai hoặc nhúng vào trang web của bạn.', helper:'Thiết lập báo giá', helperText:'Đặt giá khởi điểm một lần. EverittOS hiển thị khoảng giá cho khách, không khóa giá cuối cùng.', currency:'Tiền tệ', minimum:'Giá tối thiểu', standard:'Giá khởi điểm vệ sinh tiêu chuẩn', deep:'Giá khởi điểm vệ sinh sâu', move:'Giá khởi điểm dọn vào / dọn ra', bedroom:'Thêm phòng ngủ', bathroom:'Thêm phòng tắm', range:'Khoảng giá mỗi bên (%)', save:'Lưu giá', saved:'Đã lưu giá báo giá.', publicLink:'Liên kết công khai', deactivate:'Tắt', activate:'Bật', website:'Đặt trên trang web của bạn', copyEmbed:'Sao chép mã nhúng', answers:'Thông tin khách trả lời', noFields:'Chưa có trường thông tin.', required:'bắt buộc', copyError:'Hãy sao chép mã nhúng thủ công.' }
} as const;

export default function FormDetailPage() {
  const params = useParams(); const router = useRouter(); const feedback = useAppFeedback(); const { busy, runResponse, buttonLabel } = useAsyncAction(); const { locale } = useTranslation(); const c = copy[locale];
  const id = String(params.id); const [plan,setPlan]=useState<EverittosPlan>('free'); const [role,setRole]=useState<UserRole>('owner'); const [form,setForm]=useState<FormDetail|null>(null); const [pricing,setPricing]=useState<Required<EstimateSettings>>(DEFAULT_ESTIMATE_SETTINGS); const [loading,setLoading]=useState(true); const [canManage,setCanManage]=useState(false);
  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/f/${form?.slug || ''}` : `/f/${form?.slug || ''}`; const embedCode = form ? `<iframe src="${publicUrl}" width="100%" height="760" frameborder="0"></iframe>` : '';
  async function load(){ setLoading(true); const {data:{user}}=await supabase.auth.getUser(); if(!user){router.push('/login');return;} const {data:profile}=await supabase.from('profiles').select('plan, role').eq('id',user.id).maybeSingle(); const org=await fetchOrganizationContext(user.id); const userRole=normalizeRole(org?.role||profile?.role); setPlan(normalizePlan(profile?.plan));setRole(userRole);setCanManage(isManagerRole(userRole)); const res=await fetch(`/api/forms/${id}`);const json=await res.json();setLoading(false);if(!res.ok){feedback.error(json.error||c.notFound);return;}setForm(json.form);if(json.form?.form_type==='estimate')setPricing(normalizeEstimateSettings(json.form.settings));}
  useEffect(()=>{void load();},[id,router,locale]);
  async function toggleActive(){if(!form||!canManage)return;const res=await runResponse(()=>fetch(`/api/forms/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:!form.active})}),'updated');if(res)void load();}
  async function savePricing(){if(!form||!canManage)return;const res=await runResponse(()=>fetch(`/api/forms/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({settings:{...(form.settings||{}),estimate:pricing}})}),'updated');if(res){feedback.success(c.saved);void load();}}
  function setNumber(key:keyof EstimateSettings,raw:string){setPricing(current=>({...current,[key]:Number(raw)||0}));} function setBase(service:string,raw:string){setPricing(current=>({...current,basePrices:{...current.basePrices,[service]:Number(raw)||0}}));}
  async function copyEmbed(){if(!embedCode)return;try{await navigator.clipboard.writeText(embedCode);feedback.success(FEEDBACK.copied);}catch{feedback.error(c.copyError);}}
  if(loading)return <AppShell plan={plan} role={role}><p>{c.loading}</p></AppShell>; if(!form)return <AppShell plan={plan} role={role}><p>{c.notFound}</p></AppShell>; const fields=form.everitt_form_fields||[];
  return <AppShell plan={plan} role={role}>
    <header className="page-header"><div><h1>{form.name}</h1><p className="page-subtitle">{form.description||c.share}</p></div></header>
    {form.form_type==='estimate'?<div className="card" style={{marginBottom:18}}><h3>{c.helper}</h3><p className="muted">{c.helperText}</p><div className="form" style={{marginTop:16}}>
      <label>{c.currency}</label><input className="input" value={pricing.currency} onChange={e=>setPricing(p=>({...p,currency:e.target.value.toUpperCase()}))} disabled={!canManage}/>
      <label>{c.minimum}</label><input className="input" type="number" min="0" value={pricing.minimumCharge} onChange={e=>setNumber('minimumCharge',e.target.value)} disabled={!canManage}/>
      <label>{c.standard}</label><input className="input" type="number" min="0" value={pricing.basePrices['standard cleaning']||0} onChange={e=>setBase('standard cleaning',e.target.value)} disabled={!canManage}/>
      <label>{c.deep}</label><input className="input" type="number" min="0" value={pricing.basePrices['deep cleaning']||0} onChange={e=>setBase('deep cleaning',e.target.value)} disabled={!canManage}/>
      <label>{c.move}</label><input className="input" type="number" min="0" value={pricing.basePrices['move-in / move-out']||0} onChange={e=>setBase('move-in / move-out',e.target.value)} disabled={!canManage}/>
      <label>{c.bedroom}</label><input className="input" type="number" min="0" value={pricing.bedroomAmount} onChange={e=>setNumber('bedroomAmount',e.target.value)} disabled={!canManage}/>
      <label>{c.bathroom}</label><input className="input" type="number" min="0" value={pricing.bathroomAmount} onChange={e=>setNumber('bathroomAmount',e.target.value)} disabled={!canManage}/>
      <label>{c.range}</label><input className="input" type="number" min="0" max="50" value={pricing.rangePercent} onChange={e=>setNumber('rangePercent',e.target.value)} disabled={!canManage}/>
      {canManage?<button className="btn btn-primary" type="button" disabled={busy} onClick={()=>void savePricing()}>{buttonLabel(c.save,FEEDBACK.loading)}</button>:null}
    </div></div>:null}
    <div className="card" style={{marginBottom:16}}><h3>{c.publicLink}</h3><p><a href={`/f/${form.slug}`} target="_blank" rel="noreferrer">{publicUrl}</a></p>{canManage?<button type="button" className="btn" disabled={busy} onClick={()=>void toggleActive()}>{buttonLabel(form.active?c.deactivate:c.activate,FEEDBACK.loading)}</button>:null}</div>
    <div className="card" style={{marginBottom:16}}><h3>{c.website}</h3><pre className="code-block">{embedCode}</pre><button type="button" className="btn" onClick={()=>void copyEmbed()}>{c.copyEmbed}</button></div>
    <div className="card"><h3>{c.answers}</h3>{fields.length===0?<p className="muted">{c.noFields}</p>:null}<ul>{fields.sort((a,b)=>a.sort_order-b.sort_order).map(field=><li key={field.id}>{field.label} <span className="muted">{field.required?`· ${c.required}`:''}</span></li>)}</ul></div>
  </AppShell>;
}
