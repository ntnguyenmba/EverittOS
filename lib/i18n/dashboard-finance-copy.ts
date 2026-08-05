import { normalizeLocale, type Locale } from '@/lib/i18n/config';
import type { DashboardDateRange } from '@/lib/dashboard-metrics';
import type { DashboardDetailMetric } from '@/lib/dashboard-metric-details';

export type DashboardFinanceCopy = {
  ranges: Record<DashboardDateRange, string>;
  metricTitles: Record<DashboardDetailMetric, string>;
  formulas: Record<DashboardDetailMetric, string>;
  details: {
    titleFallback: string;
    subtitle: string;
    exactTotal: string;
    empty: string;
    tryAgain: string;
    unknownMetric: string;
    loadError: string;
    loading: string;
  };
  overview: {
    title: string;
    subtitle: string;
    periodLabel: string;
    moneySummaryTitle: string;
    moreDetails: string;
    hideDetails: string;
    loadError: string;
    missingCompletedAtWarning: string;
    fixJob: string;
  };
  money: {
    expectedRevenue: string;
    expectedRevenueHelp: string;
    collected: string;
    collectedHelp: string;
    outstanding: string;
    outstandingHelp: string;
    invoiced: string;
    invoicedHelp: string;
    netCash: string;
    netCashHelp: string;
    latePayments: string;
    latePaymentsHelp: string;
    lateInvoices: string;
    unpaidInvoices: string;
    unpaidInvoicesHelp: string;
    averageDays: string;
    averageDaysNone: string;
    averageDaysHelp: string;
    averageDaysHelpEmpty: string;
    contractorCost: string;
    contractorCostHelp: string;
    contractorPay: string;
    contractorPayHelp: string;
    contractorPayOwed: string;
    contractorPayOwedHelp: string;
    contractorPayPending: string;
    contractorPayPendingHelp: string;
    contractorPayPaid: string;
    contractorPayPaidHelp: string;
    otherExpenses: string;
    otherExpensesHelp: string;
    expectedProfit: string;
    expectedProfitHelp: string;
    cashAfterCosts: string;
    cashAfterCostsHelp: string;
    expectedProfitPct: string;
    expectedProfitPctHelp: string;
    costsMissing: string;
    uninvoicedWork: string;
    uninvoicedWorkHelp: string;
    paymentsMissingDates: string;
    paymentsMissingDatesHelp: string;
    completedJobs: string;
    completedJobsHelp: string;
    jobs: string;
    jobsHelp: string;
    activeCustomers: string;
    activeCustomersHelp: string;
    bookings: string;
    messages: string;
    reports: string;
    current: string;
    days: string;
  };
  contractorPayPage: {
    title: string;
    subtitle: string;
    privacyNotice: string;
    permissionDenied: string;
    stillOwed: string;
    pending: string;
    paid: string;
    allPayments: string;
    statusPayments: string;
    changesHint: string;
    showAll: string;
    refresh: string;
    refreshing: string;
    loading: string;
    empty: string;
    openJob: string;
    markPending: string;
    markPaid: string;
    updateError: string;
    markedPaid: string;
    markedStatus: string;
    unnamed: string;
    jobFallback: string;
    contractorOrCleaner: string;
    contractorNamePlaceholder: string;
    paymentMethodLabel: string;
    reviewPayment: string;
    addAnotherPayment: string;
    flatRate: string;
    hourly: string;
    amount: string;
    hours: string;
    hourlyRate: string;
    calculatedTotal: string;
    notesOptional: string;
    initializeFromJob: string;
    added: string;
    updated: string;
    removed: string;
    duplicated: string;
  };
};

