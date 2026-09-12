# ЗАДАЧА ДЛЯ ГЕМИНИ: «Живой Клинок» — атмосфера, пульс, слэш (CSS-волна)

## КОНТЕКСТ

Проект Blade (Firefox 155, uc.js). ПЕРВЫМ ДЕЛОМ прочитай:
1. `F:\firefox michael edition\PROJECT_MAP.md` — карта проекта;
2. `F:\firefox michael edition\Patches\gemini-prompt-design.md` — **ВСЕ конвенции и факты движка оттуда действуют и здесь** (переменные тем, transform/opacity в keyframes, мёртвые id, remote-newtab и т.д.).

Правки точечные (Edit), UTF-8 без BOM. Инженерные хуки УЖЕ в коде (BladeClock 2.2.0) — тебе остаётся чистый CSS. JS НЕ трогать вообще.

## НОВЫЕ ХУКИ (уже работают)

1. **Погода** — ровно ОДИН из булевых префов активен: `blade.weather.clear`, `.clouds`, `.rain`, `.snow`, `.thunder`, `.fog`. В контенте ловится как `@media -moz-pref("blade.weather.rain") { ... }` — тот же механизм, что у тем/фонов. Обновляется раз в час; живое переключение без перезагрузки не гарантировано (известное ограничение — для погоды это ок).
2. **Ночь** (22:00–6:00): в хроме — атрибут `[data-blade-night]` на `<html>` (обновляется каждые 10 сек, живьём); в контенте — `@media -moz-pref("blade.night")`.
3. **Музыка**: у вкладки, в которой играет звук, есть атрибут `tab[soundplaying]` (хром-документ, появляется/исчезает сам).

## БЮДЖЕТ ПСЕВДОЭЛЕМЕНТОВ newtab (КРИТИЧНО — не занимай чужое!)

На `about:newtab`/`about:home` УЖЕ ЗАНЯТЫ:
- `body::after` — анимированный фон «Blood Flow»;
- `.outer-wrapper::after` — CYBER-HUD версии.

СВОБОДНЫ только: `html::before`, `html::after`, `body::before` (+ `box-shadow: inset` на самом body — бесконечный «неуловимый» слой, псевдоэлемент не тратит). Планируй слои из этого бюджета. Один псевдоэлемент может иметь РАЗНЫЕ стили в разных `@media` (дождь и звёзды взаимоисключающие — дели один слой).

## ЗАДАЧА A: АТМОСФЕРНЫЕ ОСАДКИ (userContent.css, только about:home/newtab)

Техника: слой = псевдоэлемент c `repeating-linear-gradient`/точечными `radial-gradient` текстурами, `background-size` двойной высоты, анимация движения текстуры ТОЛЬКО `transform: translateY/translateX` (бесшовный луп 0→-50%). Никакого `background-position` в keyframes (конвенция). Все слои: `position: fixed; inset: 0; pointer-events: none;`.

- **rain** (`blade.weather.rain`): два слоя диагональных струй с разными скоростями/углами (skew через сам градиент или transform на слое), opacity ≤ 0.18, скорости ~0.5s и ~0.9s на цикл + едва заметная тёмная вуаль (`box-shadow: inset 0 0 120vmax rgba(0,0,10,0.18)` на body).
- **thunder** (`blade.weather.thunder`): дождь (наследуй rain-слои — продублируй правила или сгруппируй селекторы префов) + вспышка: отдельный слой `html::after` с бело-синим градиентом, keyframes с редкой вспышкой (2 коротких пика в цикле ~8s, opacity до 0.3, между пиками — нули).
- **snow** (`blade.weather.snow`): 2 слоя точек (мелкий быстрый ближе, крупный медленный дальше), падение + лёгкий дрейф по X (translateY+translateX в одном transform), opacity ≤ 0.5 точек, циклы 6s и 11s.
- **stars** (`@media -moz-pref("blade.weather.clear") and (-moz-pref("blade.night"))`): россыпь мерцающих точек (несколько radial-gradient пятнышек, twinkle = opacity-анимация со сдвигом delay — вариантов слоёв максимум 2), плюс едва заметное холодное усиление виньетки.
- **fog** (`blade.weather.fog`): 1–2 широких полупрозрачных полосы (мягкий linear-gradient), медленный дрейф translateX в разные стороны (alternate), opacity ≤ 0.14.
- **clouds** (`blade.weather.clouds`): без частиц — только чуть плотнее тёмная вуаль (box-shadow inset) + замедлить/приглушить существующие анимации не трогай, просто вуаль.

