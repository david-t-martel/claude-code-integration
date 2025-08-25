# CLAUDE.md - Universal Claude Code Guidelines

This file provides universal guidance for ALL Claude Code instances running on this Windows environment with WSL integration.

## 🚨 CRITICAL PYTHON EXECUTION DIRECTIVE 🚨

**ABSOLUTELY MUST USE UV FOR ALL PYTHON EXECUTION** - ZERO TOLERANCE POLICY

- ❌ **NEVER EVER** use bare `python` or `python3` commands
- ❌ **NEVER EVER** use `pip` directly - use `uv pip` instead
- ✅ **ALWAYS** use `uv run python` for Python execution (in WSL)
- ✅ **ALWAYS** use `poetry run` when using Poetry environments (in WSL)
- ✅ **ALWAYS** use `uv pip` for package management (in WSL)

**THIS IS A MANDATORY DIRECTIVE THAT OVERRIDES ALL OTHER CONSIDERATIONS**

## 📚 CRITICAL DOCUMENTATION DIRECTIVE 📚

**MUST READ ALL PROJECT DOCUMENTATION BEFORE ANY WORK** - ZERO TOLERANCE POLICY

- ✅ **ALWAYS** read README.md first
- ✅ **ALWAYS** read project-specific CLAUDE.md before planning
- ✅ **ALWAYS** read ARCHITECTURE.md and technical docs before coding
- ✅ **ALWAYS** understand requirements BEFORE jumping into tasks
- ❌ **NEVER** start coding without understanding the project structure
- ❌ **NEVER** make assumptions about how systems work

**Each project has SPECIFIC REQUIREMENTS that MUST be understood FIRST**

## 🚨 CRITICAL ANTI-DUPLICATION DIRECTIVE 🚨

**ABSOLUTELY NO ENHANCED/SIMPLE FILE VARIANTS** - ZERO TOLERANCE POLICY

### BEFORE CREATING ANY FILE:
1. **SEARCH FIRST**: Use Glob, Grep, or Read to check if similar functionality exists
2. **UPDATE EXISTING**: If found, UPDATE the existing file - DO NOT create a new variant
3. **ONE CANONICAL VERSION**: Each functionality should have exactly ONE file

### FORBIDDEN FILE PATTERNS:
- ❌ **NEVER EVER** create files with names like:
  - `enhanced_client.py`, `simple_agent.py`, `client_v2.py`
  - `improved_*.py`, `optimized_*.py`, `new_*.py`
  - `*_enhanced.*`, `*_simple.*`, `*_v2.*`, `*_v3.*`, `*_updated.*`
  - `*Manager.ps1`, `*ManagerV2.ps1`, `*ManagerV3.ps1` (use ONE version)
  - Any file that duplicates functionality with naming variants

### MANDATORY PRACTICES:
- ✅ **ALWAYS SEARCH EXISTING FILES FIRST** - check for similar functionality before creating
- ✅ **ALWAYS FIX EXISTING FILES** - modify in place rather than creating variants
- ✅ **ALWAYS** consolidate functionality into a single, well-designed file
- ✅ **ALWAYS** use configuration options, inheritance, or composition for different behaviors
- ✅ **ALWAYS** refactor existing code to support new requirements
- ✅ **ALWAYS** add comments like `# This is the CANONICAL version` to primary files

### ENFORCEMENT:
- If you create a V2/V3/enhanced file, you MUST immediately:
  1. Merge the best features into the original file
  2. Delete the variant files
  3. Update all references to use the canonical version

**WHY THIS MATTERS**:
- Prevents code divergence and maintenance nightmare
- Forces better architectural decisions
- Reduces cognitive load and improves code quality
- Eliminates confusion about which file is "canonical"
- Maintains clean, professional codebases

## Windows-WSL Integration Guidelines

### Cross-Platform Path Management

**Windows → WSL Access**:
```powershell
# Access WSL files from Windows
\\wsl.localhost\Ubuntu\home\david\
\\wsl$\Ubuntu\home\david\

# Execute WSL commands from PowerShell
wsl <command>
wsl /home/david/scripts/script.sh
```

**WSL → Windows Access**:
```bash
# Windows drives mounted in WSL
/mnt/c/Users/david/      # C: drive
/mnt/t/                  # T: drive
/mnt/f/                  # F: drive

# Execute Windows programs from WSL
/mnt/c/Windows/System32/cmd.exe /c "command"
powershell.exe -Command "Get-Process"
```

