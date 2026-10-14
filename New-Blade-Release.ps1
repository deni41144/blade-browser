# ============================================================================
# New-Blade-Release.ps1 — релиз Blade ОДНОЙ командой (Волна 4 «Blade Studio»).
#
# Собирает весь релизный набор: патч + полный пакет + однофайловый сетап
# со встроенным движком + хеши + сводка. Публикация выполняется отдельно.
#
# Использование:
#   powershell -ExecutionPolicy Bypass -File New-Blade-Release.ps1 `
#       -Version 2.0.1 -Codename "Имя Релиза" -Notes "что нового"
#
# Что происходит под капотом (существующие конвейеры, ничего нового):
#   1. Publish-Blade-Update.ps1 -Mode Full -SkipPublish:
#      - Build-Blade-Patch.ps1 → Blade-Patch-vX.zip (+ прошивка VERSION/CODENAME)
#      - Full-сборка → Blade-Full-vX.zip (зафиксированная версия движка,
#        Blade-брендинг + тот же chrome; guard личных файлов)
#   2. dotnet publish встраивает Full и его SHA-256 в Blade-Setup.exe
#   3. Сводка: артефакты, размеры, хеши, что делать дальше
# ============================================================================
param(
    [Parameter(Mandatory = $true)][string]$Version,
    [string]$Codename = '',
    [string]$Notes = '',
    [string]$EngineDir = '',
    [string]$BootstrapDir = '',
    [string]$Repo = 'deni41144/blade-browser',
    [switch]$Publish
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

if ($Version -notmatch '^\d+(\.\d+){0,3}$') {
    throw "Версия должна быть вида 2.0.1 (числа через точку), получено: '$Version'"
}

$root = $PSScriptRoot   # скрипт лежит в корне проекта
if ($PSScriptRoot -eq '') { $root = (Get-Location).Path }
# скрипт лежит в корне проекта — конвейеры в Patches\
$patches = Join-Path $root 'Patches'
if (-not $EngineDir) {
    $engineVersionFile = Join-Path $patches 'firefox-engine-version.txt'
    if (-not (Test-Path -LiteralPath $engineVersionFile -PathType Leaf)) {
        throw "Не найден фиксатор версии движка: $engineVersionFile"
    }
    $engineVersion = [System.IO.File]::ReadAllText($engineVersionFile).Trim()
    $EngineDir = Join-Path $root "Skeleton-Stage\Firefox-$engineVersion\unpacked\core"
}
if (-not $BootstrapDir) {
    # Берём только три конфигурационных файла Blade; папку браузера из этого
    # пути в сборку не копируют и не изменяют.
    $BootstrapDir = Join-Path $env:LOCALAPPDATA 'Blade\App\Blade'
}
$publish = Join-Path $patches 'Publish-Blade-Update.ps1'
if (-not (Test-Path $publish)) { throw "Не найден конвейер: $publish" }

Write-Host "═══ BLADE RELEASE $Version $(if ($Codename) { "«$Codename»" }) ═══" -ForegroundColor Cyan

# 1. Патч + Full одним вызовом (без публикации — жёсткое правило)
& $publish -Version $Version -Codename $Codename -Notes $Notes -Mode Full -EngineDir $EngineDir -BootstrapDir $BootstrapDir -SkipPublish
if ($LASTEXITCODE -eq $null -and $? -eq $false) { throw 'Publish-Blade-Update упал' }

# 2. Однофайловый офлайн-установщик со встроенным Full-пакетом и его хешем
$fullZip = Join-Path $patches "Blade-Full-v$Version.zip"
$fullHash = "$fullZip.sha256"
if (-not (Test-Path $fullZip)) { throw "Full не собрался: $fullZip" }
if (-not (Test-Path $fullHash)) { throw "Не найден SHA-256 Full-пакета: $fullHash" }

$sdkList = & dotnet --list-sdks 2>$null
if ($LASTEXITCODE -ne 0 -or -not ($sdkList | Where-Object { $_ -match '^9\.' })) {
    throw 'Для сборки Blade-Setup нужен .NET 9 SDK.'
}
$setupProject = Join-Path $root 'BladeSetup\BladeSetup.csproj'
$setupOutput = Join-Path $root 'BladeSetup\Output'
$setupExe = Join-Path $setupOutput 'Blade-Setup.exe'
New-Item -ItemType Directory -Path $setupOutput -Force | Out-Null
$publishArgs = @(
    'publish', $setupProject, '-c', 'Release', '-r', 'win-x64', '--self-contained', 'true',
    '-p:PublishSingleFile=true', '-p:IncludeNativeLibrariesForSelfExtract=true',
    '-p:EnableCompressionInSingleFile=true', "-p:BladePayloadPath=$fullZip",
    "-p:BladePayloadHashPath=$fullHash", '-o', $setupOutput
)
& dotnet @publishArgs
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $setupExe)) {
    throw 'Сборка однофайлового Blade-Setup завершилась с ошибкой.'
}
$setupHash = (Get-FileHash -LiteralPath $setupExe -Algorithm SHA256).Hash
$setupHashPath = "$setupExe.sha256"
[System.IO.File]::WriteAllText($setupHashPath, "$setupHash  Blade-Setup.exe`n", [System.Text.Encoding]::ASCII)
Write-Host "Офлайн-установщик собран: $setupExe" -ForegroundColor Green

