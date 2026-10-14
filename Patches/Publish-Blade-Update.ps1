# ============================================================================
# Publish-Blade-Update.ps1 — сборка и публикация обновления Blade в GitHub
# (приватный репозиторий, через gh CLI) одной командой.
#
# Использование:
#   Patch (только кастомизация, ~6 МБ):
#     powershell -ExecutionPolicy Bypass -File Publish-Blade-Update.ps1 -Version 1.5.1 -Notes "..."
#     (-Codename "Имя Релиза" — кодовое имя; пусто = из живого chrome\CODENAME)
#   Full (движок + кастомизация):
#     powershell -ExecutionPolicy Bypass -File Publish-Blade-Update.ps1 -Version 2.3.6 -Mode Full -EngineDir "..\Skeleton-Stage\Firefox-158.0\unpacked\core" -BootstrapDir "..\FirefoxPortable\App\Firefox64"
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
    # Для Full передаётся отдельная проверенная папка официального движка Firefox.
    [string]$EngineDir = '',
    # Файлы Blade autoconfig и политики, отдельно от движка Firefox.
    [string]$BootstrapDir = '',
    [switch]$InitRepo,             # первый запуск: создать приватный репо + README
    [switch]$Draft,                # залить как draft (друзьям не видно до публикации)
    [switch]$SkipPublish           # собрать архивы БЕЗ заливки в GitHub (тесты/офлайн)
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# $PSScriptRoot пуст при биндинге параметров — вычисляем дефолты в теле
if (-not $PatchesDir) { $PatchesDir = $PSScriptRoot }
if (-not $ProfileDir) { $ProfileDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'FirefoxPortable\Data\profile' }

if ($Mode -eq 'Full') {
    if (-not $EngineDir) {
        throw 'Для Full укажи отдельную папку движка через -EngineDir; установленная копия больше не берётся неявно.'
    }
    $enginePath = (Resolve-Path -LiteralPath $EngineDir -ErrorAction Stop).Path
    $engineExe = Join-Path $enginePath 'firefox.exe'
    $engineIni = Join-Path $enginePath 'application.ini'
    $expectedVersionFile = Join-Path $PatchesDir 'firefox-engine-version.txt'
    if (-not (Test-Path -LiteralPath $engineExe -PathType Leaf) -or -not (Test-Path -LiteralPath $engineIni -PathType Leaf)) {
        throw "В EngineDir нет firefox.exe или application.ini: $enginePath"
    }
    if (-not (Test-Path -LiteralPath $expectedVersionFile -PathType Leaf)) {
        throw "Нет фиксатора версии движка: $expectedVersionFile"
    }
    $expectedEngineVersion = [System.IO.File]::ReadAllText($expectedVersionFile).Trim()
    $engineVersionMatch = Select-String -LiteralPath $engineIni -Pattern '^Version=(\d+(?:\.\d+){1,3})$' | Select-Object -First 1
    if (-not $engineVersionMatch) { throw "Не удалось прочитать версию Firefox из $engineIni" }
    $engineVersion = $engineVersionMatch.Matches[0].Groups[1].Value
    if ($engineVersion -ne $expectedEngineVersion) {
        throw "В Full попадёт Firefox $engineVersion, а для этого выпуска зафиксирован Firefox $expectedEngineVersion."
    }
    $engineSignature = Get-AuthenticodeSignature -LiteralPath $engineExe
    if ($engineSignature.Status -ne 'Valid' -or $engineSignature.SignerCertificate.Subject -notmatch 'O=Mozilla Corporation') {
        throw "firefox.exe не прошёл проверку Authenticode как подписанный Mozilla Corporation: $($engineSignature.Status) / $($engineSignature.SignerCertificate.Subject)"
    }
    $EngineDir = $enginePath

    if (-not $BootstrapDir) {
        $repoBootstrap = Join-Path (Split-Path -Parent $PatchesDir) 'FirefoxPortable\App\Firefox64'
        if (Test-Path -LiteralPath (Join-Path $repoBootstrap 'config.js')) { $BootstrapDir = $repoBootstrap }
    }
    if (-not $BootstrapDir) {
        throw 'Для Full не найдены файлы Blade autoconfig; передай каталог через -BootstrapDir.'
    }
    $bootstrapPath = (Resolve-Path -LiteralPath $BootstrapDir -ErrorAction Stop).Path
    foreach ($required in @('config.js', 'defaults\pref\blade-defaults.js', 'distribution\policies.json')) {
        if (-not (Test-Path -LiteralPath (Join-Path $bootstrapPath $required) -PathType Leaf)) {
            throw "В BootstrapDir отсутствует обязательный файл: $required"
        }
    }
    $BootstrapDir = $bootstrapPath

    $projectRoot = Split-Path -Parent (Resolve-Path -LiteralPath $PatchesDir -ErrorAction Stop).Path
    $brandOmniScript = Join-Path $projectRoot 'Apply-Blade-Omni.ps1'
    $brandVisualScript = Join-Path $projectRoot 'Apply-Blade-Rebrand.ps1'
    $brandAssetsDir = Join-Path $projectRoot 'Branding'
    foreach ($requiredBrandFile in @(
        $brandOmniScript,
        $brandVisualScript,
        (Join-Path $brandAssetsDir 'master_icon.png'),
        (Join-Path $brandAssetsDir 'brand.ftl'),
        (Join-Path $brandAssetsDir 'brand-ru.ftl'),
        (Join-Path $brandAssetsDir 'brand.properties')
    )) {
        if (-not (Test-Path -LiteralPath $requiredBrandFile -PathType Leaf)) {
            throw "Для Full-сборки отсутствует Blade-брендинг: $requiredBrandFile"
        }
    }
}

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
$patchZip = Join-Path $PatchesDir "Blade-Patch-v$Version.zip"
$buildStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
# Build-Blade-Patch itself stages, verifies and atomically replaces the ZIP +
# checksum sidecar, preserving one rollback copy without duplicating the archive.
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
$patchHash = (Get-FileHash -LiteralPath $patchZip -Algorithm SHA256).Hash
$patchHashFile = "$patchZip.sha256"
[System.IO.File]::WriteAllText($patchHashFile, "$patchHash  $(Split-Path -Leaf $patchZip)`n", [System.Text.Encoding]::ASCII)
Write-Host "Хеш патча: $patchHashFile" -ForegroundColor DarkGray

