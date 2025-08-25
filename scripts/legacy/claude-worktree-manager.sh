#!/bin/bash
# claude-worktree-manager.sh - Advanced worktree management for parallel Claude instances
# Based on ~/.claude/hooks/development/claude-linter-agent.sh

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKTREE_BASE="${PROJECT_ROOT}/../rust-fs-worktrees"
STATE_DIR="/tmp/claude-rust-fs-workers"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $*" >&2; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*" >&2; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $*" >&2; }

# Usage
usage() {
    cat << EOF
Claude Worktree Manager - Manage parallel Claude instances for rust-fs development

USAGE:
    $(basename "$0") [command] [options]

COMMANDS:
    setup-all       Setup all worktrees and prepare for Claude instances
    start [worker]  Start a specific Claude worker (tests|archive|perf)
    start-all       Start all Claude workers in parallel
    status          Show status of all workers
    monitor         Live monitoring dashboard
    stop [worker]   Stop a specific worker
    stop-all        Stop all workers
    sync            Sync all worktrees with main branch
    integrate       Merge completed work back to main
    cleanup         Remove all worktrees and stop workers

OPTIONS:
    --tmux          Use tmux sessions (default: new terminals)
    --background    Run workers in background
    --verbose       Show detailed output
    --help          Show this help

EXAMPLES:
    # Setup and start all workers
    $(basename "$0") setup-all
    $(basename "$0") start-all

    # Monitor progress
    $(basename "$0") monitor

    # Integrate completed work
    $(basename "$0") integrate

EOF
}

# Parse arguments
COMMAND="${1:-help}"
shift || true

USE_TMUX=false
BACKGROUND=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --tmux)
            USE_TMUX=true
            shift
            ;;
        --background)
            BACKGROUND=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            break
            ;;
    esac
done

# Setup state directory
setup_state_dir() {
    mkdir -p "$STATE_DIR"/{pids,logs,status}
}

# Worker configurations
declare -A WORKERS=(
    [tests]="fix/tests|Fix failing tests|HIGH"
    [archive]="refactor/archive|Extract archive patterns|MEDIUM"
    [perf]="perf/optimization|Performance optimization|MEDIUM"
)

# Check if worktree exists
worktree_exists() {
    local name=$1
    local path="$WORKTREE_BASE/$name"
    [[ -d "$path" ]] && git -C "$PROJECT_ROOT" worktree list | grep -q "$path"
}

# Setup a single worktree
setup_worktree() {
    local name=$1
    local config="${WORKERS[$name]}"
    IFS='|' read -r branch desc priority <<< "$config"
    local path="$WORKTREE_BASE/$name"
    
    log_info "Setting up $name worktree (branch: $branch)"
    
    if worktree_exists "$name"; then
        log_info "Worktree $name already exists"
        return 0
    fi
    
    # Create worktree
    git -C "$PROJECT_ROOT" worktree add -b "$branch" "$path" main || \
        git -C "$PROJECT_ROOT" worktree add "$path" "$branch"
    
    # Copy worker instructions if they exist
    if [[ -f "$path/CLAUDE_WORKER.md" ]]; then
        log_info "Worker instructions already present"
    else
        log_warning "No CLAUDE_WORKER.md found for $name"
    fi
    
    # Create status file
    echo "setup_complete" > "$STATE_DIR/status/$name"
    
    log_success "Worktree $name setup complete"
}

# Setup all worktrees
setup_all_worktrees() {
    log_info "Setting up all worktrees..."
    setup_state_dir
    
    for worker in "${!WORKERS[@]}"; do
        setup_worktree "$worker"
    done
    
    log_success "All worktrees setup complete"
}

# Get worker status
get_worker_status() {
    local name=$1
    local pid_file="$STATE_DIR/pids/$name.pid"
    
    if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
        echo "running"
    else
        echo "stopped"
    fi
}

