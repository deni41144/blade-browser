# ============================================================================
# Apply-Blade-Langpack.ps1 — брендинг Blade в языковых пакетах профиля.
# Проблема (2026-09-14, «браузер опять превращается в Firefox»): ru-langpack
# в профиле несёт СВОИ строки брендинга («Mozilla Firefox»/«Firefox» в
# brand.ftl и значениях l10n) и перекрывает омниевское «Blade» во всём
# русском интерфейсе (заголовок окна, меню, about-страницы). Движковый
# omni при этом уже Blade (en-US), поэтому дев-профиль (en) выглядел
# правильно, а профиль владельца (ru) — как Firefox.
#
# Решение, 3 части:
#   A) КОРНЕВОЙ omni.ja: AddonSettings.sys.mjs — подписи langpack-ов
#      («locale») переводятся с константы true на преф
#      extensions.langpacks.signatures.required (дефолт false).
#      Подписи обычных расширений (REQUIRE_SIGNING) НЕ тронуты — uBO и пр.
#      остаются под проверкой Mozilla. Без этого правленный langpack
#      отключился бы как «неподписанный».
#   B) Langpack-и профиля (ru, en-GB): value-only скраб .ftl/.properties/.dtd.
#   C) l10n-хвосты en-US ВНУТРИ browser/omni.ja и omni.ja движка — тот же
#      скраб, перепаковка как в части A (бэкап, порядок записей, Optimal).
#      Идемпотентность естественная: 0 замен → архив не пишем.
#
# Скраб v2 (третья итерация, «ноль Firefox/Mozilla в видимом тексте»),
# закрывает три дыры v1:
#   1) селекторные строки .ftl («[genitive] домашней страницы Firefox» —
#      вариантов падежей нет «=», v1 их не матчил);
#   2) атрибуты .ftl («.title = Firefox рекомендует…») и строки-продолжения —
#      v1-регресс не матчил ведущую точку/отступ;
#   3) одиночный «Mozilla» не трогался («Mozilla Monitor», «политик Mozilla»);
#   4) http-гард скипал значение ЦЕЛИКОМ — теперь СЕГМЕНТНЫЙ скраб: URL-части
#      (https?://… и голые домены org/com/net) байт-в-байт, текстовые части
#      скрабим. Порядок: «Mozilla Firefox» → Blade, потом «Firefox» → Blade,
#      потом «Mozilla» → Blade (иначе «Mozilla Blade»).
# Нижний регистр «firefox»/«mozilla» НЕ трогаем (l10n-переменные/идентификаторы,
# на экран не попадают — меняются только их ОПРЕДЕЛЕНИЯ).
# Юридический стоп-лист: файлы с «aboutRights»/«license» в имени не трогаем
# вообще (MPL-тексты обязаны упоминать Mozilla/Firefox — ограничение №3 карты).
# aboutMozilla.ftl — ТРОГАЕМ (eastern-egg, не легал).
# Ключи/id/секции/имена записей — свято, меняются только значения.
#
# Использование:
#   powershell -ExecutionPolicy Bypass -File Apply-Blade-Langpack.ps1 `
#     [-AppDir <движок>] [-ProfileDir <профиль>] [-SkipLangpack] [-DryRun]
#   -SkipLangpack — без части B (langpack-и профиля); части A и C (движок)
#     выполняются — для Skeleton-Stage, там нет профиля.
# ============================================================================
param(
    [string]$AppDir = (Join-Path $env:LOCALAPPDATA 'Blade\App\Blade'),
    [string]$ProfileDir = (Join-Path $env:LOCALAPPDATA 'Blade\Data\profile'),
    [switch]$SkipLangpack,
    [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$rootOmni = Join-Path $AppDir 'omni.ja'
if (-not (Test-Path $rootOmni)) { throw "Нет корневого архива: $rootOmni" }

# --- Гвард: движок не должен работать ---
$running = @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
    Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($AppDir, [StringComparison]::OrdinalIgnoreCase) })
