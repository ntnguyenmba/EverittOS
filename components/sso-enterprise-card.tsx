'use client';

import Link from 'next/link';
import { normalizePlan, planDisplayName, type EverittosPlan } from '@/lib/everittos-plans';
import { meetsMinimumPlan } from '@/lib/plan-access';

type SsoEnterpriseCardProps = {
  plan: EverittosPlan | string | null;
};

const providerRows = [
  { name: 'Google Workspace', type: 'OIDC', status: 'Ready to configure' },
  { name: 'Microsoft Entra ID', type: 'OIDC', status: 'Ready to configure' },
  { name: 'Okta', type: 'SAML', status: 'Enterprise setup' },
  { name: 'OneLogin', type: 'SAML', status: 'Enterprise setup' }
];

export function SsoEnterpriseCard({ plan }: SsoEnterpriseCardProps) {
  const normalizedPlan = normalizePlan(plan);
  const enabled = meetsMinimumPlan(normalizedPlan, 'enterprise');

  return (
    <div className="settings-card">
      <p className="eyebrow">Enterprise</p>
      <h3>Single sign-on</h3>
      <p className="muted">
        Centralize sign-in through a company identity provider. SSO is prepared for enterprise workspaces and can be connected after provider metadata is available.
      </p>

      <div className="settings-grid" style={{ marginTop: 16 }}>
        {providerRows.map((provider) => (
          <div key={provider.name} className="settings-card">
            <h4>{provider.name}</h4>
            <p className="muted">{provider.type} · {provider.status}</p>
          </div>
        ))}
      </div>

      <div className="settings-actions" style={{ marginTop: 16 }}>
        {enabled ? (
          <Link className="btn btn-primary" href="mailto:team@everittventures.com?subject=EverittOS%20SSO%20Setup">
            Request SSO setup
          </Link>
        ) : (
          <Link className="btn btn-primary" href="/settings/billing?upgrade=enterprise&reason=plan&detail=Enterprise%20plan%20required%20for%20SSO.">
            Upgrade for SSO
          </Link>
        )}
        <Link className="btn" href="/help">
          View setup guide
        </Link>
      </div>

      <p className="muted" style={{ marginTop: 14 }}>
        Current plan: {planDisplayName(normalizedPlan)}. Password and passkey sign-in remain available until SSO enforcement is configured.
      </p>
    </div>
  );
}
