'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsShell } from '@/components/settings/settings-shell';
import { AccountDeleteSection } from '@/components/settings/account-delete-section';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useTranslation } from '@/components/locale-provider';
import { normalizeStripeStatus, subscriptionStatusMessage } from '@/lib/stripe-subscription';
import { normalizePlan, planDisplayName } from '@/lib/everittos-plans';
import { canManageBilling, isClientRole, isContractorRole, normalizeRole } from '@/lib/roles';
import { roleDisplayName } from '@/lib/role-routes';
import { normalizeAccountStatus } from '@/lib/account-status';
import { useAsyncAction } from '@/hooks/use-async-action';
import { FEEDBACK } from '@/lib/feedback-labels';
import { useWorkspacePlan } from '@/hooks/use-workspace-plan';
import { supabase } from '@/lib/supabase';

const DEFAULT_NOTIFICATIONS = {
  marketingEmails: false,
  productUpdates: true,
  operationalNotifications: true,
  emailNotifications: true,
  pushNotifications: false,
  smsNotifications: false
};

const copy = {
  en: {
    profileTitle: 'Profile',
    profileBody: 'Update how your name and contact details appear across EverittOS.',
    firstName: 'First name',
    lastName: 'Last name',
    displayName: 'Display name',
    phone: 'Phone',
    email: 'Email',
    newEmail: 'New email',
    newEmailPlaceholder: 'Leave blank to keep current email',
    newPassword: 'New password',
    newPasswordPlaceholder: 'Leave blank to keep current password',
    saveAccount: 'Save account',
    saved: 'Account settings saved.',
    notificationTitle: 'Notification preferences',
    emailNotifications: 'Email notifications',
    operationalUpdates: 'Operational updates',
    productUpdates: 'Product updates',
    marketingEmails: 'Marketing emails',
    legal: 'Legal',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    generalDisclaimer: 'General Disclaimer',
    contractorDisclaimer: 'Contractor Disclaimer',
    customerDisclaimer: 'Customer Portal Disclaimer',
    portalRetention:
      'Deleting your login removes dashboard access and personal profile details. Company-owned job, invoice, payment, and audit records remain with the service provider when required.'
  },
  es: {
    profileTitle: 'Perfil',
    profileBody: 'Actualice cómo aparecen su nombre y datos de contacto en EverittOS.',
    firstName: 'Nombre',
    lastName: 'Apellido',
    displayName: 'Nombre para mostrar',
    phone: 'Teléfono',
    email: 'Correo electrónico',
    newEmail: 'Nuevo correo',
    newEmailPlaceholder: 'Deje en blanco para mantener el correo actual',
    newPassword: 'Nueva contraseña',
    newPasswordPlaceholder: 'Deje en blanco para mantener la contraseña actual',
    saveAccount: 'Guardar cuenta',
    saved: 'Configuración de la cuenta guardada.',
    notificationTitle: 'Preferencias de notificación',
    emailNotifications: 'Notificaciones por correo',
    operationalUpdates: 'Actualizaciones operativas',
    productUpdates: 'Actualizaciones del producto',
    marketingEmails: 'Correos de marketing',
    legal: 'Legal',
    privacy: 'Política de privacidad',
    terms: 'Términos de servicio',
    generalDisclaimer: 'Aviso legal general',
    contractorDisclaimer: 'Aviso para contratistas',
    customerDisclaimer: 'Aviso del portal del cliente',
    portalRetention:
      'Eliminar su inicio de sesión quita el acceso al panel y los detalles personales del perfil. Los registros de trabajos, facturas, pagos y auditoría de la empresa permanecen con el proveedor del servicio cuando sea necesario.'
  },
  vi: {
    profileTitle: 'Hồ sơ',
    profileBody: 'Cập nhật cách tên và thông tin liên hệ của bạn hiển thị trên EverittOS.',
    firstName: 'Tên',
    lastName: 'Họ',
    displayName: 'Tên hiển thị',
    phone: 'Điện thoại',
    email: 'Email',
    newEmail: 'Email mới',
    newEmailPlaceholder: 'Để trống để giữ email hiện tại',
    newPassword: 'Mật khẩu mới',
    newPasswordPlaceholder: 'Để trống để giữ mật khẩu hiện tại',
    saveAccount: 'Lưu tài khoản',
    saved: 'Đã lưu cài đặt tài khoản.',
    notificationTitle: 'Tùy chọn thông báo',
    emailNotifications: 'Thông báo email',
    operationalUpdates: 'Cập nhật vận hành',
    productUpdates: 'Cập nhật sản phẩm',
    marketingEmails: 'Email tiếp thị',
    legal: 'Pháp lý',
    privacy: 'Chính sách quyền riêng tư',
    terms: 'Điều khoản dịch vụ',
    generalDisclaimer: 'Tuyên bố miễn trừ chung',
    contractorDisclaimer: 'Tuyên bố miễn trừ nhà thầu',
    customerDisclaimer: 'Tuyên bố miễn trừ cổng khách hàng',
    portalRetention:
      'Xóa đăng nhập sẽ gỡ quyền truy cập bảng điều khiển và thông tin hồ sơ cá nhân. Hồ sơ công việc, hóa đơn, thanh toán và kiểm tra thuộc công ty vẫn thuộc nhà cung cấp dịch vụ khi cần thiết.'
  }
} as const;

