export type RecurrenceCopy = {
  scheduleHeading: string;
  scheduleType: string;
  oneTime: string;
  daily: string;
  weekly: string;
  everyTwoWeeks: string;
  everyThreeWeeks: string;
  everyFourWeeks: string;
  monthly: string;
  custom: string;
  startsOn: string;
  startTime: string;
  endTime: string;
  weekdays: string;
  weekday: string;
  weekdaysHelp: string;
  every: string;
  unit: string;
  days: string;
  weeks: string;
  months: string;
  ends: string;
  neverEnds: string;
  endsOnDate: string;
  endsAfterCount: string;
  endDate: string;
  occurrenceCount: string;
  jobTimezone: string;
  companyDefaultTimezone: string;
  timezoneHelp: string;
  advanced: string;
  windowHelp: string;
  startDateRequired: string;
  selectStartDate: string;
  selectStartDateToPreview: string;
  selectWeekday: string;
  endDateRequired: string;
  endDateBeforeStart: string;
  occurrenceCountRequired: string;
  startTimeRequired: string;
  summaryLabel: string;
  recurringSeries: string;
  perVisit: string;
};

const en: RecurrenceCopy = {
  scheduleHeading: '4. Schedule',
  scheduleType: 'Repeats',
  oneTime: 'Does not repeat',
  daily: 'Daily',
  weekly: 'Weekly',
  everyTwoWeeks: 'Every 2 weeks',
  everyThreeWeeks: 'Every 3 weeks',
  everyFourWeeks: 'Every 4 weeks',
  monthly: 'Monthly',
  custom: 'Custom',
  startsOn: 'Starts on',
  startTime: 'Start time',
  endTime: 'End time',
  weekdays: 'Weekdays',
  weekday: 'Weekday',
  weekdaysHelp: 'Choose one or more weekdays for this schedule.',
  every: 'Every',
  unit: 'Unit',
  days: 'Days',
  weeks: 'Weeks',
  months: 'Months',
  ends: 'Ends',
  neverEnds: 'Never',
  endsOnDate: 'On date',
  endsAfterCount: 'After number of visits',
  endDate: 'End date',
  occurrenceCount: 'Number of visits',
  jobTimezone: 'Job timezone',
  companyDefaultTimezone: 'Use company default',
  timezoneHelp: 'Filled from the property address when available. You can change it.',
  advanced: 'Advanced options',
  windowHelp: 'The next 365 days are kept scheduled ahead. More visits are added automatically as time passes.',
  startDateRequired: 'Select a start date.',
  selectStartDate: 'Select a start date',
  selectStartDateToPreview: 'Select a start date to preview this recurring schedule.',
  selectWeekday: 'Select at least one weekday.',
  endDateRequired: 'Select an end date.',
  endDateBeforeStart: 'End date must be on or after the start date.',
  occurrenceCountRequired: 'Enter a number of visits of at least 1.',
  startTimeRequired: 'Select a start time.',
  summaryLabel: 'Schedule summary',
  recurringSeries: 'Recurring series',
  perVisit: 'Per visit'
};

const es: RecurrenceCopy = {
  scheduleHeading: '4. Horario',
  scheduleType: 'Se repite',
  oneTime: 'No se repite',
  daily: 'Diario',
  weekly: 'Semanal',
  everyTwoWeeks: 'Cada 2 semanas',
  everyThreeWeeks: 'Cada 3 semanas',
  everyFourWeeks: 'Cada 4 semanas',
  monthly: 'Mensual',
  custom: 'Personalizado',
  startsOn: 'Comienza el',
  startTime: 'Hora de inicio',
  endTime: 'Hora de fin',
  weekdays: 'Días de la semana',
  weekday: 'Día de la semana',
  weekdaysHelp: 'Elija uno o más días de la semana para este horario.',
  every: 'Cada',
  unit: 'Unidad',
  days: 'Días',
  weeks: 'Semanas',
  months: 'Meses',
  ends: 'Termina',
  neverEnds: 'Nunca',
  endsOnDate: 'En una fecha',
  endsAfterCount: 'Después de un número de visitas',
  endDate: 'Fecha de fin',
  occurrenceCount: 'Número de visitas',
  jobTimezone: 'Zona horaria del trabajo',
  companyDefaultTimezone: 'Usar valor predeterminado de la empresa',
  timezoneHelp: 'Se completa desde la dirección de la propiedad cuando está disponible. Puede cambiarla.',
  advanced: 'Opciones avanzadas',
  windowHelp: 'Se mantienen programados los próximos 365 días. Se añaden más visitas automáticamente con el tiempo.',
  startDateRequired: 'Seleccione una fecha de inicio.',
  selectStartDate: 'Seleccione una fecha de inicio',
  selectStartDateToPreview: 'Seleccione una fecha de inicio para previsualizar este horario recurrente.',
  selectWeekday: 'Seleccione al menos un día de la semana.',
  endDateRequired: 'Seleccione una fecha de fin.',
  endDateBeforeStart: 'La fecha de fin debe ser igual o posterior a la fecha de inicio.',
  occurrenceCountRequired: 'Ingrese un número de visitas de al menos 1.',
  startTimeRequired: 'Seleccione una hora de inicio.',
  summaryLabel: 'Resumen del horario',
  recurringSeries: 'Serie recurrente',
  perVisit: 'Por visita'
};

