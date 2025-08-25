# Contributing to Claude Code Integration

Thank you for your interest in contributing to Claude Code Integration! This guide will help you get started with contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)
- [Community](#community)

## Code of Conduct

This project adheres to the [Contributor Covenant](https://www.contributor-covenant.org/). By participating, you are expected to uphold this code. Please report unacceptable behavior to [david.martel@auricleinc.com](mailto:david.martel@auricleinc.com).

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js 18+** and **pnpm 8+** installed
- **Git** configured with your GitHub account
- **Windows 10/11** with **WSL2** (for Windows-specific development)
- **Rust toolchain** (optional, for Rust components)
- **GitHub CLI** (`gh`) for repository management

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/claude-code-integration.git
   cd claude-code-integration
   ```

3. Add the upstream remote:
   ```bash
   git remote add upstream https://github.com/david-t-martel/claude-code-integration.git
   ```

## Development Setup

### Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Start development mode
pnpm dev
```

### Environment Configuration

1. Copy the development configuration:
   ```bash
   cp configs/development/.env.example .env
   ```

2. Configure your Claude Code settings:
   ```bash
   # Windows
   copy configs\development\settings.json %USERPROFILE%\.claude\settings.json
   
   # WSL/Linux
   cp configs/development/settings.json ~/.claude/settings.json
   ```

### Verify Setup

```bash
# Lint code
pnpm lint

# Type checking
pnpm tsc --noEmit

# Run all checks
pnpm test && pnpm lint && pnpm build
```

## Project Structure

```
claude-code-integration/
├── .github/                 # GitHub workflows and templates
│   ├── workflows/          # CI/CD workflows
│   ├── ISSUE_TEMPLATE/     # Issue templates
│   └── dependabot.yml      # Dependabot configuration
├── packages/               # Monorepo packages
│   ├── core/              # Shared utilities
│   ├── hooks/             # Hook system
│   ├── windows-tools/     # Windows-specific tools
│   └── mcp-servers/       # MCP server implementations
├── agents/                # AI agent configurations
├── commands/              # Custom command definitions
├── configs/               # Configuration files
├── docs/                  # Documentation
├── scripts/               # Build and utility scripts
└── tests/                 # Integration and E2E tests
```

### Key Technologies

- **TypeScript** - Primary language for packages
- **Node.js** - Runtime environment
- **pnpm** - Package manager with workspaces
- **Turbo** - Build system for monorepo
- **Vitest** - Testing framework
- **ESLint** + **Prettier** - Code quality tools
- **GitHub Actions** - CI/CD pipelines

## Making Changes

### Branch Strategy

- `main` - Production-ready code
- `develop` - Development integration branch
- `feature/*` - Feature development
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates

### Workflow

1. **Create a branch** from `develop`:
   ```bash
   git checkout develop
   git pull upstream develop
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards

3. **Test your changes** thoroughly:
   ```bash
   pnpm test
   pnpm lint
   pnpm build
   ```

4. **Commit your changes** using conventional commits:
   ```bash
   git add .
   git commit -m "feat: add new hook validation system"
   ```

5. **Push and create a PR**:
   ```bash
   git push origin feature/your-feature-name
   ```

### Coding Standards

#### TypeScript

- Use strict TypeScript configuration
- Prefer explicit type annotations for public APIs
- Use meaningful variable and function names
- Follow ESLint rules configured in the project

#### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks
- `ci:` - CI/CD changes

Examples:
```
feat(hooks): add pre-tool validation system
fix(windows): resolve path handling on Windows 11
docs: update installation guide for WSL2
```

#### Code Style

- Use Prettier for formatting
- Follow ESLint rules
- Use descriptive names for variables and functions
- Add JSDoc comments for public APIs
- Keep functions small and focused

```typescript
/**
 * Validates a hook configuration against the schema
 * @param config - The hook configuration to validate
 * @returns Promise resolving to validation result
 * @throws {ValidationError} When configuration is invalid
 */
export async function validateHookConfig(
  config: HookConfig
): Promise<ValidationResult> {
  // Implementation
}
```

## Testing

### Test Structure

- **Unit tests** - `packages/*/src/**/*.test.ts`
- **Integration tests** - `tests/integration/`
- **E2E tests** - `tests/e2e/`

### Running Tests

```bash
# All tests
pnpm test

# Specific package
pnpm --filter @claude-code/hooks test

# With coverage
pnpm test:coverage

# Watch mode
pnpm test:watch

# E2E tests
pnpm test:e2e
```

### Test Guidelines

- Write tests for all new features
- Maintain or improve test coverage
- Use descriptive test names
- Test edge cases and error conditions
- Mock external dependencies appropriately

```typescript
describe('HookValidator', () => {
  describe('validateConfig', () => {
    it('should validate a correct hook configuration', async () => {
      const config = { /* valid config */ };
      const result = await validator.validateConfig(config);
      expect(result.isValid).toBe(true);
    });

    it('should reject configuration with missing required fields', async () => {
      const config = { /* invalid config */ };
      const result = await validator.validateConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required field: type');
    });
  });
});
```

## Pull Request Process

### Before Submitting

1. **Update documentation** as needed
2. **Add tests** for new functionality
3. **Ensure all checks pass** locally
4. **Update CHANGELOG.md** for significant changes
5. **Rebase on latest develop** branch

### PR Requirements

- Descriptive title and detailed description
- Link to related issues using `Closes #123`
- All CI checks must pass
- At least one approving review required
- Up-to-date with base branch

### PR Template

Our PR template includes:
- Description of changes
- Type of change (bug fix, feature, etc.)
- Testing information
- Breaking changes (if any)
- Documentation updates

### Review Process

1. **Automated checks** run first (CI, security scans)
2. **Code review** by maintainers
3. **Testing** in review environment
4. **Approval** and merge

## Release Process

### Version Management

We use [semantic versioning](https://semver.org/):
- `MAJOR.MINOR.PATCH`
- Breaking changes increment MAJOR
- New features increment MINOR
- Bug fixes increment PATCH

### Release Workflow

1. **Prepare release** on `develop` branch
2. **Create release PR** to `main`
3. **Automated release** via GitHub Actions
4. **Package publishing** to GitHub Packages

### Changesets (Coming Soon)

We'll be implementing changeset-based releases:
```bash
# Add a changeset
pnpm changeset

# Version packages
pnpm changeset version

# Publish release
pnpm changeset publish
```

## Community

### Getting Help

- **Discussions** - Ask questions and share ideas
- **Issues** - Report bugs and request features
- **Email** - [david.martel@auricleinc.com](mailto:david.martel@auricleinc.com)

### Contributing Areas

We welcome contributions in:

- **Code** - Bug fixes, features, performance improvements
- **Documentation** - Guides, API docs, examples
- **Testing** - Unit tests, integration tests, E2E tests
- **Issues** - Bug reports, feature requests, discussions
- **Reviews** - Code review, testing pull requests

### Recognition

Contributors are recognized in:
- Repository contributors page
- Release notes
- Special thanks in major releases

## Quick Reference

### Common Commands

```bash
# Development
pnpm dev                    # Start development mode
pnpm build                  # Build all packages
pnpm test                   # Run tests
pnpm lint                   # Lint code
pnpm format                 # Format code

# Package management
pnpm install               # Install dependencies
pnpm clean                 # Clean build artifacts
pnpm --filter <pkg> <cmd>  # Run command in specific package

# Git workflow
git checkout develop       # Switch to develop
git pull upstream develop  # Update from upstream
git checkout -b feat/name  # Create feature branch
```

### Troubleshooting

#### Common Issues

**Dependencies not installing:**
```bash
pnpm clean
pnpm install --frozen-lockfile
```

**Tests failing:**
```bash
pnpm build
pnpm test --reporter=verbose
```

**WSL integration issues:**
- Ensure WSL2 is installed and running
- Check Windows path mappings
- Verify file permissions

**Build failures:**
```bash
pnpm clean
pnpm install
pnpm build --force
```

#### Getting Unstuck

1. Check existing issues and discussions
2. Review documentation
3. Ask in GitHub discussions
4. Contact maintainers via email

---

Thank you for contributing to Claude Code Integration! Your help makes this project better for everyone. 🚀