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
    'Required': 'Required',
    'Services': 'Services',
    'Availability': 'Availability',
    'Bookings': 'Bookings',
    'Add service': 'Add service',
    'Service name *': 'Service name *',
    'Category': 'Category',
    'Description': 'Description',
    'Duration (minutes)': 'Duration (minutes)',
    'Price ($)': 'Price ($)',
    'Your services': 'Your services',
    'Loading services…': 'Loading services…',
    'No services yet. Add your first service to start accepting bookings.': 'No services yet. Add your first service to start accepting bookings.',
    'Inactive': 'Inactive',
    'General': 'General',
    'Deactivate': 'Deactivate',
    'Activate': 'Activate',
    'Remove': 'Remove',
    'Staff service assignment': 'Staff service assignment',
    'Choose a team member, tap services they can perform, then save.': 'Choose a team member, tap services they can perform, then save.',
    'Select staff member': 'Select staff member',
    'Save staff services': 'Save staff services',
    'Service name is required.': 'Service name is required.',
    'Unable to load services.': 'Unable to load services.',
    'Unable to save service.': 'Unable to save service.',
    'Unable to update service.': 'Unable to update service.',
    'Service deactivated.': 'Service deactivated.',
    'Service activated.': 'Service activated.',
    'Unable to remove service.': 'Unable to remove service.',
    'Unable to save staff assignment.': 'Unable to save staff assignment.',
    'Client name *': 'Client name *',
    'Client phone': 'Client phone',
    'Client email': 'Client email',
    'Service or appointment': 'Service or appointment',
    'Example: Haircut, house cleaning, consultation': 'Example: Haircut, house cleaning, consultation',
    'Starts *': 'Starts *',
    'Ends *': 'Ends *',
    'Staff name': 'Staff name',
    'Optional': 'Optional',
    'Add client name, start time, and end time.': 'Add client name, start time, and end time.',
    'Unable to load bookings.': 'Unable to load bookings.',
    'Unable to save booking.': 'Unable to save booking.',
    'Booking could not be saved.': 'Booking could not be saved.',
    'Unable to update booking.': 'Unable to update booking.',
    'Unable to cancel booking.': 'Unable to cancel booking.',
    'Booking cancelled.': 'Booking cancelled.',
    'Unable to resend confirmation.': 'Unable to resend confirmation.',
    'Confirmation email sent.': 'Confirmation email sent.',
    'Booking details copied.': 'Booking details copied.',
    'Unable to copy booking details.': 'Unable to copy booking details.'
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
    'Required': 'Obligatorio',
    'Services': 'Servicios',
    'Availability': 'Disponibilidad',
    'Bookings': 'Reservas',
    'Add service': 'Agregar servicio',
    'Service name *': 'Nombre del servicio *',
    'Category': 'Categoría',
    'Description': 'Descripción',
    'Duration (minutes)': 'Duración (minutos)',
    'Price ($)': 'Precio ($)',
    'Your services': 'Tus servicios',
    'Loading services…': 'Cargando servicios…',
    'No services yet. Add your first service to start accepting bookings.': 'Aún no hay servicios. Agrega tu primer servicio para comenzar a aceptar reservas.',
    'Inactive': 'Inactivo',
    'General': 'General',
    'Deactivate': 'Desactivar',
    'Activate': 'Activar',
    'Remove': 'Eliminar',
    'Staff service assignment': 'Asignación de servicios al personal',
    'Choose a team member, tap services they can perform, then save.': 'Elige un miembro del equipo, selecciona los servicios que puede realizar y guarda.',
    'Select staff member': 'Seleccionar miembro del personal',
    'Save staff services': 'Guardar servicios del personal',
    'Service name is required.': 'El nombre del servicio es obligatorio.',
    'Unable to load services.': 'No se pudieron cargar los servicios.',
    'Unable to save service.': 'No se pudo guardar el servicio.',
    'Unable to update service.': 'No se pudo actualizar el servicio.',
    'Service deactivated.': 'Servicio desactivado.',
    'Service activated.': 'Servicio activado.',
    'Unable to remove service.': 'No se pudo eliminar el servicio.',
    'Unable to save staff assignment.': 'No se pudo guardar la asignación del personal.',
    'Client name *': 'Nombre del cliente *',
    'Client phone': 'Teléfono del cliente',
    'Client email': 'Correo del cliente',
    'Service or appointment': 'Servicio o cita',
    'Example: Haircut, house cleaning, consultation': 'Ejemplo: corte de cabello, limpieza de casa, consulta',
    'Starts *': 'Comienza *',
    'Ends *': 'Termina *',
    'Staff name': 'Nombre del personal',
    'Optional': 'Opcional',
    'Add client name, start time, and end time.': 'Agrega el nombre del cliente, la hora de inicio y la hora de finalización.',
    'Unable to load bookings.': 'No se pudieron cargar las reservas.',
    'Unable to save booking.': 'No se pudo guardar la reserva.',
    'Booking could not be saved.': 'No se pudo guardar la reserva.',
    'Unable to update booking.': 'No se pudo actualizar la reserva.',
    'Unable to cancel booking.': 'No se pudo cancelar la reserva.',
    'Booking cancelled.': 'Reserva cancelada.',
    'Unable to resend confirmation.': 'No se pudo reenviar la confirmación.',
    'Confirmation email sent.': 'Correo de confirmación enviado.',
    'Booking details copied.': 'Detalles de la reserva copiados.',
    'Unable to copy booking details.': 'No se pudieron copiar los detalles de la reserva.'
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
    'Required': 'Bắt buộc',
    'Services': 'Dịch vụ',
    'Availability': 'Thời gian khả dụng',
    'Bookings': 'Lịch đặt',
    'Add service': 'Thêm dịch vụ',
    'Service name *': 'Tên dịch vụ *',
    'Category': 'Danh mục',
    'Description': 'Mô tả',
    'Duration (minutes)': 'Thời lượng (phút)',
    'Price ($)': 'Giá ($)',
    'Your services': 'Dịch vụ của bạn',
    'Loading services…': 'Đang tải dịch vụ…',
    'No services yet. Add your first service to start accepting bookings.': 'Chưa có dịch vụ. Thêm dịch vụ đầu tiên để bắt đầu nhận lịch đặt.',
    'Inactive': 'Không hoạt động',
    'General': 'Chung',
    'Deactivate': 'Tắt',
    'Activate': 'Bật',
    'Remove': 'Xóa',
    'Staff service assignment': 'Phân công dịch vụ cho nhân sự',
    'Choose a team member, tap services they can perform, then save.': 'Chọn một thành viên, chọn các dịch vụ họ có thể thực hiện rồi lưu.',
    'Select staff member': 'Chọn nhân sự',
    'Save staff services': 'Lưu dịch vụ của nhân sự',
    'Service name is required.': 'Tên dịch vụ là bắt buộc.',
    'Unable to load services.': 'Không thể tải dịch vụ.',
    'Unable to save service.': 'Không thể lưu dịch vụ.',
    'Unable to update service.': 'Không thể cập nhật dịch vụ.',
    'Service deactivated.': 'Đã tắt dịch vụ.',
    'Service activated.': 'Đã bật dịch vụ.',
    'Unable to remove service.': 'Không thể xóa dịch vụ.',
    'Unable to save staff assignment.': 'Không thể lưu phân công nhân sự.',
    'Client name *': 'Tên khách hàng *',
    'Client phone': 'Số điện thoại khách hàng',
    'Client email': 'Email khách hàng',
    'Service or appointment': 'Dịch vụ hoặc cuộc hẹn',
    'Example: Haircut, house cleaning, consultation': 'Ví dụ: cắt tóc, dọn nhà, tư vấn',
    'Starts *': 'Bắt đầu *',
    'Ends *': 'Kết thúc *',
    'Staff name': 'Tên nhân sự',
    'Optional': 'Tùy chọn',
    'Add client name, start time, and end time.': 'Thêm tên khách hàng, thời gian bắt đầu và thời gian kết thúc.',
    'Unable to load bookings.': 'Không thể tải lịch đặt.',
    'Unable to save booking.': 'Không thể lưu lịch đặt.',
    'Booking could not be saved.': 'Không thể lưu lịch đặt.',
    'Unable to update booking.': 'Không thể cập nhật lịch đặt.',
    'Unable to cancel booking.': 'Không thể hủy lịch đặt.',
    'Booking cancelled.': 'Đã hủy lịch đặt.',
    'Unable to resend confirmation.': 'Không thể gửi lại xác nhận.',
    'Confirmation email sent.': 'Đã gửi email xác nhận.',
    'Booking details copied.': 'Đã sao chép chi tiết lịch đặt.',
    'Unable to copy booking details.': 'Không thể sao chép chi tiết lịch đặt.'
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
