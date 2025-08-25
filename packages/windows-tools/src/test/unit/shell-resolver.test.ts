import { describe, test, expect, beforeEach, vi } from "vitest";
import { ShellResolver } from "../../src/shell-resolver.js";
import { createCommandString } from "../../src/types.js";

describe("ShellResolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Command Detection", () => {
    test("detects PowerShell commands correctly", () => {
      const powerShellCommands = [
        "Get-Process",
        "Set-Location C:\\test",
        "New-Item -Type File",
        "Remove-Item test.txt",
        "$PSVersionTable",
        "Import-Module TestModule",
        "Get-ChildItem | Where-Object {$_.Name -eq 'test'}",
      ];

      powerShellCommands.forEach(command => {
        const shell = ShellResolver.resolve(createCommandString(command));
        expect(shell.type).toBe("powershell");
        expect(shell.shell).toContain("powershell.exe");
        expect(shell.args).toEqual(["-NoProfile", "-Command"]);
      });
    });

    test("detects WSL commands correctly", () => {
      const wslCommands = [
        "wsl ls -la",
        "wsl cd /home/user && ls",
        "wsl --distribution Ubuntu",
        "/mnt/c/Users/test",
        "\\wsl.localhost\\Ubuntu\\home",
      ];

      wslCommands.forEach(command => {
        const shell = ShellResolver.resolve(createCommandString(command));
        expect(shell.type).toBe("wsl");
        expect(shell.shell).toContain("wsl.exe");
        expect(shell.args).toEqual(["--", "bash", "-c"]);
      });
    });

    test("detects Node.js commands correctly", () => {
      const nodeCommands = [
        "npm install",
        "npx create-react-app",
        "node server.js",
        "yarn add package",
        "pnpm install",
        "npm run build && npm test",
      ];

      nodeCommands.forEach(command => {
        const shell = ShellResolver.resolve(createCommandString(command));
        expect(shell.type).toBe("cmd");
        expect(shell.shell).toContain("cmd.exe");
        expect(shell.args).toEqual(["/c"]);
      });
    });

    test("detects Git commands correctly", () => {
      const gitCommands = [
        "git status",
        "git commit -m 'test'",
        "git push origin main",
        "git log --oneline",
      ];

      gitCommands.forEach(command => {
        const shell = ShellResolver.resolve(createCommandString(command));
        expect(shell.type).toBe("cmd");
        expect(shell.shell).toContain("cmd.exe");
        expect(shell.args).toEqual(["/c"]);
      });
    });

    test("detects Python/UV commands correctly", () => {
      const pythonCommands = [
        "python script.py",
        "python3 -m pip install",
        "py -3.9 script.py",
        "uv pip install package",
        "uv run python script.py",
      ];

      pythonCommands.forEach(command => {
        const shell = ShellResolver.resolve(createCommandString(command));
        expect(shell.type).toBe("cmd");
        expect(shell.shell).toContain("cmd.exe");
        expect(shell.args).toEqual(["/c"]);
      });
    });

    test("detects Docker commands correctly", () => {
      const dockerCommands = [
        "docker ps",
        "docker build -t myapp .",
        "docker run -p 3000:3000 myapp",
        "docker-compose up",
      ];

      dockerCommands.forEach(command => {
        const shell = ShellResolver.resolve(createCommandString(command));
        expect(shell.type).toBe("cmd");
        expect(shell.shell).toContain("cmd.exe");
        expect(shell.args).toEqual(["/c"]);
      });
    });

    test("defaults to CMD for unrecognized commands", () => {
      const genericCommands = [
        "echo hello",
        "dir",
        "type file.txt",
        "copy source dest",
        "unknown-command",
      ];

      genericCommands.forEach(command => {
        const shell = ShellResolver.resolve(createCommandString(command));
        expect(shell.type).toBe("cmd");
        expect(shell.shell).toContain("cmd.exe");
        expect(shell.args).toEqual(["/c"]);
      });
    });
  });

  describe("Shell Configuration Override", () => {
    test("respects explicit shell type override", () => {
      const command = createCommandString("echo test");
      
      const cmdShell = ShellResolver.resolve(command, "cmd");
      expect(cmdShell.type).toBe("cmd");
      expect(cmdShell.shell).toContain("cmd.exe");

      const powershellShell = ShellResolver.resolve(command, "powershell");
      expect(powershellShell.type).toBe("powershell");
      expect(powershellShell.shell).toContain("powershell.exe");

      const wslShell = ShellResolver.resolve(command, "wsl");
      expect(wslShell.type).toBe("wsl");
      expect(wslShell.shell).toContain("wsl.exe");

      const pwshShell = ShellResolver.resolve(command, "pwsh");
      expect(pwshShell.type).toBe("pwsh");
      expect(pwshShell.shell).toContain("pwsh.exe");
    });

    test("override takes precedence over command detection", () => {
      // PowerShell command forced to run in CMD
      const psCommand = createCommandString("Get-Process");
      const cmdShell = ShellResolver.resolve(psCommand, "cmd");
      expect(cmdShell.type).toBe("cmd");

      // CMD command forced to run in PowerShell
      const cmdCommand = createCommandString("dir");
      const psShell = ShellResolver.resolve(cmdCommand, "powershell");
      expect(psShell.type).toBe("powershell");
    });
  });

  describe("Complex Command Analysis", () => {
    test("handles compound commands with mixed shell indicators", () => {
      const command = createCommandString("echo start && Get-Process && echo end");
      const shell = ShellResolver.resolve(command);
      // Should detect PowerShell due to Get-Process
      expect(shell.type).toBe("powershell");
    });

    test("handles commands with quoted arguments", () => {
      const command = createCommandString('Get-Process | Where-Object {$_.Name -eq "notepad"}');
      const shell = ShellResolver.resolve(command);
      expect(shell.type).toBe("powershell");
    });

    test("handles multiline commands", () => {
      const command = createCommandString(`Get-Process |
        Where-Object {$_.WorkingSet -gt 100MB} |
        Sort-Object WorkingSet -Descending`);
      const shell = ShellResolver.resolve(command);
      expect(shell.type).toBe("powershell");
    });

    test("handles commands with environment variables", () => {
      const command = createCommandString("echo %PATH% && $env:PATH");
      const shell = ShellResolver.resolve(command);
      // Should detect PowerShell due to $env:PATH syntax
      expect(shell.type).toBe("powershell");
    });
  });

  describe("Shell Configuration Validation", () => {
    test("CMD shell config has correct structure", () => {
      const shell = ShellResolver.resolve(createCommandString("dir"), "cmd");
      expect(shell.shell).toBeTruthy();
      expect(shell.args).toBeInstanceOf(Array);
      expect(shell.args).toEqual(["/c"]);
      expect(shell.type).toBe("cmd");
    });

    test("PowerShell shell config has correct structure", () => {
      const shell = ShellResolver.resolve(createCommandString("Get-Process"), "powershell");
      expect(shell.shell).toBeTruthy();
      expect(shell.args).toBeInstanceOf(Array);
      expect(shell.args).toEqual(["-NoProfile", "-Command"]);
      expect(shell.type).toBe("powershell");
    });

    test("WSL shell config has correct structure", () => {
      const shell = ShellResolver.resolve(createCommandString("ls"), "wsl");
      expect(shell.shell).toBeTruthy();
      expect(shell.args).toBeInstanceOf(Array);
      expect(shell.args).toEqual(["--", "bash", "-c"]);
      expect(shell.type).toBe("wsl");
    });

    test("PowerShell Core shell config has correct structure", () => {
      const shell = ShellResolver.resolve(createCommandString("Get-Process"), "pwsh");
      expect(shell.shell).toBeTruthy();
      expect(shell.args).toBeInstanceOf(Array);
      expect(shell.args).toEqual(["-NoProfile", "-Command"]);
      expect(shell.type).toBe("pwsh");
    });
  });

  describe("Performance and Caching", () => {
    test("handles repeated calls efficiently", () => {
      const command = createCommandString("Get-Process");
      const startTime = Date.now();
      
      // Multiple calls should be fast due to caching/optimization
      for (let i = 0; i < 50; i++) {
        ShellResolver.resolve(command);
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50); // Should be very fast
    });

    test("returns consistent results for same input", () => {
      const command = createCommandString("npm install");
      const result1 = ShellResolver.resolve(command);
      const result2 = ShellResolver.resolve(command);
      
      expect(result1.type).toBe(result2.type);
      expect(result1.shell).toBe(result2.shell);
      expect(result1.args).toEqual(result2.args);
    });
  });

  describe("Edge Cases", () => {
    test("handles empty commands", () => {
      const shell = ShellResolver.resolve(createCommandString(""));
      expect(shell.type).toBe("cmd");
      expect(shell.shell).toContain("cmd.exe");
    });

    test("handles whitespace-only commands", () => {
      const shell = ShellResolver.resolve(createCommandString("   "));
      expect(shell.type).toBe("cmd");
      expect(shell.shell).toContain("cmd.exe");
    });

    test("handles commands with only operators", () => {
      const shell = ShellResolver.resolve(createCommandString("&&"));
      expect(shell.type).toBe("cmd");
      expect(shell.shell).toContain("cmd.exe");
    });

    test("handles very long commands", () => {
      const longCommand = "Get-Process " + "test ".repeat(1000);
      const shell = ShellResolver.resolve(createCommandString(longCommand));
      expect(shell.type).toBe("powershell");
    });

    test("handles commands with special characters", () => {
      const command = createCommandString("Get-Process | ?{$_.Name -match 'note.*'}");
      const shell = ShellResolver.resolve(command);
      expect(shell.type).toBe("powershell");
    });

    test("handles Unicode characters in commands", () => {
      const command = createCommandString("echo 你好世界 && Get-Process");
      const shell = ShellResolver.resolve(command);
      expect(shell.type).toBe("powershell");
    });
  });

  describe("Pattern Matching Accuracy", () => {
    test("PowerShell detection patterns are precise", () => {
      // These should NOT be detected as PowerShell
      const notPowerShell = [
        "get-process.exe", // executable name, not cmdlet
        "echo Get-Process", // quoted/echoed
        "# Get-Process", // commented
        "//Get-Process", // commented differently
      ];

      notPowerShell.forEach(command => {
        const shell = ShellResolver.resolve(createCommandString(command));
        expect(shell.type).toBe("cmd");
      });
    });

    test("WSL detection patterns are precise", () => {
      // These should be detected as WSL
      const wslCommands = [
        "wsl ls",
        "wsl --exec ls",
        "/mnt/c/test",
        "\\\\wsl.localhost\\Ubuntu",
      ];

      wslCommands.forEach(command => {
        const shell = ShellResolver.resolve(createCommandString(command));
        expect(shell.type).toBe("wsl");
      });

      // These should NOT be detected as WSL
      const notWsl = [
        "echo wsl",
        "mywsl command",
        "test/mnt/something",
      ];

      notWsl.forEach(command => {
        const shell = ShellResolver.resolve(createCommandString(command));
        expect(shell.type).toBe("cmd");
      });
    });
  });
});