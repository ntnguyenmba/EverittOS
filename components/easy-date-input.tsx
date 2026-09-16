'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useLocale } from '@/components/locale-provider';
import { getCommonUiCopy } from '@/lib/i18n/common-ui-copy';

type EasyDateInputProps = { value:string; onChange:(value:string)=>void; label?:string; disabled?:boolean; min?:string; max?:string; required?:boolean; showQuickDates?:boolean };
function isoToDisplay(value:string){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);return m?`${m[2]}/${m[3]}/${m[1]}`:'';}
function displayToIso(value:string){const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim().replace(/[.\-]/g,'/'));if(!m)return null;const month=Number(m[1]),day=Number(m[2]),year=Number(m[3]),date=new Date(year,month-1,day);if(date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day)return null;return `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;}
function offsetDate(days:number){const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()+days);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function EasyDateInput({value,onChange,label,disabled=false,min,max,required=false,showQuickDates=true}:EasyDateInputProps){
 const {locale}=useLocale();const c=getCommonUiCopy(locale);const id=useId();const nativeRef=useRef<HTMLInputElement>(null);const [display,setDisplay]=useState(()=>isoToDisplay(value));const [error,setError]=useState('');
 useEffect(()=>{setDisplay(isoToDisplay(value));setError('');},[value]);
 function commitDisplay(){if(!display.trim()){if(!required)onChange('');setError(required?c.enterDate:'');return;}const iso=displayToIso(display);if(!iso){setError(c.invalidDate);return;}if(min&&iso<min){setError(c.dateOnOrAfter(isoToDisplay(min)));return;}if(max&&iso>max){setError(c.dateOnOrBefore(isoToDisplay(max)));return;}setError('');setDisplay(isoToDisplay(iso));onChange(iso);}
 function chooseDate(iso:string){setError('');setDisplay(isoToDisplay(iso));onChange(iso);}
 function openCalendar(){if(disabled)return;const input=nativeRef.current;if(!input)return;if(typeof input.showPicker==='function')input.showPicker();else input.click();}
 return <div className="easy-date-field">{label?<label htmlFor={id}>{label}</label>:null}<div className="easy-date-row"><input id={id} className="input" type="text" inputMode="numeric" autoComplete="off" placeholder="MM/DD/YYYY" value={display} disabled={disabled} required={required} aria-invalid={Boolean(error)} onChange={e=>{setDisplay(e.target.value);setError('');}} onBlur={commitDisplay} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commitDisplay();}}}/><button type="button" className="btn" disabled={disabled} onClick={openCalendar} aria-label={c.openCalendar}>{c.calendar}</button><input ref={nativeRef} type="date" value={value} min={min} max={max} disabled={disabled} tabIndex={-1} aria-hidden="true" style={{position:'absolute',width:1,height:1,opacity:0,pointerEvents:'none'}} onChange={e=>chooseDate(e.target.value)}/></div>{showQuickDates&&!disabled?<div className="inline-actions" style={{marginTop:8}}><button type="button" className="btn" onClick={()=>chooseDate(offsetDate(0))}>{c.today}</button><button type="button" className="btn" onClick={()=>chooseDate(offsetDate(1))}>{c.tomorrow}</button>{value?<button type="button" className="btn" onClick={()=>chooseDate('')}>{c.clear}</button>:null}</div>:null}{error?<p className="auth-message auth-message-error" style={{marginTop:6}}>{error}</p>:null}</div>;
}
