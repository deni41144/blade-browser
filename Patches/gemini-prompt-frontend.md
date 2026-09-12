# ЗАДАЧА ДЛЯ ГЕМИНИ: три правки в кастомном браузере Blade (Firefox 155, uc.js-скрипты)

## КТО ТЫ И ЧТО ЗА ПРОЕКТ

Ты — фронтенд-специалист. Проект «Blade» — кастомный браузер на базе Firefox 155 (сборка 2026) с тёмным демоническим дизайном «клинок». Кастомизация живёт НЕ в исходниках движка, а в слое поверх него: скрипты `*.uc.js` исполняются в каждом окне браузера загрузчиком fx-autoconfig на DOMContentLoaded и внедряют стили `<style>` прямо в XUL/HTML-документ окна. Писать нужно аккуратно: правки точечные, никакого рефакторинга чужого кода, кодировка UTF-8 БЕЗ BOM, синтаксис проверяется `node --check`.

Файлов всего два, оба в dev-профиле:

1. `F:\firefox michael edition\FirefoxPortable\Data\profile\chrome\JS\BladeNewtab.uc.js` — hero-оверлей на новой вкладке
2. `F:\firefox michael edition\FirefoxPortable\Data\profile\chrome\JS\BobliksChromeStyle.uc.js` — стили урлбара/выделения

## ЖЁСТКИЕ КОНВЕНЦИИ ПРОЕКТА (нарушать нельзя)

- В `@keyframes` ТОЛЬКО `transform` и `opacity` (перф: filter/box-shadow в анимации запрещены; свечение — статикой).
- Акцент темы только через `var(--accent, #ff2a2a)` — НИКОГДА хардкод цвета.
- Всё внешнее (prefs, DOM) — в try/catch fail-soft, скрипт не имеет права валить браузер.
- Комментарии — русские, объясняют «почему», в стиле соседних строк (там есть летопись фиксов вида «раунд 9: ...» — поддерживай тон).
- Файл начинается с заголовка `// ==UserScript==` с `@version` — поднимай версию и одноимённый префикс в mark-логе (`'v1.1.1 '` → `'v1.2.0 '`), они обязаны совпадать.
- Аккуратность: удаляя код — не оставляй мусорных пустых строк; добавляя — не переформатируй соседнее.

## ЗАДАЧА 1: убрать прогноз погоды из hero (BladeNewtab.uc.js, 1.1.1 → 1.2.0)

Пользователь сказал: «лишнее расписание погоды на завтра перегружает интерфейс». Убрать ОТОБРАЖЕНИЕ прогноза:
- из HTML-структуры hero: элемент `.bh-forecast` (создаётся JS-ом, строка вида `.bh-forecast` в шаблоне wrap.innerHTML);
- из HERO_CSS: все правила `.bh-forecast`;
- из JS: весь код рендера/обновления прогноза — parse префа `blade.clock.forecast`, обновление `.bh-forecast` в функции `refreshWeather`, forecast-часть в обработчике шины `clock:weather`.
ВАЖНО: статус-строка с городом и текущей погодой (`.bh-status`, префы `blade.clock.city`/`blade.clock.weather`) — ОСТАЁТСЯ. Сбор прогноза в другом скрипте (BladeClock.uc.js) — НЕ трогать вообще, он вне задачи.

## ЗАДАЧА 2: демонический стиль приветствия (BladeNewtab.uc.js, та же версия 1.2.0)

Приветствие — элемент `.bh-greet` («Доброе утро/день/вечер/ночи», текст ставится JS-ом по часу; существует анимация `blade-greet-life 7s ease forwards` — «появляется и тает», её НЕ трогать). Сейчас — плоский белый текст. Перекроить облик ЧИСТЫМ CSS в HERO_CSS:

- цвет: кровь-градиент по тексту:
  ```css
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--accent, #ff2a2a) 85%, #fff) 0%,
    var(--accent, #ff2a2a) 40%,
    color-mix(in srgb, var(--accent, #ff2a2a) 45%, #000) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  ```
  (при `color: transparent` text-shadow не рисуется — свечение делаем следующим пунктом);
- свечение: двойной drop-shadow НА ЭЛЕМЕНТЕ (в отличие от text-shadow, он работает с background-clip:text), статикой, вне keyframes:
  ```css
  filter: drop-shadow(0 0 12px color-mix(in srgb, var(--accent, #ff2a2a) 55%, transparent))
          drop-shadow(0 0 28px color-mix(in srgb, var(--accent, #ff2a2a) 30%, transparent));
  ```
