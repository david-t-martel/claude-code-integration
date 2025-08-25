#!/usr/bin/env node
/**
 * Windows-Optimized Claude Tools Command Runner
 * Handles Windows-specific command syntax issues and provides better tool integration
 */

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import * as path from "node:path";

interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  command: string;
  duration: number;
}

class WindowsClaudeTools {
  private logPath: string;

  constructor() {
    this.logPath = path.join(process.env.USERPROFILE || "", ".claude", "logs", "claude_tools.log");
    this.ensureLogDirectory();
  }

  private async ensureLogDirectory() {
    const logDir = path.dirname(this.logPath);
    try {
      await fs.mkdir(logDir, { recursive: true });
    } catch (err) {
      console.error("Failed to create log directory:", err);
    }
  }

  /**
   * Fix common Windows command syntax issues
   */
  private fixWindowsCommand(command: string): string {
    // Fix && to proper Windows syntax
    if (command.includes(" && ")) {
      command = command.replace(/ && /g, " ; ");
    }

    // Fix Unix-style path separators in Windows contexts
    if (process.platform === "win32") {
      // Only fix paths that aren't WSL paths
      if (!command.includes("/mnt/") && !command.includes("wsl ")) {
        command = command.replace(/\/([a-zA-Z])\//g, "$1:\\");
      }
    }

    // Fix PowerShell execution for cross-platform compatibility
    if (command.startsWith("pwsh ") && !command.includes("-Command")) {
      command = command.replace("pwsh ", '"C:\\Program Files\\PowerShell\\7\\pwsh.exe" -Command ');
    }

    return command;
  }

  /**
   * Determine the best shell for command execution
   */
  private getOptimalShell(command: string): { shell: string; args: string[] } {
    // WSL commands - handle differently
    if (command.startsWith("wsl ")) {
      return {
        shell: "wsl.exe",
        args: [command.substring(4)], // Remove 'wsl ' prefix and pass rest as single argument
      };
    }

    // Git commands
    if (command.startsWith("git ")) {
      return {
        shell: "cmd.exe",
        args: ["/c", command],
      };
    }

    // npm/node commands
    if (command.startsWith("npm ") || command.startsWith("npx ") || command.startsWith("node ")) {
      return {
        shell: "cmd.exe",
        args: ["/c", command],
      };
    }

    // PowerShell commands (check for PowerShell-specific syntax)
    if (
      command.includes("Get-") ||
      command.includes("Set-") ||
      command.includes("$PSVersionTable")
    ) {
      return {
        shell: "powershell.exe",
        args: ["-NoProfile", "-Command", command],
      };
    }

    // Default to cmd for maximum compatibility
    return {
      shell: "cmd.exe",
      args: ["/c", command],
    };
  }

  /**
   * Execute command with Windows optimizations
   */
  async executeCommand(
    originalCommand: string,
    options: {
      timeout?: number;
      cwd?: string;
      env?: Record<string, string>;
      description?: string;
    } = {}
  ): Promise<CommandResult> {
    const startTime = Date.now();
    const fixedCommand = this.fixWindowsCommand(originalCommand);
    const { shell, args } = this.getOptimalShell(fixedCommand);

    const logEntry = {
      timestamp: new Date().toISOString(),
      original: originalCommand,
      fixed: fixedCommand,
      shell,
      args,
      description: options.description || "No description",
    };

    await this.log("COMMAND_START", logEntry);

    return new Promise((resolve) => {
      const childProcess = spawn(shell, args, {
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env },
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";

      childProcess.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      childProcess.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      const timeout = options.timeout || 120000; // 2 minutes default
      const timeoutHandle = setTimeout(() => {
        childProcess.kill();
        resolve({
          success: false,
          stdout,
          stderr: `${stderr}\nCommand timed out`,
          exitCode: -1,
          command: fixedCommand,
          duration: Date.now() - startTime,
        });
      }, timeout);

      childProcess.on("close", async (code: number | null) => {
        clearTimeout(timeoutHandle);
        const result: CommandResult = {
          success: code === 0,
          stdout,
          stderr,
          exitCode: code || 0,
          command: fixedCommand,
          duration: Date.now() - startTime,
        };

        await this.log("COMMAND_END", { ...logEntry, result });
        resolve(result);
      });
    });
  }

  /**
   * Execute PowerShell command with proper encoding and error handling
   */
  async executePowerShell(
    command: string,
    options: {
      timeout?: number;
      cwd?: string;
      noProfile?: boolean;
    } = {}
  ): Promise<CommandResult> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const shell = options.noProfile ? "powershell.exe" : "powershell.exe";
      const args = options.noProfile ? ["-NoProfile", "-Command", command] : ["-Command", command];

      const childProcess = spawn(shell, args, {
        cwd: options.cwd || process.cwd(),
        env: process.env,
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";

      childProcess.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      childProcess.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      childProcess.on("close", (code: number | null) => {
        resolve({
          success: code === 0,
          stdout,
          stderr,
          exitCode: code || 0,
          command,
          duration: Date.now() - startTime,
        });
      });
    });
  }

  /**
   * Execute WSL command with proper path handling
   */
  async executeWSL(
    command: string,
    options: {
      timeout?: number;
      distribution?: string;
    } = {}
  ): Promise<CommandResult> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const shell = "wsl.exe";
      const args = options.distribution
        ? ["-d", options.distribution, "--", "bash", "-c", command]
        : ["--", "bash", "-c", command];

      const childProcess = spawn(shell, args, {
        cwd: process.cwd(),
        env: process.env,
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";

      childProcess.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      childProcess.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      childProcess.on("close", (code: number | null) => {
        resolve({
          success: code === 0,
          stdout,
          stderr,
          exitCode: code || 0,
          command,
          duration: Date.now() - startTime,
        });
      });
    });
  }

