import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { list } from './list.js';
import {
  createTempDir,
  cleanupTempDir,
  createTestConfig,
  createTestProject,
  createTestRepo,
} from '../test-utils.js';

// Mock global-config to isolate tests from user's real global sources
vi.mock('../lib/global-config.js', () => ({
  getGlobalSources: vi.fn(() => []),
  getGlobalConfig: vi.fn(() => ({ globalSources: [] })),
}));

describe('list command', () => {
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
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanupTempDir(tempDir);
    vi.restoreAllMocks();
  });

  it('shows message when no sources configured', async () => {
    await list();

    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('No sources configured')
    );
  });

  it('shows message when no sources but project exists', async () => {
    createTestProject(tempDir, createTestConfig());

    await list();

    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('No sources configured')
    );
  });

  it('lists profiles from local source', async () => {
    const repoDir = createTempDir();
    try {
      createTestRepo(repoDir, ['development', 'writing']);
      createTestProject(tempDir, createTestConfig({
        sources: [{ type: 'local', path: repoDir }],
      }));

      await list();

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Available profiles')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('development')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('writing')
      );
    } finally {
      cleanupTempDir(repoDir);
    }
  });

  it('shows currently selected use-cases', async () => {
    const repoDir = createTempDir();
    try {
      createTestRepo(repoDir, ['development']);
      createTestProject(tempDir, createTestConfig({
        sources: [{ type: 'local', path: repoDir }],
        'use-cases': ['development'],
      }));

      await list();

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Currently selected')
      );
    } finally {
      cleanupTempDir(repoDir);
    }
  });

  it('shows targets and features in verbose mode', async () => {
    const repoDir = createTempDir();
    try {
      createTestRepo(repoDir, ['development']);
      createTestProject(tempDir, createTestConfig({
        sources: [{ type: 'local', path: repoDir }],
      }));

      await list({ verbose: true });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Available targets')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Available features')
      );
    } finally {
      cleanupTempDir(repoDir);
    }
  });
});
