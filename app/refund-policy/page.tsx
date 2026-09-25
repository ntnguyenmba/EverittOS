'use client';

import Link from 'next/link';
import { LegalNotice } from '@/components/legal-notice';
import { useTranslation } from '@/components/locale-provider';
import { TERMS_VERSION } from '@/lib/legal-versions';
import { SUPPORT_EMAIL } from '@/lib/support';

const copy = {
  en: { title: 'Refund Policy', part: 'Part of', terms: 'Terms of Service', version: 'Version', updated: 'Last updated June 2026', body: 'Refund eligibility is governed by the EverittOS Terms of Service and applicable law.', cancelTitle: 'Cancellation', cancel: 'You may cancel your subscription from billing settings or the Stripe customer portal. Cancellation stops future renewals according to the billing terms.', relatedTitle: 'Related policies', privacy: 'Privacy Policy', plans: 'Plans & billing', contact: 'Contact', billing: 'Billing questions', back: 'Back to login' },
  es: { title: 'Política de reembolsos', part: 'Parte de', terms: 'Términos de servicio', version: 'Versión', updated: 'Última actualización: junio de 2026', body: 'La elegibilidad para reembolsos se rige por los Términos de servicio de EverittOS y la ley aplicable.', cancelTitle: 'Cancelación', cancel: 'Puedes cancelar tu suscripción desde la configuración de facturación o el portal de clientes de Stripe. La cancelación detiene futuras renovaciones según los términos de facturación.', relatedTitle: 'Políticas relacionadas', privacy: 'Política de privacidad', plans: 'Planes y facturación', contact: 'Contacto', billing: 'Preguntas de facturación', back: 'Volver al inicio de sesión' },
  vi: { title: 'Chính sách hoàn tiền', part: 'Thuộc', terms: 'Điều khoản dịch vụ', version: 'Phiên bản', updated: 'Cập nhật lần cuối: tháng 6 năm 2026', body: 'Điều kiện hoàn tiền được điều chỉnh bởi Điều khoản dịch vụ của EverittOS và pháp luật hiện hành.', cancelTitle: 'Hủy đăng ký', cancel: 'Bạn có thể hủy gói đăng ký trong cài đặt thanh toán hoặc cổng khách hàng Stripe. Việc hủy sẽ dừng gia hạn trong tương lai theo điều khoản thanh toán.', relatedTitle: 'Chính sách liên quan', privacy: 'Chính sách quyền riêng tư', plans: 'Gói & thanh toán', contact: 'Liên hệ', billing: 'Câu hỏi về thanh toán', back: 'Quay lại đăng nhập' }
} as const;

export default function RefundPolicyPage() {
  const { locale } = useTranslation();
  const c = copy[locale] || copy.en;
  return <main className="section eo-document"><div className="container legal-document" style={{ maxWidth: 720 }}><h2>{c.title}</h2><p className="muted">{c.part} <Link href="/terms">{c.terms}</Link> · {c.version} {TERMS_VERSION} · {c.updated}</p><p>{c.body}</p><h3>{c.cancelTitle}</h3><p>{c.cancel}</p><h3>{c.relatedTitle}</h3><p><Link href="/terms">{c.terms}</Link> · <Link href="/privacy">{c.privacy}</Link> · <Link href="/settings/billing">{c.plans}</Link></p><h3>{c.contact}</h3><p>{c.billing}: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p><LegalNotice /><Link className="btn" href="/login">{c.back}</Link></div></main>;
}
