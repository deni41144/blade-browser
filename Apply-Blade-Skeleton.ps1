# ============================================================================
# Apply-Blade-Skeleton.ps1 — скелетная хирургия: физическое отключение
# телефонов Mozilla в движке (omni.ja). Фаза 7-C роадмапа 2.0 «Переплавка».
#
# Техника: value-only замена URL-литералов (https://host/path -> about:blank)
# в .js/.sys.mjs/.jsm/.json/.ftl внутри ОБЕИХ omni.ja. Телефон невозможен
# физически: слать некуда, даже если кто-то включит забытый преф.
#
# ЗАЩИЩЁННЫЙ СПИСОК (никогда не трогаем — безопасность друзей):
#   firefox.settings.services.mozilla.com — Remote Settings (блоклисты сертов)
#   safebrowsing.* (Google)               — антифишинг
#   addons.mozilla.org                    — магазин дополнений и их обновления
#
# Использование:
#   powershell -ExecutionPolicy Bypass -File Apply-Blade-Skeleton.ps1
#   -AppDir <путь к движку>   (по умолчанию %LOCALAPPDATA%\Blade\App\Blade)
#   -DryRun                   (только отчёт, файлы не трогать)
# ============================================================================
param(
    [string]$AppDir = (Join-Path $env:LOCALAPPDATA 'Blade\App\Blade'),
    [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$omniBrowser = Join-Path $AppDir 'browser\omni.ja'
$omniRoot    = Join-Path $AppDir 'omni.ja'
foreach ($p in @($omniBrowser, $omniRoot)) {
    if (-not (Test-Path $p)) { throw "Нет архива: $p" }
}

# --- Гвард: нельзя патчить движок, ИЗ которого сейчас работает браузер ---
$running = @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
    Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($AppDir, [StringComparison]::OrdinalIgnoreCase) })
if ($running.Count -gt 0 -and -not $DryRun) {
    throw "Из этого движка запущен браузер (процессов: $($running.Count)) — закрой и повтори"
}

# --- Список на срез: хост -> регэксп полного URL-литерала ---
# (схема + хост + путь до закрывающей кавычки/пробела/скобки)
$cutHosts = @(
    'telemetry.mozilla.org',
    'incoming.telemetry.mozilla.org',
    'aus5.mozilla.org',
    'contile.services.mozilla.com',
    'push.services.mozilla.com',
    'location.services.mozilla.com',
    'accounts.firefox.com',
    'monitor.firefox.com',
    'getpocket.com',
    'detectportal.firefox.com',
    # фаза 8 (разведка AI): эндпоинты Smart Window / ML-хаба / merino
    'mlpa-prod-prod-mozilla.freetls.fastly.net',
    'merino.services.mozilla.com',
    'model-hub.mozilla.org'
)
# --- Защищённые: их присутствие после операции ПРОВЕРЯЕМ отдельно ---
$protectedHosts = @(
    'firefox.settings.services.mozilla.com',
    'addons.mozilla.org',
    'safebrowsing.googleapis.com'
)

function Build-CutRegexes() {
    $map = @()
    foreach ($h in $cutHosts) {
        $escaped = [regex]::Escape($h)
        # полный URL: схема (http/https/wss — push ходит по wss, detectportal по http)
        # + (что угодно.)хост + путь до кавычки/пробела/скобки
        $map += [pscustomobject]@{
            Host  = $h
            Regex = New-Object System.Text.RegularExpressions.Regex(
                ("(https?|wss)\:\/\/[a-zA-Z0-9\.\-]*" + $escaped + "[^""'\s\)\,\}]*"),
                [System.Text.RegularExpressions.RegexOptions]::Compiled)
        }
    }
    return $map
}
$cutRegexes = Build-CutRegexes

function Patch-Text([string]$Text, [string]$RelPath, [hashtable]$Stats) {
    $result = $Text
    foreach ($cr in $cutRegexes) {
        $matches = $cr.Regex.Matches($result)
        if ($matches.Count -gt 0) {
            $result = $cr.Regex.Replace($result, 'about:blank')
            $Stats[$cr.Host] = $Stats[$cr.Host] + $matches.Count
            $Stats['_files'] = $Stats['_files'] + 1
        }
    }
    return $result
}

