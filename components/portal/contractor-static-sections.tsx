'use client';

import { useEffect } from 'react';

export function ContractorStaticSections() {
  useEffect(() => {
    let scheduled = false;

    const applyLayout = () => {
      scheduled = false;
      const dashboard = document.querySelector('.contractor-dashboard');
      const past = dashboard?.querySelector('#past-jobs');
      const earnings = dashboard?.querySelector('#earnings');
      if (!(past instanceof HTML