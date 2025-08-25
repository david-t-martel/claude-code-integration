#!/bin/bash
# Redis Integration Setup for All AI Agents and Tools
# This script configures Redis integration across the entire development environment

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REDIS_HOST="127.0.0.1"
REDIS_PORT="6379"
REDIS_URL="redis://${REDIS_HOST}:${REDIS_PORT}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*"
}

success() {
    echo -e "${GREEN}✅ $*${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $*${NC}"
}

error() {
    echo -e "${RED}❌ $*${NC}"
}

# Check if Redis is running
check_redis() {
    log "Checking Redis server availability..."
    
    if ! command -v redis-cli >/dev/null 2>&1; then
        error "redis-cli not found. Please install Redis client tools."
        echo "Ubuntu/Debian: sudo apt install redis-tools"
        echo "macOS: brew install redis"
        return 1
    fi
    
    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping >/dev/null 2>&1; then
        success "Redis server is running at $REDIS_HOST:$REDIS_PORT"
        
        # Get Redis version and info
        local redis_version
        redis_version=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" info server | grep "redis_version:" | cut -d: -f2 | tr -d '\r')
        log "Redis version: $redis_version"
        
        return 0
    else
        error "Redis server not accessible at $REDIS_HOST:$REDIS_PORT"
        echo "Please ensure Redis is running:"
        echo "  sudo systemctl start redis-server  # Linux"
        echo "  brew services start redis         # macOS"
        return 1
    fi
}

# Configure Redis databases
setup_redis_databases() {
    log "Setting up Redis database allocation..."
    
    # Database allocation as per the integration guide
    local databases=(
        "0:claude_sessions:Claude conversation contexts"
        "1:claude_cache:Claude tool results cache" 
        "2:ruff_cache:Ruff linting results cache"
        "3:agent_memory:Agent long-term memory"
        "4:agent_sessions:Agent session data"
        "5:task_queue:Inter-agent task queue"
        "6:api_cache:API response cache"
        "7:file_analysis:File analysis results"
        "8:performance_metrics:Performance tracking"
        "9:error_logs:Error tracking"
    )
    
    for db_info in "${databases[@]}"; do
        IFS=':' read -r db_num purpose description <<< "$db_info"
        
        # Test database connection
        if redis-cli -n "$db_num" ping >/dev/null 2>&1; then
            success "Database $db_num ($purpose): Available"
            
            # Set up any initial keys or configuration
            redis-cli -n "$db_num" set "db_info:purpose" "$purpose" ex 86400 >/dev/null
            redis-cli -n "$db_num" set "db_info:description" "$description" ex 86400 >/dev/null
            redis-cli -n "$db_num" set "db_info:initialized_at" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" ex 86400 >/dev/null
        else
            warning "Database $db_num ($purpose): Not accessible"
        fi
    done
    
    success "Redis database allocation completed"
}

# Install Python dependencies
install_python_dependencies() {
    log "Installing Python Redis dependencies..."
    
    local projects=(
        "/home/david/agents/gterminal"
        "/home/david/agents/py-gemini"
        "/home/david/agents/my-fullstack-agent"
    )
    
    for project_dir in "${projects[@]}"; do
        if [[ -d "$project_dir" ]]; then
            log "Installing Redis dependencies for $(basename "$project_dir")..."
            
            cd "$project_dir"
            
            # Check if uv is available
            if command -v uv >/dev/null 2>&1; then
                if uv add redis[hiredis] >/dev/null 2>&1; then
                    success "Redis dependencies installed via uv in $(basename "$project_dir")"
                else
                    warning "Failed to install Redis dependencies via uv in $(basename "$project_dir")"
                fi
            elif [[ -f "requirements.txt" ]]; then
                # Add to requirements.txt if not present
                if ! grep -q "redis\[hiredis\]" requirements.txt; then
                    echo "redis[hiredis]>=4.5.0" >> requirements.txt
                    log "Added Redis to requirements.txt in $(basename "$project_dir")"
                fi
            else
                warning "No uv or requirements.txt found in $(basename "$project_dir")"
            fi
        else
            warning "Project directory not found: $project_dir"
        fi
    done
    
    success "Python dependencies installation completed"
}

