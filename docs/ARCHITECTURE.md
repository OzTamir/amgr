# amgr Architecture

This document describes the system architecture and design decisions of `amgr`, a CLI tool for managing AI agent configurations across projects.

## High-Level Overview

```
                                    USER
                                      |
                                      v
                              +---------------+
                              |   amgr CLI    |
                              |  (index.js)   |
                              +---------------+
                                      |
           +----------+---------------+---------------+----------+
           |          |               |               |          |
           v          v               v               v          v
      +--------+  +--------+    +---------+    +--------+  +--------+
      |  init  |  |  sync  |    |  list   |    | source |  |  repo  |
      +--------+  +--------+    +---------+    +--------+  +--------+
           |          |               |               |          |
           +----------+-------+-------+---------------+----------+
                              |
                              v
                      +---------------+
                      |  lib modules  |
                      +---------------+
                              |
        +----------+----------+----------+----------+
        |          |          |          |          |
        v          v          v          v          v
    +------+  +-------+  +-------+  +------+  +------+
    |config|  |sources|  |compose|  |deploy|  | lock |
    +------+  +-------+  +-------+  +------+  +------+
                              |
                              v
                      +---------------+
                      |   rulesync    |
                      | (external)    |
                      +---------------+
```

## Data Flow

The primary data flow during a sync operation:

```
1. CONFIG LOADING
   .amgr/config.json --> config.js --> validated config object

2. SOURCE RESOLUTION  
   config.sources --> sources.js --> resolved local paths
       |                                    |
       v                                    v
   git URLs -----> clone/pull -----> ~/.amgr/cache/
   local paths --> validate --> expanded absolute paths

3. PROFILE EXPANSION
   config.profiles --> sources.js --> expanded profiles
       |
       v
   "development:*" --> ["development:frontend", "development:backend"]
   "development" (nested) --> ["development:frontend", "development:backend"]
   "writing" (flat) --> ["writing"]

4. CONTENT COMPOSITION
   resolved sources --> compose.js --> temp/.rulesync/
       |
       +-- For nested profiles (e.g., development:frontend):
       |     +-- /shared/ (filtered by "development" OR "development:frontend")
       |     +-- /development/_shared/ (filtered by "frontend")
       |     +-- /development/frontend/.rulesync/ (all content)
       |
       +-- For flat profiles (e.g., writing):
             +-- /shared/ (filtered by "writing")
             +-- /writing/.rulesync/ OR /use-cases/writing/.rulesync/

5. RULESYNC GENERATION
   temp/.rulesync/ --> rulesync --> temp/.claude/, temp/.cursor/, etc.

6. DEPLOYMENT
   temp/.claude/, etc. --> deploy.js --> project/.claude/, etc.
                               |
                               +--> .amgr/amgr-lock.json (tracking)
```

## Directory Structure

```
amgr/
├── src/
│   ├── index.js           # CLI entry point (Commander.js setup)
│   ├── commands/          # Command implementations
│   │   ├── init.js        # Interactive config initialization
│   │   ├── sync.js        # Main sync orchestration
│   │   ├── list.js        # List available use-cases
│   │   ├── validate.js    # Config validation
│   │   ├── clean.js       # Remove tracked files
│   │   ├── detach.js      # Remove amgr from project
│   │   ├── source.js      # Source management (add/remove/list/update)
│   │   └── repo.js        # Repo management (init/add/remove/list)
│   └── lib/               # Core library modules
│       ├── config.js      # Config loading, validation, manipulation
│       ├── sources.js     # Source resolution (git/local), caching
│       ├── compose.js     # Content composition from sources
│       ├── deploy.js      # File deployment to target project
│       ├── lock.js        # Lock file management
│       ├── constants.js   # Shared constants and defaults
│       ├── utils.js       # Utility functions (frontmatter, logging)
│       └── repo-config.js # repo.json management
├── schemas/               # JSON schemas for validation
│   ├── amgr.schema.json       # .amgr/config.json schema
│   └── amgr-repo.schema.json  # repo.json schema
├── docs/                  # Documentation
└── package.json           # Dependencies and CLI binary definition
```

