---
description: "Add or update rules in the repository using Rulesync"
targets: ["*"]
---

When adding new rules or modifying existing rules for AI development tools, always use Rulesync to manage them centrally.

## Core Principle

**Always use Rulesync, even when the user requests a specific tool's rule format.**

Even if a user explicitly asks for a specific agent's rule format, you must:

1. **Add the rule to the appropriate location** (`shared/rules/` or `use-cases/{name}/.rulesync/rules/`)
2. **Run `npm run bootstrap`** to generate the tool-specific configurations
3. **Never bypass Rulesync** by directly editing tool-specific files

## Workflow Steps

### Step 1: Determine Placement

Ask which use cases the rule applies to:
- **Single use case**: Place in `use-cases/{name}/.rulesync/rules/`
- **Multiple use cases**: Place in `shared/rules/` with `use-cases:` frontmatter filter
- **All use cases**: Place in `shared/rules/` without use-cases filter

### Step 2: Create or Update Rule File

Rule files should include frontmatter with:

```yaml
---
root: false
targets: ["*"]
description: "Clear description of what this rule covers"
globs: ["**/*"]  # File patterns this rule applies to
use-cases:      # Optional: list of use cases
  - development
  - product
---
```

### Step 3: Generate Tool-Specific Configurations

**CRITICAL**: After adding, updating, or deleting any rule file, you MUST regenerate configs.

**In the agents repository** (this repo):
```bash
npm run bootstrap
```

**In other repositories**:
```bash
rulesync generate
# or
npx rulesync generate
```

This generates tool-specific configuration files from the unified rules.

**Never skip this step** - rules will not take effect until generation is run.

## Best Practices

### Be Specific but Flexible

- Provide clear, actionable guidance with concrete examples
- Explain the _why_ behind rules
- Use specific glob patterns over broad ones

### Use Clear Code Examples

Always use fenced code blocks with language specifiers.

### Be Modular

Break down complex domains into smaller, focused rules rather than creating one monolithic rule.

## Examples

### DO: Add Rule Using Rulesync

1. Create rule file in `shared/rules/` or `use-cases/{name}/.rulesync/rules/` (in agents repo) or `.rulesync/rules/` (in other repos)
2. Add proper frontmatter with targets, globs, use-cases
3. Add rule content
4. Run `npm run bootstrap` (agents repo) or `rulesync generate` (other repos) to generate configurations

### DON'T: Directly Edit Tool-Specific Files

- Don't directly edit `.cursorrules`
- Don't directly edit `CLAUDE.md`
- Don't directly edit `.github/copilot-instructions.md`
- Always use Rulesync workflow instead
