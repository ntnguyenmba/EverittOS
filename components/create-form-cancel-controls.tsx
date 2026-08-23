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

function setReactInputValue(input: HTMLInputElement, value: string) {
  if (input.value === value) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function findJobTitleInput() {
  const labels = Array.from(document.querySelectorAll<HTMLLabelElement>('.unified-job-form label'));
  const label = labels.find((item) => item.textContent?.trim().toLowerCase().startsWith('job title'));
  if (!label) return null;
  const section = label.closest<HTMLElement>('.job-create-section');
  const input = section?.querySelector<HTMLInputElement>('input');
  return input ? { input, section } : null;
}

function syncJobTitleFromAddress() {
  if (window.location.pathname !== '/jobs/new') return;

  const addressInput = document.querySelector<HTMLInputElement>('#job-address');
  const titleField = findJobTitleInput();
  if (!addressInput || !titleField) return;

  const fullAddress = addressInput.value.trim();
  if (fullAddress) setReactInputValue(titleField.input, fullAddress);

  titleField.input.required = false;
  titleField.input.setAttribute('aria-hidden', 'true');
  titleField.input.tabIndex = -1;
  if (titleField.section) {
    titleField.section.style.display = 'none';
    titleField.section.setAttribute('aria-hidden', 'true');
  }
}

export function CreateFormCancelControls() {
  useEffect(() => {
    const apply = () => {
      const path = window.location.pathname;

      if (path === '/jobs/new') {
        syncJobTitleFromAddress();
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
    const jobTitleSyncTimer = window.setInterval(syncJobTitleFromAddress, 250);
    window.addEventListener('popstate', apply);

    return () => {
      observer.disconnect();
      window.clearInterval(jobTitleSyncTimer);
      window.removeEventListener('popstate', apply);
    };
  }, []);

  return null;
}
