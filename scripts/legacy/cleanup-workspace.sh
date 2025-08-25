#!/bin/bash

# 🧹 Claude Workspace Cleanup Script
# This script archives duplicate FastMCP directories and optimizes file watchers

set -e

CLAUDE_HOME="/home/david/.claude"
ARCHIVE_DIR="$CLAUDE_HOME/archive/$(date +%Y%m%d_%H%M%S)"

echo "🎯 Starting Claude workspace cleanup..."
echo "📁 Archive directory: $ARCHIVE_DIR"

# Create archive directory
mkdir -p "$ARCHIVE_DIR"

# Function to safely archive directory
archive_directory() {
    local dir="$1"
    local desc="$2"

    if [ -d "$CLAUDE_HOME/$dir" ]; then
        echo "📦 Archiving $desc: $dir"
        mv "$CLAUDE_HOME/$dir" "$ARCHIVE_DIR/"
        echo "✅ Archived: $dir"
    else
        echo "⚠️  Directory not found: $dir"
    fi
}

# Archive duplicate FastMCP directories
echo ""
echo "🗂️  Archiving duplicate FastMCP directories..."
archive_directory "fastmcp-agent-registry" "FastMCP Agent Registry"
archive_directory "fastmcp-analytics" "FastMCP Analytics"
archive_directory "fastmcp-builder" "FastMCP Builder"
archive_directory "fastmcp-communication-hub" "FastMCP Communication Hub"
archive_directory "fastmcp-coordinator" "FastMCP Coordinator"
archive_directory "fastmcp-docker-integration" "FastMCP Docker Integration"
archive_directory "fastmcp-git-integration" "FastMCP Git Integration"
archive_directory "fastmcp-integration" "FastMCP Integration"
archive_directory "fastmcp-orchestration" "FastMCP Orchestration"
archive_directory "fastmcp-task-distribution" "FastMCP Task Distribution"
archive_directory "fastmcp-workflow-engine" "FastMCP Workflow Engine"

# Archive other bloat directories
echo ""
echo "🗂️  Archiving other duplicate directories..."
archive_directory "claude-code-source" "Claude Code Source"
archive_directory "claude-docker-test" "Claude Docker Test"
archive_directory "claude-extension-dev" "Claude Extension Dev"
archive_directory "claude-mcp-test" "Claude MCP Test"
archive_directory "claude-test-env" "Claude Test Environment"
archive_directory "projects" "Projects (moved to archive)"

# Count what we kept
echo ""
echo "📊 Cleanup Summary:"
echo "📁 Files archived to: $ARCHIVE_DIR"
echo "🗂️  Directories archived: $(ls -1 "$ARCHIVE_DIR" | wc -l)"
echo ""

# List remaining directories
echo "📋 Remaining directories in ~/.claude:"
for dir in "$CLAUDE_HOME"/*; do
    if [ -d "$dir" ]; then
        basename=$(basename "$dir")
        if [ "$basename" != "archive" ]; then
            echo "$basename"
        fi
    fi
done | sort

echo ""
echo "✅ Cleanup complete! VS Code should be much more responsive now."
echo "🔧 Next steps:"
echo "   1. Restart VS Code to clear file watchers"
echo "   2. Run settings optimization script"
echo "   3. Implement smart coordinator"
echo ""
echo "📦 Archive location: $ARCHIVE_DIR"
echo "🔄 You can restore archived directories if needed"
