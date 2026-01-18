import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkbox, confirm, input } from '@inquirer/prompts';

import { CONFIG_DIR, CONFIG_FILE, VALID_TARGETS, TARGET_DESCRIPTIONS, VALID_FEATURES, FEATURE_DESCRIPTIONS } from '../lib/constants.js';
import { getConfigPath, configExists } from '../lib/config.js';
import { createLogger } from '../lib/utils.js';
import {
  parseSource,
  resolveSource,
  resolveSources,
  getSourceDisplayName,
  getCombinedUseCases
} from '../lib/sources.js';
import { getGlobalSources, hasGlobalSources } from '../lib/global-config.js';

async function promptForSources(logger) {
  const sources = [];
  const resolvedSources = [];

  while (true) {
    const sourceInput = await input({
      message: sources.length === 0
        ? 'Add a source (git URL or local path):'
        : 'Add another source (or leave empty to finish):',
      default: ''
    });

    if (!sourceInput.trim()) {
      if (sources.length === 0) {
        logger.warn('At least one source is required.');
        logger.info('Sources define where your agent configurations come from.\n');
        continue;
      }
      break;
    }

    try {
      const source = parseSource(sourceInput.trim());

      logger.info(`Validating source...`);
      const resolved = resolveSource(source, { logger });

      sources.push(source);
      resolvedSources.push(resolved);
      logger.info(`  ✓ Added: ${getSourceDisplayName(resolved)}`);
      logger.info('');
    } catch (e) {
      logger.warn(`Invalid source: ${e.message}`);
      logger.info('Please try again.\n');
    }
  }

  return { sources, resolvedSources };
}

function getUseCaseChoices(resolvedSources) {
  if (resolvedSources.length === 0) {
    return [];
  }

  const combined = getCombinedUseCases(resolvedSources);
  const useCaseNames = Object.keys(combined).sort();

  return useCaseNames.map(name => {
    const { description, sources } = combined[name];
    const sourceLabel = sources.length > 1 ? ` (${sources.join(', ')})` : ` (${sources[0]})`;
    return {
      name: `${name} - ${description}${sourceLabel}`,
      value: name,
      checked: name === 'development'
    };
  });
}

