import type { ReactNode } from 'react';
import { ContractorLoadingGuard } from '@/components/contractor-loading-guard';
import './contractor-minimal.css';

type ContractorLayoutProps = {
  children: ReactNode;
};

export default function ContractorLayout({ children }: ContractorLayoutProps) {
  return (
    <>
      {children}
      <ContractorLoadingGuard />
    </>
  );
}
