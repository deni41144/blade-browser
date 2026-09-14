$ErrorActionPreference = 'Stop'
# килл клона (конвенция: только по PID с фильтром cmdline, никогда /IM)
$procs = @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
    Where-Object { $_.CommandLine -like '*blade-diag-prof*' })
foreach ($p in $procs) { taskkill /PID $p.ProcessId /T /F | Out-Null }
Start-Sleep -Seconds 3
# единственная переменная: дождь (было false/отсутствует)
$uj = Join-Path $env:TEMP 'blade-diag-prof\user.js'
Add-Content -Path $uj -Encoding UTF8 -Value @"

// ==== RAIN TEST: единственная тестируемая переменная ====
user_pref("blade.weather.rain", true);
"@
Write-Host 'rain pref appended, relaunching'
$fx  = "$env:LOCALAPPDATA\Blade\App\Blade\firefox.exe"
$prof = Join-Path $env:TEMP 'blade-diag-prof'
Start-Process $fx -ArgumentList ('-no-remote -profile "' + $prof + '"')
Start-Sleep -Seconds 14
$procs = @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
    Where-Object { $_.CommandLine -like '*blade-diag-prof*' -and $_.CommandLine -notlike '*-contentproc*' })
if ($procs.Count -eq 0) { throw 'diag instance did not restart' }
Write-Host ('DIAG INSTANCE PID: ' + $procs[0].ProcessId)
