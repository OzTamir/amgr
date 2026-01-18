import type { Target, Feature } from '../types/config.js';

export {
  VALID_TARGETS,
  VALID_FEATURES,
  GLOBAL_SOURCES_POSITION,
  DEFAULT_OPTIONS,
} from '../types/config.js';

export { SOURCE_TYPE } from '../types/sources.js';

export const TARGET_DESCRIPTIONS: Record<Target, string> = {
  claudecode: "Claude Code (Anthropic's CLI)",
  cursor: 'Cursor IDE',
  copilot: 'GitHub Copilot',
  geminicli: 'Gemini CLI',
  cline: 'Cline VS Code extension',
  codex: 'OpenAI Codex CLI',
  opencode: 'OpenCode',
};

export const FEATURE_DESCRIPTIONS: Record<Feature, string> = {
  rules: 'General guidelines and instructions for AI assistants',
  ignore: 'File patterns to exclude from AI context',
  mcp: 'MCP (Model Context Protocol) server configurations',
  commands: 'Slash commands (e.g., /commit, /review)',
  subagents: 'Specialized AI assistant definitions',
  skills: 'Directory-based capability definitions',
};

export const FEATURE_SUPPORT: Record<Target, Record<Feature, boolean>> = {
  claudecode: {
    rules: true,
    ignore: true,
    mcp: true,
    commands: true,
    subagents: true,
    skills: true,
  },
  cursor: {
    rules: true,
    ignore: true,
    mcp: true,
    commands: true,
    subagents: false,
    skills: true,
  },
  copilot: {
    rules: true,
    ignore: false,
    mcp: true,
    commands: true,
    subagents: true,
    skills: true,
  },
  geminicli: {
    rules: true,
    ignore: true,
    mcp: true,
    commands: true,
    subagents: false,
    skills: false,
  },
  cline: {
    rules: true,
    ignore: true,
    mcp: true,
    commands: true,
    subagents: false,
    skills: false,
  },
  codex: {
    rules: true,
    ignore: false,
    mcp: true,
    commands: true,
    subagents: false,
    skills: true,
  },
  opencode: {
    rules: true,
    ignore: false,
    mcp: true,
    commands: true,
    subagents: true,
    skills: true,
  },
};

export const ENTITY_TYPES = ['rules', 'commands', 'skills', 'subagents'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const TARGET_DIRECTORIES: Record<Target, string> = {
  claudecode: '.claude',
  cursor: '.cursor',
  copilot: '.github/copilot',
  geminicli: '.gemini',
  cline: '.cline',
  codex: '.codex',
  opencode: '.opencode',
};

export const CONFIG_DIR = '.amgr';
export const CONFIG_FILE = 'config.json';
export const LOCK_FILE = 'amgr-lock.json';
export const LOCK_VERSION = '1.0.0';

export const REPO_FILE = 'repo.json';
export const SHARED_DIR = 'shared';
export const USE_CASES_DIR = 'use-cases';
export const RULESYNC_DIR = '.rulesync';
export const RULESYNC_CONFIG = 'rulesync.jsonc';
