#!/bin/bash

# fix-json.sh - High-performance JSON linter and auto-fixer
# Supports: single files, directories, recursive search, gitignore patterns
# Tools: jq, jsonlint-php, rg, fd, fzf (optional)

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default values
TARGET="${1:-.}"
RECURSIVE=false
INTERACTIVE=false
DRY_RUN=false
BACKUP=true
VERBOSE=false
QUIET=false
FIX_MODE="auto"
PARALLEL_JOBS=4
RESPECT_GITIGNORE=true
JSONC_SUPPORT=false
PRETTY_PRINT=true
SORT_KEYS=false
INDENT=2

# Usage function
usage() {
    cat << EOF
${CYAN}fix-json.sh${NC} - High-performance JSON linter and auto-fixer

${YELLOW}Usage:${NC}
    fix-json.sh [OPTIONS] [FILE|DIRECTORY]

${YELLOW}Options:${NC}
    -r, --recursive         Recursively search directories
    -i, --interactive       Interactive mode with fzf for file selection
    -d, --dry-run          Show what would be done without making changes
    -n, --no-backup        Don't create backup files
    -v, --verbose          Verbose output
    -q, --quiet            Quiet mode (errors only)
    -j, --jobs NUM         Number of parallel jobs (default: 4)
    --no-gitignore         Don't respect .gitignore patterns
    --jsonc                Support JSON with comments (.jsonc files)
    --sort-keys            Sort object keys alphabetically
    --indent NUM           Indentation spaces (default: 2)
    --tab                  Use tabs for indentation
    -h, --help             Show this help message

${YELLOW}Examples:${NC}
    fix-json.sh file.json                    # Fix single file
    fix-json.sh -r .                        # Fix all JSON files recursively
    fix-json.sh -i                          # Interactive file selection
    fix-json.sh -d -r src/                  # Dry run on src directory
    fix-json.sh --sort-keys --indent 4     # Sort keys with 4-space indent

${YELLOW}Supported file extensions:${NC}
    .json, .jsonc (with --jsonc flag), .json5

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -r|--recursive)
            RECURSIVE=true
            shift
            ;;
        -i|--interactive)
            INTERACTIVE=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -n|--no-backup)
            BACKUP=false
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -q|--quiet)
            QUIET=true
            shift
            ;;
        -j|--jobs)
            PARALLEL_JOBS="$2"
            shift 2
            ;;
        --no-gitignore)
            RESPECT_GITIGNORE=false
            shift
            ;;
        --jsonc)
            JSONC_SUPPORT=true
            shift
            ;;
        --sort-keys)
            SORT_KEYS=true
            shift
            ;;
        --indent)
            INDENT="$2"
            shift 2
            ;;
        --tab)
            INDENT="tab"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        -*)
            echo -e "${RED}Unknown option: $1${NC}" >&2
            usage
            exit 1
            ;;
        *)
            TARGET="$1"
            shift
            ;;
    esac
done

# Logging functions
log() {
    [[ "$QUIET" == "false" ]] && echo -e "$@"
}

log_verbose() {
    [[ "$VERBOSE" == "true" ]] && echo -e "${CYAN}[VERBOSE]${NC} $@" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $@" >&2
}

log_success() {
    log "${GREEN}[SUCCESS]${NC} $@"
}

log_warning() {
    log "${YELLOW}[WARNING]${NC} $@"
}

