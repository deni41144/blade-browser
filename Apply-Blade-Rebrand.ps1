# ============================================================================
# Apply-Blade-Rebrand.ps1 — замена лисьих ассетов на Blade в движке.
# Фаза «Чистый Лист»: chrome/browser/content/branding/ в browser\omni.ja
# (about-logo.png/@2x/private, about.png, icon16-128, about-logo.svg).
# Wordmark-SVG уже Blade (прошлые проходы) — не трогаем.
#
# Ассеты генерятся из Branding\master_icon.png (Pillow). Бэкап конвенцией.
#
# Использование:
#   powershell -ExecutionPolicy Bypass -File Apply-Blade-Rebrand.ps1
#   -AppDir <путь к движку> (по умолчанию %LOCALAPPDATA%\Blade\App\Blade)
# ============================================================================
param(
    [string]$AppDir = (Join-Path $env:LOCALAPPDATA 'Blade\App\Blade'),
    [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$omniBrowser = Join-Path $AppDir 'browser\omni.ja'
$master = Join-Path $PSScriptRoot 'Branding\master_icon.png'
if (-not (Test-Path $omniBrowser)) { throw "Нет архива: $omniBrowser" }
if (-not (Test-Path $master)) { throw "Нет мастер-иконки: $master" }

# --- Гвард: движок не должен работать ---
$running = @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
    Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($AppDir, [StringComparison]::OrdinalIgnoreCase) })
if ($running.Count -gt 0 -and -not $DryRun) {
    throw "Из этого движка запущен браузер ($($running.Count)) — закрой и повтори"
}

# --- 1. Генерация ассетов (Pillow) ---
$genDir = Join-Path $env:TEMP ("blade-rebrand-" + [guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $genDir -Force | Out-Null
$py = @'
import sys
from PIL import Image
master = Image.open(sys.argv[1]).convert("RGBA")
out = sys.argv[2]
def save(size, name):
    master.resize((size, size), Image.LANCZOS).save(f"{out}\\{name}", "PNG")
save(192, "about-logo.png")
save(384, "about-logo@2x.png")
save(192, "about-logo-private.png")
save(384, "about-logo-private@2x.png")
# about.png: канва 300x236, лого по центру (~200px)
canvas = Image.new("RGBA", (300, 236), (0, 0, 0, 0))
logo = master.resize((200, 200), Image.LANCZOS)
canvas.paste(logo, ((300 - 200) // 2, (236 - 200) // 2), logo)
canvas.save(f"{out}\\about.png", "PNG")
for s in (16, 32, 48, 64, 128):
    save(s, f"icon{s}.png")
print("ASSETS_OK")
'@
$pyFile = Join-Path $genDir "gen.py"
$py | Set-Content $pyFile -Encoding UTF8
$null = & python $pyFile $master $genDir
if ($LASTEXITCODE -ne 0 -or -not (Test-Path (Join-Path $genDir 'about-logo.png'))) {
    throw "Генерация ассетов упала"
}
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
