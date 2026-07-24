'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { resolveCustomerLogoUrl } from '@/lib/customer-logo';
import { supabase } from '@/lib/supabase';

type CustomerLogoProps = {
  logoPath?: string | null;
  alt: string;
  size?: number;
  className?: string;
};

export function CustomerLogo({ logoPath, alt, size = 40, className }: CustomerLogoProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    async function load() {
      if (!logoPath) {
        setSrc(null);
        return;
      }

      const url = await resolveCustomerLogoUrl(supabase, logoPath);
      if (!cancelled) setSrc(url);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [logoPath]);

  if (!src || failed) return null;

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      unoptimized
      className={className ? `customer-logo-image ${className}` : 'customer-logo-image'}
      style={{ width: size, height: size, objectFit: 'contain', borderRadius: 8 }}
      onError={() => setFailed(true)}
    />
  );
}