export async function init(options = {}) {
  const projectPath = process.cwd();
  const logger = createLogger(options.verbose);

  try {
    if (configExists(projectPath, options.config)) {
      const configPath = getConfigPath(projectPath, options.config);
      const overwrite = await confirm({
        message: `Config already exists at ${configPath}. Overwrite?`,
        default: false
      });

      if (!overwrite) {
        logger.info('Aborted. Existing config preserved.');
        return;
      }
    }

    logger.info('Setting up amgr configuration...\n');

    const globalSources = getGlobalSources();
    let resolvedGlobalSources = [];
    let projectSources = [];
    let resolvedProjectSources = [];

    if (globalSources.length > 0) {
      logger.info('Global sources available:');
      try {
        resolvedGlobalSources = resolveSources(globalSources, { logger, skipFetch: true });
        for (const source of resolvedGlobalSources) {
          logger.info(`  ✓ ${getSourceDisplayName(source)}`);
        }
      } catch (e) {
        logger.warn(`Could not resolve some global sources: ${e.message}`);
      }
      logger.info('');

      const addProjectSources = await confirm({
        message: 'Would you like to add project-specific sources?',
        default: false
      });

      if (addProjectSources) {
        logger.info('\nProject sources override global sources when files conflict.');
        logger.info('Add sources in order of priority (later sources override earlier).\n');

        const result = await promptForSources(logger);
        projectSources = result.sources;
        resolvedProjectSources = result.resolvedSources;
      }
    } else {
      logger.info('No global sources configured.');
      logger.info('Sources define where your agent configurations come from.');
      logger.info('Multiple sources are applied in order (later sources override earlier).\n');
      logger.info('Tip: Add a global source with "amgr source add <path> --global" to use it across all projects.\n');

      const result = await promptForSources(logger);
      projectSources = result.sources;
      resolvedProjectSources = result.resolvedSources;
    }

    const allResolvedSources = [...resolvedGlobalSources, ...resolvedProjectSources];

    if (allResolvedSources.length === 0) {
      logger.error('No sources available. At least one source is required.');
      logger.error('Add a global source: amgr source add <path> --global');
      process.exit(1);
    }

    if (resolvedGlobalSources.length > 0 || resolvedProjectSources.length > 0) {
      logger.info('\nSources that will be used:');
      if (resolvedGlobalSources.length > 0) {
        logger.info('  Global:');
        for (const source of resolvedGlobalSources) {
          logger.info(`    ${getSourceDisplayName(source)}`);
        }
      }
      if (resolvedProjectSources.length > 0) {
        logger.info('  Project:');
        for (const source of resolvedProjectSources) {
          logger.info(`    ${getSourceDisplayName(source)}`);
        }
      }
      logger.info('');
    }

    const targets = await checkbox({
      message: 'Select target AI tools:',
      choices: VALID_TARGETS.map(t => ({
        name: `${t} - ${TARGET_DESCRIPTIONS[t]}`,
        value: t,
        checked: t === 'claudecode' || t === 'cursor'
      })),
      required: true
    });

    if (targets.length === 0) {
      logger.error('At least one target is required.');
      process.exit(1);
    }

    const features = await checkbox({
      message: 'Select features to include:',
      choices: VALID_FEATURES.map(f => ({
        name: `${f} - ${FEATURE_DESCRIPTIONS[f]}`,
        value: f,
        checked: ['rules', 'commands', 'skills'].includes(f)
      })),
      required: true
    });

    if (features.length === 0) {
      logger.error('At least one feature is required.');
      process.exit(1);
    }

    const useCaseChoices = getUseCaseChoices(allResolvedSources);

    if (useCaseChoices.length === 0) {
      logger.error('No use-cases found in configured sources.');
      logger.error('Add use-cases to your source repos with "amgr repo add <name>".');
      process.exit(1);
    }

    const useCases = await checkbox({
      message: 'Select use-cases:',
      choices: useCaseChoices,
      required: true
    });

    if (useCases.length === 0) {
      logger.error('At least one use-case is required.');
      process.exit(1);
    }

    const configureOptions = await confirm({
      message: 'Configure advanced options?',
      default: false
    });

    let configOptions = {};
    if (configureOptions) {
      const simulateCommands = await confirm({
        message: 'Enable simulated commands for tools without native support?',
        default: false
      });
      const simulateSubagents = await confirm({
        message: 'Enable simulated subagents for tools without native support?',
        default: false
      });
      const simulateSkills = await confirm({
        message: 'Enable simulated skills for tools without native support?',
        default: false
      });
      const modularMcp = await confirm({
        message: 'Enable modular-mcp for Claude Code (reduces token usage)?',
        default: false
      });

      if (simulateCommands || simulateSubagents || simulateSkills || modularMcp) {
        configOptions = {
          ...(simulateCommands && { simulateCommands }),
          ...(simulateSubagents && { simulateSubagents }),
          ...(simulateSkills && { simulateSkills }),
          ...(modularMcp && { modularMcp })
        };
      }
    }

    const config = {
      "$schema": "https://raw.githubusercontent.com/oztamir/amgr/main/schemas/amgr.schema.json",
      targets,
      features,
      "use-cases": useCases
    };

    if (projectSources.length > 0) {
      config.sources = projectSources;
    }

    if (Object.keys(configOptions).length > 0) {
      config.options = configOptions;
    }

    const amgrDir = join(projectPath, CONFIG_DIR);
    if (!existsSync(amgrDir)) {
      mkdirSync(amgrDir, { recursive: true });
    }

    const configPath = join(amgrDir, CONFIG_FILE);
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

    logger.info('');
    logger.success(`Created ${configPath}`);
    logger.info('\nNext steps:');
    logger.info('  1. Run "amgr sync" to generate agent configurations');
    logger.info('  2. Consider adding ".amgr/" to your .gitignore');

  } catch (e) {
    if (e.name === 'ExitPromptError') {
      logger.info('\nAborted.');
      return;
    }
    logger.error(e.message);
    process.exit(1);
  }
}
