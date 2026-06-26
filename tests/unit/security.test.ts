/**
 * Unit tests for security utilities
 */

import { describe, it, expect } from 'vitest';
import { sanitizeErrorMessage, sanitizeErrorObject } from '@/lib/security/sanitize-error';
import {
  getMFAEnforcementForRole,
  shouldEnforceMFA,
  hasMFAEnabled,
  validateMFARequirements
} from '@/lib/security/mfa-enforcement';
import {
  validateRequestOrigin,
  validateRequiredHeaders,
  rateLimitKeys,
  getClientIP,
  EmailSchema,
  PasswordSchema
} from '@/lib/security/request-validation';

describe('Security: Error Sanitization', () => {
  it('sanitizes API keys from error messages', () => {
    const message = 'Failed with API_KEY=sk_live_abc123';
    const sanitized = sanitizeErrorMessage(message);
    expect(sanitized).toContain('[REDACTED]');
    expect(sanitized).not.toContain('sk_live_abc123');
  });

  it('sanitizes Supabase credentials', () => {
    const message = 'Supabase URL=https://example.supabase.co';
    const sanitized = sanitizeErrorMessage(message);
    expect(sanitized).toContain('[REDACTED]');
  });

  it('sanitizes Error objects', () => {
    const error = new Error('Failed with password=secret123');
    const sanitized = sanitizeErrorObject(error) as any;
    expect(sanitized.message).toContain('[REDACTED]');
    expect(sanitized.message).not.toContain('secret123');
  });

  it('removes stack traces in production', () => {
    const error = new Error('Test error');
    process.env.NODE_ENV = 'production';
    const sanitized = sanitizeErrorObject(error) as any;
    expect(sanitized.stack).toBeUndefined();
  });
});

describe('Security: MFA Enforcement', () => {
  it('returns recommended for admin role', () => {
    const level = getMFAEnforcementForRole('admin');
    expect(level).toBe('recommended');
  });

  it('returns optional for chef role', () => {
    const level = getMFAEnforcementForRole('chef');
    expect(level).toBe('optional');
  });

  it('validates MFA is not required currently for admins', () => {
    const profile = { role: 'admin' } as any;
    expect(shouldEnforceMFA(profile)).toBe(false);
  });

  it('checks MFA enabled status', () => {
    expect(hasMFAEnabled(true)).toBe(true);
    expect(hasMFAEnabled(false)).toBe(false);
  });
});

describe('Security: Request Validation', () => {
  it('validates same-origin requests', () => {
    const valid = validateRequestOrigin(
      'https://example.com',
      ['https://example.com']
    );
    expect(valid).toBe(true);
  });

  it('rejects cross-origin requests', () => {
    const valid = validateRequestOrigin(
      'https://evil.com',
      ['https://example.com']
    );
    expect(valid).toBe(false);
  });

  it('validates required headers', () => {
    const headers = { 'content-type': 'application/json' };
    const result = validateRequiredHeaders(headers, ['authorization']);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('authorization');
  });

  it('generates rate limit keys', () => {
    const loginKey = rateLimitKeys.login('user@example.com');
    expect(loginKey).toContain('rate-limit:login');
    expect(loginKey).toContain('user@example.com');
  });

  it('extracts client IP from headers', () => {
    const headers = { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' };
    const ip = getClientIP(headers);
    expect(ip).toBe('192.168.1.1');
  });

  it('validates email format', () => {
    expect(() => EmailSchema.parse('valid@example.com')).not.toThrow();
    expect(() => EmailSchema.parse('invalid')).toThrow();
  });

  it('validates password strength', () => {
    const strongPassword = 'SecurePass123!';
    expect(() => PasswordSchema.parse(strongPassword)).not.toThrow();

    expect(() => PasswordSchema.parse('weak')).toThrow();
  });
});
