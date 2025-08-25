#!/usr/bin/env bash
# setup-cron-sync.sh - Setup Claude GitHub sync using cron instead of systemd
#
# Alternative setup for environments where systemd user services are not available

set -euo pipefail

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

# Setup cron job
setup_cron() {
    log_info "Setting up cron job for GitHub sync"
    
    # Create cron entry
    local cron_entry="*/30 * * * * /home/david/.claude/sync-github-repos.sh sync >/dev/null 2>&1"
    
    # Check if cron entry already exists
    if crontab -l 2>/dev/null | grep -q "sync-github-repos.sh"; then
        log_info "Cron job already exists, updating..."
        # Remove existing entry and add new one
        (crontab -l 2>/dev/null | grep -v "sync-github-repos.sh"; echo "$cron_entry") | crontab -
    else
        log_info "Adding new cron job..."
        (crontab -l 2>/dev/null; echo "$cron_entry") | crontab -
    fi
    
    log_info "Cron job configured to run every 30 minutes"
}

# Remove systemd files since they won't work
cleanup_systemd() {
    log_info "Removing systemd files (not supported in this environment)"
    
    rm -f "$HOME/.config/systemd/user/claude-github-sync.service" 2>/dev/null || true
    rm -f "$HOME/.config/systemd/user/claude-github-sync.timer" 2>/dev/null || true
    
    log_info "Systemd files removed"
}

# Main setup
main() {
    log_info "Setting up cron-based GitHub sync"
    
    # Create log directory
    mkdir -p "$(dirname "$LOG_FILE")"
    
    cleanup_systemd
    setup_cron
    
    log_info "Cron-based sync setup completed"
    
    echo
    echo "Cron job configured to sync repositories every 30 minutes"
    echo "To check cron jobs: crontab -l"
    echo "To remove cron job: crontab -e (then delete the sync line)"
    echo
}

main "$@"