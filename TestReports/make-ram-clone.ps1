param(
    # Baseline-плечо A/B: откатить диет-префы 2.0 к дефолтам (строки ниже в
    # user.js перекрывают выше — диет-префы из dev user.js окажутся нейтрализованы)
    [switch]$RevertDiet,
    # Бисект: откатить только image-префы (surfacecache/unmap)
    [switch]$RevertImage,
    # Замер Dark Reader: отключить расширение в клоне (расширения живут в
    # extensions.json профиля; xpi в клоне остаётся, но не запускается)
    [switch]$DisableDarkReader
)
$ErrorActionPreference = 'Stop'
$dst = Join-Path $env:TEMP 'blade-ram-prof'
if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
robocopy 'F:\firefox michael edition\FirefoxPortable\Data\profile' $dst /E /NFL /NDL /NJH /NJS /XD storage cache2 cache storage-default minidumps crashdeltas datareporting saved-telemetry-pings shader-cache sessionstore-backups thumbnails boringssl-events | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed: $LASTEXITCODE" }
# изм-префы клонa: без диалогов закрытия (иначе CloseMainWindow упирается в
# «Закрыть N вкладок?» и через таймаут срабатывает taskkill /F — грязный шатдаун,
# сейфмод-промпт на следующих стартах)
Add-Content -Path (Join-Path $dst 'user.js') -Encoding UTF8 -Value @'

// ==== измерительный стенд RAM (TestReports\measure-ram.ps1) — только в клоне ====
user_pref("browser.warnOnQuit", false);
user_pref("browser.tabs.warnOnClose", false);
user_pref("browser.tabs.warnOnCloseOtherTabs", false);
user_pref("toolkit.startup.num_recent_crashes", 0);
'@
if ($DisableDarkReader) {
    # выключаем Dark Reader правкой extensions.json (id addon@darkreader.org)
    $ej = Join-Path $dst 'extensions.json'
    if (Test-Path $ej) {
        $json = Get-Content $ej -Raw -Encoding UTF8 | ConvertFrom-Json
        foreach ($a in $json.addons) {
            if ($a.id -eq 'addon@darkreader.org') { $a.active = $false }
        }
        $json | ConvertTo-Json -Depth 20 | Set-Content $ej -Encoding UTF8
    } else { Write-Warning 'extensions.json не найден в клоне' }
}
if ($RevertImage) {
    Add-Content -Path (Join-Path $dst 'user.js') -Encoding UTF8 -Value @'

// ==== бисект: откат image-префов к дефолтам FF155 ====
user_pref("image.mem.surfacecache.size_factor", 4);
user_pref("image.mem.shared.unmap.force-enabled", false);
'@
}
if ($RevertDiet) {
    Add-Content -Path (Join-Path $dst 'user.js') -Encoding UTF8 -Value @'

// ==== A/B: откат диет-префов 2.0 к дефолтам FF155 (плечо baseline) ====
user_pref("dom.ipc.processCount.webIsolated", 4);
user_pref("media.memory_caches_combined_limit_kb", 524288);
user_pref("image.mem.surfacecache.size_factor", 4);
user_pref("image.mem.shared.unmap.force-enabled", false);
'@
}
Remove-Item (Join-Path $dst 'sessionCheckpoints.json') -Force -ErrorAction SilentlyContinue
$size = (Get-ChildItem $dst -Recurse -File | Measure-Object Length -Sum).Sum / 1MB
Write-Host ("clone OK: {0} ({1:N1} MB)" -f $dst, $size)
