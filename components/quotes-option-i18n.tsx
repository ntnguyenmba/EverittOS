'use client';

import { useEffect } from 'react';
import { useTranslation } from '@/components/locale-provider';
import { getQuoteFieldCopy } from '@/lib/quote-field-copy';

const OPTION_MAP: Record<string, keyof ReturnType<typeof getQuoteFieldCopy>> = {
  'sq ft': 'unitSqft',
  hours: 'unitHours',
  rooms: 'unitRooms',
  items: 'unitItems',
  loads: 'unitLoads',
  'linear ft': 'unitLinear',
  acres: 'unitAcres',
  properties: 'unitProperties',
  vehicles: 'unitVehicles',
  units: 'unitUnits',
  Light: 'light',
  Average: 'average',
  Heavy: 'heavy',
  'Post-construction': 'postConstruction',
  'One-time': 'oneTime',
  Weekly: 'weekly',
  'Every 2 weeks': 'biWeekly',
  Monthly: 'monthly'
};

export function QuotesOptionI18n() {
  const { locale } = useTranslation();
  const copy = getQuoteFieldCopy(locale);

  useEffect(() => {
    const root = document.querySelector('.quote-workspace');
    if (!root) return;
    root.querySelectorAll('select option').forEach((option) => {
      const key = OPTION_MAP[option.textContent?.trim() || ''];
      if (key) option.textContent = copy[key];
    });
    root.querySelectorAll('summary').forEach((summary) => {
      if (summary.textContent?.trim() === 'Pricing inputs') summary.textContent = copy.pricingInputs;
    });
  }, [copy]);

  return null;
}
