---
allowed-tools: all
description: Comprehensive hook management and execution command
---

# 🪝 CLAUDE HOOKS MANAGEMENT

Execute and manage the comprehensive suite of automation hooks located in `~/.claude/hooks/`.

## 📋 Available Hook Categories

### Core Development Intelligence

- **claude-code-analysis.sh** - Comprehensive code analysis, IDE optimization, and development intelligence
- **claude-development-setup.sh** - Multi-language development environment configuration
- **build-claude-context.sh** - Project context preparation for AI analysis
- **claude-session-manager.sh** - Session state management and persistence

### Core Automation

- **smart-lint.sh** - Intelligent linting with zero-tolerance error handling
- **ntfy-notifier.sh** - Push notifications for task completion

### Development Workflow

- **claude-dev-environment.sh** - Universal development environment setup and optimization
- **claude-status-manager.sh** - Project status and MCP monitoring
- **typescript-workflow.sh** - Complete TypeScript development workflow
- **claude-test-integration.sh** - Comprehensive testing automation

### Git Integration

- **claude-git-integration.sh** - Advanced Git workflow with Claude Code
- **install-git-hooks.sh** - Standard Git hooks installation
- **install-git-hooks-ts.sh** - TypeScript-aware Git hooks

### Context Management

- **claude-context-loader.sh** - Intelligent context gathering
- **claude-memory-optimizer.sh** - Memory usage optimization

### System Management

- **claude-control.sh** - Central control script for Claude operations
- **claude-monitor.sh** - System monitoring and health checks
- **health-check.sh** - Comprehensive system health validation

## 🚀 Hook Execution Commands

### Quick Actions

```bash
# Complete development environment setup
~/.claude/hooks/claude-development-setup.sh full

# Comprehensive code analysis
~/.claude/hooks/claude-code-analysis.sh optimize

# Run comprehensive health check
~/.claude/hooks/health-check.sh

# Optimize development context
~/.claude/hooks/claude-context-loader.sh intelligent

# Install TypeScript-aware git hooks
~/.claude/hooks/install-git-hooks-ts.sh

# Run comprehensive linting
~/.claude/hooks/smart-lint.sh

# System monitoring
~/.claude/hooks/claude-monitor.sh status
```

### Development Intelligence Workflow

```bash
# Quick project analysis and recommendations
~/.claude/hooks/claude-code-analysis.sh quick

# Generate comprehensive development report
~/.claude/hooks/claude-code-analysis.sh report

# Get intelligent development suggestions
~/.claude/hooks/claude-code-analysis.sh suggest

# Save current development session
~/.claude/hooks/claude-session-manager.sh save

# Restore previous development session
~/.claude/hooks/claude-session-manager.sh restore
```

### Advanced Development Setup

```bash
# Universal development environment setup
~/.claude/hooks/claude-dev-environment.sh setup

# Quick start wizard (interactive)
~/.claude/hooks/claude-dev-environment.sh quick-start

# Show workflow examples and configuration
~/.claude/hooks/claude-dev-environment.sh workflow
~/.claude/hooks/claude-dev-environment.sh examples

# Create shell aliases for efficient workflows
~/.claude/hooks/claude-dev-environment.sh aliases

# Complete TypeScript workflow setup
~/.claude/hooks/typescript-workflow.sh setup

# Multi-language development environment
~/.claude/hooks/claude-development-setup.sh languages

# Editor-specific configuration
~/.claude/hooks/claude-development-setup.sh editors

# Run testing integration
~/.claude/hooks/claude-test-integration.sh run all
```

### Git and Version Control

```bash
# Install standard git hooks
~/.claude/hooks/install-git-hooks.sh

# Git integration setup
~/.claude/hooks/claude-git-integration.sh install-hooks

# Git status with context
~/.claude/hooks/claude-git-integration.sh status
```

## ⚙️ Hook Configuration

### Project-Specific Configuration

Create `.claude-hooks-config.sh` in your project root:

```bash
# Language-specific options
CLAUDE_HOOKS_GO_ENABLED=false
CLAUDE_HOOKS_PYTHON_ENABLED=true
CLAUDE_HOOKS_JS_ENABLED=true
CLAUDE_HOOKS_RUST_ENABLED=false

# Performance tuning
CLAUDE_HOOKS_FAIL_FAST=true
CLAUDE_HOOKS_DEBUG=1
CLAUDE_HOOKS_SHOW_TIMING=true
```

### Global Hook Settings

Environment variables for hook behavior:

```bash
export CLAUDE_HOOKS_ENABLED=true
export CLAUDE_HOOKS_DEBUG=1
export CLAUDE_HOOKS_FAIL_FAST=false
```

## 📊 Hook Status and Monitoring

### System Status Check

```bash
# Comprehensive system health
~/.claude/hooks/health-check.sh

# Hook-specific status
~/.claude/hooks/claude-control.sh status

# Performance monitoring
~/.claude/hooks/claude-monitor.sh performance
```

### Troubleshooting

```bash
# Debug mode execution
CLAUDE_HOOKS_DEBUG=1 ~/.claude/hooks/smart-lint.sh

# Check hook dependencies
~/.claude/hooks/health-check.sh dependencies

# Reset hook configuration
~/.claude/hooks/configure-claude.sh reset
```

## 🔧 Hook Management Operations

### Setup and Installation

```bash
# Complete environment setup
~/.claude/hooks/configure-claude.sh

# Install all development hooks
~/.claude/hooks/claude-control.sh setup install-hooks

# Update hook configurations
~/.claude/hooks/claude-control.sh maintenance update
```

### Performance Optimization

```bash
# Memory optimization
~/.claude/hooks/claude-memory-optimizer.sh optimize

# Context loading optimization
~/.claude/hooks/claude-context-loader.sh preload

# Cache management
~/.claude/hooks/claude-control.sh maintenance cleanup
```

## 📚 Hook Documentation

For detailed documentation on individual hooks:

- **Complete Hook Reference**: `~/.claude/hooks/README.md`
- **Hook Library Functions**: `~/.claude/hooks/lib/`
- **Configuration Examples**: `~/.claude/hooks/example-claude-hooks-config.sh`

## 🎯 Integration with Commands

Hooks are automatically integrated with other Claude commands:

- **`/check`** - Uses smart-lint.sh for validation
- **`/next`** - References hook workflow requirements
- **`/prompt`** - Includes hook status in synthesis

## ⚡ Usage Examples

**Complete Development Setup:**

```bash
# 1. System health check
~/.claude/hooks/health-check.sh

# 2. Configure development environment
~/.claude/hooks/configure-claude.sh

# 3. Install git hooks
~/.claude/hooks/install-git-hooks-ts.sh

# 4. Optimize VS Code integration
~/.claude/hooks/vscode-integration.sh configure
```

**Project-Specific Setup:**

```bash
# 1. Build project context
~/.claude/hooks/build-claude-context.sh

# 2. Setup testing integration
~/.claude/hooks/claude-test-integration.sh setup

# 3. Configure TypeScript workflow
~/.claude/hooks/typescript-workflow.sh configure
```

This comprehensive hook system ensures consistent, automated, and reliable development workflow with zero-tolerance error handling and intelligent automation.
