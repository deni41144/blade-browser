# ============================================================================
# Blade Patch Applier — применяет патч Blade-Patch-vX.Y.zip к установленному
# Blade. Запускается через UPDATE.bat (двойной клик) из папки распакованного
# патча. Совместим с PowerShell 5.1 (Windows 10/11 из коробки).
# ============================================================================
param(
    # Путь к папке установки Blade (где лежит FirefoxPortable). Если пусто — ищем сами.
    [string]$BladeRoot = ''
)
$ErrorActionPreference = 'Stop'

# Кириллица в консоли
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$patchRoot = $PSScriptRoot
if (-not $patchRoot) { $patchRoot = (Get-Location).Path }

# --- Патч должен лежать рядом: files\chrome\VERSION содержит версию патча ---
$patchVerFile = Join-Path $patchRoot 'files\chrome\VERSION'
if (-not (Test-Path $patchVerFile)) {
    Write-Host 'ОШИБКА: рядом со скриптом нет папки files\chrome.' -ForegroundColor Red
    Write-Host 'Распакуй архив патча ЦЕЛИКОМ и запусти UPDATE.bat из его папки.'
    exit 1
}
$patchVersion = (Get-Content $patchVerFile -First 1).Trim()

Write-Host ''
Write-Host '============================================' -ForegroundColor DarkRed
Write-Host "  BLADE PATCH  v$patchVersion" -ForegroundColor Red
Write-Host '============================================' -ForegroundColor DarkRed

# --- Поиск установки Blade (два лейаута: установщик v1.4.4+ кладёт в
# {root}\Data\profile, старые установки и дев-машина — {root}\FirefoxPortable\Data\profile) ---
function Test-BladeInstall([string]$p) {
    if (-not $p) { return $false }
    if (Test-Path (Join-Path $p 'Data\profile\chrome')) { return $true }
    return (Test-Path (Join-Path $p 'FirefoxPortable\Data\profile\chrome'))
}
function Find-Blade([string]$Hint) {
    if ($Hint) {
        if (Test-BladeInstall $Hint) { return $Hint }
        # Разрешаем указать и вложенную папку (например, выбрал FirefoxPortable)
        $sub = Join-Path $Hint 'FirefoxPortable'
        if (Test-BladeInstall $sub) { return $sub }
    }
    $std = Join-Path $env:LOCALAPPDATA 'Blade'
    if (Test-BladeInstall $std) { return $std }
    # Реестр: ключ деинсталляции. ВАЖНО: наш WPF-установщик пишет DisplayName
    # = 'Blade Browser', старый Inno — 'Blade', поэтому сравнение через -like.
    $hives = @(
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
        'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall'
    )
    $cands = @()
    foreach ($hive in $hives) {
        try {
            $keys = Get-ChildItem $hive -ErrorAction SilentlyContinue
            foreach ($k in $keys) {
                $pr = Get-ItemProperty $k.PSPath -ErrorAction SilentlyContinue
                if ($pr.DisplayName -like 'Blade*' -and $pr.InstallLocation) {
                    $loc = [string]$pr.InstallLocation
                    if (Test-BladeInstall $loc -and $cands -notcontains $loc) { $cands += $loc }
                }
            }
        } catch {}
    }
    if ($cands.Count -eq 1) { return $cands[0] }
    if ($cands.Count -gt 1) {
        # Несколько установок (старые следы): берём с самой свежей версией chrome
        function Get-BladeVersion([string]$p) {
            foreach ($rel in @('Data\profile\chrome\VERSION', 'FirefoxPortable\Data\profile\chrome\VERSION')) {
                $f = Join-Path $p $rel
                if (Test-Path $f) { return (Get-Content $f -First 1).Trim() }
            }
            return '0.0'
        }
        $best = $cands[0]; $bestV = $null
        foreach ($c in $cands) {
            $v = $null
            try { $v = [version](Get-BladeVersion $c) } catch { $v = [version]'0.0' }
            if ($null -eq $bestV -or $v -gt $bestV) { $best = $c; $bestV = $v }
        }
        return $best
    }
    return $null
}

function Show-FindTrace {
    # Диагностика для удалённой помощи: видно, что проверялось и что в реестре
    Write-Host 'Что проверено:' -ForegroundColor Yellow
    Write-Host ("  папка по умолчанию: " + (Join-Path $env:LOCALAPPDATA 'Blade') + ' — ' + $(if (Test-BladeInstall (Join-Path $env:LOCALAPPDATA 'Blade')) {'НАЙДЕНА'} else {'нет/не подходит'}))
    $hives = @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall')
    $found = $false
    foreach ($hive in $hives) {
        try {
            $keys = Get-ChildItem $hive -ErrorAction SilentlyContinue
            foreach ($k in $keys) {
                $pr = Get-ItemProperty $k.PSPath -ErrorAction SilentlyContinue
                if ($pr.DisplayName -like 'Blade*') {
                    $found = $true
                    Write-Host ("  реестр: '" + $pr.DisplayName + "' -> " + $pr.InstallLocation + ' — ' + $(if (Test-BladeInstall ([string]$pr.InstallLocation)) {'подходит'} else {'папка не похожа на Blade'}))
                }
            }
        } catch {}
    }
    if (-not $found) { Write-Host '  реестр: записей Blade* не найдено (браузер ставился другим путём?)' }
}

