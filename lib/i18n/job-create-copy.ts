import type { Locale } from '@/lib/i18n/config';

export type JobCreateCopy = {
  intro: string;
  customerHeading: string;
  customerChoice: string;
  existingCustomer: string;
  newCustomer: string;
  searchCustomers: string;
  searchPlaceholder: string;
  searching: string;
  customerMatches: string;
  changeCustomer: string;
  customerName: string;
  email: string;
  phone: string;
  company: string;
  notOnFile: string;
  propertyHeading: string;
  savedProperties: string;
  selectProperty: string;
  multipleProperties: string;
  addAnotherProperty: string;
  useSavedProperty: string;
  propertyName: string;
  propertyNamePlaceholder: string;
  serviceAddress: string;
  addressPlaceholder: string;
  noAddress: string;
  accessNotes: string;
  accessInstructions: string;
  accessPrivacy: string;
  selectPropertyRequired: string;
  unableToCreateCustomer: string;
  unableToSaveProperty: string;
  addServiceAddress: string;
  prepareCustomerProperty: string;
  noProperty: string;
};

const en: JobCreateCopy = {
  intro: 'Choose an existing customer or add a new one, then confirm the schedule.',
  customerHeading: '1. Customer',
  customerChoice: 'Customer type',
  existingCustomer: 'Existing customer',
  newCustomer: 'New customer',
  searchCustomers: 'Search customers',
  searchPlaceholder: 'Name, phone, email, company, or property address',
  searching: 'Searching…',
  customerMatches: 'Customer matches',
  changeCustomer: 'Change customer',
  customerName: 'Name',
  email: 'Email',
  phone: 'Phone',
  company: 'Company',
  notOnFile: 'Not on file',
  propertyHeading: '2. Property / service location',
  savedProperties: 'Saved properties',
  selectProperty: 'Select a property',
  multipleProperties: 'This customer has more than one property. Choose the one for this job.',
  addAnotherProperty: 'Add another property',
  useSavedProperty: 'Use a saved property',
  propertyName: 'Property name',
  propertyNamePlaceholder: 'Primary',
  serviceAddress: 'Service address',
  addressPlaceholder: 'Start typing an address or enter it manually',
  noAddress: 'No address',
  accessNotes: 'Access instructions and notes',
  accessInstructions: 'Access instructions',
  accessPrivacy: 'Gate and lockbox codes stay on the property record. They are not shown in search previews or notifications.',
  selectPropertyRequired: 'Select which property this job is for.',
  unableToCreateCustomer: 'Unable to create customer.',
  unableToSaveProperty: 'Unable to save property.',
  addServiceAddress: 'Add a service address to save the property.',
  prepareCustomerProperty: 'Unable to prepare customer/property.',
  noProperty: 'Property'
};

const es: JobCreateCopy = {
  intro: 'Elija un cliente existente o agregue uno nuevo y luego confirme el horario.',
  customerHeading: '1. Cliente',
  customerChoice: 'Tipo de cliente',
  existingCustomer: 'Cliente existente',
  newCustomer: 'Cliente nuevo',
  searchCustomers: 'Buscar clientes',
  searchPlaceholder: 'Nombre, teléfono, correo, empresa o dirección de la propiedad',
  searching: 'Buscando…',
  customerMatches: 'Coincidencias de clientes',
  changeCustomer: 'Cambiar cliente',
  customerName: 'Nombre',
  email: 'Correo electrónico',
  phone: 'Teléfono',
  company: 'Empresa',
  notOnFile: 'No registrado',
  propertyHeading: '2. Propiedad / lugar de servicio',
  savedProperties: 'Propiedades guardadas',
  selectProperty: 'Seleccione una propiedad',
  multipleProperties: 'Este cliente tiene más de una propiedad. Elija la de este trabajo.',
  addAnotherProperty: 'Agregar otra propiedad',
  useSavedProperty: 'Usar una propiedad guardada',
  propertyName: 'Nombre de la propiedad',
  propertyNamePlaceholder: 'Principal',
  serviceAddress: 'Dirección de servicio',
  addressPlaceholder: 'Empiece a escribir una dirección o ingrésela manualmente',
  noAddress: 'Sin dirección',
  accessNotes: 'Instrucciones de acceso y notas',
  accessInstructions: 'Instrucciones de acceso',
  accessPrivacy: 'Los códigos de portón y caja de seguridad permanecen en la propiedad. No se muestran en búsquedas ni notificaciones.',
  selectPropertyRequired: 'Seleccione la propiedad para este trabajo.',
  unableToCreateCustomer: 'No se pudo crear el cliente.',
  unableToSaveProperty: 'No se pudo guardar la propiedad.',
  addServiceAddress: 'Agregue una dirección de servicio para guardar la propiedad.',
  prepareCustomerProperty: 'No se pudo preparar el cliente o la propiedad.',
  noProperty: 'Propiedad'
};

const vi: JobCreateCopy = {
  intro: 'Chọn khách hàng có sẵn hoặc thêm khách hàng mới, rồi xác nhận lịch.',
  customerHeading: '1. Khách hàng',
  customerChoice: 'Loại khách hàng',
  existingCustomer: 'Khách hàng có sẵn',
  newCustomer: 'Khách hàng mới',
  searchCustomers: 'Tìm khách hàng',
  searchPlaceholder: 'Tên, điện thoại, email, công ty hoặc địa chỉ bất động sản',
  searching: 'Đang tìm…',
  customerMatches: 'Khách hàng khớp',
  changeCustomer: 'Đổi khách hàng',
  customerName: 'Tên',
  email: 'Email',
  phone: 'Điện thoại',
  company: 'Công ty',
  notOnFile: 'Chưa có',
  propertyHeading: '2. Bất động sản / nơi làm việc',
  savedProperties: 'Bất động sản đã lưu',
  selectProperty: 'Chọn bất động sản',
  multipleProperties: 'Khách hàng này có nhiều bất động sản. Hãy chọn nơi cho công việc này.',
  addAnotherProperty: 'Thêm bất động sản khác',
  useSavedProperty: 'Dùng bất động sản đã lưu',
  propertyName: 'Tên bất động sản',
  propertyNamePlaceholder: 'Chính',
  serviceAddress: 'Địa chỉ làm việc',
  addressPlaceholder: 'Nhập địa chỉ hoặc gõ thủ công',
  noAddress: 'Chưa có địa chỉ',
  accessNotes: 'Hướng dẫn ra vào và ghi chú',
  accessInstructions: 'Hướng dẫn ra vào',
  accessPrivacy: 'Mã cổng và hộp khóa được lưu trên bất động sản. Chúng không hiện trong tìm kiếm hoặc thông báo.',
  selectPropertyRequired: 'Hãy chọn bất động sản cho công việc này.',
  unableToCreateCustomer: 'Không thể tạo khách hàng.',
  unableToSaveProperty: 'Không thể lưu bất động sản.',
  addServiceAddress: 'Thêm địa chỉ làm việc để lưu bất động sản.',
  prepareCustomerProperty: 'Không thể chuẩn bị khách hàng/bất động sản.',
  noProperty: 'Bất động sản'
};

const copies: Record<Locale, JobCreateCopy> = { en, es, vi };

export function getJobCreateCopy(locale?: string | null): JobCreateCopy {
  const value = String(locale || 'en').toLowerCase();
  if (value.startsWith('es')) return copies.es;
  if (value.startsWith('vi')) return copies.vi;
  return copies.en;
}
