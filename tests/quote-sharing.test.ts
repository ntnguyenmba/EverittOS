import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read=(path:string)=>readFileSync(path,'utf8');

test('quote sharing is localized and tier gated',()=>{
  const page=read('app/quotes/page.tsx');
  const share=read('app/api/quotes/[id]/share/route.ts');
  const publicPage=read('app/q/[token]/page.tsx');
  const copy=read('lib/i18n/quote-share-copy.ts');
  assert.match(page,/getQuoteShareCopy/);
  assert.match(page,/meetsMinimumPlan/);
  assert.match(share,/requiredPlan: 'pro'/);
  assert.match(copy,/en:/);
  assert.match(copy,/es:/);
  assert.match(copy,/vi:/);
  assert.match(publicPage,/getQuoteShareCopy/);
});

test('public quote response uses token RPC instead of exposing org rows',()=>{
  const api=read('app/api/public/quotes/[token]/route.ts');
  const migration=read('supabase/migrations/202609200001_quote_public_response.sql');
  assert.match(api,/get_public_quote/);
  assert.match(api,/respond_public_quote/);
  assert.match(migration,/security definer/);
  assert.match(migration,/quotes_public_token_uidx/);
  assert.match(migration,/grant execute .* anon, authenticated/);
});

test('public quote visual layer uses centralized EverittOS primitives',()=>{
  const page=read('app/q/[token]/page.tsx');
  const primitives=read('app/design/primitives.css');
  assert.match(page,/eo-card/);
  assert.match(page,/eo-btn-primary/);
  assert.match(primitives,/\.eo-public-quote/);
  assert.match(primitives,/var\(--eo-color-page\)/);
  assert.match(primitives,/var\(--eo-color-border\)/);
});
