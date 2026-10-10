## Исправление Windows Default Apps 2.3.5 - 10 октября 2026

База выпуска: опубликованный 2.3.4, commit 2e333295c17cb42171c618832e2c93351eb49c70. Старая рабочая ветка 2.3.2 и её незакоммиченные правки не используются для сборки. Архив 2.3.4 сверяется побайтово: никаких удалённых файлов, unrelated modules/assets сохраняются. Ранее не отслеживаемый covers.css добавлен из самого опубликованного архива для воспроизводимой сборки; Build-Blade-Patch отказывает, если его нет.

Подтверждённый дефект опубликованного registrar: PS-SFTA сам удаляет/пересоздаёт UserChoice с вычисленным хешем, не учитывает UserChoiceLatest и не защищает прямой запуск для тестового EnginePath. Windows Settings продолжал показывать старый Firefox/Blade URL, несмотря на успешное SHAssocEnumHandlersForProtocolByApplication. Одной такой API-проверки недостаточно для утверждения об исправлении UI.

Новая схема2: единый set-blade-default.ps1 запускается только из LOCALAPPDATA/Blade/Data/profile/chrome/resources с проверенным установленным движком; ValidateOnly ничего не пишет; RegisterOnly восстанавливает доступность без изменения текущего выбора и без UI. Никаких write/delete UserChoice, UserChoiceLatest, generic http/https. Отдельный BladeBrowser.exe получает собственные ProgID, ApplicationName и AUMID BladeBrowser.Desktop; передаёт разрешённый URL установленному движку с явным Data/profile, без shell. Все предки paths проверяются на reparse. Только Blade-owned legacy handlers мигрируют, чужие Firefox/Thorium/MSEdge не меняются. До записи сохраняются Blade registry snapshots и заменяемый launcher/shortcut.

BladeUpdater1.3.8 автоматически выполняет одноразовую регистрацию на первом установленном запуске после обновления, даже если апдейтер отключён и старый applier не содержит миграции. Guard ProfD/XREExeF обязателен; lock через Services.ppmm.sharedData, успех-pref только при process-finished/exit0, ошибки допускают повтор следующего startup. Explicit кнопка открывает штатную Windows страницу, выбор подтверждается пользователем. Новые manual/auto applier и setup вызывают тот же registrar RegisterOnly; custom/test targets пропускаются. Полный WPF build: 0 errors, 0 warnings; 61 JS/MJS проходят Node parser; 24 updater VM tests проходят.

Проверка registrar: Patches/tests/Test-BrowserRegistration.ps1 использует отдельный PowerShell5.1 process, локальный RegOverridePredefKey для реального isolated registry, user registry fingerprint до/после, fake engine capture для URL/profile и native Shell enumeration. Результаты/ограничения выпуска фиксируются в TestReports/release-2.3.5. История сегодняшних ручных экспериментов на установленной машине НЕ является доказательством чистой установки и не включается в пакет. Текущий browser process/profile не перезапускается ради release tests.
### Опубликованное обновление · Blade v2.3.0 · 8 октября 2026

Release: https://github.com/deni41144/blade-browser/releases/tag/v2.3.0 (latest, опубликован; draft/prerelease=false). Main/tag source commit 4e82062feba3631270384a88d7fc4dc2e9a67d8f. Assets Blade-Patch-v2.3.0.zip (31,745,000 bytes; SHA256 c3bebcfd103937e3e942610a981cca1a1467a0f424f253f429558f5cc6523efb) и .sha256 загружены. Публикация завершена через Patches/Publish-Blade-Update.ps1; ZIP включил chrome и user.js, упаковщик сообщил442files и страховка профиля не обнаружила cookie/login/session данных. Остальные незакоммиченные пользовательские изменения проекта не вошли в релиз.

## Исправления аккаунтов, музыки, обоев и значка · 8 октября 2026

Accounts/AccountPanel1.2.0: отдельная кнопка Google в каждой карточке B→Система, openSite открывает/переиспользует обычную вкладку нужного контейнера. Сессии основного аккаунта не копируются: первый вход Google нужен отдельно. Реальный Gecko OAuth window.open наследует userContextId, privateBrowsingId=0; persistent HttpOnly cookie того же контейнера дошла до popup и пережила полный restart, соседние контейнеры изолированы. Отчёт accounts-oauth-runtime-quality.json — PASS.

Music1.2.0: exact HTTPS music.youtube.com actor управляет настоящими player-bar previous/next и video.currentTime±10, MediaController остаётся fallback. Критический FF155 контракт: safeForUntrustedWebProcess:true обязателен даже при remoteTypes web; enforcement-pref не отключаем. Parent пустой, child ограничен сайтом/четырьмя действиями. На настоящем неавторизованном YouTube Music проверены actor, живые DOM-кнопки и trusted CtrlAltN/P dispatch — PASS (music-real-hotkeys.json). Личная авторизованная очередь/фактическая смена пользовательского трека не проверялась. Mock контроллера/seek limits PASS.

Original RED.png отображается BLOOD; прежний Original BLOOD.png убран из рабочей папки в Backups/retired-wallpaper-20261008. Старый orig:BLOOD.* выбор/облик мигрирует на orig:RED.*, устаревший pref очищается и повторный импорт прежнего BLOOD блокируется. Builtin/V2 и имена тем не переименовываются. Effects1.1.0: активность по Services.focus.activeWindow, capture focus/blur, TabSelect/TabShow; visibility actor повторно запрашивает актуальное состояние. Реальный Gecko: четыре newtab подряд с фокусом адресной строки — running, Eco pause/resume и миграция — PASS, current-fixes-quality.json. Принятые часы Red/Grey/Purple/Volt сохранены, QA10тем PASS.

DesktopIcon1.0.0 + resources/sync-desktop-icon.ps1: debounce смены темы, исходные9 цветных PNG упаковываются в 256px ICO и обновляют IconLocation существующих desktop ярлыков runtime exe либо точного installed Blade.lnk. Чужие ярлыки, target/arguments и exe не меняются. Marionette-профили пропускаются. Helper без polling/видимой консоли; Core.runPsEncoded startHidden=true. Named mutex сериализует созданиеICO/записьярлыков, timestamp запроса не позволяет старому detached helper заменить новую тему (stale-request QA PASS). Девять ICO/header/PNGsize + fixture shortcut + unrelated shortcut invariance — PASS. Custom использует RED как текущие tab-icons. Это локальные F правки; публичный2.2.0 не заменялся.

## Текущий вариант часов после уточнения · 8 октября 2026

Дополнительно возвращён Minimal Grey из того же2.0.5: Unbounded88px/800, белая платиновая поверхность с полосой#c5d5ea, мягкое белое свечение, секунды26px/800. HeroClock1.4.6; Grey исключён из sculpted overlay и motif rendering, classic glint pause следует hc-live. GX Red и Purple сохранены в уже уточнённых вариантах. Parser, настоящий Gecko10тем, Red/Purple regressions/Grey computed styles/eco pause и visual grey-clock-restored.png — PASS (`grey-clock-restore.json`). Только F-тестовая версия, релиз2.2.0 не менялся.

Окончательное требование владельца: GX Red — белый monolithic Unbounded с красным свечением по скриншоту2.0.5; Purple — прежний неоновый Monoton из2.1.0; остальные часы как в принятой2.2.0 (Volt остаётся original). BladeHeroClock1.4.5: data-hc-ready исключён только для Red/Purple/Volt, новый classic style scoped исключительно Red, Red motif скрыт и не создаёт путей. Первые попытки переноса screenshot dial на Purple были ошибочным пониманием и отменены. Parser и реальный Gecko10тем+eco — PASS; Purple CSS Newtab совпадает с git2.1.0, computed legacyfont/gradient/glint подтверждены; Red88px700/whitegradient/redglow/finite no-layoutmotif проверен и screenshot red-clock-restored.png просмотрен. Report red-clock-restore.json. Правки пока в тестовой F-копии, опубликованный2.2.0 не изменялся.

## После выпуска: фиолетовые часы из 2.1.0 · 8 октября 2026

Уточнение по скриншоту: владелец имел в виду цельный белый циферблат как в2.0.5 (commit8a377ee,21 сентября), а не Monoton из2.1.0. Текущая HeroClock1.4.3 использует для Purple геометрию Unbounded88px/700/6px и white sweep/тематическое свечение из прежнего monolithic clock, с фиолетовым accent. Legacy Purple всё ещё исключён из sculpted data-hc-ready; поверх его Newtab только scoped классический циферблат. Hc-live=false приостанавливает новый glint, не обходя eco/battery/hidden/reduced. Node parser, реальные10тем, computedfont/gradient иeco pause — PASS; фото purple-clock-restored.png просмотрено. F перезапущен19:07, fresh HeroClock1.4.3 и HEALTH GREEN подтверждены; опубликованный2.2.0 не менялся.

По просьбе владельца Purple возвращён к оригинальному неоновому clock из2.1.0. BladeHeroClock1.4.2 не включает data-hc-ready для Purple (как уже для Volt), поэтому исходные Newtab gradients/glint/Monoton font/секунды/линия снова работают без sculpted overlay. Purple CSS в BladeNewtab побайтово совпадает с git v2.1.0; других тем и атмосферы не касается. Parser и реальный Gecko10тем — PASS, computed Purple blade-neon84px, legacy gradient/filter/glint,0 HeroClock errors; просмотрен purple-clock-restored.png, отчёт purple-clock-restore.json. Это пока правка тестовой F-копии; опубликованный архив2.2.0 не заменялся.

## Выпуск 2.2.0 · 8 октября 2026

Опубликован8 октября18:36MSK: https://github.com/deni41144/blade-browser/releases/tag/v2.2.0. Source commit817f52a276cfc41bb3f4e16d27f90658b73c36ec отправлен main; release target тот же. API releases/latest возвращаетv2.2.0,draft=false,prerelease=false. Assets ZIP32579062байта и sha25689байт, state uploaded; GitHub digest совпадает с локальным SHA256. Публикация авторизована сообщением владельца «кайф выпускай апдейт»; никаких изменений установленной C копии не выполнялось.

Владелец одобрил текущий вид и явно разрешил публикацию. Подготовлен Patch2.2.0 (31.1MiB), существующее имя «Распад (Dissolve)» сохранено. Движок Firefox155.0.1 не менялся: оба omni.ja совпадают между тестовой F и установленной C копией. Notes: Patches/ReleaseNotes-v2.2.0.md. Исходники релиза ограничены chrome/user.js и сборщиком; чужие изменения Installer/BladeSetup/Blade-Eyes и черновики не включаются в commit/пакет.

Build-Blade-Patch исключает health/perf/Shield backup и временные/cache files, проверяет resolved build/staging paths перед recursive cleanup, не удаляет другие версии staging. ZIP содержит442 файла,55 JS/MJS побайтово совпадают с текущими исходниками; user.js также прошёл Node parser. Независимое review56 исходников — без P0/P1. Guard личных данных и secrets scan — PASS. Настоящий cold boot из распакованного архива в свежем отдельном профиле: core/menu/accounts/music/tabs/shelf/shell/atmosphere loaded, HEALTH GREEN,0 error-level сообщений Blade/Bobliks. На первом запуске есть13 native sanitizer warnings о SVG/path в Newtab (warningFlag=1), отдельно от ошибок. Реальное открытие B/аккаунтов/reduced/eco/reopen из архива — PASS. Аудит: TestReports/release-2.2.0/audit.json; SHA2566baac9aaea070bdef545f5214688c16fdf0110ed0548fdfa98c5c24576e7a6e0. Изолированный release-профиль закрыт.

## Актуально: матовые кнопки и особое раскрытие B · 8 октября 2026

Уточнение владельца: остальной вид принят, открытие почти незаметно. MenuSignature1.1.0: reveal540мс вместо310, более равномерное раскрытие, тематическая светлая кромка через всю высоту меню (pseudo overlay без pointer events), header glint600мс, cleanup660мс. Реальный Gecko повторно PASS: computed duration/pass, settle, быстрый reopen, eco/reduced, accounts route и0 ScriptError (`menu-signature-quality.json`). Другие материалы/меч/содержимое меню этой правкой не менялись.

Владелец отверг выпуклые nav-плашки и toolbar имя «Основной»; попросил аккаунты только через B, более выразительное раскрытие и улучшенный меч. ChromeShell1.1.0 заменяет отдельные рамки/двойные поверхности на ровную матовую линию с мягким hover; URL focus и оконные кнопки сохранены. AccountPanel1.1.0 больше не создаёт toolbarbutton, отдельный popup/quick host; mount/render/forms работают внутри B→Система с шрифтом Blade UI. Sidebar API open() переходит в существующий раздел system меню B. Native контейнеры и входы сохранены.

Новый BladeMenuSignature1.0.0 load123: inline SVG катана с обмоткой рукояти, гардой, металлической плоскостью и светлой режущей гранью; динамический акцент темы. Заменяет старую размытую image-графику и периодический glint только у B; native image сохраняет размер/hitbox, tooltip/команда/aria остаются штатными. На popupshown содержимое B раскрывается от правого края с косой кромкой за310мс, в шапке конечный блик390мс. Native panel geometry не меняется, старый generic scale исключён только для B. Таймер440мс удаляет marker, popuphidden отменяет, быстрый reopen не повреждает новый цикл. Eco/material-motion-off/reduced-motion подавляют эффект; forced-colors используют прежнюю native image. Однократный MutationObserver nav-bar ждёт late MenuButton insertion и сразу отключается; destroy удаляет собственные DOM/marker/listeners/observer/timer, общий USER sheet остаётся инертным без ownership.

Проверки: parser трёх модулей, chrome_shell_check и accounts_convenience_mock_panel — PASS. Реальный Gecko: единственный SVG, отсутствие toolbar account/popup, pointer-клик B с настоящим reveal/settle, API переход в B→Система, строки аккаунтов/Blade font/form cancel, eco/reduced-motion, четыре быстрых open/close, cleanup и0 ScriptError — PASS (`TestReports/menu-signature-quality.json`). Просмотрен реальный menu-signature-toolbar.png и проведено независимое source/visual review без блокеров. Native OS popup не захвачен на фото: animation/clip-path и открытие проверены в живом DOM панели. Принятые темы/пассивная атмосфера/часы/звуки/вкладки/содержимое B не переделывались.

F-браузер перезапущен18:23:34; свежие ChromeShell/AccountPanel1.1.0, MenuSignature «OK mounted» и HEALTH GREEN18:23:36 подтверждены. Изолированный браузер закрыт, установленный C PID14784 не перезапускался.

## Актуально: единый материал верхней панели · 8 октября 2026

По скриншотам владельца исправлены посторонняя бирюзовая рамка поиска, разрозненные кнопки и пустая подсказка панели закладок. Новые BladeChromeShell1.0.0 load121 и BladeBookmarksShelf1.0.0 load122; принятые вкладки, меню B, часы, звуки и восстановленные пассивные эффекты тем этой задачей не менялись.

ChromeShell: тёмный слоистый материал навигационной панели, утопленная адресная строка, тонкий тематический контур обеих native focus surfaces. Общие bevel/hover/pressed/disabled поверхности для кнопок навигации, расширений, аккаунта, новой вкладки, списка вкладок и min/max/close. Native glyphs, команды, размеры оконных hitbox и drag regions сохранены. Только CSS и один unload listener, без постоянных анимаций/timers/RAF; общий USER sheet активен лишь в окнах с marker, destroy делает его инертным. Forced-colors остаются нативными, reduced-motion отключает короткие переходы.

BookmarksShelf: компактное «Избранное», реальные native Places bookmark chips; вместо пустой native подсказки «Добавить страницу» и «Все закладки». Первая кнопка доступна только HTTP(S) и открывает штатное сохранение страницы; вторая открывает native Library. Собственный hbox не участвует в CustomizableUI и native empty detection; обновления объединены microtask, observers не меняют наблюдаемые native узлы. Native collapsed/hidden сохраняет нулевую высоту: первоначальная min-height32 мешала скрытию, ошибка воспроизведена и исправлена. Материал только forced-colors:none; destroy удаляет DOM/style/listeners/observers/progress listener.

Проверки: Node parser обоих модулей и chrome_shell_check — PASS. Реальный изолированный Gecko:10 тем с точным сравнением computed focus colour, native empty/populated, insert/remove и отсутствие observer feedback, hide/show (0/34px), узкое окно834px (URL324px), настоящая Library, pointer-сохранение HTTP-закладки через native Done и pointer back/forward/reload, cleanup и0 ScriptError — PASS (`TestReports/chrome-shell-quality.json`, `bookmarks-shelf-quality.json`). Просмотрены реальные chrome-shell-after-blood/empty.png, проведено независимое визуальное и source ревью. Физический drag окна и режим high contrast отдельно не тестировались. Native fetchTree в этой сборке — stub; тест использует bookmark fetch(parentGuid)/update и восстанавливает порядок временно перемещённых закладок исключительно изолированного профиля.

Финальный F-браузер перезапущен18:12:23; свежие chrome_shell/bookmarks_shelf marks1.0.0 и HEALTH GREEN18:12:25 подтверждены. Изолированный профиль и loopback helper остановлены. Установленный C-браузер PID14784 продолжил работу без перезапуска.

## Актуально: удобные аккаунты и клавиши YouTube Music · 8 октября 2026

BladeAccounts1.1.0: нативные Firefox-контейнеры с create/update/rename, current/list(true), счётчиками вкладок и текущего сайта. switchTo(id,true) выбирает существующую вкладку того же HTTP(S) origin и аккаунта либо открывает главную сайта в нужном контейнере; исходная вкладка остаётся открытой. Основной аккаунт id0 доступен для возврата. open(id,false) остаётся явным созданием новой вкладки. Новые контейнеры требуют собственного входа; cookies/storage/opener/секретные path/query не переносятся, logout не вызывается. Приватное окно и выключенные контейнеры недоступны. Нативные изменения, вкладки и навигация обновляют интерфейс через coalesced событие blade-accounts-changed, без polling.

Новая BladeAccountPanel1.0.0 load119: кнопка с именем текущего аккаунта в панели браузера и компактная панель в стиле B. Текущий аккаунт и уже открытые вкладки сайта стоят первыми; поиск, число вкладок, отдельная кнопка новой вкладки, создание/имя/цвет прямо в панели, доступ к штатным настройкам контейнеров. Тот же компонент встроен в B → Система (MenuPopup1.4.0). Sidebar переиспользует switchTo и показывает число вкладок; реагирует на событие аккаунтов. Формы не перерисовываются при вводе, строки используют textContent, цвета — native whitelist. Popuphidden слушается напрямую; закрытие сбрасывает форму, destroy удаляет DOM/styles/listeners.

BladeMusic1.1.0: раскрывающиеся «Клавиши управления музыкой» в карточке B. Пользователь назначает предыдущий/следующий трек и ±10с; назначений по умолчанию нет. Pref blade.music.hotkeys сохраняет сочетания. Требуются Ctrl или Alt, конфликты native XUL keys, повторные назначения и специальные AltF4/AltSpace/F7 отклоняются. Native keyset работает для F-клавиш/стрелок; печатные клавиши также сопоставляются trusted keydown по физическому code для разных раскладок, с защитой от двойного вызова и удержания. Выполнение только через live native MediaController вкладки с точным music.youtube.com и supportedKeys; sleeping tab не будится. Закрытое меню B не мешает клавишам. Это сочетания внутри окна браузера, не глобальные Windows-хоткеи. Запись отменяется Escape/закрытием меню, Delete/× удаляет назначение. Неподдерживаемое действие не запускается.

Проверки: Node parser пяти файлов, accounts_convenience_mock и music_hotkeys_mock — PASS. Реальный Gecko/loopback: два независимых серверных входа и localStorage; logout A сохраняет вход B; повторное переключение не плодит вкладки; inline create/rename и B integration; trusted keyboard с фокусом remote input, четыре настоящих MediaSession команды, ±10с offset, работа из другой вкладки, удержание один раз и trusted UI assignment; перезапуск сохраняет cookie B, localStorage, имя и хоткей;0 ScriptError — PASS (`TestReports/accounts-music-quality.json`). Native browser keyboard вводился через chrome surface Marionette: content-only injection обходит XUL обработчики и не служит проверкой хоткеев. Реальный авторизованный YouTube Music не тестировался: локальный audio/native MediaSession распознавался только тестовым currentURI getter, восстановленным до перезапуска. Физическая русская раскладка проверена mock-событием code/key, не сменой раскладки ОС. Визуально просмотрен accounts-toolbar.png — native DOM/CSS панель зеркалирована в chrome, поскольку Marionette не захватывает отдельное окно popup. Изменения независимо просмотрены. Резервные копии исходных модулей в Backups/accounts-music-20261008. Темы/пассивные эффекты/часы/звуки этой задачей не менялись.

## Актуально: возврат пассивных эффектов · 8 октября 2026

Владелец отверг апгрейд1.7: прежняя разнообразная пассивная атмосфера нравилась больше, особенно Green. Восстановлены HeroAtmosphere1.6.0, прежние TileFx и VisibilityChild/Parent из Backups/theme-premium-20261008. Новый BladeThemeTouch удалён из загрузки; отклик часов/плиток на общую атмосферу убран. Меню B, часы, вкладки, обои, звуки и прочие ранее принятые изменения сохранены. Отклонённая версия сохранена отдельно в Backups/theme-premium-rejected-20261008.

При проверке возврата воспроизведена прежняя ошибка TileFx.destroy: после reload about:newtab DOM уже мог стать dead wrapper. Добавлен только ранний выход очистки для освобождённого документа/style, без изменения внешнего вида. Node parser — PASS. Реальный Gecko:9 прежних renderer-сцен, активная legacy-атмосфера, продвижение времени пассивных Green-анимаций без мыши, eco и отсутствие новых ScriptError — PASS (`TestReports/theme-restore-quality.json`). Это текущая версия; результаты апгрейда ниже — история, не свидетельство одобрения владельцем.

## Отклонено: материалы и атмосфера девяти тем · 8 октября 2026

Владелец попросил развить темы до дорогого визуала, сохранив стиль разных обоев Blade. Это не только Samurai: проверены Standart, Original, Samurai, дополнительно Blade/Acheron и живой Aurora. Обои не перекрашиваются, выбранный фон сохраняется. Принятые меню B, поверхности вкладок, основная графика плиток, звуки и типографика часов сохранены; Volt оставляет прежние часы. Конструктор Custom не получает собственной сцены.

`BladeHeroAtmosphere.uc.js`1.7.0 заменяет старые смешанные эффекты всех встроенных тем на ограниченную периферийную композицию: Red — острые угольки; Blood — накопление ярко-красной жидкости с отделением капли; Volt — короткие ветвящиеся разряды существующего ElectricArc; Cherry — лепестки; Green — вязкие потёки; Grey — перья и металлические грани; Orange — компактные искры; Midnight — плоские водяные кольца; Purple — полупрозрачные грани. Векторные группы имеют opacity .48 и clipping по краям: центр обоев остаётся свободным. Hover/press часов и плиток вызывает ограниченный тематический отклик; кровь/зелёная жидкость закреплены у верхнего края, не висят в воздухе.

`BladeTileFx.sys.mjs`: добавлены тонкие кромки/локальные блики, водяной отклик Midnight и жидкость Green; удалены молнии поверх названия Volt и кометные хвосты Midnight. Максимум три активные плитки, удаление через1550мс, без собственного RAF/polling. VisibilityChild/Parent передают только trusted pointer input выбранной вкладки, проверяют тему, режим и конечные координаты, преобразуют координаты content viewport в hero viewport с учётом боковой панели. `BladeThemeTouch.uc.js`1.0.0 load98 даёт отклик часам: только прямоугольник часов принимает указатель, остальной overlay прозрачен. Ограничения частоты, максимум два атмосферных отклика1200мс; listener/style cleanup. Новых бесконечных JS-циклов нет; электрические вспышки конечные, между ними RAF отсутствует. Eco, battery, hidden/paused, reduced motion и Custom подавляют декоративную работу. data-blade-material-motion — производный статус Materials, не отдельная настройка пользователя.

Проверки: Node parser всех пяти файлов — PASS. Реальный Gecko в отдельном профиле:27 сочетаний тема×семейство обоев, сохранение дополнительных трёх фонов, настоящее наведение на chrome-часы и remote-плитку через actor, переключение reduced-motion, eco, Custom и0 script errors — PASS (`TestReports/theme-premium-integration.json`). Tile fixture всех9тем:2–14 прямых узлов/сцена, cap3, press replacement, finite expiry и destroy — PASS (`theme-tile-quality.json`). Привилегированный chrome fixture не доказывает подавление untrusted веб-событий; это явно отмечено в отчёте. Atmosphere fixture: бюджеты узлов, два отклика/expiry, paused/eco/battery/motion/custom и destroy — PASS (`theme-atmosphere-quality.json`). Реальные covers.css/JPEG плиток с trusted hover сняты для9тем (`theme-tiles-visual.json`, premium-tile-*.png). Независимое визуальное ревью: `theme-art-review.md`; сохранённые часы Volt яркие/глитчевые, часы Cherry на светлой луне менее контрастны — существующие особенности, не изменённые этой задачей. Предыдущие модули сохранены в Backups/theme-premium-20261008.

