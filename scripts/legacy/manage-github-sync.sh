#!/usr/bin/env bash
# manage-github-sync.sh - Management utility for Claude GitHub sync system
#
# Provides convenient commands for managing the GitHub repository sync system.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="claude-github-sync"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    local color="$1"
    shift
    printf "${color}$*${NC}\n"
}

print_success() { print_status "$GREEN" "$@"; }
print_warning() { print_status "$YELLOW" "$@"; }
print_error() { print_status "$RED" "$@"; }
print_info() { print_status "$BLUE" "$@"; }

# Show help
show_help() {
    cat << EOF
Claude GitHub Sync Management

Usage: $0 <command> [options]

Commands:
  status      Show sync system status
  sync        Run manual sync now
  start       Start/enable the sync timer
  stop        Stop/disable the sync timer
  restart     Restart the sync timer
  logs        Show recent sync logs
  webhook     Manage webhook listener
  test        Test sync configuration
  clean       Clean up old logs and temporary files

Webhook subcommands:
  webhook start [--port PORT]  Start webhook listener
  webhook stop                 Stop webhook listener
  webhook test                 Test webhook configuration
  webhook status               Show webhook listener status

Examples:
  $0 status                    # Show overall status
  $0 sync                      # Run sync now
  $0 logs                      # Show recent logs
  $0 webhook start --port 8080 # Start webhook on port 8080
  $0 clean                     # Clean up old files

EOF
}

# Show system status
show_status() {
    print_info "=== Claude GitHub Sync Status ==="
    echo
    
    # Check systemd timer
    print_info "Systemd Timer:"
    if systemctl --user is-enabled "${SERVICE_NAME}.timer" >/dev/null 2>&1; then
        if systemctl --user is-active "${SERVICE_NAME}.timer" >/dev/null 2>&1; then
            print_success "  ✓ Timer is enabled and running"
        else
            print_warning "  ⚠ Timer is enabled but not running"
        fi
    else
        print_error "  ✗ Timer is not enabled"
    fi
    
    # Check last run
    local last_run=$(systemctl --user show "${SERVICE_NAME}.timer" --property=LastTriggerUSecRealtime --value 2>/dev/null || echo "0")
    if [[ "$last_run" != "0" ]]; then
        local last_run_date=$(date -d "@$((last_run / 1000000))" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "Unknown")
        print_info "  Last run: $last_run_date"
    else
        print_info "  Last run: Never"
    fi
    
    # Check next run
    local next_run=$(systemctl --user show "${SERVICE_NAME}.timer" --property=NextElapseUSecRealtime --value 2>/dev/null || echo "0")
    if [[ "$next_run" != "0" ]]; then
        local next_run_date=$(date -d "@$((next_run / 1000000))" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "Unknown")
        print_info "  Next run: $next_run_date"
    else
        print_info "  Next run: Not scheduled"
    fi
    
    echo
    
    # Check repositories
    print_info "Repository Status:"
    local repos=("commands" "agents")
    for repo in "${repos[@]}"; do
        local repo_dir="$HOME/.claude/$repo"
        if [[ -d "$repo_dir/.git" ]]; then
            cd "$repo_dir"
            local status=$(git status --porcelain 2>/dev/null || echo "ERROR")
            local branch=$(git branch --show-current 2>/dev/null || echo "unknown")
            local last_commit=$(git log -1 --format="%h %s" 2>/dev/null || echo "No commits")
            
            if [[ "$status" == "ERROR" ]]; then
                print_error "  ✗ $repo: Git error"
            elif [[ -z "$status" ]]; then
                print_success "  ✓ $repo ($branch): Clean"
            else
                print_warning "  ⚠ $repo ($branch): Has changes"
            fi
            print_info "    Last commit: $last_commit"
        else
            print_error "  ✗ $repo: Not a git repository"
        fi
    done
    
    echo
    
    # Check webhook listener
    print_info "Webhook Listener:"
    if pgrep -f "webhook-listener.py" >/dev/null; then
        local pid=$(pgrep -f "webhook-listener.py")
        print_success "  ✓ Running (PID: $pid)"
    else
        print_warning "  ⚠ Not running"
    fi
    
    # Check logs
    echo
    print_info "Recent Activity:"
    local log_file="$HOME/.claude/logs/github-sync.log"
    if [[ -f "$log_file" ]]; then
        tail -3 "$log_file" | while read -r line; do
            print_info "  $line"
        done
    else
        print_warning "  No log file found"
    fi
}

# Run manual sync
run_sync() {
    print_info "Running manual sync..."
    if "$SCRIPT_DIR/sync-github-repos.sh" sync; then
        print_success "Sync completed successfully"
    else
        print_error "Sync failed - check logs for details"
        return 1
    fi
}

