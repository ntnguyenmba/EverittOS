import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProductEventName } from '@/lib/product-analytics';

/** Server-side product event logging (first-party, not gated by cookie consent). */
export async function trackProductEventServer(
  supabase: SupabaseClient,
  eventName: ProductEventName,
  options?: {
    organizationId?: string | null;
    userId?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    await supabase.from('product_events').insert({
      organization_id: options?.organizationId || null,
      user_id: options?.userId || null,
      event_name: eventName,
      metadata: options?.metadata || {}
    });
  } catch {
    /* non-blocking */
  }
}
