import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { CommandExecutor } from "../../src/command-executor.js";
import { ShellResolver } from "../../src/shell-resolver.js";
import { CommandFixer } from "../../src/command-fixer.js";
import { createCommandString } from "../../src/types.js";
import { testHelpers } from "../setup.js";

describe("Cross-Platform Integration Tests", () => {
  let executor: CommandExecutor;

  beforeEach(() => {
    executor = new CommandExecutor();
  });

  afterEach(async () => {
    await executor.cleanup();
    await testHelpers.expectProcessCleanup();
  });

  describe("PowerShell Integration", () => {
    test("executes PowerShell commands correctly", async () => {
      const result = await executor.execute(
        createCommandString("Get-Date -Format 'yyyy-MM-dd'"),
        { shell: "powershell" }
      );

      expect(result).toBeValidCommandResult();
      if (result.success) {
        expect(result.stdout).toMatch(/\d{4}-\d{2}-\d{2}/);
      }
    });

    test("handles PowerShell objects and formatting", async () => {
      const result = await executor.execute(
        createCommandString("Get-Process | Select-Object -First 3 Name, Id | Format-Table"),
        { shell: "powershell" }
      );

      expect(result).toBeValidCommandResult();
      if (result.success) {
        expect(result.stdout).toContain("Name");
        expect(result.stdout).toContain("Id");
      }
    });

    test("handles PowerShell error conditions", async () => {
      const result = await executor.execute(
        createCommandString("Get-NonExistentCommand"),
        { shell: "powershell" }
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(false);
      expect(result.stderr).not.toBe("");
    });

    test("executes complex PowerShell scripts", async () => {
      const script = `
        $items = @('apple', 'banana', 'cherry')
        foreach ($item in $items) {
          Write-Output "Processing: $item"
        }
        Write-Output "Total items: $($items.Count)"
      `;

      const result = await executor.execute(
        createCommandString(script),
        { shell: "powershell" }
      );

      expect(result).toBeValidCommandResult();
      if (result.success) {
        expect(result.stdout).toContain("Processing: apple");
        expect(result.stdout).toContain("Processing: banana");
        expect(result.stdout).toContain("Processing: cherry");
        expect(result.stdout).toContain("Total items: 3");
      }
    });
  });

  describe("CMD Integration", () => {
    test("executes batch commands correctly", async () => {
      const result = await executor.execute(
        createCommandString("for /L %i in (1,1,3) do @echo Number %i"),
        { shell: "cmd" }
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("Number 1");
      expect(result.stdout).toContain("Number 2");
      expect(result.stdout).toContain("Number 3");
    });

    test("handles environment variable operations", async () => {
      const result = await executor.execute(
        createCommandString("set TEST_VAR=hello && echo %TEST_VAR%"),
        { shell: "cmd" }
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("hello");
    });

    test("handles file and directory operations", async () => {
      const tempDir = testHelpers.getTempDir();
      
      const result = await executor.execute(
        createCommandString(
          `cd /d "${tempDir}" && ` +
          "echo test > temp.txt && " +
          "type temp.txt && " +
          "del temp.txt"
        ),
        { shell: "cmd" }
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("test");
    });

    test("handles conditional execution", async () => {
      const result = await executor.execute(
        createCommandString("echo test && echo success || echo failure"),
        { shell: "cmd" }
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("test");
      expect(result.stdout).toContain("success");
    });
  });

  describe("WSL Integration", () => {
    test("detects WSL commands correctly", async () => {
      const wslCommand = createCommandString("wsl echo 'Hello from WSL'");
      const shell = ShellResolver.resolve(wslCommand);
      
      expect(shell.type).toBe("wsl");
      expect(shell.shell).toContain("wsl.exe");
    });

    test("handles WSL path conversion", async () => {
      const command = "wsl ls /mnt/c/Windows";
      const fixed = CommandFixer.fix(command);
      
      expect(fixed).toBe(command); // WSL commands should not be modified
    });

    // Note: Actual WSL execution depends on WSL being installed
    test("attempts WSL execution if available", async () => {
      const result = await executor.execute(
        createCommandString("wsl echo 'test'")
      );

      expect(result).toBeValidCommandResult();
      // Result depends on WSL availability
      if (result.success) {
        expect(result.stdout).toContain("test");
      }
    });
  });

  describe("Automatic Shell Detection", () => {
    test("automatically detects PowerShell commands", async () => {
      const command = createCommandString("Get-Process notepad");
      const shell = ShellResolver.resolve(command);
      
      expect(shell.type).toBe("powershell");
    });

    test("automatically detects CMD commands", async () => {
      const command = createCommandString("dir C:\\");
      const shell = ShellResolver.resolve(command);
      
      expect(shell.type).toBe("cmd");
    });

    test("automatically detects WSL commands", async () => {
      const command = createCommandString("wsl ls -la");
      const shell = ShellResolver.resolve(command);
      
      expect(shell.type).toBe("wsl");
    });

    test("handles mixed shell indicators", async () => {
      // Command with both PowerShell and CMD elements
      const command = createCommandString("Get-Process && dir");
      const shell = ShellResolver.resolve(command);
      
      // Should prefer PowerShell due to Get-Process
      expect(shell.type).toBe("powershell");
    });
  });

  describe("Cross-Shell Command Execution", () => {
    test("executes same logic across different shells", async () => {
      const testFile = await testHelpers.createTempFile("test.txt", "Hello World");
      
      // CMD version
      const cmdResult = await executor.execute(
        createCommandString(`type "${testFile}"`),
        { shell: "cmd" }
      );

      // PowerShell version
      const psResult = await executor.execute(
        createCommandString(`Get-Content "${testFile}"`),
        { shell: "powershell" }
      );

      expect(cmdResult).toBeValidCommandResult();
      expect(psResult).toBeValidCommandResult();

      if (cmdResult.success && psResult.success) {
        expect(cmdResult.stdout.trim()).toContain("Hello World");
        expect(psResult.stdout.trim()).toContain("Hello World");
      }
    });

    test("handles different error reporting styles", async () => {
      // CMD version
      const cmdResult = await executor.execute(
        createCommandString("type non-existent-file.txt"),
        { shell: "cmd" }
      );

      // PowerShell version
      const psResult = await executor.execute(
        createCommandString("Get-Content non-existent-file.txt"),
        { shell: "powershell" }
      );

      expect(cmdResult).toBeValidCommandResult();
      expect(psResult).toBeValidCommandResult();

      // Both should fail, but with different error messages
      expect(cmdResult.success).toBe(false);
      expect(psResult.success).toBe(false);
    });
  });

  describe("Path Handling Across Platforms", () => {
    test("handles Windows-style paths consistently", async () => {
      const tempDir = testHelpers.getTempDir();
      const windowsPath = `${tempDir}\\test.txt`;
      
      // Create file with Windows path
      const createResult = await executor.execute(
        createCommandString(`echo "content" > "${windowsPath}"`)
      );

      expect(createResult).toBeValidCommandResult();
      expect(createResult.success).toBe(true);

      // Read with different shells
      const cmdResult = await executor.execute(
        createCommandString(`type "${windowsPath}"`),
        { shell: "cmd" }
      );

      const psResult = await executor.execute(
        createCommandString(`Get-Content "${windowsPath}"`),
        { shell: "powershell" }
      );

      expect(cmdResult).toBeValidCommandResult();
      expect(psResult).toBeValidCommandResult();

      if (cmdResult.success) {
        expect(cmdResult.stdout).toContain("content");
      }
      if (psResult.success) {
        expect(psResult.stdout).toContain("content");
      }

      // Cleanup
      await executor.execute(createCommandString(`del "${windowsPath}"`));
    });

    test("handles Unix-style paths with conversion", async () => {
      const tempDir = testHelpers.getTempDir();
      const unixStylePath = tempDir.replace(/\\/g, "/").replace(/^([A-Z]):/, "/$1").toLowerCase();
      
      // Command with Unix-style path should be converted
      const fixed = CommandFixer.fix(`echo test > ${unixStylePath}/test.txt`);
      expect(fixed).not.toContain("/mnt/");
      expect(fixed).toContain("\\\\");
    });
  });

  describe("Environment Consistency", () => {
    test("maintains environment variables across shells", async () => {
      const testEnv = { TEST_CROSS_SHELL: "test_value" };

      // Test in CMD
      const cmdResult = await executor.execute(
        createCommandString("echo %TEST_CROSS_SHELL%"),
        { shell: "cmd", env: testEnv }
      );

      // Test in PowerShell
      const psResult = await executor.execute(
        createCommandString("echo $env:TEST_CROSS_SHELL"),
        { shell: "powershell", env: testEnv }
      );

      expect(cmdResult).toBeValidCommandResult();
      expect(psResult).toBeValidCommandResult();

      if (cmdResult.success && psResult.success) {
        expect(cmdResult.stdout).toContain("test_value");
        expect(psResult.stdout).toContain("test_value");
      }
    });

    test("handles working directory consistently", async () => {
      const tempDir = testHelpers.getTempDir();

      // Test in CMD
      const cmdResult = await executor.execute(
        createCommandString("echo %CD%"),
        { shell: "cmd", cwd: tempDir }
      );

      // Test in PowerShell
      const psResult = await executor.execute(
        createCommandString("Get-Location"),
        { shell: "powershell", cwd: tempDir }
      );

      expect(cmdResult).toBeValidCommandResult();
      expect(psResult).toBeValidCommandResult();

      if (cmdResult.success && psResult.success) {
        expect(cmdResult.stdout).toContain(tempDir.replace(/\//g, "\\"));
        expect(psResult.stdout).toContain(tempDir);
      }
    });
  });

  describe("Performance Across Platforms", () => {
    test("maintains consistent performance across shells", async () => {
      const command = "echo test";
      
      // Measure CMD performance
      const cmdStart = Date.now();
      const cmdResult = await executor.execute(
        createCommandString(command),
        { shell: "cmd" }
      );
      const cmdDuration = Date.now() - cmdStart;

      // Measure PowerShell performance
      const psStart = Date.now();
      const psResult = await executor.execute(
        createCommandString("Write-Output test"),
        { shell: "powershell" }
      );
      const psDuration = Date.now() - psStart;

      expect(cmdResult).toBeValidCommandResult();
      expect(psResult).toBeValidCommandResult();

      // Both should complete reasonably quickly
      expect(cmdDuration).toBeLessThan(5000);
      expect(psDuration).toBeLessThan(10000); // PowerShell might be slower to start

      if (cmdResult.success && psResult.success) {
        expect(cmdResult.stdout).toContain("test");
        expect(psResult.stdout).toContain("test");
      }
    });

    test("handles concurrent cross-platform execution", async () => {
      const commands = [
        { command: createCommandString("echo cmd1"), shell: "cmd" as const },
        { command: createCommandString("Write-Output ps1"), shell: "powershell" as const },
        { command: createCommandString("echo cmd2"), shell: "cmd" as const },
        { command: createCommandString("Write-Output ps2"), shell: "powershell" as const },
      ];

      const promises = commands.map(({ command, shell }) =>
        executor.execute(command, { shell })
      );

      const results = await Promise.all(promises);

      results.forEach((result, index) => {
        expect(result).toBeValidCommandResult();
        if (result.success) {
          const expected = commands[index].shell === "cmd" ? 
            `cmd${Math.ceil((index + 1) / 2)}` : 
            `ps${Math.ceil(index / 2)}`;
          expect(result.stdout).toContain(expected);
        }
      });
    });
  });
});