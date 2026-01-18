import {
  VALID_TARGETS,
  TARGET_DESCRIPTIONS,
  VALID_FEATURES,
  FEATURE_DESCRIPTIONS,
} from '../lib/constants.js';
import { createLogger } from '../lib/utils.js';
import { configExists, loadConfig } from '../lib/config.js';
import {
  resolveSources,
  getCombinedUseCases,
  getSourceDisplayName,
  getMergedSources,
  SOURCE_TYPES,
} from '../lib/sources.js';
import { getGlobalSources } from '../lib/global-config.js';
import type { CommandOptions } from '../types/common.js';
import type { Source, ResolvedSource } from '../types/sources.js';

export async function list(options: CommandOptions = {}): Promise<void> {
  const projectPath = process.cwd();
  const logger = createLogger(options.verbose);

  const globalSources = getGlobalSources();
  const hasProjectConfig = configExists(projectPath);
  let config = null;
  let projectSources: Source[] = [];

  if (hasProjectConfig) {
    try {
      config = loadConfig(projectPath);
      projectSources = config.sources ?? [];
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error(message);
      process.exit(1);
    }
  }

  const mergedSources = config
    ? getMergedSources(config, globalSources)
    : globalSources;

  if (mergedSources.length === 0) {
    console.log('\nNo sources configured.');
    if (hasProjectConfig) {
      console.log('Add a global source: amgr source add <path> --global');
      console.log('Or add a project source: amgr source add <path>');
    } else {
      console.log('Add a global source: amgr source add <path> --global');
      console.log('Or run "amgr init" to set up a project.');
    }
    console.log('');
    return;
  }

  let resolvedGlobal: ResolvedSource[] = [];
  let resolvedProject: ResolvedSource[] = [];

  if (globalSources.length > 0) {
    try {
      resolvedGlobal = resolveSources(globalSources, { logger, skipFetch: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.warn(`Could not resolve some global sources: ${message}`);
    }
  }

  if (projectSources.length > 0) {
    try {
      resolvedProject = resolveSources(projectSources, { logger, skipFetch: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.warn(`Could not resolve some project sources: ${message}`);
    }
  }

  if (resolvedGlobal.length > 0) {
    console.log('\nGlobal sources:');
    for (const source of resolvedGlobal) {
      const typeLabel = source.type === SOURCE_TYPES.GIT ? 'git' : 'local';
      console.log(`  ${typeLabel}: ${getSourceDisplayName(source)}`);
    }
  }

  if (resolvedProject.length > 0) {
    console.log('\nProject sources:');
    for (const source of resolvedProject) {
      const typeLabel = source.type === SOURCE_TYPES.GIT ? 'git' : 'local';
      console.log(`  ${typeLabel}: ${getSourceDisplayName(source)}`);
    }
  }

  const allResolved = [...resolvedGlobal, ...resolvedProject];
  const combinedUseCases = getCombinedUseCases(allResolved);
  const useCaseNames = Object.keys(combinedUseCases).sort();

  console.log('\nAvailable use-cases:');
  if (useCaseNames.length === 0) {
    console.log('  (none)');
    console.log(
      '\n  Run "amgr repo add <name>" in your source repo to add use-cases.'
    );
  } else {
    for (const name of useCaseNames) {
      const useCaseData = combinedUseCases[name];
      if (!useCaseData) continue;
      const { description, sources } = useCaseData;
      const sourceLabel =
        sources.length > 1 ? ` (${sources.join(', ')})` : ` (${sources[0]})`;
      console.log(`  ${name.padEnd(20)} - ${description}${sourceLabel}`);
    }
  }

  if (config?.['use-cases'] && config['use-cases'].length > 0) {
    console.log(`\nCurrently selected: ${config['use-cases'].join(', ')}`);
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
