$ErrorActionPreference = 'Stop'
# 1) страховка: не осталось ли процессов на тестовом профиле
$old = @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
    Where-Object { $_.CommandLine -like '*F:\Data\profile*' })
foreach ($p in $old) { taskkill /PID $p.ProcessId /T /F | Out-Null }
Start-Sleep -Seconds 2

# 2) запуск тестовой копии движка на её профиле (контролируемый стенд бага)
$fx = 'F:\App\Blade\firefox.exe'
Start-Process $fx -ArgumentList '-no-remote -profile "F:\Data\profile"'
Start-Sleep -Seconds 5

# 3) поллинг mark/health 40 секунд
$js = 'F:\Data\profile\chrome\JS'
$deadline = (Get-Date).AddSeconds(40)
while ((Get-Date) -lt $deadline) {
    $h = Get-Item (Join-Path $js 'blade_health.txt') -ErrorAction SilentlyContinue
    $m = Get-Item (Join-Path $js 'bobliks_settings_mark.txt') -ErrorAction SilentlyContinue
    $hs = if ($h) { $h.LastWriteTime.ToString('HH:mm:ss') } else { '-' }
    $ms = if ($m) { $m.LastWriteTime.ToString('HH:mm:ss') } else { '-' }
    Write-Host ("t: health=$hs mark=$ms")
    if ($h -and $h.LastWriteTime -gt (Get-Date).AddMinutes(-1) -and $m -and $m.LastWriteTime -gt (Get-Date).AddMinutes(-1)) {
        Write-Host 'BOTH FILES FRESH — scripts ran'
        break
    }
    Start-Sleep -Seconds 5
}
Write-Host '=== HEALTH ==='
Get-Content (Join-Path $js 'blade_health.txt') -ErrorAction SilentlyContinue
Write-Host '=== MARK ==='
Get-Content (Join-Path $js 'bobliks_settings_mark.txt') -ErrorAction SilentlyContinue
$procs = @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
    Where-Object { $_.CommandLine -like '*F:\Data\profile*' -and $_.CommandLine -notlike '*-contentproc*' })
if ($procs.Count -gt 0) { Write-Host ('TESTBED PID: ' + $procs[0].ProcessId) } else { Write-Host 'TESTBED: no process' }
