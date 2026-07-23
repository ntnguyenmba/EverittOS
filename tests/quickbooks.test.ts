import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  createQuickBooksOAuthState,
  verifyQuickBooksOAuthState,
  quickbooksRedirectUri,
  quickbooksConfigured,
  quickbooksBaseUrl,
  extractIntuitTid,
  parseQuickBooksError,
  escapeQuickBooksQueryValue,
  accessTokenNeedsRefresh,
  refreshAccessToken,
  QuickBooksApiError,
  buildQuickBooksCustomerPayload,
  buildQuickBooksInvoicePayload,
  syncCustomerToQuickBooks,
  exportInvoiceToQuickBooks
} from '@/lib/quickbooks';
import type { QuickBooksConnectionRecord } from '@/lib/quickbooks/client';
import { canManageOrganizationSettings, isManagerRole } from '@/lib/roles';

const ORG_A = '00000000-0000-4000-8000-0000000000aa';
const ORG_B = '00000000-0000-4000-8000-0000000000bb';
const USER = '00000000-0000-4000-8000-0000000000cc';
const CUSTOMER_ID = '00000000-0000-4000-8000-0000000000dd';
const INVOICE_ID = '00000000-0000-4000-8000-0000000000ee';

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) }
  });
}

describe('quickbooks oauth state', () => {
  const prev = process.env.QUICKBOOKS_STATE_SECRET;

  beforeEach(() => {
    process.env.QUICKBOOKS_STATE_SECRET = 'test-state-secret-value';
  });

  afterEach(() => {
    process.env.QUICKBOOKS_STATE_SECRET = prev;
  });

  it('creates and verifies signed state', () => {
    const state = createQuickBooksOAuthState(USER, ORG_A);
    const payload = verifyQuickBooksOAuthState(state);
    assert.ok(payload);
    assert.equal(payload.userId, USER);
    assert.equal(payload.organizationId, ORG_A);
    assert.ok(payload.nonce);
    assert.ok(payload.issuedAt);
  });

  it('rejects tampered state', () => {
    const state = createQuickBooksOAuthState(USER, ORG_A);
    assert.equal(verifyQuickBooksOAuthState(`${state}x`), null);
    assert.equal(verifyQuickBooksOAuthState(state.replace(/\./, '.a')), null);
  });

  it('rejects expired state', () => {
    const state = createQuickBooksOAuthState(USER, ORG_A);
    assert.equal(verifyQuickBooksOAuthState(state, 0), null);
  });

  it('rejects malformed state', () => {
    assert.equal(verifyQuickBooksOAuthState('not-valid'), null);
    assert.equal(verifyQuickBooksOAuthState(''), null);
  });
});

describe('quickbooks redirect URI consistency', () => {
  const prevApp = process.env.NEXT_PUBLIC_APP_URL;
  const prevRedirect = process.env.QUICKBOOKS_REDIRECT_URI;

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = prevApp;
    process.env.QUICKBOOKS_REDIRECT_URI = prevRedirect;
  });

  it('uses the same helper path for authorize and exchange', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.everittventures.com';
    process.env.QUICKBOOKS_REDIRECT_URI =
      'https://app.everittventures.com/api/integrations/quickbooks/callback';
    assert.equal(
      quickbooksRedirectUri(),
      'https://app.everittventures.com/api/integrations/quickbooks/callback'
    );
  });

  it('falls back when configured redirect does not match app origin', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.everittventures.com';
    process.env.QUICKBOOKS_REDIRECT_URI = 'https://evil.example/callback';
    assert.equal(
      quickbooksRedirectUri(),
      'https://app.everittventures.com/api/integrations/quickbooks/callback'
    );
  });
});

describe('quickbooks environment URLs', () => {
  const prev = process.env.QUICKBOOKS_ENVIRONMENT;

  afterEach(() => {
    process.env.QUICKBOOKS_ENVIRONMENT = prev;
  });

  it('selects sandbox and production base URLs', () => {
    process.env.QUICKBOOKS_ENVIRONMENT = 'sandbox';
    assert.equal(quickbooksBaseUrl(), 'https://sandbox-quickbooks.api.intuit.com');
    process.env.QUICKBOOKS_ENVIRONMENT = 'production';
    assert.equal(quickbooksBaseUrl(), 'https://quickbooks.api.intuit.com');
  });
});

