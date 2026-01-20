import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { AmgrConfig } from './types/config.js';
import type { Logger } from './types/common.js';

export function createTempDir(prefix = 'amgr-test-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function cleanupTempDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

export interface MockLogger extends Logger {
  logs: {
    info: string[];
    verbose: string[];
    warn: string[];
    error: string[];
    success: string[];
  };
}

export function createMockLogger(): MockLogger {
  const logs = {
    info: [] as string[],
    verbose: [] as string[],
    warn: [] as string[],
    error: [] as string[],
    success: [] as string[],
  };
  return {
    logs,
    info: (msg: string) => {
      logs.info.push(msg);
    },
    verbose: (msg: string) => {
      logs.verbose.push(msg);
    },
    warn: (msg: string) => {
      logs.warn.push(msg);
    },
    error: (msg: string) => {
      logs.error.push(msg);
    },
    success: (msg: string) => {
      logs.success.push(msg);
    },
  };
}

export function createTestConfig(overrides: Partial<AmgrConfig> = {}): AmgrConfig {
  return {
    targets: ['claudecode'],
    features: ['rules'],
    'use-cases': ['development'],
    ...overrides,
  };
}

export function createTestRepo(
  basePath: string,
  useCases: string[] = ['development']
): void {
  writeFileSync(
    join(basePath, 'repo.json'),
    JSON.stringify(
      {
        name: 'test-repo',
        'use-cases': Object.fromEntries(
          useCases.map((uc) => [uc, { description: `Test ${uc}` }])
        ),
      },
      null,
      2
    )
  );

  mkdirSync(join(basePath, 'shared', 'rules'), { recursive: true });

  for (const useCase of useCases) {
    mkdirSync(join(basePath, 'use-cases', useCase, '.rulesync', 'rules'), {
      recursive: true,
    });
  }
}

export function createTestProject(basePath: string, config: AmgrConfig): void {
  mkdirSync(join(basePath, '.amgr'), { recursive: true });
  writeFileSync(
    join(basePath, '.amgr', 'config.json'),
    JSON.stringify(config, null, 2)
  );
}

export function createTestFile(filePath: string, content: string): void {
  const dir = join(filePath, '..');
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, content);
}
