# ============================================================================
# Blade Apply Update — применяет скачанный апдейтером пакет к установке Blade.
# Совместим с PowerShell 5.1 (Windows 10/11 из коробки).
#
# Запуск двумя путями:
#   1) BladeUpdater.uc.js (автообновление, в один клик):
#      powershell -File <этот скрипт> -ZipPath <zip> -BladeRoot <корень>
#        -ProfileDir <профиль> -Auto
#   2) Вручную из консоли (отладка): без -Auto — подтверждения, без рестарта.
#
# Пакет понимает двух видов:
#   ПАТЧ  (Build-Blade-Patch):  files\chrome\..., files\user.js
#   ПОЛНЫЙ (data.zip):          App\Firefox64\..., profile\chrome\..., profile\user.js
# ============================================================================
param(
    [Parameter(Mandatory = $true)][string]$ZipPath,
    [Parameter(Mandatory = $true)][string]$BladeRoot,
    [Parameter(Mandatory = $true)][string]$ProfileDir,
    [switch]$Auto,        # авто-режим: без вопросов, сам перезапустит браузер
    [switch]$SelfCopied   # внутренний: копия уже в %TEMP%, работает основная логика
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# --- Самокопия в %TEMP%: оригинал лежит в chrome\, которую сами же заменяем.
# PowerShell держит .ps1 открытым во время исполнения — без копии удаление
# старого chrome падало бы на этом файле (паттерн деинсталлятора).
if (-not $SelfCopied) {
    # Фиксированное имя: каждая копия перезаписывает прошлую — без мусора в %TEMP%
    $tmpSelf = Join-Path $env:TEMP 'blade-apply-update.ps1'
    Copy-Item -LiteralPath $PSCommandPath -Destination $tmpSelf -Force
    $argList = @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"{0}"' -f $tmpSelf),
        '-ZipPath',   ('"{0}"' -f $ZipPath),
        '-BladeRoot', ('"{0}"' -f $BladeRoot),
        '-ProfileDir',('"{0}"' -f $ProfileDir)
    )
    if ($Auto) { $argList += '-Auto' }
    $argList += '-SelfCopied'
    Start-Process -FilePath 'powershell.exe' -ArgumentList $argList -WindowStyle Normal
    exit 0
}

# ================================ основная логика ================================

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$staging = Join-Path $env:TEMP "blade-update-staging-$stamp"
$chromeDir = Join-Path $ProfileDir 'chrome'
$engineDir = $null

# Папка движка: у друзей App\Blade, на дев-машине App\Firefox64
foreach ($cand in @((Join-Path $BladeRoot 'App\Blade'), (Join-Path $BladeRoot 'App\Firefox64'))) {
    if (Test-Path (Join-Path $cand 'firefox.exe')) { $engineDir = $cand; break }
}

function Write-Result([string]$kind, [string]$msg) {
    # Читает BladeUpdater при следующем старте браузера (однократное уведомление).
    # UTF-8 БЕЗ BOM: readUTF8 в браузере не глотает префикс
    try {
        [System.IO.File]::WriteAllText(
            (Join-Path $ProfileDir 'update_result.txt'),
            "$kind $msg", (New-Object System.Text.UTF8Encoding($false)))
    } catch {}
}

function Restart-Blade {
    if (-not $engineDir) { return }
    $fx = Join-Path $engineDir 'firefox.exe'
    if (Test-Path $fx) {
        try {
            Start-Process -FilePath $fx `
                -ArgumentList @('-profile', ('"{0}"' -f $ProfileDir)) `
                -WorkingDirectory $engineDir
        } catch { Write-Host "Не удалось запустить браузер: $($_.Exception.Message)" -ForegroundColor Red }
    }
}

function Remove-Staging {
    try { if ($staging -and (Test-Path $staging)) { Remove-Item $staging -Recurse -Force } } catch {}
}

function Finish([string]$kind, [string]$msg, [int]$code) {
    Write-Host ''
    if ($kind -eq 'OK') { Write-Host "ГОТОВО: $msg" -ForegroundColor Green }
    else { Write-Host "ОШИБКА: $msg" -ForegroundColor Red }
    Write-Result $kind $msg
    Remove-Staging
    # Скачанный архив чистим только в авто-режиме и только из profile\updates
    $updDir = Join-Path $ProfileDir 'updates'
    if ($Auto -and $ZipPath.StartsWith($updDir, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $ZipPath)) {
        try { Remove-Item -LiteralPath $ZipPath -Force } catch {}
    }
    if ($Auto) {
        Write-Host 'Перезапускаю Blade...' -ForegroundColor DarkGray
        Restart-Blade
    } else {
        Write-Host 'Перезапусти Blade вручную.' -ForegroundColor Yellow
    }
    exit $code
}

