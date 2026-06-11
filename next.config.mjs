const vercelEnv = process.env.VERCEL_ENV || (process.env.NODE_ENV === 'development' ? 'development' : 'production');

const nextConfig = {
  env: {
    NEXT_PUBLIC_VERCEL_ENV: vercelEnv
  }
};

export default nextConfig;