describe('quickbooks configuration', () => {
  it('requires state secret', () => {
    const id = process.env.QUICKBOOKS_CLIENT_ID;
    const secret = process.env.QUICKBOOKS_CLIENT_SECRET;
    const state = process.env.QUICKBOOKS_STATE_SECRET;
    process.env.QUICKBOOKS_CLIENT_ID = 'id';
    process.env.QUICKBOOKS_CLIENT_SECRET = 'secret';
    delete process.env.QUICKBOOKS_STATE_SECRET;
    assert.equal(quickbooksConfigured(), false);
    process.env.QUICKBOOKS_STATE_SECRET = 'state-secret';
    assert.equal(quickbooksConfigured(), true);
    process.env.QUICKBOOKS_CLIENT_ID = id;
    process.env.QUICKBOOKS_CLIENT_SECRET = secret;
    process.env.QUICKBOOKS_STATE_SECRET = state;
  });
});

describe('intuit_tid and error parsing', () => {
  it('extracts intuit_tid from headers', () => {
    const headers = new Headers({ intuit_tid: 'tid-123' });
    assert.equal(extractIntuitTid(headers), 'tid-123');
  });

  it('parses Fault payloads safely', () => {
    const parsed = parseQuickBooksError({
      httpStatus: 400,
      intuitTid: 'tid-9',
      body: {
        Fault: {
          type: 'ValidationFault',
          Error: [{ Message: 'Duplicate Name Exists Error', code: '6240' }]
        }
      }
    });
    assert.equal(parsed.code, '6240');
    assert.equal(parsed.faultType, 'ValidationFault');
    assert.equal(parsed.intuitTid, 'tid-9');
    assert.equal(parsed.retryable, false);
    assert.match(parsed.userMessage, /QuickBooks rejected/i);
  });

  it('marks invalid_grant as reconnect required', () => {
    const parsed = parseQuickBooksError({
      httpStatus: 400,
      body: { error: 'invalid_grant' },
      intuitTid: 'tid-grant'
    });
    assert.equal(parsed.reconnectRequired, true);
    assert.match(parsed.userMessage, /connect again/i);
  });

  it('escapes QuickBooks query values', () => {
    assert.equal(escapeQuickBooksQueryValue("O'Brien"), "O\\'Brien");
  });
});

describe('token refresh', () => {
  const prevId = process.env.QUICKBOOKS_CLIENT_ID;
  const prevSecret = process.env.QUICKBOOKS_CLIENT_SECRET;

  beforeEach(() => {
    process.env.QUICKBOOKS_CLIENT_ID = 'client-id';
    process.env.QUICKBOOKS_CLIENT_SECRET = 'client-secret';
  });

  afterEach(() => {
    process.env.QUICKBOOKS_CLIENT_ID = prevId;
    process.env.QUICKBOOKS_CLIENT_SECRET = prevSecret;
  });

  it('detects near-expiry tokens', () => {
    const connection: QuickBooksConnectionRecord = {
      id: '1',
      organization_id: ORG_A,
      status: 'connected',
      realm_id: 'realm',
      access_token: 'access',
      refresh_token: 'refresh',
      token_expires_at: new Date(Date.now() + 30_000).toISOString(),
      refresh_token_expires_at: null,
      last_sync_at: null,
      last_error: null,
      company_name: null,
      updated_at: null
    };
    assert.equal(accessTokenNeedsRefresh(connection), true);
  });

  it('refreshes successfully', async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse(
        { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 },
        200,
        { intuit_tid: 'tid-refresh' }
      );

    const result = await refreshAccessToken('old-refresh', { fetchImpl });
    assert.equal(result.tokens.access_token, 'new-access');
    assert.equal(result.intuitTid, 'tid-refresh');
  });

  it('surfaces invalid_grant refresh failure', async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse({ error: 'invalid_grant' }, 400, { intuit_tid: 'tid-bad' });

    await assert.rejects(
      () => refreshAccessToken('bad-refresh', { fetchImpl }),
      (error: unknown) => {
        assert.ok(error instanceof QuickBooksApiError);
        assert.equal(error.parsed.code, 'invalid_grant');
        assert.equal(error.parsed.reconnectRequired, true);
        assert.equal(error.parsed.intuitTid, 'tid-bad');
        return true;
      }
    );
  });
});

