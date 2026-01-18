---
name: skill-creator
description: Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends Claude's capabilities with specialized knowledge, workflows, or tool integrations.
targets: ["claudecode"]
---

# Skill Creator

This skill provides guidance for creating effective skills.

## About Skills

Skills are modular, self-contained packages that extend Claude's capabilities by providing specialized knowledge, workflows, and tools. Think of them as "onboarding guides" for specific domains or tasks.

### What Skills Provide

1. Specialized workflows - Multi-step procedures for specific domains
2. Tool integrations - Instructions for working with specific file formats or APIs
3. Domain expertise - Company-specific knowledge, schemas, business logic
4. Bundled resources - Scripts, references, and assets for complex and repetitive tasks

## Core Principles

### Concise is Key

The context window is a public good. Only add context Claude doesn't already have. Challenge each piece of information: "Does Claude really need this explanation?"

### Set Appropriate Degrees of Freedom

Match the level of specificity to the task's fragility:

**High freedom**: Use when multiple approaches are valid
**Medium freedom**: Use when a preferred pattern exists
**Low freedom**: Use when operations are fragile and error-prone

### Anatomy of a Skill

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter metadata (required)
│   │   ├── name: (required)
│   │   └── description: (required)
│   └── Markdown instructions (required)
└── Bundled Resources (optional)
    ├── scripts/          - Executable code
    ├── references/       - Documentation loaded as needed
    └── assets/           - Files used in output
```

#### SKILL.md (required)

- **Frontmatter** (YAML): Contains `name` and `description` fields
- **Body** (Markdown): Instructions and guidance for using the skill

#### Bundled Resources (optional)

##### Scripts (`scripts/`)
Executable code for tasks that require deterministic reliability.

##### References (`references/`)
Documentation loaded as needed into context. Keep SKILL.md lean.

##### Assets (`assets/`)
Files used within the output Claude produces (templates, images, etc.).

## Skill Creation Process

1. Understand the skill with concrete examples
2. Plan reusable skill contents (scripts, references, assets)
3. Initialize the skill (run init_skill.py)
4. Edit the skill (implement resources and write SKILL.md)
5. Package the skill (run package_skill.py)
6. Iterate based on real usage

### Step 1: Understanding with Concrete Examples

Ask questions like:
- "What functionality should this skill support?"
- "Can you give some examples of how this skill would be used?"
- "What would a user say that should trigger this skill?"

### Step 2: Planning Reusable Contents

Analyze each example by:
1. Considering how to execute from scratch
2. Identifying helpful scripts, references, and assets

### Step 3: Initializing the Skill

```bash
scripts/init_skill.py <skill-name> --path <output-directory>
```

### Step 4: Edit the Skill

##### Frontmatter

- `name`: The skill name
- `description`: Primary triggering mechanism. Include what the skill does AND specific triggers for when to use it.

##### Body

Write instructions for using the skill and its bundled resources.

### Step 5: Packaging

```bash
scripts/package_skill.py <path/to/skill-folder>
```

### Step 6: Iterate

Test the skill on real tasks and improve based on struggles or inefficiencies.
