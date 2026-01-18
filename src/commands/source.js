/**
 * Source command for amgr
 * Manages sources (add, remove, list)
 */

import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { confirm, input } from '@inquirer/prompts';

import { CONFIG_DIR } from '../lib/constants.js';
import {
  configExists,
  loadConfig,
  saveConfig,
  addSourceToConfig,
  removeSourceFromConfig,
  getConfigPath
} from '../lib/config.js';
import {
  parseSource,
  resolveSource,
  getSourceDisplayName,
  getSourceUseCases,
  getCombinedUseCases,
  getGitCacheLastModified,
  formatRelativeTime,
  SOURCE_TYPES,
  isValidAmgrRepo,
  expandPath
} from '../lib/sources.js';
import { createLogger } from '../lib/utils.js';

/**
 * Execute the source add command
 * Add a source to the project config
 */
export async function sourceAdd(sourceInput, options = {}) {
  const projectPath = process.cwd();
  const logger = createLogger(options.verbose);

  try {
    // Check if config exists
    if (!configExists(projectPath)) {
      throw new Error(
        'No .amgr/config.json found in current directory.\n' +
        'Run \'amgr init\' to create one first, or create a minimal config.'
      );
    }

    // Parse the source
    let source;
    try {
      source = parseSource(sourceInput);
    } catch (e) {
      throw new Error(`Invalid source: ${e.message}`);
    }

    // Add optional name
    if (options.name) {
      source.name = options.name;
    }

    logger.verbose(`Parsed source: ${JSON.stringify(source)}`);

    // Validate the source exists and is a valid amgr repo
    logger.info(`Validating source: ${sourceInput}...`);
    try {
      const resolved = resolveSource(source, { logger, skipFetch: false });
      logger.verbose(`Resolved to: ${resolved.localPath}`);
    } catch (e) {
      throw new Error(`Source validation failed: ${e.message}`);
    }

    // Load current config
    const config = loadConfig(projectPath);

    // Check if source already exists
    const existingSources = config.sources || [];
    const isDuplicate = existingSources.some(s => {
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
      throw new Error('This source is already configured');
    }

    // Add to config
    const position = options.position !== undefined ? parseInt(options.position, 10) : undefined;
    const updatedConfig = addSourceToConfig(config, source, position);

    // Save config
    saveConfig(projectPath, updatedConfig);

    const displayName = getSourceDisplayName(source);
    const positionLabel = position !== undefined ? ` at position ${position}` : '';
    logger.success(`Added source: ${displayName}${positionLabel}`);

    // Show available use-cases from the new source
    const resolved = resolveSource(source, { skipFetch: true });
    const useCases = getSourceUseCases(resolved);
    const useCaseNames = Object.keys(useCases);
    
    if (useCaseNames.length > 0) {
      logger.info(`\nAvailable use-cases from ${displayName}:`);
      for (const name of useCaseNames) {
        logger.info(`  ${name} - ${useCases[name].description}`);
      }
      logger.info('\nRun \'amgr sync\' to apply changes.');
    }

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
 * Execute the source remove command
 * Remove a source from the project config
 */
export async function sourceRemove(indexOrName, options = {}) {
  const projectPath = process.cwd();
  const logger = createLogger(options.verbose);

  try {
    // Check if config exists
    if (!configExists(projectPath)) {
      throw new Error(
        'No .amgr/config.json found in current directory.\n' +
        'Run \'amgr init\' to create one first.'
      );
    }

    // Load current config
    const config = loadConfig(projectPath);

    if (!config.sources || config.sources.length === 0) {
      throw new Error('No sources configured');
    }

    // Find the source to remove
    let index;
    const parsedIndex = parseInt(indexOrName, 10);
    
    if (!isNaN(parsedIndex)) {
      // It's an index
      index = parsedIndex;
      if (index < 0 || index >= config.sources.length) {
        throw new Error(`Invalid source index: ${index}. Valid range: 0-${config.sources.length - 1}`);
      }
    } else {
      // It's a name, find it
      index = config.sources.findIndex(s => {
        const parsed = parseSource(s);
        return parsed.name === indexOrName || getSourceDisplayName(parsed) === indexOrName;
      });
      
      if (index === -1) {
        throw new Error(`Source not found: ${indexOrName}`);
      }
    }

    const sourceToRemove = parseSource(config.sources[index]);
    const displayName = getSourceDisplayName(sourceToRemove);

    // Confirm removal
    if (!options.force) {
      const confirmRemove = await confirm({
        message: `Remove source "${displayName}"?`,
        default: false
      });

      if (!confirmRemove) {
        logger.info('Aborted.');
        return;
      }
    }

    // Remove from config
    const updatedConfig = removeSourceFromConfig(config, index);

    // Save config
    saveConfig(projectPath, updatedConfig);

    logger.success(`Removed source: ${displayName}`);
    logger.info('\nRun \'amgr sync\' to apply changes.');

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
 * Execute the source list command
 * List configured sources and their status
 */
export async function sourceList(options = {}) {
  const projectPath = process.cwd();
  const logger = createLogger(options.verbose);

  try {
    // Check if config exists
    if (!configExists(projectPath)) {
      throw new Error(
        'No .amgr/config.json found in current directory.\n' +
        'Run \'amgr init\' to create one first.'
      );
    }

    // Load current config
    const config = loadConfig(projectPath);

    const sources = config.sources || [];
    
    if (sources.length === 0) {
      console.log('\nNo sources configured.');
      console.log('Using default agents repository.');
      console.log('\nRun \'amgr source add <url-or-path>\' to add a source.');
      return;
    }

    console.log('\nConfigured sources:');
    
    const resolvedSources = [];
    for (let i = 0; i < sources.length; i++) {
      const source = parseSource(sources[i]);
      const displayName = getSourceDisplayName(source);
      
      let status = '';
      let resolved = null;
      
      try {
        // Try to resolve without fetching to check status
        resolved = resolveSource(source, { skipFetch: true });
        resolvedSources.push(resolved);
        
        if (source.type === SOURCE_TYPES.GIT) {
          const lastModified = getGitCacheLastModified(source.url);
          if (lastModified) {
            status = `(cached, updated ${formatRelativeTime(lastModified)})`;
          } else {
            status = '(not cached)';
          }
        } else {
          status = '(valid)';
        }
      } catch (e) {
        if (source.type === SOURCE_TYPES.GIT) {
          status = '(not cached)';
        } else {
          status = `(error: ${e.message})`;
        }
      }

      const typeLabel = source.type === SOURCE_TYPES.GIT ? 'git' : 'local';
      const locationLabel = source.type === SOURCE_TYPES.GIT ? source.url : source.path;
      
      console.log(`  ${i}. ${typeLabel}: ${displayName} ${status}`);
      if (options.verbose) {
        console.log(`     ${locationLabel}`);
      }
    }

    // Show combined use-cases
    if (resolvedSources.length > 0) {
      const combinedUseCases = getCombinedUseCases(resolvedSources);
      const useCaseNames = Object.keys(combinedUseCases);
      
      if (useCaseNames.length > 0) {
        console.log('\nAvailable use-cases:');
        for (const name of useCaseNames.sort()) {
          const { description, sources: ucSources } = combinedUseCases[name];
          const sourceLabel = ucSources.length > 1 
            ? ` (${ucSources.join(', ')})`
            : ` (${ucSources[0]})`;
          console.log(`  ${name.padEnd(20)} - ${description}${sourceLabel}`);
        }
      }
    }

    console.log('');

  } catch (e) {
    logger.error(e.message);
    process.exit(1);
  }
}

/**
 * Execute the source update command
 * Manually refresh all git sources
 */
export async function sourceUpdate(options = {}) {
  const projectPath = process.cwd();
  const logger = createLogger(options.verbose);

  try {
    // Check if config exists
    if (!configExists(projectPath)) {
      throw new Error(
        'No .amgr/config.json found in current directory.\n' +
        'Run \'amgr init\' to create one first.'
      );
    }

    // Load current config
    const config = loadConfig(projectPath);

    const sources = config.sources || [];
    
    if (sources.length === 0) {
      logger.info('No sources configured.');
      return;
    }

    logger.info('Updating sources...');

    let gitCount = 0;
    let localCount = 0;
    let errorCount = 0;

    for (const source of sources) {
      const parsed = parseSource(source);
      const displayName = getSourceDisplayName(parsed);

      try {
        if (parsed.type === SOURCE_TYPES.GIT) {
          logger.verbose(`Fetching ${displayName}...`);
          resolveSource(parsed, { logger, skipFetch: false });
          logger.info(`  ✓ ${displayName} (updated)`);
          gitCount++;
        } else {
          // Validate local source still exists
          resolveSource(parsed, { skipFetch: true });
          logger.info(`  ✓ ${displayName} (local)`);
          localCount++;
        }
      } catch (e) {
        logger.warn(`  ✗ ${displayName}: ${e.message}`);
        errorCount++;
      }
    }

    logger.info('');
    if (gitCount > 0) {
      logger.success(`Updated ${gitCount} git source(s)`);
    }
    if (localCount > 0) {
      logger.info(`Validated ${localCount} local source(s)`);
    }
    if (errorCount > 0) {
      logger.warn(`${errorCount} source(s) had errors`);
    }

  } catch (e) {
    logger.error(e.message);
    process.exit(1);
  }
}
