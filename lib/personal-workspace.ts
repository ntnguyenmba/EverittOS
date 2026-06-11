/** Derive a friendly default workspace name for solo operators and freelancers. */
export function defaultWorkspaceName(options: {
  email?: string | null;
  businessName?: string | null;
  metadata?: Record<string, unknown> | null;
}): string {
  const metadata = options.metadata || {};
  const fromMeta = [metadata.full_name, metadata.name, metadata.business_name].find(
    (value) => typeof value === 'string' && value.trim().length > 0
  );
  if (typeof fromMeta === 'string') {
    return fromMeta.trim();
  }

  if (options.businessName?.trim()) {
    return options.businessName.trim();
  }

  const localPart = (options.email || '').split('@')[0]?.trim();
  if (localPart) {
    const cleaned = localPart.replace(/[._+-]+/g, ' ').trim();
    if (cleaned) {
      const titled = cleaned
        .split(/\s+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
      return titled;
    }
  }

  return 'Personal workspace';
}
