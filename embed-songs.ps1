# ── Incrustar clip de musica en obreko.html ──
$htmlPath = Join-Path $PSScriptRoot "obreko.html"
$songPath = Join-Path $PSScriptRoot "song1.mp3.m4a"

if(!(Test-Path $songPath)){ Write-Host "No encontrado: song1.mp3" -ForegroundColor Red; pause; exit }

Write-Host "Leyendo clip..." -ForegroundColor Cyan
$bytes = [System.IO.File]::ReadAllBytes($songPath)
$b64   = [System.Convert]::ToBase64String($bytes)
$dataUrl = "data:audio/mp4;base64,$b64"
Write-Host "  OK: song1.mp3 ($([math]::Round($bytes.Length/1024))KB)" -ForegroundColor Green

$html = [System.IO.File]::ReadAllText($htmlPath, [System.Text.Encoding]::UTF8)

# Reemplazar array de canciones
$marker = "var songs=["
$start  = $html.IndexOf($marker)
$end    = $html.IndexOf("];", $start) + 2
$newSongs = "var songs=['$dataUrl'];"
$html = $html.Substring(0, $start) + $newSongs + $html.Substring($end)

# Activar loop
$html = $html.Replace("audio.volume=volume;", "audio.volume=volume;`n  audio.loop=true;")

[System.IO.File]::WriteAllText($htmlPath, $html, [System.Text.Encoding]::UTF8)

Write-Host ""
Write-Host "Listo! Clip incrustado con loop automatico." -ForegroundColor Yellow
Write-Host "Abre obreko.html y pulsa play en la soundbar." -ForegroundColor Yellow
pause
