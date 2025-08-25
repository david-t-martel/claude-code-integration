import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";

// Test environment setup
let testTempDir: string;
let originalEnv: NodeJS.ProcessEnv;

beforeAll(async () => {
  // Create temporary directory for test files
  testTempDir = await fs.mkdtemp(path.join(os.tmpdir(), "claude-tools-test-"));

  // Store original environment
  originalEnv = { ...process.env };

  // Set test environment variables
  process.env.CLAUDE_TOOLS_TEST = "true";
  process.env.CLAUDE_TOOLS_LOG_LEVEL = "error"; // Suppress logs during tests
  process.env.CLAUDE_TOOLS_TEMP_DIR = testTempDir;

  console.log(`Test temp directory: ${testTempDir}`);
});

afterAll(async () => {
  // Cleanup temporary directory
  try {
    await fs.rm(testTempDir, { recursive: true, force: true });
  } catch (error) {
    console.warn(`Failed to cleanup test temp dir: ${error}`);
  }

  // Restore original environment
  process.env = originalEnv;
});

beforeEach(() => {
  // Reset any global state before each test
  if (global.gc) {
    global.gc();
  }
});

afterEach(async () => {
  // Cleanup after each test
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  // Small delay to ensure async operations complete
  await new Promise((resolve) => setTimeout(resolve, 10));
});

// Global test utilities
declare global {
  namespace Vi {
    interface CustomMatchers<T = any> {
      toBeValidCommandResult(): T;
      toHaveExitCode(code: number): T;
      toCompleteWithin(ms: number): T;
    }
  }
}

// Custom matchers  
import { expect } from "vitest";

expect.extend({
  toBeValidCommandResult(received) {
    const isValid =
      received &&
      typeof received.success === "boolean" &&
      typeof received.stdout === "string" &&
      typeof received.stderr === "string" &&
      typeof received.exitCode === "number" &&
      typeof received.duration === "number" &&
      typeof received.command === "string";

    return {
      pass: isValid,
      message: () => `Expected ${received} to be a valid CommandResult`,
    };
  },

  toHaveExitCode(received, expectedCode) {
    const pass = received && received.exitCode === expectedCode;
    return {
      pass,
      message: () => `Expected exit code ${expectedCode}, got ${received?.exitCode}`,
    };
  },

  async toCompleteWithin(received, maxMs) {
    const start = Date.now();
    try {
      await received;
      const duration = Date.now() - start;
      const pass = duration <= maxMs;

      return {
        pass,
        message: () => `Expected operation to complete within ${maxMs}ms, took ${duration}ms`,
      };
    } catch (error) {
      return {
        pass: false,
        message: () => `Operation failed with error: ${error}`,
      };
    }
  },
});

// Test helper functions
export const testHelpers = {
  getTempDir: () => testTempDir,

  createTempFile: async (filename: string, content: string) => {
    const filePath = path.join(testTempDir, filename);
    await fs.writeFile(filePath, content, "utf8");
    return filePath;
  },

  expectProcessCleanup: async () => {
    // Wait for any background processes to cleanup
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check for resource leaks (if running with --expose-gc)
    if (global.gc) {
      const initialMemory = process.memoryUsage();
      global.gc();
      const afterGcMemory = process.memoryUsage();

      // Memory should not increase significantly during tests
      const heapGrowth = afterGcMemory.heapUsed - initialMemory.heapUsed;
      if (heapGrowth > 50 * 1024 * 1024) {
        // 50MB threshold
        console.warn(
          `Potential memory leak detected: ${Math.round(heapGrowth / 1024 / 1024)}MB heap growth`
        );
      }
    }
  },
};
