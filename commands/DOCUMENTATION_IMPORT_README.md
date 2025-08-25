# Documentation Import from Anthropic Claude Code

## Overview

This documentation was automatically extracted from Anthropic's official Claude Code documentation on August 4, 2025. The extraction process converted HTML documentation into clean, readable markdown files for offline reference and integration with the local Claude Code setup.

## Source URLs

The following official Anthropic documentation pages were processed:

1. **Slash Commands Documentation**
   - Source: https://docs.anthropic.com/en/docs/claude-code/slash-commands
   - Output: `COMMANDS_DOCUMENTATION.md`
   - Content: Built-in commands, custom command creation, MCP slash commands

2. **Hooks Documentation**  
   - Source: https://docs.anthropic.com/en/docs/claude-code/hooks
   - Output: `HOOKS_DOCUMENTATION.md`
   - Content: PreToolUse, PostToolUse, Stop, SessionStart, UserPromptSubmit hooks

3. **Settings Documentation**
   - Source: https://docs.anthropic.com/en/docs/claude-code/settings
   - Output: `CLAUDE_CODE_DOCUMENTATION.md` (Part 1)
   - Content: Configuration files, environment variables, permissions

4. **MCP Integration Documentation**
   - Source: https://docs.anthropic.com/en/docs/claude-code/mcp
   - Output: `CLAUDE_CODE_DOCUMENTATION.md` (Part 2)
   - Content: Model Context Protocol servers, OAuth, configuration

5. **Agents/Subagents Documentation**
   - Source: Extracted from multiple pages including slash-commands and usage patterns
   - Output: `AGENTS_DOCUMENTATION.md`
   - Content: Creating and using AI subagents via `/agents` command

## Processing Methodology

### 1. Content Extraction
- Used Claude's WebFetch tool to retrieve HTML content from documentation pages
- Extracted main documentation content while removing:
  - Navigation elements
  - HTML tags and attributes
  - JavaScript code snippets
  - CSS styling information
  - Sidebar menus and footers

### 2. Markdown Conversion
- Converted HTML structure to proper markdown:
  - Headers (`<h1>` to `#`, `<h2>` to `##`, etc.)
  - Code blocks with language hints
  - Tables with proper markdown formatting
  - Lists (ordered and unordered)
  - Links and cross-references

### 3. Content Organization
- Structured documentation with clear sections
- Added table of contents where appropriate
- Preserved all examples and code snippets
- Maintained original information hierarchy

### 4. Quality Assurance
- Verified all command examples are accurate
- Ensured configuration examples are complete
- Preserved all security warnings and best practices
- Maintained version-specific information

## Documentation Files Created

| File | Lines | Description |
|------|-------|-------------|
| `COMMANDS_DOCUMENTATION.md` | 240 | Complete guide to slash commands, including built-in commands, custom command creation, frontmatter options, and MCP-discovered commands |
| `AGENTS_DOCUMENTATION.md` | 319 | Comprehensive subagents documentation covering creation, configuration, invocation patterns, and team collaboration |
| `HOOKS_DOCUMENTATION.md` | 555 | Detailed hooks system reference with all event types, configuration examples, security considerations, and troubleshooting |
| `CLAUDE_CODE_DOCUMENTATION.md` | 513 | General Claude Code reference including settings, MCP integration, tools, permissions, and best practices |

## Integration with Local Setup

These documentation files are integrated into the Claude Code directory structure:
- `/home/david/.claude/commands/` - Commands documentation and examples
- `/home/david/.claude/agents/` - Agents documentation and patterns
- `/home/david/.claude/hooks/` - Hooks documentation and configuration
- `/home/david/.claude/` - General documentation and settings

## Version Information

- **Extraction Date**: August 4, 2025
- **Claude Code Version**: Latest as of extraction date
- **Documentation Format**: Markdown (CommonMark specification)
- **Character Encoding**: UTF-8

## Usage Notes

1. **Offline Reference**: These files provide complete offline documentation for Claude Code features
2. **Quick Lookup**: Use grep or search tools to find specific commands or configurations
3. **Examples**: All code examples are preserved and can be copied directly
4. **Updates**: Re-run the extraction process periodically to capture documentation updates

## Maintenance

To update this documentation:
1. Re-fetch the source URLs using WebFetch
2. Process through the same extraction pipeline
3. Compare with existing files to identify changes
4. Update version information and extraction date

## License and Attribution

This documentation is derived from Anthropic's official Claude Code documentation. All content remains the property of Anthropic, PBC. This extraction is for personal reference and development use within the Claude Code ecosystem.

---

*Generated automatically by Claude Code documentation extraction process*