type MockTable = {
  rows: Record<string, unknown>[];
  updates: Record<string, unknown>[];
  inserts: Record<string, unknown>[];
};

function createMockAdmin(seed: {
  connections?: Record<string, unknown>[];
  customers?: Record<string, unknown>[];
  invoices?: Record<string, unknown>[];
}) {
  const tables: Record<string, MockTable> = {
    quickbooks_connections: { rows: [...(seed.connections || [])], updates: [], inserts: [] },
    customers: { rows: [...(seed.customers || [])], updates: [], inserts: [] },
    invoices: { rows: [...(seed.invoices || [])], updates: [], inserts: [] },
    quickbooks_sync_logs: { rows: [], updates: [], inserts: [] }
  };

  function from(table: string) {
    const store = tables[table];
    let filters: Array<(row: Record<string, unknown>) => boolean> = [];
    let pendingUpdate: Record<string, unknown> | null = null;
    let pendingInsert: Record<string, unknown> | null = null;
    let pendingUpsert: Record<string, unknown> | null = null;

    const api = {
      select() {
        return api;
      },
      eq(column: string, value: unknown) {
        filters.push((row) => row[column] === value);
        return api;
      },
      maybeSingle: async () => {
        const row = store.rows.find((r) => filters.every((fn) => fn(r))) || null;
        return { data: row, error: null };
      },
      update(values: Record<string, unknown>) {
        pendingUpdate = values;
        return api;
      },
      insert(values: Record<string, unknown>) {
        pendingInsert = values;
        store.inserts.push(values);
        store.rows.push(values);
        return Promise.resolve({ data: values, error: null });
      },
      upsert(values: Record<string, unknown>) {
        pendingUpsert = values;
        const orgId = values.organization_id;
        const idx = store.rows.findIndex((r) => r.organization_id === orgId);
        if (idx >= 0) store.rows[idx] = { ...store.rows[idx], ...values };
        else store.rows.push(values);
        return Promise.resolve({ data: values, error: null });
      },
      then(resolve: (value: { data: null; error: null }) => void) {
        if (pendingUpdate) {
          for (const row of store.rows) {
            if (filters.every((fn) => fn(row))) {
              Object.assign(row, pendingUpdate);
              store.updates.push({ ...pendingUpdate });
            }
          }
          pendingUpdate = null;
        }
        if (pendingUpsert) pendingUpsert = null;
        if (pendingInsert) pendingInsert = null;
        resolve({ data: null, error: null });
      }
    };

    return api;
  }

  return {
    from,
    tables,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    asClient: () => ({ from } as any)
  };
}

