#!/usr/bin/env bash
# setup-github-sync.sh - Setup Claude GitHub repository sync system
#
# This script sets up the complete automated workflow for syncing
# GitHub repositories to ~/.claude/ directories.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$HOME/.claude/logs/setup.log"

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

log_info() { log "INFO" "$@"; }
log_warn() { log "WARN" "$@"; }
log_error() { log "ERROR" "$@"; }

# Create necessary directories
setup_directories() {
    log_info "Creating directory structure"
    
    mkdir -p "$HOME/.claude/logs"
    mkdir -p "$HOME/.claude/commands"
    mkdir -p "$HOME/.claude/agents"
    mkdir -p "$HOME/.config/systemd/user"
    
    log_info "Directories created successfully"
}

# Setup SSH keys for GitHub if needed
setup_ssh_keys() {
    log_info "Checking SSH key configuration"
    
    if [[ ! -f "$HOME/.ssh/id_rsa" ]] && [[ ! -f "$HOME/.ssh/id_ed25519" ]]; then
        log_warn "No SSH keys found. You may need to generate SSH keys for GitHub access."
        log_info "To generate SSH keys, run: ssh-keygen -t ed25519 -C 'your_email@example.com'"
        log_info "Then add the public key to your GitHub account."
    else
        log_info "SSH keys found"
    fi
    
    # Test GitHub SSH connectivity
    if ssh -T git@github.com -o ConnectTimeout=10 -o StrictHostKeyChecking=no 2>&1 | grep -q "successfully authenticated"; then
        log_info "GitHub SSH access verified"
    else
        log_warn "GitHub SSH access test failed - please verify your SSH key is added to GitHub"
    fi
}

# Install Python dependencies for webhook listener
setup_python_deps() {
    log_info "Setting up Python dependencies for webhook listener"
    
    if command -v python3 >/dev/null 2>&1; then
        # Check if aiohttp is available
        if python3 -c "import aiohttp" 2>/dev/null; then
            log_info "aiohttp already available"
        else
            log_warn "aiohttp not available - webhook listener will auto-install it when first run"
            log_info "Note: The webhook listener will attempt to install aiohttp when needed"
        fi
    else
        log_error "Python3 not found - webhook listener will not work"
        return 1
    fi
}

# Enable and start systemd services
setup_systemd() {
    log_info "Setting up systemd services"
    
    # Reload systemd user daemon
    systemctl --user daemon-reload
    
    # Enable and start the timer
    systemctl --user enable claude-github-sync.timer
    systemctl --user start claude-github-sync.timer
    
    log_info "Systemd timer enabled and started"
    
    # Show status
    systemctl --user status claude-github-sync.timer --no-pager -l || true
}

# Create webhook secret
setup_webhook_secret() {
    local secret_file="$HOME/.claude/webhook-secret.txt"
    
    if [[ ! -f "$secret_file" ]]; then
        log_info "Creating webhook secret"
        # Generate a random secret
        openssl rand -hex 32 > "$secret_file"
        chmod 600 "$secret_file"
        log_info "Webhook secret created at $secret_file"
        log_info "Use this secret when configuring GitHub webhooks"
    else
        log_info "Webhook secret already exists"
    fi
}

# Copy ntfy notifier if not available in expected location
setup_notifications() {
    local expected_ntfy="/home/david/.config/windows-bash/archive/unique-hooks-20250724/utilities/ntfy-notifier.sh"
    local claude_ntfy="$HOME/.claude/ntfy-notifier.sh"
    
    if [[ -f "$expected_ntfy" ]]; then
        log_info "Using existing ntfy-notifier at $expected_ntfy"
    elif [[ -f "$claude_ntfy" ]]; then
        log_info "Using ntfy-notifier in Claude directory"
    else
        log_warn "Ntfy notifier not found - notifications will be disabled"
        log_info "To enable notifications, ensure ntfy-notifier.sh is available"
    fi
}

# Run initial sync
run_initial_sync() {
    log_info "Running initial repository sync"
    
    if [[ -x "$SCRIPT_DIR/sync-github-repos.sh" ]]; then
        "$SCRIPT_DIR/sync-github-repos.sh" sync || {
            log_warn "Initial sync had some issues - check logs for details"
        }
    else
        log_error "Sync script not found or not executable"
        return 1
    fi
    
    log_info "Initial sync completed"
}