## Актуально: вкладки, библиотека, разрешения и музыка в стиле B · 8 октября 2026

Владелец одобрил развитие внешки вкладок с особенностями тем, боковую библиотеку, fullscreen и панели разрешений. Отказался от предложений новых хоткеев/Ctrl+Tab; для музыки добавлены непосредственно кнопки меню B. Старые встроенные сочетания не менялись.

BladeTabSurfaces.uc.js 1.0.0 (@loadOrder 120): новая объёмная форма вкладок, материал B, читаемые selected/hover/pending/multiselected, штатные favicon/close/audio controls. Нижняя SVG-кромка не перекрывает текст: Red клинок, Blood ярко-красный глянцевый потёк, Purple грани, Green дорожки, Grey металл, Orange жар, Cherry лепестки, Midnight волны, Volt молния. Custom только нейтральная кромка, без собственного эффекта конструктора. Однократные отклики hover/select ограничены 470мс; маленький индикатор музыки только soundplaying без mute, motion-off/reduced-motion прекращают анимации. Убраны старые ромб/пульс/слэш вкладки в scoped CSS. USER_SHEET перекрывает прежние правила Materials; marker делает общий лист неактивным после destroy. TabClose удаляет принадлежавшие вкладке узлы/таймер; native tab handlers не подменяются. Из userChrome.css удалены только старые dragtarget rotate/transition, мешавшие native inline transform; резервная копия Backups/userChrome-before-tab-surfaces.css.

BladeSidebar.uc.js 1.0.0 (@loadOrder 118): новая кнопка «Библиотека» перед B и отдельная панель внутри #browser. История/закладки через native Places query, максимум 80 результатов, поиск с debounce140мс; аккаунты через BladeAccounts. Ссылки сохраняют userContextId текущей вкладки. Скрытие удаляет строки, destroy удаляет кнопку/панель/listeners/observers. Прежнюю скрытую verticalTabs-панель не включает; новых хоткеев и polling нет.

BladeSitePanels.uc.js 1.0.0 (@loadOrder 120): настоящие permission/identity/notification popups оформлены материалом B, native предупреждения и действия сохранены. Fullscreen изменяет только плавность штатного margin-top до 170мс; DOMfullscreen исключён. Из-за USER !important конфликтов fullscreen получает отдельный USER_SHEET с unregister на destroy. Включение fullscreen/prefs/методы FullScreen не подменяются.

BladeMusic.uc.js 1.0.0 (@loadOrder 116) + BladeMenuPopup1.3.1: постоянная карточка YouTube Music над звуком интерфейса. Трек/исполнитель, предыдущий/пауза-продолжить/следующий/открыть сайт. Точное ограничение host music.youtube.com; per-tab native browsingContext.mediaController/getMetadata/supportedKeys/prevTrack/pause('user')/play/nextTrack. Не запускает спящие вкладки ради чтения метаданных; кнопки неподдержанных действий отключены. Слушатели MediaController действуют только пока меню открыто, popuphidden слушается напрямую на popup; закрытие снимает их. Производственной инъекции на сайты, собственных медиахоткеев и polling нет. Часы, обои и принятые звуки не менялись.

Проверки: node --check для всех модулей; tabs_surface_check.py — 10 тем, native inline drag transform/native move, audio/mute, motion-off, TabClose/destroy и отсутствие ScriptError (tabs-surfaces-quality.json). Просмотрены реальные Marionette снимки tabs-red/blood/volt.png; физический drag мышью не проверялся. sidebar_check.py — реальные Places fixtures, geometry/search/accounts/container/hide/destroy (sidebar-quality.json), просмотрен sidebar-render.png. site_check.py — реальные permissions/revoke, actual identity shadow slot и notification buttons, native fullscreen hide/show, motion-off и USERsheet cleanup (site-quality.json); устойчивое открытие OS popup и физический указатель в скрытом тестовом окне отдельно не подтверждены. music_mock_check.cjs + music_check.py — host scope/pending, настоящая локальная аудиосессия, pause/play/next/previous/live metadata/hide/tabclose (music-quality.json). Music runtime fixture только localhost с временным тестовым currentURI getter; реальный авторизованный YouTube Music не тестировался. Getter/prefs/DNS восстановлены; попытка TLS fixture не меняла глобальный trust/HSTS, её helper и временные сертификаты удалены. После загрузки финальных файлов с диска все четыре runtime-проверки повторно прошли; новых ScriptError нет (browser-b-integration.json). Изолированный профиль и HTTPhelper остановлены. Нормальный тестовый F-браузер перезапущен в 14:06; свежие marks вкладок/библиотеки/Menu1.3.1 и HEALTH GREEN подтверждены. Установленный C-браузер не менялся и не перезапускался.

## Актуально: загрузки и контекстные меню в стиле B · 8 октября 2026

По одобренному запросу добавлен BladeActionPanels.uc.js 1.0.0 (@loadOrder 115). Штатная панель Downloads оформлена материалом текущей темы: шапка/число текущих передач, карточки файлов, отдельные скорость и ETA из Download.speed/currentBytes/totalBytes, читаемый прогресс, кнопки и footer. Завершённые существующие PNG/JPEG/WebP до 8 MiB получают локальные миниатюры 52px; другие файлы сохраняют штатную иконку. Изображения декодируются только для открытой панели, очищаются после закрытия. События progress/state/exists объединяются RAF; постоянного polling нет. Сохраняются native pause/restart/open/show/remove и drag через DownloadsView._onDownloadDragStart.

Content/tab/download/toolbar context menus и вложенные подменю получают тот же материал, компактные пункты, разделители и акцент выбранного действия. Дополнены штатные --menuitem-icon для действий вкладок/загрузок. Menu B, адресная строка, часы, темы и звуки не переделывались. Destroy удаляет стиль, шапку, images/metrics, observers/listeners и восстанавливает изменённые иконки. Popuphidden слушается напрямую; отменённое/закрытое состояние sync очищает ресурсы, старое hidden при reopening проверяется в одном RAF.

Проверки: node --check; TestReports/actions_check.py — PASS с настоящими Downloads и локальным HTTP: completed PNG preview, активный progress/status, отдельные скорость/ETA, cancel/restart и completion, native file drag data (application/x-moz-file + file URI), открытие tab context и штатная команда Duplicate, темы, cleanup без ScriptError. Отчёт actions-quality.json. Физическое перетаскивание в стороннюю программу тест не выполняет. Визуально просмотрен actions-downloads-render.png: копия native card content с теми же стилями внутри chrome, поскольку Marionette screenshot не захватывает отдельные XUL popup windows. Native context popup проверен по DOM/команде, отдельного снимка нет. ui.popup.disable_autohide включался только на время теста в отдельном профиле и сброшен после. Сервер actions_fixture_server.py и изолированный профиль остановлены после проверки.

## Актуально: адресная панель и превью вкладок в стиле меню B · 8 октября 2026

После замечания владельца удалены из адресной панели старые секции recent searches/top sites и заголовки групп, накладывавшиеся на строки. Модуль 1.0.1 отключает browser.urlbar.suggest.recentsearches, suggest.topsites и groupLabels.enabled; резервный CSS убирает row[label]::before. История и плитки новой вкладки не удаляются. Node и Gecko empty/typed query без legacy providers/labels, обычные результаты сохранены — PASS (TestReports/urlbar-legacy-cleanup.json).

Владелец одобрил развитие адресной строки и карточек вкладок в визуальном языке меню B. Новый BladeSurfacePanels.uc.js 1.0.1 (@loadOrder 110) оформляет штатную адресную панель единым материалом текущей темы: строки с иконками, акцент выбранного результата, выделение совпадений, подсказка клавиш и ограничение высоты результатов с прокруткой на небольшом окне. Штатные Places, поиск, стрелки, Enter и Escape сохраняются. Меню B и звуки не изменены.

Превью использует существующие tab-preview-panel и PageThumbs Firefox 155: нативный canvas 280×140 с учётом DPR, оформление тем, название/домен, иконка сайта, live-статусы audio/mute/loading/pending и контейнер аккаунта. Собственного движка снимков, polling и дискового кеша нет. Спящие вкладки не будятся ради изображения; выбранная/спящая вкладка сохраняет нативный режим без снимка. Изображение метаданных очищается после закрытия, изменения фоновой вкладки не подгружают его снова. Listener/style/DOM cleanup на unload/destroy. Поддержаны reduced-motion и существующий data-blade-material-motion=off. В этом билде hoverPreview.enabled/showThumbnails по умолчанию true; настройки превью не менялись.

Проверки: node --check; TestReports/surfaces_check.py в отдельном Gecko-профиле — PASS: реальный ввод и Places-результаты, стрелки/Escape/Enter, 10 материалов, окно 780×640, настоящее изображение через native preview controller, live audio/mute, отсутствие capture для pending, освобождение закрытой вкладки, motion-off и destroy без ошибок. Native preview активирован событием mouseover + штатным controller, поскольку Marionette pointer не удерживает :hover в chrome; физический hover отдельно этим тестом не подтверждён. Отчёт surfaces-quality.json. Просмотрены surfaces-address.png и surfaces-address-compact.png; surfaces-thumbnail.png содержит настоящий снимок. Для визуального ревью surfaces-preview-render.png зеркалит native content/styles со снимком в chrome: Marionette не захватывает отдельное XUL-окно popup. Тестовая страница surfaces-fixtures/library.html локальная, сервер остановлен после проверки.

## Актуально: первые звуки до ASMR · 8 октября 2026

Владелец уточнил: нужен самый ранний набор игровых/тональных откликов, до ASMR, барабанных касаний и всех дальнейших переделок. Прежняя интерпретация «второй вариант = ASMR 2.1» была ошибочной. Возвращены исходные палитры, нотные последовательности и PCM-синтез BladeSounds 2.0.0 из истории текущей задачи 08:22 UTC: лакированная сталь, электрический импульс, стекло, синтезатор и другие первоначальные тембры. Runtime 2.0.1 сохраняет исходный master 0.18; только исправления громкости, ограничения голосов, API и очистки Downloads. Меню и визуал не менялись.

Проверки: node --check и TestReports/sounds_first_check.py — PASS для 60 клипов, 10 тембров, реальных событий вкладок, volume/mute, смены темы, suspend и destroy. Отчёт TestReports/sounds-first-quality.json; предыдущий ASMR сохранён в Backups/sounds-before-restore-first-game-tones.uc.js.

## История: ошибочно выбран ASMR-вариант · 8 октября 2026

По просьбе владельца восстановлены палитры и синтез второй ранней версии BladeSounds 2.1 (ASMR), до механических записей и наборов 3.x. Исходные правки восстановлены из истории этой задачи от 08:28 UTC 8 октября. Текущий модуль 2.1.2 сохраняет звук 2.1 без новых слоёв; оставлены ограничения трёх голосов, подавление дубля open/select, управление громкостью, отключение и исправление очистки Downloads.removeView. Меню и визуальные эффекты не менялись.

После жалобы на неслышимость исправлен уровень: в 2.1.1 выходной RMS клика был от −59 до −54 dBFS. MASTER увеличен с 0.065 до 0.26 (+12 dB); максимальный пик всех 60 клипов при 100% составляет 0.0394, без изменения формы/тембра. Render теперь учитывает реальную громкость и quietGain, как воспроизведение. Повторная проверка в Gecko прошла, в тесте задан нижний порог выходного пика; в рабочем профиле звук включён, громкость по умолчанию 100%.

Проверка: node --check; TestReports/sounds_rollback_check.py — 60 клипов, 10 различных тембров, плавные края, события вкладок, громкость/mute, смена тем, переход AudioContext в suspend и очистка без ошибок. Отчёт: TestReports/sounds-rollback-quality.json. Предыдущий модуль сохранён в Backups/sounds-before-restore-2.1.uc.js.

# Карта проекта Blade

## История: короткие клики без барабанного корпуса · 2026-10-08

Владелец отверг3.0 как «по барабану бьёшь». В3.1 полностью удалены тональные моды, низкочастотный удар, жидкие pitch-sweep и звонкие хвосты. Авторские60WAV пересозданы как короткие45–80мс широкополосные щелчки с индивидуальными спектром/атакой/затуханием для10тем; ни записей клавиатуры, ни осцилляторов не используется. Доля энергии ниже500Гц максимум0.0073%, выше4кГц максимум0.00021%; пикPCM0.45, master0.1 => одиночный выходной пик≤0.045при100%. Готовые WAV воспроизводятся напрямую; runtime, volume/mute, cap3, idle/cleanup сохраняются. Рецепты `TestReports/generate_custom_sounds.py`, параметры/метрики/hash `audio/custom/manifest.json`3.1.0. Gecko60вариантов/10тембров/nativeevents/volume/mute/idle/destroy — PASS. Приятность остаётся субъективной оценкой владельца. Образцы `custom-sounds-preview.wav` и `sound-previews/index.html` обновлены. Меню и визуальные эффекты не менялись.

## История: оригинальные звуки3.0 отклонены как барабан · 2026-10-08

Владелец окончательно отверг37мс клавишный тик2.5 и дальнейшую обработку этих записей2.6: попросил создать приятные кастомные звуки с нуля на наш вкус. `BladeSounds.uc.js`3.0.0 воспроизводит60готовых оригинальных WAV из `chrome/audio/custom`:10тем×6действий. Ни клавиатурные записи, ни предыдущие звуки, ни Operaаудио не являются входными данными. Red — упругий мягкий щелчок, Blood — жидкая капля, Volt — стекло, Cherry — дерево, Grey — сухой бархатный клик, Orange — керамика, Midnight — спокойная вода, Green — бамбуковое касание, Purple — приглушённый кристалл, Custom — нейтральное мягкое нажатие. Различаются собственные моды, зернистая текстура, атака и затухание; действия сохраняют характер своей темы.

Авторские рецепты и воспроизводимая сборка: `TestReports/generate_custom_sounds.py` (NumPy), параметры/метрики/SHA256 — `audio/custom/manifest.json`. Файлы105–210мс, всего849KB; плавные края, выравниваниеRMS и отдельный потолокпика. Runtime не синтезирует и не фильтрует: читает60PCM, cacheдо60AudioBuffer, максимум3голоса, livevolume/mute, idle suspend/cleanup. Master0.1, итоговый одиночныйпик не выше0.055при100%. РеальныйGecko60вариантов/10тембров, nativeopen/close, cap3,volume/mute,debounce,idle/destroy,0ошибок — PASS (`sounds-quality.json`). Субъективнуюприятностьпроверяетвладелец. Образец10темпоодномуоткрытию: `TestReports/custom-sounds-preview.wav`, порядоккаквmanifest; меню умеетпрослушатьтекущуютему.

Попытка генерации через fal была отклонена до создания задания: balance_exhausted. Владелец уведомлён один раз; платных заданий/нового пополнения/смены аккаунта не было. Набор создан локально. Принятое меню, часы, эффекты, обои и аккаунты в этой доработке не менялись.

## Актуально: меню с превью и крепление крови к цифрам · 2026-10-08

Новый дизайн меню владелец принял и попросил развивать. `BladeMenuPopup.uc.js`1.3.0: компактные6разделов,10карточек тем с материалами и SVGпризнаками эффектов, hover/focus без постоянных циклов, текущая тема в шапке, постоянный mute/volume/preview. Фон:39карточек,29реальных изображений и10статических образцов живых фонов; сохранены папки/выбор своих файлов. «Облики» и их сохранение удалены из меню по просьбе владельца. Миниатюры привязаны к фактическим границам scroll-body, src только возле viewport, очистка на popuphidden/rebuild/unload. Gecko IntersectionObserver внутри nativeXUL неправильно объявлял все29картинок видимыми, поэтому заменён явной проверкой геометрии с coalesced RAF по событиям. При проверке сверху7из29изображений загружено, остальные подгружаются при прокрутке (`menu-wallpapers.json`).

`BladeHeroClock.uc.js`1.4.1: Blood потёки закреплены на нижнем непрозрачном крае конкретных цифр, найденном по шрифтовому raster и DOM Range. Каждый резервуар перекрывает реальную кромку; общая baseline/digit-x вместо долей всей строки.72комбинации времени, размера, шрифта и DPR — PASS (`blood-clock-contact.json`). Canvas полнотекстовый advance может отличаться от DOM tabular-nums (SegoeUI:0.9px), поэтому контакт проверяется для отдельной цифры с её DOM-позицией. Исходные часы Volt сохранены и проверены после завершения theme event.

Звук `BladeSounds.uc.js`2.5.0: владелец отверг синтез2.3 и полные записи нажатия/отпускания2.4; одобрил короткий сухой мягкий «тик» без отпускания. Из10CC0записей StavSounds вырезаны только37мс атаки; PCMpeak0.8, master0.1125, выходной пик0.081–0.090. Одна запись на событие, без добавленных игровых слоёв/мелодий. ready() асинхронно читает10локальных WAV, render() послеready возвращает реальные PCM/gain/source. ОригинальныеMP3 и происхождение сохранены в chrome/audio/keyboard/README.md. РеальныйGecko:60вариантов, выбор/открытие/закрытие, cap3,livevolume/mute,idle/destroy,0ошибок — PASS (`sounds-quality.json`); прослушивание `sound-previews/index.html`. Официальные образцы GXMod_Template сравнены по длительности/энергетической огибающей в памяти; неизвестная лицензия не позволяет включать их вбилд. Точного совпадения на слух не заявляем. Не возвращать полный звук отпускания клавиши.

Добавлен крупный предпросмотр обоев кнопкой⤢: настоящее изображениеcontain, название,Назад/Применить,Escapeзакрываеттолькоpreview,focus/inert/источниккартинки очищаются. Galleryguard поev.target иstalehidden/reopened сохраняетминиатюрыпослеповторногооткрытия. Geckopreview/Escape/Apply/currentselection/cleanup — PASS (`menu-zoom.json`);6разделов,10тем,аккаунты,volume,отсутствиеОбликов — PASS (`menu-remade.json`).

## История: синтез механических звуков (отклонён) · 2026-10-08

Владелец отклонил тихие синусные попы: нужны слышимые клики механической клавиатуры и более выразительное меню. `BladeSounds.uc.js`2.3.0 полностью заменяет звуковой генератор: короткий широкополосный импульс переключателя, возбуждённые резонансы корпуса и отдельный возврат клавиши. Десять материалов; смена темы, загрузка и обновление добавляют свои защёлки/затворы/контакты/храповики. PCM нормирован до0.8; выходной пик при100% составляет0.128–0.160, без клиппинга. `render` теперь учитывает текущую громкость и ночное смягчение. Сохраняются mute, живой volume, cap3, подавление двойного TabSelect, idle suspend и cleanup.

Реальный Gecko:60вариантов,10разных тембров, finite/DC/границы PCM, штатное открытие/закрытие, cap3, volume/mute, debounce темы, suspend и destroy — PASS (`TestReports/sounds-quality.json`). Образцы `TestReports/sound-previews/index.html`. Приятность звучания оценивает владелец; программная проверка подтверждает параметры и воспроизведение.

## История: исправление отсутствия звука (заменено версией2.3) · 2026-10-08

В рабочем профиле обнаружен `blade.sounds.on=false`: после обновления звуки оставались выключены. По просьбе владельца звук включён, master поднят с0.065 до0.13 (+6dB); характер кликов/попов/всплесков не менялся. Все60вариантов и mute/volume/native tabs проверены повторно (`sounds-quality.json`), пик одного звука<0.025 при volume100. Диагностический mark2.2.1 записывает enabled/volume рабочего окна.

## История: тихие звуки тем (отклонены владельцем) · 2026-10-08

Актуальное пожелание: приятные тихие клики, попы и водяные всплески. Громкие писки/звон и ASMR-шорохи с глухими ударами отклонены. `BladeSounds.uc.js`2.2.1 заменяет прежние square/saw и громкий startup-шинг короткими чистыми многослойными PCM-звуками, без шумовой атаки и мелодичных фанфар.

Десять разных материалов: Red — упругий клик; Blood — плотный жидкий поп; Volt — электрический микроклик; Cherry — лёгкий деревянный поп; Grey — клавишный клик; Orange — тёплый округлый поп; Midnight — водяной всплеск; Green — цифровой клик; Purple — пузырёк; Custom — нейтральный мягкий клик. Шесть действий: выбор/открытие/закрытие вкладки, тема, загрузка, обновление. Общий тихий master0.13, существующие volume/mute и ночное смягчение сохранены. Нет постоянной фоновой дорожки. TabOpen/Close подавляют повторный TabSelect, быстрые смены темы объединяются. Максимум3голоса, кэш не более60буферов, контекст засыпает после idle; события/prefs/Downloads очищаются на unload.

**Проверки:** реальный Gecko: все60PCM без NaN/клиппинга, начало/конец0, пик итогового одиночного звука<0.025 при volume100;10различных тембров. Штатные вкладки, cap3, live volume/mute, смена темы, idle suspend и destroy без ошибок — PASS (`TestReports/sounds-quality.json`). Найден и исправлен неправильный вызов .catch у синхронного Downloads.removeView. Прослушиваемые образцы: `TestReports/sound-previews/index.html` (выбор/открытие/закрытие для каждой темы). Субъективная оценка последнего варианта остаётся за владельцем. Рабочий F-билд обновлён; внешний C-профиль не изменялся.

## Актуально: исходные часы Volt и проверка аккаунтов · 2026-10-08

Владелец попросил вернуть часы Volt «те что были с самого начала правок». В `BladeHeroClock.uc.js`1.4.0 для Volt отключён весь новый clock styling (`data-hc-ready` отсутствует), восстановлен исходный циферблат из неизменённого `BladeNewtab.uc.js`: шрифт, цвет, градиент, тени, секунды и анимация. Canvas часов и обработчик наведения удалены. Новая атмосферная дуга Volt и остальные темы сохранены. Сравнение computed styles с полностью выключенным HeroClock совпало для циферблата, цифр и секунд; Blood сохраняет собственное оформление (`TestReports/clock-restore-accounts-full.json`). Не возвращать электрический overlay или новую жёлтую поверхность часов без нового запроса владельца.

Мультиаккаунт проверен заново на изолированном тестовом HTTP-сайте с настоящей серверной login/logout логикой и HTTPOnly session cookie: A/B входят независимо; logout A удаляет его серверную сессию, B остаётся авторизован; после перезапуска B сохраняет вход. Cookies/localStorage, rename/цвет, меню/dispatcher, manager и private guard — PASS (`TestReports/accounts-runtime-8.json`, `accounts_runtime_verified.py`). В полной dev-сборке API доступен, меню Система отображает контейнеры, вкладка получает видимое имя; node-проверка guards/cleanup PASS. Личные аккаунты не использовались. Контейнеры устраняют необходимость выходить из другого аккаунта; серверный срок действия/отзыв сессии по-прежнему контролирует сайт.

## Volt: живой плазменный пробой · 2026-10-08

Владелец отклонил статические SVG-зигзаги как дешёвые и стандартные. Volt переведён на процедурную электрическую дугу: нарастающий лидер, горячая жила с локальной короной, ответвления и повторный удар по изменённому каналу. Концы дуги закреплены; никакой летящей частицы с хвостом. Цифры получили статический металлический рельеф вместо плоской жёлтой заливки; Zen Dots и читаемость сохранены.

- `BladeElectricArc.uc.js` 1.0.0 (`loadOrder94`): общий Canvas renderer часов и атмосферы, рекурсивное дробление канала/ответвлений, три варианта геометрии на удар, различный seed на следующий удар. Отрисовка только во время650мс события, 30fps (balanced24), затем RAF отсутствует до нового события. Canvas учитывает реальный размер/DPR до2. Режимы остановки отменяют RAF и timeout, очищают поверхность; destroy освобождает backing store и controller. Resize во время удара возвращает планировщик в idle — баг выявлен независимым ревью и исправлен.
- `BladeHeroClock.uc.js` 1.3.0: один Canvas на область цифр, запуск по наведению/смене минуты/активации и редкие автоматические удары. Статические SVG-пути и conductor-pulse удалены; Blood и другие темы не менялись.
- `BladeHeroAtmosphere.uc.js` 1.6.0: Volt — Canvas с двумя локальными каналами у краёв страницы (один в balanced), renderer=`electric`. Повторное измерение при появлении newtab/resize; при смене темы контроллер уничтожается. Blood/Cherry/Grey SVG и исходная атмосфера остальных тем сохранены.

