'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PlanCheckoutButton } from '@/components/plan-checkout-button';
import { NativeStoreSubscribeButton } from '@/components/native-store-subscribe-button';
import { resolveBillingPlanCardUi, type PaidPlanKey } from '@/lib/billing-plan-card';
import { BILLING_PLANS } from '@/lib/billing-config';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { resolveBillingVisibility, nativeBillingNotice } from '@/lib/platform/billing';
import { SUPPORT_EMAIL, supportMailtoHref } from '@/lib/support';
import { useTranslation } from '@/components/locale-provider';

type BillingPlansGridProps = {
  currentPlan: EverittosPlan;
  highlightPlan?: EverittosPlan;
  hasActiveSubscription?: boolean;
  portalAvailable?: boolean;
  onOpenPortal?: () => void;
  portalLoading?: boolean;
  onNativePurchaseSuccess?: () => void;
};

type LocalPlanCopy = {
  name: string;
  headline: string;
  features: string[];
  limits: string[];
};

const planCopy: Record<'en' | 'es' | 'vi', Record<EverittosPlan, LocalPlanCopy>> = {
  en: {
    free: { name: 'Free', headline: 'Track jobs and customers without spreadsheets.', features: ['Account and login', 'Dashboard', 'Customer management', 'Basic job tracking', 'Schedule and notifications'], limits: ['3 active jobs', '10 customers', '20 photos', '1 user'] },
    pro: { name: 'Pro', headline: 'Before/after photos, bookings, and professional job management.', features: ['Everything in Free', 'Bookings & appointments', 'Before and after photos', 'Expanded jobs and customers', 'Ask Everitt search on every plan'], limits: ['25 active jobs', '100 customers', '100 photos', '3 users'] },
    business: { name: 'Business', headline: 'Team management, crew assignment, activity log, and Everitt AI.', features: ['Everything in Pro', 'Team & crew management', 'Job assignments', 'Activity log', 'Everitt AI writing & analysis'], limits: ['150 active jobs', '1,000 customers', '15 users'] },
    starter: { name: 'Starter', headline: 'Higher limits for growing teams.', features: ['Everything in Business', 'Higher job and customer limits', 'More team members', 'Everitt AI included', 'Multi-location basics'], limits: ['500 active jobs', '5,000 customers', '50 users'] },
    growth: { name: 'Growth', headline: 'Workflows, portals, API access, and priority support.', features: ['Everything in Starter', 'Workflows', 'Client & contractor portals', 'Departments', 'API access'], limits: ['2,500 active jobs', '25,000 customers', '250 users'] },
    enterprise: { name: 'Enterprise', headline: 'Unlimited scale, unlimited Everitt AI, and dedicated support.', features: ['Everything in Growth', 'Unlimited Everitt AI', 'Enterprise permissions', 'Dedicated support', 'Unlimited jobs, customers, and users'], limits: ['Unlimited jobs', 'Unlimited customers', 'Unlimited users'] }
  },
  es: {
    free: { name: 'Gratis', headline: 'Controla trabajos y clientes sin hojas de cálculo.', features: ['Cuenta e inicio de sesión', 'Panel', 'Gestión de clientes', 'Seguimiento básico de trabajos', 'Calendario y notificaciones'], limits: ['3 trabajos activos', '10 clientes', '20 fotos', '1 usuario'] },
    pro: { name: 'Pro', headline: 'Fotos de antes y después, reservas y gestión profesional de trabajos.', features: ['Todo lo de Gratis', 'Reservas y citas', 'Fotos de antes y después', 'Más trabajos y clientes', 'Búsqueda de Ask Everitt en todos los planes'], limits: ['25 trabajos activos', '100 clientes', '100 fotos', '3 usuarios'] },
    business: { name: 'Negocio', headline: 'Gestión de equipo, asignación de cuadrillas, registro de actividad y Everitt AI.', features: ['Todo lo de Pro', 'Gestión de equipo y cuadrillas', 'Asignación de trabajos', 'Registro de actividad', 'Redacción y análisis con Everitt AI'], limits: ['150 trabajos activos', '1.000 clientes', '15 usuarios'] },
    starter: { name: 'Inicial', headline: 'Límites más altos para equipos en crecimiento.', features: ['Todo lo de Negocio', 'Más trabajos y clientes', 'Más miembros del equipo', 'Everitt AI incluido', 'Funciones básicas para varias ubicaciones'], limits: ['500 trabajos activos', '5.000 clientes', '50 usuarios'] },
    growth: { name: 'Crecimiento', headline: 'Flujos de trabajo, portales, acceso API y soporte prioritario.', features: ['Todo lo de Inicial', 'Flujos de trabajo', 'Portales para clientes y contratistas', 'Departamentos', 'Acceso API'], limits: ['2.500 trabajos activos', '25.000 clientes', '250 usuarios'] },
    enterprise: { name: 'Empresa', headline: 'Escala ilimitada, Everitt AI sin límite y soporte dedicado.', features: ['Todo lo de Crecimiento', 'Everitt AI sin límite', 'Permisos empresariales', 'Soporte dedicado', 'Trabajos, clientes y usuarios sin límite'], limits: ['Trabajos sin límite', 'Clientes sin límite', 'Usuarios sin límite'] }
  },
  vi: {
    free: { name: 'Miễn phí', headline: 'Theo dõi công việc và khách hàng mà không cần bảng tính.', features: ['Tài khoản và đăng nhập', 'Bảng điều khiển', 'Quản lý khách hàng', 'Theo dõi công việc cơ bản', 'Lịch và thông báo'], limits: ['3 công việc đang hoạt động', '10 khách hàng', '20 ảnh', '1 người dùng'] },
    pro: { name: 'Pro', headline: 'Ảnh trước/sau, đặt lịch và quản lý công việc chuyên nghiệp.', features: ['Mọi tính năng của Miễn phí', 'Đặt lịch và cuộc hẹn', 'Ảnh trước và sau', 'Nhiều công việc và khách hàng hơn', 'Tìm kiếm Ask Everitt trên mọi gói'], limits: ['25 công việc đang hoạt động', '100 khách hàng', '100 ảnh', '3 người dùng'] },
    business: { name: 'Doanh nghiệp', headline: 'Quản lý nhóm, phân công đội, nhật ký hoạt động và Everitt AI.', features: ['Mọi tính năng của Pro', 'Quản lý nhóm và đội', 'Phân công công việc', 'Nhật ký hoạt động', 'Viết và phân tích bằng Everitt AI'], limits: ['150 công việc đang hoạt động', '1.000 khách hàng', '15 người dùng'] },
    starter: { name: 'Khởi đầu', headline: 'Giới hạn cao hơn cho đội ngũ đang phát triển.', features: ['Mọi tính năng của Doanh nghiệp', 'Giới hạn công việc và khách hàng cao hơn', 'Thêm thành viên nhóm', 'Bao gồm Everitt AI', 'Cơ bản cho nhiều địa điểm'], limits: ['500 công việc đang hoạt động', '5.000 khách hàng', '50 người dùng'] },
    growth: { name: 'Tăng trưởng', headline: 'Quy trình, cổng thông tin, quyền truy cập API và hỗ trợ ưu tiên.', features: ['Mọi tính năng của Khởi đầu', 'Quy trình làm việc', 'Cổng khách hàng và nhà thầu', 'Phòng ban', 'Quyền truy cập API'], limits: ['2.500 công việc đang hoạt động', '25.000 khách hàng', '250 người dùng'] },
    enterprise: { name: 'Tập đoàn', headline: 'Quy mô không giới hạn, Everitt AI không giới hạn và hỗ trợ riêng.', features: ['Mọi tính năng của Tăng trưởng', 'Everitt AI không giới hạn', 'Quyền cấp doanh nghiệp', 'Hỗ trợ riêng', 'Không giới hạn công việc, khách hàng và người dùng'], limits: ['Công việc không giới hạn', 'Khách hàng không giới hạn', 'Người dùng không giới hạn'] }
  }
};

