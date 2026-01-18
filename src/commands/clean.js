/**
 * Clean command for amgr
 * Removes all generated agent configuration files tracked by amgr
 */

import { getTrackedFiles, removeTrackedFiles, writeLockFile, lockFileExists } from '../lib/lock.js';
import { createLogger } from '../lib/utils.js';

/**
 * Execute the clean command
 */
export async function clean(options = {}) {
  const projectPath = process.cwd();
  const verbose = options.verbose || false;
  const dryRun = options.dryRun || false;
  const logger = createLogger(verbose);

  try {
    // Check if lock file exists
    if (!lockFileExists(projectPath)) {
      logger.info('No amgr lock file found. Nothing to clean.');
      logger.info('Run "amgr sync" first to generate agent configurations.');
      return;
    }

    // Get tracked files
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

    // Remove tracked files
    logger.info('Removing tracked files...');
    const { removed, failed } = removeTrackedFiles(projectPath, { dryRun, verbose, logger });

    // Update lock file to reflect remaining files (should be empty)
    const remainingFiles = trackedFiles.filter(f => !removed.includes(f) && !failed.some(e => e.file === f));
    if (remainingFiles.length === 0) {
      // All files removed, but keep the lock file (it will be empty)
      writeLockFile(projectPath, []);
    } else {
      writeLockFile(projectPath, remainingFiles);
    }

    // Report results
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
    logger.error(e.message);
    process.exit(1);
  }
}
