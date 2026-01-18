import {
  getTrackedFiles,
  removeTrackedFiles,
  writeLockFile,
  lockFileExists,
} from '../lib/lock.js';
import { createLogger } from '../lib/utils.js';
import type { CommandOptions } from '../types/common.js';

export async function clean(options: CommandOptions = {}): Promise<void> {
  const projectPath = process.cwd();
  const verbose = options.verbose ?? false;
  const dryRun = options.dryRun ?? false;
  const logger = createLogger(verbose);

  try {
    if (!lockFileExists(projectPath)) {
      logger.info('No amgr lock file found. Nothing to clean.');
      logger.info('Run "amgr sync" first to generate agent configurations.');
      return;
    }

    const trackedFiles = getTrackedFiles(projectPath);

    if (trackedFiles.length === 0) {
      logger.info('No tracked files found. Nothing to clean.');
      return;
    }

    logger.info(`Found ${trackedFiles.length} tracked files.`);

    if (dryRun) {
      logger.info('\nFiles that would be removed:');
      for (const file of trackedFiles) {
        logger.info(`  ${file}`);
      }
      logger.info('\n(dry-run: no changes made)');
      return;
    }

    logger.info('Removing tracked files...');
    const { removed, failed } = removeTrackedFiles(projectPath, {
      dryRun,
      verbose,
      logger,
    });

    const remainingFiles = trackedFiles.filter(
      (f) => !removed.includes(f) && !failed.some((e) => e.file === f)
    );
    if (remainingFiles.length === 0) {
      writeLockFile(projectPath, []);
    } else {
      writeLockFile(projectPath, remainingFiles);
    }

    logger.info('');
    logger.success(`Removed ${removed.length} files`);

    if (failed.length > 0) {
      logger.warn(`Failed to remove ${failed.length} files:`);
      for (const { file, error } of failed) {
        logger.info(`  ${file}: ${error}`);
      }
    }

    if (verbose && removed.length > 0) {
      logger.info('\nRemoved files:');
      for (const file of removed) {
        logger.info(`  ${file}`);
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error(message);
    process.exit(1);
  }
}
