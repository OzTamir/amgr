import { describe, it, expect } from 'vitest';
import { z, ZodError } from 'zod';
import {
  formatZodError,
  formatZodErrors,
  validateWithSchema,
  validateWithSchemaGetErrors,
} from './validation.js';

describe('validation', () => {
  const testSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    age: z.number().min(0, 'Age must be positive'),
  });

  describe('formatZodError', () => {
    it('formats single error with path', () => {
      const result = testSchema.safeParse({ name: '', age: 25 });
      expect(result.success).toBe(false);
      if (!result.success) {
        const message = formatZodError(result.error);
        expect(message).toContain('Name is required');
        expect(message).toContain('name');
      }
    });

    it('formats error at root level', () => {
      const schema = z.string();
      const result = schema.safeParse(123);
      expect(result.success).toBe(false);
      if (!result.success) {
        const message = formatZodError(result.error);
        expect(message).toContain('root');
      }
    });

    it('returns generic message for empty issues', () => {
      const emptyError = new ZodError([]);
      const message = formatZodError(emptyError);
      expect(message).toBe('Validation failed');
    });
  });

  describe('formatZodErrors', () => {
    it('formats multiple errors', () => {
      const result = testSchema.safeParse({ name: '', age: -5 });
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = formatZodErrors(result.error);
        expect(messages.length).toBe(2);
        expect(messages.some((m) => m.includes('Name is required'))).toBe(true);
        expect(messages.some((m) => m.includes('Age must be positive'))).toBe(true);
      }
    });

    it('returns empty array for no errors', () => {
      const emptyError = new ZodError([]);
      const messages = formatZodErrors(emptyError);
      expect(messages).toEqual([]);
    });
  });

  describe('validateWithSchema', () => {
    it('returns data for valid input', () => {
      const data = { name: 'John', age: 30 };
      const result = validateWithSchema(testSchema, data);
      expect(result).toEqual(data);
    });

    it('throws error for invalid input', () => {
      const data = { name: '', age: 30 };
      expect(() => validateWithSchema(testSchema, data)).toThrow('Name is required');
    });

    it('includes error prefix when provided', () => {
      const data = { name: '', age: 30 };
      expect(() => validateWithSchema(testSchema, data, 'Config error')).toThrow(
        'Config error:'
      );
    });
  });

  describe('validateWithSchemaGetErrors', () => {
    it('returns success with data for valid input', () => {
      const data = { name: 'John', age: 30 };
      const result = validateWithSchemaGetErrors(testSchema, data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(data);
      }
    });

    it('returns failure with errors for invalid input', () => {
      const data = { name: '', age: -5 };
      const result = validateWithSchemaGetErrors(testSchema, data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBe(2);
      }
    });
  });
});
