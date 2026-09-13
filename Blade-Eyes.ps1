# ============================================================================
# Blade-Eyes.ps1 — «Глаза» (волна 1 «Blade Studio»): испытательный полигон.
# Поднимает dev-инстанс, снимает скриншоты (окно вперёд), собирает артефакты
# здоровья/перфа в датированный отчёт. Интерактивные прогулки по UI (меню B,
# палитра) делает смена через computer-use МЕЖДУ -Start и -Stop.
#
# Использование:
#   Blade-Eyes.ps1 -Start              поднять dev-инстанс (движок установленной
#                                      копии + F:-профиль; путь с пробелами —
#                                      кавычки внутри строки, конвенция 13)
#   Blade-Eyes.ps1 -Shot "имя"         скриншот экрана в отчёт (окно вперёд)
#   Blade-Eyes.ps1 -Stop               мягко закрыть СВОЙ инстанс (по PID)
#   Blade-Eyes.ps1 -Collect            собрать blade_health/perf_history/marks
#   Blade-Eyes.ps1 -Full               автотур без интерактива: старт → 2 скрина
#                                      (сплеш/устаканилось) → стоп → сбор
#
# ГВАРД: трогает ТОЛЬКО инстанс с F:-профилем (фильтр CommandLine); браузер
# владельца (C:-профиль) не трогается НИКОГДА. Скриншоты — весь экран, поэтому
# перед снимком окно инстанса принудительно выводится на передний план.
# ============================================================================
param(
    [switch]$Start,
    [switch]$Stop,
    [switch]$Collect,
    [switch]$Full,
    [string]$Shot
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$fx  = "$env:LOCALAPPDATA\Blade\App\Blade\firefox.exe"
$prof = 'F:\firefox michael edition\FirefoxPortable\Data\profile'
$stateFile = "$env:TEMP\blade-eyes-state.json"
$reportsRoot = 'F:\firefox michael edition\TestReports'

function Find-MyProc() {
    return @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
        Where-Object { $_.CommandLine -like '*FirefoxPortable\Data\profile*' -and $_.CommandLine -notlike '*-contentproc*' })
}

function Read-State() {
    if (Test-Path $stateFile) { return Get-Content $stateFile -Raw | ConvertFrom-Json }
    return $null
}

