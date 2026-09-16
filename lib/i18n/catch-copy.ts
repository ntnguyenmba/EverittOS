import type { Locale } from '@/lib/i18n/config';

export type CatchActionCopy = {
  leadTitle: (name: string) => string;
  leadOldReason: string;
  leadNewReason: string;
  bookingTitle: (name: string) => string;
  bookingReason: string;
  jobTitle: (title: string) => string;
  jobReason: string;
  followUpTitle: (title: string, name: string) => string;
  followUpReason: string;
  inquiryDraft: (name: string) => string;
  bookingDraft: (name: string) => string;
  jobDraft: (name: string) => string;
  followUpDraft: (name: string) => string;
};

type CatchCopy = {
  product: string;
  plan: string;
  title: string;
  addInquiry: string;
  bookings: string;
  upgrade: string;
  checking: string;
  empty: string;
  reply: string;
  open: string;
  copy: string;
  copied: string;
  done: string;
  hide: string;
  hidden: string;
  showAgain: string;
  saveError: string;
  copyError: string;
  untitledJob: string;
  job: string;
  bookingRequest: string;
  actions: CatchActionCopy;
};

function firstName(name: string, fallback: string) {
  return name.trim().split(/\s+/)[0] || fallback;
}

const COPY: Record<Locale, CatchCopy> = {
  en: {
    product: 'Catch',
    plan: 'Enterprise',
    title: 'Who needs attention',
    addInquiry: 'Add inquiry',
    bookings: 'Bookings',
    upgrade: 'Upgrade to Enterprise',
    checking: 'Checking...',
    empty: 'Nothing needs attention.',
    reply: 'Reply',
    open: 'Open',
    copy: 'Copy',
    copied: 'Copied',
    done: 'Done',
    hide: 'Hide',
    hidden: 'Hidden',
    showAgain: 'Show again',
    saveError: 'Could not save that change.',
    copyError: 'Could not copy.',
    untitledJob: 'Untitled job',
    job: 'Job',
    bookingRequest: 'Booking request',
    actions: {
      leadTitle: (name) => `Reply to ${name}`,
      leadOldReason: 'Waiting 3 days',
      leadNewReason: 'Waiting 24 hours',
      bookingTitle: (name) => `Confirm ${name}`,
      bookingReason: 'Waiting for confirmation',
      jobTitle: (title) => `Check ${title}`,
      jobReason: 'Job still open',
      followUpTitle: (title, name) => `Follow up on ${title} with ${name}`,
      followUpReason: 'Finished 3 days ago',
      inquiryDraft: (name) => `Hi ${firstName(name, 'there')}, just following up on your request. Do you still need help?`,
      bookingDraft: (name) => `Hi ${firstName(name, 'there')}, can we confirm your booking?`,
      jobDraft: (name) => `Hi ${firstName(name, 'there')}, checking in on your job. Let me know if you have any questions.`,
      followUpDraft: (name) => `Hi ${firstName(name, 'there')}, thanks again for working with us. How did everything go?`
    }
  },
  es: {
    product: 'Catch',
    plan: 'Enterprise',
    title: 'Quién necesita atención',
    addInquiry: 'Agregar consulta',
    bookings: 'Reservas',
    upgrade: 'Cambiar a Enterprise',
    checking: 'Revisando...',
    empty: 'Nada necesita atención.',
    reply: 'Respuesta',
    open: 'Abrir',
    copy: 'Copiar',
    copied: 'Copiado',
    done: 'Listo',
    hide: 'Ocultar',
    hidden: 'Ocultos',
    showAgain: 'Mostrar de nuevo',
    saveError: 'No se pudo guardar el cambio.',
    copyError: 'No se pudo copiar.',
    untitledJob: 'Trabajo sin título',
    job: 'Trabajo',
    bookingRequest: 'Solicitud de reserva',
    actions: {
      leadTitle: (name) => `Responder a ${name}`,
      leadOldReason: 'Esperando 3 días',
      leadNewReason: 'Esperando 24 horas',
      bookingTitle: (name) => `Confirmar con ${name}`,
      bookingReason: 'Falta confirmación',
      jobTitle: (title) => `Revisar ${title}`,
      jobReason: 'El trabajo sigue abierto',
      followUpTitle: (title, name) => `Dar seguimiento a ${title} con ${name}`,
      followUpReason: 'Terminó hace 3 días',
      inquiryDraft: (name) => `Hola ${firstName(name, 'de nuevo')}, quería dar seguimiento a tu solicitud. ¿Todavía necesitas ayuda?`,
      bookingDraft: (name) => `Hola ${firstName(name, 'de nuevo')}, ¿podemos confirmar tu reserva?`,
      jobDraft: (name) => `Hola ${firstName(name, 'de nuevo')}, quería saber cómo va tu trabajo. Avísame si tienes alguna pregunta.`,
      followUpDraft: (name) => `Hola ${firstName(name, 'de nuevo')}, gracias por trabajar con nosotros. ¿Cómo salió todo?`
    }
  },
  vi: {
    product: 'Catch',
    plan: 'Enterprise',
    title: 'Ai cần xử lý',
    addInquiry: 'Thêm yêu cầu',
    bookings: 'Lịch hẹn',
    upgrade: 'Nâng cấp Enterprise',
    checking: 'Đang kiểm tra...',
    empty: 'Không có việc cần xử lý.',
    reply: 'Tin nhắn',
    open: 'Mở',
    copy: 'Sao chép',
    copied: 'Đã sao chép',
    done: 'Xong',
    hide: 'Ẩn',
    hidden: 'Đã ẩn',
    showAgain: 'Hiện lại',
    saveError: 'Không lưu được thay đổi.',
    copyError: 'Không sao chép được.',
    untitledJob: 'Công việc chưa đặt tên',
    job: 'Công việc',
    bookingRequest: 'Yêu cầu đặt lịch',
    actions: {
      leadTitle: (name) => `Trả lời ${name}`,
      leadOldReason: 'Đã chờ 3 ngày',
      leadNewReason: 'Đã chờ 24 giờ',
      bookingTitle: (name) => `Xác nhận với ${name}`,
      bookingReason: 'Đang chờ xác nhận',
      jobTitle: (title) => `Kiểm tra ${title}`,
      jobReason: 'Công việc vẫn đang mở',
      followUpTitle: (title, name) => `Hỏi thăm ${name} về ${title}`,
      followUpReason: 'Đã hoàn tất 3 ngày',
      inquiryDraft: (name) => `Chào ${firstName(name, 'bạn')}, mình hỏi lại về yêu cầu của bạn. Bạn vẫn cần hỗ trợ chứ?`,
      bookingDraft: (name) => `Chào ${firstName(name, 'bạn')}, mình xác nhận lịch hẹn nhé?`,
      jobDraft: (name) => `Chào ${firstName(name, 'bạn')}, mình hỏi thăm về công việc của bạn. Nếu có câu hỏi cứ nhắn mình nhé.`,
      followUpDraft: (name) => `Chào ${firstName(name, 'bạn')}, cảm ơn bạn đã làm việc với bên mình. Mọi việc ổn chứ?`
    }
  }
};

export function getCatchCopy(locale: Locale): CatchCopy {
  return COPY[locale] || COPY.en;
}
