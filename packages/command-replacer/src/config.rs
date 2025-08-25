//! Configuration management for command replacements

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// Configuration for command replacements
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Config {
    /// Tool paths (for validation)
    #[serde(default)]
    pub tools: HashMap<String, String>,
    
    /// Replacement configurations
    #[serde(default)]
    pub replacements: HashMap<String, ReplacementConfig>,
    
    /// Global settings
    #[serde(default)]
    pub settings: GlobalSettings,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ReplacementConfig {
    /// Whether this replacement is enabled
    #[serde(default = "default_true")]
    pub enabled: bool,
    
    /// Name of the replacement tool
    pub replacement: String,
    
    /// Flags to preserve during replacement
    #[serde(default)]
    pub preserve_flags: Vec<String>,
    
    /// Flags to transform (old_flag -> new_flag)
    #[serde(default)]
    pub flag_mappings: HashMap<String, String>,
    
    /// Priority for replacement (higher = more priority)
    #[serde(default = "default_priority")]
    pub priority: u8,
    
    /// Whether to use fallback if replacement tool not available
    #[serde(default = "default_true")]
    pub use_fallback: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GlobalSettings {
    /// Enable debug logging
    #[serde(default)]
    pub debug: bool,
    
    /// Timeout for tool availability checks (ms)
    #[serde(default = "default_timeout")]
    pub tool_check_timeout: u64,
    
    /// Cache tool availability checks
    #[serde(default = "default_true")]
    pub cache_tool_checks: bool,
    
    /// Enable compatibility mode for exact behavioral matches
    #[serde(default)]
    pub compatibility_mode: Option<bool>,
    
    /// Enable semantic risk analysis to prevent problematic replacements
    #[serde(default = "default_true")]
    pub semantic_analysis: bool,
    
    /// Regex patterns for command contexts that require fallback
    #[serde(default)]
    pub fallback_patterns: Vec<String>,
}

impl Default for Config {
    fn default() -> Self {
        let mut replacements = HashMap::new();
        
        // grep → rg
        replacements.insert("grep".to_string(), ReplacementConfig {
            enabled: true,
            replacement: "rg".to_string(),
            preserve_flags: vec![
                "--color".to_string(),
                "-n".to_string(),
                "--line-number".to_string(),
                "-i".to_string(),
                "--ignore-case".to_string(),
                "-v".to_string(),
                "--invert-match".to_string(),
                "-r".to_string(),
                "--recursive".to_string(),
                "-A".to_string(),
                "-B".to_string(),
                "-C".to_string(),
            ],
            flag_mappings: HashMap::new(),
            priority: 10,
            use_fallback: true,
        });
        
        // find → fd
        replacements.insert("find".to_string(), ReplacementConfig {
            enabled: true,
            replacement: "fd".to_string(),
            preserve_flags: vec![
                "-t".to_string(),
                "--type".to_string(),
                "-e".to_string(),
                "--extension".to_string(),
                "-H".to_string(),
                "--hidden".to_string(),
                "-I".to_string(),
                "--no-ignore".to_string(),
            ],
            flag_mappings: {
                let mut map = HashMap::new();
                map.insert("-name".to_string(), "".to_string()); // fd uses direct pattern
                map.insert("-iname".to_string(), "-i".to_string());
                map
            },
            priority: 10,
            use_fallback: true,
        });
        
        // cat → bat
        replacements.insert("cat".to_string(), ReplacementConfig {
            enabled: true,
            replacement: "bat".to_string(),
            preserve_flags: vec![
                "-n".to_string(),
                "--number".to_string(),
            ],
            flag_mappings: {
                let mut map = HashMap::new();
                map.insert("-n".to_string(), "--number".to_string());
                map
            },
            priority: 5, // Lower priority, bat changes output format
            use_fallback: true,
        });
        
        // ls → eza/exa
        replacements.insert("ls".to_string(), ReplacementConfig {
            enabled: true,
            replacement: "eza".to_string(), // Try eza first, fallback to exa
            preserve_flags: vec![
                "-l".to_string(),
                "-a".to_string(),
                "--all".to_string(),
                "-h".to_string(),
                "--human-readable".to_string(),
                "-t".to_string(),
                "--time".to_string(),
                "-r".to_string(),
                "--reverse".to_string(),
            ],
            flag_mappings: HashMap::new(),
            priority: 8,
            use_fallback: true,
        });
        
        // sed → sd
        replacements.insert("sed".to_string(), ReplacementConfig {
            enabled: true,
            replacement: "sd".to_string(),
            preserve_flags: vec![],
            flag_mappings: HashMap::new(),
            priority: 6,
            use_fallback: true,
        });
        
        // ps → procs
        replacements.insert("ps".to_string(), ReplacementConfig {
            enabled: true,
            replacement: "procs".to_string(),
            preserve_flags: vec![
                "-a".to_string(),
                "-u".to_string(),
                "-x".to_string(),
                "-f".to_string(),
            ],
            flag_mappings: HashMap::new(),
            priority: 7,
            use_fallback: true,
        });
        
        Self {
            tools: HashMap::new(),
            replacements,
            settings: GlobalSettings::default(),
        }
    }
}

impl Default for GlobalSettings {
    fn default() -> Self {
        Self {
            debug: false,
            tool_check_timeout: 1000,
            cache_tool_checks: true,
            compatibility_mode: None, // Auto-detect based on context
            semantic_analysis: true,
            fallback_patterns: vec![
                // Patterns that commonly require exact grep behavior
                r"grep.*-P".to_string(),      // Perl regex
                r"grep.*--null-data".to_string(), // Binary data handling
                r"find.*-exec".to_string(),   // Find with exec actions
                r"find.*-size".to_string(),   // Size-based find
                r"find.*-perm".to_string(),   // Permission-based find
            ],
        }
    }
}

impl Config {
    /// Load configuration from file, or return default if not found
    pub fn load() -> Result<Self> {
        let config_path = Self::config_path();
        
        if config_path.exists() {
            let content = std::fs::read_to_string(&config_path)
                .context("Failed to read config file")?;
            
            let config: Config = toml::from_str(&content)
                .context("Failed to parse config file")?;
            
            Ok(config)
        } else {
            // Create default config file
            let default_config = Self::default();
            default_config.save()?;
            Ok(default_config)
        }
    }
    
    /// Save configuration to file
    pub fn save(&self) -> Result<()> {
        let config_path = Self::config_path();
        
        // Ensure parent directory exists
        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent)
                .context("Failed to create config directory")?;
        }
        
        let content = toml::to_string_pretty(self)
            .context("Failed to serialize config")?;
        
        std::fs::write(&config_path, content)
            .context("Failed to write config file")?;
        
        Ok(())
    }
    
    /// Get the configuration file path
    fn config_path() -> PathBuf {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".claude")
            .join("hooks")
            .join("command-replacer")
            .join("config.toml")
    }
}

fn default_true() -> bool {
    true
}

fn default_priority() -> u8 {
    5
}

fn default_timeout() -> u64 {
    1000
}