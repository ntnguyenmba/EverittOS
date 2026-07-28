import type { AskEverittSearchGroup, AskEverittSearchRecord, AskEverittSearchResponse } from '@/lib/ask-everitt/types';

export type AskEverittLocale = 'en' | 'es' | 'vi';

type LocalCopy = {
  sourceLabels: Record<string, string>;
  actionLabels: Record<string, string>;
  statusLabels: Record<string, string>;
  metricLabels: Record<string, string>;
  hints: Record<string, string>;
  generic: {
    askPrompt: string;
    found: (count: number) => string;
    noRecords: (query: string) => string;
    tryKeywords: (labels: string) => string;
    todaySchedule: (count: number) => string;
    noTodaySchedule: string;
    tomorrowJobs: (count: number, date: string) => string;
    noTomorrowJobs: (date: string) => string;
    weekJobs: (count: number) => string;
    noWeekJobs: string;
    overdueJobs: (count: number) => string;
    noOverdueJobs: string;
    leadsFollowUp: (count: number) => string;
    noLeadsFollowUp: string;
    bestCustomersEmpty: string;
    bestCustomers: (count: number) => string;
    businessBrief: (overdue: number, invoices: number, leads: number) => string;
    unpaidInvoices: (count: number) => string;
    noUnpaidInvoices: string;
    leadsMonth: (count: number) => string;
    noLeadsMonth: string;
    reviews: (count: number) => string;
    noReviews: string;
    photos: (count: number) => string;
    noPhotos: string;
    customersCity: (count: number, city: string) => string;
    noCustomersCity: (city: string) => string;
    noCustomersAnalyze: string;
    inactiveCustomers: (count: number) => string;
    noInactiveCustomers: string;
    topWorkerNone: string;
    topWorker: (name: string, count: number) => string;
    topTeamMember: (count: number) => string;
    revenueMonth: (amount: string) => string;
    expensesMonth: (amount: string, count: number) => string;
    sopMatches: (count: number) => string;
    onboardingDocs: (count: number) => string;
    noOnboardingDocs: string;
    activity: (count: number) => string;
    noActivity: string;
    noOutstandingBalances: string;
    customersOwe: (count: number) => string;
  };
};

