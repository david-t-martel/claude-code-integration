#!/bin/bash
# Claude-specific bash aliases for modern tool usage
# This file should be sourced by Claude's bash environment

# Modern tool replacements
alias grep='/home/david/.cargo/bin/rg'
alias find='/home/david/.cargo/bin/fd'

# Export as functions to ensure they work in subshells
grep() {
    /home/david/.cargo/bin/rg "$@"
}

find() {
    /home/david/.cargo/bin/fd "$@"
}

export -f grep
export -f find