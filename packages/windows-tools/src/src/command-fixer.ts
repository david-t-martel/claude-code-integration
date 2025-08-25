import { type CommandString, createCommandString } from "./types.js";

// Performance-optimized regex patterns (compiled once)
const COMMAND_PATTERNS = Object.freeze({
  UNIX_OPERATOR: / && /g,
  WINDOWS_OPERATOR: " ; ",
  WSL_PATH: /(\/mnt\/|wsl |\\\\wsl)/,
  UNIX_PATH: /\/([a-zA-Z])\//g,
  WINDOWS_PATH: "$1:\\\\",
  PWSH_PREFIX: /^pwsh /,
  PWSH_COMMAND_FLAG: /-Command/,
  POWERSHELL_REPLACEMENT: "powershell.exe -NoProfile -Command ",
} as const);

// Memoization cache for performance (WeakMap for automatic garbage collection)
const commandFixCache = new WeakMap<object, string>();
const pathCheckCache = new Map<string, boolean>();

// Type-safe command fixing with advanced patterns
export class CommandFixer {
  // Static readonly for performance
  private static readonly PLATFORM_WIN32 = process.platform === "win32";

  /**
   * Fix common Windows command syntax issues with optimized performance
   * Uses memoization and pre-compiled regex patterns
   */
  static fix(command: string): CommandString {
    // Input validation with early return
    if (!command || typeof command !== "string") {
      return createCommandString(command || "");
    }

    // Check memoization cache (using command as key for weak reference)
    const cacheKey = { command };
    const cachedResult = commandFixCache.get(cacheKey);
    if (cachedResult !== undefined) {
      return createCommandString(cachedResult);
    }

    // Apply fixes in order of performance impact (most common first)
    let fixedCommand = command;

    // 1. Fix Unix operators (most common fix)
    if (fixedCommand.includes(" && ")) {
      fixedCommand = fixedCommand.replace(
        COMMAND_PATTERNS.UNIX_OPERATOR,
        COMMAND_PATTERNS.WINDOWS_OPERATOR
      );
    }

    // 2. Platform-specific path fixes (only on Windows)
    if (CommandFixer.PLATFORM_WIN32) {
      if (!CommandFixer.isWslPath(fixedCommand)) {
        fixedCommand = CommandFixer.fixWindowsPaths(fixedCommand);
      }
    }

    // 3. PowerShell execution fixes
    if (
      fixedCommand.startsWith("pwsh ") &&
      !COMMAND_PATTERNS.PWSH_COMMAND_FLAG.test(fixedCommand)
    ) {
      fixedCommand = fixedCommand.replace(
        COMMAND_PATTERNS.PWSH_PREFIX,
        COMMAND_PATTERNS.POWERSHELL_REPLACEMENT
      );
    }

    // Cache the result for future use
    commandFixCache.set(cacheKey, fixedCommand);

    return createCommandString(fixedCommand);
  }

  /**
   * Check if command contains WSL paths with caching for performance
   */
  private static isWslPath(command: string): boolean {
    // Check cache first
    if (pathCheckCache.has(command)) {
      return pathCheckCache.get(command)!;
    }

    const isWSL = COMMAND_PATTERNS.WSL_PATH.test(command);

    // Cache result with size limit to prevent memory leaks
    if (pathCheckCache.size > 1000) {
      pathCheckCache.clear();
    }
    pathCheckCache.set(command, isWSL);

    return isWSL;
  }

  /**
   * Fix Unix-style paths to Windows paths with validation
   */
  private static fixWindowsPaths(command: string): string {
    // Only apply if we detect Unix-style paths
    if (!command.includes("/")) {
      return command;
    }

    return command.replace(COMMAND_PATTERNS.UNIX_PATH, COMMAND_PATTERNS.WINDOWS_PATH);
  }

  /**
   * Advanced command validation with type predicate
   */
  static isValidCommand(command: unknown): command is CommandString {
    return (
      typeof command === "string" &&
      command.length > 0 &&
      command.trim().length > 0 &&
      !command.includes("\x00")
    ); // Null byte check for security
  }

  /**
   * Type-safe command normalization
   */
  static normalize(command: string): CommandString {
    const normalized = command.trim().replace(/\s+/g, " ");
    return CommandFixer.fix(normalized);
  }

  /**
   * Clear caches for memory management
   */
  static clearCache(): void {
    pathCheckCache.clear();
    // WeakMap cache clears automatically when objects are garbage collected
  }

  /**
   * Get cache statistics for monitoring
   */
  static getCacheStats(): { pathCacheSize: number } {
    return {
      pathCacheSize: pathCheckCache.size,
    };
  }
}
