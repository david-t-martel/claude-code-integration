//! Command replacement engine with plugin architecture

use anyhow::{Context, Result};
use once_cell::sync::Lazy;
use regex::Regex;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use which::which;

use crate::config::{Config, ReplacementConfig};

/// Tool availability cache
static TOOL_CACHE: Lazy<Mutex<HashMap<String, (bool, Instant)>>> = 
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Replacement engine handles command transformations
pub struct ReplacementEngine {
    config: Config,
    compatibility_mode: bool,
    pub is_git_repo: bool,
}

impl ReplacementEngine {
    pub fn new(config: Config) -> Result<Self> {
        let compatibility_mode = config.settings.compatibility_mode.unwrap_or(false);
        let is_git_repo = Self::detect_git_repo()?;
        
        Ok(Self { 
            config,
            compatibility_mode,
            is_git_repo,
        })
    }
    
    /// Detect if we're in a git repository
    fn detect_git_repo() -> Result<bool> {
        // Check for .git directory in current or parent directories
        let mut current_dir = std::env::current_dir()?;
        loop {
            if current_dir.join(".git").exists() {
                return Ok(true);
            }
            if let Some(parent) = current_dir.parent() {
                current_dir = parent.to_path_buf();
            } else {
                break;
            }
        }
        Ok(false)
    }
    
    /// Replace a command if a better alternative is available
    pub fn replace_command(&self, command: &str) -> Result<Option<String>> {
        // Check if semantic analysis is enabled and command matches fallback patterns
        if self.config.settings.semantic_analysis && self.matches_fallback_patterns(command)? {
            return Ok(None);
        }
        
        // Parse command into parts
        let parts = self.parse_command(command)?;
        if parts.is_empty() {
            return Ok(None);
        }
        
        let cmd = &parts[0];
        let args = &parts[1..];
        
        // Check if we have a replacement for this command
        if let Some(replacement_config) = self.config.replacements.get(cmd) {
            if !replacement_config.enabled {
                return Ok(None);
            }
            
            // Check if replacement tool is available
            if self.is_tool_available(&replacement_config.replacement)? {
                return self.apply_replacement(cmd, args, replacement_config);
            } else if !replacement_config.use_fallback {
                // Replacement not available and fallback disabled
                return Ok(None);
            }
            
            // Try alternative tools for some commands
            if let Some(alternative) = self.get_alternative_tool(cmd)? {
                let alt_config = ReplacementConfig {
                    replacement: alternative,
                    ..replacement_config.clone()
                };
                return self.apply_replacement(cmd, args, &alt_config);
            }
        }
        
        Ok(None)
    }
    
    /// Check if command matches any fallback patterns
    fn matches_fallback_patterns(&self, command: &str) -> Result<bool> {
        for pattern_str in &self.config.settings.fallback_patterns {
            let regex = Regex::new(pattern_str)
                .with_context(|| format!("Invalid fallback pattern: {}", pattern_str))?;
            
            if regex.is_match(command) {
                return Ok(true);
            }
        }
        Ok(false)
    }
    
    /// Apply a specific replacement transformation
    fn apply_replacement(
        &self,
        original_cmd: &str,
        args: &[String],
        config: &ReplacementConfig,
    ) -> Result<Option<String>> {
        match original_cmd {
            "grep" => self.replace_grep(args, config),
            "find" => self.replace_find(args, config),
            "cat" => self.replace_cat(args, config),
            "ls" => self.replace_ls(args, config),
            "sed" => self.replace_sed(args, config),
            "ps" => self.replace_ps(args, config),
            _ => Ok(None),
        }
    }
    
