---
description: "Run tests and report results"
targets: ["*"]
---

Run the project's test suite and provide a summary.

1. Detect the test framework being used:
   - Look for package.json scripts (npm test, jest, vitest, etc.)
   - Look for pytest.ini, setup.py for Python
   - Look for Makefile test targets

2. Run the tests

3. Summarize results:
   - Total tests run
   - Passed/failed/skipped counts
   - Any failing test names and brief failure reasons

4. If tests fail, offer to investigate specific failures
