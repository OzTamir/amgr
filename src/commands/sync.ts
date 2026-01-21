import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';

import {
  loadAndValidateConfig,
  expandTargets,
  getEffectiveOptions,
  normalizeOutputDirPrefix,
} from '../lib/config.js';
import {
  getTrackedFiles,
  removeTrackedFiles,
  removeOrphanedFiles,
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

interface OutputGroup {
  prefix: string;
  useCases: string[];
}

function groupUseCasesByOutputDir(
  useCases: string[],
  outputDirs: Record<string, string> | undefined
): OutputGroup[] {
  const groups = new Map<string, string[]>();

  for (const useCase of useCases) {
    const rawPrefix = outputDirs?.[useCase] ?? '';
    const prefix = normalizeOutputDirPrefix(rawPrefix);

    const existing = groups.get(prefix);
    if (existing) {
      existing.push(useCase);
    } else {
      groups.set(prefix, [useCase]);
    }
  }

  return Array.from(groups.entries()).map(([prefix, useCases]) => ({
    prefix,
    useCases,
  }));
}

export async function sync(options: CommandOptions = {}): Promise<void> {
  const projectPath = process.cwd();
  const verbose = isVerbose(options);
  const logger = createLogger(verbose);
  const dryRun = options.dryRun ?? false;
  const replaceMode = options.replace ?? false;

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

    if (replaceMode && trackedFiles.length > 0 && !dryRun) {
      logger.info('Removing previously tracked files (--replace mode)...');
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

    const outputGroups = groupUseCasesByOutputDir(useCases, config.outputDirs);
    const baseTempDir = join(tmpdir(), `amgr-${Date.now()}`);
    mkdirSync(baseTempDir, { recursive: true });
    logger.verbose(`Temp directory: ${baseTempDir}`);

    const allDeployed: string[] = [];
    const allSkipped: string[] = [];
    const allConflicts: { file: string; reason: string }[] = [];
    const allOverwritten: string[] = [];
    const allCreated: string[] = [];

    try {
      for (let i = 0; i < outputGroups.length; i++) {
        const group = outputGroups[i]!;
        const { prefix, useCases: groupUseCases } = group;
        const prefixLabel = prefix || '(root)';

        const tempDir =
          outputGroups.length === 1
            ? baseTempDir
            : join(baseTempDir, `group-${i}`);

        if (outputGroups.length > 1) {
          mkdirSync(tempDir, { recursive: true });
        }

        logger.info(
          `Composing content for: ${groupUseCases.join(' + ')} → ${prefixLabel}...`
        );
        compose({
          resolvedSources,
          useCases: groupUseCases,
          outputPath: tempDir,
          logger,
        });

        logger.verbose('Generating rulesync.jsonc...');
        const rulesyncConfig = generateRulesyncConfig({
          resolvedSources,
          useCases: groupUseCases,
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

        logger.info(`Deploying files to ${prefixLabel}...`);
        const { deployed, skipped, conflicts, overwritten, created } = deploy({
          generatedPath: tempDir,
          projectPath,
          targets,
          trackedFiles,
          dryRun,
          logger,
          outputPrefix: prefix,
        });

        allDeployed.push(...deployed);
        allSkipped.push(...skipped);
        allConflicts.push(...conflicts);
        allOverwritten.push(...overwritten);
        allCreated.push(...created);
      }

      let orphansRemoved = 0;
      if (!replaceMode) {
        const orphanedFiles = trackedFiles.filter((f) => !allDeployed.includes(f));
        if (orphanedFiles.length > 0) {
          if (dryRun) {
            logger.info(`Would remove ${orphanedFiles.length} orphaned files`);
            orphansRemoved = orphanedFiles.length;
          } else {
            logger.info(`Removing ${orphanedFiles.length} orphaned files...`);
            const { removed, failed } = removeOrphanedFiles(projectPath, orphanedFiles, {
              dryRun,
              logger,
            });
            orphansRemoved = removed.length;
            if (failed.length > 0) {
              logger.warn(`Failed to remove ${failed.length} orphaned files`);
            }
          }
        }
      }

      if (!dryRun && allDeployed.length > 0) {
        logger.verbose('Updating lock file...');
        writeLockFile(projectPath, allDeployed);
      }

      logger.info('');
      if (dryRun) {
        logger.info('Dry run complete. No changes were made.');
        logger.info(`Would sync ${allDeployed.length} files`);
        if (allOverwritten.length > 0) {
          logger.info(`  Overwrite: ${allOverwritten.length}`);
        }
        if (allCreated.length > 0) {
          logger.info(`  Create: ${allCreated.length}`);
        }
        if (orphansRemoved > 0) {
          logger.info(`  Remove orphans: ${orphansRemoved}`);
        }
      } else {
        logger.success(`Synced ${allDeployed.length} files`);
        if (allOverwritten.length > 0) {
          logger.info(`  Overwritten: ${allOverwritten.length}`);
        }
        if (allCreated.length > 0) {
          logger.info(`  Created: ${allCreated.length}`);
        }
        if (orphansRemoved > 0) {
          logger.info(`  Orphans removed: ${orphansRemoved}`);
        }
      }

      if (allSkipped.length > 0) {
        logger.warn(`Skipped ${allSkipped.length} files`);
      }

      if (allConflicts.length > 0) {
        logger.warn(`${allConflicts.length} conflicts with native files (preserved)`);
      }

      if (verbose && allDeployed.length > 0) {
        logger.info('\nDeployed files:');
        for (const file of allDeployed) {
          logger.info(`  ${file}`);
        }
      }
    } finally {
      if (existsSync(baseTempDir)) {
        rmSync(baseTempDir, { recursive: true });
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error(message);
    process.exit(1);
  }
}
