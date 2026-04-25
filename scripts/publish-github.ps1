param(
    [string]$RepoName = "Centinela",
    [string]$Owner = "",
    [ValidateSet("public", "private")]
    [string]$Visibility = "public",
    [string]$Description = "Paraguay-first public-integrity and corruption-risk research system",
    [string]$RemoteName = "origin",
    [string[]]$Topics = @(
        "paraguay",
        "public-integrity",
        "procurement",
        "civic-tech",
        "open-data",
        "corruption-risk",
        "entity-intelligence"
    )
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-External {
    param(
        [string]$Command,
        [string[]]$Arguments,
        [switch]$AllowFailure
    )

    & $Command @Arguments
    $exitCode = $LASTEXITCODE
    if (-not $AllowFailure -and $exitCode -ne 0) {
        throw "Command failed with exit code ${exitCode}: $Command $($Arguments -join ' ')"
    }

    return $exitCode
}

function Get-ExternalOutput {
    param(
        [string]$Command,
        [string[]]$Arguments,
        [switch]$AllowFailure
    )

    $output = & $Command @Arguments 2>$null
    $exitCode = $LASTEXITCODE
    if (-not $AllowFailure -and $exitCode -ne 0) {
        throw "Command failed with exit code ${exitCode}: $Command $($Arguments -join ' ')"
    }

    return @{
        ExitCode = $exitCode
        Output = ($output -join "`n")
    }
}

$repoRoot = (Get-ExternalOutput "git" @("rev-parse", "--show-toplevel")).Output.Trim()
Set-Location $repoRoot

$branch = (Get-ExternalOutput "git" @("branch", "--show-current")).Output.Trim()
if ([string]::IsNullOrWhiteSpace($branch)) {
    throw "Could not determine the current Git branch."
}

$workingTree = (Get-ExternalOutput "git" @("status", "--porcelain")).Output.Trim()
if (-not [string]::IsNullOrWhiteSpace($workingTree)) {
    throw "Working tree is not clean. Commit or stash changes before publishing."
}

Invoke-External "gh" @("--version") | Out-Null

$auth = Get-ExternalOutput "gh" @("auth", "status") -AllowFailure
if ($auth.ExitCode -ne 0) {
    Write-Host "GitHub CLI is not authenticated. Starting browser login..."
    Invoke-External "gh" @(
        "auth",
        "login",
        "--web",
        "--hostname",
        "github.com",
        "--git-protocol",
        "https",
        "--scopes",
        "repo"
    ) | Out-Null
}

Invoke-External "gh" @("auth", "status") | Out-Null

if ([string]::IsNullOrWhiteSpace($Owner)) {
    $Owner = (Get-ExternalOutput "gh" @("api", "user", "--jq", ".login")).Output.Trim()
}

if ([string]::IsNullOrWhiteSpace($Owner)) {
    throw "Could not determine GitHub owner. Re-run with -Owner <github-user-or-org>."
}

$repoFullName = "$Owner/$RepoName"
$repoView = Get-ExternalOutput "gh" @("repo", "view", $repoFullName, "--json", "url", "--jq", ".url") -AllowFailure

if ($repoView.ExitCode -ne 0) {
    Write-Host "Creating GitHub repository $repoFullName as $Visibility..."
    Invoke-External "gh" @(
        "repo",
        "create",
        $repoFullName,
        "--$Visibility",
        "--description",
        $Description
    ) | Out-Null

    $repoUrl = (Get-ExternalOutput "gh" @("repo", "view", $repoFullName, "--json", "url", "--jq", ".url")).Output.Trim()
}
else {
    $repoUrl = $repoView.Output.Trim()
    Write-Host "GitHub repository already exists: $repoFullName"
}

$expectedRemote = "$repoUrl.git"
$remote = Get-ExternalOutput "git" @("remote", "get-url", $RemoteName) -AllowFailure
if ($remote.ExitCode -ne 0) {
    Invoke-External "git" @("remote", "add", $RemoteName, $expectedRemote) | Out-Null
}
elseif ($remote.Output.Trim() -ne $expectedRemote) {
    throw "Remote '$RemoteName' points to '$($remote.Output.Trim())', not '$expectedRemote'. Resolve this before publishing."
}

Write-Host "Pushing $branch to $repoFullName..."
Invoke-External "git" @("push", "-u", $RemoteName, $branch) | Out-Null

foreach ($topic in $Topics) {
    Invoke-External "gh" @("repo", "edit", $repoFullName, "--add-topic", $topic) -AllowFailure | Out-Null
}

Write-Host "Published Centinela:"
Write-Host $repoUrl
