# amgr Glossary

This document defines key terms and concepts used in amgr.

## Core Concepts

### Source

A repository or directory containing agent configurations that can be used by amgr.

**Types:**
- **Git source**: A remote repository accessed via git URL (e.g., `https://github.com/company/agent-rules`)
- **Local source**: A directory on the local filesystem (e.g., `~/my-agents` or `./local-rules`)

**Structure:**
```
source-repo/
├── repo.json          # Required: repository manifest
├── shared/            # Content included for all use-cases
│   ├── rules/
│   ├── commands/
│   ├── skills/
│   └── subagents/
└── use-cases/         # Use-case specific content
    ├── development/
    └── writing/
```

**Related:** See [Source Layering](#source-layering)

---

### Target

An AI tool that receives generated configurations. Each target has its own directory structure and file format requirements.

**Supported targets:**

| Target | Output Directory | Description |
|--------|------------------|-------------|
| `claudecode` | `.claude/` | Claude Code (Anthropic's CLI) |
| `cursor` | `.cursor/` | Cursor IDE |
| `copilot` | `.github/copilot/` | GitHub Copilot |
| `geminicli` | `.gemini/` | Gemini CLI |
| `cline` | `.cline/` | Cline VS Code extension |
| `codex` | `.codex/` | OpenAI Codex CLI |
| `opencode` | `.opencode/` | OpenCode |

**Special value:** `*` selects all targets

---

### Feature

A type of content that can be synced to targets. Not all features are supported by all targets.

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
| claudecode | Yes | Yes | Yes | Yes | Yes | Yes |
| cursor | Yes | Yes | Yes | Yes | No | Yes |
| copilot | Yes | No | Yes | Yes | Yes | Yes |
| geminicli | Yes | Yes | Yes | Yes | No | No |
| cline | Yes | Yes | Yes | Yes | No | No |
| codex | Yes | No | Yes | Yes | No | Yes |
| opencode | Yes | No | Yes | Yes | Yes | Yes |

---

### Use-Case

A named configuration set that groups related content. Use-cases are defined in source repositories and referenced in project configs.

**Examples:**
- `development` - Coding, debugging, testing
- `writing` - Documentation, content creation
- `product` - Product management tasks

**Structure in source:**
```
use-cases/
└── development/
    ├── .rulesync/
    │   ├── rules/
    │   ├── commands/
    │   ├── skills/
    │   └── subagents/
    └── rulesync.jsonc
```

**Defined in:** Source's `repo.json`:
```json
{
  "use-cases": {
    "development": {
      "description": "Coding, debugging, and testing"
    }
  }
}
```

---

### Lock File

A JSON file (`.amgr/amgr-lock.json`) that tracks all files created by amgr in a project.

**Purpose:**
- Distinguish amgr-created files from native files
- Enable safe updates (only modify tracked files)
- Support clean removal without affecting native files

**Structure:**
```json
{
  "version": "1.0.0",
  "created": "2024-01-15T10:30:00Z",
  "lastSynced": "2024-01-20T14:22:00Z",
  "files": [
    ".claude/settings.json",
    ".claude/commands/commit.md",
    ".cursor/rules/development.mdc"
  ]
}
```

**Best practice:** Add to `.gitignore` (project-local state)

---

### rulesync

An external tool that generates target-specific configurations from a common format. amgr uses rulesync as its generation engine.

**Role in amgr:**
1. amgr composes content into a `.rulesync/` directory
2. amgr generates `rulesync.jsonc` with targets and features
3. amgr calls `npx rulesync generate`
4. rulesync creates `.claude/`, `.cursor/`, etc.

**Project:** [github.com/dyoshikawa/rulesync](https://github.com/dyoshikawa/rulesync)

---

## Secondary Concepts

### Source Layering

The mechanism by which multiple sources are applied in order, with later sources overriding earlier ones.

**Example:**
```json
{
  "sources": [
    { "type": "git", "url": "https://github.com/company/rules" },  // Base
    { "type": "local", "path": "~/my-overrides" }                  // Overrides
  ]
}
```

Files from `my-overrides` take precedence when paths match.

---

### Native File

A file in a target directory (`.claude/`, `.cursor/`, etc.) that was NOT created by amgr.

**Behavior:**
- Never modified by amgr
- Never deleted by amgr
- Causes a conflict warning if amgr would create the same file

---

### Tracked File

A file that amgr created and is listed in the lock file.

**Behavior:**
- Updated during sync
- Deleted during clean/detach
- Replaced if the source changes

---

### Git Cache

The local directory (`~/.amgr/cache/`) where git sources are cloned.

**Structure:**
```
~/.amgr/
└── cache/
    ├── github.com-company-agent-rules/
    └── github.com-user-my-agents/
```

**Behavior:**
- Created on first use of a git source
- Updated (pulled) automatically during sync
- Manually refreshed via `amgr source update`

---

### Config File

The project configuration file (`.amgr/config.json`) that defines sources, targets, features, and use-cases.

**Location:** `<project>/.amgr/config.json`

**Schema:** `https://raw.githubusercontent.com/oztamir/amgr/main/schemas/amgr.schema.json`

---

### Repo Config

The repository manifest file (`repo.json`) in an amgr source repository.

**Location:** `<source>/repo.json`

**Schema:** `https://raw.githubusercontent.com/oztamir/amgr/main/schemas/amgr-repo.schema.json`

**Required properties:**
- `name` - Repository name
- `use-cases` - Object mapping use-case names to descriptions

---

### Shared Content

Content in a source's `shared/` directory that applies to all use-cases.

**Filtering:** Shared content can be tagged with use-cases via YAML frontmatter:
```yaml
---
use-cases:
  - development
  - product
---
```

Only included when the frontmatter matches the config's use-cases.

---

### Frontmatter

YAML metadata at the beginning of markdown files, used for filtering.

**Include for specific use-cases:**
```yaml
---
use-cases:
  - development
---
```

**Exclude from specific use-cases:**
```yaml
---
exclude-from-use-cases:
  - writing
---
```

---

### Composition

The process of merging content from shared directories and use-case directories into a single output.

**Order:**
1. Copy `shared/` content (filtered by frontmatter)
2. Overlay `use-cases/<name>/.rulesync/` content
3. Repeat for each use-case (later overrides earlier)
4. Repeat for each source (later overrides earlier)

---

### Deployment

The process of copying generated files to the target project's directories.

**Steps:**
1. Check each file against the lock file
2. Skip files that conflict with native files
3. Copy files to appropriate target directories
4. Update the lock file with deployed files

---

## Abbreviations

| Abbreviation | Meaning |
|--------------|---------|
| MCP | Model Context Protocol |
| CLI | Command Line Interface |
| URL | Uniform Resource Locator |

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design and module descriptions
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Contributing and development setup
- [USAGE.md](./USAGE.md) - End-user guide with examples
