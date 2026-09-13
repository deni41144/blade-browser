# External boot-timing harness: time from process start until main window is shown.
# ASCII-only by convention (PS 5.1 reads no-BOM as ANSI).
param(
    [int]$Runs = 5
)
$fx = 'C:\Users\Deni\AppData\Local\Blade\App\Blade\firefox.exe'
$floorProfile = "$env:TEMP\blade-floor-profile"
$devArgline = '-no-remote -profile "F:\firefox michael edition\FirefoxPortable\Data\profile"'
$floorArgline = '-no-remote -profile "' + $floorProfile + '"'

function Find-MainProc([string]$profileMarker) {
    $procs = Get-CimInstance Win32_Process -Filter "name='firefox.exe'" |
        Where-Object { $_.CommandLine -like "*$profileMarker*" -and $_.CommandLine -notlike '*-contentproc*' }
    return $procs
}

function Measure-Boot([string]$argline, [string]$profileMarker, [string]$label, [int]$n) {
    $times = @()
    for ($i = 0; $i -lt $n; $i++) {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $null = Start-Process $fx -ArgumentList $argline
        $shown = $false
        while ($sw.ElapsedMilliseconds -lt 30000) {
            $main = Find-MainProc $profileMarker
            foreach ($m in @($main)) {
                $gp = Get-Process -Id $m.ProcessId -ErrorAction SilentlyContinue
                if ($gp -and $gp.MainWindowHandle -ne 0) { $shown = $true; break }
            }
            if ($shown) { break }
            Start-Sleep -Milliseconds 40
        }
        $ms = $sw.ElapsedMilliseconds
        if ($shown) { $times += $ms }
        # graceful close of our instance only
        $main = Find-MainProc $profileMarker
        foreach ($m in @($main)) {
            $gp = Get-Process -Id $m.ProcessId -ErrorAction SilentlyContinue
            while ($gp -and -not $gp.HasExited) {
                $null = $gp.CloseMainWindow()
                Start-Sleep -Seconds 2
                try { $gp.Refresh() } catch { break }
            }
        }
        $deadline = (Get-Date).AddSeconds(20)
        do {
            Start-Sleep -Milliseconds 700
            $main = Find-MainProc $profileMarker
        } while (@($main).Count -gt 0 -and (Get-Date) -lt $deadline)
        if (@($main).Count -gt 0) {
            foreach ($m in @($main)) { taskkill /PID $m.ProcessId /T /F | Out-Null }
            Start-Sleep -Seconds 2
        }
        Write-Host ("{0} run {1}: {2} ms (shown={3})" -f $label, ($i+1), $ms, $shown)
    }
    if ($times.Count -gt 0) {
        $sorted = $times | Sort-Object
        $median = $sorted[[int][Math]::Floor(($sorted.Count - 1) / 2)]
        Write-Host ("{0} MEDIAN: {1} ms (runs: {2})" -f $label, $median, ($times -join ', '))
    } else {
        Write-Host ("{0} NO SUCCESSFUL RUNS" -f $label)
    }
}

# Floor profile: warmup boot first (profile creation + first-run), then measured
if (-not (Test-Path $floorProfile)) { New-Item -ItemType Directory -Path $floorProfile -Force | Out-Null }
Write-Host '--- warmup floor profile ---'
$null = Start-Process $fx -ArgumentList $floorArgline
Start-Sleep -Seconds 12
$main = Find-MainProc 'blade-floor-profile'
foreach ($m in @($main)) {
    $gp = Get-Process -Id $m.ProcessId -ErrorAction SilentlyContinue
    while ($gp -and -not $gp.HasExited) { $null = $gp.CloseMainWindow(); Start-Sleep -Seconds 2; try { $gp.Refresh() } catch { break } }
}
Start-Sleep -Seconds 4

Write-Host '=== FLOOR (fresh profile, no chrome/extensions/session) ==='
Measure-Boot $floorArgline 'blade-floor-profile' 'FLOOR' $Runs
Write-Host '=== DEV (full Blade: chrome + extensions + session) ==='
Measure-Boot $devArgline 'FirefoxPortable\Data\profile' 'DEV' $Runs
