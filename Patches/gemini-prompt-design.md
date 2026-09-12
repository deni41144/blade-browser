# ЗАДАЧА ДЛЯ ГЕМИНИ: большой дизайн-апгрейд Blade (кастомные шрифты, своя страница ошибок, фишки)

## КТО ТЫ И ЧТО ЗА ПРОЕКТ

Ты — ведущий фронтенд-дизайнер. Проект «Blade» — кастомный браузер на Firefox 155 (сборка 2026) с тёмным демоническим дизайном «клинок»: 10 живых тем с анимациями (кнопка B бьётся сердцем, дымки тулбокса, бегущий луч Volt), hero-часы на новой вкладке, меню B, авто-тема день/ночь. Твоя задача — сделать из этого «супер пушку»: кастомная типографика, собственная страница ошибок вместо лисы Firefox, и набор крутых визуальных фишек.

ПЕРВЫМ ДЕЛОМ прочитай `F:\firefox michael edition\PROJECT_MAP.md` — живая карта проекта. Затем файлы ниже. Правки точечные (Edit), никакого рефакторинга чужой логики, UTF-8 без BOM.

## ФАЙЛЫ

- `F:\firefox michael edition\FirefoxPortable\Data\profile\chrome\userChrome.css` — стили интерфейса (~1200 строк)
- `F:\firefox michael edition\FirefoxPortable\Data\profile\chrome\userContent.css` — стили контента/newtab/about: (~1040 строк)
- `F:\firefox michael edition\FirefoxPortable\Data\profile\chrome\fonts\` — УЖЕ скачанные шрифты (OFL, кириллица):
  `Unbounded[wght].ttf` (дисплейный, 200–900), `Rubik[wght].ttf` + `Rubik-Italic[wght].ttf` (интерфейсный), `JetBrainsMono[wght].ttf` (моно). Лицензии OFL-*.txt рядом — не трогать, они должны остаться.
- При необходимости смотреть JS: `chrome\JS\BobliksSettings.uc.js` (MENU_CSS), `chrome\JS\BladeNewtab.uc.js` (HERO_CSS), `chrome\JS\BobliksChromeStyle.uc.js` (инъекция), `chrome\JS\BladeUpdater.uc.js` (PANEL_CSS).

## ЖЁСТКИЕ КОНВЕНЦИИ (нарушать нельзя)

1. Акцент только `var(--accent, #ff2a2a)` и производные переменные тем — НИКОГДА хардкод цвета (кроме ::selection — см. факты).
2. В `@keyframes` ТОЛЬКО `transform` и `opacity`. Свечения (box-shadow/filter/drop-shadow) — статикой.
3. Темы живут двойным механизмом: `@media -moz-pref("bobliks.theme.X")` (холодный старт) + `[data-blade-theme="X"]` (живое переключение). Новые стили, зависящие от темы, — через переменные (--accent/--panel/--bg/--text), механизм не расширять.
4. Шрифты подключать ТОЛЬКО `@font-face` с ОТНОСИТЕЛЬНЫМИ путями: `url("fonts/Unbounded[wght].ttf")` — из userChrome.css/userContent.css (лежат в chrome\). НИКАКИХ абсолютных путей и chrome:// — браузер портабельный, пути у всех разные. Всегда задавай font-family с фолбэками: `'Unbounded', 'Segoe UI', sans-serif`.
5. Не трогать ЛОГИКУ JS: никаких изменений поведения, только стили и разметка. Особенно не трогать: BladeCore.uc.js, BladeUpdater.uc.js, механику тем (setTheme/applyThemeSheet/applyLiveAttrs), виджет кнопки B (onBuild), работающие анимации раздела 5.1 «ЖИВЫЕ ТЕМЫ» и порт «обнажения клинка» (blade-urlbar-reveal на .urlbar::after).
6. Удаляя/меняя — не оставляй мусорных пустых строк; версии скриптов не трогай (это сделает интегратор).

## ФАКТЫ ДВИЖКА FF155 (наши грабли — не наступай)

- У капсулы адресной строки КЛАСС `.urlbar-background`, id `#urlbar-background` НЕ СУЩЕСТВУЕТ (мёртвый id уже вычищен — не возвращай).
- Findbar создаётся БЕЗ id — селектор по типу: `findbar`, `findbar .findbar-textbox` и т.п.
- Инфобары (notificationbox) — Lit-элементы в Shadow DOM: документные стили внутрь НЕ проникают, не пытайся.
- Панель переводов — id `full-page-translations-panel` (не translations-panel).
- `#urlbar-scheme` не существует. fxa-элементы — только с двойкой (`appMenu-fxa-status2`, `appMenu-fxa-label2`).
- Попапы (panel) красятся ТОЛЬКО через `::part(content)` — рамка/фон/тени (см. MENU_CSS, PANEL_CSS).
- `::selection` — longhand-свойства и ЛИТЕРАЛЬНЫЕ цвета: `var()` и shorthand ломают покраску (bug 1343967). Существующая генерация из THEMES — не трогать.
- Новая вкладка — REMOTE-процесс: chrome-JS до неё не дотягивается, красит только userContent.css (+ @-moz-pref механика) и инъекции уже попавшие туда. Для контента шрифты тоже подключай в userContent.css.
- Кнопка B строится скриптом с ребёнком `.toolbarbutton-icon` — стили на нём работают.
- Страница ошибок about:neterror — живые id: `.container`, `#errorShortDesc`, `#errorLongDesc`, `#neterrorTryAgainButton`, `#exceptionDialogButton`, `#advancedPanelButtonContainer`. Хочешь больше — распакуй `C:\Users\Deni\AppData\Local\Blade\App\Blade\omni.ja` (обычный zip, во временную папку) и найди файл netError-страницы.

## ЗАДАЧА A: КАСТОМНАЯ ТИПОГРАФИКА

Подключи в НАЧАЛО userChrome.css и userContent.css (после @namespace) блок @font-face:
- `blade-display` = Unbounded (variable, weight 200–900)
- `blade-ui` = Rubik + italic
- `blade-mono` = JetBrains Mono
Примени (с фолбэками Segoe UI / consolas):
- `blade-display`: логотип «⚡ BLADE» в шапке меню B (.bp-logo), заголовок «BLADE // ХРОНИКА ОБНОВЛЕНИЙ» (.bu-title), приветствие hero (.bh-greet — усиль демоничность весом 700–800), дату hero (.bh-date);
- `blade-mono`: CYBER-HUD версии на newtab, тикер хроники (#blade-hero-chronicle), статус-строки «BLADE OS // ONLINE» (.bh-status, .bu-meta), строки ПЕРФ-вкладки (.bp-perf-val);
- `blade-ui`: общий текст панелей (.bp-row/.bp-lbl/.bu-body), строки меню, кнопки.
НЕ переопределяй глобально font интерфейса Windows (меню системы и пр.) — только перечисленные элементы.

## ЗАДАЧА B: СВОЯ СТРАНИЦА ОШИБОК (сейчас там лиса Firefox)

В userContent.css секцию `@-moz-document url-prefix("about:neterror")` — полная переделка:
- тёмный фон `#0a0a0e` с лёгким виньетированием (radial-gradient), иллюстрацию лисы скрыть (`display: none !important` — найди селектор по факту, обычно img/класс в контейнере ошибки);
- заголовок ошибки — `blade-display`, акцентный; текст — `blade-ui`; код/детали — `blade-mono`, приглушённый;
- кнопки (`#neterrorTryAgainButton`, `#exceptionDialogButton`) — в стиле Blade: тёмный фон, рамка `var(--accent-soft)`-подобная (тут контент — можно литерал #ff2a2a-тень), hover — подсветка, border-radius 8px;
- сверху тонкая акцентная линия 2px (статика) — фирменный знак;
- failing-URL — моно, с переносами (word-break).
Не ломай clinical-режимы (certerror): не скрывай кнопки «Дополнительно/Исключение» — только крась.

## ЗАДАЧА C: FINDBAR (Ctrl+F — сейчас штатный серый)

В userChrome.css: `findbar` — компактная тёмная капсула сверху справа (position: fixed? аккуратно — не ломай клики), фон #14141a, рамка акцент-soft, border-radius 10px, поле ввода — тёмное с акцент-фокусом, кнопки next/prev/close — иконки цветом --text, hover — акцент. Без анимаций layout (только transform/opacity).

## ЗАДАЧА D: МЕНЮ ФИШЕК (сделай все, отчёт по каждой)

1. Контекстное меню (menupopup): фон rgba(12,12,16,0.96), тонкая рамка rgba(255,255,255,0.08), border-radius 10px, hover-строка — акцент 15% подложка + текст белый, сепараторы едва видны. Селекторы: menupopup menuitem[_moz-menuactive] и т.п.
2. Меню ≡ (PanelUI): `#appMenu-popup` / PanelUI-главная — тёмное стекло, категории, шрифты blade-ui.
3. Панель загрузок (#downloadsPanel): тёмная, item-hover акцент, прогресс-бар акцентный.
4. Тултипы (tooltip): тёмные, mono для хоткеев если есть.
5. about:privatebrowsing: скрытый уже стилизован — приведи к духу Blade (акцентные переменные, display-шрифт заголовку, убрать остатки хардкода #ff2a2a — заменить на var(--bob-accent, #ff2a2a)).
6. Скроллбары about:страниц — тонкие, акцентные (в userContent.css).

## ЗАДАЧА E: ОБЩИЙ ПОЛИШ

- Единые border-radius (8/10/14px) по всем панелям/меню — свести к системе.
- Микро-ховеры строк меню B (.bp-row) — сдвиг translateY(1px) + подложка (transform допустим).
- Ничего не ломай: если сомневаешься в селекторе — проверь его по файлам/движку, а не угадывай.

## ЧЕГО НЕ ДЕЛАТЬ ВООБЩЕ

- Не трогать JS-логику, темы-механику, анимации раздела 5.1, обнажение клинка, панель апдейтера (кроме шрифтов в её CSS).
- Не вводить сетевые ресурсы (шрифты только локальные из fonts\).
- Не менять кодировку/BOM, не переформатировать целые файлы.

## ПРОВЕРКА (сделай сам до сдачи)

1. Скобки сбалансированы в обоих CSS (посчитай `{`/`}`).
2. grep: нет `#urlbar-background`, нет `#findbar {`, нет абсолютных путей (`F:\`, `C:\`, `file:///`) в CSS; `@font-face` с `url("fonts/` в обоих файлах; акценты через var().
3. Если менял .uc.js — `node --check` на каждом.
4. Отчёт: по каждой задаче — что сделано, какие селекторы использованы, что проверено, что требует визуальной проверки человеком.