**Проверки:** реальный Gecko — изменяющиеся пиксели дуги, hover, отсутствие отрисовки в idle, resize посреди удара, DPR125%/200%, Eco/reduced/сворачивание и30 смен тем без утечек (`electric-arc.json`). Автоматический удар атмосферы и возврат в idle (`electric-ambient.json`). В тесте CPU-время отдельной paint-функции доходило до1,7мс при DPR1; это не полный замер GPU/FPS. Регрессия10тем/ошибок — `hero-quality.json`. Запись: `volt-plasma-clock.gif`. Художественная оценка владельца ещё не получена. Рабочий профильF обновлён; установленный профильC, плитки, обои и публикация не затронуты.

## Усиление спецэффектов тем · 2026-10-08

Актуальное пожелание: Volt должен бить шокером, а не выпускать частицы с хвостами; другим темам нужны более характерные спецэффекты. Фактический исходник всё ещё содержал старый нижний Volt zigzag, несмотря на описание предыдущего среза. Этот мотив удалён. Принятые плитки, Blood, обои и базовый CSS сохранены.

- `BladeHeroClock.uc.js` 1.2.0: Volt — читаемые насыщенные жёлтые цифры Zen Dots (зарегистрированный псевдоним `blade-aurora`); два разных рисунка ветвящегося разряда непосредственно поверх области цифр. Короткие прерывистые удары раз в 6,2 секунды, дополнительный пробой при наведении и смене минуты. Геометрия привязана к измеренной области шрифта; 8 узлов Volt, нижний мотив пустой. Blood не изменён.
- `BladeHeroAtmosphere.uc.js` 1.5.0: Volt — четыре стационарных канала электрического пробоя, разные ветвления и повторный удар по другому маршруту (55 узлов; balanced 34). Cherry — редкая волна трёх детальных лепестков; Grey — маленькие осколки после рассечения. Максимум 71 узел, reduced/battery/Eco/hidden соблюдены. Blood сохранён, исходная атмосфера остальных пяти тем сохранена.
- `BladeThemeEvents.uc.js` 1.0.0: дополнительные редкие события поверх исходных Red/Orange/Midnight/Green/Purple и локально возле цифр. Red — короткий удар с красными осколками; Orange — всплеск углей; Midnight — звёздная вспышка с расходящимся кольцом; Green — цифровой пробой; Purple — грани кристаллов и локальные блики. Активна одна сцена выбранной темы, максимум 70 узлов для атмосферы и часов вместе. Eco/батарея очищают слой; reduced/hidden ставят паузу; balanced уменьшает число элементов. Custom не получает отдельной сцены.

**Проверено в Gecko:** десять тем, реальный SVG namespace, отсутствие хвостов и нижнего Volt zigzag, наведением запускается разряд; Zen Dots действительно загружен. Eco/battery/reduced/сворачивание, balanced и 40 переключений без дубликатов; консоль модулей без ошибок (`TestReports/theme-specials.json`). Общая проверка часов/атмосферы и масштабы125%/200% — PASS (`hero-quality.json`, `hero-edge.json`). Кадры активных фаз: `specials-volt.png` и остальные `specials-*.png`. Анимации используют opacity/transform, без JS кадрового цикла; отдельный замер FPS/GPU не проводился. Новая художественная оценка владельца ещё не получена. C-профиль и публикация не затронуты.

## Часы и атмосфера: актуальное направление · 2026-10-08

Владелец разрешил обновление часов, отменив прежнее указание сохранить их. Эффекты должны сохранять живой характер: падение, течение, пепел и лепестки. Геометрические рамки и летящие частицы с хвостами отклонены. Конструктору не назначать отдельную новую атмосферу или собственный эффект часов.

**Blood: актуальный ориентир — принятая кровь на плитках.** Рассечения, поверхностные пятна и прежние летающие капли отклонены. Последнее уточнение владельца: кровь накапливается на кромке и скапывает вниз. Использованы исходные четыре органические формы и влажный материал TileFx: #30040c/#6e0918/#a91e30/#440612, блик #d17783. Поток вырастает, на конце набухает капля, шейка сужается, капля отделяется и падает строго вниз с ускорением. Последняя версия ещё требует художественной оценки владельца.

- `BladeHeroClock.uc.js` 1.1.0: три тонких потёка закреплены на нижней кромке цифр, измеренной через baseline и Canvas descent. Циклы разнесены на 6,4–7,8 секунды; Blood 27 узлов. Читаемая насыщенная красная поверхность цифр сохранена. Прежний Blood motif удалён. Остальные темы сохранены.
- `BladeHeroAtmosphere.uc.js` 1.4.0: четыре канала с верхней кромки, последовательность накопление/отрыв, 59 узлов максимум. Red/Purple/Green/Orange/Midnight используют принятую исходную атмосферу; Cherry/Grey/Volt сохранены. Custom без новой собственной сцены. SVG через DOMParser/importNode.
- `BladeTabDestruction.uc.js` 1.3.0: кровь стекает с нижней кромки визуальной копии закрываемой вкладки, четыре канала (три в balanced), 34 узла. Последняя капля заканчивает движение на 1575 мс, очистка на 1600 мс. Штатное закрытие не задерживается; максимум три сцены, отмена/очистка при отключении эффектов.

**Проверки:** синтаксис трёх модулей; живой Gecko — десять тем, legacy/vector/none, Eco/батарея/reduced motion/скрытая страница и отсутствие ошибок модулей (`hero-quality.json`). Реальное закрытие вкладки шириной225 px: четыре stream/reservoir/neck/drop, SVG namespace, 34 узла и полная очистка (`blood-tab-close-refined.json`, GIF). Независимое ревью подтвердило порядок фаз и предел времени. Принятый TileFx, Newtab, обои и базовые CSS не изменялись. GitHub не опубликован.

## Реализовано: уничтожение вкладок и выделение текста · 2026-10-08

- [x] `JS/BladeTabDestruction.uc.js`: Red — диагональный разрез; Blood — стягивание поверхности и тонкие тёмные потёки; Volt — электрический разлом; Cherry — лепестки; Orange — угли; Midnight — звёздное рассеивание; Green — цифровые фрагменты; Grey — металлические пластины; Purple — кристаллы; Custom — кольца выбранного цвета. Штатное закрытие не задерживается; визуальная копия без событий, максимум три сцены, очистка через секунду. Legacy TabClose эффект WindowFx пропускается при наличии нового модуля. Eco, батарея, сворачивание и reduced motion выключают сцены.
- [x] `BladeThemeEngine` 1.2.2: выделение настоящего текста адресной строки и поиска следует теме, Custom учитывает выбранный цвет. Контрастный чёрный/белый текст выбирается по относительной яркости. Согласованы lightweight-theme tokens и scoped USER selection sheet.

