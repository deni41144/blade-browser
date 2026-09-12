// ==UserScript==
// @name            Blade Newtab Hero
// @description     Крупный неоновый блок часов/даты/погоды на новой вкладке (GX-стиль)
// @author          Bobliks-Creations
// @include         main
// @version         1.0.3
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
      const text = 'v1.0.3 ' + m + (e ? '\n' + String(e) + '\n' + (e && e.stack || '') : '');
      IOUtils.writeUTF8(markPath, text).catch(() => {});
    } catch (e2) {}
  };

  // ВАЖНО: about:newtab в FF155 — builtin-addon в REMOTE-процессе (проверено:
  // isRemoteBrowser=true, document-element-inserted в родителя не приходит).
  // Поэтому часы рисуются в ОКНЕ (chrome), поверх зоны контента, и показываются
  // только когда выбран about:newtab/about:home. Акцент — chrome-переменная
  // --accent из userChrome.css: переключается темами живьём (data-blade-theme).
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
      margin-top: 10vh; text-align: center;
      font-family: 'Segoe UI', sans-serif; user-select: none;
      animation: blade-hero-in .9s cubic-bezier(.2,.7,.3,1) both;
    }
    @keyframes blade-hero-in {
      from { opacity: 0; transform: translateY(-12px); }
      to   { opacity: 1; transform: none; }
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
    #blade-hero .bh-date {
      margin-top: 10px; font-size: 14px; font-weight: 600; letter-spacing: 4px;
      text-transform: uppercase; color: rgba(255, 255, 255, 0.78);
      text-shadow: 0 1px 6px rgba(0, 0, 0, 0.9);
    }
    #blade-hero .bh-status {
      margin-top: 12px; font-size: 11px; font-weight: 700; letter-spacing: 3px;
      color: var(--accent, #ff2a2a);
      text-shadow: 0 0 10px color-mix(in srgb, var(--accent, #ff2a2a) 55%, transparent);
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
      '<div id="blade-hero">' +
        '<div class="bh-clock"><span class="bh-hm">--:--</span><span class="bh-sec">--</span></div>' +
        '<div class="bh-date"></div>' +
        '<div class="bh-status">BLADE OS // ONLINE</div>' +
      '</div>';
    deck.appendChild(wrap);

    const hm = wrap.querySelector('.bh-hm');
    const sec = wrap.querySelector('.bh-sec');
    const dateEl = wrap.querySelector('.bh-date');
    const status = wrap.querySelector('.bh-status');

    // погода из кэша BladeClock, если успела подтянуться
    try {
      const w = Services.prefs.getStringPref('blade.clock.weather', '');
      if (w) status.textContent = 'BLADE OS // ONLINE  ·  ' + w;
    } catch (e) {}

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
        }
      } catch (e) {}
    }
    tick();
    const tickTimer = window.setInterval(tick, 1000);

    function updateVisible() {
      try {
        const u = window.gBrowser.currentURI ? window.gBrowser.currentURI.spec : '';
        wrap.classList.toggle('blade-on', /^about:(newtab|home)/.test(u));
        // hero только что показался — рисуем сразу, не ждём следующего тика
        if (wrap.classList.contains('blade-on')) tick();
      } catch (e) {}
    }
    const progListener = { onLocationChange() { updateVisible(); } };
    window.gBrowser.addTabsProgressListener(progListener);
    window.gBrowser.tabContainer.addEventListener('TabSelect', updateVisible);

    window.addEventListener('unload', () => {
      try { window.clearInterval(tickTimer); } catch (e) {}
      try { window.gBrowser.removeTabsProgressListener(progListener); } catch (e) {}
    }, { once: true });

    updateVisible();
    mark('OK overlay');
  } catch (e) { mark('ERR start', e); }

  window.BladeNewtabHero = true;
})();
