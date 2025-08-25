# Validate CI/CD Setup Script
param(
    [switch]$Detailed = $false,
    [switch]$Fix = $false
)

$ErrorActionPreference = "Continue"
$validationErrors = @()
$validationWarnings = @()

function Write-Status {
    param($Message, $Status)
    $color = switch ($Status) {
        "OK" { "Green" }
        "WARNING" { "Yellow" }
        "ERROR" { "Red" }
        "INFO" { "Cyan" }
        default { "White" }
    }
    Write-Host "[$Status] $Message" -ForegroundColor $color
}

function Test-FileExists {
    param($Path, $Description)
    if (Test-Path $Path) {
        Write-Status "$Description exists" "OK"
        return $true
    } else {
        Write-Status "$Description missing: $Path" "ERROR"
        $global:validationErrors += "Missing file: $Path"
        return $false
    }
}

function Test-DirectoryStructure {
    Write-Host "`n=== Directory Structure Validation ===" -ForegroundColor Magenta
    
    $requiredDirs = @(
        ".github",
        ".github/workflows", 
        ".github/ISSUE_TEMPLATE",
        "packages",
        "configs",
        "agents",
        "commands",
        "scripts",
        "docs"
    )
    
    foreach ($dir in $requiredDirs) {
        Test-FileExists $dir "Directory $dir"
    }
}

function Test-WorkflowFiles {
    Write-Host "`n=== GitHub Actions Workflows ===" -ForegroundColor Magenta
    
    $workflows = @(
        @{ File = ".github/workflows/ci.yml"; Name = "CI/CD Pipeline" },
        @{ File = ".github/workflows/release.yml"; Name = "Release Automation" },
        @{ File = ".github/workflows/security.yml"; Name = "Security Scanning" },
        @{ File = ".github/workflows/publish-packages.yml"; Name = "Package Publishing" }
    )
    
    foreach ($workflow in $workflows) {
        if (Test-FileExists $workflow.File $workflow.Name) {
            # Validate workflow syntax
            $content = Get-Content $workflow.File -Raw
            if ($content -match "on:" -and $content -match "jobs:") {
                Write-Status "$($workflow.Name) has valid structure" "OK"
            } else {
                Write-Status "$($workflow.Name) has invalid structure" "WARNING"
                $global:validationWarnings += "Invalid workflow structure: $($workflow.File)"
            }
        }
    }
}

function Test-ConfigurationFiles {
    Write-Host "`n=== Configuration Files ===" -ForegroundColor Magenta
    
    $configs = @(
        @{ File = "package.json"; Name = "Root package.json" },
        @{ File = ".github/dependabot.yml"; Name = "Dependabot configuration" },
        @{ File = ".github/CODEOWNERS"; Name = "Code owners" },
        @{ File = "CONTRIBUTING.md"; Name = "Contributing guide" },
        @{ File = "LICENSE"; Name = "License file" }
    )
    
    foreach ($config in $configs) {
        Test-FileExists $config.File $config.Name
    }
    
    # Validate package.json
    if (Test-Path "package.json") {
        try {
            $packageJson = Get-Content "package.json" | ConvertFrom-Json
            if ($packageJson.workspaces) {
                Write-Status "Monorepo workspace configuration found" "OK"
            } else {
                Write-Status "Workspace configuration missing" "WARNING"
            }
            
            if ($packageJson.scripts -and $packageJson.scripts.build) {
                Write-Status "Build script configured" "OK"
            } else {
                Write-Status "Build script missing" "ERROR"
                $global:validationErrors += "Missing build script in package.json"
            }
        } catch {
            Write-Status "Invalid package.json format" "ERROR"
            $global:validationErrors += "Invalid JSON in package.json"
        }
    }
}

