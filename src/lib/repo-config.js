/**
 * Repo configuration loading, saving, and validation for amgr
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_FILE, SHARED_DIR, USE_CASES_DIR } from './constants.js';

/**
 * Get the repo.json file path
 */
export function getRepoConfigPath(repoPath) {
  return join(repoPath, REPO_FILE);
}

/**
 * Check if a directory is an amgr repo (contains repo.json)
 */
export function isAmgrRepo(dirPath) {
  return existsSync(getRepoConfigPath(dirPath));
}

/**
 * Check if repo.json exists
 */
export function repoConfigExists(repoPath) {
  return existsSync(getRepoConfigPath(repoPath));
}

/**
 * Load and parse repo.json
 * Returns the parsed config or throws an error
 */
export function loadRepoConfig(repoPath) {
  const configPath = getRepoConfigPath(repoPath);

  if (!existsSync(configPath)) {
    throw new Error(
      `No repo.json found in ${repoPath}.\n` +
      `Run 'amgr repo init' to create one.`
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

/**
 * Save repo.json
 */
export function saveRepoConfig(repoPath, config) {
  const configPath = getRepoConfigPath(repoPath);
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}

/**
 * Validate the repo config object
 * Returns an array of validation errors (empty if valid)
 */
export function validateRepoConfig(config) {
  const errors = [];

  // Check required properties
  if (!config.name) {
    errors.push('Missing required property: name');
  } else if (typeof config.name !== 'string' || config.name.trim() === '') {
    errors.push('Property "name" must be a non-empty string');
  }

  if (!config['use-cases']) {
    errors.push('Missing required property: use-cases');
  } else if (typeof config['use-cases'] !== 'object' || Array.isArray(config['use-cases'])) {
    errors.push('Property "use-cases" must be an object');
  } else {
    // Validate each use-case entry
    for (const [name, useCase] of Object.entries(config['use-cases'])) {
      if (typeof useCase !== 'object' || Array.isArray(useCase)) {
        errors.push(`Use-case "${name}" must be an object`);
      } else if (!useCase.description) {
        errors.push(`Use-case "${name}" is missing required property: description`);
      } else if (typeof useCase.description !== 'string') {
        errors.push(`Use-case "${name}" description must be a string`);
      }
    }
  }

  // Validate optional properties
  if (config.description !== undefined && typeof config.description !== 'string') {
    errors.push('Property "description" must be a string');
  }

  if (config.version !== undefined) {
    if (typeof config.version !== 'string') {
      errors.push('Property "version" must be a string');
    } else if (!/^\d+\.\d+\.\d+$/.test(config.version)) {
      errors.push('Property "version" must be in semver format (e.g., "1.0.0")');
    }
  }

  if (config.author !== undefined && typeof config.author !== 'string') {
    errors.push('Property "author" must be a string');
  }

  // Check for unknown properties
  const validProps = ['$schema', 'name', 'description', 'version', 'author', 'use-cases'];
  for (const key of Object.keys(config)) {
    if (!validProps.includes(key)) {
      errors.push(`Unknown property '${key}'`);
    }
  }

  return errors;
}

/**
 * Load and validate repo config, throwing on first error
 */
export function loadAndValidateRepoConfig(repoPath) {
  const config = loadRepoConfig(repoPath);
  const errors = validateRepoConfig(config);

  if (errors.length > 0) {
    throw new Error(errors[0]);
  }

  return config;
}

/**
 * Get list of use-cases from repo.json
 */
export function getRepoUseCases(repoPath) {
  const config = loadRepoConfig(repoPath);
  return Object.keys(config['use-cases'] || {});
}

/**
 * Get use-case descriptions from repo.json
 */
export function getRepoUseCaseDescriptions(repoPath) {
  const config = loadRepoConfig(repoPath);
  const descriptions = {};
  for (const [name, useCase] of Object.entries(config['use-cases'] || {})) {
    descriptions[name] = useCase.description;
  }
  return descriptions;
}

/**
 * Add a use-case to repo.json
 */
export function addUseCaseToRepo(repoPath, name, description) {
  const config = loadRepoConfig(repoPath);

  if (config['use-cases'][name]) {
    throw new Error(`Use-case "${name}" already exists in repo.json`);
  }

  config['use-cases'][name] = { description };
  saveRepoConfig(repoPath, config);
}

/**
 * Remove a use-case from repo.json
 */
export function removeUseCaseFromRepo(repoPath, name) {
  const config = loadRepoConfig(repoPath);

  if (!config['use-cases'][name]) {
    throw new Error(`Use-case "${name}" does not exist in repo.json`);
  }

  delete config['use-cases'][name];
  saveRepoConfig(repoPath, config);
}

/**
 * Check if a use-case exists in repo.json
 */
export function useCaseExistsInRepo(repoPath, name) {
  const config = loadRepoConfig(repoPath);
  return !!config['use-cases'][name];
}

/**
 * Validate repo structure (check that directories exist)
 */
export function validateRepoStructure(repoPath) {
  const issues = [];

  if (!existsSync(getRepoConfigPath(repoPath))) {
    issues.push('Missing repo.json');
  }

  const sharedDir = join(repoPath, SHARED_DIR);
  if (!existsSync(sharedDir)) {
    issues.push('Missing shared/ directory');
  }

  const useCasesDir = join(repoPath, USE_CASES_DIR);
  if (!existsSync(useCasesDir)) {
    issues.push('Missing use-cases/ directory');
  }

  return issues;
}
