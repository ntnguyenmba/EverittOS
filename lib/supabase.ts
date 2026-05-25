export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
};

export const supabaseReady = Boolean(supabaseConfig.url && supabaseConfig.anonKey);
