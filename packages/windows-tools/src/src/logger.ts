import { promises as fs } from "node:fs";
import * as path from "node:path";
import {
  createDuration,
  createTimestamp,
  type LogEntry,
  type LogLevel,
  type PerformanceMetrics,
} from "./types.js";

// Optimized log buffer for batching writes (performance improvement)
interface LogBuffer {
  entries: LogEntry[];
  size: number;
  lastFlush: number;
}

// Configuration constants for performance tuning
const LOGGER_CONFIG = Object.freeze({
  BUFFER_SIZE: 100, // Batch writes for better I/O performance
  FLUSH_INTERVAL: 5000, // 5 seconds
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB before rotation
  MAX_LOG_FILES: 5, // Keep 5 rotated files
  CORRELATION_ID_LENGTH: 8,
} as const);

// Singleton logger with advanced features and performance optimizations
export class Logger {
  private static instance: Logger | undefined;
  private readonly logPath: string;
  private readonly logBuffer: LogBuffer;
  private flushTimer: NodeJS.Timeout | null = null;
  private correlationCounter = 0;
  private initializePromise: Promise<void> | null = null;
  private readonly performanceMetrics: PerformanceMetrics;

  private constructor() {
    this.logPath = path.join(process.env.USERPROFILE || "", ".claude", "logs", "claude_tools.log");
    this.logBuffer = {
      entries: [],
      size: 0,
      lastFlush: Date.now(),
    };

    this.performanceMetrics = {
      commandsExecuted: 0,
      totalDuration: createDuration(0),
      averageDuration: createDuration(0),
      successRate: 1.0,
      memoryUsage: process.memoryUsage(),
      lastReset: createTimestamp(),
    };

    // Initialize asynchronously to avoid blocking constructor
    this.initializePromise = this.initializeAsync();
    this.setupFlushTimer();
    this.setupProcessHandlers();
  }

  /**
   * Optimized singleton with lazy initialization
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Async initialization for better startup performance
   */
  private async initializeAsync(): Promise<void> {
    try {
      await this.ensureLogDirectory();
      await this.rotateLogIfNeeded();
    } catch (error) {
      console.error("Logger initialization failed:", error);
      // Continue with degraded logging (console only)
    }
  }

  private async ensureLogDirectory(): Promise<void> {
    const logDir = path.dirname(this.logPath);
    try {
      await fs.mkdir(logDir, { recursive: true });
    } catch (err) {
      console.error("Failed to create log directory:", err);
      throw err;
    }
  }

  /**
   * High-performance async logging with buffering
   */
  async log(
    level: LogLevel,
    message: string,
    data?: Readonly<Record<string, unknown>>,
    component?: string
  ): Promise<void> {
    // Ensure logger is initialized
    if (this.initializePromise) {
      await this.initializePromise;
      this.initializePromise = null;
    }

    const entry: LogEntry = {
      timestamp: createTimestamp(),
      level,
      message,
      data,
      correlationId: this.generateCorrelationId(),
      component,
    };

    // Add to buffer for batched writes
    this.logBuffer.entries.push(entry);
    this.logBuffer.size += this.estimateEntrySize(entry);

    // Flush if buffer is full or on ERROR level
    if (this.logBuffer.size >= LOGGER_CONFIG.BUFFER_SIZE || level === "ERROR") {
      await this.flush();
    }
  }

  /**
   * Optimized convenience methods with performance tracking
   */
  async info(
    message: string,
    data?: Readonly<Record<string, unknown>>,
    component?: string
  ): Promise<void> {
    return this.log("INFO", message, data, component);
  }

  async warn(
    message: string,
    data?: Readonly<Record<string, unknown>>,
    component?: string
  ): Promise<void> {
    return this.log("WARN", message, data, component);
  }

  async error(
    message: string,
    data?: Readonly<Record<string, unknown>>,
    component?: string
  ): Promise<void> {
    return this.log("ERROR", message, data, component);
  }

  async debug(
    message: string,
    data?: Readonly<Record<string, unknown>>,
    component?: string
  ): Promise<void> {
    if (process.env.NODE_ENV === "development" || process.env.DEBUG) {
      return this.log("DEBUG", message, data, component);
    }
    // Skip debug logs in production for performance
  }

  /**
   * Performance-optimized log entry creation with structured data
   */
  async logCommandExecution(
    command: string,
    duration: number,
    success: boolean,
    additional?: Readonly<Record<string, unknown>>
  ): Promise<void> {
    // Update performance metrics
    this.performanceMetrics.commandsExecuted++;
    this.performanceMetrics.totalDuration = createDuration(
      this.performanceMetrics.totalDuration + duration
    );
    this.performanceMetrics.averageDuration = createDuration(
      this.performanceMetrics.totalDuration / this.performanceMetrics.commandsExecuted
    );

    const successCount = success ? 1 : 0;
    this.performanceMetrics.successRate =
      (this.performanceMetrics.successRate * (this.performanceMetrics.commandsExecuted - 1) +
        successCount) /
      this.performanceMetrics.commandsExecuted;

    await this.log(
      success ? "INFO" : "ERROR",
      `Command ${success ? "completed" : "failed"}`,
      {
        command,
        duration,
        success,
        ...additional,
      },
      "CommandExecutor"
    );
  }