function Test-IssueTemplates {
    Write-Host "`n=== Issue and PR Templates ===" -ForegroundColor Magenta
    
    $templates = @(
        ".github/ISSUE_TEMPLATE/bug_report.md",
        ".github/ISSUE_TEMPLATE/feature_request.md",
        ".github/ISSUE_TEMPLATE/security_vulnerability.md",
        ".github/ISSUE_TEMPLATE/config.yml",
        ".github/pull_request_template.md"
    )
    
    foreach ($template in $templates) {
        Test-FileExists $template "Template $(Split-Path $template -Leaf)"
    }
}

function Test-SecurityConfiguration {
    Write-Host "`n=== Security Configuration ===" -ForegroundColor Magenta
    
    # Check Dependabot
    if (Test-Path ".github/dependabot.yml") {
        $dependabot = Get-Content ".github/dependabot.yml" -Raw
        if ($dependabot -match "package-ecosystem.*npm" -and $dependabot -match "package-ecosystem.*github-actions") {
            Write-Status "Dependabot monitors npm and GitHub Actions" "OK"
        } else {
            Write-Status "Dependabot missing ecosystem configurations" "WARNING"
        }
    }
    
    # Check security workflow
    if (Test-Path ".github/workflows/security.yml") {
        $security = Get-Content ".github/workflows/security.yml" -Raw
        $securityFeatures = @("codeql", "snyk", "npm.*audit", "trivy")
        
        foreach ($feature in $securityFeatures) {
            if ($security -match $feature) {
                Write-Status "$feature scanning configured" "OK"
            } else {
                Write-Status "$feature scanning not found" "WARNING"
            }
        }
    }
}

function Test-GitHubRepository {
    Write-Host "`n=== GitHub Repository Status ===" -ForegroundColor Magenta
    
    try {
        # Check if we're in a git repository
        $gitStatus = git status 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Status "Git repository initialized" "OK"
            
            # Check remote origin
            $remotes = git remote -v 2>&1
            if ($remotes -match "github.com.*claude-code-integration") {
                Write-Status "GitHub remote configured" "OK"
            } else {
                Write-Status "GitHub remote not configured properly" "WARNING"
                $global:validationWarnings += "GitHub remote origin not set"
            }
            
            # Check if connected to GitHub
            if (Get-Command gh -ErrorAction SilentlyContinue) {
                $authStatus = gh auth status 2>&1
                if ($authStatus -match "Logged in to github.com") {
                    Write-Status "GitHub CLI authenticated" "OK"
                    
                    # Check repository exists
                    try {
                        $repo = gh api repos/david-t-martel/claude-code-integration 2>&1
                        if ($LASTEXITCODE -eq 0) {
                            Write-Status "Repository exists on GitHub" "OK"
                        } else {
                            Write-Status "Repository not found on GitHub" "ERROR"
                            $global:validationErrors += "Repository not accessible on GitHub"
                        }
                    } catch {
                        Write-Status "Cannot access repository on GitHub" "WARNING"
                    }
                } else {
                    Write-Status "GitHub CLI not authenticated" "WARNING"
                    $global:validationWarnings += "GitHub CLI authentication required"
                }
            } else {
                Write-Status "GitHub CLI not installed" "WARNING"
                $global:validationWarnings += "GitHub CLI recommended for repository management"
            }
        } else {
            Write-Status "Not a Git repository" "ERROR"
            $global:validationErrors += "Git repository not initialized"
        }
    } catch {
        Write-Status "Git validation failed: $($_.Exception.Message)" "ERROR"
        $global:validationErrors += "Git validation error"
    }
}

function Test-DevelopmentEnvironment {
    Write-Host "`n=== Development Environment ===" -ForegroundColor Magenta
    
    # Node.js
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $nodeVersion = node --version
        Write-Status "Node.js version: $nodeVersion" "OK"
    } else {
        Write-Status "Node.js not installed" "ERROR"
        $global:validationErrors += "Node.js is required"
    }
    
    # pnpm
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        $pnpmVersion = pnpm --version
        Write-Status "pnpm version: $pnpmVersion" "OK"
    } else {
        Write-Status "pnpm not installed" "WARNING"
        $global:validationWarnings += "pnpm recommended for package management"
    }
    
    # Check if packages can be installed
    if (Test-Path "package.json") {
        if (Test-Path "node_modules") {
            Write-Status "Dependencies installed" "OK"
        } else {
            Write-Status "Dependencies not installed" "WARNING"
            $global:validationWarnings += "Run 'pnpm install' to install dependencies"
        }
    }
}

