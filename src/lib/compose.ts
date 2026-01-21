import {
  existsSync,
  readdirSync,
  cpSync,
  rmSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { join, basename } from 'node:path';
import { 
  ENTITY_TYPES, 
  SHARED_DIR, 
  SHARED_SUBDIR, 
  USE_CASES_DIR, 
  RULESYNC_DIR,
  type EntityType,
} from './constants.js';
import { 
  shouldIncludeForUseCases, 
  shouldIncludeForProfiles,
  readJsoncFile,
  type FilterContext,
} from './utils.js';
import { parseProfileSpec } from './sources.js';
import type { ResolvedSource } from '../types/sources.js';
import type { ConfigOptions, Target, Feature } from '../types/config.js';
import type { Logger } from '../types/common.js';

export function getAvailableUseCases(agentsPath: string): string[] {
  const useCasesDir = join(agentsPath, 'use-cases');
  if (!existsSync(useCasesDir)) return [];
  return readdirSync(useCasesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

export function getAvailableUseCasesFromSources(
  sourcePaths: string[]
): Record<string, { sources: string[] }> {
  const combined: Record<string, { sources: string[] }> = {};

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

function copyDir(src: string, dest: string): void {
  if (!existsSync(src)) return;
  cpSync(src, dest, { recursive: true });
}

function copySharedEntityDir(
  srcDir: string,
  destDir: string,
  entityType: EntityType,
  targetUseCases: string[]
): void {
  if (!existsSync(srcDir)) return;

  const entries = readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);

    if (entityType === 'skills') {
      if (entry.isDirectory()) {
        const skillMdPath = join(srcPath, 'SKILL.md');
        if (existsSync(skillMdPath)) {
          if (shouldIncludeForUseCases(skillMdPath, targetUseCases)) {
            mkdirSync(destPath, { recursive: true });
            cpSync(srcPath, destPath, { recursive: true });
          }
        } else {
          mkdirSync(destPath, { recursive: true });
          cpSync(srcPath, destPath, { recursive: true });
        }
      }
    } else if (entityType === 'subagents') {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        if (shouldIncludeForUseCases(srcPath, targetUseCases)) {
          cpSync(srcPath, destPath);
        }
      } else if (entry.isDirectory()) {
        mkdirSync(destPath, { recursive: true });
        copySharedEntityDir(srcPath, destPath, entityType, targetUseCases);
      } else {
        cpSync(srcPath, destPath);
      }
    } else {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        if (shouldIncludeForUseCases(srcPath, targetUseCases)) {
          cpSync(srcPath, destPath);
        }
      } else if (entry.isDirectory()) {
        mkdirSync(destPath, { recursive: true });
        copySharedEntityDir(srcPath, destPath, entityType, targetUseCases);
      } else {
        cpSync(srcPath, destPath);
      }
    }
  }
}

function mergeRulesyncDir(sourceDir: string, targetDir: string): void {
  for (const entityType of ENTITY_TYPES) {
    const srcPath = join(sourceDir, entityType);
    const destPath = join(targetDir, entityType);

    if (existsSync(srcPath)) {
      mkdirSync(destPath, { recursive: true });
      copyDir(srcPath, destPath);
    }
  }

  const extraFiles = ['mcp.json', '.aiignore'];
  for (const file of extraFiles) {
    const srcFile = join(sourceDir, file);
    const destFile = join(targetDir, file);
    if (existsSync(srcFile)) {
      cpSync(srcFile, destFile);
    }
  }
}

export type ProfileType = 'flat' | 'nested';

export function detectProfileType(sourcePath: string, profileName: string): ProfileType {
  const profileDir = join(sourcePath, profileName);
  
  if (!existsSync(profileDir)) {
    const legacyDir = join(sourcePath, USE_CASES_DIR, profileName);
    if (existsSync(legacyDir)) {
      return 'flat';
    }
    return 'flat';
  }
  
  const rulesyncDir = join(profileDir, RULESYNC_DIR);
  if (existsSync(rulesyncDir)) {
    return 'flat';
  }
  
  const entries = readdirSync(profileDir, { withFileTypes: true });
  const hasSubdirs = entries.some(e => 
    e.isDirectory() && e.name !== SHARED_SUBDIR && e.name !== RULESYNC_DIR
  );
  
  return hasSubdirs ? 'nested' : 'flat';
}

