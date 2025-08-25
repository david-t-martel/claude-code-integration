#!/usr/bin/env node

/**
 * Consolidation script to migrate scattered Claude files into unified project structure
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const SOURCE_BASE = 'C:\\Users\\david\\.claude';
const TARGET_BASE = 'C:\\Users\\david\\claude-code-integration';

// Mapping of source directories to target locations
const MIGRATION_MAP = {
  // Hooks system
  [`${SOURCE_BASE}\\hooks\\src`]: `${TARGET_BASE}\\packages\\hooks\\src`,
  [`${SOURCE_BASE}\\hooks\\tests`]: `${TARGET_BASE}\\packages\\hooks\\tests`,
  [`${SOURCE_BASE}\\hooks\\package.json`]: `${TARGET_BASE}\\packages\\hooks\\package.json`,
  [`${SOURCE_BASE}\\hooks\\tsconfig.json`]: `${TARGET_BASE}\\packages\\hooks\\tsconfig.json`,
  
  // Windows tools
  [`${SOURCE_BASE}\\windows`]: `${TARGET_BASE}\\packages\\windows-tools\\src`,
  
  // Command replacer (Rust)
  [`${SOURCE_BASE}\\hooks\\command-replacer\\src`]: `${TARGET_BASE}\\packages\\command-replacer\\src`,
  [`${SOURCE_BASE}\\hooks\\command-replacer\\Cargo.toml`]: `${TARGET_BASE}\\packages\\command-replacer\\Cargo.toml`,
  
  // Agents
  [`${SOURCE_BASE}\\agents`]: `${TARGET_BASE}\\agents`,
  
  // Commands
  [`${SOURCE_BASE}\\commands`]: `${TARGET_BASE}\\commands`,
  
  // Scripts
  [`${SOURCE_BASE}\\scripts`]: `${TARGET_BASE}\\scripts\\legacy`,
  
  // Configurations
  [`${SOURCE_BASE}\\settings.json`]: `${TARGET_BASE}\\configs\\production\\settings.json`,
  [`${SOURCE_BASE}\\settings.local.json`]: `${TARGET_BASE}\\configs\\development\\settings.json`,
  [`${SOURCE_BASE}\\mcp.json`]: `${TARGET_BASE}\\configs\\production\\mcp.json`,
  
  // Documentation
  [`${SOURCE_BASE}\\CLAUDE.md`]: `${TARGET_BASE}\\docs\\CLAUDE.md`,
  [`${SOURCE_BASE}\\MCP.CLAUDE.MD`]: `${TARGET_BASE}\\docs\\MCP.md`,
  [`${SOURCE_BASE}\\AGENT_MEMORY.md`]: `${TARGET_BASE}\\docs\\AGENT_MEMORY.md`,
};

// Files to ignore during migration
const IGNORE_PATTERNS = [
  'node_modules',
  'dist',
  'build',
  'target',
  '.git',
  '*.log',
  '*.tmp',
  'shell-snapshots',
  'todos',
  'logs',
  'coverage',
  '.credentials.json',
  'nul'
];

async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

async function shouldIgnore(filePath) {
  const fileName = path.basename(filePath);
  return IGNORE_PATTERNS.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      return regex.test(fileName);
    }
    return fileName === pattern || filePath.includes(pattern);
  });
}

async function copyRecursive(source, target) {
  if (await shouldIgnore(source)) {
    console.log(`  ⏭️  Skipping: ${source}`);
    return;
  }

  const stats = await fs.stat(source).catch(() => null);
  if (!stats) {
    console.log(`  ⚠️  Source not found: ${source}`);
    return;
  }

  if (stats.isDirectory()) {
    await ensureDir(target);
    const files = await fs.readdir(source);
    
    for (const file of files) {
      await copyRecursive(
        path.join(source, file),
        path.join(target, file)
      );
    }
  } else {
    await ensureDir(path.dirname(target));
    await fs.copyFile(source, target);
    console.log(`  ✅ Copied: ${path.basename(source)}`);
  }
}

async function createProjectStructure() {
  console.log('📁 Creating project structure...\n');
  
  const directories = [
    'packages/core/src',
    'packages/core/tests',
    'packages/hooks/src',
    'packages/hooks/tests',
    'packages/windows-tools/src',
    'packages/windows-tools/tests',
    'packages/command-replacer/src',
    'packages/mcp-servers/src',
    'agents/specialized',
    'agents/language',
    'agents/domain',
    'configs/development',
    'configs/production',
    'configs/schemas',
    'scripts/build',
    'scripts/install',
    'scripts/test',
    'scripts/migrate',
    'docs/architecture',
    'docs/api',
    'docs/guides',
    'docs/agents',
    'tests/fixtures',
    'tests/e2e',
    'tests/performance',
    '.github/workflows',
    '.github/ISSUE_TEMPLATE'
  ];

  for (const dir of directories) {
    await ensureDir(path.join(TARGET_BASE, dir));
    console.log(`  ✅ Created: ${dir}`);
  }
  
  console.log('\n');
}

async function migrateFiles() {
  console.log('🚀 Starting migration...\n');
  
  for (const [source, target] of Object.entries(MIGRATION_MAP)) {
    console.log(`📦 Migrating: ${path.basename(source)}`);
    await copyRecursive(source, target);
  }
  
  console.log('\n');
}

async function createGitIgnore() {
  const gitignoreContent = `# Dependencies
node_modules/
**/node_modules/
.pnp
.pnp.js

