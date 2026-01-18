---
root: false
targets: ["*"]
description: "Intent Layer pattern for folder-level context"
globs: ["**/CLAUDE.md", "**/.claude/**"]
---

# Intent Layer Pattern

**CRITICAL**: Every subfolder with a distinct semantic purpose must have its own `CLAUDE.md` file that provides context for that area.

## Core Principle

The Intent Layer is a hierarchical context system that helps AI agents understand what each area of the repository is for, how to use it safely, and what patterns apply there. Each `CLAUDE.md` file is an "Intent Node" that compresses context and surfaces hidden knowledge.

## Why This Matters

- **Context efficiency**: A well-written CLAUDE.md distills a large area into minimum tokens needed to operate there safely
- **Progressive disclosure**: Agents get high-level context first, drill into detail only where needed
- **Institutional memory**: Tribal knowledge that lives in heads gets captured and persists across sessions

## Required Structure for Folder CLAUDE.md Files

Each subfolder's `CLAUDE.md` should contain:

### 1. Purpose & Scope
What this folder is responsible for. What it explicitly does NOT cover.

### 2. Document Types & Patterns
What kinds of documents live here, what patterns they follow.

### 3. Workflows & Interactions
How the user typically interacts with this folder, which agents/tools are relevant.

### 4. Key Concepts & Relationships
Important concepts in this domain and how they relate to other folders.

### 5. Pitfalls & Anti-patterns
Common mistakes and what to avoid.

### 6. Downlinks (if applicable)
Pointers to child folders with their own CLAUDE.md files.

## When to Create/Update CLAUDE.md

### Create New CLAUDE.md When:
- Creating a new subfolder
- A folder accumulates 3+ documents without context
- The folder serves a distinct semantic purpose

### Update Existing CLAUDE.md When:
- Adding a new document type to the folder
- Discovering a pattern that should be documented
- Finding information that would help future sessions understand this area
- A new workflow or agent becomes relevant to the folder

## Hierarchical Inheritance

- Child CLAUDE.md files inherit context from parent folders
- Don't duplicate information that exists in parent CLAUDE.md
- Place shared knowledge at the Least Common Ancestor (shallowest folder that covers all relevant paths)

## Maintenance

- Review folder CLAUDE.md when adding significant new content
- Keep CLAUDE.md files concise (aim for <500 tokens)
- Update when patterns change or new anti-patterns emerge
- Add new workflows/agents as they become relevant to the folder
