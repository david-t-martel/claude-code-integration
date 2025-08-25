import { describe, test, expect, beforeEach, vi } from "vitest";
import { CommandFixer } from "../../src/command-fixer.js";
import { createCommandString } from "../../src/types.js";

describe("CommandFixer", () => {
  beforeEach(() => {
    // Clear any potential caches between tests
    vi.clearAllMocks();
  });

  describe("Basic Functionality", () => {
    test("returns empty string for empty input", () => {
      expect(CommandFixer.fix("")).toBe("");
    });

    test("returns original command for null/undefined input", () => {
      expect(CommandFixer.fix(null as any)).toBe("");
      expect(CommandFixer.fix(undefined as any)).toBe("");
    });

    test("returns original command if no fixes needed", () => {
      const command = "echo hello";
      expect(CommandFixer.fix(command)).toBe(command);
    });
  });

  describe("Unix to Windows Operator Conversion", () => {
    test("converts && to ;", () => {
      const input = "echo hello && echo world";
      const expected = "echo hello ; echo world";
      expect(CommandFixer.fix(input)).toBe(expected);
    });

    test("converts multiple && operators", () => {
      const input = "cmd1 && cmd2 && cmd3";
      const expected = "cmd1 ; cmd2 ; cmd3";
      expect(CommandFixer.fix(input)).toBe(expected);
    });

    test("preserves single & operators", () => {
      const input = "echo hello & echo world";
      expect(CommandFixer.fix(input)).toBe(input);
    });

    test("handles mixed operators correctly", () => {
      const input = "cmd1 && cmd2 & cmd3 && cmd4";
      const expected = "cmd1 ; cmd2 & cmd3 ; cmd4";
      expect(CommandFixer.fix(input)).toBe(expected);
    });
  });

  describe("Path Conversion", () => {
    test("converts Unix paths to Windows paths", () => {
      const input = "/c/Users/test/file.txt";
      const expected = "C:\\\\Users\\test\\file.txt";
      expect(CommandFixer.fix(input)).toBe(expected);
    });

    test("converts multiple Unix paths", () => {
      const input = "copy /c/source/file.txt /d/destination/file.txt";
      const expected = "copy C:\\\\source\\file.txt D:\\\\destination\\file.txt";
      expect(CommandFixer.fix(input)).toBe(expected);
    });

    test("preserves Windows paths", () => {
      const input = "C:\\Users\\test\\file.txt";
      expect(CommandFixer.fix(input)).toBe(input);
    });

    test("handles mixed path formats", () => {
      const input = "copy C:\\source\\file.txt /d/destination/file.txt";
      const expected = "copy C:\\source\\file.txt D:\\\\destination\\file.txt";
      expect(CommandFixer.fix(input)).toBe(expected);
    });
  });

  describe("PowerShell Command Fixes", () => {
    test("converts pwsh to powershell.exe with proper flags", () => {
      const input = "pwsh -Command Get-Process";
      const expected = "powershell.exe -NoProfile -Command Get-Process";
      expect(CommandFixer.fix(input)).toBe(expected);
    });

    test("handles pwsh without -Command flag", () => {
      const input = "pwsh Get-Process";
      const expected = "powershell.exe -NoProfile -Command Get-Process";
      expect(CommandFixer.fix(input)).toBe(expected);
    });

    test("preserves existing powershell.exe commands", () => {
      const input = "powershell.exe -NoProfile -Command Get-Process";
      expect(CommandFixer.fix(input)).toBe(input);
    });

    test("handles complex PowerShell commands", () => {
      const input = "pwsh -Command \"Get-Process | Where-Object {$_.Name -eq 'notepad'}\"";
      const expected = "powershell.exe -NoProfile -Command \"Get-Process | Where-Object {$_.Name -eq 'notepad'}\"";
      expect(CommandFixer.fix(input)).toBe(expected);
    });
  });

  describe("WSL Path Detection", () => {
    test("detects WSL paths with /mnt/ prefix", () => {
      const input = "/mnt/c/Users/test";
      // Should be converted to Windows path
      const result = CommandFixer.fix(input);
      expect(result).toContain("C:\\\\");
    });

    test("detects wsl command prefix", () => {
      const input = "wsl ls -la";
      // WSL commands should remain unchanged for now
      expect(CommandFixer.fix(input)).toBe(input);
    });

    test("detects \\\\wsl paths", () => {
      const input = "\\\\wsl.localhost\\Ubuntu\\home\\user";
      // Should remain unchanged as it's a valid Windows UNC path
      expect(CommandFixer.fix(input)).toBe(input);
    });
  });

  describe("Complex Command Scenarios", () => {
    test("applies multiple fixes simultaneously", () => {
      const input = "cd /c/project && npm install && /d/tools/build.exe";
      const expected = "cd C:\\\\project ; npm install ; D:\\\\tools\\build.exe";
      expect(CommandFixer.fix(input)).toBe(expected);
    });

    test("handles quoted paths correctly", () => {
      const input = 'echo "hello world" && dir "/c/Program Files"';
      const expected = 'echo "hello world" ; dir "C:\\\\Program Files"';
      expect(CommandFixer.fix(input)).toBe(expected);
    });

    test("preserves command arguments and flags", () => {
      const input = "git status && git commit -m 'fix' && git push";
      const expected = "git status ; git commit -m 'fix' ; git push";
      expect(CommandFixer.fix(input)).toBe(expected);
    });

    test("handles environment variables correctly", () => {
      const input = "echo %PATH% && set NODE_ENV=production";
      const expected = "echo %PATH% ; set NODE_ENV=production";
      expect(CommandFixer.fix(input)).toBe(expected);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    test("handles commands with only whitespace", () => {
      const input = "   ";
      expect(CommandFixer.fix(input)).toBe(input);
    });

    test("handles very long commands", () => {
      const longCommand = "echo " + "a".repeat(1000) + " && echo done";
      const result = CommandFixer.fix(longCommand);
      expect(result).toContain(" ; ");
      expect(result).toHaveLength(longCommand.length); // Should be same length after operator replacement
    });

    test("handles special characters in commands", () => {
      const input = "echo !@#$%^&*() && echo (done)";
      const expected = "echo !@#$%^&*() ; echo (done)";
      expect(CommandFixer.fix(input)).toBe(expected);
    });

    test("handles Unicode characters", () => {
      const input = "echo 你好 && echo こんにちは";
      const expected = "echo 你好 ; echo こんにちは";
      expect(CommandFixer.fix(input)).toBe(expected);
    });

    test("preserves newlines and complex formatting", () => {
      const input = `echo line1 &&
      echo line2`;
      const expected = `echo line1 ;
      echo line2`;
      expect(CommandFixer.fix(input)).toBe(expected);
    });
  });

  describe("Performance and Caching", () => {
    test("returns consistent results for same input", () => {
      const input = "echo hello && echo world";
      const result1 = CommandFixer.fix(input);
      const result2 = CommandFixer.fix(input);
      expect(result1).toBe(result2);
    });

    test("handles rapid successive calls efficiently", () => {
      const input = "test command && another";
      const startTime = Date.now();
      
      // Run multiple fixes in quick succession
      for (let i = 0; i < 100; i++) {
        CommandFixer.fix(input);
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should complete quickly due to caching
    });

    test("handles different inputs without cache conflicts", () => {
      const input1 = "echo hello && echo world";
      const input2 = "dir && type file.txt";
      
      const result1 = CommandFixer.fix(input1);
      const result2 = CommandFixer.fix(input2);
      
      expect(result1).toBe("echo hello ; echo world");
      expect(result2).toBe("dir ; type file.txt");
    });
  });

  describe("Type Safety", () => {
    test("returns CommandString branded type", () => {
      const result = CommandFixer.fix("echo test");
      expect(typeof result).toBe("string");
      // The result should be branded as CommandString
      const commandString = createCommandString("echo test");
      expect(typeof result).toBe(typeof commandString);
    });

    test("accepts string inputs and returns CommandString", () => {
      const input: string = "test command";
      const result = CommandFixer.fix(input);
      expect(typeof result).toBe("string");
    });
  });
});