# Claude Code Integration Tools

A comprehensive suite of tools and integrations for enhancing Claude Code development workflow on Windows with WSL integration.

## Features

- 🪝 **Smart Hooks System** - Pre/post tool execution hooks with validation
- 🤖 **Specialized Agents** - 50+ specialized AI agents for different tasks
- 🔧 **Windows Tools** - Native Windows command execution and path handling
- 🌐 **MCP Server Integration** - Model Context Protocol server configurations
- 🔄 **Cross-Platform Support** - Seamless Windows-WSL integration
- 📝 **Custom Commands** - Extensible command system
- 🚀 **Performance Optimized** - Fast execution with caching and lazy loading

## Quick Start

### Prerequisites

- Windows 10/11 with WSL2 installed
- Node.js 18+ (Windows and WSL)
- pnpm 8+ (`npm install -g pnpm`)
- Git
- Optional: Rust toolchain for command-replacer

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/claude-code-integration.git
cd claude-code-integration

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run installation script
pnpm install:hooks
```

### Configuration

1. Copy the example configuration:
```bash
cp configs/development/.env.example .env
```

2. Update your Claude Code settings:
```bash
# Windows
copy configs\production\settings.json %USERPROFILE%\.claude\settings.json

# WSL
cp configs/production/settings.json ~/.claude/settings.json
```

3. Configure MCP servers:
```bash
# Update with your MCP server configurations
cp configs/production/mcp.json ~/.claude/mcp.json
```

## Project Structure

```
claude-code-integration/
├── packages/           # Monorepo packages
│   ├── core/          # Shared utilities
│   ├── hooks/         # Hook system
│   ├── windows-tools/ # Windows-specific tools
│   └── mcp-servers/   # MCP server implementations
├── agents/            # AI agent configurations
├── configs/           # Configuration files
├── scripts/           # Build and utility scripts
└── docs/             # Documentation
```

## Available Scripts

- `pnpm build` - Build all packages
- `pnpm test` - Run all tests
- `pnpm lint` - Lint all code
- `pnpm format` - Format code with Prettier
- `pnpm dev` - Run development mode
- `pnpm clean` - Clean all build artifacts

## Hooks System

The hooks system allows you to intercept and modify Claude Code tool executions:

### Pre-Tool-Use Hook
Validates and potentially blocks tool executions before they happen:
- Security checks for dangerous commands
- TypeScript compilation validation
- File path validation
- Custom business logic

### Post-Tool-Use Hook
Processes results after tool execution:
- Auto-formatting with Biome
- Test execution
- Result logging
- Error recovery

### Configuration

Hooks are configured in `settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{
          "type": "command",
          "command": "path/to/pre-tool-use.exe"
        }]
      }
    ]
  }
}
```

## Agents

Over 50 specialized agents are available for different tasks:

### Categories

- **Code Review** - Architecture review, code quality
- **Language Specific** - Python, TypeScript, Rust, Go, etc.
- **Domain Specific** - ML, DevOps, Security, Database
- **Task Specific** - Debugging, Testing, Documentation

### Usage

Agents can be invoked directly in Claude Code:
```
@code-reviewer - Review my recent changes
@python-pro - Optimize this Python code
@security-auditor - Check for vulnerabilities
```

## MCP Servers

Integrated MCP servers provide extended functionality:

- **rust-fs** - High-performance filesystem operations
- **github-official** - GitHub API integration  
- **gcp-wsl** - Google Cloud Platform operations
- **wsl-filesys** - WSL filesystem access

## Development

### Setting Up Development Environment

```bash
# Install development dependencies
pnpm install

# Run in development mode
pnpm dev

# Run tests in watch mode
pnpm test:watch
```

### Building

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @claude-code/hooks build
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run specific package tests
pnpm --filter @claude-code/hooks test
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

### Development Workflow

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Troubleshooting

### Common Issues

#### Hooks not executing
- Ensure hooks are built: `pnpm build`
- Check settings.json configuration
- Verify file permissions on Windows

#### WSL integration issues
- Ensure WSL2 is installed and running
- Check WSLENV configuration
- Verify path mappings in mcp.json

#### Performance issues
- Clear cache: `pnpm clean`
- Rebuild packages: `pnpm build`
- Check for circular dependencies

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Anthropic for Claude and Claude Code
- The Model Context Protocol community
- All contributors and users of this project

## Support

- [Documentation](docs/README.md)
- [Issue Tracker](https://github.com/yourusername/claude-code-integration/issues)
- [Discussions](https://github.com/yourusername/claude-code-integration/discussions)

## Roadmap

- [ ] VSCode extension integration
- [ ] Cloud deployment support
- [ ] Advanced caching strategies
- [ ] Plugin system for custom tools
- [ ] Web UI for configuration management

---

Built with ❤️ for the Claude Code community