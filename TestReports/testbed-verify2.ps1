$ErrorActionPreference = 'Stop'
# килл тест-стенда
$old = @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
    Where-Object { $_.CommandLine -like '*F:\Data\profile*' })
foreach ($p in $old) { taskkill /PID $p.ProcessId /T /F | Out-Null }
Start-Sleep -Seconds 2
# деплой 1.14.5 в стенд
Copy-Item 'F:\firefox michael edition\FirefoxPortable\Data\profile\chrome\JS\BobliksSettings.uc.js' 'F:\Data\profile\chrome\JS\BobliksSettings.uc.js' -Force
Write-Host '1.14.5 deployed'
# запуск
Start-Process 'F:\App\Blade\firefox.exe' -ArgumentList '-no-remote -profile "F:\Data\profile"'
Start-Sleep -Seconds 8
# поллинг
$js = 'F:\Data\profile\chrome\JS'
$deadline = (Get-Date).AddSeconds(35)
while ((Get-Date) -lt $deadline) {
    $m = Get-Item (Join-Path $js 'bobliks_settings_mark.txt') -ErrorAction SilentlyContinue
    if ($m -and $m.LastWriteTime -gt (Get-Date).AddMinutes(-1)) { break }
    Start-Sleep -Seconds 5
}
Write-Host '=== HEALTH ==='
Get-Content (Join-Path $js 'blade_health.txt') -ErrorAction SilentlyContinue | Select-Object -First 6
Write-Host '=== MARK ==='
Get-Content (Join-Path $js 'bobliks_settings_mark.txt') -ErrorAction SilentlyContinue
$procs = @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
    Where-Object { $_.CommandLine -like '*F:\Data\profile*' -and $_.CommandLine -notlike '*-contentproc*' })
if ($procs.Count -gt 0) { Write-Host ('TESTBED PID: ' + $procs[0].ProcessId) } else { Write-Host 'TESTBED: no process!' }