const en: DashboardFinanceCopy = {
  ranges: {
    today: 'Today',
    week: 'This week',
    month: 'This month',
    quarter: 'This quarter',
    year: 'This year',
    last_year: 'Last year',
    all_time: 'All time'
  },
  metricTitles: {
    collected: 'Collected',
    invoiced: 'Invoiced',
    outstanding: 'Outstanding',
    late: 'Late payments',
    'unpaid-invoices': 'Unpaid invoices',
    'net-cash': 'Cash after paid costs',
    'estimated-profit': 'Expected profit',
    'contractor-pay': 'Contractor cost',
    'contractor-pay-owed': 'Contractor pay owed',
    'contractor-pay-pending': 'Contractor pay pending',
    expenses: 'Expenses',
    'completed-jobs': 'Completed jobs',
    jobs: 'Jobs',
    'active-customers': 'Active customers'
  },
  formulas: {
    collected:
      'Money received = invoice payments + direct job payments in the selected period. The same payment is never counted twice.',
    invoiced: 'Invoiced = collectible invoice totals created in the selected period.',
    outstanding:
      'Customers owe = remaining unpaid invoice balances plus unpaid direct jobs without invoices.',
    late: 'Late = unpaid invoice balances past their due date.',
    'unpaid-invoices': 'Unpaid invoices = invoices with a remaining balance.',
    'net-cash':
      'Money kept = money received minus paid contractors minus business expenses.',
    'estimated-profit':
      'Profit = job revenue minus contractor costs minus business expenses. Job revenue = money received + customers owe.',
    'contractor-pay': 'Contractor costs = labor totals for jobs in the selected period.',
    'contractor-pay-owed': 'Contractor pay owed = labor still marked unpaid.',
    'contractor-pay-pending': 'Contractor pay pending = labor marked pending.',
    expenses: 'Business expenses = expense amounts with dates in the selected period.',
    'completed-jobs':
      'Completed jobs counted by completed_at when present, or by start/scheduled date as a legacy fallback.',
    jobs: 'Jobs counted by operational work date in the selected period.',
    'active-customers':
      'Active customers = customer records with stage Active. Blank stage counts as active unless past, inactive, archived, or cancelled.'
  },
  details: {
    titleFallback: 'Metric details',
    subtitle: 'See the records behind each dashboard total.',
    exactTotal: 'Exact total',
    empty: 'No records in this period.',
    tryAgain: 'Try again',
    unknownMetric: 'Unknown dashboard metric.',
    loadError: 'Unable to load metric details.',
    loading: 'Loading…'
  },
  overview: {
    title: 'Business overview',
    subtitle: 'Period metrics for the selected range. Lifetime balances are listed separately.',
    periodLabel: 'Dashboard period',
    moneySummaryTitle: 'Money summary',
    moreDetails: 'More details',
    hideDetails: 'Hide details',
    loadError: 'Some financial totals could not be loaded. Refresh and try again.',
    missingCompletedAtWarning: '{count} completed jobs are missing completion dates',
    fixJob: 'Fix job'
  },
  money: {
    expectedRevenue: 'Job revenue',
    expectedRevenueHelp:
      'Money received plus money customers still owe for the selected period.',
    collected: 'Money received',
    collectedHelp:
      'Customer payments actually received in this period from the invoice payment ledger and direct job payment ledger.',
    outstanding: 'Customers owe',
    outstandingHelp:
      'Remaining unpaid invoice balances plus unpaid direct jobs without invoices for the selected period.',
    invoiced: 'Invoiced',
    invoicedHelp: 'Total of non-cancelled invoices created during this period.',
    netCash: 'Money kept',
    netCashHelp:
      'Money received minus paid contractors minus business expenses.',
    latePayments: 'Late payments',
    latePaymentsHelp: 'Current unpaid invoice balances that are past their due dates.',
    lateInvoices: 'Late invoices',
    unpaidInvoices: 'Unpaid invoices',
    unpaidInvoicesHelp: 'Count of non-cancelled invoices with a remaining balance.',
    averageDays: 'Average time to get paid',
    averageDaysNone: 'No fully paid invoices yet',
    averageDaysHelp:
      'Average number of days from invoice date to recorded payment date for fully paid invoices in the selected period.',
    averageDaysHelpEmpty:
      'This appears after at least one invoice has an invoice date, is fully paid, and has a recorded payment date.',
    contractorCost: 'Contractor costs',
    contractorCostHelp: 'Total labor cost for jobs in this period, paid or unpaid.',
    contractorPay: 'Contractor costs',
    contractorPayHelp: 'Total labor cost for jobs in this period, paid or unpaid.',
    contractorPayOwed: 'Contractor pay owed',
    contractorPayOwedHelp: 'Unpaid contractor labor for jobs attributed to the selected period.',
    contractorPayPending: 'Contractor pay pending',
    contractorPayPendingHelp: 'Contractor pay marked pending but not yet marked paid.',
    contractorPayPaid: 'Paid contractors',
    contractorPayPaidHelp: 'Contractor payments actually marked paid in this period (by paid_at).',
    otherExpenses: 'Business expenses',
    otherExpensesHelp: 'Recorded business expenses dated in the selected period.',
    expectedProfit: 'Profit',
    expectedProfitHelp:
      'Profit = Job revenue − Contractor costs − Business expenses.',
    cashAfterCosts: 'Money kept',
    cashAfterCostsHelp: 'Money received minus paid contractors minus business expenses.',
    expectedProfitPct: 'Profit percentage',
    expectedProfitPctHelp: 'Profit divided by job revenue for this period.',
    costsMissing: 'Only recorded costs are included.',
    uninvoicedWork: 'Uninvoiced expected revenue',
    uninvoicedWorkHelp:
      'Expected job revenue that has not been invoiced. Shown for detail only; job revenue uses money received + customers owe.',
    paymentsMissingDates: 'Payments missing dates',
    paymentsMissingDatesHelp:
      'Invoices with a paid amount but no payment date. Add the payment date so period totals and payment speed are accurate.',
    completedJobs: 'Completed jobs',
    completedJobsHelp:
      'Jobs marked completed in the selected period. Uses completed_at, or start/scheduled date when completion date is missing.',
    jobs: 'Jobs',
    jobsHelp:
      'Jobs scheduled, started, or completed in the selected period. Record entry dates are not counted.',
    activeCustomers: 'Active customers',
    activeCustomersHelp:
      'Customers with stage Active. Blank stage counts as active. Leads, past, inactive, cancelled, and archived records are not counted.',
    bookings: 'Bookings',
    messages: 'Messages',
    reports: 'Reports',
    current: 'Current',
    days: 'days'
  },
  contractorPayPage: {
    title: 'Team Pay',
    subtitle: 'Review contractor and employee payments linked to jobs.',
    privacyNotice:
      'Private company financial information. Only owners, managers, and authorized employees can view or manage team pay. Contractors and customers cannot see this section.',
    permissionDenied: 'Only owners, admins, and managers with financial access can view team pay.',
    stillOwed: 'Still owed',
    pending: 'Pending',
    paid: 'Paid',
    allPayments: 'All team payments',
    statusPayments: '{status} team payments',
    changesHint: 'Changes here automatically update the dashboard totals.',
    showAll: 'Show all',
    refresh: 'Refresh',
    refreshing: 'Refreshing…',
    loading: 'Loading team payments…',
    empty: 'No team payments match this status.',
    openJob: 'Open job',
    markPending: 'Mark pending',
    markPaid: 'Mark paid',
    updateError: 'Unable to update team payment.',
    markedPaid: 'Team payment marked paid.',
    markedStatus: 'Team payment marked {status}.',
    unnamed: 'Unassigned contractor',
    jobFallback: 'Job',
    contractorOrCleaner: 'Team member',
    contractorNamePlaceholder: 'Team member name',
    paymentMethodLabel: 'Payment method',
    reviewPayment: 'Review payment',
    addAnotherPayment: 'Add another payment',
    flatRate: 'Flat rate',
    hourly: 'Hourly',
    amount: 'Amount',
    hours: 'Hours',
    hourlyRate: 'Hourly rate',
    calculatedTotal: 'Calculated total',
    notesOptional: 'Notes (optional)',
    initializeFromJob: 'Payment details were filled from this job.',
    added: 'Team payment added.',
    updated: 'Team payment updated.',
    removed: 'Team payment removed.',
    duplicated: 'Team payment duplicated.'
  }
};

