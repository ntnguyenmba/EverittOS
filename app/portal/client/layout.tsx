import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';

type ClientLayoutProps = { children: ReactNode };

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <AppShell role="client" showBackButton={false}>
      {children}
    </AppShell>
  );
}
