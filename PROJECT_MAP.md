# Карта проекта Blade

> Обновлено: 2026-09-12 · актуально для v1.7.3 «Лёгкая Сталь»
> Кастомный браузер на базе Mozilla Firefox: брендинг-хирургия движка,
> движок тем, автообновление через GitHub. Автор: Denis Bobliksov (Blade-Creations).

## Шпаргалка типовых операций

| Что | Команда |
|---|---|
| Собрать патч-релиз (6 МБ, chrome+user.js) | `powershell -File Patches\Publish-Blade-Update.ps1 -Version X.Y.Z -Codename "Имя" -Notes "что нового"` |
| То же без заливки в GitHub (тест) | добавить `-SkipPublish` |
| Собрать полный пакет (~200 МБ, движок+chrome) | добавить `-Mode Full` |
| Обновить движок до нового Firefox | `.\Update-Blade.ps1 -NewFirefox <папка распакованного Firefox>` |
| Повторить глубокий брендинг движка | закрыть Blade → `.\Apply-Blade-Omni.ps1` (есть `-DryRun`) |
| Зарегистрировать браузером по умолчанию | `powershell -File Patches\template\set-blade-default.ps1` |
| Бэкап профиля | `Blade-Backup.bat` |
| Диагностика кастома | смотреть `chrome\JS\*_mark.txt` (живой профиль) или `Blade-Diagnostic.bat` |
| История проекта | `git log --oneline` / `git status` — репозиторий в корне; личное и артефакты (профиль, Backups, zip, Output/bin/obj) в `.gitignore` |

## Два дома проекта

- **Dev-профиль (источник правок):** `F:\firefox michael edition\FirefoxPortable\Data\profile`
  Здесь живут файлы, из которых собираются патчи. Правки делаются тут.
