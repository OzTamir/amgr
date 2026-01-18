import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';

import { REPO_FILE, GLOBAL_SOURCES_POSITION } from './constants.js';
import { getEffectiveOptions } from './config.js';
import { loadRepoConfig } from './repo-config.js';
import type {
  Source,
  SourceObject,
  GitSource,
  LocalSource,
  ResolvedSource,
  SourceType,
  CombinedUseCases,
} from '../types/sources.js';
import { SOURCE_TYPE } from '../types/sources.js';
import type { AmgrConfig } from '../types/config.js';
import type { Logger } from '../types/common.js';

export const AMGR_CACHE_DIR = join(homedir(), '.amgr', 'cache');

export { SOURCE_TYPE as SOURCE_TYPES };

export function detectSourceType(source: string): SourceType {
  if (
    source.startsWith('https://') ||
    source.startsWith('http://') ||
    source.startsWith('git@') ||
    source.startsWith('git://') ||
    source.endsWith('.git')
  ) {
    return SOURCE_TYPE.GIT;
  }
  return SOURCE_TYPE.LOCAL;
}

export function parseSource(source: Source): SourceObject {
  if (typeof source === 'string') {
    const type = detectSourceType(source);
    if (type === SOURCE_TYPE.GIT) {
      return { type, url: source };
    }
    return { type, path: source };
  }

  if (source.type === SOURCE_TYPE.GIT) {
    const gitSource = source as GitSource;
    if (!gitSource.url) {
      throw new Error('Git source must have a url property');
    }
    return {
      type: SOURCE_TYPE.GIT,
      url: gitSource.url,
      ...(gitSource.name && { name: gitSource.name }),
    };
  }

  if (source.type === SOURCE_TYPE.LOCAL) {
    const localSource = source as LocalSource;
    if (!localSource.path) {
      throw new Error('Local source must have a path property');
    }
    return {
      type: SOURCE_TYPE.LOCAL,
      path: localSource.path,
      ...(localSource.name && { name: localSource.name }),
    };
  }

  throw new Error(`Invalid source type: ${(source as SourceObject).type}`);
}

