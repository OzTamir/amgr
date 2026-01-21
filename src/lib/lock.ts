import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
  rmSync,
  readdirSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { CONFIG_DIR, LOCK_FILE, LOCK_VERSION } from './constants.js';
import type { LockFile, RemoveResult } from '../types/lock.js';
import type { Logger } from '../types/common.js';
import { LockFileSchema } from '../schemas/lock.js';

export function getLockPath(projectPath: string): string {
  return join(projectPath, CONFIG_DIR, LOCK_FILE);
}

export function readLockFile(projectPath: string): LockFile | null {
  const lockPath = getLockPath(projectPath);

  if (!existsSync(lockPath)) {
    return null;
  }

  try {
    const content = readFileSync(lockPath, 'utf8');
    const parsed: unknown = JSON.parse(content);
    const result = LockFileSchema.safeParse(parsed);

    if (!result.success) {
      return null;
    }

    return result.data;
  } catch {
    return null;
  }
}

export function writeLockFile(projectPath: string, files: string[]): void {
  const lockPath = getLockPath(projectPath);
  const lockDir = dirname(lockPath);

  if (!existsSync(lockDir)) {
    mkdirSync(lockDir, { recursive: true });
  }

  const existingLock = readLockFile(projectPath);
  const uniqueFiles = [...new Set(files)].sort();

  const lock: LockFile = {
    version: LOCK_VERSION,
    created: existingLock?.created ?? new Date().toISOString(),
    lastSynced: new Date().toISOString(),
    files: uniqueFiles,
  };

  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
}

export function getTrackedFiles(projectPath: string): string[] {
  const lock = readLockFile(projectPath);
  return lock?.files ?? [];
}

export function isTrackedFile(projectPath: string, filePath: string): boolean {
  const trackedFiles = getTrackedFiles(projectPath);
  return trackedFiles.includes(filePath);
}

interface RemoveOptions {
  dryRun?: boolean;
  verbose?: boolean;
  logger?: Logger;
}

export function removeTrackedFiles(
  projectPath: string,
  options: RemoveOptions = {}
): RemoveResult {
  const { dryRun = false, verbose = false, logger } = options;
  const trackedFiles = getTrackedFiles(projectPath);
  const removed: string[] = [];
  const failed: Array<{ file: string; error: string }> = [];

  for (const file of trackedFiles) {
    const fullPath = join(projectPath, file);

    if (existsSync(fullPath)) {
      if (dryRun) {
        logger?.info?.(`Would remove: ${file}`) ?? console.log(`Would remove: ${file}`);
        removed.push(file);
      } else {
        try {
          unlinkSync(fullPath);
          removed.push(file);
          if (verbose) {
            logger?.verbose?.(`Removed: ${file}`) ?? console.log(`Removed: ${file}`);
          }
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          failed.push({ file, error });
        }
      }
    }
  }

  if (!dryRun) {
    cleanEmptyDirectories(projectPath, trackedFiles);
  }

  return { removed, failed };
}

function cleanEmptyDirectories(projectPath: string, trackedFiles: string[]): void {
  const dirs = new Set<string>();
  for (const file of trackedFiles) {
    let dir = dirname(file);
    while (dir && dir !== '.') {
      dirs.add(dir);
      dir = dirname(dir);
    }
  }

  const sortedDirs = [...dirs].sort(
    (a, b) => b.split('/').length - a.split('/').length
  );

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

export function deleteLockFile(projectPath: string): boolean {
  const lockPath = getLockPath(projectPath);
  if (existsSync(lockPath)) {
    unlinkSync(lockPath);
    return true;
  }
  return false;
}

export function lockFileExists(projectPath: string): boolean {
  return existsSync(getLockPath(projectPath));
}

export function removeOrphanedFiles(
  projectPath: string,
  orphanedFiles: string[],
  options: RemoveOptions = {}
): RemoveResult {
  const { dryRun = false, logger } = options;
  const removed: string[] = [];
  const failed: Array<{ file: string; error: string }> = [];

  for (const file of orphanedFiles) {
    const fullPath = join(projectPath, file);

    if (existsSync(fullPath)) {
      if (dryRun) {
        logger?.info?.(`Would remove orphan: ${file}`);
        removed.push(file);
      } else {
        try {
          unlinkSync(fullPath);
          removed.push(file);
          logger?.verbose?.(`Removed orphan: ${file}`);
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          failed.push({ file, error });
        }
      }
    }
  }

  if (!dryRun && orphanedFiles.length > 0) {
    cleanEmptyDirectories(projectPath, orphanedFiles);
  }

  return { removed, failed };
}