### Development Environment Access

**Primary Development Locations**:
- **Windows Projects**: `C:\codedev\`, `T:\`, `F:\`
- **WSL Projects**: `/home/david/projects/`, `/home/david/agents/`
- **Shared Authentication**: `C:\Users\david\.auth\` ↔ `/home/david/.auth/`

**VS Code Integration**:
```powershell
# Open WSL project in VS Code
code \\wsl.localhost\Ubuntu\home\david\projects\<project>

# Open from WSL
wsl code ~/projects/<project>
```

## Google Cloud Platform Integration

### Profile Management

The system maintains two profiles for different contexts:
- **Business Profile**: `david.martel@auricleinc.com` → Project: `auricleinc-gemini`
- **Personal Profile**: `davidmartel07@gmail.com` → Project: `dtm-gemini-ai`

### Windows PowerShell Commands
```powershell
# Profile management
Set-GcpProfile business    # Switch to business account
Set-GcpProfile personal    # Switch to personal account
Get-GcpProfile             # Check current profile

# Authentication testing
Test-GcpProfile            # Test current authentication
Get-GcpAuthStrategy        # Get authentication strategy
```

### WSL Commands (via `wsl` prefix)
```bash
wsl gcp-profile business    # Switch to business account
wsl gcp-profile personal    # Switch to personal account
wsl gcp-profile status      # Check current profile

wsl gcp-auth test          # Test current profile
wsl gcp-auth verify        # Verify all credentials
```

## MCP Server Configuration

### Active MCP Servers
1. **rust-fs** - High-performance filesystem operations (ACTIVE ✅)
2. **github-official** - Official GitHub HTTP-based MCP server (ACTIVE ✅)
3. **gcp-wsl** - Google Cloud Platform operations
4. **cloud-run-wsl** - Cloud Run management
5. **google-adk-wsl** - Google ADK operations
6. **vertex-*-wsl** - Vertex AI specialized agents (10+ servers)

### MCP Server Management from Windows
```powershell
# Via WSL
wsl /home/david/.local/bin/mcp-manager.py install config.json
wsl /home/david/.local/bin/mcp-manager.py validate config.json
wsl /home/david/.local/bin/mcp-manager.py health-check

# MCP Inspector validation
npx @modelcontextprotocol/inspector --cli --config config.json
```

## AI Agent Framework Access

### Gemini Agents (via WSL)
```powershell
# Using UVX for fast execution
wsl uvx --from ~/agents/gemini-agents gmagents analyze "Your prompt"
wsl uvx --from ~/agents/gemini-agents gmagents --business workspace /path/to/project

# Traditional execution
wsl "cd ~/agents/gemini-agents && make test"
```

### Rust LLM (Local Inference via WSL)
```powershell
wsl "cd ~/agents/rust-llm && cargo run --bin rust-llm -- chat"
wsl "cd ~/agents/rust-llm && cargo run --bin rust-llm -- serve --bind 0.0.0.0:8080"
```

### Claude Agents (FFmpeg Specialists via WSL)
```powershell
wsl "cd ~/agents/claude-agents && python -m agents.ffmpeg_specialist --help"
```

## Development Patterns

### File Operations Best Practices

**From Windows**:
1. **WSL Files**: Use `\\wsl.localhost\Ubuntu\` path prefix
2. **Windows Files**: Use standard Windows paths
3. **Cross-Platform**: Use WSLENV for environment variable sharing

**From WSL**:
1. **Windows Files**: Access via `/mnt/c/`, `/mnt/t/`, etc.
2. **WSL Native**: Use standard Linux paths
3. **Performance**: Keep frequently accessed files in WSL filesystem

### Python Development (via WSL)
```powershell
# Always execute Python via WSL with uv
wsl uv run python script.py
wsl uv pip install package
wsl uv venv create

# NEVER use bare Python commands
# ❌ python script.py
# ❌ pip install package
# ✅ wsl uv run python script.py
```

### Git Operations
```powershell
# Windows git configuration
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
git config --global init.defaultBranch main

# GitHub CLI operations
gh repo list
gh pr create
gh issue list

# WSL git operations
wsl git status
wsl git commit -m "message"
```

## Testing and Quality Checks

### Via WSL from Windows
```powershell
# Smart linting
wsl /home/david/claude-linter/hooks/smart-lint.sh --fast
wsl /home/david/claude-linter/hooks/smart-lint.sh --full

# MCP server testing
wsl /home/david/claude-linter/hooks/test-mcp-servers.sh

