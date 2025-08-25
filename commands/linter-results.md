# /user:linter-results

**Purpose:** Get the latest linting results from the Claude linter agent

**Usage:** `/user:linter-results [max_results]`

**Description:**
This command retrieves and formats the most recent linting results from the background Claude linter agent. It provides structured feedback about code quality issues, syntax errors, and warnings that have been identified during background analysis.

**Parameters:**
- `max_results` (optional): Maximum number of recent results to show (default: 5)

**Examples:**
- `/user:linter-results` - Show last 5 linting results
- `/user:linter-results 10` - Show last 10 linting results

**Implementation:**
```bash
#!/usr/bin/env bash
max_results="${1:-5}"
/home/david/.claude/hooks/claude-results-viewer.sh "$max_results"
```
