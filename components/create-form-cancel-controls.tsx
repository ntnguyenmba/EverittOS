'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function buttonText(button: HTMLButtonElement) {
  return button.textContent?.trim().toLowerCase() || '';
}

function makeCancel(onClick: () => void) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn';
  button.textContent = 'Cancel';
  button.dataset.createCancel = 'true';
  button.addEventListener('click', onClick);
  return button;
}

function addAfter(target: HTMLButtonElement, onClick: () => void) {
  const parent = target.parentElement;
  const existing = parent?.querySelector<HTMLButtonElement>('[data-create-cancel="true"]');
  if (!parent) return null;
  if (existing) return existing;
  const cancel = makeCancel(onClick);
  target.insertAdjacentElement('afterend', cancel);
  return cancel;
}

export function CreateFormCancelControls() {
  const pathname = usePathname();

  useEffect(() => {
    /* Create Job is a controlled React form. Do not rewrite, hide, translate,
       reorder, or synthesize any of its fields or buttons at runtime. */
    if (pathname === '/jobs/new') return;

    const isCustomerCreate = pathname === '/customers/new';
    const isSettings = pathname.startsWith('/settings');
    if (!isCustomerCreate && !isSettings) return;

    const apply = () => {
      if (isCustomerCreate) {
        const saveCustomer = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
          (button) => buttonText(button) === 'save customer'
        );
        if (saveCustomer) {
          addAfter(saveCustomer, () =>
            window.history.length > 1 ? window.history.back() : window.location.assign('/customers')
          );
        }
      }

      if (isSettings) {
        const inviteEmail = document.querySelector<HTMLInputElement>('#invite-email');
        if (!inviteEmail) return;
        const inviteSection = inviteEmail.closest('.settings-card');
        const inviteButton = inviteSection
          ? Array.from(inviteSection.querySelectorAll<HTMLButtonElement>('button')).find((button) => {
              const text = buttonText(button);
              return text.includes('invite') || text.includes('send');
            })
          : null;
        if (!inviteButton) return;
        addAfter(inviteButton, () => {
          inviteEmail.value = '';
          inviteEmail.dispatchEvent(new Event('input', { bubbles: true }));
          const note = inviteSection?.querySelector<HTMLTextAreaElement>('textarea');
          if (note) {
            note.value = '';
            note.dispatchEvent(new Event('input', { bubbles: true }));
          }
          const header = inviteSection?.querySelector<HTMLButtonElement>('button[aria-expanded="true"]');
          header?.click();
        });
      }
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
