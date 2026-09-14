$ErrorActionPreference = 'Stop'
$fx  = "$env:LOCALAPPDATA\Blade\App\Blade\firefox.exe"
$prof = Join-Path $env:TEMP 'blade-diag-prof'
$argline = '-no-remote -profile "' + $prof + '"'
Start-Process $fx -ArgumentList $argline
Start-Sleep -Seconds 14
$procs = @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
    Where-Object { $_.CommandLine -like '*blade-diag-prof*' -and $_.CommandLine -notlike '*-contentproc*' })
if ($procs.Count -eq 0) { throw 'diag instance did not start' }
Write-Host ('DIAG INSTANCE PID: ' + $procs[0].ProcessId)
Write-Host ('CmdLine: ' + $procs[0].CommandLine)
