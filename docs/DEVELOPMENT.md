# amgr Development Guide

This guide explains how to set up a development environment and contribute to amgr.

## Prerequisites

- **Node.js**: v18 or later (ES modules support required)
- **npm**: v9 or later
- **git**: For version control and testing git source features

## Getting Started

### For Users

Install from npm:
```bash
npm install -g amgr
```

See [npm package](https://www.npmjs.com/package/amgr) for more details.

### For Development

Clone and install for local development:

```bash
# Clone the repository
git clone https://github.com/oztamir/amgr.git
cd amgr

# Install dependencies
npm install

# Link for local development
npm link
```

After linking, `amgr` will be available globally and point to your local development copy.

### Verify Installation

```bash
amgr --version
amgr --help
```

## Project Structure

```
amgr/
├── src/
│   ├── index.js           # CLI entry point
│   ├── commands/          # Command implementations
│   │   ├── init.js        # amgr init
│   │   ├── sync.js        # amgr sync (default command)
│   │   ├── list.js        # amgr list
│   │   ├── validate.js    # amgr validate
│   │   ├── clean.js       # amgr clean
│   │   ├── detach.js      # amgr detach
│   │   ├── source.js      # amgr source add/remove/list/update
│   │   └── repo.js        # amgr repo init/add/remove/list
│   └── lib/               # Core library modules
│       ├── config.js      # Config loading and validation
│       ├── sources.js     # Source resolution (git/local)
│       ├── compose.js     # Content composition
│       ├── deploy.js      # File deployment
│       ├── lock.js        # Lock file management
│       ├── constants.js   # Shared constants
│       ├── utils.js       # Utility functions
│       └── repo-config.js # repo.json management
├── schemas/               # JSON schemas
├── docs/                  # Documentation
└── package.json
```

## Code Style

### ES Modules

The project uses ES modules exclusively (no CommonJS). Always use:

```javascript
// Imports
import { something } from './module.js';
import { readFileSync } from 'node:fs';

// Exports
export function myFunction() { }
export { myFunction, anotherFunction };
```

Note: File extensions (`.js`) are required in import paths.

### Conventions

- **No TypeScript**: Pure JavaScript for simplicity
- **Node.js APIs**: Prefix with `node:` (e.g., `node:fs`, `node:path`)
- **Async/await**: Prefer async functions over callbacks or raw promises
- **Error handling**: Throw errors with descriptive messages, catch at command level
- **Logging**: Use the `createLogger()` utility for consistent output

### Code Organization

- **One export per concept**: Each function should do one thing well
- **Commands are thin**: Business logic lives in `lib/`, commands orchestrate
- **Constants are central**: All valid values defined in `constants.js`
- **No global state**: Each function receives what it needs as parameters

## Adding a New Command

1. **Create the command file** in `src/commands/`:

```javascript
// src/commands/mycommand.js
import { createLogger } from '../lib/utils.js';

export async function myCommand(options = {}) {
  const projectPath = process.cwd();
  const logger = createLogger(options.verbose);

  try {
    // Command implementation
    logger.info('Doing something...');
    
    // Success
    logger.success('Done!');
  } catch (e) {
    logger.error(e.message);
    process.exit(1);
  }
}
```

2. **Register in `src/index.js`**:

```javascript
import { myCommand } from './commands/mycommand.js';

program
  .command('mycommand')
  .description('Does something useful')
  .option('-v, --verbose', 'Enable verbose output')
  .action(myCommand);
```

3. **Test manually**:

```bash
amgr mycommand --verbose
```

## Adding a New Feature Type

Features are content types that can be synced (rules, commands, skills, etc.).

1. **Add to `src/lib/constants.js`**:

```javascript
export const VALID_FEATURES = [
  'rules',
  'ignore',
  'mcp',
  'commands',
  'subagents',
  'skills',
  'myfeature'  // Add new feature
];

export const FEATURE_DESCRIPTIONS = {
  // ... existing
  myfeature: 'Description of what this feature does'
};

// Update FEATURE_SUPPORT matrix
export const FEATURE_SUPPORT = {
  claudecode: { /* ... */ myfeature: true },
  cursor: { /* ... */ myfeature: false },
  // ... for each target
};

// If it's a composable entity type
export const ENTITY_TYPES = ['rules', 'commands', 'skills', 'subagents', 'myfeature'];
```

2. **Update composition in `src/lib/compose.js`** if needed:

The composition logic already handles entity types generically via `ENTITY_TYPES`. Special handling (like skills directories vs markdown files) may need additions to `copySharedEntityDir()`.

3. **Update rulesync integration** if the feature requires special rulesync config.

4. **Update schema** in `schemas/amgr.schema.json`:

```json
"features": {
  "items": {
    "enum": ["rules", "ignore", "mcp", "commands", "subagents", "skills", "myfeature"]
  }
}
```

## Adding a New Target

Targets are AI tools that receive generated configurations.

1. **Add to `src/lib/constants.js`**:

```javascript
export const VALID_TARGETS = [
  // ... existing
  'mytarget'
];

export const TARGET_DESCRIPTIONS = {
  // ... existing
  mytarget: 'My Target AI Tool'
};

export const FEATURE_SUPPORT = {
  // ... existing
  mytarget: { rules: true, ignore: true, mcp: false, commands: true, subagents: false, skills: true }
};

export const TARGET_DIRECTORIES = {
  // ... existing
  mytarget: '.mytarget'  // Where files get deployed
};
```

2. **Update schema** in `schemas/amgr.schema.json`:

```json
"targets": {
  "items": {
    "enum": ["*", "claudecode", "cursor", "copilot", "geminicli", "cline", "codex", "opencode", "mytarget"]
  }
}
```

3. **Ensure rulesync supports the target** (this may require upstream changes to rulesync).

## Testing

### Manual Testing

Create a test environment:

```bash
# Create a test agents repo
mkdir -p ~/test-agents
cd ~/test-agents
amgr repo init --name "test" --description "Test repo"
amgr repo add development --description "Dev use-case"

# Create a test project
mkdir -p ~/test-project
cd ~/test-project
amgr init  # Follow prompts, use ~/test-agents as source
amgr sync --verbose
amgr list
amgr clean
```

### Testing Source Resolution

```bash
# Test local source
amgr source add ~/test-agents
amgr source list --verbose

# Test git source (requires valid public repo)
amgr source add https://github.com/some/repo
amgr source update
```

### Testing Lock File

```bash
# Create some files
amgr sync

# Check lock file
cat .amgr/amgr-lock.json

# Verify tracked files are removed on clean
amgr clean --dry-run
```

### Verbose Mode

Most commands support verbose output:

```bash
amgr sync --verbose
AMGR_VERBOSE=true amgr sync  # Via environment variable
```

## Debugging

### Enable Verbose Logging

```bash
amgr sync --verbose
# or
export AMGR_VERBOSE=true
amgr sync
```

### Inspect Temporary Files

The sync command creates a temp directory. To inspect it before cleanup, add a breakpoint or sleep in `src/commands/sync.js`:

```javascript
// After compose, before rulesync
console.log(`Temp directory: ${tempDir}`);
await new Promise(r => setTimeout(r, 60000)); // 60 second pause
```

### Check Git Cache

```bash
ls -la ~/.amgr/cache/
```

### Validate Config Manually

```bash
amgr validate --verbose
```

## Common Development Tasks

### Updating Dependencies

```bash
npm update
npm outdated  # Check for newer versions
```

### Testing Changes Without npm link

```bash
node src/index.js sync --verbose
node src/index.js --help
```

### Resetting Test State

```bash
# Clean project state
rm -rf .amgr/ .claude/ .cursor/ .github/copilot/

# Clean cache
rm -rf ~/.amgr/cache/
```

## Pull Request Checklist

Before submitting a PR:

- [ ] Code follows existing style (ES modules, no TypeScript)
- [ ] New features have corresponding constants/schema updates
- [ ] Commands have appropriate `--verbose` and `--dry-run` support
- [ ] Error messages are clear and actionable
- [ ] Documentation is updated if needed
- [ ] Manual testing completed

## Architecture Notes

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design documentation.

Key principles:
- Sources are required (no implicit defaults)
- Later sources override earlier (layering)
- Lock file tracks amgr-created files
- rulesync handles actual generation