const vi: RecurrenceCopy = {
  scheduleHeading: '4. Lịch trình',
  scheduleType: 'Lặp lại',
  oneTime: 'Không lặp lại',
  daily: 'Hàng ngày',
  weekly: 'Hàng tuần',
  everyTwoWeeks: 'Mỗi 2 tuần',
  everyThreeWeeks: 'Mỗi 3 tuần',
  everyFourWeeks: 'Mỗi 4 tuần',
  monthly: 'Hàng tháng',
  custom: 'Tùy chỉnh',
  startsOn: 'Bắt đầu vào',
  startTime: 'Giờ bắt đầu',
  endTime: 'Giờ kết thúc',
  weekdays: 'Các ngày trong tuần',
  weekday: 'Ngày trong tuần',
  weekdaysHelp: 'Chọn một hoặc nhiều ngày trong tuần cho lịch này.',
  every: 'Mỗi',
  unit: 'Đơn vị',
  days: 'Ngày',
  weeks: 'Tuần',
  months: 'Tháng',
  ends: 'Kết thúc',
  neverEnds: 'Không bao giờ',
  endsOnDate: 'Vào ngày',
  endsAfterCount: 'Sau số lần ghé thăm',
  endDate: 'Ngày kết thúc',
  occurrenceCount: 'Số lần ghé thăm',
  jobTimezone: 'Múi giờ công việc',
  companyDefaultTimezone: 'Dùng mặc định của công ty',
  timezoneHelp: 'Được điền từ địa chỉ bất động sản khi có. Bạn có thể thay đổi.',
  advanced: 'Tùy chọn nâng cao',
  windowHelp: '365 ngày tiếp theo được giữ trên lịch. Các lần ghé thăm khác được thêm tự động theo thời gian.',
  startDateRequired: 'Hãy chọn ngày bắt đầu.',
  selectStartDate: 'Chọn ngày bắt đầu',
  selectStartDateToPreview: 'Hãy chọn ngày bắt đầu để xem trước lịch định kỳ này.',
  selectWeekday: 'Hãy chọn ít nhất một ngày trong tuần.',
  endDateRequired: 'Hãy chọn ngày kết thúc.',
  endDateBeforeStart: 'Ngày kết thúc phải vào hoặc sau ngày bắt đầu.',
  occurrenceCountRequired: 'Nhập số lần ghé thăm ít nhất là 1.',
  startTimeRequired: 'Hãy chọn giờ bắt đầu.',
  summaryLabel: 'Tóm tắt lịch trình',
  recurringSeries: 'Chuỗi định kỳ',
  perVisit: 'Mỗi lần'
};

export function getRecurrenceCopy(locale?: string | null): RecurrenceCopy {
  const value = String(locale || 'en').toLowerCase();
  if (value.startsWith('es')) return es;
  if (value.startsWith('vi')) return vi;
  return en;
}

export function recurrenceLocaleTag(locale?: string | null): string {
  const value = String(locale || 'en').toLowerCase();
  if (value.startsWith('es')) return 'es';
  if (value.startsWith('vi')) return 'vi';
  return 'en-US';
}
