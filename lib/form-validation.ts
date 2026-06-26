/**
 * Form validation utilities with better error handling
 */

import { z } from 'zod';

/**
 * Custom form error with field-level context
 */
export class FormValidationError extends Error {
  constructor(
    public fieldErrors: Record<string, string[]>,
    public message: string = 'Formularvalidierung fehlgeschlagen'
  ) {
    super(message);
    this.name = 'FormValidationError';
  }
}

/**
 * Validates form data and provides field-specific errors
 */
export function validateFormData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { valid: boolean; data?: T; errors?: Record<string, string[]> } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { valid: true, data: result.data };
  }

  const fieldErrors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    if (!fieldErrors[path]) fieldErrors[path] = [];
    fieldErrors[path].push(issue.message);
  }

  return { valid: false, errors: fieldErrors };
}

/**
 * Create strongly-typed form schemas
 */
export const FormSchemas = {
  login: z.object({
    email: z.string().email('Ungültige E-Mail'),
    password: z.string().min(1, 'Passwort erforderlich')
  }),

  createOrder: z.object({
    customer_id: z.string().uuid('Ungültige Kunden-ID'),
    title: z.string().min(3, 'Titel muss mindestens 3 Zeichen lang sein').max(255),
    description: z.string().max(1000).optional(),
    status: z.enum(['draft', 'sent', 'accepted', 'rejected']).default('draft')
  }),

  createJobsite: z.object({
    name: z.string().min(3, 'Name erforderlich').max(255),
    location: z.string().optional(),
    customer_id: z.string().uuid().optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional()
  })
};

/**
 * Type-safe form result extraction
 */
export function getFormFieldError(errors: Record<string, string[]> | undefined, field: string): string | undefined {
  if (!errors) return undefined;
  const fieldErrors = errors[field];
  return fieldErrors?.[0];
}
