'use client';

import { useEffect } from 'react';

function buttonText(button: HTMLButtonElement) {
  return button.textContent?.trim().toLowerCase() || '';
}

function currentLocale() {
  const value = (document.documentElement.dataset.locale || document.documentElement.lang || document.body.dataset.locale || 'en').toLowerCase();
  if (value.startsWith('es')) return 'es';
  if (value.startsWith('vi')) return 'vi';
  return 'en';
}

const JOB_CREATE_TRANSLATIONS = {
  es: {
    'Cancel': 'Cancelar',
    'Create Job': 'Crear trabajo',
    'More options': 'Más opciones',
    'Customer price': 'Precio del cliente',
    'This is what the customer will pay for this job.': 'Esto es lo que el cliente pagará por este trabajo.',
    'Worker': 'Trabajador',
    'Assign worker': 'Asignar trabajador',
    'Unassigned': 'Sin asignar',
    'Worker price': 'Pago al trabajador',
    'This is what you will pay the worker for this job.': 'Esto es lo que pagarás al trabajador por este trabajo.',
    'Flat rate': 'Tarifa fija',
    'Hourly': 'Por hora',
    'Hours': 'Horas',
    'Worker hourly rate': 'Tarifa por hora del trabajador',
    'Job notes': 'Notas del trabajo',
    'Additional expenses': 'Gastos adicionales',
    'Expense description': 'Descripción del gasto',
    'Review before saving': 'Revisar antes de guardar',
    'One-time job': 'Trabajo único',
    'Recurring series': 'Serie recurrente',
    'Photos': 'Fotos',
    'Add photos': 'Agregar fotos',
    'Date': 'Fecha',
    'Start time': 'Hora de inicio',
    'End time': 'Hora de fin',
    'Save': 'Guardar',
    'Searching addresses…': 'Buscando direcciones…',
    'Use this address': 'Usar esta dirección',
    'Start typing an address or enter it manually': 'Empiece a escribir una dirección o ingrésela manualmente'
  },
  vi: {
    'Cancel': 'Hủy',
    'Create Job': 'Tạo công việc',
    'More options': 'Tùy chọn khác',
    'Customer price': 'Giá khách hàng',
    'This is what the customer will pay for this job.': 'Đây là số tiền khách hàng sẽ trả cho công việc này.',
    'Worker': 'Nhân sự',
    'Assign worker': 'Phân công nhân sự',
    'Unassigned': 'Chưa phân công',
    'Worker price': 'Tiền trả nhân sự',
    'This is what you will pay the worker for this job.': 'Đây là số tiền bạn sẽ trả cho nhân sự cho công việc này.',
    'Flat rate': 'Giá cố định',
    'Hourly': 'Theo giờ',
    'Hours': 'Số giờ',
    'Worker hourly rate': 'Mức trả theo giờ',
    'Job notes': 'Ghi chú công việc',
    'Additional expenses': 'Chi phí bổ sung',
    'Expense description': 'Mô tả chi phí',
    'Review before saving': 'Kiểm tra trước khi lưu',
    'One-time job': 'Công việc một lần',
    'Recurring series': 'Chuỗi định kỳ',
    'Photos': 'Ảnh',
    'Add photos': 'Thêm ảnh',
    'Date': 'Ngày',
    'Start time': 'Giờ bắt đầu',
    'End time': 'Giờ kết thúc',
    'Save': 'Lưu',
    'Searching addresses…': 'Đang tìm địa chỉ…',
    'Use this address': 'Dùng địa chỉ này',
    'Start typing an address or enter it manually': 'Bắt đầu nhập địa chỉ hoặc nhập thủ công'
  }
} as const;

function translateKnownUi() {
  const locale = currentLocale();
  if (locale === 'en') return;
  const translations = JOB_CREATE_TRANSLATIONS[locale];

  if (window.location.pathname === '/jobs/new') {
    const root = document.querySelector('.unified-job-form')?.parentElement || document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const raw = node.textContent || '';
      const trimmed = raw.trim();
      const translated = translations[trimmed as keyof typeof translations];
      if (translated && translated !== trimmed) {
        const leading = raw.match(/^\s*/)?.[0] || '';
        const trailing = raw.match(/\s*$/)?.[0] || '';
        node.textContent = `${leading}${translated}${trailing}`;
      }
      node = walker.nextNode();
    }

    root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[placeholder], textarea[placeholder]').forEach((field) => {
      const placeholder = field.getAttribute('placeholder') || '';
      const translated = translations[placeholder as keyof typeof translations];
      if (translated) field.setAttribute('placeholder', translated);
    });

    root.querySelectorAll<HTMLOptionElement>('option').forEach((option) => {
      const value = option.textContent?.trim() || '';
      const translated = translations[value as keyof typeof translations];
      if (translated) option.textContent = translated;
    });
  }
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
          (button) => buttonText(button) === 'create job' || buttonText(button) === 'crear trabajo' || buttonText(button) === 'tạo công việc'
        );
        if (createJob) addAfter(createJob, () => window.history.length > 1 ? window.history.back() : window.location.assign('/jobs'));
      }

      if (path === '/customers/new') {
        const saveCustomer = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
          (button) => buttonText(button) === 'save customer'
        );
        if (saveCustomer) addAfter(saveCustomer, () => window.history.length > 1 ? window.history.back() : window.location.assign('/customers'));
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

      translateKnownUi();
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    const localeObserver = new MutationObserver(apply);
    localeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'data-locale'] });
    localeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-locale'] });
    const jobTitleSyncTimer = window.setInterval(syncJobTitleFromAddress, 250);
    window.addEventListener('popstate', apply);

    return () => {
      observer.disconnect();
      localeObserver.disconnect();
      window.clearInterval(jobTitleSyncTimer);
      window.removeEventListener('popstate', apply);
    };
  }, []);

  return null;
}
