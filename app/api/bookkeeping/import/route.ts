import { NextResponse } from 'next/server';
import { buildBookkeepingImportTemplateCsv, detectBookkeepingImportDuplicates, parseBookkeepingImportCsv, type BookkeepingImportDecision } from '@/lib/bookkeeping-import';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  return new NextResponse(buildBookkeepingImportTemplateCsv(), {
    status: 200,
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="everittos-bookkeeping-import-template.csv"' }
  });
}

export async function POST(request: Request) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  const body = (await request.json().catch(() => ({}))) as { csv?: string; preview?: boolean; decisions?: Record<string, BookkeepingImportDecision> };
  const csv = String(body.csv || '');
  if (!csv.trim()) return NextResponse.json({ error: 'csv_required' }, { status: 400 });
  const parsed = parseBookkeepingImportCsv(csv);
  if (parsed.fatalError) return NextResponse.json({ error: parsed.fatalError }, { status: 400 });
  const { data: existing, error: existingError } = await ctx.supabase.from('bookkeeping_entries').select('entry_type, entry_date, amount, title, counterparty').eq('organization_id', ctx.workspace.organizationId).limit(10000);
  if (existingError) return NextResponse.json({ error: 'load_failed' }, { status: 500 });
  const rows = detectBookkeepingImportDuplicates(parsed.rows, existing || []);
  if (body.preview !== false) {
    return NextResponse.json({ preview: true, rows, summary: { total: rows.length, valid: rows.filter((r) => !r.errors.length).length, invalid: rows.filter((r) => r.errors.length).length, duplicates: rows.filter((r) => r.duplicateKind).length } });
  }
  const decisions = body.decisions || {};
  let imported = 0;
  let skipped = 0;
  const failed: Array<{ rowNumber: number; error: string }> = [];
  for (const row of rows) {
    if (row.errors.length) { failed.push({ rowNumber: row.rowNumber, error: row.errors[0] }); continue; }
    const decision: BookkeepingImportDecision = row.duplicateKind ? decisions[String(row.rowNumber)] || 'skip' : 'create';
    if (row.duplicateKind && decision === 'skip') { skipped += 1; continue; }
    const { error } = await ctx.supabase.from('bookkeeping_entries').insert({ organization_id: ctx.workspace.organizationId, entry_type: row.entryType, entry_date: row.entryDate, amount: row.amount, title: row.title || null, counterparty: row.counterparty || null, category: row.category || null, payment_method: row.paymentMethod || null, notes: row.notes || null, created_by: ctx.userId });
    if (error) failed.push({ rowNumber: row.rowNumber, error: error.message }); else imported += 1;
  }
  return NextResponse.json({ preview: false, summary: { imported, skipped, failed: failed.length }, failed });
}
