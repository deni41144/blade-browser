# ЗАДАЧА ДЛЯ ГЕМИНИ: демонический шрифт + per-theme визуальные эффекты на Hero-часах (Blade)

## КТО ТЫ И ЧТО ЗА ПРОЕКТ

Ты — фронтенд-специалист. Проект «Blade» — кастомный браузер на базе Firefox 155 (сборка 2026) с тёмным демоническим дизайном «клинок». Кастомизация живёт НЕ в исходниках движка, а в слое поверх него: скрипты `*.uc.js` исполняются в каждом окне браузера загрузчиком fx-autoconfig на DOMContentLoaded и внедряют стили `<style>` прямо в XUL/HTML-документ окна. Писать нужно аккуратно: правки точечные, никакого рефакторинга чужого кода, кодировка UTF-8 БЕЗ BOM, синтаксис проверяется `node --check`.

Файл один:
`F:\firefox michael edition\FirefoxPortable\Data\profile\chrome\JS\BladeNewtab.uc.js`

Это uc.js-скрипт (v1.5.1), который инжектит hero-оверлей на about:newtab/home: большие часы 88px, приветствие, дата, статус. CSS живёт внутри JS-строки `HERO_CSS` (template literal, строки 36-169). Скрипт работает в chrome-процессе (parent), а не в content.

## ЖЁСТКИЕ КОНВЕНЦИИ ПРОЕКТА (нарушать нельзя)

1. В `@keyframes` ТОЛЬКО `transform` и `opacity`. Никаких `filter`, `box-shadow`, `text-shadow`, `background` внутри keyframes. Свечение, тени, градиенты — статикой в правилах, анимируется только opacity/transform.
2. Акцент темы только через `var(--accent, #ff2a2a)` или `var(--bob-accent)` — НИКОГДА хардкод цвета в per-theme правилах. Допускается хардкод в дефолтном (red) правиле как фолбэк.
3. Per-theme селекторы: `[data-blade-theme="ИМЯ"]` (атрибут ставится кнопкой B на `#main-window`). Специфичность `(0,1,1)` бьёт дефолтные правила `(0,0,1)`.
4. Всё внешнее (prefs, DOM) — в try/catch fail-soft, скрипт не имеет права валить браузер.
5. Комментарии — русские, объясняют «почему», в стиле соседних строк (там есть летопись фиксов вида «раунд 9: ...» — поддерживай тон).
6. Файл начинается с заголовка `// ==UserScript==` с `@version` — подними версию (1.5.1 → 1.6.0) и одноимённый префикс в mark-логе (`'v1.5.1 '` → `'v1.6.0 '`) в двух местах (строки 9 и 24), они обязаны совпадать.
7. Аккуратность: удаляя код — не оставляй мусорных пустых строк; добавляя — не переформатируй соседнее.
8. Шрифты подключаются через @font-face в userChrome.css/userContent.css (уже сделано, шрифт `blade-horror` подключен). В HERO_CSS используй его через `font-family: 'blade-horror', 'Segoe UI', sans-serif`.

## КОНТЕКСТ: КАК УСТРОЕНЫ ТЕМЫ

У Blade 9 тем + custom. Переключение живое (без перезапуска) через `data-blade-theme` на `html`/`#main-window`. Каждая тема задаёт `--accent` (цвет акцента):

| Тема | data-blade-theme | --accent | Характер |
|---|---|---|---|
| red (дефолт) | нет атрибута | #ff2a2a | Фирменный алый, пульс клинка |
| blood | "blood" | #a80f0f | Тёмная кровь, демонический |
| purple | "purple" | #b44bff | Синтивейв, неон |
| green | "green" | #00ff88 | Терминал, матрица |
| grey | "grey" | #8a8f98 | Полированная сталь |
| orange | "orange" | #ff6a1f | Пламя, жар |
| cherry | "cherry" | #d02d4e | Сакура, вишня |
| midnight | "midnight" | #2f6bff | Северное сияние, индиго |
| volt | "volt" | #fff820 | Электричество, молнии |

Пользователь хочет: «у каждого интерфейса своя фишка — кровавый интерфейс, с часов должна стекать кровь; вольт — электричество идёт и т.д.»

## ОРИГИНАЛ КОДА (BladeNewtab.uc.js, строки 36-169, HERO_CSS)

