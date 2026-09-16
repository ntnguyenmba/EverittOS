import type { CatchActionCopy } from '@/lib/i18n/catch-copy';

export const CATCH_FEATURE = 'catchGrowth' as const;
export const CATCH_REQUIRED_PLAN = 'enterprise' as const;
export type CatchStageId = 'inquiry' | 'booking' | 'customer' | 'job' | 'followup' | 'quote' | 'invoice';
export type CatchRecordKind = 'lead' | 'booking' | 'customer' | 'job' | 'quote' | 'invoice';
export type CatchRecord = { id:string; kind:CatchRecordKind; name:string; stage:CatchStageId; status?:string|null; email?:string|null; phone?:string|null; updatedAt?:string|null; createdAt?:string|null; href:string; contactName?:string|null; jobTitle?:string|null; customerId?:string|null; jobId?:string|null; revenueAmount?:number|null; customerRevenue?:number|null; dueAt?:string|null; reviewAlreadyRequested?:boolean };
export type CatchAction = { id:string; title:string; reason:string; valueLabel?:string; stage:CatchStageId; href:string; message:string; priority:number; email?:string|null; customerId?:string|null; jobId?:string|null; revenueAmount?:number|null; highPriority:boolean; personKey:string };
export type CatchSnapshot = { actions:CatchAction[] };
const STALE_INQUIRY_HOURS=24, STALE_REVIEW_HOURS=72, STALE_QUOTE_HOURS=48, STALE_CUSTOMER_HOURS=24*60, HIGH_VALUE=500;
export function hoursSince(iso?:string|null,now=Date.now()):number{if(!iso)return Number.POSITIVE_INFINITY;const parsed=new Date(iso).getTime();if(Number.isNaN(parsed))return Number.POSITIVE_INFINITY;return Math.max(0,(now-parsed)/36e5);}
export function isOpenLeadStatus(status?:string|null):boolean{return['open','contacted','qualified','proposal_sent','negotiation','reopened','lead'].includes((status||'open').toLowerCase());}
function keyFor(record:CatchRecord){return record.customerId||record.email?.trim().toLowerCase()||record.phone?.replace(/\D/g,'')||record.contactName?.trim().toLowerCase()||record.name.trim().toLowerCase();}
function better(a:CatchAction,b:CatchAction){if(a.highPriority!==b.highPriority)return a.highPriority;if(a.priority!==b.priority)return a.priority<b.priority;return (a.revenueAmount||0)>(b.revenueAmount||0);}
function isDue(dueAt:string|null|undefined,now:number){if(!dueAt)return true;const due=new Date(dueAt).getTime();return Number.isNaN(due)||due<=now;}
export function buildCatchSnapshot(records:CatchRecord[],copy:CatchActionCopy,now=Date.now()):CatchSnapshot{
 const candidates:CatchAction[]=[];
 for(const record of records){
  const age=hoursSince(record.updatedAt||record.createdAt,now),personKey=keyFor(record),revenue=Number(record.revenueAmount||record.customerRevenue||0)||0;
  const base={email:record.email,customerId:record.customerId||((record.kind==='lead'||record.kind==='customer')?record.id:null),jobId:record.jobId,revenueAmount:revenue,personKey};
  if(record.kind==='lead'&&isOpenLeadStatus(record.status)&&age>=STALE_INQUIRY_HOURS)candidates.push({...base,id:`reply-${record.id}`,title:copy.leadTitle(record.name),reason:age>=72?copy.leadOldReason:copy.leadNewReason,stage:'inquiry',href:record.href,message:copy.inquiryDraft(record.name),priority:age>=72?1:2,highPriority:age>=72});
  if(record.kind==='booking'&&/pending|requested|new/i.test(record.status||'pending'))candidates.push({...base,id:`confirm-${record.id}`,title:copy.bookingTitle(record.name),reason:copy.bookingReason,stage:'booking',href:record.href,message:copy.bookingDraft(record.name),priority:2,highPriority:false});
  if(record.kind==='job'&&/scheduled|assigned|in_progress|in-progress/i.test(record.status||''))candidates.push({...base,jobId:record.id,id:`advance-${record.id}`,title:copy.jobTitle(record.name),reason:copy.jobReason,valueLabel:copy.jobValueLabel,stage:'job',href:record.href,message:copy.jobDraft(record.contactName||record.name),priority:3,highPriority:revenue>=HIGH_VALUE});
  if(record.kind==='job'&&record.contactName&&/complete|done|finished/i.test(record.status||'')&&age>=STALE_REVIEW_HOURS&&!record.reviewAlreadyRequested){const highValue=revenue>=HIGH_VALUE;candidates.push({...base,jobId:record.id,id:`review-${record.id}`,title:copy.reviewTitle(record.contactName),reason:copy.reviewReason,valueLabel:copy.jobValueLabel,stage:'followup',href:record.href,message:copy.reviewDraft(record.contactName),priority:highValue?1:2,highPriority:highValue});}
  if(record.kind==='customer'&&age>=STALE_CUSTOMER_HOURS)candidates.push({...base,id:`repeat-${record.id}`,title:copy.repeatTitle(record.name),reason:copy.repeatReason,stage:'customer',href:record.href,message:copy.repeatDraft(record.name),priority:revenue>=HIGH_VALUE?2:4,highPriority:revenue>=HIGH_VALUE});
  if(record.kind==='quote'&&record.status?.toLowerCase()==='shared'&&age>=STALE_QUOTE_HOURS)candidates.push({...base,id:`quote-${record.id}`,title:copy.quoteTitle(record.name),reason:copy.quoteReason,valueLabel:copy.quoteValueLabel,stage:'quote',href:record.href,message:copy.quoteDraft(record.name),priority:revenue>=HIGH_VALUE?1:2,highPriority:revenue>=HIGH_VALUE});
  if(record.kind==='invoice'&&revenue>0&&!/paid|void|cancelled|canceled/i.test(record.status||'')&&isDue(record.dueAt,now))candidates.push({...base,id:`invoice-${record.id}`,title:copy.invoiceTitle(record.name),reason:copy.invoiceReason,valueLabel:copy.balanceDueLabel,stage:'invoice',href:record.href,message:copy.invoiceDraft(record.name),priority:1,highPriority:revenue>=HIGH_VALUE});
 }
 const byPerson=new Map<string,CatchAction>();for(const action of candidates){const current=byPerson.get(action.personKey);if(!current||better(action,current))byPerson.set(action.personKey,action);}
 const actions=[...byPerson.values()];actions.sort((a,b)=>Number(b.highPriority)-Number(a.highPriority)||a.priority-b.priority||(b.revenueAmount||0)-(a.revenueAmount||0)||a.title.localeCompare(b.title));return{actions:actions.slice(0,30)};
}