  /**
   * High-performance batch flush with error handling
   */
  private async flush(): Promise<void> {
    if (this.logBuffer.entries.length === 0) {
      return;
    }

    try {
      const entries = [...this.logBuffer.entries];
      this.logBuffer.entries = [];
      this.logBuffer.size = 0;
      this.logBuffer.lastFlush = Date.now();

      const logLines = entries.map((entry) => this.formatLogEntry(entry)).join("");
      await fs.appendFile(this.logPath, logLines, "utf8");

      // Check if log rotation is needed
      await this.rotateLogIfNeeded();
    } catch (error) {
      console.error("Failed to flush log buffer:", error);
      // Restore entries to buffer on error
      this.logBuffer.entries.unshift(...this.logBuffer.entries);
    }
  }

  /**
   * Optimized log entry formatting
   */
  private formatLogEntry(entry: LogEntry): string {
    const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : "";
    const componentStr = entry.component ? ` [${entry.component}]` : "";
    const correlationStr = entry.correlationId ? ` (${entry.correlationId})` : "";

    return `${entry.timestamp} [${entry.level}]${componentStr}${correlationStr} ${entry.message}${dataStr}\n`;
  }

  /**
   * Estimate memory footprint of log entry for buffer management
   */
  private estimateEntrySize(entry: LogEntry): number {
    return entry.message.length + (entry.data ? JSON.stringify(entry.data).length : 0) + 100; // Base overhead
  }

  /**
   * Generate correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    return (++this.correlationCounter)
      .toString(36)
      .padStart(LOGGER_CONFIG.CORRELATION_ID_LENGTH, "0");
  }

  /**
   * Log rotation for managing file sizes
   */
  private async rotateLogIfNeeded(): Promise<void> {
    try {
      const stats = await fs.stat(this.logPath).catch(() => null);
      if (!stats || stats.size < LOGGER_CONFIG.MAX_FILE_SIZE) {
        return;
      }

      // Rotate logs
      for (let i = LOGGER_CONFIG.MAX_LOG_FILES - 1; i > 0; i--) {
        const oldPath = `${this.logPath}.${i}`;
        const newPath = `${this.logPath}.${i + 1}`;

        try {
          await fs.rename(oldPath, newPath);
        } catch {
          // File doesn't exist, continue
        }
      }

      await fs.rename(this.logPath, `${this.logPath}.1`);
    } catch (error) {
      console.error("Log rotation failed:", error);
    }
  }

  /**
   * Setup automatic buffer flushing
   */
  private setupFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      if (Date.now() - this.logBuffer.lastFlush > LOGGER_CONFIG.FLUSH_INTERVAL) {
        await this.flush();
      }
    }, LOGGER_CONFIG.FLUSH_INTERVAL);
  }

  /**
   * Setup process handlers for graceful shutdown
   */
  private setupProcessHandlers(): void {
    const cleanup = async () => {
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
      }
      await this.flush();
    };

    process.on("exit", () => {
      cleanup().catch(console.error);
    });
    process.on("SIGINT", () => {
      cleanup().then(() => process.exit(0));
    });
    process.on("SIGTERM", () => {
      cleanup().then(() => process.exit(0));
    });
  }

  /**
   * Get performance metrics for monitoring
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return {
      ...this.performanceMetrics,
      memoryUsage: process.memoryUsage(),
    };
  }

  /**
   * Reset performance metrics
   */
  resetPerformanceMetrics(): void {
    this.performanceMetrics.commandsExecuted = 0;
    this.performanceMetrics.totalDuration = createDuration(0);
    this.performanceMetrics.averageDuration = createDuration(0);
    this.performanceMetrics.successRate = 1.0;
    this.performanceMetrics.lastReset = createTimestamp();
  }

  /**
   * Force flush buffer (for testing or immediate writes)
   */
  async forceFlush(): Promise<void> {
    await this.flush();
  }

  /**
   * Get logger statistics
   */
  getStats(): {
    bufferSize: number;
    bufferEntries: number;
    logPath: string;
    lastFlush: number;
  } {
    return {
      bufferSize: this.logBuffer.size,
      bufferEntries: this.logBuffer.entries.length,
      logPath: this.logPath,
      lastFlush: this.logBuffer.lastFlush,
    };
  }

  /**
   * Dispose resources for cleanup
   */
  dispose(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush (synchronous for cleanup)
    this.flush().catch(console.error);
    Logger.instance = undefined;
  }
}
