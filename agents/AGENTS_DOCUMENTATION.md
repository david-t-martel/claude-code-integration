# Claude Code Agents Documentation

## Overview

Claude Code Subagents are specialized AI assistants that can handle specific tasks within your development workflow. They operate in separate context windows with focused expertise, custom system prompts, and specific tool access, enabling more efficient problem-solving through task specialization.

## What are Subagents?

Subagents are specialized AI assistants within Claude Code that provide:

- **Separate Context Window**: Each subagent maintains its own conversation history
- **Specific Purpose**: Focused on particular types of tasks or domains
- **Custom System Prompts**: Tailored instructions for specialized behavior
- **Tool Access Control**: Can be granted specific tool permissions
- **Task Delegation**: Automatically invoked based on task context

## Creating Subagents

### Method 1: Using /agents Command (Recommended)

The `/agents` command provides an interactive interface for managing subagents:

```bash
# Create a new subagent
/agents create "TestAgent" "Run unit tests" "pytest"

# List available subagents
/agents list

# Remove a subagent
/agents remove TestAgent

# Edit existing subagent
/agents edit TestAgent
```

#### Interactive Setup Process
1. **Name Selection**: Choose a unique identifier (lowercase, hyphen-separated)
2. **Description**: Define when the subagent should be invoked
3. **Tool Selection**: Select from available tools including MCP server tools
4. **System Prompt**: Define the agent's role and capabilities

### Method 2: Direct File Management

Create Markdown files in appropriate directories:
- **Project Subagents**: `.claude/agents/` (shared with team)
- **Personal Subagents**: `~/.claude/agents/` (user-specific)

#### Subagent File Structure

```markdown
---
name: your-sub-agent-name
description: When this subagent should be invoked
tools: optional tool list
---

System prompt defining role and capabilities
```

#### Example Subagent File

`.claude/agents/code-reviewer.md`:
```markdown
---
name: code-reviewer  
description: Review code for quality, security, and best practices
tools: [Read, Edit, Bash]
---

You are a senior code reviewer specializing in:

1. **Security Analysis**: Identify potential vulnerabilities
2. **Performance Review**: Spot inefficiencies and bottlenecks  
3. **Code Quality**: Check for maintainability and readability
4. **Best Practices**: Ensure adherence to coding standards

## Review Process
1. Read and understand the code context
2. Identify issues by priority (Critical, High, Medium, Low)
3. Provide specific, actionable feedback
4. Suggest concrete improvements with examples

## Output Format
- **Summary**: Brief overview of findings
- **Critical Issues**: Security vulnerabilities, breaking changes
- **Improvements**: Performance and quality enhancements
- **Style**: Formatting and convention suggestions
```

## Configuration Fields

### Required Fields
- **`name`**: Unique identifier for the subagent
  - Format: lowercase with hyphens (e.g., `data-analyst`, `test-runner`)
  - Must be unique within project/user scope

- **`description`**: Clear explanation of the subagent's purpose
  - Used for automatic task delegation
  - Should be specific and action-oriented

### Optional Fields
- **`tools`**: Array of permitted tools
  - Limits what the subagent can access
  - Examples: `[Read, Edit, Bash, WebSearch]`
  - Can include MCP server tools

## Example Subagents

### 1. Code Reviewer
```markdown
---
name: code-reviewer
description: Review code for quality, security, and maintainability
tools: [Read, Edit]
---

You are an expert code reviewer focused on:
- Security vulnerability detection
- Performance optimization opportunities  
- Code maintainability and readability
- Best practice adherence

Provide prioritized feedback with specific examples.
```

### 2. Test Debugger  
```markdown
---
name: test-debugger
description: Debug failing tests and identify root causes
tools: [Read, Bash, Edit]
---

You are a testing specialist who:
- Analyzes test failures systematically
- Identifies root causes quickly
- Implements minimal, targeted fixes
- Ensures test reliability and maintainability

Focus on understanding the failure before proposing solutions.
```

### 3. Data Scientist
```markdown
---
name: data-scientist
description: Handle SQL queries and data analysis tasks
tools: [Read, Write, Bash]
---

You are a data scientist specializing in:
- Writing efficient SQL queries
- Performing statistical analysis
- Creating data visualizations
- Providing data-driven insights

Always validate data quality and explain your analytical approach.
```

