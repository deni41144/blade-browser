# ============================================================================
# Apply-Blade-CleanSheet.ps1 — «Чистый Лист»: все языковые поверхности движка.
# Фаза 8 роадмапа 2.0.
#
# PASS 1 (root omni):    res/language.properties — каталог веб-языков 287 → 3
#                        (en, en-us, ru). Потребитель — только диалог добавления
#                        веб-языков (разведка Analyst 2026-09-13).
# PASS 2 (browser omni): defaults/settings/main/language-dictionaries.json —
#                        каталог словарей орфографии 80 → 2 (en-US, ru).
# PASS 3 (browser omni): defaults/preferences/firefox.js — URL списка ленгпаков
#                        (services.addons.mozilla.org/api/v4/addons/language-tools)
#                        → about:blank. Диалог «язык интерфейса» перестаёт
#                        приносить живую простыню языков из магазина; обновления
#                        расширений НЕ задеты (versioncheck.addons — другой хост).
#
# НЕ ТРОГАЕМ: languageNames.ftl (имена для спелчекера/нарратора),
# browser.dictionaries.download.url (веб-страница, а не список),
# переводы/ленгпак-механику перевода страниц (translation — отдельный мир).
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

$omniRoot    = Join-Path $AppDir 'omni.ja'
$omniBrowser = Join-Path $AppDir 'browser\omni.ja'
foreach ($p in @($omniRoot, $omniBrowser)) {
    if (-not (Test-Path $p)) { throw "Нет архива: $p" }
}

# --- Гвард: нельзя патчить движок, ИЗ которого сейчас работает браузер ---
$running = @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
    Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($AppDir, [StringComparison]::OrdinalIgnoreCase) })