$assetPath = $patchZip

# --- 2. Full: движок + chrome из патча (формат data.zip) ---
if ($Mode -eq 'Full') {
    if (-not (Test-Path (Join-Path $EngineDir 'firefox.exe'))) {
        throw "Движок не найден: $EngineDir (параметр -EngineDir)"
    }
    Write-Host 'Сборка полного пакета (движок + кастомизация)...' -ForegroundColor Cyan
    $releaseStage = Join-Path $PatchesDir ("build\release-v{0}-{1}" -f $Version, [guid]::NewGuid().ToString('N'))
    $fullStaging = Join-Path $releaseStage 'full'
    $fullCandidate = ''
    try {
    New-Item -ItemType Directory -Path $releaseStage -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $fullStaging 'App\Firefox64') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $fullStaging 'profile') -Force | Out-Null

    # Движок: всё, кроме апдейтера Mozilla и телеметрии (на случай жирного источника)
    Copy-Item (Join-Path $EngineDir '*') (Join-Path $fullStaging 'App\Firefox64') -Recurse -Force
    $engineJunk = 'updater.exe', 'updater.ini', 'update-settings.ini', 'update.locale',
                  'crashreporter.exe', 'crashreporter.ini', 'maintenanceservice.exe',
                  'maintenanceservice_installer.exe', 'default-browser-agent.exe',
                  'default-agent.exe', 'firefox.exe.manifest', 'pingsender.exe'
    foreach ($j in $engineJunk) {
        $p = Join-Path $fullStaging "App\Firefox64\$j"
        if (Test-Path $p) { Remove-Item $p -Force }
    }

    # В официальном Firefox нет Blade autoconfig. Переносим только наши три
    # файла; штатные channel-prefs.js и остальные prefs Firefox сохраняются.
    $engineOut = Join-Path $fullStaging 'App\Firefox64'
    Copy-Item -LiteralPath (Join-Path $BootstrapDir 'config.js') -Destination $engineOut -Force
    $prefOut = Join-Path $engineOut 'defaults\pref'
    New-Item -ItemType Directory -Path $prefOut -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $BootstrapDir 'defaults\pref\blade-defaults.js') -Destination $prefOut -Force
    $configPrefs = Join-Path $prefOut 'config-prefs.js'
    $preservedPrefs = @()
    if (Test-Path -LiteralPath $configPrefs) {
        $preservedPrefs = @([System.IO.File]::ReadAllLines($configPrefs) | Where-Object {
            $_ -notmatch '^\s*pref\("general\.config\.(obscure_value|filename|sandbox_enabled)"'
        })
    }
    $autoconfigPrefs = @(
        'pref("general.config.obscure_value", 0);',
        'pref("general.config.filename", "config.js");',
        'pref("general.config.sandbox_enabled", false);'
    )
    $configPrefsText = (@($preservedPrefs) + $autoconfigPrefs) -join "`r`n"
    [System.IO.File]::WriteAllText($configPrefs, $configPrefsText + "`r`n", [System.Text.UTF8Encoding]::new($false))
    $policyOut = Join-Path $engineOut 'distribution'
    New-Item -ItemType Directory -Path $policyOut -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $BootstrapDir 'distribution\policies.json') -Destination $policyOut -Force

    # Полный пакет должен собираться из движка с тем же Blade-брендингом,
    # что и существующая установка. Автообновления Mozilla отключены, поэтому
    # источник отката — именно чистый omni.ja из официального архива.
    $distributionText = @(
        '[Global]',
        'id=blade-browser',
        'version=1.0',
        'about=Blade',
        '',
        '[BookmarksToolbar]',
        'item.1.title=Blade Browser',
        'item.1.link=https://github.com/deni41144/blade-browser'
    ) -join "`r`n"
    [System.IO.File]::WriteAllText(
        (Join-Path $policyOut 'distribution.ini'),
        $distributionText + "`r`n",
        [System.Text.Encoding]::ASCII
    )

    # Скальпели запускаются только над изолированной staging-копией движка.
    # BrandAssetsOnly меняет about-иконки и wordmark, оставляя встроенные
    # иллюстрации Firefox View/профилей нетронутыми.
    $stagedOmniScript = Join-Path $releaseStage 'Apply-Blade-Omni.ps1'
    $stagedVisualScript = Join-Path $releaseStage 'Apply-Blade-Rebrand.ps1'
    $stagedBrandingDir = Join-Path $releaseStage 'Branding'
    New-Item -ItemType Directory -Path $stagedBrandingDir -Force | Out-Null
    Copy-Item -LiteralPath $brandOmniScript -Destination $stagedOmniScript -Force
    Copy-Item -LiteralPath $brandVisualScript -Destination $stagedVisualScript -Force
    foreach ($brandAsset in @('master_icon.png', 'brand.ftl', 'brand-ru.ftl', 'brand.properties')) {
        Copy-Item -LiteralPath (Join-Path $brandAssetsDir $brandAsset) -Destination $stagedBrandingDir -Force
    }
    $omniArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $stagedOmniScript, '-AppDir', $engineOut)
    & powershell.exe @omniArgs
    if ($LASTEXITCODE -ne 0) { throw "Blade omni-брендинг упал (код $LASTEXITCODE)" }
    $visualArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $stagedVisualScript,
                    '-AppDir', $engineOut, '-BrandAssetsOnly')
    & powershell.exe @visualArgs
    if ($LASTEXITCODE -ne 0) { throw "Blade visual-брендинг упал (код $LASTEXITCODE)" }

    # Проверяем видимые метки в готовом omni и сохраняем подпись официального exe.
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $brandZip = [System.IO.Compression.ZipFile]::OpenRead((Join-Path $engineOut 'browser\omni.ja'))
    try {
        $brandChecks = @(
            @{ Entry = 'localization/en-US/branding/brand.ftl'; Value = 'trademarkInfo = Blade is a custom browser build by Blade-Creations.' },
            @{ Entry = 'localization/ru/branding/brand.ftl'; Value = 'trademarkInfo = браузерная сборка Blade-Creations.' },
            @{ Entry = 'chrome/ru/locale/branding/brand.properties'; Value = 'brandFullName=Blade' },
            @{ Entry = 'chrome/browser/content/branding/firefox-wordmark.svg'; Value = '<title>BLADE</title>' },
            @{ Entry = 'chrome/browser/content/branding/about-wordmark.svg'; Value = '<title>BLADE</title>' },
            @{ Entry = 'chrome/browser/content/branding/about-logo.svg'; Value = 'chrome://browser/content/branding/about-logo.png' }
        )
        foreach ($check in $brandChecks) {
            $entry = $brandZip.GetEntry($check.Entry)
            if (-not $entry) { throw "В браузерном omni.ja нет ожидаемой записи $($check.Entry)" }
            $entryStream = $entry.Open()
            $reader = [System.IO.StreamReader]::new($entryStream, [System.Text.Encoding]::UTF8)
            try { $value = $reader.ReadToEnd() } finally { $reader.Dispose() }
            if (-not $value.Contains($check.Value)) { throw "Брендинг не прошёл проверку: $($check.Entry)" }
        }
        $brandImages = @(
            @{ Entry = 'chrome/browser/content/branding/about-logo.png'; Width = 192; Height = 192 },
            @{ Entry = 'chrome/browser/content/branding/about-logo@2x.png'; Width = 384; Height = 384 },
            @{ Entry = 'chrome/browser/content/branding/about-logo-private.png'; Width = 192; Height = 192 },
            @{ Entry = 'chrome/browser/content/branding/about-logo-private@2x.png'; Width = 384; Height = 384 },
            @{ Entry = 'chrome/browser/content/branding/about.png'; Width = 300; Height = 236 },
            @{ Entry = 'chrome/browser/content/branding/icon16.png'; Width = 16; Height = 16 },
            @{ Entry = 'chrome/browser/content/branding/icon32.png'; Width = 32; Height = 32 },
            @{ Entry = 'chrome/browser/content/branding/icon48.png'; Width = 48; Height = 48 },
            @{ Entry = 'chrome/browser/content/branding/icon64.png'; Width = 64; Height = 64 },
            @{ Entry = 'chrome/browser/content/branding/icon128.png'; Width = 128; Height = 128 }
        )
        foreach ($check in $brandImages) {
            $entry = $brandZip.GetEntry($check.Entry)
            if (-not $entry) { throw "В браузерном omni.ja нет Blade-иконки $($check.Entry)" }
            $entryStream = $entry.Open()
            try {
                $pngHeader = New-Object byte[] 24
                $read = $entryStream.Read($pngHeader, 0, $pngHeader.Length)
            } finally { $entryStream.Dispose() }
            if ($read -ne 24 -or $pngHeader[0] -ne 137 -or $pngHeader[1] -ne 80 -or
                $pngHeader[2] -ne 78 -or $pngHeader[3] -ne 71 -or
                $pngHeader[4] -ne 13 -or $pngHeader[5] -ne 10 -or
                $pngHeader[6] -ne 26 -or $pngHeader[7] -ne 10) {
                throw "Иконка не является корректным PNG: $($check.Entry)"
            }
            $width = ([int]$pngHeader[16] -shl 24) -bor ([int]$pngHeader[17] -shl 16) -bor
                     ([int]$pngHeader[18] -shl 8) -bor [int]$pngHeader[19]
            $height = ([int]$pngHeader[20] -shl 24) -bor ([int]$pngHeader[21] -shl 16) -bor
                      ([int]$pngHeader[22] -shl 8) -bor [int]$pngHeader[23]
            if ($width -ne $check.Width -or $height -ne $check.Height) {
                throw "Неверный размер Blade-иконки $($check.Entry): ${width}x${height}, ожидалось $($check.Width)x$($check.Height)"
            }
        }
    } finally { $brandZip.Dispose() }
    $brandedSignature = Get-AuthenticodeSignature -LiteralPath (Join-Path $engineOut 'firefox.exe')
    if ($brandedSignature.Status -ne 'Valid' -or $brandedSignature.SignerCertificate.Subject -notmatch 'O=Mozilla Corporation') {
        throw "После брендинга подпись firefox.exe не прошла проверку: $($brandedSignature.Status)"
    }
    Write-Host 'Проверка брендинга пройдена; firefox.exe сохранил подпись Mozilla.' -ForegroundColor Green

    # Кастомизация: из свежесобранного патча (побайтово та же, что у друзей в патче)
    $patchExtract = Join-Path $releaseStage 'patch-extract'
    Expand-Archive -LiteralPath $patchZip -DestinationPath $patchExtract -Force
    $patchRoot = $patchExtract
    $top = @(Get-ChildItem -LiteralPath $patchExtract)
    if ($top.Count -eq 1 -and $top[0].PSIsContainer) { $patchRoot = $top[0].FullName }
    Copy-Item (Join-Path $patchRoot 'files\chrome') (Join-Path $fullStaging 'profile\chrome') -Recurse -Force
    Copy-Item (Join-Path $patchRoot 'files\user.js') (Join-Path $fullStaging 'profile\user.js') -Force

    # data.zip-формат: сжатие Fastest — 300 МБ бинарников Optimal-ом сжимается минутами
    $fullZip = Join-Path $PatchesDir "Blade-Full-v$Version.zip"
    if (Test-Path -LiteralPath $fullZip) {
        $savedFull = Join-Path $PatchesDir "Blade-Full-v$Version.previous-$buildStamp.zip"
        Copy-Item -LiteralPath $fullZip -Destination $savedFull
        if (Test-Path -LiteralPath "$fullZip.sha256") {
            Copy-Item -LiteralPath "$fullZip.sha256" -Destination "$savedFull.sha256"
        }
        Write-Host "Предыдущий полный пакет сохранён: $savedFull" -ForegroundColor DarkGray
    }
    $fullCandidate = Join-Path $PatchesDir ("Blade-Full-v{0}.candidate-{1}.zip" -f $Version, [guid]::NewGuid().ToString('N'))
    Compress-Archive -Path (Join-Path $fullStaging '*') -DestinationPath $fullCandidate -CompressionLevel Fastest
    Move-Item -LiteralPath $fullCandidate -Destination $fullZip -Force
    Remove-Item -LiteralPath $releaseStage -Recurse -Force

    $sizeMB = [Math]::Round((Get-Item $fullZip).Length / 1MB, 1)
    Write-Host "Полный пакет собран: $fullZip ($sizeMB МБ)" -ForegroundColor Green
    $assetPath = $fullZip
    } finally {
        # Ошибка на любом этапе не должна оставлять сотни мегабайт временной копии движка.
        $buildRoot = [System.IO.Path]::GetFullPath((Join-Path $PatchesDir 'build')).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
        $stageFullPath = [System.IO.Path]::GetFullPath($releaseStage)
        if ($stageFullPath.StartsWith($buildRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
            (Test-Path -LiteralPath $stageFullPath -PathType Container)) {
            $stageItem = Get-Item -LiteralPath $stageFullPath -Force
            $stageLink = Get-ChildItem -LiteralPath $stageFullPath -Recurse -Force -ErrorAction SilentlyContinue |
                Where-Object { $_.Attributes -band [System.IO.FileAttributes]::ReparsePoint } | Select-Object -First 1
            if (-not ($stageItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -and -not $stageLink) {
                try { Remove-Item -LiteralPath $stageFullPath -Recurse -Force -ErrorAction Stop }
                catch { Write-Warning "Не удалось убрать временную папку сборки: $stageFullPath ($($_.Exception.Message))" }
            } else {
                Write-Warning "Временная папка содержит ссылку; оставляю её для ручной проверки: $stageFullPath"
            }
        }
        if ($fullCandidate -and (Test-Path -LiteralPath $fullCandidate -PathType Leaf)) {
            try { Remove-Item -LiteralPath $fullCandidate -Force -ErrorAction Stop }
            catch { Write-Warning "Не удалось убрать временный архив: $fullCandidate ($($_.Exception.Message))" }
        }
    }
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

$releaseNotes = "Blade — обновление`n$(Get-Date -Format 'yyyy-MM-dd')`n"
if ($Notes) { $releaseNotes += "`n$Notes" }
$releaseTitle = if ($Codename) { "Blade — $Codename" } else { 'Blade — обновление' }
$releaseArgs = @('release', 'create', "v$Version", $assetPath, $hashFile,
    '--repo', $Repo, '--title', $releaseTitle, '--notes', $releaseNotes)
if ($Draft) { $releaseArgs += '--draft' }
Write-Host "Публикую релиз v$Version..." -ForegroundColor Cyan
& gh @releaseArgs
if ($LASTEXITCODE -ne 0) { throw 'gh release create упал (см. вывод выше)' }

Write-Host ''
Write-Host "ГОТОВО: релиз v$Version ($Mode) опубликован в $Repo" -ForegroundColor Green
Write-Host 'Друзья: браузер сам увидит обновление в течение суток (или сразу через меню B -> Проверить сейчас).'
