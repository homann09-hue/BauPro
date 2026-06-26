/**
 * Log sanitization for error tracking systems like Sentry.
 * Prevents sensitive data from being sent to third-party services.
 */

import { sanitizeErrorMessage, sanitizeErrorObject } from '@/lib/security/sanitize-error';

export function sanitizeForSentry(event: any): any {
  if (!event) return event;
  
  // Sanitize error messages
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((exc: any) => ({
      ...exc,
      value: sanitizeErrorMessage(exc.value || ''),
      stacktrace: exc.stacktrace ? sanitizeStackTrace(exc.stacktrace) : undefined
    }));
  }
  
  // Sanitize request data
  if (event.request) {
    event.request = {
      ...event.request,
      headers: sanitizeHeaders(event.request.headers || {}),
      url: sanitizeURL(event.request.url || '')
    };
  }
  
  // Sanitize context
  if (event.contexts?.app) {
    event.contexts.app = sanitizeErrorObject(event.contexts.app);
  }
  
  // Remove sensitive tags
  if (event.tags) {
    event.tags = Object.fromEntries(
      Object.entries(event.tags).filter(([key]) => 
        !['user_id', 'company_id', 'api_key', 'token'].includes(key.toLowerCase())
      )
    );
  }
  
  return event;
}

function sanitizeStackTrace(stacktrace: any): any {
  if (!stacktrace?.frames) return stacktrace;
  
  return {
    ...stacktrace,
    frames: stacktrace.frames.map((frame: any) => ({
      ...frame,
      context_line: frame.context_line ? sanitizeErrorMessage(frame.context_line) : undefined
    }))
  };
}

function sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-secret', 'x-token'];
  
  for (const [key, value] of Object.entries(headers)) {
    if (sensitiveHeaders.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

function sanitizeURL(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove query parameters that might contain sensitive info
    parsed.search = '';
    return parsed.toString();
  } catch {
    return url;
  }
}
