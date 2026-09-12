# ============================================================================
# Update-Blade.ps1 — пересборка Blade из новой версии Firefox (v2, бронированная)
# Использование:
#   .\Update-Blade.ps1 -NewFirefox "C:\Downloads\FirefoxPortable-new\App\Firefox64"
#   (путь к папке, где лежит firefox.exe НОВОЙ версии)
# v2 — исправления по отчёту красной команды:
#   №1  валидация пути источника (вложенность/самозеркало/отсутствие omni.ja)
#   №2  килл ТОЛЬКО процессов Blade (по пути exe), а не всех firefox в системе
#   №4  проверка кодов выхода robocopy/rcedit/бэкапа — «ГОТОВО» больше не врёт
#   №5  полный откат: старый App сохраняется в Backups ЦЕЛИКОМ (переименованием),
#       при любой ошибке — автоматический rollback
#   №8  уникальное имя TEMP-файла (GUID) — нет коллизий при повторном запуске
#   №9  retry на Move-Item (антивирус/локи)
# ============================================================================
param(
  [Parameter(Mandatory = $true)]
  [string]$NewFirefox
)
$ErrorActionPreference = 'Stop'
$Ro = Split-Path -Parent $MyInvocation.MyCommand.Path
$App = Join-Path $env:LOCALAPPDATA 'Blade\App\Blade'
$Brand = Join-Path $Ro 'Branding'
$Backups = Join-Path $Ro 'Backups'

function Write-Step($m) { Write-Host "==> $m" -ForegroundColor Cyan }
function Write-Ok($m)   { Write-Host "    $m" -ForegroundColor Green }

# --- 0. Проверки (№1) ---------------------------------------------------------
Write-Step "Проверки"
if (-not (Test-Path (Join-Path $NewFirefox 'firefox.exe'))) {
  throw "В '$NewFirefox' нет firefox.exe — укажи папку РАСПАКАННОГО нового Firefox"
}
if (-not (Test-Path (Join-Path $NewFirefox 'browser\omni.ja'))) {
  throw "В '$NewFirefox' нет browser\omni.ja — структура не похожа на Firefox. НЕ распаковал ли ты его ВНУТРЬ старого? Укажи корень новой версии."
}
$srcFull = (Resolve-Path $NewFirefox).Path
$appFull = (Resolve-Path $App).Path
if ($srcFull -eq $appFull) { throw "Источник совпадает с целевой папкой — само-зеркало, отказываюсь" }
if ($srcFull.StartsWith($appFull, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Источник '$srcFull' лежит ВНУТРИ целевой '$appFull' — robocopy /MIR уничтожил бы установку. Распакуй новый Firefox в отдельное место."
}
if ($appFull.StartsWith($srcFull, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Целевая папка лежит внутри источника — отказано (защита от самоуничтожения)"
}
foreach ($f in @('brand.ftl','brand.properties','icon.ico','master_icon.png','rcedit.exe')) {
  if (-not (Test-Path (Join-Path $Brand $f))) { throw "Branding\$f отсутствует — апдейтеру нечем работать" }
}
Write-Ok "пути валидны"

# --- 1. Килл только процессов Blade (№2) ---------------------------------------
Write-Step "Остановка Blade (и только Blade)"
$mine = Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
        Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($appFull, [StringComparison]::OrdinalIgnoreCase) }
if ($mine) {
  $mine | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 3
  Write-Ok ("остановлено процессов: " + @($mine).Count)
} else { Write-Ok "не запущен" }

# --- 2. Бэкап профиля ----------------------------------------------------------
Write-Step "Бэкап профиля"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Ro 'Blade-Backup.ps1')
if ($LASTEXITCODE -ne 0) { throw "Blade-Backup.ps1 упал (код $LASTEXITCODE) — обновление без бэкапа запрещено" }
$stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$appBackup = Join-Path $Backups "Firefox64-full-$stamp"
New-Item -ItemType Directory -Force -Path $Backups | Out-Null
Write-Ok "профиль забэкаплен"