function Show-Summary {
    Write-Host "`n=== Validation Summary ===" -ForegroundColor Magenta
    
    if ($validationErrors.Count -eq 0 -and $validationWarnings.Count -eq 0) {
        Write-Host "`n🎉 All validations passed! Your CI/CD setup is complete." -ForegroundColor Green
    } else {
        if ($validationErrors.Count -gt 0) {
            Write-Host "`n❌ Errors found ($($validationErrors.Count)):" -ForegroundColor Red
            foreach ($error in $validationErrors) {
                Write-Host "   • $error" -ForegroundColor Red
            }
        }
        
        if ($validationWarnings.Count -gt 0) {
            Write-Host "`n⚠️  Warnings ($($validationWarnings.Count)):" -ForegroundColor Yellow
            foreach ($warning in $validationWarnings) {
                Write-Host "   • $warning" -ForegroundColor Yellow
            }
        }
        
        if ($validationErrors.Count -eq 0) {
            Write-Host "`n✅ Setup is functional with minor warnings" -ForegroundColor Green
        } else {
            Write-Host "`n🔧 Please address the errors above to complete setup" -ForegroundColor Red
        }
    }
    
    Write-Host "`n📊 Validation Statistics:" -ForegroundColor Cyan
    Write-Host "   Errors: $($validationErrors.Count)" -ForegroundColor $(if ($validationErrors.Count -eq 0) { "Green" } else { "Red" })
    Write-Host "   Warnings: $($validationWarnings.Count)" -ForegroundColor $(if ($validationWarnings.Count -eq 0) { "Green" } else { "Yellow" })
}

function Show-NextSteps {
    Write-Host "`n=== Next Steps ===" -ForegroundColor Magenta
    
    Write-Host "1. Manual Configuration Required:" -ForegroundColor Cyan
    Write-Host "   • Set up branch protection rules at:" -ForegroundColor White
    Write-Host "     https://github.com/david-t-martel/claude-code-integration/settings/branches" -ForegroundColor Blue
    Write-Host "   • Configure required status checks" -ForegroundColor White
    Write-Host "   • Set up required reviews" -ForegroundColor White
    
    Write-Host "`n2. Optional Enhancements:" -ForegroundColor Cyan
    Write-Host "   • Add Snyk token for enhanced security scanning" -ForegroundColor White
    Write-Host "   • Configure NPM token for package publishing" -ForegroundColor White
    Write-Host "   • Set up notification webhooks" -ForegroundColor White
    
    Write-Host "`n3. Test the Setup:" -ForegroundColor Cyan
    Write-Host "   • Create a test branch and PR" -ForegroundColor White
    Write-Host "   • Verify all workflows trigger correctly" -ForegroundColor White
    Write-Host "   • Test security scanning" -ForegroundColor White
    
    Write-Host "`n4. Documentation:" -ForegroundColor Cyan
    Write-Host "   • Review CONTRIBUTING.md" -ForegroundColor White
    Write-Host "   • Update README.md with project-specific information" -ForegroundColor White
    Write-Host "   • Add usage examples" -ForegroundColor White
}

# Main execution
Write-Host "Claude Code Integration - CI/CD Setup Validator" -ForegroundColor Magenta
Write-Host "=====================================================" -ForegroundColor Magenta

# Run all validations
Test-DirectoryStructure
Test-WorkflowFiles
Test-ConfigurationFiles
Test-IssueTemplates
Test-SecurityConfiguration
Test-GitHubRepository
Test-DevelopmentEnvironment

# Show results
Show-Summary
Show-NextSteps

# Exit with appropriate code
if ($validationErrors.Count -gt 0) {
    exit 1
} else {
    exit 0
}