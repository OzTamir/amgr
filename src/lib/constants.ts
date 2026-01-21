import type { Target, Feature } from '../types/config.js';

export {
  VALID_TARGETS,
  VALID_FEATURES,
  GLOBAL_SOURCES_POSITION,
  DEFAULT_OPTIONS,
} from '../types/config.js';

export { SOURCE_TYPE } from '../types/sources.js';

export const TARGET_DESCRIPTIONS: Record<Target, string> = {
  agentsmd: 'AGENTS.md (generic)',
  antigravity: 'Antigravity AI',
  augmentcode: 'Augment Code',
  'augmentcode-legacy': 'Augment Code (legacy)',
  claudecode: "Claude Code (Anthropic's CLI)",
  'claudecode-legacy': 'Claude Code (legacy)',
  cline: 'Cline VS Code extension',
  codexcli: 'OpenAI Codex CLI',
  copilot: 'GitHub Copilot',
  cursor: 'Cursor IDE',
  geminicli: 'Gemini CLI',
  junie: 'JetBrains Junie',
  kilo: 'Kilo Code',
  kiro: 'Kiro AI',
  opencode: 'OpenCode',
  qwencode: 'Qwen Code',
  roo: 'Roo Code',
  warp: 'Warp Terminal',
  windsurf: 'Windsurf IDE',
  zed: 'Zed Editor',
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
  agentsmd: {
    rules: true,
    ignore: false,
    mcp: false,
    commands: true,
    subagents: true,
    skills: true,
  },
  antigravity: {
    rules: true,
    ignore: false,
    mcp: false,
    commands: true,
    subagents: false,
    skills: true,
  },
  augmentcode: {
    rules: true,
    ignore: true,
    mcp: false,
    commands: false,
    subagents: false,
    skills: false,
  },
  'augmentcode-legacy': {
    rules: true,
    ignore: false,
    mcp: false,
    commands: false,
    subagents: false,
    skills: false,
  },
  claudecode: {
    rules: true,
    ignore: true,
    mcp: true,
    commands: true,
    subagents: true,
    skills: true,
  },
  'claudecode-legacy': {
    rules: true,
    ignore: false,
    mcp: false,
    commands: false,
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
  codexcli: {
    rules: true,
    ignore: false,
    mcp: true,
    commands: true,
    subagents: true,
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
  cursor: {
    rules: true,
    ignore: true,
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
    subagents: true,
    skills: true,
  },
  junie: {
    rules: true,
    ignore: true,
    mcp: true,
    commands: false,
    subagents: false,
    skills: false,
  },
  kilo: {
    rules: true,
    ignore: true,
    mcp: true,
    commands: true,
    subagents: false,
    skills: true,
  },
  kiro: {
    rules: true,
    ignore: true,
    mcp: true,
    commands: false,
    subagents: false,
    skills: false,
  },
  opencode: {
    rules: true,
    ignore: false,
    mcp: true,
    commands: true,
    subagents: true,
    skills: true,
  },
  qwencode: {
    rules: true,
    ignore: true,
    mcp: false,
    commands: false,
    subagents: false,
    skills: false,
  },
  roo: {
    rules: true,
    ignore: true,
    mcp: true,
    commands: true,
    subagents: true,
    skills: true,
  },
  warp: {
    rules: true,
    ignore: false,
    mcp: false,
    commands: false,
    subagents: false,
    skills: false,
  },
  windsurf: {
    rules: true,
    ignore: true,
    mcp: false,
    commands: false,
    subagents: false,
    skills: false,
  },
  zed: {
    rules: false,
    ignore: true,
    mcp: false,
    commands: false,
    subagents: false,
    skills: false,
  },
};

export const ENTITY_TYPES = ['rules', 'commands', 'skills', 'subagents'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const TARGET_DIRECTORIES: Record<Target, string> = {
  agentsmd: '.',
  antigravity: '.agent',
  augmentcode: '.augment',
  'augmentcode-legacy': '.augment',
  claudecode: '.claude',
  'claudecode-legacy': '.claude',
  cline: '.cline',
  codexcli: '.codex',
  copilot: '.github/copilot',
  cursor: '.cursor',
  geminicli: '.gemini',
  junie: '.junie',
  kilo: '.kilocode',
  kiro: '.kiro',
  opencode: '.opencode',
  qwencode: '.',
  roo: '.roo',
  warp: '.',
  windsurf: '.windsurf',
  zed: '.zed',
};

export const CONFIG_DIR = '.amgr';
export const CONFIG_FILE = 'config.json';
export const LOCK_FILE = 'amgr-lock.json';
export const LOCK_VERSION = '1.0.0';

export const REPO_FILE = 'repo.json';
export const SHARED_DIR = 'shared';
export const USE_CASES_DIR = 'use-cases';
export const SHARED_SUBDIR = '_shared';
export const RULESYNC_DIR = '.rulesync';
export const RULESYNC_CONFIG = 'rulesync.jsonc';