# --- 3-8. Основной поток с полным откатом --------------------------------------
$appSaved = $false
try {
  # 3. Полный PreUpdate: ПЕРЕИМЕНОВЫВАЕМ старый App целиком (№5)
  Write-Step "Сохранение старой версии целиком"
  Move-Item $App $appBackup
  $appSaved = $true
  Write-Ok "старая версия: $appBackup"

  # 4. Заливка нового Firefox (№4: проверка exit-кода)
  Write-Step "Заливка нового Firefox"
  robocopy $srcFull $App /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy упал с кодом $LASTEXITCODE (источник недоступен?)" }
  Write-Ok "залито (robocopy: $LASTEXITCODE)"

  # 5. Возврат наших файлов из сохранённой версии
  Write-Step "Возврат config.js / config-prefs.js / blade-defaults.js / policies.json"
  Copy-Item (Join-Path $appBackup 'config.js') $App -ErrorAction SilentlyContinue
  $prefDir = Join-Path $App 'defaults\pref'
  New-Item -ItemType Directory -Force -Path $prefDir | Out-Null
  Copy-Item (Join-Path $appBackup 'defaults\pref\config-prefs.js') $prefDir -ErrorAction SilentlyContinue
  Copy-Item (Join-Path $appBackup 'defaults\pref\blade-defaults.js') $prefDir -ErrorAction SilentlyContinue
  $distDir = Join-Path $App 'distribution'
  New-Item -ItemType Directory -Force -Path $distDir | Out-Null
  Copy-Item (Join-Path $appBackup 'distribution\policies.json') $distDir -ErrorAction SilentlyContinue
  Write-Ok "autoconfig, движковые дефолты и политики на месте"
  # crashreporter возвращается с новым движком — снова в утиль
  $cr = Join-Path $App 'crashreporter.exe'
  if (Test-Path $cr) { Remove-Item $cr -Force; Write-Ok "crashreporter.exe удалён" }

  # 6. Хирургия omni.ja
  Write-Step "Хирургия omni.ja (брендинг + чистка)"
  Add-Type -AssemblyName System.Drawing
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $omni = Join-Path $App 'browser\omni.ja'

  $brandFtl = [IO.File]::ReadAllBytes((Join-Path $Brand 'brand.ftl'))
  $brandProps = [IO.File]::ReadAllBytes((Join-Path $Brand 'brand.properties'))
  $docIco = [IO.File]::ReadAllBytes((Join-Path $Brand 'icon.ico'))
  $master = [System.Drawing.Image]::FromFile((Join-Path $Brand 'master_icon.png'))
  $m256 = New-Object System.Drawing.Bitmap($master, 256, 256)
  $ms256 = New-Object System.IO.MemoryStream
  $m256.Save($ms256, [System.Drawing.Imaging.ImageFormat]::Png)
  $masterPng256 = $ms256.ToArray()
  $wordmark = [Text.Encoding]::UTF8.GetBytes(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 359 80"><text x="4" y="66" font-family="Arial Black, Arial, sans-serif" font-size="66" font-weight="900" letter-spacing="10" fill="context-fill">BLADE</text></svg>')
  $b64 = [Convert]::ToBase64String($masterPng256)
  $svgLogo = [Text.Encoding]::UTF8.GetBytes(
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 256 256"><image width="256" height="256" xlink:href="data:image/png;base64,' + $b64 + '"/></svg>')

  function Resize-Blade([int]$w, [int]$h) {
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($master, 0, 0, $w, $h)
    $g.Dispose()
    $s = New-Object System.IO.MemoryStream
    $bmp.Save($s, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    return $s.ToArray()
  }

  $srcZip = [System.IO.Compression.ZipFile]::OpenRead($omni)
  # №8: уникальное имя — повторный запуск в ту же секунду не столкнётся
  $tmpOmni = Join-Path $env:TEMP ("blade-omni-{0}-{1}.ja" -f $stamp, [guid]::NewGuid().ToString('N').Substring(0,8))
  $outZip = [System.IO.Compression.ZipFile]::Open($tmpOmni, 'Create')
  $scrubCount = 0; $iconCount = 0
  foreach ($entry in $srcZip.Entries) {
    $name = $entry.FullName
    if ($name -like '*extra-themes-previews*') { continue }
    $data = $null
    if ($name -eq 'localization/en-US/branding/brand.ftl') {
      $data = $brandFtl
    } elseif ($name -eq 'chrome/en-US/locale/branding/brand.properties') {
      $data = $brandProps
    } elseif ($name -eq 'chrome/browser/content/branding/document.ico') {
      $data = $docIco
    } elseif ($name -eq 'chrome/browser/content/branding/about-logo.svg') {
      $data = $svgLogo
    } elseif ($name -eq 'chrome/browser/content/branding/about-wordmark.svg' -or
              $name -eq 'chrome/browser/content/branding/firefox-wordmark.svg') {
      $data = $wordmark
    } elseif ($name -match '^chrome/browser/content/branding/(icon(16|32|48|64|128)\.png|about(-logo.*)?\.png)$') {
      $s = $entry.Open()
      $img = [System.Drawing.Image]::FromStream($s)
      $w = $img.Width; $h = $img.Height
      $img.Dispose(); $s.Dispose()
      $data = Resize-Blade $w $h
      $iconCount++
    } else {
      $ms2 = New-Object System.IO.MemoryStream
      $s = $entry.Open(); $s.CopyTo($ms2); $s.Dispose()
      $bytes = $ms2.ToArray()
      if ($name -match '\.(ftl|properties|dtd)$') {
        # v3: value-only, иначе ломаются l10n-id (см. Apply-Blade-Omni v3).
        # Замены строго case-sensitive (.Replace, НЕ -replace) и только в значении:
        # .ftl/.properties — после первого '=', .dtd — внутри кавычек; строка
        # без '=' пропускается. URL-гард проверяется по ЗНАЧЕНИЮ.
        # Идентификаторы внутри .ftl-значения (data-l10n-name="...", { msg-id })
        # НЕ скраббятся — они обязаны совпадать с разметкой .xhtml и ключами
        # (например, helpus-shareFirefoxLink в aboutDialog).
        try {
          $text = [Text.Encoding]::UTF8.GetString($bytes)
          if ($text -cmatch 'Firefox') {
            $isDtd = $name -match '\.dtd$'
            $lines = $text -split "`n"
            $changed = $false
            for ($li = 0; $li -lt $lines.Count; $li++) {
              $ln = $lines[$li]
              if ($ln -cnotmatch 'Firefox') { continue }
              if ($isDtd) {
                $q1 = $ln.IndexOf('"'); $q2 = $ln.LastIndexOf('"')
                if ($q1 -lt 0 -or $q2 -le $q1) { continue }
                $val = $ln.Substring($q1 + 1, $q2 - $q1 - 1)
              } else {
                # v3.2: продолжение ftl-значения определяется ОТСТУПОМ, а не
                # отсутствием '=' (в продолжении бывает '=': data-l10n-name="...",
                # .attr = ...). Вся строка с отступом — значение. В .properties
                # многострочных значений практически нет — там пропуск.
                $isCont = ($ln -match '^\s+\S')
                if ($isCont) {
                  if ($name -cnotmatch '\.ftl$') { continue }
                  $val = $ln
                  $eq = -1
                } else {
                  $eq = $ln.IndexOf('=')
                  if ($eq -lt 0) { continue }
                  $val = $ln.Substring($eq + 1)
                }
              }
              if ($val -cmatch '://' -or $val -cmatch 'mozilla\.org' -or $val -cmatch 'firefox\.com') { continue }
              if ($isDtd) {
                $newVal = $val.Replace('Mozilla Firefox', 'Blade').Replace('Firefox', 'Blade')
              } else {
                $newVal = ''
                $pos = 0
                $prot = [regex]::Matches($val, 'data-l10n-name="[^"]*"|\{\s*[A-Za-z0-9][A-Za-z0-9-]*(?:\.[A-Za-z0-9-]+)?\s*\}')
                foreach ($pm in $prot) {
                  if ($pm.Index -gt $pos) { $newVal += $val.Substring($pos, $pm.Index - $pos).Replace('Mozilla Firefox', 'Blade').Replace('Firefox', 'Blade') }
                  $newVal += $pm.Value
                  $pos = $pm.Index + $pm.Length
                }
                if ($pos -lt $val.Length) { $newVal += $val.Substring($pos).Replace('Mozilla Firefox', 'Blade').Replace('Firefox', 'Blade') }
              }
              if ($newVal -ne $val) {
                if ($isDtd) {
                  $lines[$li] = $ln.Substring(0, $q1 + 1) + $newVal + $ln.Substring($q2)
                } elseif ($eq -ge 0) {
                  $lines[$li] = $ln.Substring(0, $eq + 1) + $newVal
                } else {
                  $lines[$li] = $newVal
                }
                $changed = $true
              }
            }
            if ($changed) {
              $bytes = [Text.Encoding]::UTF8.GetBytes(($lines -join "`n"))
              $scrubCount++
            }
          }
        } catch {}
      }
      $data = $bytes
    }
    $e = $outZip.CreateEntry($name, [System.IO.Compression.CompressionLevel]::Optimal)
    $os = $e.Open(); $os.Write($data, 0, $data.Length); $os.Dispose()
  }
  $outZip.Dispose(); $srcZip.Dispose()
  $master.Dispose(); $m256.Dispose()

  # №9: retry на залоченный omni.ja (антивирус и т.п.)
  $moved = $false
  for ($i = 1; $i -le 5; $i++) {
    try { Move-Item $tmpOmni $omni -Force; $moved = $true; break }
    catch { Start-Sleep -Seconds 2 }
  }
  if (-not $moved) { throw "omni.ja залочен (антивирус?) — не удалось заменить за 5 попыток" }
  Write-Ok "omni.ja: иконок $iconCount, текстов $scrubCount"

  # 7. Патч exe (№4: проверка exit-кода)
  Write-Step "Патч firefox.exe"
  & (Join-Path $Brand 'rcedit.exe') (Join-Path $App 'firefox.exe') `
    --set-icon (Join-Path $Brand 'icon.ico') `
    --set-version-string 'ProductName' 'Blade' `
    --set-version-string 'FileDescription' 'Blade Browser' `
    --set-version-string 'CompanyName' 'Blade-Creations' `
    --set-version-string 'LegalCopyright' 'Blade-Creations'
  if ($LASTEXITCODE -ne 0) { throw "rcedit упал (код $LASTEXITCODE) — exe залочен или не PE?" }
  Write-Ok "exe пропатчен"

  # 8. Стрип мусора
  Write-Step "Стрип мусора"
  $junk = @('default-browser-agent.exe','pingsender.exe','maintenanceservice.exe',
            'maintenanceservice_installer.exe','updater.exe','updater.ini','update-settings.ini',
            'firefox.VisualElementsManifest.xml','private_browsing.VisualElementsManifest.xml')
  foreach ($j in $junk) { Remove-Item (Join-Path $App $j) -Force -ErrorAction SilentlyContinue }
  Remove-Item "$App\*.sig" -Force -ErrorAction SilentlyContinue
  Remove-Item (Join-Path $App 'browser\VisualElements') -Recurse -Force -ErrorAction SilentlyContinue
  Write-Ok "мусор удалён"

  Write-Host ""
  Write-Host "Blade обновлён: $stamp" -ForegroundColor Magenta
  Write-Host "Старая версия целиком: $appBackup"
  Write-Host "Запускай Blade с ярлыка."
}
catch {
  Write-Host "ОШИБКА: $($_.Exception.Message)" -ForegroundColor Red
  if ($appSaved -and (Test-Path $appBackup)) {
    Write-Step "ОТКАТ: возвращаю старую версию целиком"
    if (Test-Path $App) { Remove-Item $App -Recurse -Force }
    Move-Item $appBackup $App
    Write-Ok "откат завершён — Blade в домассовом состоянии"
  }
  throw
}
