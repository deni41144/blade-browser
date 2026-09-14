# ============================================================================
# Apply-Blade-Tiles.ps1 — движковый патч «pinnedOnly» для плиток новой вкладки.
# Баг (2026-09-14): удалённая плитка навсегда заменяется новой — candidates
# из frecent-истории заливают все свободные слоты сетки (2x8=16 при 10
# закреплённых), insertPinned к тому же проваливает дырки от unpinned.
# Фикс (по образцу Apply-Blade-Rebrand.ps1, перепаковка browser/omni.ja):
#   1) TopSitesFeed.sys.mjs: преф browser.newtabpage.blade.pinnedOnly —
#      сетка показывает ТОЛЬКО закреплённые плитки; удалённая плитка
#      оставляет пустой слот, кандидаты/спонсоры не вставляются.
#   2) modules/topsites/TopSites.sys.mjs insertPinned: дырка от unpinned
#      плитки сохраняется null-ом (рендер движка умеет hole-слоты).
#      v2 (audit P1): дырка ЗА хвостом дописывается null-ами — иначе
#      концевые дырки терялись, а последующий pinned через newLinks[index]
#      создавал sparse-слоты (undefined).
#   3) modules/AboutNewTab.sys.mjs getTopSites (audit P0): вырезаем
#      null-дырки из отдаваемых rows — WebExtension topSites.get({newtab:true})
#      идёт links.map(link => link.searchTopSite) по СЫРЫМ rows и падает
#      TypeError на null (урлбар/ai-window фильтруют сами, им не мешает).
# Патч идемпотентен (маркеры BLADE PATCH), синтаксис проверяется node --check.
#
# Использование:
#   powershell -ExecutionPolicy Bypass -File Apply-Blade-Tiles.ps1 `
#     -AppDir "$env:LOCALAPPDATA\Blade\App\Blade"
#   (без -AppDir — установленный движок; для стейджа передай Skeleton-Stage)
# ============================================================================
param(
    [string]$AppDir = (Join-Path $env:LOCALAPPDATA 'Blade\App\Blade'),
    [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$omni = Join-Path $AppDir 'browser\omni.ja'
if (-not (Test-Path $omni)) { throw "Нет архива: $omni" }

# --- Гвард: движок не должен работать ---
$running = @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
    Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($AppDir, [StringComparison]::OrdinalIgnoreCase) })
