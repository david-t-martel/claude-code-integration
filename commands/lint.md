---
allowed-tools: all
description: Execute comprehensive linting using smart-lint.sh hook
---

# 🔍 CLAUDE LINTING COMMAND

Execute intelligent, project-aware linting with zero-tolerance error handling using the smart-lint.sh hook.

## 🎯 Linting Execution

**Primary Command:**

```bash
~/.claude/hooks/smart-lint.sh
```

## 📋 Supported Languages & Tools

The smart-lint hook automatically detects project type and runs appropriate checks:

### Go Projects

- **gofmt** - Code formatting
- **golangci-lint** - Comprehensive linting (enforces forbidden patterns)
- **Forbidden Pattern Detection**: `time.Sleep`, `panic()`, `interface{}`

### Python Projects

- **black** - Code formatting
- **ruff** or **flake8** - Linting and style checks

### JavaScript/TypeScript Projects

- **eslint** - Linting and code quality
- **prettier** - Code formatting
- **TypeScript compiler** - Type checking

### Rust Projects

- **cargo fmt** - Code formatting
- **cargo clippy** - Linting and best practices

### Nix Projects

- **nixpkgs-fmt** or **alejandra** - Code formatting
- **statix** - Static analysis

## ⚙️ Linting Options

### Standard Execution

```bash
# Run comprehensive linting (automatic after edits)
~/.claude/hooks/smart-lint.sh
```

### Debug Mode

```bash
# Enable debug output for troubleshooting
~/.claude/hooks/smart-lint.sh --debug
```

### Fast Mode

```bash
# Skip slow checks for quick validation
~/.claude/hooks/smart-lint.sh --fast
```

## 🔧 Configuration

### Project-Specific Settings

Create `.claude-hooks-config.sh` in project root:

```bash
# Language-specific enables/disables
CLAUDE_HOOKS_GO_ENABLED=true
CLAUDE_HOOKS_PYTHON_ENABLED=true
CLAUDE_HOOKS_JS_ENABLED=true
CLAUDE_HOOKS_RUST_ENABLED=false

# Linting behavior
CLAUDE_HOOKS_FAIL_FAST=false
CLAUDE_HOOKS_SHOW_TIMING=true
```

### File Exclusions

Create `.claude-hooks-ignore` using gitignore syntax:

```
vendor/**
node_modules/**
*.pb.go
*_generated.go
dist/**
build/**
```

### Inline Skip Comments

Add to file header to skip linting:

```
// claude-hooks-disable
```

## 📊 Exit Codes & Results

### Success (Exit Code 0)

```
👉 Style clean. Continue with your task.
```

### Issues Found (Exit Code 2)

```
❌ ALL ISSUES ARE BLOCKING ❌
Fix EVERYTHING above until all checks are ✅ GREEN
```

## 🚨 Critical Requirements

**ZERO TOLERANCE POLICY:**

- ALL linting issues MUST be fixed before continuing
- NO warnings are acceptable
- NO "nolint" comments without documented justification
- NO disabled linter rules without explicit justification

## 🔄 Integration with Workflow

### Automatic Execution

Smart-lint runs automatically after:

- File edits via Write/Edit/MultiEdit commands
- Task completion
- Git commits (via pre-commit hooks)

### Manual Execution

```bash
# Direct execution
~/.claude/hooks/smart-lint.sh

# With specific project context
cd /path/to/project && ~/.claude/hooks/smart-lint.sh

# As part of comprehensive check
~/.claude/hooks/health-check.sh
```

## 🛠️ Troubleshooting

### Common Issues

**Missing Dependencies:**

```bash
# Check for required linting tools
~/.claude/hooks/health-check.sh dependencies
```

**Configuration Problems:**

```bash
# Debug configuration loading
CLAUDE_HOOKS_DEBUG=1 ~/.claude/hooks/smart-lint.sh
```

**Performance Issues:**

```bash
# Use fast mode for large projects
~/.claude/hooks/smart-lint.sh --fast
```

### Error Resolution

**When linting fails:**

1. **STOP IMMEDIATELY** - Fix all reported issues
2. **NO BYPASSING** - Address every ❌ issue until ✅ GREEN
3. **VERIFY FIX** - Re-run smart-lint to confirm resolution
4. **CONTINUE TASK** - Return to original work after clean state

## 📚 Advanced Usage

### Project Integration

```bash
# Use with Makefile integration
make lint  # Uses smart-lint if available

# Integration with VS Code tasks
# Command Palette → Tasks: Run Task → Lint Integration Suite
```

### Custom Linting Rules

Projects can extend linting with custom rules:

- Go: `.golangci.yml` configuration
- TypeScript: `eslint.config.ts` or `.eslintrc`
- Python: `pyproject.toml` or `.flake8`

## 🎯 Quality Assurance

The smart-lint system ensures:

- **Consistent code style** across all projects
- **Zero tolerance** for quality issues
- **Automatic language detection** and appropriate tool selection
- **Performance optimization** with smart file filtering
- **Integration** with git hooks and development workflow

**REMEMBER**: Linting failures are BLOCKING. All issues must be resolved before proceeding with any development tasks.
