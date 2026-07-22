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
    added: string;
    updated: string;
    removed: string;
    duplicated: string;
  };
};

const en: DashboardFinanceCopy = {
  ranges: {
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
      'Collected = invoice payments + direct job payments in the selected period. The same payment is never counted twice.',
    invoiced: 'Invoiced = collectible invoice totals created in the selected period.',
    outstanding:
      'Outstanding = money customers still owe: unpaid collectible invoice balances plus unpaid expected amounts on jobs without an invoice.',
    late: 'Late = unpaid invoice balances past their due date.',
    'unpaid-invoices': 'Unpaid invoices = invoices with a remaining balance.',
    'net-cash':
      'Cash after paid costs = payments actually received minus contractor payments actually paid minus expenses actually paid.',
    'estimated-profit':
      'Expected profit = expected revenue minus contractor cost incurred minus other recorded expenses.',
    'contractor-pay': 'Contractor cost = labor totals recorded for the selected period.',
    'contractor-pay-owed': 'Contractor pay owed = labor still marked unpaid.',
    'contractor-pay-pending': 'Contractor pay pending = labor marked pending.',
    expenses: 'Expenses = expense amounts with dates in the selected period.',
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
    subtitle: 'Expected revenue, cash collected, costs, and profit for the selected period.',
    periodLabel: 'Dashboard period',
    moneySummaryTitle: 'Money summary',
    moreDetails: 'More details',
    hideDetails: 'Hide details',
    loadError: 'Some financial totals could not be loaded. Refresh and try again.',
    missingCompletedAtWarning: '{count} completed jobs are missing completion dates',
    fixJob: 'Fix job'
  },
  money: {
    expectedRevenue: 'Expected revenue',
    expectedRevenueHelp:
      'Invoice totals created in this period plus expected amounts on jobs that do not have an invoice yet. A job is never counted twice.',
    collected: 'Collected',
    collectedHelp:
      'Client payments actually received in this period from invoices and direct job payments.',
    outstanding: 'Outstanding',
    outstandingHelp: 'Money customers still owe you.',
    invoiced: 'Invoiced',
    invoicedHelp: 'Total of non-cancelled invoices created during this period.',
    netCash: 'Cash after paid costs',
    netCashHelp:
      'Payments actually received minus contractor payments actually paid minus expenses actually paid.',
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
    contractorCost: 'Contractor cost',
    contractorCostHelp: 'Total contractor labor recorded for this period.',
    contractorPay: 'Contractor cost',
    contractorPayHelp: 'Total contractor labor recorded for this period.',
    contractorPayOwed: 'Contractor pay owed',
    contractorPayOwedHelp: 'Contractor labor not yet marked paid.',
    contractorPayPending: 'Contractor pay pending',
    contractorPayPendingHelp: 'Contractor pay marked pending but not yet marked paid.',
    otherExpenses: 'Other expenses',
    otherExpensesHelp: 'Non-contractor expenses dated in the selected period.',
    expectedProfit: 'Expected profit',
    expectedProfitHelp: 'Expected revenue minus contractor cost and other expenses.',
    cashAfterCosts: 'Cash after paid costs',
    cashAfterCostsHelp:
      'Payments actually received minus contractor payments actually paid minus expenses actually paid.',
    expectedProfitPct: 'Expected profit percentage',
    expectedProfitPctHelp: 'Expected profit divided by expected revenue for this period.',
    costsMissing: 'Only recorded costs are included.',
    uninvoicedWork: 'Uninvoiced expected revenue',
    uninvoicedWorkHelp:
      'Expected job revenue that has not been invoiced. Included in Expected revenue, not in Invoiced.',
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
    title: 'Contractor Pay',
    subtitle:
      'See who needs to be paid, which job the payment belongs to, and whether it is unpaid, pending, or paid.',
    permissionDenied: 'Only owners, admins, and managers can view contractor payments.',
    stillOwed: 'Still owed',
    pending: 'Pending',
    paid: 'Paid',
    allPayments: 'All contractor payments',
    statusPayments: '{status} contractor payments',
    changesHint: 'Changes here automatically update the dashboard totals.',
    showAll: 'Show all',
    refresh: 'Refresh',
    refreshing: 'Refreshing…',
    loading: 'Loading contractor payments…',
    empty: 'No contractor payments match this status.',
    openJob: 'Open job',
    markPending: 'Mark pending',
    markPaid: 'Mark paid',
    updateError: 'Unable to update contractor payment.',
    markedPaid: 'Contractor payment marked paid.',
    markedStatus: 'Contractor payment marked {status}.',
    unnamed: 'Unnamed contractor',
    jobFallback: 'Job',
    contractorOrCleaner: 'Contractor or cleaner',
    contractorNamePlaceholder: 'Contractor name',
    paymentMethodLabel: 'Method',
    added: 'Contractor pay added.',
    updated: 'Contractor pay updated.',
    removed: 'Contractor pay removed.',
    duplicated: 'Contractor pay duplicated.'
  }
};

