'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCurrency, type DashboardRevenueMetrics } from '@/lib/dashboard-metrics';
import { scopeJobsForWorkspace } from '@/lib/jobs-query';
import { supabase } from '@/lib/supabase';

type BriefCounts = {
  overdueJobs: number;
  unpaidInvoices: number;
  leadsNeedingFollow