const LOCAL_COPY: Record<AskEverittLocale, LocalCopy> = {
  en: {
    sourceLabels: { Leads: 'Requests' },
    actionLabels: { 'Open Lead': 'Open request' },
    statusLabels: { Lead: 'Request' },
    metricLabels: { 'Leads to review': 'Requests to review' },
    hints: {
      'New leads will appear here when their pipeline stage is lead or qualified.': 'New requests will appear here when someone asks about booking work.',
      'No urgent items found from jobs, invoices, or leads.': 'No urgent items found from jobs, invoices, or requests.'
    },
    generic: {
      askPrompt: 'Ask about customers, jobs, bookings, requests, invoices, or documents.',
      found: (count) => `Found ${count} record${count === 1 ? '' : 's'} across your workspace.`,
      noRecords: (query) => `No records found for "${query}".`,
      tryKeywords: (labels) => `Try keywords from: ${labels}.`,
      todaySchedule: (count) => `${count} item${count === 1 ? '' : 's'} on today's schedule.`,
      noTodaySchedule: 'Nothing is scheduled for today yet.',
      tomorrowJobs: (count, date) => `${count} job${count === 1 ? '' : 's'} scheduled for tomorrow (${date}).`,
      noTomorrowJobs: (date) => `No jobs scheduled for tomorrow (${date}).`,
      weekJobs: (count) => `${count} upcoming job${count === 1 ? '' : 's'} this week.`,
      noWeekJobs: 'No jobs scheduled this week.',
      overdueJobs: (count) => `${count} overdue job${count === 1 ? '' : 's'} need attention.`,
      noOverdueJobs: 'No overdue jobs found.',
      leadsFollowUp: (count) => `${count} request${count === 1 ? '' : 's'} need follow-up.`,
      noLeadsFollowUp: 'No open requests need follow-up right now.',
      bestCustomersEmpty: 'No best-customer ranking yet because no paid invoice history was found.',
      bestCustomers: (count) => `${count} top customer${count === 1 ? '' : 's'} by paid invoice history.`,
      businessBrief: (overdue, invoices, leads) => `Today: ${overdue} overdue job${overdue === 1 ? '' : 's'}, ${invoices} unpaid invoice${invoices === 1 ? '' : 's'}, and ${leads} request${leads === 1 ? '' : 's'} to review.`,
      unpaidInvoices: (count) => `${count} unpaid or outstanding invoice${count === 1 ? '' : 's'}.`,
      noUnpaidInvoices: 'No unpaid invoices found.',
      leadsMonth: (count) => `${count} request${count === 1 ? '' : 's'} added this month.`,
      noLeadsMonth: 'No new requests recorded this month.',
      reviews: (count) => `${count} recent review${count === 1 ? '' : 's'}.`,
      noReviews: 'No reviews found yet.',
      photos: (count) => `${count} job${count === 1 ? '' : 's'} with photos.`,
      noPhotos: 'No jobs with photos found.',
      customersCity: (count, city) => `${count} customer${count === 1 ? '' : 's'} in or near ${city}.`,
      noCustomersCity: (city) => `No customers found in ${city}.`,
      noCustomersAnalyze: 'No customers found to analyze.',
      inactiveCustomers: (count) => `${count} customer${count === 1 ? '' : 's'} with no jobs in the last 90 days.`,
      noInactiveCustomers: 'All active customers have had a job in the last 90 days.',
      topWorkerNone: 'No completed jobs with assigned workers this month.',
      topWorker: (name, count) => `${name} completed the most jobs this month (${count}).`,
      topTeamMember: (count) => `Top team member completed ${count} jobs this month.`,
      revenueMonth: (amount) => `Paid this month: ${amount}.`,
      expensesMonth: (amount, count) => `Expenses this month: ${amount} across ${count} recorded expense${count === 1 ? '' : 's'}.`,
      sopMatches: (count) => `${count} SOP, checklist, or document matches.`,
      onboardingDocs: (count) => `${count} onboarding-related document${count === 1 ? '' : 's'}.`,
      noOnboardingDocs: 'No onboarding documents found.',
      activity: (count) => `${count} recent activity update${count === 1 ? '' : 's'}.`,
      noActivity: 'No activity logged yet.',
      noOutstandingBalances: 'No customers with outstanding balances.',
      customersOwe: (count) => `${count} customer${count === 1 ? '' : 's'} with outstanding balances.`
    }
  },
  es: {
    sourceLabels: {
      Customers: 'Clientes', Leads: 'Solicitudes', Jobs: 'Trabajos', Schedule: 'Agenda', People: 'Personas', Reviews: 'Reseñas', Forms: 'Formularios', Templates: 'Plantillas', Documents: 'Documentos', SOPs: 'SOP', Notes: 'Notas', Invoices: 'Facturas', Expenses: 'Gastos', Revenue: 'Pagos', Photos: 'Fotos', Activity: 'Actividad', Bookings: 'Reservas', Services: 'Servicios', 'Staff availability': 'Disponibilidad del personal', Calendar: 'Calendario', 'Staff assignments': 'Asignaciones del personal', Results: 'Resultados'
    },
    actionLabels: {
      'Open Customer': 'Abrir cliente', 'Open Lead': 'Abrir solicitud', 'Open Job': 'Abrir trabajo', 'Open Schedule': 'Abrir agenda', 'Open Team': 'Abrir equipo', 'Open Review': 'Abrir reseña', 'Open Form': 'Abrir formulario', 'Open Template': 'Abrir plantilla', 'Open Document': 'Abrir documento', 'Open SOP': 'Abrir SOP', 'Open Note': 'Abrir nota', 'Open Invoice': 'Abrir factura', 'Open Expenses': 'Abrir gastos', 'View Revenue': 'Ver pagos', 'Open Activity': 'Abrir actividad', 'Open Booking': 'Abrir reserva', 'Open Service': 'Abrir servicio', 'View Availability': 'Ver disponibilidad', 'Open Calendar': 'Abrir calendario', 'View Assignments': 'Ver asignaciones'
    },
    statusLabels: {
      Lead: 'Solicitud', Overdue: 'Atrasado', 'Top customer': 'Cliente principal', 'Outstanding balance': 'Saldo pendiente', 'No booking in 90 days': 'Sin reserva en 90 días', Active: 'Activo', Inactive: 'Inactivo', Available: 'Disponible', Scheduled: 'Programado', 'Calendar synced': 'Calendario sincronizado', 'Staff assignment': 'Asignación de personal'
    },
    metricLabels: {
      'Overdue jobs': 'Trabajos atrasados', 'Unpaid invoices': 'Facturas sin pagar', 'Leads to review': 'Solicitudes por revisar', 'Revenue this month': 'Pagado este mes', 'Outstanding invoices': 'Facturas pendientes', 'Jobs completed': 'Trabajos completados', 'Active customers': 'Clientes activos', 'Total expenses this month': 'Gastos totales de este mes'
    },
    hints: {
      'Create a job or booking to build today’s schedule.': 'Cree un trabajo o una reserva para crear la agenda de hoy.',
      'Open these jobs and update the status, due date, or assignment.': 'Abra estos trabajos y actualice el estado, la fecha de vencimiento o la asignación.',
      'New leads will appear here when their pipeline stage is lead or qualified.': 'Las solicitudes nuevas aparecerán aquí cuando alguien pregunte por un servicio.',
      'Paid invoices will help EverittOS identify top customers.': 'Las facturas pagadas ayudan a EverittOS a identificar los mejores clientes.',
      'No urgent items found from jobs, invoices, or leads.': 'No se encontraron asuntos urgentes en trabajos, facturas o solicitudes.',
      'Add jobs with start or due dates.': 'Agregue trabajos con fecha de inicio o vencimiento.',
      'Upload before-and-after photos on job pages.': 'Suba fotos de antes y después en las páginas de trabajo.',
      'These customers may need a follow-up or reactivation campaign.': 'Estos clientes pueden necesitar seguimiento.',
      'Assign workers to jobs and mark jobs completed to track performance.': 'Asigne personas a trabajos y marque los trabajos completados.'
    },
    generic: {
      askPrompt: 'Pregunte sobre clientes, trabajos, reservas, solicitudes, facturas o documentos.',
      found: (count) => `Se encontraron ${count} registro${count === 1 ? '' : 's'} en su espacio.`,
      noRecords: (query) => `No se encontraron registros para "${query}".`,
      tryKeywords: (labels) => `Pruebe palabras clave de: ${labels}.`,
      todaySchedule: (count) => `${count} elemento${count === 1 ? '' : 's'} en la agenda de hoy.`,
      noTodaySchedule: 'Aún no hay nada programado para hoy.',
      tomorrowJobs: (count, date) => `${count} trabajo${count === 1 ? '' : 's'} programado${count === 1 ? '' : 's'} para mañana (${date}).`,
      noTomorrowJobs: (date) => `No hay trabajos programados para mañana (${date}).`,
      weekJobs: (count) => `${count} trabajo${count === 1 ? '' : 's'} próximo${count === 1 ? '' : 's'} esta semana.`,
      noWeekJobs: 'No hay trabajos programados esta semana.',
      overdueJobs: (count) => `${count} trabajo${count === 1 ? '' : 's'} atrasado${count === 1 ? '' : 's'} necesita${count === 1 ? '' : 'n'} atención.`,
      noOverdueJobs: 'No se encontraron trabajos atrasados.',
      leadsFollowUp: (count) => `${count} solicitud${count === 1 ? '' : 'es'} necesita${count === 1 ? '' : 'n'} seguimiento.`,
      noLeadsFollowUp: 'No hay solicitudes abiertas que necesiten seguimiento.',
      bestCustomersEmpty: 'Aún no hay ranking de mejores clientes porque no se encontró historial de facturas pagadas.',
      bestCustomers: (count) => `${count} cliente${count === 1 ? '' : 's'} principal${count === 1 ? '' : 'es'} por historial de facturas pagadas.`,
      businessBrief: (overdue, invoices, leads) => `Hoy: ${overdue} trabajo${overdue === 1 ? '' : 's'} atrasado${overdue === 1 ? '' : 's'}, ${invoices} factura${invoices === 1 ? '' : 's'} sin pagar y ${leads} solicitud${leads === 1 ? '' : 'es'} por revisar.`,
      unpaidInvoices: (count) => `${count} factura${count === 1 ? '' : 's'} sin pagar o pendiente${count === 1 ? '' : 's'}.`,
      noUnpaidInvoices: 'No se encontraron facturas sin pagar.',
      leadsMonth: (count) => `${count} solicitud${count === 1 ? '' : 'es'} agregada${count === 1 ? '' : 's'} este mes.`,
      noLeadsMonth: 'No se registraron solicitudes nuevas este mes.',
      reviews: (count) => `${count} reseña${count === 1 ? '' : 's'} reciente${count === 1 ? '' : 's'}.`,
      noReviews: 'Aún no se encontraron reseñas.',
      photos: (count) => `${count} trabajo${count === 1 ? '' : 's'} con fotos.`,
      noPhotos: 'No se encontraron trabajos con fotos.',
      customersCity: (count, city) => `${count} cliente${count === 1 ? '' : 's'} en o cerca de ${city}.`,
      noCustomersCity: (city) => `No se encontraron clientes en ${city}.`,
      noCustomersAnalyze: 'No se encontraron clientes para analizar.',
      inactiveCustomers: (count) => `${count} cliente${count === 1 ? '' : 's'} sin trabajos en los últimos 90 días.`,
      noInactiveCustomers: 'Todos los clientes activos tuvieron un trabajo en los últimos 90 días.',
      topWorkerNone: 'No hay trabajos completados con personas asignadas este mes.',
      topWorker: (name, count) => `${name} completó la mayor cantidad de trabajos este mes (${count}).`,
      topTeamMember: (count) => `El miembro principal del equipo completó ${count} trabajos este mes.`,
      revenueMonth: (amount) => `Pagado este mes: ${amount}.`,
      expensesMonth: (amount, count) => `Gastos de este mes: ${amount} en ${count} gasto${count === 1 ? '' : 's'} registrado${count === 1 ? '' : 's'}.`,
      sopMatches: (count) => `${count} coincidencia${count === 1 ? '' : 's'} de SOP, lista o documento.`,
      onboardingDocs: (count) => `${count} documento${count === 1 ? '' : 's'} relacionado${count === 1 ? '' : 's'} con incorporación.`,
      noOnboardingDocs: 'No se encontraron documentos de incorporación.',
      activity: (count) => `${count} actualizaci${count === 1 ? 'ón' : 'ones'} de actividad reciente.`,
      noActivity: 'Aún no hay actividad registrada.',
      noOutstandingBalances: 'No hay clientes con saldos pendientes.',
      customersOwe: (count) => `${count} cliente${count === 1 ? '' : 's'} con saldo${count === 1 ? '' : 's'} pendiente${count === 1 ? '' : 's'}.`
    }
  },
  vi: {
    sourceLabels: {
      Customers: 'Khách hàng', Leads: 'Yêu cầu', Jobs: 'Công việc', Schedule: 'Lịch', People: 'Mọi người', Reviews: 'Đánh giá', Forms: 'Biểu mẫu', Templates: 'Mẫu', Documents: 'Tài liệu', SOPs: 'SOP', Notes: 'Ghi chú', Invoices: 'Hóa đơn', Expenses: 'Chi phí', Revenue: 'Thanh toán', Photos: 'Ảnh', Activity: 'Hoạt động', Bookings: 'Đặt lịch', Services: 'Dịch vụ', 'Staff availability': 'Lịch rảnh của nhân sự', Calendar: 'Lịch', 'Staff assignments': 'Phân công nhân sự', Results: 'Kết quả'
    },
    actionLabels: {
      'Open Customer': 'Mở khách hàng', 'Open Lead': 'Mở yêu cầu', 'Open Job': 'Mở công việc', 'Open Schedule': 'Mở lịch', 'Open Team': 'Mở nhóm', 'Open Review': 'Mở đánh giá', 'Open Form': 'Mở biểu mẫu', 'Open Template': 'Mở mẫu', 'Open Document': 'Mở tài liệu', 'Open SOP': 'Mở SOP', 'Open Note': 'Mở ghi chú', 'Open Invoice': 'Mở hóa đơn', 'Open Expenses': 'Mở chi phí', 'View Revenue': 'Xem thanh toán', 'Open Activity': 'Mở hoạt động', 'Open Booking': 'Mở đặt lịch', 'Open Service': 'Mở dịch vụ', 'View Availability': 'Xem lịch rảnh', 'Open Calendar': 'Mở lịch', 'View Assignments': 'Xem phân công'
    },
    statusLabels: {
      Lead: 'Yêu cầu', Overdue: 'Quá hạn', 'Top customer': 'Khách hàng hàng đầu', 'Outstanding balance': 'Số dư còn nợ', 'No booking in 90 days': 'Chưa đặt lịch trong 90 ngày', Active: 'Đang hoạt động', Inactive: 'Không hoạt động', Available: 'Sẵn sàng', Scheduled: 'Đã lên lịch', 'Calendar synced': 'Đã đồng bộ lịch', 'Staff assignment': 'Phân công nhân sự'
    },
    metricLabels: {
      'Overdue jobs': 'Công việc quá hạn', 'Unpaid invoices': 'Hóa đơn chưa trả', 'Leads to review': 'Yêu cầu cần xem', 'Revenue this month': 'Đã nhận tháng này', 'Outstanding invoices': 'Hóa đơn còn nợ', 'Jobs completed': 'Công việc đã hoàn thành', 'Active customers': 'Khách hàng đang hoạt động', 'Total expenses this month': 'Tổng chi phí tháng này'
    },
    hints: {
      'Create a job or booking to build today’s schedule.': 'Tạo công việc hoặc lịch hẹn để có lịch hôm nay.',
      'Open these jobs and update the status, due date, or assignment.': 'Mở các công việc này và cập nhật trạng thái, hạn hoặc phân công.',
      'New leads will appear here when their pipeline stage is lead or qualified.': 'Yêu cầu mới sẽ xuất hiện ở đây khi có người hỏi về dịch vụ.',
      'Paid invoices will help EverittOS identify top customers.': 'Hóa đơn đã trả sẽ giúp EverittOS nhận diện khách hàng tốt nhất.',
      'No urgent items found from jobs, invoices, or leads.': 'Không tìm thấy việc khẩn cấp từ công việc, hóa đơn hoặc yêu cầu.',
      'Add jobs with start or due dates.': 'Thêm công việc có ngày bắt đầu hoặc ngày đến hạn.',
      'Upload before-and-after photos on job pages.': 'Tải ảnh trước và sau lên trang công việc.',
      'These customers may need a follow-up or reactivation campaign.': 'Những khách này có thể cần được liên hệ lại.',
      'Assign workers to jobs and mark jobs completed to track performance.': 'Phân công nhân sự và đánh dấu công việc đã hoàn thành.'
    },
    generic: {
      askPrompt: 'Hỏi về khách hàng, công việc, đặt lịch, yêu cầu, hóa đơn hoặc tài liệu.',
      found: (count) => `Tìm thấy ${count} bản ghi trong không gian làm việc.`,
      noRecords: (query) => `Không tìm thấy bản ghi cho "${query}".`,
      tryKeywords: (labels) => `Thử từ khóa từ: ${labels}.`,
      todaySchedule: (count) => `Có ${count} mục trong lịch hôm nay.`,
      noTodaySchedule: 'Hôm nay chưa có lịch.',
      tomorrowJobs: (count, date) => `Có ${count} công việc đã lên lịch cho ngày mai (${date}).`,
      noTomorrowJobs: (date) => `Không có công việc nào cho ngày mai (${date}).`,
      weekJobs: (count) => `Có ${count} công việc sắp tới trong tuần này.`,
      noWeekJobs: 'Tuần này chưa có công việc nào.',
      overdueJobs: (count) => `Có ${count} công việc quá hạn cần chú ý.`,
      noOverdueJobs: 'Không tìm thấy công việc quá hạn.',
      leadsFollowUp: (count) => `Có ${count} yêu cầu cần theo dõi.`,
      noLeadsFollowUp: 'Hiện không có yêu cầu mở cần theo dõi.',
      bestCustomersEmpty: 'Chưa có xếp hạng khách hàng tốt nhất vì chưa có lịch sử hóa đơn đã trả.',
      bestCustomers: (count) => `${count} khách hàng hàng đầu theo lịch sử hóa đơn đã trả.`,
      businessBrief: (overdue, invoices, leads) => `Hôm nay: ${overdue} công việc quá hạn, ${invoices} hóa đơn chưa trả và ${leads} yêu cầu cần xem.`,
      unpaidInvoices: (count) => `${count} hóa đơn chưa trả hoặc còn nợ.`,
      noUnpaidInvoices: 'Không tìm thấy hóa đơn chưa trả.',
      leadsMonth: (count) => `${count} yêu cầu được thêm trong tháng này.`,
      noLeadsMonth: 'Tháng này chưa ghi nhận yêu cầu mới.',
      reviews: (count) => `${count} đánh giá gần đây.`,
      noReviews: 'Chưa tìm thấy đánh giá.',
      photos: (count) => `${count} công việc có ảnh.`,
      noPhotos: 'Không tìm thấy công việc có ảnh.',
      customersCity: (count, city) => `${count} khách hàng ở hoặc gần ${city}.`,
      noCustomersCity: (city) => `Không tìm thấy khách hàng ở ${city}.`,
      noCustomersAnalyze: 'Không tìm thấy khách hàng để phân tích.',
      inactiveCustomers: (count) => `${count} khách hàng không có công việc trong 90 ngày qua.`,
      noInactiveCustomers: 'Tất cả khách hàng đang hoạt động đã có công việc trong 90 ngày qua.',
      topWorkerNone: 'Tháng này chưa có công việc đã hoàn thành với nhân sự được phân công.',
      topWorker: (name, count) => `${name} hoàn thành nhiều công việc nhất tháng này (${count}).`,
      topTeamMember: (count) => `Thành viên nổi bật nhất đã hoàn thành ${count} công việc tháng này.`,
      revenueMonth: (amount) => `Đã nhận tháng này: ${amount}.`,
      expensesMonth: (amount, count) => `Chi phí tháng này: ${amount} trong ${count} khoản chi đã ghi nhận.`,
      sopMatches: (count) => `${count} kết quả SOP, checklist hoặc tài liệu.`,
      onboardingDocs: (count) => `${count} tài liệu liên quan đến onboarding.`,
      noOnboardingDocs: 'Không tìm thấy tài liệu onboarding.',
      activity: (count) => `${count} hoạt động gần đây.`,
      noActivity: 'Chưa có hoạt động được ghi lại.',
      noOutstandingBalances: 'Không có khách hàng còn nợ.',
      customersOwe: (count) => `${count} khách hàng còn số dư phải thu.`
    }
  }
};

