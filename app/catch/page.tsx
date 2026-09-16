'use client';
import Link from 'next/link';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {AppShell} from '@/components/app-shell';
import {useAppFeedback} from '@/components/feedback/use-app-feedback';
import {useTranslation} from '@/components/locale-provider';
import {PlanLockedMessage} from '@/components/plan-locked-message';
import {billingUpgradeHref} from '@/lib/nav-access';
import {buildCatchSnapshot,type CatchRecord} from '@/lib/catch-engine';
import {customerDisplayName,type CustomerRecord} from '@/lib/customer-record';
import {getCatchCopy} from '@/lib/i18n/catch-copy';
import {normalizeLeadStage} from '@/lib/lead-pipeline';
import {canAccessFeature} from '@/lib/plan-access';
import {normalizePlan,type EverittosPlan} from '@/lib/everittos-plans';
import {fetchOrganizationContext} from '@/lib/organization';
import {isManagerRole,normalizeRole,type UserRole} from '@/lib/roles';
import {ensureWorkspaceForSave} from '@/lib/workspace-client';
import {supabase} from '@/lib/supabase';
import styles from './catch.module.css';

type JobRow={id:string;title?:string|null;customer_name?:string|null;customer_id?:string|null;status?:string|null;updated_at?:string|null;created_at?:string|null};
type BookingRow={id:string;status?:string|null;updated_at?:string|null;created_at?:string|null;customer_name?:string|null;name?:string|null;email?:string|null;phone?:string|null};
type CatchState='hidden'|'done';
type SavedStates=Record<string,CatchState>;

function storageKey(userId:string){return`everittos_catch_${userId}`;}
function readStates(userId:string):SavedStates{try{return JSON.parse(localStorage.getItem(storageKey(userId))||'{}') as SavedStates}catch{return{}}}
function writeStates(userId:string,states:SavedStates){localStorage.setItem(storageKey(userId),JSON.stringify(states));}

