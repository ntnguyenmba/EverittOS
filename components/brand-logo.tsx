import Image from 'next/image';
import Link from 'next/link';

type BrandLogoProps = {
  href?: string;
  showName?: boolean;
  size?: number;
  className?: string;
};

export function BrandLogo({ href = '/', showName = false, size = 36, className = '' }: BrandLogoProps) {
  const content = (
    <>
      <Image
        src="/9CE8852C-46D4-4C5F-8173-13B7132006EC.png"
        alt="EverittOS"
        width={size}
        height={size}
        className="brand-logo-image"
        priority
      />
      {showName ? <span className="brand-logo-name">EverittOS</span> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`brand-logo ${className}`.trim()} aria-label="EverittOS home">
        {content}
      </Link>
    );
  }

  return <div className={`brand-logo ${className}`.trim()}>{content}</div>;
}
