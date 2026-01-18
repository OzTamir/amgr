import { z } from 'zod';
import { SourcesArraySchema } from './sources.js';

export const GlobalConfigSchema = z
  .object({
    $schema: z.string().optional(),
    globalSources: SourcesArraySchema.default([]),
  })
  .strict();

export type GlobalConfigInput = z.infer<typeof GlobalConfigSchema>;
