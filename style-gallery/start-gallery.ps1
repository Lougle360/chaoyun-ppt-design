param([int]$Port = 8880, [switch]$NoOpen)
$ErrorActionPreference = 'Stop'
$galleryRoot = $PSScriptRoot
$galleryUrl = "http://127.0.0.1:$Port/style-gallery/"
$response = $null
$existingListener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existingListener) {
    try { $response = Invoke-WebRequest -Uri $galleryUrl -TimeoutSec 3 }
    catch { throw "Port $Port is occupied but did not serve the gallery. Use -Port with a free port." }
    if ($response.Content -notmatch 'id="catalog-title"') { throw "Port $Port is occupied by another service. Use -Port with a free port." }
}
if (-not $response) {
    $python = (Get-Command python -ErrorAction Stop).Source
    $serverScript = Join-Path $galleryRoot 'server.py'
    $serverArgs = @($serverScript, '--port', [string]$Port)
    Start-Process -FilePath $python -ArgumentList $serverArgs -WorkingDirectory $galleryRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $galleryRoot "server-$Port.log") -RedirectStandardError (Join-Path $galleryRoot "server-$Port-error.log") | Out-Null
    $ready = $false
    for ($attempt=0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Milliseconds 200
        try { $response = Invoke-WebRequest -Uri $galleryUrl -TimeoutSec 1; if ($response.StatusCode -eq 200) { $ready=$true; break } } catch {}
    }
    if (-not $ready) { throw "Gallery did not start; inspect server-$Port-error.log." }
}
Write-Output $galleryUrl
if (-not $NoOpen) { Start-Process $galleryUrl }
