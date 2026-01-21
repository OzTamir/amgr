import { z } from 'zod';
import { SourcesArraySchema } from './sources.js';
import { VALID_TARGETS, VALID_FEATURES } from '../types/config.js';

export const TargetSchema = z.enum([
  '*',
  ...VALID_TARGETS,
] as unknown as [string, ...string[]]);

export const FeatureSchema = z.enum([
  ...VALID_FEATURES,
] as unknown as [string, ...string[]]);

export const GlobalSourcesPositionSchema = z.enum(['prepend', 'append']);

export const ConfigOptionsSchema = z
  .object({
    simulateCommands: z.boolean().optional(),
    simulateSubagents: z.boolean().optional(),
    simulateSkills: z.boolean().optional(),
    modularMcp: z.boolean().optional(),
    ignoreGlobalSources: z.boolean().optional(),
    globalSourcesPosition: GlobalSourcesPositionSchema.optional(),
  })
  .strict();

export const OutputDirsSchema = z.record(z.string(), z.string());

const ProfileSpecSchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9-]*(:([a-z][a-z0-9-]*|\*))?$/,
    'Profile must be lowercase alphanumeric with optional sub-profile (e.g., "writing", "development:frontend", "development:*")'
  );

export const AmgrConfigSchema = z
  .object({
    $schema: z.string().optional(),
    sources: SourcesArraySchema.optional(),
    targets: z.array(TargetSchema).min(1, 'At least one target is required'),
    features: z.array(FeatureSchema).min(1, 'At least one feature is required'),
    'use-cases': z.array(z.string()).optional(),
    profiles: z.array(ProfileSpecSchema).optional(),
    options: ConfigOptionsSchema.optional(),
    outputDirs: OutputDirsSchema.optional(),
  })
  .strict()
  .refine(
    (data) =>
      (data['use-cases'] !== undefined && data['use-cases'].length > 0) ||
      (data.profiles !== undefined && data.profiles.length > 0),
    { message: 'Either "use-cases" or "profiles" must have at least one item' }
  );

export type AmgrConfigInput = z.infer<typeof AmgrConfigSchema>;
export type ConfigOptionsInput = z.infer<typeof ConfigOptionsSchema>;
