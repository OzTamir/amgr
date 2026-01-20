import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sourceAdd, sourceRemove, sourceList, sourceUpdate } from './source.js';
import {
  createTempDir,
  cleanupTempDir,
  createTestConfig,
  createTestProject,
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
  addGlobalSource: vi.fn(),
  removeGlobalSource: vi.fn(),
  getGlobalConfigPath: vi.fn(() => '~/.amgr/config.json'),
}));

import { confirm } from '@inquirer/prompts';
import { getGlobalSources, addGlobalSource, removeGlobalSource } from '../lib/global-config.js';

describe('source commands', () => {
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

  describe('sourceAdd', () => {
    it('fails when no project config exists and not global', async () => {
      await sourceAdd('/some/path');

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('No .amgr/config.json found')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('adds local source to project config', async () => {
      const repoDir = createTempDir();
      try {
        createTestRepo(repoDir, ['development']);
        createTestProject(tempDir, createTestConfig());

        await sourceAdd(repoDir);

        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining('Added source')
        );
      } finally {
        cleanupTempDir(repoDir);
      }
    });

    it('adds global source when --global flag is set', async () => {
      const repoDir = createTempDir();
      try {
        createTestRepo(repoDir, ['development']);

        await sourceAdd(repoDir, { global: true });

        expect(addGlobalSource).toHaveBeenCalled();
        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining('Added global source')
        );
      } finally {
        cleanupTempDir(repoDir);
      }
    });

    it('fails for invalid source path', async () => {
      createTestProject(tempDir, createTestConfig());

      await sourceAdd('/nonexistent/path/to/repo');

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Source validation failed')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('rejects duplicate sources', async () => {
      const repoDir = createTempDir();
      try {
        createTestRepo(repoDir, ['development']);
        createTestProject(tempDir, createTestConfig({
          sources: [{ type: 'local', path: repoDir }],
        }));

        await sourceAdd(repoDir);

        expect(consoleSpy.error).toHaveBeenCalledWith(
          expect.stringContaining('already configured')
        );
        expect(process.exit).toHaveBeenCalledWith(1);
      } finally {
        cleanupTempDir(repoDir);
      }
    });

    it('applies custom name to source', async () => {
      const repoDir = createTempDir();
      try {
        createTestRepo(repoDir, ['development']);
        createTestProject(tempDir, createTestConfig());

        await sourceAdd(repoDir, { name: 'my-custom-name' });

        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining('my-custom-name')
        );
      } finally {
        cleanupTempDir(repoDir);
      }
    });
  });

  describe('sourceRemove', () => {
    it('fails when no project config exists and not global', async () => {
      await sourceRemove('0');

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('No .amgr/config.json found')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('fails when no project sources configured', async () => {
      createTestProject(tempDir, createTestConfig());

      await sourceRemove('0');

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('No project sources configured')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('removes source by index with force flag', async () => {
      const repoDir = createTempDir();
      try {
        createTestRepo(repoDir, ['development']);
        createTestProject(tempDir, createTestConfig({
          sources: [{ type: 'local', path: repoDir }],
        }));

        await sourceRemove('0', { force: true });

        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining('Removed source')
        );
      } finally {
        cleanupTempDir(repoDir);
      }
    });

    it('prompts for confirmation without force flag', async () => {
      const repoDir = createTempDir();
      try {
        createTestRepo(repoDir, ['development']);
        createTestProject(tempDir, createTestConfig({
          sources: [{ type: 'local', path: repoDir }],
        }));

        vi.mocked(confirm).mockResolvedValue(false);

        await sourceRemove('0');

        expect(confirm).toHaveBeenCalled();
        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining('Aborted')
        );
      } finally {
        cleanupTempDir(repoDir);
      }
    });

    it('fails for invalid source index', async () => {
      const repoDir = createTempDir();
      try {
        createTestRepo(repoDir, ['development']);
        createTestProject(tempDir, createTestConfig({
          sources: [{ type: 'local', path: repoDir }],
        }));

        await sourceRemove('5', { force: true });

        expect(consoleSpy.error).toHaveBeenCalledWith(
          expect.stringContaining('Invalid source index')
        );
        expect(process.exit).toHaveBeenCalledWith(1);
      } finally {
        cleanupTempDir(repoDir);
      }
    });

    it('removes global source when --global flag is set', async () => {
      const repoDir = createTempDir();
      try {
        createTestRepo(repoDir, ['development']);
        vi.mocked(getGlobalSources).mockReturnValue([
          { type: 'local', path: repoDir },
        ]);

        await sourceRemove('0', { global: true, force: true });

        expect(removeGlobalSource).toHaveBeenCalledWith('0');
      } finally {
        cleanupTempDir(repoDir);
      }
    });

    it('fails when no global sources configured', async () => {
      vi.mocked(getGlobalSources).mockReturnValue([]);

      await sourceRemove('0', { global: true });

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('No global sources configured')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('sourceList', () => {
    it('shows message when no sources configured', async () => {
      await sourceList();

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('No sources configured')
      );
    });

    it('lists project sources', async () => {
      const repoDir = createTempDir();
      try {
        createTestRepo(repoDir, ['development']);
        createTestProject(tempDir, createTestConfig({
          sources: [{ type: 'local', path: repoDir }],
        }));

        await sourceList();

        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining('Project sources')
        );
      } finally {
        cleanupTempDir(repoDir);
      }
    });

    it('lists global sources with --global flag', async () => {
      const repoDir = createTempDir();
      try {
        createTestRepo(repoDir, ['development']);
        vi.mocked(getGlobalSources).mockReturnValue([
          { type: 'local', path: repoDir },
        ]);

        await sourceList({ global: true });

        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining('Global sources')
        );
      } finally {
        cleanupTempDir(repoDir);
      }
    });

    it('shows no global sources message with --global flag', async () => {
      vi.mocked(getGlobalSources).mockReturnValue([]);

      await sourceList({ global: true });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('No global sources configured')
      );
    });

    it('shows available use-cases from sources', async () => {
      const repoDir = createTempDir();
      try {
        createTestRepo(repoDir, ['development', 'writing']);
        createTestProject(tempDir, createTestConfig({
          sources: [{ type: 'local', path: repoDir }],
        }));

        await sourceList();

        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining('Available use-cases')
        );
        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining('development')
        );
      } finally {
        cleanupTempDir(repoDir);
      }
    });
  });

  describe('sourceUpdate', () => {
    it('shows message when no sources configured', async () => {
      await sourceUpdate();

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('No sources configured')
      );
    });

    it('validates local sources', async () => {
      const repoDir = createTempDir();
      try {
        createTestRepo(repoDir, ['development']);
        createTestProject(tempDir, createTestConfig({
          sources: [{ type: 'local', path: repoDir }],
        }));

        await sourceUpdate();

        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining('(local)')
        );
      } finally {
        cleanupTempDir(repoDir);
      }
    });

    it('updates only global sources with --global flag', async () => {
      vi.mocked(getGlobalSources).mockReturnValue([]);

      await sourceUpdate({ global: true });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('No global sources configured')
      );
    });

    it('reports errors for invalid sources', async () => {
      createTestProject(tempDir, createTestConfig({
        sources: [{ type: 'local', path: '/nonexistent/path' }],
      }));

      await sourceUpdate();

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('had errors')
      );
    });
  });
});
