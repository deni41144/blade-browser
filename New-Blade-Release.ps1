# ============================================================================
# New-Blade-Release.ps1 — релиз Blade ОДНОЙ командой (Волна 4 «Blade Studio»).
#
# Собирает весь релизный набор: патч + полный пакет + data.zip для сетапа
# + хеши + сводка. Публикация НЕ входит — только по слову владельца
# (Publish-Blade-Update.ps1 без -SkipPublish).
#
# Использование:
#   powershell -ExecutionPolicy Bypass -File New-Blade-Release.ps1 `
#       -Version 2.0.1 -Codename "Имя Релиза" -Notes "что нового"
#
# Что происходит под капотом (существующие конвейеры, ничего нового):
#   1. Publish-Blade-Update.ps1 -Mode Full -SkipPublish:
#      - Build-Blade-Patch.ps1 → Blade-Patch-vX.zip (+ прошивка VERSION/CODENAME)
#      - Full-сборка → Blade-Full-vX.zip (движок %LOCALAPPDATA%\Blade\App\Blade
#        + побайтово тот же chrome; guard личных файлов)
#   2. data.zip для установщика → BladeSetup\Output\data.zip
#   3. Сводка: артефакты, размеры, хеши, что делать дальше
# ============================================================================
param(
    [Parameter(Mandatory = $true)][string]$Version,
    [string]$Codename = '',
    [string]$Notes = '',
    [string]$EngineDir = "$env:LOCALAPPDATA\Blade\App\Blade"
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
$publish = Join-Path $patches 'Publish-Blade-Update.ps1'
if (-not (Test-Path $publish)) { throw "Не найден конвейер: $publish" }

Write-Host "═══ BLADE RELEASE $Version $(if ($Codename) { "«$Codename»" }) ═══" -ForegroundColor Cyan

# 1. Патч + Full одним вызовом (без публикации — жёсткое правило)
& $publish -Version $Version -Codename $Codename -Notes $Notes -Mode Full -EngineDir $EngineDir -SkipPublish
if ($LASTEXITCODE -eq $null -and $? -eq $false) { throw 'Publish-Blade-Update упал' }

# 2. data.zip для сетапа — свежий Full ложится рядом с Blade-Setup.exe
$fullZip = Join-Path $patches "Blade-Full-v$Version.zip"
$dataZip = Join-Path $root 'BladeSetup\Output\data.zip'
if (-not (Test-Path $fullZip)) { throw "Full не собрался: $fullZip" }
Copy-Item $fullZip $dataZip -Force
Write-Host "data.zip сетапа обновлён: $dataZip" -ForegroundColor Green

# 3. Сводка
$patchZip = Join-Path $patches "Blade-Patch-v$Version.zip"
Write-Host ''
Write-Host '═══ РЕЛИЗ СОБРАН ═══' -ForegroundColor Cyan
foreach ($f in @($patchZip, "$patchZip.sha256", $fullZip, "$fullZip.sha256", (Join-Path $root 'BladeSetup\Output\Blade-Setup.exe'), $dataZip)) {
    if (Test-Path $f) {
        $mb = [Math]::Round((Get-Item $f).Length / 1MB, 1)
        Write-Host ("  {0}  ({1} МБ)" -f (Split-Path -Leaf $f), $mb)
    }
}
Write-Host ''
Write-Host 'Дальше — ТОЛЬКО по слову владельца:' -ForegroundColor Yellow
Write-Host "  публикация: powershell -File `"$publish`" -Version $Version -Mode Full -Notes <нотсы>"
Write-Host "  (публикация поднимет тот же набор в GitHub; апдейтер друзей подхватит за сутки)"
