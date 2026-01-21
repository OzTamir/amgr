import { writeFileSync } from 'node:fs';
import { checkbox, confirm, input, select } from '@inquirer/prompts';

import {
  VALID_TARGETS,
  TARGET_DESCRIPTIONS,
  VALID_FEATURES,
  FEATURE_DESCRIPTIONS,
} from '../lib/constants.js';
import {
  loadAndValidateConfig,
  getConfigPath,
  configExists,
  normalizeOutputDirPrefix,
} from '../lib/config.js';
import { createLogger, getEffectiveProfiles } from '../lib/utils.js';
import {
  resolveSources,
  getCombinedProfiles,
} from '../lib/sources.js';
import { getGlobalSources } from '../lib/global-config.js';
import type { CommandOptions, Logger } from '../types/common.js';
import type { AmgrConfig, Target, Feature } from '../types/config.js';

type ConfigSection = 'targets' | 'features' | 'use-cases' | 'outputDirs' | 'options' | 'done';

async function editTargets(config: AmgrConfig, _logger: Logger): Promise<AmgrConfig> {
  const currentTargets = config.targets.filter((t): t is Target => t !== '*');
  const hasWildcard = config.targets.includes('*');

  const targets = (await checkbox({
    message: 'Select target AI tools:',
    choices: VALID_TARGETS.map((t) => ({
      name: `${t} - ${TARGET_DESCRIPTIONS[t]}`,
      value: t,
      checked: hasWildcard || currentTargets.includes(t),
    })),
    required: true,
  })) as Target[];

  if (targets.length === 0) {
    throw new Error('At least one target is required.');
  }

  return { ...config, targets };
}

async function editFeatures(config: AmgrConfig, _logger: Logger): Promise<AmgrConfig> {
  const features = (await checkbox({
    message: 'Select features to include:',
    choices: VALID_FEATURES.map((f) => ({
      name: `${f} - ${FEATURE_DESCRIPTIONS[f]}`,
      value: f,
      checked: config.features.includes(f),
    })),
    required: true,
  })) as Feature[];

  if (features.length === 0) {
    throw new Error('At least one feature is required.');
  }

  return { ...config, features };
}

function buildProfileChoices(
  combined: ReturnType<typeof getCombinedProfiles>,
  currentProfiles: string[]
): Array<{ name: string; value: string; checked: boolean }> {
  const choices: Array<{ name: string; value: string; checked: boolean }> = [];
  const profileNames = Object.keys(combined).sort();

  for (const name of profileNames) {
    const profileData = combined[name];
    if (!profileData) continue;
    const { description, sources } = profileData;
    const sourceLabel =
      sources.length > 1 ? ` (${sources.join(', ')})` : ` (${sources[0]})`;
    
    const subProfiles = profileData['sub-profiles'];
    if (subProfiles && Object.keys(subProfiles).length > 0) {
      const subNames = Object.keys(subProfiles).sort();
      const hasWildcard = currentProfiles.includes(`${name}:*`) || currentProfiles.includes(name);
      choices.push({
        name: `${name} - ${description}${sourceLabel}`,
        value: `${name}:*`,
        checked: hasWildcard,
      });
      for (let i = 0; i < subNames.length; i++) {
        const subName = subNames[i]!;
        const subData = subProfiles[subName];
        const isLast = i === subNames.length - 1;
        const prefix = isLast ? '  └─' : '  ├─';
        choices.push({
          name: `${prefix} ${subName} - ${subData?.description ?? ''}`,
          value: `${name}:${subName}`,
          checked: currentProfiles.includes(`${name}:${subName}`),
        });
      }
    } else {
      choices.push({
        name: `${name} - ${description}${sourceLabel}`,
        value: name,
        checked: currentProfiles.includes(name),
      });
    }
  }

  return choices;
}

