#!/bin/bash
#
# MCP Server Security Audit Script
# Scans a repository for security red flags before installation
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Severity levels
HIGH="[HIGH]"
MEDIUM="[MEDIUM]"
LOW="[LOW]"
INFO="[INFO]"

usage() {
    echo "Usage: $0 <path-to-mcp-server>"
    echo ""
    echo "Scans an MCP server repository for security red flags."
    echo ""
    echo "Example:"
    echo "  $0 ~/.claude/mcp-audits/slack-mcp"
    exit 1
}

if [ $# -lt 1 ]; then
    usage
fi

TARGET_DIR="$1"

if [ ! -d "$TARGET_DIR" ]; then
    echo -e "${RED}Error: Directory not found: $TARGET_DIR${NC}"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}MCP Server Security Audit${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Target: ${TARGET_DIR}"
echo -e "Date: $(date)"
echo ""

# Track findings
HIGH_COUNT=0
MEDIUM_COUNT=0
LOW_COUNT=0

report_finding() {
    local severity="$1"
    local category="$2"
    local description="$3"
    local file="${4:-}"

    case "$severity" in
        "HIGH")
            echo -e "${RED}${HIGH} ${category}${NC}"
            ((HIGH_COUNT++)) || true
            ;;
        "MEDIUM")
            echo -e "${YELLOW}${MEDIUM} ${category}${NC}"
            ((MEDIUM_COUNT++)) || true
            ;;
        "LOW")
            echo -e "${GREEN}${LOW} ${category}${NC}"
            ((LOW_COUNT++)) || true
            ;;
        "INFO")
            echo -e "${BLUE}${INFO} ${category}${NC}"
            ;;
    esac
    echo "  $description"
    if [ -n "$file" ]; then
        echo "  File: $file"
    fi
    echo ""
}

# ============================================
# Check for obfuscated/minified code in source
# ============================================
echo -e "${BLUE}--- Checking for obfuscated code ---${NC}"
echo ""

# Look for suspiciously long lines (minified code)
while IFS= read -r file; do
    if [ -f "$file" ]; then
        # Check for lines over 500 chars in source files
        long_lines=$(awk 'length > 500 { count++ } END { print count+0 }' "$file")
        if [ "$long_lines" -gt 0 ]; then
            report_finding "MEDIUM" "Possible minified code" \
                "File contains $long_lines lines over 500 characters" \
                "$file"
        fi
    fi