# Возвращает архив как словарь путь->байты с патчами (или без, при DryRun)
function Process-Omni([string]$OmniPath, [string]$Label, [hashtable]$Stats) {
    Write-Host "=== $Label : $OmniPath" -ForegroundColor Cyan
    $src = [System.IO.Compression.ZipFile]::OpenRead($OmniPath)
    $patched = @{}   # имя записи -> новые байты (только изменённые)
    try {
        foreach ($entry in $src.Entries) {
            $rel = $entry.FullName -replace '/', '\'
            if ($entry.FullName -notmatch '\.(js|mjs|json|ftl|properties)$') { continue }
            if ($entry.FullName -match '\.(png|jpg|webp|svg|gif|ico)$') { continue }
            $reader = New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8, $true)
            $text = $reader.ReadToEnd(); $reader.Close()
            $newText = Patch-Text $text $entry.FullName $Stats
            if ($newText -ne $text) {
                $patched[$entry.FullName] = [System.Text.Encoding]::UTF8.GetBytes($newText)
                Write-Host ("  [CUT] " + $entry.FullName) -ForegroundColor Yellow
                if ($DryRun) { continue }
            }
        }
    } finally { $src.Dispose() }

    if ($DryRun -or $patched.Count -eq 0) {
        Write-Host ("  " + $(if ($DryRun) { 'DryRun: ничего не записано' } else { 'изменений нет' })) -ForegroundColor DarkGray
        return
    }

    # Бэкап конвенцией проекта: Backups\skeleton-<timestamp>\
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $bkDir = Join-Path $PSScriptRoot ("Backups\skeleton-" + $stamp)
    New-Item -ItemType Directory -Path $bkDir -Force | Out-Null
    $bkName = if ($OmniPath -like '*browser*') { 'browser-omni.ja' } else { 'root-omni.ja' }
    Copy-Item $OmniPath (Join-Path $bkDir $bkName) -Force
    Write-Host "  бэкап: $bkDir\$bkName"

    # Перепаковка: порядок записей исходного архива, изменённые — из памяти
    $tmp = Join-Path $env:TEMP ("blade-skeleton-" + [guid]::NewGuid().ToString('N'))
    $newOmni = $OmniPath + '.new'
    $src2 = [System.IO.Compression.ZipFile]::OpenRead($OmniPath)
    $out = [System.IO.Compression.ZipFile]::Open($newOmni, 'Create')
    try {
        foreach ($entry in $src2.Entries) {
            $newEntry = $out.CreateEntry($entry.FullName, [System.IO.Compression.CompressionLevel]::Optimal)
            $stream = $newEntry.Open()
            if ($patched.ContainsKey($entry.FullName)) {
                $bytes = $patched[$entry.FullName]
                $stream.Write($bytes, 0, $bytes.Length)
            } else {
                $es = $entry.Open()
                $es.CopyTo($stream)
                $es.Close()
            }
            $stream.Close()
        }
    } finally { $src2.Dispose(); $out.Dispose() }
    Move-Item $newOmni $OmniPath -Force
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host ("  ЗАПИСАНО: " + $patched.Count + " файлов перешито") -ForegroundColor Green
}

function Verify-Omni([string]$OmniPath, [string]$Label) {
    Write-Host "=== VERIFY $Label" -ForegroundColor Cyan
    $fail = $false
    $z = [System.IO.Compression.ZipFile]::OpenRead($OmniPath)
    $allText = New-Object System.Text.StringBuilder
    try {
        foreach ($entry in $z.Entries) {
            if ($entry.FullName -notmatch '\.(js|mjs|json|ftl|properties)$') { continue }
            $reader = New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8, $true)
            [void]$allText.AppendLine($reader.ReadToEnd())
            $reader.Close()
        }
    } finally { $z.Dispose() }
    $text = $allText.ToString()
    foreach ($h in $cutHosts) {
        $left = ([regex]::Matches($text, [regex]::Escape($h))).Count
        if ($left -gt 0) {
            Write-Host ("  [ОСТАЛОСЬ] " + $h + " : " + $left + " упоминаний (без схемы — тексты/комментарии, URL-литералов см. отчёт выше)") -ForegroundColor Yellow
        } else {
            Write-Host ("  [ЧИСТО] " + $h) -ForegroundColor Green
        }
    }
    foreach ($h in $protectedHosts) {
        $left = ([regex]::Matches($text, [regex]::Escape($h))).Count
        if ($left -gt 0) { Write-Host ("  [ЗАЩИТА ОК] " + $h + " : " + $left + " упоминаний сохранено") -ForegroundColor Green }
        else { Write-Host ("  [ВНИМАНИЕ] " + $h + " отсутствовал и до операции") -ForegroundColor DarkGray }
    }
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

$stats = @{}
foreach ($h in ($cutHosts + @('_files'))) { $stats[$h] = 0 }

Write-Host 'СУХОЙ ПРОГОН (DryRun) — только отчёт' -ForegroundColor $(if ($DryRun) { 'Green' } else { 'DarkGray' })
Process-Omni $omniBrowser 'BROWSER omni.ja' $stats
Process-Omni $omniRoot    'ROOT omni.ja'    $stats

Write-Host ''
Write-Host '=== ИТОГО ЗАМЕН:' -ForegroundColor Cyan
foreach ($h in $cutHosts) { if ($stats[$h] -gt 0) { Write-Host ("  " + $h + " : " + $stats[$h] + " URL") } }

if (-not $DryRun) {
    Verify-Omni $omniBrowser 'BROWSER omni.ja'
    Verify-Omni $omniRoot    'ROOT omni.ja'
    Write-Host ''
    Write-Host 'Скелет применён. Перезапусти браузер.' -ForegroundColor Green
}
