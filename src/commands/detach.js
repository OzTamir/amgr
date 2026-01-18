/**
 * Detach command for amgr
 * Removes all amgr-created files and the lock file, optionally removes config
 */

import { existsSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { confirm } from '@inquirer/prompts';

import { CONFIG_DIR } from '../lib/constants.js';
import { getTrackedFiles, removeTrackedFiles, deleteLockFile, lockFileExists } from '../lib/lock.js';
import { getAmgrDir } from '../lib/config.js';
import { createLogger } from '../lib/utils.js';

/**
 * Execute the detach command
 */
export async function detach(options = {}) {
  const projectPath = process.cwd();
  const verbose = options.verbose || false;
  const dryRun = options.dryRun || false;
  const logger = createLogger(verbose);

  try {
    const amgrDir = getAmgrDir(projectPath);

    // Check if .amgr directory exists
    if (!existsSync(amgrDir)) {
      logger.info('No .amgr directory found. Nothing to detach.');
      return;
    }

    // Get tracked files
    const trackedFiles = lockFileExists(projectPath) ? getTrackedFiles(projectPath) : [];
    
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

    // Remove tracked files
    if (trackedFiles.length > 0) {
      logger.info('Removing tracked files...');
      const { removed, failed } = removeTrackedFiles(projectPath, { dryRun, verbose, logger });
      logger.success(`Removed ${removed.length} files`);
      
      if (failed.length > 0) {
        logger.warn(`Failed to remove ${failed.length} files`);
      }
    }

    // Delete lock file
    if (lockFileExists(projectPath)) {
      deleteLockFile(projectPath);
      logger.verbose('Removed .amgr/amgr-lock.json');
    }

    // Check what's left in .amgr directory
    const amgrContents = existsSync(amgrDir) ? readdirSync(amgrDir) : [];
    
    if (amgrContents.length > 0) {
      // There are still files in .amgr (like config.json)
      logger.info('');
      const removeConfig = await confirm({
        message: 'Remove .amgr/config.json and .amgr/ directory?',
        default: false
      });

      if (removeConfig) {
        rmSync(amgrDir, { recursive: true });
        logger.success('Removed .amgr/ directory');
      } else {
        logger.info('Preserved .amgr/config.json');
        logger.info('You can re-attach by running "amgr sync" later.');
      }
    } else {
      // .amgr directory is empty, remove it
      rmSync(amgrDir, { recursive: true });
      logger.verbose('Removed empty .amgr/ directory');
    }

    logger.info('');
    logger.success('Detached successfully');
    logger.info('Native files in agent directories have been preserved.');

  } catch (e) {
    if (e.name === 'ExitPromptError') {
      logger.info('\nAborted.');
      return;
    }
    logger.error(e.message);
    process.exit(1);
  }
}
