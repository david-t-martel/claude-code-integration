#!/bin/bash
# Comprehensive hook integration test

echo "========================================="
echo "Claude Hook System Integration Tests"
echo "========================================="
echo ""

# Test function
test_hook() {
    local test_name="$1"
    local input_json="$2"
    local expected_decision="$3"
    
    echo -n "Testing: $test_name ... "
    
    result=$(echo "$input_json" | /home/david/.claude/hooks/command-replacer/command-replacer 2>/dev/null)
    
    if echo "$result" | grep -q "\"decision\":\"$expected_decision\""; then
        echo "✓ PASSED"
        if echo "$result" | grep -q "modified_command"; then
            modified=$(echo "$result" | grep -o '"modified_command":"[^"]*"' | cut -d'"' -f4)
            echo "  → Modified to: $modified"
        fi
    else
        echo "✗ FAILED"
        echo "  Got: $result"
    fi
}

echo "1. Command Replacement Tests"
echo "-----------------------------"

test_hook "grep replacement" \
    '{"session":{"id":"test","projectDir":"/tmp"},"event":{"type":"PreToolUse","data":{"command":"grep -r pattern files"}}}' \
    "approve"

test_hook "find replacement" \
    '{"session":{"id":"test","projectDir":"/tmp"},"event":{"type":"PreToolUse","data":{"command":"find . -name *.rs"}}}' \
    "approve"

test_hook "complex grep with flags" \
    '{"session":{"id":"test","projectDir":"/tmp"},"event":{"type":"PreToolUse","data":{"command":"grep -i -n -H pattern *.txt"}}}' \
    "approve"

test_hook "no replacement needed" \
    '{"session":{"id":"test","projectDir":"/tmp"},"event":{"type":"PreToolUse","data":{"command":"ls -la"}}}' \
    "approve"

echo ""
echo "2. Edge Case Tests"
echo "------------------"

test_hook "empty command" \
    '{"session":{"id":"test","projectDir":"/tmp"},"event":{"type":"PreToolUse","data":{"command":""}}}' \
    "approve"

test_hook "non-PreToolUse event" \
    '{"session":{"id":"test","projectDir":"/tmp"},"event":{"type":"PostToolUse","data":{}}}' \
    "approve"

test_hook "malformed JSON recovery" \
    '{"invalid json' \
    "approve"

echo ""
echo "3. Performance Tests"
echo "--------------------"

echo -n "Average response time (100 iterations): "
total_time=0
for i in {1..100}; do
    start=$(date +%s%N)
    echo '{"session":{"id":"test","projectDir":"/tmp"},"event":{"type":"PreToolUse","data":{"command":"grep test"}}}' | \
        /home/david/.claude/hooks/command-replacer/command-replacer > /dev/null 2>&1
    end=$(date +%s%N)
    duration=$((($end - $start) / 1000000))
    total_time=$((total_time + duration))
done
avg_time=$((total_time / 100))
echo "${avg_time}ms"

echo ""
echo "4. Integration with claude-exec"
echo "--------------------------------"

# Test that both hooks work together
echo -n "Testing hook chain (replacer + exec): "
test_json='{"session":{"id":"test","projectDir":"/tmp"},"event":{"type":"PreToolUse","data":{"command":"grep TODO /home/david/.claude/rust-exec/README.md"}}}'

# First pass through replacer
modified_json=$(echo "$test_json" | /home/david/.claude/hooks/command-replacer/command-replacer 2>/dev/null)
if echo "$modified_json" | grep -q "rg TODO"; then
    echo "✓ Command replaced"
    
    # Then execute with claude-exec
    if claude-exec execute -- rg TODO /home/david/.claude/rust-exec/README.md 2>/dev/null | grep -q "TODO"; then
        echo "  → Execution successful"
    else
        echo "  → Execution failed"
    fi
else
    echo "✗ Replacement failed"
fi

echo ""
echo "5. Tool Availability Tests"
echo "--------------------------"

for tool in rg fd bat eza sd procs; do
    echo -n "Checking $tool: "
    if command -v $tool &> /dev/null; then
        echo "✓ Available ($(which $tool))"
    else
        echo "✗ Not installed"
    fi
done

echo ""
echo "========================================="
echo "Test Summary"
echo "========================================="

# Count actual replacements happening
echo ""
echo "Active replacements:"
echo "- grep → rg: $(command -v rg &>/dev/null && echo '✓ Active' || echo '✗ Inactive')"
echo "- find → fd: $(command -v fd &>/dev/null && echo '✓ Active' || echo '✗ Inactive')"
echo ""
echo "Hook binary size: $(du -h /home/david/.claude/hooks/command-replacer/command-replacer | cut -f1)"
echo "Claude-exec binary size: $(du -h /home/david/.local/bin/claude-exec | cut -f1)"
echo ""
echo "All tests completed!"