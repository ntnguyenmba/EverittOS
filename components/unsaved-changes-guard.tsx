'use client';

import { useEffect, useRef } from 'react';

const CLEAN_EVENT = 'everittos:changes-saved';

function isEditableField(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (!(target instanceof HTMLInputElement)) return false;
  return !['button', 'submit', 'reset', 'hidden', 'search'].includes(target.type);
}

function isGuardedField(target: EventTarget | null): boolean {
  if (!isEditableField(target)) return false;
  if (target.disabled || target.readOnly) return false;
  if (target.closest('.everitt-cmd-overlay')) return false;
  return Boolean(target.closest('form, .form, [data-unsaved-guard="true"]'));
}

export function markChangesSaved() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CLEAN_EVENT));
}

export function UnsavedChangesGuard() {
  const dirtyRef = useRef(false);

  useEffect(() => {
    const markDirty = (event: Event) => {
      if (isGuardedField(event.target)) dirtyRef.current = true;
    };

    const markClean = () => {
      dirtyRef.current = false;
    };

    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };

    const confirmNavigation = (event: MouseEvent) => {
      if (!dirtyRef.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.href === window.location.href || destination.hash) return;
      if (window.confirm('You have unsaved changes. Leave this page and discard them?')) {
        dirtyRef.current = false;
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener('input', markDirty, true);
    document.addEventListener('change', markDirty, true);
    document.addEventListener('submit', markClean, true);
    document.addEventListener('click', confirmNavigation, true);
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener(CLEAN_EVENT, markClean);

    return () => {
      document.removeEventListener('input', markDirty, true);
      document.removeEventListener('change', markDirty, true);
      document.removeEventListener('submit', markClean, true);
      document.removeEventListener('click', confirmNavigation, true);
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener(CLEAN_EVENT, markClean);
    };
  }, []);

  return null;
}
