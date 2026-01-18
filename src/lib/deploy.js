/**
 * File deployment for amgr
 * Copies generated files to target project while tracking them
 */

import { existsSync, readdirSync, cpSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { TARGET_DIRECTORIES } from './constants.js';

/**
 * Get the list of target directories that exist in the generated output
 */
export function getGeneratedTargetDirs(generatedPath) {
  const dirs = [];
  for (const [target, dir] of Object.entries(TARGET_DIRECTORIES)) {
    const fullPath = join(generatedPath, dir);
    if (existsSync(fullPath)) {
      dirs.push({ target, dir, fullPath });
    }
  }
  return dirs;
}

/**
 * Recursively get all files in a directory
 * Returns paths relative to the base directory
 */
function getAllFiles(dir, baseDir = dir) {
  const files = [];
  
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

/**
 * Deploy generated files to the target project
 * 
 * @param {Object} options
 * @param {string} options.generatedPath - Path to generated output (after rulesync)
 * @param {string} options.projectPath - Path to target project
 * @param {string[]} options.trackedFiles - Previously tracked files from lock file
 * @param {boolean} options.dryRun - If true, don't actually copy files
 * @param {Object} options.logger - Logger instance
 * @returns {Object} Result with deployed files, skipped files, and conflicts
 */
export function deploy(options) {
  const { generatedPath, projectPath, trackedFiles = [], dryRun = false, logger } = options;
  
  const deployed = [];
  const skipped = [];
  const conflicts = [];
  
  // Get all target directories that were generated
  const targetDirs = getGeneratedTargetDirs(generatedPath);
  
  for (const { target, dir, fullPath: sourceDirPath } of targetDirs) {
    const destDirPath = join(projectPath, dir);
    
    // Get all files in this target directory
    const files = getAllFiles(sourceDirPath);
    
    for (const file of files) {
      const sourceFile = join(sourceDirPath, file);
      const destFile = join(destDirPath, file);
      const relativeDestPath = join(dir, file);
      
      // Check for conflicts with native files
      if (existsSync(destFile) && !trackedFiles.includes(relativeDestPath)) {
        // File exists but is not tracked by amgr - it's a native file
        conflicts.push({
          file: relativeDestPath,
          reason: 'Native file exists'
        });
        logger?.warn?.(`File conflict detected: ${relativeDestPath}\n` +
          `This file exists but is not tracked in .amgr/amgr-lock.json.\n` +
          `Skipping to preserve native file. Remove or rename the file to allow amgr to manage it.`);
        skipped.push(relativeDestPath);
        continue;
      }
      
      if (dryRun) {
        logger?.info?.(`Would deploy: ${relativeDestPath}`);
        deployed.push(relativeDestPath);
      } else {
        try {
          // Ensure destination directory exists
          const destDir = join(destDirPath, file, '..');
          mkdirSync(destDir, { recursive: true });
          
          // Copy the file
          cpSync(sourceFile, destFile);
          deployed.push(relativeDestPath);
          logger?.verbose?.(`Deployed: ${relativeDestPath}`);
        } catch (e) {
          skipped.push(relativeDestPath);
          logger?.warn?.(`Failed to deploy ${relativeDestPath}: ${e.message}`);
        }
      }
    }
  }
  
  return { deployed, skipped, conflicts };
}

/**
 * Get all files that would be deployed from the generated output
 * Useful for dry-run and preview
 */
export function getFilesToDeploy(generatedPath) {
  const files = [];
  const targetDirs = getGeneratedTargetDirs(generatedPath);
  
  for (const { dir, fullPath: sourceDirPath } of targetDirs) {
    const dirFiles = getAllFiles(sourceDirPath);
    for (const file of dirFiles) {
      files.push(join(dir, file));
    }
  }
  
  return files;
}

/**
 * Check for conflicts between files to deploy and existing native files
 */
export function checkConflicts(generatedPath, projectPath, trackedFiles) {
  const conflicts = [];
  const filesToDeploy = getFilesToDeploy(generatedPath);
  
  for (const file of filesToDeploy) {
    const destPath = join(projectPath, file);
    if (existsSync(destPath) && !trackedFiles.includes(file)) {
      conflicts.push(file);
    }
  }
  
  return conflicts;
}
