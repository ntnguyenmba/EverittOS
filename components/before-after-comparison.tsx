'use client';
import Image from 'next/image';
import { useLocale } from '@/components/locale-provider';
import { getCommonUiCopy } from '@/lib/i18n/common-ui-copy';
import type { JobPhotoView } from '@/lib/job-photos-types';
import { resolvePhotoType } from '@/lib/job-photos-client';
import { photoTagLabel } from '@/lib/job-photo-tags';
function formatPhotoWhen(value:string|null,locale:string){if(!value)return '';return new Date(value).toLocaleString(locale,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}
type BeforeAfterComparisonProps={before:JobPhotoView|null;after:JobPhotoView|null};
function ComparisonImage({src,alt}:{src:string;alt:string}){return <Image src={src} alt={alt} width={1200} height={900} unoptimized style={{width:'100%',height:'auto'}}/>;}
export function BeforeAfterComparison({before,after}:BeforeAfterComparisonProps){const {locale}=useLocale();const c=getCommonUiCopy(locale);if(!before&&!after)return null;return <div className="before-after-comparison" aria-label={c.beforeAfterComparison}><div className="before-after-panel"><p className="before-after-label">{c.before}</p>{before?<><ComparisonImage src={before.url} alt={c.beforePhoto}/><p className="before-after-meta">{formatPhotoWhen(before.created_at,locale)}{before.uploader_display_name?` · ${before.uploader_display_name}`:''}</p></>:<div className="before-after-empty">{c.noBeforePhoto}</div>}</div><div className="before-after-panel"><p className="before-after-label">{c.after}</p>{after?<><ComparisonImage src={after.url} alt={c.afterPhoto}/><p className="before-after-meta">{formatPhotoWhen(after.created_at,locale)}{after.uploader_display_name?` · ${after.uploader_display_name}`:''}</p></>:<div className="before-after-empty">{c.noAfterPhoto}</div>}</div></div>;}
type PhotoComparisonGridProps={photos:JobPhotoView[]};
export function PhotoComparisonSection({photos}:PhotoComparisonGridProps){const {locale}=useLocale();const c=getCommonUiCopy(locale);const beforePhotos=photos.filter(p=>resolvePhotoType(p)==='before');const afterPhotos=photos.filter(p=>resolvePhotoType(p)==='after');if(!beforePhotos.length&&!afterPhotos.length)return null;return <section className="photo-comparison-section"><h4>{c.beforeAfter}</h4><BeforeAfterComparison before={beforePhotos[0]??null} after={afterPhotos[0]??null}/>{beforePhotos.length>1||afterPhotos.length>1?<p className="muted" style={{marginTop:8}}>{c.recentComparisonHint}</p>:null}</section>;}
export function photoTagBadge(label:string){return photoTagLabel(label);}
