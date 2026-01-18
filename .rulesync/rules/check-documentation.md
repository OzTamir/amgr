---
root: false
targets: ["*"]
description: "Check project documentation before starting new tasks"
globs: ["**/*"]
---

# Check Documentation Before Starting Tasks

**CRITICAL**: Always check the `docs/` directory before starting a new task to understand project context, current state, and technical details. This prevents working with outdated assumptions and ensures continuity with previous work.

## Core Principle

Project documentation in the `docs/` directory contains essential context that informs how tasks should be approached. Checking documentation first ensures you understand:

- The project's goals and current state
- Technical architecture and conventions
- Work that's already in progress
- Design patterns and UI guidelines
- Recent changes and important context

## Required Workflow

### Step 1: Check Documentation Before Starting

**Before beginning any new task**, read the relevant documentation files in `docs/`:

1. **Check if `docs/` directory exists**: If it doesn't exist, you may need to create it and initialize documentation
2. **Read `docs/CURRENT_STATE.md` first**: Understand what work is in progress, blockers, and next steps
3. **Read `docs/PROJECT.md`**: Understand project goals, important systems, and external dependencies
4. **Read `docs/TECHNICAL_DOCS.md`**: Understand tech stack, directory structure, architecture patterns, and important files
5. **Read `docs/DESIGN.md`** (if task involves UI): Understand design language, colors, themes, and component patterns

### Step 2: Determine if Documentation Check is Needed

**You may skip the documentation check only if**:

- The task instructions are **extremely explicit** and self-contained
- The task requires **no wider context** about the project, architecture, or current state
- The task is a **trivial, isolated change** that doesn't interact with other systems

**When in doubt, always check the documentation**.

### Step 3: Update Documentation if Needed

If you discover documentation is outdated or missing important information:

- **Update `CURRENT_STATE.md`**: Add notes about your work, blockers, or next steps
- **Update `TECHNICAL_DOCS.md`**: If you've made architectural changes or discovered important technical details
- **Update `DESIGN.md`**: If you've made design changes or discovered design patterns
- **Update `PROJECT.md`**: If project goals or important systems have changed
