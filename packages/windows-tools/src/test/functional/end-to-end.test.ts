import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { CommandExecutor } from "../../src/command-executor.js";
import { createCommandString } from "../../src/types.js";
import { testHelpers } from "../setup.js";

describe("End-to-End Functional Tests", () => {
  let executor: CommandExecutor;

  beforeEach(() => {
    executor = new CommandExecutor();
  });

  afterEach(async () => {
    await executor.cleanup();
    await testHelpers.expectProcessCleanup();
  });

  describe("Complete Development Workflows", () => {
    test("complete project initialization workflow", async () => {
      const tempDir = testHelpers.getTempDir();
      
      // Simulate complete project setup
      const result = await executor.execute(
        createCommandString(
          `cd /d "${tempDir}" && ` +
          `echo # My New Project > README.md && ` +
          `echo {"name": "my-project", "version": "1.0.0"} > package.json && ` +
          `echo console.log('Hello, World!'); > index.js && ` +
          `mkdir src && ` +
          `mkdir tests && ` +
          `echo node_modules/ > .gitignore && ` +
          `echo dist/ >> .gitignore && ` +
          `echo Project initialized successfully`
        )
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("Project initialized successfully");

      // Verify files were created
      const verifyResult = await executor.execute(
        createCommandString(`cd /d "${tempDir}" && dir`)
      );

      expect(verifyResult.success).toBe(true);
      expect(verifyResult.stdout).toContain("README.md");
      expect(verifyResult.stdout).toContain("package.json");
      expect(verifyResult.stdout).toContain("index.js");
      expect(verifyResult.stdout).toContain("src");
      expect(verifyResult.stdout).toContain("tests");

      // Cleanup
      await executor.execute(
        createCommandString(
          `cd /d "${tempDir}" && ` +
          `del README.md && del package.json && del index.js && del .gitignore && ` +
          `rmdir src && rmdir tests`
        )
      );
    });

    test("build and test simulation workflow", async () => {
      const tempDir = testHelpers.getTempDir();
      
      // Setup
      await testHelpers.createTempFile("app.js", "console.log('Application running');");
      await testHelpers.createTempFile("test.js", "console.log('All tests passed');");

      const result = await executor.execute(
        createCommandString(
          `cd /d "${tempDir}" && ` +
          `echo Building application... && ` +
          `node app.js && ` +
          `echo Build completed successfully && ` +
          `echo Running tests... && ` +
          `node test.js && ` +
          `echo All tests passed && ` +
          `echo Deployment ready`
        )
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("Building application...");
      expect(result.stdout).toContain("Application running");
      expect(result.stdout).toContain("Build completed successfully");
      expect(result.stdout).toContain("Running tests...");
      expect(result.stdout).toContain("All tests passed");
      expect(result.stdout).toContain("Deployment ready");
    });

    test("file processing pipeline", async () => {
      const tempDir = testHelpers.getTempDir();
      const inputFile = await testHelpers.createTempFile("input.txt", 
        "Line 1\nLine 2\nLine 3\nLine 4\nLine 5"
      );

      const result = await executor.execute(
        createCommandString(
          `cd /d "${tempDir}" && ` +
          `echo Processing file pipeline... && ` +
          `copy "${inputFile}" stage1.txt && ` +
          `echo Stage 1 complete - File copied && ` +
          `type stage1.txt | findstr "Line" > stage2.txt && ` +
          `echo Stage 2 complete - Filtered content && ` +
          `copy stage2.txt final.txt && ` +
          `echo Stage 3 complete - Final output ready && ` +
          `type final.txt && ` +
          `echo Pipeline completed successfully`
        )
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("Processing file pipeline...");
      expect(result.stdout).toContain("Stage 1 complete");
      expect(result.stdout).toContain("Stage 2 complete");
      expect(result.stdout).toContain("Stage 3 complete");
      expect(result.stdout).toContain("Pipeline completed successfully");

      // Cleanup
      await executor.execute(
        createCommandString(
          `cd /d "${tempDir}" && ` +
          `del stage1.txt && del stage2.txt && del final.txt`
        )
      );
    });
  });

  describe("Cross-Shell Integration Workflows", () => {
    test("PowerShell data processing workflow", async () => {
      const result = await executor.execute(
        createCommandString(`
          $data = @('apple', 'banana', 'cherry', 'date')
          Write-Output "Processing fruit data..."
          $processed = $data | ForEach-Object { "Processed: $_" }
          $processed | Out-String
          Write-Output "Total items processed: $($processed.Count)"
          Write-Output "Workflow completed successfully"
        `),
        { shell: "powershell" }
      );

      expect(result).toBeValidCommandResult();
      if (result.success) {
        expect(result.stdout).toContain("Processing fruit data...");
        expect(result.stdout).toContain("Processed: apple");
        expect(result.stdout).toContain("Processed: banana");
        expect(result.stdout).toContain("Total items processed: 4");
        expect(result.stdout).toContain("Workflow completed successfully");
      }
    });

    test("mixed shell environment setup", async () => {
      const tempDir = testHelpers.getTempDir();

      // Setup with CMD
      const setupResult = await executor.execute(
        createCommandString(
          `cd /d "${tempDir}" && ` +
          `echo Setting up environment... && ` +
          `set PROJECT_NAME=TestProject && ` +
          `set PROJECT_VERSION=1.0.0 && ` +
          `echo PROJECT_NAME=%PROJECT_NAME% > .env && ` +
          `echo PROJECT_VERSION=%PROJECT_VERSION% >> .env && ` +
          `echo Environment setup complete`
        ),
        { shell: "cmd" }
      );

      expect(setupResult).toBeValidCommandResult();
      expect(setupResult.success).toBe(true);

      // Verify with PowerShell
      const verifyResult = await executor.execute(
        createCommandString(
          `cd "${tempDir}"; ` +
          `Write-Output "Verifying environment..."; ` +
          `Get-Content .env; ` +
          `Write-Output "Environment verified successfully"`
        ),
        { shell: "powershell" }
      );

      expect(verifyResult).toBeValidCommandResult();
      if (verifyResult.success) {
        expect(verifyResult.stdout).toContain("PROJECT_NAME=TestProject");
        expect(verifyResult.stdout).toContain("PROJECT_VERSION=1.0.0");
        expect(verifyResult.stdout).toContain("Environment verified successfully");
      }

      // Cleanup
      await executor.execute(
        createCommandString(`cd /d "${tempDir}" && del .env`)
      );
    });
  });

  describe("Error Recovery and Resilience", () => {
    test("handles partial workflow failures gracefully", async () => {
      const tempDir = testHelpers.getTempDir();
      
      const result = await executor.execute(
        createCommandString(
          `cd /d "${tempDir}" && ` +
          `echo Starting workflow... && ` +
          `echo step1 > step1.txt && ` +
          `echo Step 1 completed && ` +
          `non-existent-command ; ` + // This will fail but continue due to ;
          `echo Step 2 failed but continuing... && ` +
          `echo step3 > step3.txt && ` +
          `echo Step 3 completed && ` +
          `echo Workflow completed with errors`
        )
      );

      expect(result).toBeValidCommandResult();
      // The overall command might fail due to the non-existent command
      expect(result.stdout).toContain("Starting workflow...");
      expect(result.stdout).toContain("Step 1 completed");

      // Cleanup
      await executor.execute(
        createCommandString(`cd /d "${tempDir}" && del step1.txt && del step3.txt`)
      );
    });

    test("timeout recovery in long workflows", async () => {
      const start = Date.now();
      
      const result = await executor.execute(
        createCommandString(
          "echo Starting long workflow... && " +
          "timeout 10 && " + // 10 second delay
          "echo This should not appear"
        ),
        { timeout: 2000 } // 2 second timeout
      );

      const duration = Date.now() - start;
      
      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("TIMEOUT");
      expect(duration).toBeLessThan(3000);
      expect(result.stdout).toContain("Starting long workflow...");
    });
  });

  describe("Complex Data Operations", () => {
    test("CSV-like data processing", async () => {
      const csvData = "Name,Age,City\nJohn,25,NYC\nJane,30,LA\nBob,35,Chicago";
      const csvFile = await testHelpers.createTempFile("data.csv", csvData);
      const tempDir = testHelpers.getTempDir();

      const result = await executor.execute(
        createCommandString(
          `cd /d "${tempDir}" && ` +
          `echo Processing CSV data... && ` +
          `type "${csvFile}" && ` +
          `echo. && ` +
          `echo Extracting headers... && ` +
          `type "${csvFile}" | findstr /n "Name" && ` +
          `echo Data processing completed`
        )
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("Processing CSV data...");
      expect(result.stdout).toContain("Name,Age,City");
      expect(result.stdout).toContain("John,25,NYC");
      expect(result.stdout).toContain("Data processing completed");
    });

    test("log file analysis simulation", async () => {
      const logData = [
        "2024-01-01 10:00:00 INFO Application started",
        "2024-01-01 10:01:00 INFO User login: john@example.com",
        "2024-01-01 10:02:00 ERROR Database connection failed",
        "2024-01-01 10:03:00 INFO Retry database connection",
        "2024-01-01 10:04:00 INFO Database connected successfully"
      ].join("\n");
      
      const logFile = await testHelpers.createTempFile("app.log", logData);

      const result = await executor.execute(
        createCommandString(
          `echo Analyzing log file... && ` +
          `type "${logFile}" && ` +
          `echo. && ` +
          `echo Finding errors... && ` +
          `type "${logFile}" | findstr "ERROR" && ` +
          `echo Log analysis completed`
        )
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("Analyzing log file...");
      expect(result.stdout).toContain("Application started");
      expect(result.stdout).toContain("Database connection failed");
      expect(result.stdout).toContain("Log analysis completed");
    });
  });

  describe("System Integration", () => {
    test("system information gathering", async () => {
      const result = await executor.execute(
        createCommandString(
          "echo System Information Gathering... && " +
          "echo Computer: %COMPUTERNAME% && " +
          "echo User: %USERNAME% && " +
          "echo OS: %OS% && " +
          "echo Processor: %PROCESSOR_ARCHITECTURE% && " +
          "echo Temp Directory: %TEMP% && " +
          "echo Information gathering completed"
        )
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("System Information Gathering...");
      expect(result.stdout).toContain("Computer:");
      expect(result.stdout).toContain("User:");
      expect(result.stdout).toContain("OS:");
      expect(result.stdout).toContain("Information gathering completed");
    });

    test("directory structure analysis", async () => {
      const tempDir = testHelpers.getTempDir();
      
      // Create test directory structure
      const setupResult = await executor.execute(
        createCommandString(
          `cd /d "${tempDir}" && ` +
          `mkdir project && ` +
          `mkdir project\\src && ` +
          `mkdir project\\tests && ` +
          `mkdir project\\docs && ` +
          `echo test > project\\src\\main.js && ` +
          `echo test > project\\tests\\test.js && ` +
          `echo test > project\\docs\\README.md`
        )
      );

      expect(setupResult.success).toBe(true);

      // Analyze structure
      const result = await executor.execute(
        createCommandString(
          `cd /d "${tempDir}" && ` +
          `echo Analyzing directory structure... && ` +
          `dir project /s && ` +
          `echo Analysis completed`
        )
      );

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("Analyzing directory structure...");
      expect(result.stdout).toContain("src");
      expect(result.stdout).toContain("tests");
      expect(result.stdout).toContain("docs");
      expect(result.stdout).toContain("main.js");
      expect(result.stdout).toContain("test.js");
      expect(result.stdout).toContain("README.md");

      // Cleanup
      await executor.execute(
        createCommandString(
          `cd /d "${tempDir}" && ` +
          `rmdir /s /q project`
        )
      );
    });
  });

  describe("Performance Under Real Workloads", () => {
    test("handles sustained operation workflow", async () => {
      const tempDir = testHelpers.getTempDir();
      const startTime = Date.now();

      // Create multiple files and process them
      const result = await executor.execute(
        createCommandString(
          `cd /d "${tempDir}" && ` +
          Array.from({ length: 20 }, (_, i) => 
            `echo Content for file ${i} > file${i}.txt`
          ).join(" && ") +
          " && echo All files created && " +
          Array.from({ length: 20 }, (_, i) => 
            `type file${i}.txt | findstr "Content"`
          ).join(" && ") +
          " && echo All files processed && " +
          Array.from({ length: 20 }, (_, i) => 
            `del file${i}.txt`
          ).join(" && ") +
          " && echo Cleanup completed"
        )
      );

      const duration = Date.now() - startTime;

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain("All files created");
      expect(result.stdout).toContain("All files processed");
      expect(result.stdout).toContain("Cleanup completed");
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    });

    test("memory stability during extended operations", async () => {
      const initialMemory = process.memoryUsage();
      
      // Run many operations
      for (let batch = 0; batch < 5; batch++) {
        const result = await executor.execute(
          createCommandString(
            Array.from({ length: 10 }, (_, i) => 
              `echo Batch ${batch} Item ${i}`
            ).join(" && ")
          )
        );
        expect(result.success).toBe(true);
      }

      // Check memory usage
      if (global.gc) global.gc();
      const finalMemory = process.memoryUsage();
      const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory growth should be reasonable (less than 20MB)
      expect(heapGrowth).toBeLessThan(20 * 1024 * 1024);
    });
  });
});