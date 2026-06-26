/**
 * Request validation and sanitization utilities for API routes.
 */

import { z } from 'zod';

/**
 * Validates that a request came from an expected origin.
 */
export function validateRequestOrigin(
  requestOrigin: string | null,
  allowedOrigins: string[]
): boolean {
  if (!requestOrigin) return false;
  
  try {
    const url = new URL(requestOrigin);
    return allowedOrigins.some(origin => {
      try {
        const allowedUrl = new URL(origin);
        return (
          url.protocol === allowedUrl.protocol &&
          url.hostname === allowedUrl.hostname &&
          url.port === allowedUrl.port
        );
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

/**
 * Validates that required headers are present in a request.
 */
export function validateRequiredHeaders(
  headers: Record<string, string | string[] | undefined>,
  required: string[]
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  for (const header of required) {
    const value = headers[header.toLowerCase()];
    if (!value || (Array.isArray(value) && value.length === 0)) {
      missing.push(header);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Rate limit key generator for various scenarios.
 */
export const rateLimitKeys = {
  login: (email: string) => `rate-limit:login:${email}`,
  demo: (ip: string) => `rate-limit:demo:${ip}`,
  upload: (userId: string) => `rate-limit:upload:${userId}`,
  api: (userId: string, endpoint: string) => `rate-limit:api:${userId}:${endpoint}`,
  ipBased: (ip: string, endpoint: string) => `rate-limit:ip:${ip}:${endpoint}`
};

/**
 * Extracts client IP from request headers, respecting reverse proxies.
 */
export function getClientIP(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ips.split(',')[0].trim();
  }
  
  const realIp = headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }
  
  return '0.0.0.0';
}

/**
 * Zod schema for email validation.
 */
export const EmailSchema = z.string().email('Ungültige E-Mail-Adresse');

/**
 * Zod schema for password validation.
 */
export const PasswordSchema = z
  .string()
  .min(8, 'Passwort muss mindestens 8 Zeichen lang sein')
  .regex(/[A-Z]/, 'Passwort muss mindestens einen Großbuchstaben enthalten')
  .regex(/[a-z]/, 'Passwort muss mindestens einen Kleinbuchstaben enthalten')
  .regex(/[0-9]/, 'Passwort muss mindestens eine Ziffer enthalten')
  .regex(/[^A-Za-z0-9]/, 'Passwort muss mindestens ein Sonderzeichen enthalten');

/**
 * Zod schema for company ID validation.
 */
export const CompanyIDSchema = z.string().uuid('Ungültige Firmen-ID');

/**
 * Zod schema for user ID validation.
 */
export const UserIDSchema = z.string().uuid('Ungültige Benutzer-ID');