function copyFilteredEntityDir(
  srcDir: string,
  destDir: string,
  entityType: EntityType,
  context: FilterContext
): void {
  if (!existsSync(srcDir)) return;

  const entries = readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);

    if (entityType === 'skills') {
      if (entry.isDirectory()) {
        const skillMdPath = join(srcPath, 'SKILL.md');
        if (existsSync(skillMdPath)) {
          if (shouldIncludeForProfiles(skillMdPath, context)) {
            mkdirSync(destPath, { recursive: true });
            cpSync(srcPath, destPath, { recursive: true });
          }
        } else {
          mkdirSync(destPath, { recursive: true });
          cpSync(srcPath, destPath, { recursive: true });
        }
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      if (shouldIncludeForProfiles(srcPath, context)) {
        mkdirSync(destDir, { recursive: true });
        cpSync(srcPath, destPath);
      }
    } else if (entry.isDirectory()) {
      mkdirSync(destPath, { recursive: true });
      copyFilteredEntityDir(srcPath, destPath, entityType, context);
    } else {
      mkdirSync(destDir, { recursive: true });
      cpSync(srcPath, destPath);
    }
  }
}

function copyGlobalShared(
  sourcePath: string,
  outputRulesyncPath: string,
  targetProfiles: string[],
  logger?: Logger
): void {
  const sharedDir = join(sourcePath, SHARED_DIR);
  if (!existsSync(sharedDir)) return;

  logger?.verbose?.(`    copying ${SHARED_DIR}/`);
  
  const context: FilterContext = {
    targetProfiles,
    currentScope: 'global',
  };

  for (const entityType of ENTITY_TYPES) {
    const srcPath = join(sharedDir, entityType);
    const destPath = join(outputRulesyncPath, entityType);
    if (existsSync(srcPath)) {
      mkdirSync(destPath, { recursive: true });
      copyFilteredEntityDir(srcPath, destPath, entityType, context);
    }
  }

  const sharedExtraFiles = ['.aiignore', 'mcp.json'];
  for (const file of sharedExtraFiles) {
    const srcFile = join(sharedDir, file);
    const destFile = join(outputRulesyncPath, file);
    if (existsSync(srcFile)) {
      cpSync(srcFile, destFile);
    }
  }
}

function copyParentShared(
  sourcePath: string,
  parentName: string,
  outputRulesyncPath: string,
  targetSubProfile: string,
  logger?: Logger
): void {
  const sharedDir = join(sourcePath, parentName, SHARED_SUBDIR);
  if (!existsSync(sharedDir)) return;

  logger?.verbose?.(`    copying ${parentName}/${SHARED_SUBDIR}/`);
  
  const context: FilterContext = {
    targetProfiles: [`${parentName}:${targetSubProfile}`],
    currentScope: parentName,
  };

  for (const entityType of ENTITY_TYPES) {
    const srcPath = join(sharedDir, entityType);
    const destPath = join(outputRulesyncPath, entityType);
    if (existsSync(srcPath)) {
      mkdirSync(destPath, { recursive: true });
      copyFilteredEntityDir(srcPath, destPath, entityType, context);
    }
  }

  const extraFiles = ['.aiignore', 'mcp.json'];
  for (const file of extraFiles) {
    const srcFile = join(sharedDir, file);
    const destFile = join(outputRulesyncPath, file);
    if (existsSync(srcFile)) {
      cpSync(srcFile, destFile);
    }
  }
}

function copySubProfileContent(
  sourcePath: string,
  parentName: string,
  subProfileName: string,
  outputRulesyncPath: string,
  logger?: Logger
): void {
  const rulesyncDir = join(sourcePath, parentName, subProfileName, RULESYNC_DIR);
  if (!existsSync(rulesyncDir)) return;

  logger?.verbose?.(`    copying ${parentName}/${subProfileName}/${RULESYNC_DIR}/`);
  mergeRulesyncDir(rulesyncDir, outputRulesyncPath);
}

function copyFlatProfileContent(
  sourcePath: string,
  profileName: string,
  outputRulesyncPath: string,
  logger?: Logger
): void {
  const newStyleDir = join(sourcePath, profileName, RULESYNC_DIR);
  if (existsSync(newStyleDir)) {
    logger?.verbose?.(`    copying ${profileName}/${RULESYNC_DIR}/`);
    mergeRulesyncDir(newStyleDir, outputRulesyncPath);
    return;
  }
  
  const legacyDir = join(sourcePath, USE_CASES_DIR, profileName, RULESYNC_DIR);
  if (existsSync(legacyDir)) {
    logger?.verbose?.(`    copying ${USE_CASES_DIR}/${profileName}/${RULESYNC_DIR}/`);
    mergeRulesyncDir(legacyDir, outputRulesyncPath);
  }
}

