/**
 * Lock file management for amgr
 * Tracks files created by amgr to distinguish from native files
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { CONFIG_DIR, LOCK_FILE, LOCK_VERSION } from './constants.js';

/**
 * Get the lock file path for a project
 */
export function getLockPath(projectPath) {
  return join(projectPath, CONFIG_DIR, LOCK_FILE);
}

/**
 * Read the lock file
 * Returns null if it doesn't exist or is invalid
 */
export function readLockFile(projectPath) {
  const lockPath = getLockPath(projectPath);
  
  if (!existsSync(lockPath)) {
    return null;
  }

  try {
    const content = readFileSync(lockPath, 'utf8');
    const lock = JSON.parse(content);
    
    // Basic validation
    if (!lock.version || !Array.isArray(lock.files)) {
      return null;
    }
    
    return lock;
  } catch (e) {
    // Invalid lock file
    return null;
  }
}

/**
 * Write the lock file with the given files
 */
export function writeLockFile(projectPath, files) {
  const lockPath = getLockPath(projectPath);
  const lockDir = dirname(lockPath);
  
  // Ensure directory exists
  if (!existsSync(lockDir)) {
    mkdirSync(lockDir, { recursive: true });
  }

  const lock = {
    version: LOCK_VERSION,
    created: readLockFile(projectPath)?.created || new Date().toISOString(),
    lastSynced: new Date().toISOString(),
    files: [...files].sort()
  };

  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
}

/**
 * Get the list of tracked files from the lock file
 * Returns empty array if no lock file exists
 */
export function getTrackedFiles(projectPath) {
  const lock = readLockFile(projectPath);
  return lock?.files || [];
}

/**
 * Check if a file is tracked by amgr
 */
export function isTrackedFile(projectPath, filePath) {
  const trackedFiles = getTrackedFiles(projectPath);
  return trackedFiles.includes(filePath);
}

/**
 * Remove tracked files from the project
 * Returns list of removed files and list of files that couldn't be removed
 */
export function removeTrackedFiles(projectPath, options = {}) {
  const { dryRun = false, verbose = false, logger = console } = options;
  const trackedFiles = getTrackedFiles(projectPath);
  const removed = [];
  const failed = [];

  for (const file of trackedFiles) {
    const fullPath = join(projectPath, file);
    
    if (existsSync(fullPath)) {
      if (dryRun) {
        logger.info?.(`Would remove: ${file}`) || console.log(`Would remove: ${file}`);
        removed.push(file);
      } else {
        try {
          unlinkSync(fullPath);
          removed.push(file);
          if (verbose) {
            logger.verbose?.(`Removed: ${file}`) || console.log(`Removed: ${file}`);
          }
        } catch (e) {
          failed.push({ file, error: e.message });
        }
      }
    }
  }

  // Clean up empty directories (only in tracked paths)
  if (!dryRun) {
    cleanEmptyDirectories(projectPath, trackedFiles);
  }

  return { removed, failed };
}

/**
 * Clean up empty directories that were created by amgr
 * Only removes directories that are now empty and were parent dirs of tracked files
 */
function cleanEmptyDirectories(projectPath, trackedFiles) {
  // Get unique parent directories from tracked files
  const dirs = new Set();
  for (const file of trackedFiles) {
    let dir = dirname(file);
    while (dir && dir !== '.') {
      dirs.add(dir);
      dir = dirname(dir);
    }
  }

  // Sort by depth (deepest first) to remove nested empty dirs
  const sortedDirs = [...dirs].sort((a, b) => b.split('/').length - a.split('/').length);

  for (const dir of sortedDirs) {
    const fullPath = join(projectPath, dir);
    if (existsSync(fullPath)) {
      try {
        const contents = readdirSync(fullPath);
        if (contents.length === 0) {
          rmSync(fullPath, { recursive: true });
        }
      } catch {
        // Ignore errors when cleaning up directories
      }
    }
  }
}

/**
 * Delete the lock file
 */
export function deleteLockFile(projectPath) {
  const lockPath = getLockPath(projectPath);
  if (existsSync(lockPath)) {
    unlinkSync(lockPath);
    return true;
  }
  return false;
}

/**
 * Check if a lock file exists
 */
export function lockFileExists(projectPath) {
  return existsSync(getLockPath(projectPath));
}
