<div align="center">

# amgr

**Agent Manager CLI**

[![npm version](https://img.shields.io/npm/v/amgr.svg)](https://www.npmjs.com/package/amgr)

*Define your AI assistant configurations once, deploy them everywhere.*

amgr lets you maintain a single repository of AI rules, commands, and settings,<br>
then selectively deploy them to any project — whether you're using Claude Code, Cursor, GitHub Copilot, or other AI tools.

</div>

## The Problem

You have multiple projects:
```
~/Code/backend/     → needs coding rules, test commands, debugging skills
~/Code/frontend/    → needs coding rules, component patterns, different MCP servers
~/Code/blog/        → needs writing rules, no coding commands
```

Each AI tool (Claude Code, Cursor, Copilot) expects configurations in different formats and directories. Keeping them in sync manually is tedious and error-prone.

## The Solution

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Your Rules Repository                            │
│  ~/Code/my-agents/                                                      │
│  ├── shared/           ← rules that apply everywhere                    │
│  │   └── rules/                                                         │
│  │       └── tone.md        (use-cases: [development, writing])         │
│  │       └── testing.md     (use-cases: [development])                  │
│  └── use-cases/                                                         │
│      ├── development/  ← coding-specific: commands, skills, subagents   │
│      └── writing/      ← writing-specific: style guides, templates      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ amgr sync
                                    ▼
     ┌──────────────────────────────┬──────────────────────────────┐
     │                              │                              │
     ▼                              ▼                              ▼
┌─────────────┐             ┌─────────────┐             ┌─────────────┐
│  backend/   │             │  frontend/  │             │    blog/    │
│ .claude/    │             │ .claude/    │             │ .claude/    │
│ .cursor/    │             │ .cursor/    │             │ .cursor/    │
│             │             │             │             │             │
│ coding rules│             │ coding rules│             │ writing     │
│ test cmds   │             │ components  │             │ style guide │
│ debug skills│             │ debug skills│             │             │
└─────────────┘             └─────────────┘             └─────────────┘
```

**One source of truth → Multiple projects → Multiple AI tools**

## Installation

```bash
npm install -g amgr
```

## Quick Start

### 1. Create a rules repository (one-time setup)

```bash
mkdir ~/Code/my-agents && cd ~/Code/my-agents
amgr repo init --name "my-agents"
amgr repo add development --description "Coding and debugging"
amgr repo add writing --description "Documentation and content"
```

This creates a repository structure where you can add your rules, commands, and skills.

### 2. Set it as your global source

```bash
amgr source add ~/Code/my-agents --global
```

Now all your projects can use this repository.

### 3. Configure any project

```bash
cd ~/Code/my-project
amgr init                    # Interactive setup
amgr sync                    # Deploy configurations
```

That's it. Your AI tools now have the rules you defined, formatted correctly for each tool.

## Commands

### `amgr` or `amgr sync`

Synchronize agent configurations based on `.amgr/config.json`.

```bash
amgr sync
amgr sync --dry-run      # Preview changes without applying
amgr sync --verbose      # Show detailed output
amgr sync --replace      # Delete all tracked files before deploying
```

**Options:**
- `-n, --dry-run` - Show what would be done without making changes
- `-v, --verbose` - Enable verbose output
- `-c, --config <path>` - Use a custom config file path
- `--replace` - Delete all tracked files before deploying (use with caution in cloud-synced directories like iCloud, Dropbox, or OneDrive as it may create duplicate files)

### `amgr init`

Initialize a new `.amgr/config.json` configuration file interactively.

```bash
amgr init
```

Prompts for:
- Target AI tools (claudecode, cursor, copilot, etc.)
- Features to include (rules, commands, skills, etc.)
- Use-cases (development, writing, product, etc.)
- Output directories (optional, per use-case)
- Advanced options (optional)

### `amgr config`

Interactively edit an existing `.amgr/config.json` configuration file.

```bash
amgr config
```

Provides a menu to edit:
- Targets - AI tools to generate configs for
- Features - Content types to include
- Use-cases - Which use-cases to enable
- Output directories - Custom paths per use-case
- Options - Advanced settings

**Options:**
- `-v, --verbose` - Enable verbose output
- `-c, --config <path>` - Use a custom config file path

### `amgr list`

List available use-cases from the agents repository.

```bash
amgr list
amgr list --verbose    # Also show targets and features
```

### `amgr validate`

Validate the configuration file without syncing.

```bash
amgr validate
amgr validate --verbose    # Show configuration summary
```

### `amgr clean`

Remove all generated agent configuration files tracked by amgr.

```bash
amgr clean
amgr clean --dry-run    # Preview what would be removed
```

### `amgr detach`

Remove all amgr-created files and optionally the configuration.

```bash
amgr detach
```

This command:
1. Removes all files tracked in the lock file
2. Deletes the lock file
3. Optionally removes `.amgr/config.json` and the `.amgr/` directory

### `amgr source`

Manage rules sources for your project. Sources can be local paths or Git URLs, allowing you to use rules from multiple repositories.

#### `amgr source add <url-or-path>`

Add a rules source to the project configuration.

```bash
amgr source add https://github.com/company/agent-rules
amgr source add ~/my-personal-agents
amgr source add ./local-rules
```

**Options:**
- `--position <index>` - Insert at specific position (default: append at end)
- `--name <name>` - Optional display name for the source

#### `amgr source remove <index-or-name>`

Remove a source from the project configuration.

```bash
amgr source remove 0              # Remove by index
amgr source remove company        # Remove by name
```

**Options:**
- `-f, --force` - Skip confirmation prompt

#### `amgr source list`

Show configured sources and their status.

```bash
amgr source list
amgr source list --verbose    # Show full URLs/paths
```

#### `amgr source update`

Manually refresh all Git sources (fetch latest changes).

```bash
amgr source update
amgr source update --global    # Update only global sources
```

### Global Sources

Global sources are configured once in `~/.amgr/config.json` and are automatically available to all projects.

```bash
# Add a global source (available to all projects)
amgr source add ~/Code/my-agents --global
amgr source add https://github.com/company/rules --global

# List global sources
amgr source list --global

# Remove a global source
amgr source remove agents --global
```

**Global config (`~/.amgr/config.json`):**
```json
{
  "globalSources": [
    { "type": "local", "path": "~/Code/agents", "name": "agents" }
  ]
}
```

By default, global sources are prepended to project sources (project sources override global). Projects can control this behavior via `options.ignoreGlobalSources` and `options.globalSourcesPosition`.

### Source Layering

When multiple sources are configured, they are applied in order:
1. First source provides the base content
2. Later sources override earlier ones
3. This allows "company rules + personal overrides" patterns

```json
{
  "sources": [
    { "type": "git", "url": "https://github.com/company/agent-rules" },
    { "type": "local", "path": "~/my-personal-agents" }
  ]
}
```

### `amgr repo`

Manage standalone amgr repositories. An amgr repo is a directory containing agent configurations that can be used with `amgr sync`.

#### `amgr repo init`

Initialize a new amgr repository in the current directory.

```bash
amgr repo init
amgr repo init --name "my-agents" --description "My agent configs" --author "Your Name"
```

Creates the following structure:
```
my-agents-repo/
├── repo.json          # Repository manifest
├── shared/            # Shared content across all use-cases
│   ├── rules/
│   ├── commands/
│   ├── skills/
│   └── subagents/
└── use-cases/         # Use-case specific content
```

**Options:**
- `--name <name>` - Repository name (defaults to directory name)
- `--description <desc>` - Repository description
- `--author <author>` - Repository author

#### `amgr repo add <name>`

Add a new use-case to the repository.

```bash
amgr repo add development
amgr repo add development --description "Coding and debugging tasks"
```

Creates a use-case scaffold with:
- `use-cases/<name>/.rulesync/` directory with subdirectories
- `use-cases/<name>/rulesync.jsonc` configuration file
- Entry in `repo.json`

**Options:**
- `--description <desc>` - Use-case description (prompted if not provided)

#### `amgr repo remove <name>`

Remove a use-case from the repository.

```bash
amgr repo remove development
amgr repo remove development --force    # Skip confirmation
```

**Options:**
- `-f, --force` - Skip confirmation prompt

#### `amgr repo list`

List use-cases in the current repository.

```bash
amgr repo list
amgr repo list --verbose    # Show orphaned directories
```

### Repository Auto-Detection

When running `amgr repo list` inside a directory containing `repo.json`, amgr automatically uses that directory as the agents source. This means you can:

```bash
cd /path/to/my-agents-repo
amgr repo list               # Lists use-cases from this repo
```

To use a repository as a source in your project, add it via `amgr source add`:

```bash
amgr source add /path/to/my-agents-repo
amgr source add https://github.com/company/agent-rules
```

## Configuration

Configuration lives in `.amgr/config.json` in your project directory.

### Example Configuration

```json
{
  "$schema": "https://raw.githubusercontent.com/oztamir/amgr/main/schemas/amgr.schema.json",
  "targets": ["claudecode", "cursor"],
  "features": ["rules", "commands", "skills"],
  "use-cases": ["development"]
}
```

### Example with Custom Sources

```json
{
  "$schema": "https://raw.githubusercontent.com/oztamir/amgr/main/schemas/amgr.schema.json",
  "sources": [
    { "type": "git", "url": "https://github.com/company/agent-rules" },
    { "type": "local", "path": "~/my-personal-agents" }
  ],
  "targets": ["claudecode", "cursor"],
  "features": ["rules", "commands", "skills"],
  "use-cases": ["development", "my-custom-usecase"]
}
```

### Example with Custom Output Directories

```json
{
  "$schema": "https://raw.githubusercontent.com/oztamir/amgr/main/schemas/amgr.schema.json",
  "targets": ["claudecode", "cursor"],
  "features": ["rules", "commands"],
  "use-cases": ["development", "product"],
  "outputDirs": {
    "product": "docs/"
  }
}
```

This places `product` use-case files in `docs/.claude/` and `docs/.cursor/` instead of the project root.

### Properties

#### `sources` (optional)

Array of rules sources. Each source can be:
- A git URL (e.g., `https://github.com/company/agent-rules`)
- A local path (e.g., `~/my-agents` or `./local-rules`)
- An object with `type`, `url`/`path`, and optional `name`

Sources are processed in order - later sources override earlier ones.

| Format | Example |
|--------|---------|
| Git URL string | `"https://github.com/company/rules"` |
| Local path string | `"~/my-agents"` |
| Git object | `{ "type": "git", "url": "...", "name": "company" }` |
| Local object | `{ "type": "local", "path": "...", "name": "personal" }` |

#### `targets` (required)

AI tools to generate configurations for:

| Target | Description |
|--------|-------------|
| `agentsmd` | AGENTS.md (generic) |
| `antigravity` | Antigravity AI |
| `augmentcode` | Augment Code |
| `augmentcode-legacy` | Augment Code (legacy) |
| `claudecode` | Claude Code (Anthropic's CLI) |
| `claudecode-legacy` | Claude Code (legacy) |
| `cline` | Cline VS Code extension |
| `codexcli` | OpenAI Codex CLI |
| `copilot` | GitHub Copilot |
| `cursor` | Cursor IDE |
| `geminicli` | Gemini CLI |
| `junie` | JetBrains Junie |
| `kilo` | Kilo Code |
| `kiro` | Kiro AI |
| `opencode` | OpenCode |
| `qwencode` | Qwen Code |
| `roo` | Roo Code |
| `warp` | Warp Terminal |
| `windsurf` | Windsurf IDE |
| `zed` | Zed Editor |

Use `"*"` to generate for all supported tools.

#### `features` (required)

Content types to include:

| Feature | Description |
|---------|-------------|
| `rules` | General guidelines and instructions |
| `ignore` | File patterns to exclude from AI context |
| `mcp` | MCP server configurations |
| `commands` | Slash commands (e.g., /commit) |
| `subagents` | Specialized AI assistant definitions |
| `skills` | Directory-based capability definitions |

#### `use-cases` (required)

Use-case identifiers that map to folders in your configured sources. Any use-case name defined in a source's `repo.json` is valid.

**Note:** Sources must be configured for `amgr sync` to work. Use-cases are defined by source repositories, not hardcoded. Run `amgr list` to see available use-cases from your configured sources.

#### `options` (optional)

Advanced configuration options:

```json
{
  "options": {
    "simulateCommands": false,
    "simulateSubagents": false,
    "simulateSkills": false,
    "modularMcp": false,
    "ignoreGlobalSources": false,
    "globalSourcesPosition": "prepend"
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `simulateCommands` | boolean | `false` | Generate simulated commands for tools without native support |
| `simulateSubagents` | boolean | `false` | Generate simulated subagents for tools without native support |
| `simulateSkills` | boolean | `false` | Generate simulated skills for tools without native support |
| `modularMcp` | boolean | `false` | Enable modular-mcp for Claude Code (reduces token usage) |
| `ignoreGlobalSources` | boolean | `false` | Ignore global sources for this project |
| `globalSourcesPosition` | string | `"prepend"` | Where to merge global sources: `"prepend"` (project overrides global) or `"append"` (global overrides project) |

#### `outputDirs` (optional)

Custom output directory prefixes per use-case. By default, all use-cases deploy files to the project root (e.g., `.claude/`, `.cursor/`). Use `outputDirs` to place specific use-cases in subdirectories.

```json
{
  "use-cases": ["development", "product"],
  "outputDirs": {
    "product": "docs/"
  }
}
```

With this configuration:
- `development` rules → `.claude/`, `.cursor/` (default)
- `product` rules → `docs/.claude/`, `docs/.cursor/`

Rules from `shared/` are deployed to all configured output directories.

| Property | Type | Description |
|----------|------|-------------|
| `<use-case>` | string | Directory prefix for this use-case. Will be normalized to end with `/`. Example: `"docs"` or `"docs/"` |

**Validation rules:**
- Keys must match use-cases in the `use-cases` array
- Values must be relative paths (no leading `/`)
- Values must not contain `..` path traversal

## File Tracking

amgr maintains a lock file (`.amgr/amgr-lock.json`) to track files it creates. This ensures:

- **Safe updates**: Only amgr-managed files are modified during sync
- **Native file preservation**: Files you create manually are never touched
- **Clean removal**: `amgr clean` and `amgr detach` only remove tracked files

### Recommended .gitignore

```gitignore
# amgr lock file (project-local state)
.amgr/amgr-lock.json

# Or ignore the entire directory
.amgr/
```

You may choose to commit `.amgr/config.json` to share the configuration with your team.

## Git Source Caching

Git sources are cached locally in `~/.amgr/cache/`:

```
~/.amgr/
├── config.json                        # Global sources configuration
└── cache/
    ├── github.com-company-agent-rules/
    │   ├── .git/
    │   ├── repo.json
    │   ├── shared/
    │   └── use-cases/
    └── github.com-other-repo/
        └── ...
```

- On `amgr sync`: Git sources are automatically pulled (updated)
- Cache is created on first use and reused for subsequent syncs
- Use `amgr source update` to manually refresh all git sources

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AMGR_CONFIG` | Override the config file path |
| `AMGR_VERBOSE` | Enable verbose logging (`true`/`false`) |

## Repository Configuration (`repo.json`)

When managing a standalone amgr repository, `repo.json` defines the repository metadata and available use-cases.

### Example repo.json

```json
{
  "$schema": "https://raw.githubusercontent.com/oztamir/amgr/main/schemas/amgr-repo.schema.json",
  "name": "my-agents",
  "description": "My personal agent configurations",
  "version": "1.0.0",
  "author": "Your Name",
  "use-cases": {
    "development": {
      "description": "Coding, debugging, and testing"
    },
    "writing": {
      "description": "Documentation and content creation"
    }
  }
}
```

### Properties

| Property | Required | Description |
|----------|----------|-------------|
| `name` | Yes | Repository name |
| `description` | No | Repository description |
| `version` | No | Semantic version (e.g., "1.0.0") |
| `author` | No | Repository author or maintainer |
| `use-cases` | Yes | Object mapping use-case names to their metadata |

Each use-case entry must include a `description` field.

## How It Works

1. **Parse Configuration** - Reads `.amgr/config.json` and validates it
2. **Clean Previous Files** - Removes files listed in the lock file
3. **Compose Content** - Merges shared content with use-case specific content
4. **Generate Configs** - Runs rulesync to create tool-specific configurations
5. **Deploy Files** - Copies generated files to target directories (`.claude/`, `.cursor/`, etc.)
6. **Update Lock File** - Records all created files for future reference

## Conflict Handling

When amgr encounters a file that exists but isn't tracked:

1. The file is skipped (not overwritten)
2. A warning is displayed
3. Other files continue to be processed

To resolve conflicts:
- Remove or rename the conflicting file
- Re-run `amgr sync`