function localCopy(locale: AskEverittLocale): LocalCopy {
  return LOCAL_COPY[locale] || LOCAL_COPY.en;
}

function localizeSourceLabels(labels: string, copy: LocalCopy): string {
  return labels
    .split(', ')
    .map((label) => copy.sourceLabels[label] || label)
    .join(', ');
}

function localizeSummary(summary: string, copy: LocalCopy): string {
  let m = summary.match(/^Found (\d+) records? across your workspace\.$/);
  if (m) return copy.generic.found(Number(m[1]));
  m = summary.match(/^No records found for "(.+)"\.$/);
  if (m) return copy.generic.noRecords(m[1]);
  m = summary.match(/^(\d+) items? on today's schedule\.$/);
  if (m) return copy.generic.todaySchedule(Number(m[1]));
  if (summary === 'Nothing is scheduled for today yet.') return copy.generic.noTodaySchedule;
  m = summary.match(/^(\d+) jobs? scheduled for tomorrow \((.+)\)\.$/);
  if (m) return copy.generic.tomorrowJobs(Number(m[1]), m[2]);
  m = summary.match(/^No jobs scheduled for tomorrow \((.+)\)\.$/);
  if (m) return copy.generic.noTomorrowJobs(m[1]);
  m = summary.match(/^(\d+) upcoming jobs? this week\.$/);
  if (m) return copy.generic.weekJobs(Number(m[1]));
  if (summary === 'No jobs scheduled this week.') return copy.generic.noWeekJobs;
  m = summary.match(/^(\d+) overdue jobs? need attention\.$/);
  if (m) return copy.generic.overdueJobs(Number(m[1]));
  if (summary === 'No overdue jobs found.') return copy.generic.noOverdueJobs;
  m = summary.match(/^(\d+) (?:leads?|requests?) (?:should be reviewed for follow-up|need follow-up)\.$/);
  if (m) return copy.generic.leadsFollowUp(Number(m[1]));
  if (summary === 'No open leads need follow-up right now.' || summary === 'No open requests need follow-up right now.') return copy.generic.noLeadsFollowUp;
  if (summary === 'No best-customer ranking yet because no paid invoice history was found.') return copy.generic.bestCustomersEmpty;
  m = summary.match(/^(\d+) top customers? by paid invoice history\.$/);
  if (m) return copy.generic.bestCustomers(Number(m[1]));
  m = summary.match(/^(?:Today[’']s business brief|Today): (\d+) overdue jobs?, (\d+) unpaid invoices?, and (\d+) (?:leads?|requests?) to review\.$/);
  if (m) return copy.generic.businessBrief(Number(m[1]), Number(m[2]), Number(m[3]));
  m = summary.match(/^(\d+) unpaid or outstanding invoices?\.$/);
  if (m) return copy.generic.unpaidInvoices(Number(m[1]));
  if (summary === 'No unpaid invoices found.') return copy.generic.noUnpaidInvoices;
  m = summary.match(/^(\d+) (?:leads?|requests?) added this month\.$/);
  if (m) return copy.generic.leadsMonth(Number(m[1]));
  if (summary === 'No new leads recorded this month.' || summary === 'No new requests recorded this month.') return copy.generic.noLeadsMonth;
  m = summary.match(/^(\d+) recent reviews?\.$/);
  if (m) return copy.generic.reviews(Number(m[1]));
  if (summary === 'No reviews found yet.') return copy.generic.noReviews;
  if (summary === 'No jobs with photos found.') return copy.generic.noPhotos;
  m = summary.match(/^(\d+) jobs? with photos\.$/);
  if (m) return copy.generic.photos(Number(m[1]));
  m = summary.match(/^(\d+) customers? in or near (.+)\.$/);
  if (m) return copy.generic.customersCity(Number(m[1]), m[2]);
  m = summary.match(/^No customers found in (.+)\.$/);
  if (m) return copy.generic.noCustomersCity(m[1]);
  if (summary === 'No customers found to analyze.') return copy.generic.noCustomersAnalyze;
  m = summary.match(/^(\d+) customers? with no jobs in the last 90 days\.$/);
  if (m) return copy.generic.inactiveCustomers(Number(m[1]));
  if (summary === 'All active customers have had a job in the last 90 days.') return copy.generic.noInactiveCustomers;
  if (summary === 'No completed jobs with assigned workers this month.') return copy.generic.topWorkerNone;
  m = summary.match(/^(.+) completed the most jobs this month \((\d+)\)\.$/);
  if (m) return copy.generic.topWorker(m[1], Number(m[2]));
  m = summary.match(/^Top team member completed (\d+) jobs this month\.$/);
  if (m) return copy.generic.topTeamMember(Number(m[1]));
  m = summary.match(/^(?:Revenue|Paid) this month: (.+)\.$/);
  if (m) return copy.generic.revenueMonth(m[1]);
  m = summary.match(/^Expenses this month: (.+) across (\d+) recorded expenses?\.$/);
  if (m) return copy.generic.expensesMonth(m[1], Number(m[2]));
  m = summary.match(/^(\d+) SOP, checklist, or document matches\.$/);
  if (m) return copy.generic.sopMatches(Number(m[1]));
  m = summary.match(/^(\d+) onboarding-related documents?\.$/);
  if (m) return copy.generic.onboardingDocs(Number(m[1]));
  if (summary === 'No onboarding documents found.') return copy.generic.noOnboardingDocs;
  m = summary.match(/^(\d+) recent activity updates?\.$/);
  if (m) return copy.generic.activity(Number(m[1]));
  m = summary.match(/^(\d+) recent activity entries\.$/);
  if (m) return copy.generic.activity(Number(m[1]));
  if (summary === 'No activity logged yet.') return copy.generic.noActivity;
  if (summary === 'No customers with outstanding balances.') return copy.generic.noOutstandingBalances;
  m = summary.match(/^(\d+) customers? with outstanding balances\.$/);
  if (m) return copy.generic.customersOwe(Number(m[1]));
  if (summary === 'Ask about customers, jobs, bookings, leads, invoices, or documents.' || summary === LOCAL_COPY.en.generic.askPrompt) return copy.generic.askPrompt;
  return summary;
}

function localizeText(value: string | null, map: Record<string, string>): string | null {
  if (!value) return value;
  if (map[value]) return map[value];
  return value;
}

function localizeRecord(record: AskEverittSearchRecord, copy: LocalCopy): AskEverittSearchRecord {
  return {
    ...record,
    actionLabel: copy.actionLabels[record.actionLabel] || record.actionLabel,
    status: localizeText(record.status, copy.statusLabels),
    subtitle: localizeText(record.subtitle, copy.statusLabels),
    owner: record.owner === 'Assigned crew' ? copy.statusLabels['Staff assignment'] || record.owner : record.owner
  };
}

function localizeGroup(group: AskEverittSearchGroup, copy: LocalCopy): AskEverittSearchGroup {
  return {
    ...group,
    label: copy.sourceLabels[group.label] || group.label,
    results: group.results.map((record) => localizeRecord(record, copy))
  };
}

export function localizeAskEverittSearchResponse(
  payload: AskEverittSearchResponse,
  locale: AskEverittLocale
): AskEverittSearchResponse {
  const copy = localCopy(locale);
  const results = payload.results.map((record) => localizeRecord(record, copy));
  return {
    ...payload,
    summary: localizeSummary(payload.summary, copy),
    results,
    groups: payload.groups?.map((group) => localizeGroup(group, copy)),
    metrics: payload.metrics?.map((metric) => ({
      ...metric,
      label: copy.metricLabels[metric.label] || metric.label
    })),
    noResultsHint: payload.noResultsHint
      ? copy.hints[payload.noResultsHint] ||
        (payload.noResultsHint.startsWith('Try keywords from: ')
          ? copy.generic.tryKeywords(localizeSourceLabels(payload.noResultsHint.replace(/^Try keywords from: |\.$/g, ''), copy))
          : payload.noResultsHint)
      : payload.noResultsHint
  };
}