# Move existing repositories out of /home/david/agents/
move_existing_repos() {
    log_info "Moving existing repositories out of /home/david/agents/"
    
    local source_commands="/home/david/agents/claude-commands"
    local source_agents="/home/david/agents/claude-agents"
    local backup_dir="/home/david/agents/backup-$(date +%Y%m%d_%H%M%S)"
    
    if [[ -d "$source_commands" ]] || [[ -d "$source_agents" ]]; then
        log_info "Creating backup directory: $backup_dir"
        mkdir -p "$backup_dir"
        
        if [[ -d "$source_commands" ]]; then
            log_info "Moving claude-commands to backup"
            mv "$source_commands" "$backup_dir/"
        fi
        
        if [[ -d "$source_agents" ]]; then
            log_info "Moving claude-agents to backup"
            mv "$source_agents" "$backup_dir/"
        fi
        
        log_info "Existing repositories moved to $backup_dir"
        log_info "You can remove this backup once you've verified the new sync is working"
    else
        log_info "No existing repositories found in /home/david/agents/"
    fi
}

# Print setup summary
print_summary() {
    echo
    echo "======================================"
    echo "Claude GitHub Sync Setup Complete"
    echo "======================================"
    echo
    echo "Components installed:"
    echo "  • Sync script: $HOME/.claude/sync-github-repos.sh"
    echo "  • Webhook listener: $HOME/.claude/webhook-listener.py"
    echo "  • Systemd service: claude-github-sync.service"
    echo "  • Systemd timer: claude-github-sync.timer"
    echo
    echo "Repository sync locations:"
    echo "  • claude-commands: $HOME/.claude/commands/"
    echo "  • claude-agents: $HOME/.claude/agents/"
    echo
    echo "Management commands:"
    echo "  • Test sync: $HOME/.claude/sync-github-repos.sh test"
    echo "  • Manual sync: $HOME/.claude/sync-github-repos.sh sync"
    echo "  • Force sync: $HOME/.claude/sync-github-repos.sh force"
    echo "  • Check timer: systemctl --user status claude-github-sync.timer"
    echo "  • View logs: tail -f $HOME/.claude/logs/github-sync.log"
    echo
    echo "Webhook setup (optional):"
    echo "  • Start listener: $HOME/.claude/webhook-listener.py"
    echo "  • Test config: $HOME/.claude/webhook-listener.py --test"
    echo "  • GitHub webhook URL: http://your-server:8080/webhook"
    echo "  • Secret file: $HOME/.claude/webhook-secret.txt"
    echo
    echo "Next steps:"
    echo "  1. Verify SSH access to GitHub is working"
    echo "  2. Check that the timer is running: systemctl --user status claude-github-sync.timer"
    echo "  3. Monitor the first few syncs: tail -f $HOME/.claude/logs/github-sync.log"
    echo "  4. (Optional) Set up GitHub webhooks for immediate updates"
    echo
}

# Main execution
main() {
    log_info "Starting Claude GitHub sync setup"
    
    # Create log directory
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Run setup steps
    setup_directories
    setup_ssh_keys
    setup_python_deps
    setup_webhook_secret
    setup_notifications
    move_existing_repos
    setup_systemd
    run_initial_sync
    
    print_summary
    
    log_info "Setup completed successfully"
}

# Handle command line arguments
case "${1:-setup}" in
    "setup")
        main
        ;;
    "test")
        echo "Testing setup configuration..."
        echo "Sync script: $HOME/.claude/sync-github-repos.sh"
        [[ -x "$HOME/.claude/sync-github-repos.sh" ]] && echo "  ✓ Executable" || echo "  ✗ Not executable"
        
        echo "Webhook listener: $HOME/.claude/webhook-listener.py"
        [[ -x "$HOME/.claude/webhook-listener.py" ]] && echo "  ✓ Executable" || echo "  ✗ Not executable"
        
        echo "Systemd service files:"
        [[ -f "$HOME/.config/systemd/user/claude-github-sync.service" ]] && echo "  ✓ Service file exists" || echo "  ✗ Service file missing"
        [[ -f "$HOME/.config/systemd/user/claude-github-sync.timer" ]] && echo "  ✓ Timer file exists" || echo "  ✗ Timer file missing"
        
        echo "Target directories:"
        [[ -d "$HOME/.claude/commands" ]] && echo "  ✓ Commands directory exists" || echo "  ✗ Commands directory missing"
        [[ -d "$HOME/.claude/agents" ]] && echo "  ✓ Agents directory exists" || echo "  ✗ Agents directory missing"
        ;;
    *)
        echo "Usage: $0 {setup|test}"
        echo "  setup - Run complete setup (default)"
        echo "  test  - Test current configuration"
        exit 1
        ;;
esac