```css
    #browser { position: relative; }
    #blade-hero-wrap {
      position: absolute; inset: 0; z-index: 5;
      pointer-events: none; display: none;
      justify-content: center; align-items: flex-start;
    }
    #blade-hero-wrap.blade-on { display: flex; }
    #blade-hero {
      position: relative;
      /* [2026-09-15] Подъём Hero-часов до 5vh (было 10vh): обои V2 с высокими композициями */
      margin-top: 5vh; text-align: center;
      font-family: 'Segoe UI', sans-serif; user-select: none;
      animation: blade-hero-in .9s cubic-bezier(.2,.7,.3,1) both;
    }
    @keyframes blade-hero-in {
      from { opacity: 0; transform: translateY(-12px); }
      to   { opacity: 1; transform: none; }
    }
    #blade-hero .bh-greet {
      font-family: var(--blade-display, 'Unbounded', 'Segoe UI', sans-serif);
      font-size: 16px; font-weight: 800; letter-spacing: 10px;
      text-transform: uppercase;
      margin-bottom: 12px;
      /* кровь-градиент + двойное свечение — демонический облик */
      background: linear-gradient(180deg,
        color-mix(in srgb, var(--accent, #ff2a2a) 85%, #fff) 0%,
        var(--accent, #ff2a2a) 40%,
        color-mix(in srgb, var(--accent, #ff2a2a) 45%, #000) 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      filter: drop-shadow(0 0 12px color-mix(in srgb, var(--accent, #ff2a2a) 55%, transparent))
              drop-shadow(0 0 28px color-mix(in srgb, var(--accent, #ff2a2a) 30%, transparent));
      opacity: 0;
      animation: blade-greet-life 7s ease forwards;
    }
    @keyframes blade-greet-life {
      0%   { opacity: 0; transform: translateY(8px); }
      10%  { opacity: 1; transform: none; }
      55%  { opacity: 1; }
      78%  { opacity: 0; transform: translateY(-6px); }
      100% { opacity: 0; }
    }
    #blade-hero .bh-clock {
      font-size: 88px; font-weight: 200; line-height: 1; letter-spacing: 6px;
      color: #f4f4f8;
      text-shadow:
        0 0 22px color-mix(in srgb, var(--accent, #ff2a2a) 45%, transparent),
        0 0 70px color-mix(in srgb, var(--accent, #ff2a2a) 22%, transparent);
      animation: blade-hero-breathe 3.6s ease-in-out infinite;
    }
    @keyframes blade-hero-breathe {
      0%, 100% { opacity: 0.92; }
      50%      { opacity: 1; }
    }
    /* Атмосферные «уголки» за часами: два радиальных пятна акцента,
       медленный дрейф transform + лёгкий пульс opacity (композит, дёшево) */
    #blade-hero::before, #blade-hero::after {
      content: '';
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      z-index: -1;
    }
    #blade-hero::before {
      top: -90px; left: -140px; width: 320px; height: 320px;
      background: radial-gradient(circle, color-mix(in srgb, var(--accent, #ff2a2a) 13%, transparent) 0%, transparent 70%);
      animation: blade-hero-drift-a 9s ease-in-out infinite alternate;
    }
    #blade-hero::after {
      bottom: -120px; right: -140px; width: 380px; height: 380px;
      background: radial-gradient(circle, color-mix(in srgb, var(--accent, #ff2a2a) 11%, transparent) 0%, transparent 70%);
      animation: blade-hero-drift-b 13s ease-in-out infinite alternate;
    }
    @keyframes blade-hero-drift-a {
      from { transform: translate(-18px, -8px); opacity: 0.55; }
      to   { transform: translate(18px, 8px);   opacity: 1; }
    }
    @keyframes blade-hero-drift-b {
      from { transform: translate(18px, 10px);   opacity: 0.5; }
      to   { transform: translate(-18px, -10px); opacity: 0.9; }
    }
    #blade-hero .bh-sec {
      font-size: 26px; font-weight: 300; letter-spacing: 2px;
      color: color-mix(in srgb, var(--accent, #ff2a2a) 78%, white);
      margin-left: 10px; vertical-align: 14px;
    }
    /* AVA 3.0: фирменная лазерная грань-разделитель под циферблатом */
    #blade-hero .bh-accent-line {
      position: relative;
      width: 240px; height: 1px;
      margin: 14px auto 10px auto;
      background: linear-gradient(90deg, transparent 0%, rgba(255, 0, 0, 0.35) 20%, var(--accent, #ff2a2a) 50%, rgba(255, 0, 0, 0.35) 80%, transparent 100%);
      box-shadow: 0 0 10px rgba(255, 0, 0, 0.55), 0 0 4px var(--accent, #ff2a2a);
      display: flex; align-items: center; justify-content: center;
    }
    #blade-hero .bh-accent-core {
      width: 5px; height: 5px;
      background: #ffffff;
      transform: rotate(45deg);
      box-shadow: 0 0 6px #ffffff, 0 0 12px rgba(255, 0, 0, 0.9);
    }
    #blade-hero .bh-date {
      font-family: var(--blade-display, 'Unbounded', 'Segoe UI', sans-serif);
      margin-top: 10px; font-size: 14px; font-weight: 600; letter-spacing: 4px;
      text-transform: uppercase; color: rgba(255, 255, 255, 0.78);
      text-shadow: 0 1px 6px rgba(0, 0, 0, 0.9);
    }
    #blade-hero .bh-status {
      font-family: var(--blade-mono, 'JetBrains Mono', monospace);
      margin-top: 12px; font-size: 11px; font-weight: 700; letter-spacing: 3px;
      color: var(--accent, #ff2a2a);
      text-shadow: 0 0 10px color-mix(in srgb, var(--accent, #ff2a2a) 55%, transparent);
    }
    #blade-hero[data-state="loading"] .bh-clock { opacity: 0.6; }
    #blade-hero[data-state="error"] .bh-status { color: #ff3333; }
    #blade-hero[data-state="empty"] .bh-date { display: none; }
    #blade-hero[data-state="success"] { opacity: 1; }
    #blade-hero-chronicle {
      position: absolute; left: 18px; bottom: 14px;
      font-family: var(--blade-mono, 'JetBrains Mono', monospace); font-size: 10px; letter-spacing: 1px;
      color: var(--accent, #ff2a2a); opacity: 0.45; pointer-events: none;
      max-width: 42vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
```

