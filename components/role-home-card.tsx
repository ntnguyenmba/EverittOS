'use client';

type RoleHomeCardProps = {
  title: string;
  subtitle?: string | null;
  eyebrow?: string | null;
  children?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
};

export function RoleHomeCard({
  title,
  subtitle,
  eyebrow,
  children,
  className,
  ariaLabel
}: RoleHomeCardProps) {
  const classes = ['card', 'eo-role-home-card', className].filter(Boolean).join(' ');
  return (
    <section className={classes} aria-label={ariaLabel || title}>
      <div className="eo-role-home-heading">
        {eyebrow ? <p className="eyebrow eo-role-home-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {subtitle ? <p className="eo-role-home-subtitle">{subtitle}</p> : null}
      </div>
      {children ? <div className="eo-role-home-body">{children}</div> : null}
    </section>
  );
}