const es: DashboardFinanceCopy = {
  ...en,
  ranges: {
    today: 'Hoy',
    week: 'Esta semana',
    month: 'Este mes',
    quarter: 'Este trimestre',
    year: 'Este año',
    last_year: 'El año pasado',
    all_time: 'Todo el tiempo'
  },
  metricTitles: {
    collected: 'Cobrado',
    invoiced: 'Facturado',
    outstanding: 'Pendiente',
    late: 'Pagos atrasados',
    'unpaid-invoices': 'Facturas sin pagar',
    'net-cash': 'Efectivo después de costos pagados',
    'estimated-profit': 'Ganancia esperada',
    'contractor-pay': 'Costo de contratistas',
    'contractor-pay-owed': 'Pago a contratistas adeudado',
    'contractor-pay-pending': 'Pago a contratistas pendiente',
    expenses: 'Gastos',
    'completed-jobs': 'Trabajos completados',
    jobs: 'Trabajos',
    'active-customers': 'Clientes activos'
  },
  formulas: {
    collected:
      'Cobrado = pagos de facturas + pagos directos del trabajo en el período. El mismo pago nunca se cuenta dos veces.',
    invoiced: 'Facturado = totales de facturas no canceladas creadas en el período.',
    outstanding:
      'Pendiente = saldos de facturas sin pagar + montos esperados de trabajos sin factura menos pagos directos.',
    late: 'Atrasado = saldos de facturas sin pagar después de la fecha de vencimiento.',
    'unpaid-invoices': 'Facturas sin pagar = facturas con saldo restante.',
    'net-cash':
      'Efectivo después de costos pagados = pagos recibidos menos pagos a contratistas pagados menos gastos pagados.',
    'estimated-profit':
      'Ganancia esperada = ingresos esperados menos costo de contratistas menos otros gastos registrados.',
    'contractor-pay': 'Costo de contratistas = totales de mano de obra registrados en el período.',
    'contractor-pay-owed': 'Adeudado = mano de obra aún marcada como no pagada.',
    'contractor-pay-pending': 'Pendiente = mano de obra marcada como pendiente.',
    expenses: 'Gastos = montos con fecha en el período seleccionado.',
    'completed-jobs':
      'Trabajos completados contados por completed_at, o por fecha de inicio/programada como respaldo.',
    jobs: 'Trabajos contados por la fecha operativa en el período seleccionado.',
    'active-customers':
      'Clientes activos = registros con etapa Activo. Etapa en blanco cuenta como activo, salvo pasado, inactivo, archivado o cancelado.'
  },
  details: {
    titleFallback: 'Detalle de métrica',
    subtitle: 'Vea los registros detrás de cada total del panel.',
    exactTotal: 'Total exacto',
    empty: 'No hay registros en este período.',
    tryAgain: 'Intentar de nuevo',
    unknownMetric: 'Métrica del panel desconocida.',
    loadError: 'No se pudo cargar el detalle de la métrica.',
    loading: 'Cargando…'
  },
  overview: {
    title: 'Resumen del negocio',
    subtitle: 'Dinero recibido, dinero adeudado y costos reales.',
    periodLabel: 'Período del panel',
    moneySummaryTitle: 'Resumen de dinero',
    moreDetails: 'Más detalles',
    hideDetails: 'Ocultar detalles',
    loadError: 'Algunos totales financieros no se pudieron cargar. Actualice e intente de nuevo.',
    missingCompletedAtWarning: '{count} trabajos completados no tienen fecha de finalización',
    fixJob: 'Corregir trabajo'
  },
  money: {
    ...en.money,
    expectedRevenue: 'Ingresos esperados',
    expectedRevenueHelp:
      'Ingresos esperados de clientes en este período, incluyendo actividad facturada y pagos directos sin contar dos veces.',
    collected: 'Cobrado',
    collectedHelp:
      'Pagos de clientes realmente recibidos en este período por facturas y pagos directos.',
    outstanding: 'Pendiente',
    outstandingHelp: 'Dinero que los clientes aún le deben.',
    invoiced: 'Facturado',
    invoicedHelp: 'Total de facturas no canceladas creadas en este período.',
    netCash: 'Efectivo después de costos pagados',
    netCashHelp:
      'Pagos recibidos menos pagos a contratistas pagados menos gastos pagados.',
    latePayments: 'Pagos atrasados',
    latePaymentsHelp: 'Saldos de facturas sin pagar que ya pasaron su fecha de vencimiento.',
    lateInvoices: 'Facturas atrasadas',
    unpaidInvoices: 'Facturas sin pagar',
    unpaidInvoicesHelp: 'Cantidad de facturas no canceladas con saldo restante.',
    averageDays: 'Tiempo promedio para cobrar',
    averageDaysNone: 'Aún no hay facturas pagadas por completo',
    contractorCost: 'Costo de contratistas',
    contractorCostHelp: 'Mano de obra de contratistas de trabajos en este período.',
    contractorPay: 'Costo de contratistas',
    contractorPayHelp: 'Mano de obra de contratistas de trabajos en este período.',
    contractorPayOwed: 'Pago a contratistas adeudado',
    contractorPayPending: 'Pago a contratistas pendiente',
    contractorPayPaid: 'Pago a contratistas pagado',
    contractorPayPaidHelp: 'Pagos a contratistas realmente hechos en este período.',
    otherExpenses: 'Otros gastos',
    expectedProfit: 'Ganancia esperada',
    expectedProfitHelp: 'Ingresos esperados menos costo de contratistas y otros gastos.',
    cashAfterCosts: 'Efectivo después de costos pagados',
    cashAfterCostsHelp:
      'Pagos recibidos menos costos de contratistas pagados y gastos pagados.',
    expectedProfitPct: 'Porcentaje de ganancia esperada',
    costsMissing: 'Solo se incluyen costos registrados.',
    uninvoicedWork: 'Ingresos esperados sin factura',
    paymentsMissingDates: 'Pagos sin fecha',
    completedJobs: 'Trabajos completados',
    jobs: 'Trabajos',
    activeCustomers: 'Clientes activos',
    activeCustomersHelp:
      'Clientes con etapa Activo. Etapa en blanco cuenta como activo. Leads, pasados, inactivos, cancelados y archivados no se cuentan.',
    bookings: 'Reservas',
    messages: 'Mensajes',
    reports: 'Informes',
    current: 'Actual',
    days: 'días'
  },
  contractorPayPage: {
    title: 'Pago del equipo',
    subtitle: 'Revise los pagos a contratistas y empleados vinculados a trabajos.',
    privacyNotice:
      'Información financiera privada de la empresa. Solo propietarios, gerentes y empleados autorizados pueden ver o gestionar el pago del equipo. Los contratistas y clientes no pueden ver esta sección.',
    permissionDenied: 'Solo propietarios, administradores y gerentes con acceso financiero pueden ver el pago del equipo.',
    stillOwed: 'Aún adeudado',
    pending: 'Pendiente',
    paid: 'Pagado',
    allPayments: 'Todos los pagos del equipo',
    statusPayments: 'Pagos del equipo {status}',
    changesHint: 'Los cambios aquí actualizan automáticamente los totales del panel.',
    showAll: 'Mostrar todo',
    refresh: 'Actualizar',
    refreshing: 'Actualizando…',
    loading: 'Cargando pagos del equipo…',
    empty: 'No hay pagos del equipo con este estado.',
    openJob: 'Abrir trabajo',
    markPending: 'Marcar pendiente',
    markPaid: 'Marcar pagado',
    updateError: 'No se pudo actualizar el pago del equipo.',
    markedPaid: 'Pago del equipo marcado como pagado.',
    markedStatus: 'Pago del equipo marcado como {status}.',
    unnamed: 'Contratista sin asignar',
    jobFallback: 'Trabajo',
    contractorOrCleaner: 'Miembro del equipo',
    contractorNamePlaceholder: 'Nombre del miembro del equipo',
    paymentMethodLabel: 'Método de pago',
    reviewPayment: 'Revisar pago',
    addAnotherPayment: 'Agregar otro pago',
    flatRate: 'Tarifa fija',
    hourly: 'Por hora',
    amount: 'Monto',
    hours: 'Horas',
    hourlyRate: 'Tarifa por hora',
    calculatedTotal: 'Total calculado',
    notesOptional: 'Notas (opcional)',
    initializeFromJob: 'Los detalles del pago se completaron desde este trabajo.',
    added: 'Pago del equipo agregado.',
    updated: 'Pago del equipo actualizado.',
    removed: 'Pago del equipo eliminado.',
    duplicated: 'Pago del equipo duplicado.'
  }
};

