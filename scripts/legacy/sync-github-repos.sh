#!/bin/bash
# GitHub Repository Sync Script for Claude
# Syncs claude-commands and claude-agents from GitHub to ~/.claude/

set -euo pipefail

# Configuration
CLAUDE_DIR="$HOME/.claude"
LOG_DIR="$CLAUDE_DIR/logs"
LOG_FILE="$LOG_DIR/github-sync.log"
LOCK_FILE="/tmp/claude-github-sync.lock"
NTFY_SCRIPT="$HOME/hooks/ntfy-notifier.sh"

# Repository mappings - local directories that are already Git repositories
declare -A REPOS=(
    ["commands"]="$CLAUDE_DIR/commands"
    ["agents"]="$CLAUDE_DIR/agents"
)

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Notification function
notify() {
    local title="$1"
    local message="$2"
    local priority="${3:-default}"
    
    if [[ -x "$NTFY_SCRIPT" ]]; then
        "$NTFY_SCRIPT" "$title" "$message" "$priority" 2>/dev/null || true
    fi
    log "NOTIFICATION: $title - $message"
}

# Lock file management
acquire_lock() {
    local timeout=60
    local elapsed=0
    
    while [[ -f "$LOCK_FILE" ]] && [[ $elapsed -lt $timeout ]]; do
        log "Waiting for lock (PID: $(cat "$LOCK_FILE" 2>/dev/null || echo 'unknown'))..."
        sleep 2
        ((elapsed+=2))
    done
    
    if [[ -f "$LOCK_FILE" ]]; then
        log "ERROR: Lock timeout exceeded. Removing stale lock."
        rm -f "$LOCK_FILE"
    fi
    
    echo $$ > "$LOCK_FILE"
    trap 'rm -f "$LOCK_FILE"' EXIT
}

# Sync a single repository
sync_repo() {
    local repo_name="$1"
    local target_dir="${REPOS[$repo_name]}"
    
    log "Syncing $repo_name at $target_dir"
    
    if [[ ! -d "$target_dir" ]]; then
        log "ERROR: Repository directory $target_dir does not exist"
        return 1
    fi
    
    if [[ ! -d "$target_dir/.git" ]]; then
        log "ERROR: $target_dir is not a Git repository"
        return 1
    fi
    
    cd "$target_dir"
    
    # Store current branch
    local current_branch=$(git branch --show-current)
    
    # Check for local modifications
    if ! git diff-index --quiet HEAD --; then
        log "Local modifications detected in $repo_name, stashing..."
        git stash push -m "Auto-stash before sync $(date +%Y%m%d-%H%M%S)"
    fi
    
    # Fetch updates
    log "Fetching updates for $repo_name"
    git fetch origin
    
    # Check if there are updates
    local LOCAL=$(git rev-parse HEAD)
    local REMOTE=$(git rev-parse origin/main)
    
    if [[ "$LOCAL" == "$REMOTE" ]]; then
        log "$repo_name is already up to date"
        return 0
    fi
    
    # Get list of changed files for notification
    local changed_files=$(git diff --name-only HEAD..origin/main | head -10)
    local num_changes=$(git diff --name-only HEAD..origin/main | wc -l)
    
    # Try to merge updates
    log "Applying updates to $repo_name"
    if git merge origin/main --no-edit; then
        log "Successfully merged updates for $repo_name"
        
        # Prepare notification message
        local msg="Updated $num_changes file(s):\n$changed_files"
        if [[ $num_changes -gt 10 ]]; then
            msg="$msg\n... and $((num_changes - 10)) more"
        fi
        
        notify "Repository Updated" "$repo_name: $msg" "default"
    else
        log "Merge conflict detected, attempting rebase..."
        git merge --abort
        
        if git rebase origin/main; then
            log "Successfully rebased $repo_name"
            notify "Repository Rebased" "$repo_name successfully rebased with origin/main" "default"
        else
            log "Rebase failed, resetting to origin/main"
            git rebase --abort
            git reset --hard origin/main
            notify "Repository Reset" "$repo_name reset to origin/main due to conflicts" "high"
        fi
    fi
    
    # Re-apply stashed changes if any
    if git stash list | grep -q "Auto-stash before sync"; then
        log "Re-applying stashed changes..."
        if git stash pop; then
            log "Successfully re-applied local modifications"
        else
            log "Failed to re-apply stash, saved as stash@{0}"
            notify "Stash Conflict" "Local changes in $repo_name saved to stash" "high"
        fi
    fi
}

# Main sync function
sync_all() {
    log "Starting GitHub repository sync"
    acquire_lock
    
    local sync_status=0
    
    for repo_name in "${!REPOS[@]}"; do
        if sync_repo "$repo_name"; then
            log "✓ $repo_name synced successfully"
        else
            log "✗ Failed to sync $repo_name"
            sync_status=1
        fi
    done
    
    if [[ $sync_status -eq 0 ]]; then
        log "All repositories synced successfully"
        notify "Sync Complete" "All Claude repositories are up to date" "low"
    else
        log "Some repositories failed to sync"
        notify "Sync Partial" "Some repositories failed to sync. Check logs." "high"
    fi
    
    return $sync_status
}

# Status check function
check_status() {
    echo "=== Claude GitHub Sync Status ==="
    echo
    
    for repo_name in "${!REPOS[@]}"; do
        local target_dir="${REPOS[$repo_name]}"
        
        echo "Repository: $repo_name"
        echo "Location: $target_dir"
        
        if [[ ! -d "$target_dir" ]]; then
            echo "Status: Not cloned"
            echo
            continue
        fi
        
        cd "$target_dir"
        
        # Get current status
        local current_branch=$(git branch --show-current)
        local local_commit=$(git rev-parse --short HEAD)
        
        # Fetch quietly to check remote
        git fetch origin -q 2>/dev/null || true
        local remote_commit=$(git rev-parse --short origin/main 2>/dev/null || echo "unknown")
        
        echo "Branch: $current_branch"
        echo "Local: $local_commit"
        echo "Remote: $remote_commit"
        
        if [[ "$local_commit" == "$remote_commit" ]]; then
            echo "Status: Up to date ✓"
        else
            local behind=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "0")
            local ahead=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "0")
            echo "Status: Behind by $behind, Ahead by $ahead commits"
        fi
        
        # Check for local modifications
        if ! git diff-index --quiet HEAD -- 2>/dev/null; then
            echo "Local changes: Yes (uncommitted)"
        fi
        
        echo
    done
}

# Cleanup old logs (keep last 30 days)
cleanup_logs() {
    find "$LOG_DIR" -name "github-sync.log*" -mtime +30 -delete 2>/dev/null || true
    
    # Rotate current log if it's too large (>10MB)
    if [[ -f "$LOG_FILE" ]] && [[ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null || echo 0) -gt 10485760 ]]; then
        mv "$LOG_FILE" "$LOG_FILE.$(date +%Y%m%d-%H%M%S)"
        touch "$LOG_FILE"
    fi
}

# Main execution
main() {
    local command="${1:-sync}"
    
    case "$command" in
        sync)
            cleanup_logs
            sync_all
            ;;
        status)
            check_status
            ;;
        help)
            echo "Usage: $0 [sync|status|help]"
            echo
            echo "Commands:"
            echo "  sync    - Sync all repositories (default)"
            echo "  status  - Check current sync status"
            echo "  help    - Show this help message"
            ;;
        *)
            echo "Unknown command: $command"
            echo "Run '$0 help' for usage information"
            exit 1
            ;;
    esac
}

main "$@"