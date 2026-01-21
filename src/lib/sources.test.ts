import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  detectSourceType,
  parseSource,
  normalizeGitUrl,
  expandPath,
  isValidAmgrRepo,
  getGitCachePath,
  validateSources,
  formatRelativeTime,
  getMergedSources,
  getSourceDisplayName,
  resolveSource,
  getSourceUseCases,
  getCombinedUseCases,
  AMGR_CACHE_DIR,
  parseProfileSpec,
  isNestedProfile,
  getSubProfiles,
  expandProfiles,
} from './sources.js';
import { SOURCE_TYPE } from '../types/sources.js';
import type { ResolvedSource } from '../types/sources.js';
import {
  createTempDir,
  cleanupTempDir,
  createTestConfig,
  createTestRepo,
} from '../test-utils.js';

describe('sources', () => {
  describe('detectSourceType', () => {
    it.each([
      { input: 'https://github.com/user/repo', expected: SOURCE_TYPE.GIT },
      { input: 'http://github.com/user/repo', expected: SOURCE_TYPE.GIT },
      { input: 'git@github.com:user/repo.git', expected: SOURCE_TYPE.GIT },
      { input: 'git://github.com/user/repo', expected: SOURCE_TYPE.GIT },
      { input: 'https://github.com/user/repo.git', expected: SOURCE_TYPE.GIT },
      { input: '/path/to/local', expected: SOURCE_TYPE.LOCAL },
      { input: './relative/path', expected: SOURCE_TYPE.LOCAL },
      { input: '~/home/path', expected: SOURCE_TYPE.LOCAL },
    ] as const)('detects "$input" as $expected', ({ input, expected }) => {
      expect(detectSourceType(input)).toBe(expected);
    });
  });

  describe('parseSource', () => {
    it('parses string URL as git source', () => {
      const result = parseSource('https://github.com/user/repo');
      expect(result).toEqual({
        type: SOURCE_TYPE.GIT,
        url: 'https://github.com/user/repo',
      });
    });

    it('parses string path as local source', () => {
      const result = parseSource('/path/to/local');
      expect(result).toEqual({
        type: SOURCE_TYPE.LOCAL,
        path: '/path/to/local',
      });
    });

    it('parses git source object', () => {
      const result = parseSource({
        type: 'git',
        url: 'https://github.com/user/repo',
        name: 'my-repo',
      });
      expect(result).toEqual({
        type: SOURCE_TYPE.GIT,
        url: 'https://github.com/user/repo',
        name: 'my-repo',
      });
    });

    it('parses local source object', () => {
      const result = parseSource({
        type: 'local',
        path: '/path/to/local',
        name: 'local-repo',
      });
      expect(result).toEqual({
        type: SOURCE_TYPE.LOCAL,
        path: '/path/to/local',
        name: 'local-repo',
      });
    });

    it('throws for git source without url', () => {
      expect(() => parseSource({ type: 'git' } as never)).toThrow(
        'Git source must have a url'
      );
    });

    it('throws for local source without path', () => {
      expect(() => parseSource({ type: 'local' } as never)).toThrow(
        'Local source must have a path'
      );
    });

    it('throws for invalid source type', () => {
      expect(() => parseSource({ type: 'invalid' } as never)).toThrow(
        'Invalid source type'
      );
    });
  });

  describe('normalizeGitUrl', () => {
    it.each([
      {
        input: 'https://github.com/user/repo',
        expected: 'github.com-user-repo',
      },
      {
        input: 'http://github.com/user/repo',
        expected: 'github.com-user-repo',
      },
      {
        input: 'git@github.com:user/repo.git',
        expected: 'github.com-user-repo',
      },
      {
        input: 'git://github.com/user/repo',
        expected: 'github.com-user-repo',
      },
      {
        input: 'https://gitlab.com/org/project.git',
        expected: 'gitlab.com-org-project',
      },
    ] as const)('normalizes "$input" to "$expected"', ({ input, expected }) => {
      expect(normalizeGitUrl(input)).toBe(expected);
    });
  });

  describe('expandPath', () => {
    it('expands tilde to home directory', () => {
      const result = expandPath('~/projects');
      expect(result).toBe(join(homedir(), 'projects'));
    });

    it('resolves relative path from base path', () => {
      const result = expandPath('./relative', '/base/path');
      expect(result).toBe('/base/path/relative');
    });

    it('returns absolute path unchanged', () => {
      const result = expandPath('/absolute/path');
      expect(result).toBe('/absolute/path');
    });

    it('uses cwd as default base path', () => {
      const result = expandPath('./relative');
      expect(result).toBe(join(process.cwd(), 'relative'));
    });
  });

  describe('getGitCachePath', () => {
    it('returns path in amgr cache directory', () => {
      const result = getGitCachePath('https://github.com/user/repo');
      expect(result).toBe(join(AMGR_CACHE_DIR, 'github.com-user-repo'));
    });
  });

  describe('validateSources', () => {
    it('returns empty array for valid sources', () => {
      const sources = [
        'https://github.com/user/repo',
        { type: 'local', path: '/path' },
      ];
      expect(validateSources(sources)).toEqual([]);
    });

    it('returns error when sources is not an array', () => {
      const errors = validateSources('not an array');
      expect(errors).toContain('sources must be an array');
    });

    it('allows string sources', () => {
      expect(validateSources(['https://github.com/user/repo'])).toEqual([]);
    });

    it('returns error for non-object non-string source', () => {
      const errors = validateSources([123]);
      expect(errors.some((e) => e.includes('must be a string or object'))).toBe(true);
    });

    it('returns error for source without type', () => {
      const errors = validateSources([{ path: '/path' }]);
      expect(errors.some((e) => e.includes('missing required property: type'))).toBe(true);
    });

    it('returns error for git source without url', () => {
      const errors = validateSources([{ type: 'git' }]);
      expect(errors.some((e) => e.includes('missing required property: url'))).toBe(true);
    });

    it('returns error for local source without path', () => {
      const errors = validateSources([{ type: 'local' }]);
      expect(errors.some((e) => e.includes('missing required property: path'))).toBe(true);
    });

    it('returns error for invalid source type', () => {
      const errors = validateSources([{ type: 'invalid' }]);
      expect(errors.some((e) => e.includes('invalid type'))).toBe(true);
    });
  });

  describe('formatRelativeTime', () => {
    it('returns "just now" for very recent times', () => {
      const now = new Date();
      expect(formatRelativeTime(now)).toBe('just now');
    });

    it('returns minutes ago for recent times', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago');
    });

    it('returns hours ago for times within a day', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      expect(formatRelativeTime(threeHoursAgo)).toBe('3h ago');
    });

    it('returns days ago for times within a week', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(twoDaysAgo)).toBe('2d ago');
    });

    it('returns formatted date for older times', () => {
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(twoWeeksAgo);
      expect(result).not.toContain('ago');
    });
  });

  describe('getMergedSources', () => {
    it('returns project sources when ignoreGlobalSources is true', () => {
      const config = createTestConfig({
        sources: [{ type: 'local', path: '/project' }],
        options: { ignoreGlobalSources: true },
      });
      const globalSources = [{ type: 'local' as const, path: '/global' }];

      const result = getMergedSources(config, globalSources);
      expect(result).toEqual([{ type: 'local', path: '/project' }]);
    });

    it('prepends global sources by default', () => {
      const config = createTestConfig({
        sources: [{ type: 'local', path: '/project' }],
      });
      const globalSources = [{ type: 'local' as const, path: '/global' }];

      const result = getMergedSources(config, globalSources);
      expect(result).toEqual([
        { type: 'local', path: '/global' },
        { type: 'local', path: '/project' },
      ]);
    });

    it('appends global sources when globalSourcesPosition is append', () => {
      const config = createTestConfig({
        sources: [{ type: 'local', path: '/project' }],
        options: { globalSourcesPosition: 'append' },
      });
      const globalSources = [{ type: 'local' as const, path: '/global' }];

      const result = getMergedSources(config, globalSources);
      expect(result).toEqual([
        { type: 'local', path: '/project' },
        { type: 'local', path: '/global' },
      ]);
    });

    it('returns empty array when no sources', () => {
      const config = createTestConfig();
      const result = getMergedSources(config, []);
      expect(result).toEqual([]);
    });
  });

  describe('getSourceDisplayName', () => {
    it('returns name when provided', () => {
      const source: ResolvedSource = {
        type: 'local',
        path: '/path/to/repo',
        name: 'my-repo',
        localPath: '/path/to/repo',
      };
      expect(getSourceDisplayName(source)).toBe('my-repo');
    });

    it('returns basename for local source without name', () => {
      const source: ResolvedSource = {
        type: 'local',
        path: '/path/to/repo',
        localPath: '/path/to/repo',
      };
      expect(getSourceDisplayName(source)).toBe('repo');
    });

    it('returns repo name from git URL', () => {
      const source: ResolvedSource = {
        type: 'git',
        url: 'https://github.com/user/my-agents.git',
        localPath: '/cache/path',
      };
      expect(getSourceDisplayName(source)).toBe('my-agents');
    });
  });

  describe('file system operations', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = createTempDir();
    });

    afterEach(() => {
      cleanupTempDir(tempDir);
    });

    describe('isValidAmgrRepo', () => {
      it('returns true when repo.json exists', () => {
        createTestRepo(tempDir);
        expect(isValidAmgrRepo(tempDir)).toBe(true);
      });

      it('returns false when repo.json does not exist', () => {
        expect(isValidAmgrRepo(tempDir)).toBe(false);
      });
    });

    describe('resolveSource', () => {
      it('resolves local source with valid repo', () => {
        createTestRepo(tempDir);

        const result = resolveSource({ type: 'local', path: tempDir });
        expect(result.localPath).toBe(tempDir);
        expect(result.type).toBe('local');
      });

      it('throws for non-existent local path', () => {
        expect(() =>
          resolveSource({ type: 'local', path: '/nonexistent/path' })
        ).toThrow('does not exist');
      });

      it('throws for local path without repo.json', () => {
        expect(() => resolveSource({ type: 'local', path: tempDir })).toThrow(
          'not a valid amgr repo'
        );
      });
    });

    describe('getSourceUseCases', () => {
      it('returns use-cases from repo config', () => {
        createTestRepo(tempDir, ['development', 'writing']);

        const source: ResolvedSource = {
          type: 'local',
          path: tempDir,
          localPath: tempDir,
        };
        const useCases = getSourceUseCases(source);

        expect(useCases).toHaveProperty('development');
        expect(useCases).toHaveProperty('writing');
      });

      it('returns empty object for invalid repo', () => {
        const source: ResolvedSource = {
          type: 'local',
          path: tempDir,
          localPath: tempDir,
        };
        const useCases = getSourceUseCases(source);
        expect(useCases).toEqual({});
      });
    });

    describe('getCombinedUseCases', () => {
      it('combines use-cases from multiple sources', () => {
        const tempDir2 = createTempDir();

        try {
          createTestRepo(tempDir, ['development']);
          createTestRepo(tempDir2, ['writing']);

          const sources: ResolvedSource[] = [
            { type: 'local', path: tempDir, localPath: tempDir },
            { type: 'local', path: tempDir2, localPath: tempDir2 },
          ];

          const combined = getCombinedUseCases(sources);

          expect(combined).toHaveProperty('development');
          expect(combined).toHaveProperty('writing');
        } finally {
          cleanupTempDir(tempDir2);
        }
      });

      it('tracks which sources provide each use-case', () => {
        const tempDir2 = createTempDir();

        try {
          createTestRepo(tempDir, ['development']);
          createTestRepo(tempDir2, ['development']);

          const sources: ResolvedSource[] = [
            { type: 'local', path: tempDir, localPath: tempDir, name: 'source1' },
            { type: 'local', path: tempDir2, localPath: tempDir2, name: 'source2' },
          ];

          const combined = getCombinedUseCases(sources);

          expect(combined['development']?.sources).toContain('source1');
          expect(combined['development']?.sources).toContain('source2');
        } finally {
          cleanupTempDir(tempDir2);
        }
      });
    });
  });

  describe('parseProfileSpec', () => {
    it('parses flat profile name', () => {
      const result = parseProfileSpec('development');
      expect(result).toEqual({ parent: 'development', sub: null, isWildcard: false });
    });

    it('parses sub-profile spec', () => {
      const result = parseProfileSpec('development:frontend');
      expect(result).toEqual({ parent: 'development', sub: 'frontend', isWildcard: false });
    });

    it('parses wildcard spec', () => {
      const result = parseProfileSpec('development:*');
      expect(result).toEqual({ parent: 'development', sub: null, isWildcard: true });
    });

    it('handles names with hyphens', () => {
      const result = parseProfileSpec('my-project:sub-profile');
      expect(result).toEqual({ parent: 'my-project', sub: 'sub-profile', isWildcard: false });
    });
  });

  describe('isNestedProfile', () => {
    it('returns false when profile not found', () => {
      const config = { name: 'test', profiles: {} };
      expect(isNestedProfile('missing', config)).toBe(false);
    });

    it('returns false for flat profile', () => {
      const config = { 
        name: 'test', 
        profiles: { development: { description: 'Dev' } } 
      };
      expect(isNestedProfile('development', config)).toBe(false);
    });

    it('returns true for nested profile with sub-profiles', () => {
      const config = { 
        name: 'test', 
        profiles: { 
          development: { 
            description: 'Dev',
            'sub-profiles': { frontend: { description: 'Frontend' } }
          } 
        } 
      };
      expect(isNestedProfile('development', config)).toBe(true);
    });

    it('returns false for empty sub-profiles', () => {
      const config = { 
        name: 'test', 
        profiles: { 
          development: { 
            description: 'Dev',
            'sub-profiles': {}
          } 
        } 
      };
      expect(isNestedProfile('development', config)).toBe(false);
    });
  });

  describe('getSubProfiles', () => {
    it('returns empty array when profile not found', () => {
      const config = { name: 'test', profiles: {} };
      expect(getSubProfiles('missing', config)).toEqual([]);
    });

    it('returns empty array for flat profile', () => {
      const config = { 
        name: 'test', 
        profiles: { development: { description: 'Dev' } } 
      };
      expect(getSubProfiles('development', config)).toEqual([]);
    });

    it('returns sub-profile names for nested profile', () => {
      const config = { 
        name: 'test', 
        profiles: { 
          development: { 
            description: 'Dev',
            'sub-profiles': { 
              frontend: { description: 'Frontend' },
              backend: { description: 'Backend' }
            }
          } 
        } 
      };
      expect(getSubProfiles('development', config)).toEqual(['frontend', 'backend']);
    });
  });

  describe('expandProfiles', () => {
    it('keeps flat profile unchanged', () => {
      const config = { 
        name: 'test', 
        profiles: { writing: { description: 'Writing' } } 
      };
      expect(expandProfiles(['writing'], config)).toEqual(['writing']);
    });

    it('keeps explicit sub-profile unchanged', () => {
      const config = { 
        name: 'test', 
        profiles: { 
          development: { 
            description: 'Dev',
            'sub-profiles': { frontend: { description: 'Frontend' } }
          } 
        } 
      };
      expect(expandProfiles(['development:frontend'], config)).toEqual(['development:frontend']);
    });

    it('expands wildcard to all sub-profiles', () => {
      const config = { 
        name: 'test', 
        profiles: { 
          development: { 
            description: 'Dev',
            'sub-profiles': { 
              frontend: { description: 'Frontend' },
              backend: { description: 'Backend' }
            }
          } 
        } 
      };
      expect(expandProfiles(['development:*'], config)).toEqual([
        'development:frontend',
        'development:backend'
      ]);
    });

    it('expands parent name to all sub-profiles', () => {
      const config = { 
        name: 'test', 
        profiles: { 
          development: { 
            description: 'Dev',
            'sub-profiles': { 
              frontend: { description: 'Frontend' },
              backend: { description: 'Backend' }
            }
          } 
        } 
      };
      expect(expandProfiles(['development'], config)).toEqual([
        'development:frontend',
        'development:backend'
      ]);
    });

    it('handles mixed flat and nested profiles', () => {
      const config = { 
        name: 'test', 
        profiles: { 
          development: { 
            description: 'Dev',
            'sub-profiles': { frontend: { description: 'Frontend' } }
          },
          writing: { description: 'Writing' }
        } 
      };
      expect(expandProfiles(['development', 'writing'], config)).toEqual([
        'development:frontend',
        'writing'
      ]);
    });
  });
});
