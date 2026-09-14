# -*- coding: utf-8 -*-
# Тест-стенд Apply-Blade-Langpack.ps1 (скраб v2): вырезает python-блок из ps1
# (единственный источник истины — никакого дублирования логики), мокает
# langpack-xpi профиля и движковые omni.ja, гоняет dry -> run -> rerun.
# Правила v2 под проверкой: селекторные строки .ftl (падежи), атрибуты .title,
# строки-продолжения, одиночный «Mozilla», сегментный http-гард (URL байт-в-байт),
# стоп-лист license/aboutRights, ключи/комментарии/нижний регистр не тронуты,
# порядок записей архивов, META-INF, идемпотентность.
import os, re, shutil, subprocess, sys, tempfile, zipfile

PS1 = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'Apply-Blade-Langpack.ps1')
PS1 = os.path.abspath(PS1)

FAILURES = []
def check(name, cond, detail=''):
    tag = 'PASS' if cond else 'FAIL'
    print(f'{tag} {name}' + (f' | {detail}' if detail else ''))
    if not cond:
        FAILURES.append(name)

def read_zip(path):
    z = zipfile.ZipFile(path, 'r')
    out = {i.filename: z.read(i.filename) for i in z.infolist()}
    order = [i.filename for i in z.infolist()]
    z.close()
    return out, order

# ---------- 1. Вырезать python-блок из ps1 ----------
ps1_text = open(PS1, encoding='utf-8-sig').read()
m = re.search(r"\$py = @'\r?\n(.*?)\r?\n'@", ps1_text, re.S)
check('EXTRACT python-блок найден в ps1', m is not None)
if not m:
    sys.exit(2)
sandbox = tempfile.mkdtemp(prefix='blade-lp-test-')
scrub_py = os.path.join(sandbox, 'scrub.py')
with open(scrub_py, 'w', encoding='utf-8') as f:
    f.write(m.group(1))

# ---------- 1b. Юнит-доступ к функциям блока (вхолостую: profile='') ----------
sys.argv = ['x', 'langpack', '', 'run']
ns = {}
exec(compile(m.group(1), 'scrub', 'exec'), ns)  # напечатает «нет extensions» — не страшно
scrub_value = ns['scrub_value']
URL_RE_NEW = ns['URL_RE']
BRACE_SPAN = ns['BRACE_SPAN']

# P2-аудит (ReDoS): старый класс [\w.-] (точка внутри сегмента) полиномиален
# на «a.a.a...»; новый — линейный (точка только разделитель)
import time
payload = 'a.' * 12000 + 'xyz'
t0 = time.perf_counter(); URL_RE_NEW.search(payload); t_new = time.perf_counter() - t0
URL_RE_OLD = re.compile(r'https?://\S+|[\w.-]+\.(?:org|com|net)\S*')
t0 = time.perf_counter(); URL_RE_OLD.search(payload); t_old = time.perf_counter() - t0
check('ReDoS: новый URL_RE из ps1 линеен (<300мс)', t_new < 0.3, f'{t_new*1000:.1f}ms')
check('ReDoS: старый регекс действительно тормозил (>5x нового)', t_old > t_new * 5,
      f'old {t_old*1000:.1f}ms vs new {t_new*1000:.1f}ms')
check('ReDoS: новый регекс по-прежнему ловит URL и голые домены',
      [u for u in URL_RE_NEW.findall('см. https://addons.mozilla.org/ru и mozilla.org/download')]
      == ['https://addons.mozilla.org/ru', 'mozilla.org/download'])

# P2-аудит (Fluent-иммунитет): { ... }-спаны — ссылки на идентификаторы,
# скрабить текст вокруг, спан байт-в-байт
sv, cnt = scrub_value('Подробности: { policy-FirefoxSuggest } и политика Mozilla для Firefox')
check('Fluent {…}: спан байт-в-байт, текст вокруг скрабится',
      sv == 'Подробности: { policy-FirefoxSuggest } и политика Blade для Blade' and cnt == 2, repr(sv))
sv, cnt = scrub_value('Скачайте Firefox на { -brand-download } от Mozilla')
check('Fluent {…}: { -brand-download } цел, бренды в тексте заменены',
      sv == 'Скачайте Blade на { -brand-download } от Blade' and cnt == 2, repr(sv))
