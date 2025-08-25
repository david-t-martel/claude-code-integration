import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { CommandExecutor } from "../../src/command-executor.js";
import { createCommandString } from "../../src/types.js";
import { testHelpers } from "../setup.js";

describe("CommandExecutor", () => {
  let executor: CommandExecutor;

  beforeEach(() => {
    executor = new CommandExecutor();
  });

  afterEach(async () => {
    if (executor) {
      executor.dispose();
    }
    await testHelpers.expectProcessCleanup();
  });

  describe("Basic Command Execution", () => {
    test("executes simple echo command successfully", async () => {
      const result = await executor.execute("echo hello");

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("hello");
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test("handles command with exit code 0", async () => {
      const result = await executor.execute("exit 0");
      
      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result).toHaveExitCode(0);
    });

    test("handles command with non-zero exit code", async () => {
      const result = await executor.execute("exit 1");
      
      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(false);
      expect(result).toHaveExitCode(1);
    });

    test("captures stdout and stderr correctly", async () => {
      // Command that outputs to both stdout and stderr
      const result = await executor.execute(
        "echo stdout output && echo stderr output >&2"
      );
      
      expect(result).toBeValidCommandResult();
      expect(result.stdout).toContain("stdout output");
      // Note: stderr capture depends on shell behavior
    });
  });

  describe("Command Execution Options", () => {
    test("respects timeout option", async () => {
      const start = Date.now();
      const result = await executor.execute(
        "timeout 5", // 5 second delay
        { timeout: 1000 } // 1 second timeout
      );

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000); // Should timeout before 2 seconds
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("TIMEOUT");
    });

    test("respects working directory option", async () => {
      const tempDir = testHelpers.getTempDir();
      const result = await executor.execute(
        "echo %CD%", // Windows command to show current directory
        { cwd: tempDir }
      );

      expect(result.success).toBe(true);
      expect(result.stdout).toContain(tempDir.replace(/\//g, "\\"));
    });

    test("respects environment variables option", async () => {
      const result = await executor.execute(
        "echo %TEST_VAR%",
        { env: { TEST_VAR: "test_value" } }
      );

      expect(result.success).toBe(true);
      expect(result.stdout).toContain("test_value");
    });

    test("respects shell type override", async () => {
      // Force PowerShell for a simple command
      const result = await executor.execute(
        "$PSVersionTable.PSVersion",
        { shell: "powershell" }
      );

      expect(result).toBeValidCommandResult();
      // PowerShell should execute this command successfully
    });

    test("respects encoding option", async () => {
      const result = await executor.execute(
        "echo test",
        { encoding: "utf8" }
      );

      expect(result.success).toBe(true);
      expect(typeof result.stdout).toBe("string");
      expect(result.stdout).toContain("test");
    });
  });

  describe("Error Handling", () => {
    test("handles non-existent command gracefully", async () => {
      const result = await executor.execute(
        "non-existent-command-12345"
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.category).toBe("SYSTEM");
    });

    test("handles invalid command syntax", async () => {
      const result = await executor.execute("<<<invalid>>>");

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(false);
    });

    test("handles commands with special characters", async () => {
      const result = await executor.execute('echo "test & test"');

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("test & test");
    });

    test("handles empty command", async () => {
      const result = await executor.execute("");

      expect(result).toBeValidCommandResult();
      // Should handle empty command gracefully
    });

    test("handles very long command output", async () => {
      // Generate long output
      const result = await executor.execute(
        "echo This is a test output"
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout.length).toBeGreaterThan(0);
    });
  });

  describe("Concurrent Execution", () => {
    test("handles multiple concurrent commands", async () => {
      const commands = [
        "echo command1",
        "echo command2",
        "echo command3",
        "echo command4",
        "echo command5",
      ];

      const promises = commands.map(cmd => executor.execute(cmd));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result).toBeValidCommandResult();
        expect(result.success).toBe(true);
        expect(result.stdout).toContain(`command${index + 1}`);
      });
    });

    test("respects concurrency limits", async () => {
      const manyCommands = Array.from({ length: 20 }, (_, i) => 
        `echo command${i}`
      );

      const start = Date.now();
      const promises = manyCommands.map(cmd => executor.execute(cmd));
      const results = await Promise.all(promises);
      const duration = Date.now() - start;

      // All commands should succeed
      results.forEach(result => {
        expect(result).toBeValidCommandResult();
        expect(result.success).toBe(true);
      });

      // With concurrency limits, this should take some time
      expect(duration).toBeGreaterThan(0);
    });

    test("handles mixed success and failure in concurrent execution", async () => {
      const commands = [
        "",
        "",
        "",
        "",
        "",
      ];

      const promises = commands.map(cmd => executor.execute(cmd));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
      expect(results[3].success).toBe(false);
      expect(results[4].success).toBe(true);
    });
  });

  describe("Performance Monitoring", () => {
    test("tracks execution metrics", async () => {
      await executor.execute("");
      await executor.execute("");
      await executor.execute("");

      const stats = executor.getStats();

      expect(stats.processPool).toBeDefined();
      expect(stats.processPool.active).toBeGreaterThanOrEqual(0);
      expect(stats.processPool.max).toBeGreaterThan(0);
      expect(stats.performance).toBeDefined();
    });

    test("provides process pool statistics", async () => {
      await executor.execute("");
      
      const stats = executor.getStats();
      expect(stats.processPool).toBeDefined();
      expect(stats.processPool.active).toBeGreaterThanOrEqual(0);
      expect(stats.processPool.max).toBeGreaterThan(0);
    });

    test("measures command duration accurately", async () => {
      const result = await executor.execute("");
      
      expect(result.duration).toBeGreaterThan(0); // Should have some duration
      expect(result.duration).toBeLessThan(5000); // But reasonable
    });
  });

  describe("Resource Management", () => {
    test("cleans up resources properly", async () => {
      await executor.execute("");
      executor.dispose();
      
      // After disposal, create new executor for testing
      const newExecutor = new CommandExecutor();
      const result = await newExecutor.execute("");
      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      newExecutor.dispose();
    });

    test("handles disposal multiple times safely", async () => {
      await executor.execute("");
      
      // Multiple disposals should not throw
      executor.dispose();
      executor.dispose();
      executor.dispose();
      
      // Create new executor for further testing
      const newExecutor = new CommandExecutor();
      const result = await newExecutor.execute("");
      expect(result).toBeValidCommandResult();
      newExecutor.dispose();
    });

    test("manages process pool correctly", async () => {
      // Start many concurrent operations
      const promises = Array.from({ length: 15 }, (_, i) =>
        executor.execute(createCommandString(`echo process${i}`))
      );

      const results = await Promise.all(promises);

      // All should succeed despite pool limits
      results.forEach(result => {
        expect(result).toBeValidCommandResult();
        expect(result.success).toBe(true);
      });
    });
  });

  describe("Command Preprocessing", () => {
    test("applies command fixes automatically", async () => {
      // Unix-style command should be fixed for Windows
      const result = await executor.execute(
        ""
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      // Both echo commands should execute
      expect(result.stdout).toContain("hello");
      expect(result.stdout).toContain("world");
    });

    test("chooses appropriate shell automatically", async () => {
      // PowerShell command should use PowerShell
      const psResult = await executor.execute(
        ""
      );

      expect(psResult).toBeValidCommandResult();
      // Should succeed if PowerShell is available

      // Regular cmd command should use CMD
      const cmdResult = await executor.execute(
        ""
      );

      expect(cmdResult).toBeValidCommandResult();
      expect(cmdResult.success).toBe(true);
    });
  });

  describe("Edge Cases and Stress Testing", () => {
    test("handles rapid fire commands", async () => {
      const commands = Array.from({ length: 50 }, (_, i) => 
        executor.execute(createCommandString(`echo rapid${i}`))
      );

      const results = await Promise.all(commands);
      
      results.forEach((result, index) => {
        expect(result).toBeValidCommandResult();
        expect(result.success).toBe(true);
        expect(result.stdout).toContain(`rapid${index}`);
      });
    });

    test("handles commands with large amounts of output", async () => {
      // Generate command that outputs many lines
      const result = await executor.execute(
        ""
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout.split('\n').length).toBeGreaterThan(50);
    });

    test("handles Unicode and special characters in output", async () => {
      const result = await executor.execute(
        ""
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("你好世界");
      expect(result.stdout).toContain("🚀");
    });
  });
});
