# AMGR - Agents Manager CLI Specification

## Overview

`amgr` is a CLI tool for managing AI agent configurations across projects. It composes configurations from one or more source repositories and deploys them to target project directories.

When running `amgr` in a project folder containing a `.amgr/config.json` configuration file, the tool:
1. Reads the configuration to determine sources, targets, features, and use-cases
2. Resolves sources (fetching git repos or validating local paths)
3. Composes the appropriate content from all configured sources
4. Runs rulesync to generate tool-specific configurations
5. Copies the generated configurations to the project's agent folders (`.claude/`, `.cursor/`, etc.)
6. Maintains a lock file (`.amgr/amgr-lock.json`) tracking all files created by amgr

**Sources are required**: You must configure at least one source (git URL or local path) that contains a valid amgr repository with a `repo.json` file.

**File Tracking:**
- amgr tracks all files it creates in a lock file (`.amgr/amgr-lock.json`)
- During sync, only amgr-created files are removed/replaced
- Native files in target directories are preserved and never modified

## File Tracking: `.amgr/amgr-lock.json`

amgr maintains a lock file (`.amgr/amgr-lock.json`) in the `.amgr` directory to track all files it creates. This allows amgr to distinguish between:
- **amgr-created files**: Files generated and managed by amgr
- **Native files**: Files that exist in the target directories independently of amgr

### Lock File Structure

```json
{
  "version": "1.0.0",
  "created": "2024-01-15T10:30:00Z",
  "lastSynced": "2024-01-20T14:22:00Z",
  "files": [
    ".claude/settings.json",
    ".claude/commands/commit.md",
    ".cursor/rules/development.mdc",
    ".github/copilot/instructions.md"
  ]
}
```

### Lock File Behavior

- **Created automatically**: The lock file is created on first sync
- **Updated on sync**: File list is refreshed each time `amgr sync` runs
- **Git-ignored by default**: The `.amgr` directory should be added to `.gitignore` (amgr can optionally handle this)
- **Preserves native files**: Only files listed in the lock file are considered amgr-managed

## Configuration File: `.amgr/config.json`

The configuration file lives in the `.amgr` directory of a target project and defines what agent configurations should be deployed.

### Schema

```json
{
  "$schema": "https://raw.githubusercontent.com/oztamir/amgr/main/schemas/amgr.schema.json",
  "sources": [
    { "type": "local", "path": "~/Code/agents" }
  ],
  "targets": ["claudecode", "cursor"],
  "features": ["rules", "commands", "skills"],
  "use-cases": ["development"],
  "options": {
    "simulateCommands": false,
    "simulateSubagents": false,
    "simulateSkills": false,
    "modularMcp": false
  }
}
```

**Note:** The `$schema` property is optional but recommended for IDE validation support.

#### `sources` (required for sync)
An array of source repositories containing agent configurations. Sources can be git URLs or local paths.

**Source types:**
| Format | Example |
|--------|---------|
| Git URL string | `"https://github.com/company/rules"` |
| Local path string | `"~/my-agents"` |
| Git object | `{ "type": "git", "url": "...", "name": "company" }` |
| Local object | `{ "type": "local", "path": "...", "name": "personal" }` |

Sources are applied in order - later sources override earlier ones. This allows patterns like "company rules + personal overrides".

**Example:**
```json
{
  "sources": [
    { "type": "git", "url": "https://github.com/company/agent-rules" },
    { "type": "local", "path": "~/my-personal-agents" }
  ]
}
```

### Properties

#### `targets` (required)
An array of AI tools to generate configurations for.

