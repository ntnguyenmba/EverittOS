import { QuotesOptionI18n } from '@/components/quotes-option-i18n';

export default function QuotesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <QuotesOptionI18n />
    </>
  );
}
