import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Logger, CommandOptions } from '../types/common.js';

/**
 * Scope context for filtering.
 * - 'global': /shared/ directory - can reference any profile or sub-profile
 * - string: /parent/_shared/ directory - can only reference sub-profile names (e.g., 'frontend', not 'development:frontend')
 */
export type ProfileScope = 'global' | string;

/**
 * Context for profile-aware filtering.
 */
export interface FilterContext {
  /** The profiles the user selected (e.g., ["development:frontend"]) */
  targetProfiles: string[];
  /** Current scope: 'global' for /shared/, or parent name for /parent/_shared/ */
  currentScope: ProfileScope;
}

/**
 * Result of frontmatter scope validation.
 */
export interface FrontmatterScopeValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface FrontmatterResult {
  [key: string]: string | string[];
}

export function parseFrontmatter(filePath: string): FrontmatterResult | null {
  try {
    const content = readFileSync(filePath, 'utf8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match?.[1]) return null;

    const yaml = match[1];
    const result: FrontmatterResult = {};

    const lines = yaml.split('\n');
    let currentKey: string | null = null;

    for (const line of lines) {
      if (line.match(/^\s*-\s+/)) {
        if (currentKey && Array.isArray(result[currentKey])) {
          const value = line
            .replace(/^\s*-\s+/, '')
            .replace(/^["']|["']$/g, '')
            .trim();
          (result[currentKey] as string[]).push(value);
        }
        continue;
      }

      const keyMatch = line.match(/^(\w[\w-]*)\s*:\s*(.*)/);
      if (keyMatch) {
        const [, key, value] = keyMatch;
        if (!key) continue;
        currentKey = key;

        const inlineArray = value?.match(/^\[(.*)\]$/);
        if (inlineArray?.[1] !== undefined) {
          result[key] = inlineArray[1]
            .split(',')
            .map((v) => v.trim().replace(/^["']|["']$/g, ''))
            .filter((v) => v);
        } else if (!value?.trim()) {
          result[key] = [];
        } else {
          result[key] = value.replace(/^["']|["']$/g, '').trim();
        }
      }
    }

    return result;
  } catch {
    return null;
  }
}

export function shouldIncludeForUseCases(
  filePath: string,
  targetUseCases: string[]
): boolean {
  const frontmatter = parseFrontmatter(filePath);

  if (!frontmatter) {
    return true;
  }

  const excludeUseCases = frontmatter['exclude-from-use-cases'];
  if (excludeUseCases) {
    const excludeList = Array.isArray(excludeUseCases)
      ? excludeUseCases
      : [excludeUseCases];
    if (targetUseCases.some((uc) => excludeList.includes(uc))) {
      return false;
    }
  }

  const fileUseCases = frontmatter['use-cases'];
  if (!fileUseCases) {
    return true;
  }

  if (Array.isArray(fileUseCases)) {
    return targetUseCases.some((uc) => fileUseCases.includes(uc));
  }

  return targetUseCases.includes(fileUseCases);
}

function getProfilesFromFrontmatter(frontmatter: FrontmatterResult): string[] | null {
  const profiles = frontmatter['profiles'] ?? frontmatter['use-cases'];
  if (!profiles) return null;
  return Array.isArray(profiles) ? profiles : [profiles];
}

function getExcludeProfilesFromFrontmatter(frontmatter: FrontmatterResult): string[] | null {
  const exclude = frontmatter['exclude-from-profiles'] ?? frontmatter['exclude-from-use-cases'];
  if (!exclude) return null;
  return Array.isArray(exclude) ? exclude : [exclude];
}

function profileMatchesTarget(
  declaredProfile: string,
  targetProfile: string,
  scope: ProfileScope
): boolean {
  if (scope === 'global') {
    // In global scope (/shared/), frontmatter can use:
    // - Full specs: "development:frontend" matches "development:frontend"
    // - Parent only: "development" matches "development:frontend" or "development:backend"
    if (declaredProfile === targetProfile) return true;
    
    // Check if declared is a parent matching the target's parent
    const colonIndex = targetProfile.indexOf(':');
    if (colonIndex !== -1) {
      const targetParent = targetProfile.substring(0, colonIndex);
      if (declaredProfile === targetParent) return true;
    }
    
    return false;
  }

  // In parent scope (/parent/_shared/), frontmatter should only use sub-profile names
  // e.g., in /development/_shared/, use "frontend" not "development:frontend"
  const colonIndex = targetProfile.indexOf(':');
  if (colonIndex === -1) {
    // Target is a flat profile - shouldn't be filtering in parent _shared
    return false;
  }
  
  const targetParent = targetProfile.substring(0, colonIndex);
  const targetSub = targetProfile.substring(colonIndex + 1);
  
  // Only match if we're in the right parent scope
  if (scope !== targetParent) return false;
  
  // In scoped context, declared profile should be just the sub-profile name
  return declaredProfile === targetSub;
}

export function shouldIncludeForProfiles(
  filePath: string,
  context: FilterContext
): boolean {
  const frontmatter = parseFrontmatter(filePath);

  if (!frontmatter) {
    return true;
  }

  const excludeProfiles = getExcludeProfilesFromFrontmatter(frontmatter);
  if (excludeProfiles) {
    for (const targetProfile of context.targetProfiles) {
      for (const excludeProfile of excludeProfiles) {
        if (profileMatchesTarget(excludeProfile, targetProfile, context.currentScope)) {
          return false;
        }
      }
    }
  }

  const declaredProfiles = getProfilesFromFrontmatter(frontmatter);
  if (!declaredProfiles) {
    return true;
  }

  for (const targetProfile of context.targetProfiles) {
    for (const declaredProfile of declaredProfiles) {
      if (profileMatchesTarget(declaredProfile, targetProfile, context.currentScope)) {
        return true;
      }
    }
  }

  return false;
}

export function validateFrontmatterScope(
  filePath: string,
  currentScope: ProfileScope,
  validSubProfiles: string[]
): FrontmatterScopeValidation {
  const result: FrontmatterScopeValidation = { valid: true, errors: [], warnings: [] };
  
  const frontmatter = parseFrontmatter(filePath);
  if (!frontmatter) return result;

  const declaredProfiles = getProfilesFromFrontmatter(frontmatter);
  if (!declaredProfiles || declaredProfiles.length === 0) return result;

  if (currentScope === 'global') {
    return result;
  }

  for (const profile of declaredProfiles) {
    if (profile.includes(':')) {
      result.warnings.push(
        `"profiles: [${profile}]" uses full profile spec in scoped context. Use just the sub-profile name (e.g., "${profile.split(':')[1]}")`
      );
      result.valid = false;
    } else if (!validSubProfiles.includes(profile)) {
      result.warnings.push(
        `"profiles: [${profile}]" references profile outside of "${currentScope}" scope. Allowed: [${validSubProfiles.join(', ')}]`
      );
      result.valid = false;
    }
  }

  return result;
}

export function parseJsonc(content: string): unknown {
  const jsonContent = content
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(jsonContent) as unknown;
}

export function readJsoncFile(filePath: string): unknown {
  const content = readFileSync(filePath, 'utf8');
  return parseJsonc(content);
}

export function formatFileList(files: string[], prefix = '  '): string {
  return files.map((f) => `${prefix}${f}`).join('\n');
}

export function createLogger(verbose = false): Logger {
  return {
    info: (msg: string) => console.log(msg),
    verbose: (msg: string) => {
      if (verbose) console.log(msg);
    },
    warn: (msg: string) => console.warn(`Warning: ${msg}`),
    error: (msg: string) => console.error(`Error: ${msg}`),
    success: (msg: string) => console.log(`✓ ${msg}`),
  };
}

export function isVerbose(options: CommandOptions = {}): boolean {
  return options.verbose === true || process.env['AMGR_VERBOSE'] === 'true';
}

export type CloudProvider = 'icloud' | 'dropbox' | 'onedrive';

export function isCloudSyncedPath(projectPath: string): CloudProvider | null {
  const resolved = resolve(projectPath);

  if (resolved.includes('/Library/Mobile Documents/')) {
    return 'icloud';
  }

  if (resolved.includes('/Dropbox/')) {
    return 'dropbox';
  }

  if (resolved.includes('/OneDrive/') || resolved.includes('/OneDrive-')) {
    return 'onedrive';
  }

  return null;
}

export function getEffectiveProfiles(config: {
  profiles?: string[] | undefined;
  'use-cases'?: string[] | undefined;
}): string[] {
  return config.profiles ?? config['use-cases'] ?? [];
}
