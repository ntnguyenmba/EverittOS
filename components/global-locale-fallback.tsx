'use client';

import { useEffect, useMemo } from 'react';
import { useTranslation } from '@/components/locale-provider';
import { getMessages, type Messages } from '@/lib/i18n/get-messages';

type FlatMessages = Record<string, string>;
type SupportedLocale = 'en' | 'es' | 'vi';

const MANUAL_UI_COPY: Record<SupportedLocale, Record<string, string>> = {
  en: {
    'Save': 'Save',
    'Cancel': 'Cancel',
    'Edit': 'Edit',
    'Delete': 'Delete',
    'Close': 'Close',
    'Back': 'Back',
    'Next': 'Next',
    'Search': 'Search',
    'View': 'View',
    'Open': 'Open',
    'Add': 'Add',
    'Create': 'Create',
    'Update': 'Update',
    'Submit': 'Submit',
    'Loading': 'Loading',
    'Name': 'Name',
    'Email': 'Email',
    'Phone': 'Phone',
    'Address': 'Address',
    'Notes': 'Notes',
    'Status': 'Status',
    'Date': 'Date',
    'Time': 'Time',
    'Amount': 'Amount',
    'Customer': 'Customer',
    'Worker': 'Worker',
    'Job': 'Job',
    'Jobs': 'Jobs',
    'Team': 'Team',
    'Customers': 'Customers',
    'Expenses': 'Expenses',
    'Settings': 'Settings',
    'Flat rate': 'Flat rate',
    'Hourly': 'Hourly',
    'Top performer': 'Top performer',
    'Top customers': 'Top customers',
    'No results': 'No results',
    'Not set': 'Not set',
    'Required': 'Required'
  },
  es: {
    'Save': 'Guardar',
    'Cancel': 'Cancelar',
    'Edit': 'Editar',
    'Delete': 'Eliminar',
    'Close': 'Cerrar',
    'Back': 'Atrás',
    'Next': 'Siguiente',
    'Search': 'Buscar',
    'View': 'Ver',
    'Open': 'Abrir',
    'Add': 'Agregar',
    'Create': 'Crear',
    'Update': 'Actualizar',
    'Submit': 'Enviar',
    'Loading': 'Cargando',
    'Name': 'Nombre',
    'Email': 'Correo electrónico',
    'Phone': 'Teléfono',
    'Address': 'Dirección',
    'Notes': 'Notas',
    'Status': 'Estado',
    'Date': 'Fecha',
    'Time': 'Hora',
    'Amount': 'Monto',
    'Customer': 'Cliente',
    'Worker': 'Trabajador',
    'Job': 'Trabajo',
    'Jobs': 'Trabajos',
    'Team': 'Equipo',
    'Customers': 'Clientes',
    'Expenses': 'Gastos',
    'Settings': 'Configuración',
    'Flat rate': 'Tarifa fija',
    'Hourly': 'Por hora',
    'Top performer': 'Mejor trabajador',
    'Top customers': 'Mejores clientes',
    'No results': 'Sin resultados',
    'Not set': 'No establecido',
    'Required': 'Obligatorio'
  },
  vi: {
    'Save': 'Lưu',
    'Cancel': 'Hủy',
    'Edit': 'Chỉnh sửa',
    'Delete': 'Xóa',
    'Close': 'Đóng',
    'Back': 'Quay lại',
    'Next': 'Tiếp theo',
    'Search': 'Tìm kiếm',
    'View': 'Xem',
    'Open': 'Mở',
    'Add': 'Thêm',
    'Create': 'Tạo',
    'Update': 'Cập nhật',
    'Submit': 'Gửi',
    'Loading': 'Đang tải',
    'Name': 'Tên',
    'Email': 'Email',
    'Phone': 'Số điện thoại',
    'Address': 'Địa chỉ',
    'Notes': 'Ghi chú',
    'Status': 'Trạng thái',
    'Date': 'Ngày',
    'Time': 'Giờ',
    'Amount': 'Số tiền',
    'Customer': 'Khách hàng',
    'Worker': 'Người làm',
    'Job': 'Công việc',
    'Jobs': 'Công việc',
    'Team': 'Nhân sự',
    'Customers': 'Khách hàng',
    'Expenses': 'Chi phí',
    'Settings': 'Cài đặt',
    'Flat rate': 'Giá cố định',
    'Hourly': 'Theo giờ',
    'Top performer': 'Người làm tốt nhất',
    'Top customers': 'Khách hàng hàng đầu',
    'No results': 'Không có kết quả',
    'Not set': 'Chưa thiết lập',
    'Required': 'Bắt buộc'
  }
};