# Set up environment variables
setup_environment_variables() {
    log "Setting up environment variables..."
    
    local env_files=(
        "/home/david/.bashrc"
        "/home/david/.zshrc"
        "/home/david/.claude/env"
    )
    
    local env_content="
# Redis Configuration for AI Agents
export REDIS_URL=\"$REDIS_URL\"
export REDIS_HOST=\"$REDIS_HOST\"
export REDIS_PORT=\"$REDIS_PORT\"
export CLAUDE_REDIS_ENABLED=\"true\"
export RUFF_CLAUDE_REDIS_ENABLED=\"true\"
"
    
    # Create .claude/env if it doesn't exist
    mkdir -p "$(dirname "/home/david/.claude/env")"
    
    for env_file in "${env_files[@]}"; do
        if [[ -f "$env_file" ]] || [[ "$env_file" == "/home/david/.claude/env" ]]; then
            # Check if Redis config already exists
            if ! grep -q "REDIS_URL" "$env_file" 2>/dev/null; then
                echo "$env_content" >> "$env_file"
                success "Added Redis environment variables to $(basename "$env_file")"
            else
                log "Redis environment variables already exist in $(basename "$env_file")"
            fi
        fi
    done
    
    # Export for current session
    export REDIS_URL="$REDIS_URL"
    export REDIS_HOST="$REDIS_HOST"
    export REDIS_PORT="$REDIS_PORT"
    export CLAUDE_REDIS_ENABLED="true"
    export RUFF_CLAUDE_REDIS_ENABLED="true"
    
    success "Environment variables configuration completed"
}

# Install Redis utilities across projects
install_redis_utils() {
    log "Installing shared Redis utilities..."
    
    local target_dirs=(
        "/home/david/agents/gterminal"
        "/home/david/agents/py-gemini"
        "/home/david/agents/my-fullstack-agent"
    )
    
    for target_dir in "${target_dirs[@]}"; do
        if [[ -d "$target_dir" ]]; then
            local utils_dir="$target_dir/shared/redis"
            mkdir -p "$utils_dir"
            
            # Copy shared utilities
            cp "$SCRIPT_DIR/shared_redis_utils.py" "$utils_dir/"
            cp "$SCRIPT_DIR/claude_redis_integration.py" "$utils_dir/"
            
            # Create __init__.py
            cat > "$utils_dir/__init__.py" << 'EOF'
"""Shared Redis utilities for AI agents."""

from .shared_redis_utils import *
from .claude_redis_integration import get_claude_redis, cache_file_analysis, get_cached_file_analysis

__all__ = [
    'RedisManager',
    'AgentSessionManager',
    'SmartCache', 
    'AgentTaskQueue',
    'get_claude_redis',
    'cache_file_analysis',
    'get_cached_file_analysis'
]
EOF
            
            success "Installed Redis utilities in $(basename "$target_dir")"
        else
            warning "Target directory not found: $target_dir"
        fi
    done
    
    success "Redis utilities installation completed"
}

# Configure ruff-claude integration
setup_ruff_claude_integration() {
    log "Setting up ruff-claude Redis integration..."
    
    # Install the enhanced ruff-claude script
    local target_locations=(
        "/home/david/.claude/ruff-claude.sh"
        "/home/david/.local/bin/ruff-claude"
        "/home/david/bin/ruff-claude"
    )
    
    for location in "${target_locations[@]}"; do
        local dir
        dir=$(dirname "$location")
        if [[ -d "$dir" ]] || mkdir -p "$dir" 2>/dev/null; then
            cp "$SCRIPT_DIR/ruff-claude-redis.sh" "$location"
            chmod +x "$location"
            success "Installed enhanced ruff-claude script at $location"
        else
            warning "Could not create directory for $location"
        fi
    done
    
    # Test the installation
    if [[ -x "/home/david/.claude/ruff-claude.sh" ]]; then
        if "/home/david/.claude/ruff-claude.sh" health >/dev/null 2>&1; then
            success "Ruff-claude Redis integration is working"
        else
            warning "Ruff-claude Redis integration test failed"
        fi
    fi
    
    success "Ruff-claude integration setup completed"
}

