/** Vercel deployment target baked at build time (see next.config.mjs). */
export type VercelDeploymentEnv = 'production' | 'preview' | 'development';

export function vercelDeploymentEnv(): VercelDeploymentEnv {
  const value = process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV;
  if (value === 'production' || value === 'preview' || value === 'development') {
    return value;
  }
  return process.env.NODE_ENV === 'development' ? 'development' : 'production';
}

/** Block Vercel Toolbar / feedback widget for end users on production. */
export function shouldSuppressVercelToolbar(): boolean {
  return vercelDeploymentEnv() === 'production';
}

/** Allow toolbar on localhost and preview deployments only. */
export function shouldAllowVercelToolbar(): boolean {
  return !shouldSuppressVercelToolbar();
}
