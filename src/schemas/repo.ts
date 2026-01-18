import { z } from 'zod';

export const UseCaseDefinitionSchema = z.object({
  description: z.string().min(1, 'Use-case description is required'),
});

export const RepoConfigSchema = z
  .object({
    $schema: z.string().optional(),
    name: z.string().min(1, 'Repository name is required'),
    description: z.string().optional(),
    version: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/, 'Version must be in semver format (e.g., "1.0.0")')
      .optional(),
    author: z.string().optional(),
    'use-cases': z.record(z.string(), UseCaseDefinitionSchema),
  })
  .strict();

export type RepoConfigInput = z.infer<typeof RepoConfigSchema>;
export type UseCaseDefinitionInput = z.infer<typeof UseCaseDefinitionSchema>;