**Supported targets:**
| Target | Description |
|--------|-------------|
| `claudecode` | Claude Code (Anthropic's CLI) |
| `cursor` | Cursor IDE |
| `copilot` | GitHub Copilot |
| `geminicli` | Gemini CLI |
| `cline` | Cline VS Code extension |
| `codex` | OpenAI Codex CLI |
| `opencode` | OpenCode |

**Special value:** `"*"` - Generate for all supported tools

**Example:**
```json
{
  "targets": ["claudecode", "cursor"]
}
```

#### `features` (required)
An array of content types to include in the generated configuration.

**Supported features:**
| Feature | Description |
|---------|-------------|
| `rules` | General guidelines and instructions for AI assistants |
| `ignore` | File patterns to exclude from AI context |
| `mcp` | MCP (Model Context Protocol) server configurations |
| `commands` | Slash commands (e.g., `/commit`, `/review`) |
| `subagents` | Specialized AI assistant definitions |
| `skills` | Directory-based capability definitions |

**Feature support by target:**

| Target | rules | ignore | mcp | commands | subagents | skills |
|--------|:-----:|:------:|:---:|:--------:|:---------:|:------:|
| claudecode | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| cursor | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| copilot | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ |
| geminicli | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| cline | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| codex | ✓ | ✗ | ✓ | ✓ | ✗ | ✓ |
| opencode | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ |

**Example:**
```json
{
  "features": ["rules", "ignore", "mcp", "commands", "skills"]
}
```

#### `use-cases` (required)
An array of use-case identifiers that map to folders under `use-cases/` in the source repositories.

Use-cases are defined in source repositories via their `repo.json` file. Any use-case name that exists in a configured source is valid. When multiple use-cases are specified, they are composed in order (later use-cases override earlier ones).

**Example:**
```json
{
  "use-cases": ["development"]
}
```

**Example with multiple use-cases (merged):**
```json
{
  "use-cases": ["development", "writing"]
}
```

#### `options` (optional)
Advanced configuration options passed to rulesync.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `simulateCommands` | boolean | `false` | Generate simulated commands for tools without native support |
| `simulateSubagents` | boolean | `false` | Generate simulated subagents for tools without native support |
| `simulateSkills` | boolean | `false` | Generate simulated skills for tools without native support |
| `modularMcp` | boolean | `false` | Enable modular-mcp for Claude Code (reduces token usage) |

**Example:**
```json
{
  "options": {
    "simulateCommands": true,
    "modularMcp": true
  }
}
```

## CLI Usage

### Installation

```bash
npm install -g amgr
```

Or with npx (no install required):
```bash
npx amgr init
```

See [npm package](https://www.npmjs.com/package/amgr) for more details.

### Commands

#### `amgr` or `amgr sync`
Synchronize agent configurations based on the `.amgr/config.json` in the current directory.

```bash
# Run in a project directory containing .amgr/config.json
cd /path/to/my-project
amgr
```

**Process:**
1. Locate and parse `.amgr/config.json` in the current directory
2. Read `.amgr/amgr-lock.json` (if exists) to identify previously created files
3. Remove only amgr-created files (listed in lock file) from target directories
4. Compose content from the agents repository based on specified use-cases
5. Generate rulesync.jsonc with specified targets and features
6. Run `rulesync generate` to create tool-specific configurations
7. Copy generated configurations to appropriate directories:
   - `.claude/` for Claude Code
   - `.cursor/` for Cursor
   - `.github/copilot/` for GitHub Copilot
   - etc.
8. Update `.amgr/amgr-lock.json` with the list of all newly created files

**File Safety:**
- Only files tracked in the manifest are removed during sync
- Native files in target directories (`.claude/`, `.cursor/`, etc.) are never touched
- If a native file conflicts with an amgr file, amgr will skip that file and warn the user

#### `amgr init`
Initialize a new `.amgr/config.json` configuration file interactively.

```bash
cd /path/to/my-project
amgr init
```

**Process:**
1. Creates `.amgr/` directory if it doesn't exist
2. Prompts for configuration:
   - Select targets (multi-select)
   - Select features (multi-select)
   - Select use-cases (multi-select)
   - Configure advanced options (optional)
3. Creates `.amgr/config.json` with the selected configuration

#### `amgr list`
List available use-cases from configured sources.

```bash
amgr list
```

**Output (example):**
```
Available use-cases from configured sources:

Source: ~/Code/agents
  development   - Coding, debugging, testing, software engineering
  writing       - Documentation, content creation, technical writing

Source: https://github.com/company/rules
  company-dev   - Company-specific development rules
```

**Note:** Requires at least one source configured in `.amgr/config.json`. Run `amgr init` first if no config exists.

#### `amgr validate`
Validate the `.amgr/config.json` configuration file without syncing.

```bash
amgr validate
```

**Checks:**
- JSON syntax validity
- Required properties present
- Valid targets, features, and use-cases
- Options schema compliance

#### `amgr clean`
Remove all generated agent configuration files.

```bash
amgr clean
```

**Removes:**
- `.claude/` directory (or specific generated files)
- `.cursor/` directory (or specific generated files)
- Other tool-specific directories

#### `amgr detach`
Remove all amgr-created files and the lock file, leaving only native files in the target directories.

```bash
amgr detach
```

**Process:**
1. Read `.amgr/amgr-lock.json` to identify all amgr-created files
2. Remove only the files listed in the lock file
3. Remove empty directories that were created by amgr (if they contain no native files)
4. Remove `.amgr/amgr-lock.json`
5. Optionally remove `.amgr/config.json` and `.amgr/` directory (with confirmation prompt)

**Safety:**
- Only removes files tracked in the lock file
- Preserves all native files in target directories
- Does not remove `.amgr/config.json` unless explicitly confirmed
- Safe to run even if some lock file entries are missing

**Use Cases:**
- Removing amgr from a project while keeping native agent configurations
- Cleaning up before switching to manual configuration management
- Preparing a project for handoff without amgr dependencies

#### `amgr source`
Manage rules sources for your project. Sources can be local paths or Git URLs.

##### `amgr source add <url-or-path>`
Add a rules source to the project configuration.

```bash
amgr source add https://github.com/company/agent-rules
amgr source add ~/my-personal-agents
amgr source add ./local-rules
```

**Options:**
- `--position <index>` - Insert at specific position (default: append at end)
- `--name <name>` - Optional display name for the source

##### `amgr source remove <index-or-name>`
Remove a source from the project configuration.

```bash
amgr source remove 0              # Remove by index
amgr source remove company        # Remove by name
```

**Options:**
- `-f, --force` - Skip confirmation prompt

##### `amgr source list`
Show configured sources and their status.

```bash
amgr source list
amgr source list --verbose    # Show full URLs/paths
```

##### `amgr source update`
Manually refresh all Git sources (fetch latest changes).

```bash
amgr source update
```

#### `amgr repo`
Manage standalone amgr repositories. An amgr repo is a directory containing agent configurations that can be used as a source.

##### `amgr repo init`
Initialize a new amgr repository in the current directory.

```bash
amgr repo init
amgr repo init --name "my-agents" --description "My agent configs" --author "Your Name"
```

**Options:**
- `--name <name>` - Repository name (defaults to directory name)
- `--description <desc>` - Repository description
- `--author <author>` - Repository author

##### `amgr repo add <name>`
Add a new use-case to the repository.

```bash
amgr repo add development
amgr repo add development --description "Coding and debugging tasks"
```

**Options:**
- `--description <desc>` - Use-case description (prompted if not provided)

##### `amgr repo remove <name>`
Remove a use-case from the repository.

```bash
amgr repo remove development
amgr repo remove development --force    # Skip confirmation
```

**Options:**
- `-f, --force` - Skip confirmation prompt

##### `amgr repo list`
List use-cases in the current repository (requires `repo.json` in current directory).

```bash
amgr repo list
amgr repo list --verbose    # Show orphaned directories
```

### Flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--dry-run` | `-n` | Show what would be done without making changes |
| `--verbose` | `-v` | Enable verbose output |
| `--config <path>` | `-c` | Use a custom config file path (default: `.amgr/config.json`) |
| `--help` | `-h` | Show help message |
| `--version` | | Show version number |

## Configuration Templates

### Minimal Configuration
```json
{
  "sources": [
    { "type": "local", "path": "~/Code/agents" }
  ],
  "targets": ["claudecode"],
  "features": ["rules"],
  "use-cases": ["development"]
}
```

### Development Project
```json
{
  "sources": [
    { "type": "git", "url": "https://github.com/company/agent-rules" }
  ],
  "targets": ["claudecode", "cursor"],
  "features": ["rules", "ignore", "mcp", "commands", "skills"],
  "use-cases": ["development"]
}
```

### Full-Featured Project with Multiple Sources
```json
{
  "sources": [
    { "type": "git", "url": "https://github.com/company/agent-rules", "name": "company" },
    { "type": "local", "path": "~/my-personal-agents", "name": "personal" }
  ],
  "targets": ["claudecode", "cursor", "copilot"],
  "features": ["rules", "ignore", "mcp", "commands", "subagents", "skills"],
  "use-cases": ["development"],
  "options": {
    "simulateCommands": true,
    "modularMcp": true
  }
}
```

### Documentation Project
```json
{
  "sources": [
    { "type": "local", "path": "~/Code/agents" }
  ],
  "targets": ["claudecode"],
  "features": ["rules", "commands", "skills"],
  "use-cases": ["writing"]
}
```

### Multi-Purpose Project
```json
{
  "sources": [
    { "type": "local", "path": "~/Code/agents" }
  ],
  "targets": ["claudecode", "cursor"],
  "features": ["rules", "ignore", "mcp", "commands", "skills"],
  "use-cases": ["development", "writing"]
}
```

## How It Works

### Composition Process

```
.amgr/config.json in target project
           │
           ▼
┌──────────────────────────────────────────┐
│  1. Parse Configuration                   │
│     - Read targets, features, use-cases  │
│     - Read .amgr/amgr-lock.json (if exists)│
└──────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│  2. Clean Previous amgr Files            │
│     - Remove files listed in lock file    │
│     - Preserve native files              │
│     - Remove empty amgr-created dirs     │
└──────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│  3. Compose Content                       │
│     a. Copy shared/ content               │
│        (filtered by use-cases frontmatter)│
│     b. Overlay use-case specific content  │
│        (in order, later overrides earlier)│
└──────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│  4. Generate rulesync.jsonc              │
│     - Merge targets from config          │
│     - Merge features from config         │
│     - Apply options                       │
└──────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│  5. Run rulesync generate                │
│     - Process .rulesync/ directory       │
│     - Generate tool-specific outputs     │
└──────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│  6. Deploy to Target Project             │
│     - Copy .claude/ to project           │
│     - Copy .cursor/ to project           │
│     - Copy other tool directories        │
│     - Track all created files            │
└──────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│  7. Update Lock File                     │
│     - Record all created file paths      │
│     - Update lastSynced timestamp        │
│     - Write .amgr/amgr-lock.json         │
└──────────────────────────────────────────┘
```

### Directory Structure

**Source Repository (amgr repo):**
```
my-agents/
├── repo.json                  # Repository manifest (required)
├── shared/                    # Shared content (all use-cases)
│   ├── rules/
│   ├── commands/
│   ├── skills/
│   ├── subagents/
│   ├── mcp.json
│   └── .aiignore
└── use-cases/                 # Use-case specific content
    ├── development/           # Defined in repo.json
    ├── writing/
    └── my-custom-usecase/
```

**Target Project (after sync):**
```
my-project/
├── .amgr/                     # amgr configuration directory
│   ├── config.json            # Configuration file
│   └── amgr-lock.json         # File tracking lock file (git-ignored)
├── .claude/                   # Generated for Claude Code
│   ├── settings.json          # (amgr-managed)
│   ├── commands/              # (amgr-managed)
│   │   └── ...
│   └── custom-config.json     # (native file, preserved)
├── .cursor/                   # Generated for Cursor
│   ├── rules/                 # (amgr-managed)
│   └── local-settings.json    # (native file, preserved)
└── ...
```

### Content Filtering

Shared content is filtered based on frontmatter in markdown files:

```yaml
---
use-cases:
  - development
  - product
---
```

- Files with matching `use-cases` are included
- Files without `use-cases` property are included for all use-cases
- Files with `exclude-from-use-cases` property are excluded from those use-cases

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AMGR_CONFIG` | Override the default config file path (default: `.amgr/config.json`) |
| `AMGR_VERBOSE` | Enable verbose logging (`true`/`false`) |

## Global Sources

Global sources are configured in `~/.amgr/config.json` and are automatically available to all projects.

### Global Configuration File

**Location:** `~/.amgr/config.json`

**Schema:** `https://raw.githubusercontent.com/oztamir/amgr/main/schemas/amgr-global.schema.json`

**Structure:**
```json
{
  "$schema": "https://raw.githubusercontent.com/oztamir/amgr/main/schemas/amgr-global.schema.json",
  "globalSources": [
    { "type": "local", "path": "~/Code/agents", "name": "agents" }
  ]
}
```

### Global Source Commands

#### `amgr source add <url-or-path> --global`
Add a source to the global configuration.

```bash
amgr source add ~/Code/agents --global
amgr source add https://github.com/company/rules --global --name company
```

#### `amgr source remove <index-or-name> --global`
Remove a source from the global configuration.

```bash
amgr source remove 0 --global
amgr source remove agents --global
```

#### `amgr source list --global`
List only global sources.

```bash
amgr source list --global
```

#### `amgr source update --global`
Update only global git sources.

```bash
amgr source update --global
```

### Global Source Merge Behavior

During sync, global sources are merged with project sources:

1. **Default (prepend)**: Global sources come first, project sources override them
2. **Append mode**: Project sources come first, global sources override them

**Effective sources order with `prepend` (default):**
```
[global source 1] → [global source 2] → [project source 1] → [project source 2]
```

**Effective sources order with `append`:**
```
[project source 1] → [project source 2] → [global source 1] → [global source 2]
```

### Project-Level Options for Global Sources

Projects can control global source behavior in `.amgr/config.json`:

```json
{
  "options": {
    "ignoreGlobalSources": true,
    "globalSourcesPosition": "append"
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ignoreGlobalSources` | boolean | `false` | Ignore global sources for this project |
| `globalSourcesPosition` | string | `"prepend"` | Where to merge global sources: `"prepend"` or `"append"` |

## File Management

### Lock File

The `.amgr/amgr-lock.json` file tracks all files created by amgr. The entire `.amgr` directory should typically be added to `.gitignore` since it contains project-local state:

```gitignore
# amgr configuration and tracking
.amgr/
```

However, you may choose to commit `.amgr/config.json` (but not `amgr-lock.json`) if you want to share the configuration with your team while keeping the lock file local.

### Native File Handling

When amgr encounters a file that would be overwritten but is not in the lock file, it will:
1. Skip creating/updating that file
2. Warn the user about the conflict
3. Continue with other files

To resolve conflicts:
- **Option 1**: Manually remove or rename the native file, then re-run `amgr sync`
- **Option 2**: Add the file to `.amgr/amgr-lock.json` if you want amgr to manage it (not recommended)
- **Option 3**: Exclude the conflicting feature/target from your `.amgr/config.json` configuration

## Error Handling

### Missing Configuration
```
Error: No .amgr/config.json found in current directory.
Run 'amgr init' to create one.
```

### Invalid Target
```
Error: Invalid target 'unknown' in .amgr/config.json.
Valid targets: claudecode, cursor, copilot, geminicli, cline, codex, opencode
```

### Invalid Use-Case
```
Error: Use-case 'unknown' not found in any configured source.
Run 'amgr list' to see available use-cases from your sources.
```

### No Sources Configured
```
Error: No sources configured in .amgr/config.json.
Add at least one source using 'amgr source add <url-or-path>' or run 'amgr init'.
```

### File Conflicts
```
Warning: File conflict detected: .claude/settings.json
This file exists but is not tracked in .amgr/amgr-lock.json.
Skipping to preserve native file. Remove or rename the file to allow amgr to manage it.
```

### Lock File Corruption
```
Error: Invalid .amgr/amgr-lock.json format.
The lock file appears to be corrupted. You may need to:
1. Delete .amgr/amgr-lock.json and run 'amgr sync' to recreate it
2. Or run 'amgr detach' to clean up and start fresh
```

## Schema Validation

The `.amgr/config.json` file can be validated against the JSON schema:

```json
{
  "$schema": "https://raw.githubusercontent.com/oztamir/amgr/main/schemas/amgr.schema.json",
  ...
}
```

### JSON Schema Definition

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["targets", "features", "use-cases"],
  "properties": {
    "sources": {
      "type": "array",
      "description": "Required for sync. Array of source repositories containing agent configurations.",
      "items": {
        "oneOf": [
          { "type": "string" },
          {
            "type": "object",
            "properties": {
              "type": { "type": "string", "enum": ["git", "local"] },
              "url": { "type": "string" },
              "path": { "type": "string" },
              "name": { "type": "string" }
            },
            "required": ["type"]
          }
        ]
      }
    },
    "targets": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["*", "claudecode", "cursor", "copilot", "geminicli", "cline", "codex", "opencode"]
      },
      "minItems": 1
    },
    "features": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["rules", "ignore", "mcp", "commands", "subagents", "skills"]
      },
      "minItems": 1
    },
    "use-cases": {
      "type": "array",
      "description": "Use-case identifiers. Valid values come from configured sources.",
      "items": { "type": "string" },
      "minItems": 1
    },
    "options": {
      "type": "object",
      "properties": {
        "simulateCommands": { "type": "boolean", "default": false },
        "simulateSubagents": { "type": "boolean", "default": false },
        "simulateSkills": { "type": "boolean", "default": false },
        "modularMcp": { "type": "boolean", "default": false }
      },
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}
```

## Future Considerations

### Potential Enhancements
- **Remote agents repository**: Support fetching from a git URL
- **Version pinning**: Lock to specific agents repository versions
- **Custom use-cases**: Define project-specific use-cases in `.amgr/config.json`
- **Selective sync**: Only sync specific features or tools
- **Watch mode**: Auto-sync when agents repository changes
- **Diff mode**: Show changes before applying
- **Lock file versioning**: Track file versions and changes over time
- **Conflict resolution**: Interactive prompts to resolve file conflicts
- **Backup mode**: Create backups of native files before overwriting (if explicitly allowed)

### Integration Points
- **Git hooks**: Auto-sync on checkout/pull
- **CI/CD**: Validate `.amgr/config.json` in pipelines
- **IDE extensions**: Visual configuration editor