Гроза+ночь, дождь+ночь — комбинации должны работать вместе (слои не конфликтуют по бюджету: звёзды только на clear).

## ЗАДАЧА B: СЛЭШ ПО ПЛИТКАМ (userContent.css)

Ховер на плитке — по ней проходит диагональный разрез светом:
- носитель: `.tile::after` (СНАЧАЛА проверь grep'ом по `userContent.css` и живому `chrome\covers.css`, что `.tile::after` свободен; если занят — `.top-site-outer .tile .top-site-icon::after`);
- полоса: тонкая диагональ (linear-gradient под ~25°), `transform: translateX(-130%) skewX(-18deg)`, на `.top-site-outer:hover` — `translateX(130%)` (та же skew), `transition: transform 0.35s ease` (transition на transform допустим — не keyframes);
- цвет полосы — `var(--bob-accent, #ff2a2a)` с прозрачными краями, `pointer-events: none`, поверх плитки, `border-radius` в тон плитки;
- тень/свечение полосы — статикой.

## ЗАДАЧА C: ПУЛЬС МУЗЫКИ (userChrome.css)

- **Звуковая вкладка дышит**: `tab[soundplaying] .tab-background` — мягкая opacity-пульсация (1.6s, 0.85↔1) в акцентном свечении. Дёшево, без :has.
- **Клинок слушает**: `#navigator-toolbox:has(tab[soundplaying]) #bobliks-settings-button` — усиленное «дыхание» иконки (animation на opacity, 1.2s). `:has()` в FF155 работает; обновления атрибута редкие (старт/стоп звука), перф-риск низкий — но НЕ вешай `:has` ни на что горячее (таббар-хендлы и т.п.).
- ВАЖНО: у кнопки B уже есть тем-анимации (`[data-blade-theme="X"] #bobliks-settings-button .toolbarbutton-icon`) — твой music-пульс не должен их ломать: музыка добавляет отдельный эффект (например, через `box-shadow`-статику на кнопке или анимацию на самом `#bobliks-settings-button`, а не на `.toolbarbutton-icon`, где хозяйничают темы). Подбери бесконфликтный носитель.

## ЗАДАЧА D: НОЧНАЯ ЗАБОТА

- Хром (`userChrome.css`): `[data-blade-night]` — тёплый сдвиг БЕЗ filter на больших слоях: переопредели переменные чуть теплее/темнее (`--bg`, `--panel` — аккуратные дельты через color-mix с тёплым тоном), плюс мягкое тёплое свечение рамки окна если уместно. Темы продолжают работать поверх (механизм переменных не ломай — только значения).
- Контент (`userContent.css`): `@media -moz-pref("blade.night")` — только `box-shadow: inset 0 0 120vmax rgba(255,190,140,0.05)` на body newtab (тёплый тёплый полумрак, комбинируется с любыми осадками). Больше ничего — не перекрывай слои.

## ОГРАНИЧЕНИЯ (повтор из design-промпта, критичные здесь)

- keyframes: ТОЛЬКО transform/opacity. Никакого backdrop-filter/blur на fullscreen-слоях. Свечения — статикой.
- Оверлеи — только `@-moz-document url("about:home"), url("about:newtab")`, `pointer-events: none`, ничего поверх ошибок/меню.
- Не трогать: body::after (Blood Flow), .outer-wrapper::after (CYBER-HUD), секцию живых тем 5.1, шрифтовые блоки из v1.8.0, JS.
- Перф-скромность: осадки — это фоновые слои с постоянной анимацией; держи количество анимируемых слоёв ≤ 3 одновременно, cycle-длительности не короче 0.5s (дождь).

## ПРОВЕРКА (сделай сам до сдачи)

1. Скобки сбалансированы в обоих CSS.
2. grep: `body::after` не переопределён в новых секциях; `.tile::after` свободен (проверил до использования); нет `background-position` в keyframes; нет filter/backdrop-filter в keyframes; акцент только var().
3. Каждую задачу опиши в отчёте: какие слои/псевдоэлементы занял, какие @media-хуки использовал, что проверить глазами (в т.ч. комбинации: дождь+ночь, гроза+день).