export function normalizeGitUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^git@/, '')
    .replace(/^git:\/\//, '')
    .replace(/\.git$/, '')
    .replace(/:/g, '-')
    .replace(/\//g, '-')
    .replace(/[^a-zA-Z0-9-_.]/g, '_');
}

export function getGitCachePath(url: string): string {
  const normalized = normalizeGitUrl(url);
  return join(AMGR_CACHE_DIR, normalized);
}

export function expandPath(inputPath: string, basePath = process.cwd()): string {
  if (inputPath.startsWith('~')) {
    return join(homedir(), inputPath.slice(1));
  }
  return resolve(basePath, inputPath);
}

export function isValidAmgrRepo(repoPath: string): boolean {
  const repoFile = join(repoPath, REPO_FILE);
  return existsSync(repoFile);
}

interface FetchOptions {
  logger?: Logger | undefined;
  quiet?: boolean | undefined;
}

export function fetchGitSource(url: string, options: FetchOptions = {}): string {
  const { logger, quiet = true } = options;
  const cachePath = getGitCachePath(url);

  if (!existsSync(AMGR_CACHE_DIR)) {
    mkdirSync(AMGR_CACHE_DIR, { recursive: true });
  }

  const stdio = quiet ? 'pipe' : 'inherit';

  if (existsSync(cachePath)) {
    logger?.verbose?.(`Pulling latest from ${url}...`);
    try {
      execSync('git pull --ff-only', {
        cwd: cachePath,
        stdio,
      });
    } catch {
      logger?.warn?.(`Pull failed, attempting reset for ${url}`);
      try {
        execSync('git fetch origin && git reset --hard origin/HEAD', {
          cwd: cachePath,
          stdio,
        });
      } catch (resetError) {
        const message =
          resetError instanceof Error ? resetError.message : String(resetError);
        throw new Error(`Failed to update git source ${url}: ${message}`);
      }
    }
  } else {
    logger?.verbose?.(`Cloning ${url}...`);
    try {
      execSync(`git clone "${url}" "${cachePath}"`, {
        stdio,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to clone git source ${url}: ${message}`);
    }
  }

  if (!isValidAmgrRepo(cachePath)) {
    throw new Error(
      `Git source ${url} is not a valid amgr repo (missing ${REPO_FILE})`
    );
  }

  return cachePath;
}

interface ResolveOptions {
  logger?: Logger | undefined;
  skipFetch?: boolean | undefined;
}

export function resolveSource(
  source: Source,
  options: ResolveOptions = {}
): ResolvedSource {
  const { logger, skipFetch = false } = options;
  const parsed = parseSource(source);

  if (parsed.type === SOURCE_TYPE.LOCAL) {
    const localPath = expandPath(parsed.path);

    if (!existsSync(localPath)) {
      throw new Error(`Local source path does not exist: ${parsed.path}`);
    }

    if (!isValidAmgrRepo(localPath)) {
      throw new Error(
        `Local source ${parsed.path} is not a valid amgr repo (missing ${REPO_FILE})`
      );
    }

    return {
      ...parsed,
      localPath,
    };
  }

const cachePath = getGitCachePath(parsed.url);

  if (skipFetch && existsSync(cachePath)) {
    return {
      ...parsed,
      localPath: cachePath,
    };
  }

  const localPath = fetchGitSource(parsed.url, { logger });
  return {
    ...parsed,
    localPath,
  };
}

export function resolveSources(
  sources: Source[],
  options: ResolveOptions = {}
): ResolvedSource[] {
  const { logger } = options;
  const resolved: ResolvedSource[] = [];

  for (const source of sources) {
    try {
      const resolvedSource = resolveSource(source, options);
      resolved.push(resolvedSource);
      logger?.verbose?.(`  ✓ ${getSourceDisplayName(resolvedSource)}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger?.error?.(`Failed to resolve source: ${message}`);
      throw e;
    }
  }

  return resolved;
}

export function getSourceDisplayName(source: ResolvedSource | SourceObject): string {
  if (source.name) {
    return source.name;
  }
  if (source.type === SOURCE_TYPE.GIT) {
    const gitSource = source as GitSource | (ResolvedSource & { type: 'git' });
    const url = 'url' in gitSource ? gitSource.url : '';
    if (!url) return 'unknown';
    const urlParts = url.replace(/\.git$/, '').split('/');
    return urlParts[urlParts.length - 1] ?? url;
  }
  const localSource = source as LocalSource | ResolvedSource;
  const path = 'path' in localSource ? localSource.path : localSource.localPath;
  return basename(path ?? '') || path || 'unknown';
}

export function getSourceUseCases(
  source: ResolvedSource
): Record<string, { description: string }> {
  if (!source.localPath) {
    throw new Error('Source must be resolved before getting use-cases');
  }

  try {
    const config = loadRepoConfig(source.localPath);
    return config['use-cases'] ?? {};
  } catch {
    return {};
  }
}

export function getCombinedUseCases(sources: ResolvedSource[]): CombinedUseCases {
  const combined: CombinedUseCases = {};

  for (const source of sources) {
    const useCases = getSourceUseCases(source);
    const sourceName = getSourceDisplayName(source);

    for (const [name, metadata] of Object.entries(useCases)) {
      if (!combined[name]) {
        combined[name] = {
          description: metadata.description,
          sources: [sourceName],
        };
      } else {
        combined[name].sources.push(sourceName);
        combined[name].description = metadata.description;
      }
    }
  }

  return combined;
}

export function getGitCacheLastModified(url: string): Date | null {
  const cachePath = getGitCachePath(url);
  if (!existsSync(cachePath)) {
    return null;
  }

  try {
    const stats = statSync(cachePath);
    return stats.mtime;
  } catch {
    return null;
  }
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function validateSources(sources: unknown): string[] {
  const errors: string[] = [];

  if (!Array.isArray(sources)) {
    errors.push('sources must be an array');
    return errors;
  }

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i] as unknown;

    if (typeof source === 'string') {
      continue;
    }

    if (typeof source !== 'object' || source === null) {
      errors.push(`sources[${i}] must be a string or object`);
      continue;
    }

    const sourceObj = source as Record<string, unknown>;

    if (!sourceObj['type']) {
      errors.push(`sources[${i}] is missing required property: type`);
      continue;
    }

    if (sourceObj['type'] === SOURCE_TYPE.GIT) {
      if (!sourceObj['url']) {
        errors.push(`sources[${i}] (git) is missing required property: url`);
      }
    } else if (sourceObj['type'] === SOURCE_TYPE.LOCAL) {
      if (!sourceObj['path']) {
        errors.push(`sources[${i}] (local) is missing required property: path`);
      }
    } else {
      errors.push(`sources[${i}] has invalid type: ${sourceObj['type']}`);
    }
  }

  return errors;
}

export function getMergedSources(
  projectConfig: AmgrConfig,
  globalSources: Source[] = []
): Source[] {
  const effectiveOptions = getEffectiveOptions(projectConfig);

  if (effectiveOptions.ignoreGlobalSources) {
    return projectConfig.sources ?? [];
  }

  const projectSources = projectConfig.sources ?? [];

  if (effectiveOptions.globalSourcesPosition === GLOBAL_SOURCES_POSITION.APPEND) {
    return [...projectSources, ...globalSources];
  }

  return [...globalSources, ...projectSources];
}
