// ==UserScript==
// @name            Blade Newtab Hero
// @description     Hero-циферблат на новой вкладке (GX-стиль): приветствие,
//                  большие часы, дата, статус, хроника. Только about:newtab/home —
//                  на остальных страницах время показывают навбар-часы
//                  (BladeClock 2.6.0 сам прячется на главной: дублей нет).
// @author          Bobliks-Creations
// @include         main
// @version         1.5.1
// ==/UserScript==
(function () {
  if (window.BladeNewtabHero) return;

  // Диаг по конвенции проекта
  let markPath = '';
  try {
    const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
    d.append('JS');
    markPath = d.path + '\\newtab_mark.txt';
  } catch (e) {}
  const mark = (m, e) => {
    try {
      if (!markPath) return;
      const text = 'v1.5.1 ' + m + (e ? '\n' + String(e) + '\n' + (e && e.stack || '') : '');
      IOUtils.writeUTF8(markPath, text).catch(() => {});
    } catch (e2) {}
  };

  // ВАЖНО: about:newtab в FF155 — builtin-addon в REMOTE-процессе (проверено:
  // isRemoteBrowser=true, document-element-inserted в родителя не приходит).
  // Поэтому hero рисуется в ОКНЕ (chrome), поверх зоны контента, и показывается
  // только когда выбран about:newtab/about:home — раскладка «у каждой странице
  // свой часы»: главная — большие Hero, остальные — навбар (BladeClock).
  // Акцент — chrome-переменная --accent из userChrome.css: переключается
  // темами живьём (data-blade-theme).
  const HERO_CSS = `
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
      /* Появляется и тает, оставляя чистые часы: подъём с opacity при входе,
         пауза, плавный уход вверх с растворением. Только transform/opacity —
         раскладку не дёргаем (margin-bottom на месте, элемент не схлопывается).
         Перезапуск сам: blade-on переключает display none<->flex (updateVisible). */
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
    /* Дыхание на opacity: filter: drop-shadow в keyframes дёргал
       перерисовку фильтра каждый кадр; свечение живёт статикой в text-shadow */
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
      /* #FF0000 — фирменный градиент бренда AVA 3.0 в гармонии с var(--accent) */
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
    /* 4 состояния Hero: [Loading, Error, Empty, Success] */
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
  `;

  try {
    const doc = window.document;
    // НЕ в tabbrowser-tabpanels: XUL deck рисует только выбранный panel,
    // остальные дети невидимы. #browser — обычный hbox, рендерит всех.
    const deck = doc.getElementById('browser');
    if (!deck) throw new Error('нет #browser');

    const st = doc.createElementNS('http://www.w3.org/1999/xhtml', 'style');
    st.textContent = HERO_CSS;
    doc.documentElement.appendChild(st);

    const wrap = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
    wrap.id = 'blade-hero-wrap';
    wrap.innerHTML =
      '<div id="blade-hero" role="banner" aria-label="AVA 3.0 Hero" data-state="success">' +
        '<div class="bh-greet" role="heading" aria-level="2"></div>' +
        '<div class="bh-clock" role="timer" aria-live="off"><span class="bh-hm">--:--</span><span class="bh-sec">--</span></div>' +
        '<div class="bh-accent-line" aria-hidden="true"><span class="bh-accent-core"></span></div>' +
        '<div class="bh-date"></div>' +
        '<div class="bh-status" role="status" aria-live="polite">BLADE OS // ONLINE</div>' +
      '</div>';
    deck.appendChild(wrap);

    const hm = wrap.querySelector('.bh-hm');
    const sec = wrap.querySelector('.bh-sec');
    const dateEl = wrap.querySelector('.bh-date');
    const status = wrap.querySelector('.bh-status');
    const greetEl = wrap.querySelector('.bh-greet');

    // --- Погода/город из кэша BladeClock (префы) ---
    function getStr(name) {
      try { return Services.prefs.getStringPref(name, ''); } catch (e) { return ''; }
    }
    // data != null — пришло живьём из шины clock:weather, иначе читаем префы
    function refreshWeather(data) {
      try {
        let weather = '', city = '';
        if (data) {
          weather = data.weather || '';
          city = data.city || '';
        } else {
          weather = getStr('blade.clock.weather');
          city = getStr('blade.clock.city');
        }
        const part = weather ? (city ? city + ' ' : '') + weather : '';
        const text = part ? 'BLADE OS // ONLINE  ·  ' + part : 'BLADE OS // ONLINE';
        if (status.textContent !== text) status.textContent = text;
      } catch (e) {}
    }
    refreshWeather();

    // --- Приветствие по часу: обновляется в минутной ветке tick() ---
    function greetText(h) {
      if (h >= 5 && h < 11) return 'Доброе утро';
      if (h >= 11 && h < 17) return 'Добрый день';
      if (h >= 17 && h < 23) return 'Добрый вечер';
      return 'Доброй ночи';
    }

    // Тик дешевле: DOM трогаем только когда hero виден (класс blade-on),
    // дату — не чаще раза в минуту (день меняется редко)
    let lastMinute = -1;
    function tick() {
      try {
        if (!wrap.classList.contains('blade-on')) return;
        const d = new Date();
        hm.textContent = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        sec.textContent = d.toLocaleTimeString('ru-RU', { second: '2-digit' }).padStart(2, '0');
        if (d.getMinutes() !== lastMinute) {
          lastMinute = d.getMinutes();
          dateEl.textContent = d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
          const g = greetText(d.getHours());
          if (greetEl.textContent !== g) greetEl.textContent = g;
        }
      } catch (e) {}
    }
    tick();
    // Тик через реестр BladeCore — снятие на unload автоматом (2.0)
    if (window.Blade && window.Blade.every) Blade.every(tick, 1000);
    else window.setInterval(tick, 1000);

    function updateVisible() {
      try {
        const u = window.gBrowser.currentURI ? window.gBrowser.currentURI.spec : '';
        wrap.classList.toggle('blade-on', /^about:(newtab|home)/.test(u));
        // hero только что показался — рисуем сразу, не ждём следующего тика
        if (wrap.classList.contains('blade-on')) {
          tick();
          refreshWeather();   // префы могли обновиться, пока hero был скрыт
        }
      } catch (e) {}
    }
    const progListener = { onLocationChange() { updateVisible(); } };
    window.gBrowser.addTabsProgressListener(progListener);
    window.gBrowser.tabContainer.addEventListener('TabSelect', updateVisible);

    // --- Тикер хроники: строка 1 (заголовок) + первая непустая после неё ---
    try {
      const f = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      f.append('JS'); f.append('update_chronicle.txt');
      IOUtils.readUTF8(f.path).then(text => {
        try {
          const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
          const title = (lines[0] || '').trim();
          if (!title) return;
          let detail = '';
          for (let i = 1; i < lines.length; i++) {
            const ln = lines[i].trim();
            if (ln) { detail = ln; break; }
          }
          if (!detail) return;
          const el = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
          el.id = 'blade-hero-chronicle';
          el.textContent = title + ' — ' + detail;
          wrap.appendChild(el);
        } catch (e) {}
      }).catch(() => {});
    } catch (e) {}

    // --- Живая погода из BladeClock через шину (fail-soft, если шины нет) ---
    let busHandler = null;
    try {
      if (window.Blade && window.Blade.bus) {
        busHandler = (data) => refreshWeather(data);
        window.Blade.bus.on('clock:weather', busHandler);
      }
    } catch (e) {}

    window.addEventListener('unload', () => {
      try { window.gBrowser.removeTabsProgressListener(progListener); } catch (e) {}
      try {
        if (busHandler && window.Blade && window.Blade.bus)
          window.Blade.bus.off('clock:weather', busHandler);
      } catch (e) {}
    }, { once: true });

    updateVisible();
    mark('OK overlay');
  } catch (e) { mark('ERR start', e); }

  window.BladeNewtabHero = true;
})();