const vi: DashboardFinanceCopy = {
  ...en,
  ranges: {
    today: 'Hôm nay',
    week: 'Tuần này',
    month: 'Tháng này',
    quarter: 'Quý này',
    year: 'Năm nay',
    last_year: 'Năm trước',
    all_time: 'Toàn thời gian'
  },
  metricTitles: {
    collected: 'Đã thu',
    invoiced: 'Đã xuất hóa đơn',
    outstanding: 'Còn nợ',
    late: 'Thanh toán quá hạn',
    'unpaid-invoices': 'Hóa đơn chưa thanh toán',
    'net-cash': 'Tiền mặt sau chi phí đã trả',
    'estimated-profit': 'Lợi nhuận dự kiến',
    'contractor-pay': 'Chi phí thầu phụ',
    'contractor-pay-owed': 'Còn nợ thầu phụ',
    'contractor-pay-pending': 'Thầu phụ đang chờ',
    expenses: 'Chi phí',
    'completed-jobs': 'Công việc hoàn thành',
    jobs: 'Công việc',
    'active-customers': 'Khách hàng đang hoạt động'
  },
  formulas: {
    collected:
      'Đã thu = thanh toán hóa đơn + thanh toán trực tiếp trong kỳ. Cùng một khoản không được tính hai lần.',
    invoiced: 'Đã xuất hóa đơn = tổng hóa đơn không bị hủy được tạo trong kỳ.',
    outstanding:
      'Chưa thu = số dư hóa đơn chưa trả + số tiền dự kiến của việc chưa có hóa đơn trừ thanh toán trực tiếp.',
    late: 'Quá hạn = số dư hóa đơn chưa trả sau ngày đến hạn.',
    'unpaid-invoices': 'Hóa đơn chưa thanh toán = hóa đơn còn số dư.',
    'net-cash':
      'Tiền mặt sau chi phí đã trả = tiền thực nhận trừ tiền thầu phụ đã trả trừ chi phí đã trả.',
    'estimated-profit':
      'Lợi nhuận dự kiến = doanh thu dự kiến trừ chi phí thầu phụ trừ chi phí khác đã ghi nhận.',
    'contractor-pay': 'Chi phí thầu phụ = tổng chi phí nhân công ghi nhận trong kỳ.',
    'contractor-pay-owed': 'Còn nợ = nhân công vẫn đánh dấu chưa trả.',
    'contractor-pay-pending': 'Đang chờ = nhân công đánh dấu đang chờ.',
    expenses: 'Chi phí = các khoản có ngày trong kỳ đã chọn.',
    'completed-jobs':
      'Công việc hoàn thành tính theo completed_at, hoặc ngày bắt đầu/lịch làm việc khi thiếu ngày hoàn thành.',
    jobs: 'Công việc tính theo ngày vận hành trong kỳ đã chọn.',
    'active-customers':
      'Khách hàng đang hoạt động = bản ghi ở giai đoạn Active. Giai đoạn trống được tính là active, trừ khi past, inactive, archived hoặc cancelled.'
  },
  details: {
    titleFallback: 'Chi tiết chỉ số',
    subtitle: 'Xem các bản ghi tạo nên từng tổng trên bảng điều khiển.',
    exactTotal: 'Tổng chính xác',
    empty: 'Không có bản ghi trong kỳ này.',
    tryAgain: 'Thử lại',
    unknownMetric: 'Chỉ số bảng điều khiển không hợp lệ.',
    loadError: 'Không tải được chi tiết chỉ số.',
    loading: 'Đang tải…'
  },
  overview: {
    title: 'Tổng quan kinh doanh',
    subtitle: 'Tiền đã thu, tiền còn nợ và chi phí thực tế.',
    periodLabel: 'Kỳ bảng điều khiển',
    moneySummaryTitle: 'Tóm tắt tiền',
    moreDetails: 'Chi tiết thêm',
    hideDetails: 'Ẩn chi tiết',
    loadError: 'Một số tổng tài chính không tải được. Hãy làm mới và thử lại.',
    missingCompletedAtWarning: '{count} công việc hoàn thành đang thiếu ngày hoàn thành',
    fixJob: 'Sửa công việc'
  },
  money: {
    ...en.money,
    expectedRevenue: 'Doanh thu dự kiến',
    expectedRevenueHelp:
      'Doanh thu khách hàng dự kiến trong kỳ, gồm hoạt động đã xuất hóa đơn và thanh toán trực tiếp trên công việc, không tính trùng.',
    collected: 'Đã thu',
    collectedHelp: 'Tiền khách thực nhận trong kỳ từ hóa đơn và thanh toán trực tiếp.',
    outstanding: 'Còn nợ',
    outstandingHelp: 'Số tiền khách hàng vẫn còn nợ bạn.',
    invoiced: 'Đã xuất hóa đơn',
    netCash: 'Tiền mặt sau chi phí đã trả',
    netCashHelp: 'Tiền thực nhận trừ tiền thầu phụ đã trả trừ chi phí đã trả.',
    latePayments: 'Thanh toán quá hạn',
    lateInvoices: 'Hóa đơn quá hạn',
    unpaidInvoices: 'Hóa đơn chưa thanh toán',
    averageDays: 'Thời gian trung bình để thu tiền',
    averageDaysNone: 'Chưa có hóa đơn thanh toán đủ',
    contractorCost: 'Chi phí thầu phụ',
    contractorCostHelp: 'Chi phí nhân công thầu phụ của công việc trong kỳ này.',
    contractorPay: 'Chi phí thầu phụ',
    contractorPayHelp: 'Chi phí nhân công thầu phụ của công việc trong kỳ này.',
    contractorPayOwed: 'Còn nợ thầu phụ',
    contractorPayPending: 'Thầu phụ đang chờ',
    contractorPayPaid: 'Đã trả thầu phụ',
    contractorPayPaidHelp: 'Các khoản đã trả thầu phụ trong kỳ này.',
    otherExpenses: 'Chi phí khác',
    expectedProfit: 'Lợi nhuận dự kiến',
    expectedProfitHelp: 'Doanh thu dự kiến trừ chi phí thầu phụ và chi phí khác.',
    cashAfterCosts: 'Tiền mặt sau chi phí đã trả',
    cashAfterCostsHelp: 'Tiền đã thu trừ chi phí thầu phụ đã trả và chi phí đã trả.',
    expectedProfitPct: 'Tỷ lệ lợi nhuận dự kiến',
    costsMissing: 'Chỉ gồm chi phí đã ghi nhận.',
    uninvoicedWork: 'Doanh thu dự kiến chưa xuất hóa đơn',
    paymentsMissingDates: 'Thanh toán thiếu ngày',
    completedJobs: 'Công việc hoàn thành',
    jobs: 'Công việc',
    activeCustomers: 'Khách hàng đang hoạt động',
    activeCustomersHelp:
      'Khách hàng ở giai đoạn Active. Giai đoạn trống được tính là active. Lead, past, inactive, cancelled và archived không được tính.',
    bookings: 'Đặt lịch',
    messages: 'Tin nhắn',
    reports: 'Báo cáo',
    current: 'Hiện tại',
    days: 'ngày'
  },
  contractorPayPage: {
    title: 'Thanh toán nhóm',
    subtitle: 'Xem các khoản thanh toán cho thầu phụ và nhân viên gắn với công việc.',
    privacyNotice:
      'Thông tin tài chính nội bộ của công ty. Chỉ chủ sở hữu, quản lý và nhân viên được ủy quyền mới xem hoặc quản lý thanh toán nhóm. Thầu phụ và khách hàng không thấy phần này.',
    permissionDenied: 'Chỉ chủ sở hữu, quản trị và quản lý có quyền tài chính mới xem được thanh toán nhóm.',
    stillOwed: 'Còn nợ',
    pending: 'Đang chờ',
    paid: 'Đã trả',
    allPayments: 'Tất cả khoản thanh toán nhóm',
    statusPayments: 'Khoản thanh toán nhóm {status}',
    changesHint: 'Thay đổi tại đây sẽ tự cập nhật tổng trên bảng điều khiển.',
    showAll: 'Hiện tất cả',
    refresh: 'Làm mới',
    refreshing: 'Đang làm mới…',
    loading: 'Đang tải khoản thanh toán nhóm…',
    empty: 'Không có khoản thanh toán nhóm khớp trạng thái này.',
    openJob: 'Mở công việc',
    markPending: 'Đánh dấu đang chờ',
    markPaid: 'Đánh dấu đã trả',
    updateError: 'Không cập nhật được khoản thanh toán nhóm.',
    markedPaid: 'Đã đánh dấu khoản thanh toán nhóm là đã trả.',
    markedStatus: 'Đã đánh dấu khoản thanh toán nhóm là {status}.',
    unnamed: 'Thầu phụ chưa phân công',
    jobFallback: 'Công việc',
    contractorOrCleaner: 'Thành viên nhóm',
    contractorNamePlaceholder: 'Tên thành viên nhóm',
    paymentMethodLabel: 'Phương thức thanh toán',
    reviewPayment: 'Xem lại thanh toán',
    addAnotherPayment: 'Thêm khoản thanh toán khác',
    flatRate: 'Trọn gói',
    hourly: 'Theo giờ',
    amount: 'Số tiền',
    hours: 'Số giờ',
    hourlyRate: 'Đơn giá theo giờ',
    calculatedTotal: 'Tổng tính toán',
    notesOptional: 'Ghi chú (tùy chọn)',
    initializeFromJob: 'Chi tiết thanh toán đã được điền từ công việc này.',
    added: 'Đã thêm khoản thanh toán nhóm.',
    updated: 'Đã cập nhật khoản thanh toán nhóm.',
    removed: 'Đã xóa khoản thanh toán nhóm.',
    duplicated: 'Đã nhân bản khoản thanh toán nhóm.'
  }
};

const byLocale: Record<Locale, DashboardFinanceCopy> = { en, es, vi };

export function getDashboardFinanceCopy(locale: string | null | undefined): DashboardFinanceCopy {
  return byLocale[normalizeLocale(locale)];
}

export function formatDashboardCopy(
  template: string,
  values?: Record<string, string | number>
): string {
  if (!values) return template;
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    template
  );
}
