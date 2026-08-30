'use client';

import { base64ToFile, deleteFieldPhoto, getFieldRecord, listFieldOutbox, putFieldRecord, queueFieldChange, readFieldPhoto, removeFieldOutbox, saveFieldPhoto } from '@/lib/native-field-store';
import type { ContractorSafeJobView } from '@/lib/contractor-job-access';

export type CachedContractorDashboard = { savedAt:string; workerName:string; jobs:unknown[]; totals:unknown };
export type PendingContractorPhoto = { id:string; jobId:string; tag:'before'|'after'; path:string; name:string; mimeType:string; previewUrl:string; status:'local'|'uploading'|'synced' };
function scopedKey(userId:string,key:string){return `${userId}:${key}`;}
function pendingKey(userId:string,jobId:string){return scopedKey(userId,`${jobId}:pending-photos`);}
export async function saveContractorDashboard(userId:string,payload:Omit<CachedContractorDashboard,'savedAt'>){if(!userId)return;await putFieldRecord('worker-dashboard',scopedKey(userId,'dashboard'),{...payload,savedAt:new Date().toISOString()});}
export async function readContractorDashboard(userId:string):Promise<CachedContractorDashboard|null>{if(!userId)return null;return getFieldRecord<CachedContractorDashboard>('worker-dashboard',scopedKey(userId,'dashboard'));}
export async function saveContractorJob(userId:string,job:ContractorSafeJobView){if(!userId||!job?.id)return;await putFieldRecord('job-detail',scopedKey(userId,job.id),{...job,cachedAt:new Date().toISOString()});}
export async function readContractorJob(userId:string,jobId:string):Promise<ContractorSafeJobView|null>{if(!userId||!jobId)return null;return getFieldRecord<ContractorSafeJobView>('job-detail',scopedKey(userId,jobId));}
export async function queueContractorStatus(userId:string,jobId:string,status:'active'|'completed'){await queueFieldChange(status==='completed'?'job.finish':'job.start',scopedKey(userId,jobId),{userId,jobId,status});}

export async function readPendingContractorPhotos(userId:string,jobId:string):Promise<PendingContractorPhoto[]>{
  const rows=await getFieldRecord<Array<Omit<PendingContractorPhoto,'previewUrl'>> | null>('job-detail',pendingKey(userId,jobId));
  if(!rows?.length)return[];
  const photos:PendingContractorPhoto[]=[];
  for(const row of rows){const base64=await readFieldPhoto(row.path);if(!base64)continue;photos.push({...row,previewUrl:`data:${row.mimeType||'image/jpeg'};base64,${base64}`});}
  return photos;
}
async function savePendingPhotoRows(userId:string,jobId:string,photos:PendingContractorPhoto[]){await putFieldRecord('job-detail',pendingKey(userId,jobId),photos.map(({previewUrl,...rest})=>rest));}
async function removePendingPhoto(userId:string,jobId:string,id:string){const current=await readPendingContractorPhotos(userId,jobId);await savePendingPhotoRows(userId,jobId,current.filter(photo=>photo.id!==id));}

export async function queueContractorPhoto(userId:string,jobId:string,tag:'before'|'after',file:File):Promise<PendingContractorPhoto>{
  const id=crypto.randomUUID();const stored=await saveFieldPhoto(scopedKey(userId,`${jobId}:${id}`),file);
  const photo={id,jobId,tag,path:stored.path,name:file.name||`${tag}-${id}.jpg`,mimeType:file.type||'image/jpeg',previewUrl:stored.previewUrl,status:'local' as const};
  const current=await readPendingContractorPhotos(userId,jobId);await savePendingPhotoRows(userId,jobId,[...current,photo]);
  await queueFieldChange('photo.upload',scopedKey(userId,jobId),{userId,jobId,tag,path:stored.path,name:photo.name,mimeType:photo.mimeType,id});return photo;
}

function permanentFailure(status:number){return status>=400&&status<500&&status!==408&&status!==429;}
export async function drainContractorOutbox():Promise<number>{const items=await listFieldOutbox();let drained=0;for(const item of items){try{
  if(item.type==='job.start'||item.type==='job.finish'){const payload=JSON.parse(item.json) as {jobId?:string;status?:'active'|'completed'};if(!payload.jobId||!payload.status){await removeFieldOutbox(item.id);continue;}const response=await fetch(`/api/portal/contractor/jobs/${encodeURIComponent(payload.jobId)}/status`,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':`field-${item.id}`},body:JSON.stringify({status:payload.status})});if(!response.ok){if(permanentFailure(response.status))await removeFieldOutbox(item.id);continue;}await removeFieldOutbox(item.id);drained+=1;continue;}
  if(item.type==='photo.upload'){const payload=JSON.parse(item.json) as {userId?:string;jobId?:string;tag?:'before'|'after';path?:string;name?:string;mimeType?:string;id?:string};if(!payload.jobId||!payload.tag||!payload.path){await removeFieldOutbox(item.id);continue;}const base64=await readFieldPhoto(payload.path);if(!base64){await removeFieldOutbox(item.id);continue;}const body=new FormData();body.append('file',base64ToFile(base64,payload.name||'job-photo.jpg',payload.mimeType||'image/jpeg'));body.append('tag',payload.tag);body.append('client_upload_id',payload.id||String(item.id));const response=await fetch(`/api/portal/contractor/jobs/${encodeURIComponent(payload.jobId)}/photos`,{method:'POST',headers:{'Idempotency-Key':`field-photo-${payload.id||item.id}`},body});if(!response.ok){if(permanentFailure(response.status)){await removeFieldOutbox(item.id);await deleteFieldPhoto(payload.path);if(payload.userId&&payload.id)await removePendingPhoto(payload.userId,payload.jobId,payload.id);}continue;}await removeFieldOutbox(item.id);await deleteFieldPhoto(payload.path);if(payload.userId&&payload.id)await removePendingPhoto(payload.userId,payload.jobId,payload.id);drained+=1;continue;}
}catch{break;}}return drained;}
