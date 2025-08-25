# Simple Branch Protection Setup
param(
    [string]$RepoOwner = "david-t-martel",
    [string]$RepoName = "claude-code-integration",
    [string]$Branch = "main"
)

Write-Host "Setting up basic branch protection for $RepoOwner/$RepoName..."

try {
    # Enable vulnerability alerts first
    Write-Host "Enabling vulnerability alerts..."
    gh api repos/$RepoOwner/$RepoName/vulnerability-alerts -X PUT
    Write-Host "✅ Vulnerability alerts enabled" -ForegroundColor Green
    
    # Enable automated security fixes
    Write-Host "Enabling automated security fixes..."
    gh api repos/$RepoOwner/$RepoName/automated-security-fixes -X PUT
    Write-Host "✅ Automated security fixes enabled" -ForegroundColor Green
    
    # Configure repository settings
    Write-Host "Configuring repository settings..."
    gh api repos/$RepoOwner/$RepoName -X PATCH --field delete_branch_on_merge=true --field has_wiki=false --field has_projects=false
    Write-Host "✅ Repository settings updated" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "✅ Basic security and repository settings configured!" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  Note: Branch protection rules should be configured manually via:" -ForegroundColor Yellow
    Write-Host "   https://github.com/$RepoOwner/$RepoName/settings/branches" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Recommended settings:" -ForegroundColor Cyan
    Write-Host "  • Require a pull request before merging" -ForegroundColor White
    Write-Host "  • Require status checks to pass before merging" -ForegroundColor White
    Write-Host "  • Require conversation resolution before merging" -ForegroundColor White
    Write-Host "  • Do not allow bypassing the above settings" -ForegroundColor White
    
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 Initial repository security configuration complete!" -ForegroundColor Green