const uiCopy = {
  en: { popular: 'Popular', storePrice: 'Store price shown at purchase', limits: 'plan limits', choose: 'Choose', unavailable: 'Unavailable', manage: 'Manage subscription', opening: 'Opening…', renewStore: 'Subscriptions renew automatically until canceled in the App Store or Google Play. Deleting your EverittOS account does not cancel a store subscription.', renewWeb: 'Subscriptions renew monthly until canceled.' },
  es: { popular: 'Popular', storePrice: 'El precio de la tienda se muestra al comprar', limits: 'límites del plan', choose: 'Elegir', unavailable: 'No disponible', manage: 'Administrar suscripción', opening: 'Abriendo…', renewStore: 'Las suscripciones se renuevan automáticamente hasta que las canceles en App Store o Google Play. Eliminar tu cuenta de EverittOS no cancela una suscripción de la tienda.', renewWeb: 'Las suscripciones se renuevan mensualmente hasta que se cancelen.' },
  vi: { popular: 'Phổ biến', storePrice: 'Giá trên cửa hàng sẽ hiển thị khi mua', limits: 'giới hạn gói', choose: 'Chọn', unavailable: 'Không khả dụng', manage: 'Quản lý gói đăng ký', opening: 'Đang mở…', renewStore: 'Gói đăng ký tự động gia hạn cho đến khi bạn hủy trong App Store hoặc Google Play. Xóa tài khoản EverittOS không hủy gói đăng ký trên cửa hàng.', renewWeb: 'Gói đăng ký gia hạn hàng tháng cho đến khi bị hủy.' }
} as const;

