import { readFileSync } from 'node:fs';
import type { Logger, CommandOptions } from '../types/common.js';

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