sv, cnt = scrub_value('{ policy-FirefoxHome2 }')
check('Fluent {…}: значение целиком-ссылка не тронуто', sv == '{ policy-FirefoxHome2 }' and cnt == 0, repr(sv))
check('Fluent {…}: URL рядом со спаном — оба защищены',
      scrub_value('Firefox на { -term } см. https://www.mozilla.org/ru/firefox/')[0]
      == 'Blade на { -term } см. https://www.mozilla.org/ru/firefox/')
check('Fluent {…}: селекторы не под защитой спана (движковое правило FTL_SEL отдельно)',
      not BRACE_SPAN.search('    { $case ->') and not BRACE_SPAN.search('        [genitive] значение'))

# ---------- 2. Фейковые langpack-xpi ----------
profile = os.path.join(sandbox, 'profile')
os.makedirs(os.path.join(profile, 'extensions'))

BRANDINGS_RU = (
    "-mozmonitor-brand-name = Mozilla Monitor\n"
    "-mozilla-vpn-brand-name = Mozilla VPN\n"
    "-fakespot-brand-full-name = Fakespot \u043e\u0442 Mozilla\n"
    "-thunderbird-brand-name = Mozilla Thunderbird\n"
    "-firefox-home-brand-name =\n"
    "    { $case ->\n"
    "        [nominative_uppercase] \u0414\u043e\u043c\u0430\u0448\u043d\u044f\u044f \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430 Firefox\n"
    "        [genitive] \u0434\u043e\u043c\u0430\u0448\u043d\u0435\u0439 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u044b Firefox\n"
    "        [dative] \u0434\u043e\u043c\u0430\u0448\u043d\u044e\u044e \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443 Firefox\n"
    "       *[nominative] \u0434\u043e\u043c\u0430\u0448\u043d\u044f\u044f \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430 Firefox\n"
    "    }\n"
    "-firefox-suggest-brand-name = Blade Suggest\n"
)
ABOUT_ADDONS_RU = (
    "addon-recommendations-title =\n"
    "    .title = Firefox \u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u0442\u0435 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043d\u0438\u044f, "
    "\u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u0441\u043e\u043e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u044e\u0442 \u0441\u0442\u0430\u043d\u0434\u0430\u0440\u0442\u0430\u043c "
    "\u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u0438. \u041f\u043e\u0434\u0440\u043e\u0431\u043d\u0435\u0435: https://addons.mozilla.org/ru/recommended\n"
    "    .message = \u042d\u0442\u043e \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043d\u0438\u0435 \u0437\u0430\u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u043d\u043e "
    "\u0437\u0430 \u043d\u0430\u0440\u0443\u0448\u0435\u043d\u0438\u0435 \u043f\u043e\u043b\u0438\u0442\u0438\u043a Mozilla \u0438 \u0431\u044b\u043b\u043e \u043e\u0442\u043a\u043b\u044e\u0447\u0435\u043d\u043e.\n"
    "recommended-intro =\n"
    "    \u0432\u044b\u0431\u043e\u0440, \u043a\u043e\u0442\u043e\u0440\u044b\u0439 Firefox "
    "<a data-l10n-name=\"learn-more-trigger\">\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u0442</a> \u0434\u043b\u044f \u0432\u0430\u0441\n"
)
ABOUT_LICENSE_RU = "license-page = Mozilla Firefox \u0432\u044b\u043f\u0443\u0441\u043a\u0430\u0435\u0442\u0441\u044f Mozilla Foundation\n"
ABOUT_MOZILLA_RU = (
    "about-mozilla-title-6-27 = \u041a\u043d\u0438\u0433\u0430 Mozilla, 6:27\n"
    "about-mozilla-from-6-27 = \u0438\u0437 <strong>\u043a\u043d\u0438\u0433\u0438 Mozilla,</strong> 6:27\n"
)
DTD_RU = (
    '<!ENTITY vendorShort "Mozilla Firefox">\n'
    '<!ENTITY book "\u041a\u043d\u0438\u0433\u0430 Mozilla">\n'
    '<!ENTITY homepage "\u0414\u043e\u043c\u0430\u0448\u043d\u044f\u044f \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430 Mozilla Firefox">\n'
)
PROPS_RU = (
    "# \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u0441 Mozilla \u2014 \u043d\u0435 \u0442\u0440\u043e\u0433\u0430\u0435\u043c\n"
    "vendorShortName=Mozilla\n"
    "homepage.url=https://www.mozilla.org/ru/firefox/\n"
    "safeMode.prompt=Firefox \u0437\u0430\u043f\u0443\u0449\u0435\u043d \u0432 \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u043c \u0440\u0435\u0436\u0438\u043c\u0435 \u043e\u0442 Mozilla\n"
    "updateLink=\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u043d\u0430 mozilla.org/\u0441\u043a\u0430\u0447\u0430\u0442\u044c\n"
)
LANGPACK_FILES = {
    'localization/ru/toolkit/branding/brandings.ftl': BRANDINGS_RU,
    'localization/ru/toolkit/about/aboutAddons.ftl': ABOUT_ADDONS_RU,
    'localization/ru/toolkit/about/aboutLicense.ftl': ABOUT_LICENSE_RU,
    'localization/ru/toolkit/about/aboutMozilla.ftl': ABOUT_MOZILLA_RU,
    'chrome/ru/locale/ru/global/test.dtd': DTD_RU,
    'chrome/ru/locale/ru/global/test.properties': PROPS_RU,
    'META-INF/manifest.json': '{"name": "Mozilla Firefox langpack", "locales": ["ru"]}',
}
lp_path = os.path.join(profile, 'extensions', 'langpack-ru@test.mozilla.org.xpi')
with zipfile.ZipFile(lp_path, 'w') as z:
    for n, c in LANGPACK_FILES.items():
        z.writestr(n, c)
