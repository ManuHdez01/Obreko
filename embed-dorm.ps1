# Incrustar cancion del dormitorio como base64 en obreko.html
$htmlPath = Join-Path $PSScriptRoot "obreko.html"
$songPath = Join-Path $PSScriptRoot "Video Project 1.m4a"

if(!(Test-Path $songPath)){ Write-Host "No encontrado: $songPath" -ForegroundColor Red; pause; exit }

Write-Host "Leyendo audio..." -ForegroundColor Cyan
$bytes = [System.IO.File]::ReadAllBytes($songPath)
$b64   = [System.Convert]::ToBase64String($bytes)
$dataUrl = "data:audio/mp4;base64,$b64"
Write-Host "  OK: $([math]::Round($bytes.Length/1024)) KB" -ForegroundColor Green

Write-Host "Actualizando HTML (dormitorio)..." -ForegroundColor Cyan
$html = [System.IO.File]::ReadAllText($htmlPath, [System.Text.Encoding]::UTF8)

$old = "var songs=[],cur=0,volume=0.5,dragging=false;"
$new = "var songs=['$dataUrl'],cur=0,volume=0.5,dragging=false;"

if(!$html.Contains($old)){
    Write-Host "ERROR: No se encontro el marcador en el HTML." -ForegroundColor Red
    pause; exit
}

$html = $html.Replace($old, $new)
[System.IO.File]::WriteAllText($htmlPath, $html, [System.Text.Encoding]::UTF8)

Write-Host ""
Write-Host "Listo! Cancion del dormitorio incrustada." -ForegroundColor Yellow
pause