const es: DashboardFinanceCopy = {
  ...en,
  ranges: {
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
    subtitle: 'Ingresos esperados, cobros, costos y ganancia del período seleccionado.',
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
      'Totales de facturas creadas en este período más montos esperados de trabajos sin factura. Un trabajo nunca se cuenta dos veces.',
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
    contractorCostHelp: 'Total de mano de obra de contratistas registrada en este período.',
    contractorPay: 'Costo de contratistas',
    contractorPayHelp: 'Total de mano de obra de contratistas registrada en este período.',
    contractorPayOwed: 'Pago a contratistas adeudado',
    contractorPayPending: 'Pago a contratistas pendiente',
    otherExpenses: 'Otros gastos',
    expectedProfit: 'Ganancia esperada',
    expectedProfitHelp: 'Ingresos esperados menos costo de contratistas y otros gastos.',
    cashAfterCosts: 'Efectivo después de costos pagados',
    cashAfterCostsHelp:
      'Pagos recibidos menos pagos a contratistas pagados menos gastos pagados.',
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
    title: 'Pago a contratistas',
    subtitle:
      'Vea a quién hay que pagar, a qué trabajo pertenece y si está sin pagar, pendiente o pagado.',
    permissionDenied: 'Solo propietarios, administradores y gerentes pueden ver estos pagos.',
    stillOwed: 'Aún adeudado',
    pending: 'Pendiente',
    paid: 'Pagado',
    allPayments: 'Todos los pagos a contratistas',
    statusPayments: 'Pagos a contratistas {status}',
    changesHint: 'Los cambios aquí actualizan automáticamente los totales del panel.',
    showAll: 'Mostrar todo',
    refresh: 'Actualizar',
    refreshing: 'Actualizando…',
    loading: 'Cargando pagos a contratistas…',
    empty: 'No hay pagos a contratistas con este estado.',
    openJob: 'Abrir trabajo',
    markPending: 'Marcar pendiente',
    markPaid: 'Marcar pagado',
    updateError: 'No se pudo actualizar el pago al contratista.',
    markedPaid: 'Pago al contratista marcado como pagado.',
    markedStatus: 'Pago al contratista marcado como {status}.',
    unnamed: 'Contratista sin nombre',
    jobFallback: 'Trabajo',
    contractorOrCleaner: 'Contratista o personal de limpieza',
    contractorNamePlaceholder: 'Nombre del contratista',
    paymentMethodLabel: 'Método',
    added: 'Pago a contratista agregado.',
    updated: 'Pago a contratista actualizado.',
    removed: 'Pago a contratista eliminado.',
    duplicated: 'Pago a contratista duplicado.'
  }
};

const vi: DashboardFinanceCopy = {
  ...en,
  ranges: {
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
    subtitle: 'Doanh thu dự kiến, tiền đã thu, chi phí và lợi nhuận trong kỳ đã chọn.',
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
      'Tổng hóa đơn tạo trong kỳ cộng số tiền dự kiến của việc chưa có hóa đơn. Một công việc không được tính hai lần.',
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
    contractorCostHelp: 'Tổng chi phí nhân công thầu phụ ghi nhận trong kỳ này.',
    contractorPay: 'Chi phí thầu phụ',
    contractorPayHelp: 'Tổng chi phí nhân công thầu phụ ghi nhận trong kỳ này.',
    contractorPayOwed: 'Còn nợ thầu phụ',
    contractorPayPending: 'Thầu phụ đang chờ',
    otherExpenses: 'Chi phí khác',
    expectedProfit: 'Lợi nhuận dự kiến',
    expectedProfitHelp: 'Doanh thu dự kiến trừ chi phí thầu phụ và chi phí khác.',
    cashAfterCosts: 'Tiền mặt sau chi phí đã trả',
    cashAfterCostsHelp: 'Tiền thực nhận trừ tiền thầu phụ đã trả trừ chi phí đã trả.',
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
    title: 'Trả thầu phụ',
    subtitle: 'Xem cần trả cho ai, thuộc công việc nào, và trạng thái chưa trả, đang chờ hay đã trả.',
    permissionDenied: 'Chỉ chủ sở hữu, quản trị và quản lý mới xem được các khoản trả này.',
    stillOwed: 'Còn nợ',
    pending: 'Đang chờ',
    paid: 'Đã trả',
    allPayments: 'Tất cả khoản trả thầu phụ',
    statusPayments: 'Khoản trả thầu phụ {status}',
    changesHint: 'Thay đổi tại đây sẽ tự cập nhật tổng trên bảng điều khiển.',
    showAll: 'Hiện tất cả',
    refresh: 'Làm mới',
    refreshing: 'Đang làm mới…',
    loading: 'Đang tải khoản trả thầu phụ…',
    empty: 'Không có khoản trả thầu phụ khớp trạng thái này.',
    openJob: 'Mở công việc',
    markPending: 'Đánh dấu đang chờ',
    markPaid: 'Đánh dấu đã trả',
    updateError: 'Không cập nhật được khoản trả thầu phụ.',
    markedPaid: 'Đã đánh dấu khoản trả thầu phụ là đã trả.',
    markedStatus: 'Đã đánh dấu khoản trả thầu phụ là {status}.',
    unnamed: 'Thầu phụ chưa đặt tên',
    jobFallback: 'Công việc',
    contractorOrCleaner: 'Thầu phụ hoặc nhân viên',
    contractorNamePlaceholder: 'Tên thầu phụ',
    paymentMethodLabel: 'Phương thức',
    added: 'Đã thêm khoản trả thầu phụ.',
    updated: 'Đã cập nhật khoản trả thầu phụ.',
    removed: 'Đã xóa khoản trả thầu phụ.',
    duplicated: 'Đã nhân bản khoản trả thầu phụ.'
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
