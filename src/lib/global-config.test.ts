import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { getGlobalConfigPath, validateGlobalConfig } from './global-config.js';
import { homedir } from 'node:os';

describe('global-config', () => {
  describe('getGlobalConfigPath', () => {
    it('returns path to global config file', () => {
      const result = getGlobalConfigPath();
      expect(result).toBe(join(homedir(), '.amgr', 'config.json'));
    });
  });

  describe('validateGlobalConfig', () => {
    it('returns empty array for valid config', () => {
      const config = { globalSources: [] };
      expect(validateGlobalConfig(config)).toEqual([]);
    });

    it('returns empty array for config with valid sources', () => {
      const config = {
        globalSources: [{ type: 'local', path: '/path' }],
      };
      expect(validateGlobalConfig(config)).toEqual([]);
    });

    it('returns error for invalid sources', () => {
      const config = {
        globalSources: [{ type: 'git' }],
      };
      const errors = validateGlobalConfig(config);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