## Core Modules

### `src/index.js` - CLI Entry Point

Defines all CLI commands using Commander.js. Registers command handlers and global options.

**Key responsibilities:**
- Parse command-line arguments
- Route to appropriate command handlers
- Provide `--help` and `--version`

### `src/lib/config.js` - Configuration Management

Handles loading, validating, and saving `.amgr/config.json` files.

**Key functions:**
- `loadConfig(projectPath)` - Load and parse config JSON
- `validateConfig(config)` - Validate against schema rules
- `loadAndValidateConfig()` - Combined load + validate
- `saveConfig()` - Write config to disk
- `hasSources()` - Check if sources are configured
- `addSourceToConfig()` / `removeSourceFromConfig()` - Manipulate sources array
- `expandTargets()` - Expand `"*"` to all valid targets
- `getEffectiveOptions()` - Merge user options with defaults

### `src/lib/sources.js` - Source Resolution

Handles resolution of git URLs and local paths to usable local directories.

**Key functions:**
- `parseSource(source)` - Normalize string or object to source object
- `detectSourceType(source)` - Determine if git URL or local path
- `resolveSource(source)` - Convert source to local path (clone if git)
- `resolveSources(sources)` - Resolve array of sources
- `fetchGitSource(url)` - Clone or pull git repository
- `getGitCachePath(url)` - Generate cache directory name from URL
- `getCombinedUseCases(sources)` - Aggregate use-cases from all sources (legacy)
- `getCombinedProfiles(sources)` - Aggregate profiles (including nested) from all sources
- `validateSources(sources)` - Validate sources array structure

**Profile handling functions:**
- `parseProfileSpec(spec)` - Parse "development:frontend" → `{ parent: "development", sub: "frontend", isWildcard: false }`
- `isNestedProfile(name, repoConfig)` - Check if profile has sub-profiles
- `getSubProfiles(name, repoConfig)` - Get sub-profile names for a parent
- `expandProfiles(profiles, repoConfig)` - Expand wildcards and bare parent names
- `getSourceProfiles(source)` - Get profiles from a resolved source

**Git caching:**
- Git sources are cached in `~/.amgr/cache/`
- Cache directory names are normalized from URLs (e.g., `github.com-user-repo`)
- On sync: automatically pulls latest (or clones if not cached)
- On source update: explicitly fetches all git sources

### `src/lib/compose.js` - Content Composition

Merges content from multiple sources into a single `.rulesync/` directory.

**Key functions:**
- `compose(options)` - Main composition orchestrator (legacy use-cases)
- `composeWithProfiles(options)` - Profile-based composition (supports nested profiles)
- `generateRulesyncConfig()` - Create rulesync.jsonc with targets/features
- `writeRulesyncConfig()` - Write generated config to disk
- `composeFromSource()` - Process single source (shared + use-cases)
- `composeFromSourceWithProfiles()` - Process single source with profile support
- `copySharedEntityDir()` - Copy with frontmatter filtering
- `copyFilteredEntityDir()` - Copy with scope-aware profile filtering
- `copyGlobalShared()` - Copy `/shared/` with global scope
- `copyParentShared()` - Copy `/parent/_shared/` with parent scope
- `copySubProfileContent()` - Copy `/parent/sub/.rulesync/`
- `copyFlatProfileContent()` - Copy from `/profile/.rulesync/` or `/use-cases/profile/.rulesync/`
- `detectProfileType(sourcePath, profileName)` - Returns 'flat' or 'nested'

**Composition process for profiles:**
1. Clean output directory
2. For each source (in order):
   - For each profile:
     - If nested (e.g., `development:frontend`):
       1. Copy `shared/` filtered by "development" OR "development:frontend"
       2. Copy `development/_shared/` filtered by "frontend"
       3. Copy `development/frontend/.rulesync/` (all content)
     - If flat (e.g., `writing`):
       1. Copy `shared/` filtered by "writing"
       2. Copy `writing/.rulesync/` or `use-cases/writing/.rulesync/`
