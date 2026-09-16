import type { Locale } from '@/lib/i18n/config';

export type AssignmentNotificationKind = 'job' | 'customer' | 'lead';
export type JobChangeReasonKey = 'schedule' | 'address' | 'cancelled';

type Copy = {
  assignmentTitle: Record<AssignmentNotificationKind, string>;
  untitled: Record<AssignmentNotificationKind, string>;
  assignedBody: (kind: AssignmentNotificationKind, title: string) => string;
  viewLabel: Record<AssignmentNotificationKind, string>;
  cancelledTitle: string;
  updatedTitle: string;
  cancelledBody: (title: string) => string;
  updatedBody: (title: string, changed: string) => string;
  changedLabel: string;
  viewJob: string;
  changeLabels: Record<JobChangeReasonKey, string>;
};

const COPY: Record<Locale, Copy> = {
  en: {
    assignmentTitle: { job: 'Job assignment updated', customer: 'Customer assignment updated', lead: 'Lead assignment updated' },
    untitled: { job: 'Untitled job', customer: 'Untitled customer', lead: 'Untitled lead' },
    assignedBody: (kind, title) => `You have been assigned to ${title}.`,
    viewLabel: { job: 'View job', customer: 'View customer', lead: 'View lead' },
    cancelledTitle: 'Job cancelled',
    updatedTitle: 'Job details updated',
    cancelledBody: (title) => `${title} was cancelled.`,
    updatedBody: (title, changed) => `${title} changed: ${changed}.`,
    changedLabel: 'Changed',
    viewJob: 'View job',
    changeLabels: { schedule: 'date or time', address: 'address', cancelled: 'status' }
  },
  es: {
    assignmentTitle: { job: 'Asignación de trabajo actualizada', customer: 'Asignación de cliente actualizada', lead: 'Asignación de prospecto actualizada' },
    untitled: { job: 'Trabajo sin título', customer: 'Cliente sin nombre', lead: 'Prospecto sin nombre' },
    assignedBody: (kind, title) => `Se te asignó ${title}.`,
    viewLabel: { job: 'Ver trabajo', customer: 'Ver cliente', lead: 'Ver prospecto' },
    cancelledTitle: 'Trabajo cancelado',
    updatedTitle: 'Detalles del trabajo actualizados',
    cancelledBody: (title) => `${title} fue cancelado.`,
    updatedBody: (title, changed) => `${title} cambió: ${changed}.`,
    changedLabel: 'Cambió',
    viewJob: 'Ver trabajo',
    changeLabels: { schedule: 'fecha u hora', address: 'dirección', cancelled: 'estado' }
  },
  vi: {
    assignmentTitle: { job: 'Phân công công việc đã cập nhật', customer: 'Phân công khách hàng đã cập nhật', lead: 'Phân công khách tiềm năng đã cập nhật' },
    untitled: { job: 'Công việc chưa đặt tên', customer: 'Khách hàng chưa đặt tên', lead: 'Khách tiềm năng chưa đặt tên' },
    assignedBody: (kind, title) => `Bạn đã được phân công cho ${title}.`,
    viewLabel: { job: 'Xem công việc', customer: 'Xem khách hàng', lead: 'Xem khách tiềm năng' },
    cancelledTitle: 'Công việc đã hủy',
    updatedTitle: 'Chi tiết công việc đã cập nhật',
    cancelledBody: (title) => `${title} đã bị hủy.`,
    updatedBody: (title, changed) => `${title} đã thay đổi: ${changed}.`,
    changedLabel: 'Thay đổi',
    viewJob: 'Xem công việc',
    changeLabels: { schedule: 'ngày hoặc giờ', address: 'địa chỉ', cancelled: 'trạng thái' }
  }
};

export function getAssignmentNotificationCopy(locale: Locale): Copy {
  return COPY[locale] || COPY.en;
}
