'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ContactLink } from '@/components/contact-link';
import { CustomerLogo } from '@/components/customer-logo';
import { RecordSharingPanel } from '@/components/record-sharing-panel';
import { fetchOrganizationContext } from '@/lib/organization';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { customerDisplayAddress, customerDisplayName, type CustomerRecord } from '@/lib/customer-record';
import { uploadCustomerLogo } from '@/lib/customer-logo';
import { useTeamOptions } from '@/lib/team-options-client';
import { supabase } from '@/lib/supabase';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { FEEDBACK } from '@/lib/feedback-label