lp_before, lp_order_before = read_zip(lp_path)

# ---------- 3. Фейковый движок: omni.ja + browser/omni.ja ----------
appdir = os.path.join(sandbox, 'App', 'Blade')
os.makedirs(os.path.join(appdir, 'browser'))
BIN_ENTRY = b'\x00\x01Mozilla Firefox\x7f binary \xff\xfe'
ROOT_OMNI = {
    'localization/en-US/toolkit/branding/brandings.ftl':
        "-firefox-home-brand-name =\n"
        "    { $case ->\n"
        "       *[nominative] Firefox Home\n"
        "        [genitive] Firefox Home\n"
        "    }\n"
        "-mozmonitor-brand-name = Mozilla Monitor\n",
    'localization/en-US/toolkit/about/aboutRights.ftl':
        "rights-intro = Mozilla Firefox is free and open source software\n",
    'localization/en-US/toolkit/about/aboutMozilla.ftl':
        "about-mozilla-from-6-27 = from <strong>The Book of Mozilla,</strong> 6:27\n",
    'modules/addons/AddonSettings.sys.mjs': BIN_ENTRY,  # не l10n — байт-в-байт
}
BROWSER_OMNI = {
    'localization/en-US/browser/aboutDialog.ftl':
        "about-dialog-title = Mozilla Firefox\n"
        "community-2 = { -brand-short-name } is designed by Mozilla\n"
        "helpus = Help Mozilla at https://www.mozilla.org/contribute\n",
    'localization/en-US/browser/policies/policies-descriptions.ftl':
        "policy-DisableFirefoxScreenshots = Disable the Firefox Screenshots tool\n",
    'chrome/en-US/locale/en-US/browser/test.properties':
        "menuQuit.label=Quit Firefox\n",
}
for omni_rel, files in (('omni.ja', ROOT_OMNI), (os.path.join('browser', 'omni.ja'), BROWSER_OMNI)):
    p = os.path.join(appdir, omni_rel)
    with zipfile.ZipFile(p, 'w', zipfile.ZIP_DEFLATED) as z:
        for n, c in files.items():
            z.writestr(n, c)
root_omni_path = os.path.join(appdir, 'omni.ja')
browser_omni_path = os.path.join(appdir, 'browser', 'omni.ja')
root_before, root_order_before = read_zip(root_omni_path)
browser_before, browser_order_before = read_zip(browser_omni_path)

