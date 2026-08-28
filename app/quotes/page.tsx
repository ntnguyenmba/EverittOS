'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useWorkspacePlan } from '@/components/workspace-plan-provider';
import { useTranslation } from '@/components/locale-provider';

type Quote = {
  id: string;
  status: string;
  service_type: string | null;
  size_value: number | null;
  size_unit: string | null;
  primary_units: number | null;
  extra_units: number | null;
  condition: string | null;
  frequency: string | null;
  add_ons: string[] | null;
  labor_hours: number | null;
  price: number;
  currency: string;
  source_request: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  notes: string | null;
  job_id: string | null;
  created_at: string;
};

const copy = {
  en: { title:'Quotes', sub:'Price the request, save the quote, share it, then turn the same record into a job.', request:'Customer request', requestHint:'Paste the text, email, or notes you received.', customer:'Customer', email:'Email', phone:'Phone', service:'Service', size:'Size / quantity', unit:'Unit', primary:'Primary units', extra:'Extra units', condition:'Condition', frequency:'Frequency', addons:'Add-ons', hours:'Labor hours', price:'Final price', notes:'Customer note', save:'Save quote', saving:'Saving...', saved:'Saved quotes', empty:'No saved quotes yet.', share:'Share', copyAction:'Copy', print:'PDF / Print', job:'Create job', openJob:'Open job', converting:'Creating...', draft:'Draft', schema:'Saved quotes need the latest database migration.', error:'Could not save quote.' },
  es: { title:'Cotizaciones', sub:'Calcula la solicitud, guarda la cotización, compártela y convierte el mismo registro en trabajo.', request:'Solicitud del cliente', requestHint:'Pega el texto, correo o notas recibidas.', customer:'Cliente', email:'Correo', phone:'Teléfono', service:'Servicio', size:'Tamaño / cantidad', unit:'Unidad', primary:'Unidades principales', extra:'Unidades extra', condition:'Condición', frequency:'Frecuencia', addons:'Extras', hours:'Horas de trabajo', price:'Precio final', notes:'Nota para el cliente', save:'Guardar cotización', saving:'Guardando...', saved:'Cotizaciones guardadas', empty:'Aún no hay cotizaciones guardadas.', share:'Compartir', copyAction:'Copiar', print:'PDF / Imprimir', job:'Crear trabajo', openJob:'Abrir trabajo', converting:'Creando...', draft:'Borrador', schema:'Las cotizaciones guardadas necesitan la última migración de base de datos.', error:'No se pudo guardar la cotización.' },
  vi: { title:'Báo giá', sub:'Định giá yêu cầu, lưu báo giá, chia sẻ rồi chuyển chính báo giá đó thành công việc.', request:'Yêu cầu của khách', requestHint:'Dán tin nhắn, email hoặc ghi chú bạn nhận được.', customer:'Khách hàng', email:'Email', phone:'Điện thoại', service:'Dịch vụ', size:'Quy mô / số lượng', unit:'Đơn vị', primary:'Đơn vị chính', extra:'Đơn vị thêm', condition:'Tình trạng', frequency:'Tần suất', addons:'Dịch vụ thêm', hours:'Giờ công', price:'Giá cuối', notes:'Ghi chú cho khách', save:'Lưu báo giá', saving:'Đang lưu...', saved:'Báo giá đã lưu', empty:'Chưa có báo giá đã lưu.', share:'Chia sẻ', copyAction:'Sao chép', print:'PDF / In', job:'Tạo công việc', openJob:'Mở công việc', converting:'Đang tạo...', draft:'Bản nháp', schema:'Báo giá đã lưu cần bản cập nhật cơ sở dữ liệu mới nhất.', error:'Không thể lưu báo giá.' }
} as const;

function quoteText(q: Quote) {
  const lines = [q.customer_name ? `For: ${q.customer_name}` : '', q.service_type || 'Service', `${q.currency || 'USD'} ${Number(q.price || 0).toFixed(2)}`, q.notes || '', q.frequency ? `Frequency: ${q.frequency}` : ''].filter(Boolean);
  return lines.join('\n');
}

