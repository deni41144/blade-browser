$ErrorActionPreference = 'Stop'
# чистим клон от старого кода: кладём 1.14.5 (клон = 1.14.3 с 16:10)
Copy-Item 'F:\firefox michael edition\FirefoxPortable\Data\profile\chrome\JS\BobliksSettings.uc.js' "$env:TEMP\blade-diag-prof\chrome\JS\BobliksSettings.uc.js" -Force
# запуск клона на ЧИНЁНОМ C:-движке (loader восстановлен в 17:0x)
Start-Process "$env:LOCALAPPDATA\Blade\App\Blade\firefox.exe" -ArgumentList ('-no-remote -profile "' + (Join-Path $env:TEMP 'blade-diag-prof') + '"')
Start-Sleep -Seconds 8
$js = Join-Path $env:TEMP 'blade-diag-prof\chrome\JS'
$deadline = (Get-Date).AddSeconds(35)
while ((Get-Date) -lt $deadline) {
    $m = Get-Item (Join-Path $js 'bobliks_settings_mark.txt') -ErrorAction SilentlyContinue
    if ($m -and $m.LastWriteTime -gt (Get-Date).AddMinutes(-1)) { break }
    Start-Sleep -Seconds 5
}
Write-Host '=== HEALTH ==='
Get-Content (Join-Path $js 'blade_health.txt') -ErrorAction SilentlyContinue | Select-Object -First 7
Write-Host '=== MARK ==='
Get-Content (Join-Path $js 'bobliks_settings_mark.txt') -ErrorAction SilentlyContinue
$procs = @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
    Where-Object { $_.CommandLine -like '*blade-diag-prof*' -and $_.CommandLine -notlike '*-contentproc*' })
if ($procs.Count -gt 0) { Write-Host ('CLONE PID: ' + $procs[0].ProcessId) } else { Write-Host 'CLONE: no process!' }