if ($running.Count -gt 0 -and -not $DryRun) {
    throw "Из этого движка запущен браузер ($($running.Count)) — закрой и повтори"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$utf8 = New-Object System.Text.UTF8Encoding($false)

# Штамп/каталог бэкапов — общий для частей A и C
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$label = Split-Path $AppDir -Leaf
$bkDir = Join-Path $PSScriptRoot ("Backups\langpack-" + $stamp + "\" + $label)

# ============ ЧАСТЬ A: патчи корневого omni.ja (подписи langpack-ов) ============
function Read-Entry([string]$zipPath, [string]$entryName) {
    $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    try {
        $e = $zip.Entries | Where-Object { $_.FullName -eq $entryName }
        if (-not $e) { throw "В архиве нет записи: $entryName" }
        $sr = New-Object System.IO.StreamReader($e.Open(), [System.Text.Encoding]::UTF8)
        try { return $sr.ReadToEnd() } finally { $sr.Dispose() }
    } finally { $zip.Dispose() }
}

# A1 (AddonSettings): LANGPACKS_REQUIRE_SIGNING с константы -> преф
$pA1 = @{
    entry = 'modules/addons/AddonSettings.sys.mjs'
    old = @'
if (AppConstants.MOZ_REQUIRE_SIGNING && !Cu.isInAutomation) {
  makeConstant("REQUIRE_SIGNING", true);
  makeConstant("LANGPACKS_REQUIRE_SIGNING", true);
'@.Replace("`r`n", "`n")
    new = @'
if (AppConstants.MOZ_REQUIRE_SIGNING && !Cu.isInAutomation) {
  makeConstant("REQUIRE_SIGNING", true);
  // BLADE PATCH (Apply-Blade-Langpack.ps1): подписи langpack-ов («locale»)
  // управляются префом extensions.langpacks.signatures.required (дефолт
  // false) — наш брендированный langpack-ru не подписан Mozilla (value-only
  // скраб значений). Подписи обычных расширений не тронуты.
  XPCOMUtils.defineLazyPreferenceGetter(
    AddonSettings,
    "LANGPACKS_REQUIRE_SIGNING",
    PREF_LANGPACK_SIGNATURES,
    false
  );
'@.Replace("`r`n", "`n")
    marker = 'Apply-Blade-Langpack.ps1): подписи langpack-ов'
}

# A2 (XPIDatabase.mustSign): locale -> всегда false (двойная страховка:
# даже если преф-геттер где-то не перекроется, mustSign не отключит langpack)
$pA2 = @{
    entry = 'modules/addons/XPIDatabase.sys.mjs'
    old = @'
    if (aType == "locale") {
      return lazy.AddonSettings.LANGPACKS_REQUIRE_SIGNING;
    }
'@.Replace("`r`n", "`n")
    new = @'
    if (aType == "locale") {
      // BLADE PATCH (Apply-Blade-Langpack.ps1): langpack-и не требуют подписи —
      // брендированный ru-langpack перешит скрабом значений.
      return false;
    }
'@.Replace("`r`n", "`n")
    marker = 'langpack-и не требуют подписи'
}

# A3 (XPIInstall.shouldVerifySignedState): locale -> не проверять вовсе:
# signedState остаётся NOT_REQUIRED => isCorrectlySigned=true, без предупреждений
$pA3 = @{
    entry = 'modules/addons/XPIInstall.sys.mjs'
    old = @'
  // Otherwise only check signatures if the add-on is one of the signed
  // types.
  return XPIExports.XPIDatabase.SIGNED_TYPES.has(aAddonType);
}
'@.Replace("`r`n", "`n")
    new = @'
  // Otherwise only check signatures if the add-on is one of the signed
  // types.
  // BLADE PATCH (Apply-Blade-Langpack.ps1): подпись langpack-ов не проверяем —
  // брендированный ru-langpack правится скрабом значений (не подписан Mozilla).
  if (aAddonType == "locale") {
    return false;
  }
  return XPIExports.XPIDatabase.SIGNED_TYPES.has(aAddonType);
}
'@.Replace("`r`n", "`n")
    marker = 'подпись langpack-ов не проверяем'
}

$patches = @($pA1, $pA2, $pA3)
$contents = @{}
$changed = $false
foreach ($p in $patches) {
    if (-not $contents.ContainsKey($p.entry)) { $contents[$p.entry] = Read-Entry $rootOmni $p.entry }
    $txt = $contents[$p.entry]
    if ($txt.Contains($p.marker)) {
        Write-Host "$($p.entry): уже пропатчен, пропускаю" -ForegroundColor DarkYellow
        continue
    }
    if (-not $txt.Contains($p.old)) { throw "$($p.entry): якорь не найден — файл движка изменился" }
    $contents[$p.entry] = $txt.Replace($p.old, $p.new)
    $changed = $true
    Write-Host "$($p.entry): патч применён" -ForegroundColor Cyan
}

if ($changed) {
    # синтаксис-проверка всех трёх
    $tmp = Join-Path $env:TEMP ("blade-lp-" + [guid]::NewGuid().ToString('N').Substring(0,8))
    New-Item -ItemType Directory -Path $tmp -Force | Out-Null
    try {
        foreach ($e in $contents.Keys) {
            $f = Join-Path $tmp (Split-Path $e -Leaf)
            [System.IO.File]::WriteAllText($f, $contents[$e], $utf8)
            & node --check $f
            if ($LASTEXITCODE -ne 0) { throw "node --check: $e — синтаксис битый, откат" }
        }
    } finally { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }

    if (-not $DryRun) {
        New-Item -ItemType Directory -Path $bkDir -Force | Out-Null
        Copy-Item $rootOmni (Join-Path $bkDir 'root-omni.ja') -Force
        Write-Host "бэкап: $bkDir\root-omni.ja"
    }
    $newOmni = $rootOmni + '.new'
    $src = [System.IO.Compression.ZipFile]::OpenRead($rootOmni)
    $out = [System.IO.Compression.ZipFile]::Open($newOmni, 'Create')
    try {
        foreach ($e in $src.Entries) {
            $ne = $out.CreateEntry($e.FullName, [System.IO.Compression.CompressionLevel]::Optimal)
            $st = $ne.Open()
            if ($contents.ContainsKey($e.FullName)) {
                $bytes = $utf8.GetBytes($contents[$e.FullName])
                $st.Write($bytes, 0, $bytes.Length)
                Write-Host "  [PATCH] $($e.FullName)"
            } else {
                $es = $e.Open(); $es.CopyTo($st); $es.Close()
            }
            $st.Close()
        }
    } finally { $src.Dispose(); $out.Dispose() }
    if ($DryRun) { Remove-Item $newOmni -Force; Write-Host 'DryRun A: движок не тронут' -ForegroundColor Cyan }
    else { Move-Item $newOmni $rootOmni -Force; Write-Host 'Часть A: корневой omni.ja перешит' -ForegroundColor Green }
} else {
    Write-Host 'Часть A: все патчи уже стоят' -ForegroundColor Yellow
}

# ============ ЧАСТИ B и C: сегментный скраб l10n (python, режимы) ============
# B — langpack-и профиля; C — l10n-хвосты en-US в browser/omni.ja и omni.ja.
$py = @'
import os, re, sys, zipfile, shutil

# Apply-Blade-Langpack.ps1 v2 (третья итерация): value-only скраб брендов.
# Дыры v1, закрытые здесь: селекторные строки ftl (падежи без «=»), атрибуты
# .ftl («.title = Firefox рекомендует…») и строки-продолжения, одиночный
# «Mozilla», http-гард скипал значение целиком (теперь сегментный).

mode = sys.argv[1]        # 'langpack' | 'omni'
dry = sys.argv[-1] == '-dryrun'

# URL-подстроки (протокол + голые домены org/com/net) — байт-в-байт, не скрабим.
# P2-аудит (ReDoS): класс [\w.-] допускал точку ВНУТРИ сегмента — полином на
# «a.a.a...». Фикс в два приёма (паттерн аудитора без lookbehind замерен: 1.6 c
# на 'a.'×12000 — re перебирает КАЖДУЮ позицию как старт): (1) точка только
# разделитель сегментов; (2) lookbehind (?<![\w.-]) запрещает старт внутри
# доменной цепочки — валидных стартов O(слов), не O(символов).
URL_RE = re.compile(r'https?://\S+|(?<![\w.-])[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*\.(?:org|com|net)\b\S*')

# Однострочные { ... }-спаны Fluent: ссылки на термины/message-id
# ({ policy-FirefoxSuggest }, { -brand-short-name }, { $case }) — на экран
# попадает ЗНАЧЕНИЕ определения, а не ссылка; скраб идентификаторов ломал бы
# их. Многострочные { $case -> ... } не матчатся ([^{}\n] без переводов
# строк) — их внутренности покрыты селекторным правилом FTL_SEL.
BRACE_SPAN = re.compile(r'\{[^{}\n]*\}')

# Юридический стоп-лист (ограничение №3 карты): MPL-тексты обязаны упоминать
# Mozilla/Firefox — файлы с такими именами не трогаем вообще.
# aboutMozilla.ftl НЕ в стоп-листе (eastern-egg, не легал).
def stopped(fn):
    low = fn.lower()
    return 'licens' in low or 'aboutrights' in low

def scrub_segment(s):
    # P2-аудит: { ... }-спаны Fluent защищены как URL — идентификаторы
    # внутри не скрабим; текст между ними скрабится как обычно
    n = 0
    out = []
    pos = 0
    for m in BRACE_SPAN.finditer(s):
        seg, k = _scrub_plain(s[pos:m.start()])
        n += k; out.append(seg)
        out.append(m.group(0))
        pos = m.end()
    seg, k = _scrub_plain(s[pos:])
    n += k; out.append(seg)
    return ''.join(out), n

def _scrub_plain(s):
    # порядок: длинное «Mozilla Firefox» раньше «Firefox» (иначе «Mozilla Blade»)
    n = 0
    if 'Mozilla Firefox' in s:
        n += s.count('Mozilla Firefox'); s = s.replace('Mozilla Firefox', 'Blade')
    if 'Firefox' in s:
        n += s.count('Firefox'); s = s.replace('Firefox', 'Blade')
    if 'Mozilla' in s:
        n += s.count('Mozilla'); s = s.replace('Mozilla', 'Blade')
    return s, n

def scrub_value(v):
    # v1 скипал значение целиком из-за одного URL — выживали строки вида
    # «Firefox рекомендует только те расширения, проверенные на https://…».
    # v2: сегментный скраб — URL-части байт-в-байт, текстовые части скрабим.
    if 'Firefox' not in v and 'Mozilla' not in v:
        return v, 0
    n = 0
    out = []
    pos = 0
    for m in URL_RE.finditer(v):
        seg, k = scrub_segment(v[pos:m.start()])
        n += k; out.append(seg)
        out.append(m.group(0))
        pos = m.end()
    seg, k = scrub_segment(v[pos:])
    n += k; out.append(seg)
    return ''.join(out), n

# .ftl: id = / -term = / .attr = (атрибуты с отступом — дыра v1: ведущая
# точка не матчилась, из-за неё выжили .title/.message «Firefox рекомендует…»)
FTL_KV = re.compile(r'^(\s*-?[\w.-]+(?:\[[^\]]*\])?\s*=\s*)(.*)$')
# .ftl: варианты селекторов — «[genitive] домашней страницы Firefox» без «=»
# (дыра v1: все 6 падежей -firefox-home-brand-name оставались Firefox)
FTL_SEL = re.compile(r'^(\s*\*?\[[\w-]+\]\s+)(.+)$')
PROP_LINE = re.compile(r'^([^#=]+=)(.*)$')
DTD_LINE = re.compile(r'^(<!ENTITY\s+\S+\s+")(.*)("\s*>)$')

def scrub_ftl_line(line):
    m = FTL_KV.match(line)
    if m:
        v, n = scrub_value(m.group(2))
        return (m.group(1) + v) if n else None, n
    m = FTL_SEL.match(line)
    if m:
        v, n = scrub_value(m.group(2))
        return (m.group(1) + v) if n else None, n
    # строка-продолжение значения (отступ, не комментарий) — скраб целиком;
    # идентификаторы в нижнем регистре правило не трогает (case-sensitive)
    if (line.startswith(' ') or line.startswith('\t')) and not line.lstrip().startswith('#'):
        v, n = scrub_value(line)
        return v if n else None, n
    return None, 0

def scrub_text(name, text):
    out = []
    total = 0
    is_ftl = name.endswith('.ftl')
    is_prop = name.endswith('.properties')
    is_dtd = name.endswith('.dtd')
    for line in text.split('\n'):
        replaced = None
        # vendor: точные строки (значения целиком точные, не подстроки)
        if '-vendor-short-name = Mozilla' in line:
            total += 1
            line = line.replace('-vendor-short-name = Mozilla', '-vendor-short-name = Blade')
            replaced = line
        if 'vendorShortName=Mozilla' in line:
            total += 1
            line = line.replace('vendorShortName=Mozilla', 'vendorShortName=Blade')
            replaced = line
        if is_ftl:
            r, n = scrub_ftl_line(line)
            if r is not None:
                replaced = r
                total += n
        elif is_prop:
            if not line.lstrip().startswith('#'):
                m = PROP_LINE.match(line)
                if m:
                    v, n = scrub_value(m.group(2))
                    if n:
                        replaced = m.group(1) + v
                        total += n
        elif is_dtd:
            m = DTD_LINE.match(line)
            if m:
                v, n = scrub_value(m.group(2))
                if n:
                    replaced = m.group(1) + v + m.group(3)
                    total += n
        out.append(replaced if replaced is not None else line)
    return '\n'.join(out), total

def scrub_zip_entries(entries):
    # конвенция 3: ТОЛЬКО значения; ключи/id/имена записей неприкосновенны
    patched = {}
    total = 0
    for info, data in entries:
        fn = info.filename
        if (fn.endswith(('.ftl', '.properties', '.dtd'))
                and not fn.startswith('META-INF/') and not stopped(fn)):
            try:
                text = data.decode('utf-8')
            except UnicodeDecodeError:
                continue
            new_text, n = scrub_text(fn, text)
            if n:
                patched[fn] = new_text.encode('utf-8')
                total += n
    return patched, total

def repack(path, entries, patched, bak=None):
    if bak and not os.path.exists(bak):
        os.makedirs(os.path.dirname(bak), exist_ok=True)
        shutil.copy2(path, bak)
    tmp = path + '.new'
    zout = zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED)
    try:
        for info, data in entries:
            # Optimal как в части A: все записи deflate, порядок сохранён
            info.compress_type = zipfile.ZIP_DEFLATED
            zout.writestr(info, patched.get(info.filename, data))
    finally:
        zout.close()
    os.replace(tmp, path)

def run_langpack(profile):
    ext_dir = os.path.join(profile, 'extensions')
    if not os.path.isdir(ext_dir):
        print('extensions/ не найден — langpack-ов нет')
        return
    targets = [f for f in os.listdir(ext_dir)
               if f.startswith('langpack-') and f.endswith('.xpi')]
    if not targets:
        print('langpack-и не найдены в профиле — нечего скрабить')
        return
    for fname in sorted(targets):
        path = os.path.join(ext_dir, fname)
        zin = zipfile.ZipFile(path, 'r')
        entries = [(i, zin.read(i.filename)) for i in zin.infolist()]
        zin.close()
        patched, total = scrub_zip_entries(entries)
        if total == 0:
            print(f'{fname}: замен 0 (уже чист?)')
            continue
        if dry:
            print(f'{fname} [DRY]: {total} замен в {len(patched)} файлах')
            continue
        repack(path, entries, patched, bak=path + '.blade-bak')
        print(f'{fname}: {total} замен в {len(patched)} файлах (бэкап .blade-bak)')

def run_omni(appdir, backupdir):
    omnis = [
        ('root-omni', os.path.join(appdir, 'omni.ja')),
        ('browser-omni', os.path.join(appdir, 'browser', 'omni.ja')),
    ]
    for label, path in omnis:
        if not os.path.exists(path):
            print(f'{label}: нет файла — пропуск')
            continue
        zin = zipfile.ZipFile(path, 'r')
        entries = [(i, zin.read(i.filename)) for i in zin.infolist()]
        zin.close()
        patched, total = scrub_zip_entries(entries)
        if total == 0:
            print(f'{label}: замен 0 (уже чист)')
            continue
        if dry:
            print(f'{label} [DRY]: {total} замен в {len(patched)} файлах')
            continue
        bk = os.path.join(backupdir, label + '.ja') if backupdir != '-' else None
        repack(path, entries, patched, bak=bk)
        print(f'{label}: {total} замен в {len(patched)} файлах (перепакован'
              + (f', бэкап {bk}' if bk else '') + ')')

if mode == 'langpack':
    run_langpack(sys.argv[2])
elif mode == 'omni':
    run_omni(sys.argv[2], sys.argv[3])
else:
    print('неизвестный режим: ' + mode)
    sys.exit(2)
print('SCRUB_OK')
'@

$pyFile = Join-Path $env:TEMP ("blade-lp-scrub-" + [guid]::NewGuid().ToString('N').Substring(0,8) + ".py")
$py | Set-Content $pyFile -Encoding UTF8
try {
    $arg2 = if ($DryRun) { '-dryrun' } else { 'run' }

    # --- ЧАСТЬ B: langpack-и профиля ---
    if ($SkipLangpack) {
        Write-Host 'Часть B пропущена (-SkipLangpack)' -ForegroundColor Yellow
    } else {
        if (-not (Test-Path $ProfileDir)) { throw "Нет профиля: $ProfileDir" }
        & python $pyFile langpack $ProfileDir $arg2
        if ($LASTEXITCODE -ne 0) { throw "Скраб langpack-ов упал (код $LASTEXITCODE)" }
    }

    # --- ЧАСТЬ C: l10n-хвосты en-US в движковых omni ---
    # Перепаковка как в части A: бэкап Backups\langpack-<stamp>\<label>\,
    # порядок записей, Optimal. Идемпотентно: 0 замен — архив не пишем.
    $browserOmni = Join-Path $AppDir 'browser\omni.ja'
    if (-not (Test-Path $browserOmni)) {
        Write-Host 'Часть C: нет browser\omni.ja — пропуск' -ForegroundColor Yellow
    } else {
        $bkArg = if ($DryRun) { '-' } else { $bkDir }
        & python $pyFile omni $AppDir $bkArg $arg2
        if ($LASTEXITCODE -ne 0) { throw "Скраб omni упал (код $LASTEXITCODE)" }
    }
} finally {
    Remove-Item $pyFile -Force -ErrorAction SilentlyContinue
}
Write-Host 'Готово. Перезапусти браузер (startupCache чистить не обязательно, l10n кэшируется слабо).' -ForegroundColor Green
