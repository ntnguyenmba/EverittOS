import type { Locale } from '@/lib/i18n/config';

export type JobCreateCopy = {
  pageTitle: string;
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
  jobDetailsHeading: string;
  jobTitle: string;
  jobTitlePlaceholder: string;
  date: string;
  customerPriceHeading: string;
  customerPriceHelp: string;
  customerPrice: string;
  workerHeading: string;
  assignWorker: string;
  unassigned: string;
  workerPrice: string;
  workerPriceHelp: string;
  flatRate: string;
  hourly: string;
  hours: string;
  workerHourlyRate: string;
  workerCost: string;
  jobNotes: string;
  moreOptions: string;
  visitsHelp: string;
  jobTimezone: string;
  companyDefaultTimezone: string;
  timezoneHelp: string;
  visitNotes: string;
  visitLabel: string;
  startTime: string;
  endTime: string;
  removeVisit: string;
  addVisit: string;
  additionalExpenses: string;
  expenseDescription: string;
  expensePlaceholder: string;
  workerPayNotes: string;
  expectedProfit: string;
  profitFormula: string;
  initialPhotos: string;
  initialPhotosHelp: string;
  photosSelected: string;
  reviewHeading: string;
  oneTimeJob: string;
  recurringSeries: string;
  perVisit: string;
  createJob: string;
};

const en: JobCreateCopy = {
  pageTitle: 'Create job',
  intro: 'Choose an existing customer or add a new one, then save the job.',
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
  noProperty: 'Property',
  jobDetailsHeading: '3. Job details',
  jobTitle: 'Job title *',
  jobTitlePlaceholder: 'Example: Move-out cleaning',
  date: 'Date',
  customerPriceHeading: '5. Customer price',
  customerPriceHelp: 'This is what the customer will pay for this job.',
  customerPrice: 'Customer price',
  workerHeading: '6. Worker',
  assignWorker: 'Assign worker',
  unassigned: 'Unassigned',
  workerPrice: 'Worker price',
  workerPriceHelp: 'This is what you will pay the worker for this job.',
  flatRate: 'Flat rate',
  hourly: 'Hourly',
  hours: 'Hours',
  workerHourlyRate: 'Worker hourly rate',
  workerCost: 'Worker cost',
  jobNotes: 'Job notes',
  moreOptions: 'More options',
  visitsHelp: 'Add one or more visits. Times use the job timezone below.',
  jobTimezone: 'Job timezone',
  companyDefaultTimezone: 'Use company default',
  timezoneHelp: 'Filled from the property address when available. You can change it.',
  visitNotes: 'Visit notes',
  visitLabel: 'Visit',
  startTime: 'Start time',
  endTime: 'End time',
  removeVisit: 'Remove visit',
  addVisit: 'Add another visit',
  additionalExpenses: 'Additional expected expenses',
  expenseDescription: 'Expense description (optional)',
  expensePlaceholder: 'Supplies, parking, travel…',
  workerPayNotes: 'Worker pay notes (optional)',
  expectedProfit: 'Expected profit',
  profitFormula: 'Expected profit = Customer price − Worker price − Additional expected expenses',
  initialPhotos: 'Initial photos',
  initialPhotosHelp: 'Optional before photos. You can edit or add more photos after the job is created.',
  photosSelected: 'photos selected',
  reviewHeading: '7. Review before saving',
  oneTimeJob: 'One-time job',
  recurringSeries: 'Recurring series',
  perVisit: 'Per visit',
  createJob: 'Create Job'
};

