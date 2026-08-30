export type CustomerCreateCopy = {
  pageTitle: string;
  intro: string;
  back: string;
  formTitle: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  assignTo: string;
  unassigned: string;
  save: string;
  cancel: string;
  unableToSave: string;
};

const en: CustomerCreateCopy = {
  pageTitle: 'New customer',
  intro: 'Add contact details, notes, and follow-ups for a new customer.',
  back: 'Back to customers',
  formTitle: 'New customer',
  name: 'Name *',
  phone: 'Phone',
  email: 'Email',
  address: 'Address',
  notes: 'Notes',
  assignTo: 'Assign to',
  unassigned: 'Unassigned',
  save: 'Save customer',
  cancel: 'Cancel',
  unableToSave: 'Unable to save customer.'
};

const es: CustomerCreateCopy = {
  pageTitle: 'Cliente nuevo',
  intro: 'Agregue datos de contacto, notas y seguimientos para un cliente nuevo.',
  back: 'Volver a clientes',
  formTitle: 'Cliente nuevo',
  name: 'Nombre *',
  phone: 'Teléfono',
  email: 'Correo electrónico',
  address: 'Dirección',
  notes: 'Notas',
  assignTo: 'Asignar a',
  unassigned: 'Sin asignar',
  save: 'Guardar cliente',
  cancel: 'Cancelar',
  unableToSave: 'No se pudo guardar el cliente.'
};

const vi: CustomerCreateCopy = {
  pageTitle: 'Khách hàng mới',
  intro: 'Thêm thông tin liên hệ, ghi chú và theo dõi cho khách hàng mới.',
  back: 'Quay lại khách hàng',
  formTitle: 'Khách hàng mới',
  name: 'Tên *',
  phone: 'Điện thoại',
  email: 'Email',
  address: 'Địa chỉ',
  notes: 'Ghi chú',
  assignTo: 'Giao cho',
  unassigned: 'Chưa giao',
  save: 'Lưu khách hàng',
  cancel: 'Hủy',
  unableToSave: 'Không lưu được khách hàng.'
};

export function getCustomerCreateCopy(locale?: string | null): CustomerCreateCopy {
  const value = String(locale || 'en').toLowerCase();
  if (value.startsWith('es')) return es;
  if (value.startsWith('vi')) return vi;
  return en;
}
