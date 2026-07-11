'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { supabase } from '@/lib/supabase';

type PersonalWorkMetricsProps = {
  role: string;
};

type JobRow = {
  id: string;
  user_id: string | null;
  assigned_to: string | null;
  status: string | null;
  created_at: string | null;
  start_date: string | null;
  completed_at: string | null;
};

type