def run_scrub(args):
    r = subprocess.run([sys.executable, scrub_py] + args, capture_output=True, text=True, encoding='utf-8')
    return r.returncode, r.stdout + r.stderr

# ---------- 4. DRY: ничего не меняет, счётчики > 0 ----------
code, out = run_scrub(['langpack', profile, '-dryrun'])
check('DRY langpack: exit 0', code == 0, out.strip())
check('DRY langpack: счётчик > 0', '[DRY]:' in out, out.strip())
lp_after_dry, _ = read_zip(lp_path)
check('DRY langpack: файл не изменён', lp_after_dry == lp_before)

code, out = run_scrub(['omni', appdir, '-', '-dryrun'])
check('DRY omni: exit 0', code == 0, out.strip())
check('DRY omni: оба архива со счётчиком', out.count('[DRY]:') == 2, out.strip())
check('DRY omni: архивы не изменены',
      read_zip(root_omni_path)[0] == root_before and read_zip(browser_omni_path)[0] == browser_before)

# ---------- 5. RUN langpack ----------
code, out = run_scrub(['langpack', profile, 'run'])
check('RUN langpack: exit 0', code == 0, out.strip())
lp_after, lp_order_after = read_zip(lp_path)

def lines(name): return lp_after[name].decode('utf-8').split('\n')
b = '\n'.join(lines('localization/ru/toolkit/branding/brandings.ftl'))
check('RU селекторы: все 4 варианта падежей -> Blade',
      b.count('\u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430 Blade') + b.count('\u0441\u0442\u0440\u0430\u043d\u0438\u0446\u044b Blade') + b.count('\u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443 Blade') == 4
      and 'Firefox' not in b)
check('RU одиночный Mozilla: Monitor/VPN/Thunderbird/Fakespot \u043e\u0442 -> Blade',
      '-mozmonitor-brand-name = Blade Monitor' in b and '-mozilla-vpn-brand-name = Blade VPN' in b
      and '-thunderbird-brand-name = Blade Thunderbird' in b
      and 'Fakespot \u043e\u0442 Blade' in b and 'Mozilla' not in b)
check('RU ключ -firefox-home-brand-name сохранён (нижний регистр не тронут)',
      '-firefox-home-brand-name =' in b)

a = '\n'.join(lines('localization/ru/toolkit/about/aboutAddons.ftl'))
check('RU .title атрибут: Firefox->Blade, URL байт-в-байт',
      '.title = Blade \u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u0442' in a
      and 'https://addons.mozilla.org/ru/recommended' in a)
check('RU .message: \u043f\u043e\u043b\u0438\u0442\u0438\u043a Blade', '\u043f\u043e\u043b\u0438\u0442\u0438\u043a Blade' in a and '\u043f\u043e\u043b\u0438\u0442\u0438\u043a Mozilla' not in a)
check('RU строка-продолжение: Firefox->Blade, data-l10n-name цел',
      '\u043a\u043e\u0442\u043e\u0440\u044b\u0439 Blade <a data-l10n-name="learn-more-trigger">\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u0442</a>' in a)

check('RU СТОП-ЛИСТ aboutLicense: байт-в-байт',
      lp_after['localization/ru/toolkit/about/aboutLicense.ftl'] == LANGPACK_FILES['localization/ru/toolkit/about/aboutLicense.ftl'].encode('utf-8'))
mo = '\n'.join(lines('localization/ru/toolkit/about/aboutMozilla.ftl'))
check('RU aboutMozilla (НЕ стоп-лист): \u041a\u043d\u0438\u0433\u0430 Blade',
      '\u041a\u043d\u0438\u0433\u0430 Blade, 6:27' in mo and '\u043a\u043d\u0438\u0433\u0438 Blade,' in mo)

d = '\n'.join(lines('chrome/ru/locale/ru/global/test.dtd'))
check('DTD: Mozilla Firefox->Blade, \u041a\u043d\u0438\u0433\u0430 Mozilla->Blade',
      '<!ENTITY vendorShort "Blade">' in d and '<!ENTITY book "\u041a\u043d\u0438\u0433\u0430 Blade">' in d
      and '<!ENTITY homepage "\u0414\u043e\u043c\u0430\u0448\u043d\u044f\u044f \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430 Blade">' in d)