**Причина старого синего выделения:** Gecko 155 использует нативные `ui.highlight` / `ui.highlighttext`; старые `ui.textSelectBackground` / `ui.textSelectForeground` не входят в перечень LookAndFeel prefs. Одного computed `::selection` было недостаточно: CSS показывал правильный цвет, но нативное поле рисовало прежний. Проверено по [исходнику Gecko](https://searchfox.org/mozilla-central/source/widget/nsXPLookAndFeel.cpp) и реальным скриншотам поля. Неактивное выделение сохраняет цвет темы через `ui.textSelectDisabledBackground`.

**Проверки:** `TestReports/tab-close-selection.json` — десять сцен, отсутствие двойного legacy эффекта, 6–25 дочерних узлов, cap 3, cleanup, Eco/reduced и консоль без ошибок; `selection-rendered.json` — десять тем, по 1528 реально отрисованных пикселей нужного акцента в выбранном тексте. Нативное закрытие стабильной вкладки с `animate:true` проверено отдельно (ширина сцены 225 px). Записи: `tab-destruction-blood.gif`, `tab-destruction-grey.gif`, `tab-destruction-volt.gif`. Часы, обои и принятые hover эффекты не менялись. GitHub не опубликован.

## Приоритеты владельца · 2026-10-07

Выбраны функциональные доработки: мультиаккаунты реализованы в dev и проверены; удобное управление сохранёнными сессиями остаётся в плане. Все девять одобренных визуальных доработок реализованы в рабочем тестовом билде и проверены в Gecko. Рабочие пространства, новый поиск вкладок, музыкальный мини-плеер и интерфейс управления тяжёлыми вкладками из последнего предложения отклонены; в план их не включать. Отказ от переделки часов 7 октября отменён новым запросом владельца 8 октября; актуальные требования записаны выше.

## Реализовано: визуальная доработка тем · 2026-10-07

Владелец одобрил четыре первоначальные идеи и пять дополнительных — все девять пунктов ниже. Сохранить нынешние темы, обои и принятые эффекты плиток; детализация обновлённого Blood — ориентир качества.

- [x] **Эффект выбора вкладки:** короткая анимация проходит по контуру выбранной вкладки и затихает. Индивидуальный характер каждой темы: Blood — влажный след, Volt — разряд, Grey — металлический отблеск; для остальных тем подобрать соответствующую им геометрию и материал.
- [x] **Появление меню:** меню раскрывается из точки нажатия, с аккуратной глубиной и отражением по краю. Для клавиатурного открытия использовать положение кнопки или штатную точку привязки меню.
- [x] **Переход между темами:** прежний эффект затухает, новый собирается по элементам интерфейса за 300–400 мс. Быстрое повторное переключение корректно завершает предыдущий переход.
- [x] **Материалы каждой темы:** Blood — тёмный лак и влажные блики; Grey — шлифованный металл; Midnight — глубокое стекло. Разработать различимые материалы для остальных тем, чтобы оформление отличалось и в статике.
- [x] **Индикатор загрузки страницы в стиле темы:** тонкий индикатор под адресной строкой, связанный с реальным состоянием загрузки. Blood — растекающийся тёмный след; Volt — пробегающий разряд; Grey — движущийся металлический блик. Завершать при окончании, отмене или ошибке загрузки; не имитировать точный процент, если движок его не сообщает.
- [x] **Оформление активной вкладки:** визуально соединить выбранную вкладку с панелью адреса через общий материал и глубину. Активная вкладка должна легко отличаться при включённых и отключённых анимациях; согласовать с отдельным эффектом выбора вкладки.
- [x] **Перетаскивание плиток:** плитка приподнимается над сеткой, остальные плавно освобождают место; при отпускании плитка садится с короткой реакцией выбранной темы. Сохранять штатное изменение порядка и корректно обрабатывать отмену перетаскивания.
- [x] **Объёмные значки панели:** чёткие формы, тонкие грани и отражения материала темы; короткое движение кнопки при нажатии. Сохранить узнаваемость значков, контраст и различимость недоступного состояния при разных масштабах.
- [x] **Адресная строка при фокусе:** рамка проявляется от места клика; результаты поиска связно раскрываются под строкой, выбранный пункт хорошо выделен. Для клавиатурного фокуса предусмотреть устойчивую точку начала; сохранить штатные ввод, выбор результатов и навигацию с клавиатуры.

**Художественные требования:** чёткие детали и сдержанные блики; без пересвета, детских одинаковых частиц, заливки обоев цветом темы или конфликта палитры с фоном. Не удалять принятую атмосферу и эффекты ради этих доработок. Материалы должны сохранять читаемость текста, значков и состояния выбранной вкладки.

**Оптимизация и проверка готовности:** короткие анимации по действию пользователя; учитывать Eco, батарею, скрытое окно и уменьшение движения. Проверить в живом браузере переключение вкладок, открытие меню мышью и клавиатурой, быстрое переключение тем, масштабирование и высокую плотность пикселей. Эффекты должны завершаться и очищаться без накопления узлов или постоянных циклов; статические материалы остаются различимыми при отключённых анимациях.

**Реализация:** `JS/BladeChromeMotion.uc.js` — контуры вкладок, переходы и настоящий progress listener; `JS/BladeMaterials.uc.js` — материалы, кнопки, меню и адресная строка; `JS/BladeEffectsVisibility/BladeTileDrag.sys.mjs` — сопровождение штатного перетаскивания Firefox. Child актор владеет обоими renderer. Legacy WindowFx пропускает заменённые эффекты при наличии ChromeMotion. Материалы XUL используют ограниченный USER sheet, HTML-эффекты — AUTHOR style. Часы, атмосфера, обои, базовые CSS и принятый hover Blood сохранены без изменения исходников.

**Проверки:** `TestReports/COSMETIC-PLANS.md`, `cosmetic-integration.json`, `cosmetic-drag.json`, `cosmetic-finish.json`, `cosmetic-edge-cases.json`. Десять разных материалов, контуры вкладок, переходы, меню/поиск, загрузка/отмена/ошибка, Eco/батарея/reduced motion/сворачивание, масштабы 125% и 200% — PASS. Штатное сохранение порядка плиток проверено через настоящие React drag handlers и перезагрузку; WebDriver pointer подтверждает подъём/preview, но не доставляет OS drop, поэтому завершение проверено DOM DragEvents. FPS/GPU замеры не проводились. Код не опубликован в GitHub.

## К реализации: восстановление сессий · 2026-10-07

- [ ] Проверить существующее восстановление Firefox и добавить удобное управление сохранёнными сессиями в Blade.
- [ ] Сохранять именованные наборы окон и вкладок; показывать дату и количество вкладок, позволять восстановить выбранную сессию.
- [ ] Добавить понятный доступ к недавно закрытым вкладкам и окнам, а также восстановлению после аварийного завершения.
- [ ] Сохранять порядок вкладок, закрепление, выбранную вкладку и контейнер каждого аккаунта; согласовать восстановление с мультиаккаунтами.
- [ ] Не сохранять приватные окна и вкладки в постоянные сессии.

**Проверка готовности:** сохранённая сессия восстанавливает окна, порядок и закрепление вкладок с правильными контейнерами; случайно закрытое окно можно вернуть; приватные вкладки отсутствуют в сохранениях. Использовать штатные механизмы Firefox, не копировать cookies или токены в файлы сессий Blade.

## Реализовано в dev: мультиаккаунты в контейнерах · 2026-10-08

- [x] Ручные универсальные контейнеры через штатный Firefox ContextualIdentityService/userContextId; без автоматических правил по доменам. Изоляция cookies/localStorage проверена на одном тестовом origin.
- [x] Меню B → СИСТЕМА → АККАУНТЫ / КОНТЕЙНЕРЫ: новая вкладка выбранного контейнера, штатное управление созданием/именем/цветом через about:preferences#containers. На вкладке XUL имя и штатный цвет identity.
- [x] «Главная сайта» открывает origin в другом контейнере без выхода, закрытия исходной вкладки или переноса cookies; userinfo/path/query/fragment не переносятся, чтобы не копировать URL-токены.
- [x] Штатное постоянство контейнеров и восстановление userContextId через SessionStore проверены restart тестового профиля; собственных файлов сессий Blade нет.

**Проблема владельца:** сейчас для входа в другой аккаунт приходится выходить из текущего; сайт при выходе сразу аннулирует его токен. Цель — устранить необходимость этого выхода через независимые сессии. Статус: реализовано в dev исходниках, не опубликовано.

**Границы:** контейнеры не делают токены вечными и не обходят серверный срок действия или отзыв. Продление сессии остаётся штатным механизмом сайта; не хранить и не копировать токены в карту проекта или отдельную общую базу.

**Проверки 2026-10-08:** `TestReports/accounts-runtime-7.json` — отдельный чистый профиль и loopback origin: A/B cookies и localStorage изолированы, контролируемая очистка A не затрагивает B; rename/цвет/labels, настоящие menu rows и dispatcher, переход в штатный manager, restart ID 6/7 и сохранение B PASS. Labels имеют ненулевые rect и visible. В приватном окне контейнерный API запрещён; после restart sentinel отсутствует в SessionStore.getBrowserState() обычного окна. Проверка ограничена: загрузку sentinel перед закрытием приватного окна не ожидали, файлы SessionStore на диске отдельно не проверяли. `TestReports/test-blade-accounts.cjs` — unknown ID, invalid/unsafe URL, origin-only без URL credentials, private guard и observer/label cleanup PASS. Синтаксис node --check PASS. Logout проверен как очистка тестовых данных, не как серверная авторизация; реальные личные аккаунты не использовались. Нативный editor не проверен кликами создания/переименования/цвета, runtime использует настоящий service API. Cleanup instrumentation живого окна и клавиатурный/визуальный обзор меню не выполнены. Crash/startup prefs dev-профиля не менялись: restart проверялся со штатным восстановлением, включённым только в тестовом профиле. Источник: `JS/BladeAccounts.uc.js`, минимальные пункты `BladeMenuPopup.uc.js`, enable/UI prefs `user.js`; темы/часы/атмосфера и боевой C: не изменялись.


> 2026-10-07, актуальное направление по требованию владельца: исходный
> вид тем восстановлен из `Backups/effects-wave-20261007-142831` — HERO_CSS
> и разметка атмосферы совпадают с базой, оптимизация таймера/пауза сохранены.
> Эксперимент с удалением атмосферы и нейтральными часами отменён.
> Новый `JS/BladeEffectsVisibility/BladeTileFx.sys.mjs` рисует многослойные
> эффекты наведения/фокуса внутри плиток: 10 разных сцен, 10–24 узла,
> максимум 3 сцены, удаление через 1550 мс, без кадрового JS-цикла.
> Child актор владеет renderer/lifecycle; Effects 1.1.0 передаёт mode/theme/
> accent/paused; Parent получает окно через `embedderElement.ownerDocument.
> defaultView` (`ownerGlobal` здесь не давал окно). Устранена гонка раннего
> наведения до handshake: pending-hit воспроизводится один раз при готовности.
> Старый одиночный SVG hover заменён renderer, исходные обложки/атмосфера/
> выбранный фон сохранены. Eco/батарея/неактивность отключают сцены.
> Проверки: `tile-layered.json`, `tile-power-final.json`, `tile-power-pause.json`;
> записи настоящего рендера: `tile-power-volt.gif`, `tile-power-cherry.gif`.


> 2026-10-07, корректировка по оценке владельца: Newtab 2.1.1 удаляет
> атмосферный слой целиком (DOM, SVG, частицы и CSS), вместо очередного
> изменения цвета. Часы нейтральные; тема не накладывается на обои.
> userContent: удалены погодные частицы/цветные виньетки и вспышка темы.
> Выбранные обои, включая самостоятельные анимированные фоны, сохранены.
> Акценты и короткие эффекты остаются на вкладках/кнопках/карточках.
> Проверка 10 тем × 3 режима: одинаковый фон, отсутствие atmosphere
> и погодных псевдоэлементов; `TestReports/effects-clean-wallpaper.json`.
> Эта запись заменяет направление полноэкранной атмосферы из записей ниже.

> 2026-10-07, художественная переработка: Newtab 2.1.0 заменяет широкие облака
> векторными контурами с отдельной геометрией 10 тем, убирает ореолы часов
> и дубли звёзд. WindowFx 1.2.0 — короткие контуры/следы вместо вспышек.
> userContent: карточки без 3D наклона, тонкие отражения, ослабленные Aurora/звёзды.
> Режимы, пауза, выбранный фон сохранены; проверки и снимок:
> `TestReports/effects-art-styles.json`, `effects-art-midnight.png`.

> 2026-10-07, локальная волна эффектов: все 10 тем получили усиленную атмосферу
> в `BladeNewtab` 2.0.0; `BladeWindowFx` 1.1.0 усиливает удар вкладки и ограничивает
> накопление распада. Новый `BladeEffects` (loadOrder 6) управляет `blade.fx.mode`
> (`vivid` по умолчанию / `balanced` / `eco`) и паузой неактивного окна.
> Пара `JS/BladeEffectsVisibility/*Child.sys.mjs` и `*Parent.sys.mjs` останавливает
> remote CSS-обои **только** about:newtab/home, отдельно для каждого окна.
> Меню B → СИСТЕМА → ИНТЕРФЕЙС: режимы эффектов; ПЕРФ: фактическое состояние.
> Палитра 1.3.0 ищет вкладки текущего окна (`@`), команды (`>`), веб (`?`),
> восстанавливает закрытую вкладку. SearchService в FF155 импортируется из
> `moz-src:///toolkit/components/search/SearchService.sys.mjs`, не Services.search.
> «Мой Облик» сохраняет Custom-цвет и режим. Perf 2.0.1 исправляет async VERSION,
> Engine 1.2.1 кэширует CSS с проверкой свежести и явной инвалидацией.
> Живые сценарии/скриншоты и границы измерений: `TestReports/EFFECTS-WAVE.md`.
> Источник правок — dev-профиль F:, бэкап `Backups/effects-wave-20261007-142831`.
> VERSION остаётся 2.1.0; волна не опубликована, боевой профиль C: не изменялся.

> 2026-10-07: тестовый профиль обновлён с 2.0.8 до **2.1.0** из официального
> `Blade-Full-v2.1.0.zip` (GitHub Latest, опубликован 2026-10-03). `main` и тег
> `v2.1.0` указывают на старый коммит `3dae359`: свежие изменения получены из
> релизного архива, а не через git pull; в рабочем дереве они пока не закоммичены.
> Собственный dev-движок: `FirefoxPortable\App\Firefox64\firefox.exe`, профиль:
> `FirefoxPortable\Data\profile`. Запуск: `Start-Blade-Dev.ps1`; `Blade-Eyes.ps1`
> теперь тоже использует этот движок. Старый `Skeleton-Stage` сохранён.
> Бэкап chrome/user.js и локальных правок установщика:
> `Backups\update-2.1.0-20261007-142339`. Проверки: SHA256 архива совпал,
> 333 файла профиля и 59 файлов движка совпали с релизом, node --check 32/32,
> запуск на dev-профиле — свежий `HEALTH: GREEN`, VERSION=2.1.0.
> Установленная копия на C: не обновлялась; публикации и push не выполнялись.

> Обновлено: 2026-09-25 · **v2.0.8 «Распад (Dissolve)» ОПУБЛИКОВАНА** в GitHub (deni41144/blade-browser, тег v2.0.8, Latest): патч 262 файла / 10.5 МБ, ассеты `Blade-Patch-v2.0.8.zip` + `.sha256`, guard 2c (личных файлов нет) пройден, дельта к v2.0.7 +20 файлов (5 шрифтов Hero-часов + лицензии OFL, 10 SVG-кнопок тем), удалений 0. Состав: фикс распыления (конвенция 34) + Dissolve v2 (осколки/ударная волна) + контекстное меню. Живая папка chrome прошита VERSION=2.0.8 / CODENAME «Распад (Dissolve)». Друзья получат апдейт автоматически через BladeUpdater в течение суток.
> 2026-09-27: **онбординг разработчика (zxvolfik)** — обновлён `BLADE-START-HERE.md` (конвенции 1–34, quick-start, актуальный конвейер), собрана поставка `Blade-Workstation-2.0.8.zip` (151 МБ: движок + chrome + `КАК-НАЧАТЬ.md` для не-кодера + `НЕЙРОНКЕ.md` — промпт для его Atria); процесс кооперации зафиксирован в секции «GitHub → Кооперация с разработчиком» — пакет собирается **только из закоммиченного main после `git pull`**, папки `Blade-Workstation-*/` в `.gitignore`.
> Пред. обновление: 2026-09-24 · v2.0.7 «Чистый Клинок» — **задеплоено в боевой профиль владельца** (`C:\Users\Deni\AppData\Local\Blade\Data\profile`, 263 файла + user.js, бэкап `Backups\combat-chrome-2026-09-24_16-23-49`, пофайловая сверка SHA256 263/263 + добит v2-апдейт распыления 2 файла). Боевой браузер был запущен — новый код применится после перезапуска владельцем. Осторожно: был жив старый монолит BobliksSettings 112КБ (v2.0.5) — деплой затёр его тонким шеллом 28КБ и доставил 10 декомпозированных скриптов; рассинхрон был бы критичен (двойное меню B / двойные эффекты).
> Ревизия 2026-09-22: починена волна киберпанк-контекстных меню (BladeContextMenu 1.0.1, конвенция 16); удалены низкокачественные обои Ember Flow (конвенция 18); разработана векторная SVG-иконка кнопки Blade (btn_blade.svg) с context-fill и дуговой вариант (конвенция 26); внедрена Волна 2 — 8 живых дышащих полотен-обоев на чистом CSS для всех тем (конвенция 29); внедрена Волна 4 — усиление атмосферных частиц AVA 3.0 на newtab: 3 плана глубины, плавный вход 1.4s, 4 состояния, насыщение green и red/custom (конвенция 30) — фиксы в dev-профиле, ещё не опубликованы; внедрена Волна 5 — Тулбар next-gen: оживление темы Custom на var(--accent), характерные асимметричные ритмы blood/cherry/volt, hover/[open] отклики кнопки B для всех тем (конвенция 32); внедрён эффект A12 (ударная волна при смене темы `theme:changed`: акцентный разряд .blade-theme-wave по #navigator-toolbox, BladeWindowFx + userChrome.css); внедрён эффект A13 (удар клинка при выборе вкладки `TabSelect`: вспышка акцентной линии .blade-tab-hit под табом, BladeWindowFx + userChrome.css).
> 🧹 **Обновлено 2026-09-16: репозиторий почищен** — стейдж-движок, легаси-установщик
> и генерируемая диагностика сняты с отслеживания, личные исходники/обои и движок
> вырезаны из истории, main и теги переписаны и перезалиты (см. «GitHub → Чистка репозитория»).
> **В РАБОТЕ: Blade 2.0 «Переплавка»** — суперглобальный рефакторинг-релиз со своим
> сетапом. Большой план: `ROADMAP-2.0.md`.
> ⚡ **ПРАВИЛО ВЛАДЕЛЬЦА (2026-09-13, захардкожено его словами):**
> «ТЫ ОБЯЗАН ИСПОЛЬЗОВАТЬ ВСЕХ СВОИХ АГЕНТОВ ПО НАДОБНОСТИ И НЕ ЗАБЫВАТЬ» —
> оркестратор НЕ работает в одиночку, когда есть профильная роль: Analyst (карты
> кода), FastHelper (механические аудиты), QAReviewer (аудит волн), FrontendDesigner
> (CSS по спецификации), Explore (кросс-поиск). Разведку перед любой хирургией —
> агентами. Забыл про агентов = нарушил правило владельца.
> **БЫСТРЫЙ СТАРТ — `BLADE-START-HERE.md`** (одна страница: пути, операции,
> правила). Эта карта — полный справочник.
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
| Перешить движковый патч плиток pinnedOnly | закрыть Blade → `.\Apply-Blade-Tiles.ps1 -AppDir <движок>` (идемпотентен) |
| Брендированный langpack (подписи+скраб+omni-хвосты) | закрыть Blade → `.\Apply-Blade-Langpack.ps1 [-AppDir <движок>] [-ProfileDir <профиль>] [-SkipLangpack] [-DryRun]` |
| Перебить иконки движка из Branding | закрыть Blade → `.\Apply-Blade-Rebrand.ps1 -AppDir <движок>` + rcedit |
| Зарегистрировать браузером по умолчанию | `powershell -File Patches\template\set-blade-default.ps1` |
| Бэкап профиля | `Blade-Backup.bat` |
| Диагностика кастома | смотреть `chrome\JS\*_mark.txt` (живой профиль) или `Blade-Diagnostic.bat` |
| История проекта | `git log --oneline` / `git status` — репозиторий в корне; личное и артефакты (профиль, Backups, zip, Output/bin/obj, Release/) в `.gitignore`. **Запушено на GitHub (2026-09-14, force):** вся история 2.0.1 + слияние с веб-коммитами README/LICENSE; ⚠️ история ПЕРЕПИСАНА (filter-branch: вырезан Skeleton-Stage/xul.dll 168МБ > лимита GitHub 100МБ + инвалидный на Windows «README.md.») — старые хэши из этой карты (c84ed99, 4ec8577, b264fbb, 4319ecb и др.) в `git log` больше не сходятся. **Переписана ВТОРОЙ раз 2026-09-16** (чистка репо: из истории вырезаны движок `Skeleton-Stage`, личные `Иконки` и диагностические скриншоты, теги переставлены, force-push) — актуальные хэши: main `ddd265a`, релизный `7759a13`, тег v2.0.2 `e0fa92f`; весь стейдж-движок теперь ВНЕ git (файлы остались только на диске), старая история лежит в бэкапе `F:\blade-repo-BACKUP-20260916.bundle` (подробности — «GitHub → Чистка репозитория») |
| Дизайн/вёрстка | НЕ делать молча самому: уточнить у Дени про Gemini (Antigravity) → добро → промпт по шаблону `Patches\gemini-prompt-*.md` → после работы GLM верифицирует и интегрирует |

## Команда: GLM + Gemini (обязательный тандем)

Браузер делается связкой двух моделей, и их взаимодействие — не опция, а правило:

- **GLM (ZCode, оркестратор)** — инженерия: диагностика по исходникам движка
  (omni.ja), архитектура (BladeCore, шина), конвейеры сборки/публикации,
  гит, релизы. Обязательно верифицирует ЛЮБУЮ внешнюю работу перед вкаткой
  (node --check, grep-инварианты, живые тесты, сверка с движком).
- **Gemini (Antigravity, фронтенд)** — дизайн: вёрстка, типографика,
  визуальные фишки. Во фронтенде он сильнее — дизайн-работа отдаётся ему.
- **FastHelper (Gemini flash через OMNIROUT, с 2026-09-12)** — быстрая
  механическая помощь оркестратору: аудит версий/счётчиков/расхождений
  файлов против документации, валидация JSON/YAML, regex, выжимки фактов
  из длинных файлов. Только чтение и доклад — код, архитектура и решения
  НЕ его зона. Первый вылов при боевой проверке: счётчик «10 uc.js» в
  карте при реальных 11 (исправлено, гит 6988760).
- **Протокол**: получив дизайн-задачу, GLM не делает её сам молча — он
  спрашивает у Дени «отдать Гемини?», Дени даёт добро. Дальше GLM пишет
  самодостаточный промпт (контекст + конвенции + факты движка + оригиналы,
  чтобы Gemini не наступил на собранные грабли), Gemini делает конфетку,
  GLM проверяет и интегрирует (патч + живой профиль + гит + релиз).
- Шаблоны промптов: `Patches\gemini-prompt-frontend.md` (v1.7.5 —
  демон-приветствие, анимации урлбара), `Patches\gemini-prompt-design.md`
  (типографика + своя страница ошибок + фишки — большая дизайн-волна).

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
├── BladeSetup\               WPF-установщик (C#): Blade-Setup.exe + data.zip (редизайн уровня Opera GX под бренд AVA 3.0, 2026-09-14)
├── Installer\                Inno Setup — ЛЕГАСИ, не используется
├── FirefoxPortable\          Dev-профиль (источник патчей)
│   └── Data\profile\
│       ├── user.js           Пресеты движка (~280 строк: перф/приватность/медиа)
│       └── chrome\
│           ├── userChrome.css   Темы UI (~1400 строк, 10 тем, секция 18 SIGNATURE)
│           ├── userContent.css  Темы newtab/сайтов/about: (~1050 строк)
│           ├── covers.css       ГЕНЕРИРУЕТСЯ BobliksCovers.uc.js — руками не править
│           ├── JS\              27 uc.js-скриптов (загрузка через utils\ fx-autoconfig)
│           ├── fonts\           Шрифты (OFL, только относительные url): Unbounded/Rubik/JetBrainsMono (кириллица, общие) + 9 демонических для часов тем (сабсет до цифр, суммарно 80КБ)
│           ├── img\             Фоны bg_*.jpg, themes\<домен>\<тема>.jpg, covers\
│           ├── resources\       blade-apply-update.ps1, set-blade-default.ps1, blade-backup.ps1 (кнопка в меню B)
│           └── utils\           Загрузчик uc.js (boot.sys.mjs и пр.)
├── Patches\
│   ├── Build-Blade-Patch.ps1     Сборка патча из живого профиля
│   ├── Publish-Blade-Update.ps1  Сборка + guard + публикация в GitHub
│   └── template\                 UPDATE.bat, blade-update.ps1, blade-apply-update.ps1,
│                                 set-blade-default.ps1, repo-README.md
└── Иконки\, Иконки старые\       Графические исходники
    TestReports\                  Стенды замеров: measure-ram.ps1 (RAM, клон профиля
                                  в %TEMP%\blade-ram-prof), make-ram-clone.ps1,
                                  ram-diet.csv, eyes-* (отчёты Глаз)
```

## Ключевые uc.js-скрипты (chrome\JS\)

| Скрипт | Версия | Роль |
|---|---|---|
| BladeCore.uc.js | 1.1.0 | Общий контракт `window.Blade`: THEMES, builtinBgs, bgPrefId, mark, prefStr, шина, runPsEncoded + реестр every/listen с авто-очисткой на unload (2.0). `@loadOrder 5`. ОТКЛЮЧАТЬ НЕЛЬЗЯ |
| BobliksSettings.uc.js | 1.14.5 | Бывший монолит меню «B» — после декомпозиции 351 строка: CORE (mark-диагностика + CustomizableUI-bootstrap), THEMES-реф (единственный источник — контракт `window.Blade.themes`), INIT (boot движка → плитки новой вкладки → docObs → downloads → shazam), API `window.BladeSettings` (тонкая делегирующая обёртка — каждый метод стрелкой в модуль) и финальный mark `OK init`. **Декомпозиция 2026-09-22 (1765→1644→1401→1387→1356→1168→1105→786→351 строк, шаги 1–8 — ЗАВЕРШЕНА):** шаг 1 — хозяйственный cleanup (BladeHousekeeping); шаг 2 — эффекты окна (BladeWindowFx); шаг 3 — авто-тема (BladeAutoTheme, первый пишущий модуль — внешний клиент API); шаг 4 — системные инструменты (BladeSystemTools: notifyBlade+launchBackup вынесены, оба вызова переведены на `window.BladeSystemTools.launchBackup()`); шаг 5 — конструктор темы (BladeThemeLab: диалог HSL вынесен); шаг 6 — облики (BladeVisages); шаг 7 — движок тем и фонов (BladeThemeEngine: весь кластер THEMES+BGS + стартовая последовательность `boot()`, `window.BladeSettings` стал тонкой делегирующей обёрткой); **шаг 8 — UI панели и виджет «B»** (BladeMenuPopup @11: MENU_CSS/BP_TABS/buildPopup + клик-диспетчер со всеми действиями вкладок, версия/кодовое имя, PERF, DNS_URI; BladeMenuButton @12: WIDGET_ID, прямая DOM-вставка, САМОМОНТ, keyset Alt+B/F1/Shift+F2-F3) — КРИТИЧЕСКИЙ риск, модули описаны ниже. **Живой прогон шага 8:** `bobliks_settings_mark` = `v1.14.5 OK init`, Пульс GREEN 10/10 (включая `node-menub` — кнопка примонтировалась из нового модуля). см. ROADMAP-2.0.md | v1.14.4-1.14.5 (2026-09-14, инцидент «пропала кнопка Б»): CustomizableUI.createWidget убран — FF155 не строит узел и НЕ СОХРАНЯЕТ плейсмент позднерегистрируемого custom-виджета (тот же корень 1.9.2, что у часов; свежие профили Setup = без кнопки навсегда, live-тест: RED node-menub). Теперь прямая DOM-вставка как у часов: mount по `browser-delayed-startup-finished` (nav-bar финален, ранний mount попадал под buildArea) + таймер-страховка 2.5с + дедуп querySelectorAll. Плюс фикс маскировки mark: асинхронная чистка закладок перезаписывала финальный «OK widget»/«ERR fatal» — теперь `finalStatus · bookmarks OK` |
| BladeUpdater.uc.js | 1.3.6 | Автопроверка GitHub (сутки), панель «Хроника обновлений», самолечение 401-токена, однократная регистрация дефолт-браузера, API `window.BladeUpdater`. v1.3.6 (b80e0d7, фикс 2.0.2): `Set-Location`-префикс перед запуском аплайера — наследованный от Setup/ярлыков WorkingDirectory (каталог движка) блокировал `Move-Item` самомодификации (self-lock) |
| BobliksCovers.uc.js | 2.1.0 | Генератор covers.css (`@onlyonce` + перегенерация по префу `bobliks.covers.dirty`) |
| BladeNewtab.uc.js | 1.9.0 | Hero ТОЛЬКО на новой вкладке: per-theme шрифты и эффекты 9 тем (v1.7.1: кастомный ttf-шрифт BladeBlood с впаянными каплями крови прямо в контуры глифов цифр; устранены перекрытия шрифтов спанами — все 9 тем имеют свои шрифты без сбоев), большие часы 88px+секунды, приветствие, дата, статус-строка, тикер хроники. На остальных страницах время — навбар-часы (BladeClock 2.6.0). v1.9.0 (8a377ee, волна v2.0.5 «Katana Slash»): монолитный циферблат (монолитные часы вместо спан-перекрытий), Blood-переписывание эффектов, ховеры плиток |
| BladeClock.uc.js | 2.7.0 | Часы+погода+прогноз в тулбаре (ipwho.is + open-meteo), публикует в шину clock:weather. v2.6.0: на about:newtab/home кнопка прячется — там время показывает Hero. v2.7.0 «Сок»: солнечные часы — восход/закат из open-meteo (кэш-преф blade.clock.sun на день), ночь по реальному солнцу, фолбэк 22:00-06:00 |
| BladePalette.uc.js | 1.2.0 | Командная палитра Ctrl+K (терминал): темы/фоны/облики/действия, register() для будущих команд, API window.BladePalette. v1.2.0 «Сок»: помодоро — «Таймер 25/5 мин» с фанфарой тембра темы на финише, живой остаток в метке «остановить» |
| BladeBattery.uc.js | 1.0.1 | Режим экономии (волна «Сок»): navigator.getBattery → data-blade-battery на :root + преф blade.battery.sav; CSS гасит бесконечные анимации хрома и живых фонов newtab, idle-заставка не поднимается. Порог: не заряжается и <60%. v1.0.1 (P1-аудит, волна 2.0.1): BatteryManager глобален на процесс — слушатели levelchange/chargingchange переживали закрытие окна и держали его мёртвым (утечка); теперь ссылки хранятся и снимаются на unload, неразрешившийся к закрытию промис доезжает через then(detach) |
| BladePerf.uc.js | 2.0.0 | Замер фаз старта окна (dcl/load/paint/ssr) → `perf_mark.txt` + история `perf_history.txt` (ротация 50) — бенчмарки волн 2.0 |
| BladePulse.uc.js | 1.0.0 | Пульс Клинка: самодиагностика при старте (`@onlyonce`, `@loadOrder 99`) — контракт Blade, узлы (навбар/часы/меню B/Hero), шрифты, VERSION/covers → `blade_health.txt`, вердикт GREEN/YELLOW/RED |
| BladeTranslate.uc.js | 1.0.0 | «Перевести страницу» в контекстном меню ПКМ (как в Chrome): menuitem в contentAreaContextMenu, вызов штатной FullPageTranslationsPanel; только http/https/file (2026-09-13, по слову владельца) |
| BladeShield.uc.js | 1.8.1 | Сторож анти-детект списков uBlock (2026-09-14): при старте сверяет selectedFilterLists с эталоном (awrl+annoyances) и дописывает недостающие. Путь: ПРЯМОЙ mozStorage-доступ к sqlite storage.local uBO (snappy+structured-clone кодек, roundtrip-верифицирован). ⚠️ Все IDB-пути (7 версий) движок режет UnknownErr — гейт квота-менеджера на moz-extension принципалы из chrome-окна. Бэкап перед записью: BladeShield_backup.txt |
| BladeProfileGuard.uc.js | 1.0.3 | Страж голого запуска (2026-09-14): раз в сессию, в первом окне через 15 c — идемпотентная прошивка [Install<ХЭШ>] Default/Locked=1 + [ProfileN] в %APPDATA%\Mozilla\Firefox\profiles.ini и installs.ini (хэш = CityHash64 v1.0, BigInt-порт cityhash_blade.py, формат движка %llX). Каталог движка = XREExeF→.parent (фолбэк GreBinD); ⚠️ XCurProcD на stage-движке отдаёт ...\browser — давал мусорный хэш (баг-фикс 1.0.1 по живому тесту). ⚠️ Номер новой секции = НАИМЕНЬШИЙ свободный [ProfileN] (баг-фикс 1.0.2). v1.0.3 (инцидент 2026-09-14): гвард-условие против угона Default — при явном `-profile` (дев/клон/стенд на боевом движке) гвард перепривязывал [Install].Default на временный профиль (живой угон: [InstallD0DD9ACE] уехал на %TEMP%-клон) — теперь чужой СУЩЕСТВУЮЩИЙ Default свято (как у движкового autoseed), лечится только отсутствующий/битый. Тест: TestReports\test-BladeProfileGuard.js (запуск: `node TestReports\test-BladeProfileGuard.js <путь к .uc.js>`, аргумент обязателен) |
| BobliksChromeStyle 1.3.0 / AboutStyle 1.0.1 / BladeSounds 1.4.0 | — | Стили хрома/about (incl. порт SIGNATURE), звуки: саундскрины тем + контекст (непогода/ночь/приватность глушат тембр), шинг при смене темы (шина theme:changed) |
| BladeLang.uc.js | 1.0.0 | Сидинг langpack-ru в профиль (2026-09-15, «русский в настройках браузера»): из chrome\extensions через AddonManager.getInstallForFile; идемпотентен (getAddonsByTypes locale), кулдаун blade.lang.lastTry 6ч (СЕКУНДЫ — int-префы 32-бит),@loadOrder 15. Закрывает ограничение 2.0.2 «патч не сеет policy»: теперь русский появляется в about:preferences → Browser Language даже на патч-установках. На старых движках без Langpack-хирургии — тихий mark «unsigned rejected» |
| BladeThemeEngine.uc.js | 1.0.0 | Шаг 7 декомпозиции BobliksSettings (2026-09-22): забрал ВЕСЬ кластер тем и фонов (354 строки) — `syncSelectionPrefs` (синхрон цвета системного выделения), каталоги фонов (`BUILTIN_BGS` + скан `chrome\img\` в `getCustomBgs` с кэшем на окно + `getAllBgs`), `activeTheme`/`activeBg`, юзер-щиты `applyThemeSheet`/`applyCustomBgSheet` (nsIStyleSheetService USER_SHEET — единственный живой канал до remote-контента), живые атрибуты `applyLiveAttrs`/`newtabDocs`/`applyBgToDoc`, цветная математика кастомной темы (`customVars`/`hexToRgb`/`applyCustomToDoc`/`getCustomColor`) и `setTheme`/`setBg`. **Главное отличие от шагов 5–6: модуль работает на СТАРТЕ**, а не по клику — стартовая последовательность переехала в `boot()` (override->selection->themeSheet->liveAttrs->customBgSheet), монолит зовёт `window.BladeEngine.boot()` первым в INIT. `@loadOrder 8` — детерминированно раньше BobliksSettings (default 10) и всех @loadOrder 12; BladeCore (5) успевает дать каталоги. Цикл setTheme↔applyThemeSheet↔activeBg/setBg (риск 1) НАМЕРЕННО оставлен внутри модуля — связанность данных локальна, разрыв через шину `theme:changed` отменён: добавил бы async-риск без выигрыша по строкам (ROADMAP шаг 7 исходно планировал шину). `window.BladeSettings` стал тонкой делегирующей обёрткой (каждый метод — стрелка в `window.BladeEngine`), поэтому BladeThemeLab/BladeVisages/BladePalette/BladeAutoTheme переезд не заметили; `THEMES` (контракт BladeCore) остался в монолите — buildPopup/keyset читают сырой массив. **Живой прогон:** Пульс GREEN 10/10, `BladeThemeEngine_mark` = `v1.0.0 OK boot`. **Клик-тест пройден:** вкладка ФОН → «V2 Ember» = `OK setBg=v2ember` (преф + юзер-щит) → вкладка ТЕМА → «Neon Purple» = `OK themeSheet purple bg=v2ember` (фон вшит в тематический щит — цикл работает) → «Конструктор темы…» открылся с живыми значениями, «Применить» = `OK themeSheet custom bg=v2ember` → Облик «Полуночный Кодер» = `OK visage coder` + `OK setBg=midnight`. Dev-состояние возвращено (red + acheron) |
| BladeMenuPopup.uc.js | 1.0.0 | Шаг 8 декомпозиции BobliksSettings (2026-09-22): забрал всю панель меню «B» — POPUP_ID (`bobliks-settings-popup`), MENU_CSS (рамка/фон/тени только через `::part(content)` — в FF155 попапы рисуются в Shadow DOM), BP_TABS (6 вкладок: ТЕМА/ФОН/ПЛИТКИ/ОБНОВЫ/ПЕРФ/СИСТЕМА, активная — преф `blade.menu.tab`), `buildPopup` (синхронный рендер тела под активную вкладку) и полный клик-диспетчер по dataset-атрибутам строк: `bobliksTheme`/`bobliksBg` → `window.BladeEngine`, `bladeLab` → BladeThemeLab, `bladeVisage`/`bladeVisageSave` → BladeVisages, `bladeAutoTheme`/`bladeAutoDay`/`bladeAutoNight` → авто-тема, `bladePickBg` → выбор своего файла обоев, `bobliksEdit`, `bladeDns` (Cloudflare/AdGuard/Quad9), `bladeSounds`, `bladeIdle`, `bladePurge`, `bladeBackup`, `bladeDefault`, `bladeUpdate`. Также забрал асинхронные читатели VERSION/CODENAME (шапка панели), PERF_LINE/`readPerfMark` (вкладка ПЕРФ) и DNS_URI. Экспортирует `window.BladeMenuPopup = { ensurePopup, open }`, `@loadOrder 11` — выше BladeMenuButton (@12), чтобы кнопка звала уже готовую панель. THEMES — `window.Blade.themes` (контракт BladeCore, без дублирования). **Живой прогон:** mark `v1.0.0 LOADED`; панель открылась и по клику кнопки B, и по Alt+B — все 6 вкладок, шапка `v2.0.5 · Срез Катаны (Katana Slash)`, переключение ФОН→ТЕМА, клики строк темы и фона дошли до движка (`OK setBg=acheron`, `OK themeSheet green bg=acheron`) |
| BladeMenuButton.uc.js | 1.0.0 | Шаг 8 декомпозиции BobliksSettings (2026-09-22): забрал виджет кнопки «B» и keyset — WIDGET_ID (`bobliks-settings-button`), `buildMenuButton` (прямая DOM-вставка в `#nav-bar`, а не CustomizableUI.createWidget — см. инцидент 1.14.5 в строке BobliksSettings; команда → `window.BladeMenuPopup.open(btn)`), `mountMenuButton`/`tryMount` (дедуп querySelectorAll) и САМОМОНТ: наблюдатель `browser-delayed-startup-finished` (снимается на unload) + таймер-страховка 2.5с перенесены из INIT монолита ДОСЛОВНО. Немедленный `tryMount()` НЕ вызывается намеренно — ранний mount попадал под buildArea CustomizableUI: узел стэшился, ретрай вставлял второго, стэш возвращался = ДВЕ кнопки (инцидент 1.14.5). Keyset (`mainKeyset`, настоящие `<key>` — работают при любом фокусе, баг красной команды №11): Alt+B и F1 → `window.BladeMenuPopup.open(btn)`, Shift+F2/Shift+F3 → цикл тем через `window.BladeEngine.setTheme`. Экспортирует `window.BladeMenuButton = { mount }`, `@loadOrder 12`. THEMES — `window.Blade.themes`. **Главный риск шага 8 (КРИТИЧЕСКИЙ):** кнопка должна примонтироваться из нового модуля — Пульс дал `[OK] node-menub: #bobliks-settings-button` на первом же живом прогоне; клик по ней открыл панель (цепочка виджет→`BladeMenuPopup.open` работает) |
| BladeAutoTheme.uc.js | 1.0.0 | Шаг 3 декомпозиции BobliksSettings (2026-09-22): циклер авто-темы день/ночь (60с через `Blade.every`). Первый модуль, который **пишет** состояние, а не только читает — внешний клиент API: текущую тему берёт из `data-blade-theme` на `documentElement` (а не из замыкания монолита), переключает через `window.BladeSettings.setTheme()`. Если API ещё не жив — тихий `NO_API` в mark. **Функциональный тест пройден:** включённый `blade.autotheme.on` + 11:00 → авто-тема выставила дневную `grey` (`bobliks.theme.grey: true` в prefs.js после закрытия) |
| BladeSystemTools.uc.js | 1.0.0 | Шаг 4 декомпозиции BobliksSettings (2026-09-22): забрал системные операции — `notifyBlade` (gNotificationBox FF155, сигнатура `appendNotification(type, {label,image,priority})`) и `launchBackup` (Blade.runPsEncoded → `resources\blade-backup.ps1`, base64 UTF-16LE, пробелы в путях не рвутся). Экспортирует `window.BladeSystemTools = { launchBackup, notify }`, `@loadOrder 12`. Из монолита удалены обе функции; ОБА вызова (клик-диспетчер `ds.bladeBackup` + `window.BladeSettings.backup()`) переведены на новый API. ⚠️ DoH/RAM-действия ушли из монолита вместе с клик-диспетчером на шаге 8 (BladeMenuPopup). Живой прогон: Пульс GREEN, `BladeSystemTools_mark` = `v1.0.0 OK tools`, `bobliks_settings_mark` = `v1.14.5 OK widget`. Клик-тест самого пункта «Бэкап» не проводился (кнопка меню B открывает ≡ из-за ограничений a11y-дерева) — проверена только живучесть API |
| BladeVisages.uc.js | 1.0.0 | Шаг 6 декомпозиции BobliksSettings (2026-09-22): забрал весь кластер обликов — данные `BLADE_VISAGES` (5 пресетов «тема+фон»: Кровавый Охотник/Полуночный Кодер/Неоновый Город/Высокое Напряжение/Вишнёвый Сад), `userVisage/allVisages` (читают `blade.visage.mine`, fail-soft на битый JSON), `applyVisage` (setTheme+setBg через API), `saveVisage` (пишет `blade.visage.mine`), `chooseCustomWallpaper` (nsIFilePicker → копирование в `chrome\img\` санитизированным именем + тумблер `bobliks.covers.dirty` + `setBg('file:…')`). Экспортирует `window.BladeVisages = { allVisages, applyVisage, saveVisage, chooseCustomWallpaper }`, `@loadOrder 12`. Требует от `window.BladeSettings` внутренний контракт: `setTheme/setBg/activeTheme/activeBg/getImgDir/invalidateBgCache` — последние добавлены в экспорт монолита; `applyVisage/saveVisage` в API переведены в делегирующие стрелки (обратная совместимость). **Функциональный тест пройден:** ОБЛИКИ отрисованы через API → клик «Вишнёвый Сад» = `OK visage cherry` (тема+фон переключились) → «Сохранить как Мой Облик» = `OK visage saved` + «Мой Облик» появился в списке (round-trip). ⚠️ `chooseCustomWallpaper` не кликался — нативный диалог выбора файла не приводится в действие через CUA; но его зависимости (getImgDir/setBg/invalidateBgCache) покрыты остальными тестами |
| BladeThemeLab.uc.js | 1.0.0 | Шаг 5 декомпозиции BobliksSettings (2026-09-22): забрал диалог конструктора своей темы (192 строки: HSL-слайдеры `Оттенок/Насыщенность/Яркость` — системный `<input type=color>` в chrome-диалоге палитру не открывает; hex-поле; 8 свотчей-пресетов; живое превью плитка+кнопка; кнопки «Применить»/«Вернуть GX Red»). Экспортирует `window.BladeThemeLab.open()`, `@loadOrder 12`. **Чистый API-клиент:** сам не считает цвета — берёт `customVars/hexToRgb/applyCustomToDoc/applyLiveAttrs/getCustomColor/setTheme` из `window.BladeSettings` (эти 5 функции жили в экспорте монолита как внутренний контракт; шагом 7 уехали в BladeThemeEngine). Гард: если API неполон — тихий `NO_API` в mark. **Функциональный тест пройден полностью:** меню B → вкладка ТЕМА → «Конструктор темы…» → диалог открылся, слайдеры получили реальные значения через API-цепочку (`setHex(getCustomColor())` → `hexToRgb` → `hexToHsl` → `render`), закрытие крестиком корректно откатило живую перекраску через `applyLiveAttrs`. ⚠️ Применение (запись `blade.theme.customColor` + тумблер `bobliks.covers.dirty`) в тесте не нажималось — намеренно, чтобы не запускать перегенерацию covers.css на дев-профиле |
| BladeWindowFx.uc.js | 1.0.0 | Шаг 2 декомпозиции BobliksSettings (2026-09-22): забрал визуальные эффекты окна — лазерный луч загрузки (`data-blade-loading` на `#navigator-toolbox` + `blade-loaded` вспышка на 500мс), ghost-карточка закрытия вкладки (`.blade-ghost` + распыление: 12 искр `.blade-spark` радиальным разлётом + 8 пылинок `.blade-dust` осыпаются вниз + 8 осколков `.blade-shard` с вращением + ударная волна `.blade-burst` кольцом из центра, все с индивидуальными `--dx/--dy`), эффект A12 ударная волна перезарядки темы (`.blade-theme-wave` по шине `theme:changed`), эффект A13 удар клинка при выборе вкладки (`.blade-tab-hit` на `TabSelect`), сплеш-заставка старта (`#blade-splash`, только первое окно сессии), заставка простоя (`#blade-idle`, 3 мин неактивности, гварды: преф/fullscreen/батарея/звук во вкладках, тик через `Blade.every`). PiP-неон ОСТАВЛЕН в монолите — он встроен в `docObs` (тот же observer параллельно делает `applyLiveAttrs` для новых окон), трогать ради 25 строк ядро нельзя. `getImgDir()` локализирован (UChrm/img, 3 строки). **Инцидент 2026-09-25 «эффекты не видны»:** все стили эффектов (.blade-ghost/.spark/.dust/.shard/.burst/.theme-wave/.tab-hit) жили в `userChrome.css`, но грузятся USER_SHEET'ом, который в XUL-документе не достаёт HTML-нод — правила молча не матчились, распыление никогда не работало. Перенесены в AUTHOR-инъекцию `<style id="blade-fx-style">` в начале скрипта (конвенция 34, паттерн BobliksChromeStyle), из userChrome.css удалены. Живой прогон: Пульс GREEN, `BladeWindowFx_mark` = `v1.0.0 OK idle` |
| BladeHousekeeping.uc.js | 1.0.0 | Шаг 1 декомпозиции BobliksSettings (2026-09-22): забрал полностью изолированный хозяйственный cleanup — стиль About-диалога (USER_SHEET через nsIStyleSheetService), сброс `sidebar.verticalTabs` (отклонённая владельцем фича), чистильщик мусорных вкладок расширений (SponsorBlock help, первая минута), «Чистый лист» (BANNED data-l10n-id порталов Mozilla в меню + idle-проход), удаление дефолтных mozilla/portableapps-закладок (PlacesUtils). `@loadOrder 12`, свой mark-файл `BladeHousekeeping_mark.txt`. Из монолита удалена мёртвая `finalStatus` — её единственный читатель (bookmarks-IIFE) ушёл вместе с блоком. Живой прогон: Пульс GREEN, `bobliks_settings_mark` = `v1.14.5 OK widget`, `BladeHousekeeping_mark` = `v1.0.0 OK bookmarks` |
| BladeContextMenu.uc.js | 1.0.1 | Киберпанк-контекстные меню: SVG-иконки действий (страница/картинка/ссылка/выделение, реестр ICON_MAP из 29 id) + подчёркивания акселераторов гасятся префой. v1.0.1 (правка волны 2026-09-22): найден и устранён системный рассинхрон — иконки назначались ОДНОВРЕМЕННО из JS (атрибут image, 29 id) и из CSS-списка (`--menuitem-icon`, 16 id), из-за чего 13 пунктов оставались без иконки, а в `#context-inspect` лежал несуществующий `chrome://devtools/skin/images/command-pick.svg` (движок использует `resource://devtools-shared-images/command-pick.svg`); мёртвый `#context-translate` заменён на реальный `#context-translate-selection` (сверка с browser.xhtml). Канон движка: переменная `--menuitem-icon` на самом пункте + класс `.menuitem-iconic` (так же делает contextmenu.css омни) — теперь это единственный механизм, 16 дублирующих CSS-правил удалены. Атрибут `image` больше НЕ ставится — движок прокидывает его в `.menu-icon` как `srcset`, что ломает content-путь. Подчёркивания: убрана мутация `removeAttribute("accesskey")` на каждом popupshowing (ломала активацию пунктов по Alt+букве) — её целиком покрывает префа `ui.key.chromeAccess=0` (user.js), CSS-правило на `label html\|span.accesskey` оставлено как визуальный ремень-страховка. Добавлен mark-файл (`BladeContextMenu_mark.txt`, конвенция 2) |

**Тёмный режим сайтов (решение 2026-09-13):** делает **Dark Reader** — ставится
политикой `policies.json` (Install, вместе с uBlock/SponsorBlock). Наша старая
механика (инверт-фильтр blade.reader.on, кнопка в меню B, команда палитры,
хоткей F2, ручной Google-блок в userContent секция 14) — снесена полностью.
Замер A/B: цена DR по CPU/RAM — нулевая (лёгкие и тяжёлые сайты).
Google-блок оформления ВОЗВРАЩЁН через день (владелец заметил слетевшую тему):
живёт ПОВЕРХ DR (!important перекрывают генерическую покраску).

**Фичи по слову владельца (2026-09-13—14):**
- «Перевести страницу» в ПКМ — BladeTranslate.uc.js (см. таблицу).
- Шазам-плитка (aha-music + микрофон-политика) — ОТЗВАНА владельцем через день
  («калл, плитка не удаляется»): снесена из pinned/default.sites/полиси,
  обложки удалены, NewTabUtils.blockedLinks блокирует возврат (BobliksSettings).
- Кнопка загрузок: FF155 прячет её autohide'ом (`browser.download.autohideButton`
  default true — «меню загрузок не открывается»); фикс: преф false в user.js +
  ensure-плейсмент в nav-bar (BobliksSettings).
- **Плитки «pinnedOnly» (2026-09-14, «после удаления появляется новая»)**: движковый
  патч `Apply-Blade-Tiles.ps1` (перепаковка browser/omni.ja по образцу Rebrand,
  идемпотентен, node --check): (1) TopSitesFeed — преф `browser.newtabpage.blade.pinnedOnly`:
  сетка = только закреплённые, кандидаты из frecent/дефолтов/спонсоры не вставляются,
  закреплённые не режутся по rows×perRow (A4, живой тест: 15 pinned при 2×5 срезались
  до 10); (2) modules/topsites/TopSites.sys.mjs `insertPinned` — дырка от unpinned
  плитки сохраняется null-ом (рендер движка умеет hole-слоты, см. «hole-N» в бандле).
  `unpin` дырки оставляет нативно (`links[index]=null`, NewTabUtils:253). Живо
  проверено владельцем: 7 удалений подряд, ни одной новой плитки, все 3 вкладки
  консистентны, Пульс GREEN. ⚠️ Преф работает ТОЛЬКО с пропатченным движком —
  друзьям уедет только с Full-релизом (профильные user.js без патча = сток);
  шаблонным движкам (полный пакет) патч уже вшит в Skeleton-Stage.
  Снесён мёртвый `browser.newtabpage.activity-stream.default.sites` (JSON):
  движок ждёт URL через запятую и читает преф только при useRemoteSetting=false
  (дефолт true) — годы лежал мусором. Заставший null в pinned владельца (шазам)
  компактим при прошивке.
- **AVA 3.0 — смена иконки + редизайн newtab (2026-09-14)**: новые ассеты владельца
  `ava-logo.png` (круглая, 1024²) / `ava-sq.png (квадрат с вордмарком) — палитра
  #000/#FF0000/#FFF. Движок: Branding/master_icon.png + icon.ico (пересобран
  мультисайз 16–256 из одного 256-слойного исходника) → Apply-Blade-Rebrand.ps1
  (86 ассетов omni) + rcedit exe — прошиты в Skeleton-Stage и установленную копию.
  UI (FrontendDesigner по правилу владельца «используй агентов»): сплеш старта с
  ava-logo 220px + надпись A V A + статус-строка; заставка простоя с ava-sq;
  плитки — строгие карточки AVA (срез 3D-наклона, обсидиан #060507, верхняя
  лазерная грань, hover translateY); hero-грань с ромбом; водяной знак newtab
  (opacity .05). BobliksSettings 1.14.3, BladeNewtab 1.5.1; covers.css-механика
  не тронута (селекторы .top-site-outer .top-site-button .tile сохранены).
- **«Браузер превращается в обычный Firefox» (2026-09-14, ТРИ корня, все устранены):**
  1. **Bare-запуски шли в чужой профиль.** `firefox.exe` без `-profile` (автозагрузка
     `-os-autostart`, пин таскбара, прямой запуск) резолвится через
     `Roaming\Mozilla\Firefox\profiles.ini` → инсталл-хэш D0DD9ACE… → свежий голый
     профиль `r8fcseh1.default-release-1` (английский, виджеты, дефолт-плитки) —
     выглядел как «обычный фаерфокс». Фикс: [InstallD0DD9ACE…].Default → абсолютный
     путь Data\profile + секция [Profile3] Name=Blade IsRelative=0 (⚠️ секции
     профилей — ТОЛЬКО [ProfileN] с номером; [ProfileBlade] ломал парсер и открывал
     менеджер профилей; ⚠️ нумерация ПЛОТНАЯ: движок перебирает Profile0..N подряд
     и обрывает на первом пропуске — секции за дыркой невидимы, поэтому при
     ручных правках/сидинге новый номер = наименьший свободный, а не maxN+1). Бэкапы: profiles.ini.blade-bak / installs.ini.blade-bak.
     Автоматизировано (2026-09-14): uc.js-страж BladeProfileGuard (канал патчей —
     существующие пользователи) + SeedFirefoxProfilesIni в BladeSetup (новые
     установки, вызов после CreateUninstaller). Хэш — порт CityHash 1.0
     (cityhash_blade.py → BigInt в JS / ulong в C#), векторы D0DD9ACE5A41BA7D и
     841AB720B1601E88 проверены в обоих портах; формат движка сверен с исходниками
     (commonupdatedir.cpp: %PRIX64, UTF-16LE без терминатора, паддинга нет).
  2. **ru-langpack перебивал брендинг.** В профиле владельца стоит
     `langpack-ru@firefox.mozilla.org` (intl.locale.requested=ru) — его brand.ftl
     («Firefox»/«Mozilla Firefox») перекрывал омниевское «Blade» во всём русском UI
     (заголовок окна «— Mozilla Firefox»). Править xpi нельзя безнаказанно —
     release-сборка требует подписи langpack-ов (AddonSettings: константа true, а не
     преф!). Решение `Apply-Blade-Langpack.ps1`: (A) корневой omni — AddonSettings
     LANGPACKS_REQUIRE_SIGNING → преф (дефолт false), XPIDatabase.mustSign(locale)
     → false, XPIInstall.shouldVerifySignedState(locale) → false (NOT_REQUIRED ⇒
     isCorrectlySigned=true, без варнингов; подписи РАСШИРЕНИЙ не тронуты);
     (B) value-only скраб langpack-ов профиля + (C) l10n-хвосты en-US ВНУТРИ
     browser/omni.ja и omni.ja движка (перепаковка как в A, идемпотентно:
     0 замен → архив не пишем). Скраб v2 (третья итерация, 2026-09-14, «ноль
     Firefox/Mozilla в видимом тексте»): селекторные строки .ftl (падежи
     brandings — у вариантов нет «=», v1 их не матчил), атрибуты `.title =`
     и строки-продолжения (v1-регресс не брал ведущую точку/отступ — выживал
     «.title = Firefox рекомендует…»), одиночный «Mozilla» → Blade (после
     «Mozilla Firefox» и «Firefox»), СЕГМЕНТНЫЙ http-гард (v1 скипал значение
     целиком из-за одного URL; v2: URL-части `https?://…` и голые домены
     org|com|net — байт-в-байт, текстовые части — скраб). Нижний регистр
     firefox/mozilla — не трогаем (ключи и { -firefox-home-brand-name }-
     переменные; меняются их ОПРЕДЕЛЕНИЯ). Юридический стоп-лист: файлы с
     «aboutRights»/«license» в имени — не трогать вообще (ограничение №3),
     aboutMozilla.ftl — трогаем (easter-egg, не легал). Тест:
     `TestReports\test-langpack-scrub.py` — 45 PASS (вырезает python-блок
     прямо из ps1 — единственный источник истины, без дублирования логики).
     DryRun по живым поверхностям: ru 43 / en-GB 36 / root-omni 19 /
     browser-omni 14 замен. «Mozilla Foundation»→«Blade Foundation» (8 строк:
     trademarkInfo + онбординг-благодарности) — РЕШЕНО владельцем «ноль
     упоминаний»: скраб оставлен; юр-тексты целиком сохранены в
     about:license/about:rights (стоп-лист). Живая проверка v2 (2026-09-14):
     about:mozilla = «Книга Blade, 6:27 — Blade», about:addons = «Blade
     рекомендует…»/«Добавить в Blade»/«Настройки Blade», about:support = «—
     Blade»; RU-langpack: 0 видимых Firefox/Mozilla вне URL и стоп-листа.
     Установка langpack-ов — политикой Install с локальным путём xpi (в
     policies.json УСТАНОВЛЕННОЙ копии, стейдж не трогаем — друзьям путь
     бессмысленен). Reconcile сам langpack-и из extensions/ НЕ ставит (только
     спец-поток). Живо проверено: русский UI + «Blade» в заголовке + без
     предупреждений. ⚠️ Если langpack обновится с AMO — скраб повторить
     (скрипт идемпотентен); при DisableAppUpdate обновлений почти не бывает.
  3. **Мёртвая автозагрузка**: HKCU Run `Mozilla-Firefox-841AB720B1601E88` →
     несуществующий `FirefoxPortable\App\Firefox64` — удалена (осталась только
     легитимная `Mozilla-Firefox-D0DD9ACE5A41BA7D` → установленный движок).
  УРОК: «превращается в Firefox» ≠ движок/брендинг — сначала проверить, ТОТ ЛИ
  ПРОФИЛЬ открыт (заголовок, about:support, язык UI), потом уже копать omni.
  Второй урок: diagnostics a11y-деревом ловит язык UI и виджеты без скринов.

**ИНЦИДЕНТ «ПРОПАЛА КНОПКА Б, ТУЛЗА НЕТУ» (2026-09-14 вечер, ДВА корня, оба устранены):**
Владелец в 16:04 сообщил «пропала кнопка Б, тулза нету». Диагноз по следам (mark-файлы,
sessionstore таймлайны, prefs-криминалистика, клоны профилей):
1. **ГЛАВНЫЙ КОРЕНЬ: вписка autoseed (15:45:02) ВЫРЕЗАЛА загрузчик fx-autoconfig из
   config.js.** Файл установленного движка и Skeleton-Stage стал «autoseed-only» (304
   строки) — блок `autoRegister(chrome.manifest) + import boot.sys.mjs` исчез, хотя
   комментарий autoseed ссылался на «загрузчик выше». Сессия 15:43 была последней со
   скриптами; рестарт 15:59 = голый движок: НЕТ ни меню B, ни часов, ни палитры, ни
   живых тем («тулза нету»). Клоны/дев-прогоны этого не ловили — думал «кнопка есть»,
   а это была движковая smartwindow-кнопка с лейблом «Blade» от брендинга.
   ФИКС: config.js = канонический загрузчик (12 строк, эталон из тест-копии Setup)
   + autoseed; прошито в установленный движок, Skeleton-Stage и тест-стенд.
   ⚠️ РЕЛИЗ: Release\data.zip собран до/с разными версиями — перед публикацией
   2.0.1 ПЕРЕСОБРАТЬ (config.js комбинированный + BobliksSettings 1.14.5).
   УРОК: правка config.js = СНАЧАЛА дифф с эталоном загрузчика, автосид — ТОЛЬКО
   допиской, никогда заменой; проверка живого старта после каждой правки движковых
   файлов (mark-файлы обязаны свежеть).
2. **ВТОРОЙ КОРЕНЬ (латентный, всплыл в тест-копии Setup на F:\): свежий профиль —
   БЕЗ кнопки B НАВСЕГДА.** FF155 CustomizableUI не строит узел и не сохраняет
   плейсмент позднерегистрируемого custom-виджета (placement без DOM — тот же корень
   1.9.2 «случай часов»; в старых профилях кнопка жила только от сохранённого
   состояния). Тест-установка F:\App\Blade: health RED node-menub, в стейте id
   отсутствует после двух прогонов. ФИКС: BobliksSettings 1.14.4→1.14.5 — прямая
   DOM-вставка (паттерн BladeClock), mount после browser-delayed-startup-finished +
   дедуп. Живо проверено на стенде: GREEN, кнопка одна (DOM-зонд), меню открывается,
   позиция prev=blade-clock-widget.
3. **СОПУТСТВУЮЩИЕ НАХОДКИ:** (a) mark-маскировка: асинхронная чистка закладок
   перезаписывала финальный mark («ERR fatal» мог стереться) — исправлено (finalStatus);
   (b) гвард профиля 1.0.3 угонял [Install].Default при явном -profile — живой угон
   при диагностике, условие-гвард добавлено, тесты ALL PASSED; (c) в installs.ini
   была мёртвая секция [6FD3671E]→удалённый сток-профиль (мусор от утренних тестов
   Setup) — снесена с бэкапом installs.ini.blade-bak-deadentry; (d) a11y-дерево
   показывает ДВЕ «button Blade» на ОДНУ кнопку (плюс движковые smartwindow/taskbar
   кнопки с лейблом «Blade») — a11y ≠ DOM-истина, при спорах гонять DOM-зонд
   (querySelectorAll по id в живом окне).

**РУССКИЙ ИЗ КОРОБКИ (2026-09-14, инцидент «в Browser Language нету русского»):**
свежая установка была англоязычной — langpack-ru доставлялся только в боевую
копию владельца (policies Install с АБСОЛЮТНЫМ путём на его диск — друзьям
бессмысленно). Решение: скрабленный langpack-ru@firefox.mozilla.org.xpi (603КБ,
тот же файл из профиля владельца — Blade вместо Firefox в строках) едет в
`chrome\extensions\` поставки (автоматом в патч/фулл/data.zip); **Setup 1.4.2**
(SeedLangpackPolicy) при установке копирует его в `Data\profile\extensions\`
и дописывает абсолютный путь в `distribution\policies.json` → Extensions.Install
(JsonNode-мутация, чужие ключи целы, идемпотентно, fail-soft); `user.js` задаёт
`intl.locale.requested = "ru,en-US"` (без langpack — тихий фолбэк en-US).
Подписи: xpi скраблен (подпись сломана), но движок уже не требует подписи
langpack-ов (Langpack-хирургия omni). Механика = боевая копия владельца,
живьём работает у него; GUI-прогон свежей установки отменён владельцем
(«сетап работает»). ⚠️ Патч-друзьям (без Full): user.js привезёт преф, но
langpack-а в патче НЕТ (extensions не входит в патч-джанк... включён в chrome —
проверить: chrome\extensions уезжает в патч, но СТАРЫЙ сетап его не сеет —
нужен Setup 1.4.2+; апдейт патчем не даст русский старым друзьям до Full).

**ИНЦИДЕНТ «НЕ УДАЛОСЬ УБРАТЬ СТАРЫЙ ДВИЖОК» (2026-09-14 ночь, друг на 2.0.1):**
друг принял Full-обновление 2.0.2 — applier упал на Move-Item движка «файл занят».
Корень (репро A/B доказано): applier запускается BladeUpdater'ом из firefox и
НАСЛЕДУЕТ CWD = каталог движка (Setup и ВСЕ ярлыки ставят WorkingDirectory =
App\Blade) — Move-Item каталога, в котором стоит сам applier (точнее — его
отделённая %TEMP%-самокопия, наследующая тот же CWD), Windows запрещает.
Дев-машина не ловила: там firefox стартовал из чужого CWD. ФИКС (задеплоено
владельцу + едет в патче): applier — Set-Location UserProfile до самокопии +
Close-BladeProcesses в функцию + 3 попытки Move-Item; BladeUpdater 1.3.6 —
префикс Set-Location в psLine (страхует и старые applier'ы). ⚠️ ВАЖНО:
applier в патч/Full/data.zip едет из **Patches\template\blade-apply-update.ps1**
(живая chrome\resources — только для машины владельца); шаблон и живая теперь
идентичны (мердж: фикс + блок проверки SHA256 из шаблона). РЕЛИЗ v2.0.2
ПЕРЕИЗДАН с активом-ПАТЧЕМ (7.7МБ, Full-актив снят): у ВСЕХ друзей старый
applier — Full-актив падал бы у каждого; патч движок не трогает → применяется
чисто и доставляет чиненые апдейтер+applier → будущие Full-обновления (2.0.3+)
пройдут. УРОК: любой живой тест обновлений — запускать браузер С ЯРЛЫКА
(WorkingDirectory=движок), иначе CWD-класс багов невидим.

**УРОК «ПОЛОСЫ НА ЭКРАНЕ» (2026-09-14, полдня диагностики):** владелец увидел
«полосы на фоне новой вкладки, будто экран разъебали» — вердикт оказался
**атмосферными осадками**: `blade.weather.rain=true` (BladeClock/Open-Meteo:
в Днепре реально шёл дождь) активировал `@media -moz-pref("blade.weather.rain")`
в userContent.css (секция «Живой Клинок» 1.8.1) — диагональные струи поверх
фона. ПРОВЕРЯТЬ ПЕРВЫМ ДЕЛОМ при «артефактах» на newtab: префы blade.weather.*
и blade.night. Кривые пути в тот день: пиксельный автокорреляционный «детектор
полос» мерил гладкость тёмных картинок (выкинут); откат омни/CSS/сброс драйвера
(Win+Ctrl+Shift+B) — всё мимо; обои зря смягчены blur-ом (откачены из
Backups g-originals-20260914). РЕЗУЛЬТАТ-решение: фича переделана по слову
владельца («вместо изменения обоев нужно чтобы на панели капал дождик») —
заливка страницы и затемнение удалены из userContent.css (обои чистые),
дождь перенесён на капсулу навбара в userChrome.css (секция 24): деликатные
капли на стекле и срыв росинок с нижней кромки #nav-bar (opacity 0.68,
ход 64px, только compositor transform/opacity, 4 состояния, A11y). Доработка от
владельца (2026-09-14): капли окрашены в цвета активной темы со своим
уникальным характером под каждую тему через `--blade-rain-core` и
`--blade-rain-halo` (blood = тёмный рубин, volt = жёлтая молния с белым
ядром, cherry = розово-сиреневый, midnight = индиго-лёд, purple = синтивейв,
green = изумруд, grey = матовое серебро, orange = янтарь, red = фирменный алый,
custom = автонаследование от --accent).

**Разрешение-безопасная геометрия newtab (урок 2026-09-14):** на 768p/900p Hero-часы
наезжали на плитки из-за жёсткого `top: 50%` у `.top-sites-list` (центр экрана на
низких высотах попадал в Hero-зону). Исправлено в `userContent.css`:
`top: max(50%, 430px)` (на 1080p вьюпорт ~960px -> 50%=480px > 430px, геометрия
1080p остаётся строго 50% без малейшего сдвига; на 900p и 768p сетка не поднимается
выше 430px) + медиа-запрос `@media (max-height: 800px)` со `scale(0.86)` для
комфортного зазора между циферблатом и плитками. Сопутствующий откат
ПО ЖЕЛАНИЮ ВЛАДЕЛЬЦА: AVA-редизайн newtab (сплеш/idle/hero/плитки «строгие
карточки») откачен на HEAD 08f28e4 — плитки 3D-карточки вернулись; дизайн-волна
не была закоммичена и утеряна из рабочего дерева; иконки AVA в движке/Setup
НЕ откачены. Движковые фиксы аудита (B1 v2, C1) и прочее — на месте.

**Анти-детект адблока (урок 2026-09-14, критичный):** `ublock0.adminSettings`
из user.js — МЁРТВЫЙ канал в Firefox (это Chrome storage.managed; uBO читает
через vAPI.adminStorage, куда Gecko префы не попадают). Работал раньше только
на старой версии uBO, после её обновления списки откатывались к дефолту.
Замена — BladeShield.uc.js (см. таблицу). Эталон списков: user-filters,
ublock-filters/quick-fixes/annoyances/badware/privacy/unbreak, easylist,
easyprivacy, adguard-generic/other-annoyances/social + URL-импорты:
awrl (antiadblockfilters.txt), AdGuard 14 (ключи awrl/adguard-annoyance/
ublock-annoyance из стока uBO 1.74 удалены — маппинг на живые URL).

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
| 1.7.3 | Лёгкая Сталь | Большая чистка: закрыты утечки (AboutStyle observer, createWidget, интервалы), мёртвый CSS (~175 строк)/12 мёртвых префов/BladeTiles-дубль удалены, сплеш не ловит клики, кэш скана img/, сеть часов по кэшу, BladeCore (общий контракт) + BladePerf (замер старта), порт SIGNATURE — «обнажение клинка» впервые работает. Отдельно не публиковался — вошёл в 1.7.4 |
| 1.7.4 | Утренняя Сталь | Волна 1 «мелкого счастья»: приветствие+погода+прогноз на новой вкладке (шина clock:weather), тикер хроники, вкладка ПЕРФ, кнопка бэкапа (resources\blade-backup.ps1), авто-тема день/ночь (ручной выбор глушит авто), F1=меню. Опубликован 2026-09-12 (включает всю «Лёгкую Сталь») |
| 1.7.5 | Первый Луч | Фиксы 1.7.4: «обнажение клинка» оживлено по-настоящему (линия на .urlbar::after, конфликт position с движком устранён — сверка с omni.ja); приветствие newtab демоническое (кровь-градиент + свечение, появляется и тает), прогноз убран (перегруз), пульс свечения урлбара + Volt-дрожь возвращены портом на класс (вёрстка — Gemini/Antigravity по промпту gemini-prompt-frontend.md). Опубликован 2026-09-12 |
| 1.7.6 | Живое Сердце | Кнопка B восстановлена: FF155 строил голую кнопку без .toolbarbutton-icon (весь облик/пульсации тем висели на нём) — виджет переведён на type:custom+onBuild с ребёнком-иконкой; ВАЖНО: для type:custom движок не вызывает onCreated/onBeforeCreated — слушатель клика обязан жить в onBuild (урок 1.10.1: кнопка умерла); корень «нет анимаций тем» — Windows с выключенными клиент-анимациями давал prefers-reduced-motion:reduce, v1.7.0-блок гасил всё — user.js форсит ui.prefersReducedMotion=0. Опубликован 2026-09-12 |
| 1.7.7 | Родной Дом | Внешние ссылки открываются в профиле Blade: команды реестра (StartMenuInternet + BladeURL/BladeHTML) теперь с -profile и БЕЗ -osint (движок молча игнорирует osint+profile при remoting — проверено тестами A/B/C); set-blade-default.ps1 принимает EnginePath и корнем, и папкой движка. Друзьям после апдейта — один клик «Сделать браузером по умолчанию». Опубликован 2026-09-12 |
| 1.8.0 | Кровавая Гравюра | Дизайн-волна (вёрстка — Gemini/Antigravity по gemini-prompt-design.md, верифицировано GLM): кастомная типографика (Unbounded/Rubik/JetBrains Mono, chrome\fonts, OFL), своя страница ошибок (лиса скрыта), капсульный findbar, контекстные меню/PanelUI/загрузки/тултипы — тёмное стекло + единые радиусы. Отдельно не публиковался — вошёл в 1.8.1 |
| 1.8.1 | Живой Клинок | «Живой» слой: атмосферные осадки newtab (дождь/гроза/снег/звёзды/туман по blade.weather.*), слэш по плиткам (заменил голографический блик), пульс музыки (tab[soundplaying] + :has), ночная забота ([data-blade-night]/blade.night, тёплые дельты тем), звуковой пакет (шинг старта/фанфара/чим, WebAudio-синтез, blade.sounds.volume). CSS — Gemini (верифицировано GLM), инженерия — GLM. Не опубликован — вошёл в 1.9.0 |
| 1.9.0 | Тёмный Терминал | Палитра Ctrl+K (BladePalette: фильтр/стрелки/Enter, API window.BladeSettings из Settings 1.12.0) + Облики Клинка (5 пресетов тема+фон + слот «Мой Облик», преф blade.visage.mine). Отдельно не публиковался — вошёл в 1.9.1 |
| 1.9.1 | Новый Силуэт | Вертикальные вкладки были реализованы, проверены диагностикой (всё работало) и ОТКЛОНЕНЫ владельцем как непрактичные — вырезаны полностью, преф гасится на старте (страховка от нативного тумблера). Остались: плавающая капсула навбара (прокачана: 8/14px, радиус 16, акцентное свечение), плитки-карточки 3D (наклон 7/9° + scale), Splash 2.0 (слово 46px, блик встречает «шинг»), заставка простоя #blade-idle (3 мин, гварды fullscreen/музыки). CSS — Gemini (сверено с движком), инженерия/чистка — GLM (Settings 1.13.1, Palette 1.0.2). Отдельно не публиковался — вошёл в 1.9.2 |
| 1.9.2 | Клинок Живёт | 13 микро-вау (CSS — Gemini/Antigravity, селекторы сверены: [dragtarget] tabs.css:209, [privatebrowsingmode]; JS-хуки контрактов — GLM): искры закрытия (.blade-ghost), разрез открытия ([fadein]), перековка тем (transition), вспышка окна (.blade-flash), блик кнопки B, разрядка капсулы (.blade-loaded), воспламенение короны, шиммер окна, звёздная пыль приватки, глиф погоды в часах, карточка драга, пульс ввода палитры (.blp-typing), закатная волна. Фикс-раунды по живому фидбеку: иконка B (brightness 1.7+glow), искры-частицы (--dx/--dy), СЛУЧАЙ ЧАСОВ: CustomizableUI FF155 не строит узел позднерегистрируемого custom-виджета (placement без DOM, 13 раундов диагностики через mark/скрины/консоль) — часы переведены на прямую DOM-вставку в #nav-bar (нативный паттерн движка), бесклассовая кнопка + спаны, глиф погоды одним спаном. Отдельно не публиковался — вошёл в 1.9.3 |
| 1.9.3 | Дом без Эха | Не публиковался — через час отменён владельцем. Урок зафиксирован: фидбек «не нравится дубль на главной» ≠ «убери часы» — перед радикальным удалением любимой фичи уточнять желаемое поведение. Дожил в конвейере как чистка: BladeDiag/BladeDiag2.uc.js навсегда исключены из патчей |
| 1.9.4 | Вечный Циферблат | Hero-часы возвращены (BladeNewtab 1.4.0) и переехали на все страницы, кроме главной: about:newtab/home — `.blade-no-clock` (время в навбаре, дубль убран), остальные — полный циферблат 88px с секундами и дыханием. Тёмная подложка-градиент за hero (читаемость на светлых сайтах, статическая — без backdrop-filter), гвард фуллскрина (часы не висят над видео/презентациями), хроника обновлений — только на главной. Не публиковался отдельно — вошёл в 1.9.5 |
| 1.9.5 | Голос Клинка | Саундскрины тем (BladeSounds 1.3.0): у каждой темы свой тембр — pitch/gain/форма волны/Q, читается с data-blade-theme на каждом звуке, переключение темы перекрашивает звук мгновенно. blood 0.70 (низко и зло), volt 1.35+пила (электроукол), cherry 1.25 (сладкий колокольчик), grey ×0.55 (матово-тихо), midnight 0.78 (глубокий синус), purple синтивейв, green чип-тюн, orange тепло-треугольник. Первая фича, отобранная по вето-фильтру владельца (конвенция 12). Не публиковался — вошёл в 1.9.6 |
| 1.9.6 | Дом и Дорога | Финал часовой саги (третий раунд): раскладка «у каждой странице свой часы» — Hero с большим циферблатом ТОЛЬКО на about:newtab/home (BladeNewtab 1.5.0, семантика v1.2.0, срезаны no-clock/подложка/фуллскрин-гвард v1.4.0), навбар-часы прячутся на главной (BladeClock 2.6.0: btn.hidden по currentURI + страховка в тике). УРОК №2 (двойник урока 1.9.3): «виджет появлялся на других страницах» = НАВБАР-часы на других страницах, а не Hero везде; при неоднозначности раскладки — подтверждать у владельца КАКУЮ штуку куда двигаем, до кода |
| 2.0.0 | Переплавка | Суперглобальная ночная смена (5 волн за ночь, все с Пульсом GREEN): стенд BladePerf 2.0 + Пульс Клинка (BladePulse, самодиагностика GREEN/YELLOW/RED); BladeCore 1.1.0 (реестр every/listen, снос слепых ретраев); саундскрины тем в контексте (BladeSounds 1.4.0: шинг темы через шину, непогода/ночь/приватка глушат тембр); солнечные часы (BladeClock 2.7.0: восход/закат open-meteo, проверено Днепр 06:13/18:56); помодоро в палитре (1.2.0); батарея (BladeBattery 1.0.0); шрифты сабсет 1.68МБ→551КБ (−67%, оси целы, оригиналы в Backups); мёртвый CSS срезан; полный редизайн Newtab под бренд AVA 3.0 (логотип ava-logo.png на сплеше и водяном фоне newtab, ava-sq.png в центре заставки простоя, строгие тёмные карточки плиток с верхней лазерной гранью, 4 состояния [Loading, Error, Empty, Success], ARIA/a11y). Артефакты: Patch 6.7МБ + Full 149.2МБ (движок с v3-хирургией — закрывает ограничение №5) + пересобранный Setup (exe+data.zip 2.0.0). Отдельно НЕ публиковался — ночь перетекла в фикс-волны 2.0.1/2.0.2 (2026-09-14), которыми и был опубликован. Тогда же осознанно отложенное (трекается в ROADMAP-2.0.md): декомпозиция Settings (без глаз нельзя — 10 точек риска) — **ВЫПОЛНЕНО 2026-09-22, шаги 1–8, 1765→351 строк**; склейка CSS-дублей, Google AI Overview (нужна живая DOM-сессия). Уроки ночи: конвенция 13 (PS 5.1 quoting), a11y-дерево = глаза без скринов, синтетический Ctrl+K не открывает палитру (проверить руками) |
| 2.0.5 | Срез Катаны | **Волна Katana Slash (2026-09-17, 8a377ee):** монолитная типографика часов — нативные глифы двоеточия вместо спан-склейки (контур циферблата один на все темы); бесшовный проблеск **Katana Shimmer** проходит по всему времени разом (не по отдельным цифрам); midnight мигрировал на Unbounded 800 + aurora-свечение; **Blood переписан** — багровый туман и дуга клинка вместо «игрушечных» капель (суперсирует капельный BladeBlood-шрифт из 2.0.4: шрифт с впаянными каплями заменён на атмосферный эффект); per-theme сигнатурные ховеры плиток в `userContent.css`. BladeNewtab 1.7.1→**1.9.0**, VERSION/CODENAME подняты. **ОПУБЛИКОВАН: GitHub Releases, Patch 10.4МБ, Latest** (апдейтер друзей подхватит за сутки / «Проверить сейчас»). Ревизия 2026-09-22 (эта сессия): волна ехала с неподконтекстным багом — см. конвенцию 16 и BladeContextMenu 1.0.1 |
| 2.0.4 | Кровавый Циферблат | **Волна «демонические часы» (2026-09-15, ночь, 4 раунда живого фидбека владельца):** per-theme типографика Hero-часов — у каждой из 9 тем свой шрифт (red=Nosifer, purple=Monoton, green=VT323, grey=Michroma, orange=RubikBurned, cherry=KaiseiDecol, midnight=ZenDots (Syncopate выпилен из google/fonts), volt=RubikGlitch; сабсет pyftsubset до цифр 6160КБ→80КБ, оригиналы в Backups\fonts-originals-2026-09-15, OFL-лицензии рядом) и уникальный эффект циферблата в HERO_CSS; BladeNewtab 1.5.1→**1.7.1**. Blood после трёх вето владельца (WetPaint-шрифт → Nosifer+градиент → Unbounded+CSS-капли) — полностью кастомный шрифт **BladeBlood**: генератор `make_blood_font.py` (Unbounded-800 + капли-сосульки, влитые TTGlyphPen'ом в сами глифы, descender расширен; варианты A/B/C + превью в TestReports\blood-font-preview, дефолт B) + кровавый градиент background-clip:text. Плитки: движковый аудит omni — добавление через «+» в pinnedOnly НЕ ломалось (TOP_SITES_PIN → _pinSiteAt → pinnedLinks.pin без капа; topика newtab-linkAdded не существует) → BladeTiles.uc.js удалён как мёртвый из dev и боевого; ин-грид плюсик + hover-оверлей скрыты в userContent.css (не сдвигают сетку), добавление — контекстное меню плитки «Добавить новый ярлык» (живой тест: меню → форма → OK). УРОК: раунд 1.7.0 убил per-theme шрифты unscoped-правилом на спанах — регрессию поймал владелец визуально (моя проверка её пропустила: проверял блоки, не каскад); в 1.7.1 спаны вырезаны, в проверку добавлены grep-инварианты шрифтов по всем 9 селекторам. **ОПУБЛИКОВАН 2026-09-15: gh release v2.0.4 (Patch 10.3МБ, 233 файла + sha256), Latest; задеплоено владельцу в боевой профиль до публикации (4 файла, SHA256 OK).** |
| 2.0.3 | Молния | **Волна ночи 2026-09-15 по словам владельца («внедри обои», «подними часы», «при грозе обои уродуются полосами», «нет русского в настройках»):** серия обоев V2.0 — 9 JPG 2560x1440 из «BLADE WALLPAPER V2.0» владельца (bg_v2_red/blood/cherry/midnight/violet/toxic/ashen/ember/volt.jpg, PNG→JPG q87 = 2.6МБ суммарно), реестр BladeCore BUILTIN_BGS + преф-блоки/атрибутные дубли userContent.css; **гроза мигрировала с newtab на панель** (конвенция 14): полосы-струи и вспышки с newtab снесены, в userChrome секция 24-бис капли #nav-bar::after + молнии-зигзаги #nav-bar::before в цвет темы (--blade-rain-core/halo, белый стержень color-mix 55/45, 3 зоны разрядов, только transform/opacity); Hero-часы подняты margin-top 10vh→5vh (BladeNewtab 1.5.1); **BladeLang.uc.js 1.0.0** — сидинг langpack-ru через AddonManager (русский в Browser Language на патч-установках, закрывает ограничение 2.0.2). Живо проверено на dev (Пульс GREEN, меню B показывает все V2-фоны, v2red переключается, langpack active после рестарта, идемпотентность SKIP cooldown) и задеплоено владельцу (v2.0.3 · Молния в меню B). **ОПУБЛИКОВАН 2026-09-15: gh release v2.0.3 (Patch 10.3МБ + sha256), Latest.** Сопутствующий фикс инфраструктуры: xul.dll (176МБ) отсутствовал в Skeleton-Stage (вылет «Couldn't load XPCOM» при любом запуске) — восстановлен копированием из установленной копии; в .gitignore он уже был (локальный артефакт) | BobliksSettings 1.14.5 — кнопка B на прямой DOM-вставке (FF155 не строит узел позднерегистрируемого custom-виджета — свежие профили Setup теряли кнопку навсегда; mount по browser-delayed-startup-finished + дедуп); восстановлен загрузчик fx-autoconfig в config.js движков (вписка autoseed его вырезала — с 15:59 основной браузер шёл без uc.js, инцидент «кнопка Б пропала»); BladeProfileGuard 1.0.3 (гвард от угона Default при явном -profile); фикс маскировки финального mark; **русский из коробки**: langpack-ru в chrome\extensions поставки + Setup 1.4.2 SeedLangpackPolicy (копия xpi в профиль + policies Install) + user.js intl.locale.requested=ru,en-US. Состав data.zip проверен, распаковка-верификация сумм OK, полный GUI-прогон установщика GREEN с кнопкой. Артефакты: Patch 7.7МБ + Full/data.zip 149.4МБ + дистрибутив Release\Blade-Setup-2.0.2.zip (205.5МБ; устаревшие Blade-Setup-2.0.1*.zip и -v2/v3 — снести); теги на GitHub (v1.7.x) указывают на README-коммит, а не релизные — косметика, апдейтер читает Releases. **ОПУБЛИКОВАН 2026-09-14 ночью: gh release v2.0.2 (Full 149.4МБ + sha256), Latest; апдейтер Full-осознан (isFull → applier меняет движок + кастом, проверено по коду); русскоязычным друзьям-патчевикам русский UI не приедет до переустановки Setup 1.4.2+ (патч не сеет policy для langpack) — осознанное ограничение** |
| 2.0.2 | Ливень | **Фикс-волна вечера 2026-09-14, по слову владельца версия поднята с 2.0.1 (тот не публиковался, всё вошло сюда):** BobliksSettings 1.14.5 — кнопка B на прямой DOM-вставке (FF155 не строит узел позднерегистрируемого custom-виджета — свежие профили Setup теряли кнопку навсегда; mount по browser-delayed-startup-finished + дедуп); восстановлен загрузчик fx-autoconfig в config.js движков (вписка autoseed его вырезала — с 15:59 основной браузер шёл без uc.js, инцидент «кнопка Б пропала»); BladeProfileGuard 1.0.3 (гвард от угона Default при явном -profile); фикс маскировки финального mark; **русский из коробки**: langpack-ru в chrome\extensions поставки + Setup 1.4.2 SeedLangpackPolicy (копия xpi в профиль + policies Install) + user.js intl.locale.requested=ru,en-US. Состав data.zip проверен, распаковка-верификация сумм OK, полный GUI-прогон установщика GREEN с кнопкой. Артефакты: Patch 7.7МБ + Full/data.zip 149.4МБ + дистрибутив Release\Blade-Setup-2.0.2.zip (205.5МБ; устаревшие Blade-Setup-2.0.1*.zip и -v2/v3 — снести); теги на GitHub (v1.7.x) указывают на README-коммит, а не релизные — косметика, апдейтер читает Releases. **ОПУБЛИКОВАН 2026-09-14 ночью: gh release v2.0.2 (Full 149.4МБ + sha256), Latest; апдейтер Full-осознан (isFull → applier меняет движок + кастом, проверено по коду); русскоязычным друзьям-патчевикам русский UI не приедет до переустановки Setup 1.4.2+ (патч не сеет policy для langpack) — осознанное ограничение, снятое в 2.0.3 через BladeLang** |
| 2.0.1 | Ливень | День багфиксов + AVA 3.0 (2026-09-14; НЕ публиковался — по слову владельца всё вошло в 2.0.2): BladeShield 1.8.1 (анти-детект списков uBO через mozStorage); возврат Google-блока поверх Dark Reader; кнопка загрузок всегда видна (autohideButton=false + nav-bar ensure); отзыв шазам-плитки (pinned/defaults/полиси/каверы + NewTabUtils-блок); **фикс «плитку невозможно удалить навсегда»** — движковый патч pinnedOnly (Apply-Blade-Tiles.ps1, см. «Фичи по слову владельца») + снос мёртвого default.sites-JSON; **AVA 3.0**: новая иконка (Branding master/ico мультисайз, rebrand 86 ассетов + rcedit), сплеш/idle/hero/плитки — FrontendDesigner-агент, верифицировано GLM (node --check, баланс скобок, гварды батареи, covers-селекторы); BobliksSettings 1.14.3, BladeNewtab 1.5.1; **страж голого запуска** BladeProfileGuard 1.0.2 (два живых баг-фикса: XCurProcD→XREExeF.parent, плотная нумерация ProfileN) + сидинг profiles.ini в установщик (SeedFirefoxProfilesIni; Setup exe пересобран 2026-09-14); чистка мусора владельца: мёртвые секции [Install841AB…] + [Install5BF0C4DC…] и 3 мусорных профиля → Backups\profiles-cleanup-*, нумерация [ProfileN] уплотнена. Движковые части уезжают друзьям только Full-релизом. Итог дня: дождь переехал с обоев на панель (секц. 24 userChrome, в цвет темы, 10 палитр --blade-rain-core/halo, opacity 0.68); AVA-сплеш/заставка/hero ВОЗВРАЩЕНЫ после отката (секц. 25; плитки остались старые 3D по требованию); релиз 2.0.1 «Ливень» собран: Patch 7.2МБ + Full 148.8МБ + Setup AVA GX (61.9МБ exe + data.zip 148.8МБ с сидингом профилей); data.zip проверен: сплеш/дождь/гвард/pinnedOnly/VERSION — всё внутри, личного нет. Установщик перебрендирован по слову владельца: все ТЕКСТЫ Blade (сплеш «B L A D E», финиш «BLADE ГОТОВ», кнопка «ЗАПУСТИТЬ BLADE»), AVA — только логотипы-картинки. Дистрибутив собран в Release\Blade-2.0.1-Ливень\ (Setup.exe + data.zip + SHA256 + README); публикация в GitHub отложена владельцем («когда-нибудь»). Фикс установщика (2026-09-14, баг владельца «не создаёт свою папку»): InstallerLogic.EnsureBladeSubfolder — автодобавление \Blade к пути без него (корень диска/чужая папка), запись итога в поле ДО установки, модал-предупреждение при непустой чужой папке; 15/15 юнит-кейсов (включая корень «D:\» без потери диска после TrimEnd — поймано тестом), Release переупакован. **Вечерний фикс-пакет (инцидент «кнопка Б пропала», см. раздел выше): config.js движков = загрузчик+autoseed восстановлен (3 копии), BobliksSettings 1.14.5 (кнопка B — DOM-вставка, свежие профили Setup больше не беззвучно теряют кнопку), BladeProfileGuard 1.0.3 (гвард от угона Default при -profile), profiles/installs.ini почищены от следов тестов. СЕТАП ПЕРЕСОБРАН (17:1x): New-Blade-Release.ps1 → Patch 7.2МБ + Full/data.zip 148.8МБ (guard 2c: личного нет), состав data.zip проверен (config.js комбинированный, 1.14.5, гвард 1.0.3, VERSION/CODENAME), релизная папка Release\Blade-2.0.1-Ливень\ обновлена (data.zip + SHA256SUMS перегенерированы), дистрибутив Release\Blade-Setup-2.0.1-v3.zip (205МБ; состав: Setup.exe + data.zip + README + SHA256SUMS из двух строк — только то, что в пакете; проверен распаковкой со сверкой всех сумм + полный GUI-прогон установщика «как друг»: лицензия → кастомный путь (EnsureBladeSubfolder дописал \Blade) → 100% → «ЗАПУСТИТЬ BLADE» → GREEN, кнопка B на месте; v1/v2 — устаревшие, можно сносить). E2E «как у друга»: распаковка data.zip установочным маппингом (App\Firefox64→App\Blade, profile→Data\profile) в %TEMP% + запуск — GREEN, кнопка B на месте, хроника с вечерними фиксами в тикере; за собой вычищено (процессы, каталог, ini-секции). Хроника релиза переписана с полным списком 2.0.1.** |

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
11. **-Notes без ASCII-кавычек:** PS 5.1 не экранирует символ `"` при передаче аргументов нативному процессу — нотсы с `"..."` рвут сборку (PositionalParameterNotFound). Писать «ёлочки». (Урок 1.7.7)
12. **Вето владельца на фичи «для галочки»** (2026-09-12, слова Дени; расширено
   2026-09-13): «есть моменты — всякие замудрённые хоткеи, режим чтения и т.д. —
   90% людей не юзают; тема в определённый день — сильная нагрузка на ядро, а
   пользы ноль». НЕ предлагать и НЕ делать: лабиринты хоткеев и любые новые
   клавиатурные комбинации, клавиатурную навигацию/фокус-ринги и прочую
   «доступность», которой никто не пользуется, режимы чтения/фокуса,
   тем-по-дням/праздникам/лунным фазам и вообще вещи, которые никто
   использовать не будет. Подтверждение практики (2026-09-14): плитка-шазам
   отозвана владельцем через день. Критерий отбора: либо реальная ежедневная
   польза, либо вау без нагрузки на ядро. Одобрено владельцем по этому критерию:
   саундскрины тем (1.9.5), перевод в ПКМ, кнопка загрузок.
13. **PS 5.1 Start-Process не квотит пробелы в аргументах** (урок ночи 2.0):
   `-ArgumentList '-profile','F:\firefox michael edition\...'` уезжает в cmdline
   БЕЗ кавычек → Firefox создаёт мусорный профиль из первого слова пути, а
   хвост летит как URL (2026-09-13: создался F:\firefox, chrome не грузился,
   40 минут диагностики). Рецепт: единая строка с ручными кавычками —
   `-ArgumentList '-no-remote -profile "F:\firefox michael edition\..."'`.
   Бонус-уроки той же ночи: Start-Process возвращает PID лаунчера, который
   сразу умирает (настоящий главный процесс ищи по CommandLine-фильтру);
   CloseMainWindow() — только по настоящему PID; taskkill только /PID /T,
   никогда /IM. Живые прогоны — только dev-профиль F:, профиль владельца C:
   не трогать.
14. **Миграция грозы на навбар и обои V2.0 (2026-09-15):** Гроза на newtab (`userContent.css`) уродовала обои полосами струй и вспышками — полностью отключена на newtab (удалены keyframes `blade-thunder-*` и `blade-rain-drop-a`, очищена комбинация ночь+гроза) и перенесена в `userChrome.css` (секция 24-бис): капли дождя на `#nav-bar::after` + молнии на `#nav-bar::before` (зигзаг-разряды, вспышка капсулы, keyframes `blade-navbar-lightning`, 3 зоны разрядов, строго transform/opacity) с наследованием палитры тем (`--blade-rain-core`/`--blade-rain-halo`) и стоп-кранами батареи/motion. В `userContent.css` добавлены 9 встроенных фонов V2.0 (преф-блоки + атрибутные дубли `v2red`..`v2volt`). Hero-часы в `BladeNewtab.uc.js` подняты до `margin-top: 5vh` (было `10vh`) под новые композиции обоев.
15. **Per-theme эффекты на Hero-часах + 9 шрифтов тем (2026-09-15):** шрифт часов обновлён до `blade-horror` (Nosifer, OFL, horror-стиль с потёками; `chrome/fonts/Nosifer-Regular.ttf`) с фолбэком на Segoe UI; добавлены 10 @font-face в userChrome.css и userContent.css (blade-horror, blade-blood, blade-custom-blood, blade-neon, blade-terminal, blade-steel, blade-fire, blade-sakura, blade-aurora, blade-volt). BladeNewtab.uc.js обновлён до v1.7.1: для blood сгенерирован кастомный TTF-шрифт BladeBlood (`make_blood_font.py`) на базе Unbounded 800 с органичными каплями крови, впаянными прямо в контуры глифов цифр 0-9 и двоеточия (3 варианта A/B/C в TestReports\blood-font-preview\, дефолт B в chrome\fonts\BladeBlood-Regular.ttf, сгенерировано визуальное превью preview-ABC.png); все временные спаны удалены, каскад шрифтов восстановлен — каждая из 9 тем гарантированно получает свой уникальный шрифт без перекрытий. Плитки «+» (вердикт движка, 2026-09-15): ин-грид кнопка `.top-site-outer.add-button-tile` и hover-оверлей `.add-button-hidden` скрыты в userContent.css (не занимают слот в сетке 3x5 и не сдвигают плитки); добавление штатно доступно через контекстное меню любой плитки («Добавить ярлык» / AddTopSite); в scope edit-контейнера сохранён ре-шоу. BladeTiles.uc.js (был написан под несуществующий observer) УДАЛЁН из dev и боевого профиля. Сабсет pyftsubset до «0123456789:- » = 6160КБ→80КБ, оригиналы в Backups\fonts-originals-2026-09-15. Волна опубликована: v2.0.4 «Bloody Dial» (ddd265a) + v2.0.5 «Katana Slash» (8a377ee, монолитные часы + Blood-переписывание + ховеры плиток).
16. **Один источник истины для пунктов меню (2026-09-22, правка волны «Киберпунк-контекстные меню»):** иконки контекстного меню назначаются ТОЛЬКО реестром `ICON_MAP` в `BladeContextMenu.uc.js` — скрипт ставит класс `.menuitem-iconic` и инлайнит переменную `--menuitem-icon` на сам пункт (это канон движка, так же делает `contextmenu.css` омни: `#context-back { --menuitem-icon: url(...) }`). Дублирующий список id в `userChrome.css` ЗАПРЕЩЁН — в волне 2.0.5 CSS и JS разъехались (13 пунктов без иконки, битый `command-pick.svg`, мёртвый `#context-translate`). Атрибут `image` НЕ ставить: движок прокидывает его в `.menu-icon` как `srcset`, а правило `content: var(--menuitem-icon)` в `menu.css` стоит под guards `:not([srcset])` — иконка гаснет. Подчёркивания акселераторов — один канал: префа `ui.key.chromeAccess=0` в `user.js` (снимает раньше, чем грузится uc.js); мутация `removeAttribute("accesskey")` на `popupshowing` запрещена — она убивала активацию пунктов по Alt+букве. CSS-правило на `menupopup label html|span.accesskey` оставлено как визуальный ремень-страховка.
17. **Вуаль обоев — константа единого источника (2026-09-22, фикс «темы щакалит по качеству обоев»):** жалоба владельца «качество картинки ЛЮБЫХ обоев плохое, будто ухудшает — и своих, и встроенных». Разведка установила: браузер пиксели НЕ перекодирует (ноль canvas/toDataURL/createImageBitmap в chrome/, `chooseCustomWallpaper` копирует файл as-is), исходники качественные (DQT-парсер: avgDQT≈15 ≈ q78-80 для V1/V2; попытка пересжать V2 в q85 дала avgDQT 18.4 — ХУЖЕ, откачено). Причина — вшитый тёмный градиент `linear-gradient(180deg, rgba(10,10,12,0.55) 0%, rgba(10,10,12,0.22) 45%, rgba(10,10,12,0.45) 100%)`, который лёг ПЕРВЫМ слоем в каждое из 46 объявлений `body.activity-stream` background — гасит контраст ×0.5, насыщенность ×0.4 и читается глазом как «мыло/ухудшенное качество». `background-attachment: fixed` + `cover` НЕ виноваты (изолированный тест полосами: чистое масштабирование, дельта с Lanczos < 0.5), фильтров/блюра на самих обоях нет. **Контракт: альфа вуали — одна константа в 4 местах** (userContent.css ×42, BladeThemeEngine ×3 — `applyBgToDoc`/`applyThemeSheet`/`applyCustomBgSheet`, BobliksCovers ×1 — генератор covers.css); covers.css НЕ править руками (регенерируется). Замена 0.55/0.22/0.45 → 0.35/0.10/0.25 (46 вхождений, инвариант grep: старая строка = 0). Визуальный аудит FrontendDesigner (зрение): B текущий 5.0/10 → D новый 9.5/10; live-скрин TestReports\cmp-wallpaper.png/cmp-wallpaper2.png/live-newtab-after.png — 9/10, читаемость UI сохранена (контраст часов >16:1). Методология: цифровая оценка через DQT-маркёры (0xDB) точнее размера файла; NCC-матчинг для сверки источников; для визуальных вердиктов — субагент со зрением (у основного агента его нет в этой сессии).
18. **Удаление обоев Ember Flow (2026-09-22):** по решению владельца удалены низкокачественные обои 1280x720 Ember Flow (`bg_emberflow.webp` 679КБ) — вырезана запись из `BUILTIN_BGS` в `BladeCore.uc.js`, в `BladeVisages.uc.js` облик «Неоновый Город» переключён на качественный встроенный фон `v2violet`, в `userContent.css` удалены преф-блок `@media -moz-pref("bobliks.bg.emberflow")` и атрибутный дубль `:root[data-blade-bg="emberflow"]`. Файл `bg_emberflow.webp` удалён из `chrome\img\`.
19. **Кровавые часы: двухслойный объём в покое (2026-09-22, фикс «блуд кажется шакальным»):** владелец жаловался на кровавую тему, визуальный аудит на РОДНОМ фоне Blood Moon дал 7.8/10 — главная проблема не в цветах, а в плоско-белых цифрах: `blade-katana-glint` проходит срез за 22% цикла 7.5с, остальные 78% `background-position: 160%` смотрит в зону градиента со сплошным `#ffffff` — часы 5.85с из 7.5с как мелкий трафарет. Фикс: `.bh-hm` крови переведён на двухслойный фон — верхний sweep-слой прозрачный вне полосы блика (`transparent 0-38% / rgba(255,140,160,0.35) 44% / #fff 50% / ... / transparent 62-100%`), нижний статичный вертикальный металлический градиент `linear-gradient(180deg, #fff, #fbe7ec 55%, #f2c0cc)`. Добавлены ОТДЕЛЬНЫЕ `@keyframes blade-katana-glint-blood`, двигающие ТОЛЬКО верхний слой (`-60% 0, 0 0 → 160% 0, 0 0`) — база статична; общие `blade-katana-glint` и остальные 9 тем не тронуты. **Урок-инвариант:** timing-аудит анимации (доля активной фазы) так же важен, как цветовой — «плоско» могло быть не материалом, а расписанием. Первый скрин темы показывал 3/10 из-за кэша префов remote-newtab (демонстрировал фиолетовый фон при активном bloodmoon-префе) — аудит валиден ТОЛЬКО на чистом рестарте; `@media -moz-pref()` в remote-контенте не перевчитывается без рестарта. Визуальный аудит: 7.8 → 9/10, регрессий нет.

20. **Аудит защитного слоя: наша защита НЕ виновата в жалобе на OLX (2026-09-22):** пришла жалоба «пропадает поиск и не работает OLX в Одессе, в другом браузере всё ок, подозрение на наш ад-блок». Полный фронтенд-форензик дал: **BladeShield v1.8.1 не виноват** — движок uBO здоров (компилированные списки и оба selfie-блоба на месте, `UOSC/lz4_1` magic совпадает с uBO 1.75.0, `blockedCount: 1366` — фильтрация жива), BladeShield только аддитивно добавил 4 annoyance-списка к стоковым 10 (см. `BladeShield_backup.txt`), ничего не удалял. Пугающие `integer 4294967296` в `object_data` — это НОРМАЛЬНЫЙ маркер Firefox IDB для внешних блобов (`file_ids` → `idb\*.files\`), а не порча. **Списки uBO чисты относительно OLX**: greps всех 13 подписанных списков по `olx` дают только рекламные слоты (`div[data-testid="qa-advert-slot"]`), share-кнопки (`m.olx.ua##div[data-testid="share-button"]`) и трекеры (`tracking.olx-st.com` в easyprivacy) — core-функции не блокируются; региональных RU/UA списков НЕ подписано. DarkReader/SponsorBlock чисты (нет site-exceptions на olx.ua). **Воспроизведение на дев-инстансе (Skeleton-Stage, F:):** `https://www.olx.ua/odessa/` грузится ПОЛНОСТЬЮ — листинги, цены, пагинация, категории, cookie-баннер; поиск в дереве доступности присутствует. **Корень странной 403 на curl — не наш браузер:** olx.ua отдаёт 403 на TLS-fingerprint curl'а (AWS WAF bot-detection), при этом HEAD-запрос проходит как 302/nginx — сеть и DNS у машины пользователя в порядке (системный резолвер и Cloudflare DoH дают разные, но оба живые диапазоны AWS). **Единственный реальный дефект, обнаруженный попутно:** два imported URL-списка (`antiadblockfilters.txt`, `filters.adtidy.org/.../14.txt`) объявлены в `userSettings.importedLists`, но НИКОГДА не скачивались (нет cache-записей) — анти-адблок-протекция на сайтах с WAF-обнаружением блокировщиков может не срабатывать. **Урок-инвариант:** `curl`-аудит сайтов за AWS WAF ненадёжен из-за TLS-фингерпринта; атакующий тест на блокировку ПО должен идти через реальный браузер. Владелец подтвердил: у нас всё работает — проблема локальна у того пользователя (вероятно его собственный DNS/ETP/состояние профиля), а не в сборке.

21. **Пилотный визуальный апгрейд темы Blood (2026-09-22):** (1) В `BladeNewtab.uc.js` Hero-часы темы blood подключены к кастомному шрифту `blade-custom-blood` (BladeBlood-Regular.ttf с каплями крови, фолбэк `blade-display` / Unbounded); (2) В `userContent.css` введена шкала поверхностей `--bob-surface: #170a0c`, `--bob-surface-2: #221013`, `--bob-surface-line`, `--bob-text: #f3e3e3` (в pref-блоке и атрибутном дубле); (3) Плитки newtab для blood в покое получили обсидиановую подложку с рубиновым краевым светом (`.top-site-outer .tile`, box-shadow/border-color, фильтр смягчён до `grayscale(12%) contrast(1.02)`); (4) В `userChrome.css` капсула `#urlbar .urlbar-background` для темы blood оформлена обсидианом с рубиновым свечением. Аудит: часы 9/10, urlbar 9/10.

22. **КРИТИЧЕСКИЙ ИНВАРИАНТ: атрибутные селекторы тем мертвы на remote newtab (2026-09-22, фикс провала плиток blood):** первый прогон пилота провалился — tile-правила крови лежали на `:root[data-blade-theme="blood"]`, а `about:newtab` в FF155 — REMOTE-процесс, и `applyLiveAttrs()` (BladeThemeEngine.uc.js) ставит атрибут ТОЛЬКО на не-remote документы (гард `!b.isRemoteBrowser` в `newtabDocs()`). Remote-контент красит `applyThemeSheet()` через USER_SHEET **без атрибута**. **Следствие: ВСЯ секция «ИНДИВИДУАЛЬНЫЕ СРЕЗЫ ПЛИТОК» (AVA 3.0, ~900-982 в userContent.css: grey/volt/green/orange/cherry/midnight) — мёртвый код на newtab, перете-матические срезы плиток НИКОГДА не работали.** Фикс: blood-плитки перенесены в `@media -moz-pref("bobliks.theme.blood")` ВНУТРИ `@-moz-document url("about:home"), url("about:newtab")`, после базовых `.tile`-правил (выигрыш source order при равной специфичности) — тот же механизм, через который работают обои. Аудит после фикса: separation плиток 2.5 → 8.0/10, cover art видны, рубиновая кайма видна, обои Blood Moon видны, общая оценка темы 8.5/10, регрессий нет. **Правило для будущих per-theme правил в content: перт-theme стилистика newtab — только через `@media -moz-pref("bobliks.theme.X")` внутри `@-moz-document`; атрибут `[data-blade-theme]` в userContent.css работает только на chrome-окнах (userChrome.css) и не-remote документах.** При переносе остальных тем (фоллоу-ап пилота) — тот же паттерн. Требуется рестарт: pref-cached `@media -moz-pref()` в remote-контенте не перевчитывается без рестарта (конвенция 19).

23. **Раскатка системы материалов на все темы (2026-09-22):** конвенция 22 применена ко всем темам. (1) В `userContent.css` в pref-блоки всех тем (purple/green/grey/orange/cherry/volt/midnight) и в базовый `:root` (дефолт GX Red) добавлена шкала поверхностей `--bob-surface` / `--bob-surface-2` / `--bob-surface-line` / `--bob-text` — каждой теме свой материал (volt: тёмный контрастный текст, остальные светлый). (2) Базовое правило `.top-site-outer .tile` переведено на `var(--bob-surface, #14090a)` — даёт red-материал всем не-тематическим контекстам (включая custom). (3) Вся мёртвая секция per-theme срезов (~904-982) удалена и пересоздана как `@media -moz-pref("bobliks.theme.X")` блоки ВНУТРИ `@-moz-document` (~957-1105): сигнатурный `.tile::after`-срез, hover-подсветка и материал плитки в покое для 7 тем (green сохранил CRT-особенность translateY-сканлайна). (4) **Удалён мёртвый блок `@media -moz-pref("bobliks.theme.red")` — преф `bobliks.theme.red` в коде НЕ существует** (BladeCore не описывает red как тему; red = дефолт при всех сброшенных префах, `activeTheme()` возвращает 'red' по умолчанию). Проверено grep'ом по всему chrome/. **Аудит-подтверждение:** blood после раскатки — 8.5/10, регрессии нет (плитки #0e0000..#100000, рубиновый спектр, фолбэк #14090a перекрыт); midnight — плитки #060606..#080912 (космический обсидиан), cover art видны, циановая кайма видна, система материалов 9/10. Тема и фон — НЕЗАВИСИМЫЕ оси (`bobliks.theme.*` и `bobliks.bg.*`): при переключении темы фон не меняется, это by design, не баг. **Контрольный прогон после возврата blood (рестарт дев-инстанса + перечитка pref-cache): 9/10, паритет с эталоном rollout-blood.png — 7 из 8 плиток идентичны (mean diff 0.00-0.27), материал в покое #170a0c, кайма #441314, cover art на всех 8 плитках, hero/часы целы, артефактов нет.** Подтверждает, что pref-cache remote-контента полностью сбрасывается рестартом (конвенция 19).

24. **Замена кустарного шрифта кровавых часов + сигнатурные шрифты тем (2026-09-22):** владелец назвал шрифт кровавых часов «селючинским». **Корень:** `BladeBlood-Regular.ttf` (3996 байт!) — самодельный шрифт, сгенерированный скриптом `make_blood_font.py` (в `TestReports/blood-font-preview/` лежат варианты A/B/C — тот же скрипт с другим масштабным коэффициентом капель). По факту это Unbounded 800 с процедурно «приваренными» одинаковыми каплями-сосульками, которые из-за `background-clip: text` заливаются белым металлом, а не кровью; базовая линия сломана. **Решение:** двухраундный аудит 9 кандидатов на превью-стенде (`scratch/font-preview.html`, рендерит часы голым шрифтом). Готовые кандидаты провалились: RubikWetPaint — стрит-арт-слайм, Nosifer — ломает базовую линию (девятка 83px против единицы 59px), Vampiro One — premium 8 но readable 5, Pirata One — пираты, Eater — новая кустарщина, Creepster — мультяшный. **Победитель: Metal Mania 400** (Google Fonts) — единственный с readable 8/10 И demon-fit 7/10. В `BladeNewtab.uc.js` тема blood переведена на новый `@font-face blade-metal-mania` (вес **400** — у Metal Mania/Michroma только Regular, вес 800 даёт synthetic-bold = та же кустарщина). **Аналогично grey переведена на `blade-steel` = Michroma 400** (раньше сидела на Unbounded, мёртвый @font-face оживлён): аудит — theme_fit **10/10**, overall **9.5/10**. MIDNIGHT оставлен на Unbounded: Zen Dots атмосферен, но readable 7 + even 7 из-за трафаретных разрезов и перечёркнутого нуля. **Доработка:** блок секунд `.bh-sec` в blood/grey тоже синхронизирован на шрифты часов (вес 400) — раньше был жёстко `var(--blade-display)` Unbounded 800, диссонанс. Финальный аудит крови: 9/10, секунды 100% совпадают с метриками MetalMania-Regular, synthetic-bold нет, базовая линия часов/сунд выровнена до 1px, артефактов нет. Читаемость секунд 26px — 7.5/10 (умеренная, узкий просвет подмывается свечением). Скачаны 5 шрифтов + OFL-лицензии в `chrome/fonts/`. **Итог по сигнатурным шрифтам часов: blood→Metal Mania, purple→Monoton(neon), green→VT323(terminal), grey→Michroma(steel), orange→RubikBurned(fire), cherry→KaiseiDecol(sakura), volt→RubikGlitch, midnight/red/custom→Unbounded.**

25. **КРИТИЧЕСКИЙ ИНВАРИАНТ: `::selection` из USER-стилей мёртв в FF155 (2026-09-22, расследование «выделение текста в цвет темы»):** владелец спросил, возможно ли выделение текста цветом темы. В коде 18+19 правил `::selection` (userChrome.css:186 база + 8 тем + 9 атрибутных дублей; userContent.css аналогично), плюс динамическая генерация в `BobliksChromeStyle.uc.js` (author `<style id="bobliks-chrome-style">`) и `BladeThemeEngine.uc.js:259-261` (custom), плюс `syncSelectionPrefs()` ставит `ui.textSelectBackground`/`ui.textSelectForeground`. **Но дифференциальная диагностика на дев-инстансе (Skeleton-Stage, профиль F:, тема grey) доказала: выделение везде системного бирюзового цвета, а не серого #8a8f98.** Три контекста, все teal: urlbar chrome `#11545d`, example.com (с DarkReader) `#1a515b`, about:support (без DarkReader) `#0e5260`. Преф `ui.textSelectBackground=#8a8f98` стоит в prefs.js, но НЕ применяется. `toolkit.legacyUserProfileCustomizations.stylesheets=true`, userContent.css жив (плитки красятся, -moz-pref работает), баланс скобок 397/397, teal в коде нигде нет (полный grep по репо — Explore-субагент). **Решающий эксперимент:** тест-страница `scratch/sel-test.html` со своим AUTHOR-правилом `::selection { background:#ff0000 !important }` → выделение чистый красный `#a80f0f` (hue 0.0°). **ВЫВОД: Gecko 155 применяет `::selection` из AUTHOR sheets, но игнорирует из USER sheets (userChrome.css/userContent.css).** Доказательство того, что author-инъекция в chrome вообще живёт: рамка фокуса urlbar серая `#8a8f98` — это `var(--accent)` из `bobliks-chrome-style` author sheet, а его же `#urlbar-input::selection` остаётся мёртвым — отдельный вопрос к расследованию (возможно, `::selection` на HTML `<input>` внутри XUL browser.xhtml рендерится нативно). **Лечение (доказано возможным): per-theme `::selection` поднимать через AUTHOR sheet — например `nsIStyleSheetService.loadAndRegisterSheet(uri, SSS.AUTHOR_SHEET)` из `applyThemeSheet()` (сейчас туда можно добавить `::selection{background:<accent>!important;color:<selFg>!important}` в тот же data:-лист).** Тест-стенд: `scratch/sel-test.html`. Скрины: `TestReports/selection-blood.png`, `selection-blood-ctrla.png`, `selection-content-grey.png`, `selection-web-grey.png`, `selection-support-grey.png`, `selection-support2-grey.png`, `selection-authorsheet.png`.

26. **Тема не переключается живьём через about:config (2026-09-22, находка):** в `BladeThemeEngine.uc.js` **нет pref-observer на `bobliks.theme.*`**. Ручная смена префов в about:config не вызывает `setTheme()` / `applyLiveAttrs()`, поэтому `data-blade-theme` на chrome-`documentElement` остаётся прежним, и часы/тулбар не меняются. Плюс `BladeNewtab.uc.js` инжектит HERO_CSS единожды при старте — правки файла на диске не перечитываются на лету. **Рабочий путь смены темы для аудита: выставить префы в about:config и перезапустить дев-инстанс** (`scratch/stop-dev.ps1` + `run-dev.ps1`), либо переключать через меню кнопки «B» (метод `setTheme()`). Преф `bobliks.theme.grey` до этого теста не существовал (создан в about:config как boolean) — темы, которые ни разу не активировались, не имеют установленного префа, `activeTheme()` читает их с default false.

27. **КРИТИЧЕСКИЙ ИНВАРИАНТ: SVG-иконки в `list-style-image` Gecko 155 — context-fill и currentColor мертвы, работает только литеральный fill (2026-09-22, полный реворк значка кнопки B):** владелец назвал PNG-клинок «говно полное». Легаси-растр `btn_blade.png` (тёмный 64x64, контраст 1.4:1, требовавший искусственных фильтров `brightness(1.7) saturate(1.3)`) заменён на векторный силуэт катаны (`chrome\img\btn_blade.svg`, 24x24 viewBox, ~870Б): hilt/guard/blade, spine с sori-изгибом, single-edged kissaki, 83% viewBox. **Путь окраски пришлось менять 4 итерациями:** (1) `fill="context-fill"` + `-moz-context-properties: fill` → рендерится в чёрный/полностью прозрачный; (2) `currentColor` через `color: var(--accent)` на хосте → тоже чёрный #000000 (контраст 1.05:1) — currentColor не резолвится из host-`color` в list-style-image; (3) литеральный `fill="#8a8f98"` остался чёрным, потому что внутри файла остался `<style>.b{fill:context-fill}</style>` — **внутренний CSS-класс (specificity 0,1,0) ВСЕГДА перекрывает presentation attribute**; (4) убрать `<defs>/<style>` полностью, оставить чистый presentation attribute → **прорыв**. Дополнительно: XML-комментарий, содержащий `--` (например с `var(--accent)`), делает файл невалидным (`ET.parse` ловит на line 4 col 42) — все 4 итерации были битым файлом, list-style-image просто не грузился. **Финальный механизм: 9 per-theme файлов** `btn_blade-{red,blood,purple,green,grey,orange,cherry,midnight,volt}.svg` с литеральным fill цвета темы (генератор `scratch/make-blade-icons.py`), переключаются `@media -moz-pref("bobliks.theme.X")` блоками в `userChrome.css` (~458-586: base = red fallback для custom/дефолта). Подтверждено владельцем на purple: иконка фиолетовая, катана читается. **Аудиторские огрехи: drop-shadow halo может мостить 1.4u зазоры между частями; 1px смещение центроида — косметика.**

28. **Полный реворк кнопки B и попапа (2026-09-22, «выглядит круто когда нажимаем»):** (1) **Состояния кнопки** — добавлено `:active` (механический отклик: `scale(0.91)`, `brightness(1.25)`, `border-color` flash, transition 0.04s), оживлён `[open]` — `BladeMenuButton.uc.js:52-92` ставит/снимает `open` + `aria-expanded` на `popupshown`/`popuphiding`/`popuphidden` (раньше CSS-правила `[open]` были мёртвыми), hover/[open] — двухслойный halo `drop-shadow(0 0 9px accent) drop-shadow(0 0 3px #fff)`; (2) **Двойная рамка попапа убрана** — `#bobliks-settings-popup` в userChrome.css И `::part(content)` в `MENU_CSS` (BladeMenuPopup.uc.js:82) одновременно рисовали border/radius → паразитный двойной контур; (3) **Акриловое стекло признано невозможным** — XUL `<panel>` в FF155 это отдельное нативное окно ОС, `backdrop-filter` не сэмплирует родительское окно браузера (подтверждено визуально: blur_strength=none), полупрозрачный фон просто проваливается в системный чёрный. Вместо мёртвого акрила — плотный материал: двухслойный градиент (`#181820→#0d0d13→#0a0a0e`) + верхний блик + акцентный подмес 7%/4%; (4) **Переменная-источник акцента для author-стилей — `--bob-accent`, НЕ `--accent`** — `--accent` из userChrome.css не резолвится в author sheet (MENU_CSS давал красный fallback `#ff2a2a`, рамка была красной на purple-теме), а `--bob-accent` инжектится `applyThemeSheet()` USER_SHEET'ом гарантированно — на нём и построены color-mix'ы рамки/материала; (5) **Убраны дубли анимаций попапа** (были `bp-in` и `blade-menu-wrap-in`/`blade-menu-body-in` — translateY vs translateX конфликтовали). **Подтверждено владельцем: кнопка в [open] подсвечена, попап стоит по центру под кнопкой.**

29. **Волна 2: Живые дышащие полотна-обои для всех тем (2026-09-22):** чистый CSS, 0 файлов. Добавлено 8 живых полотен с многослойными градиентами (радиальные/конусные/линейные) и медленными дрейфующими анимациями композитора (`infinite` / `alternate`, 9-68s) для всех тем браузера: `aurora` (midnight, дрейф сияния циан+синий+индиго), `matrix` (green, падающие фосфорные колонны), `ember` (orange, восходящие искры + тлеющий магматический жар), `plasma` (volt, электрические дуги и резкие вспышки), `synthwave` (purple, ретровейв горизонт + неоновая сетка), `mist` (grey, медленный перелив хладных градиентов в противоход), `sakura` (cherry, мягкий дрейф розового тумана), `inferno` (red, улучшенное дыхание бездны). Каждый фон снабжён тёмным базовым цветом темы (`#04060d`..`#100508`), 16 уникальными `@keyframes` на верхнем уровне `userContent.css`, фирменной константной вуалью (конвенция 17), блоками `@media -moz-pref` и `:root[data-blade-bg]` дублями. В `BUILTIN_BGS` в `BladeCore.uc.js` добавлены все 8 записей с `file: null` (пропускаются `applyThemeSheet`, красятся юзер-стилями). Статичные обои `inferno` и `ember` бережно сохранены через алиасы `infernobg` и `emberbg` (по аналогии с `cherrybg` и `voltbg`), исключая коллизию ID и сохраняя все 21 статичные обоины + `pulse` + `flow`.

30. **Волна 4: Усиление атмосферных частиц AVA 3.0 на newtab (2026-09-22):** чистый CSS, 0 JS-обработчиков мыши. (1) **Мягкий вход:** плавный fade-in на появление (`opacity 0→1`, 1.4s ease-out both) для `#blade-atmosphere` и 1.3s для каждого `.ba-[theme]`; (2) **Глубина и планы:** разделение частиц и слоёв по 3 планам глубины (`z-index` 1..3, масштабы, дифференцированная скорость, лёгкий блюр дальних планов, многослойный `box-shadow`/`drop-shadow` и повышенная яркость ключевых элементов переднего плана); (3) **Насыщение бедных тем:** `red`/`custom` расширен с 4 до 10 алых искр клинка на 3 планах глубины; `green` расширен с 4 до 7 матричных колонок + 3 фосфорные капли бинарного кода `ba-md1`..`ba-md3`; (4) **Доступность и 4 состояния:** `#blade-atmosphere` снабжён `aria-hidden="true"` и стилизованными 4 состояниями (`[data-state="loading"]` 0.45 saturate 0.65, `[data-state="error"]` grayscale 0.55 brightness 0.8, `[data-state="empty"]` 0.12, `[data-state="success"]` 1); (5) Стоп-кран батареи `:root[data-blade-battery]` и видимость Hero (`updateVisible`) полностью сохранены.

31. **Волна 3 + патч-фикс регрессий плиток (2026-09-24):** Wave 3 next-gen плитки принесла два живых бага, пойманных владельцем на дев-инстансе (volt). (1) **Хардкод-акцент в `:focus-visible`** — базовый блок hover/focus плиток (`userContent.css:1398`) красил рамку и glow в хардкод `#ff4a4a`/`rgba(255,42,42,0.7)`, а per-theme блоки переопределяли **только `:hover`** → плитка в фокусе клавиатуры/клика горела красным на любой теме. Лечение: базовый блок переведён на `var(--bob-accent, ...)` + `color-mix` для glow — одним ударом для всех 9 тем + custom (подтверждено: рамка стала жёлтой на volt). (2) **Per-theme `transform` перебивает базовый hover-эффект (КЛЮЧЕВОЙ УРОК КАСКАДА)** — Wave 3 добавила в 8 `@media -moz-pref("bobliks.theme.X")` блоков `.top-site-outer:hover .tile { transform: translateY(-4px) !important; }`. Specificity у этого селектора **идентична** базовому `.top-site-outer:hover .tile`, оба `!important`, а per-theme блок стоит в файле **ниже** → он выигрывает каскад и убивает базовый фирменный эффект (в данном случае — 3D-наклон «Живой Клинок» `perspective(600px) rotateX(7deg) rotateY(-9deg) translateY(-5px) scale(1.03)`) **во всех 9 темах разом**. Лечение: удалены все 8 per-theme `transform` — per-theme блок должен нести ТОЛЬКО цвет/тень (`border-color` + `box-shadow`), геометрия — один раз в базовом блоке. **Проверка на «оригинал» (`git show 8a377ee`) перед удалением обязательна:** легаси-блок `.top-site-outer:hover .tile { transform: translateY(-3px) scale(1.02) }` (строка ~1518 оригинала, ~2197 текущего) идентичен оригиналу и победил бы базовый 3D-поворот и там — значит именно он и есть «норма», которую видел владелец; его НЕ трогать. (3) **Ложная тревога аудитора:** плитки в покое намеренно обесцвечены (`filter: grayscale(...)` → `grayscale(0%)` при hover — стелс-проявление Blade); аудитор, смотрящий плитки в покое, фиксирует «плоские монохромные» — это штатное поведение. (4) Микро-правки атмосферы green: `.ba-mc5` `left: 22%→19%` (отход от контура плитки), `.ba-md2` 4.5px→3.2px. **Подтверждено владельцем: «все ок теперь».**

32. **Волна 5: Тулбар next-gen — живые темы и ритмы (2026-09-24):** (1) **Custom-хамелеон:** оживлена тема-конструктор на `var(--accent)` — мягкое свечение `::before` (radial-gradient на color-mix 30% с медленным дрейфом `blade-live-aurora-drift` 7s alternate), акцентный beam `::after` (`blade-beam-run` 4s, ширина 40%), кнопка B с двухслойным ореолом на `var(--accent)` + keyframes `blade-live-custom-btn` 3.4s alternate и hover/[open]-override без переопределения базовой SVG-иконки; (2) **Характерные ритмы тем:** заменено симметричное дыхание на сигнатурную динамику: blood — двойной сердечный ритм 5s (`blade-live-breathe-double`, `blade-live-breathe-double-strong`, `blade-live-button-breathe-double`); cherry — асимметрия падающего лепестка 4.5s (`blade-live-cherry-petal`); volt — резкий электрический разряд 3s (`blade-live-volt-flash`, 2-8% вспышка без alternate); (3) **Hover/[open]-overrides кнопки B:** добавлены специфичные правила для red (#ff4a4a), blood (#ff1a3c), purple (#b44bff), orange (#ff6a1f), cherry (#ff5c85) и custom (var(--accent)); (4) **Очистка мёртвого кода:** удалены осиротевшие keyframes (`blade-live-breathe`, `blade-live-breathe-strong`, `blade-live-button-breathe`, `blade-live-cherry`, `blade-live-cherry-strong`, `blade-live-volt-hum`), сохранены используемые button-keyframes (`blade-live-cherry-btn`, `blade-live-volt-btn`). Баланс скобок CSS сохранён.

33. **Эффект A13: Удар клинка при выборе вкладки (2026-09-24):** при переключении вкладки (`TabSelect`) под выбранным табом вспыхивает тонкая (2px) акцентная линия `var(--accent, #ff2a2a)` со статическим двойным `box-shadow` (конвенция 6: keyframes `blade-tab-hit-flash` 0.5s строго на `transform`/`opacity`: разгорание из центра `scaleX(0.2)→scaleX(1)` и таяние). Позиционирование вычислено относительно хоста `#navigator-toolbox` (`r.left - hr.left`, `r.bottom - hr.top - 1`). Реализован дедуп — при быстром переборе табов предыдущий `.blade-tab-hit` снимается, слои не копятся. `syncLaser()` сохранён первой строкой колбэка `TabSelect`. Одноразовый DOM-узел снимается через 550мс. Стили — в AUTHOR-инъекции `BladeWindowFx.uc.js` (`#blade-fx-style`, конвенция 34), логика там же.

34. **AUTHOR-инъекция для HTML-нод в XUL-документе (2026-09-25, инцидент «эффекты не видны»):** стили для DOM-узлов, создаваемых JS через `createElementNS('http://www.w3.org/1999/xhtml', ...)` в chrome-документе, **нельзя класть в `userChrome.css`**. `userChrome.css` грузится USER_SHEET'ом, который в XUL-документе не достаёт HTML-элементов — правила молча не матчатся, нода остаётся `position:static; opacity:1` и эффект невидим. Дополнительная ловушка: префикс `html|` (валидный в `userChrome.css`, где объявлен `@namespace html`) **невалиден внутри AUTHOR `<style>`** — без объявления namespace парсер отбрасывает каждое правило (`selectorText` пустой, `cssRules` содержит только уцелевшие `@keyframes`). Правильный путь — инжектировать `<style id="blade-fx-style">` в `document.documentElement` из того же скрипта, который спавнит ноды (паттерн `BobliksChromeStyle.uc.js`), селекторы — **без** namespace-префикса. Диагностика: computed-style тестовой ноды (`position`/`animation-name`) + канарейка на XUL-элементе (`#navigator-toolbox` должен получать свои стили из `userChrome.css` — если получает, а HTML-нода нет, дело в USER_SHEET, а не в загрузке таблицы). Проверка через `document.styleSheets` USER_SHEET не видит — он туда не попадает.

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

**WPF BladeSetup (редизайн AVA 3.0 / Opera GX, 2026-09-14):**
Полный переход визуального слоя установщика на бренд «AVA 3.0». Палитра: база #060002, акцент #FF0000/#C50606, детали #FFFFFF.
Эффекты Opera GX: пул частиц/искр на Canvas (DispatcherTimer 40 FPS, IsHitTestVisible=False, без тяжелых шейдеров, авто-стоп при Minimize/Close), дышащий радиальный фон, бегущая лазерная кайма окна, интро логотипа 78px со слэшем клинка и посимвольным вордмарком «A V A», белый флеш-оверлей (вспышка) на 100%, плавная анимация переходов экранов (AnimateScreenTransition), тактильный hover со scale 1.03 и разгоранием неона. Все 28 x:Name и обработчики сохранены 1:1.

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

### Чистка репозитория (2026-09-16)

Аудит: в репо лежало ~630 МБ мусора (движок целиком + личные обои + скриншоты
в истории; размер репо на GitHub — 299 МБ, `.git` локально — 372 МБ).
Что сделано:

1. **Снято с отслеживания** (файлы на диске целы): `Skeleton-Stage/` (58 файлов,
   105 МБ — локальный артефакт сборки; ни один конвейер на него не опирается:
   Patch/Full идут от установленной копии и dev-профиля), `Installer/` (Inno —
   легаси, `.iss` не вызывается ничем, актуален только его `Output/` для
   `BladeSetup\Build-BladeSetup.bat`), `blade_health.txt` / `perf_history.txt`
   (пишутся рантаймом BladePulse/BladePerf — вечный шум в `git status`).
   Новые правила в `.gitignore`: `Skeleton-Stage/`, `Installer/`, `.zcode/`,
   `.vscode/`, `.idea/`, три генерируемых файла в `chrome\JS\`,
   `TestReports/blood-font-preview/`.
2. **Перезаписана история** main и всех тегов (`git filter-branch --index-filter`
   с `--prune-empty --tag-name-filter cat`; вырезаны `Skeleton-Stage`, `Иконки`,
   `Иконки старые`, `Installer`, `TestReports/**.png`), затем force-push main
   и тегов. Топ-блоб истории: 168 МБ `xul.dll` → 1.9 МБ `Branding\master_icon.png`;
   достижимый контент — 26 МБ в 612 блобах. Релизы (11 шт, 22 актива) и Latest
   не тронуты: апдейтер читает Releases, не теги.
3. **Ловушки этой операции (уроки):**
   - `git filter-branch -- --all` на этом репо ПАДАЕТ: в `--all` попадают
     `refs/stash` («On main: gitignore-xul» от 2026-09-14) и `refs/cline/checkpoints/*`,
     а в дереве сташа живёт файл `README.md.` (случайное переименование, коммит
     72a3a354) — Windows-гит не может прочитать такое имя в индекс
     («error: invalid path 'README.md.' / Could not initialize the index»).
     Лечится перечислением ссылок явно (`refs/heads/main refs/remotes/origin/main refs/tags/*`).
     ⚠️ Любой `--all`/`--mirror` на этом репо споткнётся о тот же сташ.
   - Теги `v2.0.3`/`v2.0.4` существовали ТОЛЬКО на GitHub (локально их не было)
     и указывали на до-перезаписные коммиты — то есть держали мусор достижимым
     и обесценивали чистку. После перезаписи переставлены на эквиваленты новой
     истории по совпадению сообщений: v2.0.3 → `84c56a1`, v2.0.4 → `7759a13`.
     Наблюдение (не исправлялось): тег v2.0.4 указывает на коммит с сообщением
     и `VERSION` 2.0.3 — так их ставил релизный конвейер; корректный маркер 2.0.4
     — это `ddd265a`.
   - В рабочем дереве висела неотслеженная волна 2.0.4 (10 шрифтов тем + CSS +
     `VERSION`/`CODENAME`), уже уехавшая в опубликованный релиз — закоммичена
     отдельным коммитом `454e0c5` (в новой истории `ddd265a`), иначе репо был бы
     рассинхронизирован с релизом.
4. **Осталось локально** (в репо не уезжает, ничего не удалялось без спроса):
   `.git` 152 МБ держат чужие ссылки — `refs/stash` (367 файлов в дереве) и
   3 × `refs/cline/checkpoints/*` (по 58 файлов Skeleton-Stage). Снос этих ссылок
   + `git gc --prune=now` вернёт `.git` к ~15-25 МБ.
5. **Бэкап до чистки:** `F:\blade-repo-BACKUP-20260916.bundle` (372 МБ, все ссылки) —
   полный откат, если что-то понадобится из старой истории.
6. Хеши переписанной истории (использовать вместо старых из этой карты):
   main = `ddd265a` (2.0.4) → `b735b68` (запись чистки в карте), chore-чистка `24c40cb`,
   предыдущий релизный коммит `7759a13`, тег v2.0.2 = `e0fa92f`, v2.0.3 = `84c56a1`,
   v2.0.4 = `7759a13`.

**Как проверить результат чистки:**

```
# 1. Живой клон с GitHub — должно быть ~34 МБ (было ~300 МБ), 338 файлов
git clone https://github.com/deni41144/blade-browser.git %TEMP%\blade-clone-check
cd %TEMP%\blade-clone-check && git ls-files | wc -l

# 2. Все ссылки на GitHub без мусора (в каждой строке junk=0)
for t in $(gh api repos/deni41144/blade-browser/git/refs --jq '.[].ref'); do
  echo "$t junk=$(gh api "repos/deni41144/blade-browser/git/trees/${t}?recursive=1" \
    --jq '[.tree[].path | select(startswith("Skeleton-Stage") or startswith("Иконки") or startswith("Installer"))] | length')"
done

# 3. Локально: дерево чистое, движок виден только на диске
git status --porcelain ; git check-ignore -v Skeleton-Stage/firefox.exe Installer/Blade-Installer.iss
```

Ожидаемо: клон 34 МБ / 338 файлов, 12 ссылок с `junk=0`, `git status` пуст,
`Skeleton-Stage/` и `Installer/` игнорируются (файлы на диске целы),
`chrome/VERSION` в клоне = `2.0.4`.

## Кооперация с разработчиком (с 2026-09-27)

**Участник:** zxvolfik (коллаборатор приватного репо, артер — графика; в коде
работает через свою нейронку Atria, сам не кодер). Текущая поставка:
`Blade-Workstation-2.0.8.zip` (151 МБ) — движок + chrome 2.0.8 + `КАК-НАЧАТЬ.md`
(инструкция для не-кодера) + `НЕЙРОНКЕ.md` (готовый промпт для Atria: контекст
проекта, конвенции 33/34 и 6, запреты на публикацию/боевой профиль, общение
простыми словами на русском). Папки `Blade-Workstation-*/` — в `.gitignore`
(151 МБ не источник).

**Синхронизация — через git, не через обмен файлами.** Репо — единый источник
правды для кода; движок и боевой профиль в git не входят.

| Когда | Что делает главный агент |
|---|---|
| Сотрудник закончил правку | `git pull` → проверить `chrome/VERSION` и diff → при конфликте разобрать по конвенциям, не перетирать вслепую |
| Нужно отдать свежий пакет | Пересобрать `Blade-Workstation-<VERSION>.zip` **из актуального main после `git pull`**, а не из dev-папки — иначе в пакет уйдут незакоммиченные правки |
| Публикация релиза | Пуш уже выполнен (иначе пакет протухнет в момент сборки) |

**Контракт обновления пакета (порядок соблюдать):**
1. `git pull origin main` и разбор конфликтов (если есть).
2. `git status` чистый — все правки, которые войдут в пакет, закоммичены
   (незакоммиченный код в пакет не уходит — это его и единственный способ
   протухнуть).
3. **Сборка одной командой:**
   `powershell -ExecutionPolicy Bypass -File Patches\Build-Blade-Workstation.ps1`
   Скрипт делает всё сам: pull → guard чистого дерева (отказ, если есть
   незакоммиченные `chrome/`/`user.js`/карта) → сборка Full → сборка пакета
   → аудит на личные файлы. Версию и кодовое имя читает из `chrome\VERSION` /
   `chrome\CODENAME`. Инструкции берёт из `Onboarding/` репозитория.
4. Упаковать папку `Blade-Workstation-<V>/` в ZIP и передать сотруднику.

**⚠️ Ловушка mojibake (инцидент 2026-09-27):** кириллица в аргументе
`-Codename` дочернего `powershell.exe` из PS 5.1 приходит двойным
кодированием — CODENAME прошивается кривыми байтами (`Р Р°СЃРїР°Рґ`), и
только в пакете, не в GitHub (там `gh` ушёл корректным). Поэтому
`Build-Blade-Workstation.ps1` **не передаёт `-Codename`** —
`Publish-Blade-Update.ps1` читает имя из `chrome\CODENAME`. Любая кириллица
через аргументы `powershell -File` — риск; для интерфейсных скриптов с
кириллицей обязателен UTF-8 BOM.

**⚠️ Главное правило:** пакет всегда собирается из закоммиченного main. Если
сотрудник говорит «сделай пакет» — сначала `git pull`, потом сборка. Пакет из
грязного dev-дерева = рассинхрон с тем, что он получит через `git clone`.

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
7. **Размер репо на GitHub ещё не пересчитан** (API отдаёт 305 999 КБ после чистки
   2026-09-16) — это устаревший счётчик: GitHub уже не отдаёт мусор, проверено
   живым клоном (`git clone https://github.com/deni41144/blade-browser.git` →
   34 МБ, из них `.git` 17 МБ, 1.7 с; было ~300 МБ). Достижимый контент чист —
   все 12 ссылок (main + 9 тегов + origin) содержат 0 файлов
   `Skeleton-Stage`/`Иконки`/`Installer`. Старые коммиты (`b594174`, `8361a8e`)
   пока отдаются по прямой ссылке как висячие объекты; пересчёт счётчика `size`
   и окончательный сбор мусора — запрос в GitHub Support («run git gc on the
   repository»), на работу апдейтера и клонов не влияет.
8. Локальный диск после чистки не тронут: `Release/` и `Backups/` ~по 1.3 ГБ,
   `Patches\*.zip` 617 МБ, `Installer\Output` 197 МБ, `Blade-Release-v1.4.2/` 201 МБ —
   всё это уже в `.gitignore` и в репо не уезжает; снос — решение владельца.
9. В репо остались 32 разовых диагностических скрипта в `TestReports/` (дамперы
   sessionstore, репро CWD, упаковка 2.0.2 — 54 КБ суммарно) и `Patches\boot-timing.ps1`
   с абсолютными путями владельца. Размер ничтожный, оставлены как летопись
   расследований; удалить можно одной командой при желании.
