---
root: false
targets: ["*"]
description: "Always use package manager install commands instead of manually editing dependency files"
globs:
  - "**/package.json"
  - "**/package-lock.json"
  - "**/yarn.lock"
  - "**/pnpm-lock.yaml"
  - "**/requirements.txt"
  - "**/pyproject.toml"
  - "**/Cargo.toml"
  - "**/go.mod"
---

# Package Installation

**CRITICAL**: Always use the appropriate package manager install command to add dependencies instead of manually editing dependency files. Never write dependencies from memory or guess version numbers.

## Core Principle

Package managers are designed to handle dependency resolution, version management, and lock file updates correctly. Manually editing dependency files bypasses this system and can lead to:

- Incorrect or outdated versions
- Missing peer dependencies
- Broken lock files
- Version conflicts
- Security vulnerabilities from outdated packages

## Required Workflow

### 1. Identify the Package Manager

Determine which package manager the project uses:

- **npm**: `package.json` → Use `npm install <package>`
- **yarn**: `yarn.lock` → Use `yarn add <package>`
- **pnpm**: `pnpm-lock.yaml` → Use `pnpm add <package>`
- **pip**: `requirements.txt` → Use `pip install <package>`
- **poetry**: `pyproject.toml` → Use `poetry add <package>`
- **cargo**: `Cargo.toml` → Use `cargo add <package>`
- **go**: `go.mod` → Use `go get <package>`

### 2. Run the Install Command

Execute the appropriate install command for the package manager:

- This ensures the latest compatible version is installed
- Automatically updates lock files
- Resolves peer dependencies correctly
- Updates dependency metadata properly

### 3. Pin the Version

After the package manager installs the dependency, **always pin the version** to ensure reproducibility:

- **npm/yarn/pnpm**: Remove version range prefixes (`^`, `~`) and use exact version
- **pip**: Use exact version in `requirements.txt` (e.g., `package==1.2.3`)
- **poetry**: Use exact version constraint
- **cargo**: Use exact version

## Examples of What NOT to Do

❌ **Don't**: Manually edit `package.json` and add `"package-name": "^1.2.3"` from memory
❌ **Don't**: Guess version numbers when adding dependencies
❌ **Don't**: Manually edit `requirements.txt` without running `pip install`
❌ **Don't**: Skip lock file updates by manually editing dependency files
❌ **Don't**: Leave version ranges (e.g., `^`, `~`) after installation - always pin to exact versions

## Examples of What TO Do

✅ **Do**: Run `npm install <package>` to add npm packages
✅ **Do**: Run `yarn add <package>` to add yarn packages
✅ **Do**: Run `pip install <package>` and update `requirements.txt`
✅ **Do**: Let the package manager determine the latest compatible version
✅ **Do**: **Pin versions after installation** - Remove version range prefixes

## Summary

1. **Always use package manager commands** - Never manually edit dependency files
2. **Let package managers handle versions** - They know the latest compatible versions
3. **Pin versions after installation** - Remove version ranges for reproducibility
4. **Trust lock files** - Package managers update them correctly