const es: JobCreateCopy = {
  pageTitle: 'Crear trabajo',
  intro: 'Elija un cliente existente o agregue uno nuevo y luego guarde el trabajo.',
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
  noProperty: 'Propiedad',
  jobDetailsHeading: '3. Detalles del trabajo',
  jobTitle: 'Título del trabajo *',
  jobTitlePlaceholder: 'Ejemplo: Limpieza de mudanza',
  date: 'Fecha',
  customerPriceHeading: '5. Precio del cliente',
  customerPriceHelp: 'Esto es lo que el cliente pagará por este trabajo.',
  customerPrice: 'Precio del cliente',
  workerHeading: '6. Trabajador',
  assignWorker: 'Asignar trabajador',
  unassigned: 'Sin asignar',
  workerPrice: 'Precio del trabajador',
  workerPriceHelp: 'Esto es lo que pagará al trabajador por este trabajo.',
  flatRate: 'Tarifa fija',
  hourly: 'Por hora',
  hours: 'Horas',
  workerHourlyRate: 'Tarifa por hora del trabajador',
  workerCost: 'Costo del trabajador',
  jobNotes: 'Notas del trabajo',
  moreOptions: 'Más opciones',
  visitsHelp: 'Agregue una o más visitas. Los horarios usan la zona horaria del trabajo.',
  jobTimezone: 'Zona horaria del trabajo',
  companyDefaultTimezone: 'Usar la predeterminada de la empresa',
  timezoneHelp: 'Se completa con la dirección de la propiedad cuando está disponible. Puede cambiarla.',
  visitNotes: 'Notas de la visita',
  visitLabel: 'Visita',
  startTime: 'Hora de inicio',
  endTime: 'Hora de fin',
  removeVisit: 'Quitar visita',
  addVisit: 'Agregar otra visita',
  additionalExpenses: 'Gastos adicionales previstos',
  expenseDescription: 'Descripción del gasto (opcional)',
  expensePlaceholder: 'Insumos, estacionamiento, viaje…',
  workerPayNotes: 'Notas de pago al trabajador (opcional)',
  expectedProfit: 'Ganancia prevista',
  profitFormula: 'Ganancia prevista = Precio del cliente − Precio del trabajador − Gastos adicionales previstos',
  initialPhotos: 'Fotos iniciales',
  initialPhotosHelp: 'Fotos previas opcionales. Puede editar o agregar más después de crear el trabajo.',
  photosSelected: 'fotos seleccionadas',
  reviewHeading: '7. Revisar antes de guardar',
  oneTimeJob: 'Trabajo único',
  recurringSeries: 'Serie recurrente',
  perVisit: 'Por visita',
  createJob: 'Crear trabajo'
};

const vi: JobCreateCopy = {
  pageTitle: 'Tạo công việc',
  intro: 'Chọn khách hàng có sẵn hoặc thêm khách hàng mới, rồi lưu công việc.',
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
  noProperty: 'Bất động sản',
  jobDetailsHeading: '3. Chi tiết công việc',
  jobTitle: 'Tên công việc *',
  jobTitlePlaceholder: 'Ví dụ: Dọn nhà chuyển đi',
  date: 'Ngày',
  customerPriceHeading: '5. Giá khách hàng',
  customerPriceHelp: 'Đây là số tiền khách sẽ trả cho công việc này.',
  customerPrice: 'Giá khách hàng',
  workerHeading: '6. Nhân viên',
  assignWorker: 'Giao nhân viên',
  unassigned: 'Chưa giao',
  workerPrice: 'Giá nhân viên',
  workerPriceHelp: 'Đây là số tiền bạn sẽ trả cho nhân viên.',
  flatRate: 'Giá cố định',
  hourly: 'Theo giờ',
  hours: 'Giờ',
  workerHourlyRate: 'Mức giờ của nhân viên',
  workerCost: 'Chi phí nhân viên',
  jobNotes: 'Ghi chú công việc',
  moreOptions: 'Thêm tùy chọn',
  visitsHelp: 'Thêm một hoặc nhiều lần đến. Giờ theo múi giờ công việc bên dưới.',
  jobTimezone: 'Múi giờ công việc',
  companyDefaultTimezone: 'Dùng múi giờ mặc định của công ty',
  timezoneHelp: 'Được điền từ địa chỉ bất động sản khi có. Bạn có thể đổi.',
  visitNotes: 'Ghi chú lần đến',
  visitLabel: 'Lần đến',
  startTime: 'Giờ bắt đầu',
  endTime: 'Giờ kết thúc',
  removeVisit: 'Xóa lần đến',
  addVisit: 'Thêm lần đến',
  additionalExpenses: 'Chi phí thêm dự kiến',
  expenseDescription: 'Mô tả chi phí (tùy chọn)',
  expensePlaceholder: 'Vật tư, đỗ xe, đi lại…',
  workerPayNotes: 'Ghi chú trả nhân viên (tùy chọn)',
  expectedProfit: 'Lợi nhuận dự kiến',
  profitFormula: 'Lợi nhuận dự kiến = Giá khách − Giá nhân viên − Chi phí thêm dự kiến',
  initialPhotos: 'Ảnh ban đầu',
  initialPhotosHelp: 'Ảnh trước tùy chọn. Bạn có thể sửa hoặc thêm ảnh sau khi tạo công việc.',
  photosSelected: 'ảnh đã chọn',
  reviewHeading: '7. Xem lại trước khi lưu',
  oneTimeJob: 'Công việc một lần',
  recurringSeries: 'Chuỗi định kỳ',
  perVisit: 'Mỗi lần đến',
  createJob: 'Tạo công việc'
};

const copies: Record<Locale, JobCreateCopy> = { en, es, vi };

export function getJobCreateCopy(locale?: string | null): JobCreateCopy {
  const value = String(locale || 'en').toLowerCase();
  if (value.startsWith('es')) return copies.es;
  if (value.startsWith('vi')) return copies.vi;
  return copies.en;
}
