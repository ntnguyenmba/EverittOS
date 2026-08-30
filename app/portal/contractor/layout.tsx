import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';

type ContractorLayoutProps = { children: ReactNode };

export default function ContractorLayout({ children }: ContractorLayoutProps) {
  return (
    <AppShell role="contractor" showBackButton>
      {children}
    </AppShell>
  );
}
