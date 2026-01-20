import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { configEdit } from './config.js';
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

import { confirm, input, checkbox, select } from '@inquirer/prompts';
import { getGlobalSources } from '../lib/global-config.js';

describe('config edit command', () => {
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

  it('fails when no config exists', async () => {
    await configEdit();

    expect(consoleSpy.error).toHaveBeenCalledWith(
      expect.stringContaining('No configuration found')
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('shows current configuration on start', async () => {
    createTestProject(tempDir, createTestConfig());
    vi.mocked(select).mockResolvedValue('done');

    await configEdit();

    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('Current configuration')
    );
    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('Targets:')
    );
  });

  it('saves no changes when user selects done immediately', async () => {
    createTestProject(tempDir, createTestConfig());
    vi.mocked(select).mockResolvedValue('done');

    await configEdit();

    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('No changes made')
    );
  });

  it('edits targets and saves changes', async () => {
    createTestProject(tempDir, createTestConfig({
      targets: ['claudecode'],
    }));

    vi.mocked(select)
      .mockResolvedValueOnce('targets')
      .mockResolvedValueOnce('done');

    vi.mocked(checkbox).mockResolvedValueOnce(['claudecode', 'cursor']);

    await configEdit();

    const config = JSON.parse(
      readFileSync(join(tempDir, '.amgr', 'config.json'), 'utf-8')
    );
    expect(config.targets).toContain('cursor');
    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('Saved')
    );
  });

  it('edits features and saves changes', async () => {
    createTestProject(tempDir, createTestConfig({
      features: ['rules'],
    }));

    vi.mocked(select)
      .mockResolvedValueOnce('features')
      .mockResolvedValueOnce('done');

    vi.mocked(checkbox).mockResolvedValueOnce(['rules', 'commands', 'skills']);

    await configEdit();

    const config = JSON.parse(
      readFileSync(join(tempDir, '.amgr', 'config.json'), 'utf-8')
    );
    expect(config.features).toContain('commands');
    expect(config.features).toContain('skills');
  });

  it('edits use-cases with available sources', async () => {
    const repoDir = createTempDir();
    try {
      createTestRepo(repoDir, ['development', 'writing']);
      createTestProject(tempDir, createTestConfig({
        sources: [{ type: 'local', path: repoDir }],
        'use-cases': ['development'],
      }));

      vi.mocked(select)
        .mockResolvedValueOnce('use-cases')
        .mockResolvedValueOnce('done');

      vi.mocked(checkbox).mockResolvedValueOnce(['development', 'writing']);

      await configEdit();

      const config = JSON.parse(
        readFileSync(join(tempDir, '.amgr', 'config.json'), 'utf-8')
      );
      expect(config['use-cases']).toContain('writing');
    } finally {
      cleanupTempDir(repoDir);
    }
  });

  it('warns when editing use-cases with no sources', async () => {
    createTestProject(tempDir, createTestConfig({
      'use-cases': ['development'],
    }));

    vi.mocked(select)
      .mockResolvedValueOnce('use-cases')
      .mockResolvedValueOnce('done');

    await configEdit();

    expect(consoleSpy.warn).toHaveBeenCalledWith(
      expect.stringContaining('No sources configured')
    );
  });

  it('edits output directories', async () => {
    const repoDir = createTempDir();
    try {
      createTestRepo(repoDir, ['development', 'writing']);
      createTestProject(tempDir, createTestConfig({
        sources: [{ type: 'local', path: repoDir }],
        'use-cases': ['development', 'writing'],
      }));

      vi.mocked(select)
        .mockResolvedValueOnce('outputDirs')
        .mockResolvedValueOnce('done');

      vi.mocked(input)
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('docs/');

      await configEdit();

      const config = JSON.parse(
        readFileSync(join(tempDir, '.amgr', 'config.json'), 'utf-8')
      );
      expect(config.outputDirs).toBeDefined();
      expect(config.outputDirs.writing).toBe('docs/');
    } finally {
      cleanupTempDir(repoDir);
    }
  });

  it('edits options', async () => {
    createTestProject(tempDir, createTestConfig());

    vi.mocked(select)
      .mockResolvedValueOnce('options')
      .mockResolvedValueOnce('done');

    vi.mocked(confirm)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await configEdit();

    const config = JSON.parse(
      readFileSync(join(tempDir, '.amgr', 'config.json'), 'utf-8')
    );
    expect(config.options).toBeDefined();
    expect(config.options.simulateCommands).toBe(true);
    expect(config.options.modularMcp).toBe(true);
  });

  it('removes outputDirs for deselected use-cases', async () => {
    const repoDir = createTempDir();
    try {
      createTestRepo(repoDir, ['development', 'writing']);
      createTestProject(tempDir, createTestConfig({
        sources: [{ type: 'local', path: repoDir }],
        'use-cases': ['development', 'writing'],
        outputDirs: {
          writing: 'docs/',
        },
      }));

      vi.mocked(select)
        .mockResolvedValueOnce('use-cases')
        .mockResolvedValueOnce('done');

      vi.mocked(checkbox).mockResolvedValueOnce(['development']);

      await configEdit();

      const config = JSON.parse(
        readFileSync(join(tempDir, '.amgr', 'config.json'), 'utf-8')
      );
      expect(config.outputDirs).toBeUndefined();
    } finally {
      cleanupTempDir(repoDir);
    }
  });

  it('handles multiple edit cycles', async () => {
    createTestProject(tempDir, createTestConfig({
      targets: ['claudecode'],
      features: ['rules'],
    }));

    vi.mocked(select)
      .mockResolvedValueOnce('targets')
      .mockResolvedValueOnce('features')
      .mockResolvedValueOnce('done');

    vi.mocked(checkbox)
      .mockResolvedValueOnce(['claudecode', 'cursor'])
      .mockResolvedValueOnce(['rules', 'commands']);

    await configEdit();

    const config = JSON.parse(
      readFileSync(join(tempDir, '.amgr', 'config.json'), 'utf-8')
    );
    expect(config.targets).toContain('cursor');
    expect(config.features).toContain('commands');
  });

  it('handles prompt cancellation gracefully', async () => {
    createTestProject(tempDir, createTestConfig());

    const exitError = new Error('User cancelled');
    exitError.name = 'ExitPromptError';
    vi.mocked(select).mockRejectedValue(exitError);

    await configEdit();

    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('Aborted')
    );
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('shows updated configuration after each edit', async () => {
    createTestProject(tempDir, createTestConfig({
      targets: ['claudecode'],
    }));

    vi.mocked(select)
      .mockResolvedValueOnce('targets')
      .mockResolvedValueOnce('done');

    vi.mocked(checkbox).mockResolvedValueOnce(['claudecode', 'cursor']);

    await configEdit();

    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('Updated configuration')
    );
  });
});
