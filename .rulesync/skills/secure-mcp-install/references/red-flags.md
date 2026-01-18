# Security Red Flags Reference

This document details the patterns scanned by the audit script and explains why each is concerning.

## HIGH Severity Patterns

### Dynamic Code Execution

**JavaScript/TypeScript:**
```javascript
eval(userInput)           // Executes arbitrary code
new Function(code)        // Creates function from string
setTimeout(string, ms)    // Can execute string as code
setInterval(string, ms)   // Can execute string as code
```

**Python:**
```python
eval(expression)          # Evaluates expression
exec(code)                # Executes arbitrary code
compile(source, ...)      # Compiles code for execution
__import__(name)          # Dynamic imports
```

**Why dangerous:** These allow executing arbitrary code at runtime. If user input reaches these functions, it's remote code execution.

### Shell Execution with User Input

```javascript
// Node.js
child_process.exec(userInput)
child_process.spawn(cmd, { shell: true })
```

```python
# Python
os.system(user_input)
subprocess.call(cmd, shell=True)
os.popen(user_input)
```

**Why dangerous:** Shell injection can lead to complete system compromise.

## MEDIUM Severity Patterns

### Base64 Encoding in Source

```javascript
atob(encoded)                    // Decode base64
btoa(data)                       // Encode base64
Buffer.from(data, 'base64')      // Node base64
```

```python
base64.b64decode(encoded)
base64.b64encode(data)
```

**Why concerning:** Often used to obfuscate malicious payloads. Legitimate uses exist (binary data handling), but encoded strings in source code warrant inspection.

**What to check:**
- Decode any base64 strings found in source
- Verify the decoded content is benign
- Check if execution follows decoding

### Minified/Obfuscated Source

**Indicators:**
- Lines exceeding 500 characters
- Single-letter variable names throughout
- Lack of whitespace/formatting
- Encoded string literals

**Why concerning:** Legitimate source code is readable. Minification in source (not dist/) suggests intent to hide functionality.

**What to check:**
- Is there a readable source elsewhere?
- Can you find the original source to compare?
- Is the project build process transparent?

### Install Hooks (postinstall, preinstall)

```json
// package.json
{
  "scripts": {
    "postinstall": "node setup.js",
    "prepare": "node build.js"
  }
}
```

```python
# setup.py
cmdclass = {'install': CustomInstall}
```

**Why concerning:** Code runs automatically during installation, before you've reviewed the project. This is a common attack vector for supply chain attacks.

**What to check:**
- Read the hook script completely
- Verify it only does expected setup (compilation, etc.)
- Check for network calls or unusual behavior

## LOW Severity Patterns

### Hardcoded URLs

```javascript
fetch('https://unknown-domain.com/api')
axios.post('https://analytics.example.com/track')
```

**Why concerning:** The server might exfiltrate data to external services.

**What to check:**
- Are the domains expected (API providers the tool integrates with)?
- Is there documentation explaining these connections?
- Is data being sent, or only received?

### WebSocket Connections

```javascript
new WebSocket('wss://server.example.com')
```

**Why concerning:** Persistent connections could be used for command-and-control.

**What to check:**
- Is the WebSocket to an expected service?
- What data flows through the connection?
- Is the connection authenticated?

### No Test Suite

**Why concerning:** Lack of tests indicates lower quality standards. Well-maintained projects typically have tests.

**What to check:**
- Is the project very new?
- Is there CI/CD despite no visible tests?
- How active is the maintainer?

## INFO Level Patterns (Not Necessarily Bad)

### Environment Variable Access

```javascript
process.env.API_KEY
process.env.DATABASE_URL
```

```python
os.environ.get('SECRET_KEY')
os.getenv('API_TOKEN')
```

**Why tracked:** Understanding what the server accesses helps scope permissions.

**What to check:**
- List all env vars accessed
- Are they documented in README?
- Are any unexpected (shouldn't need that access)?

### File System Operations

```javascript
fs.readFileSync(path)
fs.writeFileSync(path, data)
```

```python
open(path, 'w')
pathlib.Path(path).read_text()
```

**Why tracked:** File access should be limited to expected locations.

**What to check:**
- What paths are accessed?
- Is path traversal prevented?
- Does it access unexpected directories?

### Outbound HTTP Requests

```javascript
fetch(url, { method: 'POST', body: data })
axios.post(url, data)
```

```python
requests.post(url, json=data)
urllib.request.urlopen(req)
```

**Why tracked:** Understand what data leaves your system.

**What to check:**
- What data is being sent?
- To which endpoints?
- Is this expected for the tool's function?

## Dependency Red Flags

### Typosquatting

Watch for packages with names similar to popular ones:
- `lodash` vs `1odash` (number one, not letter L)
- `requests` vs `request` (missing s)
- `colors` vs `colour` (British spelling)

### Low Download Counts

Check npm/PyPI download stats. Extremely low counts on a dependency warrant investigation.

### Recent Ownership Changes

Check if package ownership transferred recently. Attackers sometimes acquire abandoned packages.

### Suspicious resolved URLs in lockfile

```json
// package-lock.json
{
  "resolved": "https://attacker.com/malicious.tgz"
}
```

Lockfile should only reference official registries.

## Behavioral Analysis

Beyond static patterns, consider:

### Does the Capability Match the Function?

A "markdown formatter" shouldn't need:
- Network access
- File system write access
- Environment variables with secrets

### Are There Unexplained Permissions?

MCP servers declare their tools. If a server provides tools that seem unrelated to its stated purpose, investigate.

### Is There Hidden Functionality?

Look for:
- Conditional code that only runs in certain environments
- Backdoors triggered by specific inputs
- Easter eggs that aren't documented
