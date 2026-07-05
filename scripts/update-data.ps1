param(
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
  [int]$Limit = 760
)

$ErrorActionPreference = "Stop"
$StockPath = Join-Path $ProjectRoot "data/stocks.json"
$LogPath = Join-Path $ProjectRoot "data/update-log.json"
$EastmoneyKlineEndpoint = "https://push2his.eastmoney.com/api/qt/stock/kline/get"

if (-not (Test-Path -LiteralPath $StockPath)) {
  throw "Cannot find data/stocks.json"
}

function Get-EastmoneyMarketId {
  param([string]$Symbol)

  if ($Symbol.StartsWith("6")) {
    return "1"
  }

  if ($Symbol.StartsWith("0") -or $Symbol.StartsWith("2") -or $Symbol.StartsWith("3")) {
    return "0"
  }

  throw "Unsupported A-share symbol: $Symbol"
}

function Get-EastmoneyKlines {
  param(
    [string]$Symbol,
    [int]$Limit
  )

  $MarketId = Get-EastmoneyMarketId $Symbol
  $Query = @{
    secid = "$MarketId.$Symbol"
    klt = "101"
    fqt = "1"
    lmt = "$Limit"
    end = "20500101"
    fields1 = "f1,f2,f3,f4,f5,f6"
    fields2 = "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61"
  }
  $QueryString = ($Query.GetEnumerator() | ForEach-Object {
    "$([System.Uri]::EscapeDataString($_.Key))=$([System.Uri]::EscapeDataString($_.Value))"
  }) -join "&"
  $Uri = "$EastmoneyKlineEndpoint`?$QueryString"

  $Response = Invoke-RestMethod `
    -Uri $Uri `
    -Headers @{ Referer = "https://quote.eastmoney.com/" } `
    -TimeoutSec 20

  if (-not $Response.data -or -not $Response.data.klines) {
    throw "No Eastmoney kline data returned for $Symbol"
  }

  return $Response.data.klines | ForEach-Object {
    $Parts = $_ -split ","
    [pscustomobject]@{
      date = $Parts[0]
      open = [double]$Parts[1]
      close = [double]$Parts[2]
      high = [double]$Parts[3]
      low = [double]$Parts[4]
      volume = [double]$Parts[5]
      amount = [double]$Parts[6]
      amplitudePercent = [double]$Parts[7]
      changePercent = [double]$Parts[8]
      changeAmount = [double]$Parts[9]
      turnoverPercent = [double]$Parts[10]
    }
  }
}

function Get-SampledPriceHistory {
  param($Klines)

  $Points = @($Klines)
  if ($Points.Count -le 12) {
    return $Points | ForEach-Object {
      [pscustomobject]@{
        date = $_.date
        close = $_.close
      }
    }
  }

  $Sampled = @()
  for ($Index = 0; $Index -lt 12; $Index++) {
    $SourceIndex = [Math]::Round($Index * (($Points.Count - 1) / 11))
    $Point = $Points[$SourceIndex]
    $Sampled += [pscustomobject]@{
      date = $Point.date
      close = $Point.close
    }
  }

  return $Sampled
}

$Stocks = Get-Content -LiteralPath $StockPath -Raw -Encoding UTF8 | ConvertFrom-Json
$Today = Get-Date
$NextReferenceDate = $Today.Date.AddDays(1).ToString("yyyy-MM-dd")
$SuccessCount = 0
$FailedSymbols = @()

$UpdatedStocks = foreach ($Stock in $Stocks) {
  try {
    $Klines = @(Get-EastmoneyKlines -Symbol $Stock.symbol -Limit $Limit)
    $Latest = $Klines[-1]
    $Prices = $Klines | ForEach-Object { [double]$_.close }
    $MinPrice = ($Prices | Measure-Object -Minimum).Minimum
    $MaxPrice = ($Prices | Measure-Object -Maximum).Maximum
    $Range = [Math]::Max(0.01, $MaxPrice - $MinPrice)
    $Position = [Math]::Round((($Latest.close - $MinPrice) / $Range) * 100)
    $LowScore = [Math]::Max(0, [Math]::Min(100, 100 - $Position))

    $Stock.currentPrice = [Math]::Round($Latest.close, 2)
    $Stock.priceHistory = @(Get-SampledPriceHistory $Klines)
    $Stock.pricePositionPercent = [int]$Position
    $Stock.priceLowScore = [int]$LowScore
    $Stock | Add-Member -NotePropertyName "latestTradeDate" -NotePropertyValue $Latest.date -Force
    $Stock | Add-Member -NotePropertyName "latestChangePercent" -NotePropertyValue $Latest.changePercent -Force
    $Stock | Add-Member -NotePropertyName "latestTurnoverPercent" -NotePropertyValue $Latest.turnoverPercent -Force
    $Stock | Add-Member -NotePropertyName "latestAmount" -NotePropertyValue $Latest.amount -Force
    $Stock | Add-Member -NotePropertyName "dataSource" -NotePropertyValue "Eastmoney public kline API" -Force
    $Stock | Add-Member -NotePropertyName "lastUpdatedAt" -NotePropertyValue $Today.ToString("s") -Force
    $Stock | Add-Member -NotePropertyName "nextReferenceDate" -NotePropertyValue $NextReferenceDate -Force
    $SuccessCount += 1
  }
  catch {
    $FailedSymbols += "$($Stock.symbol): $($_.Exception.Message)"
    $Stock | Add-Member -NotePropertyName "dataSource" -NotePropertyValue "local fallback after Eastmoney failure" -Force
    $Stock | Add-Member -NotePropertyName "lastUpdateError" -NotePropertyValue $_.Exception.Message -Force
    $Stock | Add-Member -NotePropertyName "lastUpdatedAt" -NotePropertyValue $Today.ToString("s") -Force
  }

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
  source = "Eastmoney public kline API"
  stockCount = @($UpdatedStocks).Count
  successCount = $SuccessCount
  failedCount = @($FailedSymbols).Count
  failedSymbols = $FailedSymbols
  note = "17:00 real market data refresh completed for next-day reference."
}

@($LogEntry) + @($ExistingLog) | Select-Object -First 30 | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $LogPath -Encoding UTF8

Write-Host "Updated $SuccessCount/$(@($UpdatedStocks).Count) stocks from Eastmoney at $($Today.ToString("yyyy-MM-dd HH:mm:ss"))."
Write-Host "Next reference date: $NextReferenceDate"
if ($FailedSymbols.Count -gt 0) {
  Write-Warning "Failed symbols: $($FailedSymbols -join '; ')"
}