# Check for required tools
check_tools() {
    local missing_tools=()
    
    # Required tools
    for tool in jq; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    # Optional but recommended tools
    local optional_tools=()
    for tool in fd rg fzf jsonlint-php; do
        if ! command -v "$tool" &> /dev/null; then
            optional_tools+=("$tool")
        fi
    done
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Required tools missing: ${missing_tools[*]}"
        log_error "Please install: sudo apt-get install jq"
        exit 1
    fi
    
    if [[ ${#optional_tools[@]} -gt 0 ]] && [[ "$VERBOSE" == "true" ]]; then
        log_warning "Optional tools missing for enhanced performance: ${optional_tools[*]}"
        log_warning "Install with: sudo apt-get install fd-find ripgrep fzf"
        log_warning "For jsonlint: sudo apt-get install jsonlint"
    fi
}

# Build JQ options based on settings
build_jq_options() {
    local opts="."
    
    if [[ "$SORT_KEYS" == "true" ]]; then
        opts="$opts | sort_keys"
    fi
    
    echo "$opts"
}

# Build JQ format options
build_jq_format_options() {
    local opts=""
    
    if [[ "$INDENT" == "tab" ]]; then
        opts="--tab"
    else
        opts="--indent $INDENT"
    fi
    
    echo "$opts"
}

# Get list of files to process
get_json_files() {
    local search_path="$1"
    local files=()
    
    # Use fd if available for better performance
    if command -v fd &> /dev/null; then
        local fd_opts="-t f"
        [[ "$RECURSIVE" == "false" ]] && fd_opts="$fd_opts --max-depth 1"
        [[ "$RESPECT_GITIGNORE" == "true" ]] && fd_opts="$fd_opts" || fd_opts="$fd_opts --no-ignore"
        
        # Build extension pattern
        local ext_pattern='\.json$'
        [[ "$JSONC_SUPPORT" == "true" ]] && ext_pattern='\.jsonc?$'
        
        mapfile -t files < <(fd $fd_opts -e json $([[ "$JSONC_SUPPORT" == "true" ]] && echo "-e jsonc") . "$search_path" 2>/dev/null)
    else
        # Fallback to find
        local find_opts="-name '*.json'"
        [[ "$JSONC_SUPPORT" == "true" ]] && find_opts="$find_opts -o -name '*.jsonc'"
        [[ "$RECURSIVE" == "false" ]] && find_opts="-maxdepth 1 $find_opts"
        
        if [[ "$RESPECT_GITIGNORE" == "true" ]] && [[ -f .gitignore ]]; then
            # Basic gitignore support with find
            mapfile -t files < <(find "$search_path" $find_opts -type f 2>/dev/null | grep -v -E '/(\.git|node_modules|dist|build|coverage)/')
        else
            mapfile -t files < <(find "$search_path" $find_opts -type f 2>/dev/null)
        fi
    fi
    
    printf '%s\n' "${files[@]}"
}

# Validate JSON using multiple tools
validate_json() {
    local file="$1"
    local content
    local errors=""
    
    # First try with jq
    if ! errors=$(jq empty "$file" 2>&1); then
        echo "jq validation failed: $errors"
        return 1
    fi
    
    # If jsonlint is available, use it for better error messages
    if command -v jsonlint-php &> /dev/null; then
        if ! errors=$(jsonlint-php "$file" 2>&1); then
            echo "jsonlint validation failed: $errors"
            return 1
        fi
    fi
    
    return 0
}

# Process a single JSON file
process_json_file() {
    local file="$1"
    local temp_file
    local jq_opts
    local jq_format_opts
    local changed=false
    
    log_verbose "Processing: $file"
    
    # Skip if file doesn't exist
    if [[ ! -f "$file" ]]; then
        log_error "File not found: $file"
        echo "ERROR"
        return 1
    fi
    
    # Validate JSON first
    local validation_error
    if ! validation_error=$(validate_json "$file" 2>&1); then
        log_error "Invalid JSON in $file: $validation_error"
        echo "ERROR"
        return 1
    fi
    
    # Create temp file
    temp_file=$(mktemp)
    
    # Build JQ options
    jq_opts=$(build_jq_options)
    jq_format_opts=$(build_jq_format_options)
    
    # Process with jq
    if ! jq $jq_format_opts "$jq_opts" "$file" > "$temp_file" 2>/dev/null; then
        log_error "Failed to process $file with jq"
        rm -f "$temp_file"
        echo "ERROR"
        return 1
    fi
    
    # Check if file changed
    if ! cmp -s "$file" "$temp_file"; then
        changed=true
        
        if [[ "$DRY_RUN" == "true" ]]; then
            log_warning "[DRY RUN] Would fix: $file"
            if [[ "$VERBOSE" == "true" ]]; then
                log_verbose "Changes:"
                diff -u "$file" "$temp_file" || true
            fi
        else
            # Backup original if requested
            if [[ "$BACKUP" == "true" ]]; then
                cp "$file" "$file.bak"
                log_verbose "Created backup: $file.bak"
            fi
            
            # Replace with formatted version
            mv "$temp_file" "$file"
            log_success "Fixed: $file"
        fi
        echo "FIXED"
    else
        rm -f "$temp_file"
        [[ "$VERBOSE" == "true" ]] && log_success "$file is already properly formatted"
        echo "OK"
    fi
    
    return 0
}

# Interactive mode with fzf
interactive_mode() {
    if ! command -v fzf &> /dev/null; then
        log_error "fzf is required for interactive mode"
        log_error "Install with: sudo apt-get install fzf"
        exit 1
    fi
    
    log "Searching for JSON files..."
    local files
    mapfile -t files < <(get_json_files ".")
    
    if [[ ${#files[@]} -eq 0 ]]; then
        log_warning "No JSON files found"
        exit 0
    fi
    
    log "Select files to process (Tab to select multiple, Enter to confirm):"
    local selected
    mapfile -t selected < <(printf '%s\n' "${files[@]}" | fzf --multi --preview 'jq . {} 2>/dev/null | head -50' --preview-window=right:50%:wrap)
    
    if [[ ${#selected[@]} -eq 0 ]]; then
        log "No files selected"
        exit 0
    fi
    
    printf '%s\n' "${selected[@]}"
}

# Main processing logic
main() {
    check_tools
    
    local files_to_process=()
    
    # Handle interactive mode
    if [[ "$INTERACTIVE" == "true" ]]; then
        mapfile -t files_to_process < <(interactive_mode)
    elif [[ -f "$TARGET" ]]; then
        # Single file mode
        files_to_process=("$TARGET")
    elif [[ -d "$TARGET" ]]; then
        # Directory mode
        mapfile -t files_to_process < <(get_json_files "$TARGET")
    else
        log_error "Target not found: $TARGET"
        exit 1
    fi
    
    if [[ ${#files_to_process[@]} -eq 0 ]]; then
        log_warning "No JSON files found to process"
        exit 0
    fi
    
    log "Found ${#files_to_process[@]} JSON file(s) to process"
    [[ "$DRY_RUN" == "true" ]] && log_warning "Running in DRY RUN mode - no files will be modified"
    
    # Counters
    local total=0
    local fixed=0
    local errors=0
    local unchanged=0
    
    # Process files (with parallel support if GNU parallel is available)
    if command -v parallel &> /dev/null && [[ ${#files_to_process[@]} -gt 10 ]] && [[ "$VERBOSE" == "false" ]]; then
        log_verbose "Using GNU parallel with $PARALLEL_JOBS jobs"
        
        # Export functions and variables for parallel
        export -f process_json_file validate_json build_jq_options build_jq_format_options log_verbose log_error log_success log_warning
        export DRY_RUN BACKUP VERBOSE QUIET SORT_KEYS INDENT JSONC_SUPPORT
        
        local results
        results=$(printf '%s\n' "${files_to_process[@]}" | parallel -j "$PARALLEL_JOBS" --will-cite process_json_file {})
        
        # Count results
        fixed=$(echo "$results" | grep -c "FIXED" || true)
        unchanged=$(echo "$results" | grep -c "OK" || true)
        total=${#files_to_process[@]}
        errors=$((total - fixed - unchanged))
    else
        # Sequential processing
        for file in "${files_to_process[@]}"; do
            ((total++))
            # Process file and capture result
            local result
            result=$(process_json_file "$file")
            local process_status=$?
            
            if [[ $process_status -eq 0 ]]; then
                case "$result" in
                    FIXED) ((fixed++)) ;;
                    OK) ((unchanged++)) ;;
                    *) ((unchanged++)) ;;
                esac
            else
                ((errors++))
            fi
        done
    fi
    
    # Summary
    echo
    log "${YELLOW}Summary:${NC}"
    log "Total files processed: $total"
    log "Fixed: ${GREEN}$fixed${NC}"
    log "Unchanged: ${BLUE}$unchanged${NC}"
    log "Errors: ${RED}$errors${NC}"
    
    if [[ "$fixed" -gt 0 ]] && [[ "$BACKUP" == "true" ]] && [[ "$DRY_RUN" == "false" ]]; then
        log ""
        log "${YELLOW}Note: Original files backed up with .bak extension${NC}"
    fi
    
    # Exit with error if any files had errors
    [[ "$errors" -gt 0 ]] && exit 1
    exit 0
}

# Run main function
main