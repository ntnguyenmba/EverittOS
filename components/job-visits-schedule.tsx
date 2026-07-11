'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';

export type JobVisitRow = {
  id?: string;
  visit_date: string;
  start_time: string;
  end_time: string;
  notes?: string | null;
};

type JobVisitsScheduleProps = {
  jobId: string;
  organizationId: string | null;
  canManage: boolean