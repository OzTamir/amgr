---
root: false
targets: ["*"]
description: "Guidelines for maintaining up-to-date technical documentation in docs/"
globs: ["docs/**/*.md", "**/*.md"]
---

# Project Documentation

**CRITICAL**: Always maintain up-to-date technical documentation organized in `.md` files under the `docs/` directory. Keep documentation concise and well-organized - avoid over-documentation. Focus on essential knowledge that helps team members and AI agents understand the project.

## Required Documentation Structure

Maintain four core documentation files in the `docs/` directory:

### 1. `docs/PROJECT.md` - Project Overview

**Purpose**: Outward-facing overview of the project for new team members (especially PMs) to understand the project quickly.

**Content should include**:
- **Project goals and purpose**: What is this project trying to achieve?
- **Important systems and logic**: Key architectural decisions, important business logic, critical workflows
- **External dependencies**: Third-party services, APIs, libraries, and their purposes
- **Key stakeholders and contacts**: Who to reach out to for different areas

**Tone**: Clear, accessible to both technical and non-technical readers. Focus on "what" and "why" rather than deep technical "how".

### 2. `docs/TECHNICAL_DOCS.md` - Technical Documentation

**Purpose**: Comprehensive technical reference for developers and AI agents working on the codebase.

**Content should include**:
- **Tech stack**: Programming languages, frameworks, libraries, and their versions
- **Directory structure**: Overview of the project structure with explanations of key directories
- **Important files**: References to critical files and their purposes
- **Architecture patterns**: Key architectural patterns and conventions used in the codebase
- **Development setup**: How to set up the development environment
- **Build and deployment**: Build processes, deployment procedures

**Tone**: Technical, detailed, reference-style. Focus on "how" and concrete implementation details.

### 3. `docs/CURRENT_STATE.md` - Session State Scratchpad

**Purpose**: A scratchpad for AI agents to maintain continuity between sessions and track current work.

**Content should include**:
- **Current efforts**: What work is actively in progress?
- **In-progress items**: Tasks that are partially complete
- **Next steps**: Planned actions and priorities
- **Blockers**: Issues preventing progress
- **Recent changes**: Important updates made in recent sessions

**Tone**: Informal, practical. This is a working document that should be updated frequently as work progresses.

### 4. `docs/DESIGN.md` - Design Language

**Purpose**: Central reference for UI design language, visual identity, and design system.

**Content should include**:
- **Color palette**: Primary, secondary, accent colors with hex codes
- **Typography**: Font families, sizes, weights, and usage guidelines
- **Theme configuration**: Light/dark mode settings, theme variables
- **Component patterns**: Common UI patterns and their usage

**Tone**: Reference-style, precise. Include actual values (hex codes, sizes, etc.) for easy reference.

## Documentation Maintenance Workflow

### When to Update Documentation

1. **After significant architectural changes**: Update `PROJECT.md` when systems change, and `TECHNICAL_DOCS.md` when technical details change
2. **When tech stack changes**: Update `TECHNICAL_DOCS.md` with new technologies, dependencies, or versions
3. **At the end of work sessions**: Update `CURRENT_STATE.md` to preserve context
4. **When design changes**: Update `DESIGN.md` when colors, themes, or design system evolves

### How to Update Documentation

1. **Read existing documentation first**: Understand current state before making changes
2. **Update relevant sections**: Modify only what has changed, preserve what's still accurate
3. **Keep it concise**: Remove outdated information, avoid redundancy
4. **Use clear structure**: Use headings, lists, and formatting for readability

## Summary

1. **Maintain four core files** - `PROJECT.md`, `TECHNICAL_DOCS.md`, `CURRENT_STATE.md`, `DESIGN.md` in the `docs/` directory
2. **Keep it concise** - Focus on essential information, avoid over-documentation
3. **Separate concerns** - `PROJECT.md` for outward-facing overview (non-technical), `TECHNICAL_DOCS.md` for all technical details
4. **Update regularly** - Keep documentation current, especially `CURRENT_STATE.md` between sessions
