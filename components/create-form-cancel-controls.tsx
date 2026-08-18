'use client';

import { useEffect } from 'react';

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
  if (!parent || parent.querySelector('[data-create-cancel="true"]')) return;
  const cancel = makeCancel(onClick);
  target.insertAdjacentElement('afterend', cancel);
}

export function CreateFormCancelControls() {
  useEffect(() => {
    const apply = () => {
      const path = window.location.pathname;

      if (path === '/jobs/new') {
        const createJob = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
          (button) => buttonText(button) === 'create job'
        );
        if (createJob) addAfter(createJob, () => window.history.length > 1 ? window.history.back() : window.location.assign('/jobs'));
      }

      if (path === '/customers/new') {
        const saveCustomer = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
          (button) => buttonText(button) === 'save customer'
        );
        if (saveCustomer) addAfter(saveCustomer, () => window.history.length > 1 ? window.history.back() : window.location.assign('/customers'));
      }

      if (path === '/expenses') {
        const saveExpense = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) => {
          const text = buttonText(button);
          return text === 'save expense' || text === 'add expense' || text === 'update expense';
        });
        if (saveExpense) {
          addAfter(saveExpense, () => {
            const close = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
              (button) => buttonText(button) === 'close'
            );
            if (close) close.click();
            else window.location.assign('/expenses');
          });
        }
      }

      const inviteEmail = document.querySelector<HTMLInputElement>('#invite-email');
      if (inviteEmail) {
        const inviteSection = inviteEmail.closest('.settings-card');
        const inviteButton = inviteSection
          ? Array.from(inviteSection.querySelectorAll<HTMLButtonElement>('button')).find((button) => {
              const text = buttonText(button);
              return text.includes('invite') || text.includes('send');
            })
          : null;
        if (inviteButton) {
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
      }
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('popstate', apply);

    return () => {
      observer.disconnect();
      window.removeEventListener('popstate', apply);
    };
  }, []);

  return null;
}
