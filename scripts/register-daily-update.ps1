param(
  [string]$TaskName = "DailyStockRecommendationsDataUpdate",
  [string]$Time = "17:00"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$UpdateScript = Join-Path $ProjectRoot "scripts/update-data.ps1"

if (-not (Test-Path -LiteralPath $UpdateScript)) {
  throw "Cannot find scripts/update-data.ps1"
}

$Action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$UpdateScript`" -ProjectRoot `"$ProjectRoot`""

$Trigger = New-ScheduledTaskTrigger -Daily -At $Time
$Settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -Description "Daily 17:00 A-share data refresh for next-day investment reference." `
  -Force | Out-Null

Write-Host "Registered task '$TaskName' to run daily at $Time."
Write-Host "Update script: $UpdateScript"