done < <(find "$TARGET_DIR" -type f \( -name "*.js" -o -name "*.ts" -o -name "*.py" \) \
    ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" 2>/dev/null)

# Look for base64 in source (potential obfuscation)
base64_files=$(grep -rl "atob\|btoa\|Buffer.from.*base64\|b64decode\|base64.decode" "$TARGET_DIR" \
    --include="*.js" --include="*.ts" --include="*.py" \
    2>/dev/null | grep -v node_modules | grep -v ".git" || true)
if [ -n "$base64_files" ]; then
    while IFS= read -r file; do
        report_finding "MEDIUM" "Base64 encoding detected" \
            "Check if used for obfuscation or legitimate encoding" \
            "$file"
    done <<< "$base64_files"
fi

# ============================================
# Check for dangerous code execution patterns
# ============================================
echo -e "${BLUE}--- Checking for dangerous code patterns ---${NC}"
echo ""

# JavaScript/TypeScript: eval, Function constructor, etc.
js_dangerous=$(grep -rn "eval\s*(" "$TARGET_DIR" --include="*.js" --include="*.ts" \
    2>/dev/null | grep -v node_modules | grep -v ".git" | grep -v "// " | grep -v "* " || true)
if [ -n "$js_dangerous" ]; then
    report_finding "HIGH" "eval() usage detected" \
        "Direct code execution - requires manual review" \
        ""
    echo "$js_dangerous" | head -5
    echo ""
fi

# Function constructor
func_constructor=$(grep -rn "new Function\s*(" "$TARGET_DIR" --include="*.js" --include="*.ts" \
    2>/dev/null | grep -v node_modules | grep -v ".git" || true)
if [ -n "$func_constructor" ]; then
    report_finding "HIGH" "new Function() usage detected" \
        "Dynamic code execution - requires manual review" \
        ""
    echo "$func_constructor" | head -5
    echo ""
fi

# Python: exec, eval, compile
py_dangerous=$(grep -rn "exec\s*(\|eval\s*(\|compile\s*(" "$TARGET_DIR" --include="*.py" \
    2>/dev/null | grep -v ".git" | grep -v "# " || true)
if [ -n "$py_dangerous" ]; then
    report_finding "HIGH" "Python exec/eval/compile usage detected" \
        "Dynamic code execution - requires manual review" \
        ""
    echo "$py_dangerous" | head -5
    echo ""
fi

# Child process with shell
shell_exec=$(grep -rn "child_process\|subprocess\|os.system\|os.popen\|shell=True" "$TARGET_DIR" \
    --include="*.js" --include="*.ts" --include="*.py" \
    2>/dev/null | grep -v node_modules | grep -v ".git" || true)
if [ -n "$shell_exec" ]; then
    report_finding "MEDIUM" "Shell execution detected" \
        "Check if user input reaches these calls" \
        ""
    echo "$shell_exec" | head -5
    echo ""
fi

# ============================================
# Check for suspicious network activity
# ============================================
echo -e "${BLUE}--- Checking for network patterns ---${NC}"
echo ""

# Hardcoded URLs (excluding common legitimate ones)
urls=$(grep -roEh "https?://[a-zA-Z0-9./?=_-]+" "$TARGET_DIR" \
    --include="*.js" --include="*.ts" --include="*.py" --include="*.json" \
    2>/dev/null | grep -v node_modules | grep -v ".git" | \
    grep -v "github.com\|npmjs.com\|pypi.org\|googleapis.com\|localhost\|127.0.0.1\|example.com" | \
    sort -u || true)
if [ -n "$urls" ]; then
    report_finding "LOW" "Hardcoded URLs found" \
        "Review these endpoints:" \
        ""
    echo "$urls" | head -10
    echo ""
fi

# WebSocket connections
websocket=$(grep -rn "WebSocket\|wss://\|ws://" "$TARGET_DIR" \
    --include="*.js" --include="*.ts" --include="*.py" \
    2>/dev/null | grep -v node_modules | grep -v ".git" || true)
if [ -n "$websocket" ]; then
    report_finding "LOW" "WebSocket usage detected" \
        "Verify these are expected connections" \
        ""
    echo "$websocket" | head -5
    echo ""
fi

# ============================================
# Check for credential/environment access
# ============================================
echo -e "${BLUE}--- Checking for credential access patterns ---${NC}"
echo ""

# Environment variable access
env_access=$(grep -rn "process\.env\|os\.environ\|os\.getenv\|environ\[" "$TARGET_DIR" \
    --include="*.js" --include="*.ts" --include="*.py" \
    2>/dev/null | grep -v node_modules | grep -v ".git" || true)
if [ -n "$env_access" ]; then
    report_finding "INFO" "Environment variable access" \
        "Review which variables are accessed and how used:" \
        ""
    echo "$env_access" | head -10
    echo ""
fi

# Credential-related keywords
creds=$(grep -rin "password\|secret\|api_key\|apikey\|token\|credential\|auth" "$TARGET_DIR" \
    --include="*.js" --include="*.ts" --include="*.py" \
    2>/dev/null | grep -v node_modules | grep -v ".git" | grep -v "// " | grep -v "# " || true)
if [ -n "$creds" ]; then
    report_finding "INFO" "Credential-related code" \
        "Review how credentials are handled:" \
        ""
    echo "$creds" | head -10
    echo ""
fi

# ============================================
# Check for file system access
# ============================================
echo -e "${BLUE}--- Checking for file system access ---${NC}"
echo ""

# File operations
fs_ops=$(grep -rn "writeFile\|readFile\|fs\.\|open\s*(\|Path\|pathlib" "$TARGET_DIR" \
    --include="*.js" --include="*.ts" --include="*.py" \
    2>/dev/null | grep -v node_modules | grep -v ".git" | head -20 || true)
if [ -n "$fs_ops" ]; then
    report_finding "INFO" "File system operations" \
        "Review file access patterns - check for path traversal risks" \
        ""
    echo "$fs_ops" | head -10
    echo ""
fi

# ============================================
# Check for npm/pip postinstall hooks
# ============================================
echo -e "${BLUE}--- Checking for install hooks ---${NC}"
echo ""

# npm postinstall
if [ -f "$TARGET_DIR/package.json" ]; then
    postinstall=$(grep -n "postinstall\|preinstall\|prepare" "$TARGET_DIR/package.json" || true)
    if [ -n "$postinstall" ]; then
        report_finding "MEDIUM" "npm install hooks detected" \
            "Review what runs during installation:" \
            "$TARGET_DIR/package.json"
        echo "$postinstall"
        echo ""
    fi
fi

# Python setup.py
if [ -f "$TARGET_DIR/setup.py" ]; then
    setup_exec=$(grep -n "cmdclass\|subprocess\|os.system" "$TARGET_DIR/setup.py" || true)
    if [ -n "$setup_exec" ]; then
        report_finding "MEDIUM" "Python setup.py hooks detected" \
            "Review install-time code execution:" \
            "$TARGET_DIR/setup.py"
        echo "$setup_exec"
        echo ""
    fi
fi

# ============================================
# Check for data exfiltration patterns
# ============================================
echo -e "${BLUE}--- Checking for data exfiltration patterns ---${NC}"
echo ""

# Sending data to external services
exfil=$(grep -rn "fetch\|axios\|requests\.\(post\|put\)\|http\.request\|urllib" "$TARGET_DIR" \
    --include="*.js" --include="*.ts" --include="*.py" \
    2>/dev/null | grep -v node_modules | grep -v ".git" || true)
if [ -n "$exfil" ]; then
    report_finding "INFO" "Outbound HTTP requests" \
        "Review what data is being sent externally:" \
        ""
    echo "$exfil" | head -10
    echo ""
fi

# ============================================
# Repository metadata checks
# ============================================
echo -e "${BLUE}--- Repository metadata ---${NC}"
echo ""

# Check if tests exist
if [ -d "$TARGET_DIR/test" ] || [ -d "$TARGET_DIR/tests" ] || [ -d "$TARGET_DIR/__tests__" ]; then
    report_finding "INFO" "Test suite found" \
        "Presence of tests is a positive signal" \
        ""
else
    report_finding "LOW" "No test directory found" \
        "Lack of tests may indicate lower code quality" \
        ""
fi

# Check for CI/CD
if [ -d "$TARGET_DIR/.github" ] || [ -f "$TARGET_DIR/.gitlab-ci.yml" ] || [ -f "$TARGET_DIR/.travis.yml" ]; then
    report_finding "INFO" "CI/CD configuration found" \
        "Automated testing is a positive signal" \
        ""
fi

# ============================================
# Summary
# ============================================
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}SUMMARY${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "HIGH severity findings:   ${RED}${HIGH_COUNT}${NC}"
echo -e "MEDIUM severity findings: ${YELLOW}${MEDIUM_COUNT}${NC}"
echo -e "LOW severity findings:    ${GREEN}${LOW_COUNT}${NC}"
echo ""

if [ "$HIGH_COUNT" -gt 0 ]; then
    echo -e "${RED}RECOMMENDATION: Manual review required before installation.${NC}"
    echo -e "${RED}HIGH severity findings must be investigated.${NC}"
    exit 1
elif [ "$MEDIUM_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}RECOMMENDATION: Review MEDIUM findings before proceeding.${NC}"
    exit 0
else
    echo -e "${GREEN}RECOMMENDATION: No major red flags found. Proceed with manual review.${NC}"
    exit 0
fi