$root = Find-Blade $BladeRoot
if (-not $root) {
    Write-Host 'Blade не найден автоматически.' -ForegroundColor Yellow
    Show-FindTrace
    $inp = Read-Host "Введи путь к папке Blade (где папка App или FirefoxPortable), например $env:LOCALAPPDATA\Blade"
    if ($inp) { $root = Find-Blade $inp.Trim('"').Trim("'") }
}
if (-not $root) {
    Show-FindTrace
    Write-Host 'Установка Blade не найдена — обновление отменено.' -ForegroundColor Red
    exit 1
}
Write-Host "Найден Blade: $root"

$profileDir = Join-Path $root 'Data\profile'
if (-not (Test-Path (Join-Path $profileDir 'chrome'))) {
    $profileDir = Join-Path $root 'FirefoxPortable\Data\profile'
}
$chromeDir  = Join-Path $profileDir 'chrome'

# --- Текущая версия ---
$oldVersion = 'неизвестно'
$oldVerFile = Join-Path $chromeDir 'VERSION'
if (Test-Path $oldVerFile) { $oldVersion = (Get-Content $oldVerFile -First 1).Trim() }
Write-Host "Текущая версия: $oldVersion"

# --- Защита от даунгрейда ---
function Parse-VersionString([string]$v) {
    $p = @()
    foreach ($x in ($v -split '\.')) { $n = 0; if ([int]::TryParse($x, [ref]$n)) { $p += $n } }
    return ,$p
}
function Compare-VersionString([string]$a, [string]$b) {
    # -1: a<b, 0: равны, 1: a>b
    $pa = Parse-VersionString $a; $pb = Parse-VersionString $b
    $max = [Math]::Max($pa.Count, $pb.Count)
    for ($i = 0; $i -lt $max; $i++) {
        $xa = 0; if ($i -lt $pa.Count) { $xa = $pa[$i] }
        $xb = 0; if ($i -lt $pb.Count) { $xb = $pb[$i] }
        if ($xa -lt $xb) { return -1 }
        if ($xa -gt $xb) { return 1 }
    }
    return 0
}
if ($oldVersion -ne 'неизвестно' -and ((Compare-VersionString $patchVersion $oldVersion) -lt 0)) {
    Write-Host "ВНИМАНИЕ: у тебя версия $oldVersion НОВЕЕ патча $patchVersion." -ForegroundColor Yellow
    $c = Read-Host 'Всё равно поставить? (y/N)'
    if ($c -notmatch '^[yYдД]') { Write-Host 'Отменено.'; exit 0 }
}

# --- Закрываем запущенный Blade (только его процессы, чужой Firefox не трогаем) ---
$running = Get-Process firefox -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -and $_.Path.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) }
if ($running) {
    Write-Host ("Blade запущен (pid: " + ($running.Id -join ', ') + ') — закрываю...') -ForegroundColor Yellow
    $running | ForEach-Object { try { $_.CloseMainWindow() | Out-Null } catch {} }
    $running | Wait-Process -Timeout 10 -ErrorAction SilentlyContinue
    $running = Get-Process firefox -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -and $_.Path.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) }
    if ($running) { $running | Stop-Process -Force }
    Start-Sleep -Seconds 1
}

# --- Бэкап старой папки chrome + user.js (ничего не теряется) ---
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $root ("Backups\profile-chrome-v{0}-{1}" -f $oldVersion, $stamp)
try {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    Copy-Item $chromeDir (Join-Path $backupDir 'chrome') -Recurse -Force
    if (Test-Path (Join-Path $profileDir 'user.js')) {
        Copy-Item (Join-Path $profileDir 'user.js') (Join-Path $backupDir 'user.js') -Force
    }
    Write-Host "Бэкап старого: $backupDir" -ForegroundColor DarkGray
} catch {
    Write-Host "ОШИБКА бэкапа: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Обновление отменено (данные не тронуты).'
    exit 1
}

# --- Применение: наши файлы заменяем, img не трогаем (там могут быть свои обои/обложки) ---
try {
    Get-ChildItem $chromeDir -Exclude 'img' | Remove-Item -Recurse -Force
    Copy-Item (Join-Path $patchRoot 'files\chrome\*') $chromeDir -Recurse -Force
    Copy-Item (Join-Path $patchRoot 'files\user.js') $profileDir -Force

    # Вычищаем мёртвые файлы старых версий (точные имена, свои файлы не задеваем)
    $deadFiles = @(
        'acheron_bg.jpg', 'acheron_bg_before_shift.jpg', 'acheron_bg_fixed.jpg',
        'acheron_bg_old.jpg', 'acheron_bg_shift_v1.jpg', 'acheron_bg_v3.jpg',
        'acheron_bg_v4.jpg'
    )
    foreach ($f in $deadFiles) {
        $p = Join-Path (Join-Path $chromeDir 'img') $f
        if (Test-Path $p) { Remove-Item $p -Force -ErrorAction SilentlyContinue }
    }
} catch {
    Write-Host "ОШИБКА применения: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Старое сохранено в: $backupDir"
    exit 1
}

# --- Отчёт ---
$fileCount = (Get-ChildItem (Join-Path $patchRoot 'files') -Recurse -File).Count
$changes = Join-Path $patchRoot 'CHANGES.txt'
if (Test-Path $changes) {
    Write-Host ''
    Write-Host '--- Что нового ---' -ForegroundColor Cyan
    Get-Content $changes | ForEach-Object { Write-Host "  $_" }
}
Write-Host ''
Write-Host "ГОТОВО: $oldVersion  ->  v$patchVersion  ($fileCount файлов)" -ForegroundColor Green
Write-Host 'Перезапусти Blade, чтобы применить.' -ForegroundColor Green
exit 0
