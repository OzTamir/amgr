import { z } from 'zod';

export const GitSourceSchema = z.object({
  type: z.literal('git'),
  url: z.string().min(1, 'Git source must have a url'),
  name: z.string().optional(),
});

export const LocalSourceSchema = z.object({
  type: z.literal('local'),
  path: z.string().min(1, 'Local source must have a path'),
  name: z.string().optional(),
});

export const SourceObjectSchema = z.discriminatedUnion('type', [
  GitSourceSchema,
  LocalSourceSchema,
]);

export const SourceSchema = z.union([z.string().min(1), SourceObjectSchema]);

export const SourcesArraySchema = z.array(SourceSchema);

export type GitSourceInput = z.infer<typeof GitSourceSchema>;
export type LocalSourceInput = z.infer<typeof LocalSourceSchema>;
export type SourceObjectInput = z.infer<typeof SourceObjectSchema>;
export type SourceInput = z.infer<typeof SourceSchema>;