- **Установленная копия (боевой браузер):** `C:\Users\Deni\AppData\Local\Blade`
  Движок: `App\Blade\firefox.exe`. Профиль: `Data\profile` (проверено по cmdline
  живого процесса 2026-09-12; прежний `FirefoxPortable\` там же — мёртвое дерево,
  убрано в `Backups\FirefoxPortable-dead-tree-2026-09-12`).
  Патч в него применяется копированием `chrome/` + `user.js` (как UPDATE.bat).

## Структура каталогов

```
F:\firefox michael edition\
├── Apply-Blade-Omni.ps1      Глубокая хирургия движка v3 (см. «Конвейеры»)
├── Update-Blade.ps1          Пересборка на новом Firefox (лёгкая хирургия)
├── Blade-Backup.ps1/.bat     Бэкап профиля → Backups\
├── Blade-Diagnostic.bat      Диагностика установки
├── Backups\                  ВСЕ бэкапы (см. «Откаты»); ротации нет
├── Branding\                 brand.ftl/properties, иконки, rcedit.exe
├── BladeSetup\               WPF-установщик (C#): Blade-Setup.exe + data.zip
├── Installer\                Inno Setup — ЛЕГАСИ, не используется
├── FirefoxPortable\          Dev-профиль (источник патчей)
│   └── Data\profile\
│       ├── user.js           Пресеты движка (~280 строк: перф/приватность/медиа)
│       └── chrome\
│           ├── userChrome.css   Темы UI (~1400 строк, 10 тем, секция 18 SIGNATURE)
│           ├── userContent.css  Темы newtab/сайтов/about: (~1050 строк)
│           ├── covers.css       ГЕНЕРИРУЕТСЯ BobliksCovers.uc.js — руками не править
│           ├── JS\              10 uc.js-скриптов (загрузка через utils\ fx-autoconfig)
│           ├── img\             Фоны bg_*.jpg, themes\<домен>\<тема>.jpg, covers\
│           ├── resources\       blade-apply-update.ps1, set-blade-default.ps1
│           └── utils\           Загрузчик uc.js (boot.sys.mjs и пр.)
├── Patches\
│   ├── Build-Blade-Patch.ps1     Сборка патча из живого профиля
│   ├── Publish-Blade-Update.ps1  Сборка + guard + публикация в GitHub
│   └── template\                 UPDATE.bat, blade-update.ps1, blade-apply-update.ps1,
│                                 set-blade-default.ps1, repo-README.md
└── Иконки\, Иконки старые\       Графические исходники
```

## Ключевые uc.js-скрипты (chrome\JS\)

| Скрипт | Версия | Роль |
|---|---|---|
| BladeCore.uc.js | 1.0.0 | Общий контракт `window.Blade`: THEMES, builtinBgs, bgPrefId, mark, шина событий, runPsEncoded. `@loadOrder 5` — исполняется до всех. ОТКЛЮЧАТЬ НЕЛЬЗЯ |
| BobliksSettings.uc.js | 1.9.0 | Меню «B»: темы, фоны, DNS, система. `applyThemeSheet()` — USER_SHEET для живого переключения тем на ВСЕХ поверхностях |
| BladeUpdater.uc.js | 1.3.2 | Автопроверка GitHub (сутки), панель «Хроника обновлений», самолечение 401-токена, однократная регистрация дефолт-браузера, API `window.BladeUpdater` |
| BobliksCovers.uc.js | 2.1.0 | Генератор covers.css (`@onlyonce` + перегенерация по префу `bobliks.covers.dirty`) |
| BladeNewtab.uc.js | 1.0.3 | Hero-часы на новой вкладке (chrome-оверлей) |
| BladeClock.uc.js | 2.0.1 | Часы+погода в тулбаре (ipwho.is + open-meteo) |
| BladePerf.uc.js | 1.0.0 | Замер фаз старта окна (dcl/load/paint/ssr) → `perf_mark.txt` |
| BobliksChromeStyle 1.2.0 / AboutStyle 1.0.1 / BladeSounds 1.0.1 | — | Стили хрома/about (incl. порт SIGNATURE), звуки |

## Конвейеры

### 1. Патч-релиз (основной, 6 МБ)
`Publish-Blade-Update.ps1` → `Build-Blade-Patch.ps1` (копия `chrome/`+`user.js` из живого
профиля → джанк-чистка личного → прошивка VERSION/CODENAME → хроника) → **guard 2c**
(отказ публикации при личных файлах в архиве: logins/cookies/places/…) → `gh release create`.
Друзья получают автоматически в течение суток (BladeUpdater).

### 2. Полный пакет (~200 МБ)
`Publish-Blade-Update.ps1 -Mode Full`: движок из `%LOCALAPPDATA%\Blade\App\Blade` +
побайтово тот же chrome. Формат data.zip для WPF-установщика (BladeSetup).
**Единственный способ доставить друзьям движковые фиксы** (омни-хирургия в патч не входит).

### 3. Обновление движка (лёгкая хирургия)
`Update-Blade.ps1 -NewFirefox <папка>`: валидация путей → килл только Blade → бэкап
профиля → старый App сохранён целиком → robocopy нового → value-only скраб омни (v3:
ТОЛЬКО значения после `=`, case-sensitive — иначе ломаются l10n-id!) → иконки/brand →
rcedit exe → стрип мусора (updater, crashreporter, телеметрия). Любая ошибка = автоОткат.

### 4. Глубокая хирургия (Apply-Blade-Omni.ps1 v3)
Запускать при ЗАКРЫТОМ браузере (сам откажется при запущенном). Проходы:
- PASS A: ремонт l10n-ключей, побитых старым скраббером (Blade→firefox в позициях идентификаторов)
- PASS B: value-only скраб ftl/properties/dtd (URL-гард, защита data-l10n-name/`{ msg-id }`)
- PASS C: литералы в .js/.mjs (фразовый паттерн; webcompat-инъекции ИСКЛЮЧЕНЫ)
- PASS D: JSON по белому списку (имена тем, devtools, AI-промпты)
- Корневой omni.ja (gecko): value-only l10n, порядок 2563 записей сохранён
- distribution.ini: about=Blade, закладка → github.com/deni41144/blade-browser
`-DryRun` — всё то же над копиями в %TEMP%\blade-omni-dryrun, ничего не трогает.

### 5. Браузер по умолчанию (set-blade-default.ps1)
HKCU-регистрация (без админки): StartMenuInternet\Blade + Capabilities +
ProgID BladeHTML/BladeURL. Ассоциации .html/.htm/.xhtml/.shtml — с валидным
UserChoice-хешем (алгоритм PS-SFTA, MIT). http/https: автоматически где позволяет
система; на укреплённых Win11 (24H2+/25H2) существующий UserChoice неприступен даже
для SYSTEM → скрипт открывает Settings, остаётся один клик «Set default».
Триггер: однократно при старте (преф `blade.setdefault.done`) + кнопка в меню B → СИСТЕМА.

## Версионирование

- `chrome\VERSION` — цифры вида 1.7.1 (UTF-8 БЕЗ BOM, без перевода строки). Для compareVersions.
- `chrome\CODENAME` — имя релиза на русском (тот же формат). Показывается в меню B, панели апдейтера, заголовке релиза.
- Компоненты имеют свои версии (@version в uc.js) — независимы от версии сборки.

### Реестр релизов
| Версия | Имя | Что принесла |
|---|---|---|
| 1.6.3 | Полуночный Клинок | Последняя «до эпохи конвейера v3» |
| 1.7.0 | Пепельный Венец | Перф-CSS (0 дорогих keyframes), панель апдейтера, CODENAME-система, самолечение тем |
| 1.7.1 | Багровая Заря | Регистрация в Windows, браузер по умолчанию, кнопка в меню B |
| 1.7.2 | Укрощённая Тень | Фикс BladeUpdater 1.3.1: панель обновления не лезет на меню B/тулбар (закрытие меню, ожидание якоря, гвард layout) |
| 1.7.3 | Лёгкая Сталь | Большая чистка: закрыты утечки (AboutStyle observer, createWidget, интервалы), мёртвый CSS (~175 строк)/12 мёртвых префов/BladeTiles-дубль удалены, сплеш не ловит клики, кэш скана img/, сеть часов по кэшу, BladeCore (общий контракт) + BladePerf (замер старта), порт SIGNATURE — «обнажение клинка» впервые работает. Не опубликован — на проверке |

## Конвенции (нарушать опасно)

1. **BOM:** ps1 с кириллицей — всегда UTF-8 С BOM (PS 5.1 иначе читает ANSI).
   VERSION/CODENAME — БЕЗ BOM. Хроника update_chronicle.txt — С BOM.
2. **mark-файлы:** каждый uc.js пишет `chrome\JS\<имя>_mark.txt` (перезапись, не append).
   Первая строка вида `v<версия> <событие>`. Это главная диагностика.
3. **Скраббинг омни:** только значения, только case-sensitive, URL-гард обязателен.
   Построчный case-insensitive replace уже однажды переименовал 205 l10n-ключей.
4. **Темы:** двойной механизм (@media -moz-pref + [data-blade-theme]) в CSS для
   холодного старта; живое переключение — только через USER_SHEET (applyThemeSheet).
   Новые правила-потребители цвета: `var(--accent, #ff2a2a)`, никогда хардкод.
5. **Патч не возит личное:** джанк-лист в Build-Blade-Patch + guard 2c в Publish.
6. **Анимации:** в keyframes только transform/opacity. filter/box-shadow — статики.
7. **nsIProcess не квотит пробелы:** внешние вызовы только через `-EncodedCommand` (base64 UTF-16LE).
8. **BladeCore — корень:** `window.Blade` (THEMES/builtinBgs/bgPrefId/mark/шина) потребляют
   Settings/ChromeStyle/Covers; скрипт в меню загрузчика отключать нельзя — всё сломается.
9. **Правки в живой профиль установленной копии** (`Blade\Data\profile`) — копированием
   поверх + ручное удаление снятых файлов (копирование не удаляет старое, пример — BladeTiles).
10. **Язык GitHub:** коммит-месседжи — ТОЛЬКО на английском; заголовки релизов —
   двуязычные с кодовым именем: `Blade vX.Y.Z — Имя (English Name)`;
   релизные нотсы — RU + секция `--- English ---` с переводом (финальную
   английскую часть заголовка релиза апдейтер показывает как codename).

## Стиль кода (считан с фактического кода, не дублирует конвенции)

**uc.js — каркас:** header `==UserScript==` (@name, @description, @author,
`@include main`, @version) → IIFE → гвард повторного запуска
(`if (window.X) return;`, для виджетов — `CustomizableUI.getWidget()`).
Состояние — в замыкании; наружу только API на `window.<Имя>`
(BladeUpdater, BladeNewtabHero).

**Именование:** файлы `Blade*`/`Bobliks*`; id элементов — kebab-case с префиксом
(`blade-update-panel`, `bobliks-settings-popup`); CSS-классы — короткий префикс
(`.bu-*` у апдейтера, `.bp-*` у меню B); префы — `blade.<модуль>.<поле>` / `bobliks.*`.

**Обработка ошибок (fail-soft):** чтение префов и всё внешнее (IOUtils, fetch,
DOM-геометрия) — в try/catch; скрипт никогда не валит браузер, ошибка уходит в
`mark('ERR …')`. Сеть — `fetch` + `AbortSignal.timeout(8000–15000)`; сетевые кэши —
преф + `<поле>Stamp` (weatherStamp, geoStamp, lastCheck) со сроком годности.

**Панели UI (паттерн BobliksSettings):** XUL `panel` в `#mainPopupSet`, контент —
XHTML через `createElementNS`, кнопки — div, открытие
`openPopup(anchor, 'after_start', 0, 0, false, false)`, стили — инъекция `<style>`
с id-гвардом от дублей, рамка/фон — только `::part(content)` (FF155 иначе не красится).

**CSS:** тёмная палитра — градиент `#17171f → #0a0a0e`, Segoe UI, текст `#e9e9ee`;
акцент — только `var(--accent, #ff2a2a)` (конвенция 4), хардкод запрещён.

**Комментарии:** русские, отвечают «почему», несут летопись фиксов («Gemini раунд 10»,
«баг красной команды №11») — это история решений, при правках не стирать.

**PowerShell:** `$ErrorActionPreference = 'Stop'`; ошибки — `throw` с русским
текстом; прогресс — `Write-Host -ForegroundColor`; перед необратимым — guard;
кириллица/пробелы в аргументах внешних вызовов — только `-EncodedCommand` (конвенция 7).

## Откаты и бэкапы (Backups\)

| Бэкап | Что внутри | Когда создаётся |
|---|---|---|
| `Blade-backup-*.zip` | Профиль | Blade-Backup.bat / перед обновлением движка |
| `Firefox64-full-*` | Движок целиком | Update-Blade.ps1 |
| `browser-omni-<stamp>.ja`, `root-omni-<stamp>.ja`, `distribution-<stamp>.ini` | До глубокой хирургии | Apply-Blade-Omni.ps1 |
| `pre-refactor-2026-09-12\` | 7 файлов до CSS/апдейтер-рефакторинга | вручную при больших правках |
| `FirefoxPortable-dead-tree-2026-09-12\` (в `%LOCALAPPDATA%\Blade\Backups`) | Мёртвое дерево установленной копии: дубль движка 304 МБ + устаревший профиль 94 МБ | Чистка v1.7.3; можно снести после пары недель стабильности |
| `installed-profile-chrome-1.4.2\` | Chrome боевого профиля до 1.7.0 | вручную |

Откат движка: закрыть Blade → скопировать бэкап поверх → запустить.
Откат профиля: заменить `chrome/` + `user.js` из соответствующего бэкапа.

## GitHub

- Репо: `deni41144/blade-browser` (публичный — анонимный доступ апдейтера работает)
- README двуязычный, лого в `assets/`, LICENSE (MPL 2.0 + атрибуция zxvolfik по графике)
- Префы апдейтера: `blade.update.repo/token/apiBase/auto/lastCheck/availableVersion`;
  протухший токен отбрасывается автоматически (v1.2.1+)
- Social preview ставится руками в Settings репо

## Известные ограничения (осознанные)

1. **25H2:** протоколы http/https — один ручной клик в Settings (стена Microsoft,
   непробиваема программно даже для SYSTEM; файлы и регистрация — автоматом).
2. Анимированные фоны newtab (pulse/flow) и картинки-обложки плиток переключаются
   живьём только на хроме; контент — при перезапуске (ограничение applyThemeSheet).
3. `about:license` содержит «Firefox» юридически корректно (текст MPL про код Firefox).
4. Экзешники (LegalTrademarks, деинсталлятор helper.exe) не перебиты — нужна переподпись.
5. Полный пакет с новым движком (v3-хирургия) друзьям ещё не рассылался — их движки
   ждут Full-релиза.
6. Ротации бэкапов нет — папка растёт, чистить руками.