pr = '\n'.join(lines('chrome/ru/locale/ru/global/test.properties'))
check('PROPERTIES: vendorShortName=Blade, safeMode Blade, комментарий цел',
      'vendorShortName=Blade' in pr
      and 'safeMode.prompt=Blade \u0437\u0430\u043f\u0443\u0449\u0435\u043d \u0432 \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u043c \u0440\u0435\u0436\u0438\u043c\u0435 \u043e\u0442 Blade' in pr
      and pr.startswith('# \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u0441 Mozilla'))
check('PROPERTIES: URL-значение и голый домен mozilla.org не тронуты',
      'homepage.url=https://www.mozilla.org/ru/firefox/' in pr
      and 'updateLink=\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u043d\u0430 mozilla.org/\u0441\u043a\u0430\u0447\u0430\u0442\u044c' in pr)
check('META-INF не тронута',
      lp_after['META-INF/manifest.json'] == LANGPACK_FILES['META-INF/manifest.json'].encode('utf-8'))
check('langpack: порядок записей сохранён', lp_order_after == lp_order_before)
check('langpack: бэкап .blade-bak создан',
      os.path.exists(lp_path + '.blade-bak')
      and read_zip(lp_path + '.blade-bak')[0] == lp_before)

# ---------- 6. RUN omni ----------
bkdir = os.path.join(sandbox, 'Backups', 'langpack-test', 'Blade')
code, out = run_scrub(['omni', appdir, bkdir, 'run'])
check('RUN omni: exit 0', code == 0, out.strip())
root_after, root_order_after = read_zip(root_omni_path)
browser_after, browser_order_after = read_zip(browser_omni_path)

rb = root_after['localization/en-US/toolkit/branding/brandings.ftl'].decode('utf-8')
check('EN селекторы root-omni: *[nominative]/[genitive] -> Blade Home',
      '*[nominative] Blade Home' in rb and '[genitive] Blade Home' in rb and 'Firefox' not in rb)
check('EN root-omni: Mozilla Monitor -> Blade Monitor', '-mozmonitor-brand-name = Blade Monitor' in rb)
check('EN СТОП-ЛИСТ aboutRights: байт-в-байт',
      root_after['localization/en-US/toolkit/about/aboutRights.ftl'] == ROOT_OMNI['localization/en-US/toolkit/about/aboutRights.ftl'].encode('utf-8'))
check('EN root-omni aboutMozilla: Book of Mozilla -> Book of Blade',
      'The Book of Blade,' in root_after['localization/en-US/toolkit/about/aboutMozilla.ftl'].decode('utf-8'))
check('root-omni: не-l10n запись байт-в-байт',
      root_after['modules/addons/AddonSettings.sys.mjs'] == BIN_ENTRY)
check('root-omni: порядок записей сохранён', root_order_after == root_order_before)

ad = browser_after['localization/en-US/browser/aboutDialog.ftl'].decode('utf-8')
check('browser-omni: Mozilla Firefox -> Blade, designed by Blade',
      'about-dialog-title = Blade' in ad and 'designed by Blade' in ad)
check('browser-omni: сегментный скраб — текст заменён, URL цел',
      'helpus = Help Blade at https://www.mozilla.org/contribute' in ad)
pd = browser_after['localization/en-US/browser/policies/policies-descriptions.ftl'].decode('utf-8')
check('browser-omni: Firefox Screenshots -> Blade Screenshots (ключ с CamelCase не тронут)',
      'Disable the Blade Screenshots tool' in pd and 'the Firefox Screenshots tool' not in pd
      and 'policy-DisableFirefoxScreenshots' in pd)
tp = browser_after['chrome/en-US/locale/en-US/browser/test.properties'].decode('utf-8')
check('browser-omni properties: menuQuit.label=Quit Blade', 'menuQuit.label=Quit Blade' in tp)
check('omni: бэкапы root/browser-omni.ja созданы',
      os.path.exists(os.path.join(bkdir, 'root-omni.ja'))
      and os.path.exists(os.path.join(bkdir, 'browser-omni.ja')))
check('browser-omni: порядок записей сохранён', browser_order_after == browser_order_before)