describe('customer sync', () => {
  it('builds customer payload from Everitt fields', () => {
    const payload = buildQuickBooksCustomerPayload({
      id: CUSTOMER_ID,
      organization_id: ORG_A,
      company_name: "O'Brien Homes",
      email: 'a@example.com',
      phone: '555-0100',
      address_line1: '1 Main',
      city: 'Austin',
      state: 'TX',
      postal_code: '78701'
    });
    assert.equal(payload.DisplayName, "O'Brien Homes");
    assert.equal((payload.PrimaryEmailAddr as { Address: string }).Address, 'a@example.com');
    assert.ok(payload.BillAddr);
  });

  it('creates a customer when none exists and stores external id', async () => {
    const mock = createMockAdmin({
      connections: [
        {
          id: 'c1',
          organization_id: ORG_A,
          status: 'connected',
          realm_id: '123',
          access_token: 'access',
          refresh_token: 'refresh',
          token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
          refresh_token_expires_at: null,
          last_sync_at: null,
          last_error: null,
          company_name: 'Demo Co',
          updated_at: null
        }
      ],
      customers: [
        {
          id: CUSTOMER_ID,
          organization_id: ORG_A,
          company_name: 'Acme',
          email: 'acme@example.com',
          phone: null,
          address_line1: null,
          address_line2: null,
          city: null,
          state: null,
          postal_code: null,
          country: null,
          quickbooks_customer_id: null,
          quickbooks_sync_token: null
        }
      ]
    });

    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes('/query')) {
        return jsonResponse({ QueryResponse: { Customer: [] } }, 200, { intuit_tid: 'tid-q' });
      }
      if (url.includes('/customer')) {
        return jsonResponse(
          { Customer: { Id: 'QB-CUST-1', SyncToken: '0', DisplayName: 'Acme' } },
          200,
          { intuit_tid: 'tid-create' }
        );
      }
      return jsonResponse({ error: 'unexpected' }, 500);
    };

    const result = await syncCustomerToQuickBooks({
      admin: mock.asClient(),
      organizationId: ORG_A,
      userId: USER,
      customerId: CUSTOMER_ID,
      fetchImpl
    });

    assert.equal(result.success, true);
    assert.equal(result.created, true);
    assert.equal(result.externalId, 'QB-CUST-1');
    const updated = mock.tables.customers.rows[0];
    assert.equal(updated.quickbooks_customer_id, 'QB-CUST-1');
    assert.equal(mock.tables.quickbooks_sync_logs.inserts.length, 1);
    assert.equal(mock.tables.quickbooks_sync_logs.inserts[0].status, 'created');
  });

  it('updates an existing QuickBooks customer by stored id', async () => {
    const mock = createMockAdmin({
      connections: [
        {
          id: 'c1',
          organization_id: ORG_A,
          status: 'connected',
          realm_id: '123',
          access_token: 'access',
          refresh_token: 'refresh',
          token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
          refresh_token_expires_at: null,
          last_sync_at: null,
          last_error: null,
          company_name: null,
          updated_at: null
        }
      ],
      customers: [
        {
          id: CUSTOMER_ID,
          organization_id: ORG_A,
          company_name: 'Acme Updated',
          email: 'acme@example.com',
          phone: null,
          address_line1: null,
          address_line2: null,
          city: null,
          state: null,
          postal_code: null,
          country: null,
          quickbooks_customer_id: 'QB-CUST-1',
          quickbooks_sync_token: '0'
        }
      ]
    });

    let postedUpdate = false;
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.includes('/customer/QB-CUST-1') && (!init || init.method === 'GET' || !init.method)) {
        return jsonResponse(
          { Customer: { Id: 'QB-CUST-1', SyncToken: '3', DisplayName: 'Acme' } },
          200,
          { intuit_tid: 'tid-read' }
        );
      }
      if (url.includes('/customer') && init?.method === 'POST') {
        postedUpdate = true;
        const body = JSON.parse(String(init.body)) as { Id?: string; SyncToken?: string };
        assert.equal(body.Id, 'QB-CUST-1');
        assert.equal(body.SyncToken, '3');
        return jsonResponse(
          { Customer: { Id: 'QB-CUST-1', SyncToken: '4', DisplayName: 'Acme Updated' } },
          200,
          { intuit_tid: 'tid-update' }
        );
      }
      return jsonResponse({ error: 'unexpected' }, 500);
    };

    const result = await syncCustomerToQuickBooks({
      admin: mock.asClient(),
      organizationId: ORG_A,
      userId: USER,
      customerId: CUSTOMER_ID,
      fetchImpl
    });

    assert.equal(postedUpdate, true);
    assert.equal(result.updated, true);
    assert.equal(result.externalId, 'QB-CUST-1');
    assert.equal(mock.tables.customers.rows[0].quickbooks_sync_token, '4');
  });

  it('rejects customers outside the organization', async () => {
    const mock = createMockAdmin({
      customers: [
        {
          id: CUSTOMER_ID,
          organization_id: ORG_B,
          company_name: 'Other Org',
          email: null,
          phone: null,
          address_line1: null,
          address_line2: null,
          city: null,
          state: null,
          postal_code: null,
          country: null,
          quickbooks_customer_id: null,
          quickbooks_sync_token: null
        }
      ]
    });

    await assert.rejects(
      () =>
        syncCustomerToQuickBooks({
          admin: mock.asClient(),
          organizationId: ORG_A,
          customerId: CUSTOMER_ID,
          fetchImpl: async () => jsonResponse({})
        }),
      (error: unknown) => error instanceof QuickBooksApiError && error.parsed.httpStatus === 404
    );
  });
});

