'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AddressAutocomplete } from '@/components/address-autocomplete';
import { supabase } from '@/lib/supabase';
import { Button } from './ui/button';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { fetchUsageCounts, limitMessage } from '@/lib/everittos-usage';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { FEEDBACK } from '@/lib/feedback-labels';
import { validatePlanAction } from '@/lib/plan-validate';
import { ensureWorkspaceForSave } from '@/lib/workspace-client';
import { compressImageFile } from '@/lib/image-compress';
import { insertJobPhotoRow } from '@/lib/job-photos-client';
import { buildSafePhotoStoragePath, validateImageUpload } from '@/lib/upload-security';
import { wallClockDateTime } from '@/lib/schedule-times';
import { TIME_ZONE_OPTIONS } from '@/lib/time-zones';
import type { StructuredAddress } from '@/lib/address/types';
import { PROPERTY_TYPE_LABELS, type PropertyType } from '@/lib/customer-property';
import { calculateExpectedJobFinance, multiplyMoneyDollars, parseMoneyDollars } from '@/lib/money-decimal';
import { getBillingOpsCopy } from '@/lib/i18n/billing-ops-copy';
import { getJobCreateCopy } from '@/lib/i18n/job-create-copy';
import { getRecurrenceCopy } from '@/lib/i18n/recurrence-copy';
import {
  RECURRING_GENERATION_WINDOW_DAYS,
  summarizeRecurrenceForLocale,
  type RecurrenceEndMode,
  type RecurrenceFrequency,
  type RecurrenceIntervalUnit
} from '@/lib/recurring-jobs';
