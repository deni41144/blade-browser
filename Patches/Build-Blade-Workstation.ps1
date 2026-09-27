# ============================================================================
# Build-Blade-Workstation.ps1 — сборка пакета поставки для разработчика.
#
# Пакет = движок + свежий chrome из ACTUAL main + инструкции онбординга.
# Контракт анти-рассинхрона (см. PROJECT_MAP «Кооперация с разработчиком»):
#   1. git pull (правки сотрудника приезжают в локальный main)
#   2. guard: дерево чистое — незакоммиченные правки в пакет НЕ уходят
#   3. сборка Full из того же main (движок %LOCALAPPDATA%\Blade\App\Blade)
#   4. инструкции берутся из Onboarding/ репозитория (не из пакета прошлого
#      релиза — именно там был рассинхрон)
#   5. аудит: нет личных фото/скринов/кэша/thumbnails
#
# Использование:
#   powershell -ExecutionPolicy Bypass -File Build-Blade-Workstation.ps1
#   (версия и кодовое имя читаются из chrome\VERSION / chrome\CODENAME)
# ============================================================================
param(
    [string]$PatchesDir = '',      # пусто = папка рядом со скриптом
    [string]$ProfileDir = '',      # пусто = dev-профиль
    [string]$EngineDir = "$env:LOCALAPPDATA\Blade\App\Blade",
    [switch]$SkipPull              # пропуск git pull (офлайн / своя ветка)
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

if (-not $PatchesDir) { $PatchesDir = $PSScriptRoot }
$repoRoot = Split-Path -Parent $PatchesDir
if (-not $ProfileDir) { $ProfileDir = Join-Path $repoRoot 'FirefoxPortable\Data\profile' }

# --- 1. git pull: чужие правки приезжают до сборки ---
if (-not $SkipPull) {
    Write-Host '[1/6] git pull (правки разработчика)...' -ForegroundColor Cyan
    # git пишет прогресс в stderr — это не ошибка; временно ослабляем Stop
    $ErrorActionPreference = 'Continue'
    & git -C $repoRoot pull --ff-only origin main 2>&1 | Out-Host
    $code = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($code -ne 0) { throw 'git pull упал — разбирайся вручную (возможен конфликт слияния)' }
}

# --- 2. guard: дерево должно быть чистым ---
Write-Host '[2/6] guard: проверка чистоты дерева...' -ForegroundColor Cyan
$ErrorActionPreference = 'Continue'
$allStatus = @(& git -C $repoRoot status --porcelain)
$ErrorActionPreference = 'Stop'
$uncommittedChrome = @($allStatus | Where-Object {
    $_ -match '(?i)(chrome/|user\.js|PROJECT_MAP|START-HERE)' })
if ($uncommittedChrome.Count -gt 0) {
    throw ('ОТКАЗ: в пакете будут незакоммиченные правки кода: ' +
           (($uncommittedChrome | ForEach-Object { $_.Trim() }) -join ', ') +
           '. Сначала закоммить и запушь — пакет должен = main.')
}
Write-Host '  дерево кода чистое (незакоммиченных правок chrome/user.js нет)' -ForegroundColor Green

# --- 3. версия из main (UTF-8 без BOM читаем через .NET: PS 5.1
#     Get-Content читает как ANSI и ломает кириллицу кодового имени) ---
$utf8 = New-Object System.Text.UTF8Encoding($false)
$version = [System.IO.File]::ReadAllText((Join-Path $ProfileDir 'chrome\VERSION'), $utf8).Trim()
$codename = ''
$cnFile = Join-Path $ProfileDir 'chrome\CODENAME'
if (Test-Path $cnFile) { $codename = [System.IO.File]::ReadAllText($cnFile, $utf8).Trim() }
Write-Host "[3/6] версия: $version $(if ($codename) { $codename })" -ForegroundColor Cyan

# --- 4. сборка Full (патч в комплекте — chrome из того же main) ---
# ВАЖНО: -Codename НЕ передаём. Кириллица в аргументах дочернего
# powershell.exe из PS 5.1 приходит как mojibake (двойное кодирование) и
# CODENAME/хроника прошиваются кривыми байтами. Publish-Blade-Update сам
# читает кодовое имя из chrome\CODENAME — тот же источник, без шанса
# рассинхрона через командную строку.
Write-Host '[4/6] сборка Full-пакета...' -ForegroundColor Cyan
$pub = Join-Path $PatchesDir 'Publish-Blade-Update.ps1'
& powershell -NoProfile -ExecutionPolicy Bypass -File $pub `
    -Version $version -Mode Full -SkipPublish
if ($LASTEXITCODE -ne 0) { throw 'Publish-Blade-Update.ps1 (Full, SkipPublish) упал' }
$fullZip = Join-Path $PatchesDir "Blade-Full-v$version.zip"
if (-not (Test-Path $fullZip)) { throw "Full-пакет не собран: $fullZip" }

# --- 5. пакет поставки ---
Write-Host '[5/6] сборка пакета поставки...' -ForegroundColor Cyan
$wsDir = Join-Path $repoRoot "Blade-Workstation-$version"
if (Test-Path $wsDir) { Remove-Item $wsDir -Recurse -Force }
New-Item -ItemType Directory -Path $wsDir -Force | Out-Null
Copy-Item $fullZip (Join-Path $wsDir "Blade-Full-v$version.zip") -Force
$sha = Join-Path $PatchesDir "Blade-Full-v$version.zip.sha256"
if (Test-Path $sha) { Copy-Item $sha (Join-Path $wsDir "Blade-Full-v$version.zip.sha256") -Force }

# инструкции — только из репозитория (единый источник, версия в тексте
# обновляется тем же коммитом, что и код — рассинхрон невозможен)
$onb = Join-Path $repoRoot 'Onboarding'
foreach ($f in @('КАК-НАЧАТЬ.md', 'НЕЙРОНКЕ.md')) {
    $src = Join-Path $onb $f
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $wsDir $f) -Force
    } else {
        Write-Host "  ВНИМАНИЕ: $f нет в Onboarding/ — пакуется без него" -ForegroundColor Yellow
    }
}

# --- 6. аудит на личные файлы ---
Write-Host '[6/6] аудит пакета на личные файлы...' -ForegroundColor Cyan
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead($fullZip)
try { $entries = @($z.Entries | ForEach-Object { $_.FullName }) }
finally { $z.Dispose() }
# патру名单: prefs.js движка (channel-prefs/config-prefs) — не личное,
# живут в App\Firefox64\defaults\pref\. Личный prefs.js — корень профиля.
# Пути в архиве нормализуем к '/' (regex-класс с бэкслешем в PS ломается).
$persRe = '(?i)(thumbnails|places\.sqlite|logins|key[34]?\.db|cookies\.sqlite|sessionstore|storage\.sqlite|bookmarkbackups|minidumps|crashes|datareporting|(^|/)prefs\.js($|/))'
$personal = @($entries | ForEach-Object { ($_.Replace('\', '/')) } | Where-Object { $_ -match $persRe })
if ($personal.Count -gt 0) {
    Remove-Item $wsDir -Recurse -Force
    throw ('ОТКАЗ: в пакете личные файлы: ' + ($personal -join ', '))
}
Write-Host '  личных файлов нет' -ForegroundColor Green

$sizeMB = [Math]::Round((Get-Item $fullZip).Length / 1MB, 1)
Write-Host ''
Write-Host "ПАКЕТ ГОТОВ: $wsDir" -ForegroundColor Green
Write-Host "  Blade-Full-v$version.zip ($sizeMB МБ) + sha256 + инструкции из Onboarding/"
Write-Host ''
Write-Host "Передай сотруднику ZIP папки (Blade-Workstation-$version). Инструкции"
Write-Host 'тоже лежат в репо (Onboarding/) — он получит их же через git clone.'
