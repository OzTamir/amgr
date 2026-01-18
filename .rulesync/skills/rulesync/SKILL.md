---
name: rulesync
description: >-
  Manage rulesync - a CLI tool that generates AI tool configurations from unified rule files.
  Use when working with rulesync.jsonc, generating configs, importing existing configs, or managing
  rules, commands, subagents, and skills across multiple AI tools.
targets: ["*"]
use-cases: ["development", "bootstrap"]
claudecode:
  allowed-tools:
    - "Bash"
    - "Read"
    - "Write"
    - "Edit"
    - "Grep"
    - "Glob"
---

# Rulesync Skill

Rulesync is a CLI tool that automatically generates configuration files for various AI development tools from unified AI rule files. It enables maintaining consistent AI coding assistant rules across multiple tools.

## Key Commands

### Initialize a New Project
```bash
npx rulesync init
```
Creates directories, sample rule files, and a `rulesync.jsonc` configuration file.

### Import Existing Configurations
```bash
# Import from specific tools
npx rulesync import --targets claudecode
npx rulesync import --targets cursor
npx rulesync import --targets copilot

# Import specific features
npx rulesync import --targets claudecode --features rules,mcp,commands,subagents,skills
```

### Generate Configurations
```bash
# Generate all features for all tools
npx rulesync generate --targets "*" --features "*"

# Generate specific features for specific tools
npx rulesync generate --targets copilot,cursor,cline --features rules,mcp
npx rulesync generate --targets claudecode --features rules,subagents

# Generate simulated commands/subagents for tools that don't natively support them
npx rulesync generate --targets copilot,cursor --features commands,subagents --simulate-commands --simulate-subagents
```

### Add Generated Files to .gitignore
```bash
npx rulesync gitignore
```

## Configuration File (rulesync.jsonc)

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/dyoshikawa/rulesync/refs/heads/main/config-schema.json",

  // Tools to generate for ("*" for all)
  "targets": ["cursor", "claudecode", "geminicli", "copilot"],

  // Features to generate ("*" for all)
  "features": ["rules", "ignore", "mcp", "commands", "subagents", "skills"],

  // Base directories (usually ["."])
  "baseDirs": ["."],

  // Delete existing files before generating
  "delete": true,

  // Advanced options
  "global": false,              // Generate for global/user scope
  "simulateCommands": false,    // Generate simulated commands
  "simulateSubagents": false,   // Generate simulated subagents
  "simulateSkills": false,      // Generate simulated skills
  "modularMcp": false           // Enable modular-mcp for context compression (Claude Code only)
}
```

## Directory Structure

```
.rulesync/
├── rules/*.md           # Rule files (merged into tool configs)
├── commands/*.md        # Command definitions
├── subagents/*.md       # Subagent definitions
├── skills/*/SKILL.md    # Skill definitions (directory-based)
├── mcp.json             # MCP server configurations
└── .aiignore            # Ignore patterns
```

## File Formats

### Rules (.rulesync/rules/*.md)

```markdown
---
root: true                    # true for overview files, false for details
targets: ["*"]                # * = all, or specific tools
description: "Project overview"
globs: ["**/*"]               # File patterns to match
cursor:                       # Tool-specific parameters
  alwaysApply: true
---

# Your Rule Content

Instructions, guidelines, and context for AI tools...
```

### Commands (.rulesync/commands/*.md)

```markdown
---
description: "What this command does"
targets: ["*"]
---

Instructions for executing this command...
Use $ARGUMENTS to access command arguments.
```

### Subagents (.rulesync/subagents/*.md)

```markdown
---
name: agent-name
targets: ["*"]
description: "What this agent does"
claudecode:
  model: inherit    # opus, sonnet, haiku, or inherit
---

You are a specialized agent that...
```

### Skills (.rulesync/skills/*/SKILL.md)

```markdown
---
name: skill-name
description: "What this skill does"
targets: ["*"]
---

Skill instructions and content...
```

### MCP Configuration (.rulesync/mcp.json)

```json
{
  "mcpServers": {
    "server-name": {
      "description": "What this server provides",
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "package-name"],
      "env": {}
    }
  }
}
```

## Supported Tools

| Tool               | rules | ignore | mcp | commands | subagents | skills |
|--------------------|:-----:|:------:|:---:|:--------:|:---------:|:------:|
| Claude Code        |   ✅  |   ✅   | ✅  |    ✅    |    ✅     |   ✅   |
| Cursor             |   ✅  |   ✅   | ✅  |    ✅    |    -      |   ✅   |
| GitHub Copilot     |   ✅  |   -    | ✅  |    ✅    |    ✅     |   ✅   |
| Gemini CLI         |   ✅  |   ✅   | ✅  |    ✅    |    -      |   -    |
| Cline              |   ✅  |   ✅   | ✅  |    ✅    |    -      |   -    |
| Codex CLI          |   ✅  |   -    | ✅  |    ✅    |    -      |   ✅   |
| OpenCode           |   ✅  |   -    | ✅  |    ✅    |    ✅     |   ✅   |

## Global Mode

For user-scope configurations (e.g., in ~/.aiglobal):

```jsonc
{
  "global": true,
  "features": ["rules", "commands"]
}
```

## Best Practices

1. **Single Source of Truth**: Keep all rules in `.rulesync/` and generate tool-specific configs
2. **Use Targets Wisely**: Specify `targets: ["*"]` for universal rules, or list specific tools
3. **Leverage Frontmatter**: Use tool-specific frontmatter sections for tool-specific behavior
4. **Simulated Features**: Use `--simulate-commands` for tools that don't natively support commands
5. **Modular MCP**: Enable `modularMcp: true` for Claude Code to reduce token usage

## Troubleshooting

- **MCP not working**: Add `"enableAllProjectMcpServers": true` to `.claude/settings.json`
- **Files not generating**: Check that targets and features are correctly specified
- **Conflicts**: When multiple targets write to the same file, the last target in the array wins
