import type { SupabaseClient } from '@supabase/supabase-js';
import { QuickBooksApiError, quickbooksAccountingRequest, type QuickBooksFetch } from '@/lib/quickbooks/client';
import { escapeQuickBooksQueryValue, parseQuickBooksError } from '@/lib/quickbooks/errors';
import { writeQuickBooksSyncLog } from '@/lib/quickbooks/logging';
import { customerDisplayName } from '@/lib/customer-record';

export type EverittCustomerRow = {
  id: string;
  organization_id: string;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  quickbooks_customer_id?: string | null;
  quickbooks_sync_token?: string | null;
};

export type QuickBooksCustomerEntity = {
  Id: string;
  SyncToken: string;
  DisplayName?: string;
  sparse?: boolean;
};

export type SyncCustomerResult = {
  success: true;
  created: boolean;
  updated: boolean;
  externalId: string;
  syncToken: string;
  intuitTid: string | null;
};

function buildBillAddr(customer: EverittCustomerRow) {
  if (!customer.address_line1 && !customer.city && !customer.postal_code) return undefined;
  return {
    Line1: customer.address_line1 || undefined,
    Line2: customer.address_line2 || undefined,
    City: customer.city || undefined,
    CountrySubDivisionCode: customer.state || undefined,
    PostalCode: customer.postal_code || undefined,
    Country: customer.country || undefined
  };
}

export function buildQuickBooksCustomerPayload(customer: EverittCustomerRow): Record<string, unknown> {
  const displayName = customerDisplayName(customer) || customer.email || `Customer ${customer.id.slice(0, 8)}`;
  const payload: Record<string, unknown> = {
    DisplayName: displayName.slice(0, 500)
  };

  if (customer.company_name?.trim()) {
    payload.CompanyName = customer.company_name.trim().slice(0, 500);
  }
  if (customer.email?.trim()) {
    payload.PrimaryEmailAddr = { Address: customer.email.trim().slice(0, 100) };
  }
  if (customer.phone?.trim()) {
    payload.PrimaryPhone = { FreeFormNumber: customer.phone.trim().slice(0, 30) };
  }
  const billAddr = buildBillAddr(customer);
  if (billAddr) payload.BillAddr = billAddr;
  return payload;
}

type QueryCustomerResponse = {
  QueryResponse?: {
    Customer?: QuickBooksCustomerEntity[];
  };
};

type CustomerReadResponse = {
  Customer?: QuickBooksCustomerEntity;
};

async function queryCustomers(
  admin: SupabaseClient,
  organizationId: string,
  sql: string,
  fetchImpl?: QuickBooksFetch
): Promise<{ customers: QuickBooksCustomerEntity[]; intuitTid: string | null }> {
  const result = await quickbooksAccountingRequest<QueryCustomerResponse>({
    admin,
    organizationId,
    method: 'GET',
    path: '/query',
    query: { query: sql },
    fetchImpl
  });
  return {
    customers: result.body.QueryResponse?.Customer || [],
    intuitTid: result.intuitTid
  };
}

async function findExistingQuickBooksCustomer(
  admin: SupabaseClient,
  organizationId: string,
  customer: EverittCustomerRow,
  fetchImpl?: QuickBooksFetch
): Promise<{ entity: QuickBooksCustomerEntity | null; intuitTid: string | null }> {
  if (customer.quickbooks_customer_id) {
    try {
      const result = await quickbooksAccountingRequest<CustomerReadResponse>({
        admin,
        organizationId,
        method: 'GET',
        path: `/customer/${encodeURIComponent(customer.quickbooks_customer_id)}`,
        fetchImpl
      });
      if (result.body.Customer?.Id) {
        return { entity: result.body.Customer, intuitTid: result.intuitTid };
      }
    } catch (error) {
      if (!(error instanceof QuickBooksApiError) || error.parsed.httpStatus !== 404) {
        throw error;
      }
    }
  }

  const displayName = customerDisplayName(customer);
  if (displayName) {
    const escaped = escapeQuickBooksQueryValue(displayName);
    const byName = await queryCustomers(
      admin,
      organizationId,
      `select Id, SyncToken, DisplayName from Customer where DisplayName = '${escaped}' maxresults 1`,
      fetchImpl
    );
    if (byName.customers[0]) {
      return { entity: byName.customers[0], intuitTid: byName.intuitTid };
    }
  }

  if (customer.email?.trim()) {
    const escaped = escapeQuickBooksQueryValue(customer.email.trim());
    const byEmail = await queryCustomers(
      admin,
      organizationId,
      `select Id, SyncToken, DisplayName from Customer where PrimaryEmailAddr = '${escaped}' maxresults 1`,
      fetchImpl
    );
    if (byEmail.customers[0]) {
      return { entity: byEmail.customers[0], intuitTid: byEmail.intuitTid };
    }
  }

  return { entity: null, intuitTid: null };
}

