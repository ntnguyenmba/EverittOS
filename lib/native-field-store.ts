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
};

const NativeFieldStore = registerPlugin<NativeFieldStorePlugin>('EverittFieldStore');
const WEB_PREFIX = 'everittos.field-cache.v1';
const WEB_OUTBOX = 'everittos.field-outbox.v1';

function webKey(kind: FieldRecordKind, key: string) {
  return `${WEB_PREFIX}.${kind}.${key}`;
}

export async function putFieldRecord<T>(kind: FieldRecordKind, key: string, value: T): Promise<void> {
  const json = JSON.stringify(value);
  if (Capacitor.isNativePlatform()) {
    await NativeFieldStore.putRecord({ kind, key, json });
    return;
  }
  window.localStorage.setItem(webKey(kind, key), json);
}

export async function getFieldRecord<T>(kind: FieldRecordKind, key: string): Promise<T | null> {
  try {
    if (Capacitor.isNativePlatform()) {
      const result = await NativeFieldStore.getRecord({ kind, key });
      return result.json ? (JSON.parse(result.json) as T) : null;
    }
    const json = window.localStorage.getItem(webKey(kind, key));
    return json ? (JSON.parse(json) as T) : null;
  } catch {
    return null;
  }
}

export async function queueFieldChange(type: FieldOutboxType, key: string, payload: unknown): Promise<void> {
  const json = JSON.stringify(payload);
  if (Capacitor.isNativePlatform()) {
    await NativeFieldStore.queue({ type, key, json });
    return;
  }
  const current = JSON.parse(window.localStorage.getItem(WEB_OUTBOX) || '[]') as Array<{ id: number; type: FieldOutboxType; key: string; json: string }>;
  current.push({ id: Date.now(), type, key, json });
  window.localStorage.setItem(WEB_OUTBOX, JSON.stringify(current));
}

export async function listFieldOutbox(): Promise<Array<{ id: number; type: FieldOutboxType; key: string; json: string }>> {
  try {
    if (Capacitor.isNativePlatform()) return (await NativeFieldStore.listOutbox()).items || [];
    return JSON.parse(window.localStorage.getItem(WEB_OUTBOX) || '[]');
  } catch {
    return [];
  }
}

export async function removeFieldOutbox(id: number): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await NativeFieldStore.removeOutbox({ id });
    return;
  }
  const current = await listFieldOutbox();
  window.localStorage.setItem(WEB_OUTBOX, JSON.stringify(current.filter(item => item.id !== id)));
}
