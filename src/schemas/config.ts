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

export const AmgrConfigSchema = z
  .object({
    $schema: z.string().optional(),
    sources: SourcesArraySchema.optional(),
    targets: z.array(TargetSchema).min(1, 'At least one target is required'),
    features: z.array(FeatureSchema).min(1, 'At least one feature is required'),
    'use-cases': z.array(z.string()).min(1, 'At least one use-case is required'),
    options: ConfigOptionsSchema.optional(),
    outputDirs: OutputDirsSchema.optional(),
  })
  .strict();

export type AmgrConfigInput = z.infer<typeof AmgrConfigSchema>;
export type ConfigOptionsInput = z.infer<typeof ConfigOptionsSchema>;
