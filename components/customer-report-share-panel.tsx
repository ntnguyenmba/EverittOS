'use client';

type CustomerReportSharePanelProps = {
  jobId: string;
  canManage: boolean;
};

/**
 * Customer reports were retired from EverittOS.
 * Keep this compatibility component temporarily so older job pages compile while
 * the surrounding legacy report block is hidden from every role.
 */
export function CustomerReportSharePanel(_props: CustomerReportSharePanelProps) {
  return (
    <>
      <span className="retired-customer-report-panel" hidden aria-hidden="true" />
      <style