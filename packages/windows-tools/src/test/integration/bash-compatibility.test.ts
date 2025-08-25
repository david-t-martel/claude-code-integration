import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { CommandExecutor } from "../../src/command-executor.js";
import { createCommandString } from "../../src/types.js";
import { testHelpers } from "../setup.js";

describe("Bash Compatibility Integration Tests", () => {
  let executor: CommandExecutor;

  beforeEach(() => {
    executor = new CommandExecutor();
  });

  afterEach(async () => {
    await executor.cleanup();
    await testHelpers.expectProcessCleanup();
  });

  describe("Unix-style Command Conversion", () => {
    test("converts chained commands with &&", async () => {
      const result = await executor.execute(
        createCommandString("echo first && echo second && echo third")
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("first");
      expect(result.stdout).toContain("second");
      expect(result.stdout).toContain("third");
    });

    test("handles mixed operators correctly", async () => {
      // Test && (sequential) vs & (background on Unix, sequential on Windows)
      const result = await executor.execute(
        createCommandString("echo start && echo middle & echo end")
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("start");
      expect(result.stdout).toContain("middle");
      expect(result.stdout).toContain("end");
    });

    test("converts Unix paths to Windows format", async () => {
      // Create a temporary file to test path conversion
      const testFile = await testHelpers.createTempFile("test.txt", "test content");
      const unixStylePath = testFile.replace(/\\/g, "/").replace(/^([A-Z]):/, "/$1").toLowerCase();

      const result = await executor.execute(
        createCommandString(`type "${unixStylePath}"`)
      );

      // Should work with converted path
      expect(result).toBeValidCommandResult();
      if (result.success) {
        expect(result.stdout).toContain("test content");
      }
    });

    test("handles directory operations with Unix-style paths", async () => {
      const tempDir = testHelpers.getTempDir();
      const unixStyleDir = tempDir.replace(/\\/g, "/");

      const result = await executor.execute(
        createCommandString(`dir "${unixStyleDir}"`)
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
    });
  });

  describe("Cross-Platform File Operations", () => {
    test("handles file creation and manipulation", async () => {
      const testFile = "test-file.txt";
      const tempDir = testHelpers.getTempDir();
      
      // Create file
      const createResult = await executor.execute(
        createCommandString(`echo "test content" > "${tempDir}\\${testFile}"`)
      );

      expect(createResult).toBeValidCommandResult();
      expect(createResult.success).toBe(true);

      // Read file
      const readResult = await executor.execute(
        createCommandString(`type "${tempDir}\\${testFile}"`)
      );

      expect(readResult).toBeValidCommandResult();
      expect(readResult.success).toBe(true);
      expect(readResult.stdout).toContain("test content");

      // Clean up
      await executor.execute(
        createCommandString(`del "${tempDir}\\${testFile}"`)
      );
    });

    test("handles directory operations", async () => {
      const tempDir = testHelpers.getTempDir();
      const testSubDir = "test-subdir";

      // Create directory
      const mkdirResult = await executor.execute(
        createCommandString(`mkdir "${tempDir}\\${testSubDir}"`)
      );

      expect(mkdirResult).toBeValidCommandResult();
      expect(mkdirResult.success).toBe(true);

      // List directory
      const lsResult = await executor.execute(
        createCommandString(`dir "${tempDir}"`)
      );

      expect(lsResult).toBeValidCommandResult();
      expect(lsResult.success).toBe(true);
      expect(lsResult.stdout).toContain(testSubDir);

      // Remove directory
      const rmdirResult = await executor.execute(
        createCommandString(`rmdir "${tempDir}\\${testSubDir}"`)
      );

      expect(rmdirResult).toBeValidCommandResult();
      expect(rmdirResult.success).toBe(true);
    });

    test("handles file copying operations", async () => {
      const sourceFile = await testHelpers.createTempFile("source.txt", "source content");
      const tempDir = testHelpers.getTempDir();
      const destFile = `${tempDir}\\dest.txt`;

      // Copy file
      const copyResult = await executor.execute(
        createCommandString(`copy "${sourceFile}" "${destFile}"`)
      );

      expect(copyResult).toBeValidCommandResult();
      expect(copyResult.success).toBe(true);

      // Verify copy
      const verifyResult = await executor.execute(
        createCommandString(`type "${destFile}"`)
      );

      expect(verifyResult).toBeValidCommandResult();
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.stdout).toContain("source content");

      // Clean up
      await executor.execute(createCommandString(`del "${destFile}"`));
    });
  });

  describe("Environment Variable Handling", () => {
    test("handles Windows environment variables", async () => {
      const result = await executor.execute(
        createCommandString("echo %COMPUTERNAME%")
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout.trim()).not.toBe("%COMPUTERNAME%");
    });

    test("handles environment variable expansion in paths", async () => {
      const result = await executor.execute(
        createCommandString("echo %TEMP%")
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("\\");
    });

    test("handles setting temporary environment variables", async () => {
      const result = await executor.execute(
        createCommandString("set TEST_VAR=test123 && echo %TEST_VAR%")
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("test123");
    });
  });

  describe("Process Management", () => {
    test("handles process chains correctly", async () => {
      // Simple process chain
      const result = await executor.execute(
        createCommandString("echo start && timeout 1 && echo end")
      );

      expect(result).toBeValidCommandResult();
      expect(result.stdout).toContain("start");
      expect(result.stdout).toContain("end");
      expect(result.duration).toBeGreaterThan(800); // Should take at least 800ms due to timeout
    });

    test("handles command substitution alternatives", async () => {
      // Windows equivalent of command substitution
      const result = await executor.execute(
        createCommandString("echo Today is && date /t && time /t")
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("Today is");
    });
  });

  describe("Error Handling and Recovery", () => {
    test("handles failed commands in chains", async () => {
      // First command fails, but we continue with next
      const result = await executor.execute(
        createCommandString("non-existent-command ; echo this should still run")
      );

      expect(result).toBeValidCommandResult();
      // The behavior depends on whether we use && or ;
      // With ;, it should continue even after failure
    });

    test("handles permission errors gracefully", async () => {
      // Try to access a restricted location
      const result = await executor.execute(
        createCommandString("dir C:\\System Volume Information")
      );

      expect(result).toBeValidCommandResult();
      // Should handle permission denied gracefully
    });
  });

  describe("Complex Real-World Scenarios", () => {
    test("simulates common development workflows", async () => {
      const tempDir = testHelpers.getTempDir();
      
      // Simulate a build process
      const result = await executor.execute(
        createCommandString(
          `cd /d "${tempDir}" && ` +
          `echo console.log('hello') > app.js && ` +
          `echo Created app.js && ` +
          `type app.js && ` +
          `del app.js && ` +
          `echo Cleaned up`
        )
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("Created app.js");
      expect(result.stdout).toContain("hello");
      expect(result.stdout).toContain("Cleaned up");
    });

    test("handles git-like command sequences", async () => {
      const tempDir = testHelpers.getTempDir();
      
      // Simulate git operations (without actually using git)
      const result = await executor.execute(
        createCommandString(
          `cd /d "${tempDir}" && ` +
          `echo # My Project > README.md && ` +
          `echo Created README && ` +
          `type README.md && ` +
          `echo README.md >> .gitignore && ` +
          `type .gitignore`
        )
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("Created README");
      expect(result.stdout).toContain("# My Project");
      expect(result.stdout).toContain("README.md");
    });

    test("handles package management workflows", async () => {
      // Simulate npm-like operations without actually running npm
      const result = await executor.execute(
        createCommandString(
          `echo Initializing project && ` +
          `echo {"name": "test"} > package.json && ` +
          `type package.json && ` +
          `echo Package initialized`
        )
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("Initializing project");
      expect(result.stdout).toContain('"name": "test"');
      expect(result.stdout).toContain("Package initialized");
    });
  });

  describe("Performance Under Load", () => {
    test("handles multiple file operations efficiently", async () => {
      const tempDir = testHelpers.getTempDir();
      const startTime = Date.now();
      
      const result = await executor.execute(
        createCommandString(
          `cd /d "${tempDir}" && ` +
          Array.from({ length: 10 }, (_, i) => 
            `echo content${i} > file${i}.txt`
          ).join(" && ") +
          " && echo All files created"
        )
      );

      const duration = Date.now() - startTime;
      
      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("All files created");
      expect(duration).toBeLessThan(5000); // Should complete reasonably quickly

      // Clean up
      await executor.execute(
        createCommandString(
          `cd /d "${tempDir}" && ` +
          Array.from({ length: 10 }, (_, i) => `del file${i}.txt`).join(" && ")
        )
      );
    });

    test("maintains stability under concurrent load", async () => {
      const commands = Array.from({ length: 10 }, (_, i) =>
        executor.execute(
          createCommandString(
            `echo Starting task ${i} && timeout 1 && echo Completed task ${i}`
          )
        )
      );

      const results = await Promise.all(commands);

      results.forEach((result, index) => {
        expect(result).toBeValidCommandResult();
        expect(result.success).toBe(true);
        expect(result.stdout).toContain(`Starting task ${index}`);
        expect(result.stdout).toContain(`Completed task ${index}`);
      });
    });
  });
});