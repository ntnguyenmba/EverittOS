import { normalizeLocale, type Locale } from '@/lib/i18n/config';

export type ExpensesPageCopy = {
  title: string;
  subtitle: string;
  gateTitle: string;
  gateBody: string;
  upgrade: string;
  addExpense: string;
  close: string;
  filters: string;
  hideFilters: string;
  total: string;
  saveChanges: string;
  delete: string;
  deleteConfirm: string;
  bookkeeping: string;
  loadError: string;
  roleDenied: string;
  quickbooksLocked: string;
  amountRequired: string;
  saveError: string;
  receiptError: string;
  deleteError: string;
  roleGateTitle: string;
  roleGateBody: string;
  search: string;
  searchPlaceholder: string;
  fromDate: string;
  toDate: string;
  category: string;
  allCategories: string;
  job: string;
  allJobs: string;
  customer: string;
  allCustomers: string;
  teamMember: string;
  allTeamMembers: string;
  applyFilters: string;
  editExpense: string;
  date: string;
  legacy: string;
  vendor: string;
  description: string;
  amount: string;
  amountHint: string;
  relatedJob: string;
  relatedCustomer: string;
  teamMemberOptional: string;
  none: string;
  paymentMethod: string;
  paymentPlaceholder: string;
  receiptPhoto: string;
  notes: string;
  cancel: string;
  emptyTitle: string;
  emptyBody: string;
  openInNewTab: string;
  credit: string;
  sourceManual: string;
  quickbooksManaged: string;
  linkedJob: string;
  added: string;
  notLinked: string;
  viewReceipt: string;
  edit: string;
  categories: Record<string, string>;
};

