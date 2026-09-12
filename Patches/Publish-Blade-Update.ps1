# ============================================================================
# Publish-Blade-Update.ps1 — сборка и публикация обновления Blade в GitHub
# (приватный репозиторий, через gh CLI) одной командой.
#
# Использование:
#   Patch (только кастомизация, ~6 МБ):
#     powershell -ExecutionPolicy Bypass -File Publish-Blade-Update.ps1 -Version 1.5.1 -Notes "..."
#     (-Codename "Имя Релиза" — кодовое имя; пусто = из живого chrome\CODENAME)
#   Full (движок + кастомизация, ~200 МБ):
#     powershell -ExecutionPolicy Bypass -File Publish-Blade-Update.ps1 -Version 1.6.0 -Mode Full -Notes "..."
#   Первый запуск (создать репо + README):
#     ... -InitRepo
#
# Что делает:
#   1. Build-Blade-Patch.ps1 — патч + прошивка chrome\VERSION (живая папка тоже)
#   2. Full: дополнительно собирает Blade-Full-vX.zip (движок + chrome + user.js
#      в формате data.zip) — chrome берёт из свежесобранного патча, чтобы
#      патч и полный пакет были побайтово одинаковы
#   3. gh release create vX <zip> — заливка релиза
#
# Друзья получают обновление автоматически: BladeUpdater.uc.js проверяет
# releases/latest раз в сутки (см. chrome\JS\BladeUpdater.uc.js).
# ============================================================================
param(
    [Parameter(Mandatory = $true)][string]$Version,
    [string]$Notes = '',
    [string]$Codename = '',        # кодовое имя релиза; пусто = из живого chrome\CODENAME
    [ValidateSet('Patch', 'Full')][string]$Mode = 'Patch',
    [string]$Repo = '',            # owner/name; пусто = <твой логин>/blade-browser
    [string]$ProfileDir = '',      # пусто = папка профиля рядом со скриптом
    [string]$PatchesDir = '',      # пусто = папка самого скрипта
    # Источник движка для Full: установленная копия (всегда актуальная и почищенная)
    [string]$EngineDir = "$env:LOCALAPPDATA\Blade\App\Blade",
    [switch]$InitRepo,             # первый запуск: создать приватный репо + README
    [switch]$Draft,                # залить как draft (друзьям не видно до публикации)
    [switch]$SkipPublish           # собрать архивы БЕЗ заливки в GitHub (тесты/офлайн)
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# $PSScriptRoot пуст при биндинге параметров — вычисляем дефолты в теле
if (-not $PatchesDir) { $PatchesDir = $PSScriptRoot }
if (-not $ProfileDir) { $ProfileDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'FirefoxPortable\Data\profile' }

if ($Version -notmatch '^\d+(\.\d+){0,3}$') {
    throw "Версия должна быть вида 1.5.0 (числа через точку), получено: '$Version'"
}

# Кодовое имя релиза: не задано — берём из живого chrome\CODENAME
# (его мог написать прошлый запуск Build-Blade-Patch.ps1)
if (-not $Codename) {
    $liveCodenameFile = Join-Path $ProfileDir 'chrome\CODENAME'
    if (Test-Path $liveCodenameFile) {
        $Codename = [System.IO.File]::ReadAllText($liveCodenameFile).Trim()
    }
}

# --- gh: нужен только для публикации (сборка работает и без него) ---
if (-not $SkipPublish) {
    try { $null = Get-Command gh -ErrorAction Stop } catch {
        throw 'gh CLI не найден. Установи: winget install GitHub.cli и залогинься: gh auth login'
    }
    & gh auth status 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw 'gh не залогинен. Запусти: gh auth login'
    }
    if (-not $Repo) {
        $owner = (& gh api user --jq .login).Trim()
        $Repo = "$owner/blade-browser"
    }
    Write-Host "Репозиторий: $Repo" -ForegroundColor Cyan
} elseif (-not $Repo) {
    $Repo = 'owner/blade-browser (не определён — публикация пропущена)'
}

