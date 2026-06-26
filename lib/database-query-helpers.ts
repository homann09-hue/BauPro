/**
 * Database query optimization utilities
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Helper to build efficient select queries without SELECT *
 */
export function buildSelectQuery(fields: string[]): string {
  if (fields.length === 0) throw new Error('At least one field must be selected');
  return fields.join(', ');
}

/**
 * Check if a query would return sensitive pricing data
 */
export function queryExposesPrice(query: string): boolean {
  const priceFields = [
    'cost_price',
    'cost_price_eur',
    'selling_price',
    'markup_percent',
    'margin_percent',
    'discount_percent',
    'buy_price'
  ];
  
  const queryLower = query.toLowerCase();
  return priceFields.some(field => queryLower.includes(field));
}

/**
 * Safe query with automatic field filtering for non-managers
 */
export async function safeQuery(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  table: string,
  fields: string[],
  filters: Array<[string, string, any]> = [],
  isManager: boolean = false
): Promise<any[]> {
  // Filter out pricing fields for non-managers
  const allowedFields = isManager
    ? fields
    : fields.filter(
        f =>
          ![
            'cost_price',
            'cost_price_eur',
            'selling_price',
            'markup_percent',
            'margin_percent'
          ].includes(f)
      );

  let query = supabase.from(table).select(buildSelectQuery(allowedFields));

  for (const [field, op, value] of filters) {
    query = (query as any)[op](field, value);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}
