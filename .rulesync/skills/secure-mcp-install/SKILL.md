---
name: secure-mcp-install
description: This skill should be used when the user asks to "install an MCP server", "add an MCP server", "set up an MCP server", "install the Slack MCP", "install MCP from GitHub", "audit an MCP server", "check if an MCP server is safe", or mentions installing any third-party MCP server. Provides a security-focused workflow to clone, audit, and install MCP servers at pinned commits with automatic updates disabled.
targets: ["claudecode"]
---

# Secure MCP Server Installation

This skill provides a security-focused workflow for installing MCP servers from third-party sources. It implements a "trust but verify" approach: clone the repository at a specific commit, run automated security scans, perform manual review of critical areas, then install with updates disabled.

## When to Use This Skill

Use this workflow when:
- Installing MCP servers from community maintainers (not official Anthropic packages)
- The repository has popularity/stars but unknown maintainers
- Security is a concern but full code review isn't practical
- Pinning to a specific version is desired

## Core Workflow

### Step 1: Clone at Specific Commit

Clone the repository and check out the target commit:

```bash
# Create audit directory
mkdir -p ~/.claude/mcp-audits
cd ~/.claude/mcp-audits

# Clone the repository
git clone <REPO_URL> <SERVER_NAME>
cd <SERVER_NAME>

# Check out specific commit (or latest if user doesn't specify)
git checkout <COMMIT_SHA>

# Record the commit for the audit report
git log -1 --format="%H %ci %s" > ../<SERVER_NAME>-audit-commit.txt
```

### Step 2: Run Automated Security Scan

Execute the audit script to scan for red flags:

```bash
~/.claude/skills/secure-mcp-install/scripts/audit-mcp-server.sh ~/.claude/mcp-audits/<SERVER_NAME>
```

The script scans for:
- Dangerous code patterns (eval, exec, dynamic imports)
- Obfuscated or minified source code
- Suspicious network calls and hardcoded URLs
- Environment variable access patterns
- Credential harvesting indicators
- Known malware signatures

Review the output. Any HIGH severity findings require manual investigation before proceeding.

### Step 3: Audit Dependencies

For Node.js projects:
```bash
cd ~/.claude/mcp-audits/<SERVER_NAME>
npm audit --audit-level=high
```

For Python projects:
```bash
cd ~/.claude/mcp-audits/<SERVER_NAME>
pip-audit -r requirements.txt 2>/dev/null || pip install pip-audit && pip-audit -r requirements.txt
```

### Step 4: Manual Review (Focus Areas)

Perform targeted manual review of these critical areas:

1. **Entry points**: Main file, server initialization
2. **Tool handlers**: What each MCP tool actually does
3. **Network code**: Any HTTP clients, WebSocket connections
4. **File system access**: Read/write operations, paths accessed
5. **Environment handling**: What env vars are read and how used
6. **Build scripts**: postinstall hooks, build commands

### Step 5: Install with Pinned Version

If approved, install the MCP server at the audited commit.

For npm-based servers, install from the local clone:
```bash
cd ~/.claude/mcp-audits/<SERVER_NAME>
npm install
npm run build  # if needed
```

Then register with Claude Code using the CLI:

```bash
# For Node.js servers
claude mcp add-json <SERVER_NAME> '{
  "type": "stdio",
  "command": "node",
  "args": ["'$HOME'/.claude/mcp-audits/<SERVER_NAME>/dist/index.js"],
  "env": {
    "API_KEY": "your-key"
  }
}'
```

**Important**: Use `claude mcp add-json` - manually editing `~/.claude.json` gets overwritten on restart.

## Security Principles

1. **Pin versions**: Never use `latest` or auto-updating installs
2. **Local installs**: Install from audited local clone, not registry
3. **Minimal env**: Only pass required environment variables
4. **Document decisions**: Keep audit reports for future reference
5. **Re-audit on upgrade**: Treat updates as new installs
