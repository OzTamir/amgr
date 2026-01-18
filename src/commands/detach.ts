import { existsSync, rmSync, readdirSync } from 'node:fs';
import { confirm } from '@inquirer/prompts';
import {
  getTrackedFiles,
  removeTrackedFiles,
  deleteLockFile,
  lockFileExists,
} from '../lib/lock.js';
import { getAmgrDir } from '../lib/config.js';
import { createLogger } from '../lib/utils.js';
import type { CommandOptions } from '../types/common.js';

export async function detach(options: CommandOptions = {}): Promise<void> {
  const projectPath = process.cwd();
  const verbose = options.verbose ?? false;
  const dryRun = options.dryRun ?? false;
  const logger = createLogger(verbose);

  try {
    const amgrDir = getAmgrDir(projectPath);

    if (!existsSync(amgrDir)) {
      logger.info('No .amgr directory found. Nothing to detach.');
      return;
    }

    const trackedFiles = lockFileExists(projectPath)
      ? getTrackedFiles(projectPath)
      : [];

    logger.info('Detaching amgr from this project...');

    if (trackedFiles.length > 0) {
      logger.info(`Found ${trackedFiles.length} tracked files to remove.`);
    }

    if (dryRun) {
      if (trackedFiles.length > 0) {
        logger.info('\nFiles that would be removed:');
        for (const file of trackedFiles) {
          logger.info(`  ${file}`);
        }
      }
      logger.info(`\nWould remove: .amgr/amgr-lock.json`);
      logger.info('Would prompt to remove: .amgr/config.json and .amgr/ directory');
      logger.info('\n(dry-run: no changes made)');
      return;
    }

    if (trackedFiles.length > 0) {
      logger.info('Removing tracked files...');
      const { removed, failed } = removeTrackedFiles(projectPath, {
        dryRun,
        verbose,
        logger,
      });
      logger.success(`Removed ${removed.length} files`);

      if (failed.length > 0) {
        logger.warn(`Failed to remove ${failed.length} files`);
      }
    }

    if (lockFileExists(projectPath)) {
      deleteLockFile(projectPath);
      logger.verbose('Removed .amgr/amgr-lock.json');
    }

    const amgrContents = existsSync(amgrDir) ? readdirSync(amgrDir) : [];

    if (amgrContents.length > 0) {
      logger.info('');
      const removeConfig = await confirm({
        message: 'Remove .amgr/config.json and .amgr/ directory?',
        default: false,
      });

      if (removeConfig) {
        rmSync(amgrDir, { recursive: true });
        logger.success('Removed .amgr/ directory');
      } else {
        logger.info('Preserved .amgr/config.json');
        logger.info('You can re-attach by running "amgr sync" later.');
      }
    } else {
      rmSync(amgrDir, { recursive: true });
      logger.verbose('Removed empty .amgr/ directory');
    }

    logger.info('');
    logger.success('Detached successfully');
    logger.info('Native files in agent directories have been preserved.');
  } catch (e) {
    if (e instanceof Error && e.name === 'ExitPromptError') {
      logger.info('\nAborted.');
      return;
    }
    const message = e instanceof Error ? e.message : String(e);
    logger.error(message);
    process.exit(1);
  }
}