    /// Replace grep with ripgrep (rg)
    fn replace_grep(&self, args: &[String], config: &ReplacementConfig) -> Result<Option<String>> {
        // Check if we should use fallback due to semantic differences
        if self.should_use_grep_fallback(args)? {
            return Ok(None);
        }
        
        let mut new_args = Vec::new();
        let mut i = 0;
        
        // Add compatibility flags for git repositories
        if self.is_git_repo && !self.has_ignore_flags(args) {
            new_args.push("--no-ignore".to_string());
            new_args.push("--hidden".to_string());
        }
        
        while i < args.len() {
            let arg = &args[i];
            
            if arg.starts_with('-') {
                match arg.as_str() {
                    // Regex flavor differences - handle carefully
                    "-E" | "--extended-regexp" => {
                        // rg uses regex crate (similar to PCRE), grep -E is ERE
                        if self.compatibility_mode {
                            return Ok(None); // Use fallback for exact compatibility
                        }
                        // rg's default is similar to grep -E, so we can skip this
                    }
                    "-F" | "--fixed-strings" => {
                        new_args.push("--fixed-strings".to_string());
                    }
                    "-P" | "--perl-regexp" => {
                        // rg doesn't support PCRE, this is a semantic difference
                        return Ok(None);
                    }
                    // Output format flags that might differ
                    "-o" | "--only-matching" => {
                        new_args.push("--only-matching".to_string());
                    }
                    "-c" | "--count" => {
                        new_args.push("--count".to_string());
                    }
                    "-l" | "--files-with-matches" => {
                        new_args.push("--files-with-matches".to_string());
                    }
                    "-L" | "--files-without-match" => {
                        new_args.push("--files-without-match".to_string());
                    }
                    // Context flags
                    "-A" | "--after-context" => {
                        new_args.push("-A".to_string());
                        if i + 1 < args.len() {
                            i += 1;
                            new_args.push(args[i].clone());
                        }
                    }
                    "-B" | "--before-context" => {
                        new_args.push("-B".to_string());
                        if i + 1 < args.len() {
                            i += 1;
                            new_args.push(args[i].clone());
                        }
                    }
                    "-C" | "--context" => {
                        new_args.push("-C".to_string());
                        if i + 1 < args.len() {
                            i += 1;
                            new_args.push(args[i].clone());
                        }
                    }
                    // File selection flags
                    arg if arg.starts_with("--include=") => {
                        let pattern = &arg[10..]; // Remove "--include="
                        new_args.push("--glob".to_string());
                        let clean_pattern = pattern.trim_matches('"').trim_matches('\'');
                        new_args.push(clean_pattern.to_string());
                    }
                    arg if arg.starts_with("--exclude=") => {
                        let pattern = &arg[10..]; // Remove "--exclude="
                        new_args.push("--glob".to_string());
                        let clean_pattern = pattern.trim_matches('"').trim_matches('\'');
                        new_args.push(format!("!{}", clean_pattern));
                    }
                    "--include" => {
                        if i + 1 < args.len() {
                            i += 1;
                            new_args.push("--glob".to_string());
                            // Remove quotes if present
                            let pattern = args[i].trim_matches('"').trim_matches('\'');
                            new_args.push(pattern.to_string());
                        }
                    }
                    "--exclude" => {
                        if i + 1 < args.len() {
                            i += 1;
                            new_args.push("--glob".to_string());
                            // Remove quotes if present and negate
                            let pattern = args[i].trim_matches('"').trim_matches('\'');
                            new_args.push(format!("!{}", pattern));
                        }
                    }
                    _ => {
                        // Handle flags that should be preserved or mapped
                        if config.preserve_flags.contains(&arg.to_string()) {
                            new_args.push(arg.to_string());
                        } else if let Some(mapped) = config.flag_mappings.get(arg) {
                            if !mapped.is_empty() {
                                new_args.push(mapped.clone());
                            }
                        } else {
                            // Check if this is a potentially problematic flag
                            if self.is_problematic_grep_flag(arg) {
                                return Ok(None); // Use fallback
                            }
                            new_args.push(arg.to_string());
                        }
                    }
                }
            } else {
                // Regular arguments (pattern, files)
                new_args.push(arg.to_string());
            }
            
            i += 1;
        }
        
        let new_command = format!("{} {}", config.replacement, new_args.join(" "));
        Ok(Some(new_command))
    }
    
    /// Check if grep command should use fallback due to semantic differences
    fn should_use_grep_fallback(&self, args: &[String]) -> Result<bool> {
        for arg in args {
            match arg.as_str() {
                // Regex flavors that differ significantly
                "-P" | "--perl-regexp" => return Ok(true),
                // Binary file handling differences
                "-a" | "--text" => {
                    if self.compatibility_mode {
                        return Ok(true);
                    }
                }
                // Some GNU grep specific options
                "--null-data" | "-z" => return Ok(true),
                _ => {}
            }
        }
        
        // Check if we're dealing with complex regex patterns that might behave differently
        if self.has_complex_regex_patterns(args) && self.compatibility_mode {
            return Ok(true);
        }
        
        Ok(false)
    }
    
