#!/bin/bash

# Claude Code Launcher with enhanced VS Code integration
# Usage: ./launch-claude.sh [model] [options]

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_CONFIG="$PROJECT_DIR/.claude.json"
CLAUDE_BIN="$HOME/.local/bin/claude"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[CLAUDE]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Check if configuration exists
if [ ! -f "$CLAUDE_CONFIG" ]; then
    echo "Claude configuration not found. Run: ./scripts/configure-claude.sh"
    exit 1
fi

# Check if local Claude installation exists
if [ ! -f "$CLAUDE_BIN" ]; then
    echo "Local Claude installation not found at: $CLAUDE_BIN"
    echo "Run: npm install @anthropic-ai/claude-code"
    exit 1
fi

# Get default model from config
DEFAULT_MODEL=$(cat "$CLAUDE_CONFIG" | jq -r '.defaultModel // "claude-sonnet-4-20250514"')

# Parse arguments
MODEL=""
SKIP_ANNOUNCEMENTS=false

# Check for special flags first
REMAINING_ARGS=()
while [[ $# -gt 0 ]]; do
    case $1 in
    --skip-announcements)
        SKIP_ANNOUNCEMENTS=true
        shift
        ;;
    --test-mcp | --check)
        REMAINING_ARGS+=("$1")
        shift
        ;;
    --help)
        echo "Claude Code Launcher - Enhanced VS Code Integration"
        echo ""
        echo "Usage: $0 [model] [options]"
        echo ""
        echo "Models:"
        echo "  claude-sonnet-4-20250514   (default) - Balanced performance"
        echo "  claude-opus-4-20250514     - Maximum intelligence"
        echo "  claude-haiku-4-20250514    - Fastest responses"
        echo ""
        echo "Options:"
        echo "  --skip-announcements       Skip capability announcements"
        echo "  --test-mcp                 Test MCP server connections"
        echo "  --check                    Check prerequisites"
        echo "  --help                     Show this help"
        echo ""
        echo "Examples:"
        echo "  $0                         # Launch with default model"
        echo "  $0 claude-opus-4-20250514 # Launch with Opus model"
        echo "  $0 --test-mcp             # Test MCP servers"
        exit 0
        ;;
    claude-*)
        # Model name
        MODEL="$1"
        shift
        ;;
    *)
        REMAINING_ARGS+=("$1")
        shift
        ;;
    esac
done

# Set default model if none specified
MODEL="${MODEL:-$DEFAULT_MODEL}"

print_status "Launching Claude Code..."
print_info "Model: $MODEL"
print_info "Project: $(basename "$PROJECT_DIR")"

# Set environment
export CLAUDE_PROJECT_ROOT="$PROJECT_DIR"
export CLAUDE_PROJECT_NAME="$(basename "$PROJECT_DIR")"

# Launch Claude Code with capability awareness
cd "$PROJECT_DIR"

# Restore previous session automatically
if [[ -x "./scripts/claude-session-manager.sh" ]]; then
    print_status "Restoring previous session..."
    ./scripts/claude-session-manager.sh restore >/dev/null 2>&1 || print_info "No previous session to restore"
fi

# Announce capabilities if appropriate
if [[ "$SKIP_ANNOUNCEMENTS" == false ]] && [[ -x "./scripts/claude-capability-announcer.sh" ]]; then
    print_status "Checking capability awareness system..."
    ./scripts/claude-capability-announcer.sh auto
fi

# Start Claude Code
print_status "Launching Claude Code with model: $MODEL"
"$CLAUDE_BIN" --model "$MODEL" --mcp-config "$CLAUDE_CONFIG" "${REMAINING_ARGS[@]}"

# Save session state when Claude exits
if [[ -x "./scripts/claude-session-manager.sh" ]]; then
    print_status "Saving session state..."
    ./scripts/claude-session-manager.sh save >/dev/null 2>&1 || print_info "Session save failed"
fi

# Source browser utilities for opening documentation and links
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/scripts/browser-utils.sh" ]]; then
    source "$SCRIPT_DIR/scripts/browser-utils.sh"
fi
