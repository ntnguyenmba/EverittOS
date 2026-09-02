'use client';

import { Capacitor, registerPlugin } from '@capacitor/core';

export type FieldRecordKind = 'worker-dashboard' | 'job-detail';
export type FieldOutboxType = 'job.start' | 'job.finish' | 'note.upsert' | 'photo.upload';

type NativeFieldStorePlugin = {
  putRecord(options: { kind: FieldRecordKind; key: string; json: string }): Promise<void>;
  getRecord(options: { kind: FieldRecordKind; key: string }): Promise<{ json?: string | null }>;
  queue(options: { type: FieldOutboxType; key: string; json: string }): Promise<void>;
  listOutbox(): Promise<{ items: Array<{ id: number; type: FieldOutboxType; key: string; json: string }> }>;
  removeOutbox(options: { id: number }): Promise<void>;
  savePhoto(options: { key: string; base64: string }): Promise<{ path: string }>;
  readPhoto(options: { path: string }): Promise<{ base64?: string | null }>;
  deletePhoto(options: { path: string }): Promise<void>;
};

const NativeFieldStore = registerPlugin<NativeFieldStorePlugin>('EverittFieldStore');
const WEB_PREFIX = 'everittos.field-cache.v1';
const WEB_OUTBOX = 'everittos.field-outbox.v1';
const WEB_PHOTO_PREFIX = 'everittos.field-photo.v1.';

function webKey(kind: FieldRecordKind, key: string) { return `${WEB_PREFIX}.${kind}.${key}`; }
function bytesToBase64(bytes: Uint8Array): string { let binary = ''; const chunk = 0x8000; for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length))); return btoa(binary); }
function base64ToBytes(base64: string): Uint8Array { const binary = atob(base64); const bytes = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i); return bytes; }

export async function fileToBase64(file: File): Promise<string> { return bytesToBase64(new Uint8Array(await file.arrayBuffer())); }
export function base64ToFile(base64: string, name: string, type: string): File { const bytes = base64ToBytes(base64); return new File([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], name, { type: type || 'image/jpeg' }); }

export async function putFieldRecord<T>(kind: FieldRecordKind, key: string, value: T): Promise<void> {
  const json = JSON.stringify(value);
  if (Capacitor.isNativePlatform()) { await NativeFieldStore.putRecord({ kind, key, json }); return; }
  window.localStorage.setItem(webKey(kind, key), json);
}

export async function getFieldRecord<T>(kind: FieldRecordKind, key: string): Promise<T | null> {
  try {
    if (Capacitor.isNativePlatform()) { const result = await NativeFieldStore.getRecord({ kind, key }); return result.json ? JSON.parse(result.json) as T : null; }
    const json = window.localStorage.getItem(webKey(kind, key)); return json ? JSON.parse(json) as T : null;
  } catch { return null; }
}

export async function queueFieldChange(type: FieldOutboxType, key: string, payload: unknown): Promise<void> {
  const json = JSON.stringify(payload);
  if (Capacitor.isNativePlatform()) { await NativeFieldStore.queue({ type, key, json }); return; }
  const current = JSON.parse(window.localStorage.getItem(WEB_OUTBOX) || '[]') as Array<{ id:number; type:FieldOutboxType; key:string; json:string }>;
  current.push({ id: Date.now(), type, key, json }); window.localStorage.setItem(WEB_OUTBOX, JSON.stringify(current));
}

export async function listFieldOutbox(): Promise<Array<{ id:number; type:FieldOutboxType; key:string; json:string }>> {
  try { if (Capacitor.isNativePlatform()) return (await NativeFieldStore.listOutbox()).items || []; return JSON.parse(window.localStorage.getItem(WEB_OUTBOX) || '[]'); } catch { return []; }
}

export async function removeFieldOutbox(id: number): Promise<void> {
  if (Capacitor.isNativePlatform()) { await NativeFieldStore.removeOutbox({ id }); return; }
  const current = await listFieldOutbox(); window.localStorage.setItem(WEB_OUTBOX, JSON.stringify(current.filter(item => item.id !== id)));
}

export async function saveFieldPhoto(key: string, file: File): Promise<{ path: string; previewUrl: string }> {
  const base64 = await fileToBase64(file);
  if (Capacitor.isNativePlatform()) {
    const result = await NativeFieldStore.savePhoto({ key, base64 });
    return { path: result.path, previewUrl: `data:${file.type || 'image/jpeg'};base64,${base64}` };
  }
  const path = `${WEB_PHOTO_PREFIX}${key}`;
  window.localStorage.setItem(path, base64);
  return { path, previewUrl: `data:${file.type || 'image/jpeg'};base64,${base64}` };
}

export async function readFieldPhoto(path: string): Promise<string | null> {
  try {
    if (Capacitor.isNativePlatform()) return (await NativeFieldStore.readPhoto({ path })).base64 || null;
    return window.localStorage.getItem(path);
  } catch { return null; }
}

export async function deleteFieldPhoto(path: string): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) { await NativeFieldStore.deletePhoto({ path }); return; }
    window.localStorage.removeItem(path);
  } catch {}
}
