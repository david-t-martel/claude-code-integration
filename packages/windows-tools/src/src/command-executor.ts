import { type ChildProcess, type SpawnOptions, spawn } from "node:child_process";
import { CommandFixer } from "./command-fixer.js";
import { Logger } from "./logger.js";
import { ShellResolver } from "./shell-resolver.js";
import {
  type CommandResult,
  type CommandString,
  createCommandString,
  createDuration,
  createExitCode,
  createTimestamp,
  type ExecutionOptions,
  ProcessSpawnError,
  TimeoutError,
} from "./types.js";

// Resource pool for managing concurrent executions
class ProcessPool {
  private activeProcesses = new Set<ChildProcess>();
  private readonly maxConcurrent: number;

  constructor(maxConcurrent = 10) {
    this.maxConcurrent = maxConcurrent;
  }

  canExecute(): boolean {
    return this.activeProcesses.size < this.maxConcurrent;
  }

  add(process: ChildProcess): void {
    this.activeProcesses.add(process);
    process.once("close", () => {
      this.activeProcesses.delete(process);
    });
  }

  killAll(): void {
    for (const process of this.activeProcesses) {
      process.kill("SIGTERM");
    }
    this.activeProcesses.clear();
  }

  getStats(): { active: number; max: number } {
    return {
      active: this.activeProcesses.size,
      max: this.maxConcurrent,
    };
  }
}

export class CommandExecutor {
  private readonly logger: Logger;
  private readonly processPool: ProcessPool;
  private readonly abortController: AbortController;

  constructor(maxConcurrentProcesses = 10) {
    this.logger = Logger.getInstance();
    this.processPool = new ProcessPool(maxConcurrentProcesses);
    this.abortController = new AbortController();
    this.setupCleanup();
  }

  /**
   * High-performance command execution with advanced error handling
   */
  async execute(originalCommand: string, options: ExecutionOptions = {}): Promise<CommandResult> {
    // Validate and normalize input
    if (!originalCommand || typeof originalCommand !== "string") {
      throw new ProcessSpawnError(
        createCommandString(originalCommand || ""),
        new Error("Invalid command provided")
      );
    }

    // Check if we can execute (resource management)
    if (!this.processPool.canExecute()) {
      throw new ProcessSpawnError(
        createCommandString(originalCommand),
        new Error("Too many concurrent processes")
      );
    }

    const startTime = performance.now();
    const fixedCommand = CommandFixer.fix(originalCommand);
    const shellConfig = ShellResolver.resolve(fixedCommand);

    await this.logger.info(
      "Executing command",
      {
        original: originalCommand,
        fixed: fixedCommand,
        shell: shellConfig.shell,
        args: shellConfig.args,
        type: shellConfig.type,
        description: options.description,
      },
      "CommandExecutor"
    );

    try {
      const result = await this.spawnProcess(shellConfig, fixedCommand, startTime, options);

      // Log performance metrics
      await this.logger.logCommandExecution(fixedCommand, result.duration, result.success, {
        exitCode: result.exitCode,
        shell: shellConfig.type,
        stdoutLength: result.stdout.length,
        stderrLength: result.stderr.length,
      });

      return result;
    } catch (error) {
      const duration = createDuration(performance.now() - startTime);

      if (error instanceof TimeoutError || error instanceof ProcessSpawnError) {
        await this.logger.error(
          "Command execution failed",
          {
            command: fixedCommand,
            error: error.message,
            type: error.constructor.name,
            duration,
          },
          "CommandExecutor"
        );

        // Return failure result instead of throwing
        return {
          success: false,
          stdout: "",
          stderr: error.message,
          exitCode: createExitCode(-1),
          command: fixedCommand,
          duration,
          timestamp: createTimestamp(),
          error,
        };
      }

      throw error;
    }
  }