function flattenMessages(value: unknown, prefix = '', output: FlatMessages = {}): FlatMessages {
  if (!value || typeof value !== 'object') return output;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') output[path] = child;
    else flattenMessages(child, path, output);
  }
  return output;
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function buildTranslationMap(locale: SupportedLocale): Map<string, string> {
  const locales: SupportedLocale[] = ['en', 'es', 'vi'];
  const flattened = locales.map((item) => flattenMessages(getMessages(item)));
  const target = flattened[locales.indexOf(locale)];
  const result = new Map<string, string>();

  for (const sourceCatalog of flattened) {
    for (const [path, sourceValue] of Object.entries(sourceCatalog)) {
      const translatedValue = target[path];
      if (!translatedValue || /\{\w+\}/.test(sourceValue) || /\{\w+\}/.test(translatedValue)) continue;
      const source = normalize(sourceValue);
      if (source && source.length <= 220) result.set(source, translatedValue);
    }
  }

  for (const sourceLocale of locales) {
    for (const source of Object.values(MANUAL_UI_COPY[sourceLocale])) {
      const englishKey = Object.keys(MANUAL_UI_COPY.en).find((key) => MANUAL_UI_COPY[sourceLocale][key] === source);
      if (englishKey) result.set(normalize(source), MANUAL_UI_COPY[locale][englishKey]);
    }
  }
  for (const [source, translated] of Object.entries(MANUAL_UI_COPY[locale])) result.set(source, translated);

  return result;
}

function shouldSkip(element: Element | null): boolean {
  if (!element) return true;
  return Boolean(element.closest('[data-no-translate], [data-user-content], [contenteditable="true"], script, style, code, pre, textarea'));
}

function translatedValue(value: string, translations: Map<string, string>): string {
  const clean = normalize(value);
  const exact = translations.get(clean);
  if (exact) return value.replace(clean, exact);

  const colonMatch = clean.match(/^(.+?)(\s*:\s*)$/);
  if (colonMatch) {
    const translated = translations.get(normalize(colonMatch[1]));
    if (translated) return value.replace(clean, `${translated}${colonMatch[2]}`);
  }

  return value;
}

function translateElementAttributes(root: ParentNode, translations: Map<string, string>) {
  const attributes = ['placeholder', 'title', 'aria-label', 'aria-description', 'data-label', 'alt'] as const;
  const selector = attributes.map((attribute) => `[${attribute}]`).join(', ');
  const elements = root.querySelectorAll<HTMLElement>(selector);

  for (const element of elements) {
    if (shouldSkip(element)) continue;
    for (const attribute of attributes) {
      const current = element.getAttribute(attribute);
      if (!current) continue;
      const next = translatedValue(current, translations);
      if (next !== current) element.setAttribute(attribute, next);
    }
  }

  const valueControls = root.querySelectorAll<HTMLInputElement>('input[type="button"][value], input[type="submit"][value], input[type="reset"][value]');
  for (const control of valueControls) {
    if (shouldSkip(control)) continue;
    const next = translatedValue(control.value, translations);
    if (next !== control.value) control.value = next;
  }
}

function translateTextNodes(root: ParentNode, translations: Map<string, string>) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }

  for (const node of nodes) {
    const parent = node.parentElement;
    if (shouldSkip(parent)) continue;
    const raw = node.nodeValue || '';
    const next = translatedValue(raw, translations);
    if (next !== raw) node.nodeValue = next;
  }
}

export function GlobalLocaleFallback() {
  const { locale } = useTranslation();
  const translations = useMemo(() => buildTranslationMap(locale), [locale]);

  useEffect(() => {
    let frame = 0;
    const apply = () => {
      frame = 0;
      translateTextNodes(document.body, translations);
      translateElementAttributes(document.body, translations);
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(apply);
    };

    apply();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label', 'aria-description', 'data-label', 'alt', 'value']
    });

    window.addEventListener('pageshow', schedule);
    window.addEventListener('popstate', schedule);
    return () => {
      observer.disconnect();
      window.removeEventListener('pageshow', schedule);
      window.removeEventListener('popstate', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [translations]);

  return null;
}
