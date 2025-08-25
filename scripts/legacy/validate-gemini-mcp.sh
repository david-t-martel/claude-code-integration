#!/bin/bash

# Gemini MCP Servers Validation Script
# Tests all Gemini MCP servers for basic functionality

set -e

echo "🔍 Validating Gemini MCP Configuration..."
echo "============================================="

# Check JSON syntax
echo "📋 Validating JSON syntax..."
if python3 -m json.tool /home/david/.claude/mcp.json > /dev/null; then
    echo "✅ JSON syntax is valid"
else
    echo "❌ JSON syntax error"
    exit 1
fi

# Check authentication
echo ""
echo "🔐 Checking authentication..."
if gcp-profile status | grep -q "business"; then
    echo "✅ Business profile is active"
else
    echo "❌ Business profile not active"
    echo "Run: gcp-profile business"
    exit 1
fi

# Check service account key
if [ -f "/home/david/.auth/business/service-account-key.json" ]; then
    echo "✅ Service account key found"
else
    echo "❌ Service account key missing"
    exit 1
fi

# Test each Gemini server
echo ""
echo "🚀 Testing Gemini MCP Servers..."
echo "================================="

SERVERS=(
    "gemini-master-architect"
    "gemini-code-reviewer" 
    "gemini-workspace-analyzer"
    "unified-mcp-gateway"
    "cloud-cost-optimizer"
    "ai-model-abstraction"
    "mcp-code-generator"
)

WORKING_SERVERS=0
TOTAL_SERVERS=${#SERVERS[@]}

for server in "${SERVERS[@]}"; do
    echo ""
    echo "Testing $server..."
    
    if timeout 10s "$server" 2>&1 | grep -q "Starting MCP server"; then
        echo "✅ $server - Working"
        ((WORKING_SERVERS++))
    else
        echo "❌ $server - Failed to start"
    fi
done

echo ""
echo "📊 Summary:"
echo "==========="
echo "Working servers: $WORKING_SERVERS/$TOTAL_SERVERS"
echo "Success rate: $((WORKING_SERVERS * 100 / TOTAL_SERVERS))%"

if [ $WORKING_SERVERS -eq $TOTAL_SERVERS ]; then
    echo "🎉 All Gemini MCP servers are working!"
    echo ""
    echo "💡 Next steps:"
    echo "  1. Start Claude Code: claude --verbose"
    echo "  2. Verify servers load in Claude"
    echo "  3. Test tools in development workflow"
else
    echo "⚠️  Some servers need attention"
    echo ""
    echo "💡 Troubleshooting:"
    echo "  1. Check missing dependencies"
    echo "  2. Verify Python environment"
    echo "  3. Review server logs for errors"
fi

echo ""
echo "📖 Configuration details: /home/david/.claude/mcp-gemini-integration-summary.md"