async function editProfiles(config: AmgrConfig, logger: Logger): Promise<AmgrConfig> {
  const globalSources = getGlobalSources();
  const allSources = [...globalSources, ...(config.sources ?? [])];

  if (allSources.length === 0) {
    logger.warn('No sources configured. Add sources first to select profiles.');
    return config;
  }

  let resolvedSources;
  try {
    resolvedSources = resolveSources(allSources, { logger, skipFetch: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.warn(`Could not resolve sources: ${message}`);
    return config;
  }

  const combined = getCombinedProfiles(resolvedSources);
  const profileNames = Object.keys(combined).sort();

  if (profileNames.length === 0) {
    logger.warn('No profiles found in configured sources.');
    return config;
  }

  const currentProfiles = getEffectiveProfiles(config);
  const choices = buildProfileChoices(combined, currentProfiles);

  const selectedProfiles = (await checkbox({
    message: 'Select profiles:',
    choices,
    required: true,
  })) as string[];

  if (selectedProfiles.length === 0) {
    throw new Error('At least one profile is required.');
  }

  const newConfig = { ...config, 'use-cases': selectedProfiles };

  if (newConfig.outputDirs) {
    const validOutputDirs: Record<string, string> = {};
    for (const [profile, prefix] of Object.entries(newConfig.outputDirs)) {
      const profileParent = profile.includes(':') ? profile.split(':')[0] : profile;
      const matchesSelected = selectedProfiles.some(p => {
        if (p === profile) return true;
        if (p.endsWith(':*') && p.startsWith(`${profileParent}:`)) return true;
        return false;
      });
      if (matchesSelected) {
        validOutputDirs[profile] = prefix;
      }
    }
    if (Object.keys(validOutputDirs).length > 0) {
      newConfig.outputDirs = validOutputDirs;
    } else {
      delete newConfig.outputDirs;
    }
  }

  return newConfig;
}

async function editOutputDirs(config: AmgrConfig, logger: Logger): Promise<AmgrConfig> {
  const profiles = getEffectiveProfiles(config);

  if (profiles.length === 0) {
    logger.warn('No profiles configured. Add profiles first.');
    return config;
  }

  const currentOutputDirs = config.outputDirs ?? {};

  logger.info(
    '\nSpecify a directory prefix for each profile (e.g., "docs/" places files in docs/.claude/).'
  );
  logger.info('Leave empty to use the default (project root).\n');

  const outputDirs: Record<string, string> = {};

  for (const profile of profiles) {
    const currentValue = currentOutputDirs[profile] ?? '';
    const dirInput = await input({
      message: `Output directory for '${profile}':`,
      default: currentValue,
    });

    const normalized = normalizeOutputDirPrefix(dirInput);
    if (normalized) {
      outputDirs[profile] = normalized;
    }
  }

  const newConfig = { ...config };
  if (Object.keys(outputDirs).length > 0) {
    newConfig.outputDirs = outputDirs;
  } else {
    delete newConfig.outputDirs;
  }

  return newConfig;
}

async function editOptions(config: AmgrConfig, _logger: Logger): Promise<AmgrConfig> {
  const currentOptions = config.options ?? {};

  const simulateCommands = await confirm({
    message: 'Enable simulated commands for tools without native support?',
    default: currentOptions.simulateCommands ?? false,
  });

  const simulateSubagents = await confirm({
    message: 'Enable simulated subagents for tools without native support?',
    default: currentOptions.simulateSubagents ?? false,
  });

  const simulateSkills = await confirm({
    message: 'Enable simulated skills for tools without native support?',
    default: currentOptions.simulateSkills ?? false,
  });

  const modularMcp = await confirm({
    message: 'Enable modular-mcp for Claude Code (reduces token usage)?',
    default: currentOptions.modularMcp ?? false,
  });

  const newConfig = { ...config };

  const newOptions: AmgrConfig['options'] = {};
  if (simulateCommands) newOptions.simulateCommands = true;
  if (simulateSubagents) newOptions.simulateSubagents = true;
  if (simulateSkills) newOptions.simulateSkills = true;
  if (modularMcp) newOptions.modularMcp = true;

  if (currentOptions.ignoreGlobalSources !== undefined) {
    newOptions.ignoreGlobalSources = currentOptions.ignoreGlobalSources;
  }
  if (currentOptions.globalSourcesPosition !== undefined) {
    newOptions.globalSourcesPosition = currentOptions.globalSourcesPosition;
  }

  if (Object.keys(newOptions).length > 0) {
    newConfig.options = newOptions;
  } else {
    delete newConfig.options;
  }

  return newConfig;
}

function formatCurrentConfig(config: AmgrConfig): string {
  const profiles = getEffectiveProfiles(config);
  const lines: string[] = [];
  lines.push(`  Targets: ${config.targets.join(', ')}`);
  lines.push(`  Features: ${config.features.join(', ')}`);
  lines.push(`  Profiles: ${profiles.join(', ')}`);

  if (config.outputDirs && Object.keys(config.outputDirs).length > 0) {
    const outputDirEntries = Object.entries(config.outputDirs)
      .map(([uc, dir]) => `${uc}→${dir}`)
      .join(', ');
    lines.push(`  Output dirs: ${outputDirEntries}`);
  }

  if (config.options && Object.keys(config.options).length > 0) {
    const enabledOptions = Object.entries(config.options)
      .filter(([, v]) => v === true)
      .map(([k]) => k);
    if (enabledOptions.length > 0) {
      lines.push(`  Options: ${enabledOptions.join(', ')}`);
    }
  }

  return lines.join('\n');
}

export async function configEdit(options: CommandOptions = {}): Promise<void> {
  const projectPath = process.cwd();
  const logger = createLogger(options.verbose);

  try {
    if (!configExists(projectPath, options.config)) {
      logger.error('No configuration found. Run "amgr init" first.');
      process.exit(1);
    }

    let config = loadAndValidateConfig(projectPath, options.config);
    const configPath = getConfigPath(projectPath, options.config);

    logger.info(`Editing ${configPath}\n`);
    logger.info('Current configuration:');
    logger.info(formatCurrentConfig(config));
    logger.info('');

    let hasChanges = false;

    while (true) {
      const section = await select<ConfigSection>({
        message: 'What would you like to edit?',
        choices: [
          { name: 'Targets - AI tools to generate configs for', value: 'targets' },
          { name: 'Features - Content types to include', value: 'features' },
          { name: 'Profiles - Which profiles to enable', value: 'use-cases' },
          { name: 'Output directories - Custom paths per profile', value: 'outputDirs' },
          { name: 'Options - Advanced settings', value: 'options' },
          { name: 'Done - Save and exit', value: 'done' },
        ],
      });

      if (section === 'done') {
        break;
      }

      const previousConfig = JSON.stringify(config);

      switch (section) {
        case 'targets':
          config = await editTargets(config, logger);
          break;
        case 'features':
          config = await editFeatures(config, logger);
          break;
        case 'use-cases':
          config = await editProfiles(config, logger);
          break;
        case 'outputDirs':
          config = await editOutputDirs(config, logger);
          break;
        case 'options':
          config = await editOptions(config, logger);
          break;
      }

      if (JSON.stringify(config) !== previousConfig) {
        hasChanges = true;
        logger.info('\nUpdated configuration:');
        logger.info(formatCurrentConfig(config));
        logger.info('');
      }
    }

    if (hasChanges) {
      writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
      logger.success(`\nSaved ${configPath}`);
      logger.info('Run "amgr sync" to apply the changes.');
    } else {
      logger.info('\nNo changes made.');
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
