# ============================================================================
# Build-Blade-Patch.ps1 — сборка патча обновления Blade для рассылки.
# Упаковывает чистую копию chrome + user.js + автоустановщик.
#
# Использование:
#   powershell -ExecutionPolicy Bypass -File Build-Blade-Patch.ps1 -Version 1.0.1 -Codename "Имя Релиза" -Notes "что нового"
#
# Результат: Patches\Blade-Patch-v<версия>.zip
# Друг: распаковал ZIP -> двойной клик UPDATE.bat -> перезапустил Blade.
# ============================================================================
param(
    [Parameter(Mandatory = $true)][string]$Version,   # например 1.0.1
    [string]$Notes = '',                              # текст "что нового" в CHANGES.txt
    [string]$Codename = '',                           # кодовое имя релиза (chrome\CODENAME, CHANGES, хроника)
    [string]$ProfileDir = '',                         # пусто = папка профиля рядом со скриптом
    [string]$PatchesDir = ''                          # пусто = папка самого скрипта
)
$ErrorActionPreference = 'Stop'

# $PSScriptRoot пуст при биндинге параметров — вычисляем дефолты в теле
if (-not $PatchesDir) { $PatchesDir = $PSScriptRoot }
if (-not $ProfileDir) { $ProfileDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'FirefoxPortable\Data\profile' }

if ($Version -notmatch '^\d+(\.\d+){0,3}$') {
    throw "Версия должна быть вида 1.0.1 (числа через точку), получено: '$Version'"
}
$srcChrome = Join-Path $ProfileDir 'chrome'
if (-not (Test-Path $srcChrome)) { throw "Нет папки chrome: $srcChrome" }
$userJs = Join-Path $ProfileDir 'user.js'
if (-not (Test-Path $userJs)) { throw "Нет user.js: $userJs" }

$staging = Join-Path $PatchesDir "build\Blade-Patch-v$Version"
$zipPath = Join-Path $PatchesDir "Blade-Patch-v$Version.zip"
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
New-Item -ItemType Directory -Path (Join-Path $staging 'files') -Force | Out-Null

# --- 1. Копируем chrome целиком, потом вычищаем мусор из КОПИИ ---
$dstChrome = Join-Path $staging 'files\chrome'
New-Item -ItemType Directory -Path $dstChrome -Force | Out-Null
Copy-Item (Join-Path $srcChrome '*') $dstChrome -Recurse -Force
$junk = @(
    # рантайм-состояние и мёртвые артефакты разработки
    'img\current_bg.jpg',
    'img\acheron_bg.jpg', 'img\acheron_bg_before_shift.jpg', 'img\acheron_bg_fixed.jpg',
    'img\acheron_bg_old.jpg', 'img\acheron_bg_shift_v1.jpg', 'img\acheron_bg_v3.jpg',
    'img\acheron_bg_v4.jpg',
    # личное и доки разработки — друзьям не рассылаем (без названия.jpg =
    # обои, добавленные через настройки; если хочешь шарить свои обои —
    # переименуй осмысленно и убери отсюда)
    'img\Без названия.jpg',
    'img\themes\gx-red_acheron.jpg', 'img\themes\README.txt', 'img\covers\README.txt',
    # диагностические uc.js дела часов (1.9.2) — друзьям не нужны
    'JS\BladeDiag.uc.js', 'JS\BladeDiag2.uc.js',
    'JS\tiles_log.txt'
)
foreach ($j in $junk) {
    $p = Join-Path $dstChrome $j
    if (Test-Path $p) { Remove-Item $p -Force }
}
Get-ChildItem $dstChrome -Recurse -Include 'Thumbs.db', 'desktop.ini', '*_mark.txt' -File |
    Remove-Item -Force -ErrorAction SilentlyContinue

# --- 2. VERSION: в патч и в живую папку (UTF-8 без BOM — иначе BOM уедет в меню) ---
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $dstChrome 'VERSION'), $Version, $utf8NoBom)
[System.IO.File]::WriteAllText((Join-Path $srcChrome 'VERSION'), $Version, $utf8NoBom)

# --- 2b. CODENAME: кодовое имя релиза — в патч и в живую папку (как VERSION) ---
if ($Codename) {
    [System.IO.File]::WriteAllText((Join-Path $dstChrome 'CODENAME'), $Codename, $utf8NoBom)
    [System.IO.File]::WriteAllText((Join-Path $srcChrome 'CODENAME'), $Codename, $utf8NoBom)
}