interface ComposeFromSourceWithProfilesOptions {
  sourcePath: string;
  profiles: string[];
  outputRulesyncPath: string;
  logger?: Logger | undefined;
  sourceLabel?: string | undefined;
}

function composeFromSourceWithProfiles(options: ComposeFromSourceWithProfilesOptions): void {
  const { sourcePath, profiles, outputRulesyncPath, logger, sourceLabel } = options;
  const label = sourceLabel ?? basename(sourcePath);

  logger?.verbose?.(`  ← ${label}`);

  copyGlobalShared(sourcePath, outputRulesyncPath, profiles, logger);

  for (const profileSpec of profiles) {
    const { parent, sub } = parseProfileSpec(profileSpec);

    if (sub) {
      copyParentShared(sourcePath, parent, outputRulesyncPath, sub, logger);
      copySubProfileContent(sourcePath, parent, sub, outputRulesyncPath, logger);
    } else {
      const profileType = detectProfileType(sourcePath, parent);
      if (profileType === 'nested') {
        logger?.verbose?.(`    profile "${parent}" is nested but no sub-profile specified, skipping direct content`);
      } else {
        copyFlatProfileContent(sourcePath, parent, outputRulesyncPath, logger);
      }
    }
  }
}

interface ComposeFromSourceOptions {
  sourcePath: string;
  useCases: string[];
  outputRulesyncPath: string;
  logger?: Logger | undefined;
  sourceLabel?: string | undefined;
}

function composeFromSource(options: ComposeFromSourceOptions): void {
  const { sourcePath, useCases, outputRulesyncPath, logger, sourceLabel } = options;

  const sharedDir = join(sourcePath, 'shared');
  const useCasesDir = join(sourcePath, 'use-cases');
  const label = sourceLabel ?? basename(sourcePath);

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

    const sharedExtraFiles = ['.aiignore', 'mcp.json'];
    for (const file of sharedExtraFiles) {
      const srcFile = join(sharedDir, file);
      const destFile = join(outputRulesyncPath, file);
      if (existsSync(srcFile)) {
        cpSync(srcFile, destFile);
      }
    }
  }

  for (const useCaseName of useCases) {
    const useCaseRulesyncDir = join(useCasesDir, useCaseName, '.rulesync');

    if (existsSync(useCaseRulesyncDir)) {
      logger?.verbose?.(`  ← ${label}/use-cases/${useCaseName}/`);
      mergeRulesyncDir(useCaseRulesyncDir, outputRulesyncPath);
    }
  }
}

interface ComposeOptions {
  agentsPath?: string;
  sourcePaths?: string[];
  resolvedSources?: ResolvedSource[];
  useCases: string[];
  outputPath: string;
  logger?: Logger;
}

interface ComposeWithProfilesOptions {
  sourcePaths?: string[];
  resolvedSources?: ResolvedSource[];
  profiles: string[];
  outputPath: string;
  logger?: Logger;
}

export function composeWithProfiles(options: ComposeWithProfilesOptions): string {
  const { sourcePaths, resolvedSources, profiles, outputPath, logger } = options;

  const outputRulesyncPath = join(outputPath, RULESYNC_DIR);

  if (existsSync(outputPath)) {
    rmSync(outputPath, { recursive: true });
  }
  mkdirSync(outputRulesyncPath, { recursive: true });

  logger?.verbose?.(`Composing profiles: ${profiles.join(' + ')}`);
  logger?.verbose?.(`Output: ${outputPath}`);

  let sources: Array<{ path: string; label: string }> = [];

  if (resolvedSources && resolvedSources.length > 0) {
    sources = resolvedSources.map((s) => ({
      path: s.localPath,
      label: s.name ?? basename(s.localPath),
    }));
  } else if (sourcePaths && sourcePaths.length > 0) {
    sources = sourcePaths.map((p) => ({ path: p, label: basename(p) }));
  } else {
    throw new Error('No source paths provided for composition');
  }

  for (const source of sources) {
    composeFromSourceWithProfiles({
      sourcePath: source.path,
      profiles,
      outputRulesyncPath,
      logger,
      sourceLabel: source.label,
    });
  }

  return outputRulesyncPath;
}

