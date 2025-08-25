#!/bin/bash

# Script to help register Claude agents and commands
# This generates configuration entries for settings.json

echo "Generating agent configurations from markdown files..."

# Function to extract description from markdown frontmatter
extract_description() {
    local file="$1"
    awk '/^description:/ {$1=""; gsub(/^[ \t]+|[ \t]+$/, "", $0); print; exit}' "$file"
}

# Generate subAgents configuration
echo "{"
echo '  "subAgents": {'

# Process agent files
first=true
for agent_file in /home/david/.claude/agents/*.md; do
    if [[ -f "$agent_file" ]]; then
        agent_name=$(basename "$agent_file" .md)
        description=$(extract_description "$agent_file")
        
        if [[ ! "$first" == true ]]; then
            echo ","
        fi
        first=false
        
        printf '    "%s": {\n' "$agent_name"
        printf '      "description": "%s",\n' "$description"
        printf '      "configPath": "%s"\n' "$agent_file"
        printf '    }'
    fi
done

echo ""
echo "  }"
echo "}"

echo ""
echo "To use these agents:"
echo "1. Copy the subAgents section above"
echo "2. Replace the existing subAgents section in ~/.claude/settings.json"
echo "3. Or use the Task tool with subagent_type parameter matching the agent name"