HTML-структура hero (строки 184-191):
```html
<div id="blade-hero" role="banner" aria-label="AVA 3.0 Hero" data-state="success">
  <div class="bh-greet" role="heading" aria-level="2"></div>
  <div class="bh-clock" role="timer" aria-live="off">
    <span class="bh-hm">--:--</span><span class="bh-sec">--</span>
  </div>
  <div class="bh-accent-line" aria-hidden="true"><span class="bh-accent-core"></span></div>
  <div class="bh-date"></div>
  <div class="bh-status" role="status" aria-live="polite">BLADE OS // ONLINE</div>
</div>
```

ВАЖНО: `#blade-hero::before` и `#blade-hero::after` уже заняты атмосферными уголками (радиальные пятна). Для per-theme эффектов на часах используй `.bh-clock::before` и `.bh-clock::after` — они свободны.

## ЗАДАЧА 1: Демонический шрифт часов (BladeNewtab.uc.js, 1.5.1 → 1.6.0)

Замени `font-family: 'Segoe UI', sans-serif` на `font-family: 'blade-horror', 'Segoe UI', sans-serif` в правиле `#blade-hero` (строка 48). Шрифт Nosifer (horror-стиль с потёками крови) уже подключен через @font-face как `blade-horror` в userChrome.css и userContent.css. Fallback на Segoe UI обязателен — если шрифт не загрузился, часы не должны сломаться.

Увеличь `letter-spacing` с 6px до 10px в `.bh-clock` (Nosifer широкий, буквы сливаются при 6px).

## ЗАДАЧА 2: Per-theme визуальные эффекты на часах (тот же файл, та же версия 1.6.0)

Добавь CSS-блок после `@keyframes blade-hero-breathe` (после строки 97). Каждая из 9 тем получает уникальный визуальный эффект на `.bh-clock`. Deфолтная тема (red) — без `data-blade-theme` атрибута, остальные — через `[data-blade-theme="X"]`.

### Принципы дизайна

- Эффекты должны выглядеть КРАСИВО и ДЕМОНИЧЕСКИ. Не дешёвые box-shadow-точки, а продуманные визуальные элементы.
- Используй `.bh-clock::before` и `.bh-clock::after` для псевдоэлементов (они свободны).
- По умолчанию (без темы) pseudo-элементы выключены: `content: none; opacity: 0;`.
- Каждый `[data-blade-theme]` селектор включает свой эффект: `content: '';` + анимация.
- ВСЕ keyframes строго: только `transform` и `opacity`.
- Цвета — через `var(--accent, #ff2a2a)`. В дефолтном (red) правиле допускается хардкод `#ff2a2a` как фолбэк.
- Статические свойства (text-shadow, box-shadow, background, filter) — в правилах, НЕ в keyframes.
- Позиционирование pseudo-элементов: `position: absolute; pointer-events: none;` относительно `.bh-clock` (нужно добавить `position: relative` к `.bh-clock`).

### Темы и их эффекты (концепции для вдохновения, реализуй красиво)

**red (дефолт, нет data-blade-theme):** Пульс клинка. Усиленное дыхание свечения через дополнительный слой text-shadow (статика) + opacity-пульс чуть шире чем breathe. Без pseudo-элементов.

**blood:** Стекающая кровь. Через `.bh-clock::after` — 3-4 капли разной длины (узкие вертикальные прямоугольники с border-radius снизу, цвет `var(--accent)` = `#a80f0f`). Анимация: translateY вниз + fade out. Задержки между каплями через animation-delay. Капли начинаются от нижнего края цифр.

