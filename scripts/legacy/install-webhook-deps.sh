#!/usr/bin/env bash
# install-webhook-deps.sh - Install dependencies for webhook listener
#
# This script installs the required Python dependencies for the webhook listener
# using pip with --user flag to avoid system package conflicts.

set -euo pipefail

echo "Installing webhook listener dependencies..."

# Check if python3 is available
if ! command -v python3 >/dev/null 2>&1; then
    echo "Error: python3 not found"
    exit 1
fi

# Try to install aiohttp with --user flag and --break-system-packages if needed
if python3 -m pip install --user aiohttp; then
    echo "✓ aiohttp installed successfully"
elif python3 -m pip install --user --break-system-packages aiohttp; then
    echo "✓ aiohttp installed successfully (with --break-system-packages)"
else
    echo "❌ Failed to install aiohttp"
    echo "Alternative: Create a virtual environment:"
    echo "  python3 -m venv ~/.claude/webhook-env"
    echo "  source ~/.claude/webhook-env/bin/activate"
    echo "  pip install aiohttp"
    exit 1
fi

# Test the installation
if python3 -c "import aiohttp" 2>/dev/null; then
    echo "✓ aiohttp installation verified"
    
    # Test webhook configuration
    echo "Testing webhook listener configuration..."
    python3 /home/david/.claude/webhook-listener.py --test
else
    echo "❌ aiohttp installation verification failed"
    exit 1
fi

echo "✓ Webhook listener setup completed successfully"