# Start a worker
start_worker() {
    local name=$1
    local config="${WORKERS[$name]}"
    IFS='|' read -r branch desc priority <<< "$config"
    local path="$WORKTREE_BASE/$name"
    
    if [[ "$(get_worker_status "$name")" == "running" ]]; then
        log_warning "Worker $name is already running"
        return 0
    fi
    
    if ! worktree_exists "$name"; then
        log_error "Worktree $name doesn't exist. Run setup-all first."
        return 1
    fi
    
    log_info "Starting $name worker ($desc)"
    
    # Create instruction file
    cat > "$path/.claude-session-instructions" << EOF
You are the ${name^^} WORKER for the Rust MCP Filesystem Server project.
Branch: $branch
Priority: $priority
Task: $desc

IMPORTANT: Read your CLAUDE_WORKER.md file for complete instructions.
Your working directory is: $path

Start by:
1. cat CLAUDE_WORKER.md
2. ./scripts/llm-helper.sh pre-edit
3. Begin your specific tasks
EOF
    
    # Start Claude based on mode
    if [[ "$USE_TMUX" == "true" ]]; then
        tmux new-session -d -s "claude-$name" -c "$path" \
            "cat .claude-session-instructions && echo && claude"
        echo $$ > "$STATE_DIR/pids/$name.pid"
        log_success "Started $name worker in tmux session claude-$name"
    elif [[ "$BACKGROUND" == "true" ]]; then
        (
            cd "$path"
            nohup claude > "$STATE_DIR/logs/$name.log" 2>&1 &
            echo $! > "$STATE_DIR/pids/$name.pid"
        )
        log_success "Started $name worker in background"
    else
        # Try to use available terminal
        if command -v gnome-terminal &> /dev/null; then
            gnome-terminal --title="Claude-$name" --working-directory="$path" \
                -- bash -c "cat .claude-session-instructions && echo && claude; exec bash"
        elif command -v xterm &> /dev/null; then
            xterm -title "Claude-$name" -e \
                "cd $path && cat .claude-session-instructions && echo && claude; bash" &
        else
            log_error "No suitable terminal found. Use --tmux or --background"
            return 1
        fi
        log_success "Started $name worker in new terminal"
    fi
}

# Start all workers
start_all_workers() {
    log_info "Starting all workers..."
    
    for worker in "${!WORKERS[@]}"; do
        start_worker "$worker"
        sleep 2  # Stagger starts
    done
    
    log_success "All workers started"
}

# Show status
show_status() {
    echo -e "${BLUE}=== Claude Worker Status ===${NC}"
    echo
    
    printf "%-10s %-20s %-10s %-30s\n" "WORKER" "BRANCH" "STATUS" "RECENT ACTIVITY"
    printf "%-10s %-20s %-10s %-30s\n" "------" "------" "------" "---------------"
    
    for worker in "${!WORKERS[@]}"; do
        local config="${WORKERS[$worker]}"
        IFS='|' read -r branch desc priority <<< "$config"
        local status=$(get_worker_status "$worker")
        local path="$WORKTREE_BASE/$worker"
        
        # Get recent activity
        local activity=""
        if [[ -d "$path" ]]; then
            activity=$(cd "$path" && git log --oneline -1 2>/dev/null || echo "No commits yet")
            activity="${activity:0:30}"
        fi
        
        # Color code status
        local status_colored
        if [[ "$status" == "running" ]]; then
            status_colored="${GREEN}● running${NC}"
        else
            status_colored="${RED}○ stopped${NC}"
        fi
        
        printf "%-10s %-20s %-10b %-30s\n" "$worker" "$branch" "$status_colored" "$activity"
    done
    
    echo
    
    # System resources
    echo -e "${BLUE}System Resources:${NC}"
    local claude_mem=$(ps aux | grep claude | awk '{sum+=$6} END {print sum/1024 " MB"}' 2>/dev/null || echo "0 MB")
    echo "Claude Memory Usage: $claude_mem"
    echo "Load Average: $(uptime | awk -F'load average:' '{print $2}')"
}

