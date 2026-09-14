$ErrorActionPreference = 'Stop'
# 1) стоп клон-инстанс (rain-test), он больше не нужен
$procs = @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
    Where-Object { $_.CommandLine -like '*blade-diag-prof*' })
foreach ($p in $procs) { taskkill /PID $p.ProcessId /T /F | Out-Null }
Start-Sleep -Seconds 2

# 2) свежий профиль как из установщика: пустой + chrome/ + user.js из dev
$dev = 'F:\firefox michael edition\FirefoxPortable\Data\profile'
$fresh = Join-Path $env:TEMP 'blade-fresh-prof'
if (Test-Path $fresh) { Remove-Item $fresh -Recurse -Force }
New-Item -ItemType Directory -Path $fresh | Out-Null
Copy-Item (Join-Path $dev 'chrome') (Join-Path $fresh 'chrome') -Recurse
Copy-Item (Join-Path $dev 'user.js') $fresh

# 3) запуск движка на свежем профиле
$fx = "$env:LOCALAPPDATA\Blade\App\Blade\firefox.exe"
Start-Process $fx -ArgumentList ('-no-remote -profile "' + $fresh + '"')
Start-Sleep -Seconds 16
$procs = @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
    Where-Object { $_.CommandLine -like '*blade-fresh-prof*' -and $_.CommandLine -notlike '*-contentproc*' })
if ($procs.Count -eq 0) { throw 'fresh-profile instance did not start' }
Write-Host ('FRESH INSTANCE PID: ' + $procs[0].ProcessId)
Write-Host ('Profile: ' + $fresh)
