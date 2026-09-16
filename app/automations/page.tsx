'use client';
import Link from 'next/link';
import { useCallback,useEffect,useState } from 'react';
import { useRouter } from 'next/navigation';
import { OsModulePage } from '@/components/os-module-page';
import { useTranslation } from '@/components/locale-provider';
import { getOpsCopy } from '@/lib/i18n/ops-pages-copy';
import { canAccessFeature } from '@/lib/plan-access';
import { fetchOrganizationContext } from '@/lib/organization';
import { isManagerRole,normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
type Automation={id:string;name:string;trigger_type:string;action_type:string;active:boolean};
export default function AutomationsPage(){const router=useRouter();const {locale}=useTranslation();const c=getOpsCopy('automations',locale);const [rows,setRows]=useState<Automation[]>([]);const [name,setName]=useState('');const [role,setRole]=useState(normalizeRole('employee'));const [loading,setLoading]=useState(true);
const load=useCallback(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user){router.push('/login');return;}const {data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle();const org=await fetchOrganizationContext(user.id);setRole(normalizeRole(org?.role||profile?.role));if(!org){setLoading(false);return;}const {data}=await supabase.from('automations').select('id, name, trigger_type, action_type, active').eq('organization_id',org.organizationId).order('created_at',{ascending:false});setRows(data||[]);setLoading(false);},[router]);useEffect(()=>{void load();},[load]);
async function createAutomation(){if(!name.trim()||!isManagerRole(role))return;const {data:{user}}=await supabase.auth.getUser();if(!user)return;const org=await fetchOrganizationContext(user.id);if(!org)return;await supabase.from('automations').insert({organization_id:org.organizationId,name:name.trim(),trigger_type:'lead_created',action_type:'create_task',created_by:user.id});setName('');void load();}
return <OsModulePage title={c.title} description={c.subtitle} requiredPlan="business" requiredFeature={c.feature} featureCheck={plan=>canAccessFeature(plan,'aiAccess')} actions={[{label:c.jobWorkflows,href:'/workflows'}]}>{isManagerRole(role)?<div className="card form" style={{marginBottom:18}}><input className="input" placeholder={c.name} value={name} onChange={e=>setName(e.target.value)}/><button type="button" className="btn btn-primary" onClick={()=>void createAutomation()}>{c.create}</button></div>:null}<div className="card">{loading?<p>{c.loading}</p>:null}{!loading&&rows.length===0?<p className="muted">{c.empty}</p>:null}{rows.map(row=><div key={row.id} className="dashboard-today-row"><span>{row.name}</span><span className="muted">{row.trigger_type} → {row.action_type}</span></div>)}</div><p className="muted" style={{marginTop:16}}>{c.advancedPrefix} <Link href="/workflows">{c.workflows}</Link> {c.advancedSuffix}</p></OsModulePage>;
}
