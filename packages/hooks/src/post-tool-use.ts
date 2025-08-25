/**
 * Post-Tool-Use Hook for Windows Claude Tools Development (TypeScript)
 * Automatically format, compile, and test code changes
 */

import { spawn, SpawnOptions } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

interface HookInput {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: {
    file_path?: string;
    content?: string;
    command?: string;
  };
}

interface HookResponse {
  continue?: boolean;
  suppressOutput?: boolean;
  message?: string;
  hookSpecificOutput?: Record<string, any>;
}

interface CommandResult {
  status: 'success' | 'failed' | 'timeout' | 'error' | 'skipped' | 'unavailable' | 'partial';
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  reason?: string;
  [key: string]: any;
}

class PostDevelopmentHook {
  private readonly CLAUDE_TOOLS_DIR = path.join(os.homedir(), '.claude', 'windows');
  private readonly BIOME_CONFIG = path.join(this.CLAUDE_TOOLS_DIR, 'biome.json');
  private readonly SWC_CONFIG = path.join(this.CLAUDE_TOOLS_DIR, '.swcrc');
  
  private inputData: HookInput = {};
  private toolInput: HookInput['tool_input'] = {};
  private filePath = '';

  constructor() {
    // Constructor is sync, loading happens in processCompletion
  }

  private async loadInput(): Promise<void> {
    try {
      const stdinData = await this.readStdin();
      this.inputData = JSON.parse(stdinData);
      // Tool name loaded but not used in post-hook
      this.toolInput = this.inputData.tool_input || {};
      this.filePath = this.toolInput.file_path || '';
    } catch (error) {
      // Silent error handling - no console output
    }
  }

  private readStdin(): Promise<string> {
    return new Promise((resolve) => {
      let data = '';
      process.stdin.on('data', (chunk) => {
        data += chunk;
      });
      process.stdin.on('end', () => {
        resolve(data);
      });
    });
  }


  private success(message = '', data?: Record<string, any>): never {
    const response: HookResponse = {
      continue: true,
      suppressOutput: false
    };
    
    if (message) response.message = message;
    if (data) response.hookSpecificOutput = data;
    
    console.log(JSON.stringify(response));
    process.exit(0);
  }

  private isTypeScriptFile(): boolean {
    return this.filePath.endsWith('.ts') || this.filePath.endsWith('.tsx');
  }

  private isTestFile(): boolean {
    return this.filePath.includes('test') && 
           (this.filePath.endsWith('.test.ts') || this.filePath.endsWith('.spec.ts'));
  }

