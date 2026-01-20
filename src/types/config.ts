import type { Source } from './sources.js';

export const VALID_TARGETS = [
  'agentsmd',
  'antigravity',
  'augmentcode',
  'augmentcode-legacy',
  'claudecode',
  'claudecode-legacy',
  'cline',
  'codexcli',
  'copilot',
  'cursor',
  'geminicli',
  'junie',
  'kilo',
  'kiro',
  'opencode',
  'qwencode',
  'roo',
  'warp',
  'windsurf',
  'zed',
] as const;

export type Target = (typeof VALID_TARGETS)[number];

export const VALID_FEATURES = [
  'rules',
  'ignore',
  'mcp',
  'commands',
  'subagents',
  'skills',
] as const;

export type Feature = (typeof VALID_FEATURES)[number];

export const GLOBAL_SOURCES_POSITION = {
  PREPEND: 'prepend',
  APPEND: 'append',
} as const;

export type GlobalSourcesPosition =
  (typeof GLOBAL_SOURCES_POSITION)[keyof typeof GLOBAL_SOURCES_POSITION];

export interface ConfigOptions {
  simulateCommands?: boolean | undefined;
  simulateSubagents?: boolean | undefined;
  simulateSkills?: boolean | undefined;
  modularMcp?: boolean | undefined;
  ignoreGlobalSources?: boolean | undefined;
  globalSourcesPosition?: GlobalSourcesPosition | undefined;
}

export interface AmgrConfig {
  $schema?: string | undefined;
  sources?: Source[] | undefined;
  targets: (Target | '*')[];
  features: Feature[];
  'use-cases': string[];
  options?: ConfigOptions | undefined;
  outputDirs?: Record<string, string> | undefined;
}

export interface GlobalConfig {
  $schema?: string | undefined;
  globalSources: Source[];
}

export const DEFAULT_OPTIONS: Required<
  Omit<ConfigOptions, 'globalSourcesPosition'>
> & { globalSourcesPosition: GlobalSourcesPosition } = {
  simulateCommands: false,
  simulateSubagents: false,
  simulateSkills: false,
  modularMcp: false,
  ignoreGlobalSources: false,
  globalSourcesPosition: 'prepend',
};
