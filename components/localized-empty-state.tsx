'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/locale-provider';
import { EmptyState } from '@/components/empty-state';

export type EmptyKey =
  | 'jobs'
  | 'customers'
  | 'leads'
  | 'schedule'
  | 'workers'
  | 'reviews'
  | 'forms'
  | 'templates'
  | 'expenses'
  | 'invoices'
  | 'analytics'
  | 'activity'
  | '