describe('invoice export', () => {
  it('builds invoice payload without inventing tax codes', () => {
    const payload = buildQuickBooksInvoicePayload({
      invoice: {
        id: INVOICE_ID,
        organization_id: ORG_A,
        customer_id: CUSTOMER_ID,
        amount: 250,
        description: 'Fence repair',
        notes: 'Gate latch',
        invoice_date: '2026-07-01',
        due_date: '2026-07-15'
      },
      customerExternalId: 'QB-CUST-1',
      itemId: 'ITEM-1'
    });
    assert.equal((payload.CustomerRef as { value: string }).value, 'QB-CUST-1');
    assert.ok(Array.isArray(payload.Line));
    assert.equal(payload.TxnDate, '2026-07-01');
    assert.equal(Object.prototype.hasOwnProperty.call(payload, 'TxnTaxDetail'), false);
  });

  it('creates an invoice after ensuring the customer exists', async () => {
    const mock = createMockAdmin({
      connections: [
        {
          id: 'c1',
          organization_id: ORG_A,
          status: 'connected',
          realm_id: '123',
          access_token: 'access',
          refresh_token: 'refresh',
          token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
          refresh_token_expires_at: null,
          last_sync_at: null,
          last_error: null,
          company_name: null,
          updated_at: null
        }
      ],
      customers: [
        {
          id: CUSTOMER_ID,
          organization_id: ORG_A,
          company_name: 'Acme',
          email: 'acme@example.com',
          phone: null,
          address_line1: null,
          address_line2: null,
          city: null,
          state: null,
          postal_code: null,
          country: null,
          quickbooks_customer_id: 'QB-CUST-1',
          quickbooks_sync_token: '1'
        }
      ],
      invoices: [
        {
          id: INVOICE_ID,
          organization_id: ORG_A,
          customer_id: CUSTOMER_ID,
          amount: 100,
          description: 'Work',
          notes: null,
          invoice_date: '2026-07-01',
          due_date: '2026-07-15',
          status: 'sent',
          payment_status: 'unpaid',
          quickbooks_invoice_id: null,
          quickbooks_sync_token: null
        }
      ]
    });

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.includes('/customer/QB-CUST-1')) {
        return jsonResponse({ Customer: { Id: 'QB-CUST-1', SyncToken: '1' } }, 200, {
          intuit_tid: 'tid-cust'
        });
      }
      if (url.includes('/customer') && init?.method === 'POST') {
        return jsonResponse({ Customer: { Id: 'QB-CUST-1', SyncToken: '2' } }, 200, {
          intuit_tid: 'tid-cust-up'
        });
      }
      if (url.includes('/query') && url.includes('Item')) {
        return jsonResponse({ QueryResponse: { Item: [{ Id: 'ITEM-1', Type: 'Service' }] } }, 200, {
          intuit_tid: 'tid-item'
        });
      }
      if (url.includes('/invoice') && init?.method === 'POST') {
        return jsonResponse({ Invoice: { Id: 'QB-INV-1', SyncToken: '0' } }, 200, {
          intuit_tid: 'tid-inv'
        });
      }
      return jsonResponse({ error: 'unexpected', url }, 500);
    };

    const result = await exportInvoiceToQuickBooks({
      admin: mock.asClient(),
      organizationId: ORG_A,
      userId: USER,
      invoiceId: INVOICE_ID,
      fetchImpl
    });

    assert.equal(result.success, true);
    assert.equal(result.created, true);
    assert.equal(result.externalId, 'QB-INV-1');
    assert.equal(mock.tables.invoices.rows[0].quickbooks_invoice_id, 'QB-INV-1');
  });

  it('updates an already exported invoice instead of duplicating', async () => {
    const mock = createMockAdmin({
      connections: [
        {
          id: 'c1',
          organization_id: ORG_A,
          status: 'connected',
          realm_id: '123',
          access_token: 'access',
          refresh_token: 'refresh',
          token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
          refresh_token_expires_at: null,
          last_sync_at: null,
          last_error: null,
          company_name: null,
          updated_at: null
        }
      ],
      customers: [
        {
          id: CUSTOMER_ID,
          organization_id: ORG_A,
          company_name: 'Acme',
          email: 'acme@example.com',
          phone: null,
          address_line1: null,
          address_line2: null,
          city: null,
          state: null,
          postal_code: null,
          country: null,
          quickbooks_customer_id: 'QB-CUST-1',
          quickbooks_sync_token: '1'
        }
      ],
      invoices: [
        {
          id: INVOICE_ID,
          organization_id: ORG_A,
          customer_id: CUSTOMER_ID,
          amount: 150,
          description: 'Work',
          notes: null,
          invoice_date: '2026-07-01',
          due_date: '2026-07-15',
          status: 'sent',
          payment_status: 'unpaid',
          quickbooks_invoice_id: 'QB-INV-1',
          quickbooks_sync_token: '0'
        }
      ]
    });

    let updatePosted = false;
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.includes('/customer/QB-CUST-1')) {
        return jsonResponse({ Customer: { Id: 'QB-CUST-1', SyncToken: '1' } }, 200);
      }
      if (url.includes('/customer') && init?.method === 'POST') {
        return jsonResponse({ Customer: { Id: 'QB-CUST-1', SyncToken: '2' } }, 200);
      }
      if (url.includes('/query') && url.includes('Item')) {
        return jsonResponse({ QueryResponse: { Item: [{ Id: 'ITEM-1' }] } }, 200);
      }
      if (url.includes('/invoice/QB-INV-1')) {
        return jsonResponse({ Invoice: { Id: 'QB-INV-1', SyncToken: '5' } }, 200);
      }
      if (url.includes('/invoice') && init?.method === 'POST') {
        updatePosted = true;
        const body = JSON.parse(String(init.body)) as { Id?: string; SyncToken?: string };
        assert.equal(body.Id, 'QB-INV-1');
        assert.equal(body.SyncToken, '5');
        return jsonResponse({ Invoice: { Id: 'QB-INV-1', SyncToken: '6' } }, 200, {
          intuit_tid: 'tid-inv-up'
        });
      }
      return jsonResponse({ error: 'unexpected' }, 500);
    };

    const result = await exportInvoiceToQuickBooks({
      admin: mock.asClient(),
      organizationId: ORG_A,
      userId: USER,
      invoiceId: INVOICE_ID,
      fetchImpl
    });

    assert.equal(updatePosted, true);
    assert.equal(result.updated, true);
    assert.equal(result.created, false);
    assert.equal(mock.tables.invoices.rows[0].quickbooks_sync_token, '6');
  });
});