    /// Check if args contain ignore-related flags
    fn has_ignore_flags(&self, args: &[String]) -> bool {
        args.iter().any(|arg| {
            matches!(arg.as_str(), "--no-ignore" | "--hidden" | "-u" | "--unrestricted")
        })
    }
    
    /// Check if a grep flag is known to be problematic with rg
    fn is_problematic_grep_flag(&self, flag: &str) -> bool {
        matches!(flag, 
            // Flags that don't exist in rg or behave very differently
            "--null-data" | "-z" |
            "--line-buffered" |
            "--mmap" |
            "-U" | "--binary" |
            "-Z" | "--null"
        )
    }
    
    /// Check if args contain complex regex patterns that might behave differently
    fn has_complex_regex_patterns(&self, args: &[String]) -> bool {
        // This is a heuristic - look for patterns that commonly differ between grep and rg
        for arg in args {
            if !arg.starts_with('-') {
                // Check for potentially problematic regex constructs
                if arg.contains("\\<") || arg.contains("\\>") || // Word boundaries (GNU grep style)
                   arg.contains("\\b") ||  // Word boundaries
                   arg.contains("(?") ||   // Advanced regex features
                   arg.contains("\\x") ||  // Hex escapes
                   arg.contains("\\u") {   // Unicode escapes
                    return true;
                }
            }
        }
        false
    }
    
    /// Replace find with fd
    fn replace_find(&self, args: &[String], config: &ReplacementConfig) -> Result<Option<String>> {
        // Check if we should use fallback due to semantic differences
        if self.should_use_find_fallback(args)? {
            return Ok(None);
        }
        
        let mut new_args = Vec::new();
        let mut i = 0;
        let mut pattern = None;
        let mut search_paths = Vec::new();
        
        // Add compatibility flags to match find's behavior of showing all files
        new_args.push("-H".to_string()); // Show hidden files
        new_args.push("-I".to_string()); // Don't respect ignore files
        
        while i < args.len() {
            let arg = &args[i];
            
            match arg.as_str() {
                // Pattern matching
                "-name" => {
                    if i + 1 < args.len() {
                        i += 1;
                        pattern = Some(self.convert_glob_to_regex(&args[i])?);
                    }
                }
                "-iname" => {
                    new_args.push("-i".to_string());
                    if i + 1 < args.len() {
                        i += 1;
                        pattern = Some(self.convert_glob_to_regex(&args[i])?);
                    }
                }
                "-path" => {
                    if i + 1 < args.len() {
                        i += 1;
                        // fd doesn't have direct -path equivalent, use glob pattern
                        new_args.push("--glob".to_string());
                        new_args.push(args[i].clone());
                    }
                }
                "-ipath" => {
                    new_args.push("-i".to_string());
                    if i + 1 < args.len() {
                        i += 1;
                        new_args.push("--glob".to_string());
                        new_args.push(args[i].clone());
                    }
                }
                // Type restrictions
                "-type" => {
                    if i + 1 < args.len() {
                        i += 1;
                        let type_char = &args[i];
                        match type_char.as_str() {
                            "f" => {
                                new_args.push("--type".to_string());
                                new_args.push("file".to_string());
                            }
                            "d" => {
                                new_args.push("--type".to_string());
                                new_args.push("directory".to_string());
                            }
                            "l" => {
                                new_args.push("--type".to_string());
                                new_args.push("symlink".to_string());
                            }
                            _ => {
                                // Other types (block, char, socket, pipe) not supported by fd
                                return Ok(None);
                            }
                        }
                    }
                }
                // Size restrictions (fd doesn't support these directly)
                "-size" => return Ok(None),
                // Time restrictions (fd has limited support)
                "-mtime" | "-ctime" | "-atime" => return Ok(None),
                // Actions (fd doesn't support find actions)
                "-exec" | "-execdir" | "-ok" | "-okdir" | "-delete" | "-print0" => {
                    return Ok(None); // fd doesn't support find actions
                }
                // Depth control
                "-maxdepth" => {
                    if i + 1 < args.len() {
                        i += 1;
                        new_args.push("--max-depth".to_string());
                        new_args.push(args[i].clone());
                    }
                }
                "-mindepth" => {
                    if i + 1 < args.len() {
                        i += 1;
                        new_args.push("--min-depth".to_string());
                        new_args.push(args[i].clone());
                    }
                }
                // Permission flags (not supported by fd)
                "-perm" | "-readable" | "-writable" | "-executable" => return Ok(None),
                // Ownership flags (not supported by fd)
                "-user" | "-group" | "-uid" | "-gid" => return Ok(None),
                // Logic operators
                "-and" | "-or" | "-not" | "!" | "(" | ")" => return Ok(None),
                // Other flags
                arg if arg.starts_with('-') => {
                    if config.preserve_flags.contains(&arg.to_string()) {
                        new_args.push(arg.to_string());
                    } else if self.is_problematic_find_flag(arg) {
                        return Ok(None);
                    }
                }
                _ => {
                    // This should be a search path
                    if !arg.starts_with('-') {
                        search_paths.push(arg.clone());
                    }
                }
            }
            
            i += 1;
        }
        
        // Handle search paths - fd takes pattern first, then paths
        let has_pattern = pattern.is_some();
        if let Some(p) = pattern {
            new_args.insert(0, p);
        }
        
        // If no search path was specified, add current directory
        let search_paths_empty = search_paths.is_empty();
        
        // Add search paths at the end
        for path in &search_paths {
            new_args.push(path.clone());
        }
        
        if search_paths_empty && has_pattern {
            new_args.push(".".to_string());
        }
        
        let new_command = format!("{} {}", config.replacement, new_args.join(" "));
        Ok(Some(new_command))
    }
    
