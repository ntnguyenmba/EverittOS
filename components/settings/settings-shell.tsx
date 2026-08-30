'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useTranslation } from '@/components/locale-provider';
import { isNavLinkActive, settingsLinksForRole } from '@/lib/nav-access';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import {
  canManageBilling,
  canViewTeam,
  isClientRole,
  isContractorRole,
  normalizeRole,
  type UserRole
} from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type SettingsShellProps = {
  plan?: EverittosPlan;
  title: string;
  description?: string;
  role?: UserRole | string | null;
  children: React.ReactNode;
};

const JOB_INSTRUCTIONS_PATH = '/settings/account/job-instructions';

const LABELS = {
  en: {
    organization: 'Company', team: 'Team', notifications: 'Notifications', preferences: 'General',
    privacy: 'Privacy', terms: 'Terms', deleteAccount: 'Delete', billing: 'Billing', about: 'About',
    instructions: 'Instructions', manageBilling: 'Billing', settings: 'Settings', recommendations: 'Recommendations'
  },
  es: {
    organization: 'Empresa', team: 'Equipo', notifications: 'Notificaciones', preferences: 'General',
    privacy: 'Privacidad', terms: 'Términos', deleteAccount: 'Eliminar', billing: 'Facturación', about: 'Acerca de',
    instructions: 'Instrucciones', manageBilling: 'Facturación', settings: 'Configuración', recommendations: 'Recomendaciones'
  },
  vi: {
    organization: 'Công ty', team: 'Nhóm', notifications: 'Thông báo', preferences: 'Chung',
    privacy: 'Quyền riêng tư', terms: 'Điều khoản', deleteAccount: 'Xóa', billing: 'Thanh toán', about: 'Giới thiệu',
    instructions: 'Hướng dẫn', manageBilling: 'Thanh toán', settings: 'Cài đặt', recommendations: 'Đánh giá'
  }
} as const;

export function SettingsShell({ plan = 'free', title, description, role: roleProp, children }: SettingsShellProps) {
  const pathname = usePathname();
  const { locale } = useTranslation();
  const copy = LABELS[locale];
  const normalizedPlan = normalizePlan(plan);
  const [role, setRole] = useState<UserRole>(normalizeRole(roleProp));

  useEffect(() => {
    if (roleProp) {
      setRole(normalizeRole(roleProp));
      return;
    }

    async function loadRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      setRole(normalizeRole(profile?.role));
    }

    void loadRole();
  }, [roleProp]);

  const labelByHref: Record<string, string> = {
    '/settings/account': copy.settings,
    '/settings': copy.organization,
    '/settings/team': copy.team,
    '/settings/people': copy.team,
    '/settings/notifications': copy.notifications,
    '/settings/branding': copy.preferences,
    '/settings/privacy': copy.privacy,
    '/terms': copy.terms,
    '/settings/privacy#delete-account': copy.deleteAccount,
    '/settings/billing': copy.billing,
    '/settings/reviews': copy.recommendations,
    [JOB_INSTRUCTIONS_PATH]: copy.instructions,
    '/about': copy.about
  };

  const links = settingsLinksForRole(role, normalizedPlan).map((link) => ({
    ...link,
    label: labelByHref[link.href] || link.label
  }));

  if (canViewTeam(role) && !links.some((link) => link.href === '/settings/team')) {
    const organizationIndex = links.findIndex((link) => link.href === '/settings');
    const teamLink = { href: '/settings/team', label: copy.team };
    if (organizationIndex >= 0) links.splice(organizationIndex + 1, 0, teamLink);
    else links.push(teamLink);
  }

  const canUseJobInstructions = !isClientRole(role) && !isContractorRole(role);
  if (canUseJobInstructions && !links.some((link) => link.href === JOB_INSTRUCTIONS_PATH)) {
    const teamIndex = links.findIndex((link) => link.href === '/settings/team');
    const instructionLink = { href: JOB_INSTRUCTIONS_PATH, label: copy.instructions };
    if (teamIndex >= 0) links.splice(teamIndex + 1, 0, instructionLink);
    else links.unshift(instructionLink);
  }

  if (canManageBilling(role) && !links.some((link) => link.href === '/settings/billing')) {
    links.push({ href: '/settings/billing', label: copy.billing });
  }

  if (!links.some((link) => link.href === '/about')) links.push({ href: '/about', label: copy.about });

  const showBillingShortcut = canManageBilling(role) && pathname !== '/settings/billing';
  const showInstructionsShortcut = canUseJobInstructions && pathname !== JOB_INSTRUCTIONS_PATH;

  return (
    <AppShell plan={normalizedPlan} role={role}>
      <div className="page-head settings-page-head">
        <div>
          <h2>{title}</h2>
          {description ? <p className="muted">{description}</p> : null}
        </div>
        <div className="inline-actions">
          {showInstructionsShortcut ? (
            <Link className="btn" href={JOB_INSTRUCTIONS_PATH}>{copy.instructions}</Link>
          ) : null}
          {showBillingShortcut ? <Link className="btn" href="/settings/billing">{copy.manageBilling}</Link> : null}
        </div>
      </div>

      <nav className="settings-subnav settings-subnav-pills" aria-label={copy.settings}>
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={isNavLinkActive(pathname, link.href) ? 'active' : undefined}>
            {link.label}
          </Link>
        ))}
      </nav>

      {children}
    </AppShell>
  );
}