$patchZip = Join-Path $patches "Blade-Patch-v$Version.zip"
if ($Publish) {
    $releaseAssets = @(
        $patchZip, "$patchZip.sha256",
        $fullZip, "$fullZip.sha256",
        $setupExe, $setupHashPath
    )
    foreach ($asset in $releaseAssets) {
        if (-not (Test-Path -LiteralPath $asset -PathType Leaf)) { throw "Не найден релизный файл: $asset" }
        if ($asset.EndsWith('.sha256', [StringComparison]::OrdinalIgnoreCase)) { continue }
        $expected = (Get-FileHash -LiteralPath $asset -Algorithm SHA256).Hash
        $sidecar = [System.IO.File]::ReadAllText("$asset.sha256").Trim()
        $sidecarParts = $sidecar -split '\s+', 2
        if ($sidecarParts.Count -ne 2 -or
            $sidecarParts[0] -ne $expected -or
            $sidecarParts[1] -ne (Split-Path -Leaf $asset)) {
            throw "SHA-256 не совпадает для $asset"
        }
    }

    & gh auth status 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Для публикации войди в GitHub через gh auth login.' }
    $existingRelease = & gh release view "v$Version" --repo $Repo 2>$null
    if ($LASTEXITCODE -eq 0) { throw "Релиз v$Version уже существует в $Repo; автоматическая замена запрещена." }
    $targetCommit = (& git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $targetCommit) { throw 'Не удалось определить коммит-источник релиза.' }
    $remoteMain = (& git ls-remote origin 'refs/heads/main').Trim()
    if ($LASTEXITCODE -ne 0 -or -not $remoteMain) { throw 'Не удалось проверить origin/main перед публикацией.' }
    $remoteMainCommit = ($remoteMain -split '\s+')[0]
    if ($remoteMainCommit -ne $targetCommit) {
        throw "Сначала отправь коммит $targetCommit в origin/main; сейчас там $remoteMainCommit."
    }
    $remoteTag = & git ls-remote --tags origin "refs/tags/v$Version" "refs/tags/v$Version^{}"
    if ($LASTEXITCODE -ne 0) { throw 'Не удалось проверить теги origin перед публикацией.' }
    if ($remoteTag) { throw "Тег v$Version уже существует в origin; автоматическая замена запрещена." }

    $releaseNotesFile = Join-Path $patches "ReleaseNotes-v$Version.md"
    $releaseTitle = "Blade v$Version"
    if ($Codename) { $releaseTitle += " — $Codename" }
    $releaseArgs = @('release', 'create', "v$Version") + $releaseAssets + @(
        '--repo', $Repo, '--title', $releaseTitle, '--target', $targetCommit, '--latest'
    )
    if (Test-Path -LiteralPath $releaseNotesFile -PathType Leaf) {
        $releaseArgs += @('--notes-file', $releaseNotesFile)
    } elseif ($Notes) {
        $releaseArgs += @('--notes', $Notes)
    } else {
        throw "Для публикации добавь заметки: $releaseNotesFile (или передай -Notes)."
    }
    Write-Host "Публикую релиз v$Version в $Repo со всеми шестью файлами..." -ForegroundColor Cyan
    & gh @releaseArgs
    if ($LASTEXITCODE -ne 0) { throw "Не удалось опубликовать релиз v$Version." }
}

# 3. Сводка
Write-Host ''
Write-Host '═══ РЕЛИЗ СОБРАН ═══' -ForegroundColor Cyan
foreach ($f in @($patchZip, "$patchZip.sha256", $fullZip, "$fullZip.sha256", $setupExe, $setupHashPath)) {
    if (Test-Path $f) {
        $mb = [Math]::Round((Get-Item $f).Length / 1MB, 1)
        Write-Host ("  {0}  ({1} МБ)" -f (Split-Path -Leaf $f), $mb)
    }
}
Write-Host ''
if ($Publish) {
    Write-Host "Релиз v$Version опубликован со всеми шестью файлами." -ForegroundColor Green
} else {
    Write-Host 'Публикация пропущена. Для выпуска этих файлов добавь к команде -Publish.' -ForegroundColor Yellow
}
