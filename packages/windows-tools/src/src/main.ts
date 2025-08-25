import { CommandExecutor } from "./command-executor.js";
import { PowerShellExecutor, WSLExecutor } from "./specialized-executors.js";
import type { CommandResult } from "./types.js";

export class WindowsClaudeTools {
  private executor: CommandExecutor;
  private powerShell: PowerShellExecutor;
  private wsl: WSLExecutor;

  constructor() {
    this.executor = new CommandExecutor();
    this.powerShell = new PowerShellExecutor();
    this.wsl = new WSLExecutor();
  }

  async executeCommand(
    command: string,
    options: {
      timeout?: number;
      cwd?: string;
      env?: Record<string, string>;
      description?: string;
    } = {}
  ): Promise<CommandResult> {
    return this.executor.execute(command, options);
  }

  async executePowerShell(
    command: string,
    options: {
      timeout?: number;
      cwd?: string;
      noProfile?: boolean;
    } = {}
  ): Promise<CommandResult> {
    return this.powerShell.execute(command, options);
  }

  async executeWSL(
    command: string,
    options: {
      timeout?: number;
      distribution?: string;
    } = {}
  ): Promise<CommandResult> {
    return this.wsl.execute(command, options);
  }

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

  async getSystemInfo(): Promise<Record<string, any>> {
    const [pwshVersion, wslVersion, nodeVersion] = await Promise.all([
      this.executePowerShell("$PSVersionTable.PSVersion.ToString()", { noProfile: true }),
      this.executeWSL('lsb_release -d 2>/dev/null || echo "WSL not available"'),
      this.executeCommand("node --version"),
    ]);

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
}

export * from "./types.js";
