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

  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    vercelEnv === 'development' ? "'unsafe-eval'" : '',
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com'
  ]
    .filter(Boolean)
    .join(' ');

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    `connect-src ${connectSrc}`,
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://billing.stripe.com https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; ');

  const headers = {
    'Content-Security-Policy': csp,
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy':
      'camera=(self), microphone=(), geolocation=(), payment=(self "https://checkout.stripe.com")',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Cross-Origin-Resource-Policy': 'same-site',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'X-DNS-Prefetch-Control': 'on'
  };

  if (vercelEnv === 'production') {
    headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload';
  }

  return headers;
}

const securityHeaders = Object.entries(buildSecurityHeaders()).map(([key, value]) => ({
  key,
  value
}));

const nextConfig = {
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  typescript: {
    ignoreBuildErrors: true
  },
  env: {
    NEXT_PUBLIC_VERCEL_ENV: vercelEnv,
    NEXT_PUBLIC_BILLING_UI_BUILD: 'billing-v3-client-checkout',
    NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES: process.env.SESSION_IDLE_TIMEOUT_MINUTES || '30',
    NEXT_PUBLIC_SESSION_IDLE_WARNING_MINUTES: process.env.SESSION_IDLE_WARNING_MINUTES || '5',
    NEXT_PUBLIC_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA || 'local'
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' }
        ]
      },
      {
        source: '/.well-known/apple-app-site-association',
        headers: [{ key: 'Content-Type', value: 'application/json' }]
      },
      {
        source: '/.well-known/assetlinks.json',
        headers: [{ key: 'Content-Type', value: 'application/json' }]
      },
      {
        source: '/:path*',
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;