export default function QuotesPage() {
  const router = useRouter();
  const { locale } = useTranslation();
  const c = copy[locale];
  const workspace = useWorkspacePlan();
  const [quotes,setQuotes]=useState<Quote[]>([]);
  const [schemaReady,setSchemaReady]=useState(true);
  const [busy,setBusy]=useState(false);
  const [converting,setConverting]=useState('');
  const [message,setMessage]=useState('');
  const [form,setForm]=useState({ sourceRequest:'', customerName:'', customerEmail:'', customerPhone:'', serviceType:'', sizeValue:'', sizeUnit:'square-feet', primaryUnits:'', extraUnits:'', condition:'', frequency:'one-time', addOns:'', laborHours:'', price:'', notes:'' });

  async function load(){const r=await fetch('/api/quotes',{cache:'no-store'});const j=await r.json().catch(()=>({}));if(r.ok){setQuotes(j.quotes||[]);setSchemaReady(j.schemaReady!==false);}}
  useEffect(()=>{void load();},[]);
  const canSave=useMemo(()=>Boolean(form.serviceType.trim()&&Number(form.price)>=0&&form.price!==''),[form.serviceType,form.price]);
  const set=(key:keyof typeof form,value:string)=>setForm(current=>({...current,[key]:value}));

  async function save(){if(!canSave||busy)return;setBusy(true);setMessage('');const r=await fetch('/api/quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,addOns:form.addOns.split(',').map(v=>v.trim()).filter(Boolean)})});const j=await r.json().catch(()=>({}));setBusy(false);if(!r.ok){setMessage(j.code==='schema_update_required'?c.schema:j.error||c.error);return;}setForm(current=>({...current,sourceRequest:'',customerName:'',customerEmail:'',customerPhone:'',serviceType:'',sizeValue:'',primaryUnits:'',extraUnits:'',condition:'',frequency:'one-time',addOns:'',laborHours:'',price:'',notes:''}));await load();}
  async function share(q:Quote){const text=quoteText(q);if(navigator.share){await navigator.share({title:q.service_type||c.title,text}).catch(()=>undefined);}else{await navigator.clipboard.writeText(text);}}
  async function copyQuote(q:Quote){await navigator.clipboard.writeText(quoteText(q));}
  async function convert(q:Quote){if(q.job_id){router.push(`/jobs/${q.job_id}`);return;}setConverting(q.id);const r=await fetch(`/api/quotes/${q.id}/convert`,{method:'POST'});const j=await r.json().catch(()=>({}));setConverting('');if(!r.ok){setMessage(j.error||'Could not create job.');return;}router.push(`/jobs/${j.job.id}`);}

  return <AppShell plan={workspace.plan || 'free'} role={workspace.role || 'owner'}>
    <div className="quote-workspace">
      <header className="page-header quote-page-head"><div><p className="eyebrow">EverittOS</p><h1>{c.title}</h1><p className="page-subtitle">{c.sub}</p></div></header>
      {!schemaReady?<div className="card quote-alert">{c.schema}</div>:null}{message?<div className="card quote-alert">{message}</div>:null}
      <div className="quote-compose-grid">
        <section className="card quote-compose">
          <label>{c.request}<textarea className="input" rows={5} value={form.sourceRequest} placeholder={c.requestHint} onChange={e=>set('sourceRequest',e.target.value)}/></label>
          <div className="form-grid"><label>{c.customer}<input className="input" value={form.customerName} onChange={e=>set('customerName',e.target.value)}/></label><label>{c.email}<input className="input" type="email" value={form.customerEmail} onChange={e=>set('customerEmail',e.target.value)}/></label><label>{c.phone}<input className="input" value={form.customerPhone} onChange={e=>set('customerPhone',e.target.value)}/></label><label>{c.service}<input className="input" value={form.serviceType} onChange={e=>set('serviceType',e.target.value)}/></label><label>{c.size}<input className="input" type="number" min="0" value={form.sizeValue} onChange={e=>set('sizeValue',e.target.value)}/></label><label>{c.unit}<input className="input" value={form.sizeUnit} onChange={e=>set('sizeUnit',e.target.value)}/></label><label>{c.primary}<input className="input" type="number" min="0" value={form.primaryUnits} onChange={e=>set('primaryUnits',e.target.value)}/></label><label>{c.extra}<input className="input" type="number" min="0" value={form.extraUnits} onChange={e=>set('extraUnits',e.target.value)}/></label><label>{c.condition}<input className="input" value={form.condition} onChange={e=>set('condition',e.target.value)}/></label><label>{c.frequency}<input className="input" value={form.frequency} onChange={e=>set('frequency',e.target.value)}/></label><label>{c.addons}<input className="input" value={form.addOns} placeholder="laundry, fridge" onChange={e=>set('addOns',e.target.value)}/></label><label>{c.hours}<input className="input" type="number" min="0" step="0.25" value={form.laborHours} onChange={e=>set('laborHours',e.target.value)}/></label></div>
          <label>{c.notes}<textarea className="input" rows={3} value={form.notes} onChange={e=>set('notes',e.target.value)}/></label>
          <div className="quote-price-row"><label>{c.price}<input className="input quote-price-input" type="number" min="0" step="0.01" value={form.price} onChange={e=>set('price',e.target.value)}/></label><button type="button" className="btn btn-primary" disabled={!canSave||busy} onClick={()=>void save()}>{busy?c.saving:c.save}</button></div>
        </section>
        <aside className="quote-letter card"><p className="eyebrow">{c.draft}</p><h2>{form.serviceType||c.service}</h2><div className="quote-letter-price">{form.price?`$${Number(form.price).toFixed(2)}`:'$0.00'}</div><p>{form.customerName||c.customer}</p><p className="muted">{form.notes||form.sourceRequest||c.requestHint}</p></aside>
      </div>
      <section className="quote-saved"><div className="quote-section-head"><h2>{c.saved}</h2></div>{quotes.length===0?<div className="card"><p className="muted">{c.empty}</p></div>:<div className="quote-list">{quotes.map(q=><article className="card quote-row" key={q.id}><div><p className="eyebrow">{q.status}</p><h3>{q.service_type||c.service}</h3><p>{q.customer_name||c.customer}</p><p className="muted">{q.condition||''}{q.frequency?` · ${q.frequency}`:''}</p></div><div className="quote-row-price">{new Intl.NumberFormat(undefined,{style:'currency',currency:q.currency||'USD'}).format(Number(q.price||0))}</div><div className="quote-actions"><button className="btn" onClick={()=>void copyQuote(q)}>{c.copyAction}</button><button className="btn" onClick={()=>void share(q)}>{c.share}</button><button className="btn" onClick={()=>window.print()}>{c.print}</button><button className="btn btn-primary" disabled={converting===q.id} onClick={()=>void convert(q)}>{q.job_id?c.openJob:converting===q.id?c.converting:c.job}</button></div></article>)}</div>}</section>
    </div>
  </AppShell>;
}