const shellStyle: CSSProperties = { width: '100%', maxWidth: '100%', minWidth: 0, overflow: 'visible' };
const introStyle: CSSProperties = { display: 'grid', gap: 6, margin: '0 0 18px', maxWidth: 760 };
const gridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 18, width: '100%', minWidth: 0, alignItems: 'stretch' };
const cardStyle: CSSProperties = { display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: '100%', padding: 22, border: '1px solid rgba(37, 54, 74, 0.14)', borderRadius: 18, background: '#fff', boxShadow: '0 12px 32px rgba(37, 54, 74, 0.06)', overflow: 'hidden' };
const mainStyle: CSSProperties = { display: 'flex', flex: '1 1 auto', minWidth: 0, flexDirection: 'column' };
const badgeRowStyle: CSSProperties = { minHeight: 24, marginBottom: 8 };
const badgeStyle: CSSProperties = { display: 'inline-flex', width: 'fit-content', borderRadius: 999, border: '1px solid rgba(47, 95, 143, 0.18)', background: 'rgba(47, 95, 143, 0.07)', color: 'var(--accent)', padding: '3px 9px', fontSize: 11, fontWeight: 600, lineHeight: 1.35 };
const priceStyle: CSSProperties = { margin: '0 0 8px', color: 'var(--text)', fontSize: 22, fontWeight: 650, lineHeight: 1.2 };
const headlineStyle: CSSProperties = { margin: '0 0 14px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 };
const featuresStyle: CSSProperties = { display: 'grid', gap: 9, margin: 0, padding: '0 0 0 18px', color: 'var(--text)', fontSize: 13, lineHeight: 1.45 };
const limitsStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(37, 54, 74, 0.08)' };
const limitStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 28, padding: '5px 9px', border: '1px solid rgba(37, 54, 74, 0.1)', borderRadius: 999, background: 'rgba(37, 54, 74, 0.035)', color: 'var(--muted)', fontSize: 11, lineHeight: 1.3 };
const footerStyle: CSSProperties = { display: 'grid', gap: 10, marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(37, 54, 74, 0.1)' };
const noteStyle: CSSProperties = { margin: 0, color: 'var(--muted)', fontSize: 13, lineHeight: 1.55, overflowWrap: 'anywhere' };
const currentStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, margin: 0, borderRadius: 12, border: '1px solid rgba(37, 54, 74, 0.12)', background: 'rgba(37, 54, 74, 0.035)', color: 'var(--muted)', fontSize: 13, fontWeight: 600, lineHeight: 1.2 };
const footnotesStyle: CSSProperties = { display: 'grid', gap: 6, marginTop: 22, paddingTop: 16, borderTop: '1px solid rgba(37, 54, 74, 0.1)' };

