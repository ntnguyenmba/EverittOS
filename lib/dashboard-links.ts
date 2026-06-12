/** Deep links from dashboard KPI cards to filtered list views. */
export const DASHBOARD_LINKS = {
  completedWeek: '/jobs?status=completed&period=week',
  revenueMonth: '/settings/billing?period=month',
  newCustomersMonth: '/customers?period=month',
  openInvoices: '/settings/billing?filter=unpaid',
  scheduledUpcoming: '/schedule?range=upcoming',
  todayTasks: '/projects',
  notifications: '/notifications',
  customers: '/customers',
  customersLeads: '/customers?stage=lead',
  workers: '/workers',
  proposals: '/proposals'
} as const;
