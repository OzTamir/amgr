import { existsSync, readdirSync, cpSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { TARGET_DIRECTORIES } from './constants.js';
import type { Logger } from '../types/common.js';
import type { Target } from '../types/config.js';

interface TargetDir {
  target: Target;
  dir: string;
  fullPath: string;
}

export function getGeneratedTargetDirs(generatedPath: string): TargetDir[] {
  const dirs: TargetDir[] = [];
  for (const [target, dir] of Object.entries(TARGET_DIRECTORIES)) {
    const fullPath = join(generatedPath, dir);
    if (existsSync(fullPath)) {
      dirs.push({ target: target as Target, dir, fullPath });
    }
  }
  return dirs;
}

function getAllFiles(dir: string, baseDir = dir): string[] {
  const files: string[] = [];

  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir));
    } else {
      files.push(relativePath);
    }
  }

  return files;
}

interface Conflict {
  file: string;
  reason: string;
}

interface DeployResult {
  deployed: string[];
  skipped: string[];
  conflicts: Conflict[];
}

interface DeployOptions {
  generatedPath: string;
  projectPath: string;
  trackedFiles?: string[];
  dryRun?: boolean;
  logger?: Logger;
}

export function deploy(options: DeployOptions): DeployResult {
  const {
    generatedPath,
    projectPath,
    trackedFiles = [],
    dryRun = false,
    logger,
  } = options;

  const deployed: string[] = [];
  const skipped: string[] = [];
  const conflicts: Conflict[] = [];

  const targetDirs = getGeneratedTargetDirs(generatedPath);

  for (const { dir, fullPath: sourceDirPath } of targetDirs) {
    const destDirPath = join(projectPath, dir);

    const files = getAllFiles(sourceDirPath);

    for (const file of files) {
      const sourceFile = join(sourceDirPath, file);
      const destFile = join(destDirPath, file);
      const relativeDestPath = join(dir, file);

      if (existsSync(destFile) && !trackedFiles.includes(relativeDestPath)) {
        conflicts.push({
          file: relativeDestPath,
          reason: 'Native file exists',
        });
        logger?.warn?.(
          `File conflict detected: ${relativeDestPath}\n` +
            `This file exists but is not tracked in .amgr/amgr-lock.json.\n` +
            `Skipping to preserve native file. Remove or rename the file to allow amgr to manage it.`
        );
        skipped.push(relativeDestPath);
        continue;
      }

      if (dryRun) {
        logger?.info?.(`Would deploy: ${relativeDestPath}`);
        deployed.push(relativeDestPath);
      } else {
        try {
          const destDir = join(destDirPath, file, '..');
          mkdirSync(destDir, { recursive: true });

          cpSync(sourceFile, destFile);
          deployed.push(relativeDestPath);
          logger?.verbose?.(`Deployed: ${relativeDestPath}`);
        } catch (e) {
          skipped.push(relativeDestPath);
          const message = e instanceof Error ? e.message : String(e);
          logger?.warn?.(`Failed to deploy ${relativeDestPath}: ${message}`);
        }
      }
    }
  }

  return { deployed, skipped, conflicts };
}

export function getFilesToDeploy(generatedPath: string): string[] {
  const files: string[] = [];
  const targetDirs = getGeneratedTargetDirs(generatedPath);

  for (const { dir, fullPath: sourceDirPath } of targetDirs) {
    const dirFiles = getAllFiles(sourceDirPath);
    for (const file of dirFiles) {
      files.push(join(dir, file));
    }
  }

  return files;
}

export function checkConflicts(
  generatedPath: string,
  projectPath: string,
  trackedFiles: string[]
): string[] {
  const conflicts: string[] = [];
  const filesToDeploy = getFilesToDeploy(generatedPath);

  for (const file of filesToDeploy) {
    const destPath = join(projectPath, file);
    if (existsSync(destPath) && !trackedFiles.includes(file)) {
      conflicts.push(file);
    }
  }

  return conflicts;
}