### 4. Documentation Writer
```markdown
---
name: docs-writer
description: Create and maintain project documentation
tools: [Read, Write, Edit]
---

You are a technical writer who creates:
- Clear API documentation
- Comprehensive README files
- Code comments and docstrings
- User guides and tutorials

Focus on clarity, completeness, and practical examples.
```

## Subagent Invocation

### Automatic Delegation
Claude Code automatically selects appropriate subagents based on:
- Task description keywords
- File types being modified
- Context of the conversation
- Subagent descriptions

Example:
```bash
# Automatically invokes code-reviewer subagent
"Please review this authentication module for security issues"

# Automatically invokes test-debugger subagent  
"The unit tests are failing with assertion errors"
```

### Explicit Invocation
Directly request specific subagents:
```bash
# Explicit subagent request
"Use the data-scientist subagent to analyze this CSV file"

# Multiple subagent workflow
"Have the code-reviewer check this, then use test-debugger to fix any issues"
```

### Chaining Subagents
Combine multiple subagents for complex workflows:
```bash
"Use the code-reviewer to identify issues, then the test-debugger to create tests, and finally the docs-writer to update documentation"
```

## Best Practices

### Design Principles
1. **Single Responsibility**: Each subagent should have one clear focus area
2. **Specific Expertise**: Deep knowledge in a particular domain
3. **Clear Boundaries**: Well-defined scope of responsibilities
4. **Complementary Skills**: Different subagents should work well together

### System Prompt Guidelines
1. **Role Definition**: Clearly state what the subagent is and does
2. **Expertise Areas**: List specific skills and knowledge domains
3. **Process Steps**: Outline the approach the subagent should take
4. **Output Format**: Specify expected response structure
5. **Quality Standards**: Define criteria for good work

### Tool Access Management
1. **Principle of Least Privilege**: Grant only necessary tools
2. **Task-Appropriate**: Match tools to subagent responsibilities
3. **Security Conscious**: Be careful with powerful tools like Bash
4. **MCP Integration**: Include relevant MCP server tools

### Naming Conventions
1. **Descriptive**: Names should clearly indicate purpose
2. **Consistent**: Follow project naming patterns
3. **Hierarchical**: Use prefixes for related subagents
4. **Memorable**: Easy to remember and type

## Advanced Usage

### Context Preservation
- Subagents help preserve main conversation context
- Use for investigation tasks early in conversations
- Delegate specific analysis to maintain focus

### Performance Considerations
- Slight latency due to context gathering
- More efficient for specialized tasks
- Reduces cognitive load on main conversation

### Team Collaboration
- Share project subagents via version control
- Document subagent purposes and usage
- Maintain consistent subagent library
- Regular review and updates

### Integration Patterns
- **Validation Pipeline**: code-reviewer → test-runner → deployer
- **Analysis Chain**: data-scientist → report-writer → presenter  
- **Development Flow**: architect → coder → reviewer → tester

## Troubleshooting

### Subagent Not Found
- Check file location (`.claude/agents/` or `~/.claude/agents/`)
- Verify filename has `.md` extension
- Ensure proper YAML frontmatter syntax

### Automatic Delegation Issues
- Make descriptions more specific and action-oriented
- Use keywords that match your task descriptions
- Test invocation with explicit requests first

### Tool Access Problems
- Review `tools` configuration in frontmatter
- Check tool names match available tools exactly
- Verify MCP server connections for external tools

### Performance Issues
- Limit tool access to essential tools only
- Keep system prompts focused and concise
- Consider breaking complex subagents into smaller ones

## Subagent Library Management

### Organization Structure
```
.claude/agents/
├── development/
│   ├── code-reviewer.md
│   ├── test-debugger.md
│   └── refactoring-specialist.md
├── data/
│   ├── sql-analyst.md
│   ├── data-scientist.md
│   └── report-generator.md
├── documentation/
│   ├── api-writer.md
│   ├── readme-maintainer.md
│   └── tutorial-creator.md
└── deployment/
    ├── ci-cd-manager.md
    ├── security-scanner.md
    └── performance-monitor.md
```

### Version Control
- Include project subagents in repository
- Use `.gitignore` for personal subagents in user directory
- Document subagent changes in commit messages
- Tag releases with subagent updates

### Maintenance
- Regular review of subagent effectiveness
- Update system prompts based on experience
- Archive unused subagents
- Share useful subagents across projects

This comprehensive documentation provides everything needed to create, configure, and effectively use Claude Code subagents in your development workflow.