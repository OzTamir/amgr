import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import {
  parseFrontmatter,
  shouldIncludeForUseCases,
  shouldIncludeForProfiles,
  validateFrontmatterScope,
  parseJsonc,
  readJsoncFile,
  formatFileList,
  createLogger,
  isVerbose,
  isCloudSyncedPath,
  type FilterContext,
} from './utils.js';
import {
  createTempDir,
  cleanupTempDir,
  createTestFile,
} from '../test-utils.js';

describe('utils', () => {
  describe('parseFrontmatter', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = createTempDir();
    });

    afterEach(() => {
      cleanupTempDir(tempDir);
    });

    it('parses valid YAML frontmatter with string values', () => {
      const filePath = join(tempDir, 'test.md');
      createTestFile(
        filePath,
        `---
title: Test Document
author: John Doe
---
# Content here`
      );

      const result = parseFrontmatter(filePath);
      expect(result).toEqual({
        title: 'Test Document',
        author: 'John Doe',
      });
    });

    it('parses array values in block format', () => {
      const filePath = join(tempDir, 'test.md');
      createTestFile(
        filePath,
        `---
use-cases:
  - development
  - writing
---
Content`
      );

      const result = parseFrontmatter(filePath);
      expect(result).toEqual({
        'use-cases': ['development', 'writing'],
      });
    });

    it('parses inline array format', () => {
      const filePath = join(tempDir, 'test.md');
      createTestFile(
        filePath,
        `---
use-cases: [development, writing]
---
Content`
      );

      const result = parseFrontmatter(filePath);
      expect(result).toEqual({
        'use-cases': ['development', 'writing'],
      });
    });

    it('strips quotes from values', () => {
      const filePath = join(tempDir, 'test.md');
      createTestFile(
        filePath,
        `---
title: "Quoted Value"
tags: ['tag1', "tag2"]
---
Content`
      );

      const result = parseFrontmatter(filePath);
      expect(result).toEqual({
        title: 'Quoted Value',
        tags: ['tag1', 'tag2'],
      });
    });

    it('returns null for file without frontmatter', () => {
      const filePath = join(tempDir, 'test.md');
      createTestFile(filePath, '# Just a heading\n\nSome content');

      const result = parseFrontmatter(filePath);
      expect(result).toBeNull();
    });

    it('returns null for non-existent file', () => {
      const result = parseFrontmatter(join(tempDir, 'nonexistent.md'));
      expect(result).toBeNull();
    });

    it('handles empty frontmatter values as empty arrays', () => {
      const filePath = join(tempDir, 'test.md');
      createTestFile(
        filePath,
        `---
tags:
---
Content`
      );

      const result = parseFrontmatter(filePath);
      expect(result).toEqual({ tags: [] });
    });
  });

  describe('shouldIncludeForUseCases', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = createTempDir();
    });

    afterEach(() => {
      cleanupTempDir(tempDir);
    });

    it('includes file when no frontmatter present', () => {
      const filePath = join(tempDir, 'test.md');
      createTestFile(filePath, '# No frontmatter');

      expect(shouldIncludeForUseCases(filePath, ['development'])).toBe(true);
    });

    it('includes file when use-cases match', () => {
      const filePath = join(tempDir, 'test.md');
      createTestFile(
        filePath,
        `---
use-cases: [development, writing]
---
Content`
      );

      expect(shouldIncludeForUseCases(filePath, ['development'])).toBe(true);
      expect(shouldIncludeForUseCases(filePath, ['writing'])).toBe(true);
    });

    it('excludes file when use-cases do not match', () => {
      const filePath = join(tempDir, 'test.md');
      createTestFile(
        filePath,
        `---
use-cases: [development]
---
Content`
      );

      expect(shouldIncludeForUseCases(filePath, ['writing'])).toBe(false);
    });

    it('excludes file when in exclude-from-use-cases', () => {
      const filePath = join(tempDir, 'test.md');
      createTestFile(
        filePath,
        `---
exclude-from-use-cases: [development]
---
Content`
      );

      expect(shouldIncludeForUseCases(filePath, ['development'])).toBe(false);
      expect(shouldIncludeForUseCases(filePath, ['writing'])).toBe(true);
    });

    it('handles string value for use-cases (not array)', () => {
      const filePath = join(tempDir, 'test.md');
      createTestFile(
        filePath,
        `---
use-cases: development
---
Content`
      );

      expect(shouldIncludeForUseCases(filePath, ['development'])).toBe(true);
      expect(shouldIncludeForUseCases(filePath, ['writing'])).toBe(false);
    });

    it('handles string value for exclude-from-use-cases', () => {
      const filePath = join(tempDir, 'test.md');
      createTestFile(
        filePath,
        `---
exclude-from-use-cases: development
---
Content`
      );

      expect(shouldIncludeForUseCases(filePath, ['development'])).toBe(false);
    });
  });

  describe('shouldIncludeForProfiles', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = createTempDir();
    });

    afterEach(() => {
      cleanupTempDir(tempDir);
    });

    describe('global scope (/shared/)', () => {
      it('includes file when no frontmatter present', () => {
        const filePath = join(tempDir, 'test.md');
        createTestFile(filePath, '# No frontmatter');

        const context: FilterContext = {
          targetProfiles: ['development:frontend'],
          currentScope: 'global',
        };
        expect(shouldIncludeForProfiles(filePath, context)).toBe(true);
      });

      it('includes file when profiles match exactly', () => {
        const filePath = join(tempDir, 'test.md');
        createTestFile(
          filePath,
          `---
profiles: [development:frontend]
---
Content`
        );

        const context: FilterContext = {
          targetProfiles: ['development:frontend'],
          currentScope: 'global',
        };
        expect(shouldIncludeForProfiles(filePath, context)).toBe(true);
      });

      it('includes file when parent profile matches nested target', () => {
        const filePath = join(tempDir, 'test.md');
        createTestFile(
          filePath,
          `---
profiles: [development]
---
Content`
        );

        const context: FilterContext = {
          targetProfiles: ['development:frontend'],
          currentScope: 'global',
        };
        expect(shouldIncludeForProfiles(filePath, context)).toBe(true);
      });

      it('excludes file when profiles do not match', () => {
        const filePath = join(tempDir, 'test.md');
        createTestFile(
          filePath,
          `---
profiles: [writing]
---
Content`
        );

        const context: FilterContext = {
          targetProfiles: ['development:frontend'],
          currentScope: 'global',
        };
        expect(shouldIncludeForProfiles(filePath, context)).toBe(false);
      });

      it('supports legacy use-cases key', () => {
        const filePath = join(tempDir, 'test.md');
        createTestFile(
          filePath,
          `---
use-cases: [development]
---
Content`
        );

        const context: FilterContext = {
          targetProfiles: ['development:frontend'],
          currentScope: 'global',
        };
        expect(shouldIncludeForProfiles(filePath, context)).toBe(true);
      });

      it('excludes file via exclude-from-profiles', () => {
        const filePath = join(tempDir, 'test.md');
        createTestFile(
          filePath,
          `---
exclude-from-profiles: [development]
---
Content`
        );

        const context: FilterContext = {
          targetProfiles: ['development:frontend'],
          currentScope: 'global',
        };
        expect(shouldIncludeForProfiles(filePath, context)).toBe(false);
      });

      it('supports legacy exclude-from-use-cases key', () => {
        const filePath = join(tempDir, 'test.md');
        createTestFile(
          filePath,
          `---
exclude-from-use-cases: [development]
---
Content`
        );

        const context: FilterContext = {
          targetProfiles: ['development:frontend'],
          currentScope: 'global',
        };
        expect(shouldIncludeForProfiles(filePath, context)).toBe(false);
      });
    });

    describe('parent scope (/parent/_shared/)', () => {
      it('includes file when sub-profile matches', () => {
        const filePath = join(tempDir, 'test.md');
        createTestFile(
          filePath,
          `---
profiles: [frontend]
---
Content`
        );

        const context: FilterContext = {
          targetProfiles: ['development:frontend'],
          currentScope: 'development',
        };
        expect(shouldIncludeForProfiles(filePath, context)).toBe(true);
      });

      it('excludes file when sub-profile does not match', () => {
        const filePath = join(tempDir, 'test.md');
        createTestFile(
          filePath,
          `---
profiles: [backend]
---
Content`
        );

        const context: FilterContext = {
          targetProfiles: ['development:frontend'],
          currentScope: 'development',
        };
        expect(shouldIncludeForProfiles(filePath, context)).toBe(false);
      });

      it('excludes file when scope parent does not match', () => {
        const filePath = join(tempDir, 'test.md');
        createTestFile(
          filePath,
          `---
profiles: [frontend]
---
Content`
        );

        const context: FilterContext = {
          targetProfiles: ['development:frontend'],
          currentScope: 'writing',
        };
        expect(shouldIncludeForProfiles(filePath, context)).toBe(false);
      });

      it('excludes file with full profile spec in scoped context', () => {
        const filePath = join(tempDir, 'test.md');
        createTestFile(
          filePath,
          `---
profiles: [development:frontend]
---
Content`
        );

        const context: FilterContext = {
          targetProfiles: ['development:frontend'],
          currentScope: 'development',
        };
        expect(shouldIncludeForProfiles(filePath, context)).toBe(false);
      });

      it('handles multiple sub-profiles', () => {
        const filePath = join(tempDir, 'test.md');
        createTestFile(
          filePath,
          `---
profiles: [frontend, backend]
---
Content`
        );

        const frontendContext: FilterContext = {
          targetProfiles: ['development:frontend'],
          currentScope: 'development',
        };
        const backendContext: FilterContext = {
          targetProfiles: ['development:backend'],
          currentScope: 'development',
        };
        expect(shouldIncludeForProfiles(filePath, frontendContext)).toBe(true);
        expect(shouldIncludeForProfiles(filePath, backendContext)).toBe(true);
      });
    });

    describe('flat profiles', () => {
      it('matches flat profile in global scope', () => {
        const filePath = join(tempDir, 'test.md');
        createTestFile(
          filePath,
          `---
profiles: [writing]
---
Content`
        );

        const context: FilterContext = {
          targetProfiles: ['writing'],
          currentScope: 'global',
        };
        expect(shouldIncludeForProfiles(filePath, context)).toBe(true);
      });

      it('excludes flat profile when targeting different profile', () => {
        const filePath = join(tempDir, 'test.md');
        createTestFile(
          filePath,
          `---
profiles: [writing]
---
Content`
        );

        const context: FilterContext = {
          targetProfiles: ['development'],
          currentScope: 'global',
        };
        expect(shouldIncludeForProfiles(filePath, context)).toBe(false);
      });
    });
  });

  describe('validateFrontmatterScope', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = createTempDir();
    });

    afterEach(() => {
      cleanupTempDir(tempDir);
    });

    it('returns valid for global scope', () => {
      const filePath = join(tempDir, 'test.md');
      createTestFile(
        filePath,
        `---
profiles: [development:frontend, writing]
---
Content`
      );

      const result = validateFrontmatterScope(filePath, 'global', []);
      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual([]);
    });

    it('returns valid for file without frontmatter', () => {
      const filePath = join(tempDir, 'test.md');
      createTestFile(filePath, '# No frontmatter');

      const result = validateFrontmatterScope(filePath, 'development', ['frontend', 'backend']);
      expect(result.valid).toBe(true);
    });

    it('returns valid for correct sub-profile references', () => {
      const filePath = join(tempDir, 'test.md');
      createTestFile(
        filePath,
        `---
profiles: [frontend, backend]
---
Content`
      );

      const result = validateFrontmatterScope(filePath, 'development', ['frontend', 'backend']);
      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual([]);
    });

    it('warns when using full profile spec in scoped context', () => {
      const filePath = join(tempDir, 'test.md');
      createTestFile(
        filePath,
        `---
profiles: [development:frontend]
---
Content`
      );

      const result = validateFrontmatterScope(filePath, 'development', ['frontend', 'backend']);
      expect(result.valid).toBe(false);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]).toContain('full profile spec');
    });

    it('warns when referencing profile outside scope', () => {
      const filePath = join(tempDir, 'test.md');
      createTestFile(
        filePath,
        `---
profiles: [writing]
---
Content`
      );

      const result = validateFrontmatterScope(filePath, 'development', ['frontend', 'backend']);
      expect(result.valid).toBe(false);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]).toContain('outside of "development" scope');
    });

    it('collects multiple warnings', () => {
      const filePath = join(tempDir, 'test.md');
      createTestFile(
        filePath,
        `---
profiles: [development:frontend, writing]
---
Content`
      );

      const result = validateFrontmatterScope(filePath, 'development', ['frontend', 'backend']);
      expect(result.valid).toBe(false);
      expect(result.warnings.length).toBe(2);
    });
  });

  describe('parseJsonc', () => {
    it('parses valid JSON', () => {
      const result = parseJsonc('{"key": "value"}');
      expect(result).toEqual({ key: 'value' });
    });

    it('removes single-line comments', () => {
      const jsonc = `{
        // This is a comment
        "key": "value"
      }`;
      const result = parseJsonc(jsonc);
      expect(result).toEqual({ key: 'value' });
    });

    it('removes multi-line comments', () => {
      const jsonc = `{
        /* This is a
           multi-line comment */
        "key": "value"
      }`;
      const result = parseJsonc(jsonc);
      expect(result).toEqual({ key: 'value' });
    });

    it('handles trailing commas', () => {
      const jsonc = `{
        "key": "value",
        "array": [1, 2, 3,],
      }`;
      const result = parseJsonc(jsonc);
      expect(result).toEqual({ key: 'value', array: [1, 2, 3] });
    });

    it('throws on invalid JSON', () => {
      expect(() => parseJsonc('not json')).toThrow();
    });
  });

  describe('readJsoncFile', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = createTempDir();
    });

    afterEach(() => {
      cleanupTempDir(tempDir);
    });

    it('reads and parses JSONC file', () => {
      const filePath = join(tempDir, 'config.jsonc');
      createTestFile(
        filePath,
        `{
        // Comment
        "key": "value",
      }`
      );

      const result = readJsoncFile(filePath);
      expect(result).toEqual({ key: 'value' });
    });
  });

  describe('formatFileList', () => {
    it('formats empty list', () => {
      expect(formatFileList([])).toBe('');
    });

    it('formats single file with default prefix', () => {
      expect(formatFileList(['file.txt'])).toBe('  file.txt');
    });

    it('formats multiple files with default prefix', () => {
      expect(formatFileList(['file1.txt', 'file2.txt'])).toBe(
        '  file1.txt\n  file2.txt'
      );
    });

    it('uses custom prefix', () => {
      expect(formatFileList(['file.txt'], '-> ')).toBe('-> file.txt');
    });
  });

  describe('createLogger', () => {
    let consoleSpy: {
      log: ReturnType<typeof vi.spyOn>;
      warn: ReturnType<typeof vi.spyOn>;
      error: ReturnType<typeof vi.spyOn>;
    };

    beforeEach(() => {
      consoleSpy = {
        log: vi.spyOn(console, 'log').mockImplementation(() => {}),
        warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
        error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      };
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('logs info messages', () => {
      const logger = createLogger();
      logger.info('test message');
      expect(consoleSpy.log).toHaveBeenCalledWith('test message');
    });

    it('logs success messages with checkmark', () => {
      const logger = createLogger();
      logger.success('done');
      expect(consoleSpy.log).toHaveBeenCalledWith('✓ done');
    });

    it('logs warning messages', () => {
      const logger = createLogger();
      logger.warn('warning');
      expect(consoleSpy.warn).toHaveBeenCalledWith('Warning: warning');
    });

    it('logs error messages', () => {
      const logger = createLogger();
      logger.error('error');
      expect(consoleSpy.error).toHaveBeenCalledWith('Error: error');
    });

    it('suppresses verbose messages when verbose=false', () => {
      const logger = createLogger(false);
      logger.verbose('verbose message');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('logs verbose messages when verbose=true', () => {
      const logger = createLogger(true);
      logger.verbose('verbose message');
      expect(consoleSpy.log).toHaveBeenCalledWith('verbose message');
    });
  });

  describe('isVerbose', () => {
    const originalEnv = process.env['AMGR_VERBOSE'];

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env['AMGR_VERBOSE'];
      } else {
        process.env['AMGR_VERBOSE'] = originalEnv;
      }
    });

    it('returns false by default', () => {
      delete process.env['AMGR_VERBOSE'];
      expect(isVerbose()).toBe(false);
    });

    it('returns true when options.verbose is true', () => {
      expect(isVerbose({ verbose: true })).toBe(true);
    });

    it('returns true when AMGR_VERBOSE env var is "true"', () => {
      process.env['AMGR_VERBOSE'] = 'true';
      expect(isVerbose()).toBe(true);
    });

    it('returns false when AMGR_VERBOSE is other values', () => {
      process.env['AMGR_VERBOSE'] = 'false';
      expect(isVerbose()).toBe(false);

      process.env['AMGR_VERBOSE'] = '1';
      expect(isVerbose()).toBe(false);
    });
  });

  describe('isCloudSyncedPath', () => {
    it.each([
      {
        path: '/Users/test/Library/Mobile Documents/iCloud~md~obsidian/Documents/vault',
        expected: 'icloud',
        description: 'iCloud path',
      },
      {
        path: '/Users/test/Dropbox/projects/my-project',
        expected: 'dropbox',
        description: 'Dropbox path',
      },
      {
        path: '/Users/test/OneDrive/Documents/work',
        expected: 'onedrive',
        description: 'OneDrive path',
      },
      {
        path: '/Users/test/Library/CloudStorage/OneDrive-Personal/Documents',
        expected: 'onedrive',
        description: 'OneDrive CloudStorage path',
      },
      {
        path: '/Users/test/Code/my-project',
        expected: null,
        description: 'regular path',
      },
      {
        path: '/home/user/projects/app',
        expected: null,
        description: 'Linux path',
      },
    ] as const)('returns $expected for $description', ({ path, expected }) => {
      expect(isCloudSyncedPath(path)).toBe(expected);
    });
  });
});
