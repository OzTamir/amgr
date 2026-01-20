import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { init } from './init.js';
import {
  createTempDir,
  cleanupTempDir,
  createTestProject,
  createTestConfig,
  createTestRepo,
} from '../test-utils.js';

vi.mock('@inquirer/prompts', () => ({
  confirm: vi.fn(),
  input: vi.fn(),
  checkbox: vi.fn(),
  select: vi.fn(),
}));

vi.mock('../lib/global-config.js', () => ({
  getGlobalSources: vi.fn(() => []),
  getGlobalConfig: vi.fn(() => ({ globalSources: [] })),
}));

import { confirm, input, checkbox } from '@inquirer/prompts';
import { getGlobalSources } from '../lib/global-config.js';

describe('init command', () => {
  let tempDir: string;
  let originalCwd: string;
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    tempDir = createTempDir();
    originalCwd = process.cwd();
    process.chdir(tempDir);

    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.mocked(getGlobalSources).mockReturnValue([]);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanupTempDir(tempDir);
    vi.restoreAllMocks();
  });

  it('prompts to overwrite existing config', async () => {
    createTestProject(tempDir, createTestConfig());

    vi.mocked(confirm).mockResolvedValue(false);

    await init();

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('already exists'),
      })
    );
    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('Aborted')
    );
  });

  it('creates config when no sources exist and user provides one', async () => {
    const repoDir = createTempDir();
    try {
      createTestRepo(repoDir, ['development']);

      let inputCallCount = 0;
      vi.mocked(input).mockImplementation(async () => {
        inputCallCount++;
        if (inputCallCount === 1) return repoDir;
        return '';
      });

      vi.mocked(checkbox)
        .mockResolvedValueOnce(['claudecode'])
        .mockResolvedValueOnce(['rules'])
        .mockResolvedValueOnce(['development']);

      vi.mocked(confirm)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);

      await init();

      expect(existsSync(join(tempDir, '.amgr', 'config.json'))).toBe(true);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Created')
      );
    } finally {
      cleanupTempDir(repoDir);
    }
  });

  it('uses global sources without prompting for project sources', async () => {
    const repoDir = createTempDir();
    try {
      createTestRepo(repoDir, ['development']);
      vi.mocked(getGlobalSources).mockReturnValue([
        { type: 'local', path: repoDir },
      ]);

      vi.mocked(confirm)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);

      vi.mocked(checkbox)
        .mockResolvedValueOnce(['claudecode'])
        .mockResolvedValueOnce(['rules'])
        .mockResolvedValueOnce(['development']);

      await init();

      expect(existsSync(join(tempDir, '.amgr', 'config.json'))).toBe(true);
      
      const config = JSON.parse(
        readFileSync(join(tempDir, '.amgr', 'config.json'), 'utf-8')
      );
      expect(config.sources).toBeUndefined();
    } finally {
      cleanupTempDir(repoDir);
    }
  });

  it('allows adding project sources when global sources exist', async () => {
    const globalRepoDir = createTempDir();
    const projectRepoDir = createTempDir();
    try {
      createTestRepo(globalRepoDir, ['development']);
      createTestRepo(projectRepoDir, ['writing']);
      vi.mocked(getGlobalSources).mockReturnValue([
        { type: 'local', path: globalRepoDir },
      ]);

      vi.mocked(confirm)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);

      let inputCallCount = 0;
      vi.mocked(input).mockImplementation(async () => {
        inputCallCount++;
        if (inputCallCount === 1) return projectRepoDir;
        return '';
      });

      vi.mocked(checkbox)
        .mockResolvedValueOnce(['claudecode'])
        .mockResolvedValueOnce(['rules'])
        .mockResolvedValueOnce(['development', 'writing']);

      await init();

      const config = JSON.parse(
        readFileSync(join(tempDir, '.amgr', 'config.json'), 'utf-8')
      );
      expect(config.sources).toBeDefined();
      expect(config.sources.length).toBe(1);
    } finally {
      cleanupTempDir(globalRepoDir);
      cleanupTempDir(projectRepoDir);
    }
  });

  it('fails when no targets selected', async () => {
    const repoDir = createTempDir();
    try {
      createTestRepo(repoDir, ['development']);
      vi.mocked(getGlobalSources).mockReturnValue([
        { type: 'local', path: repoDir },
      ]);

      vi.mocked(confirm).mockResolvedValue(false);
      vi.mocked(checkbox).mockResolvedValueOnce([]);

      await init();

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('At least one target is required')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    } finally {
      cleanupTempDir(repoDir);
    }
  });

  it('fails when no features selected', async () => {
    const repoDir = createTempDir();
    try {
      createTestRepo(repoDir, ['development']);
      vi.mocked(getGlobalSources).mockReturnValue([
        { type: 'local', path: repoDir },
      ]);

      vi.mocked(confirm).mockResolvedValue(false);
      vi.mocked(checkbox)
        .mockResolvedValueOnce(['claudecode'])
        .mockResolvedValueOnce([]);

      await init();

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('At least one feature is required')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    } finally {
      cleanupTempDir(repoDir);
    }
  });

  it('fails when no use-cases selected', async () => {
    const repoDir = createTempDir();
    try {
      createTestRepo(repoDir, ['development']);
      vi.mocked(getGlobalSources).mockReturnValue([
        { type: 'local', path: repoDir },
      ]);

      vi.mocked(confirm).mockResolvedValue(false);
      vi.mocked(checkbox)
        .mockResolvedValueOnce(['claudecode'])
        .mockResolvedValueOnce(['rules'])
        .mockResolvedValueOnce([]);

      await init();

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('At least one use-case is required')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    } finally {
      cleanupTempDir(repoDir);
    }
  });

  it('configures output directories when requested', async () => {
    const repoDir = createTempDir();
    try {
      createTestRepo(repoDir, ['development', 'writing']);
      vi.mocked(getGlobalSources).mockReturnValue([
        { type: 'local', path: repoDir },
      ]);

      vi.mocked(confirm)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      vi.mocked(checkbox)
        .mockResolvedValueOnce(['claudecode'])
        .mockResolvedValueOnce(['rules'])
        .mockResolvedValueOnce(['development', 'writing']);

      vi.mocked(input)
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('docs/');

      await init();

      const config = JSON.parse(
        readFileSync(join(tempDir, '.amgr', 'config.json'), 'utf-8')
      );
      expect(config.outputDirs).toBeDefined();
      expect(config.outputDirs.writing).toBe('docs/');
    } finally {
      cleanupTempDir(repoDir);
    }
  });

  it('configures advanced options when requested', async () => {
    const repoDir = createTempDir();
    try {
      createTestRepo(repoDir, ['development']);
      vi.mocked(getGlobalSources).mockReturnValue([
        { type: 'local', path: repoDir },
      ]);

      vi.mocked(confirm)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      vi.mocked(checkbox)
        .mockResolvedValueOnce(['claudecode'])
        .mockResolvedValueOnce(['rules'])
        .mockResolvedValueOnce(['development']);

      await init();

      const config = JSON.parse(
        readFileSync(join(tempDir, '.amgr', 'config.json'), 'utf-8')
      );
      expect(config.options).toBeDefined();
      expect(config.options.simulateCommands).toBe(true);
      expect(config.options.modularMcp).toBe(true);
    } finally {
      cleanupTempDir(repoDir);
    }
  });

  it('handles prompt cancellation gracefully', async () => {
    const repoDir = createTempDir();
    try {
      createTestRepo(repoDir, ['development']);
      vi.mocked(getGlobalSources).mockReturnValue([
        { type: 'local', path: repoDir },
      ]);

      const exitError = new Error('User cancelled');
      exitError.name = 'ExitPromptError';
      vi.mocked(confirm).mockRejectedValue(exitError);

      await init();

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Aborted')
      );
      expect(process.exit).not.toHaveBeenCalled();
    } finally {
      cleanupTempDir(repoDir);
    }
  });
});
