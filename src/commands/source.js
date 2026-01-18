import { confirm } from '@inquirer/prompts';

import { CONFIG_DIR } from '../lib/constants.js';
import {
  configExists,
  loadConfig,
  saveConfig,
  addSourceToConfig,
  removeSourceFromConfig
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
  expandPath
} from '../lib/sources.js';
import {
  getGlobalSources,
  addGlobalSource,
  removeGlobalSource,
  getGlobalConfigPath
} from '../lib/global-config.js';
import { createLogger } from '../lib/utils.js';

export async function sourceAdd(sourceInput, options = {}) {
  const projectPath = process.cwd();
  const logger = createLogger(options.verbose);
  const isGlobal = options.global;

  try {
    if (!isGlobal && !configExists(projectPath)) {
      throw new Error(
        'No .amgr/config.json found in current directory.\n' +
        'Run \'amgr init\' to create one first, or use --global to add a global source.'
      );
    }

    let source;
    try {
      source = parseSource(sourceInput);
    } catch (e) {
      throw new Error(`Invalid source: ${e.message}`);
    }

    if (options.name) {
      source.name = options.name;
    }

    logger.verbose(`Parsed source: ${JSON.stringify(source)}`);

    logger.info(`Validating source: ${sourceInput}...`);
    try {
      const resolved = resolveSource(source, { logger, skipFetch: false });
      logger.verbose(`Resolved to: ${resolved.localPath}`);
    } catch (e) {
      throw new Error(`Source validation failed: ${e.message}`);
    }

    const position = options.position !== undefined ? parseInt(options.position, 10) : undefined;

    if (isGlobal) {
      addGlobalSource(source, position);
      const displayName = getSourceDisplayName(source);
      const positionLabel = position !== undefined ? ` at position ${position}` : '';
      logger.success(`Added global source: ${displayName}${positionLabel}`);
      logger.info('This source will be available to all projects.');
    } else {
      const config = loadConfig(projectPath);

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

      const updatedConfig = addSourceToConfig(config, source, position);
      saveConfig(projectPath, updatedConfig);

      const displayName = getSourceDisplayName(source);
      const positionLabel = position !== undefined ? ` at position ${position}` : '';
      logger.success(`Added source: ${displayName}${positionLabel}`);
    }

    const resolved = resolveSource(source, { skipFetch: true });
    const useCases = getSourceUseCases(resolved);
    const useCaseNames = Object.keys(useCases);

    if (useCaseNames.length > 0) {
      const displayName = getSourceDisplayName(source);
      logger.info(`\nAvailable use-cases from ${displayName}:`);
      for (const name of useCaseNames) {
        logger.info(`  ${name} - ${useCases[name].description}`);
      }
      if (!isGlobal) {
        logger.info('\nRun \'amgr sync\' to apply changes.');
      }
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

export async function sourceRemove(indexOrName, options = {}) {
  const projectPath = process.cwd();
  const logger = createLogger(options.verbose);
  const isGlobal = options.global;

  try {
    if (isGlobal) {
      const globalSources = getGlobalSources();
      if (globalSources.length === 0) {
        throw new Error('No global sources configured');
      }

      let sourceToRemove;
      const parsedIndex = parseInt(indexOrName, 10);

      if (!isNaN(parsedIndex)) {
        if (parsedIndex < 0 || parsedIndex >= globalSources.length) {
          throw new Error(`Invalid source index: ${parsedIndex}. Valid range: 0-${globalSources.length - 1}`);
        }
        sourceToRemove = parseSource(globalSources[parsedIndex]);
      } else {
        const found = globalSources.find(s => {
          const parsed = parseSource(s);
          return parsed.name === indexOrName || getSourceDisplayName(parsed) === indexOrName;
        });
        if (!found) {
          throw new Error(`Global source not found: ${indexOrName}`);
        }
        sourceToRemove = parseSource(found);
      }

      const displayName = getSourceDisplayName(sourceToRemove);

      if (!options.force) {
        const confirmRemove = await confirm({
          message: `Remove global source "${displayName}"?`,
          default: false
        });

        if (!confirmRemove) {
          logger.info('Aborted.');
          return;
        }
      }

      removeGlobalSource(indexOrName);
      logger.success(`Removed global source: ${displayName}`);

    } else {
      if (!configExists(projectPath)) {
        throw new Error(
          'No .amgr/config.json found in current directory.\n' +
          'Run \'amgr init\' to create one first.'
        );
      }

      const config = loadConfig(projectPath);

      if (!config.sources || config.sources.length === 0) {
        throw new Error('No project sources configured');
      }

      let index;
      const parsedIndex = parseInt(indexOrName, 10);

      if (!isNaN(parsedIndex)) {
        index = parsedIndex;
        if (index < 0 || index >= config.sources.length) {
          throw new Error(`Invalid source index: ${index}. Valid range: 0-${config.sources.length - 1}`);
        }
      } else {
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

      const updatedConfig = removeSourceFromConfig(config, index);
      saveConfig(projectPath, updatedConfig);

      logger.success(`Removed source: ${displayName}`);
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

function printSourcesList(sources, label, startIndex, options, resolvedSources) {
  const logger = createLogger(options.verbose);
  
  if (sources.length === 0) return startIndex;

  console.log(`\n${label}:`);

  for (let i = 0; i < sources.length; i++) {
    const source = parseSource(sources[i]);
    const displayName = getSourceDisplayName(source);

    let status = '';
    let resolved = null;

    try {
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

    console.log(`  ${startIndex + i}. ${typeLabel}: ${displayName} ${status}`);
    if (options.verbose) {
      console.log(`     ${locationLabel}`);
    }
  }

  return startIndex + sources.length;
}

export async function sourceList(options = {}) {
  const projectPath = process.cwd();
  const logger = createLogger(options.verbose);
  const isGlobal = options.global;

  try {
    const globalSources = getGlobalSources();
    const hasProjectConfig = configExists(projectPath);
    const projectSources = hasProjectConfig ? (loadConfig(projectPath).sources || []) : [];

    if (isGlobal) {
      if (globalSources.length === 0) {
        console.log('\nNo global sources configured.');
        console.log(`Global config: ${getGlobalConfigPath()}`);
        console.log('\nRun \'amgr source add <url-or-path> --global\' to add a global source.');
        return;
      }

      const resolvedSources = [];
      printSourcesList(globalSources, 'Global sources', 0, options, resolvedSources);

      if (resolvedSources.length > 0) {
        const combinedUseCases = getCombinedUseCases(resolvedSources);
        const useCaseNames = Object.keys(combinedUseCases);

        if (useCaseNames.length > 0) {
          console.log('\nAvailable use-cases:');
          for (const name of useCaseNames.sort()) {
            const { description } = combinedUseCases[name];
            console.log(`  ${name.padEnd(20)} - ${description}`);
          }
        }
      }

      console.log('');
      return;
    }

    if (globalSources.length === 0 && projectSources.length === 0) {
      console.log('\nNo sources configured.');
      console.log('\nAdd a global source: amgr source add <url-or-path> --global');
      if (hasProjectConfig) {
        console.log('Add a project source: amgr source add <url-or-path>');
      } else {
        console.log('Or run \'amgr init\' to set up a project.');
      }
      return;
    }

    const resolvedSources = [];
    let nextIndex = 0;

    if (globalSources.length > 0) {
      nextIndex = printSourcesList(globalSources, 'Global sources', nextIndex, options, resolvedSources);
    }

    if (projectSources.length > 0) {
      printSourcesList(projectSources, 'Project sources', 0, options, resolvedSources);
    }

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

export async function sourceUpdate(options = {}) {
  const projectPath = process.cwd();
  const logger = createLogger(options.verbose);
  const isGlobal = options.global;

  try {
    const globalSources = getGlobalSources();
    const hasProjectConfig = configExists(projectPath);
    const projectSources = hasProjectConfig ? (loadConfig(projectPath).sources || []) : [];

    let sourcesToUpdate = [];

    if (isGlobal) {
      sourcesToUpdate = globalSources;
      if (sourcesToUpdate.length === 0) {
        logger.info('No global sources configured.');
        return;
      }
      logger.info('Updating global sources...');
    } else {
      sourcesToUpdate = [...globalSources, ...projectSources];
      if (sourcesToUpdate.length === 0) {
        logger.info('No sources configured.');
        return;
      }
      logger.info('Updating sources...');
    }

    let gitCount = 0;
    let localCount = 0;
    let errorCount = 0;

    for (const source of sourcesToUpdate) {
      const parsed = parseSource(source);
      const displayName = getSourceDisplayName(parsed);

      try {
        if (parsed.type === SOURCE_TYPES.GIT) {
          logger.verbose(`Fetching ${displayName}...`);
          resolveSource(parsed, { logger, skipFetch: false });
          logger.info(`  ✓ ${displayName} (updated)`);
          gitCount++;
        } else {
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
