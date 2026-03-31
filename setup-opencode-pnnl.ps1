#Requires -Version 5.1

$ErrorActionPreference = "Stop"

$OpenCodeConfigDir  = Join-Path $HOME ".config\opencode"
$OpenCodeConfigFile = Join-Path $OpenCodeConfigDir "opencode.json"
$OpenCodePackageFile = Join-Path $OpenCodeConfigDir "package.json"
$AgentSettingsFile  = Join-Path $HOME ".agent\settings.json"
$ScriptDir          = Split-Path -Parent $MyInvocation.MyCommand.Path

function Print-Step { param($msg) Write-Host ""; Write-Host "==> $msg" }
function Print-Ok   { param($msg) Write-Host "    [ok] $msg" }
function Print-Skip { param($msg) Write-Host "    [skip] $msg" }

# ─── 1. Node.js ───────────────────────────────────────────────────────────────

Print-Step "Checking Node.js..."

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
    $nodeVersion = & node --version
    Print-Ok "Node.js already installed ($nodeVersion)"
} else {
    Write-Host "    Node.js not found. Installing via winget..."
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        winget install OpenJS.NodeJS --silent --accept-package-agreements --accept-source-agreements
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                    [System.Environment]::GetEnvironmentVariable("Path","User")
        Print-Ok "Node.js installed ($(& node --version))"
    } else {
        Write-Host "ERROR: winget not available. Please install Node.js v18+ from https://nodejs.org and re-run this script."
        exit 1
    }
}

# ─── 2. OpenCode ──────────────────────────────────────────────────────────────

Print-Step "Checking OpenCode..."

$opencodeCmd = Get-Command opencode -ErrorAction SilentlyContinue
if ($opencodeCmd) {
    Print-Ok "OpenCode already installed"
} else {
    Write-Host "    OpenCode not found. Installing via npm..."
    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
    if ($npmCmd) {
        & npm install -g opencode-ai
        Print-Ok "OpenCode installed"
    } else {
        Write-Host "ERROR: npm not found. Please install Node.js first, then re-run this script."
        exit 1
    }
}

# ─── 3. JIRA skill npm dependencies ──────────────────────────────────────────

Print-Step "Installing JIRA skill npm dependencies..."

$packageJson = Join-Path $ScriptDir "package.json"
if (Test-Path $packageJson) {
    & npm install --prefix $ScriptDir --silent
    Print-Ok "Dependencies installed"
} else {
    Print-Skip "No package.json found in $ScriptDir"
}

# ─── 4. Collect JIRA credentials ─────────────────────────────────────────────

Print-Step "JIRA Configuration"

Write-Host ""
$JiraUrl = Read-Host "Enter your JIRA instance URL (e.g. https://jira.example.com)"
if ([string]::IsNullOrWhiteSpace($JiraUrl)) {
    Write-Host "ERROR: JIRA URL cannot be empty."
    exit 1
}

$JiraEmail = Read-Host "Enter your JIRA email address"
if ([string]::IsNullOrWhiteSpace($JiraEmail)) {
    Write-Host "ERROR: JIRA email cannot be empty."
    exit 1
}

$JiraTokenSecure = Read-Host "Enter your JIRA Personal Access Token" -AsSecureString
$JiraToken = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($JiraTokenSecure)
)
if ([string]::IsNullOrWhiteSpace($JiraToken)) {
    Write-Host "ERROR: JIRA token cannot be empty."
    exit 1
}

$UsePatInput = Read-Host "Are you using a Personal Access Token (Server/DC)? [Y/n]"
if ([string]::IsNullOrWhiteSpace($UsePatInput) -or $UsePatInput -match "^[Yy]") {
    $JiraUsePat = "true"
} else {
    $JiraUsePat = "false"
}

# ─── 5. Write ~/.agent/settings.json ─────────────────────────────────────────

Print-Step "Writing ~/.agent/settings.json..."

$agentDir = Split-Path -Parent $AgentSettingsFile
if (!(Test-Path $agentDir)) {
    New-Item -ItemType Directory -Path $agentDir -Force | Out-Null
}

if (Test-Path $AgentSettingsFile) {
    $settings = Get-Content $AgentSettingsFile -Raw | ConvertFrom-Json
} else {
    $settings = [PSCustomObject]@{}
}

if (-not (Get-Member -InputObject $settings -Name "env" -MemberType NoteProperty)) {
    $settings | Add-Member -MemberType NoteProperty -Name "env" -Value ([PSCustomObject]@{})
}

