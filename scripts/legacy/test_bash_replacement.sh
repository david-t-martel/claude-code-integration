#!/bin/bash
# Test claude-bash as a bash replacement

echo "========================================="
echo "Claude-Bash Replacement Test Suite"
echo "========================================="
echo ""

# Test function
test_command() {
    local test_name="$1"
    local command="$2"
    
    echo -n "Testing: $test_name ... "
    
    if claude-bash "$command" > /tmp/test_output.txt 2>&1; then
        echo "✓ PASSED"
    else
        echo "✗ FAILED"
        echo "  Error: $(cat /tmp/test_output.txt | head -1)"
    fi
}

echo "1. Basic Commands"
echo "-----------------"
test_command "Simple echo" "echo 'Hello World'"
test_command "List files" "ls /tmp | head -5"
test_command "Print working directory" "pwd"
test_command "Date command" "date +%Y-%m-%d"

echo ""
echo "2. Pipes and Redirects"
echo "----------------------"
test_command "Simple pipe" "echo 'test' | wc -c"
test_command "Multi-pipe" "ls -la | grep -v '^d' | head -3"
test_command "Output redirect" "echo 'test' > /tmp/claude_test.txt && cat /tmp/claude_test.txt"
test_command "Append redirect" "echo 'append' >> /tmp/claude_test.txt && wc -l /tmp/claude_test.txt"

echo ""
echo "3. Command Chaining"
echo "-------------------"
test_command "AND operator" "true && echo 'success'"
test_command "OR operator" "false || echo 'fallback'"
test_command "Semicolon chain" "echo 'first'; echo 'second'"

echo ""
echo "4. Variable Expansion"
echo "---------------------"
test_command "HOME variable" "echo \$HOME"
test_command "Command substitution" "echo Today is \$(date +%A)"
test_command "Quote handling" "echo 'single' \"double\" unquoted"

echo ""
echo "5. Performance Test"
echo "-------------------"
echo -n "100 simple commands timing: "

# Time 100 simple commands
start_time=$(date +%s%N)
for i in {1..100}; do
    claude-bash "true" 2>/dev/null
done
end_time=$(date +%s%N)
duration=$((($end_time - $start_time) / 1000000))
avg=$((duration / 100))
echo "${duration}ms total, ${avg}ms average"

echo ""
echo "6. Security Tests"
echo "-----------------"
echo -n "Command injection attempt: "
if claude-bash "echo test; cat /etc/passwd" 2>/dev/null | grep -q root; then
    echo "✗ VULNERABLE"
else
    echo "✓ BLOCKED or SAFE"
fi

echo -n "Path traversal attempt: "
if claude-bash "cat ../../../etc/passwd" 2>/dev/null | grep -q root; then
    echo "✗ VULNERABLE"
else
    echo "✓ BLOCKED or SAFE"
fi

echo ""
echo "7. Comparison with Bash"
echo "------------------------"
echo "Timing comparison for 'ls -la | grep -v ^d | head -5':"

echo -n "  bash: "
time -p bash -c "ls -la | grep -v ^d | head -5" > /dev/null 2>&1

echo -n "  claude-bash: "
time -p claude-bash "ls -la | grep -v ^d | head -5" > /dev/null 2>&1

echo ""
echo "8. Use as SHELL Replacement"
echo "---------------------------"
echo -n "Can be used as SHELL: "
if SHELL=/usr/local/bin/claude-bash $SHELL -c "echo 'Shell test'" 2>/dev/null | grep -q "Shell test"; then
    echo "✓ YES"
else
    echo "✗ NO"
fi

echo ""
echo "========================================="
echo "Test Complete"
echo "========================================="

# Cleanup
rm -f /tmp/claude_test.txt /tmp/test_output.txt