export default function AccountSettingsPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const c = copy[locale] || copy.en;
  const { busy: saving, runResponse, buttonLabel } = useAsyncAction({
    successMessage: c.saved
  });
  const [saveMessage, setSaveMessage] = useState('');
  const {
    profilePlan,
    billingPlan,
    organizationPlan,
    plan: workspacePlan,
    role: workspaceRole,
    subscriptionStatus: workspaceSubscriptionStatus,
    loading: planLoading
  } = useWorkspacePlan();
  const plan = billingPlan ?? profilePlan ?? workspacePlan ?? organizationPlan;
  const role = workspaceRole ?? normalizeRole('owner');
  const subscriptionStatus = workspaceSubscriptionStatus || 'free';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [accountStatus, setAccountStatus] = useState('active');
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/settings/account');
        return;
      }

      const res = await fetch('/api/account/profile', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setFirstName(json.firstName || '');
        setLastName(json.lastName || '');
        setDisplayName(json.displayName || '');
        setEmail(json.email || user.email || '');
        setPhone(json.phone || '');
        setNotifications(json.notifications || DEFAULT_NOTIFICATIONS);
      } else {
        setEmail(user.email || '');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('account_status')
        .eq('id', user.id)
        .maybeSingle();
      setAccountStatus(normalizeAccountStatus(profile?.account_status));
      setLoading(false);
    }

    void load();
  }, [router]);

  async function saveProfile() {
    const ok = await runResponse(() =>
      fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          displayName,
          phone,
          newEmail: newEmail.trim() || undefined,
          newPassword: newPassword.trim() || undefined,
          notifications
        })
      })
    );
    if (ok) setSaveMessage(c.saved);
    setNewPassword('');
    setNewEmail('');
  }

  if (loading || planLoading || !plan) {
    return (
      <SettingsShell plan={plan || 'free'} role={role} title={t('settingsNav.account')}>
        <p>{t('common.loading')}</p>
      </SettingsShell>
    );
  }

  const canBilling = canManageBilling(role);
  const activeSubscriptionStatuses = new Set(['active', 'trialing', 'past_due', 'unpaid', 'paused', 'incomplete']);
  const hasActiveSubscription =
    normalizePlan(plan) !== 'free' && activeSubscriptionStatuses.has(normalizeStripeStatus(subscriptionStatus));
  const isPortalMember = isClientRole(role) || isContractorRole(role);

  return (
    <SettingsShell plan={plan} role={role} title={t('settingsNav.account')} description={t('settings.account.description')}>
      <div className="settings-card form settings-form-grid">
        <h3>{c.profileTitle}</h3>
        <p className="muted">{c.profileBody}</p>
        <label className="settings-field">
          <span>{c.firstName}</span>
          <input className="input" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
        </label>
        <label className="settings-field">
          <span>{c.lastName}</span>
          <input className="input" value={lastName} onChange={(event) => setLastName(event.target.value)} />
        </label>
        <label className="settings-field">
          <span>{c.displayName}</span>
          <input className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        <label className="settings-field">
          <span>{c.phone}</span>
          <input className="input" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label className="settings-field">
          <span>{c.email}</span>
          <input className="input" value={email} disabled />
        </label>
        <label className="settings-field">
          <span>{c.newEmail}</span>
          <input
            className="input"
            type="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            placeholder={c.newEmailPlaceholder}
          />
        </label>
        <label className="settings-field">
          <span>{c.newPassword}</span>
          <input
            className="input"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder={c.newPasswordPlaceholder}
          />
        </label>
        <div className="settings-actions">
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveProfile()}>
            {buttonLabel(c.saveAccount, FEEDBACK.loading)}
          </button>
        </div>
        {saveMessage ? <p className="auth-message auth-message-success">{saveMessage}</p> : null}
      </div>

      <div className="settings-card form settings-form-grid">
        <h3>{c.notificationTitle}</h3>
        <label>
          <input
            type="checkbox"
            checked={notifications.emailNotifications}
            onChange={(event) => setNotifications((current) => ({ ...current, emailNotifications: event.target.checked }))}
          />{' '}
          {c.emailNotifications}
        </label>
        <label>
          <input
            type="checkbox"
            checked={notifications.operationalNotifications}
            onChange={(event) =>
              setNotifications((current) => ({ ...current, operationalNotifications: event.target.checked }))
            }
          />{' '}
          {c.operationalUpdates}
        </label>
        <label>
          <input
            type="checkbox"
            checked={notifications.productUpdates}
            onChange={(event) => setNotifications((current) => ({ ...current, productUpdates: event.target.checked }))}
          />{' '}
          {c.productUpdates}
        </label>
        <label>
          <input
            type="checkbox"
            checked={notifications.marketingEmails}
            onChange={(event) => setNotifications((current) => ({ ...current, marketingEmails: event.target.checked }))}
          />{' '}
          {c.marketingEmails}
        </label>
      </div>

      <div className="settings-card">
        <h3>{t('settings.account.languageTitle')}</h3>
        <p className="muted">{t('settings.account.languageNote')}</p>
        <LanguageSwitcher />
      </div>

      <div className="settings-card">
        <h3>{t('settings.account.profile')}</h3>
        <div className="settings-row">
          <span className="settings-row-label">{t('settings.account.role')}</span>
          <span className="settings-row-value">{roleDisplayName(role)}</span>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t('billing.currentPlan')}</span>
          <span className="settings-row-value">{planDisplayName(plan)}</span>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t('billing.status')}</span>
          <span className="settings-row-value">{subscriptionStatus}</span>
        </div>
        <p className="muted">{subscriptionStatusMessage(subscriptionStatus, locale)}</p>
        <div className="settings-row">
          <span className="settings-row-label">{t('settings.account.accountStatus')}</span>
          <span className="settings-row-value">
            {accountStatus === 'active' ? t('settings.account.active') : t('settings.account.disabled')}
          </span>
        </div>
        <div className="settings-actions">
          {canBilling ? (
            <Link href="/settings/billing" className="btn">
              {t('settings.account.manageBilling')}
            </Link>
          ) : null}
          <Link href="/settings/security" className="btn">
            {t('settingsNav.security')}
          </Link>
          {canBilling ? (
            <Link href="/settings" className="btn">
              {t('settings.account.workspaceSettings')}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="settings-card">
        <h3>{c.legal}</h3>
        <div className="button-row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <Link href="/privacy" className="btn">
            {c.privacy}
          </Link>
          <Link href="/terms" className="btn">
            {c.terms}
          </Link>
          <Link href="/disclaimer" className="btn">
            {c.generalDisclaimer}
          </Link>
          {isContractorRole(role) ? (
            <Link href="/disclaimer/contractor" className="btn">
              {c.contractorDisclaimer}
            </Link>
          ) : null}
          {isClientRole(role) ? (
            <Link href="/disclaimer/customer" className="btn">
              {c.customerDisclaimer}
            </Link>
          ) : null}
        </div>
      </div>

      <AccountDeleteSection
        hasActiveSubscription={hasActiveSubscription}
        role={role}
        retentionNote={isPortalMember ? c.portalRetention : undefined}
      />
    </SettingsShell>
  );
}
