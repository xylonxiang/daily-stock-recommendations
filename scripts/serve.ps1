param(
  [int]$Port = 4173
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Address = [System.Net.IPAddress]::Parse("127.0.0.1")
$Server = [System.Net.Sockets.TcpListener]::new($Address, $Port)

function Get-ContentType {
  param([string]$Path)

  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".html" { "text/html; charset=utf-8" }
    ".css" { "text/css; charset=utf-8" }
    ".js" { "text/javascript; charset=utf-8" }
    ".json" { "application/json; charset=utf-8" }
    ".svg" { "image/svg+xml" }
    ".png" { "image/png" }
    ".jpg" { "image/jpeg" }
    ".jpeg" { "image/jpeg" }
    default { "application/octet-stream" }
  }
}

function Write-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$StatusText,
    [byte[]]$Body,
    [string]$ContentType = "text/plain; charset=utf-8"
  )

  $Header = "HTTP/1.1 $StatusCode $StatusText`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nConnection: close`r`n`r`n"
  $HeaderBytes = [System.Text.Encoding]::ASCII.GetBytes($Header)
  $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
  $Stream.Write($Body, 0, $Body.Length)
}

try {
  $Server.Start()
  Write-Host "Serving $ProjectRoot at http://localhost:$Port/"
  Write-Host "Press Ctrl+C to stop."

  while ($true) {
    $Client = $Server.AcceptTcpClient()
    try {
      $Client.ReceiveTimeout = 2000
      $Client.SendTimeout = 2000
      $Stream = $Client.GetStream()
      $Buffer = New-Object byte[] 4096
      $Read = $Stream.Read($Buffer, 0, $Buffer.Length)
      if ($Read -le 0) {
        continue
      }
      $Request = [System.Text.Encoding]::ASCII.GetString($Buffer, 0, $Read)
      $RequestLine = ($Request -split "`r`n")[0]
      $Parts = $RequestLine -split " "
      $UrlPath = if ($Parts.Length -ge 2) { $Parts[1] } else { "/" }
      $RequestPath = [System.Uri]::UnescapeDataString(($UrlPath -split "\?")[0].TrimStart("/"))

      if ([string]::IsNullOrWhiteSpace($RequestPath)) {
        $RequestPath = "index.html"
      }

      $RequestedFile = Join-Path $ProjectRoot $RequestPath
      $ResolvedRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
      $ResolvedFile = [System.IO.Path]::GetFullPath($RequestedFile)

      if (-not $ResolvedFile.StartsWith($ResolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        $Body = [System.Text.Encoding]::UTF8.GetBytes("403 Forbidden")
        Write-Response $Stream 403 "Forbidden" $Body
        continue
      }

      if (-not (Test-Path -LiteralPath $ResolvedFile -PathType Leaf)) {
        $Body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
        Write-Response $Stream 404 "Not Found" $Body
        continue
      }

      $Bytes = [System.IO.File]::ReadAllBytes($ResolvedFile)
      Write-Response $Stream 200 "OK" $Bytes (Get-ContentType $ResolvedFile)
    }
    finally {
      $Client.Close()
    }
  }
}
finally {
  $Server.Stop()
}
