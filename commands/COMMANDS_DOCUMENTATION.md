# Claude Code Slash Commands Documentation

## Overview

Claude Code provides a comprehensive system of slash commands that allow you to interact with the AI assistant in structured ways. These commands can be built-in, custom project commands, or dynamically discovered from MCP servers.

## Built-in Slash Commands

### Core Commands

- **`/add-dir`**: Add working directories to the current session
- **`/agents`**: Manage AI subagents (create, list, configure)
- **`/bug`**: Report issues to Anthropic
- **`/clear`**: Reset conversation history
- **`/config`**: Modify configuration settings
- **`/help`**: Get usage assistance and command documentation
- **`/init`**: Initialize project guide and setup
- **`/model`**: Select specific AI model for the session
- **`/review`**: Request code review from Claude
- **`/status`**: Check system status and configuration

### Command Syntax

All slash commands follow the pattern:
```
/<command-name> [arguments]
```

Arguments are passed as space-separated values and can include:
- File references with `@` prefix: `@filename.txt`
- Directory paths: `/path/to/directory`
- String arguments: `"quoted strings for multi-word arguments"`

## Custom Slash Commands

Claude Code supports two types of custom commands:

### 1. Project Commands
- Location: `.claude/commands/` (in project root)
- Scope: Available only within the specific project
- Shared with team via version control

### 2. Personal Commands
- Location: `~/.claude/commands/` (in user home directory)
- Scope: Available across all projects for the user
- Personal configuration, not shared

### Creating Custom Commands

Custom commands are created as Markdown files with optional frontmatter configuration:

#### Basic Command Structure
```markdown
---
description: Brief description of what the command does
allowed-tools: Bash(git add:*), Bash(git status:*)
model: claude-3-5-sonnet-20241022
---

Command instructions and behavior definition here.

Use $ARGUMENTS to reference command-line arguments.
Use @filename.txt to reference files.
```

#### Frontmatter Options

- **`allowed-tools`**: Specify which tools the command can use
  - Format: `ToolName(pattern:*)` or `ToolName`
  - Examples: `Bash(git add:*)`, `Edit`, `Write`
- **`description`**: Brief explanation shown in help
- **`model`**: Override default AI model for this command

#### Example Custom Command

Create `.claude/commands/commit.md`:
```markdown
---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*)
description: Create git commit based on staged changes
---

Based on the current git status and staged changes, create a single meaningful git commit with an appropriate message.

First check git status, then create the commit.
Arguments: $ARGUMENTS
```

Usage: `/project:commit "Fix user authentication bug"`

### Command Namespacing

Commands are automatically namespaced based on their location:
- Project commands: `/project:<command-name>`
- Personal commands: `/<command-name>`

### Advanced Features

#### File References
Commands can reference files using the `@` prefix:
```
/project:analyze @src/main.py @tests/test_main.py
```

#### Argument Handling
Use `$ARGUMENTS` placeholder to access all command arguments:
```markdown
---
description: Run tests with custom arguments
---

Run the test suite with the following arguments: $ARGUMENTS

If no arguments provided, run all tests.
```

#### Directory Organization
Organize commands in subdirectories for better management:
```
.claude/commands/
├── git/
│   ├── commit.md
│   ├── review.md
│   └── sync.md
├── testing/
│   ├── unit.md
│   └── integration.md
└── deploy.md
```

Access with: `/project:git/commit`, `/project:testing/unit`

## MCP Slash Commands

MCP (Model Context Protocol) servers can expose prompts as slash commands:

### Syntax
```
/mcp__<server-name>__<prompt-name> [arguments]
```

### Features
- **Dynamic Discovery**: Commands are automatically discovered from connected MCP servers
- **Argument Support**: Arguments are passed according to server definitions  
- **Real-time Updates**: Available commands update when servers are added/removed

### Example MCP Commands
```bash
# GitHub MCP server commands
/mcp__github__create-issue "Bug in user login"

# Database MCP server commands  
/mcp__postgres__query "SELECT * FROM users WHERE active = true"

# File system MCP server commands
/mcp__filesystem__search-files "*.py"
```

## Best Practices

### Command Design
1. **Single Responsibility**: Each command should have one clear purpose
2. **Clear Naming**: Use descriptive, action-oriented names
3. **Consistent Patterns**: Follow consistent naming and argument patterns
4. **Documentation**: Include helpful descriptions in frontmatter

### Security Considerations
1. **Tool Restrictions**: Use `allowed-tools` to limit command capabilities
2. **Input Validation**: Commands should validate arguments appropriately
3. **File Access**: Be mindful of which files commands can access
4. **Sensitive Operations**: Require explicit confirmation for destructive actions

### Organization
1. **Logical Grouping**: Group related commands in subdirectories
2. **Team Consistency**: Establish team conventions for command naming
3. **Version Control**: Include project commands in repository
4. **Documentation**: Maintain a command reference for your project

### Performance
1. **Efficient Tools**: Use appropriate tools for each task
2. **Batch Operations**: Combine related operations when possible
3. **Caching**: Consider caching for expensive operations
4. **Timeouts**: Handle long-running operations gracefully

## Troubleshooting

### Command Not Found
- Check file location (`.claude/commands/` or `~/.claude/commands/`)
- Verify file has `.md` extension
- Ensure proper frontmatter syntax

### Permission Errors
- Review `allowed-tools` configuration
- Check file system permissions
- Verify tool patterns match intended usage

### Argument Issues
- Use `$ARGUMENTS` placeholder correctly
- Quote multi-word arguments when calling
- Check argument parsing in command definition

### MCP Command Problems
- Verify MCP server is connected (`claude mcp list`)
- Check server status and authentication
- Review server-specific documentation

## Command Reference Template

When creating commands, use this template:

```markdown
---
description: [Clear, concise description]
allowed-tools: [Specific tool restrictions]
model: [Optional model override]
---

# Command: [command-name]

## Purpose
[Detailed explanation of what this command does]

## Usage
`/[namespace:]command-name [arguments]`

## Arguments
- `arg1`: [Description of first argument]
- `arg2`: [Description of second argument]

## Examples
```
/command-name example-arg
/command-name "multi word argument"
```

## Implementation
[Command behavior and logic]
```

This documentation provides a comprehensive guide to using and creating slash commands in Claude Code, enabling efficient and structured interactions with the AI assistant.