/**
 * Global configuration management for amgr
 * Handles ~/.amgr/config.json for global sources
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

import { validateSources, parseSource, getSourceDisplayName, expandPath, SOURCE_TYPES } from './sources.js';

// Global amgr directory
export const AMGR_GLOBAL_DIR = join(homedir(), '.amgr');
export const GLOBAL_CONFIG_PATH = join(AMGR_GLOBAL_DIR, 'config.json');

/**
 * Get the global config file path
 * @returns {string} Path to ~/.amgr/config.json
 */
export function getGlobalConfigPath() {
  return GLOBAL_CONFIG_PATH;
}

/**
 * Check if global config file exists
 * @returns {boolean} True if global config exists
 */
export function globalConfigExists() {
  return existsSync(GLOBAL_CONFIG_PATH);
}

/**
 * Ensure the global amgr directory exists
 */
export function ensureGlobalDir() {
  if (!existsSync(AMGR_GLOBAL_DIR)) {
    mkdirSync(AMGR_GLOBAL_DIR, { recursive: true });
  }
}

/**
 * Load and parse the global config file
 * Returns empty config structure if file doesn't exist
 * @returns {Object} Global config object
 */
export function loadGlobalConfig() {
  if (!existsSync(GLOBAL_CONFIG_PATH)) {
    return { globalSources: [] };
  }

  try {
    const content = readFileSync(GLOBAL_CONFIG_PATH, 'utf8');
    const config = JSON.parse(content);
    
    // Ensure globalSources array exists
    if (!config.globalSources) {
      config.globalSources = [];
    }
    
    return config;
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`Invalid JSON in global config (${GLOBAL_CONFIG_PATH}): ${e.message}`);
    }
    throw e;
  }
}

/**
 * Save global config to file
 * @param {Object} config - Global config object to save
 */
export function saveGlobalConfig(config) {
  ensureGlobalDir();
  writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

/**
 * Validate global config structure
 * @param {Object} config - Global config object
 * @returns {Array} Array of validation errors (empty if valid)
 */
export function validateGlobalConfig(config) {
  const errors = [];

  if (config.globalSources !== undefined) {
    if (!Array.isArray(config.globalSources)) {
      errors.push('globalSources must be an array');
    } else {
      const sourceErrors = validateSources(config.globalSources);
      errors.push(...sourceErrors.map(e => e.replace('sources', 'globalSources')));
    }
  }

  // Check for unknown properties
  const validProps = ['$schema', 'globalSources'];
  for (const key of Object.keys(config)) {
    if (!validProps.includes(key)) {
      errors.push(`Unknown property '${key}' in global config`);
    }
  }

  return errors;
}

/**
 * Get global sources array
 * @returns {Array} Array of global source objects
 */
export function getGlobalSources() {
  const config = loadGlobalConfig();
  return config.globalSources || [];
}

/**
 * Check if global sources are configured
 * @returns {boolean} True if at least one global source exists
 */
export function hasGlobalSources() {
  const sources = getGlobalSources();
  return sources.length > 0;
}

/**
 * Add a source to global config
 * @param {Object} source - Source object to add
 * @param {number} position - Position to insert at (default: end)
 * @returns {Object} Updated global config
 */
export function addGlobalSource(source, position) {
  const config = loadGlobalConfig();
  const sources = config.globalSources || [];

  // Check for duplicates
  const isDuplicate = sources.some(s => {
    const parsed = parseSource(s);
    if (source.type === SOURCE_TYPES.GIT && parsed.type === SOURCE_TYPES.GIT) {
      return source.url === parsed.url;
    }
    if (source.type === SOURCE_TYPES.LOCAL && parsed.type === SOURCE_TYPES.LOCAL) {
      return expandPath(source.path) === expandPath(parsed.path);
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

/**
 * Remove a source from global config by index or name
 * @param {number|string} indexOrName - Index or name of source to remove
 * @returns {Object} Object with removed source and updated config
 */
export function removeGlobalSource(indexOrName) {
  const config = loadGlobalConfig();
  const sources = config.globalSources || [];

  if (sources.length === 0) {
    throw new Error('No global sources configured');
  }

  let index;
  const parsedIndex = parseInt(indexOrName, 10);

  if (!isNaN(parsedIndex)) {
    // It's an index
    index = parsedIndex;
    if (index < 0 || index >= sources.length) {
      throw new Error(`Invalid source index: ${index}. Valid range: 0-${sources.length - 1}`);
    }
  } else {
    // It's a name, find it
    index = sources.findIndex(s => {
      const parsed = parseSource(s);
      return parsed.name === indexOrName || getSourceDisplayName(parsed) === indexOrName;
    });

    if (index === -1) {
      throw new Error(`Global source not found: ${indexOrName}`);
    }
  }

  const removed = sources.splice(index, 1)[0];
  config.globalSources = sources;
  saveGlobalConfig(config);

  return { removed: parseSource(removed), config };
}

/**
 * Find a global source by name
 * @param {string} name - Name to search for
 * @returns {Object|null} Source object or null if not found
 */
export function findGlobalSourceByName(name) {
  const sources = getGlobalSources();
  
  for (const source of sources) {
    const parsed = parseSource(source);
    if (parsed.name === name || getSourceDisplayName(parsed) === name) {
      return parsed;
    }
  }
  
  return null;
}
