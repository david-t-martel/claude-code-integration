import {
  type CommandString,
  createShellPath,
  type NodeCommand,
  type PowerShellIndicator,
  type ShellConfig,
  type ShellType,
  type WSLCommand,
} from "./types.js";

// Optimized command detection patterns with pre-compiled regex
const DETECTION_PATTERNS = Object.freeze({
  WSL_PREFIX: /^wsl\s+/,
  POWERSHELL_INDICATORS: /(?:Get-|Set-|New-|Remove-|\$PSVersionTable|Import-Module)/,
  GIT_PREFIX: /^git\s+/,
  NODE_COMMANDS: /^(?:npm|npx|node|yarn|pnpm)\s+/,
  DOCKER_PREFIX: /^docker\s+/,
  PYTHON_PREFIX: /^(?:python|python3|py)\s+/,
  UV_PREFIX: /^uv\s+/,
} as const);

// Shell configurations for performance (pre-defined configurations)
const SHELL_CONFIGS = Object.freeze({
  CMD: {
    shell: createShellPath("cmd.exe"),
    args: Object.freeze(["/c"]),
    type: "cmd" as const,
  },
  POWERSHELL: {
    shell: createShellPath("powershell.exe"),
    args: Object.freeze(["-NoProfile", "-Command"]),
    type: "powershell" as const,
  },
  WSL: {
    shell: createShellPath("wsl.exe"),
    args: Object.freeze(["--", "bash", "-c"]),
    type: "wsl" as const,
  },
  PWSH: {
    shell: createShellPath("pwsh.exe"),
    args: Object.freeze(["-NoProfile", "-Command"]),
    type: "pwsh" as const,
  },
} as const);

// Memoization for command resolution (performance optimization)
const resolutionCache = new Map<string, ShellConfig>();
const MAX_CACHE_SIZE = 500;

export class ShellResolver {
  /**
   * Resolve command to appropriate shell configuration with caching
   */
  static resolve(command: CommandString): ShellConfig {
    // Check cache first
    if (resolutionCache.has(command)) {
      return resolutionCache.get(command)!;
    }

    const config = ShellResolver.resolveInternal(command);

    // Cache management with size limit
    if (resolutionCache.size >= MAX_CACHE_SIZE) {
      // Clear oldest entries (simple FIFO)
      const keysToDelete = Array.from(resolutionCache.keys()).slice(0, 100);
      keysToDelete.forEach((key) => resolutionCache.delete(key));
    }

    resolutionCache.set(command, config);
    return config;
  }

  private static resolveInternal(command: CommandString): ShellConfig {
    // WSL commands (highest priority for Linux compatibility)
    if (DETECTION_PATTERNS.WSL_PREFIX.test(command)) {
      return {
        ...SHELL_CONFIGS.WSL,
        args: [...SHELL_CONFIGS.WSL.args, command.substring(4)],
      };
    }

    // PowerShell-specific commands (second priority)
    if (ShellResolver.isPowerShellCommand(command)) {
      return {
        ...SHELL_CONFIGS.POWERSHELL,
        args: [...SHELL_CONFIGS.POWERSHELL.args, command],
      };
    }

    // Git commands (prefer cmd for compatibility)
    if (DETECTION_PATTERNS.GIT_PREFIX.test(command)) {
      return {
        ...SHELL_CONFIGS.CMD,
        args: [...SHELL_CONFIGS.CMD.args, command],
      };
    }

    // Node.js ecosystem commands
    if (ShellResolver.isNodeCommandInternal(command)) {
      return {
        ...SHELL_CONFIGS.CMD,
        args: [...SHELL_CONFIGS.CMD.args, command],
      };
    }

    // Docker commands
    if (DETECTION_PATTERNS.DOCKER_PREFIX.test(command)) {
      return {
        ...SHELL_CONFIGS.CMD,
        args: [...SHELL_CONFIGS.CMD.args, command],
      };
    }

    // Python commands (check for uv prefix first)
    if (DETECTION_PATTERNS.UV_PREFIX.test(command)) {
      return {
        ...SHELL_CONFIGS.WSL, // uv typically runs better in WSL
        args: [...SHELL_CONFIGS.WSL.args, command],
      };
    }

    if (DETECTION_PATTERNS.PYTHON_PREFIX.test(command)) {
      return {
        ...SHELL_CONFIGS.CMD,
        args: [...SHELL_CONFIGS.CMD.args, command],
      };
    }

    // Default to cmd for maximum compatibility
    return {
      ...SHELL_CONFIGS.CMD,
      args: [...SHELL_CONFIGS.CMD.args, command],
    };
  }

  /**
   * Type-safe PowerShell command detection with performance optimization
   */
  private static isPowerShellCommand(command: string): boolean {
    return DETECTION_PATTERNS.POWERSHELL_INDICATORS.test(command);
  }

  /**
   * Type-safe Node.js command detection with performance optimization
   */
  private static isNodeCommandInternal(command: string): boolean {
    return DETECTION_PATTERNS.NODE_COMMANDS.test(command);
  }

  /**
   * Advanced shell detection with type predicates
   */
  static isWSLCommand(command: string): command is WSLCommand {
    return DETECTION_PATTERNS.WSL_PREFIX.test(command);
  }

  static isPowerShellIndicator(command: string): command is PowerShellIndicator {
    return DETECTION_PATTERNS.POWERSHELL_INDICATORS.test(command);
  }

  static isNodeCommand(command: string): command is NodeCommand {
    return DETECTION_PATTERNS.NODE_COMMANDS.test(command);
  }

  /**
   * Get the best shell for a given command type
   */
  static getBestShell(commandType: ShellType): ShellConfig {
    switch (commandType) {
      case "wsl":
        return { ...SHELL_CONFIGS.WSL, args: [...SHELL_CONFIGS.WSL.args] };
      case "powershell":
        return { ...SHELL_CONFIGS.POWERSHELL, args: [...SHELL_CONFIGS.POWERSHELL.args] };
      case "pwsh":
        return { ...SHELL_CONFIGS.PWSH, args: [...SHELL_CONFIGS.PWSH.args] };
      default:
        return { ...SHELL_CONFIGS.CMD, args: [...SHELL_CONFIGS.CMD.args] };
    }
  }

  /**
   * Clear resolution cache for memory management
   */
  static clearCache(): void {
    resolutionCache.clear();
  }

  /**
   * Get cache statistics for monitoring
   */
  static getCacheStats(): { cacheSize: number; maxSize: number } {
    return {
      cacheSize: resolutionCache.size,
      maxSize: MAX_CACHE_SIZE,
    };
  }

  /**
   * Validate shell configuration
   */
  static isValidShellConfig(config: unknown): config is ShellConfig {
    return (
      typeof config === "object" &&
      config !== null &&
      "shell" in config &&
      "args" in config &&
      "type" in config &&
      typeof (config as any).shell === "string" &&
      Array.isArray((config as any).args)
    );
  }
}