Write-Host ''
Write-Host '============================================' -ForegroundColor DarkRed
Write-Host '  BLADE UPDATE' -ForegroundColor Red
Write-Host '============================================' -ForegroundColor DarkRed
Write-Host "Установка: $BladeRoot"

# --- Валидация входа ---
if (-not (Test-Path -LiteralPath $ZipPath)) { Finish 'ERR' "архив не найден: $ZipPath" 1 }
if (-not (Test-Path $chromeDir)) { Finish 'ERR' "не найден профиль: $chromeDir" 1 }

# --- Место на дисках ДО распаковки: полный пакет ~200 МБ zip -> ~700 МБ в TEMP ---
$zipItem = Get-Item -LiteralPath $ZipPath
if ($zipItem.Length -gt 50MB) {
    try {
        $tmpDrive = [System.IO.Path]::GetPathRoot($env:TEMP).TrimEnd('\')[0]
        $tmpFree = (Get-PSDrive -Name $tmpDrive -ErrorAction Stop).Free
        if ($tmpFree -lt 1GB) { Finish 'ERR' ("мало места на системном диске (TEMP): " + [Math]::Round($tmpFree / 1MB) + " МБ свободно, нужно ~1000 МБ") 1 }
        $insDrive = [System.IO.Path]::GetPathRoot((Resolve-Path $BladeRoot).Path).TrimEnd('\')[0]
        if ($insDrive -ne $tmpDrive) {
            $insFree = (Get-PSDrive -Name $insDrive -ErrorAction Stop).Free
            if ($insFree -lt 700MB) { Finish 'ERR' ("мало места на диске установки: " + [Math]::Round($insFree / 1MB) + " МБ свободно, нужно ~700 МБ") 1 }
        }
    } catch {}
}

# --- Распаковка в staging ---
try {
    New-Item -ItemType Directory -Path $staging -Force | Out-Null
    Expand-Archive -LiteralPath $ZipPath -DestinationPath $staging -Force
} catch {
    Finish 'ERR' ("архив повреждён или не распаковывается: " + $_.Exception.Message) 1
}

# Compress-Archive кладёт всё в папку-обёртку (Blade-Patch-vX\...); data.zip — без неё
$pkgRoot = $staging
$top = @(Get-ChildItem -LiteralPath $staging)
if ($top.Count -eq 1 -and $top[0].PSIsContainer) { $pkgRoot = $top[0].FullName }

# --- Определение режима пакета ---
$isFull = Test-Path (Join-Path $pkgRoot 'App')
$chromeSrc = Join-Path $pkgRoot 'files\chrome'
$userSrc   = Join-Path $pkgRoot 'files\user.js'
if ($isFull) {
    $chromeSrc = Join-Path $pkgRoot 'profile\chrome'
    $userSrc   = Join-Path $pkgRoot 'profile\user.js'
}
if (-not (Test-Path $chromeSrc)) { Finish 'ERR' 'в пакете нет files\chrome или profile\chrome — неизвестный формат' 1 }

$engineSrc = $null
if ($isFull) {
    $engineSrc = Join-Path $pkgRoot 'App\Firefox64'
    if (-not (Test-Path (Join-Path $engineSrc 'firefox.exe'))) {
        $engineSrc = Join-Path $pkgRoot 'App\Blade'
    }
    if (-not (Test-Path (Join-Path $engineSrc 'firefox.exe'))) { Finish 'ERR' 'в полном пакете нет движка (App\Firefox64)' 1 }
    if (-not $engineDir) { Finish 'ERR' "в установке не найден движок ($BladeRoot\App\Blade)" 1 }
}

# --- Версии ---
$newVersion = 'неизвестно'
$newVerFile = Join-Path $chromeSrc 'VERSION'
if (Test-Path $newVerFile) { $newVersion = (Get-Content $newVerFile -First 1).Trim() }
$oldVersion = 'неизвестно'
$oldVerFile = Join-Path $chromeDir 'VERSION'
if (Test-Path $oldVerFile) { $oldVersion = (Get-Content $oldVerFile -First 1).Trim() }
$modeLabel = if ($isFull) { 'ПОЛНЫЙ (движок + кастомизация)' } else { 'ПАТЧ (кастомизация)' }
Write-Host "Пакет: $modeLabel  v$oldVersion -> v$newVersion"

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
if ($newVersion -ne 'неизвестно' -and $oldVersion -ne 'неизвестно' -and
    ((Compare-VersionString $newVersion $oldVersion) -le 0)) {
    if ($Auto) { Finish 'ERR' "пакет v$newVersion не новее установленной v$oldVersion — пропущено" 1 }
    $c = Read-Host "ВНИМАНИЕ: пакет v$newVersion НЕ новее v$oldVersion. Всё равно ставить? (y/N)"
    if ($c -notmatch '^[yYдД]') { Finish 'ERR' 'отменено пользователем' 0 }
}

# --- Закрываем запущенный Blade (только процессы НАШЕЙ установки) ---
$running = Get-Process firefox -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -and $_.Path.StartsWith($BladeRoot, [System.StringComparison]::OrdinalIgnoreCase) }
if ($running) {
    Write-Host 'Blade запущен — закрываю...' -ForegroundColor Yellow
    $deadline = (Get-Date).AddSeconds(20)
    do {
        $running | ForEach-Object { try { $_.CloseMainWindow() | Out-Null } catch {} }
        Start-Sleep -Milliseconds 500
        $running = Get-Process firefox -ErrorAction SilentlyContinue |
            Where-Object { $_.Path -and $_.Path.StartsWith($BladeRoot, [System.StringComparison]::OrdinalIgnoreCase) }
    } while ($running -and (Get-Date) -lt $deadline)
    if ($running) { $running | Stop-Process -Force; Start-Sleep -Seconds 1 }
}

# --- Бэкап профиля (chrome + user.js) — ничего не теряем ---
$backupDir = Join-Path $BladeRoot ("Backups\profile-chrome-v{0}-{1}" -f $oldVersion, $stamp)
try {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    Copy-Item $chromeDir (Join-Path $backupDir 'chrome') -Recurse -Force
    if (Test-Path (Join-Path $ProfileDir 'user.js')) {
        Copy-Item (Join-Path $ProfileDir 'user.js') (Join-Path $backupDir 'user.js') -Force
    }
    Write-Host "Бэкап профиля: $backupDir" -ForegroundColor DarkGray
} catch {
    Finish 'ERR' ("бэкап профиля не удался: " + $_.Exception.Message + " — установка не тронута") 1
}

# --- Движок (только полный пакет): move-старого + copy-нового, откат при сбое ---
if ($isFull) {
    $engineBackup = Join-Path $BladeRoot ("Backups\engine-v{0}-{1}" -f $oldVersion, $stamp)
    Write-Host 'Замена движка...' -ForegroundColor Cyan
    try {
        Move-Item $engineDir $engineBackup
    } catch {
        Finish 'ERR' ("не удалось убрать старый движок (файл занят?): " + $_.Exception.Message) 1
    }
    try {
        Copy-Item $engineSrc $engineDir -Recurse -Force
        Write-Host "Бэкап движка: $engineBackup" -ForegroundColor DarkGray
    } catch {
        Write-Host 'Сбой копирования движка — откатываю...' -ForegroundColor Yellow
        try {
            if (Test-Path $engineDir) { Remove-Item $engineDir -Recurse -Force }
            Move-Item $engineBackup $engineDir
            Finish 'ERR' ("копирование движка не удалось (откат выполнен): " + $_.Exception.Message) 1
        } catch {
            Finish 'ERR' ("КОПИРОВАНИЕ И ОТКАТ НЕ УДАЛИСЬ: " + $_.Exception.Message + " — восстанови $engineBackup вручную") 1
        }
    }
}

# --- Применение кастомизации: наши файлы заменяем, img не трогаем (свои обои) ---
try {
    Write-Host 'Обновление кастомизации...' -ForegroundColor Cyan
    Get-ChildItem $chromeDir -Exclude 'img' | Remove-Item -Recurse -Force
    Copy-Item (Join-Path $chromeSrc '*') $chromeDir -Recurse -Force
    if (Test-Path $userSrc) { Copy-Item $userSrc $ProfileDir -Force }

    # Мёртвые файлы старых версий (точные имена, свои файлы не задеваем)
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
    Finish 'ERR' ("применение не удалось (старое в бэкапе: $backupDir): " + $_.Exception.Message) 1
}

# --- Чистка старых бэкапов: движковые тяжёлые — держим 1, профильные — 3 ---
try {
    $bkRoot = Join-Path $BladeRoot 'Backups'
    if (Test-Path $bkRoot) {
        $engines = Get-ChildItem $bkRoot -Directory -Filter 'engine-v*' -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending
        if ($engines.Count -gt 1) { $engines | Select-Object -Skip 1 | Remove-Item -Recurse -Force }
        $chromes = Get-ChildItem $bkRoot -Directory -Filter 'profile-chrome-v*' -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending
        if ($chromes.Count -gt 3) { $chromes | Select-Object -Skip 3 | Remove-Item -Recurse -Force }
    }
} catch {}

Finish 'OK' ("v$oldVersion -> v$newVersion" + $(if ($isFull) { ' (движок + кастомизация)' } else { ' (кастомизация)' })) 0