const byLocale: Record<Locale, ExpensesPageCopy> = {
  en: {
    title: 'Expenses',
    subtitle: 'Track supplies, software, fuel, advertising, and other operating costs. Link expenses to jobs for profit estimates.',
    gateTitle: 'Expenses and job profit',
    gateBody:
      '{plan} and above unlock expense tracking, job profitability, and business performance reports.',
    upgrade: 'Upgrade to {plan}',
    addExpense: 'Add expense',
    close: 'Close',
    filters: 'Filters',
    hideFilters: 'Hide filters',
    total: 'Total',
    saveChanges: 'Save changes',
    delete: 'Delete',
    deleteConfirm: 'Delete this expense?',
    bookkeeping: 'Bookkeeping',
    loadError: 'Unable to load expenses.',
    roleDenied: 'Your role cannot access expenses.',
    quickbooksLocked: 'This expense is managed in QuickBooks and cannot be edited here.',
    amountRequired: 'Enter an amount other than zero. Use a negative amount for a refund or credit.',
    saveError: 'Unable to save expense.',
    receiptError: 'Expense saved but receipt upload failed.',
    deleteError: 'Unable to delete expense.',
    roleGateTitle: 'Expenses are limited to owners, admins, and managers',
    roleGateBody: 'Your workspace role cannot access business expenses, revenue, or profit tracking.',
    search: 'Search',
    searchPlaceholder: 'Vendor, description, or notes',
    fromDate: 'From date',
    toDate: 'To date',
    category: 'Category',
    allCategories: 'All categories',
    job: 'Job',
    allJobs: 'All jobs',
    customer: 'Customer',
    allCustomers: 'All customers',
    teamMember: 'Team member',
    allTeamMembers: 'All team members',
    applyFilters: 'Apply filters',
    editExpense: 'Edit expense',
    date: 'Date',
    legacy: 'legacy',
    vendor: 'Vendor',
    description: 'Description',
    amount: 'Amount',
    amountHint: 'Enter a negative amount for a refund or credit, for example -12.47.',
    relatedJob: 'Related job (optional)',
    relatedCustomer: 'Related customer (optional)',
    teamMemberOptional: 'Team member (optional)',
    none: 'None',
    paymentMethod: 'Payment method (optional)',
    paymentPlaceholder: 'Cash, card, check...',
    receiptPhoto: 'Receipt photo (optional)',
    notes: 'Notes (optional)',
    cancel: 'Cancel',
    emptyTitle: 'No business expenses recorded yet',
    emptyBody: 'Add supplies, software, fuel, advertising, and other operating costs to improve profit reporting.',
    openInNewTab: 'Open {name} in a new tab',
    credit: 'Credit',
    sourceManual: 'Manual',
    quickbooksManaged: 'Managed in QuickBooks. Edit or delete it there to avoid duplicate totals.',
    linkedJob: 'Linked job',
    added: 'Added {date}',
    notLinked: 'Not linked to a job',
    viewReceipt: 'View receipt',
    edit: 'Edit',
    categories: { 'Supplies': 'Supplies', 'Equipment': 'Equipment', 'Fuel and mileage': 'Fuel and mileage', 'Software': 'Software', 'Advertising': 'Advertising', 'Insurance': 'Insurance', 'Office': 'Office', 'Repairs and maintenance': 'Repairs and maintenance', 'Professional services': 'Professional services', 'Taxes and fees': 'Taxes and fees', 'Other': 'Other', 'Fuel': 'Fuel', 'Materials': 'Materials', 'Equipment rental': 'Equipment rental', 'Tools': 'Tools', 'Vehicle': 'Vehicle', 'Marketing': 'Marketing', 'Subcontractor payment': 'Subcontractor payment' }
  },
  es: {
    title: 'Gastos',
    subtitle:
      'Registre combustible, suministros, materiales y otros costos. Vincule gastos a trabajos para estimar la ganancia.',
    gateTitle: 'Gastos y ganancia por trabajo',
    gateBody:
      '{plan} y superiores desbloquean el seguimiento de gastos, la rentabilidad por trabajo y los informes de desempeño.',
    upgrade: 'Mejorar a {plan}',
    addExpense: 'Agregar gasto',
    close: 'Cerrar',
    filters: 'Filtros',
    hideFilters: 'Ocultar filtros',
    total: 'Total',
    saveChanges: 'Guardar cambios',
    delete: 'Eliminar',
    deleteConfirm: '¿Eliminar este gasto?',
    bookkeeping: 'Contabilidad',
    loadError: 'No se pudieron cargar los gastos.',
    roleDenied: 'Su rol no puede acceder a los gastos.',
    quickbooksLocked: 'Este gasto se administra en QuickBooks y no se puede editar aquí.',
    amountRequired: 'Ingrese un monto distinto de cero. Use un monto negativo para un reembolso o crédito.',
    saveError: 'No se pudo guardar el gasto.',
    receiptError: 'El gasto se guardó, pero no se pudo subir el recibo.',
    deleteError: 'No se pudo eliminar el gasto.',
    roleGateTitle: 'Los gastos están limitados a propietarios, administradores y gerentes',
    roleGateBody: 'Su rol en el espacio de trabajo no puede acceder a gastos, ingresos ni seguimiento de ganancias.',
    search: 'Buscar',
    searchPlaceholder: 'Proveedor, descripción o notas',
    fromDate: 'Desde',
    toDate: 'Hasta',
    category: 'Categoría',
    allCategories: 'Todas las categorías',
    job: 'Trabajo',
    allJobs: 'Todos los trabajos',
    customer: 'Cliente',
    allCustomers: 'Todos los clientes',
    teamMember: 'Miembro del equipo',
    allTeamMembers: 'Todos los miembros del equipo',
    applyFilters: 'Aplicar filtros',
    editExpense: 'Editar gasto',
    date: 'Fecha',
    legacy: 'anterior',
    vendor: 'Proveedor',
    description: 'Descripción',
    amount: 'Monto',
    amountHint: 'Ingrese un monto negativo para un reembolso o crédito, por ejemplo -12.47.',
    relatedJob: 'Trabajo relacionado (opcional)',
    relatedCustomer: 'Cliente relacionado (opcional)',
    teamMemberOptional: 'Miembro del equipo (opcional)',
    none: 'Ninguno',
    paymentMethod: 'Método de pago (opcional)',
    paymentPlaceholder: 'Efectivo, tarjeta, cheque...',
    receiptPhoto: 'Foto del recibo (opcional)',
    notes: 'Notas (opcional)',
    cancel: 'Cancelar',
    emptyTitle: 'Aún no hay gastos registrados',
    emptyBody: 'Agregue suministros, software, combustible, publicidad y otros costos operativos para mejorar los informes de ganancias.',
    openInNewTab: 'Abrir {name} en una pestaña nueva',
    credit: 'Crédito',
    sourceManual: 'Manual',
    quickbooksManaged: 'Se administra en QuickBooks. Edítelo o elimínelo allí para evitar totales duplicados.',
    linkedJob: 'Trabajo vinculado',
    added: 'Agregado {date}',
    notLinked: 'Sin trabajo vinculado',
    viewReceipt: 'Ver recibo',
    edit: 'Editar',
    categories: { 'Supplies': 'Suministros', 'Equipment': 'Equipo', 'Fuel and mileage': 'Combustible y kilometraje', 'Software': 'Software', 'Advertising': 'Publicidad', 'Insurance': 'Seguro', 'Office': 'Oficina', 'Repairs and maintenance': 'Reparaciones y mantenimiento', 'Professional services': 'Servicios profesionales', 'Taxes and fees': 'Impuestos y tarifas', 'Other': 'Otro', 'Fuel': 'Combustible', 'Materials': 'Materiales', 'Equipment rental': 'Alquiler de equipo', 'Tools': 'Herramientas', 'Vehicle': 'Vehículo', 'Marketing': 'Mercadeo', 'Subcontractor payment': 'Pago a subcontratista' }
  },
  vi: {
    title: 'Chi phí',
    subtitle:
      'Theo dõi nhiên liệu, vật tư, nguyên liệu và chi phí khác. Liên kết chi phí với công việc để ước tính lợi nhuận.',
    gateTitle: 'Chi phí và lợi nhuận theo công việc',
    gateBody:
      '{plan} trở lên mở khóa theo dõi chi phí, lợi nhuận theo công việc và báo cáo hiệu suất kinh doanh.',
    upgrade: 'Nâng cấp lên {plan}',
    addExpense: 'Thêm chi phí',
    close: 'Đóng',
    filters: 'Bộ lọc',
    hideFilters: 'Ẩn bộ lọc',
    total: 'Tổng',
    saveChanges: 'Lưu thay đổi',
    delete: 'Xóa',
    deleteConfirm: 'Xóa chi phí này?',
    bookkeeping: 'Sổ sách',
    loadError: 'Không thể tải chi phí.',
    roleDenied: 'Vai trò của bạn không thể truy cập chi phí.',
    quickbooksLocked: 'Chi phí này được quản lý trong QuickBooks và không thể sửa tại đây.',
    amountRequired: 'Nhập số tiền khác 0. Dùng số âm cho khoản hoàn tiền hoặc tín dụng.',
    saveError: 'Không thể lưu chi phí.',
    receiptError: 'Đã lưu chi phí nhưng tải biên nhận lên thất bại.',
    deleteError: 'Không thể xóa chi phí.',
    roleGateTitle: 'Chi phí chỉ dành cho chủ, quản trị viên và quản lý',
    roleGateBody: 'Vai trò của bạn không thể truy cập chi phí, doanh thu hoặc theo dõi lợi nhuận.',
    search: 'Tìm kiếm',
    searchPlaceholder: 'Nhà cung cấp, mô tả hoặc ghi chú',
    fromDate: 'Từ ngày',
    toDate: 'Đến ngày',
    category: 'Danh mục',
    allCategories: 'Tất cả danh mục',
    job: 'Công việc',
    allJobs: 'Tất cả công việc',
    customer: 'Khách hàng',
    allCustomers: 'Tất cả khách hàng',
    teamMember: 'Thành viên nhóm',
    allTeamMembers: 'Tất cả thành viên',
    applyFilters: 'Áp dụng bộ lọc',
    editExpense: 'Sửa chi phí',
    date: 'Ngày',
    legacy: 'cũ',
    vendor: 'Nhà cung cấp',
    description: 'Mô tả',
    amount: 'Số tiền',
    amountHint: 'Nhập số âm cho khoản hoàn tiền hoặc tín dụng, ví dụ -12.47.',
    relatedJob: 'Công việc liên quan (tùy chọn)',
    relatedCustomer: 'Khách hàng liên quan (tùy chọn)',
    teamMemberOptional: 'Thành viên nhóm (tùy chọn)',
    none: 'Không có',
    paymentMethod: 'Phương thức thanh toán (tùy chọn)',
    paymentPlaceholder: 'Tiền mặt, thẻ, séc...',
    receiptPhoto: 'Ảnh biên nhận (tùy chọn)',
    notes: 'Ghi chú (tùy chọn)',
    cancel: 'Hủy',
    emptyTitle: 'Chưa ghi nhận chi phí nào',
    emptyBody: 'Thêm vật tư, phần mềm, nhiên liệu, quảng cáo và chi phí vận hành khác để cải thiện báo cáo lợi nhuận.',
    openInNewTab: 'Mở {name} trong thẻ mới',
    credit: 'Tín dụng',
    sourceManual: 'Thủ công',
    quickbooksManaged: 'Được quản lý trong QuickBooks. Hãy sửa hoặc xóa ở đó để tránh trùng tổng.',
    linkedJob: 'Công việc đã liên kết',
    added: 'Đã thêm {date}',
    notLinked: 'Chưa liên kết với công việc',
    viewReceipt: 'Xem biên nhận',
    edit: 'Sửa',
    categories: { 'Supplies': 'Vật tư', 'Equipment': 'Thiết bị', 'Fuel and mileage': 'Nhiên liệu và quãng đường', 'Software': 'Phần mềm', 'Advertising': 'Quảng cáo', 'Insurance': 'Bảo hiểm', 'Office': 'Văn phòng', 'Repairs and maintenance': 'Sửa chữa và bảo trì', 'Professional services': 'Dịch vụ chuyên môn', 'Taxes and fees': 'Thuế và phí', 'Other': 'Khác', 'Fuel': 'Nhiên liệu', 'Materials': 'Nguyên liệu', 'Equipment rental': 'Thuê thiết bị', 'Tools': 'Dụng cụ', 'Vehicle': 'Phương tiện', 'Marketing': 'Tiếp thị', 'Subcontractor payment': 'Thanh toán nhà thầu phụ' }
  }
};

export function getExpensesPageCopy(locale?: string | null): ExpensesPageCopy {
  return byLocale[normalizeLocale(locale)];
}

export function expenseCategoryLabel(copy: ExpensesPageCopy, category: string): string {
  return copy.categories[category] || category;
}

export function formatExpensesCopy(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, 'g'), value),
    template
  );
}