3. Later sources override earlier sources (layering)

### `src/lib/deploy.js` - File Deployment

Copies generated files to the target project while handling conflicts.

**Key functions:**
- `deploy(options)` - Deploy generated files
- `getGeneratedTargetDirs()` - Find which target dirs exist
- `getFilesToDeploy()` - List all files to be deployed
- `checkConflicts()` - Find conflicts with native files

**Conflict handling:**
- Files tracked in lock file: replaced
- Files not tracked (native): skipped with warning
- Empty directories: cleaned up after file removal

### `src/lib/lock.js` - Lock File Management

Tracks files created by amgr to distinguish from user's native files.

**Key functions:**
- `readLockFile(projectPath)` - Parse existing lock file
- `writeLockFile(projectPath, files)` - Save tracked files
- `getTrackedFiles(projectPath)` - Get list of tracked files
- `removeTrackedFiles(projectPath)` - Delete tracked files
- `deleteLockFile(projectPath)` - Remove lock file entirely
- `lockFileExists(projectPath)` - Check if lock file exists

**Lock file structure:**
```json
{
  "version": "1.0.0",
  "created": "2024-01-15T10:30:00Z",
  "lastSynced": "2024-01-20T14:22:00Z",
  "files": [".claude/settings.json", ".cursor/rules/dev.mdc"]
}
```

### `src/lib/constants.js` - Shared Constants

Defines all valid values and defaults used throughout the codebase.

**Exports:**
- `VALID_TARGETS` - Array of supported AI tools
- `TARGET_DESCRIPTIONS` - Human-readable target names
- `VALID_FEATURES` - Array of supported feature types
- `FEATURE_DESCRIPTIONS` - Human-readable feature names
- `FEATURE_SUPPORT` - Matrix of which features each target supports
- `DEFAULT_OPTIONS` - Default values for options
- `ENTITY_TYPES` - Content types that can be composed
- `TARGET_DIRECTORIES` - Mapping of targets to directory names
- `CONFIG_DIR`, `CONFIG_FILE`, `LOCK_FILE` - Path constants

### `src/lib/utils.js` - Utility Functions

General-purpose helpers used across modules.

**Key functions:**
- `parseFrontmatter(filePath)` - Extract YAML frontmatter from markdown
- `shouldIncludeForUseCases()` - Check if file matches use-case filter (legacy)
- `shouldIncludeForProfiles(filePath, context)` - Scope-aware profile filtering
- `validateFrontmatterScope(filePath, currentScope, validSubProfiles)` - Validate frontmatter scope rules
- `parseJsonc(content)` - Parse JSON with comments
- `readJsoncFile(filePath)` - Read and parse JSONC file
- `createLogger(verbose)` - Create logger with verbose support
- `isVerbose(options)` - Check verbose mode from options or env
- `getEffectiveProfiles(config)` - Get profiles from config (prefers `profiles` over `use-cases`)

**Profile filtering types:**
```typescript
type ProfileScope = 'global' | string; // 'global' for /shared/, parent name for /_shared/

interface FilterContext {
  targetProfiles: string[];   // What user selected: ["development:frontend"]
  currentScope: ProfileScope; // 'global' or 'development'
}
```

### `src/lib/repo-config.js` - Repository Configuration

Manages `repo.json` files in amgr repositories.

**Key functions:**
- `loadRepoConfig(repoPath)` - Load repo.json
- `saveRepoConfig()` - Save repo.json
- `validateRepoConfig()` - Validate structure
- `addUseCaseToRepo()` / `removeUseCaseFromRepo()` - Manage use-cases (legacy)
- `useCaseExistsInRepo()` - Check if use-case is registered (legacy)
- `getRepoUseCases()` - List available use-cases (legacy)
- `profileExistsInRepo(repoPath, profileSpec)` - Check if profile/sub-profile exists
- `addProfileToRepo(repoPath, profileSpec, description)` - Add profile or sub-profile
- `removeProfileFromRepo(repoPath, profileSpec)` - Remove profile or sub-profile
- `initNestedProfile(repoPath, name, description)` - Initialize nested profile with `_shared/`
- `validateRepoStructure()` - Check directory structure