export function compose(options: ComposeOptions): string {
  const { agentsPath, sourcePaths, resolvedSources, useCases, outputPath, logger } =
    options;

  const outputRulesyncPath = join(outputPath, '.rulesync');

  if (existsSync(outputPath)) {
    rmSync(outputPath, { recursive: true });
  }
  mkdirSync(outputRulesyncPath, { recursive: true });

  logger?.verbose?.(`Composing: ${useCases.join(' + ')}`);
  logger?.verbose?.(`Output: ${outputPath}`);

  let sources: Array<{ path: string; label: string }> = [];

  if (resolvedSources && resolvedSources.length > 0) {
    sources = resolvedSources.map((s) => ({
      path: s.localPath,
      label: s.name ?? basename(s.localPath),
    }));
  } else if (sourcePaths && sourcePaths.length > 0) {
    sources = sourcePaths.map((p) => ({ path: p, label: basename(p) }));
  } else if (agentsPath) {
    sources = [{ path: agentsPath, label: basename(agentsPath) }];
  } else {
    throw new Error('No source paths provided for composition');
  }

  for (const source of sources) {
    composeFromSource({
      sourcePath: source.path,
      useCases,
      outputRulesyncPath,
      logger,
      sourceLabel: source.label,
    });
  }

  return outputRulesyncPath;
}

interface RulesyncConfig {
  $schema: string;
  targets: string[];
  features: string[];
  baseDirs: string[];
  delete: boolean;
  simulateCommands?: boolean;
  simulateSubagents?: boolean;
  simulateSkills?: boolean;
  modularMcp?: boolean;
}

interface GenerateRulesyncConfigOptions {
  agentsPath?: string;
  sourcePaths?: string[];
  resolvedSources?: ResolvedSource[];
  useCases: string[];
  targets: Target[];
  features: Feature[];
  configOptions?: ConfigOptions;
}

export function generateRulesyncConfig(
  options: GenerateRulesyncConfigOptions
): RulesyncConfig {
  const {
    agentsPath,
    sourcePaths,
    resolvedSources,
    useCases,
    targets,
    features,
    configOptions = {},
  } = options;

  let sources: string[] = [];
  if (resolvedSources && resolvedSources.length > 0) {
    sources = resolvedSources.map((s) => s.localPath);
  } else if (sourcePaths && sourcePaths.length > 0) {
    sources = sourcePaths;
  } else if (agentsPath) {
    sources = [agentsPath];
  }

  const rulesyncConfig: RulesyncConfig = {
    $schema:
      'https://raw.githubusercontent.com/dyoshikawa/rulesync/refs/heads/main/config-schema.json',
    targets: targets as string[],
    features: features as string[],
    baseDirs: ['.'],
    delete: true,
  };

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

  for (const sourcePath of sources) {
    const useCasesDir = join(sourcePath, 'use-cases');

    for (const useCaseName of useCases) {
      const useCaseConfig = join(useCasesDir, useCaseName, 'rulesync.jsonc');
      if (existsSync(useCaseConfig)) {
        try {
          const customConfig = readJsoncFile(useCaseConfig) as Partial<RulesyncConfig>;
          const {
            simulateCommands,
            simulateSubagents,
            simulateSkills,
            modularMcp,
          } = customConfig;
          if (
            simulateCommands !== undefined &&
            configOptions.simulateCommands === undefined
          ) {
            rulesyncConfig.simulateCommands = simulateCommands;
          }
          if (
            simulateSubagents !== undefined &&
            configOptions.simulateSubagents === undefined
          ) {
            rulesyncConfig.simulateSubagents = simulateSubagents;
          }
          if (
            simulateSkills !== undefined &&
            configOptions.simulateSkills === undefined
          ) {
            rulesyncConfig.simulateSkills = simulateSkills;
          }
          if (modularMcp !== undefined && configOptions.modularMcp === undefined) {
            rulesyncConfig.modularMcp = modularMcp;
          }
        } catch {
          // Ignore parsing errors in use-case configs
        }
      }
    }
  }

  return rulesyncConfig;
}

export function writeRulesyncConfig(
  outputPath: string,
  config: RulesyncConfig
): string {
  const configPath = join(outputPath, 'rulesync.jsonc');
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  return configPath;
}
