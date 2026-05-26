param(
  [int]$Port = 4173
)

$root = (Resolve-Path $PSScriptRoot).Path
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".webmanifest" = "application/manifest+json; charset=utf-8"
  ".svg" = "image/svg+xml"
}

function Send-Response($stream, [int]$status, [string]$contentType, [byte[]]$body) {
  $reason = if ($status -eq 200) { "OK" } elseif ($status -eq 404) { "Not Found" } else { "Server Error" }
  $header = "HTTP/1.1 $status $reason`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
  $headerBytes = [Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  $stream.Write($body, 0, $body.Length)
}

$listener.Start()
Write-Host "Serving http://localhost:$Port/"

while ($true) {
  $client = $listener.AcceptTcpClient()

  try {
    $stream = $client.GetStream()
    $buffer = New-Object byte[] 4096
    $read = $stream.Read($buffer, 0, $buffer.Length)
    $request = [Text.Encoding]::ASCII.GetString($buffer, 0, $read)
    $firstLine = ($request -split "`r?`n")[0]
    $parts = $firstLine -split " "

    if ($parts.Length -lt 2) {
      Send-Response $stream 500 "text/plain; charset=utf-8" ([Text.Encoding]::UTF8.GetBytes("Bad request"))
      continue
    }

    $requestPath = [Uri]::UnescapeDataString(($parts[1] -split "\?")[0].TrimStart("/"))
    if ([string]::IsNullOrWhiteSpace($requestPath)) {
      $requestPath = "index.html"
    }

    $fullPath = [IO.Path]::GetFullPath([IO.Path]::Combine($root, $requestPath))

    if (-not $fullPath.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or -not [IO.File]::Exists($fullPath)) {
      Send-Response $stream 404 "text/plain; charset=utf-8" ([Text.Encoding]::UTF8.GetBytes("Not found"))
      continue
    }

    $extension = [IO.Path]::GetExtension($fullPath)
    $contentType = if ($mime.ContainsKey($extension)) { $mime[$extension] } else { "application/octet-stream" }
    Send-Response $stream 200 $contentType ([IO.File]::ReadAllBytes($fullPath))
  } catch {
    if ($stream) {
      Send-Response $stream 500 "text/plain; charset=utf-8" ([Text.Encoding]::UTF8.GetBytes("Server error"))
    }
  } finally {
    $client.Close()
  }
}