describe('permission gates', () => {
  it('rejects non-managers for sync-style roles and non-admins for connect', () => {
    assert.equal(isManagerRole('employee'), false);
    assert.equal(isManagerRole('contractor'), false);
    assert.equal(isManagerRole('manager'), true);
    assert.equal(canManageOrganizationSettings('manager'), false);
    assert.equal(canManageOrganizationSettings('admin'), true);
    assert.equal(canManageOrganizationSettings('owner'), true);
  });
});

describe('disconnected account behavior', () => {
  it('fails sync when QuickBooks is not connected', async () => {
    const mock = createMockAdmin({
      connections: [
        {
          id: 'c1',
          organization_id: ORG_A,
          status: 'disconnected',
          realm_id: null,
          access_token: null,
          refresh_token: null,
          token_expires_at: null,
          refresh_token_expires_at: null,
          last_sync_at: null,
          last_error: null,
          company_name: null,
          updated_at: null
        }
      ],
      customers: [
        {
          id: CUSTOMER_ID,
          organization_id: ORG_A,
          company_name: 'Acme',
          email: null,
          phone: null,
          address_line1: null,
          address_line2: null,
          city: null,
          state: null,
          postal_code: null,
          country: null,
          quickbooks_customer_id: null,
          quickbooks_sync_token: null
        }
      ]
    });

    await assert.rejects(
      () =>
        syncCustomerToQuickBooks({
          admin: mock.asClient(),
          organizationId: ORG_A,
          customerId: CUSTOMER_ID,
          fetchImpl: async () => jsonResponse({})
        }),
      (error: unknown) =>
        error instanceof QuickBooksApiError &&
        (error.parsed.reconnectRequired || error.parsed.code === 'not_connected')
    );
  });
});
