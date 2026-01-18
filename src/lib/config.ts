import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONFIG_DIR,
  CONFIG_FILE,
  VALID_TARGETS,
  DEFAULT_OPTIONS,
} from './constants.js';
import { validateSources } from './sources.js';
import type { AmgrConfig, ConfigOptions, Target } from '../types/config.js';
import type { Source } from '../types/sources.js';
import { AmgrConfigSchema } from '../schemas/config.js';
import { validateWithSchemaGetErrors } from '../schemas/validation.js';

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

export function validateConfig(config: unknown): string[] {
  const result = validateWithSchemaGetErrors(AmgrConfigSchema, config);
  if (result.success) {
    if (result.data.sources !== undefined) {
      const sourceErrors = validateSources(result.data.sources);
      if (sourceErrors.length > 0) {
        return sourceErrors;
      }
    }
    return [];
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