# Start/enable timer
start_timer() {
    print_info "Starting sync timer..."
    systemctl --user daemon-reload
    systemctl --user enable "${SERVICE_NAME}.timer"
    systemctl --user start "${SERVICE_NAME}.timer"
    print_success "Timer started and enabled"
}

# Stop/disable timer
stop_timer() {
    print_info "Stopping sync timer..."
    systemctl --user stop "${SERVICE_NAME}.timer"
    systemctl --user disable "${SERVICE_NAME}.timer"
    print_success "Timer stopped and disabled"
}

# Restart timer
restart_timer() {
    print_info "Restarting sync timer..."
    systemctl --user daemon-reload
    systemctl --user restart "${SERVICE_NAME}.timer"
    print_success "Timer restarted"
}

# Show logs
show_logs() {
    local log_file="$HOME/.claude/logs/github-sync.log"
    local lines="${1:-50}"
    
    if [[ -f "$log_file" ]]; then
        print_info "=== Recent Sync Logs (last $lines lines) ==="
        tail -n "$lines" "$log_file"
    else
        print_warning "No log file found at $log_file"
    fi
}

# Test configuration
test_config() {
    print_info "=== Testing Configuration ==="
    echo
    
    # Test sync script
    print_info "Sync Script:"
    if "$SCRIPT_DIR/sync-github-repos.sh" test; then
        print_success "  ✓ Sync script configuration OK"
    else
        print_error "  ✗ Sync script configuration failed"
    fi
    
    echo
    
    # Test webhook listener
    print_info "Webhook Listener:"
    if "$SCRIPT_DIR/webhook-listener.py" --test; then
        print_success "  ✓ Webhook listener configuration OK"
    else
        print_error "  ✗ Webhook listener configuration failed"
    fi
}

# Clean up old files
clean_files() {
    print_info "Cleaning up old files..."
    
    local cleaned=0
    
    # Clean old logs (older than 30 days)
    if find "$HOME/.claude/logs" -name "*.log.*" -mtime +30 -delete 2>/dev/null; then
        local count=$(find "$HOME/.claude/logs" -name "*.log.*" -mtime +30 2>/dev/null | wc -l)
        if [[ $count -gt 0 ]]; then
            print_info "  Removed $count old log files"
            ((cleaned += count))
        fi
    fi
    
    # Clean temporary files
    if find /tmp -name ".claude-*" -mtime +1 -delete 2>/dev/null; then
        local count=$(find /tmp -name ".claude-*" -mtime +1 2>/dev/null | wc -l)
        if [[ $count -gt 0 ]]; then
            print_info "  Removed $count temporary files"
            ((cleaned += count))
        fi
    fi
    
    if [[ $cleaned -eq 0 ]]; then
        print_info "  No files to clean"
    else
        print_success "  Cleaned $cleaned files"
    fi
}

# Webhook management
manage_webhook() {
    local subcommand="${1:-}"
    
    case "$subcommand" in
        "start")
            local port="${2:-8080}"
            print_info "Starting webhook listener on port $port..."
            "$SCRIPT_DIR/webhook-listener.py" --port "$port" &
            local pid=$!
            sleep 2
            if kill -0 "$pid" 2>/dev/null; then
                print_success "Webhook listener started (PID: $pid)"
            else
                print_error "Failed to start webhook listener"
                return 1
            fi
            ;;
        "stop")
            print_info "Stopping webhook listener..."
            if pkill -f "webhook-listener.py"; then
                print_success "Webhook listener stopped"
            else
                print_warning "No webhook listener found running"
            fi
            ;;
        "test")
            print_info "Testing webhook configuration..."
            "$SCRIPT_DIR/webhook-listener.py" --test
            ;;
        "status")
            if pgrep -f "webhook-listener.py" >/dev/null; then
                local pid=$(pgrep -f "webhook-listener.py")
                print_success "Webhook listener is running (PID: $pid)"
            else
                print_warning "Webhook listener is not running"
            fi
            ;;
        *)
            print_error "Unknown webhook subcommand: $subcommand"
            echo "Available subcommands: start, stop, test, status"
            return 1
            ;;
    esac
}

# Main command handling
main() {
    local command="${1:-help}"
    
    case "$command" in
        "status")
            show_status
            ;;
        "sync")
            run_sync
            ;;
        "start")
            start_timer
            ;;
        "stop")
            stop_timer
            ;;
        "restart")
            restart_timer
            ;;
        "logs")
            local lines="${2:-50}"
            show_logs "$lines"
            ;;
        "webhook")
            shift
            manage_webhook "$@"
            ;;
        "test")
            test_config
            ;;
        "clean")
            clean_files
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            echo
            show_help
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"