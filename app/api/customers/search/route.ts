import { NextResponse } from 'next/server';
import { CUSTOMER_LIST_SELECT, customerDisplayName } from '@/lib/customer-record';
import { propertyDisplayAddress } from '@/lib/customer-property';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';

export const runtime = 'nodejs';
export