# Setup Branch Protection Rules for Claude Code Integration
param(
    [string]$RepoOwner = "david-t-martel",
    [string]$RepoName = "claude-code-integration",
    [string]$Branch = "main"
)

Write-Host "Setting up branch protection rules for $RepoOwner/$RepoName..."

# Branch protection configuration
$protection = @{
    required_status_checks = @{
        strict = $true
        contexts = @(
            "Code Quality & Linting",
            "Unit Tests",
            "Build Tests", 
            "Integration Tests",
            "All Checks Complete"
        )
    }
    enforce_admins = $false
    required_pull_request_reviews = @{
        required_approving_review_count = 1
        dismiss_stale_reviews = $true
        require_code_owner_reviews = $true
        require_last_push_approval = $true
    }
    restrictions = $null
    allow_force_pushes = $false
    allow_deletions = $false
    block_creations = $false
    required_conversation_resolution = $true
} | ConvertTo-Json -Depth 10

# Create temporary file for the JSON payload
$tempFile = [System.IO.Path]::GetTempFileName()
$protection | Out-File -FilePath $tempFile -Encoding UTF8

try {
    Write-Host "Creating branch protection rule..."
    
    # Use gh CLI to set branch protection
    $result = gh api repos/$RepoOwner/$RepoName/branches/$Branch/protection -X PUT --input $tempFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Branch protection rules applied successfully!" -ForegroundColor Green
    } else {
        Write-Host "Failed to apply branch protection rules" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "Error setting up branch protection: $_" -ForegroundColor Red
    exit 1
}
finally {
    # Clean up temporary file
    if (Test-Path $tempFile) {
        Remove-Item $tempFile
    }
}

# Set up additional repository settings
Write-Host ""
Write-Host "Configuring additional repository settings..."

try {
    # Enable vulnerability alerts
    gh api repos/$RepoOwner/$RepoName/vulnerability-alerts -X PUT
    Write-Host "Vulnerability alerts enabled" -ForegroundColor Green
    
    # Enable automated security fixes
    gh api repos/$RepoOwner/$RepoName/automated-security-fixes -X PUT
    Write-Host "Automated security fixes enabled" -ForegroundColor Green
    
    # Enable delete branch on merge
    gh api repos/$RepoOwner/$RepoName -X PATCH --field delete_branch_on_merge=true
    Write-Host "Delete branch on merge enabled" -ForegroundColor Green
    
    # Disable wiki and projects if not needed
    gh api repos/$RepoOwner/$RepoName -X PATCH --field has_wiki=false --field has_projects=false
    Write-Host "Wiki and Projects disabled" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "Repository configuration complete!" -ForegroundColor Green
    
} catch {
    Write-Host "Some additional settings may not have been applied: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Branch protection setup completed successfully!" -ForegroundColor Green