if ($running.Count -gt 0 -and -not $DryRun) {
    throw "Из этого движка запущен браузер (процессов: $($running.Count)) — закрой и повтори"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

# --- Общий механизм: патч набора записей архива с сохранением порядка --------
function Patch-Omni([string]$OmniPath, [string]$Label, [hashtable]$Patches, [string]$BackupName) {
    if ($Patches.Count -eq 0) { Write-Host "=== $Label : изменений нет"; return }
    Write-Host "=== $Label : перешиваю $($Patches.Count) записей" -ForegroundColor Cyan

    if (-not $DryRun) {
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $bkDir = Join-Path $PSScriptRoot ("Backups\cleansheet-" + $stamp)
        New-Item -ItemType Directory -Path $bkDir -Force | Out-Null
        Copy-Item $OmniPath (Join-Path $bkDir $BackupName) -Force
        Write-Host "  бэкап: $bkDir\$BackupName"
    }

    $newOmni = $OmniPath + '.new'
    $src = [System.IO.Compression.ZipFile]::OpenRead($OmniPath)
    $out = [System.IO.Compression.ZipFile]::Open($newOmni, 'Create')
    try {
        foreach ($e in $src.Entries) {
            $ne = $out.CreateEntry($e.FullName, [System.IO.Compression.CompressionLevel]::Optimal)
            $st = $ne.Open()
            if ($Patches.ContainsKey($e.FullName)) {
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($Patches[$e.FullName])
                $st.Write($bytes, 0, $bytes.Length)
            } else {
                $es = $e.Open(); $es.CopyTo($st); $es.Close()
            }
            $st.Close()
        }
    } finally { $src.Dispose(); $out.Dispose() }
    if ($DryRun) { Remove-Item $newOmni -Force } else { Move-Item $newOmni $OmniPath -Force }
}

function Read-Entry([string]$OmniPath, [string]$EntryName) {
    $z = [System.IO.Compression.ZipFile]::OpenRead($OmniPath)
    try {
        $e = $z.Entries | Where-Object { $_.FullName -eq $EntryName }
        if (-not $e) { return $null }
        $r = New-Object System.IO.StreamReader($e.Open(), [System.Text.Encoding]::UTF8, $true)
        $t = $r.ReadToEnd(); $r.Close()
        return $t
    } finally { $z.Dispose() }
}

# --- PASS 1: каталог веб-языков (root omni) ----------------------------------
$KEEP_WEB = @('en', 'en-us', 'ru')
$p1 = @{}
$langProps = Read-Entry $omniRoot 'res/language.properties'
if ($null -ne $langProps) {
    $lines = $langProps -split "`r?`n"
    $kept = New-Object System.Collections.Generic.List[string]
    $removed = 0
    foreach ($line in $lines) {
        if ($line -match '^([a-z]{2,3}(-[a-z0-9]+)?)\.accept\s*=') {
            if ($KEEP_WEB -contains $Matches[1].ToLower()) { $kept.Add($line) } else { $removed++ }
        } else { $kept.Add($line) }
    }
    $stayCount = @($kept | Where-Object { $_ -match '\.accept\s*=' }).Count
    Write-Host ("PASS 1 каталог веб-языков: было {0}, вырезано {1}, осталось {2}" -f `
        @($lines | Where-Object { $_ -match '\.accept\s*=' }).Count, $removed, $stayCount)
    if ($removed -gt 0) { $p1['res/language.properties'] = ($kept -join "`r`n") }
}
Patch-Omni $omniRoot 'PASS 1 root omni' $p1 'root-omni.ja'

# --- PASS 2+3: словари и ленгпак-API (browser omni) --------------------------
$brPatches = @{}

# PASS 2: language-dictionaries.json → записи id=en-US и id=ru
$KEEP_DICT = @('en-US', 'ru')
$dictJson = Read-Entry $omniBrowser 'defaults/settings/main/language-dictionaries.json'
if ($null -ne $dictJson) {
    try {
        $obj = $dictJson | ConvertFrom-Json
        $before = @($obj.data).Count
        $obj.data = @($obj.data | Where-Object { $KEEP_DICT -contains $_.id })
        $after = @($obj.data).Count
        Write-Host ("PASS 2 каталог словарей: было {0}, осталось {1} (en-US, ru)" -f $before, $after)
        if ($after -lt $before) {
            $brPatches['defaults/settings/main/language-dictionaries.json'] = ($obj | ConvertTo-Json -Depth 10 -Compress)
        }
    } catch { Write-Host "PASS 2: JSON не разобрался — пропускаю ($_)".Trim() -ForegroundColor Yellow }
}

# PASS 3: URL списка ленгпаков в firefox.js → about:blank
$ffJs = Read-Entry $omniBrowser 'defaults/preferences/firefox.js'
if ($null -ne $ffJs) {
    $rx = [regex]'https://services\.addons\.mozilla\.org/api/v4/addons/language-tools/[^"'']*'
    $hits = $rx.Matches($ffJs).Count
    if ($hits -gt 0) {
        $newJs = $rx.Replace($ffJs, 'about:blank')
        Write-Host ("PASS 3 ленгпак-API: {0} URL нейтрализовано (обновления расширений не задеты)" -f $hits)
        $brPatches['defaults/preferences/firefox.js'] = $newJs
    } else {
        Write-Host 'PASS 3 ленгпак-API: URL не найден (уже чисто)'
    }
}
Patch-Omni $omniBrowser 'PASS 2+3 browser omni' $brPatches 'browser-omni.ja'

# --- Верификация ---------------------------------------------------------------
$langCheck = Read-Entry $omniRoot 'res/language.properties'
if ($null -ne $langCheck) {
    $n = ([regex]::Matches($langCheck, '\.accept\s*=')).Count
    Write-Host ("ВЕРИФИКАЦИЯ каталог веб-языков: {0} (ожидалось 3)" -f $n) -ForegroundColor $(if ($n -eq 3) { 'Green' } else { 'Yellow' })
}
$dictCheck = Read-Entry $omniBrowser 'defaults/settings/main/language-dictionaries.json'
if ($null -ne $dictCheck) {
    try {
        $ids = @((($dictCheck | ConvertFrom-Json).data).id)
        Write-Host ("ВЕРИФИКАЦИЯ каталог словарей: {0} записей → {1}" -f $ids.Count, ($ids -join ', ')) -ForegroundColor $(if ($ids.Count -le 2) { 'Green' } else { 'Yellow' })
    } catch {}
}
$ffCheck = Read-Entry $omniBrowser 'defaults/preferences/firefox.js'
if ($null -ne $ffCheck) {
    # считаем только API ленгпаков; веб-страница словарей (browser.dictionaries.
    # download.url) сознательно остаётся живой — это ссылка, а не список
    $alive = ([regex]::Matches($ffCheck, 'services\.addons\.mozilla\.org/api/v4/addons/language-tools')).Count
    Write-Host ("ВЕРИФИКАЦИЯ ленгпак-API: живых API-URL {0} (ожидалось 0; веб-страница словарей жива намеренно)" -f $alive) -ForegroundColor $(if ($alive -eq 0) { 'Green' } else { 'Yellow' })
}
Write-Host 'Готово. При желании почистить <профиль>\startupCache — кэш пересоздастся.' -ForegroundColor Green