if ($running.Count -gt 0 -and -not $DryRun) {
    throw "Из этого движка запущен браузер ($($running.Count)) — закрой и повтори"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$utf8 = New-Object System.Text.UTF8Encoding($false)

# --- 1. Патч-контент (LF-концы строк, как в исходниках движка) ---
$feedEntry = 'chrome/browser/builtin-addons/newtab/lib/TopSitesFeed.sys.mjs'
$insEntry  = 'modules/topsites/TopSites.sys.mjs'
$antEntry  = 'modules/AboutNewTab.sys.mjs'

# A1: объявление флага перед frecent-выборкой
$a1old = @'
    // Get all frecent sites from history.
    let frecent = [];
'@.Replace("`r`n", "`n")
$a1new = @'
    // BLADE PATCH pinnedOnly (Apply-Blade-Tiles.ps1): сетка новой вкладки —
    // только закреплённые плитки; удалённая (unpinned) плитка оставляет
    // пустой слот, кандидаты из истории/дефолтов слот не занимают.
    const bladePinnedOnly = Services.prefs.getBoolPref(
      "browser.newtabpage.blade.pinnedOnly",
      false
    );

    // Get all frecent sites from history.
    let frecent = [];
'@.Replace("`r`n", "`n")

# A2: поисковые шорткаты не пиннятся в дырки
$a2old = @'
    if (await this._maybeInsertSearchShortcuts(plainPinned)) {
'@.Replace("`r`n", "`n")
$a2new = @'
    if (
      !bladePinnedOnly &&
      (await this._maybeInsertSearchShortcuts(plainPinned))
    ) {
'@.Replace("`r`n", "`n")

# A3: withPinned = только pinned, спонсоры не вставляются
$a3old = @'
    // Insert sponsored sites at their desired position.
    dedupedSponsored.forEach(link => {
      if (!link) {
        return;
      }
'@.Replace("`r`n", "`n")
$a3new = @'
    // BLADE PATCH pinnedOnly: сетка = только закреплённые (дырки остаются
    // пустыми), спонсорские плитки не вставляются.
    if (bladePinnedOnly) {
      withPinned = pinned;
    }

    // Insert sponsored sites at their desired position.
    dedupedSponsored.forEach(link => {
      if (!link || bladePinnedOnly) {
        return;
      }
'@.Replace("`r`n", "`n")

# A4: в pinnedOnly не режем закреплённые по numItems (rows×perRow) —
# живой тест 2026-09-14: 15 pinned при сетке 2×5 показывали только 10,
# хвост срезался slice. Раскладку любого количества делает CSS (flex-wrap).
$a4old = @'
    // Remove excess items after we inserted sponsored ones.
    withPinned = withPinned.slice(0, numItems);
'@.Replace("`r`n", "`n")
$a4new = @'
    // Remove excess items after we inserted sponsored ones.
    // BLADE PATCH pinnedOnly: закреплённые не режем по numItems — сетка
    // показывает все pinned независимо от rows×perRow.
    if (!bladePinnedOnly) {
      withPinned = withPinned.slice(0, numItems);
    }
'@.Replace("`r`n", "`n")

# B1: insertPinned сохраняет дырки; v2 (audit P1) — дырка ЗА хвостом
# дописывается null-ами, иначе последующий pinned через newLinks[index]
# создаёт sparse-слоты (undefined), а концевые дырки вообще терялись.
$b1old = @'
  pinned.forEach((val, index) => {
    if (!val) {
      return;
    }
'@.Replace("`r`n", "`n")
# v1 (для распознавания уже прошитых движков и миграции на v2)
$b1v1 = @'
  pinned.forEach((val, index) => {
    if (!val) {
      // BLADE PATCH: дырка от unpinned плитки остаётся пустой —
      // кандидаты из истории не занимают чужой слот.
      if (index < newLinks.length) {
        newLinks.splice(index, 0, null);
      }
      return;
    }
'@.Replace("`r`n", "`n")
$b1new = @'
  pinned.forEach((val, index) => {
    if (!val) {
      // BLADE PATCH: дырка от unpinned плитки остаётся пустой —
      // кандидаты из истории не занимают чужой слот.
      if (index < newLinks.length) {
        newLinks.splice(index, 0, null);
      } else {
        // BLADE PATCH v2 (audit P1): дырка ЗА хвостом — дополняем массив
        // null-ами до index включительно; иначе последующий pinned через
        // newLinks[index] создаст sparse-слоты (undefined-дырки).
        while (newLinks.length < index) {
          newLinks.push(null);
        }
        newLinks.push(null);
      }
      return;
    }
'@.Replace("`r`n", "`n")

# C1 (audit P0): getTopSites отдаёт СЫРЫЕ rows со стор-дырками (null от
# unpinned). Потребитель ext-topSites.js (WebExtension topSites.get
# {newtab:true}) делает links.map(async link => ({ type: link.searchTopSite
# ... })) — на null TypeError; урлбар (UrlbarProviderTopSites:128) и
# ai-window фильтруют сами (site?.url / filter(site => site)), им фильтр
# не мешает. Рендер сетки идёт мимо getTopSites (через стор) — позиции
# никто не ждёт, все потребители списковые.
$c1old = @'
    return this.activityStream
      ? this.activityStream.store.getState().TopSites.rows
      : [];
'@.Replace("`r`n", "`n")
$c1new = @'
    return this.activityStream
      ? // BLADE PATCH (audit P0): вырезаем null-дырки (слоты unpinned) —
        // WebExtension topSites.get({newtab:true}) мапит сырые rows и падает
        // TypeError на null; рендер сетки идёт через стор, не отсюда.
        this.activityStream.store.getState().TopSites.rows.filter(Boolean)
      : [];
'@.Replace("`r`n", "`n")

# --- 2. Читаем текущий контент целей из архива ---
function Read-Entry([string]$zipPath, [string]$entryName) {
    $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    try {
        $e = $zip.Entries | Where-Object { $_.FullName -eq $entryName }
        if (-not $e) { throw "В архиве нет записи: $entryName" }
        $sr = New-Object System.IO.StreamReader($e.Open(), [System.Text.Encoding]::UTF8)
        try { return $sr.ReadToEnd() } finally { $sr.Dispose() }
    } finally { $zip.Dispose() }
}

$feedTxt = Read-Entry $omni $feedEntry
$insTxt  = Read-Entry $omni $insEntry
$antTxt  = Read-Entry $omni $antEntry

# --- 3. Применяем патчи (каждый идемпотентен по своему маркеру) ---
# Патчи A1..A4 можно ставить выборочно (напр. A4 поверх старой прошивки A1-A3).
$feedPatches = @(
    @{ id = 'A1'; old = $a1old; new = $a1new; marker = 'const bladePinnedOnly' },
    @{ id = 'A2'; old = $a2old; new = $a2new; marker = '!bladePinnedOnly &&' },
    @{ id = 'A3'; old = $a3old; new = $a3new; marker = 'withPinned = pinned;' },
    @{ id = 'A4'; old = $a4old; new = $a4new; marker = 'закреплённые не режем по numItems' }
)
$feedChanged = $false
foreach ($p in $feedPatches) {
    if ($feedTxt.Contains($p.marker)) {
        Write-Host "TopSitesFeed: $($p.id) уже стоит, пропускаю" -ForegroundColor DarkYellow
        continue
    }
    if (-not $feedTxt.Contains($p.old)) { throw "TopSitesFeed: якорь $($p.id) не найден — файл движка изменился, патч не применяется" }
    $feedTxt = $feedTxt.Replace($p.old, $p.new)
    $feedChanged = $true
    Write-Host "TopSitesFeed: $($p.id) применён" -ForegroundColor Cyan
}

# B1 v2: идемпотентность по v2-маркеру; старая прошивка v1 мигрируется
$insDone = $insTxt.Contains('BLADE PATCH v2 (audit P1)')
$insChanged = $false
if (-not $insDone) {
    if ($insTxt.Contains($b1v1)) {
        $insTxt = $insTxt.Replace($b1v1, $b1new)
        $insChanged = $true
        Write-Host 'TopSites.sys.mjs: B1 v1 -> v2 (миграция)' -ForegroundColor Cyan
    } elseif ($insTxt.Contains($b1old)) {
        $insTxt = $insTxt.Replace($b1old, $b1new)
        $insChanged = $true
        Write-Host 'TopSites.sys.mjs: B1 v2 применён' -ForegroundColor Cyan
    } else {
        throw "TopSites.sys.mjs: якорь B1 не найден — файл движка изменился"
    }
} else {
    Write-Host 'TopSites.sys.mjs: B1 v2 уже стоит, пропускаю' -ForegroundColor Yellow
}

# C1 (audit P0): идемпотентность по filter(Boolean) в getTopSites
$antChanged = $false
if ($antTxt.Contains('TopSites.rows.filter(Boolean)')) {
    Write-Host 'AboutNewTab.sys.mjs: C1 уже стоит, пропускаю' -ForegroundColor Yellow
} elseif ($antTxt.Contains($c1old)) {
    $antTxt = $antTxt.Replace($c1old, $c1new)
    $antChanged = $true
    Write-Host 'AboutNewTab.sys.mjs: C1 применён' -ForegroundColor Cyan
} else {
    throw "AboutNewTab.sys.mjs: якорь C1 не найден — файл движка изменился"
}

if (-not $feedChanged -and -not $insChanged -and -not $antChanged) {
    Write-Host 'Нечего менять — все патчи уже стоят' -ForegroundColor Yellow
    return
}

# --- 4. Синтаксис-проверка (node --check понимает .mjs как ESM) ---
$tmp = Join-Path $env:TEMP ("blade-tiles-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
try {
    $f1 = Join-Path $tmp 'TopSitesFeed.sys.mjs'
    [System.IO.File]::WriteAllText($f1, $feedTxt, $utf8)
    $f2 = Join-Path $tmp 'TopSites.sys.mjs'
    [System.IO.File]::WriteAllText($f2, $insTxt, $utf8)
    $f3 = Join-Path $tmp 'AboutNewTab.sys.mjs'
    [System.IO.File]::WriteAllText($f3, $antTxt, $utf8)
    & node --check $f1
    if ($LASTEXITCODE -ne 0) { throw "node --check: TopSitesFeed.sys.mjs — синтаксис битый, откат" }
    & node --check $f2
    if ($LASTEXITCODE -ne 0) { throw "node --check: TopSites.sys.mjs — синтаксис битый, откат" }
    & node --check $f3
    if ($LASTEXITCODE -ne 0) { throw "node --check: AboutNewTab.sys.mjs — синтаксис битый, откат" }
    Write-Host 'Синтаксис патчей проверен (node --check): OK' -ForegroundColor Green

    # --- 5. Перепаковка архива (порядок записей сохраняем, как в Rebrand) ---
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $label = Split-Path $AppDir -Leaf
    $bkDir = Join-Path $PSScriptRoot ("Backups\tiles-" + $stamp + "\" + $label)
    if (-not $DryRun) {
        New-Item -ItemType Directory -Path $bkDir -Force | Out-Null
        Copy-Item $omni (Join-Path $bkDir 'browser-omni.ja') -Force
        Write-Host "бэкап: $bkDir\browser-omni.ja"
    }

    $feedBytes = $utf8.GetBytes($feedTxt)
    $insBytes  = $utf8.GetBytes($insTxt)
    $antBytes  = $utf8.GetBytes($antTxt)
    $newOmni = $omni + '.new'
    $src = [System.IO.Compression.ZipFile]::OpenRead($omni)
    $out = [System.IO.Compression.ZipFile]::Open($newOmni, 'Create')
    try {
        foreach ($e in $src.Entries) {
            $ne = $out.CreateEntry($e.FullName, [System.IO.Compression.CompressionLevel]::Optimal)
            $st = $ne.Open()
            if ($e.FullName -eq $feedEntry) {
                $st.Write($feedBytes, 0, $feedBytes.Length)
                Write-Host ("  [PATCH] " + $feedEntry)
            } elseif ($e.FullName -eq $insEntry) {
                $st.Write($insBytes, 0, $insBytes.Length)
                Write-Host ("  [PATCH] " + $insEntry)
            } elseif ($e.FullName -eq $antEntry) {
                $st.Write($antBytes, 0, $antBytes.Length)
                Write-Host ("  [PATCH] " + $antEntry)
            } else {
                $es = $e.Open(); $es.CopyTo($st); $es.Close()
            }
            $st.Close()
        }
    } finally { $src.Dispose(); $out.Dispose() }

    if ($DryRun) {
        Remove-Item $newOmni -Force
        Write-Host "DryRun: патчи готовы и проверены, архив не тронут" -ForegroundColor Cyan
    } else {
        Move-Item $newOmni $omni -Force
        Write-Host "Готово: browser/omni.ja перешит (pinnedOnly + дырки). Почисти startupCache профилей и перезапусти браузер." -ForegroundColor Green
    }
} finally {
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