async function createOrUpdateCustomer(
  admin: SupabaseClient,
  organizationId: string,
  payload: Record<string, unknown>,
  existing: QuickBooksCustomerEntity | null,
  fetchImpl?: QuickBooksFetch
): Promise<{ entity: QuickBooksCustomerEntity; created: boolean; intuitTid: string | null }> {
  if (existing?.Id && existing.SyncToken != null) {
    const result = await quickbooksAccountingRequest<CustomerReadResponse>({
      admin,
      organizationId,
      method: 'POST',
      path: '/customer',
      body: {
        ...payload,
        Id: existing.Id,
        SyncToken: existing.SyncToken,
        sparse: true
      },
      fetchImpl
    });
    if (!result.body.Customer?.Id) {
      throw new QuickBooksApiError(
        parseQuickBooksError({ httpStatus: result.status, body: result.body, intuitTid: result.intuitTid })
      );
    }
    return { entity: result.body.Customer, created: false, intuitTid: result.intuitTid };
  }

  const result = await quickbooksAccountingRequest<CustomerReadResponse>({
    admin,
    organizationId,
    method: 'POST',
    path: '/customer',
    body: payload,
    fetchImpl
  });
  if (!result.body.Customer?.Id) {
    throw new QuickBooksApiError(
      parseQuickBooksError({ httpStatus: result.status, body: result.body, intuitTid: result.intuitTid })
    );
  }
  return { entity: result.body.Customer, created: true, intuitTid: result.intuitTid };
}

export async function syncCustomerToQuickBooks(input: {
  admin: SupabaseClient;
  organizationId: string;
  userId?: string | null;
  customerId: string;
  fetchImpl?: QuickBooksFetch;
  log?: boolean;
}): Promise<SyncCustomerResult> {
  const { data: customer, error } = await input.admin
    .from('customers')
    .select(
      'id, organization_id, company_name, email, phone, address_line1, address_line2, city, state, postal_code, country, quickbooks_customer_id, quickbooks_sync_token'
    )
    .eq('id', input.customerId)
    .eq('organization_id', input.organizationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!customer) {
    throw new QuickBooksApiError({
      userMessage: 'Customer not found in this workspace.',
      httpStatus: 404,
      intuitTid: null,
      reconnectRequired: false,
      retryable: false,
      code: 'customer_not_found'
    });
  }

  const row = customer as EverittCustomerRow;
  const payload = buildQuickBooksCustomerPayload(row);

  try {
    const found = await findExistingQuickBooksCustomer(input.admin, input.organizationId, row, input.fetchImpl);
    const saved = await createOrUpdateCustomer(
      input.admin,
      input.organizationId,
      payload,
      found.entity,
      input.fetchImpl
    );

    const { error: updateError } = await input.admin
      .from('customers')
      .update({
        quickbooks_customer_id: saved.entity.Id,
        quickbooks_sync_token: saved.entity.SyncToken,
        updated_at: new Date().toISOString()
      })
      .eq('id', row.id)
      .eq('organization_id', input.organizationId);

    if (updateError) throw new Error(updateError.message);

    await input.admin
      .from('quickbooks_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', input.organizationId);

    if (input.log !== false) {
      await writeQuickBooksSyncLog(input.admin, {
        organizationId: input.organizationId,
        userId: input.userId,
        entityType: 'customer',
        entityId: row.id,
        action: 'sync_customer',
        status: saved.created ? 'created' : 'updated',
        externalId: saved.entity.Id,
        intuitTid: saved.intuitTid,
        httpStatus: 200
      });
    }

    return {
      success: true,
      created: saved.created,
      updated: !saved.created,
      externalId: saved.entity.Id,
      syncToken: saved.entity.SyncToken,
      intuitTid: saved.intuitTid
    };
  } catch (error) {
    const parsed =
      error instanceof QuickBooksApiError
        ? error.parsed
        : parseQuickBooksError({
            httpStatus: 500,
            body: { error: error instanceof Error ? error.message : 'unknown' },
            intuitTid: null
          });

    if (input.log !== false) {
      await writeQuickBooksSyncLog(input.admin, {
        organizationId: input.organizationId,
        userId: input.userId,
        entityType: 'customer',
        entityId: row.id,
        action: 'sync_customer',
        status: 'failed',
        errorMessage: parsed.userMessage,
        intuitTid: parsed.intuitTid,
        httpStatus: parsed.httpStatus,
        qbErrorCode: parsed.code || null,
        faultType: parsed.faultType || null
      });
    }

    await input.admin
      .from('quickbooks_connections')
      .update({
        last_error: parsed.userMessage,
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', input.organizationId);

    throw error instanceof QuickBooksApiError
      ? error
      : new QuickBooksApiError(parsed);
  }
}
