'use client';

import { useEffect, useState } from 'react';
import { isNativePlatform } from '@/lib/platform/detect';
import { nativePinCooldownRemainingMs, nativePinIsEnabled, verifyNativePin } from '@/lib/native-pin';
import { deviceIdleLockMs, SYSTEM_HANDOFF_GRACE_MS } from '@/lib/session-policy';

const LAST_ACTIVE_KEY = 'everittos_device_last_active_v1';
const IGNORE_IDLE_UNTIL_KEY = 'everittos_ignore_idle_until_v1';
const copy={
 en:{title:'Welcome back',body:'Enter your 4-digit PIN to open EverittOS.',placeholder:'PIN',unlock:'Open EverittOS',wrong:'That PIN is not correct.',cooldown:'Too many attempts. Try again in 5 minutes or use account sign-in.',account:'Use account sign-in'},
 es:{title:'Bienvenido de nuevo',body:'Ingrese su PIN de 4 dígitos para abrir EverittOS.',placeholder:'PIN',unlock:'Abrir EverittOS',wrong:'Ese PIN no es correcto.',cooldown:'Demasiados intentos. Intente de nuevo en 5 minutos o use el inicio de sesión.',account:'Usar inicio de sesión'},
 vi:{title:'Chào mừng trở lại',body:'Nhập mã PIN 4 số để mở EverittOS.',placeholder:'PIN',unlock:'Mở EverittOS',wrong:'Mã PIN không đúng.',cooldown:'Quá nhiều lần thử. Thử lại sau 5 phút hoặc đăng nhập bằng tài khoản.',account:'Đăng nhập bằng tài khoản'}
} as const;
type PinLocale=keyof typeof copy;
function currentLocale():PinLocale{const value=`${document.documentElement.lang||''} ${document.documentElement.dataset.locale||''} ${document.body?.dataset.locale||''}`.toLowerCase();return value.includes('es')?'es':value.includes('vi')?'vi':'en';}
function forceAccountSignIn(){return window.location.pathname==='/login'&&new URLSearchParams(window.location.search).get('force')==='1';}
function nowNumber(key:string){return Number(window.localStorage.getItem(key)||'0')||0;}
function markActive(){window.localStorage.setItem(LAST_ACTIVE_KEY,String(Date.now()));}
export function grantNativeSystemHandoffGrace(){window.localStorage.setItem(IGNORE_IDLE_UNTIL_KEY,String(Date.now()+SYSTEM_HANDOFF_GRACE_MS));}

export function NativePinLock(){
 const[native,setNative]=useState(false);const[locked,setLocked]=useState(false);const[pin,setPin]=useState('');const[error,setError]=useState('');const[locale,setLocale]=useState<PinLocale>('en');
 useEffect(()=>{const isNative=isNativePlatform();setNative(isNative);if(!isNative)return;setLocale(currentLocale());
  const enabled=nativePinIsEnabled();const hadActivity=nowNumber(LAST_ACTIVE_KEY)>0;
  const shouldLock=(coldStart=false)=>{if(forceAccountSignIn()||!nativePinIsEnabled())return false;const now=Date.now();if(now<nowNumber(IGNORE_IDLE_UNTIL_KEY))return false;if(coldStart&&!hadActivity)return true;return now-nowNumber(LAST_ACTIVE_KEY)>=deviceIdleLockMs(window.location.pathname);};
  const lock=()=>{setPin('');setError('');setLocked(true);};const check=()=>{if(shouldLock())lock();};
  const activity=()=>{if(!locked&&document.visibilityState==='visible')markActive();};const visibility=()=>{if(document.visibilityState==='visible')check();};const forceLock=()=>{if(nativePinIsEnabled())lock();};
  if(enabled&&shouldLock(true))lock();else if(!hadActivity)markActive();
  const timer=window.setInterval(check,15000);for(const name of ['pointerdown','keydown','scroll'] as const)window.addEventListener(name,activity,{passive:true});window.addEventListener('everittos:photo-saved',activity);window.addEventListener('everittos:native-lock',forceLock);document.addEventListener('visibilitychange',visibility);
  return()=>{window.clearInterval(timer);for(const name of ['pointerdown','keydown','scroll'] as const)window.removeEventListener(name,activity);window.removeEventListener('everittos:photo-saved',activity);window.removeEventListener('everittos:native-lock',forceLock);document.removeEventListener('visibilitychange',visibility);};
 },[locked]);
 if(!native||!locked)return null;const c=copy[locale];
 async function unlock(event:React.FormEvent){event.preventDefault();if(nativePinCooldownRemainingMs()>0){setError(c.cooldown);setPin('');return;}const ok=await verifyNativePin(pin);if(!ok){setError(nativePinCooldownRemainingMs()>0?c.cooldown:c.wrong);setPin('');return;}markActive();setError('');setLocked(false);}
 return <div className="native-pin-lock" role="dialog" aria-modal="true" aria-labelledby="native-pin-title"><form className="native-pin-card" onSubmit={unlock}><div className="native-pin-mark">E</div><h1 id="native-pin-title">{c.title}</h1><p>{c.body}</p><input aria-label={c.placeholder} inputMode="numeric" autoComplete="off" type="password" maxLength={4} pattern="[0-9]*" value={pin} onChange={event=>setPin(event.target.value.replace(/\D/g,'').slice(0,4))} autoFocus />{error?<p className="native-pin-error" role="alert">{error}</p>:null}<button className="btn btn-primary" type="submit" disabled={pin.length!==4}>{c.unlock}</button><button className="native-pin-account" type="button" onClick={()=>{setLocked(false);window.location.assign('/login?force=1');}}>{c.account}</button></form></div>;
}
