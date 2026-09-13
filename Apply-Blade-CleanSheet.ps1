# ============================================================================
# Apply-Blade-CleanSheet.ps1 — «Чистый Лист»: каталог выбора языков в движке.
# Фаза 8 роадмапа 2.0. Режет res/language.properties в КОРНЕВОМ omni.ja
# до трёх записей (en, en-us, ru) — диалог «добавить язык» в настройках
# показывает только английский и русский.
#
# Безопасность: у файла ЕСТЬ ровно один потребитель — диалог веб-языков
# (preferences/dialogs/languages.js/.xhtml, разведка Analyst 2026-09-13).
# Активные языки (intl.accept_languages) и ленгпаки НЕ зависят от файла.
# languageNames.ftl НЕ трогаем (спелчекер/нарратор его читают).
#
# Использование:
#   powershell -ExecutionPolicy Bypass -File Apply-Blade-CleanSheet.ps1
#   -AppDir <путь к движку>   (по умолчанию %LOCALAPPDATA%\Blade\App\Blade)
#   -DryRun                   (только отчёт)
# ============================================================================
param(
    [string]$AppDir = (Join-Path $env:LOCALAPPDATA 'Blade\App\Blade'),
    [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$omniRoot = Join-Path $AppDir 'omni.ja'
if (-not (Test-Path $omniRoot)) { throw "Нет архива: $omniRoot" }

# --- Гвард: нельзя патчить движок, ИЗ которого сейчас работает браузер ---
$running = @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
    Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($AppDir, [StringComparison]::OrdinalIgnoreCase) })
if ($running.Count -gt 0 -and -not $DryRun) {
    throw "Из этого движка запущен браузер (процессов: $($running.Count)) — закрой и повтори"
}

$KEEP = @('en', 'en-us', 'ru')   # каталог выбора: только эти языки остаются

Add-Type -AssemblyName System.IO.Compression.FileSystem

$src = [System.IO.Compression.ZipFile]::OpenRead($omniRoot)
$entry = $src.Entries | Where-Object { $_.FullName -eq 'res/language.properties' }
if (-not $entry) { $src.Dispose(); throw 'res/language.properties не найден в omni.ja' }
$reader = New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8, $true)
$text = $reader.ReadToEnd(); $reader.Close()
$src.Dispose()

$lines = $text -split "`r?`n"
$kept = New-Object System.Collections.Generic.List[string]
$removed = 0
foreach ($line in $lines) {
    if ($line -match '^([a-z]{2,3}(-[a-z0-9]+)?)\.accept\s*=') {
        $code = $Matches[1].ToLower()
        if ($KEEP -contains $code) { $kept.Add($line) } else { $removed++ }
    } else {
        # комментарии и прочее — сохраняем как есть
        $kept.Add($line)
    }
}
Write-Host ("Каталог языков: записей было {0}, вырезано {1}, осталось {2} (en, en-us, ru)" -f `
    (($lines | Where-Object { $_ -match '\.accept\s*=' }).Count), $removed, `
    (($kept | Where-Object { $_ -match '\.accept\s*=' }).Count))

if ($DryRun) { Write-Host 'DryRun: ничего не записано'; exit 0 }
if ($removed -eq 0) { Write-Host 'Изменений нет — уже чисто.'; exit 0 }

# Бэкап конвенцией проекта
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$bkDir = Join-Path $PSScriptRoot ("Backups\cleansheet-" + $stamp)
New-Item -ItemType Directory -Path $bkDir -Force | Out-Null
Copy-Item $omniRoot (Join-Path $bkDir 'root-omni.ja') -Force
Write-Host "бэкап: $bkDir\root-omni.ja"

$newText = ($kept -join "`r`n")
$newBytes = [System.Text.Encoding]::UTF8.GetBytes($newText)

# Перепаковка с сохранением порядка записей
$newOmni = $omniRoot + '.new'
$src2 = [System.IO.Compression.ZipFile]::OpenRead($omniRoot)
$out = [System.IO.Compression.ZipFile]::Open($newOmni, 'Create')
try {
    foreach ($e in $src2.Entries) {
        $ne = $out.CreateEntry($e.FullName, [System.IO.Compression.CompressionLevel]::Optimal)
        $st = $ne.Open()
        if ($e.FullName -eq 'res/language.properties') {
            $st.Write($newBytes, 0, $newBytes.Length)
        } else {
            $es = $e.Open(); $es.CopyTo($st); $es.Close()
        }
        $st.Close()
    }
} finally { $src2.Dispose(); $out.Dispose() }
Move-Item $newOmni $omniRoot -Force

# Верификация: перечитываем и считаем
$chk = [System.IO.Compression.ZipFile]::OpenRead($omniRoot)
$ce = $chk.Entries | Where-Object { $_.FullName -eq 'res/language.properties' }
$cr = New-Object System.IO.StreamReader($ce.Open(), [System.Text.Encoding]::UTF8, $true)
$ct = $cr.ReadToEnd(); $cr.Close()
$chk.Dispose()
$left = ([regex]::Matches($ct, '\.accept\s*=')).Count
Write-Host ("ВЕРИФИКАЦИЯ: в архиве осталось записей языков: {0} (ожидалось 3)" -f $left) -ForegroundColor $(if ($left -eq 3) { 'Green' } else { 'Yellow' })
Write-Host 'Готово. Профили: при желании почистить <профиль>\startupCache — кэш пересоздастся.' -ForegroundColor Green