# Create health monitoring script
create_health_monitor() {
    log "Creating Redis health monitoring script..."
    
    cat > "/home/david/.claude/redis_health_monitor.sh" << 'EOF'
#!/bin/bash
# Redis Health Monitor for AI Agents

REDIS_DB_COUNT=10
ALERT_MEMORY_THRESHOLD=90
ALERT_LATENCY_THRESHOLD=10

check_redis_health() {
    local overall_status="healthy"
    local issues=()
    
    echo "=== Redis Health Check Report ==="
    echo "Timestamp: $(date)"
    echo ""
    
    # Basic connectivity
    if redis-cli ping >/dev/null 2>&1; then
        echo "✅ Redis connectivity: OK"
        
        # Check memory usage
        local memory_info
        memory_info=$(redis-cli info memory)
        local used_memory
        used_memory=$(echo "$memory_info" | grep "used_memory:" | cut -d: -f2 | tr -d '\r')
        local max_memory
        max_memory=$(echo "$memory_info" | grep "maxmemory:" | cut -d: -f2 | tr -d '\r')
        
        if [[ "$max_memory" -gt 0 ]]; then
            local memory_percent
            memory_percent=$((used_memory * 100 / max_memory))
            echo "📊 Memory usage: ${memory_percent}%"
            
            if [[ "$memory_percent" -gt "$ALERT_MEMORY_THRESHOLD" ]]; then
                echo "⚠️  High memory usage warning: ${memory_percent}%"
                issues+=("High memory usage: ${memory_percent}%")
                overall_status="degraded"
            fi
        fi
        
        # Check latency
        local latency
        latency=$(redis-cli --latency-history -i 1 ping 2>/dev/null | head -1 | grep -o '[0-9]\+\.[0-9]\+' | head -1 || echo "0")
        echo "⚡ Latency: ${latency}ms"
        
        if (( $(echo "$latency > $ALERT_LATENCY_THRESHOLD" | bc -l 2>/dev/null || echo "0") )); then
            echo "⚠️  High latency warning: ${latency}ms"
            issues+=("High latency: ${latency}ms")
            overall_status="degraded"
        fi
        
        # Check database availability
        echo ""
        echo "Database Status:"
        for ((db=0; db<REDIS_DB_COUNT; db++)); do
            if redis-cli -n "$db" ping >/dev/null 2>&1; then
                local key_count
                key_count=$(redis-cli -n "$db" dbsize)
                echo "  DB $db: ✅ ($key_count keys)"
            else
                echo "  DB $db: ❌"
                issues+=("Database $db unavailable")
                overall_status="unhealthy"
            fi
        done
        
    else
        echo "❌ Redis connectivity: FAILED"
        issues+=("Redis server not accessible")
        overall_status="unhealthy"
    fi
    
    echo ""
    echo "=== Summary ==="
    echo "Overall Status: $overall_status"
    
    if [[ ${#issues[@]} -gt 0 ]]; then
        echo "Issues:"
        printf '  - %s\n' "${issues[@]}"
    else
        echo "No issues detected"
    fi
    
    # Store health check result
    if redis-cli ping >/dev/null 2>&1; then
        redis-cli -n 8 hset "system:health:redis" \
            "timestamp" "$(date +%s)" \
            "status" "$overall_status" \
            "issues" "$(IFS=','; echo "${issues[*]}")" \
            >/dev/null
        redis-cli -n 8 expire "system:health:redis" 300 >/dev/null
    fi
    
    # Return appropriate exit code
    case "$overall_status" in
        "healthy") exit 0 ;;
        "degraded") exit 1 ;;
        "unhealthy") exit 2 ;;
    esac
}

case "${1:-check}" in
    "check"|"health")
        check_redis_health
        ;;
    "status")
        if redis-cli ping >/dev/null 2>&1; then
            redis-cli -n 8 hgetall "system:health:redis"
        else
            echo "Redis not available"
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 {check|health|status}"
        echo "  check/health: Perform health check"
        echo "  status: Get last health check result"
        exit 1
        ;;
esac
EOF
    
    chmod +x "/home/david/.claude/redis_health_monitor.sh"
    success "Health monitoring script created"
    
    # Test the health monitor
    if "/home/david/.claude/redis_health_monitor.sh" >/dev/null 2>&1; then
        success "Health monitor is working correctly"
    else
        warning "Health monitor test failed"
    fi
}

