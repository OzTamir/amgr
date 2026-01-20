import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validate } from './validate.js';
import {
  createTempDir,
  cleanupTempDir,
  createTestConfig,
  createTestProject,
} from '../test-utils.js';
import type { AmgrConfig } from '../types/config.js';

describe('validate command', () => {
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

  it('shows error when no config exists', async () => {
    await validate();

    expect(consoleSpy.error).toHaveBeenCalledWith(
      expect.stringContaining('No configuration file found')
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('shows success for valid config', async () => {
    createTestProject(tempDir, createTestConfig());

    await validate();

    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('Configuration is valid')
    );
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('shows validation errors for invalid config', async () => {
    const invalidConfig = {
      targets: [],
      features: ['rules'],
      'use-cases': ['development'],
    } as unknown as AmgrConfig;
    createTestProject(tempDir, invalidConfig);

    await validate();

    expect(consoleSpy.error).toHaveBeenCalledWith(
      expect.stringContaining('validation failed')
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('shows config summary in verbose mode', async () => {
    createTestProject(tempDir, createTestConfig());

    await validate({ verbose: true });

    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('Configuration summary')
    );
    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('Targets:')
    );
    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('Features:')
    );
  });
});
