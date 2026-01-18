import { VALID_TARGETS, TARGET_DESCRIPTIONS, VALID_FEATURES, FEATURE_DESCRIPTIONS } from '../lib/constants.js';
import { createLogger } from '../lib/utils.js';
import { configExists, loadConfig, hasSources } from '../lib/config.js';
import {
  resolveSources,
  getCombinedUseCases,
  getSourceDisplayName
} from '../lib/sources.js';

export async function list(options = {}) {
  const projectPath = process.cwd();
  const logger = createLogger(options.verbose);

  if (!configExists(projectPath)) {
    console.log('\nNo .amgr/config.json found in current directory.');
    console.log('Run "amgr init" to create one.\n');
    return;
  }

  let config;
  try {
    config = loadConfig(projectPath);
  } catch (e) {
    logger.error(e.message);
    process.exit(1);
  }

  if (!hasSources(config)) {
    console.log('\nNo sources configured.');
    console.log('Run "amgr source add <url-or-path>" to add a source.\n');
    return;
  }

  let resolvedSources = [];
  try {
    resolvedSources = resolveSources(config.sources, { 
      logger, 
      skipFetch: true 
    });
  } catch (e) {
    logger.error(`Could not resolve sources: ${e.message}`);
    process.exit(1);
  }

  console.log('\nConfigured sources:');
  for (const source of resolvedSources) {
    console.log(`  ${getSourceDisplayName(source)}`);
  }

  const combinedUseCases = getCombinedUseCases(resolvedSources);
  const useCaseNames = Object.keys(combinedUseCases).sort();

  console.log('\nAvailable use-cases:');
  if (useCaseNames.length === 0) {
    console.log('  (none)');
    console.log('\n  Run "amgr repo add <name>" in your source repo to add use-cases.');
  } else {
    for (const name of useCaseNames) {
      const { description, sources } = combinedUseCases[name];
      const sourceLabel = sources.length > 1 
        ? ` (${sources.join(', ')})`
        : ` (${sources[0]})`;
      console.log(`  ${name.padEnd(20)} - ${description}${sourceLabel}`);
    }
  }

  if (options.verbose) {
    console.log('\nAvailable targets:');
    for (const target of VALID_TARGETS) {
      console.log(`  ${target.padEnd(14)} - ${TARGET_DESCRIPTIONS[target]}`);
    }

    console.log('\nAvailable features:');
    for (const feature of VALID_FEATURES) {
      console.log(`  ${feature.padEnd(14)} - ${FEATURE_DESCRIPTIONS[feature]}`);
    }
  }

  console.log('');
}
