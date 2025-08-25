// Branded types for type safety and performance
type Brand<T, B> = T & { readonly __brand: B };

// Performance-optimized branded types
export type CommandString = Brand<string, "Command">;
export type ShellPath = Brand<string, "ShellPath">;
export type ExitCode = Brand<number, "ExitCode">;
export type Duration = Brand<number, "Duration">;
export type Timestamp = Brand<string, "Timestamp">;

// Template literal types for shell detection
export type PowerShellIndicator =
  | `Get-${string}`
  | `Set-${string}`
  | `New-${string}`
  | `Remove-${string}`
  | "$PSVersionTable"
  | "Import-Module";
export type NodeCommand =
  | `npm ${string}`
  | `npx ${string}`
  | `node ${string}`
  | `yarn ${string}`
  | `pnpm ${string}`;
export type WSLCommand = `wsl ${string}` | `/mnt/${string}` | `\\wsl${string}`;

// Strict log levels with const assertion
export const LOG_LEVELS = ["INFO", "WARN", "ERROR", "DEBUG"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

// Optimized result types with discriminated unions
export interface SuccessResult {
  readonly success: true;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: ExitCode;
  readonly command: CommandString;
  readonly duration: Duration;
  readonly timestamp: Timestamp;
}

export interface FailureResult {
  readonly success: false;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: ExitCode;
  readonly command: CommandString;
  readonly duration: Duration;
  readonly timestamp: Timestamp;
  readonly error?: CommandExecutionError | undefined;
}

export type CommandResult = SuccessResult | FailureResult;

// Enhanced execution options with practical typing
export interface ExecutionOptions {
  readonly timeout?: number; // Timeout in milliseconds (1s to 1h recommended)
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly description?: string;
  readonly shell?: ShellType;
  readonly priority?: ProcessPriority;
  readonly encoding?: BufferEncoding;
}

// Performance-optimized shell configuration
export interface ShellConfig {
  readonly shell: ShellPath;
  readonly args: readonly string[];
  readonly type: ShellType;
}

// Enhanced log entry with structured data
export interface LogEntry {
  readonly timestamp: Timestamp;
  readonly level: LogLevel;
  readonly message: string;
  readonly data?: Readonly<Record<string, unknown>> | undefined;
  readonly correlationId?: string | undefined;
  readonly component?: string | undefined;
}

// Shell type enumeration for better type safety
export const SHELL_TYPES = ["cmd", "powershell", "wsl", "bash", "pwsh"] as const;
export type ShellType = (typeof SHELL_TYPES)[number];

// Process priority for performance tuning
export const PROCESS_PRIORITIES = ["low", "normal", "high"] as const;
export type ProcessPriority = (typeof PROCESS_PRIORITIES)[number];

// Comprehensive error types for better error handling
export abstract class CommandExecutionError extends Error {
  abstract readonly code: string;
  abstract readonly category: ErrorCategory;

  constructor(
    message: string,
    public readonly command: CommandString,
    public readonly timestamp: Timestamp = new Date().toISOString() as Timestamp
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class TimeoutError extends CommandExecutionError {
  readonly code = "TIMEOUT" as const;
  readonly category = "EXECUTION" as const;

  constructor(command: CommandString, timeoutMs: number) {
    super(`Command timed out after ${timeoutMs}ms`, command);
  }
}

export class ProcessSpawnError extends CommandExecutionError {
  readonly code = "SPAWN_FAILED" as const;
  readonly category = "SYSTEM" as const;

  constructor(command: CommandString, cause: Error) {
    super(`Failed to spawn process: ${cause.message}`, command);
    this.cause = cause;
  }
}

export class InvalidCommandError extends CommandExecutionError {
  readonly code = "INVALID_COMMAND" as const;
  readonly category = "VALIDATION" as const;
}

export class ShellNotFoundError extends CommandExecutionError {
  readonly code = "SHELL_NOT_FOUND" as const;
  readonly category = "SYSTEM" as const;
}

export const ERROR_CATEGORIES = ["EXECUTION", "SYSTEM", "VALIDATION", "NETWORK", "AUTH"] as const;
export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

// Type guards for better type narrowing and performance
export const isSuccessResult = (result: CommandResult): result is SuccessResult => result.success;
export const isFailureResult = (result: CommandResult): result is FailureResult => !result.success;
export const isTimeoutError = (error: unknown): error is TimeoutError =>
  error instanceof TimeoutError;
export const isProcessSpawnError = (error: unknown): error is ProcessSpawnError =>
  error instanceof ProcessSpawnError;

// Utility type for creating branded values (performance optimization)
export const createBrandedValue = <T, B>(value: T): Brand<T, B> => value as Brand<T, B>;

// Type-safe factory functions
export const createCommandString = (command: string): CommandString =>
  createBrandedValue<string, "Command">(command);
export const createShellPath = (path: string): ShellPath =>
  createBrandedValue<string, "ShellPath">(path);
export const createExitCode = (code: number): ExitCode =>
  createBrandedValue<number, "ExitCode">(code);
export const createDuration = (ms: number): Duration => createBrandedValue<number, "Duration">(ms);
export const createTimestamp = (): Timestamp =>
  createBrandedValue<string, "Timestamp">(new Date().toISOString());

// Performance monitoring types (mutable for internal updates)
export interface PerformanceMetrics {
  commandsExecuted: number;
  totalDuration: Duration;
  averageDuration: Duration;
  successRate: number;
  memoryUsage: NodeJS.MemoryUsage;
  lastReset: Timestamp;
}

// Resource management for memory optimization
export interface ResourceManager {
  readonly acquire: () => Promise<void>;
  readonly release: () => void;
  readonly isAcquired: boolean;
}
