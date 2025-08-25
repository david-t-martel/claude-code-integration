# 🛠️ CLAUDE DEVELOPMENT ENVIRONMENT MANAGEMENT

Setup and optimize development environment for any editor/IDE with Claude Code integration.

## 🎯 Purpose

Universal development environment manager that adapts to your preferred editor (VS Code, Vim, Emacs, etc.) and provides:
- Intelligent editor detection and configuration
- Language server optimization
- Project-specific development shortcuts
- Universal Claude operation aliases

## 🚀 Quick Start

```bash
# Detect your editor and setup environment
~/.claude/hooks/claude-dev-environment.sh setup

# Create shell aliases for quick access
~/.claude/hooks/claude-dev-environment.sh aliases

# Optimize language support (auto-detects project type)
~/.claude/hooks/claude-dev-environment.sh intellisense
```

## 📋 Available Commands

### Environment Setup
```bash
# Complete development environment setup
~/.claude/hooks/claude-dev-environment.sh setup

# VS Code specific integration
~/.claude/hooks/claude-dev-environment.sh vscode

# Universal integration (any editor)
~/.claude/hooks/claude-dev-environment.sh universal
```

### Development Optimization
```bash
# Optimize IntelliSense/language servers
~/.claude/hooks/claude-dev-environment.sh intellisense

# Optimize for specific language
~/.claude/hooks/claude-dev-environment.sh intellisense typescript
~/.claude/hooks/claude-dev-environment.sh intellisense python
~/.claude/hooks/claude-dev-environment.sh intellisense rust
```

### Productivity Tools
```bash
# Create shell aliases for Claude commands
~/.claude/hooks/claude-dev-environment.sh aliases

# Detect current editor/IDE
~/.claude/hooks/claude-dev-environment.sh detect
```

## 🎹 Shell Aliases Created

After running `aliases` command, you get these shortcuts:

```bash
# Core Claude operations
claude-context      # Build project context
claude-load         # Load context progressively
claude-lint         # Run comprehensive linting
claude-status       # Check project status
claude-health       # Run health checks
claude-git          # Git integration commands
claude-session      # Session management

# Quick combinations
cdev               # Status + linting
csetup             # Context + git hooks
ccheck             # Health + status
```

## 🔧 VS Code Integration

When VS Code is detected, creates:

### Tasks (Ctrl+Shift+P → "Tasks: Run Task")
- 🤖 Build Claude Context
- 🧠 Load Claude Context (Progressive)
- ⚡ Smart Lint All
- 📊 Claude Status Check
- 🔄 Git Integration Setup

### Keybindings
- `Ctrl+Shift+C B` - Build Context
- `Ctrl+Shift+C L` - Load Context
- `Ctrl+Shift+C T` - Smart Lint
- `Ctrl+Shift+C S` - Status Check

### Extension Recommendations
- TypeScript/JavaScript: ESLint, Prettier, Path IntelliSense
- Python: Python extension, Pylint, Black formatter
- Rust: Rust Analyzer, Better TOML
- General: Markdown All in One, ShellCheck

## 🌐 Universal Editor Support

Supports any editor/IDE:
- **VS Code/Insiders**: Full integration with tasks and keybindings
- **Neovim/Vim**: Basic integration with file opening
- **Emacs**: Basic integration
- **Others**: Shell aliases and universal tools

## 📊 Editor Detection

The system automatically detects and prioritizes:
1. VS Code Insiders
2. VS Code
3. Neovim
4. Vim
5. Emacs
6. Sublime Text
7. Atom
8. Nano

## 🔗 Integration with Other Commands

Works seamlessly with:
- `/check` - Uses development environment status
- `/lint` - Leverages optimized language servers
- `/hooks` - Integrates with hook management system

## 💡 Project-Specific Configuration

Creates `.claude-dev-config.sh` in your project:

```bash
# Language and tool preferences
export CLAUDE_DEV_PRIMARY_LANGUAGE="auto"
export CLAUDE_DEV_ENABLE_LINT="true"
export CLAUDE_DEV_ENABLE_FORMAT="true"
export CLAUDE_DEV_ENABLE_INTELLISENSE="true"

# Editor preferences
export CLAUDE_DEV_EDITOR="auto"

# Performance settings
export CLAUDE_DEV_FAST_MODE="false"
export CLAUDE_DEV_CACHE_ENABLED="true"
```

This universal approach ensures Claude works optimally regardless of your development environment preferences.