export default function CatchPage(){
  const router=useRouter(),feedback=useAppFeedback(),{locale}=useTranslation(),copy=getCatchCopy(locale);
  const[plan,setPlan]=useState<EverittosPlan>('free'),[role,setRole]=useState<UserRole>('owner'),[loading,setLoading]=useState(true),[records,setRecords]=useState<CatchRecord[]>([]),[copiedId,setCopiedId]=useState<string|null>(null),[userId,setUserId]=useState(''),[states,setStates]=useState<SavedStates>({}),[showHidden,setShowHidden]=useState(false);
  const allowed=canAccessFeature(plan,'catchGrowth');
  const snapshot=useMemo(()=>buildCatchSnapshot(records,copy.actions),[records,copy.actions]);
  const visibleActions=snapshot.actions.filter(action=>!states[action.id]);
  const hiddenActions=snapshot.actions.filter(action=>states[action.id]==='hidden');

  const load=useCallback(async()=>{setLoading(true);const{data:{user}}=await supabase.auth.getUser();if(!user){router.push('/login');return}setUserId(user.id);setStates(readStates(user.id));const{data:profile}=await supabase.from('profiles').select('plan, role').eq('id',user.id).maybeSingle();const org=await fetchOrganizationContext(user.id);setPlan(normalizePlan(profile?.plan));setRole(normalizeRole(org?.role||profile?.role));const workspace=await ensureWorkspaceForSave(user.id);const organizationId=workspace.ok?workspace.workspace?.organizationId:org?.organizationId;let customerQuery=supabase.from('customers').select('id, company_name, contact_name, email, phone, record_type, pipeline_stage, updated_at, created_at').order('updated_at',{ascending:false}).limit(200),jobQuery=supabase.from('jobs').select('id, title, customer_name, customer_id, status, updated_at, created_at').order('updated_at',{ascending:false}).limit(200),bookingQuery=supabase.from('bookings').select('id, status, updated_at, created_at, customer_name, name, email, phone').order('updated_at',{ascending:false}).limit(100);if(organizationId){customerQuery=customerQuery.eq('organization_id',organizationId);jobQuery=jobQuery.eq('organization_id',organizationId);bookingQuery=bookingQuery.eq('organization_id',organizationId)}else{customerQuery=customerQuery.eq('user_id',user.id);jobQuery=jobQuery.eq('user_id',user.id)}const[customersRes,jobsRes,bookingsRes]=await Promise.all([customerQuery,jobQuery,bookingQuery]);const customers=(customersRes.data||[])as CustomerRecord[];const customerNames=new Map(customers.map(row=>[row.id,customerDisplayName(row)]));const next:CatchRecord[]=[];for(const row of customers){const leadLike=row.record_type==='lead';next.push({id:row.id,kind:leadLike?'lead':'customer',name:customerDisplayName(row),stage:leadLike?'inquiry':'customer',status:leadLike?normalizeLeadStage(row.pipeline_stage):'customer',email:row.email,phone:row.phone,updatedAt:row.updated_at,createdAt:row.created_at,href:leadLike?`/leads/${row.id}`:`/customers/${row.id}`})}for(const row of(jobsRes.data||[])as JobRow[]){const contactName=(row.customer_id?customerNames.get(row.customer_id):null)||row.customer_name||null;next.push({id:row.id,kind:'job',name:row.title||copy.untitledJob,jobTitle:row.title||copy.job,contactName,stage:'job',status:row.status,updatedAt:row.updated_at,createdAt:row.created_at,href:`/jobs/${row.id}`})}if(!bookingsRes.error)for(const row of(bookingsRes.data||[])as BookingRow[])next.push({id:row.id,kind:'booking',name:row.customer_name||row.name||copy.bookingRequest,stage:'booking',status:row.status||'pending',email:row.email,phone:row.phone,updatedAt:row.updated_at,createdAt:row.created_at,href:'/bookings'});setRecords(next);setLoading(false)},[router,copy.untitledJob,copy.job,copy.bookingRequest]);
  useEffect(()=>{void load()},[load]);

  function setActionState(id:string,state:CatchState|undefined){if(!userId)return;setStates(current=>{const next={...current};if(state)next[id]=state;else delete next[id];try{writeStates(userId,next)}catch{feedback.error(copy.saveError)}return next});}
  async function copyMessage(id:string,message:string){try{await navigator.clipboard.writeText(message);setCopiedId(id)}catch{feedback.error(copy.copyError)}}

  return <AppShell plan={plan} role={role}><div className={styles.page}>
    <header className={styles.hero}><div><p className={styles.kicker}>{copy.product} · {copy.plan}</p><h1>{copy.title}</h1></div>{isManagerRole(role)?<div className={styles.heroActions}><Link className="btn btn-primary" href="/leads/new">{copy.addInquiry}</Link><Link className="btn" href="/bookings">{copy.bookings}</Link></div>:null}</header>
    {!allowed?<div className={styles.lock}><PlanLockedMessage feature={copy.product} requiredPlan="Enterprise"/><Link className="btn btn-primary" href={billingUpgradeHref('enterprise','Catch')}>{copy.upgrade}</Link></div>:<section className={styles.actionsSection}>
      <div className={styles.actionList}>{loading?<p className={styles.empty}>{copy.checking}</p>:null}{!loading&&visibleActions.length===0?<p className={styles.empty}>{copy.empty}</p>:null}{visibleActions.map(action=><article key={action.id} className={styles.action}><div className={styles.actionCopy}><span className={styles.actionReason}>{action.reason}</span><h2>{action.title}</h2><p className={styles.label}>{copy.reply}</p><blockquote>{action.message}</blockquote></div><div className={styles.actionButtons}><Link className="btn" href={action.href}>{copy.open}</Link><button type="button" className="btn" onClick={()=>void copyMessage(action.id,action.message)}>{copiedId===action.id?copy.copied:copy.copy}</button><button type="button" className="btn btn-primary" onClick={()=>setActionState(action.id,'done')}>{copy.done}</button><button type="button" className={styles.textButton} onClick={()=>setActionState(action.id,'hidden')}>{copy.hide}</button></div></article>)}</div>
      {hiddenActions.length>0?<div className={styles.hiddenSection}><button type="button" className={styles.hiddenToggle} onClick={()=>setShowHidden(value=>!value)} aria-expanded={showHidden}>{copy.hidden} ({hiddenActions.length})</button>{showHidden?<div className={styles.hiddenList}>{hiddenActions.map(action=><div key={action.id} className={styles.hiddenItem}><span>{action.title}</span><button type="button" className={styles.textButton} onClick={()=>setActionState(action.id,undefined)}>{copy.showAgain}</button></div>)}</div>:null}</div>:null}
    </section>}
  </div></AppShell>;
}
