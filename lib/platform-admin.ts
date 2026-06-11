/** Platform operator emails (comma-separated ADMIN_EMAILS env). */
export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  const list = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return !!email && list.includes(email.toLowerCase());
}