  /**
   * Test Google Cloud authentication across platforms
   */
  async testGCPAuth(): Promise<{
    windows: CommandResult;
    wsl: CommandResult;
    summary: string;
  }> {
    const windowsTest = await this.executePowerShell('gcloud auth list --format="value(account)"', {
      noProfile: true,
    });

    const wslTest = await this.executeWSL('gcloud auth list --format="value(account)"');

    const summary = `
Windows GCP Auth: ${windowsTest.success ? "SUCCESS" : "FAILED"}
WSL GCP Auth: ${wslTest.success ? "SUCCESS" : "FAILED"}
Windows Account: ${windowsTest.stdout.trim() || "None"}
WSL Account: ${wslTest.stdout.trim() || "None"}
    `.trim();

    return { windows: windowsTest, wsl: wslTest, summary };
  }

  /**
   * Get system environment info for debugging
   */
  async getSystemInfo(): Promise<Record<string, any>> {
    const pwshVersion = await this.executePowerShell("$PSVersionTable.PSVersion", {
      noProfile: true,
    });
    const wslVersion = await this.executeWSL("lsb_release -d");
    const nodeVersion = await this.executeCommand("node --version");

    return {
      powershell: pwshVersion.stdout.trim(),
      wsl: wslVersion.stdout.trim(),
      node: nodeVersion.stdout.trim(),
      platform: process.platform,
      arch: process.arch,
      userProfile: process.env.USERPROFILE,
      path: process.env.PATH?.split(";").slice(0, 5), // First 5 PATH entries
    };
  }

  private async log(level: string, data: any) {
    try {
      const logLine = `${new Date().toISOString()} [${level}] ${JSON.stringify(data)}\n`;
      await fs.appendFile(this.logPath, logLine);
    } catch (err) {
      console.error("Failed to write log:", err);
    }
  }
}

// CLI Interface
async function main() {
  const tools = new WindowsClaudeTools();
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Windows Claude Tools - Command Runner");
    console.log("Usage:");
    console.log("  npx ts-node claude_tools.ts exec <command>     - Execute command with fixes");
    console.log("  npx ts-node claude_tools.ts pwsh <command>     - Execute PowerShell command");
    console.log("  npx ts-node claude_tools.ts wsl <command>      - Execute WSL command");
    console.log("  npx ts-node claude_tools.ts test-gcp          - Test GCP authentication");
    console.log("  npx ts-node claude_tools.ts sysinfo           - Show system information");
    return;
  }

  const command = args[0];
  const commandArgs = args.slice(1).join(" ");

  try {
    switch (command) {
      case "exec": {
        const result = await tools.executeCommand(commandArgs);
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case "pwsh": {
        const result = await tools.executePowerShell(commandArgs);
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case "wsl": {
        const result = await tools.executeWSL(commandArgs);
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case "test-gcp": {
        const result = await tools.testGCPAuth();
        console.log(result.summary);
        console.log("\nDetailed Results:");
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case "sysinfo": {
        const info = await tools.getSystemInfo();
        console.log(JSON.stringify(info, null, 2));
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { WindowsClaudeTools };
