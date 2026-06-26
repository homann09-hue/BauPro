/**
 * Sanitizes error messages to prevent leaking sensitive information
 * to error tracking systems like Sentry or to the client.
 */

const SENSITIVE_PATTERNS = [
  /(?:api[_-]?key|secret|password|token|credential)/gi,
  /(?:supabase|openai|stripe|aws)[\s=:]+[\w\-_.]/gi,
  /(?:email|user)[\s=:]+[\w.@]+/gi,
  /(?:database|host|port)[\s=:]+[\w.:-]+/gi,
  /authorization[\s=:]+bearer\s+[\w.-]+/gi
];

export function sanitizeErrorMessage(message: string): string {
  let sanitized = message;
  
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  
  return sanitized;
}

export function sanitizeErrorObject(error: unknown): unknown {
  if (!error) return error;
  
  if (error instanceof Error) {
    return {
      name: error.name,
      message: sanitizeErrorMessage(error.message),
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    };
  }
  
  if (typeof error === 'string') {
    return sanitizeErrorMessage(error);
  }
  
  if (typeof error === 'object') {
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(error)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeErrorMessage(value);
      } else if (value instanceof Error) {
        sanitized[key] = sanitizeErrorMessage(value.message);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
  
  return error;
}