# Health checks
wsl /home/david/claude-linter/hooks/health-check.sh
```

### Python Testing
```powershell
# Always via WSL with uv
wsl "cd ~/projects/<project> && uv run pytest"
wsl "cd ~/projects/<project> && uv run pytest --cov"
```

## Performance Considerations

### Windows-Specific Optimizations
1. **WSL2 Performance**: Keep development files in WSL native filesystem
2. **Drive Usage**:
   - `C:\codedev\` for active Windows projects
   - `T:\` for large files and caches
   - WSL filesystem for Linux-native development
3. **Path Translation**: Use WSLENV for seamless environment variable sharing
4. **VS Code Remote**: Use WSL Remote extension for native Linux development

### Cross-Platform Caching
- **Python packages**: Shared cache via WSLENV
- **Node modules**: Project-specific to avoid cross-platform issues
- **Docker images**: WSL2 backend for Windows Docker Desktop
- **MCP connections**: Persistent connection pooling

## Quick Reference

### Essential Commands from Windows

**Profile Management**:
```powershell
# Windows PowerShell
Set-GcpProfile business
Test-GcpProfile

# WSL Bash
wsl gcp-profile business
wsl gcp-auth test
```

**Development**:
```powershell
# Open WSL terminal
wsl

# Execute single WSL command
wsl <command>

# Access WSL files
explorer.exe \\wsl.localhost\Ubuntu\home\david\

# VS Code with WSL
code \\wsl.localhost\Ubuntu\home\david\projects\
```

**Testing**:
```powershell
# Via WSL
wsl /home/david/claude-linter/hooks/smart-lint.sh --fast
wsl /home/david/claude-linter/hooks/test-mcp-servers.sh
```

## Important Reminders

1. **Cross-Platform Paths**: Use appropriate path formats for Windows vs WSL
2. **Python Execution**: ALWAYS use `wsl uv run python`, NEVER bare `python`
3. **Credential Security**: Maintain proper permissions (600) on auth files
4. **Profile Awareness**: Check active GCP profile before cloud operations
5. **WSL Integration**: Prefer WSL for development, Windows for system operations
6. **NO duplicate files**: Always fix existing files, never create variants
7. **Use modern tools**: PowerShell 7+ on Windows, `uv` for Python in WSL
8. **Test MCP servers**: Validate before complex operations
9. **Git configuration**: Ensure global config is set properly
10. **Documentation first**: Always read project docs before starting work

## MCP Server Configuration Guidelines

### Windows-Specific MCP Configuration

When configuring MCP servers on Windows, follow these patterns:

1. **Use cmd wrapper for npx commands**:
   ```json
   "command": "cmd",
   "args": ["/c", "npx", "-y", "package-name"]
   ```
   NOT: `"command": "npx"`

2. **WSL command execution**:
   ```json
   "command": "wsl",
   "args": ["bash", "-c", "cd /path && command"]
   ```

3. **Environment variables in proper field**:
   ```json
   "env": {
     "VAR_NAME": "value"
   }
   ```
   NOT in args: `["bash", "-c", "source file.env && command"]`

4. **Cross-platform path handling**:
   - Windows paths: `C:/Users/david` or `C:\\Users\\david`
   - WSL paths: `/home/david` or `\\wsl.localhost\Ubuntu\home\david`

### MCP Server Best Practices

1. **Test server connection**: Use `claude mcp list` to verify
2. **Check tool availability**: Servers must be connected to use their tools
3. **Virtual environments**: For Python MCP servers in WSL, activate venv in args
4. **Service account auth**: Use `GOOGLE_APPLICATION_CREDENTIALS` for Google services
5. **Proper JSON format**: Always validate JSON syntax before saving

### Common MCP Servers

- **wsl-filesys**: WSL filesystem operations
- **server-everything**: General utility tools
- **gemini-cli**: Google Gemini AI integration
- **Context7**: Documentation and context management
- **sequential-thinking**: Step-by-step reasoning

## Remember

1. **Quality over speed**: Better to do it right than do it twice
2. **Read the docs**: Project-specific CLAUDE.md may have additional rules
3. **Ask when unsure**: Better to clarify than make assumptions
4. **Keep it simple**: Don't over-engineer solutions
5. **Be helpful**: Focus on solving the user's actual problem
6. **MCP configuration**: Follow Windows-specific patterns for reliable server connections

This configuration ensures consistent, high-quality assistance across all Claude instances on this Windows system with WSL integration.