# --- 0. Первый запуск: приватный репо + README ---
if ($InitRepo -and -not $SkipPublish) {
    & gh repo create $Repo --private --description 'Blade browser (private distribution)' 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Host 'Репозиторий создан (приватный).' -ForegroundColor Green }
    else { Write-Host 'Репозиторий уже существует или не создан — проверю...' -ForegroundColor Yellow }
    $readme = Join-Path $PatchesDir 'template\repo-README.md'
    if (Test-Path $readme) {
        $b64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($readme))
        & gh api "repos/$Repo/contents/README.md" -X PUT -f message='Blade browser' -f "content=$b64" | Out-Null
        Write-Host 'README.md загружен.' -ForegroundColor Green
    }
}

# --- 1. Патч (заодно прошивает VERSION в живой chrome) ---
$buildScript = Join-Path $PatchesDir 'Build-Blade-Patch.ps1'
# PS 5.1 выкидывает пустые строки из аргументов powershell -File: -Notes ''
# съедал следующий параметр и валил сборку. Передаём -Notes только непустым.
$buildArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $buildScript,
               '-Version', $Version, '-ProfileDir', $ProfileDir, '-PatchesDir', $PatchesDir)
if ($Notes) { $buildArgs += @('-Notes', $Notes) }
if ($Codename) { $buildArgs += @('-Codename', $Codename) }
& powershell @buildArgs
if ($LASTEXITCODE -ne 0) { throw 'Build-Blade-Patch.ps1 упал' }
$patchZip = Join-Path $PatchesDir "Blade-Patch-v$Version.zip"
if (-not (Test-Path $patchZip)) { throw "патч не собран: $patchZip" }

$assetPath = $patchZip

# --- 2. Full: движок + chrome из патча (формат data.zip) ---
if ($Mode -eq 'Full') {
    if (-not (Test-Path (Join-Path $EngineDir 'firefox.exe'))) {
        throw "Движок не найден: $EngineDir (параметр -EngineDir)"
    }
    Write-Host 'Сборка полного пакета (движок + кастомизация)...' -ForegroundColor Cyan
    $fullStaging = Join-Path $PatchesDir "build\full-v$Version"
    if (Test-Path $fullStaging) { Remove-Item $fullStaging -Recurse -Force }
    New-Item -ItemType Directory -Path (Join-Path $fullStaging 'App\Firefox64') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $fullStaging 'profile') -Force | Out-Null

    # Движок: всё, кроме апдейтера Mozilla и телеметрии (на случай жирного источника)
    Copy-Item (Join-Path $EngineDir '*') (Join-Path $fullStaging 'App\Firefox64') -Recurse -Force
    $engineJunk = 'updater.exe', 'updater.ini', 'update-settings.ini', 'update.locale',
                  'crashreporter.exe', 'crashreporter.ini', 'maintenance_service.exe',
                  'default-agent.exe', 'firefox.exe.manifest', 'pingsender.exe'
    foreach ($j in $engineJunk) {
        $p = Join-Path $fullStaging "App\Firefox64\$j"
        if (Test-Path $p) { Remove-Item $p -Force }
    }

    # Кастомизация: из свежесобранного патча (побайтово та же, что у друзей в патче)
    $patchExtract = Join-Path $PatchesDir 'build\patch-extract'
    if (Test-Path $patchExtract) { Remove-Item $patchExtract -Recurse -Force }
    Expand-Archive -LiteralPath $patchZip -DestinationPath $patchExtract -Force
    $patchRoot = $patchExtract
    $top = @(Get-ChildItem -LiteralPath $patchExtract)
    if ($top.Count -eq 1 -and $top[0].PSIsContainer) { $patchRoot = $top[0].FullName }
    Copy-Item (Join-Path $patchRoot 'files\chrome') (Join-Path $fullStaging 'profile\chrome') -Recurse -Force
    Copy-Item (Join-Path $patchRoot 'files\user.js') (Join-Path $fullStaging 'profile\user.js') -Force

    # data.zip-формат: сжатие Fastest — 300 МБ бинарников Optimal-ом сжимается минутами
    $fullZip = Join-Path $PatchesDir "Blade-Full-v$Version.zip"
    if (Test-Path $fullZip) { Remove-Item $fullZip -Force }
    Compress-Archive -Path (Join-Path $fullStaging '*') -DestinationPath $fullZip -CompressionLevel Fastest
    Remove-Item (Join-Path $PatchesDir 'build') -Recurse -Force

    $sizeMB = [Math]::Round((Get-Item $fullZip).Length / 1MB, 1)
    Write-Host "Полный пакет собран: $fullZip ($sizeMB МБ)" -ForegroundColor Green
    $assetPath = $fullZip
}

