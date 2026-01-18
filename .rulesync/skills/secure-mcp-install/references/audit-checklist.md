# Manual Audit Checklist

Use this checklist for the manual review portion of the audit. Focus time on areas most likely to contain issues.

## Pre-Review: Repository Signals

Before diving into code, assess the repository's trustworthiness:

- [ ] **Star count and activity**: Higher engagement suggests more eyes on the code
- [ ] **Maintainer history**: Check their other projects and GitHub activity
- [ ] **Issue response**: Are issues addressed? Are security reports handled?
- [ ] **Contributor count**: Single-author vs community-maintained
- [ ] **Code age**: How long has the project existed?
- [ ] **Last commit**: Is it actively maintained?
- [ ] **Forks**: Are there forks that might indicate community distrust of main repo?

## Entry Point Review

The most critical code to review. This is where execution begins.

### Node.js Projects

- [ ] Read `package.json` - check `main`, `bin`, and `scripts` fields
- [ ] Read the main entry file (usually `src/index.ts` or `index.js`)
- [ ] Trace initialization: What happens when the server starts?
- [ ] Check for immediate network calls or file operations at startup

### Python Projects

- [ ] Read `setup.py` or `pyproject.toml` - check entry points
- [ ] Read `__main__.py` or the main module
- [ ] Trace initialization path
- [ ] Check for code that runs at import time

### Questions to Answer

1. What happens when the server starts?
2. What resources does it immediately access?
3. Are there any side effects before the first tool call?

## Tool Handler Review

MCP servers expose tools. Each tool handler is a potential attack surface.

- [ ] List all tools the server exposes
- [ ] For each tool, review:
  - [ ] What inputs does it accept?
  - [ ] What operations does it perform?
  - [ ] Does it validate inputs?
  - [ ] Could it be abused with malicious inputs?

### Common Tool Vulnerabilities

- [ ] **Path traversal**: Does it accept file paths? Can `../` escape intended directories?
- [ ] **Command injection**: Does it execute shell commands with user input?
- [ ] **SSRF**: Does it make requests to user-provided URLs?
- [ ] **Information disclosure**: Could it leak sensitive data?

## Network Code Review

Review all code that makes network requests.

- [ ] List all URLs/endpoints the server contacts
- [ ] For each endpoint:
  - [ ] Is it documented/expected?
  - [ ] What data is sent?
  - [ ] Is authentication properly handled?
  - [ ] Are responses validated?

### Specific Checks

- [ ] No hardcoded credentials in request headers
- [ ] HTTPS used (not HTTP) for sensitive data
- [ ] Timeouts configured (prevent hanging)
- [ ] Error responses don't leak sensitive info

## File System Review

Check all file operations for security issues.

- [ ] List all file read operations
- [ ] List all file write operations
- [ ] For each operation:
  - [ ] Are paths validated/sanitized?
  - [ ] Is access scoped to expected directories?
  - [ ] Could user input manipulate paths?

### Path Traversal Test

If the server accepts file paths, consider:
```
../../../etc/passwd
....//....//etc/passwd
..%2f..%2f..%2fetc/passwd
```

Could any of these bypass validation?

## Environment & Configuration Review

- [ ] List all environment variables accessed
- [ ] Are they documented in README?
- [ ] Are there any unexpected accesses?
- [ ] How are missing env vars handled?
- [ ] Are secrets logged or exposed in errors?

## Dependency Review

Beyond `npm audit`/`pip-audit`, manually check:

- [ ] Read through `package.json` or `requirements.txt`
- [ ] Are all dependencies necessary?
- [ ] Are any suspiciously named (typosquats)?
- [ ] Any with very low usage/downloads?
- [ ] Check lockfile for unexpected resolved URLs

### Deep Dependency Check

For critical dependencies:
- [ ] Check the package on npm/PyPI
- [ ] Review recent commits to the package
- [ ] Check for ownership changes
- [ ] Verify the source matches the registry version

## Build Process Review

If the project has a build step:

- [ ] Read build scripts (`build.js`, `webpack.config.js`, etc.)
- [ ] Check for pre/post build hooks
- [ ] Verify build output matches source
- [ ] No external resources fetched during build

## Logging & Telemetry Review

Check what data the server logs or reports:

- [ ] Search for logging calls (`console.log`, `logger.`, `print`)
- [ ] Check for analytics/telemetry libraries
- [ ] Are credentials ever logged?
- [ ] Is PII handled appropriately?
- [ ] Are errors logged without sensitive context?

## Error Handling Review

How does the server handle errors?

- [ ] Are errors caught appropriately?
- [ ] Do error messages expose sensitive info?
- [ ] Is there a global error handler?
- [ ] Do errors fail securely (deny by default)?

## Quick Grep Commands

Use these to quickly search for concerning patterns:

```bash
# Dynamic code execution
grep -rn "eval\|exec\|Function(" --include="*.js" --include="*.ts" --include="*.py"

# Shell execution
grep -rn "child_process\|subprocess\|os.system" --include="*.js" --include="*.ts" --include="*.py"

# Network calls
grep -rn "fetch\|axios\|requests\.\|http\." --include="*.js" --include="*.ts" --include="*.py"

# File operations
grep -rn "readFile\|writeFile\|open(" --include="*.js" --include="*.ts" --include="*.py"

# Environment access
grep -rn "process.env\|os.environ\|getenv" --include="*.js" --include="*.ts" --include="*.py"

# Encoding (potential obfuscation)
grep -rn "atob\|btoa\|base64" --include="*.js" --include="*.ts" --include="*.py"

# Crypto operations (understand what's encrypted)
grep -rn "crypto\|hashlib\|bcrypt" --include="*.js" --include="*.ts" --include="*.py"
```

## Final Checklist

Before approving installation:

- [ ] All HIGH severity scan findings investigated
- [ ] Entry point code reviewed
- [ ] All tool handlers understood
- [ ] Network destinations verified
- [ ] File access scoped appropriately
- [ ] Dependencies checked
- [ ] No unexplained functionality
- [ ] Capability matches stated purpose

## Decision Framework

### APPROVE if:
- No HIGH severity findings (or all explained/mitigated)
- Code is readable and understandable
- Functionality matches documentation
- Dependencies are reputable
- No unexplained network/file access

### REJECT if:
- Unexplained dynamic code execution
- Obfuscated/unreadable source
- Undocumented external connections
- Evidence of data exfiltration
- Excessive permissions for stated purpose
- Maintainer unresponsive to security concerns

### CONDITIONAL APPROVAL if:
- Some concerns but mitigatable
- Document restrictions:
  - Limit env vars passed
  - Run in sandbox/container
  - Monitor network traffic
  - Restrict file system access
