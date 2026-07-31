/** Column keys + English headers for role-based exports. */

export type ExportColumnDef = {
  key: string;
  header: string;
};

function cols(defs: Array<[string, string]>): ExportColumnDef[] {
  return defs.map(([key, header]) => ({ key, header }));
}

/** Owner / manager operational export (no finance). */
export const OWNER_JOBS_OPERATIONAL_COLUMNS = cols([
  ['jobId', 'Job ID'],
  ['jobTitle', 'Job title'],
  ['customerName', 'Customer name'],
  ['customerEmail', 'Customer email'],
  ['customerPhone', 'Customer phone'],
  ['serviceAddress', 'Property or service address'],
  ['city', 'City'],
  ['state', 'State'],
  ['postalCode', 'Postal code'],
  ['scheduledDate', 'Scheduled date'],
  ['startTime', 'Start time'],
  ['endTime', 'End time'],
  ['timezone', 'Timezone'],
  ['assignedWorker', 'Assigned contractor or employee'],
  ['jobStatus', 'Job status'],
  ['photoCount', 'Photo count'],
  ['createdDate', 'Created date'],
  ['completedDate', 'Completed date']
]);

/** Owner / manager financial export (full). */
export const OWNER_JOBS_FINANCIAL_COLUMNS = cols([
  ['jobId', 'Job ID'],
  ['jobTitle', 'Job title'],
  ['customerName', 'Customer name'],
  ['customerEmail', 'Customer email'],
  ['customerPhone', 'Customer phone'],
  ['serviceAddress', 'Property or service address'],
  ['city', 'City'],
  ['state', 'State'],
  ['postalCode', 'Postal code'],
  ['scheduledDate', 'Scheduled date'],
  ['startTime', 'Start time'],
  ['endTime', 'End time'],
  ['timezone', 'Timezone'],
  ['assignedWorker', 'Assigned contractor or employee'],
  ['jobStatus', 'Job status'],
  ['billingStatus', 'Billing status'],
  ['expectedRevenue', 'Expected revenue'],
  ['expectedContractorCost', 'Expected contractor cost'],
  ['additionalExpectedExpenses', 'Additional expected expenses'],
  ['expectedProfit', 'Expected profit'],
  ['actualCollected', 'Actual collected amount'],
  ['actualLaborCost', 'Actual labor cost'],
  ['actualExpenses', 'Actual expenses'],
  ['actualProfit', 'Actual profit'],
  ['photoCount', 'Photo count'],
  ['createdDate', 'Created date'],
  ['completedDate', 'Completed date']
]);

export const TEAM_EXPORT_COLUMNS = cols([
  ['memberName', 'Team member name'],
  ['email', 'Email'],
  ['role', 'Role'],
  ['accountStatus', 'Account status'],
  ['invitationStatus', 'Invitation status'],
  ['joinedDate', 'Joined date'],
  ['lastActiveDate', 'Last active date'],
  ['assignedJobCount', 'Assigned job count'],
  ['completedJobCount', 'Completed job count'],
  ['currentActiveJobCount', 'Current active job count']
]);

export const CUSTOMER_JOBS_COLUMNS = cols([
  ['jobTitle', 'Job title'],
  ['serviceAddress', 'Property or service address'],
  ['scheduledDate', 'Scheduled date'],
  ['startTime', 'Start time'],
  ['endTime', 'End time'],
  ['jobStatus', 'Job status'],
  ['assignedCompany', 'Assigned company or team display name'],
  ['completionDate', 'Completion date'],
  ['sharedNotes', 'Shared notes'],
  ['sharedReport', 'Shared report link or report status'],
  ['invoiceNumber', 'Invoice number'],
  ['invoiceStatus', 'Invoice status'],
  ['invoiceTotal', 'Invoice total'],
  ['amountPaid', 'Amount paid'],
  ['balanceDue', 'Balance due']
]);

export const CONTRACTOR_JOBS_COLUMNS = cols([
  ['jobTitle', 'Job title'],
  ['customerDisplayName', 'Customer display name'],
  ['serviceAddress', 'Service address'],
  ['scheduledDate', 'Scheduled date'],
  ['startTime', 'Start time'],
  ['endTime', 'End time'],
  ['jobStatus', 'Job status'],
  ['completionDate', 'Completion date'],
  ['assignedNotes', 'Assigned notes'],
  ['photoCount', 'Photo count'],
  ['payStatus', 'Pay status'],
  ['payAmount', 'Pay amount']
]);

export function ownerJobsColumns(includeFinance: boolean): ExportColumnDef[] {
  return includeFinance ? OWNER_JOBS_FINANCIAL_COLUMNS : OWNER_JOBS_OPERATIONAL_COLUMNS;
}

export function columnHeaders(columns: ExportColumnDef[]): string[] {
  return columns.map((c) => c.header);
}

export function columnKeys(columns: ExportColumnDef[]): string[] {
  return columns.map((c) => c.key);
}

export function rowValues(columns: ExportColumnDef[], row: Record<string, unknown>): unknown[] {
  return columns.map((c) => row[c.key] ?? '');
}

export function stringRowValues(columns: ExportColumnDef[], row: Record<string, unknown>): string[] {
  return columns.map((c) => {
    const value = row[c.key];
    return value == null ? '' : String(value);
  });
}
