#!/bin/bash
# Launch parallel Claude instances for rust-fs development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Base directories
MAIN_DIR="/home/david/.claude/mcp/rust-fs"
WORKTREE_BASE="/home/david/.claude/mcp/rust-fs-worktrees"

echo -e "${BLUE}🚀 Rust MCP Filesystem Server - Parallel Claude Launcher${NC}"
echo

# Function to check if worktree exists
check_worktree() {
    local name=$1
    local path="$WORKTREE_BASE/$name"
    
    if [ ! -d "$path" ]; then
        echo -e "${RED}❌ Worktree not found: $path${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ Found worktree: $name${NC}"
    return 0
}

# Function to launch Claude in a worktree
launch_claude() {
    local name=$1
    local path="$WORKTREE_BASE/$name"
    local instructions=$2
    
    echo -e "${BLUE}Starting Claude for $name worker...${NC}"
    
    # Create instruction file
    cat > "$path/.claude-instructions" << EOF
$instructions

IMPORTANT: Read your CLAUDE_WORKER.md file for complete instructions.
Your working directory is: $path
EOF
    
    # Launch in new terminal based on available terminal emulator
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal --title="Claude-$name" --working-directory="$path" -- bash -c "echo 'Starting Claude $name worker...'; cat .claude-instructions; echo; claude; exec bash"
    elif command -v xterm &> /dev/null; then
        xterm -title "Claude-$name" -e "cd $path && cat .claude-instructions && echo && claude; bash" &
    elif command -v tmux &> /dev/null; then
        tmux new-session -d -s "claude-$name" -c "$path" "cat .claude-instructions && echo && claude"
        echo -e "${YELLOW}Started in tmux session: claude-$name${NC}"
        echo -e "${YELLOW}Attach with: tmux attach -t claude-$name${NC}"
    else
        echo -e "${RED}No suitable terminal found. Please run manually:${NC}"
        echo "cd $path && claude"
    fi
}

# Main execution
echo "Checking worktrees..."

# Check all worktrees exist
all_exist=true
for worktree in tests archive perf; do
    if ! check_worktree "$worktree"; then
        all_exist=false
    fi
done

if [ "$all_exist" = false ]; then
    echo
    echo -e "${RED}Some worktrees are missing. Please run:${NC}"
    echo "cd $MAIN_DIR"
    echo "git worktree add -b fix/tests ../rust-fs-worktrees/tests main"
    echo "git worktree add -b refactor/archive ../rust-fs-worktrees/archive main"
    echo "git worktree add -b perf/optimization ../rust-fs-worktrees/perf main"
    exit 1
fi

echo
echo "Updating worktrees with latest from main..."

# Update all worktrees
cd "$MAIN_DIR"
git fetch origin

for worktree in tests archive perf; do
    echo -e "${BLUE}Updating $worktree...${NC}"
    cd "$WORKTREE_BASE/$worktree"
    git fetch origin
    git rebase origin/main || echo -e "${YELLOW}Warning: Rebase failed for $worktree${NC}"
done

echo
echo "Launching Claude instances..."

# Launch Test Worker
launch_claude "tests" "You are the TEST WORKER. Your primary task is to fix all failing tests in the Rust MCP Filesystem Server.

Key commands:
- ./scripts/run-tests.sh all
- cargo nextest run test_name
- ./scripts/llm-helper.sh pre-edit

Focus: Fix failing tests module by module until all pass."

sleep 2

# Launch Archive Worker
launch_claude "archive" "You are the ARCHIVE WORKER. Your primary task is to extract replace and replace_block commands from the archive.

Key commands:
- rg 'fn.*replace' src/archive/
- fd '\.rs$' src/archive/ | fzf --preview 'bat {}'

Focus: Extract valuable patterns and implement missing commands."

sleep 2

# Launch Performance Worker
launch_claude "perf" "You are the PERFORMANCE WORKER. Your primary task is to benchmark and optimize performance.

Key commands:
- cargo run --bin perf-test --release
- ./scripts/profile-binary.sh
- ./scripts/run-benchmarks.sh

Focus: Establish baselines and implement optimizations."

echo
echo -e "${GREEN}✅ All Claude workers launched!${NC}"
echo
echo "Monitor progress with:"
echo "  git worktree list"
echo "  ps aux | grep claude"
echo
echo "View logs:"
echo "  tail -f ~/.claude/logs/claude-*.log"
echo
echo "Integration:"
echo "  cd $MAIN_DIR"
echo "  git fetch --all"
echo "  git log --oneline --graph --all --decorate"

# Create monitoring script
cat > "$MAIN_DIR/monitor-workers.sh" << 'EOF'
#!/bin/bash
# Monitor all Claude workers

clear
echo "=== Claude Worker Status ==="
echo

for worktree in tests archive perf; do
    echo "[$worktree]"
    cd /home/david/.claude/mcp/rust-fs-worktrees/$worktree 2>/dev/null || continue
    
    # Branch and changes
    git status --short --branch
    
    # Recent commits
    echo "Recent commits:"
    git log --oneline -3
    
    # Check process
    if pgrep -f "claude.*$worktree" > /dev/null; then
        echo "Status: ✅ Running"
    else
        echo "Status: ❌ Not running"
    fi
    
    echo "---"
done

echo
echo "System Resources:"
ps aux | grep claude | awk '{sum+=$6} END {print "Claude Memory: " sum/1024 " MB"}'
echo "Load Average: $(uptime | awk -F'load average:' '{print $2}')"
EOF

chmod +x "$MAIN_DIR/monitor-workers.sh"

echo
echo -e "${BLUE}Created monitor-workers.sh for status tracking${NC}"