  private isWindowsToolsProject(): boolean {
    return this.filePath.includes(this.CLAUDE_TOOLS_DIR) || 
           this.filePath.toLowerCase().includes('claude');
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async runCommand(command: string, args: string[], options: SpawnOptions = {}): Promise<CommandResult> {
    return new Promise((resolve) => {
      const child = spawn(command, args, { 
        ...options,
        timeout: options.timeout || 120000, // Default 2 minutes
        windowsHide: true 
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const timer = setTimeout(() => {
        child.kill();
        resolve({ status: 'timeout', reason: 'Command timed out' });
      }, options.timeout || 120000);

      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          status: code === 0 ? 'success' : 'failed',
          stdout,
          stderr,
          exitCode: code || 0
        });
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        if (error.message.includes('ENOENT')) {
          resolve({ status: 'unavailable', reason: `${command} not installed` });
        } else {
          resolve({ status: 'error', reason: error.message });
        }
      });
    });
  }

  private async runBiomeFormat(): Promise<CommandResult> {
    if (!(await this.fileExists(this.BIOME_CONFIG)) || !(await this.fileExists(this.filePath))) {
      return { status: 'skipped', reason: 'Config or file not found' };
    }

    const result = await this.runCommand('biome', [
      'format',
      '--write',
      '--config-path',
      this.BIOME_CONFIG,
      this.filePath
    ], { timeout: 30000 });

    return {
      ...result,
      formatted: result.status === 'success'
    };
  }

  private async runBiomeLintFix(): Promise<CommandResult> {
    if (!(await this.fileExists(this.BIOME_CONFIG)) || !(await this.fileExists(this.filePath))) {
      return { status: 'skipped', reason: 'Config or file not found' };
    }

    const result = await this.runCommand('biome', [
      'lint',
      '--apply',
      '--config-path',
      this.BIOME_CONFIG,
      this.filePath
    ], { timeout: 30000 });

    return {
      ...result,
      status: result.status === 'success' ? 'success' : 'partial',
      fixes_applied: result.stdout?.toLowerCase().includes('applied') || false
    };
  }

  private async compileWithSwc(): Promise<CommandResult> {
    if (!(await this.fileExists(this.SWC_CONFIG)) || !(await this.fileExists(this.filePath))) {
      return { status: 'skipped', reason: 'Config or file not found' };
    }

    // Create temporary output file
    const tmpFile = path.join(os.tmpdir(), `swc-compile-${Date.now()}.js`);

    try {
      const result = await this.runCommand('swc', [
        this.filePath,
        '-o',
        tmpFile,
        '--config-file',
        this.SWC_CONFIG
      ], { timeout: 30000 });

      // Get compiled file size
      let compiledSize = 0;
      if (await this.fileExists(tmpFile)) {
        const stats = await fs.stat(tmpFile);
        compiledSize = stats.size;
        await fs.unlink(tmpFile);
      }

      return {
        ...result,
        compiled: result.status === 'success',
        compiled_size: compiledSize
      };
    } catch (error) {
      return { status: 'error', reason: String(error) };
    }
  }

  private async runRelevantTests(): Promise<CommandResult> {
    if (!this.isWindowsToolsProject() || !(await this.fileExists(this.CLAUDE_TOOLS_DIR))) {
      return { status: 'skipped', reason: 'Not in Windows tools project' };
    }

    // Determine which tests to run based on the modified file
    const testCommands: string[] = [];
    
    const relativePath = path.relative(this.CLAUDE_TOOLS_DIR, this.filePath);
    
    if (relativePath.includes('command-fixer')) {
      testCommands.push(
        '../test/unit/command-fixer.test.ts',
        '../test/integration/bash-compatibility.test.ts'
      );
    } else if (relativePath.includes('shell-resolver')) {
      testCommands.push('../test/unit/shell-resolver.test.ts');
    } else if (relativePath.includes('executor')) {
      testCommands.push(
        '../test/unit/*executor*.test.ts',
        '../test/performance/command-fixer-threading.test.ts'
      );
    } else if (this.isTestFile()) {
      // If it's a test file, run just that test
      testCommands.push(relativePath);
    }

    if (testCommands.length === 0) {
      return { status: 'skipped', reason: 'No relevant tests identified' };
    }

    const result = await this.runCommand('npm', ['run', 'test', ...testCommands], {
      cwd: this.CLAUDE_TOOLS_DIR,
      timeout: 120000
    });

    // Parse test results
    const stdout = result.stdout || '';
    const testsRun = (stdout.match(/✓/g) || []).length + (stdout.match(/✗/g) || []).length;
    const testsPassed = (stdout.match(/✓/g) || []).length;
    const testsFailed = (stdout.match(/✗/g) || []).length;

    return {
      ...result,
      stdout: stdout.slice(-1500), // Last 1500 chars
      stderr: result.stderr?.slice(-500) || '',
      tests_passed: result.status === 'success',
      tests_run: testsRun,
      passed_count: testsPassed,
      failed_count: testsFailed,
      test_files: testCommands
    };
  }

  private async updateBuildArtifacts(): Promise<CommandResult> {
    if (!this.isWindowsToolsProject() || !(await this.fileExists(this.CLAUDE_TOOLS_DIR))) {
      return { status: 'skipped', reason: 'Not in Windows tools project' };
    }

    const result = await this.runCommand('npm', ['run', 'build'], {
      cwd: this.CLAUDE_TOOLS_DIR,
      timeout: 60000
    });

    return {
      ...result,
      stdout: result.stdout?.slice(-800) || '', // Last 800 chars
      stderr: result.stderr?.slice(-400) || '',
      build_successful: result.status === 'success'
    };
  }

  private async generateDocumentationIfNeeded(): Promise<CommandResult> {
    if (!this.isWindowsToolsProject()) {
      return { status: 'skipped', reason: 'Not in Windows tools project' };
    }

    // Check if this is a main API file that might need doc updates
    const apiFiles = ['main.ts', 'types.ts', 'command-executor.ts'];
    if (!apiFiles.some(apiFile => this.filePath.includes(apiFile))) {
      return { status: 'skipped', reason: 'Not an API file' };
    }

    const result = await this.runCommand('npx', ['typedoc', '--out', 'docs', 'src/main.ts'], {
      cwd: this.CLAUDE_TOOLS_DIR,
      timeout: 45000
    });

    return {
      ...result,
      docs_generated: result.status === 'success',
      output_dir: 'docs'
    };
  }

  async processCompletion(): Promise<void> {
    await this.loadInput();

    // Only process TypeScript files in our project
    if (!(this.isTypeScriptFile() && this.isWindowsToolsProject())) {
      this.success('No post-processing needed');
    }

    // Silent processing - no console output

    const results: Record<string, CommandResult> = {};

    // 1. Format code with Biome
    const formatResult = await this.runBiomeFormat();
    results.format = formatResult;
    // Silent formatting result - no console output

    // 2. Apply linting fixes
    const lintResult = await this.runBiomeLintFix();
    results.lint = lintResult;
    // Silent linting result - no console output

    // 3. Compile with SWC to verify
    const compileResult = await this.compileWithSwc();
    results.compile = compileResult;
    // Silent compilation result - no console output

    // 4. Run relevant tests (only for non-test files to avoid recursion)
    if (!this.isTestFile()) {
      const testResult = await this.runRelevantTests();
      results.tests = testResult;
      // Silent test result - no console output
    }

    // 5. Update build artifacts
    const buildResult = await this.updateBuildArtifacts();
    results.build = buildResult;
    // Silent build result - no console output

    // 6. Generate documentation for API changes
    const docsResult = await this.generateDocumentationIfNeeded();
    results.documentation = docsResult;

    // Summary
    const successfulOperations = Object.values(results).filter(
      r => ['success', 'skipped'].includes(r.status)
    ).length;
    const totalOperations = Object.keys(results).length;

    this.success(
      `Post-processing complete: ${successfulOperations}/${totalOperations} operations successful`,
      {
        hookEventName: 'PostToolUse',
        processResults: results,
        summary: {
          file: path.basename(this.filePath),
          operations: totalOperations,
          successful: successfulOperations,
          formatted: formatResult.formatted || false,
          compiled: compileResult.compiled || false,
          tests_passed: results.tests?.tests_passed || null
        }
      }
    );
  }
}

async function main(): Promise<void> {
  const hook = new PostDevelopmentHook();
  await hook.processCompletion();
}

if (require.main === module) {
  // Suppress all unhandled rejection warnings
  process.removeAllListeners('unhandledRejection');
  process.removeAllListeners('uncaughtException');
  process.on('unhandledRejection', () => process.exit(1));
  process.on('uncaughtException', () => process.exit(1));
  
  main().catch(() => {
    // Silent error handling - no console output
    process.exit(1);
  });
}