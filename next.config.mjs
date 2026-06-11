import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const vercelEnv = process.env.VERCEL_ENV || (process.env.NODE_ENV === 'development' ? 'development' : 'production');

function buildSecurityHeaders() {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  let supabaseHost = '';
  try {
    supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : '';
  } catch {
    supabaseHost = '';
  }

  const connectSrc = [
    "'self'",
    supabaseHost ? `https://${supabaseHost}` : '',
    supabaseHost ? `wss://${supabaseHost}` : '',
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://api.stripe.com',
    'https://buy.stripe.com',
    'https://billing.stripe.com',
    'https://checkout.stripe.com',
    'https://www.google-analytics.com',
    'https://region1.google-analytics.com',
    'https://www.googletagmanager.com',
    'https://oauth2.googleapis.com',
    'https://www.googleapis.com',
    'https://accounts.google.com'
  ]
    .filter(Boolean)
    .join(' ');

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    `connect-src ${connectSrc}`,
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://billing.stripe.com https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ');

  return {
    'Content-Security-Policy': csp,
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.stripe.com")',
    'X-DNS-Prefetch-Control': 'on'
  };
}

const securityHeaders = Object.entries(buildSecurityHeaders()).map(([key, value]) => ({
  key,
  value
}));

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_VERCEL_ENV: vercelEnv,
    NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES: process.env.SESSION_IDLE_TIMEOUT_MINUTES || '30',
    NEXT_PUBLIC_SESSION_IDLE_WARNING_MINUTES: process.env.SESSION_IDLE_WARNING_MINUTES || '5'
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders
      }
    ];
  }
};

export default withNextIntl(nextConfig);
