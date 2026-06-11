const vercelEnv = process.env.VERCEL_ENV || (process.env.NODE_ENV === 'development' ? 'development' : 'production');

const nextConfig = {
  env: {
    NEXT_PUBLIC_VERCEL_ENV: vercelEnv,
    NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES: process.env.SESSION_IDLE_TIMEOUT_MINUTES || '30'
  }
};

export default nextConfig;
