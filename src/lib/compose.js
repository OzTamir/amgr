/**
 * Content composition for amgr
 * Composes shared content and use-case specific content into a rulesync directory
 * Supports multiple sources with layering (later sources override earlier ones)
 */

import { existsSync, readdirSync, cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { ENTITY_TYPES } from './constants.js';
import { shouldIncludeForUseCases, readJsoncFile } from './utils.js';

/**
 * Get available use-cases from the agents repository
 */
export function getAvailableUseCases(agentsPath) {
  const useCasesDir = join(agentsPath, 'use-cases');
  if (!existsSync(useCasesDir)) return [];
  return readdirSync(useCasesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

/**
 * Get available use-cases from multiple source paths
 * Returns combined use-cases with source attribution
 * @param {Array} sourcePaths - Array of source paths
 * @returns {Object} Object with use-case names as keys and { sources: [] } as values
 */
export function getAvailableUseCasesFromSources(sourcePaths) {
  const combined = {};
  
  for (const sourcePath of sourcePaths) {
    const useCases = getAvailableUseCases(sourcePath);
    const sourceName = basename(sourcePath);
    
    for (const useCase of useCases) {
      if (!combined[useCase]) {
        combined[useCase] = { sources: [] };
      }
      combined[useCase].sources.push(sourceName);
    }
  }
  
  return combined;
}

/**
 * Copy a directory recursively
 */
function copyDir(src, dest) {
  if (!existsSync(src)) return;
  cpSync(src, dest, { recursive: true });
}

/**
 * Copy shared entity directory with use-cases filtering
 * - For rules/commands: filter .md files by frontmatter use-cases
 * - For skills: filter directories by SKILL.md frontmatter use-cases
 */
function copySharedEntityDir(srcDir, destDir, entityType, targetUseCases) {
  if (!existsSync(srcDir)) return;
  
  const entries = readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);

    if (entityType === 'skills') {
      // Skills are directories - check SKILL.md for filtering
      if (entry.isDirectory()) {
        const skillMdPath = join(srcPath, 'SKILL.md');
        if (existsSync(skillMdPath)) {
          if (shouldIncludeForUseCases(skillMdPath, targetUseCases)) {
            mkdirSync(destPath, { recursive: true });
            cpSync(srcPath, destPath, { recursive: true });
          }
        } else {
          // No SKILL.md, copy anyway
          mkdirSync(destPath, { recursive: true });
          cpSync(srcPath, destPath, { recursive: true });
        }
      }
    } else if (entityType === 'subagents') {
      // Subagents are .md files - filter by frontmatter
      if (entry.isFile() && entry.name.endsWith('.md')) {
        if (shouldIncludeForUseCases(srcPath, targetUseCases)) {
          cpSync(srcPath, destPath);
        }
      } else if (entry.isDirectory()) {
        // Subdirectory - recurse
        mkdirSync(destPath, { recursive: true });
        copySharedEntityDir(srcPath, destPath, entityType, targetUseCases);
      } else {
        // Other files, copy as-is
        cpSync(srcPath, destPath);
      }
    } else {
      // Rules and commands are .md files
      if (entry.isFile() && entry.name.endsWith('.md')) {
        if (shouldIncludeForUseCases(srcPath, targetUseCases)) {
          cpSync(srcPath, destPath);
        }
      } else if (entry.isDirectory()) {
        // Subdirectory - recurse
        mkdirSync(destPath, { recursive: true });
        copySharedEntityDir(srcPath, destPath, entityType, targetUseCases);
      } else {
        // Other files, copy as-is
        cpSync(srcPath, destPath);
      }
    }
  }
}

/**
 * Merge a rulesync directory into the target directory
 * Later calls override earlier content
 */
function mergeRulesyncDir(sourceDir, targetDir) {
  // Copy each entity type from source to target
  for (const entityType of ENTITY_TYPES) {
    const srcPath = join(sourceDir, entityType);
    const destPath = join(targetDir, entityType);

    if (existsSync(srcPath)) {
      mkdirSync(destPath, { recursive: true });
      copyDir(srcPath, destPath);
    }
  }

  // Also copy mcp.json and .aiignore if they exist
  const extraFiles = ['mcp.json', '.aiignore'];
  for (const file of extraFiles) {
    const srcFile = join(sourceDir, file);
    const destFile = join(targetDir, file);
    if (existsSync(srcFile)) {
      cpSync(srcFile, destFile);
    }
  }
}

/**
 * Compose content from a single source
 * @param {Object} options
 * @param {string} options.sourcePath - Path to the source repository
 * @param {string[]} options.useCases - Array of use-case names to compose
 * @param {string} options.outputRulesyncPath - Path to write composed content (.rulesync dir)
 * @param {Object} options.logger - Logger instance
 * @param {string} options.sourceLabel - Label for logging (optional)
 */
function composeFromSource(options) {
  const { sourcePath, useCases, outputRulesyncPath, logger, sourceLabel } = options;
  
  const sharedDir = join(sourcePath, 'shared');
  const useCasesDir = join(sourcePath, 'use-cases');
  const label = sourceLabel || basename(sourcePath);

  // 1. Copy shared content (filtered by use-cases frontmatter)
  if (existsSync(sharedDir)) {
    logger?.verbose?.(`  ← ${label}/shared/`);
    for (const entityType of ENTITY_TYPES) {
      const srcPath = join(sharedDir, entityType);
      const destPath = join(outputRulesyncPath, entityType);
      if (existsSync(srcPath)) {
        mkdirSync(destPath, { recursive: true });
        copySharedEntityDir(srcPath, destPath, entityType, useCases);
      }
    }
    
    // Also copy shared .aiignore and mcp.json
    const sharedExtraFiles = ['.aiignore', 'mcp.json'];
    for (const file of sharedExtraFiles) {
      const srcFile = join(sharedDir, file);
      const destFile = join(outputRulesyncPath, file);
      if (existsSync(srcFile)) {
        cpSync(srcFile, destFile);
      }
    }
  }

  // 2. Overlay each use case from this source (later ones override earlier)
  for (const useCaseName of useCases) {
    const useCaseRulesyncDir = join(useCasesDir, useCaseName, '.rulesync');
    
    if (existsSync(useCaseRulesyncDir)) {
      logger?.verbose?.(`  ← ${label}/use-cases/${useCaseName}/`);
      mergeRulesyncDir(useCaseRulesyncDir, outputRulesyncPath);
    }
  }
}

/**
 * Compose content from agents repository based on use-cases
 * Supports both single source (agentsPath) and multiple sources (sourcePaths)
 * 
 * @param {Object} options
 * @param {string} options.agentsPath - Path to the agents repository (single source, for backward compat)
 * @param {Array} options.sourcePaths - Array of source paths (multiple sources)
 * @param {Array} options.resolvedSources - Array of resolved source objects (with localPath and name)
 * @param {string[]} options.useCases - Array of use-case names to compose
 * @param {string} options.outputPath - Path to write composed content
 * @param {Object} options.logger - Logger instance
 * @returns {string} Path to the .rulesync directory in output
 */
export function compose(options) {
  const { agentsPath, sourcePaths, resolvedSources, useCases, outputPath, logger } = options;
  
  const outputRulesyncPath = join(outputPath, '.rulesync');

  // Clean and create output directory
  if (existsSync(outputPath)) {
    rmSync(outputPath, { recursive: true });
  }
  mkdirSync(outputRulesyncPath, { recursive: true });

  logger?.verbose?.(`Composing: ${useCases.join(' + ')}`);
  logger?.verbose?.(`Output: ${outputPath}`);

  // Determine source paths to use
  let sources = [];
  
  if (resolvedSources && resolvedSources.length > 0) {
    // Use resolved sources with labels
    sources = resolvedSources.map(s => ({
      path: s.localPath,
      label: s.name || basename(s.localPath)
    }));
  } else if (sourcePaths && sourcePaths.length > 0) {
    // Use source paths array
    sources = sourcePaths.map(p => ({ path: p, label: basename(p) }));
  } else if (agentsPath) {
    // Backward compatibility: single agentsPath
    sources = [{ path: agentsPath, label: basename(agentsPath) }];
  } else {
    throw new Error('No source paths provided for composition');
  }

  // Compose from each source in order (later sources override earlier)
  for (const source of sources) {
    composeFromSource({
      sourcePath: source.path,
      useCases,
      outputRulesyncPath,
      logger,
      sourceLabel: source.label
    });
  }

  return outputRulesyncPath;
}

/**
 * Generate rulesync.jsonc configuration
 * Supports both single source (agentsPath) and multiple sources (sourcePaths/resolvedSources)
 * 
 * @param {Object} options
 * @param {string} options.agentsPath - Path to the agents repository (single source, backward compat)
 * @param {Array} options.sourcePaths - Array of source paths (multiple sources)
 * @param {Array} options.resolvedSources - Array of resolved source objects (with localPath)
 * @param {string[]} options.useCases - Array of use-case names
 * @param {string[]} options.targets - Array of target names
 * @param {string[]} options.features - Array of feature names
 * @param {Object} options.configOptions - Options from .amgr/config.json
 * @returns {Object} The rulesync configuration object
 */
export function generateRulesyncConfig(options) {
  const { agentsPath, sourcePaths, resolvedSources, useCases, targets, features, configOptions = {} } = options;
  
  // Determine source paths to use
  let sources = [];
  if (resolvedSources && resolvedSources.length > 0) {
    sources = resolvedSources.map(s => s.localPath);
  } else if (sourcePaths && sourcePaths.length > 0) {
    sources = sourcePaths;
  } else if (agentsPath) {
    sources = [agentsPath];
  }
  
  // Base configuration
  const rulesyncConfig = {
    "$schema": "https://raw.githubusercontent.com/dyoshikawa/rulesync/refs/heads/main/config-schema.json",
    "targets": targets,
    "features": features,
    "baseDirs": ["."],
    "delete": true
  };

  // Apply options from config
  if (configOptions.simulateCommands !== undefined) {
    rulesyncConfig.simulateCommands = configOptions.simulateCommands;
  }
  if (configOptions.simulateSubagents !== undefined) {
    rulesyncConfig.simulateSubagents = configOptions.simulateSubagents;
  }
  if (configOptions.simulateSkills !== undefined) {
    rulesyncConfig.simulateSkills = configOptions.simulateSkills;
  }
  if (configOptions.modularMcp !== undefined) {
    rulesyncConfig.modularMcp = configOptions.modularMcp;
  }

  // Check if any use case in any source has a custom rulesync.jsonc and merge
  // Later sources take precedence
  for (const sourcePath of sources) {
    const useCasesDir = join(sourcePath, 'use-cases');
    
    for (const useCaseName of useCases) {
      const useCaseConfig = join(useCasesDir, useCaseName, 'rulesync.jsonc');
      if (existsSync(useCaseConfig)) {
        try {
          const customConfig = readJsoncFile(useCaseConfig);
          // Only merge specific keys (simulation options), not targets/features
          // since those come from the amgr config
          const { simulateCommands, simulateSubagents, simulateSkills, modularMcp } = customConfig;
          if (simulateCommands !== undefined && configOptions.simulateCommands === undefined) {
            rulesyncConfig.simulateCommands = simulateCommands;
          }
          if (simulateSubagents !== undefined && configOptions.simulateSubagents === undefined) {
            rulesyncConfig.simulateSubagents = simulateSubagents;
          }
          if (simulateSkills !== undefined && configOptions.simulateSkills === undefined) {
            rulesyncConfig.simulateSkills = simulateSkills;
          }
          if (modularMcp !== undefined && configOptions.modularMcp === undefined) {
            rulesyncConfig.modularMcp = modularMcp;
          }
        } catch (e) {
          // Ignore parsing errors in use-case configs
        }
      }
    }
  }

  return rulesyncConfig;
}

/**
 * Write rulesync.jsonc to the output directory
 */
export function writeRulesyncConfig(outputPath, config) {
  const configPath = join(outputPath, 'rulesync.jsonc');
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  return configPath;
}
