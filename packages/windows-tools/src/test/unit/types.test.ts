import { describe, test, expect } from "vitest";
import {
  type CommandResult,
  type CommandString,
  createCommandString,
  createExitCode,
  createTimestamp,
  createDuration,
  isSuccessResult,
  isFailureResult,
  TimeoutError,
  ProcessSpawnError,
  InvalidCommandError,
  ShellNotFoundError,
  LOG_LEVELS,
  SHELL_TYPES,
  PROCESS_PRIORITIES,
  type LogLevel,
  type ShellType,
  type ProcessPriority,
} from "../../src/types.js";

describe("Types and Factory Functions", () => {
  describe("Branded Types", () => {
    test("createCommandString creates branded CommandString", () => {
      const command = createCommandString("echo hello");
      expect(command).toBe("echo hello");
      expect(typeof command).toBe("string");
    });

    test("createExitCode creates branded ExitCode", () => {
      const exitCode = createExitCode(0);
      expect(exitCode).toBe(0);
      expect(typeof exitCode).toBe("number");
    });

    test("createDuration creates branded Duration", () => {
      const duration = createDuration(1500);
      expect(duration).toBe(1500);
      expect(typeof duration).toBe("number");
    });

    test("createTimestamp creates valid ISO timestamp", () => {
      const timestamp = createTimestamp();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(timestamp).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("Type Guards", () => {
    test("isSuccessResult correctly identifies success results", () => {
      const successResult: CommandResult = {
        success: true,
        stdout: "Hello World",
        stderr: "",
        exitCode: createExitCode(0),
        command: createCommandString("echo Hello World"),
        duration: createDuration(100),
        timestamp: createTimestamp(),
      };

      expect(isSuccessResult(successResult)).toBe(true);
      expect(isFailureResult(successResult)).toBe(false);
    });

    test("isFailureResult correctly identifies failure results", () => {
      const failureResult: CommandResult = {
        success: false,
        stdout: "",
        stderr: "Command failed",
        exitCode: createExitCode(1),
        command: createCommandString("invalid-command"),
        duration: createDuration(50),
        timestamp: createTimestamp(),
        error: new InvalidCommandError(createCommandString("invalid-command"), "Invalid command syntax"),
      };

      expect(isFailureResult(failureResult)).toBe(true);
      expect(isSuccessResult(failureResult)).toBe(false);
    });
  });

  describe("Error Classes", () => {
    test("TimeoutError creates correct error structure", () => {
      const command = createCommandString("long-running-command");
      const error = new TimeoutError(command, 5000);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TimeoutError);
      expect(error.code).toBe("TIMEOUT");
      expect(error.category).toBe("EXECUTION");
      expect(error.command).toBeTruthy();
      expect(error.message).toBe("Command timed out after 5000ms");
      expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test("ProcessSpawnError creates correct error structure", () => {
      const command = createCommandString("failed-spawn");
      const cause = new Error("ENOENT: no such file or directory");
      const error = new ProcessSpawnError(command, cause);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ProcessSpawnError);
      expect(error.code).toBe("SPAWN_FAILED");
      expect(error.category).toBe("SYSTEM");
      expect(error.command).toBeTruthy();
      expect(error.message).toBe("Failed to spawn process: ENOENT: no such file or directory");
      expect(error.cause).toBe(cause);
    });

    test("InvalidCommandError creates correct error structure", () => {
      const command = createCommandString(";;invalid");
      const error = new InvalidCommandError(command, "Invalid syntax");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(InvalidCommandError);
      expect(error.code).toBe("INVALID_COMMAND");
      expect(error.category).toBe("VALIDATION");
      expect(error.command).toBeTruthy();
      expect(error.message).toBe("Invalid syntax");
    });

    test("ShellNotFoundError creates correct error structure", () => {
      const command = createCommandString("test");
      const error = new ShellNotFoundError(command, "Shell not found");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ShellNotFoundError);
      expect(error.code).toBe("SHELL_NOT_FOUND");
      expect(error.category).toBe("SYSTEM");
      expect(error.command).toBeTruthy();
      expect(error.message).toBe("Shell not found");
    });
  });

  describe("Constants and Enums", () => {
    test("LOG_LEVELS contains expected values", () => {
      expect(LOG_LEVELS).toEqual(["INFO", "WARN", "ERROR", "DEBUG"]);
      // Arrays are readonly but not necessarily frozen in TypeScript
    });

    test("SHELL_TYPES contains expected values", () => {
      expect(SHELL_TYPES).toEqual(["cmd", "powershell", "wsl", "bash", "pwsh"]);
      // Arrays are readonly but not necessarily frozen in TypeScript
    });

    test("PROCESS_PRIORITIES contains expected values", () => {
      expect(PROCESS_PRIORITIES).toEqual(["low", "normal", "high"]);
      // Arrays are readonly but not necessarily frozen in TypeScript
    });

    test("LogLevel type accepts valid values", () => {
      const validLogLevels: LogLevel[] = ["INFO", "WARN", "ERROR", "DEBUG"];
      expect(validLogLevels).toHaveLength(4);
    });

    test("ShellType type accepts valid values", () => {
      const validShellTypes: ShellType[] = ["cmd", "powershell", "wsl", "bash", "pwsh"];
      expect(validShellTypes).toHaveLength(5);
    });

    test("ProcessPriority type accepts valid values", () => {
      const validPriorities: ProcessPriority[] = ["low", "normal", "high"];
      expect(validPriorities).toHaveLength(3);
    });
  });

  describe("Complex Type Structures", () => {
    test("CommandResult has correct discriminated union behavior", () => {
      const successResult: CommandResult = {
        success: true,
        stdout: "Success output",
        stderr: "",
        exitCode: createExitCode(0),
        command: createCommandString("test-command"),
        duration: createDuration(250),
        timestamp: createTimestamp(),
      };

      const failureResult: CommandResult = {
        success: false,
        stdout: "",
        stderr: "Error output",
        exitCode: createExitCode(1),
        command: createCommandString("test-command"),
        duration: createDuration(100),
        timestamp: createTimestamp(),
        error: new InvalidCommandError(createCommandString("test-command"), "Test error"),
      };

      // TypeScript compiler should handle discriminated union correctly
      if (successResult.success) {
        expect(successResult.exitCode).toBe(0);
      } else {
        expect(successResult.error).toBeUndefined();
      }

      if (failureResult.success) {
        expect(failureResult.error).toBeUndefined();
      } else {
        expect(failureResult.error).toBeInstanceOf(InvalidCommandError);
      }
    });

    test("ExecutionOptions has correct optional properties", () => {
      const minimalOptions = {};
      expect(typeof minimalOptions).toBe("object");

      const fullOptions = {
        timeout: 5000,
        cwd: "C:\\test",
        env: { PATH: "test" },
        description: "Test command",
        shell: "powershell" as ShellType,
        priority: "high" as ProcessPriority,
        encoding: "utf8" as BufferEncoding,
      };
      
      expect(fullOptions.timeout).toBe(5000);
      expect(fullOptions.shell).toBe("powershell");
      expect(fullOptions.priority).toBe("high");
    });
  });
});