export function BillingPlansGrid({ currentPlan, highlightPlan, hasActiveSubscription = false, portalAvailable = false, onOpenPortal, portalLoading = false, onNativePurchaseSuccess }: BillingPlansGridProps) {
  const { t, locale } = useTranslation();
  const language: 'en' | 'es' | 'vi' = locale === 'es' || locale === 'vi' ? locale : 'en';
  const c = uiCopy[language];
  const normalizedCurrent = normalizePlan(currentPlan);
  const isFreeUser = normalizedCurrent === 'free';
  const billingVisibility = resolveBillingVisibility();
  const visiblePlans = billingVisibility.allowNativeStorePurchase
    ? BILLING_PLANS.filter((tier) => tier.id === 'free' || tier.id === 'pro' || tier.id === 'business')
    : BILLING_PLANS;
  const [checkoutAvailableByPlan, setCheckoutAvailableByPlan] = useState<Partial<Record<PaidPlanKey, boolean>>>({});

  useEffect(() => {
    if (!billingVisibility.allowCheckout) return;
    let cancelled = false;
    async function loadCapabilities() {
      const res = await fetch('/api/stripe/capabilities', { cache: 'no-store' });
      const json = (await res.json().catch(() => ({}))) as { plans?: Partial<Record<PaidPlanKey, { checkoutAvailable?: boolean }>> };
      if (cancelled || !json.plans) return;
      const next: Partial<Record<PaidPlanKey, boolean>> = {};
      for (const [plan, config] of Object.entries(json.plans)) next[plan as PaidPlanKey] = Boolean(config?.checkoutAvailable);
      setCheckoutAvailableByPlan(next);
    }
    void loadCapabilities();
    return () => { cancelled = true; };
  }, [billingVisibility.allowCheckout]);

  return (
    <section className="billing-plans-grid-wrap" style={shellStyle}>
      <div style={introStyle}><p style={noteStyle}>{t('billing.planChangeIntro')}</p></div>
      <div className="billing-plans-grid" style={gridStyle}>
        {visiblePlans.map((tier) => {
          const localized = planCopy[language][tier.id];
          const ui = resolveBillingPlanCardUi({ currentPlan: normalizedCurrent, targetPlan: tier.id, hasActiveSubscription: isFreeUser ? false : hasActiveSubscription, portalAvailable, checkoutAvailableByPlan });
          const isCurrent = ui.kind === 'current';
          const isHighlighted = highlightPlan === tier.id;
          const emphasizedCardStyle = isCurrent || isHighlighted ? { ...cardStyle, borderColor: 'rgba(47, 95, 143, 0.36)', boxShadow: '0 0 0 1px rgba(47, 95, 143, 0.16), 0 14px 34px rgba(37, 54, 74, 0.07)' } : cardStyle;
          const price = language === 'en' ? tier.priceLabel : tier.priceLabel.replace('/month', language === 'es' ? '/mes' : '/tháng');
          const actionLabel = ui.kind === 'current' ? t('billing.currentPlanBadge') : ui.kind === 'portal' ? c.manage : ui.kind === 'unavailable' ? c.unavailable : `${c.choose} ${localized.name}`;
          return (
            <article key={tier.id} className={['pricing-plan-card','billing-plan-card',isCurrent ? 'current-plan' : '',isHighlighted ? 'highlighted' : '',tier.featured ? 'featured-plan' : ''].filter(Boolean).join(' ')} data-plan-id={tier.id} data-plan-action={ui.kind} style={emphasizedCardStyle}>
              <div className="billing-plan-card-body" style={mainStyle}>
                <div style={badgeRowStyle}>{isCurrent ? <span style={badgeStyle}>{t('billing.currentPlanBadge')}</span> : null}{tier.featured && !isCurrent ? <span style={badgeStyle}>{c.popular}</span> : null}</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 18, lineHeight: 1.25 }}>{localized.name}</h3>
                {billingVisibility.showUpgradePrices && !billingVisibility.allowNativeStorePurchase ? <p className="pricing-plan-price" style={priceStyle}>{price}</p> : null}
                {billingVisibility.allowNativeStorePurchase && (tier.id === 'pro' || tier.id === 'business') ? <p className="pricing-plan-price" style={priceStyle}>{c.storePrice}</p> : null}
                <p className="billing-plan-headline" style={headlineStyle}>{localized.headline}</p>
                <ul className="billing-plan-features" style={featuresStyle}>{localized.features.map((feature) => <li key={feature} style={{ margin: 0, overflowWrap: 'anywhere' }}>{feature}</li>)}</ul>
                <div className="billing-plan-limits" aria-label={`${localized.name} ${c.limits}`} style={limitsStyle}>{localized.limits.map((limit) => <span key={limit} style={limitStyle}>{limit}</span>)}</div>
              </div>
              <div className="billing-plan-card-footer" style={footerStyle}>
                {ui.kind === 'current' ? <p className="billing-plan-current-label" style={currentStyle}>{actionLabel}</p> : null}
                {ui.kind === 'checkout' && billingVisibility.allowCheckout ? <PlanCheckoutButton plan={ui.plan} label={actionLabel} requireRefundAck={false} disabled={!ui.checkoutAvailable} className="btn btn-primary btn-block" /> : null}
                {ui.kind === 'checkout' && billingVisibility.allowNativeStorePurchase && (ui.plan === 'pro' || ui.plan === 'business') ? <NativeStoreSubscribeButton plan={ui.plan} label={actionLabel} onSuccess={() => onNativePurchaseSuccess?.()} /> : null}
                {ui.kind === 'checkout' && !billingVisibility.allowCheckout && !billingVisibility.allowNativeStorePurchase ? <p className="billing-plan-current-label" style={currentStyle}>{nativeBillingNotice(locale)}</p> : null}
                {ui.kind === 'unavailable' ? <p className="billing-plan-current-label" style={currentStyle}>{actionLabel}</p> : null}
                {ui.kind === 'portal' && onOpenPortal && billingVisibility.allowPortal ? <button type="button" className="btn btn-primary btn-block" disabled={portalLoading} onClick={onOpenPortal}>{portalLoading ? c.opening : actionLabel}</button> : null}
                {ui.kind === 'downgrade_contact' ? <a className="btn btn-block" href={ui.href}>{actionLabel}</a> : null}
              </div>
            </article>
          );
        })}
      </div>
      {billingVisibility.showWebBillingNotice ? <p className="billing-native-notice" style={noteStyle}>{nativeBillingNotice(locale)}</p> : null}
      {!portalAvailable && hasActiveSubscription && !isFreeUser ? <p className="billing-support-fallback">{t('billing.planChangesSupport')}{' '}<a href={supportMailtoHref('EverittOS billing')}>{SUPPORT_EMAIL}</a></p> : null}
      <footer className="billing-plans-footnote-group" style={footnotesStyle}>
        <p className="billing-plans-footnote" style={noteStyle}>{billingVisibility.allowNativeStorePurchase ? c.renewStore : c.renewWeb}</p>
        <p className="billing-plans-footnote billing-legal-links" style={noteStyle}><Link href="/terms">{t('legal.terms')}</Link> · <Link href="/privacy">{t('legal.privacy')}</Link></p>
      </footer>
    </section>
  );
}
