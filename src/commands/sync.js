/**
 * Sync command for amgr
 * Main command that synchronizes agent configurations to a project
 */

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';

import { loadAndValidateConfig, expandTargets, getEffectiveOptions, hasSources } from '../lib/config.js';
import { getTrackedFiles, removeTrackedFiles, writeLockFile } from '../lib/lock.js';
import { compose, generateRulesyncConfig, writeRulesyncConfig } from '../lib/compose.js';
import { deploy } from '../lib/deploy.js';
import { createLogger, isVerbose } from '../lib/utils.js';
import { resolveSources, getSourceDisplayName } from '../lib/sources.js';

/**
 * Execute the sync command
 */
export async function sync(options = {}) {
  const projectPath = process.cwd();
  const verbose = isVerbose(options);
  const logger = createLogger(verbose);
  const dryRun = options.dryRun || false;

  try {
    // 1. Load and validate config
    logger.info('Loading configuration...');
    const config = loadAndValidateConfig(projectPath, options.config);
    
    const targets = expandTargets(config.targets);
    const features = config.features;
    const useCases = config['use-cases'];
    const configOptions = getEffectiveOptions(config);

    logger.verbose(`Targets: ${targets.join(', ')}`);
    logger.verbose(`Features: ${features.join(', ')}`);
    logger.verbose(`Use-cases: ${useCases.join(', ')}`);

    if (!hasSources(config)) {
      throw new Error(
        'No sources configured in .amgr/config.json.\n' +
        'Run "amgr source add <url-or-path>" to add a source.'
      );
    }

    if (!useCases || useCases.length === 0) {
      throw new Error(
        'No use-cases configured in .amgr/config.json.\n' +
        'Add use-cases after configuring sources, then run "amgr sync" again.'
      );
    }

    logger.info('Updating sources...');
    let resolvedSources = [];
    try {
      resolvedSources = resolveSources(config.sources, { logger });
    } catch (e) {
      throw new Error(`Failed to resolve sources: ${e.message}`);
    }
    logger.verbose(`Resolved ${resolvedSources.length} source(s)`);

    // 3. Read existing lock file and get tracked files
    const trackedFiles = getTrackedFiles(projectPath);
    logger.verbose(`Previously tracked files: ${trackedFiles.length}`);

    // 4. Remove previously tracked files
    if (trackedFiles.length > 0 && !dryRun) {
      logger.info('Removing previously tracked files...');
      const { removed, failed } = removeTrackedFiles(projectPath, { dryRun, verbose, logger });
      logger.verbose(`Removed ${removed.length} files`);
      if (failed.length > 0) {
        logger.warn(`Failed to remove ${failed.length} files`);
      }
    }

    // 5. Create temp directory for composition
    const tempDir = join(tmpdir(), `amgr-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    logger.verbose(`Temp directory: ${tempDir}`);

    try {
      // 6. Compose content from all sources
      logger.info(`Composing content for: ${useCases.join(' + ')}...`);
      compose({
        resolvedSources,
        useCases,
        outputPath: tempDir,
        logger
      });

      // 7. Generate rulesync.jsonc
      logger.verbose('Generating rulesync.jsonc...');
      const rulesyncConfig = generateRulesyncConfig({
        resolvedSources,
        useCases,
        targets,
        features,
        configOptions
      });
      writeRulesyncConfig(tempDir, rulesyncConfig);

      // 8. Run rulesync generate
      logger.info('Running rulesync generate...');
      if (!dryRun) {
        try {
          execSync('npx rulesync generate', {
            cwd: tempDir,
            stdio: verbose ? 'inherit' : 'pipe'
          });
        } catch (e) {
          throw new Error('Failed to run rulesync generate. Make sure rulesync is installed.');
        }
      } else {
        logger.info('(dry-run: skipping rulesync generate)');
      }

      // 9. Deploy generated files to target project
      logger.info('Deploying files...');
      const { deployed, skipped, conflicts } = deploy({
        generatedPath: tempDir,
        projectPath,
        trackedFiles,
        dryRun,
        logger
      });

      // 10. Update lock file
      if (!dryRun && deployed.length > 0) {
        logger.verbose('Updating lock file...');
        writeLockFile(projectPath, deployed);
      }

      // Report results
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

      // List deployed files in verbose mode
      if (verbose && deployed.length > 0) {
        logger.info('\nDeployed files:');
        for (const file of deployed) {
          logger.info(`  ${file}`);
        }
      }

    } finally {
      // Clean up temp directory
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true });
      }
    }

  } catch (e) {
    logger.error(e.message);
    process.exit(1);
  }
}
