# Model Context Protocol (MCP) - Comprehensive Usage Guide

This guide provides thorough documentation for using the Model Context Protocol (MCP) with Claude Code, based on Anthropic's official documentation and analysis of your current configuration.

## Table of Contents

1. [Overview](#overview)
2. [Configuration Structure](#configuration-structure)
3. [Server Types and Transport Methods](#server-types-and-transport-methods)
4. [Security Considerations](#security-considerations)
5. [Current Server Inventory](#current-server-inventory)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)
8. [Schema Compliance](#schema-compliance)

## Overview

The Model Context Protocol (MCP) is an open-source standard that enables standardized communication between AI models, tools, and data sources. It allows Claude Code to integrate with external services, tools, and data sources through a well-defined protocol.

### Key Benefits
- **Standardized Communication**: Consistent interface for tool integration
- **Security**: Built-in authentication and security mechanisms
- **Scalability**: Support for multiple transport protocols
- **Cross-Platform**: Works across Windows and WSL environments

## Configuration Structure

Your MCP configuration follows the official schema with these main sections:

### Core Configuration Elements

```json
{
  "$schema": "https://raw.githubusercontent.com/modelcontextprotocol/specification/main/schema/mcp_config_schema.json",
  "mcpServers": { /* Server definitions */ },
  "globalSettings": { /* Global configuration */ },
  "security": { /* Security settings */ }
}
```

### Required Fields per Server
- `command`: Executable path or command
- `args`: Command-line arguments array
- `env`: Environment variables object
- `timeout`: Timeout in milliseconds
- `restart`: Boolean for auto-restart
- `description`: Human-readable description
- `enabled`: Boolean to enable/disable server

## Server Types and Transport Methods

### 1. Local STDIO Servers
**Purpose**: Direct process communication for local tools
**Transport**: Standard input/output streams
**Best for**: High-performance local operations

**Example Configuration**:
```json
"rust-fs": {
  "command": "rust-fs",
  "args": ["--mode", "mcp", "--protocol", "stdio"],
  "env": {
    "RUST_LOG": "info",
    "RUST_FS_MAX_CONCURRENT": "16"
  },
  "timeout": 30000,
  "restart": true,
  "enabled": true
}
```

### 2. HTTP Servers
**Purpose**: Remote server communication via HTTP
**Transport**: HTTP requests/responses
**Best for**: Remote services, concurrent connections

**Example Configuration**:
```json
"vertex-code-reviewer-http": {
  "command": "uvx",
  "args": ["--from", "vertex-mcp", "vertex-code-reviewer", "--transport", "http", "--port", "8000"],
  "env": {
    "MCP_TRANSPORT": "http",
    "MCP_HOST": "127.0.0.1",
    "MCP_PORT": "8000"
  }
}
```

### 3. NPX-based Servers
**Purpose**: Node.js package execution
**Transport**: Various (typically STDIO)
**Best for**: JavaScript/TypeScript based tools

**Example Configuration**:
```json
"context7": {
  "command": "npx",
  "args": ["-y", "@upstash/context7-mcp"],
  "env": {
    "CURRENT_PROFILE": "personal"
  }
}
```

## Security Considerations

### Authentication Methods

#### 1. Service Account Authentication
```json
"env": {
  "GOOGLE_APPLICATION_CREDENTIALS": "/home/david/.auth/business/service-account-key.json"
}
```

#### 2. Environment Variable Security
```json
"env": {
  "API_KEY": "${input:api-key}",  // Secure input prompt
  "SECRET_TOKEN": "${env:SECRET_TOKEN}"  // Environment variable
}
```

#### 3. File-based Configuration Loading
```json
"command": "bash",
"args": ["-c", "source /home/david/.config/secure/cloudflare.env && npx -y @cloudflare/mcp-server-cloudflare run $CLOUDFLARE_ACCOUNT_ID"]
```

### Security Best Practices

1. **Never hardcode secrets** in configuration files
2. **Use environment variables** for sensitive data
3. **Set appropriate file permissions** (600) on credential files
4. **Validate third-party servers** before enabling
5. **Use secure transport protocols** when available
6. **Enable audit logging** for production environments

### Current Security Configuration
```json
"security": {
  "enableAuthentication": false,
  "enableRateLimiting": true,
  "defaultRateLimit": 100,
  "trustedOrigins": ["localhost", "127.0.0.1"],
  "enableAuditLogging": true,
  "auditLogPath": "/home/david/.claude/logs/mcp-audit.log"
}
```

## Current Server Inventory

### High-Performance Rust Tools (ACTIVE)
- **rust-fs**: Filesystem operations with SIMD acceleration
- **rust-fetch**: Secure HTTP content retrieval
- **rust-memory**: Knowledge graph memory system
- **rust-bridge**: Windows-WSL communication bridge
- **rust-link**: Inter-agent communication framework
- **rust-cross-platform**: Unified cross-platform coordinator
- **rust-sequential-thinking**: Structured reasoning framework

### Vertex AI Ecosystem (ACTIVE)
- **vertex-code-reviewer**: Code review and security analysis
- **vertex-master-architect**: System design analysis
- **vertex-code-generator**: Code generation and optimization
- **vertex-workspace-analyzer**: Project workspace analysis
- **vertex-doc-generator**: Documentation generation
- **vertex-gcp-manager**: GCP resource management

### Integration Services (ACTIVE)
- **context7**: Long-term context management
- **gemini-cli**: Google AI/Cloud integration
- **redis-memory-gpu**: GPU-accelerated memory system
- **weather**: National Weather Service data
- **serena**: Semantic code retrieval toolkit
- **docker-gateway**: Docker container management

### Third-Party Integrations
- **ironclads-cloudflare**: Enterprise Cloudflare management (ACTIVE)
- **dropbox-mcp**: Dropbox file operations (DISABLED)
- **gcp-wsl**: Alternative GCP integration (DISABLED)

## Best Practices

### 1. Server Configuration
```json
{
  "timeout": 30000,          // 30 seconds is recommended
  "restart": true,           // Enable auto-restart
  "enabled": true,           // Explicit enable/disable
  "description": "Clear description of server purpose"
}
```

### 2. Environment Variables
- Use descriptive names with prefixes (e.g., `RUST_FS_MAX_CONCURRENT`)
- Set appropriate log levels (`RUST_LOG`: "info")
- Configure cross-platform paths when needed
- Use boolean strings ("true"/"false") for configuration flags

### 3. Performance Optimization
```json
"globalSettings": {
  "maxConcurrentServers": 16,
  "serverStartupTimeout": 10000,
  "healthCheckInterval": 60000,
  "enableMetrics": true
}
```

### 4. Cross-Platform Support
```json
"env": {
  "RUST_FS_WSL_PATH": "/home/david/.local/bin/rust-fs",
  "RUST_FS_WINDOWS_PATH": "C:\\Users\\david\\.cargo\\bin",
  "RUST_FS_MOUNT_POINTS": "C:=/mnt/c,T:=/mnt/t,F:=/mnt/f"
}
```

## Troubleshooting

### Common Issues

#### 1. Server Startup Failures
- Check executable paths and permissions
- Verify environment variables are set correctly
- Review server logs for specific error messages
- Ensure dependencies are installed

#### 2. Authentication Errors
- Verify credential file paths exist and are accessible
- Check file permissions (should be 600 for credential files)
- Ensure environment variables contain correct values
- Test authentication independently

#### 3. Cross-Platform Path Issues
- Use forward slashes in WSL paths: `/home/david/`
- Use backslashes in Windows paths: `C:\\Users\\david\\`
- Configure mount points correctly for cross-platform access
- Test path translation manually

#### 4. Network Connectivity
- Check firewall settings for HTTP servers
- Verify port availability (netstat -an)
- Test connectivity with curl or telnet
- Review proxy settings if applicable

### Diagnostic Commands

```bash
# Test MCP server connectivity
npx @modelcontextprotocol/inspector --cli --config mcp.json

# Check server health
/home/david/.local/bin/mcp-health-check.sh --verbose

# Validate configuration
/home/david/.local/bin/install-mcp-servers.sh --validate mcp.json
```

## Schema Compliance

### Official Schema Requirements

Your configuration uses the official schema:
```json
"$schema": "https://raw.githubusercontent.com/modelcontextprotocol/specification/main/schema/mcp_config_schema.json"
```

### Required Fields Validation
- ✅ All servers have required `command` field
- ✅ All servers have required `args` array
- ✅ All servers have required `env` object
- ✅ All servers have timeout specified
- ✅ All servers have restart boolean
- ✅ All servers have description strings
- ✅ All servers have enabled boolean

### Schema Extensions
Your configuration includes custom extensions:
- `globalSettings`: Performance and operational settings
- `security`: Security configuration options
- `name`, `version`, `description`: Metadata fields
- `lastUpdated`: Maintenance tracking
- `features`: Capability documentation

### Transport Protocol Compliance
- **STDIO**: Compliant with MCP specification
- **HTTP**: Uses standard HTTP transport with proper headers
- **Environment Variables**: Follows ${env:VAR} and ${input:var} patterns

## Advanced Configuration Patterns

### 1. Dual Transport Support
Many servers provide both STDIO and HTTP variants:
```json
"vertex-code-reviewer": { /* STDIO version */ },
"vertex-code-reviewer-http": { /* HTTP version */ }
```

### 2. Secure Environment Loading
```json
"command": "bash",
"args": ["-c", "source /path/to/secure.env && command"]
```

### 3. Python UV Integration
```json
"command": "uv",
"args": ["run", "--directory", "/path/to/project", "python", "-m", "module"]
```

### 4. NPX Package Execution
```json
"command": "npx",
"args": ["-y", "package-name"]
```

## Maintenance and Updates

### Regular Maintenance Tasks
1. **Update server versions** regularly
2. **Rotate credentials** periodically
3. **Review enabled servers** and disable unused ones
4. **Monitor performance metrics**
5. **Check audit logs** for security events

### Configuration Backup
```bash
# Backup configuration
cp mcp.json mcp.json.backup.$(date +%Y%m%d)

# Validate before applying changes
npx @modelcontextprotocol/inspector --cli --config mcp.json
```

### Performance Monitoring
- Monitor server startup times
- Check memory usage of active servers
- Review timeout frequencies
- Analyze audit logs for patterns

## Conclusion

Your MCP configuration represents a sophisticated, cross-platform ecosystem with extensive integration capabilities. The configuration follows best practices for security, performance, and maintainability while providing comprehensive functionality across Rust performance tools, Vertex AI services, and third-party integrations.

Regular maintenance, security reviews, and performance monitoring will ensure continued optimal operation of your MCP server ecosystem.