import { appUrl, safeNextPath } from '@/lib/app-url';

export type SsoProvider = 'google' | 'azure';

type SsoProviderConfig = {
  provider: SsoProvider;
  label: string;
  enabled: boolean;
};

const PROVIDER_LABELS: Record<SsoProvider, string> = {
  google: 'Google Workspace',
  azure: 'Microsoft Entra ID'
};

export const SSO_PROVIDERS: SsoProvider[] = ['google', 'azure'];

export function normalizeSsoProvider(value: string | null | undefined): SsoProvider | null {
  if (value === 'google' || value === 'azure') return value;
  return null;
}

export function ssoProviderLabel(provider: SsoProvider): string {
  return PROVIDER_LABELS[provider];
}

export function ssoProviderEnabled(provider: SsoProvider): boolean {
  if (provider === 'google') return process.env.NEXT_PUBLIC_SSO_GOOGLE_ENABLED === 'true' || process.env.SSO_GOOGLE_ENABLED === 'true';
  if (provider === 'azure') return process.env.NEXT_PUBLIC_SSO_AZURE_ENABLED === 'true' || process.env.SSO_AZURE_ENABLED === 'true';
  return false;
}

export function ssoProviders(): SsoProviderConfig[] {
  return SSO_PROVIDERS.map((provider) => ({
    provider,
    label: ssoProviderLabel(provider),
    enabled: ssoProviderEnabled(provider)
  }));
}

export function ssoCallbackUrl(next?: string | null): string {
  const destination = safeNextPath(next, '/dashboard');
  return appUrl(`/auth/callback?next=${encodeURIComponent(destination)}&type=sso`);
}
