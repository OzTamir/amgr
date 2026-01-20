import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import {
  getAvailableUseCases,
  getAvailableUseCasesFromSources,
  compose,
  generateRulesyncConfig,
  writeRulesyncConfig,
} from './compose.js';
import {
  createTempDir,
  cleanupTempDir,
  createTestRepo,
  createMockLogger,
  createTestFile,
} from '../test-utils.js';

describe('compose', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('getAvailableUseCases', () => {
    it('returns empty array when use-cases directory does not exist', () => {
      expect(getAvailableUseCases(tempDir)).toEqual([]);
    });

    it('returns list of use-case directories', () => {
      createTestRepo(tempDir, ['development', 'writing']);

      const useCases = getAvailableUseCases(tempDir);

      expect(useCases).toContain('development');
      expect(useCases).toContain('writing');
    });

    it('ignores files in use-cases directory', () => {
      createTestRepo(tempDir, ['development']);
      writeFileSync(join(tempDir, 'use-cases', 'readme.md'), 'content');

      const useCases = getAvailableUseCases(tempDir);

      expect(useCases).toEqual(['development']);
    });
  });

  describe('getAvailableUseCasesFromSources', () => {
    it('combines use-cases from multiple sources', () => {
      const source1 = createTempDir();
      const source2 = createTempDir();

      try {
        createTestRepo(source1, ['development']);
        createTestRepo(source2, ['writing']);

        const result = getAvailableUseCasesFromSources([source1, source2]);

        expect(result).toHaveProperty('development');
        expect(result).toHaveProperty('writing');
      } finally {
        cleanupTempDir(source1);
        cleanupTempDir(source2);
      }
    });

    it('tracks sources for each use-case', () => {
      const source1 = createTempDir();
      const source2 = createTempDir();

      try {
        createTestRepo(source1, ['shared-use-case']);
        createTestRepo(source2, ['shared-use-case']);

        const result = getAvailableUseCasesFromSources([source1, source2]);

        expect(result['shared-use-case']?.sources.length).toBe(2);
      } finally {
        cleanupTempDir(source1);
        cleanupTempDir(source2);
      }
    });
  });

  describe('compose', () => {
    it('creates output directory structure', () => {
      const sourceDir = createTempDir();
      const outputDir = join(tempDir, 'output');

      try {
        createTestRepo(sourceDir, ['development']);

        compose({
          sourcePaths: [sourceDir],
          useCases: ['development'],
          outputPath: outputDir,
        });

        expect(existsSync(join(outputDir, '.rulesync'))).toBe(true);
      } finally {
        cleanupTempDir(sourceDir);
      }
    });

    it('copies shared content', () => {
      const sourceDir = createTempDir();
      const outputDir = join(tempDir, 'output');

      try {
        createTestRepo(sourceDir, ['development']);
        createTestFile(
          join(sourceDir, 'shared', 'rules', 'base.md'),
          '# Base Rules'
        );

        compose({
          sourcePaths: [sourceDir],
          useCases: ['development'],
          outputPath: outputDir,
        });

        expect(existsSync(join(outputDir, '.rulesync', 'rules', 'base.md'))).toBe(true);
      } finally {
        cleanupTempDir(sourceDir);
      }
    });

    it('copies use-case specific content', () => {
      const sourceDir = createTempDir();
      const outputDir = join(tempDir, 'output');

      try {
        createTestRepo(sourceDir, ['development']);
        createTestFile(
          join(sourceDir, 'use-cases', 'development', '.rulesync', 'rules', 'dev.md'),
          '# Dev Rules'
        );

        compose({
          sourcePaths: [sourceDir],
          useCases: ['development'],
          outputPath: outputDir,
        });

        expect(existsSync(join(outputDir, '.rulesync', 'rules', 'dev.md'))).toBe(true);
      } finally {
        cleanupTempDir(sourceDir);
      }
    });

    it('throws when no sources provided', () => {
      const outputDir = join(tempDir, 'output');

      expect(() =>
        compose({
          useCases: ['development'],
          outputPath: outputDir,
        })
      ).toThrow('No source paths provided');
    });

    it('logs progress with logger', () => {
      const sourceDir = createTempDir();
      const outputDir = join(tempDir, 'output');
      const logger = createMockLogger();

      try {
        createTestRepo(sourceDir, ['development']);

        compose({
          sourcePaths: [sourceDir],
          useCases: ['development'],
          outputPath: outputDir,
          logger,
        });

        expect(logger.logs.verbose.some((m) => m.includes('Composing'))).toBe(true);
      } finally {
        cleanupTempDir(sourceDir);
      }
    });
  });

  describe('generateRulesyncConfig', () => {
    it('generates basic config', () => {
      const config = generateRulesyncConfig({
        useCases: ['development'],
        targets: ['claudecode'],
        features: ['rules'],
      });

      expect(config.targets).toEqual(['claudecode']);
      expect(config.features).toEqual(['rules']);
      expect(config.baseDirs).toEqual(['.']);
      expect(config.delete).toBe(true);
    });

    it('includes config options when provided', () => {
      const config = generateRulesyncConfig({
        useCases: ['development'],
        targets: ['claudecode'],
        features: ['rules'],
        configOptions: {
          simulateCommands: true,
          modularMcp: true,
        },
      });

      expect(config.simulateCommands).toBe(true);
      expect(config.modularMcp).toBe(true);
    });
  });

  describe('writeRulesyncConfig', () => {
    it('writes config to file', () => {
      const outputDir = join(tempDir, 'output');
      mkdirSync(outputDir, { recursive: true });

      const config = {
        $schema: 'https://example.com/schema.json',
        targets: ['claudecode'],
        features: ['rules'],
        baseDirs: ['.'],
        delete: true,
      };

      const configPath = writeRulesyncConfig(outputDir, config);

      expect(existsSync(configPath)).toBe(true);
      expect(configPath).toBe(join(outputDir, 'rulesync.jsonc'));
    });
  });
});
