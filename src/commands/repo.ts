import { existsSync, mkdirSync, rmSync, readdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { input, confirm } from '@inquirer/prompts';

import {
  SHARED_DIR,
  USE_CASES_DIR,
  SHARED_SUBDIR,
  RULESYNC_DIR,
  RULESYNC_CONFIG,
  ENTITY_TYPES,
} from '../lib/constants.js';
import {
  isAmgrRepo,
  loadRepoConfig,
  saveRepoConfig,
  addUseCaseToRepo,
  removeUseCaseFromRepo,
  useCaseExistsInRepo,
  profileExistsInRepo,
  addProfileToRepo,
  removeProfileFromRepo,
  initNestedProfile,
} from '../lib/repo-config.js';
import { createLogger } from '../lib/utils.js';
import type { CommandOptions } from '../types/common.js';
import type { RepoConfig } from '../types/repo.js';

interface RepoInitOptions extends CommandOptions {
  name?: string;
  description?: string;
  author?: string;
}

export async function repoInit(options: RepoInitOptions = {}): Promise<void> {
  const repoPath = process.cwd();
  const logger = createLogger(options.verbose);

  try {
    if (isAmgrRepo(repoPath)) {
      const overwrite = await confirm({
        message: 'This directory already contains a repo.json. Reinitialize?',
        default: false,
      });

      if (!overwrite) {
        logger.info('Aborted. Existing repo preserved.');
        return;
      }
    }

    logger.info('Initializing amgr repository...\n');

    const defaultName = basename(repoPath);
    const name =
      options.name ??
      (await input({
        message: 'Repository name:',
        default: defaultName,
        validate: (value) => (value.trim() ? true : 'Name is required'),
      }));

    const description =
      options.description !== undefined
        ? options.description
        : await input({
            message: 'Description (optional):',
            default: '',
          });

    const author =
      options.author !== undefined
        ? options.author
        : await input({
            message: 'Author (optional):',
            default: '',
          });

    const repoConfig: RepoConfig = {
      $schema:
        'https://raw.githubusercontent.com/oztamir/amgr/main/schemas/amgr-repo.schema.json',
      name: name.trim(),
      ...(description.trim() && { description: description.trim() }),
      version: '1.0.0',
      ...(author.trim() && { author: author.trim() }),
      'use-cases': {},
    };

    const sharedDir = join(repoPath, SHARED_DIR);
    const useCasesDir = join(repoPath, USE_CASES_DIR);

    for (const entityType of ENTITY_TYPES) {
      const entityDir = join(sharedDir, entityType);
      if (!existsSync(entityDir)) {
        mkdirSync(entityDir, { recursive: true });
      }
    }

    if (!existsSync(useCasesDir)) {
      mkdirSync(useCasesDir, { recursive: true });
    }

    saveRepoConfig(repoPath, repoConfig);

    logger.info('');
    logger.success(`Initialized amgr repo: ${name}`);
    logger.info('\nCreated structure:');
    logger.info('  repo.json');
    logger.info('  shared/');
    for (const entityType of ENTITY_TYPES) {
      logger.info(`    ${entityType}/`);
    }
    logger.info('  use-cases/');
    logger.info('\nNext steps:');
    logger.info('  1. Add use-cases with "amgr repo add <name>"');
    logger.info('  2. Add shared content to shared/rules/, shared/commands/, etc.');
    logger.info('  3. Use this repo as a source with "amgr source add ."');
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

interface RepoAddOptions extends CommandOptions {
  description?: string;
  nested?: boolean;
}

function parseProfileSpec(spec: string): { parent: string; sub: string | null } {
  const colonIndex = spec.indexOf(':');
  if (colonIndex === -1) {
    return { parent: spec, sub: null };
  }
  return { 
    parent: spec.substring(0, colonIndex), 
    sub: spec.substring(colonIndex + 1) 
  };
}

async function addFlatProfile(
  repoPath: string,
  profileName: string,
  description: string,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  const useCaseDir = join(repoPath, USE_CASES_DIR, profileName);
  if (existsSync(useCaseDir)) {
    const useExisting = await confirm({
      message: `Directory use-cases/${profileName}/ already exists. Register it in repo.json?`,
      default: true,
    });

    if (!useExisting) {
      logger.info('Aborted.');
      return;
    }
  }

  const rulesyncDir = join(useCaseDir, RULESYNC_DIR);

  for (const entityType of ENTITY_TYPES) {
    const entityDir = join(rulesyncDir, entityType);
    if (!existsSync(entityDir)) {
      mkdirSync(entityDir, { recursive: true });
    }
  }

  const rulesyncConfigPath = join(useCaseDir, RULESYNC_CONFIG);
  if (!existsSync(rulesyncConfigPath)) {
    const rulesyncConfig = {
      $schema:
        'https://raw.githubusercontent.com/dyoshikawa/rulesync/refs/heads/main/config-schema.json',
    };
    writeFileSync(
      rulesyncConfigPath,
      JSON.stringify(rulesyncConfig, null, 2) + '\n'
    );
  }

  addUseCaseToRepo(repoPath, profileName, description);

  logger.info('');
  logger.success(`Added profile: ${profileName}`);
  logger.info('\nCreated structure:');
  logger.info(`  use-cases/${profileName}/`);
  logger.info(`    ${RULESYNC_DIR}/`);
  for (const entityType of ENTITY_TYPES) {
    logger.info(`      ${entityType}/`);
  }
  logger.info(`    ${RULESYNC_CONFIG}`);
  logger.info('\nNext steps:');
  logger.info(`  1. Add rules to use-cases/${profileName}/.rulesync/rules/`);
  logger.info(`  2. Add commands to use-cases/${profileName}/.rulesync/commands/`);
  logger.info(`  3. Add skills to use-cases/${profileName}/.rulesync/skills/`);
}

async function addNestedProfile(
  repoPath: string,
  parentName: string,
  parentDescription: string,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  const parentDir = join(repoPath, parentName);
  const sharedDir = join(parentDir, SHARED_SUBDIR);
  
  for (const entityType of ENTITY_TYPES) {
    const entityDir = join(sharedDir, entityType);
    if (!existsSync(entityDir)) {
      mkdirSync(entityDir, { recursive: true });
    }
  }

  initNestedProfile(repoPath, parentName, parentDescription);

  logger.info('');
  logger.success(`Added nested profile: ${parentName}`);
  logger.info('\nCreated structure:');
  logger.info(`  ${parentName}/`);
  logger.info(`    ${SHARED_SUBDIR}/`);
  for (const entityType of ENTITY_TYPES) {
    logger.info(`      ${entityType}/`);
  }
  logger.info('\nNext steps:');
  logger.info(`  1. Add sub-profiles with "amgr repo add ${parentName}:<sub-profile>"`);
  logger.info(`  2. Add shared rules to ${parentName}/${SHARED_SUBDIR}/rules/`);
}

async function addSubProfile(
  repoPath: string,
  parent: string,
  sub: string,
  description: string,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  const subProfileDir = join(repoPath, parent, sub);
  const rulesyncDir = join(subProfileDir, RULESYNC_DIR);

  for (const entityType of ENTITY_TYPES) {
    const entityDir = join(rulesyncDir, entityType);
    if (!existsSync(entityDir)) {
      mkdirSync(entityDir, { recursive: true });
    }
  }

  const rulesyncConfigPath = join(subProfileDir, RULESYNC_CONFIG);
  if (!existsSync(rulesyncConfigPath)) {
    const rulesyncConfig = {
      $schema:
        'https://raw.githubusercontent.com/dyoshikawa/rulesync/refs/heads/main/config-schema.json',
    };
    writeFileSync(
      rulesyncConfigPath,
      JSON.stringify(rulesyncConfig, null, 2) + '\n'
    );
  }

  addProfileToRepo(repoPath, `${parent}:${sub}`, description);

  logger.info('');
  logger.success(`Added sub-profile: ${parent}:${sub}`);
  logger.info('\nCreated structure:');
  logger.info(`  ${parent}/${sub}/`);
  logger.info(`    ${RULESYNC_DIR}/`);
  for (const entityType of ENTITY_TYPES) {
    logger.info(`      ${entityType}/`);
  }
  logger.info(`    ${RULESYNC_CONFIG}`);
  logger.info('\nNext steps:');
  logger.info(`  1. Add rules to ${parent}/${sub}/.rulesync/rules/`);
  logger.info(`  2. Add commands to ${parent}/${sub}/.rulesync/commands/`);
}

export async function repoAdd(
  name: string,
  options: RepoAddOptions = {}
): Promise<void> {
  const repoPath = process.cwd();
  const logger = createLogger(options.verbose);

  try {
    if (!isAmgrRepo(repoPath)) {
      throw new Error('Not an amgr repo. Run "amgr repo init" first.');
    }

    if (!name || !name.trim()) {
      throw new Error('Profile name is required');
    }

    const profileSpec = name.trim().toLowerCase().replace(/\s+/g, '-');
    const { parent, sub } = parseProfileSpec(profileSpec);

    if (profileExistsInRepo(repoPath, profileSpec)) {
      throw new Error(`Profile "${profileSpec}" already exists`);
    }

    const description =
      options.description ??
      (await input({
        message: 'Description:',
        validate: (value) => (value.trim() ? true : 'Description is required'),
      }));

    if (sub) {
      logger.info(`Adding sub-profile: ${parent}:${sub}\n`);
      await addSubProfile(repoPath, parent, sub, description.trim(), logger);
    } else if (options.nested) {
      logger.info(`Adding nested profile: ${parent}\n`);
      await addNestedProfile(repoPath, parent, description.trim(), logger);
    } else {
      logger.info(`Adding profile: ${parent}\n`);
      await addFlatProfile(repoPath, parent, description.trim(), logger);
    }
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

export async function repoRemove(
  name: string,
  options: CommandOptions = {}
): Promise<void> {
  const repoPath = process.cwd();
  const logger = createLogger(options.verbose);

  try {
    if (!isAmgrRepo(repoPath)) {
      throw new Error('Not an amgr repo. Run "amgr repo init" first.');
    }

    if (!name || !name.trim()) {
      throw new Error('Profile name is required');
    }

    const profileSpec = name.trim();
    const { parent, sub } = parseProfileSpec(profileSpec);
    
    const isProfile = profileExistsInRepo(repoPath, profileSpec);
    const isLegacyUseCase = !isProfile && !sub && useCaseExistsInRepo(repoPath, profileSpec);

    if (!isProfile && !isLegacyUseCase) {
      throw new Error(`Profile "${profileSpec}" does not exist in repo.json`);
    }

    if (isLegacyUseCase) {
      if (!options.force) {
        const confirmDelete = await confirm({
          message: `Remove use-case "${profileSpec}"? This will delete the directory and all its contents.`,
          default: false,
        });

        if (!confirmDelete) {
          logger.info('Aborted.');
          return;
        }
      }

      const useCaseDir = join(repoPath, USE_CASES_DIR, profileSpec);
      if (existsSync(useCaseDir)) {
        rmSync(useCaseDir, { recursive: true });
        logger.verbose(`Removed directory: use-cases/${profileSpec}/`);
      }

      removeUseCaseFromRepo(repoPath, profileSpec);
      logger.success(`Removed use-case: ${profileSpec}`);
      return;
    }

    if (!options.force) {
      const confirmDelete = await confirm({
        message: `Remove profile "${profileSpec}"? This will delete the directory and all its contents.`,
        default: false,
      });

      if (!confirmDelete) {
        logger.info('Aborted.');
        return;
      }
    }

    if (sub) {
      const subProfileDir = join(repoPath, parent, sub);
      if (existsSync(subProfileDir)) {
        rmSync(subProfileDir, { recursive: true });
        logger.verbose(`Removed directory: ${parent}/${sub}/`);
      }
    } else {
      const profileDir = join(repoPath, parent);
      if (existsSync(profileDir)) {
        rmSync(profileDir, { recursive: true });
        logger.verbose(`Removed directory: ${parent}/`);
      }
      const useCaseDir = join(repoPath, USE_CASES_DIR, parent);
      if (existsSync(useCaseDir)) {
        rmSync(useCaseDir, { recursive: true });
        logger.verbose(`Removed directory: use-cases/${parent}/`);
      }
    }

    removeProfileFromRepo(repoPath, profileSpec);
    logger.success(`Removed profile: ${profileSpec}`);
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

export async function repoList(options: CommandOptions = {}): Promise<void> {
  const repoPath = process.cwd();
  const logger = createLogger(options.verbose);

  try {
    if (!isAmgrRepo(repoPath)) {
      throw new Error('Not an amgr repo. Run "amgr repo init" first.');
    }

    const config = loadRepoConfig(repoPath);
    const useCases = config['use-cases'] ?? {};
    const profiles = config.profiles ?? {};
    const useCaseNames = Object.keys(useCases);
    const profileNames = Object.keys(profiles);

    const useCasesDir = join(repoPath, USE_CASES_DIR);
    const existingUseCaseDirs = existsSync(useCasesDir)
      ? readdirSync(useCasesDir, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
      : [];

    console.log(`\nRepository: ${config.name}`);
    if (config.description) {
      console.log(`Description: ${config.description}`);
    }
    if (config.version) {
      console.log(`Version: ${config.version}`);
    }

    const hasContent = profileNames.length > 0 || useCaseNames.length > 0;

    if (profileNames.length > 0) {
      console.log('\nProfiles:');
      for (const name of profileNames.sort()) {
        const profile = profiles[name];
        if (!profile) continue;
        const desc = profile.description;
        const subProfiles = profile['sub-profiles'];
        
        if (subProfiles && Object.keys(subProfiles).length > 0) {
          const profileDir = join(repoPath, name);
          const hasDir = existsSync(profileDir);
          const status = hasDir ? '' : ' (missing directory)';
          console.log(`  ${name.padEnd(20)} - ${desc}${status}`);
          
          const subNames = Object.keys(subProfiles).sort();
          for (let i = 0; i < subNames.length; i++) {
            const subName = subNames[i]!;
            const subData = subProfiles[subName];
            const isLast = i === subNames.length - 1;
            const prefix = isLast ? '  └─' : '  ├─';
            const subDir = join(repoPath, name, subName);
            const hasSubDir = existsSync(subDir);
            const subStatus = hasSubDir ? '' : ' (missing directory)';
            console.log(`  ${prefix} ${subName.padEnd(17)} - ${subData?.description ?? ''}${subStatus}`);
          }
        } else {
          const profileDir = join(repoPath, name);
          const hasDir = existsSync(profileDir) || existingUseCaseDirs.includes(name);
          const status = hasDir ? '' : ' (missing directory)';
          console.log(`  ${name.padEnd(20)} - ${desc}${status}`);
        }
      }
    }

    if (useCaseNames.length > 0) {
      const legacyUseCases = useCaseNames.filter(n => !profileNames.includes(n));
      if (legacyUseCases.length > 0) {
        console.log('\nUse-cases (legacy):');
        for (const name of legacyUseCases.sort()) {
          const useCase = useCases[name];
          if (!useCase) continue;
          const desc = useCase.description;
          const hasDir = existingUseCaseDirs.includes(name);
          const status = hasDir ? '' : ' (missing directory)';
          console.log(`  ${name.padEnd(20)} - ${desc}${status}`);
        }
      }
    }

    if (!hasContent) {
      console.log('\nProfiles:');
      console.log('  (none)');
      console.log('\n  Run "amgr repo add <name>" to add a profile.');
      console.log('  Run "amgr repo add <name> --nested" to add a nested profile.');
    }

    if (options.verbose) {
      const allRegistered = [...profileNames, ...useCaseNames];
      const orphaned = existingUseCaseDirs.filter((d) => !allRegistered.includes(d));
      
      const rootDirs = readdirSync(repoPath, { withFileTypes: true })
        .filter((d) => d.isDirectory() && 
          !['shared', 'use-cases', '.git', 'node_modules', '.amgr'].includes(d.name) &&
          !d.name.startsWith('.'))
        .map((d) => d.name);
      const orphanedRoot = rootDirs.filter((d) => !profileNames.includes(d));
      
      if (orphaned.length > 0 || orphanedRoot.length > 0) {
        console.log('\nOrphaned directories (not in repo.json):');
        for (const dir of orphaned) {
          console.log(`  use-cases/${dir}`);
        }
        for (const dir of orphanedRoot) {
          console.log(`  ${dir}/`);
        }
      }
    }

    console.log('');
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error(message);
    process.exit(1);
  }
}
