'use client';

import { useTranslation } from '@/components/locale-provider';
import { SUPPORT_EMAIL } from '@/lib/support';

const copy = {
  en: 'EverittOS provides business operations software and does not provide legal, tax, accounting, employment, insurance, financial, or regulatory advice. Questions:',
  es: 'EverittOS proporciona software para operaciones empresariales y no ofrece asesoría legal, fiscal, contable, laboral, de seguros, financiera ni regulatoria. Preguntas:',
  vi: 'EverittOS cung cấp phần mềm vận hành doanh nghiệp và không cung cấp tư vấn pháp lý, thuế, kế toán, lao động, bảo hiểm, tài chính hoặc quy định. Câu hỏi:'
} as const;

export function LegalNotice() {
  const { locale } = useTranslation();
  const text = copy[locale] || copy.en;
  return <p className="muted" style={{ marginTop: '1.5rem' }}>{text} <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>;
}