# Monitor dashboard
monitor_dashboard() {
    while true; do
        clear
        show_status
        
        echo
        echo -e "${YELLOW}Refreshing every 5 seconds... (Ctrl+C to exit)${NC}"
        sleep 5
    done
}

# Stop a worker
stop_worker() {
    local name=$1
    local pid_file="$STATE_DIR/pids/$name.pid"
    
    if [[ -f "$pid_file" ]]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
            sleep 2
            if kill -0 "$pid" 2>/dev/null; then
                kill -9 "$pid" 2>/dev/null || true
            fi
            log_success "Stopped $name worker"
        fi
        rm -f "$pid_file"
    fi
    
    # Stop tmux session if exists
    tmux kill-session -t "claude-$name" 2>/dev/null || true
}

# Stop all workers
stop_all_workers() {
    log_info "Stopping all workers..."
    
    for worker in "${!WORKERS[@]}"; do
        stop_worker "$worker"
    done
    
    log_success "All workers stopped"
}

# Sync worktrees with main
sync_worktrees() {
    log_info "Syncing all worktrees with main branch..."
    
    cd "$PROJECT_ROOT"
    git fetch origin
    
    for worker in "${!WORKERS[@]}"; do
        local path="$WORKTREE_BASE/$worker"
        if [[ -d "$path" ]]; then
            log_info "Syncing $worker..."
            (
                cd "$path"
                git fetch origin
                git rebase origin/main || log_warning "Rebase failed for $worker"
            )
        fi
    done
    
    log_success "Sync complete"
}

# Integrate completed work
integrate_work() {
    log_info "Checking for completed work to integrate..."
    
    cd "$PROJECT_ROOT"
    git checkout main
    git pull origin main
    
    for worker in "${!WORKERS[@]}"; do
        local config="${WORKERS[$worker]}"
        IFS='|' read -r branch desc priority <<< "$config"
        
        # Check if branch has commits
        if git rev-parse --verify "origin/$branch" &>/dev/null; then
            local commits=$(git rev-list --count main..origin/$branch)
            if [[ "$commits" -gt 0 ]]; then
                log_info "Found $commits commits in $branch"
                read -p "Merge $branch? (y/n) " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    git merge --no-ff "origin/$branch" -m "Merge $branch from parallel worker

$desc completed by Claude worker"
                    log_success "Merged $branch"
                fi
            fi
        fi
    done
    
    log_info "Integration complete"
}

# Cleanup worktrees
cleanup_worktrees() {
    log_warning "This will remove all worktrees and stop all workers"
    read -p "Are you sure? (y/n) " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cleanup cancelled"
        return 0
    fi
    
    stop_all_workers
    
    for worker in "${!WORKERS[@]}"; do
        local path="$WORKTREE_BASE/$worker"
        if worktree_exists "$worker"; then
            log_info "Removing $worker worktree..."
            git -C "$PROJECT_ROOT" worktree remove --force "$path" 2>/dev/null || true
        fi
    done
    
    rm -rf "$STATE_DIR"
    log_success "Cleanup complete"
}

# Main command handler
case "$COMMAND" in
    setup-all)
        setup_all_worktrees
        ;;
    start)
        if [[ -n "${1:-}" ]]; then
            start_worker "$1"
        else
            log_error "Please specify a worker: tests, archive, or perf"
            exit 1
        fi
        ;;
    start-all)
        start_all_workers
        ;;
    status)
        show_status
        ;;
    monitor)
        monitor_dashboard
        ;;
    stop)
        if [[ -n "${1:-}" ]]; then
            stop_worker "$1"
        else
            log_error "Please specify a worker: tests, archive, or perf"
            exit 1
        fi
        ;;
    stop-all)
        stop_all_workers
        ;;
    sync)
        sync_worktrees
        ;;
    integrate)
        integrate_work
        ;;
    cleanup)
        cleanup_worktrees
        ;;
    help|--help)
        usage
        ;;
    *)
        log_error "Unknown command: $COMMAND"
        usage
        exit 1
        ;;
esac