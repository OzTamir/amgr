import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_FILE, SHARED_DIR, USE_CASES_DIR } from './constants.js';
import type { RepoConfig } from '../types/repo.js';
import { RepoConfigSchema } from '../schemas/repo.js';
import { validateWithSchemaGetErrors } from '../schemas/validation.js';

export function getRepoConfigPath(repoPath: string): string {
  return join(repoPath, REPO_FILE);
}

export function isAmgrRepo(dirPath: string): boolean {
  return existsSync(getRepoConfigPath(dirPath));
}

export function repoConfigExists(repoPath: string): boolean {
  return existsSync(getRepoConfigPath(repoPath));
}

export function loadRepoConfig(repoPath: string): RepoConfig {
  const configPath = getRepoConfigPath(repoPath);

  if (!existsSync(configPath)) {
    throw new Error(
      `No repo.json found in ${repoPath}.\n` + `Run 'amgr repo init' to create one.`
    );
  }

  try {
    const content = readFileSync(configPath, 'utf8');
    const parsed: unknown = JSON.parse(content);

    const result = RepoConfigSchema.safeParse(parsed);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const path =
        firstIssue && firstIssue.path.length > 0
          ? firstIssue.path.join('.')
          : 'root';
      const message = firstIssue?.message ?? 'Validation failed';
      throw new Error(`Invalid repo.json: ${message} (at ${path})`);
    }

    return result.data;
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${configPath}: ${e.message}`);
    }
    throw e;
  }
}

export function saveRepoConfig(repoPath: string, config: RepoConfig): void {
  const configPath = getRepoConfigPath(repoPath);
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}

export function validateRepoConfig(config: unknown): string[] {
  const result = validateWithSchemaGetErrors(RepoConfigSchema, config);
  if (result.success) {
    return [];
  }
  return result.errors;
}

export function loadAndValidateRepoConfig(repoPath: string): RepoConfig {
  const config = loadRepoConfig(repoPath);
  const errors = validateRepoConfig(config);

  if (errors.length > 0) {
    throw new Error(errors[0]);
  }

  return config;
}

export function getRepoUseCases(repoPath: string): string[] {
  const config = loadRepoConfig(repoPath);
  return Object.keys(config['use-cases'] ?? {});
}

export function getRepoUseCaseDescriptions(
  repoPath: string
): Record<string, string> {
  const config = loadRepoConfig(repoPath);
  const descriptions: Record<string, string> = {};
  for (const [name, useCase] of Object.entries(config['use-cases'] ?? {})) {
    descriptions[name] = useCase.description;
  }
  return descriptions;
}

export function addUseCaseToRepo(
  repoPath: string,
  name: string,
  description: string
): void {
  const config = loadRepoConfig(repoPath);

  if (config['use-cases'][name]) {
    throw new Error(`Use-case "${name}" already exists in repo.json`);
  }

  config['use-cases'][name] = { description };
  saveRepoConfig(repoPath, config);
}

export function removeUseCaseFromRepo(repoPath: string, name: string): void {
  const config = loadRepoConfig(repoPath);

  if (!config['use-cases'][name]) {
    throw new Error(`Use-case "${name}" does not exist in repo.json`);
  }

  delete config['use-cases'][name];
  saveRepoConfig(repoPath, config);
}

export function useCaseExistsInRepo(repoPath: string, name: string): boolean {
  const config = loadRepoConfig(repoPath);
  return !!config['use-cases'][name];
}

export function validateRepoStructure(repoPath: string): string[] {
  const issues: string[] = [];

  if (!existsSync(getRepoConfigPath(repoPath))) {
    issues.push('Missing repo.json');
  }

  const sharedDir = join(repoPath, SHARED_DIR);
  if (!existsSync(sharedDir)) {
    issues.push('Missing shared/ directory');
  }

  const useCasesDir = join(repoPath, USE_CASES_DIR);
  if (!existsSync(useCasesDir)) {
    issues.push('Missing use-cases/ directory');
  }

  return issues;
}
