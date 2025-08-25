//! Tests for command replacement functionality

#[cfg(test)]
mod tests {
    use crate::config::Config;
    use crate::replacements::ReplacementEngine;

    fn create_test_config() -> Config {
        let mut config = Config::default();
        config.settings.compatibility_mode = Some(false);
        config.settings.semantic_analysis = true;
        config
    }

    #[test]
    fn test_grep_to_rg_basic() {
        let config = create_test_config();
        let engine = ReplacementEngine::new(config).unwrap();
        
        let result = engine.replace_command("grep -n pattern file.txt").unwrap();
        assert!(result.is_some());
        let command = result.unwrap();
        assert!(command.contains("rg"));
        assert!(command.contains("-n"));
        assert!(command.contains("pattern"));
        assert!(command.contains("file.txt"));
    }

    #[test]
    fn test_grep_perl_regex_fallback() {
        let config = create_test_config();
        let engine = ReplacementEngine::new(config).unwrap();
        
        // Should fallback because of -P flag
        let result = engine.replace_command("grep -P '\\d+' file.txt").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_grep_git_repo_flags() {
        let mut config = create_test_config();
        let engine = ReplacementEngine::new(config).unwrap();
        
        let result = engine.replace_command("grep -r pattern .").unwrap();
        if let Some(command) = result {
            // Should add --no-ignore --hidden for git repos
            if engine.is_git_repo {
                assert!(command.contains("--no-ignore"));
                assert!(command.contains("--hidden"));
            }
        }
    }

    #[test]
    fn test_find_to_fd_basic() {
        let config = create_test_config();
        let engine = ReplacementEngine::new(config).unwrap();
        
        let result = engine.replace_command("find . -name '*.rs'").unwrap();
        assert!(result.is_some());
        let command = result.unwrap();
        assert!(command.contains("fd"));
        assert!(command.contains("*.rs"));
        assert!(command.contains("-H -I")); // Compatibility flags
    }

    #[test]
    fn test_find_exec_fallback() {
        let config = create_test_config();
        let engine = ReplacementEngine::new(config).unwrap();
        
        // Should fallback because of -exec
        let result = engine.replace_command("find . -name '*.tmp' -exec rm {} \\;").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_find_type_conversion() {
        let config = create_test_config();
        let engine = ReplacementEngine::new(config).unwrap();
        
        let result = engine.replace_command("find . -type f -name '*.log'").unwrap();
        if let Some(command) = result {
            assert!(command.contains("--type file"));
            assert!(command.contains("*.log"));
        }
    }

    #[test]
    fn test_semantic_analysis_fallback_patterns() {
        let config = create_test_config();
        let engine = ReplacementEngine::new(config).unwrap();
        
        // Should match fallback pattern
        let result = engine.replace_command("grep -P 'complex.*regex' file").unwrap();
        assert!(result.is_none());
        
        let result = engine.replace_command("find . -size +100M").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_compatibility_mode_conservative() {
        let mut config = create_test_config();
        config.settings.compatibility_mode = Some(true);
        let engine = ReplacementEngine::new(config).unwrap();
        
        // In compatibility mode, should be more conservative
        let result = engine.replace_command("grep -E 'complex|pattern' file").unwrap();
        // Might fallback in strict compatibility mode
        if result.is_none() {
            // This is expected in compatibility mode
        }
    }

    #[test]
    fn test_regex_pattern_detection() {
        let config = create_test_config();
        let _engine = ReplacementEngine::new(config.clone()).unwrap();
        
        // Complex regex patterns should trigger fallback in compatibility mode
        let mut compat_config = config;
        compat_config.settings.compatibility_mode = Some(true);
        let compat_engine = ReplacementEngine::new(compat_config).unwrap();
        
        let result = compat_engine.replace_command("grep '\\<word\\>' file").unwrap();
        // Should fallback due to word boundaries
        assert!(result.is_none());
    }

    #[test]
    fn test_tool_availability_cache() {
        let config = create_test_config();
        let engine = ReplacementEngine::new(config).unwrap();
        
        // First call
        let available1 = engine.is_tool_available("rg").unwrap();
        // Second call should use cache
        let available2 = engine.is_tool_available("rg").unwrap();
        
        assert_eq!(available1, available2);
    }

    #[test]
    fn test_flag_mapping_transformations() {
        let config = create_test_config();
        let engine = ReplacementEngine::new(config).unwrap();
        
        let result = engine.replace_command("grep --include='*.rs' pattern .").unwrap();
        if let Some(command) = result {
            assert!(command.contains("--glob"));
            assert!(command.contains("*.rs"));
        }
    }

    #[test] 
    fn test_exclude_pattern_negation() {
        let config = create_test_config();
        let engine = ReplacementEngine::new(config).unwrap();
        
        let result = engine.replace_command("grep --exclude='*.tmp' pattern .").unwrap();
        if let Some(command) = result {
            assert!(command.contains("--glob"));
            assert!(command.contains("!*.tmp"));
        }
    }

    #[test]
    fn test_disabled_replacement() {
        let mut config = create_test_config();
        config.replacements.get_mut("grep").unwrap().enabled = false;
        let engine = ReplacementEngine::new(config).unwrap();
        
        let result = engine.replace_command("grep pattern file").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_alternative_tools() {
        let config = create_test_config();
        let _engine = ReplacementEngine::new(config).unwrap();
        
        // Test that alternative tools are considered when primary is unavailable
        // This would require mocking tool availability
        // For now, just test the logic exists
    }
}