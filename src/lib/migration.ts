import type { AmgrConfig } from '../types/config.js';
import type { RepoConfig } from '../types/repo.js';
import type { Logger } from '../types/common.js';

export interface MigrationResult<T> {
  config: T;
  migrated: boolean;
  messages: string[];
}

export function migrateAmgrConfig(
  config: AmgrConfig,
  logger?: Logger
): MigrationResult<AmgrConfig> {
  const result: MigrationResult<AmgrConfig> = {
    config: { ...config },
    migrated: false,
    messages: [],
  };

  if (config['use-cases'] && !config.profiles) {
    result.config.profiles = config['use-cases'];
    delete (result.config as Partial<AmgrConfig>)['use-cases'];
    result.migrated = true;
    result.messages.push('Migrated "use-cases" to "profiles" field');
    logger?.warn('Config uses deprecated "use-cases" field. Consider updating to "profiles".');
  }

  return result;
}

export function migrateRepoConfig(
  config: RepoConfig,
  logger?: Logger
): MigrationResult<RepoConfig> {
  const result: MigrationResult<RepoConfig> = {
    config: { ...config },
    migrated: false,
    messages: [],
  };

  if (config['use-cases'] && !config.profiles) {
    const profiles: RepoConfig['profiles'] = {};
    
    for (const [name, meta] of Object.entries(config['use-cases'])) {
      profiles[name] = { description: meta.description };
    }
    
    result.config.profiles = profiles;
    result.migrated = true;
    result.messages.push('Migrated "use-cases" to "profiles" field');
    logger?.warn('repo.json uses deprecated "use-cases" field. Consider updating to "profiles".');
  }

  return result;
}

export function shouldMigrateAmgrConfig(config: AmgrConfig): boolean {
  return !!(config['use-cases'] && !config.profiles);
}

export function shouldMigrateRepoConfig(config: RepoConfig): boolean {
  return !!(config['use-cases'] && !config.profiles);
}
