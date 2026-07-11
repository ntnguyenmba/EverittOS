'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import { fetchDashboardRevenueMetrics, formatCurrency, type DashboardDateRange, type DashboardRevenueMetrics } from '@/lib/dashboard-metrics';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { supabase } from '@/lib/supabase';

type DashboardRevenueSnapshotProps = {
  metrics: DashboardRevenueMetrics;
  loading?: boolean;