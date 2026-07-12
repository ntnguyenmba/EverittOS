'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OsModulePage } from '@/components/os-module-page';
import { fetchOrganizationContext } from '@/lib/organization';
import { limitsForPlan } from '@/lib/everittos-limits';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type Doc = { id: string; title: string; category: string; updated_at: string | null }