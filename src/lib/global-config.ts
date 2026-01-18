import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

import {
  validateSources,
  parseSource,
  getSourceDisplayName,
  expandPath,
} from './sources.js';
import { SOURCE_TYPE } from '../types/sources.js';
import type { Source, SourceObject, GitSource, LocalSource } from '../types/sources.js';
import type { GlobalConfig } from '../types/config.js';
import { GlobalConfigSchema } from '../schemas/global-config.js';
import { validateWithSchemaGetErrors } from '../schemas/validation.js';

export const AMGR_GLOBAL_DIR = join(homedir(), '.amgr');
export const GLOBAL_CONFIG_PATH = join(AMGR_GLOBAL_DIR, 'config.json');

export function getGlobalConfigPath(): string {
  return GLOBAL_CONFIG_PATH;
}

export function globalConfigExists(): boolean {
  return existsSync(GLOBAL_CONFIG_PATH);
}

export function ensureGlobalDir(): void {
  if (!existsSync(AMGR_GLOBAL_DIR)) {
    mkdirSync(AMGR_GLOBAL_DIR, { recursive: true });
  }
}

export function loadGlobalConfig(): GlobalConfig {
  if (!existsSync(GLOBAL_CONFIG_PATH)) {
    return { globalSources: [] };
  }

  try {
    const content = readFileSync(GLOBAL_CONFIG_PATH, 'utf8');
    const parsed: unknown = JSON.parse(content);

    const result = GlobalConfigSchema.safeParse(parsed);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const path =
        firstIssue && firstIssue.path.length > 0
          ? firstIssue.path.join('.')
          : 'root';
      const message = firstIssue?.message ?? 'Validation failed';
      throw new Error(
        `Invalid global config (${GLOBAL_CONFIG_PATH}): ${message} (at ${path})`
      );
    }

    return result.data;
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(
        `Invalid JSON in global config (${GLOBAL_CONFIG_PATH}): ${e.message}`
      );
    }
    throw e;
  }
}

export function saveGlobalConfig(config: GlobalConfig): void {
  ensureGlobalDir();
  writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

export function validateGlobalConfig(config: unknown): string[] {
  const result = validateWithSchemaGetErrors(GlobalConfigSchema, config);
  if (result.success) {
    if (result.data.globalSources !== undefined) {
      const sourceErrors = validateSources(result.data.globalSources);
      return sourceErrors.map((e) => e.replace('sources', 'globalSources'));
    }
    return [];
  }
  return result.errors;
}

export function getGlobalSources(): Source[] {
  const config = loadGlobalConfig();
  return config.globalSources ?? [];
}

export function hasGlobalSources(): boolean {
  const sources = getGlobalSources();
  return sources.length > 0;
}

export function addGlobalSource(source: SourceObject, position?: number): GlobalConfig {
  const config = loadGlobalConfig();
  const sources = config.globalSources ?? [];

  const isDuplicate = sources.some((s) => {
    const parsed = parseSource(s);
    if (source.type === SOURCE_TYPE.GIT && parsed.type === SOURCE_TYPE.GIT) {
      return source.url === (parsed as GitSource).url;
    }
    if (source.type === SOURCE_TYPE.LOCAL && parsed.type === SOURCE_TYPE.LOCAL) {
      return expandPath(source.path) === expandPath((parsed as LocalSource).path);
    }
    return false;
  });

  if (isDuplicate) {
    throw new Error('This source is already configured as a global source');
  }

  if (position !== undefined && position >= 0 && position <= sources.length) {
    sources.splice(position, 0, source);
  } else {
    sources.push(source);
  }

  config.globalSources = sources;
  saveGlobalConfig(config);

  return config;
}

export function removeGlobalSource(
  indexOrName: number | string
): { removed: SourceObject; config: GlobalConfig } {
  const config = loadGlobalConfig();
  const sources = config.globalSources ?? [];

  if (sources.length === 0) {
    throw new Error('No global sources configured');
  }

  let index: number;
  const parsedIndex =
    typeof indexOrName === 'number' ? indexOrName : parseInt(indexOrName, 10);

  if (!isNaN(parsedIndex)) {
    index = parsedIndex;
    if (index < 0 || index >= sources.length) {
      throw new Error(
        `Invalid source index: ${index}. Valid range: 0-${sources.length - 1}`
      );
    }
  } else {
    index = sources.findIndex((s) => {
      const parsed = parseSource(s);
      return (
        parsed.name === indexOrName || getSourceDisplayName(parsed) === indexOrName
      );
    });

    if (index === -1) {
      throw new Error(`Global source not found: ${indexOrName}`);
    }
  }

  const removedSource = sources[index];
  if (!removedSource) {
    throw new Error(`Source at index ${index} not found`);
  }

  sources.splice(index, 1);
  config.globalSources = sources;
  saveGlobalConfig(config);

  return { removed: parseSource(removedSource), config };
}

export function findGlobalSourceByName(name: string): SourceObject | null {
  const sources = getGlobalSources();

  for (const source of sources) {
    const parsed = parseSource(source);
    if (parsed.name === name || getSourceDisplayName(parsed) === name) {
      return parsed;
    }
  }

  return null;
}
