/**
 * Configuration loading and validation for amgr
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONFIG_DIR,
  CONFIG_FILE,
  VALID_TARGETS,
  VALID_FEATURES,
  DEFAULT_OPTIONS,
  GLOBAL_SOURCES_POSITION
} from './constants.js';
import { validateSources } from './sources.js';

/**
 * Get the config file path for a project
 */
export function getConfigPath(projectPath, customPath) {
  if (customPath) {
    return customPath;
  }
  if (process.env.AMGR_CONFIG) {
    return process.env.AMGR_CONFIG;
  }
  return join(projectPath, CONFIG_DIR, CONFIG_FILE);
}

/**
 * Get the .amgr directory path for a project
 */
export function getAmgrDir(projectPath) {
  return join(projectPath, CONFIG_DIR);
}

/**
 * Check if a config file exists
 */
export function configExists(projectPath, customPath) {
  const configPath = getConfigPath(projectPath, customPath);
  return existsSync(configPath);
}

/**
 * Load and parse the config file
 * Returns the parsed config or throws an error
 */
export function loadConfig(projectPath, customPath) {
  const configPath = getConfigPath(projectPath, customPath);
  
  if (!existsSync(configPath)) {
    throw new Error(
      `No .amgr/config.json found in current directory.\n` +
      `Run 'amgr init' to create one.`
    );
  }

  try {
    const content = readFileSync(configPath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${configPath}: ${e.message}`);
    }
    throw e;
  }
}

export function validateConfig(config) {
  const errors = [];

  if (!config.targets) {
    errors.push('Missing required property: targets');
  }
  if (!config.features) {
    errors.push('Missing required property: features');
  }
  if (!config['use-cases']) {
    errors.push('Missing required property: use-cases');
  }

  if (config.sources !== undefined) {
    const sourceErrors = validateSources(config.sources);
    errors.push(...sourceErrors);
  }

  if (config.targets) {
    if (!Array.isArray(config.targets)) {
      errors.push('Property "targets" must be an array');
    } else if (config.targets.length === 0) {
      errors.push('Property "targets" must have at least one item');
    } else {
      for (const target of config.targets) {
        if (target !== '*' && !VALID_TARGETS.includes(target)) {
          errors.push(
            `Invalid target '${target}'.\n` +
            `Valid targets: ${VALID_TARGETS.join(', ')}`
          );
        }
      }
    }
  }

  if (config.features) {
    if (!Array.isArray(config.features)) {
      errors.push('Property "features" must be an array');
    } else if (config.features.length === 0) {
      errors.push('Property "features" must have at least one item');
    } else {
      for (const feature of config.features) {
        if (!VALID_FEATURES.includes(feature)) {
          errors.push(
            `Invalid feature '${feature}'.\n` +
            `Valid features: ${VALID_FEATURES.join(', ')}`
          );
        }
      }
    }
  }

  if (config['use-cases']) {
    if (!Array.isArray(config['use-cases'])) {
      errors.push('Property "use-cases" must be an array');
    } else if (config['use-cases'].length === 0) {
      errors.push('Property "use-cases" must have at least one item');
    }
  }

  if (config.options) {
    if (typeof config.options !== 'object' || Array.isArray(config.options)) {
      errors.push('Property "options" must be an object');
    } else {
      const validOptionKeys = Object.keys(DEFAULT_OPTIONS);
      const booleanOptions = ['simulateCommands', 'simulateSubagents', 'simulateSkills', 'modularMcp', 'ignoreGlobalSources'];
      const validPositions = Object.values(GLOBAL_SOURCES_POSITION);
      
      for (const key of Object.keys(config.options)) {
        if (!validOptionKeys.includes(key)) {
          errors.push(
            `Invalid option '${key}'.\n` +
            `Valid options: ${validOptionKeys.join(', ')}`
          );
        } else if (key === 'globalSourcesPosition') {
          if (!validPositions.includes(config.options[key])) {
            errors.push(`Option 'globalSourcesPosition' must be one of: ${validPositions.join(', ')}`);
          }
        } else if (booleanOptions.includes(key) && typeof config.options[key] !== 'boolean') {
          errors.push(`Option '${key}' must be a boolean`);
        }
      }
    }
  }

  const validProps = ['$schema', 'sources', 'targets', 'features', 'use-cases', 'options'];
  for (const key of Object.keys(config)) {
    if (!validProps.includes(key)) {
      errors.push(`Unknown property '${key}'`);
    }
  }

  return errors;
}

export function loadAndValidateConfig(projectPath, customPath) {
  const config = loadConfig(projectPath, customPath);
  const errors = validateConfig(config);
  
  if (errors.length > 0) {
    throw new Error(errors[0]);
  }
  
  return config;
}

/**
 * Save config to file
 * @param {string} projectPath - Path to project
 * @param {Object} config - Config object to save
 * @param {string} customPath - Custom config path (optional)
 */
export function saveConfig(projectPath, config, customPath) {
  const configPath = getConfigPath(projectPath, customPath);
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}

/**
 * Check if config has sources defined
 * @param {Object} config - Config object
 * @returns {boolean} True if sources are defined
 */
export function hasSources(config) {
  return config.sources && Array.isArray(config.sources) && config.sources.length > 0;
}

/**
 * Add a source to the config
 * @param {Object} config - Config object
 * @param {Object} source - Source to add
 * @param {number} position - Position to insert at (default: end)
 * @returns {Object} Updated config
 */
export function addSourceToConfig(config, source, position) {
  const sources = config.sources ? [...config.sources] : [];
  
  if (position !== undefined && position >= 0 && position <= sources.length) {
    sources.splice(position, 0, source);
  } else {
    sources.push(source);
  }
  
  return { ...config, sources };
}

/**
 * Remove a source from the config by index
 * @param {Object} config - Config object
 * @param {number} index - Index of source to remove
 * @returns {Object} Updated config
 */
export function removeSourceFromConfig(config, index) {
  if (!config.sources || index < 0 || index >= config.sources.length) {
    throw new Error(`Invalid source index: ${index}`);
  }
  
  const sources = [...config.sources];
  sources.splice(index, 1);
  
  // If no sources left, remove the sources property entirely
  if (sources.length === 0) {
    const { sources: _, ...rest } = config;
    return rest;
  }
  
  return { ...config, sources };
}

/**
 * Get the effective options (merged with defaults)
 */
export function getEffectiveOptions(config) {
  return {
    ...DEFAULT_OPTIONS,
    ...(config.options || {})
  };
}

/**
 * Expand targets (handle "*" wildcard)
 */
export function expandTargets(targets) {
  if (targets.includes('*')) {
    return [...VALID_TARGETS];
  }
  return targets;
}
