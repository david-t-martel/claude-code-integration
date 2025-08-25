import { spawn } from "node:child_process";
import {
  type CommandResult,
  createCommandString,
  createDuration,
  createExitCode,
  createTimestamp,
} from "./types.js";

export class PowerShellExecutor {
  async execute(
    command: string,
    options: {
      timeout?: number;
      cwd?: string;
      noProfile?: boolean;
    } = {}
  ): Promise<CommandResult> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const args = options.noProfile ? ["-NoProfile", "-Command", command] : ["-Command", command];

      const childProcess = spawn("powershell.exe", args, {
        cwd: options.cwd || process.cwd(),
        env: process.env,
        windowsHide: true,
      });

      this.handleProcessExecution(childProcess, command, startTime, resolve, options.timeout);
    });
  }

  private handleProcessExecution(
    childProcess: any,
    command: string,
    startTime: number,
    resolve: (result: CommandResult) => void,
    timeout?: number
  ): void {
    let stdout = "";
    let stderr = "";

    childProcess.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    childProcess.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    const timeoutHandle = timeout
      ? setTimeout(() => {
          childProcess.kill();
          resolve(this.buildTimeoutResult(stdout, stderr, command, startTime));
        }, timeout)
      : null;

    childProcess.on("close", (code: number | null) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      resolve(this.buildResult(code === 0, stdout, stderr, code || 0, command, startTime));
    });

    childProcess.on("error", (error: Error) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      resolve(this.buildResult(false, stdout, error.message, -1, command, startTime));
    });
  }

  private buildResult(
    success: boolean,
    stdout: string,
    stderr: string,
    exitCode: number,
    command: string,
    startTime: number
  ): CommandResult {
    return {
      success,
      stdout,
      stderr,
      exitCode: createExitCode(exitCode),
      command: createCommandString(command),
      duration: createDuration(Date.now() - startTime),
      timestamp: createTimestamp(),
    };
  }

  private buildTimeoutResult(
    stdout: string,
    stderr: string,
    command: string,
    startTime: number
  ): CommandResult {
    return this.buildResult(
      false,
      stdout,
      `${stderr}\nPowerShell command timed out`,
      -1,
      command,
      startTime
    );
  }
}

export class WSLExecutor {
  async execute(
    command: string,
    options: {
      timeout?: number;
      distribution?: string;
    } = {}
  ): Promise<CommandResult> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const args = options.distribution
        ? ["-d", options.distribution, "--", "bash", "-c", command]
        : ["--", "bash", "-c", command];

      const childProcess = spawn("wsl.exe", args, {
        cwd: process.cwd(),
        env: process.env,
        windowsHide: true,
      });

      this.handleProcessExecution(childProcess, command, startTime, resolve, options.timeout);
    });
  }

  private handleProcessExecution(
    childProcess: any,
    command: string,
    startTime: number,
    resolve: (result: CommandResult) => void,
    timeout?: number
  ): void {
    let stdout = "";
    let stderr = "";

    childProcess.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    childProcess.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    const timeoutHandle = timeout
      ? setTimeout(() => {
          childProcess.kill();
          resolve(this.buildTimeoutResult(stdout, stderr, command, startTime));
        }, timeout)
      : null;

    childProcess.on("close", (code: number | null) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      resolve(this.buildResult(code === 0, stdout, stderr, code || 0, command, startTime));
    });

    childProcess.on("error", (error: Error) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      resolve(this.buildResult(false, stdout, error.message, -1, command, startTime));
    });
  }

  private buildResult(
    success: boolean,
    stdout: string,
    stderr: string,
    exitCode: number,
    command: string,
    startTime: number
  ): CommandResult {
    return {
      success,
      stdout,
      stderr,
      exitCode: createExitCode(exitCode),
      command: createCommandString(command),
      duration: createDuration(Date.now() - startTime),
      timestamp: createTimestamp(),
    };
  }

  private buildTimeoutResult(
    stdout: string,
    stderr: string,
    command: string,
    startTime: number
  ): CommandResult {
    return this.buildResult(
      false,
      stdout,
      `${stderr}\nWSL command timed out`,
      -1,
      command,
      startTime
    );
  }
}
