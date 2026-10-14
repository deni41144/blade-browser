# ============================================================================
# Apply-Blade-Rebrand.ps1 — замена лисьих ассетов на Blade в движке.
# Фаза «Чистый Лист»: chrome/browser/content/branding/ в browser\omni.ja
# (about-logo.png/@2x/private, about.png, icon16-128, about-logo.svg).
# Wordmark-SVG уже Blade (прошлые проходы) — не трогаем.
#
# Ассеты генерятся из Branding\master_icon.png (System.Drawing). Бэкап конвенцией.
#
# Использование:
#   powershell -ExecutionPolicy Bypass -File Apply-Blade-Rebrand.ps1
#   -AppDir <путь к движку> (по умолчанию %LOCALAPPDATA%\Blade\App\Blade)
# ============================================================================
param(
    [string]$AppDir = (Join-Path $env:LOCALAPPDATA 'Blade\App\Blade'),
    [switch]$DryRun,
    # Для релизной сборки меняем только основные about/app-иконки, сохраняя
    # иллюстрации Firefox View, профилей и встроенных подсказок целыми.
    [switch]$BrandAssetsOnly
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$omniBrowser = Join-Path $AppDir 'browser\omni.ja'
$master = Join-Path $PSScriptRoot 'Branding\master_icon.png'
$brandFtlEn = Join-Path $PSScriptRoot 'Branding\brand.ftl'
$brandFtlRu = Join-Path $PSScriptRoot 'Branding\brand-ru.ftl'
$brandProperties = Join-Path $PSScriptRoot 'Branding\brand.properties'
if (-not (Test-Path $omniBrowser)) { throw "Нет архива: $omniBrowser" }
foreach ($requiredBrandAsset in @($master, $brandFtlEn, $brandFtlRu, $brandProperties)) {
    if (-not (Test-Path $requiredBrandAsset -PathType Leaf)) { throw "Нет бренд-ресурса: $requiredBrandAsset" }
}

# --- Гвард: движок не должен работать ---
$running = @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
    Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($AppDir, [StringComparison]::OrdinalIgnoreCase) })
if ($running.Count -gt 0 -and -not $DryRun) {
    throw "Из этого движка запущен браузер ($($running.Count)) — закрой и повтори"
}