# --- 3. user.js ---
Copy-Item $userJs (Join-Path $staging 'files\user.js') -Force

# --- 4. Автоустановщик: bat как есть, ps1 пересохраняем с BOM (иначе PS 5.1 друга прочтёт кириллицу как ANSI) ---
Copy-Item (Join-Path $PatchesDir 'template\UPDATE.bat') $staging -Force
$ps1 = Get-Content (Join-Path $PatchesDir 'template\blade-update.ps1') -Raw -Encoding UTF8
$utf8Bom = New-Object System.Text.UTF8Encoding($true)
[System.IO.File]::WriteAllText((Join-Path $staging 'blade-update.ps1'), $ps1, $utf8Bom)

# --- 4b. Аплайер автообновления: едет в chrome\resources — его запускает
# BladeUpdater.uc.js при обновлении в один клик; патчами он обновляется сам ---
$resDir = Join-Path $dstChrome 'resources'
New-Item -ItemType Directory -Path $resDir -Force | Out-Null
$applierSrc = Get-Content (Join-Path $PatchesDir 'template\blade-apply-update.ps1') -Raw -Encoding UTF8
[System.IO.File]::WriteAllText((Join-Path $resDir 'blade-apply-update.ps1'), $applierSrc, $utf8Bom)

# --- 4c. Регистрация браузера по умолчанию: set-blade-default.ps1 едет тем же
# маршрутом (chrome\resources) — его запускает BladeUpdater.uc.js однократно
# после установки/обновления и по кнопке в меню B (СИСТЕМА) ---
$defaultSrc = Get-Content (Join-Path $PatchesDir 'template\set-blade-default.ps1') -Raw -Encoding UTF8
[System.IO.File]::WriteAllText((Join-Path $resDir 'set-blade-default.ps1'), $defaultSrc, $utf8Bom)

# --- 5. CHANGES.txt ---
$changesTitle = "Blade Patch v$Version"
if ($Codename) { $changesTitle = "Blade v$Version — $Codename" }
$changesText = "$changesTitle`r`nДата: $(Get-Date -Format 'yyyy-MM-dd')`r`n"
if ($Notes) { $changesText += "`r`n$Notes`r`n" }
[System.IO.File]::WriteAllText((Join-Path $staging 'CHANGES.txt'), $changesText, $utf8Bom)

# --- 5b. Хроника для панели «Клинок обновлён»: BladeUpdater.uc.js читает её
# в chrome\JS\update_chronicle.txt после применения патча. C BOM: JS readUTF8
# BOM не срезает — апдейтер срезает сам (как у update_result.txt). Не лог:
# в джанк-лист не входит. Хронику прошлого релиза, приехавшую из живой
# chrome, не тащим — новую пишет только непустой -Notes. ---
$chronicleDir = Join-Path $dstChrome 'JS'
if (-not (Test-Path $chronicleDir)) { New-Item -ItemType Directory -Path $chronicleDir -Force | Out-Null }
$chronicleFile = Join-Path $chronicleDir 'update_chronicle.txt'
if ($Notes) {
    $chronicleHeader = "Blade v$Version"
    if ($Codename) { $chronicleHeader = "Blade v$Version — $Codename" }
    [System.IO.File]::WriteAllText($chronicleFile, "$chronicleHeader`r`n`r`n$Notes", $utf8Bom)
} elseif (Test-Path $chronicleFile) {
    Remove-Item $chronicleFile -Force
}

# --- 6. ZIP ---
Compress-Archive -Path $staging -DestinationPath $zipPath -CompressionLevel Optimal

# --- 7. Отчёт ---
$fileCount = (Get-ChildItem (Join-Path $staging 'files') -Recurse -File).Count
$sizeMB = [Math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Remove-Item (Join-Path $PatchesDir 'build') -Recurse -Force
Write-Host ''
Write-Host "Патч собран: $zipPath" -ForegroundColor Green
Write-Host "Файлов в патче: $fileCount, размер: $sizeMB MB"
Write-Host "Живая папка chrome помечена версией: $Version"
if ($Codename) { Write-Host "Кодовое имя релиза: $Codename" }
Write-Host ''
Write-Host 'Отправка другу: ZIP -> распаковать -> UPDATE.bat -> перезапустить Blade.'
