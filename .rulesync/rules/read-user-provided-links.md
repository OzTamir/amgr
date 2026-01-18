---
root: false
targets: ["*"]
description: "Always read the exact web link provided by users"
globs: ["**/*"]
---

# Read User-Provided Web Links

**CRITICAL**: When a user provides a web link, always read the exact link they provided. Never attempt to search the web or navigate to the page using other tools. Use the exact URL provided by the user.

## Core Principle

When users provide web links, they are giving you a specific resource they want you to read. You should:

- **Use the exact link provided**: Read the URL the user shared, not a search result or navigation path
- **Never search instead**: Don't use web search tools to find the page - use the direct link
- **Handle GitHub links specially**: For GitHub file links, fetch the raw file content

## Required Workflow

### Step 1: Identify the Link Type

When a user provides a web link, determine what type it is:

- **Standard web URL**: Use web fetch tools with the exact URL
- **GitHub file link**: Convert to raw GitHub URL and fetch
- **GitHub repository link**: Use web fetch tools with the exact URL

### Step 2: Choose the Right Tool

Use tools in this order of preference based on availability:

#### For GitHub Links

1. **GitHub MCP tool** (preferred): If `mcp__github__get_file_contents` is available, use it directly
2. **Firecrawl**: If Firecrawl tools are available, use `mcp__firecrawl__firecrawl_scrape`
3. **WebFetch fallback**: Convert to raw URL and fetch
   - Replace `/blob/` with raw.githubusercontent.com
   - Example: `https://github.com/user/repo/blob/main/src/file.ts` → `https://raw.githubusercontent.com/user/repo/main/src/file.ts`

#### For Standard Web URLs

1. **Firecrawl** (preferred): If available, use `mcp__firecrawl__firecrawl_scrape` for better content extraction
2. **WebFetch fallback**: Use the built-in WebFetch tool with the exact URL

## Examples of What NOT to Do

❌ **Don't**: Use web search to find a page when the user provided a direct link
❌ **Don't**: Navigate manually using browser tools when a direct link is provided
❌ **Don't**: Ignore GitHub file links or read them as regular web pages
❌ **Don't**: Modify or search for alternatives to the provided link

## Examples of What TO Do

✅ **Do**: Use the exact URL provided by the user
✅ **Do**: Convert GitHub file links to raw URLs and fetch
✅ **Do**: Use the exact link even if you think you know what it contains
✅ **Do**: Handle GitHub repository links as regular URLs

## GitHub Link Handling (Fallback)

If GitHub MCP tools are not available, convert file links to raw URLs:

```
https://github.com/{owner}/{repo}/blob/{branch}/{path}
→ https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}
```

## Summary

1. **Always use the exact link provided** - Never search or navigate to find the page
2. **Use the best available tool** - GitHub MCP > Firecrawl > WebFetch
3. **Trust the user's link** - They provided it for a reason, so read it directly
