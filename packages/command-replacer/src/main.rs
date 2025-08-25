//! Command Replacer PreToolUse Hook
//! 
//! A high-performance hook that replaces common commands with faster alternatives:
//! - grep → rg (ripgrep)
//! - find → fd 
//! - cat → bat (if available, fallback to cat)
//! - ls → eza/exa (if available, fallback to ls)
//! - sed → sd (if available, fallback to sed)
//! - ps → procs (if available, fallback to ps)

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::io::{self, Read};
use std::process;

mod config;
mod replacements;
#[cfg(test)]
mod tests;

use config::Config;
use replacements::ReplacementEngine;

/// Hook input format as specified in HOOKS_DOCUMENTATION.md
#[derive(Debug, Deserialize)]
struct HookInput {
    session: Session,
    event: Event,
}

#[derive(Debug, Deserialize)]
struct Session {
    id: String,
    #[serde(rename = "projectDir")]
    project_dir: String,
}

#[derive(Debug, Deserialize)]
struct Event {
    #[serde(rename = "type")]
    event_type: String,
    data: serde_json::Value,
}

/// Hook output format as specified in HOOKS_DOCUMENTATION.md
#[derive(Debug, Serialize)]
struct HookOutput {
    decision: Decision,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    context: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
enum Decision {
    Approve,
    Block,
}

/// Tool data for Bash commands
#[derive(Debug, Deserialize)]
struct BashToolData {
    command: String,
    #[serde(default)]
    description: Option<String>,
}

fn main() {
    if let Err(e) = run() {
        eprintln!("Hook error: {}", e);
        // On error, allow the operation to continue
        let output = HookOutput {
            decision: Decision::Approve,
            message: Some(format!("Command replacer hook error: {}", e)),
            context: None,
        };
        if let Ok(json) = serde_json::to_string(&output) {
            println!("{}", json);
        }
        process::exit(0);
    }
}

fn run() -> Result<()> {
    // Read JSON input from stdin
    let mut input = String::new();
    io::stdin().read_to_string(&mut input)
        .context("Failed to read from stdin")?;

    // Parse input using simd-json for performance
    let hook_input: HookInput = {
        let mut bytes = input.as_bytes().to_vec();
        simd_json::from_slice(&mut bytes)
            .or_else(|_| serde_json::from_str(&input))
            .context("Failed to parse JSON input")?
    };

    // Only process PreToolUse events for Bash commands
    if hook_input.event.event_type != "PreToolUse" {
        return allow_with_passthrough();
    }

    // Extract bash command data
    let tool_data: BashToolData = serde_json::from_value(hook_input.event.data)
        .context("Failed to parse tool data")?;

    // Load configuration
    let config = Config::load().unwrap_or_default();
    
    // Initialize replacement engine
    let engine = ReplacementEngine::new(config)?;

    // Apply command replacements
    match engine.replace_command(&tool_data.command)? {
        Some(new_command) => {
            // Command was replaced, modify the event data
            let output = HookOutput {
                decision: Decision::Approve,
                message: None,
                context: Some(serde_json::json!({
                    "modified_command": new_command,
                    "original_command": tool_data.command
                })),
            };
            
            println!("{}", serde_json::to_string(&output)?);
        }
        None => {
            // No replacement needed, allow as-is
            allow_with_passthrough()?;
        }
    }

    Ok(())
}

fn allow_with_passthrough() -> Result<()> {
    let output = HookOutput {
        decision: Decision::Approve,
        message: None,
        context: None,
    };
    println!("{}", serde_json::to_string(&output)?);
    Ok(())
}