## State Management

amgr maintains state in several locations:

### Project-Level State (`.amgr/`)

```
project/
└── .amgr/
    ├── config.json      # User configuration (may be committed)
    └── amgr-lock.json   # Tracked files (should be gitignored)
```

- **config.json**: User's choices for sources, targets, features, use-cases
- **amgr-lock.json**: Runtime tracking of files amgr created

### User-Level State (`~/.amgr/`)

```
~/.amgr/
├── config.json                      # Global configuration (sources)
└── cache/
    ├── github.com-company-rules/    # Cloned git repos
    └── github.com-user-agents/
```

- **config.json**: Global sources available to all projects
- **cache/**: Cloned git repositories for remote sources
- Each git source has a directory named from normalized URL
- Updated automatically during sync, manually via `amgr source update`

### Global Sources

amgr supports global sources that are automatically available to all projects. Global sources are configured in `~/.amgr/config.json`:

```json
{
  "globalSources": [
    { "type": "local", "path": "~/Code/agents", "name": "agents" }
  ]
}
```

**Behavior:**
- Global sources are merged with project-specific sources during sync
- By default, global sources are prepended (project sources override global)
- Projects can control merge behavior via `options.globalSourcesPosition`
- Projects can opt out entirely via `options.ignoreGlobalSources: true`

## Key Design Decisions

### 1. Sources Required for Sync

Sources must be explicitly configured. There is no fallback to hardcoded use-cases or default repository. This ensures:
- Explicit is better than implicit
- No surprise behavior when sources change upstream
- Projects are self-contained with their source configuration

### 2. Source Layering (Later Overrides Earlier)

When multiple sources are configured, they are applied in order. Later sources override earlier ones. This enables patterns like:
```json
{
  "sources": [
    { "type": "git", "url": "https://github.com/company/rules" },
    { "type": "local", "path": "~/my-overrides" }
  ]
}
```
Company-wide rules form the base, personal overrides customize on top.

### 3. Lock File for Safe Updates

amgr tracks every file it creates. This ensures:
- Only amgr-managed files are updated during sync
- Native files (created manually) are never touched
- Clean removal of amgr-created files without affecting native files

### 4. Frontmatter-Based Filtering

Shared content can be tagged with profiles via YAML frontmatter:
```yaml
---
profiles:
  - development
  - development:frontend
  - writing
---
```
Files are only included when their profiles match the config.

**Scope-aware filtering for nested profiles:**
- In `/shared/`: Match full specs (`development`, `development:frontend`) or parent-only (`development` matches `development:frontend`)
- In `/parent/_shared/`: Match sub-profile names only (`frontend`, not `development:frontend`)

Legacy `use-cases` frontmatter is also supported for backwards compatibility.

### 5. rulesync as the Generation Engine

amgr delegates actual config generation to `rulesync`. This provides:
- Separation of concerns (amgr: orchestration, rulesync: generation)
- Access to rulesync's target-specific output formats
- Future compatibility with rulesync improvements

### 6. TypeScript

The codebase is written in TypeScript with ES modules. This choice:
- Provides type safety and better IDE support
- Enables better documentation through type definitions
- Aligns with modern Node.js development practices

## External Dependencies

| Package | Purpose |
|---------|---------|
| `commander` | CLI argument parsing and command routing |
| `@inquirer/prompts` | Interactive prompts for init and confirmations |
| `rulesync` | Config generation (called via npx) |

## Error Handling

Errors are handled at the command level with informative messages:

- **Missing config**: "No .amgr/config.json found. Run 'amgr init' to create one."
- **Invalid source**: "Source validation failed: [specific error]"
- **Missing use-case**: "Use-case 'X' not found in any configured source"
- **File conflicts**: Warning message, file skipped, sync continues

Commands exit with code 1 on fatal errors, 0 on success.
