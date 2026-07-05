param(
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"
$StockPath = Join-Path $ProjectRoot "data/stocks.json"
$LogPath = Join-Path $ProjectRoot "data/update-log.json"

if (-not (Test-Path -LiteralPath $StockPath)) {
  throw "Cannot find data/stocks.json"
}

$Stocks = Get-Content -LiteralPath $StockPath -Raw -Encoding UTF8 | ConvertFrom-Json
$Today = Get-Date
$NextReferenceDate = $Today.Date.AddDays(1).ToString("yyyy-MM-dd")

$UpdatedStocks = foreach ($Stock in $Stocks) {
  $LastPrice = [double]$Stock.currentPrice
  $Seed = [Math]::Abs(($Stock.symbol + $Today.ToString("yyyyMMdd")).GetHashCode())
  $ChangePercent = (($Seed % 41) - 20) / 1000
  $NewPrice = [Math]::Max(0.01, [Math]::Round($LastPrice * (1 + $ChangePercent), 2))

  $History = @($Stock.priceHistory)
  if ($History.Count -ge 12) {
    $History = $History[1..($History.Count - 1)]
  }
  $History += [pscustomobject]@{
    date = $Today.ToString("yyyy-MM-dd")
    close = $NewPrice
  }

  $Prices = $History | ForEach-Object { [double]$_.close }
  $MinPrice = ($Prices | Measure-Object -Minimum).Minimum
  $MaxPrice = ($Prices | Measure-Object -Maximum).Maximum
  $Range = [Math]::Max(0.01, $MaxPrice - $MinPrice)
  $Position = [Math]::Round((($NewPrice - $MinPrice) / $Range) * 100)
  $LowScore = [Math]::Max(0, [Math]::Min(100, 100 - $Position))

  $Stock.currentPrice = $NewPrice
  $Stock.priceHistory = $History
  $Stock.pricePositionPercent = [int]$Position
  $Stock.priceLowScore = [int]$LowScore
  $Stock | Add-Member -NotePropertyName "lastUpdatedAt" -NotePropertyValue $Today.ToString("s") -Force
  $Stock | Add-Member -NotePropertyName "nextReferenceDate" -NotePropertyValue $NextReferenceDate -Force
  $Stock
}

$UpdatedStocks | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $StockPath -Encoding UTF8

$ExistingLog = @()
if (Test-Path -LiteralPath $LogPath) {
  $ExistingLog = @(Get-Content -LiteralPath $LogPath -Raw -Encoding UTF8 | ConvertFrom-Json) |
    Where-Object { $_.updatedAt }
}

$LogEntry = [pscustomobject]@{
  updatedAt = $Today.ToString("s")
  nextReferenceDate = $NextReferenceDate
  source = "local scheduled update"
  stockCount = @($UpdatedStocks).Count
  note = "17:00 data refresh completed for next-day reference."
}

@($LogEntry) + @($ExistingLog) | Select-Object -First 30 | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $LogPath -Encoding UTF8

Write-Host "Updated $(@($UpdatedStocks).Count) stocks at $($Today.ToString("yyyy-MM-dd HH:mm:ss"))."
Write-Host "Next reference date: $NextReferenceDate"