# --- 2b. Хеш-файл для проверки целостности у друзей (формат sha256sum: "<hash>  <имя>") ---
$hashFile = "$assetPath.sha256"
$assetHash = (Get-FileHash -LiteralPath $assetPath -Algorithm SHA256).Hash
$assetName = Split-Path -Leaf $assetPath
# ASCII без BOM: в именах ассетов только латиница; LF — совместимость с GNU sha256sum
[System.IO.File]::WriteAllText($hashFile, "$assetHash  $assetName`n", [System.Text.Encoding]::ASCII)
Write-Host "Хеш-файл: $hashFile" -ForegroundColor DarkGray

# --- 2c. СТРАХОВКА: в архиве не должно быть НИЧЕГО личного ---
# Патч и Full собираются только из chrome/user.js/движка, но если туда
# когда-нибудь попадёт файл профиля (logins/cookies/places/...) —
# отказ публикации ДО заливки в GitHub. Бэкслеши Compress-Archive
# нормализуем: regex ждёт прямые слеши.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$sensRe = '(?i)(^|/)(logins\.(db|json|sqlite)[^/]*|key(3|4)?\.db|cookies\.sqlite[^/]*|places\.sqlite[^/]*|formhistory\.sqlite[^/]*|favicons\.sqlite[^/]*|permissions\.sqlite[^/]*|content-prefs\.sqlite[^/]*|storage\.sqlite|prefs\.js|sessionstore[^/]*|search\.json\.mozlz4)($|/)|(^|/)(storage|datareporting|bookmarkbackups|minidumps|crashes|saved-telemetry-pings)($|/)'
$zipCheck = [System.IO.Compression.ZipFile]::OpenRead($assetPath)
try {
    $sensitive = @($zipCheck.Entries | Where-Object { ($_.FullName -replace '\\', '/') -match $sensRe })
} finally { $zipCheck.Dispose() }
if ($sensitive.Count -gt 0) {
    throw ('ОТКАЗ ПУБЛИКАЦИИ: в архиве личные файлы профиля: ' + (($sensitive | ForEach-Object { $_.FullName }) -join ', '))
}
Write-Host 'Страховка: личных файлов в архиве нет' -ForegroundColor Green

# --- 3. Релиз в GitHub ---
if ($SkipPublish) {
    Write-Host ''
    Write-Host "ГОТОВО (без публикации): v$Version ($Mode), архив: $assetPath" -ForegroundColor Green
    Write-Host 'Публикация пропущена (-SkipPublish).'
    exit 0
}

$releaseNotes = "Blade v$Version`n$(Get-Date -Format 'yyyy-MM-dd')`n"
if ($Notes) { $releaseNotes += "`n$Notes" }
$releaseTitle = "Blade v$Version"
if ($Codename) { $releaseTitle = "Blade v$Version — $Codename" }
$releaseArgs = @('release', 'create', "v$Version", $assetPath, $hashFile,
    '--repo', $Repo, '--title', $releaseTitle, '--notes', $releaseNotes)
if ($Draft) { $releaseArgs += '--draft' }
Write-Host "Публикую релиз v$Version..." -ForegroundColor Cyan
& gh @releaseArgs
if ($LASTEXITCODE -ne 0) { throw 'gh release create упал (см. вывод выше)' }

Write-Host ''
Write-Host "ГОТОВО: релиз v$Version ($Mode) опубликован в $Repo" -ForegroundColor Green
Write-Host 'Друзья: браузер сам увидит обновление в течение суток (или сразу через меню B -> Проверить сейчас).'
