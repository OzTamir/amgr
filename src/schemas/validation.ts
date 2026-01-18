import { ZodError, type ZodSchema } from 'zod';

export function formatZodError(error: ZodError): string {
  const issues = error.issues;
  if (issues.length === 0) {
    return 'Validation failed';
  }

  const firstIssue = issues[0];
  if (!firstIssue) {
    return 'Validation failed';
  }

  const path = firstIssue.path.length > 0 ? firstIssue.path.join('.') : 'root';
  return `${firstIssue.message} (at ${path})`;
}

export function formatZodErrors(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
    return `${issue.message} (at ${path})`;
  });
}

export function validateWithSchema<T>(
  schema: ZodSchema<T>,
  data: unknown,
  errorPrefix?: string
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = formatZodError(result.error);
    throw new Error(errorPrefix ? `${errorPrefix}: ${message}` : message);
  }
  return result.data;
}

export function validateWithSchemaGetErrors<T>(
  schema: ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { success: false, errors: formatZodErrors(result.error) };
  }
  return { success: true, data: result.data };
}
