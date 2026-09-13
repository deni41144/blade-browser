# Диета памяти 2.0: замер RAM Blade.
# Запуск: powershell -File TestReports\measure-ram.ps1 -Label "baseline" [-Runs 3]
# Профиль — КЛОН dev-профиля (TestReports\make-ram-clone.ps1, %TEMP%\blade-ram-prof):
# в клоне отключены диалоги закрытия; dev-профиль F: не трогается вообще.
# Движок — владельца (конвенция 13, однострочный ArgumentList).
# URLs передаются ОТДЕЛЬНОЙ remoting-командой в уже поднятый инстанс: cmdline-URL
# при прямом старте движок теряет через ре-спавн лаунчера (нестабильно, часть
# прогонов открывалась пустой newtab — 6 процессов вместо 12).
# Результат → TestReports\ram-diet.csv.
param(
    [Parameter(Mandatory=$true)][string]$Label,
    [int]$Runs = 3,
    [int]$WaitSec = 25,
    # web6 — шесть лёгких сайтов на разных eTLD+1, без видео: сигнал от потолка
    # web-процессов заметнее, а видеобуферы не шумят (урок: youtube = ±10% шума)
    [ValidateSet('web3','web6')][string]$Preset = 'web3'
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$engine = "$env:LOCALAPPDATA\Blade\App\Blade\firefox.exe"
$profile_ = Join-Path $env:TEMP 'blade-ram-prof'
$urlSets = @{
    web3 = '"https://www.wikipedia.org/" "https://www.youtube.com/" "https://example.com/"'
    web6 = '"https://example.com/" "https://www.wikipedia.org/" "https://developer.mozilla.org/" "https://news.ycombinator.com/" "https://github.com/" "https://www.bbc.com/"'
}
$urls = $urlSets[$Preset]
$csv = Join-Path $PSScriptRoot 'ram-diet.csv'

if (-not (Test-Path $engine))  { throw "Движок не найден: $engine" }
if (-not (Test-Path $profile_)) { throw "Клон профиля не найден: $profile_ (запусти make-ram-clone.ps1)" }

function Find-MyMain() {
    return @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
        Where-Object { $_.CommandLine -like '*blade-ram-prof*' -and $_.CommandLine -notlike '*-contentproc*' })
}

function Close-MyInstance() {
    foreach ($m in (Find-MyMain)) {
        $proc = Get-Process -Id $m.ProcessId -ErrorAction SilentlyContinue
        while ($proc -and -not $proc.HasExited) {
            $null = $proc.CloseMainWindow()
            Start-Sleep -Seconds 2
            try { $proc.Refresh() } catch { break }
        }
    }
    $deadline = (Get-Date).AddSeconds(20)
    do { Start-Sleep -Milliseconds 800 }
    while ((Find-MyMain).Count -gt 0 -and (Get-Date) -lt $deadline)
    foreach ($m in (Find-MyMain)) { taskkill /PID $m.ProcessId /T /F 2>$null | Out-Null }
    Start-Sleep -Seconds 5
}

$results = @()
for ($i = 1; $i -le $Runs; $i++) {
    if ((Find-MyMain).Count -gt 0) { Close-MyInstance }
    # шаг 1: поднять инстанс (remoting-сервер профиля; владельческий C:-профиль —
    # другой профиль, ремотингом не пересекается)
    $null = Start-Process $engine -ArgumentList ('-profile "' + $profile_ + '"')
    Start-Sleep -Seconds $WaitSec
    # шаг 2: URLs remoting-ом (клиентский процесс отработает и умрёт)
    $null = Start-Process $engine -ArgumentList ('-profile "' + $profile_ + '" ' + $urls)
    Start-Sleep -Seconds $WaitSec

    $mains = Find-MyMain
    if ($mains.Count -eq 0) {
        Write-Host "ДИАГНОСТИКА: все firefox.exe сейчас:" -ForegroundColor Yellow
        Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" | ForEach-Object {
            Write-Host ("  {0} :: {1}" -f $_.ProcessId, $_.CommandLine)
        }
        throw "Главный процесс замера (клон профиля) не найден"
    }
    $mainId = $mains[0].ProcessId
    $pids = @($mainId) + @(
        Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
            Where-Object { $_.CommandLine -like "*-parentPid $mainId*" } |
            ForEach-Object { $_.ProcessId })

    $sum = 0
    foreach ($procId in $pids) {
        try {
            $pr = Get-Process -Id $procId -ErrorAction Stop
            $sum += $pr.PrivateMemorySize64
        } catch { } # процесс мог выйти между списком и замером
    }
    $mb = [math]::Round($sum / 1MB)
    $results += $mb
    Write-Host ("Прогон {0}: {1} МБ ({2} процессов)" -f $i, $mb, $pids.Count)
    Close-MyInstance
}

$median = ($results | Sort-Object)[[int][math]::Floor($results.Count / 2)]
$line = "{0};{1};{2};{3}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Label, ($results -join ','), $median
Add-Content -Path $csv -Value $line -Encoding UTF8
Write-Host "МЕДИАНА [$Label]: $median МБ" -ForegroundColor Green
