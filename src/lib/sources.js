/**
 * Source management for amgr
 * Handles git clone/pull, path resolution, cache management, and source validation
 */

import { existsSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';

import { REPO_FILE, GLOBAL_SOURCES_POSITION } from './constants.js';
import { getEffectiveOptions } from './config.js';
import { loadRepoConfig } from './repo-config.js';

// Cache directory for git sources
export const AMGR_CACHE_DIR = join(homedir(), '.amgr', 'cache');

/**
 * Source types
 */
export const SOURCE_TYPES = {
  GIT: 'git',
  LOCAL: 'local'
};

/**
 * Detect source type from a string (URL or path)
 */
export function detectSourceType(source) {
  // Git URLs: https://, git@, git://, or ends with .git
  if (
    source.startsWith('https://') ||
    source.startsWith('http://') ||
    source.startsWith('git@') ||
    source.startsWith('git://') ||
    source.endsWith('.git')
  ) {
    return SOURCE_TYPES.GIT;
  }
  return SOURCE_TYPES.LOCAL;
}

/**
 * Parse a source string or object into a normalized source object
 * @param {string|Object} source - Source string (URL/path) or source object
 * @returns {Object} Normalized source object with type, url/path, and optional name
 */
export function parseSource(source) {
  if (typeof source === 'string') {
    const type = detectSourceType(source);
    if (type === SOURCE_TYPES.GIT) {
      return { type, url: source };
    }
    return { type, path: source };
  }
  
  // Already an object, validate and return
  if (source.type === SOURCE_TYPES.GIT) {
    if (!source.url) {
      throw new Error('Git source must have a url property');
    }
    return { type: SOURCE_TYPES.GIT, url: source.url, ...(source.name && { name: source.name }) };
  }
  
  if (source.type === SOURCE_TYPES.LOCAL) {
    if (!source.path) {
      throw new Error('Local source must have a path property');
    }
    return { type: SOURCE_TYPES.LOCAL, path: source.path, ...(source.name && { name: source.name }) };
  }
  
  throw new Error(`Invalid source type: ${source.type}`);
}

/**
 * Normalize a git URL to create a cache directory name
 * @param {string} url - Git URL
 * @returns {string} Normalized name for cache directory
 */
export function normalizeGitUrl(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^git@/, '')
    .replace(/^git:\/\//, '')
    .replace(/\.git$/, '')
    .replace(/:/g, '-')
    .replace(/\//g, '-')
    .replace(/[^a-zA-Z0-9-_.]/g, '_');
}

/**
 * Get the cache path for a git source
 * @param {string} url - Git URL
 * @returns {string} Path to the cached repository
 */
export function getGitCachePath(url) {
  const normalized = normalizeGitUrl(url);
  return join(AMGR_CACHE_DIR, normalized);
}

/**
 * Expand ~ to home directory and resolve relative paths
 * @param {string} inputPath - Path that may contain ~ or be relative
 * @param {string} basePath - Base path for resolving relative paths (default: cwd)
 * @returns {string} Absolute path
 */
export function expandPath(inputPath, basePath = process.cwd()) {
  if (inputPath.startsWith('~')) {
    return join(homedir(), inputPath.slice(1));
  }
  return resolve(basePath, inputPath);
}

/**
 * Check if a path is a valid amgr repo (contains repo.json)
 * @param {string} repoPath - Path to check
 * @returns {boolean} True if valid amgr repo
 */
export function isValidAmgrRepo(repoPath) {
  const repoFile = join(repoPath, REPO_FILE);
  return existsSync(repoFile);
}

/**
 * Clone or pull a git repository
 * @param {string} url - Git URL to clone/pull
 * @param {Object} options - Options
 * @param {Object} options.logger - Logger instance
 * @param {boolean} options.quiet - Suppress git output
 * @returns {string} Path to the cloned/updated repository
 */
export function fetchGitSource(url, options = {}) {
  const { logger, quiet = true } = options;
  const cachePath = getGitCachePath(url);
  
  // Ensure cache directory exists
  if (!existsSync(AMGR_CACHE_DIR)) {
    mkdirSync(AMGR_CACHE_DIR, { recursive: true });
  }
  
  const stdio = quiet ? 'pipe' : 'inherit';
  
  if (existsSync(cachePath)) {
    // Pull latest
    logger?.verbose?.(`Pulling latest from ${url}...`);
    try {
      execSync('git pull --ff-only', {
        cwd: cachePath,
        stdio
      });
    } catch (e) {
      // If pull fails (e.g., dirty state), try to reset and pull
      logger?.warn?.(`Pull failed, attempting reset for ${url}`);
      try {
        execSync('git fetch origin && git reset --hard origin/HEAD', {
          cwd: cachePath,
          stdio
        });
      } catch (resetError) {
        throw new Error(`Failed to update git source ${url}: ${resetError.message}`);
      }
    }
  } else {
    // Clone
    logger?.verbose?.(`Cloning ${url}...`);
    try {
      execSync(`git clone "${url}" "${cachePath}"`, {
        stdio
      });
    } catch (e) {
      throw new Error(`Failed to clone git source ${url}: ${e.message}`);
    }
  }
  
  // Validate it's an amgr repo
  if (!isValidAmgrRepo(cachePath)) {
    throw new Error(
      `Git source ${url} is not a valid amgr repo (missing ${REPO_FILE})`
    );
  }
  
  return cachePath;
}

/**
 * Resolve a source to its local path
 * For local sources: expand path and validate
 * For git sources: clone/pull and return cache path
 * 
 * @param {Object} source - Source object from config
 * @param {Object} options - Options
 * @param {Object} options.logger - Logger instance
 * @param {boolean} options.skipFetch - Skip fetching git sources (use cached)
 * @returns {Object} Resolved source with localPath property
 */
export function resolveSource(source, options = {}) {
  const { logger, skipFetch = false } = options;
  const parsed = parseSource(source);
  
  if (parsed.type === SOURCE_TYPES.LOCAL) {
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
      localPath
    };
  }
  
  if (parsed.type === SOURCE_TYPES.GIT) {
    const cachePath = getGitCachePath(parsed.url);
    
    if (skipFetch && existsSync(cachePath)) {
      // Use cached version without fetching
      return {
        ...parsed,
        localPath: cachePath
      };
    }
    
    const localPath = fetchGitSource(parsed.url, { logger });
    return {
      ...parsed,
      localPath
    };
  }
  
  throw new Error(`Unknown source type: ${parsed.type}`);
}

/**
 * Resolve multiple sources to their local paths
 * @param {Array} sources - Array of source objects
 * @param {Object} options - Options
 * @returns {Array} Array of resolved sources with localPath property
 */
export function resolveSources(sources, options = {}) {
  const { logger } = options;
  const resolved = [];
  
  for (const source of sources) {
    try {
      const resolvedSource = resolveSource(source, options);
      resolved.push(resolvedSource);
      logger?.verbose?.(`  ✓ ${getSourceDisplayName(resolvedSource)}`);
    } catch (e) {
      logger?.error?.(`Failed to resolve source: ${e.message}`);
      throw e;
    }
  }
  
  return resolved;
}

/**
 * Get a display name for a source
 * @param {Object} source - Source object
 * @returns {string} Display name
 */
export function getSourceDisplayName(source) {
  if (source.name) {
    return source.name;
  }
  if (source.type === SOURCE_TYPES.GIT) {
    // Extract repo name from URL
    const urlParts = source.url.replace(/\.git$/, '').split('/');
    return urlParts[urlParts.length - 1] || source.url;
  }
  // For local, use the last directory name or the path itself
  const path = source.path || source.localPath;
  return basename(path) || path;
}

/**
 * Get use-cases from a resolved source
 * @param {Object} source - Resolved source with localPath
 * @returns {Object} Object with use-case names as keys and descriptions as values
 */
export function getSourceUseCases(source) {
  if (!source.localPath) {
    throw new Error('Source must be resolved before getting use-cases');
  }
  
  try {
    const config = loadRepoConfig(source.localPath);
    return config['use-cases'] || {};
  } catch (e) {
    return {};
  }
}

/**
 * Get combined use-cases from multiple resolved sources
 * Returns use-cases with their source attribution
 * @param {Array} sources - Array of resolved sources
 * @returns {Object} Object with use-case names as keys and metadata as values
 */
export function getCombinedUseCases(sources) {
  const combined = {};
  
  for (const source of sources) {
    const useCases = getSourceUseCases(source);
    const sourceName = getSourceDisplayName(source);
    
    for (const [name, metadata] of Object.entries(useCases)) {
      if (!combined[name]) {
        combined[name] = {
          description: metadata.description,
          sources: [sourceName]
        };
      } else {
        // Use-case exists from earlier source, this one overrides
        combined[name].sources.push(sourceName);
        // Keep the later description as the override
        combined[name].description = metadata.description;
      }
    }
  }
  
  return combined;
}

/**
 * Get the last modified time of a cached git source
 * @param {string} url - Git URL
 * @returns {Date|null} Last modified time or null if not cached
 */
export function getGitCacheLastModified(url) {
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

/**
 * Format a relative time string (e.g., "2 hours ago")
 * @param {Date} date - Date to format
 * @returns {string} Relative time string
 */
export function formatRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Validate a sources array
 * @param {Array} sources - Array of source objects
 * @returns {Array} Array of validation errors (empty if valid)
 */
export function validateSources(sources) {
  const errors = [];
  
  if (!Array.isArray(sources)) {
    errors.push('sources must be an array');
    return errors;
  }
  
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    
    if (typeof source === 'string') {
      continue;
    }
    
    if (typeof source !== 'object' || source === null) {
      errors.push(`sources[${i}] must be a string or object`);
      continue;
    }
    
    if (!source.type) {
      errors.push(`sources[${i}] is missing required property: type`);
      continue;
    }
    
    if (source.type === SOURCE_TYPES.GIT) {
      if (!source.url) {
        errors.push(`sources[${i}] (git) is missing required property: url`);
      }
    } else if (source.type === SOURCE_TYPES.LOCAL) {
      if (!source.path) {
        errors.push(`sources[${i}] (local) is missing required property: path`);
      }
    } else {
      errors.push(`sources[${i}] has invalid type: ${source.type}`);
    }
  }
  
  return errors;
}

export function getMergedSources(projectConfig, globalSources = []) {
  const effectiveOptions = getEffectiveOptions(projectConfig);

  if (effectiveOptions.ignoreGlobalSources) {
    return projectConfig.sources || [];
  }

  const projectSources = projectConfig.sources || [];

  if (effectiveOptions.globalSourcesPosition === GLOBAL_SOURCES_POSITION.APPEND) {
    return [...projectSources, ...globalSources];
  }

  return [...globalSources, ...projectSources];
}
