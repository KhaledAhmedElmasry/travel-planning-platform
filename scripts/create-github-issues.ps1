# Creates the labels, the "Milestone 1" milestone and one GitHub issue per requirement
# from docs/requirements/issues.csv.
#
# Prerequisites: GitHub CLI (https://cli.github.com), then `gh auth login`.
# Run from the repository root after pushing the repo to GitHub:
#   powershell -ExecutionPolicy Bypass -File scripts/create-github-issues.ps1
# This creates all 122 issues: 111 mandatory (incl. 7 assumed) in "Milestone 1", and 11 bonus
# issues with the "bonus" label and no milestone. Add -SkipBonus to create only the 111.
#
# Run it once only: running it again creates duplicate issues.

param(
    [switch]$SkipBonus
)

$ErrorActionPreference = 'Stop'
$csvPath = Join-Path $PSScriptRoot '..\docs\requirements\issues.csv'
$issues = Import-Csv -Path $csvPath -Encoding UTF8

if ($SkipBonus) {
    $issues = $issues | Where-Object { $_.labels -notmatch '(^|,)bonus(,|$)' }
}

$labelColors = @{
    'mandatory'             = 'b60205'
    'bonus'                 = '0e8a16'
    'assumed'               = 'fbca04'
    'area:foundation'       = '5319e7'
    'area:auth-accounts'    = '1d76db'
    'area:community'        = 'c5def5'
    'area:flight-inventory' = '0052cc'
    'area:flight-booking'   = '006b75'
    'area:hotels'           = 'd93f0b'
    'area:hotel-booking'    = 'e99695'
    'area:payments'         = '0e8a16'
    'area:itineraries'      = 'bfd4f2'
    'complexity:low'        = 'ededed'
    'complexity:medium'     = 'c2e0c6'
    'complexity:high'       = 'f9d0c4'
}

Write-Host 'Creating labels...'
foreach ($label in $labelColors.Keys) {
    gh label create $label --color $labelColors[$label] --force | Out-Null
}

Write-Host 'Creating milestone...'
$repo = gh repo view --json nameWithOwner --jq .nameWithOwner
$existing = gh api "repos/$repo/milestones" --jq '.[].title'
if ($existing -notcontains 'Milestone 1') {
    gh api "repos/$repo/milestones" -f title='Milestone 1' -f due_on='2026-11-20T21:59:59Z' -f description='Backend & API (Swagger)' | Out-Null
}

$count = 0
foreach ($issue in $issues) {
    $ghArgs = @('issue', 'create', '--title', $issue.title, '--body', $issue.body, '--label', $issue.labels)
    if ($issue.milestone) { $ghArgs += @('--milestone', $issue.milestone) }
    gh @ghArgs | Out-Null
    $count++
    Write-Host "[$count/$($issues.Count)] $($issue.title)"
    Start-Sleep -Milliseconds 700  # stay under GitHub's rate limits
}

Write-Host "Done: $count issues created."
