import type { ReactNode } from 'react';
import './contractor-minimal.css';

type ContractorLayoutProps = {
  children: ReactNode;
};

export default function ContractorLayout({ children }: ContractorLayoutProps) {
  return <div className="contractor-portal-shell">{children}</div>;
}