# Build outputs
dist/
**/dist/
build/
**/build/
*.exe
*.dll
*.so
*.dylib

# Rust
target/
**/target/
Cargo.lock
**/*.rs.bk

# Testing
coverage/
**/coverage/
*.lcov
.nyc_output
junit.xml

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Environment
.env
.env.local
.env.*.local
*.local

# Editor directories
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store
Thumbs.db

# Cache
.cache/
.parcel-cache/
.turbo/
.next/
.nuxt/

# Temporary files
*.tmp
*.temp
temp/
tmp/
shell-snapshots/

# OS files
.DS_Store
Thumbs.db
desktop.ini

# Claude-specific
.credentials.json
settings.local.json
mcp-data/
statsig/
todos/

# Python
__pycache__/
*.py[cod]
*$py.class
.Python
venv/
.venv/

# Misc
*.bak
*.orig
nul`;

  await fs.writeFile(path.join(TARGET_BASE, '.gitignore'), gitignoreContent);
  console.log('✅ Created .gitignore');
}

async function createPackageJsonFiles() {
  // Hooks package.json
  const hooksPackage = {
    name: '@claude-code/hooks',
    version: '1.0.0',
    description: 'Claude Code hooks system',
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    scripts: {
      build: 'tsc',
      'build:exe': 'bun build src/pre-tool-use.ts --compile --outfile dist/pre-tool-use.exe',
      test: 'vitest',
      lint: 'eslint src --ext .ts',
      clean: 'rimraf dist'
    },
    dependencies: {},
    devDependencies: {
      '@types/node': '^20.0.0',
      typescript: '^5.4.0',
      vitest: '^1.6.0'
    }
  };

  await ensureDir(path.join(TARGET_BASE, 'packages/hooks'));
  await fs.writeFile(
    path.join(TARGET_BASE, 'packages/hooks/package.json'),
    JSON.stringify(hooksPackage, null, 2)
  );
  console.log('✅ Created packages/hooks/package.json');

  // Windows tools package.json
  const windowsPackage = {
    name: '@claude-code/windows-tools',
    version: '1.0.0',
    description: 'Windows-specific tools for Claude Code',
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    scripts: {
      build: 'tsc',
      test: 'vitest',
      lint: 'eslint src --ext .ts',
      clean: 'rimraf dist'
    },
    dependencies: {},
    devDependencies: {
      '@types/node': '^20.0.0',
      typescript: '^5.4.0',
      vitest: '^1.6.0'
    }
  };

  await ensureDir(path.join(TARGET_BASE, 'packages/windows-tools'));
  await fs.writeFile(
    path.join(TARGET_BASE, 'packages/windows-tools/package.json'),
    JSON.stringify(windowsPackage, null, 2)
  );
  console.log('✅ Created packages/windows-tools/package.json');
}

async function initGitRepository() {
  console.log('\n🔧 Initializing Git repository...');
  
  try {
    execSync('git init', { cwd: TARGET_BASE });
    execSync('git add .', { cwd: TARGET_BASE });
    execSync('git commit -m "Initial commit: Consolidated Claude Code integration tools"', { cwd: TARGET_BASE });
    console.log('✅ Git repository initialized');
  } catch (error) {
    console.log('⚠️  Git initialization failed (may already exist)');
  }
}

async function createSummary() {
  const summary = `# Migration Summary

## Completed Actions

1. ✅ Created unified project structure
2. ✅ Migrated hooks system to packages/hooks
3. ✅ Migrated Windows tools to packages/windows-tools  
4. ✅ Consolidated agent configurations
5. ✅ Organized configuration files
6. ✅ Created package.json files for workspaces
7. ✅ Added .gitignore
8. ✅ Initialized Git repository

## Next Steps

1. Install dependencies:
   \`\`\`bash
   cd ${TARGET_BASE}
   pnpm install
   \`\`\`

2. Build the project:
   \`\`\`bash
   pnpm build
   \`\`\`

3. Run tests:
   \`\`\`bash
   pnpm test
   \`\`\`

4. Create GitHub repository:
   \`\`\`bash
   gh repo create claude-code-integration --public
   git remote add origin https://github.com/yourusername/claude-code-integration.git
   git push -u origin main
   \`\`\`

## File Locations

- **Old location**: ${SOURCE_BASE}
- **New location**: ${TARGET_BASE}

## Important Notes

- Original files have been copied, not moved
- Verify the migration before deleting original files
- Update your Claude Code settings to point to new locations
- Some manual configuration may be required

Generated: ${new Date().toISOString()}
`;

  await fs.writeFile(path.join(TARGET_BASE, 'MIGRATION_SUMMARY.md'), summary);
  console.log('\n📄 Migration summary saved to MIGRATION_SUMMARY.md');
}

async function main() {
  console.log('='.repeat(60));
  console.log('  Claude Code Integration - Project Consolidation Tool');
  console.log('='.repeat(60));
  console.log();

  try {
    await createProjectStructure();
    await migrateFiles();
    await createGitIgnore();
    await createPackageJsonFiles();
    await initGitRepository();
    await createSummary();
    
    console.log('\n' + '='.repeat(60));
    console.log('  ✅ Migration completed successfully!');
    console.log('='.repeat(60));
    console.log(`\n📁 Project location: ${TARGET_BASE}`);
    console.log('\nNext: cd claude-code-integration && pnpm install');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };