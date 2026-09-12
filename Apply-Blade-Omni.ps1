# ============================================================================
# Apply-Blade-Omni.ps1 — глубокая брендинг-хирургия движка Blade (v3).
#
# ЗАЧЕМ: после Update-Blade.ps1 архивы снова стоковые, а старый построчный
# скраббер (v2: case-INSENSITIVE -replace 'Firefox','Blade' по всей строке)
# ПОВРЕДИЛ l10n: ~205 ключей и термов Fluent переименованы
# (firefoxview-* -> Bladeview-*), 67 data-l10n-id осиротели — Firefox View,
# сайдбары, категории настроек, about:debugging показывают пустые строки.
#
# v3, проходы по browser\omni.ja (порядок важен — СНАЧАЛА РЕМОНТ, потом скраб):
#   PASS A — РЕМОНТ (.ftl/.properties/.dtd), только позиции ключей/ссылок:
#           идентификатор до '='            'Blade' -> 'Firefox'/'firefox' по
#                                           контексту: camelCase-ключи вроде
#                                           policy-DisableFirefoxAccounts1
#                                           (их так зовут JS и policies-schema.json)
#                                           восстанавливаются с большой F,
#                                           kebab-ключи — со строчной 'firefox';
#           термы                           { -Blade... } -> { -firefox... };
#           ссылки на сообщения             { msg-Blade-id } -> { msg-firefox-id };
#           data-l10n-name="...Blade..."    -> "...firefox...".
#           Значения не трогаются — легитимный «Blade» в значениях остаётся.
#   PASS B — VALUE-ONLY скраб (.ftl/.properties/.dtd): замены ТОЛЬКО в значении
#           (после первого '=', в .dtd — внутри кавычек), case-SENSITIVE
#           ('Mozilla Firefox' -> 'Blade', затем 'Firefox' -> 'Blade';
#           только [string]::Replace — НЕ -replace, он case-insensitive и
#           ломает ключи!). URL-гард: '://', mozilla.org, firefox.com.
#           В .ftl идентификаторы внутри значения — data-l10n-name="..." и
#           чистые ссылки { msg-id } — НЕ скраббятся: они обязаны совпадать
#           с нетронутой разметкой .xhtml и ключами (helpus-shareFirefoxLink).
#   PASS C — литералы в коде (.js/.mjs/.sys.mjs/.jsx): 'Firefox' -> 'Blade'
#           только внутри однострочных литералов "..." / '...' и только
#           фразовым паттерном (не приклеен к идентификаторным символам —
#           защищает FirefoxLabs, Firefox/99.0, Software\Mozilla\Firefox).
#   PASS D — JSON по белому списку путей архива: builtin-themes/*/manifest.json
#           (только "name"), defaults/settings/main/devtools-compatibility-
#           browsers.json ("name"), ai-window-prompts.json (текстовые значения).
#
# Плюс:
#   2. КОРНЕВОЙ omni.ja (раньше вообще не трогался): value-only скраб
#      .ftl/.properties/.dtd из localization/ и */locale/ (ремонт не нужен —
#      корень не скраббился), остальные записи — байт-в-байт, порядок записей
#      и первый entry сохраняются (aboutAddons/Telemetry, toolkit brandings).
#   3. distribution\distribution.ini: about=Blade, [BookmarksToolbar] ->
#      закладка Blade Browser вместо PortableApps.com.
#   4. снос crashreporter.exe (возвращается с обновлением движка).
#
# Запуск: powershell -ExecutionPolicy Bypass -File Apply-Blade-Omni.ps1 [-DryRun]
#   -DryRun — все трансформации над копиями в %TEMP%\blade-omni-dryrun,
#             установленные файлы НЕ трогаются, в конце — детальный отчёт.
# Изменения подхватываются при следующем запуске браузера.
# ============================================================================
param(
    [string]$AppDir = (Join-Path $env:LOCALAPPDATA 'Blade\App\Blade'),
    [switch]$DryRun
)
$ErrorActionPreference = 'Stop'

$omniBrowser = Join-Path $AppDir 'browser\omni.ja'
$omniRoot    = Join-Path $AppDir 'omni.ja'
$distIni     = Join-Path $AppDir 'distribution\distribution.ini'
foreach ($req in @($omniBrowser, $omniRoot, $distIni)) {
    if (-not (Test-Path $req)) { throw "Нет файла: $req" }
}
$appFull = (Resolve-Path $AppDir).Path

# --- 0. Живой браузер держит архивы — подменять нельзя ---
# DryRun только читает живые файлы (копирует их), поэтому при запущенном
# браузере ругаемся, но продолжаем; боевой прогон — без вариантов.
$running = @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
    Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($appFull, [StringComparison]::OrdinalIgnoreCase) })
if ($running.Count -gt 0) {
    if ($DryRun) {
        Write-Host "ВНИМАНИЕ: Blade запущен ($($running.Count) proc) — DryRun читает живые файлы, это безопасно" -ForegroundColor Yellow
    } else {
        throw "Закрой Blade и перезапусти скрипт (запущено процессов: $($running.Count))"
    }
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$backups = Join-Path $PSScriptRoot 'Backups'

if ($DryRun) {
    # Все трансформации — над копиями; живая установка не трогается.
    $dryDir = Join-Path $env:TEMP 'blade-omni-dryrun'
    if (Test-Path $dryDir) { Remove-Item $dryDir -Recurse -Force }
    New-Item -ItemType Directory -Path $dryDir -Force | Out-Null
    Copy-Item $omniBrowser (Join-Path $dryDir 'browser-omni.ja')
    Copy-Item $omniRoot    (Join-Path $dryDir 'root-omni.ja')
    Copy-Item $distIni     (Join-Path $dryDir 'distribution.ini')
    $omniBrowser = Join-Path $dryDir 'browser-omni.ja'
    $omniRoot    = Join-Path $dryDir 'root-omni.ja'
    $distIni     = Join-Path $dryDir 'distribution.ini'
    $backups     = $dryDir   # бэкапы сухого прогона не мусорят в Backups\
} else {
    New-Item -ItemType Directory -Path $backups -Force | Out-Null
}

Write-Host '=== BLADE OMNI SURGERY v3 ==='
if ($DryRun) { Write-Host "*** DRYRUN: работаю над копиями в $dryDir ***" -ForegroundColor Yellow }

# --- Метрики и примеры для отчёта ---
$RepairExamples  = New-Object System.Collections.Generic.List[string]
$LiteralExamples = New-Object System.Collections.Generic.List[string]
$M = [ordered]@{
    RepairKeys  = 0; RepairFiles  = 0
    ValueScrub  = 0
    Literals    = 0; LiteralFiles = 0
    JsonScrub   = 0
    RootScrub   = 0; RootFiles    = 0
    RepairedIds = New-Object System.Collections.Generic.HashSet[string]
}

# Фразовый паттерн (PASS C/D): 'Firefox' не приклеен к идентификаторным
# символам — защищает FirefoxConversionNotification, Firefox/99.0,
# Software\Mozilla\Firefox, а также regex-альтернаты вида UCBrowser|Firefox|...
# (нижний регистр и так не матчится, замены case-чувствительные).
$FxPhrase = '(?<![A-Za-z0-9_.\\\/|-])Firefox(?![A-Za-z0-9_.\\\/|-])'
# Однострочные строковые литералы "..." и '...'
$LitRe = '"[^"\r\n]*"|''[^''\r\n]*'''

# Value-замена (PASS B/C/D): case-SENSITIVE, URL-гард по самому значению.
# -Phrase — фразовый паттерн PASS C/D; без него прямая замена 'Firefox' (PASS B).
# Возвращает [pscustomobject]@{ Text; Count } ($null-текст не бывает).
function ConvertTo-BladeValue {
    param([string]$Value, [switch]$Phrase)
    if ([regex]::IsMatch($Value, '(?i)://|mozilla\.org|firefox\.com')) {
        return [pscustomobject]@{ Text = $Value; Count = 0 }
    }
    $v = $Value; $cnt = 0
    $mf = [regex]::Matches($v, 'Mozilla Firefox').Count
    if ($mf -gt 0) { $v = $v.Replace('Mozilla Firefox', 'Blade'); $cnt += $mf }
    if ($Phrase) {
        $f = [regex]::Matches($v, $script:FxPhrase).Count
        if ($f -gt 0) { $v = [regex]::Replace($v, $script:FxPhrase, 'Blade'); $cnt += $f }
    } else {
        $f = [regex]::Matches($v, 'Firefox').Count
        if ($f -gt 0) { $v = $v.Replace('Firefox', 'Blade'); $cnt += $f }
    }
    [pscustomobject]@{ Text = $v; Count = $cnt }
}

# Value-скраб для .ftl с защитой идентификаторов: data-l10n-name="..." и чистые
# ссылки { msg-id } / { msg-id.attr } не скраббятся — это идентификаторы, они
# обязаны совпадать с нетронутой разметкой .xhtml и l10n-ключами
# (пример: helpus-shareFirefoxLink — скраббинг возвращал ему 'Blade' и ломал оверлей).
function ConvertTo-BladeFtlValue {
    param([string]$Value)
    $prot = [regex]::Matches($Value, 'data-l10n-name="[^"]*"|\{\s*[A-Za-z0-9][A-Za-z0-9-]*(?:\.[A-Za-z0-9-]+)?\s*\}')
    if ($prot.Count -eq 0) { return ConvertTo-BladeValue $Value }
    $sb = New-Object System.Text.StringBuilder
    $pos = 0; $cnt = 0
    foreach ($m in $prot) {
        if ($m.Index -gt $pos) {
            $scr = ConvertTo-BladeValue $Value.Substring($pos, $m.Index - $pos)
            [void]$sb.Append($scr.Text); $cnt += $scr.Count
        }
        [void]$sb.Append($m.Value)
        $pos = $m.Index + $m.Length
    }
    if ($pos -lt $Value.Length) {
        $scr = ConvertTo-BladeValue $Value.Substring($pos)
        [void]$sb.Append($scr.Text); $cnt += $scr.Count
    }
    [pscustomobject]@{ Text = $sb.ToString(); Count = $cnt }
}

# Ремонт идентификатора (PASS A): 'Blade' -> 'Firefox'/'firefox' по контексту.
# Старый case-insensitive скраббер порезал и camelCase-ключи: policy-DisableFirefoxAccounts1
# -> policy-DisableBladeAccounts1; JS/policies-schema.json зовут их с большой F.
# Правило: 'Blade', приклеенный к строчной букве/цифре слева или к большой
# букве справа (CamelCase) -> 'Firefox'; иначе (kebab: Bladeview-..., -Blade-) -> 'firefox'.
function Repair-BladeIdentifier {
    param([string]$Id)
    $r = [regex]::Replace($Id, '(?<=[a-z0-9])Blade', 'Firefox')
    $r = [regex]::Replace($r, 'Blade(?=[A-Z])', 'Firefox')
    return $r.Replace('Blade', 'firefox')
}

# PASS A: ремонт ссылок в .ftl (значение ИЛИ строка-продолжение без '='):
# термы { -Blade... }, чистые ссылки { msg-Blade-id }, data-l10n-name="...".
# Возвращает [pscustomobject]@{ Text; Count }.
function Repair-BladeFtlRefs {
    param([string]$Text)
    $repair = 0
    # термы { -Blade... } -> { -firefox...
    $t = [regex]::Matches($Text, '\{ -Blade|\{-Blade').Count
    if ($t -gt 0) {
        $Text = $Text.Replace('{ -Blade', '{ -firefox').Replace('{-Blade', '{-firefox')
        $repair += $t
    }
    # ссылки на сообщения { msg-Blade-id } / { msg-Blade-id.attr }
    # (строгий паттерн «только идентификатор в скобках» — селекторы с
    # текстом и переменные { $x } не матчатся и не трогаются)
    $mr = [regex]::Matches($Text, '\{\s*[A-Za-z0-9][A-Za-z0-9-]*(?:\.[A-Za-z0-9-]+)?\s*\}')
    for ($k = $mr.Count - 1; $k -ge 0; $k--) {
        if ($mr[$k].Value.Contains('Blade')) {
            $rep = Repair-BladeIdentifier $mr[$k].Value
            $Text = $Text.Remove($mr[$k].Index, $mr[$k].Length).Insert($mr[$k].Index, $rep)
            $repair++
        }
    }
    # data-l10n-name="...Blade..." -> "...firefox..." (только внутри кавычек)
    $dl = [regex]::Matches($Text, 'data-l10n-name="[^"]*"')
    for ($k = $dl.Count - 1; $k -ge 0; $k--) {
        if ($dl[$k].Value.Contains('Blade')) {
            $rep = Repair-BladeIdentifier $dl[$k].Value
            $Text = $Text.Remove($dl[$k].Index, $dl[$k].Length).Insert($dl[$k].Index, $rep)
            $repair++
        }
    }
    [pscustomobject]@{ Text = $Text; Count = $repair }
}

# PASS A + PASS B для .ftl: PASS A чинит ссылки на всех строках (в т.ч.
# продолжениях многострочных значений без '='), PASS B скраббит только
# строки с '=' и только значение после первого '='.
function Invoke-FtlSurgery {
    param([string]$Text, [string]$RelPath)
    $repair = 0; $scrub = 0
    $ex  = New-Object System.Collections.Generic.List[string]
    $ids = New-Object System.Collections.Generic.List[string]
    $lines = $Text -split "`n"
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        # Дискриминатор продолжения — ОТСТУП, а не наличие '=': в продолжении
        # может быть '=' (data-l10n-name="...", .attr = ...), а строка сообщения
        # всегда стоит в колонке 0 (спека Fluent).
        $isCont = ($line -match '^\s+\S')
        $eq = if ($isCont) { -1 } else { $line.IndexOf('=') }
        if ($isCont -or $eq -lt 0) {
            # Продолжение — вся строка значение: ремонт ссылок + value-скраб.
            # Строка в колонке 0 без '=' (комментарий/секция) — только ремонт.
            $r = Repair-BladeFtlRefs $line
            if ($r.Count -gt 0) { $line = $r.Text; $repair += $r.Count }
            if ($isCont) {
                $scr = ConvertTo-BladeFtlValue $line
                if ($scr.Count -gt 0) { $line = $scr.Text; $scrub += $scr.Count }
            }
            $lines[$i] = $line
            continue
        }
        $left  = $line.Substring(0, $eq)
        $right = $line.Substring($eq + 1)
        # PASS A: идентификатор до '=' (сообщения и термы), контекстный ремонт
        $idm = [regex]::Match($left, '^(\s*)(-?[A-Za-z0-9][A-Za-z0-9-]*)\s*$')
        if ($idm.Success -and $idm.Groups[2].Value.Contains('Blade')) {
            $oldId = $idm.Groups[2].Value
            $newId = Repair-BladeIdentifier $oldId
            $left = $idm.Groups[1].Value + $newId
            $repair++
            $ex.Add("$oldId -> $newId ($RelPath)")
            $ids.Add($newId)
        }
        # PASS A: ссылки в значении
        $r = Repair-BladeFtlRefs $right
        if ($r.Count -gt 0) { $right = $r.Text; $repair += $r.Count }
        # PASS B: value-only скраб (case-sensitive, URL-гард; идентификаторы в
        # значении защищены — см. ConvertTo-BladeFtlValue)
        $scr = ConvertTo-BladeFtlValue $right
        if ($scr.Count -gt 0) { $right = $scr.Text; $scrub += $scr.Count }
        $lines[$i] = $left + '=' + $right
    }
    [pscustomobject]@{ Text = ($lines -join "`n"); Repair = $repair; Scrub = $scrub; Examples = $ex; Ids = $ids }
}

# PASS A + PASS B для .properties: ключ до первого '=', значение — после.
function Invoke-PropertiesSurgery {
    param([string]$Text, [string]$RelPath)
    $repair = 0; $scrub = 0
    $ex  = New-Object System.Collections.Generic.List[string]
    $ids = New-Object System.Collections.Generic.List[string]
    $lines = $Text -split "`n"
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        $eq = $line.IndexOf('=')
        if ($eq -lt 0) { continue }
        $left  = $line.Substring(0, $eq)
        $right = $line.Substring($eq + 1)
        $km = [regex]::Match($left, '^([A-Za-z0-9._-]+)\s*$')
        if ($km.Success -and $km.Groups[1].Value.Contains('Blade')) {
            $oldKey = $km.Groups[1].Value
            $newKey = Repair-BladeIdentifier $oldKey
            $left = $newKey
            $repair++
            $ex.Add("$oldKey -> $newKey ($RelPath)")
            $ids.Add($newKey)
        }
        $scr = ConvertTo-BladeValue $right
        if ($scr.Count -gt 0) { $right = $scr.Text; $scrub += $scr.Count }
        $lines[$i] = $left + '=' + $right
    }
    [pscustomobject]@{ Text = ($lines -join "`n"); Repair = $repair; Scrub = $scrub; Examples = $ex; Ids = $ids }
}

# PASS A + PASS B для .dtd: имя entity, значение — между первой и последней кавычкой.
function Invoke-DtdSurgery {
    param([string]$Text, [string]$RelPath)
    $repair = 0; $scrub = 0
    $ex  = New-Object System.Collections.Generic.List[string]
    $ids = New-Object System.Collections.Generic.List[string]
    $lines = $Text -split "`n"
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        # PASS A: имя entity
        $em = [regex]::Match($line, '^(<!ENTITY\s+)([A-Za-z0-9._-]+)(\s+")')
        if ($em.Success -and $em.Groups[2].Value.Contains('Blade')) {
            $oldName = $em.Groups[2].Value
            $newName = Repair-BladeIdentifier $oldName
            $line = $line.Substring(0, $em.Groups[2].Index) + $newName + $line.Substring($em.Groups[2].Index + $em.Groups[2].Length)
            $repair++
            $ex.Add("$oldName -> $newName ($RelPath)")
            $ids.Add($newName)
        }
        # PASS B: значение — внутри кавычек
        $q1 = $line.IndexOf('"'); $q2 = $line.LastIndexOf('"')
        if ($q1 -ge 0 -and $q2 -gt $q1) {
            $val = $line.Substring($q1 + 1, $q2 - $q1 - 1)
            $scr = ConvertTo-BladeValue $val
            if ($scr.Count -gt 0) {
                $line = $line.Substring(0, $q1 + 1) + $scr.Text + $line.Substring($q2)
                $scrub += $scr.Count
            }
        }
        $lines[$i] = $line
    }
    [pscustomobject]@{ Text = ($lines -join "`n"); Repair = $repair; Scrub = $scrub; Examples = $ex; Ids = $ids }
}

# PASS C: литералы в коде (.js/.mjs/.sys.mjs/.jsx).
# Строки-комментарии (//, /*, *) пропускаем целиком; апострофы в них не
# превращаются в «литералы», т.к. закрывающей кавычки на строке нет.
function Invoke-JsLiteralSurgery {
    param([string]$Text, [string]$RelPath)
    $count = 0
    $ex = New-Object System.Collections.Generic.List[string]
    $lines = $Text -split "`n"
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if (-not $line.Contains('Firefox')) { continue }
        $tr = $line.TrimStart()
        if ($tr.StartsWith('//') -or $tr.StartsWith('/*') -or $tr.StartsWith('*')) { continue }
        $lits = [regex]::Matches($line, $script:LitRe)
        for ($k = $lits.Count - 1; $k -ge 0; $k--) {
            $lit = $lits[$k].Value
            $inner = $lit.Substring(1, $lit.Length - 2)
            if (-not $inner.Contains('Firefox')) { continue }
            $scr = ConvertTo-BladeValue -Value $inner -Phrase
            if ($scr.Count -gt 0) {
                $newLit = $lit.Substring(0, 1) + $scr.Text + $lit.Substring($lit.Length - 1, 1)
                $line = $line.Remove($lits[$k].Index, $lits[$k].Length).Insert($lits[$k].Index, $newLit)
                $count++
                $s1 = if ($inner.Length -gt 60)    { $inner.Substring(0, 57) + '...' }    else { $inner }
                $s2 = if ($scr.Text.Length -gt 60) { $scr.Text.Substring(0, 57) + '...' } else { $scr.Text }
                $ex.Add("'$s1' -> '$s2' ($RelPath)")
            }
        }
        $lines[$i] = $line
    }
    [pscustomobject]@{ Text = ($lines -join "`n"); Count = $count; Examples = $ex }
}

# PASS D: JSON по белому списку путей (вызывается только для разрешённых путей).
# -NameFieldsOnly — трогать только значения полей "name"; иначе все строковые
# значения (ai-window-prompts: большой текст промптов, «те же правила»).
function Invoke-JsonSurgery {
    param([string]$Text, [string]$RelPath, [switch]$NameFieldsOnly)
    $count = 0
    if ($NameFieldsOnly) {
        $ms = [regex]::Matches($Text, '"name"\s*:\s*"[^"\r\n]*"')
        for ($k = $ms.Count - 1; $k -ge 0; $k--) {
            $vm = [regex]::Match($ms[$k].Value, '"[^"\r\n]*"$')
            $inner = $vm.Value.Substring(1, $vm.Value.Length - 2)
            if (-not $inner.Contains('Firefox')) { continue }
            $scr = ConvertTo-BladeValue -Value $inner -Phrase
            if ($scr.Count -gt 0) {
                $newm = $ms[$k].Value.Substring(0, $ms[$k].Value.Length - $vm.Value.Length) + '"' + $scr.Text + '"'
                $Text = $Text.Remove($ms[$k].Index, $ms[$k].Length).Insert($ms[$k].Index, $newm)
                $count++
                $script:LiteralExamples.Add("JSON $RelPath : '$inner' -> '$($scr.Text)'")
            }
        }
    } else {
        $ms = [regex]::Matches($Text, '"(?:[^"\\]|\\.)*"')
        for ($k = $ms.Count - 1; $k -ge 0; $k--) {
            $lit = $ms[$k].Value
            $inner = $lit.Substring(1, $lit.Length - 2)
            if (-not $inner.Contains('Firefox')) { continue }
            $scr = ConvertTo-BladeValue -Value $inner -Phrase
            if ($scr.Count -gt 0) {
                $newLit = '"' + $scr.Text + '"'
                $Text = $Text.Remove($ms[$k].Index, $ms[$k].Length).Insert($ms[$k].Index, $newLit)
                $count++
                $s1 = if ($inner.Length -gt 60)    { $inner.Substring(0, 57) + '...' }    else { $inner }
                $s2 = if ($scr.Text.Length -gt 60) { $scr.Text.Substring(0, 57) + '...' } else { $scr.Text }
                $script:LiteralExamples.Add("JSON $RelPath : '$s1' -> '$s2'")
            }
        }
    }
    [pscustomobject]@{ Text = $Text; Count = $count }
}

# --- 1. browser\omni.ja: бэкап + распаковка ---
$bkpBrowser = Join-Path $backups "browser-omni-$stamp.ja"
Copy-Item $omniBrowser $bkpBrowser -Force
Write-Host "Бэкап: $bkpBrowser"

$tmp = Join-Path $env:TEMP ("blade-omni-" + [guid]::NewGuid().ToString('N'))
[System.IO.Compression.ZipFile]::ExtractToDirectory($omniBrowser, $tmp)
Write-Host 'Распаковано во временный каталог'

# --- PASS A (ремонт) + PASS B (value-only скраб): .ftl/.properties/.dtd ---
$l10nFiles = @(Get-ChildItem $tmp -Recurse -Include *.ftl, *.properties, *.dtd -File)
foreach ($f in $l10nFiles) {
    $rel = $f.FullName.Substring($tmp.Length + 1).Replace('\', '/')
    $text = [System.IO.File]::ReadAllText($f.FullName, $utf8)
    if (-not ($text.Contains('Blade') -or $text.Contains('Firefox'))) { continue }
    if ($f.Extension -eq '.ftl')          { $r = Invoke-FtlSurgery -Text $text -RelPath $rel }
    elseif ($f.Extension -eq '.properties') { $r = Invoke-PropertiesSurgery -Text $text -RelPath $rel }
    else                                  { $r = Invoke-DtdSurgery -Text $text -RelPath $rel }
    if ($r.Repair -gt 0 -or $r.Scrub -gt 0) {
        [System.IO.File]::WriteAllText($f.FullName, $r.Text, $utf8)
        $M.RepairKeys += $r.Repair
        $M.ValueScrub += $r.Scrub
        if ($r.Repair -gt 0) {
            $M.RepairFiles++
            foreach ($e in $r.Examples) { $RepairExamples.Add($e) }
            foreach ($id in $r.Ids) { [void]$M.RepairedIds.Add($id) }
        }
    }
}
Write-Host ("PASS A+B (l10n): ремонт ключей $($M.RepairKeys), value-скраб $($M.ValueScrub) (файлов l10n: $($l10nFiles.Count))")

# --- PASS C: литералы в коде (.js/.mjs/.sys.mjs/.jsx) ---
$codeFiles = @(Get-ChildItem $tmp -Recurse -Include *.js, *.mjs, *.jsx -File)
foreach ($f in $codeFiles) {
    $text = [System.IO.File]::ReadAllText($f.FullName, $utf8)
    if (-not $text.Contains('Firefox')) { continue }
    $rel = $f.FullName.Substring($tmp.Length + 1).Replace('\', '/')
    # webcompat-инъекции — ЛОГИКА (детекция браузера, подмена UA для сломанных
    # сайтов), не display-текст: 'Firefox' там — искомое значение, замена ломает
    if ($rel -like 'chrome/browser/builtin-addons/webcompat/*') { continue }
    $r = Invoke-JsLiteralSurgery -Text $text -RelPath $rel
    if ($r.Count -gt 0) {
        [System.IO.File]::WriteAllText($f.FullName, $r.Text, $utf8)
        $M.Literals += $r.Count
        $M.LiteralFiles++
        foreach ($e in $r.Examples) { $LiteralExamples.Add($e) }
    }
}
Write-Host "PASS C (литералы кода): замен $($M.Literals) (файлов: $($M.LiteralFiles))"

# --- PASS D: JSON по белому списку путей ---
$jsonNameOnly = @(
    'defaults/settings/main/devtools-compatibility-browsers.json'
)
$jsonAllStrings = @(
    'defaults/settings/main/ai-window-prompts.json'
)
foreach ($rel in $jsonNameOnly) {
    $p = Join-Path $tmp ($rel.Replace('/', '\'))
    if (-not (Test-Path $p)) { Write-Host "PASS D: $rel не найден — пропущен"; continue }
    $text = [System.IO.File]::ReadAllText($p, $utf8)
    if (-not $text.Contains('Firefox')) { continue }
    $r = Invoke-JsonSurgery -Text $text -RelPath $rel -NameFieldsOnly
    if ($r.Count -gt 0) { [System.IO.File]::WriteAllText($p, $r.Text, $utf8); $M.JsonScrub += $r.Count }
}
foreach ($rel in $jsonAllStrings) {
    $p = Join-Path $tmp ($rel.Replace('/', '\'))
    if (-not (Test-Path $p)) { Write-Host "PASS D: $rel не найден — пропущен"; continue }
    $text = [System.IO.File]::ReadAllText($p, $utf8)
    if (-not $text.Contains('Firefox')) { continue }
    $r = Invoke-JsonSurgery -Text $text -RelPath $rel
    if ($r.Count -gt 0) { [System.IO.File]::WriteAllText($p, $r.Text, $utf8); $M.JsonScrub += $r.Count }
}
# встроенные темы: builtin-themes/*/manifest.json — только поле "name"
$themesDir = Join-Path $tmp 'chrome\browser\content\builtin-themes'
if (Test-Path $themesDir) {
    foreach ($d in @(Get-ChildItem $themesDir -Directory)) {
        $p = Join-Path $d.FullName 'manifest.json'
        if (-not (Test-Path $p)) { continue }
        $rel = "chrome/browser/content/builtin-themes/$($d.Name)/manifest.json"
        $text = [System.IO.File]::ReadAllText($p, $utf8)
        if (-not $text.Contains('Firefox')) { continue }
        $r = Invoke-JsonSurgery -Text $text -RelPath $rel -NameFieldsOnly
        if ($r.Count -gt 0) { [System.IO.File]::WriteAllText($p, $r.Text, $utf8); $M.JsonScrub += $r.Count }
    }
}
Write-Host "PASS D (JSON, белый список): замен $($M.JsonScrub)"

# --- Репак browser\omni.ja ---
# ВАЖНО: пути внутри zip — ТОЛЬКО прямые слеши. .NET CreateFromDirectory
# пишет бэкслеши — Firefox после такого репака НЕ ЗАПУСКАЕТСЯ (проверено).
# Первый entry — chrome.manifest (как в оригинале, стартовая оптимизация).
$newOmni = $omniBrowser + '.new'
if (Test-Path $newOmni) { Remove-Item $newOmni -Force }
$zip = [System.IO.Compression.ZipFile]::Open($newOmni, 'Create')
try {
    $all = @(Get-ChildItem $tmp -Recurse -File)
    $ordered = @($all | Where-Object { $_.Name -eq 'chrome.manifest' }) + @($all | Where-Object { $_.Name -ne 'chrome.manifest' })
    foreach ($f in $ordered) {
        $rel = $f.FullName.Substring($tmp.Length + 1).Replace('\', '/')
        [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $f.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal)
    }
} finally { $zip.Dispose() }
Move-Item $newOmni $omniBrowser -Force
Remove-Item $tmp -Recurse -Force

# --- Проверка результата (browser omni) ---
try {
    $check = [System.IO.Compression.ZipFile]::OpenRead($omniBrowser)
    $entries = $check.Entries
    $badPaths = @($entries | Where-Object { $_.FullName -match '\\' })
    $first = $entries[0].FullName
    $count = $entries.Count
    $check.Dispose()
    if ($badPaths.Count -gt 0) { throw "в omni $($badPaths.Count) путей с бэкслешем — Firefox не стартует" }
    if ($first -ne 'chrome.manifest') { throw "первый entry '$first' — должен быть chrome.manifest" }
    Write-Host "Проверка: browser\omni.ja читается, записей: $count, первый entry: $first"
} catch {
    Write-Host "!!! ОШИБКА: новый omni.ja повреждён ($_) — откатываю !!!" -ForegroundColor Red
    Move-Item $bkpBrowser $omniBrowser -Force
    exit 1
}

# --- 2. Корневой omni.ja: value-only скраб l10n, порядок записей сохранён ---
# Ремонт не нужен: корень старым скраббером не трогался, 'Blade' там нет.
$bkpRoot = Join-Path $backups "root-omni-$stamp.ja"
Copy-Item $omniRoot $bkpRoot -Force
Write-Host "Бэкап: $bkpRoot"

$rootOk = $true
$rootOrigCount = 0
$rootOrigFirst = ''
try {
    $srcZip = [System.IO.Compression.ZipFile]::OpenRead($omniRoot)
    $rootOrigCount = $srcZip.Entries.Count
    $rootOrigFirst = $srcZip.Entries[0].FullName
    $newRoot = $omniRoot + '.new'
    if (Test-Path $newRoot) { Remove-Item $newRoot -Force }
    $outZip = [System.IO.Compression.ZipFile]::Open($newRoot, 'Create')
    try {
        # записи пишутся В ТОМ ЖЕ ПОРЯДКЕ, в каком в оригинале (chrome.manifest — где был)
        foreach ($entry in $srcZip.Entries) {
            $name = $entry.FullName
            $ms = New-Object System.IO.MemoryStream
            $s = $entry.Open(); $s.CopyTo($ms); $s.Dispose()
            $bytes = $ms.ToArray()
            if ($name -match '\.(ftl|properties|dtd)$' -and ($name.StartsWith('localization/') -or $name.Contains('/locale/'))) {
                $text = $utf8.GetString($bytes)
                $ext = [System.IO.Path]::GetExtension($name)
                if ($ext -eq '.ftl')             { $r = Invoke-FtlSurgery -Text $text -RelPath $name }
                elseif ($ext -eq '.properties')  { $r = Invoke-PropertiesSurgery -Text $text -RelPath $name }
                else                             { $r = Invoke-DtdSurgery -Text $text -RelPath $name }
                if ($r.Repair -gt 0 -or $r.Scrub -gt 0) {
                    # repair в корне всегда 0 (там нет 'Blade'), на всякий случай суммируем
                    $bytes = $utf8.GetBytes($r.Text)
                    $M.RootScrub += $r.Scrub + $r.Repair
                    $M.RootFiles++
                }
            }
            # остальные записи — байт-в-байт; имена уже с прямыми слэшами
            $e = $outZip.CreateEntry($name, [System.IO.Compression.CompressionLevel]::Optimal)
            $os = $e.Open(); $os.Write($bytes, 0, $bytes.Length); $os.Dispose()
        }
    } finally { $outZip.Dispose() }
    $srcZip.Dispose()

    # Проверка НОВОГО архива до подмены: открывается, записей столько же, бэкслешей нет
    $chk = [System.IO.Compression.ZipFile]::OpenRead($newRoot)
    $badPaths = @($chk.Entries | Where-Object { $_.FullName -match '\\' })
    $cnt = $chk.Entries.Count
    $fst = $chk.Entries[0].FullName
    $chk.Dispose()
    if ($badPaths.Count -gt 0) { throw "бэкслеши в путях ($($badPaths.Count))" }
    if ($cnt -ne $rootOrigCount) { throw "записей $cnt вместо $rootOrigCount" }
    if ($fst -ne $rootOrigFirst) { throw "первый entry '$fst' вместо '$rootOrigFirst' — порядок нарушен" }

    # Подмена с retry (антивирус/локи)
    $moved = $false
    for ($i = 1; $i -le 5; $i++) {
        try { Move-Item $newRoot $omniRoot -Force; $moved = $true; break }
        catch { Start-Sleep -Seconds 2 }
    }
    if (-not $moved) { throw "не удалось заменить корневой omni.ja за 5 попыток" }
    Write-Host "Корневой omni.ja: замен value-only $($M.RootScrub) (файлов: $($M.RootFiles)); записей: $cnt, первый entry: $fst (порядок сохранён)"
} catch {
    $rootOk = $false
    Write-Host "!!! ОШИБКА корневого omni.ja: $_ — откат из бэкапа !!!" -ForegroundColor Red
    if (Test-Path $bkpRoot) { Copy-Item $bkpRoot $omniRoot -Force }
    if (Test-Path ($omniRoot + '.new')) { Remove-Item ($omniRoot + '.new') -Force -ErrorAction SilentlyContinue }
}
if (-not $rootOk -and -not $DryRun) { exit 1 }

# --- 3. distribution\distribution.ini ---
$bkpDist = Join-Path $backups "distribution-$stamp.ini"
Copy-Item $distIni $bkpDist -Force
$distText = [System.IO.File]::ReadAllText($distIni)
$distOrig = $distText
# about=Firefox, Portable Edition -> about=Blade
$distText = $distText.Replace('about=Firefox, Portable Edition', 'about=Blade')
# [BookmarksToolbar]: закладка PortableApps.com (с base64-иконкой) -> наша, без icon/iconData
$distSection = "[BookmarksToolbar]`r`nitem.1.title=Blade Browser`r`nitem.1.link=https://github.com/deni41144/blade-browser"
$secm = [regex]::Match($distText, '(?s)\[BookmarksToolbar\].*?(?=\r?\n\[|\z)')
if (-not $secm.Success) { throw 'В distribution.ini нет секции [BookmarksToolbar]' }
$tail = if ($secm.Value.EndsWith("`n")) { "`r`n" } else { '' }
$distText = $distText.Substring(0, $secm.Index) + $distSection + $tail + $distText.Substring($secm.Index + $secm.Length)
if ($distText -ne $distOrig) {
    [System.IO.File]::WriteAllText($distIni, $distText, $utf8)
    Write-Host 'distribution.ini: about=Blade, [BookmarksToolbar] -> Blade Browser'
} else {
    Write-Host 'distribution.ini: уже в порядке (изменений нет)'
}

# --- 4. Гигиена движка: crashreporter возвращается с обновлениями ---
if (-not $DryRun) {
    $cr = Join-Path $AppDir 'crashreporter.exe'
    if (Test-Path $cr) {
        Remove-Item $cr -Force
        Write-Host 'crashreporter.exe удалён'
    } else {
        Write-Host 'crashreporter.exe отсутствует (ок)'
    }
}

# --- 5. Метрики ---
Write-Host ''
Write-Host '--- Метрики ---'
Write-Host "Ремонт ключей: $($M.RepairKeys) (файлов: $($M.RepairFiles))"
Write-Host "Value-скраб: $($M.ValueScrub)"
Write-Host "Литералы: $($M.Literals) (файлов: $($M.LiteralFiles))"
Write-Host "JSON: $($M.JsonScrub)"
Write-Host "Корневой omni: $($M.RootScrub)"
Write-Host 'distribution.ini: ok'

# --- DryRun: детальный отчёт ---
if ($DryRun) {
    Write-Host ''
    Write-Host '=== DRYRUN: контроль известных повреждений (из аудита) ==='
    foreach ($key in @('firefoxview-page-title', 'pane-about-firefox-title', 'policy-DisableFirefoxAccounts1')) {
        $ok = $M.RepairedIds.Contains($key)
        $state = if ($ok) { 'восстановлен' } else { 'НЕ НАЙДЕН' }
        Write-Host "  ${key}: $state"
    }
    $msgOk = @($LiteralExamples | Where-Object { $_.Contains('Message from Firefox') }).Count -gt 0
    $msgState = if ($msgOk) { 'да' } else { 'нет' }
    Write-Host "  Message from Firefox -> Message from Blade: $msgState"

    Write-Host ''
    Write-Host '=== DRYRUN: примеры отремонтированных ключей (10) ==='
    $prior = @($RepairExamples | Where-Object { $_.Contains('firefoxview-page-title') -or $_.Contains('pane-about-firefox-title') } | Select-Object -First 2)
    $rest  = @($RepairExamples | Where-Object { $prior -notcontains $_ } | Select-Object -First (10 - $prior.Count))
    ($prior + $rest) | ForEach-Object { Write-Host "  $_" }

    Write-Host ''
    Write-Host '=== DRYRUN: примеры заменённых литералов (10) ==='
    $priorL = @($LiteralExamples | Where-Object { $_.Contains('Message from Firefox') } | Select-Object -First 1)
    $restL  = @($LiteralExamples | Where-Object { $priorL -notcontains $_ } | Select-Object -First (10 - $priorL.Count))
    ($priorL + $restL) | ForEach-Object { Write-Host "  $_" }

    Write-Host ''
    Write-Host "Установленные файлы НЕ тронуты. Копии после трансформаций: $dryDir"
    Write-Host 'Запусти без -DryRun, чтобы применить.'
    exit 0
}

Write-Host 'ГОТОВО. Изменения применятся при следующем запуске браузера.'
