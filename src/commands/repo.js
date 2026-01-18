/**
 * Repo command for amgr
 * Manages amgr repositories (init, add, remove, list)
 */

import { existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { input, confirm } from '@inquirer/prompts';

import {
  REPO_FILE,
  SHARED_DIR,
  USE_CASES_DIR,
  RULESYNC_DIR,
  RULESYNC_CONFIG,
  ENTITY_TYPES
} from '../lib/constants.js';
import {
  isAmgrRepo,
  loadRepoConfig,
  saveRepoConfig,
  addUseCaseToRepo,
  removeUseCaseFromRepo,
  useCaseExistsInRepo
} from '../lib/repo-config.js';
import { createLogger } from '../lib/utils.js';

/**
 * Execute the repo init command
 * Creates a new amgr repo in the current directory
 */
export async function repoInit(options = {}) {
  const repoPath = process.cwd();
  const logger = createLogger(options.verbose);

  try {
    // Check if already an amgr repo
    if (isAmgrRepo(repoPath)) {
      const overwrite = await confirm({
        message: 'This directory already contains a repo.json. Reinitialize?',
        default: false
      });

      if (!overwrite) {
        logger.info('Aborted. Existing repo preserved.');
        return;
      }
    }

    logger.info('Initializing amgr repository...\n');

    // Get repo name (default to directory name)
    const defaultName = basename(repoPath);
    const name = options.name || await input({
      message: 'Repository name:',
      default: defaultName,
      validate: (value) => value.trim() ? true : 'Name is required'
    });

    // Get description
    const description = options.description !== undefined ? options.description : await input({
      message: 'Description (optional):',
      default: ''
    });

    // Get author
    const author = options.author !== undefined ? options.author : await input({
      message: 'Author (optional):',
      default: ''
    });

    // Build repo config
    const repoConfig = {
      "$schema": "https://raw.githubusercontent.com/oztamir/amgr/main/schemas/amgr-repo.schema.json",
      name: name.trim(),
      ...(description.trim() && { description: description.trim() }),
      version: "1.0.0",
      ...(author.trim() && { author: author.trim() }),
      "use-cases": {}
    };

    // Create directory structure
    const sharedDir = join(repoPath, SHARED_DIR);
    const useCasesDir = join(repoPath, USE_CASES_DIR);

    // Create shared directory with subdirectories
    for (const entityType of ENTITY_TYPES) {
      const entityDir = join(sharedDir, entityType);
      if (!existsSync(entityDir)) {
        mkdirSync(entityDir, { recursive: true });
      }
    }

    // Create use-cases directory
    if (!existsSync(useCasesDir)) {
      mkdirSync(useCasesDir, { recursive: true });
    }

    // Write repo.json
    saveRepoConfig(repoPath, repoConfig);

    logger.info('');
    logger.success(`Initialized amgr repo: ${name}`);
    logger.info('\nCreated structure:');
    logger.info('  repo.json');
    logger.info('  shared/');
    for (const entityType of ENTITY_TYPES) {
      logger.info(`    ${entityType}/`);
    }
    logger.info('  use-cases/');
    logger.info('\nNext steps:');
    logger.info('  1. Add use-cases with "amgr repo add <name>"');
    logger.info('  2. Add shared content to shared/rules/, shared/commands/, etc.');
    logger.info('  3. Use this repo as a source with "amgr source add ."');

  } catch (e) {
    if (e.name === 'ExitPromptError') {
      logger.info('\nAborted.');
      return;
    }
    logger.error(e.message);
    process.exit(1);
  }
}

/**
 * Execute the repo add command
 * Adds a new use-case to the repo
 */
export async function repoAdd(name, options = {}) {
  const repoPath = process.cwd();
  const logger = createLogger(options.verbose);

  try {
    // Check if this is an amgr repo
    if (!isAmgrRepo(repoPath)) {
      throw new Error(
        'Not an amgr repo. Run "amgr repo init" first.'
      );
    }

    // Validate use-case name
    if (!name || !name.trim()) {
      throw new Error('Use-case name is required');
    }

    const useCaseName = name.trim().toLowerCase().replace(/\s+/g, '-');

    // Check if use-case already exists
    if (useCaseExistsInRepo(repoPath, useCaseName)) {
      throw new Error(`Use-case "${useCaseName}" already exists`);
    }

    // Check if directory already exists
    const useCaseDir = join(repoPath, USE_CASES_DIR, useCaseName);
    if (existsSync(useCaseDir)) {
      const useExisting = await confirm({
        message: `Directory use-cases/${useCaseName}/ already exists. Register it in repo.json?`,
        default: true
      });

      if (!useExisting) {
        logger.info('Aborted.');
        return;
      }
    }

    logger.info(`Adding use-case: ${useCaseName}\n`);

    // Get description
    const description = options.description || await input({
      message: 'Description:',
      validate: (value) => value.trim() ? true : 'Description is required'
    });

    // Create use-case directory structure
    const rulesyncDir = join(useCaseDir, RULESYNC_DIR);

    // Create .rulesync subdirectories
    for (const entityType of ENTITY_TYPES) {
      const entityDir = join(rulesyncDir, entityType);
      if (!existsSync(entityDir)) {
        mkdirSync(entityDir, { recursive: true });
      }
    }

    // Create rulesync.jsonc with default content
    const rulesyncConfigPath = join(useCaseDir, RULESYNC_CONFIG);
    if (!existsSync(rulesyncConfigPath)) {
      const rulesyncConfig = {
        "$schema": "https://raw.githubusercontent.com/dyoshikawa/rulesync/refs/heads/main/config-schema.json",
        // Use-case specific overrides can go here
      };
      const fs = await import('node:fs');
      fs.writeFileSync(
        rulesyncConfigPath,
        `// ${useCaseName} use-case configuration\n` +
        `// Add use-case specific rulesync options here\n` +
        JSON.stringify(rulesyncConfig, null, 2) + '\n'
      );
    }

    // Add to repo.json
    addUseCaseToRepo(repoPath, useCaseName, description.trim());

    logger.info('');
    logger.success(`Added use-case: ${useCaseName}`);
    logger.info('\nCreated structure:');
    logger.info(`  use-cases/${useCaseName}/`);
    logger.info(`    ${RULESYNC_DIR}/`);
    for (const entityType of ENTITY_TYPES) {
      logger.info(`      ${entityType}/`);
    }
    logger.info(`    ${RULESYNC_CONFIG}`);
    logger.info('\nNext steps:');
    logger.info(`  1. Add rules to use-cases/${useCaseName}/.rulesync/rules/`);
    logger.info(`  2. Add commands to use-cases/${useCaseName}/.rulesync/commands/`);
    logger.info(`  3. Add skills to use-cases/${useCaseName}/.rulesync/skills/`);

  } catch (e) {
    if (e.name === 'ExitPromptError') {
      logger.info('\nAborted.');
      return;
    }
    logger.error(e.message);
    process.exit(1);
  }
}

/**
 * Execute the repo remove command
 * Removes a use-case from the repo
 */
export async function repoRemove(name, options = {}) {
  const repoPath = process.cwd();
  const logger = createLogger(options.verbose);

  try {
    // Check if this is an amgr repo
    if (!isAmgrRepo(repoPath)) {
      throw new Error(
        'Not an amgr repo. Run "amgr repo init" first.'
      );
    }

    // Validate use-case name
    if (!name || !name.trim()) {
      throw new Error('Use-case name is required');
    }

    const useCaseName = name.trim();

    // Check if use-case exists in repo.json
    if (!useCaseExistsInRepo(repoPath, useCaseName)) {
      throw new Error(`Use-case "${useCaseName}" does not exist in repo.json`);
    }

    // Confirm deletion
    if (!options.force) {
      const confirmDelete = await confirm({
        message: `Remove use-case "${useCaseName}"? This will delete the directory and all its contents.`,
        default: false
      });

      if (!confirmDelete) {
        logger.info('Aborted.');
        return;
      }
    }

    // Remove directory if it exists
    const useCaseDir = join(repoPath, USE_CASES_DIR, useCaseName);
    if (existsSync(useCaseDir)) {
      rmSync(useCaseDir, { recursive: true });
      logger.verbose(`Removed directory: use-cases/${useCaseName}/`);
    }

    // Remove from repo.json
    removeUseCaseFromRepo(repoPath, useCaseName);

    logger.success(`Removed use-case: ${useCaseName}`);

  } catch (e) {
    if (e.name === 'ExitPromptError') {
      logger.info('\nAborted.');
      return;
    }
    logger.error(e.message);
    process.exit(1);
  }
}

/**
 * Execute the repo list command
 * Lists use-cases in the current repo
 */
export async function repoList(options = {}) {
  const repoPath = process.cwd();
  const logger = createLogger(options.verbose);

  try {
    // Check if this is an amgr repo
    if (!isAmgrRepo(repoPath)) {
      throw new Error(
        'Not an amgr repo. Run "amgr repo init" first.'
      );
    }

    const config = loadRepoConfig(repoPath);
    const useCases = config['use-cases'] || {};
    const useCaseNames = Object.keys(useCases);

    // Check which use-cases have directories
    const useCasesDir = join(repoPath, USE_CASES_DIR);
    const existingDirs = existsSync(useCasesDir)
      ? readdirSync(useCasesDir, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => d.name)
      : [];

    console.log(`\nRepository: ${config.name}`);
    if (config.description) {
      console.log(`Description: ${config.description}`);
    }
    if (config.version) {
      console.log(`Version: ${config.version}`);
    }

    console.log('\nUse-cases:');
    if (useCaseNames.length === 0) {
      console.log('  (none)');
      console.log('\n  Run "amgr repo add <name>" to add a use-case.');
    } else {
      for (const name of useCaseNames) {
        const desc = useCases[name].description;
        const hasDir = existingDirs.includes(name);
        const status = hasDir ? '' : ' (missing directory)';
        console.log(`  ${name.padEnd(16)} - ${desc}${status}`);
      }
    }

    // Check for orphaned directories (directories not in repo.json)
    const orphaned = existingDirs.filter(d => !useCaseNames.includes(d));
    if (orphaned.length > 0 && options.verbose) {
      console.log('\nOrphaned directories (not in repo.json):');
      for (const dir of orphaned) {
        console.log(`  ${dir}`);
      }
    }

    console.log('');

  } catch (e) {
    logger.error(e.message);
    process.exit(1);
  }
}
