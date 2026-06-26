/**
 * Type-safe environment variable access
 */

const requiredEnvVars = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPPLIER_API_ENCRYPTION_KEY: process.env.SUPPLIER_API_ENCRYPTION_KEY
};

const optionalEnvVars = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  KV_REST_API_URL: process.env.KV_REST_API_URL,
  KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
  SENTRY_DSN: process.env.SENTRY_DSN,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DEMO_MODE_ENABLED: process.env.DEMO_MODE_ENABLED === 'true',
  DEMO_RESEED_ON_START: process.env.DEMO_RESEED_ON_START === 'true'
};

/**
 * Validates that all required environment variables are configured.
 */
export function validateEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (process.env.NODE_ENV === 'production') {
    // In production, enforce all required variables
    for (const [key, value] of Object.entries(requiredEnvVars)) {
      if (!value) {
        errors.push(`Missing required environment variable: ${key}`);
      }
    }

    // Rate limiting is critical in production
    const hasRedis = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    if (!hasRedis) {
      errors.push('Production requires Redis/KV: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN or KV_REST_API_URL and KV_REST_API_TOKEN');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get all environment configuration
 */
export const env = {
  ...requiredEnvVars,
  ...optionalEnvVars
};

export type Env = typeof env;
