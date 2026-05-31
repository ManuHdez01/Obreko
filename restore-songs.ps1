# ── Restaurar obreko.html quitando el base64 ──
$htmlPath = Join-Path $PSScriptRoot "obreko.html"
$html = [System.IO.File]::ReadAllText($htmlPath, [System.Text.Encoding]::UTF8)

$marker = "var songs=["
$start  = $html.IndexOf($marker)
$end    = $html.IndexOf("];", $start) + 2

$original = "var songs=['song1.mp3.mp3','song2.mp3.mp3','song3.mp3.mp3'];"
$html = $html.Substring(0, $start) + $original + $html.Substring($end)

[System.IO.File]::WriteAllText($htmlPath, $html, [System.Text.Encoding]::UTF8)
Write-Host "Restaurado correctamente!" -ForegroundColor Green
pause
