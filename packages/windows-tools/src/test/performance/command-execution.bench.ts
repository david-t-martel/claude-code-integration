import { describe, test, expect, beforeEach, afterEach, bench } from "vitest";
import { CommandExecutor } from "../../src/command-executor.js";
import { CommandFixer } from "../../src/command-fixer.js";
import { ShellResolver } from "../../src/shell-resolver.js";
import { createCommandString } from "../../src/types.js";
import { testHelpers } from "../setup.js";

describe("Performance Benchmarks", () => {
  let executor: CommandExecutor;

  beforeEach(() => {
    executor = new CommandExecutor();
  });

  afterEach(async () => {
    await executor.cleanup();
    await testHelpers.expectProcessCleanup();
  });

  describe("Command Execution Performance", () => {
    bench("simple echo command execution", async () => {
      const result = await executor.execute(createCommandString("echo test"));
      expect(result.success).toBe(true);
    });

    bench("complex command with operators", async () => {
      const result = await executor.execute(
        createCommandString("echo start && echo middle && echo end")
      );
      expect(result.success).toBe(true);
    });

    bench("PowerShell command execution", async () => {
      const result = await executor.execute(
        createCommandString("Get-Date -Format 'HH:mm:ss'"),
        { shell: "powershell" }
      );
      // PowerShell might not be available in all environments
      expect(result).toBeValidCommandResult();
    });

    bench("file operation command", async () => {
      const tempFile = await testHelpers.createTempFile("bench.txt", "benchmark content");
      const result = await executor.execute(
        createCommandString(`type "${tempFile}"`)
      );
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("benchmark content");
    });
  });

  describe("Concurrent Execution Performance", () => {
    bench("10 concurrent echo commands", async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        executor.execute(createCommandString(`echo test${i}`))
      );
      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach(result => expect(result.success).toBe(true));
    });

    bench("20 concurrent simple commands", async () => {
      const promises = Array.from({ length: 20 }, (_, i) =>
        executor.execute(createCommandString(`echo concurrent${i}`))
      );
      const results = await Promise.all(promises);
      expect(results).toHaveLength(20);
      results.forEach(result => expect(result.success).toBe(true));
    });

    bench("mixed shell concurrent execution", async () => {
      const commands = [
        { cmd: "echo cmd1", shell: "cmd" as const },
        { cmd: "Write-Output ps1", shell: "powershell" as const },
        { cmd: "echo cmd2", shell: "cmd" as const },
        { cmd: "Write-Output ps2", shell: "powershell" as const },
      ];

      const promises = commands.map(({ cmd, shell }) =>
        executor.execute(createCommandString(cmd), { shell })
      );
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(4);
      results.forEach(result => expect(result).toBeValidCommandResult());
    });
  });

  describe("Command Processing Performance", () => {
    bench("command fixing - simple command", () => {
      const result = CommandFixer.fix("echo hello");
      expect(result).toBe("echo hello");
    });

    bench("command fixing - complex command with fixes", () => {
      const result = CommandFixer.fix("echo start && /c/tools/build.exe && echo done");
      expect(result).toContain(";");
      expect(result).toContain("C:\\\\");
    });

    bench("command fixing - repeated calls (caching test)", () => {
      const input = "echo test && /c/program/app.exe";
      for (let i = 0; i < 100; i++) {
        CommandFixer.fix(input);
      }
    });

    bench("shell resolution - PowerShell command", () => {
      const shell = ShellResolver.resolve(createCommandString("Get-Process"));
      expect(shell.type).toBe("powershell");
    });

    bench("shell resolution - CMD command", () => {
      const shell = ShellResolver.resolve(createCommandString("dir C:\\"));
      expect(shell.type).toBe("cmd");
    });

    bench("shell resolution - WSL command", () => {
      const shell = ShellResolver.resolve(createCommandString("wsl ls -la"));
      expect(shell.type).toBe("wsl");
    });

    bench("shell resolution - repeated calls", () => {
      const commands = [
        "Get-Process",
        "dir",
        "wsl ls",
        "npm install",
        "echo test"
      ].map(createCommandString);

      commands.forEach(cmd => {
        ShellResolver.resolve(cmd);
      });
    });
  });

  describe("Memory Usage Performance", () => {
    bench("memory usage - many sequential commands", async () => {
      const initialMemory = process.memoryUsage();
      
      for (let i = 0; i < 50; i++) {
        await executor.execute(createCommandString(`echo test${i}`));
      }
      
      const finalMemory = process.memoryUsage();
      const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory growth should be reasonable (less than 10MB)
      expect(heapGrowth).toBeLessThan(10 * 1024 * 1024);
    });

    bench("memory usage - concurrent commands", async () => {
      const initialMemory = process.memoryUsage();
      
      const promises = Array.from({ length: 25 }, (_, i) =>
        executor.execute(createCommandString(`echo concurrent${i}`))
      );
      
      await Promise.all(promises);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory growth should be reasonable
      expect(heapGrowth).toBeLessThan(15 * 1024 * 1024);
    });

    bench("command result object creation", () => {
      // Simulate creating many command results
      const results = Array.from({ length: 1000 }, (_, i) => ({
        success: true,
        stdout: `output${i}`,
        stderr: "",
        exitCode: 0,
        command: `command${i}`,
        duration: 100 + i,
        timestamp: new Date().toISOString(),
      }));
      
      expect(results).toHaveLength(1000);
    });
  });

  describe("Threading and Concurrency Performance", () => {
    bench("high concurrency stress test", async () => {
      // Test with higher concurrency than pool limit
      const promises = Array.from({ length: 50 }, (_, i) =>
        executor.execute(createCommandString(`echo stress${i}`))
      );
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(50);
      results.forEach(result => expect(result.success).toBe(true));
    });

    bench("rapid sequential execution", async () => {
      // Test rapid sequential execution
      for (let i = 0; i < 30; i++) {
        const result = await executor.execute(createCommandString(`echo rapid${i}`));
        expect(result.success).toBe(true);
      }
    });

    bench("mixed execution patterns", async () => {
      // Mix of sequential and concurrent execution
      for (let batch = 0; batch < 3; batch++) {
        const promises = Array.from({ length: 5 }, (_, i) =>
          executor.execute(createCommandString(`echo batch${batch}_item${i}`))
        );
        const results = await Promise.all(promises);
        expect(results).toHaveLength(5);
      }
    });
  });

  describe("Real-World Scenario Performance", () => {
    bench("simulated build process", async () => {
      const tempDir = testHelpers.getTempDir();
      
      const result = await executor.execute(
        createCommandString(
          `cd /d "${tempDir}" && ` +
          `echo console.log('app') > app.js && ` +
          `echo {"name": "test"} > package.json && ` +
          `type package.json && ` +
          `type app.js && ` +
          `del app.js && ` +
          `del package.json`
        )
      );
      
      expect(result.success).toBe(true);
    });

    bench("file processing workflow", async () => {
      const tempDir = testHelpers.getTempDir();
      const sourceFile = await testHelpers.createTempFile("source.txt", "source content");
      
      const result = await executor.execute(
        createCommandString(
          `copy "${sourceFile}" "${tempDir}\\processed.txt" && ` +
          `type "${tempDir}\\processed.txt" && ` +
          `del "${tempDir}\\processed.txt"`
        )
      );
      
      expect(result.success).toBe(true);
    });

    bench("environment management", async () => {
      const result = await executor.execute(
        createCommandString(
          "set BUILD_ENV=production && " +
          "set BUILD_VERSION=1.0.0 && " +
          "echo Build: %BUILD_ENV% v%BUILD_VERSION% && " +
          "set BUILD_ENV= && " +
          "set BUILD_VERSION="
        )
      );
      
      expect(result.success).toBe(true);
    });

    bench("cross-shell compatibility", async () => {
      const cmdResult = await executor.execute(
        createCommandString("echo CMD_TEST"),
        { shell: "cmd" }
      );
      
      const psResult = await executor.execute(
        createCommandString("Write-Output 'PS_TEST'"),
        { shell: "powershell" }
      );
      
      expect(cmdResult).toBeValidCommandResult();
      expect(psResult).toBeValidCommandResult();
    });
  });

  describe("Resource Cleanup Performance", () => {
    bench("cleanup after many operations", async () => {
      // Execute many commands
      const promises = Array.from({ length: 30 }, (_, i) =>
        executor.execute(createCommandString(`echo cleanup_test${i}`))
      );
      
      await Promise.all(promises);
      
      // Measure cleanup time
      const cleanupStart = Date.now();
      await executor.cleanup();
      const cleanupDuration = Date.now() - cleanupStart;
      
      // Cleanup should be fast
      expect(cleanupDuration).toBeLessThan(1000);
    });

    bench("metrics collection and reset", async () => {
      // Generate some metrics
      for (let i = 0; i < 20; i++) {
        await executor.execute(createCommandString(`echo metrics${i}`));
      }
      
      const metrics = executor.getMetrics();
      expect(metrics.commandsExecuted).toBe(20);
      
      executor.resetMetrics();
      
      const resetMetrics = executor.getMetrics();
      expect(resetMetrics.commandsExecuted).toBe(0);
    });
  });

  describe("Error Handling Performance", () => {
    bench("handling command failures", async () => {
      const promises = Array.from({ length: 10 }, (_, i) => {
        const command = i % 2 === 0 ? 
          createCommandString(`echo success${i}`) :
          createCommandString(`non-existent-command${i}`);
        return executor.execute(command);
      });
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      
      // Half should succeed, half should fail
      const successes = results.filter(r => r.success).length;
      const failures = results.filter(r => !r.success).length;
      expect(successes).toBe(5);
      expect(failures).toBe(5);
    });

    bench("timeout handling performance", async () => {
      const result = await executor.execute(
        createCommandString("timeout 3"), // 3 second command
        { timeout: 500 } // 500ms timeout
      );
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("TIMEOUT");
      expect(result.duration).toBeLessThan(1000);
    });
  });
});