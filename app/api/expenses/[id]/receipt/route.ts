import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { isValidUuid } from '@/lib/input-validation';
import { ALLOWED_IMAGE_MIME_TYPES, MAX_UPLOAD_BYTES } from '@/lib/upload-security';
import { createAdminSupabase } from '@/lib/supabase-admin';

type RouteParams = { params: Promise<{ id: string }> };

const RECEIPT_MIME = new Set<string>([...Array.from(ALLOWED_IMAGE_MIME_TYPES), 'application/pdf']);

export async function POST(request: Request, { params }: RouteParams) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { id } = await params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid expense id' }, { status: 400 });
  }

  const { data: expense } = await ctx.supabase
    .from('expenses')
    .select('id, receipt_url')
    .eq('id', id)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();

  if (!expense) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Receipt file is required' }, { status: 400 });
  }

  if (!RECEIPT_MIME.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'File is too large (max 10 MB)' }, { status: 400 });
  }

  const ext = file.type === 'application/pdf' ? 'pdf' : file.type.includes('png') ? 'png' : 'jpg';
  const storagePath = `${ctx.userId}/${id}/receipt-${Date.now()}.${ext}`;

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  if (expense.receipt_url) {
    await admin.storage.from('expense-receipts').remove([expense.receipt_url]);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from('expense-receipts').upload(storagePath, buffer, {
    contentType: file.type,
    upsert: false
  });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  const { data: updated, error } = await ctx.supabase
    .from('expenses')
    .update({ receipt_url: storagePath })
    .eq('id', id)
    .eq('organization_id', ctx.organizationId)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: signed } = await admin.storage.from('expense-receipts').createSignedUrl(storagePath, 3600);

  return NextResponse.json({
    expense: updated,
    receipt_signed_url: signed?.signedUrl || null
  });
}