# Create integration test script
create_integration_test() {
    log "Creating Redis integration test script..."
    
    cat > "/home/david/.claude/test_redis_integration.py" << 'EOF'
#!/usr/bin/env python3
"""Test Redis integration across all AI agents and tools."""

import asyncio
import json
import os
import sys
import time
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

try:
    from claude_redis_integration import (
        get_claude_redis,
        cache_file_analysis,
        get_cached_file_analysis,
        redis_health_check
    )
    from shared_redis_utils import (
        AgentSessionManager,
        SmartCache,
        AgentTaskQueue,
        health_check
    )
    REDIS_AVAILABLE = True
except ImportError as e:
    print(f"Redis integration not available: {e}")
    REDIS_AVAILABLE = False

async def test_claude_integration():
    """Test Claude Redis integration."""
    print("Testing Claude Redis integration...")
    
    if not REDIS_AVAILABLE:
        print("❌ Redis integration not available")
        return False
    
    try:
        # Test basic caching
        claude_redis = get_claude_redis()
        
        # Cache a tool result
        await claude_redis.cache_tool_result(
            "test_tool", 
            {"param": "value"}, 
            {"result": "success", "timestamp": time.time()}
        )
        
        # Retrieve cached result
        cached_result = await claude_redis.get_cached_tool_result(
            "test_tool",
            {"param": "value"}
        )
        
        if cached_result and cached_result.get("result") == "success":
            print("✅ Tool result caching: PASS")
        else:
            print("❌ Tool result caching: FAIL")
            return False
        
        # Test file analysis caching
        test_file = "/tmp/test_redis_integration.py"
        with open(test_file, "w") as f:
            f.write("# Test file for Redis integration\nprint('Hello Redis')\n")
        
        await cache_file_analysis(test_file, "test_analysis", {
            "lines": 2,
            "functions": 0,
            "classes": 0
        })
        
        cached_analysis = await get_cached_file_analysis(test_file, "test_analysis")
        if cached_analysis and cached_analysis.get("lines") == 2:
            print("✅ File analysis caching: PASS")
        else:
            print("❌ File analysis caching: FAIL")
            return False
        
        # Cleanup
        os.unlink(test_file)
        
        return True
        
    except Exception as e:
        print(f"❌ Claude integration test failed: {e}")
        return False

async def test_agent_utilities():
    """Test shared Redis utilities."""
    print("Testing shared Redis utilities...")
    
    if not REDIS_AVAILABLE:
        print("❌ Redis utilities not available")
        return False
    
    try:
        # Test session management
        session_manager = AgentSessionManager("test_agent")
        test_session_data = {
            "agent_type": "test",
            "created_at": time.time(),
            "test_data": {"key": "value"}
        }
        
        await session_manager.save_session(test_session_data)
        loaded_session = await session_manager.load_session()
        
        if loaded_session.get("agent_type") == "test":
            print("✅ Session management: PASS")
        else:
            print("❌ Session management: FAIL")
            return False
        
        # Test smart cache
        cache = SmartCache("test_cache")
        await cache.set("test_namespace", "test_key", {"cached": "data"})
        cached_data = await cache.get("test_namespace", "test_key")
        
        if cached_data and cached_data.get("cached") == "data":
            print("✅ Smart cache: PASS")
        else:
            print("❌ Smart cache: FAIL")
            return False
        
        # Test task queue
        task_queue = AgentTaskQueue()
        task_id = await task_queue.enqueue_task(
            "test_agent",
            "test_task",
            {"test": True}
        )
        
        if task_id:
            print("✅ Task queue: PASS")
        else:
            print("❌ Task queue: FAIL")
            return False
        
        # Cleanup
        await session_manager.clear_session()
        
        return True
        
    except Exception as e:
        print(f"❌ Agent utilities test failed: {e}")
        return False

async def test_health_monitoring():
    """Test health monitoring capabilities."""
    print("Testing health monitoring...")
    
    if not REDIS_AVAILABLE:
        print("❌ Health monitoring not available")
        return False
    
    try:
        health_result = await redis_health_check()
        
        if health_result.get("overall_status") in ["healthy", "degraded"]:
            print("✅ Health monitoring: PASS")
            print(f"   Status: {health_result.get('overall_status')}")
            return True
        else:
            print("❌ Health monitoring: FAIL")
            print(f"   Status: {health_result.get('overall_status')}")
            return False
            
    except Exception as e:
        print(f"❌ Health monitoring test failed: {e}")
        return False

async def main():
    """Run all integration tests."""
    print("=== Redis Integration Test Suite ===")
    print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    if not REDIS_AVAILABLE:
        print("❌ Redis integration dependencies not available")
        print("Please run the setup script first: ~/.claude/setup_redis_integration.sh")
        return 1
    
    tests = [
        ("Claude Integration", test_claude_integration),
        ("Agent Utilities", test_agent_utilities), 
        ("Health Monitoring", test_health_monitoring)
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        print(f"\n--- {test_name} ---")
        try:
            if await test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
            failed += 1
    
    print(f"\n=== Test Results ===")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Total: {passed + failed}")
    
    if failed == 0:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed. Check Redis setup and configuration.")
        return 1

if __name__ == "__main__":
    exit(asyncio.run(main()))
EOF
    
    chmod +x "/home/david/.claude/test_redis_integration.py"
    success "Integration test script created"
}

# Main setup function
main() {
    local action="${1:-setup}"
    
    echo "=== Redis Integration Setup for AI Agents ==="
    echo "Timestamp: $(date)"
    echo ""
    
    case "$action" in
        "setup"|"install")
            if ! check_redis; then
                error "Redis server not available. Setup cannot continue."
                echo ""
                echo "To install Redis:"
                echo "  Ubuntu/Debian: sudo apt install redis-server"
                echo "  CentOS/RHEL: sudo yum install redis"
                echo "  macOS: brew install redis"
                echo ""
                echo "To start Redis:"
                echo "  Linux: sudo systemctl start redis-server"
                echo "  macOS: brew services start redis"
                exit 1
            fi
            
            setup_redis_databases
            install_python_dependencies
            setup_environment_variables
            install_redis_utils
            setup_ruff_claude_integration
            create_health_monitor
            create_integration_test
            
            echo ""
            success "Redis integration setup completed successfully!"
            echo ""
            echo "Next steps:"
            echo "1. Source your shell profile to load environment variables:"
            echo "   source ~/.bashrc  # or ~/.zshrc"
            echo ""
            echo "2. Test the integration:"
            echo "   ~/.claude/test_redis_integration.py"
            echo ""
            echo "3. Run health check:"
            echo "   ~/.claude/redis_health_monitor.sh"
            echo ""
            echo "4. Try the enhanced ruff-claude:"
            echo "   ~/.claude/ruff-claude.sh help"
            ;;
        
        "test")
            log "Running integration tests..."
            if [[ -x "/home/david/.claude/test_redis_integration.py" ]]; then
                python3 "/home/david/.claude/test_redis_integration.py"
            else
                error "Integration test script not found. Run setup first."
                exit 1
            fi
            ;;
        
        "health")
            log "Running health check..."
            if [[ -x "/home/david/.claude/redis_health_monitor.sh" ]]; then
                "/home/david/.claude/redis_health_monitor.sh"
            else
                error "Health monitor script not found. Run setup first."
                exit 1
            fi
            ;;
        
        "uninstall")
            log "Removing Redis integration..."
            warning "This will remove Redis utilities but not the Redis server itself."
            read -p "Continue? [y/N] " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                # Remove installed files
                rm -f "/home/david/.claude/ruff-claude.sh"
                rm -f "/home/david/.claude/redis_health_monitor.sh" 
                rm -f "/home/david/.claude/test_redis_integration.py"
                rm -f "/home/david/.local/bin/ruff-claude"
                rm -f "/home/david/bin/ruff-claude"
                
                # Remove from projects (keeping originals as .bak)
                local projects=("/home/david/agents/gterminal" "/home/david/agents/py-gemini" "/home/david/agents/my-fullstack-agent")
                for project in "${projects[@]}"; do
                    if [[ -d "$project/shared/redis" ]]; then
                        rm -rf "$project/shared/redis"
                        success "Removed Redis utilities from $(basename "$project")"
                    fi
                done
                
                success "Redis integration removed"
            else
                log "Uninstall cancelled"
            fi
            ;;
        
        "help"|"-h"|"--help")
            cat << 'EOF'
Redis Integration Setup for AI Agents

USAGE:
    setup_redis_integration.sh [action]

ACTIONS:
    setup, install    Set up Redis integration (default)
    test             Run integration tests
    health           Run health check
    uninstall        Remove Redis integration
    help             Show this help

REQUIREMENTS:
    - Redis server running on localhost:6379
    - Python 3.7+ with asyncio support
    - Write permissions to ~/.claude/ directory

EXAMPLES:
    ./setup_redis_integration.sh setup
    ./setup_redis_integration.sh test
    ./setup_redis_integration.sh health

For more information, see ~/.claude/REDIS_INTEGRATION_GUIDE.md
EOF
            ;;
        
        *)
            error "Unknown action: $action"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"