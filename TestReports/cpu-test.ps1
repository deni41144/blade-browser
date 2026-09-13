$ErrorActionPreference = 'Stop'
$engine = "$env:LOCALAPPDATA\Blade\App\Blade\firefox.exe"
$prof = Join-Path $env:TEMP 'blade-ram-prof'
function Find-Main() {
    @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
        Where-Object { $_.CommandLine -like '*blade-ram-prof*' -and $_.CommandLine -notlike '*-contentproc*' })
}
$null = Start-Process $engine -ArgumentList ('-profile "' + $prof + '"')
Start-Sleep -Seconds 20
$null = Start-Process $engine -ArgumentList ('-profile "' + $prof + '" "https://rozetka.com.ua/" "https://aliexpress.com/" "https://www.pinterest.com/"')
Start-Sleep -Seconds 30
$main = Find-Main
$mainId = $main[0].ProcessId
$tree = @($mainId) + @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
    Where-Object { $_.CommandLine -like "*-parentPid $mainId*" } | ForEach-Object { $_.ProcessId })
$cpu = 0; $ram = 0
foreach ($p in $tree) {
    try { $pr = Get-Process -Id $p -ErrorAction Stop; $cpu += $pr.TotalProcessorTime.TotalSeconds; $ram += $pr.PrivateMemorySize64 } catch {}
}
Write-Host ("CPU: {0:N1}s  RAM: {1} MB  ({2} procs)" -f $cpu, [math]::Round($ram/1MB), $tree.Count)
foreach ($m in (Find-Main)) {
    $proc = Get-Process -Id $m.ProcessId -ErrorAction SilentlyContinue
    while ($proc -and -not $proc.HasExited) { $null = $proc.CloseMainWindow(); Start-Sleep -Seconds 2; try { $proc.Refresh() } catch { break } }
}
foreach ($m in (Find-Main)) { taskkill /PID $m.ProcessId /T /F 2>$null | Out-Null }
Start-Sleep -Seconds 5
