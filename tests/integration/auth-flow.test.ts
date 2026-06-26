/**
 * Integration tests for authentication flow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SafeActionError, safeErrorMessage, safeQueryErrorMessage } from '@/lib/security/errors';

describe('Auth: Error Handling', () => {
  it('preserves SafeActionError messages', () => {
    const error = new SafeActionError('Custom error message');
    const message = safeErrorMessage(error);
    expect(message).toBe('Custom error message');
  });

  it('masks unknown errors', () => {
    const error = new Error('Database connection failed with secret_key=xyz');
    const message = safeErrorMessage(error);
    expect(message).not.toContain('secret_key');
  });

  it('returns fallback for missing schema errors', () => {
    const queryError = {
      code: '42P01',
      message: 'relation "missing_table" does not exist'
    };
    const message = safeQueryErrorMessage(queryError);
    expect(message).toContain('Datenbank-Update fehlt');
  });

  it('handles null errors gracefully', () => {
    const message = safeQueryErrorMessage(null);
    expect(message).toBeNull();
  });
});