  /**
   * Optimized process spawning with resource management
   */
  private spawnProcess(
    shellConfig: { shell: string; args: readonly string[]; type: string },
    command: CommandString,
    startTime: number,
    options: ExecutionOptions
  ): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      // Prepare spawn options with optimizations
      const spawnOptions: SpawnOptions = {
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env },
        windowsHide: true,
        signal: this.abortController.signal,
        // Performance optimizations
        stdio: ["pipe", "pipe", "pipe"],
        detached: false,
      };

      let childProcess: ChildProcess;

      try {
        childProcess = spawn(shellConfig.shell, [...shellConfig.args], spawnOptions);
        this.processPool.add(childProcess);
      } catch (error) {
        reject(new ProcessSpawnError(command, error as Error));
        return;
      }

      // Optimized data collection with streaming
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let stdoutLength = 0;
      let stderrLength = 0;

      childProcess.stdout?.on("data", (chunk: Buffer) => {
        stdoutChunks.push(chunk);
        stdoutLength += chunk.length;
      });

      childProcess.stderr?.on("data", (chunk: Buffer) => {
        stderrChunks.push(chunk);
        stderrLength += chunk.length;
      });

      // Timeout handling with cleanup
      const timeout = options.timeout ?? 120000; // Default 2 minutes
      const timeoutHandle = setTimeout(() => {
        childProcess.kill("SIGTERM");

        // Force kill after grace period
        setTimeout(() => {
          if (!childProcess.killed) {
            childProcess.kill("SIGKILL");
          }
        }, 5000);

        reject(new TimeoutError(command, timeout));
      }, timeout);

      childProcess.on("close", (code: number | null, signal: NodeJS.Signals | null) => {
        clearTimeout(timeoutHandle);

        // Efficiently concatenate buffers
        const stdout = Buffer.concat(stdoutChunks, stdoutLength).toString("utf8");
        const stderr = Buffer.concat(stderrChunks, stderrLength).toString("utf8");

        const result = this.buildResult(
          code === 0 && signal === null,
          stdout,
          stderr,
          code ?? -1,
          command,
          startTime,
          signal
        );

        resolve(result);
      });

      childProcess.on("error", (error: Error) => {
        clearTimeout(timeoutHandle);
        reject(new ProcessSpawnError(command, error));
      });

      // Handle abort signal
      this.abortController.signal.addEventListener("abort", () => {
        clearTimeout(timeoutHandle);
        childProcess.kill("SIGTERM");
      });
    });
  }

  /**
   * Optimized result building with type safety
   */
  private buildResult(
    success: boolean,
    stdout: string,
    stderr: string,
    exitCode: number,
    command: CommandString,
    startTime: number,
    signal?: NodeJS.Signals | null
  ): CommandResult {
    const duration = createDuration(performance.now() - startTime);
    const timestamp = createTimestamp();

    if (success) {
      return {
        success: true,
        stdout,
        stderr,
        exitCode: createExitCode(exitCode),
        command,
        duration,
        timestamp,
      };
    } else {
      return {
        success: false,
        stdout,
        stderr: signal ? `${stderr}\nProcess terminated with signal: ${signal}` : stderr,
        exitCode: createExitCode(exitCode),
        command,
        duration,
        timestamp,
        // error property is optional in FailureResult
      };
    }
  }

  /**
   * Batch execution for multiple commands with concurrency control
   */
  async executeBatch(
    commands: readonly string[],
    options: ExecutionOptions = {}
  ): Promise<readonly CommandResult[]> {
    const concurrency = Math.min(commands.length, this.processPool.getStats().max);
    const results: CommandResult[] = [];

    // Process commands in batches for memory efficiency
    for (let i = 0; i < commands.length; i += concurrency) {
      const batch = commands.slice(i, i + concurrency);
      const batchPromises = batch.map((cmd) => this.execute(cmd, options));

      try {
        const batchResults = await Promise.allSettled(batchPromises);

        for (const result of batchResults) {
          if (result.status === "fulfilled") {
            results.push(result.value);
          } else {
            // Convert rejected promises to failure results
            results.push({
              success: false,
              stdout: "",
              stderr: result.reason?.message || "Unknown error",
              exitCode: createExitCode(-1),
              command: createCommandString(""),
              duration: createDuration(0),
              timestamp: createTimestamp(),
            });
          }
        }
      } catch (error) {
        await this.logger.error(
          "Batch execution failed",
          {
            batchSize: batch.length,
            error: error instanceof Error ? error.message : "Unknown error",
          },
          "CommandExecutor"
        );
        throw error;
      }
    }

    return Object.freeze(results);
  }

  /**
   * Resource cleanup and process management
   */
  private setupCleanup(): void {
    const cleanup = () => {
      this.abortController.abort();
      this.processPool.killAll();
    };

    process.on("exit", cleanup);
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
    process.on("uncaughtException", cleanup);
  }

  /**
   * Get executor statistics for monitoring
   */
  getStats(): {
    processPool: { active: number; max: number };
    performance: unknown;
  } {
    return {
      processPool: this.processPool.getStats(),
      performance: this.logger.getPerformanceMetrics(),
    };
  }

  /**
   * Dispose resources for cleanup
   */
  dispose(): void {
    this.abortController.abort();
    this.processPool.killAll();
  }
}
