import { NextResponse } from 'next/server';
import { sendAssignmentNotification } from '@/lib/assignment-notifications';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { buildCustomerUpdatePayload, customerDisplayName } from '@/lib/customer-record';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const VALID_RECORD