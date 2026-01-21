import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sync } from './sync.js';
import {
  createTempDir,
  cleanupTempDir,
  createTestConfig,
  createTestProject,
  createTestRepo,
} from '../test-utils.js';

vi.mock('../lib/global-config.js', () => ({
  getGlobalSources: vi.fn(() => []),
  getGlobalConfig: vi.fn(() => ({ globalSources: [] })),
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

import { getGlobalSources } from '../lib/global-config.js';
import { execSync } from 'node:child_process';

describe('sync command', () => {
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
    vi.mocked(execSync).mockImplementation(() => Buffer.from(''));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanupTempDir(tempDir);
    vi.restoreAllMocks();
  });

  it('fails when no config exists', async () => {
    await sync();

    expect(consoleSpy.error).toHaveBeenCalledWith(
      expect.stringContaining('No .amgr/config.json found')
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('fails when no sources are configured', async () => {
    createTestProject(tempDir, createTestConfig({
      'use-cases': ['development'],
    }));

    await sync();

    expect(consoleSpy.error).toHaveBeenCalledWith(
      expect.stringContaining('No sources configured')
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('fails when no profiles are configured', async () => {
    const repoDir = createTempDir();
    try {
      createTestRepo(repoDir, ['development']);
      createTestProject(tempDir, createTestConfig({
        sources: [{ type: 'local', path: repoDir }],
        'use-cases': [],
      }));

      await sync();

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('must have at least one item')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    } finally {
      cleanupTempDir(repoDir);
    }
  });

  it('performs sync with valid configuration', async () => {
    const repoDir = createTempDir();
    try {
      createTestRepo(repoDir, ['development']);
      createTestProject(tempDir, createTestConfig({
        sources: [{ type: 'local', path: repoDir }],
        'use-cases': ['development'],
      }));

      await sync();

      expect(execSync).toHaveBeenCalledWith(
        'npx rulesync generate',
        expect.objectContaining({ cwd: expect.any(String) })
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Synced')
      );
    } finally {
      cleanupTempDir(repoDir);
    }
  });

  it('skips rulesync in dry-run mode', async () => {
    const repoDir = createTempDir();
    try {
      createTestRepo(repoDir, ['development']);
      createTestProject(tempDir, createTestConfig({
        sources: [{ type: 'local', path: repoDir }],
        'use-cases': ['development'],
      }));

      await sync({ dryRun: true });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('dry-run')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Dry run complete')
      );
    } finally {
      cleanupTempDir(repoDir);
    }
  });

  it('uses global sources when available', async () => {
    const repoDir = createTempDir();
    try {
      createTestRepo(repoDir, ['development']);
      vi.mocked(getGlobalSources).mockReturnValue([
        { type: 'local', path: repoDir },
      ]);
      createTestProject(tempDir, createTestConfig({
        'use-cases': ['development'],
      }));

      await sync();

      expect(execSync).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Synced')
      );
    } finally {
      cleanupTempDir(repoDir);
    }
  });

  it('handles rulesync execution failure', async () => {
    const repoDir = createTempDir();
    try {
      createTestRepo(repoDir, ['development']);
      createTestProject(tempDir, createTestConfig({
        sources: [{ type: 'local', path: repoDir }],
        'use-cases': ['development'],
      }));

      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('rulesync failed');
      });

      await sync();

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to run rulesync')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    } finally {
      cleanupTempDir(repoDir);
    }
  });

  it('handles multiple use-cases with different output directories', async () => {
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

      await sync({ dryRun: true });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('development')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('docs/')
      );
    } finally {
      cleanupTempDir(repoDir);
    }
  });

  it('shows verbose output when enabled', async () => {
    const repoDir = createTempDir();
    try {
      createTestRepo(repoDir, ['development']);
      createTestProject(tempDir, createTestConfig({
        sources: [{ type: 'local', path: repoDir }],
        'use-cases': ['development'],
      }));

      await sync({ verbose: true, dryRun: true });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Targets:')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Features:')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Profiles:')
      );
    } finally {
      cleanupTempDir(repoDir);
    }
  });

  it('does not delete tracked files before deploy by default', async () => {
    const repoDir = createTempDir();
    try {
      createTestRepo(repoDir, ['development']);
      createTestProject(tempDir, createTestConfig({
        sources: [{ type: 'local', path: repoDir }],
        'use-cases': ['development'],
      }));

      await sync();

      const logCalls = consoleSpy.log.mock.calls.map((c) => c[0]);
      const hasRemovingMessage = logCalls.some(
        (msg) =>
          typeof msg === 'string' && msg.includes('Removing previously tracked')
      );
      expect(hasRemovingMessage).toBe(false);
    } finally {
      cleanupTempDir(repoDir);
    }
  });

  it('deletes tracked files before deploy with --replace flag', async () => {
    const repoDir = createTempDir();
    try {
      createTestRepo(repoDir, ['development']);
      createTestProject(tempDir, createTestConfig({
        sources: [{ type: 'local', path: repoDir }],
        'use-cases': ['development'],
      }));

      await sync({ replace: true });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Synced')
      );
    } finally {
      cleanupTempDir(repoDir);
    }
  });
});
