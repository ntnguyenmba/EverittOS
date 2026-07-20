type ContactLinkProps = {
  type: 'email' | 'phone';
  value: string | null | undefined;
  fallback?: string;
  className?: string;
};

function phoneHref(value: string) {
  return `tel:${value.replace(/[^+\d]/g, '')}`;
}

export function ContactLink({
  type,
  value,
  fallback = type === 'email' ? 'No email' : 'No phone',
  className
}: ContactLinkProps) {
  const trimmed = value?.trim();
  if (!trimmed) return <span className={className}>{fallback}</span>;

  const href = type === 'email' ? `mailto:${trimmed}` : phoneHref(trimmed);

  return (
    <a className={className} href={href}>
      {trimmed}
    </a>
  );
}
