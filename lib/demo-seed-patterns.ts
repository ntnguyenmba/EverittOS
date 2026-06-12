/** Known demo / manual seed values. Used to hide stray rows in real workspaces. */

export const DEMO_SEED_WORKER_NAMES = new Set(['Jordan Lee', 'Marcus Reed', 'Sophia Nguyen', 'Daniel Brooks']);

export const DEMO_SEED_CUSTOMER_NAMES = new Set([
  'Riverfront Property Group',
  'Sample customer',
  'Cliente de ejemplo',
  'Khách hàng mẫu'
]);

export const DEMO_SEED_JOB_TITLES = new Set([
  'Quarterly HVAC inspection',
  'Welcome visit',
  'Visita de bienvenida',
  'Chuyến thăm chào mừng'
]);

export const DEMO_SEED_PHONE_PREFIXES = ['512-555-', '214-555-'];

export function isDemoSeedPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  return DEMO_SEED_PHONE_PREFIXES.some((prefix) => phone.startsWith(prefix));
}

export function isDemoSeedWorker(row: { name?: string | null; phone?: string | null }): boolean {
  const name = (row.name || '').trim();
  return DEMO_SEED_WORKER_NAMES.has(name) || isDemoSeedPhone(row.phone);
}

export function isDemoSeedCustomer(row: {
  company_name?: string | null;
  phone?: string | null;
  email?: string | null;
}): boolean {
  const name = (row.company_name || '').trim();
  if (DEMO_SEED_CUSTOMER_NAMES.has(name)) return true;
  if (isDemoSeedPhone(row.phone)) return true;
  const email = (row.email || '').toLowerCase();
  return email.endsWith('@riverfront.example');
}

export function isDemoSeedJob(row: { title?: string | null; customer_name?: string | null }): boolean {
  const title = (row.title || '').trim();
  if (DEMO_SEED_JOB_TITLES.has(title)) return true;
  const customer = (row.customer_name || '').trim();
  return DEMO_SEED_CUSTOMER_NAMES.has(customer);
}
