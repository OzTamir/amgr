# amgr Usage Guide

This guide covers how to use amgr to manage AI agent configurations across your projects.

## Installation

```bash
npm install -g amgr
```

Or with npx (no install required):
```bash
npx amgr init
```

See [npm package](https://www.npmjs.com/package/amgr) for more details.

Verify installation:

```bash
amgr --version
amgr --help
```

## Quick Start

### 1. Initialize a Project

```bash
cd /path/to/your-project
amgr init
```

Follow the interactive prompts to:
1. Add sources (git URLs or local paths to agent configs)
2. Select target AI tools (claudecode, cursor, etc.)
3. Select features to include (rules, commands, skills, etc.)
4. Choose use-cases from your sources

### 2. Sync Configurations

```bash
amgr sync
```

This will:
- Fetch/update sources
- Compose content from your selected use-cases
- Generate tool-specific configurations
- Deploy files to your project

### 3. View Available Options

```bash
amgr list
```

Shows configured sources and available use-cases.

## Commands Reference

### `amgr sync` (Default Command)

Synchronize agent configurations to your project.

```bash
amgr sync                    # Standard sync
amgr sync --dry-run          # Preview without changes
amgr sync --verbose          # Show detailed output
amgr sync --config ./custom.json  # Use custom config path
```

**What it does:**
1. Loads `.amgr/config.json`
2. Resolves sources (clones/pulls git repos)
3. Removes previously tracked files
4. Composes content from sources
5. Runs rulesync to generate configs
6. Deploys files to `.claude/`, `.cursor/`, etc.
7. Updates lock file

### `amgr init`

Create a new configuration interactively.

```bash
amgr init
amgr init --verbose
```

If a config already exists, prompts for confirmation to overwrite.

### `amgr list`

List available use-cases from configured sources.

```bash
amgr list                # Show sources and use-cases
amgr list --verbose      # Also show available targets and features
```

### `amgr validate`

Check configuration validity without syncing.

```bash
amgr validate
amgr validate --verbose  # Show configuration summary
```

### `amgr clean`

Remove all amgr-generated files.

```bash
amgr clean
amgr clean --dry-run     # Preview what would be removed
amgr clean --verbose     # Show each file removed
```

Only removes files tracked in the lock file. Native files are preserved.

### `amgr detach`

Completely remove amgr from a project.

```bash
amgr detach
amgr detach --dry-run
```

This command:
1. Removes all tracked files
2. Deletes the lock file
3. Optionally removes `.amgr/config.json` and `.amgr/` directory

### `amgr source` - Source Management

#### Add a Source

```bash
amgr source add https://github.com/company/agent-rules
amgr source add ~/my-personal-agents
amgr source add ./local-rules
amgr source add https://github.com/team/rules --name company
amgr source add ~/agents --position 0  # Insert at beginning
```

#### Remove a Source

```bash
amgr source remove 0          # By index
amgr source remove company    # By name
amgr source remove 1 --force  # Skip confirmation
```

#### List Sources

```bash
amgr source list
amgr source list --verbose    # Show full URLs/paths
```

#### Update Sources

```bash
amgr source update    # Refresh all git sources
```

## Global Sources

Global sources are configured once and automatically available to all projects. This is ideal for personal agent configurations you use across many projects.

### Global Sources Configuration

Global sources are stored in `~/.amgr/config.json`:

```json
{
  "globalSources": [
    { "type": "local", "path": "~/Code/agents", "name": "agents" }
  ]
}
```

### Managing Global Sources

#### Add a Global Source

```bash
amgr source add ~/Code/my-agents --global
amgr source add https://github.com/company/rules --global --name company
```

#### Remove a Global Source

```bash
amgr source remove 0 --global          # By index
amgr source remove agents --global     # By name
```

#### List Global Sources

```bash
amgr source list --global              # Show only global sources
amgr source list                       # Show both global and project sources
```

#### Update Global Sources

```bash
amgr source update --global            # Update only global git sources
amgr source update                     # Update all git sources
```

### How Global Sources Merge with Project Sources

By default, global sources are prepended to project sources:

```
Effective order: [global sources...] → [project sources...]
```

This means project sources override global sources when files conflict.

### Project-Level Control

Projects can control how global sources are handled in `.amgr/config.json`:

```json
{
  "options": {
    "ignoreGlobalSources": false,
    "globalSourcesPosition": "prepend"
  }
}
```

| Option | Values | Description |
|--------|--------|-------------|
| `ignoreGlobalSources` | `true`/`false` (default: `false`) | Ignore global sources for this project |
| `globalSourcesPosition` | `"prepend"` (default) / `"append"` | Where to merge global sources |

**Position behavior:**
- `"prepend"`: Global sources first, then project sources (project overrides global)
- `"append"`: Project sources first, then global sources (global overrides project)

### Example: Personal + Company Sources

**Global config (`~/.amgr/config.json`):**
```json
{
  "globalSources": [
    { "type": "local", "path": "~/Code/my-agents", "name": "personal" }
  ]
}
```

**Project config (`.amgr/config.json`):**
```json
{
  "sources": [
    { "type": "git", "url": "https://github.com/company/rules", "name": "company" }
  ],
  "targets": ["claudecode"],
  "features": ["rules"],
  "use-cases": ["development"]
}
```

**Effective sources (in order):**
1. `personal` (global, from ~/.amgr/config.json)
2. `company` (project, from .amgr/config.json)

Company rules override personal rules when paths conflict.

### `amgr repo` - Repository Management

For managing amgr source repositories.

#### Initialize a Repository

```bash
cd my-agents-repo
amgr repo init
amgr repo init --name "my-agents" --description "Personal agent configs"
```

Creates:
```
my-agents-repo/
├── repo.json
├── shared/
│   ├── rules/
│   ├── commands/
│   ├── skills/
│   └── subagents/
└── use-cases/
```

#### Add a Use-Case

```bash
amgr repo add development
amgr repo add development --description "Coding and debugging"
```

Creates:
```
use-cases/development/
├── .rulesync/
│   ├── rules/
│   ├── commands/
│   ├── skills/
│   └── subagents/
└── rulesync.jsonc
```

#### Remove a Use-Case

```bash
amgr repo remove development
amgr repo remove development --force
```

#### List Use-Cases

```bash
amgr repo list
amgr repo list --verbose  # Show orphaned directories
```

## Configuration

Configuration lives in `.amgr/config.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/oztamir/amgr/main/schemas/amgr.schema.json",
  "sources": [
    { "type": "git", "url": "https://github.com/company/agent-rules" },
    { "type": "local", "path": "~/my-personal-agents" }
  ],
  "targets": ["claudecode", "cursor"],
  "features": ["rules", "commands", "skills"],
  "use-cases": ["development"]
}
```

### Sources

Define where agent configurations come from. Later sources override earlier ones.

**Git source:**
```json
{ "type": "git", "url": "https://github.com/company/rules", "name": "company" }
```

**Local source:**
```json
{ "type": "local", "path": "~/my-agents", "name": "personal" }
```

**Shorthand (type auto-detected):**
```json
"https://github.com/company/rules"
"~/my-agents"
```

### Targets

AI tools to generate configurations for:

| Target | Description |
|--------|-------------|
| `claudecode` | Claude Code (Anthropic's CLI) |
| `cursor` | Cursor IDE |
| `copilot` | GitHub Copilot |
| `geminicli` | Gemini CLI |
| `cline` | Cline VS Code extension |
| `codex` | OpenAI Codex CLI |
| `opencode` | OpenCode |
| `*` | All targets |

### Features

Content types to include:

| Feature | Description |
|---------|-------------|
| `rules` | General guidelines and instructions |
| `ignore` | File patterns to exclude from AI context |
| `mcp` | MCP server configurations |
| `commands` | Slash commands (e.g., /commit) |
| `subagents` | Specialized AI assistant definitions |
| `skills` | Directory-based capability definitions |

### Use-Cases

Identifiers that map to folders in your sources. Examples:
- `development` - Coding, debugging, testing
- `writing` - Documentation, content creation
- `product` - Product management tasks

### Options

Advanced configuration options:

```json
{
  "options": {
    "simulateCommands": true,
    "simulateSubagents": true,
    "simulateSkills": true,
    "modularMcp": true
  }
}
```

| Option | Description |
|--------|-------------|
| `simulateCommands` | Generate simulated commands for tools without native support |
| `simulateSubagents` | Generate simulated subagents for tools without native support |
| `simulateSkills` | Generate simulated skills for tools without native support |
| `modularMcp` | Enable modular-mcp for Claude Code (reduces token usage) |

## Multi-Source Workflows

### Company + Personal Pattern

Layer personal overrides on top of company-wide rules:

```json
{
  "sources": [
    { "type": "git", "url": "https://github.com/company/agent-rules", "name": "company" },
    { "type": "local", "path": "~/my-overrides", "name": "personal" }
  ],
  "targets": ["claudecode", "cursor"],
  "features": ["rules", "commands", "skills"],
  "use-cases": ["development"]
}
```

Content from `personal` source overrides `company` when files have the same path.

### Multiple Teams Pattern

Combine configurations from different team repos:

```json
{
  "sources": [
    { "type": "git", "url": "https://github.com/org/base-rules" },
    { "type": "git", "url": "https://github.com/frontend-team/rules" },
    { "type": "git", "url": "https://github.com/backend-team/rules" }
  ]
}
```

### Local Development Pattern

Use a local repo during development:

```json
{
  "sources": [
    { "type": "local", "path": "./agent-rules" }
  ]
}
```

## Common Use Cases

### Setting Up a New Project

```bash
cd my-project
amgr init
# Select sources, targets, features, use-cases
amgr sync
```

### Adding a Source Later

```bash
amgr source add https://github.com/team/new-rules
amgr sync  # Re-sync to apply
```

### Previewing Changes

```bash
amgr sync --dry-run --verbose
```

### Updating After Source Changes

```bash
amgr source update  # Fetch latest from git sources
amgr sync           # Re-apply configurations
```

### Removing amgr From a Project

```bash
amgr detach
# Choose whether to keep or remove .amgr/config.json
```

### Creating Your Own Agent Repository

```bash
mkdir my-agents
cd my-agents
amgr repo init --name "my-agents"
amgr repo add development --description "Development use-case"
# Add rules to shared/rules/ and use-cases/development/.rulesync/rules/
```

## Troubleshooting

### "No sources configured"

Add at least one source:
```bash
amgr source add ~/my-agents
# or
amgr source add https://github.com/user/agents
```

### "Use-case 'X' not found"

The use-case doesn't exist in any configured source. Check available use-cases:
```bash
amgr list
```

### "Not a valid amgr repo"

The source path doesn't contain a `repo.json`. Initialize it:
```bash
cd /path/to/source
amgr repo init
```

### Files Not Updating

Check if files are tracked vs native:
```bash
cat .amgr/amgr-lock.json
```

Native files (not in lock file) are never modified by amgr.

### Git Source Not Updating

Force refresh:
```bash
amgr source update
```

Or check the cache:
```bash
ls -la ~/.amgr/cache/
```

### File Conflicts

If you see "File conflict detected", the file exists but isn't tracked by amgr:
- Remove or rename the conflicting file
- Run `amgr sync` again

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AMGR_CONFIG` | Override the config file path |
| `AMGR_VERBOSE` | Enable verbose logging (`true`/`false`) |

Example:
```bash
AMGR_VERBOSE=true amgr sync
```

## File Structure After Sync

```
my-project/
├── .amgr/
│   ├── config.json      # Your configuration
│   └── amgr-lock.json   # Tracked files (gitignore this)
├── .claude/             # Generated for Claude Code
│   ├── settings.json
│   └── commands/
├── .cursor/             # Generated for Cursor
│   └── rules/
└── .github/copilot/     # Generated for Copilot
    └── instructions.md
```

## Recommended .gitignore

```gitignore
# amgr lock file (project-local state)
.amgr/amgr-lock.json

# Or ignore entire directory
.amgr/
```

Consider committing `.amgr/config.json` if you want to share configuration with your team.