    /// Check if find command should use fallback due to semantic differences
    fn should_use_find_fallback(&self, args: &[String]) -> Result<bool> {
        let mut i = 0;
        
        while i < args.len() {
            let arg = &args[i];
            
            match arg.as_str() {
                // Actions are not supported by fd
                "-exec" | "-execdir" | "-ok" | "-okdir" | "-delete" | "-print0" => return Ok(true),
                // Complex predicates not supported
                "-size" | "-mtime" | "-ctime" | "-atime" | "-perm" | 
                "-user" | "-group" | "-uid" | "-gid" => return Ok(true),
                // Logic operators
                "-and" | "-or" | "-not" | "!" | "(" | ")" => return Ok(true),
                // File type tests beyond basic f/d/l
                "-type" => {
                    if i + 1 < args.len() && 
                       !matches!(args[i + 1].as_str(), "f" | "d" | "l") {
                        return Ok(true);
                    }
                }
                _ => {}
            }
            
            i += 1;
        }
        
        // In strict compatibility mode, be more conservative
        if self.compatibility_mode && self.has_complex_find_expressions(args) {
            return Ok(true);
        }
        
        Ok(false)
    }
    
    /// Convert glob pattern to regex pattern for fd
    fn convert_glob_to_regex(&self, glob_pattern: &str) -> Result<String> {
        // fd supports glob patterns natively, but we need to handle some differences
        let mut pattern = glob_pattern.to_string();
        
        // Remove quotes if present
        if pattern.starts_with('"') && pattern.ends_with('"') {
            pattern = pattern[1..pattern.len()-1].to_string();
        } else if pattern.starts_with('\'') && pattern.ends_with('\'') {
            pattern = pattern[1..pattern.len()-1].to_string();
        }
        
        Ok(pattern)
    }
    
    /// Check if a find flag is known to be problematic with fd
    fn is_problematic_find_flag(&self, flag: &str) -> bool {
        matches!(flag,
            // Flags that don't exist in fd or behave very differently
            "-daystart" | "-follow" | "-regextype" | "-warn" | "-nowarn" |
            "-mount" | "-xdev" | "-prune" | "-quit" |
            "-printf" | "-fprintf" | "-fprint" | "-fls" |
            "-ls" | "-fprint0"
        )
    }
    
    /// Check if find command has complex expressions that might not translate well
    fn has_complex_find_expressions(&self, args: &[String]) -> bool {
        // Look for patterns that suggest complex find usage
        args.iter().any(|arg| {
            matches!(arg.as_str(),
                // Complex logic
                "-and" | "-or" | "-not" | "!" |
                // Complex actions
                "-exec" | "-execdir" | "-ok" | "-okdir" |
                // Regex usage
                "-regex" | "-iregex" |
                // Complex tests
                "-newer" | "-cnewer" | "-anewer" |
                "-samefile" | "-inum" | "-links"
            )
        })
    }
    
