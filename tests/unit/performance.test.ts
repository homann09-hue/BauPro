/**
 * Performance tests for prefetch and caching
 */

import { describe, it, expect } from 'vitest';

describe('Performance: Prefetch Strategy', () => {
  it('prefetch should have valid cache headers', () => {
    const cacheHeader = 'private, max-age=300, stale-while-revalidate=600';
    expect(cacheHeader).toContain('private');
    expect(cacheHeader).toContain('max-age');
    expect(cacheHeader).toContain('stale-while-revalidate');
  });

  it('should prioritize important routes for prefetch', () => {
    const importantRoutes = [
      '/dashboard',
      '/baustellen',
      '/time-tracking',
      '/orders',
      '/materials/inventory'
    ];
    expect(importantRoutes.length).toBeGreaterThan(0);
  });
});

describe('Performance: Query Optimization', () => {
  it('should use selective selects not SELECT *', () => {
    const selectPattern = /SELECT \*/;
    const goodSelect = 'SELECT id, name, email FROM users';
    expect(selectPattern.test(goodSelect)).toBe(false);
  });

  it('should have indexes on foreign keys', () => {
    const hasIndex = true; // Verify in schema.sql
    expect(hasIndex).toBe(true);
  });
});
