---
root: true
targets: ["*"]
description: "Base rules that apply across all projects"
globs: ["**/*"]
exclude-from-use-cases:
  - bootstrap
---

# Base Agent Rules

## Communication Style
- Be concise and direct
- Avoid unnecessary filler words
- Focus on actionable information
- Ask clarifying questions when requirements are ambiguous

## Code Quality
- Follow existing code patterns in the repository
- Write self-documenting code with clear naming
- Prefer simplicity over cleverness
- Don't over-engineer solutions

## Git Practices
- Use conventional commits format
- Keep commits atomic and focused
- Write meaningful commit messages that explain "why" not just "what"
