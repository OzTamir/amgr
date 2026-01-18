import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';

import {
  loadAndValidateConfig,
  expandTargets,
  getEffectiveOptions,
} from '../lib/config.js';
import {
  getTrackedFiles,
  removeTrackedFiles,
  writeLockFile,
} from '../lib/lock.js';
import {
  compose,
  generateRulesyncConfig,
  writeRulesyncConfig,
} from '../lib/compose.js';
import { deploy } from '../lib/deploy.js';
import { createLogger, isVerbose } from '../lib/utils.js';
import { resolveSources, getMergedSources } from '../lib/sources.js';
import { getGlobalSources } from '../lib/global-config.js';
import type { CommandOptions } from '../types/common.js';

export async function sync(options: CommandOptions = {}): Promise<void> {
  const projectPath = process.cwd();
  const verbose = isVerbose(options);
  const logger = createLogger(verbose);
  const dryRun = options.dryRun ?? false;

  try {
    logger.info('Loading configuration...');
    const config = loadAndValidateConfig(projectPath, options.config);

    const targets = expandTargets(config.targets);
    const features = config.features;
    const useCases = config['use-cases'];
    const configOptions = getEffectiveOptions(config);

    logger.verbose(`Targets: ${targets.join(', ')}`);
    logger.verbose(`Features: ${features.join(', ')}`);
    logger.verbose(`Use-cases: ${useCases.join(', ')}`);

    const globalSources = getGlobalSources();
    const mergedSources = getMergedSources(config, globalSources);

    if (mergedSources.length === 0) {
      throw new Error(
        'No sources configured.\n' +
          'Add a global source: amgr source add <path> --global\n' +
          'Or add a project source: amgr source add <path>'
      );
    }

    if (!useCases || useCases.length === 0) {
      throw new Error(
        'No use-cases configured in .amgr/config.json.\n' +
          'Add use-cases after configuring sources, then run "amgr sync" again.'
      );
    }

    logger.info('Resolving sources...');
    let resolvedSources;
    try {
      resolvedSources = resolveSources(mergedSources, { logger });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to resolve sources: ${message}`);
    }
    logger.verbose(`Resolved ${resolvedSources.length} source(s)`);

    const trackedFiles = getTrackedFiles(projectPath);
    logger.verbose(`Previously tracked files: ${trackedFiles.length}`);

    if (trackedFiles.length > 0 && !dryRun) {
      logger.info('Removing previously tracked files...');
      const { removed, failed } = removeTrackedFiles(projectPath, {
        dryRun,
        verbose,
        logger,
      });
      logger.verbose(`Removed ${removed.length} files`);
      if (failed.length > 0) {
        logger.warn(`Failed to remove ${failed.length} files`);
      }
    }

    const tempDir = join(tmpdir(), `amgr-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    logger.verbose(`Temp directory: ${tempDir}`);

    try {
      logger.info(`Composing content for: ${useCases.join(' + ')}...`);
      compose({
        resolvedSources,
        useCases,
        outputPath: tempDir,
        logger,
      });

      logger.verbose('Generating rulesync.jsonc...');
      const rulesyncConfig = generateRulesyncConfig({
        resolvedSources,
        useCases,
        targets,
        features,
        configOptions,
      });
      writeRulesyncConfig(tempDir, rulesyncConfig);

      logger.info('Running rulesync generate...');
      if (!dryRun) {
        try {
          execSync('npx rulesync generate', {
            cwd: tempDir,
            stdio: verbose ? 'inherit' : 'pipe',
          });
        } catch {
          throw new Error(
            'Failed to run rulesync generate. Make sure rulesync is installed.'
          );
        }
      } else {
        logger.info('(dry-run: skipping rulesync generate)');
      }

      logger.info('Deploying files...');
      const { deployed, skipped, conflicts } = deploy({
        generatedPath: tempDir,
        projectPath,
        targets,
        trackedFiles,
        dryRun,
        logger,
      });

      if (!dryRun && deployed.length > 0) {
        logger.verbose('Updating lock file...');
        writeLockFile(projectPath, deployed);
      }

      logger.info('');
      if (dryRun) {
        logger.info('Dry run complete. No changes were made.');
        logger.info(`Would deploy ${deployed.length} files`);
      } else {
        logger.success(`Synced ${deployed.length} files`);
      }

      if (skipped.length > 0) {
        logger.warn(`Skipped ${skipped.length} files`);
      }

      if (conflicts.length > 0) {
        logger.warn(`${conflicts.length} conflicts with native files (preserved)`);
      }

      if (verbose && deployed.length > 0) {
        logger.info('\nDeployed files:');
        for (const file of deployed) {
          logger.info(`  ${file}`);
        }
      }
    } finally {
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true });
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error(message);
    process.exit(1);
  }
}