$settings.env | Add-Member -MemberType NoteProperty -Name "JIRA_URL"     -Value $JiraUrl   -Force
$settings.env | Add-Member -MemberType NoteProperty -Name "JIRA_EMAIL"   -Value $JiraEmail -Force
$settings.env | Add-Member -MemberType NoteProperty -Name "JIRA_TOKEN"   -Value $JiraToken -Force
$settings.env | Add-Member -MemberType NoteProperty -Name "JIRA_USE_PAT" -Value $JiraUsePat -Force

$settings | ConvertTo-Json -Depth 10 | Set-Content $AgentSettingsFile
Print-Ok "Written to $AgentSettingsFile"

# ─── 6. Configure OpenCode (PNNL provider) ───────────────────────────────────

Print-Step "Configuring OpenCode PNNL provider..."

$ApiKeySecure = Read-Host "Enter your PNNL API Key" -AsSecureString
$ApiKey = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($ApiKeySecure)
)
if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    Write-Host "ERROR: PNNL API key cannot be empty."
    exit 1
}

if (!(Test-Path $OpenCodeConfigDir)) {
    New-Item -ItemType Directory -Path $OpenCodeConfigDir -Force | Out-Null
}

if (Test-Path $OpenCodeConfigFile) {
    $config = Get-Content $OpenCodeConfigFile -Raw | ConvertFrom-Json
} else {
    $config = [PSCustomObject]@{}
}

if (-not (Get-Member -InputObject $config -Name "provider" -MemberType NoteProperty)) {
    $config | Add-Member -MemberType NoteProperty -Name "provider" -Value ([PSCustomObject]@{})
}

$pnnlProvider = [PSCustomObject]@{
    npm  = "@ai-sdk/openai-compatible"
    name = "PNNL AI Incubator"
    options = [PSCustomObject]@{
        baseURL = "https://ai-incubator-api.pnnl.gov"
        apiKey  = $ApiKey
    }
    models = [PSCustomObject]@{
        "gpt-5-birthright"                        = [PSCustomObject]@{}
        "gpt-5.1-birthright"                      = [PSCustomObject]@{}
        "gpt-5.2-birthright"                      = [PSCustomObject]@{}
        "gpt-5.4-birthright"                      = [PSCustomObject]@{}
        "gpt-4.1-birthright"                      = [PSCustomObject]@{}
        "o3-birthright"                            = [PSCustomObject]@{}
        "o4-mini-birthright"                       = [PSCustomObject]@{}
        "grok-4-birthright"                        = [PSCustomObject]@{}
        "grok-4-fast-non-reasoning-birthright"     = [PSCustomObject]@{}
        "grok-4-fast-reasoning-birthright"         = [PSCustomObject]@{}
        "claude-sonnet-4-6-birthright"             = [PSCustomObject]@{}
        "claude-sonnet-4-5-20250929-v1-birthright" = [PSCustomObject]@{}
        "claude-sonnet-4-20250514-v1-birthright"   = [PSCustomObject]@{}
        "claude-haiku-4-5-20251001-v1-birthright"  = [PSCustomObject]@{}
    }
}

$config.provider | Add-Member -MemberType NoteProperty -Name "pnnl" -Value $pnnlProvider -Force
$config | Add-Member -MemberType NoteProperty -Name "model" -Value "pnnl/gpt-5.4-birthright" -Force

$config | ConvertTo-Json -Depth 10 | Set-Content $OpenCodeConfigFile
Print-Ok "OpenCode configured at $OpenCodeConfigFile"

if (Test-Path $OpenCodePackageFile) {
    $pkg = Get-Content $OpenCodePackageFile -Raw | ConvertFrom-Json
} else {
    $pkg = [PSCustomObject]@{}
}
$pkg | Add-Member -MemberType NoteProperty -Name "type" -Value "module" -Force
$pkg | ConvertTo-Json -Depth 10 | Set-Content $OpenCodePackageFile
Print-Ok "ESM package boundary set at $OpenCodePackageFile"

# ─── 7. Test JIRA connection ──────────────────────────────────────────────────

Print-Step "Testing JIRA connection..."

$testScript = Join-Path $ScriptDir "scripts\test-connection.js"
if (Test-Path $testScript) {
    try {
        & node $testScript
        Print-Ok "JIRA connection successful"
    } catch {
        Write-Host "    WARNING: JIRA connection test failed. Check your URL, email, and token."
    }
} else {
    Print-Skip "test-connection.js not found"
}

# ─── Done ─────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "Setup complete."
Write-Host ""
Write-Host "  JIRA settings : $AgentSettingsFile"
Write-Host "  OpenCode config: $OpenCodeConfigFile"
Write-Host ""
Write-Host "Run 'opencode' to start."
