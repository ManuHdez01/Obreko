# Incrustar audio como base64 en obreko.html
$htmlPath = Join-Path $PSScriptRoot "obreko.html"
$songPath = Join-Path $PSScriptRoot "song1.mp3.m4a"

if(!(Test-Path $songPath)){ Write-Host "No encontrado: $songPath" -ForegroundColor Red; pause; exit }

Write-Host "Leyendo audio..." -ForegroundColor Cyan
$bytes = [System.IO.File]::ReadAllBytes($songPath)
$b64   = [System.Convert]::ToBase64String($bytes)
$dataUrl = "data:audio/mp4;base64,$b64"
Write-Host "  OK: $([math]::Round($bytes.Length/1024)) KB" -ForegroundColor Green

Write-Host "Actualizando HTML..." -ForegroundColor Cyan
$html = [System.IO.File]::ReadAllText($htmlPath, [System.Text.Encoding]::UTF8)

$old = "var songs=[],cur=0,volume=0.5,dragging=false;"
$new = "var songs=['$dataUrl'],cur=0,volume=0.5,dragging=false;"
$html = $html.Replace($old, $new)

[System.IO.File]::WriteAllText($htmlPath, $html, [System.Text.Encoding]::UTF8)

Write-Host ""
Write-Host "Listo! Audio incrustado. La musica sonara automaticamente al pulsar play." -ForegroundColor Yellow
pause
