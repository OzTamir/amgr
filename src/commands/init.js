/**
 * Init command for amgr
 * Interactively creates a new .amgr/config.json
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkbox, confirm, input } from '@inquirer/prompts';

import { CONFIG_DIR, CONFIG_FILE, VALID_TARGETS, TARGET_DESCRIPTIONS, VALID_FEATURES, FEATURE_DESCRIPTIONS } from '../lib/constants.js';
import { getConfigPath, configExists } from '../lib/config.js';
import { createLogger } from '../lib/utils.js';
import {
  parseSource,
  resolveSource,
  getSourceDisplayName,
  getCombinedUseCases
} from '../lib/sources.js';

/**
 * Prompt user to add sources interactively
 * @param {Object} logger - Logger instance
 * @returns {Promise<{sources: Array, resolvedSources: Array}>} Sources and their resolved versions
 */
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
      
      // Validate the source
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

/**
 * Execute the init command
 */
export async function init(options = {}) {
  const projectPath = process.cwd();
  const logger = createLogger(options.verbose);

  try {
    // Check if config already exists
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

    logger.info('Sources define where your agent configurations come from.');
    logger.info('Multiple sources are applied in order (later sources override earlier).\n');
    
    const { sources, resolvedSources } = await promptForSources(logger);
    
    logger.info(`\nConfigured ${sources.length} source(s):`);
    for (let i = 0; i < resolvedSources.length; i++) {
      logger.info(`  ${i + 1}. ${getSourceDisplayName(resolvedSources[i])}`);
    }
    logger.info('');

    // Select targets
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

    // Select features
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

    const useCaseChoices = getUseCaseChoices(resolvedSources);
    
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

    // Ask about advanced options
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
      sources,
      targets,
      features,
      "use-cases": useCases
    };

    if (Object.keys(configOptions).length > 0) {
      config.options = configOptions;
    }

    // Create .amgr directory
    const amgrDir = join(projectPath, CONFIG_DIR);
    if (!existsSync(amgrDir)) {
      mkdirSync(amgrDir, { recursive: true });
    }

    // Write config file
    const configPath = join(amgrDir, CONFIG_FILE);
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

    logger.info('');
    logger.success(`Created ${configPath}`);
    logger.info('\nNext steps:');
    logger.info('  1. Run "amgr sync" to generate agent configurations');
    logger.info('  2. Consider adding ".amgr/" to your .gitignore');

  } catch (e) {
    if (e.name === 'ExitPromptError') {
      // User cancelled
      logger.info('\nAborted.');
      return;
    }
    logger.error(e.message);
    process.exit(1);
  }
}