function Get-ReportDir([bool]$Create) {
    $st = Read-State
    if ($st -and (Test-Path $st.reportDir)) { return $st.reportDir }
    if (-not $Create) { throw 'Нет активного отчёта — сначала -Start' }
    $dir = Join-Path $reportsRoot ('eyes-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    @{ reportDir = $dir; pid = 0 } | ConvertTo-Json | Set-Content $stateFile -Encoding UTF8
    return $dir
}

if ($Start -or $Full) {
    if ((Find-MyProc).Count -gt 0) { throw 'dev-инстанс уже запущен — сначала -Stop' }
    $dir = Get-ReportDir $true
    # конвенция 13: путь с пробелами — в кавычках ВНУТРИ строки аргументов
    $argline = '-no-remote -profile "' + $prof + '"'
    $null = Start-Process $fx -ArgumentList $argline
    $deadline = (Get-Date).AddSeconds(30); $myPid = 0
    while ((Get-Date) -lt $deadline) {
        $p = Find-MyProc
        if ($p.Count -gt 0) { $myPid = $p[0].ProcessId; break }
        Start-Sleep -Milliseconds 300
    }
    if ($myPid -eq 0) { throw 'dev-инстанс не поднялся за 30с' }
    @{ reportDir = $dir; pid = $myPid } | ConvertTo-Json | Set-Content $stateFile -Encoding UTF8
    Write-Host "START: PID $myPid, отчёт: $dir"
}

if ($Shot -or $Full) { Add-Type -AssemblyName System.Windows.Forms, System.Drawing }

function Take-Shot([string]$Name) {
    $dir = Get-ReportDir $false
    $st = Read-State
    # окно инстанса — на передний план (скрин — весь экран)
    if ($st.pid -gt 0) {
        $proc = Get-Process -Id $st.pid -ErrorAction SilentlyContinue
        if ($proc -and $proc.MainWindowHandle -ne 0) {
            $sig = '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);'
            Add-Type -MemberDefinition $sig -Name U32 -Namespace Win -ErrorAction SilentlyContinue
            [Win.U32]::SetForegroundWindow($proc.MainWindowHandle) | Out-Null
            Start-Sleep -Milliseconds 400
        }
    }
    $existing = @(Get-ChildItem $dir -Filter '*.png' -ErrorAction SilentlyContinue)
    $nn = ('{0:D2}' -f ($existing.Count + 1))
    $b = New-Object System.Drawing.Bitmap([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width,
                                          [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height)
    $g = [System.Drawing.Graphics]::FromImage($b)
    $g.CopyFromScreen(0, 0, 0, 0, $b.Size)
    $path = Join-Path $dir ("$nn-$Name.png")
    $b.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $b.Dispose()
    Write-Host "SHOT: $path"
}

if ($Shot) { Take-Shot $Shot }

if ($Full) {
    Start-Sleep -Seconds 4
    Take-Shot 'boot-splash'
    Start-Sleep -Seconds 12
    Take-Shot 'newtab-settled'
}

if ($Stop -or $Full) {
    $st = Read-State
    if (-not $st) { throw 'Нечего останавливать' }
    foreach ($m in (Find-MyProc)) {
        $proc = Get-Process -Id $m.ProcessId -ErrorAction SilentlyContinue
        while ($proc -and -not $proc.HasExited) {
            $null = $proc.CloseMainWindow()
            Start-Sleep -Seconds 2
            try { $proc.Refresh() } catch { break }
        }
    }
    $deadline = (Get-Date).AddSeconds(20)
    do {
        Start-Sleep -Milliseconds 800
    } while ((Find-MyProc).Count -gt 0 -and (Get-Date) -lt $deadline)
    if ((Find-MyProc).Count -gt 0) {
        foreach ($m in (Find-MyProc)) { taskkill /PID $m.ProcessId /T /F | Out-Null }
    }
    Write-Host 'STOP: инстанс закрыт'
}

if ($Collect -or $Full) {
    $dir = Get-ReportDir $false
    $art = Join-Path $dir 'artifacts'
    New-Item -ItemType Directory -Path $art -Force | Out-Null
    $files = @(
        @{ src = "$prof\chrome\JS\blade_health.txt";  dst = 'blade_health.txt' },
        @{ src = "$prof\chrome\JS\perf_history.txt";  dst = 'perf_history.txt' },
        @{ src = "$prof\chrome\JS\perf_mark.txt";     dst = 'perf_mark.txt' },
        @{ src = "$prof\chrome\JS\update_chronicle.txt"; dst = 'update_chronicle.txt' },
        @{ src = "$prof\chrome\VERSION";              dst = 'VERSION.txt' }
    )
    foreach ($f in $files) {
        if (Test-Path $f.src) { Copy-Item $f.src (Join-Path $art $f.dst) -Force }
    }
    $index = @()
    $index += "# Глаза — отчёт " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
    $index += ""
    $index += "## Скриншоты"
    $index += (Get-ChildItem $dir -Filter '*.png' | ForEach-Object { "- $($_.Name)" })
    $index += ""
    $index += "## Артефакты"
    $index += (Get-ChildItem $art | ForEach-Object { "- $($_.Name) ($($_.Length) б)" })
    $index += ""
    $index += "## Вердикт здоровья"
    if (Test-Path "$art\blade_health.txt") {
        $index += (Get-Content "$art\blade_health.txt" | Select-Object -First 1)
    }
    $index | Set-Content (Join-Path $dir 'index.md') -Encoding UTF8
    Write-Host "COLLECT: $dir (скринов: $((Get-ChildItem $dir -Filter '*.png').Count))"
    Write-Host "Готово: обзор в $dir\index.md"
}