# ---------- 7. Идемпотентность: повторный RUN = 0 ----------
code, out = run_scrub(['langpack', profile, 'run'])
check('RERUN langpack: замен 0', code == 0 and 'замен 0' in out, out.strip())
check('RERUN langpack: файлы не изменились', read_zip(lp_path)[0] == lp_after)
code, out = run_scrub(['omni', appdir, bkdir, 'run'])
check('RERUN omni: замен 0 в обоих', code == 0 and out.count('замен 0') == 2, out.strip())

# ---------- 8. Сквозная проверка: видимый текст без Firefox/Mozilla ----------
URL_RE = re.compile(r'https?://\S+|[\w.-]+\.(?:org|com|net)\S*')
def visible_dirty(text):
    # Грязь считаем только в ЗНАЧЕНИЯХ: хвост после «=» (ftl/properties) или
    # текст в кавычках (dtd); ключи вида policy-DisableFirefoxScreenshots —
    # идентификаторы, на экран не попадают (правило D ТЗ).
    bad = []
    for line in text.split('\n'):
        if line.lstrip().startswith('#'):
            continue
        if line.lstrip().startswith('<!ENTITY'):
            parts = line.split('"')
            probe = parts[1] if len(parts) > 2 else line
        elif '=' in line:
            probe = line.split('=', 1)[1]
        else:
            probe = line
        probe = URL_RE.sub('', probe)
        if 'Firefox' in probe or 'Mozilla' in probe:
            bad.append(line)
    return bad

for label, content, expect_dirty in [
    ('brandings.ftl RU', lp_after['localization/ru/toolkit/branding/brandings.ftl'], 0),
    ('aboutAddons.ftl RU', lp_after['localization/ru/toolkit/about/aboutAddons.ftl'], 0),
    ('aboutMozilla.ftl RU', lp_after['localization/ru/toolkit/about/aboutMozilla.ftl'], 0),
    ('test.dtd RU', lp_after['chrome/ru/locale/ru/global/test.dtd'], 0),
    ('test.properties RU', lp_after['chrome/ru/locale/ru/global/test.properties'], 0),
    ('brandings.ftl EN', root_after['localization/en-US/toolkit/branding/brandings.ftl'], 0),
    ('aboutDialog.ftl EN', browser_after['localization/en-US/browser/aboutDialog.ftl'], 0),
]:
    bad = visible_dirty(content.decode('utf-8'))
    check(f'ВИДИМЫЙ ТЕКСТ чист: {label}', len(bad) == expect_dirty, '; '.join(bad[:2]))

# ---------- 8b. Живой RU-langpack: идемпотентность + {…}-спаны с брендами ----------
LIVE_LP = r'C:\Users\Deni\AppData\Local\Blade\Data\profile\extensions\langpack-ru@firefox.mozilla.org.xpi'
if os.path.exists(LIVE_LP):
    z = zipfile.ZipFile(LIVE_LP)
    brace_hits = 0
    for n in z.namelist():
        if n.endswith(('.ftl', '.properties', '.dtd')) and not n.startswith('META-INF/'):
            try: t = z.read(n).decode('utf-8')
            except Exception: continue
            for span in BRACE_SPAN.findall(t):
                if 'Firefox' in span or 'Mozilla' in span:
                    brace_hits += 1
    z.close()
    check('ЖИВОЙ RU: {…}-спанов с Firefox/Mozilla нет (иммунитет ничего не изменил — 43 сохраняется)',
          brace_hits == 0, f'{brace_hits} спанов')
    live_sandbox = os.path.join(sandbox, 'liveprofile', 'extensions')
    os.makedirs(live_sandbox)
    shutil.copy2(LIVE_LP, os.path.join(live_sandbox, os.path.basename(LIVE_LP)))
    code, out = run_scrub(['langpack', os.path.join(sandbox, 'liveprofile'), 'run'])
    check('ЖИВОЙ RU: повторный прогон = замен 0 (уже прошит, идемпотентно)',
          code == 0 and 'замен 0' in out, out.strip())

shutil.rmtree(sandbox, ignore_errors=True)
print('\nALL TESTS PASSED' if not FAILURES else '\nFAILED: ' + ', '.join(FAILURES))
sys.exit(0 if not FAILURES else 1)
