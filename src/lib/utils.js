/**
 * Utility functions for amgr CLI
 */

import { readFileSync } from 'node:fs';

/**
 * Parse YAML frontmatter from a markdown file
 * Returns the frontmatter object or null if none exists
 */
export function parseFrontmatter(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;

    // Simple YAML parsing for our use case (handles arrays and strings)
    const yaml = match[1];
    const result = {};

    // Match key: value or key: [array]
    const lines = yaml.split('\n');
    let currentKey = null;

    for (const line of lines) {
      // Check for array item (starts with -)
      if (line.match(/^\s*-\s+/)) {
        if (currentKey && Array.isArray(result[currentKey])) {
          const value = line.replace(/^\s*-\s+/, '').replace(/^["']|["']$/g, '').trim();
          result[currentKey].push(value);
        }
        continue;
      }

      // Check for key: value
      const keyMatch = line.match(/^(\w[\w-]*)\s*:\s*(.*)/);
      if (keyMatch) {
        const [, key, value] = keyMatch;
        currentKey = key;

        // Check if it's an inline array like ["a", "b"]
        const inlineArray = value.match(/^\[(.*)\]$/);
        if (inlineArray) {
          result[key] = inlineArray[1]
            .split(',')
            .map(v => v.trim().replace(/^["']|["']$/g, ''))
            .filter(v => v);
        } else if (value.trim() === '') {
          // Empty value, might be followed by array items
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

/**
 * Check if a file should be included for the given use cases
 * based on its frontmatter `use-cases` and `exclude-from-use-cases` properties
 */
export function shouldIncludeForUseCases(filePath, targetUseCases) {
  const frontmatter = parseFrontmatter(filePath);

  // No frontmatter = include for all
  if (!frontmatter) {
    return true;
  }

  // Check exclude-from-use-cases first (takes precedence)
  const excludeUseCases = frontmatter['exclude-from-use-cases'];
  if (excludeUseCases) {
    const excludeList = Array.isArray(excludeUseCases) ? excludeUseCases : [excludeUseCases];
    // If any target use case is in the exclude list, don't include
    if (targetUseCases.some(uc => excludeList.includes(uc))) {
      return false;
    }
  }

  // Check use-cases (include list)
  const fileUseCases = frontmatter['use-cases'];
  if (!fileUseCases) {
    // No use-cases property = include for all (unless excluded above)
    return true;
  }

  // If use-cases is an array, check if any target use case is in it
  if (Array.isArray(fileUseCases)) {
    return targetUseCases.some(uc => fileUseCases.includes(uc));
  }

  // If it's a string, check direct match
  return targetUseCases.includes(fileUseCases);
}

/**
 * Parse JSONC (JSON with comments) content
 * Strips single-line, multi-line comments and trailing commas
 */
export function parseJsonc(content) {
  const jsonContent = content
    .replace(/\/\/.*$/gm, '')           // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')   // Remove multi-line comments
    .replace(/,(\s*[}\]])/g, '$1');     // Remove trailing commas
  return JSON.parse(jsonContent);
}

/**
 * Read and parse a JSONC file
 */
export function readJsoncFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  return parseJsonc(content);
}

/**
 * Format a file list for display
 */
export function formatFileList(files, prefix = '  ') {
  return files.map(f => `${prefix}${f}`).join('\n');
}

/**
 * Create a simple logger with verbose support
 */
export function createLogger(verbose = false) {
  return {
    info: (msg) => console.log(msg),
    verbose: (msg) => { if (verbose) console.log(msg); },
    warn: (msg) => console.warn(`Warning: ${msg}`),
    error: (msg) => console.error(`Error: ${msg}`),
    success: (msg) => console.log(`✓ ${msg}`)
  };
}

/**
 * Check if running in verbose mode (via flag or env var)
 */
export function isVerbose(options = {}) {
  return options.verbose || process.env.AMGR_VERBOSE === 'true';
}
