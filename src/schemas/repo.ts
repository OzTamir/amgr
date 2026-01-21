import { z } from 'zod';

export const UseCaseDefinitionSchema = z.object({
  description: z.string().min(1, 'Use-case description is required'),
});

export const SubProfileDefinitionSchema = z.object({
  description: z.string().min(1, 'Sub-profile description is required'),
});

export const ProfileDefinitionSchema = z.object({
  description: z.string().min(1, 'Profile description is required'),
  'sub-profiles': z.record(z.string(), SubProfileDefinitionSchema).optional(),
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
    'use-cases': z.record(z.string(), UseCaseDefinitionSchema).optional(),
    profiles: z.record(z.string(), ProfileDefinitionSchema).optional(),
  })
  .strict()
  .refine(
    (data) => data['use-cases'] !== undefined || data.profiles !== undefined,
    { message: 'Either "use-cases" or "profiles" must be defined' }
  );

export type RepoConfigInput = z.infer<typeof RepoConfigSchema>;
export type UseCaseDefinitionInput = z.infer<typeof UseCaseDefinitionSchema>;
export type ProfileDefinitionInput = z.infer<typeof ProfileDefinitionSchema>;
export type SubProfileDefinitionInput = z.infer<typeof SubProfileDefinitionSchema>;