# --- 1. Генерация ассетов (встроенный System.Drawing, без Python/Pillow) ---
$genDir = Join-Path $env:TEMP ("blade-rebrand-" + [guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $genDir -Force | Out-Null
Add-Type -AssemblyName System.Drawing
$masterImage = [System.Drawing.Image]::FromFile($master)
function Save-BladePng {
    param(
        [System.Drawing.Image]$Source,
        [string]$Path,
        [int]$Width,
        [int]$Height
    )
    $bitmap = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($Source, 0, 0, $Width, $Height)
        $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}
try {
    foreach ($size in @(192, 384)) {
        $logoName = if ($size -eq 384) { 'about-logo@2x.png' } else { 'about-logo.png' }
        Save-BladePng -Source $masterImage -Path (Join-Path $genDir $logoName) -Width $size -Height $size
    }
    Copy-Item (Join-Path $genDir 'about-logo.png') (Join-Path $genDir 'about-logo-private.png')
    Copy-Item (Join-Path $genDir 'about-logo@2x.png') (Join-Path $genDir 'about-logo-private@2x.png')
    Save-BladePng -Source $masterImage -Path (Join-Path $genDir 'about.png') -Width 200 -Height 200
    $aboutCanvas = New-Object System.Drawing.Bitmap(300, 236, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $aboutGraphics = [System.Drawing.Graphics]::FromImage($aboutCanvas)
    try {
        $aboutGraphics.Clear([System.Drawing.Color]::Transparent)
        $aboutGraphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
        $aboutGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $aboutGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $aboutGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $logoImage = [System.Drawing.Image]::FromFile((Join-Path $genDir 'about.png'))
        try { $aboutGraphics.DrawImage($logoImage, 50, 18, 200, 200) } finally { $logoImage.Dispose() }
        $aboutCanvas.Save((Join-Path $genDir 'about.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $aboutGraphics.Dispose()
        $aboutCanvas.Dispose()
    }
    foreach ($size in @(16, 32, 48, 64, 128)) {
        Save-BladePng -Source $masterImage -Path (Join-Path $genDir "icon$size.png") -Width $size -Height $size
    }
} finally {
    $masterImage.Dispose()
}
if (-not (Test-Path (Join-Path $genDir 'icon128.png'))) { throw 'Генерация ассетов упала' }
Write-Host 'Ассеты Blade сгенерированы (11 файлов из master_icon.png)' -ForegroundColor Green

# --- 2. SVG-обёртка для about-logo.svg (векторную лису заменяем ссылкой на Blade-PNG) ---
$svgWrap = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 192 192"><image xlink:href="chrome://browser/content/branding/about-logo.png" width="192" height="192"/></svg>'

Add-Type -AssemblyName System.IO.Compression.FileSystem

# --- 3. Патч архива (бинарные записи, порядок сохраняем) ---
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$bkDir = Join-Path $PSScriptRoot ("Backups\rebrand-" + $stamp)
if (-not $DryRun) {
    New-Item -ItemType Directory -Path $bkDir -Force | Out-Null
    Copy-Item $omniBrowser (Join-Path $bkDir 'browser-omni.ja') -Force
    Write-Host "бэкап: $bkDir\browser-omni.ja"
}

$replace = @{
    'chrome/browser/content/branding/about-logo.png'          = (Join-Path $genDir 'about-logo.png')
    'chrome/browser/content/branding/about-logo@2x.png'       = (Join-Path $genDir 'about-logo@2x.png')
    'chrome/browser/content/branding/about-logo-private.png'  = (Join-Path $genDir 'about-logo-private.png')
    'chrome/browser/content/branding/about-logo-private@2x.png' = (Join-Path $genDir 'about-logo-private@2x.png')
    'chrome/browser/content/branding/about.png'               = (Join-Path $genDir 'about.png')
    'chrome/browser/content/branding/icon16.png'              = (Join-Path $genDir 'icon16.png')
    'chrome/browser/content/branding/icon32.png'              = (Join-Path $genDir 'icon32.png')
    'chrome/browser/content/branding/icon48.png'              = (Join-Path $genDir 'icon48.png')
    'chrome/browser/content/branding/icon64.png'              = (Join-Path $genDir 'icon64.png')
    'chrome/browser/content/branding/icon128.png'             = (Join-Path $genDir 'icon128.png')
}
$brandFtlEnBytes = [System.IO.File]::ReadAllBytes($brandFtlEn)
$brandFtlRuBytes = [System.IO.File]::ReadAllBytes($brandFtlRu)
$brandPropertiesBytes = [System.IO.File]::ReadAllBytes($brandProperties)
$wordmark = [System.Text.Encoding]::UTF8.GetBytes(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 359 80"><title>BLADE</title><text x="4" y="66" font-family="Arial Black, Arial, sans-serif" font-size="66" font-weight="900" letter-spacing="10" fill="context-fill">BLADE</text></svg>')

# --- PASS 2: все лисьи ассеты (маска: fox/mascot/kit/mr-/splash/firefox) ---
# SVG -> обёртка Blade, PNG -> рендер клинка 200px. Исключения: wordmark'и уже
# Blade (текст), branding/ закрыт PASS 1.
Add-Type -AssemblyName System.Drawing
$bladePng200 = Join-Path $genDir 'blade-200.png'
$bmp = [System.Drawing.Image]::FromFile($master)
$resized = New-Object System.Drawing.Bitmap(200, 200)
$gr = [System.Drawing.Graphics]::FromImage($resized)
$gr.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gr.DrawImage($bmp, 0, 0, 200, 200)
$resized.Save($bladePng200, [System.Drawing.Imaging.ImageFormat]::Png)
$gr.Dispose(); $resized.Dispose(); $bmp.Dispose()

$foxPattern = '(?i)(fox|mascot|kit|mr-|splash|firefox)'
$skipExact = @('chrome/browser/content/branding/firefox-wordmark.svg', 'chrome/browser/content/branding/about-wordmark.svg')
$foxTargets = @{}
if (-not $BrandAssetsOnly) {
    $srcList = [System.IO.Compression.ZipFile]::OpenRead($omniBrowser)
    foreach ($e in $srcList.Entries) {
        $leaf = Split-Path -Leaf $e.FullName
        if ($e.FullName -notmatch '\.(svg|png)$') { continue }
        if ($e.FullName -like 'chrome/browser/content/branding/*') { continue }
        if ($skipExact -contains $e.FullName) { continue }
        if ($leaf -match $foxPattern) { $foxTargets[$e.FullName] = $true }
    }
    $srcList.Dispose()
    Write-Host ("PASS 2: лисьих ассетов к замене: " + $foxTargets.Count) -ForegroundColor Cyan
} else {
    Write-Host 'PASS 2: иллюстрации встроенных страниц сохранены (-BrandAssetsOnly)' -ForegroundColor DarkGray
}

$newOmni = $omniBrowser + '.new'
$src = [System.IO.Compression.ZipFile]::OpenRead($omniBrowser)
$out = [System.IO.Compression.ZipFile]::Open($newOmni, 'Create')
$patched = 0
try {
    foreach ($e in $src.Entries) {
        $ne = $out.CreateEntry($e.FullName, [System.IO.Compression.CompressionLevel]::Optimal)
        $st = $ne.Open()
        if ($replace.ContainsKey($e.FullName)) {
            $bytes = [System.IO.File]::ReadAllBytes($replace[$e.FullName])
            $st.Write($bytes, 0, $bytes.Length)
            $patched++
            Write-Host ("  [REBRAND] " + $e.FullName + "  (" + $bytes.Length + " б)")
        } elseif ($e.FullName -eq 'chrome/browser/content/branding/about-logo.svg') {
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($svgWrap)
            $st.Write($bytes, 0, $bytes.Length)
            $patched++
            Write-Host ("  [REBRAND] about-logo.svg -> SVG-обёртка Blade")
        } elseif ($e.FullName -eq 'localization/en-US/branding/brand.ftl') {
            $st.Write($brandFtlEnBytes, 0, $brandFtlEnBytes.Length)
            $patched++
            Write-Host '  [REBRAND] brand.ftl en-US'
        } elseif ($e.FullName -eq 'localization/ru/branding/brand.ftl') {
            $st.Write($brandFtlRuBytes, 0, $brandFtlRuBytes.Length)
            $patched++
            Write-Host '  [REBRAND] brand.ftl ru'
        } elseif ($e.FullName -match '^chrome/(ru|en-US)/locale/branding/brand\.properties$') {
            $st.Write($brandPropertiesBytes, 0, $brandPropertiesBytes.Length)
            $patched++
            Write-Host ("  [REBRAND] " + $e.FullName)
        } elseif ($e.FullName -eq 'chrome/browser/content/branding/about-wordmark.svg' -or
                  $e.FullName -eq 'chrome/browser/content/branding/firefox-wordmark.svg') {
            $st.Write($wordmark, 0, $wordmark.Length)
            $patched++
            Write-Host ("  [REBRAND] " + $e.FullName + ' -> BLADE')
        } elseif ($foxTargets.ContainsKey($e.FullName)) {
            if ($e.FullName -match '\.svg$') {
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($svgWrap)
            } else {
                $bytes = [System.IO.File]::ReadAllBytes($bladePng200)
            }
            $st.Write($bytes, 0, $bytes.Length)
            $patched++
            Write-Host ("  [FOX OUT] " + $e.FullName)
        } else {
            $es = $e.Open(); $es.CopyTo($st); $es.Close()
        }
        $st.Close()
    }
} finally { $src.Dispose(); $out.Dispose() }

if ($DryRun) {
    Remove-Item $newOmni -Force
    Write-Host "DryRun: перешито бы $patched записей, ничего не записано"
} else {
    Move-Item $newOmni $omniBrowser -Force
    Write-Host ("Готово: перешито {0} бренд-ассетов. Перезапусти браузер + почисти startupCache профилей." -f $patched) -ForegroundColor Green
}
Remove-Item $genDir -Recurse -Force -ErrorAction SilentlyContinue
