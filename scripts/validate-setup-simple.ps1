# Simple CI/CD Setup Validator
Write-Host "CI/CD Setup Validation" -ForegroundColor Green
Write-Host "======================" -ForegroundColor Green

$errors = 0
$warnings = 0

function Test-File($path, $name) {
    if (Test-Path $path) {
        Write-Host "[OK] $name" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] $name missing: $path" -ForegroundColor Red
        $global:errors++
    }
}

Write-Host "`nChecking GitHub workflows..." -ForegroundColor Cyan
Test-File ".github/workflows/ci.yml" "CI Pipeline"
Test-File ".github/workflows/release.yml" "Release Automation"  
Test-File ".github/workflows/security.yml" "Security Scanning"
Test-File ".github/workflows/publish-packages.yml" "Package Publishing"

Write-Host "`nChecking configuration files..." -ForegroundColor Cyan
Test-File ".github/dependabot.yml" "Dependabot Config"
Test-File ".github/CODEOWNERS" "Code Owners"
Test-File "package.json" "Root Package Config"
Test-File "CONTRIBUTING.md" "Contributing Guide"
Test-File "LICENSE" "License File"

Write-Host "`nChecking templates..." -ForegroundColor Cyan
Test-File ".github/ISSUE_TEMPLATE/bug_report.md" "Bug Report Template"
Test-File ".github/ISSUE_TEMPLATE/feature_request.md" "Feature Request Template"
Test-File ".github/pull_request_template.md" "PR Template"

Write-Host "`nValidation Summary:" -ForegroundColor Yellow
if ($errors -eq 0) {
    Write-Host "All files present! CI/CD setup complete." -ForegroundColor Green
} else {
    Write-Host "$errors files missing. Please check the errors above." -ForegroundColor Red
}

Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Set up branch protection at: https://github.com/david-t-martel/claude-code-integration/settings/branches"
Write-Host "2. Test workflows by creating a test PR"
Write-Host "3. Configure any missing secrets (SNYK_TOKEN, NPM_TOKEN, etc.)"