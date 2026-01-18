/**
 * Constants for amgr CLI
 * Defines valid targets, features, and their metadata
 */

export const VALID_TARGETS = [
  'claudecode',
  'cursor',
  'copilot',
  'geminicli',
  'cline',
  'codex',
  'opencode'
];

export const TARGET_DESCRIPTIONS = {
  claudecode: 'Claude Code (Anthropic\'s CLI)',
  cursor: 'Cursor IDE',
  copilot: 'GitHub Copilot',
  geminicli: 'Gemini CLI',
  cline: 'Cline VS Code extension',
  codex: 'OpenAI Codex CLI',
  opencode: 'OpenCode'
};

export const VALID_FEATURES = [
  'rules',
  'ignore',
  'mcp',
  'commands',
  'subagents',
  'skills'
];

export const FEATURE_DESCRIPTIONS = {
  rules: 'General guidelines and instructions for AI assistants',
  ignore: 'File patterns to exclude from AI context',
  mcp: 'MCP (Model Context Protocol) server configurations',
  commands: 'Slash commands (e.g., /commit, /review)',
  subagents: 'Specialized AI assistant definitions',
  skills: 'Directory-based capability definitions'
};

// Feature support matrix by target
export const FEATURE_SUPPORT = {
  claudecode: { rules: true, ignore: true, mcp: true, commands: true, subagents: true, skills: true },
  cursor: { rules: true, ignore: true, mcp: true, commands: true, subagents: false, skills: true },
  copilot: { rules: true, ignore: false, mcp: true, commands: true, subagents: true, skills: true },
  geminicli: { rules: true, ignore: true, mcp: true, commands: true, subagents: false, skills: false },
  cline: { rules: true, ignore: true, mcp: true, commands: true, subagents: false, skills: false },
  codex: { rules: true, ignore: false, mcp: true, commands: true, subagents: false, skills: true },
  opencode: { rules: true, ignore: false, mcp: true, commands: true, subagents: true, skills: true }
};

export const DEFAULT_OPTIONS = {
  simulateCommands: false,
  simulateSubagents: false,
  simulateSkills: false,
  modularMcp: false,
  ignoreGlobalSources: false,
  globalSourcesPosition: 'prepend'
};

export const GLOBAL_SOURCES_POSITION = {
  PREPEND: 'prepend',
  APPEND: 'append'
};

// Entity types that can be composed
export const ENTITY_TYPES = ['rules', 'commands', 'skills', 'subagents'];

// Target directory mappings for deployment
export const TARGET_DIRECTORIES = {
  claudecode: '.claude',
  cursor: '.cursor',
  copilot: '.github/copilot',
  geminicli: '.gemini',
  cline: '.cline',
  codex: '.codex',
  opencode: '.opencode'
};

// Config file paths
export const CONFIG_DIR = '.amgr';
export const CONFIG_FILE = 'config.json';
export const LOCK_FILE = 'amgr-lock.json';
export const LOCK_VERSION = '1.0.0';

// Repo structure paths
export const REPO_FILE = 'repo.json';
export const SHARED_DIR = 'shared';
export const USE_CASES_DIR = 'use-cases';
export const RULESYNC_DIR = '.rulesync';
export const RULESYNC_CONFIG = 'rulesync.jsonc';