**purple:** Неоновое мерцание. Как неисправная неоновая трубка — text-shadow с `var(--accent)` = `#b44bff` быстро переключается между ярким и тусклым. Реализация: opacity-анимация с steps() timing function (не smooth, а рывками). Можно добавить лёгкий translateY микро-дрожь (1-2px).

**green:** Сканлайны терминала. `.bh-clock::before` — горизонтальные линии (repeating-linear-gradient, полупрозрачный зелёный `var(--accent)` = `#00ff88`). Анимация: translateY дрейф вниз (4px loop, линейная, бесконечная). Цифры получают характерный "мониторный" вид.

**grey:** Холодная сталь. Один статичный блик через text-shadow (белый, смещённый вверх-влево, имитирует отражение света на металле) + медленный opacity pulse (6s цикл). Минималистично, элегантно.

**orange:** Жар пламени. `.bh-clock::after` — языки пламени снизу (3-4 radial-gradient эллипса, `var(--accent)` = `#ff6a1f`, полупрозрачные). Анимация: scaleY + translateY вверх (языки лижут цифры снизу). transform-origin: bottom center.

**cherry:** Лепестки сакуры. `.bh-clock::after` — 4-6 маленьких элементов (border-radius: 50% 0 50% 0 — форма лепестка, `var(--accent)` = `#d02d4e`). Анимация: падают по дуге (translateY вниз + translateX вбок + rotate). Рандомизация через animation-delay.

**midnight:** Северное сияние. Три слоя text-shadow разных цветов (через `var(--accent)` + color-mix для вариаций: голубой/синий/фиолетовый). Медленный дрейф: opacity-анимация с разными фазами для каждого слоя создаёт эффект переливающегося сияния. 8s цикл.

**volt:** Электрические разряды. `.bh-clock::after` — тонкие ломаные линии-молнии (можно через clip-path polygon или border-left/bottom комбинацию, `var(--accent)` = `#fff820`). Анимация: steps() стробоскоп — вспышки opacity (невидимо → ярко → невидимо за доли секунды, пауза, повтор). Дополнительно: brightness filter на `.bh-clock` в момент вспышки (статика в rule, opacity анимируется).

### Технические требования к CSS-блоку

1. Начни с комментария: `/* Per-theme эффекты на часах (2026-09-15): каждая тема — уникальная визуальная фишка на циферблате. Только transform/opacity в keyframes, цвета через var(--accent). */`
2. Базовое состояние pseudo-элементов (выключены):
```css
    #blade-hero .bh-clock { position: relative; }
    #blade-hero .bh-clock::before,
    #blade-hero .bh-clock::after {
      content: none;
      position: absolute;
      pointer-events: none;
      z-index: -1;
    }
```
3. Затем 9 блоков (red без селектора темы, остальные через `[data-blade-theme="X"]`).
4. Все keyframes именуй с префиксом `blade-hero-` (например `blade-hero-blood-drip`, `blade-hero-volt-flash`).
5. Не трогай существующие правила (.bh-greet, .bh-date, .bh-status, .bh-accent-line, .bh-sec, .bh-chronicle, #blade-hero::before/after, blade-hero-breathe, blade-hero-drift-a/b, blade-hero-in, blade-greet-life).
6. Не меняй HTML-структуру (wrap.innerHTML).
7. Не меняй JS-логику (tick, greetText, refreshWeather, updateVisible и т.д.).

## ПРОВЕРКА (сделай сам, прежде чем отдавать)

1. `node --check "F:\firefox michael edition\FirefoxPortable\Data\profile\chrome\JS\BladeNewtab.uc.js"` — обязано пройти (валидный JS, template literal не сломан).
2. grep-инварианты:
   - `font-family: 'blade-horror'` присутствует в правиле `#blade-hero`
   - `letter-spacing: 10px` в `.bh-clock`
   - `@version         1.6.0` в шапке
   - `'v1.6.0 '` в mark-префиксе (строка ~24)
   - `[data-blade-theme="blood"]` присутствует
   - `[data-blade-theme="volt"]` присутствует
   - `[data-blade-theme="cherry"]` присутствует
   - Все 9 тем покрыты (red, blood, purple, green, grey, orange, cherry, midnight, volt)
   - Нет TODO, pass, заглушек
3. Кодировка UTF-8 без BOM сохранена.
4. Баланс скобок: количество `{` = количество `}` в HERO_CSS.
5. Ни одно существующее правило не удалено и не изменено (кроме font-family и letter-spacing в задаче 1).

## КАК ПРАВИТЬ

Точечные правки существующих строк + добавление нового CSS-блока. Прочитай файл целиком ПЕРЕД правками — номера строк в этой спеке примерные. Если реальность не совпадает со спекой — подстройся по смыслу, в отчёте укажи отклонение. Никаких TODO/заглушек/pass.
