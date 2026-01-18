---
description: "Create a well-formatted conventional commit"
targets: ["*"]
---

Create a git commit for the current staged changes.

1. Run `git diff --cached` to see what's staged
2. Analyze the changes and determine the appropriate commit type:
   - feat: new feature
   - fix: bug fix
   - docs: documentation only
   - style: formatting, missing semicolons, etc
   - refactor: code change that neither fixes a bug nor adds a feature
   - test: adding or updating tests
   - chore: maintenance tasks

3. Write a commit message following conventional commits:
   - Format: `type(scope): description`
   - Keep the first line under 72 characters
   - Use imperative mood ("add" not "added")

4. Create the commit