- вес и ритм: `font-weight: 800; letter-spacing: 10px; font-size: 16px; margin-bottom: 12px;`
Слова приветствия НЕ менять. Фолбэк с хардкодом не добавлять. Комментарий: «кровь-градиент + двойное свечение — демонический облик».

## ЗАДАЧА 3: оживить две мёртвые анимации урлбара (BobliksChromeStyle.uc.js, 1.2.1 → 1.3.0)

Предыстория: Firefox в какой-то версии сменил у капсулы адресной строки id `#urlbar-background` на класс `.urlbar-background` — и две фишки, привязанные к id, тихо умерли. Пользователь просит вернуть их к жизни портом на живой селектор.

ОРИГИНАЛЫ (дословно из старого userChrome.css, комменты сохраняй):

```css
/* v1.6.1: пульс свечения капсулы; раунд 9: filter→opacity, перф —
   статичное свечение вынесено в box-shadow правила #urlbar[focused] */
@keyframes blade-urlbar-glow {
  0%, 100% { opacity: 0.85; }
  50%      { opacity: 1; }
}

/* раунд 7: filter→opacity, перф; статичное электрическое свечение —
   box-shadow в volt-правиле #urlbar[focused] выше */
@keyframes blade-live-volt-focus {
  from { opacity: 0.8; }
  to   { opacity: 1; }
}

#urlbar[focused] #urlbar-background {
  border-color: var(--accent) !important;
  /* раунд 9: свечение капсулы — статикой (перенесено из filter-анимации) */
  box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 60%, transparent) !important;
  animation: blade-urlbar-glow 2.2s ease-in-out infinite !important;
}

html|html[data-blade-theme="volt"] #urlbar[focused] #urlbar-background {
  /* раунд 7: filter→opacity, перф — электрическое свечение статично */
  box-shadow: 0 0 10px rgba(255, 248, 32, 0.75) !important;
  animation: blade-live-volt-focus 0.7s ease-in-out infinite alternate !important;
}
```

Что сделать: портировать эти правила в CSS-шаблон (инъекцию `<style>`) файла BobliksChromeStyle.uc.js, рядом с существующим правилом фокус-глоу `#urlbar[focused] .urlbar-background` (найдёшь его — там сейчас статичный box-shadow `0 0 12px ... 45%`). Замены:
- мёртвый селектор `#urlbar-background` → ЖИВОЙ класс `.urlbar-background`; итог: `#urlbar[focused] .urlbar-background, .urlbar[focused] .urlbar-background` (атрибут `focused` движок ставит — проверено по UrlbarInput.mjs: `toggleAttribute("focused", ...)` — селектор живой);
- volt-правило: `html|html[data-blade-theme="volt"]` → `[data-blade-theme="volt"] #urlbar[focused] .urlbar-background, [data-blade-theme="volt"] .urlbar[focused] .urlbar-background` (инъекция живёт в HTML-namespace, префикс `html|` не нужен).
- keyframes перенести ДОСЛОВНО (они уже opacity-only — конвенция соблюдена).
- box-shadow в правилах оставь как в оригинале (это статика поверх, фолбэк).
- Комментарий-летопись: «оригинал из userChrome до чистки (id капсулы умер в FF155), восстановлен по просьбе портом на класс».
- НЕ трогать существующий порт `blade-urlbar-reveal` (линия `.urlbar::after`) — он работает и его не должно задеть.
- Ожидаемое поведение: при фокусе урлбара капсула начинает мягко пульсировать свечением (2.2с цикл, все темы); в теме Volt — быстрая электрическая дрожь (0.7с alternate); при расфокусе — возврат к статике.

## ПРОВЕРКА (сделай сам, прежде чем отдавать)

1. `node --check` на обоих файлах — обязано пройти.
2. grep-инварианты: в BladeNewtab нет `bh-forecast` и прогноз-рендера (статус с city/weather остался), у `.bh-greet` есть `background-clip: text` и `drop-shadow`; в BobliksChromeStyle есть `blade-urlbar-glow`, `blade-live-volt-focus`, `[data-blade-theme="volt"]`.
3. Кодировка UTF-8 без BOM сохранена; версии в @version и mark-префиксах совпадают и подняты.

## КАК ПРАВИТЬ

Точечные правки существующих строк. Прочитай оба файла целиком ПЕРЕД правками — номера строк в этой спеке примерные. Если реальность не совпадает со спекой — подстройся по смыслу, в отчёте укажи отклонение. Никаких TODO/заглушек/pass.
