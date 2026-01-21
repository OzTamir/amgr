import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONFIG_DIR,
  CONFIG_FILE,
  VALID_TARGETS,
  DEFAULT_OPTIONS,
  SHARED_SUBDIR,
} from './constants.js';
import { validateSources, parseProfileSpec, getCombinedProfiles } from './sources.js';
import type { AmgrConfig, ConfigOptions, Target } from '../types/config.js';
import type { Source, ResolvedSource } from '../types/sources.js';
import { AmgrConfigSchema } from '../schemas/config.js';
import { validateWithSchemaGetErrors } from '../schemas/validation.js';
import { getEffectiveProfiles } from './utils.js';

export function getConfigPath(projectPath: string, customPath?: string): string {
  if (customPath) {
    return customPath;
  }
  const envConfig = process.env['AMGR_CONFIG'];
  if (envConfig) {
    return envConfig;
  }
  return join(projectPath, CONFIG_DIR, CONFIG_FILE);
}

export function getAmgrDir(projectPath: string): string {
  return join(projectPath, CONFIG_DIR);
}

export function configExists(projectPath: string, customPath?: string): boolean {
  const configPath = getConfigPath(projectPath, customPath);
  return existsSync(configPath);
}

export function loadConfig(projectPath: string, customPath?: string): AmgrConfig {
  const configPath = getConfigPath(projectPath, customPath);

  if (!existsSync(configPath)) {
    throw new Error(
      `No .amgr/config.json found in current directory.\n` +
        `Run 'amgr init' to create one.`
    );
  }

  try {
    const content = readFileSync(configPath, 'utf8');
    return JSON.parse(content) as AmgrConfig;
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${configPath}: ${e.message}`);
    }
    throw e;
  }
}

export function normalizeOutputDirPrefix(prefix: string): string {
  const trimmed = prefix.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

export function validateOutputDirs(
  outputDirs: Record<string, string> | undefined,
  useCases: string[]
): string[] {
  if (!outputDirs) {
    return [];
  }

  const errors: string[] = [];
  const useCaseSet = new Set(useCases);

  for (const [useCase, prefix] of Object.entries(outputDirs)) {
    if (!useCaseSet.has(useCase)) {
      errors.push(
        `outputDirs references unknown use-case '${useCase}'. ` +
          `Available use-cases: ${useCases.join(', ')}`
      );
    }

    if (prefix.startsWith('/')) {
      errors.push(
        `outputDirs['${useCase}'] must be a relative path, not an absolute path: '${prefix}'`
      );
    }

    if (prefix.includes('..')) {
      errors.push(
        `outputDirs['${useCase}'] must not contain '..': '${prefix}'`
      );
    }
  }

  return errors;
}

export function validateConfig(config: unknown): string[] {
  const result = validateWithSchemaGetErrors(AmgrConfigSchema, config);
  if (result.success) {
    const errors: string[] = [];

    if (result.data.sources !== undefined) {
      const sourceErrors = validateSources(result.data.sources);
      errors.push(...sourceErrors);
    }

    if (result.data.outputDirs !== undefined) {
      const outputDirErrors = validateOutputDirs(
        result.data.outputDirs,
        result.data['use-cases'] ?? []
      );
      errors.push(...outputDirErrors);
    }

    return errors;
  }
  return result.errors;
}

export function loadAndValidateConfig(
  projectPath: string,
  customPath?: string
): AmgrConfig {
  const config = loadConfig(projectPath, customPath);
  const errors = validateConfig(config);

  if (errors.length > 0) {
    const firstError = errors[0];
    if (firstError) {
      throw new Error(firstError);
    }
  }

  return config;
}

export function saveConfig(
  projectPath: string,
  config: AmgrConfig,
  customPath?: string
): void {
  const configPath = getConfigPath(projectPath, customPath);
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}

export function hasSources(config: AmgrConfig): boolean {
  return (
    config.sources !== undefined &&
    Array.isArray(config.sources) &&
    config.sources.length > 0
  );
}

export function addSourceToConfig(
  config: AmgrConfig,
  source: Source,
  position?: number
): AmgrConfig {
  const sources = config.sources ? [...config.sources] : [];

  if (position !== undefined && position >= 0 && position <= sources.length) {
    sources.splice(position, 0, source);
  } else {
    sources.push(source);
  }

  return { ...config, sources };
}

export function removeSourceFromConfig(
  config: AmgrConfig,
  index: number
): AmgrConfig {
  if (!config.sources || index < 0 || index >= config.sources.length) {
    throw new Error(`Invalid source index: ${index}`);
  }

  const sources = [...config.sources];
  sources.splice(index, 1);

  if (sources.length === 0) {
    const { sources: _removed, ...rest } = config;
    return rest as AmgrConfig;
  }

  return { ...config, sources };
}

export function getEffectiveOptions(
  config: AmgrConfig
): Required<ConfigOptions> {
  return {
    ...DEFAULT_OPTIONS,
    ...(config.options ?? {}),
  };
}

export function expandTargets(targets: (Target | '*')[]): Target[] {
  if (targets.includes('*')) {
    return [...VALID_TARGETS];
  }
  return targets.filter((t): t is Target => t !== '*');
}

const PROFILE_SPEC_REGEX = /^[a-z][a-z0-9-]*(:([a-z][a-z0-9-]*|\*))?$/;
const RESERVED_PROFILE_NAMES = [SHARED_SUBDIR, 'shared'];

export interface ProfileValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateProfileSpec(spec: string): ProfileValidationResult {
  const result: ProfileValidationResult = { valid: true, errors: [], warnings: [] };
  
  const parsed = parseProfileSpec(spec);
  
  if (RESERVED_PROFILE_NAMES.includes(parsed.parent)) {
    result.valid = false;
    result.errors.push(`"${parsed.parent}" is a reserved name and cannot be used as a profile name`);
    return result;
  }
  
  if (parsed.sub && RESERVED_PROFILE_NAMES.includes(parsed.sub)) {
    result.valid = false;
    result.errors.push(`"${parsed.sub}" is a reserved name and cannot be used as a sub-profile name`);
    return result;
  }
  
  if (!PROFILE_SPEC_REGEX.test(spec)) {
    result.valid = false;
    result.errors.push(
      `Invalid profile spec "${spec}". Must match pattern: lowercase letters, numbers, hyphens, optionally followed by :subprofile or :*`
    );
    return result;
  }
  
  return result;
}

export function validateProfilesExist(
  profiles: string[],
  resolvedSources: ResolvedSource[]
): ProfileValidationResult {
  const result: ProfileValidationResult = { valid: true, errors: [], warnings: [] };
  
  if (resolvedSources.length === 0) {
    return result;
  }
  
  const combinedProfiles = getCombinedProfiles(resolvedSources);
  const availableProfiles = Object.keys(combinedProfiles);
  
  for (const profileSpec of profiles) {
    const specResult = validateProfileSpec(profileSpec);
    if (!specResult.valid) {
      result.valid = false;
      result.errors.push(...specResult.errors);
      continue;
    }
    
    const parsed = parseProfileSpec(profileSpec);
    
    if (parsed.isWildcard) {
      if (!availableProfiles.includes(parsed.parent)) {
        result.valid = false;
        result.errors.push(`Profile "${parsed.parent}" not found in configured sources`);
        
        const suggestions = findSimilarProfiles(parsed.parent, availableProfiles);
        if (suggestions.length > 0) {
          result.errors.push(`  Did you mean: ${suggestions.join(', ')}?`);
        }
      } else {
        const profileData = combinedProfiles[parsed.parent];
        const subProfiles = profileData?.['sub-profiles'];
        if (!subProfiles || Object.keys(subProfiles).length === 0) {
          result.warnings.push(
            `Profile "${parsed.parent}" has no sub-profiles. "${parsed.parent}:*" is equivalent to "${parsed.parent}".`
          );
        }
      }
      continue;
    }
    
    if (parsed.sub) {
      if (!availableProfiles.includes(parsed.parent)) {
        result.valid = false;
        result.errors.push(`Parent profile "${parsed.parent}" not found in configured sources`);
        continue;
      }
      
      const profileData = combinedProfiles[parsed.parent];
      const subProfiles = profileData?.['sub-profiles'];
      
      if (!subProfiles || Object.keys(subProfiles).length === 0) {
        result.valid = false;
        result.errors.push(
          `Profile "${parsed.parent}" has no sub-profiles. Use "${parsed.parent}" instead of "${profileSpec}".`
        );
        continue;
      }
      
      if (!subProfiles[parsed.sub]) {
        result.valid = false;
        result.errors.push(
          `Sub-profile "${parsed.sub}" not found under "${parsed.parent}". Available: ${Object.keys(subProfiles).join(', ')}`
        );
      }
    } else {
      if (!availableProfiles.includes(parsed.parent)) {
        result.valid = false;
        result.errors.push(`Profile "${parsed.parent}" not found in configured sources`);
        
        const allSubProfiles: string[] = [];
        for (const [parentName, profileData] of Object.entries(combinedProfiles)) {
          const subs = profileData['sub-profiles'];
          if (subs && subs[parsed.parent]) {
            allSubProfiles.push(`${parentName}:${parsed.parent}`);
          }
        }
        
        if (allSubProfiles.length > 0) {
          result.errors.push(`  Did you mean: ${allSubProfiles.join(', ')}?`);
        } else {
          const suggestions = findSimilarProfiles(parsed.parent, availableProfiles);
          if (suggestions.length > 0) {
            result.errors.push(`  Did you mean: ${suggestions.join(', ')}?`);
          }
        }
      }
    }
  }
  
  return result;
}

function findSimilarProfiles(target: string, available: string[]): string[] {
  return available
    .filter(p => {
      const distance = levenshteinDistance(target.toLowerCase(), p.toLowerCase());
      return distance <= 3;
    })
    .slice(0, 3);
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= b.length; j++) {
    matrix[0]![j] = j;
  }
  
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost
      );
    }
  }
  
  return matrix[a.length]![b.length]!;
}

export function validateConfigProfiles(
  config: AmgrConfig,
  resolvedSources: ResolvedSource[]
): ProfileValidationResult {
  const profiles = getEffectiveProfiles(config);
  return validateProfilesExist(profiles, resolvedSources);
}