    /// Replace cat with bat (with plain output for compatibility)
    fn replace_cat(&self, args: &[String], config: &ReplacementConfig) -> Result<Option<String>> {
        let mut new_args = vec!["--style=plain".to_string()];
        
        for arg in args {
            if arg.starts_with('-') {
                if let Some(mapped) = config.flag_mappings.get(arg) {
                    new_args.push(mapped.clone());
                } else if config.preserve_flags.contains(&arg.to_string()) {
                    new_args.push(arg.to_string());
                }
            } else {
                new_args.push(arg.to_string());
            }
        }
        
        let new_command = format!("{} {}", config.replacement, new_args.join(" "));
        Ok(Some(new_command))
    }
    
    /// Replace ls with eza/exa
    fn replace_ls(&self, args: &[String], config: &ReplacementConfig) -> Result<Option<String>> {
        let mut new_args = Vec::new();
        
        for arg in args {
            if config.preserve_flags.contains(&arg.to_string()) {
                new_args.push(arg.to_string());
            } else if !arg.starts_with('-') {
                new_args.push(arg.to_string());
            }
        }
        
        let new_command = format!("{} {}", config.replacement, new_args.join(" "));
        Ok(Some(new_command))
    }
    
    /// Replace sed with sd (simple cases only)
    fn replace_sed(&self, args: &[String], config: &ReplacementConfig) -> Result<Option<String>> {
        // Only handle simple s/pattern/replacement/ cases
        if args.len() >= 1 {
            let expr = &args[0];
            if let Some(captures) = self.parse_sed_expression(expr)? {
                let mut new_args = vec![captures.0, captures.1];
                // Add remaining arguments (files)
                new_args.extend_from_slice(&args[1..]);
                
                let new_command = format!("{} {}", config.replacement, new_args.join(" "));
                return Ok(Some(new_command));
            }
        }
        
        // Complex sed expressions - use fallback
        Ok(None)
    }
    
    /// Replace ps with procs
    fn replace_ps(&self, args: &[String], config: &ReplacementConfig) -> Result<Option<String>> {
        let mut new_args = Vec::new();
        
        for arg in args {
            if config.preserve_flags.contains(&arg.to_string()) {
                new_args.push(arg.to_string());
            } else if !arg.starts_with('-') {
                new_args.push(arg.to_string());
            }
        }
        
        let new_command = format!("{} {}", config.replacement, new_args.join(" "));
        Ok(Some(new_command))
    }
    
    /// Parse sed s/pattern/replacement/ expressions
    fn parse_sed_expression(&self, expr: &str) -> Result<Option<(String, String)>> {
        static SED_REGEX: Lazy<Regex> = Lazy::new(|| {
            Regex::new(r"^s/([^/]+)/([^/]*)/[gi]*$").unwrap()
        });
        
        if let Some(captures) = SED_REGEX.captures(expr) {
            let pattern = captures.get(1).unwrap().as_str().to_string();
            let replacement = captures.get(2).unwrap().as_str().to_string();
            Ok(Some((pattern, replacement)))
        } else {
            Ok(None)
        }
    }
    
    /// Get alternative tool if primary replacement isn't available
    fn get_alternative_tool(&self, original_cmd: &str) -> Result<Option<String>> {
        match original_cmd {
            "ls" => {
                // Try exa if eza isn't available
                if self.is_tool_available("exa")? {
                    Ok(Some("exa".to_string()))
                } else {
                    Ok(None)
                }
            }
            _ => Ok(None),
        }
    }
    
    /// Check if a tool is available on the system
    pub fn is_tool_available(&self, tool: &str) -> Result<bool> {
        if !self.config.settings.cache_tool_checks {
            return Ok(which(tool).is_ok());
        }
        
        let cache_duration = Duration::from_millis(self.config.settings.tool_check_timeout);
        let now = Instant::now();
        
        let mut cache = TOOL_CACHE.lock().unwrap();
        
        if let Some((available, timestamp)) = cache.get(tool) {
            if now.duration_since(*timestamp) < cache_duration {
                return Ok(*available);
            }
        }
        
        let available = which(tool).is_ok();
        cache.insert(tool.to_string(), (available, now));
        
        Ok(available)
    }
    
    /// Parse command string into parts using shell parsing
    fn parse_command(&self, command: &str) -> Result<Vec<String>> {
        shlex::split(command)
            .context("Failed to parse command")
    }
}