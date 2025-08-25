#!/usr/bin/env node
import { WindowsClaudeTools } from "./main.js";

async function main(): Promise<void> {
  const tools = new WindowsClaudeTools();
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Windows Claude Tools - Modular Command Runner");
    console.log("Usage:");
    console.log("  npm run cli exec <command>     - Execute command with auto-fixes");
    console.log("  npm run cli pwsh <command>     - Execute PowerShell command");
    console.log("  npm run cli wsl <command>      - Execute WSL command");
    console.log("  npm run cli test-gcp          - Test GCP authentication");
    console.log("  npm run cli sysinfo           - Show system information");
    return;
  }

  const command = args[0];
  const commandArgs = args.slice(1).join(" ");

  try {
    switch (command) {
      case "exec": {
        const result = await tools.executeCommand(commandArgs);
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case "pwsh": {
        const result = await tools.executePowerShell(commandArgs);
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case "wsl": {
        const result = await tools.executeWSL(commandArgs);
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case "test-gcp": {
        const result = await tools.testGCPAuth();
        console.log(result.summary);
        console.log("\nDetailed Results:");
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case "sysinfo": {
        const info = await tools.getSystemInfo();
        console.log(JSON.stringify(info, null, 2));
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
