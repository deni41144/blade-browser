// ==UserScript==
// @name            Blade Window Fx
// @description     Визуальные эффекты окна: лазерный луч загрузки, призрак закрытия вкладки, сплеш-заставка старта, заставка простоя
// @author          Blade-Creations
// @include         main
// @version         1.0.0
// @loadOrder       12
// ==/UserScript==
(function () {
  if (window.BladeWindowFx) return;
  window.BladeWindowFx = true;

  let markPath = '';
  try {
    const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
    d.append('JS');
    markPath = d.path + '\\BladeWindowFx_mark.txt';
  } catch (e) {}
  const mark = (m, e) => {
    try {
      if (!markPath) return;
      const text = 'v1.0.0 ' + m + (e ? '\n' + String(e) + '\n' + (e && e.stack || '') : '');
      IOUtils.writeUTF8(markPath, text).catch(() => {});
    } catch (e2) {}
  };

  mark('START');

  const getImgDir = () => {
    const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
    d.append('img');
    return d;
  };

  try {
    // ЛАЗЕРНЫЙ ЛУЧ ЗАГРУЗКИ: пока активная вкладка грузится, тулбокс несёт
    // data-blade-loading — линия под ним бежит лучом (CSS, userChrome §12)
    try {
      // Тулбокс один на окно — кэш в замыкании вместо getElementById на каждый
      // TabAttrModified; запись тем же значением не делается (каждый
      // setAttribute = пересчёт стилей)
      let toolbox = null;
      let prevWant = false;
      const syncLaser = () => {
        try {
          if (!toolbox) toolbox = window.document.getElementById('navigator-toolbox');
          if (!toolbox) return;
          const tab = window.gBrowser.selectedTab;
          const want = !!(tab && tab.hasAttribute('busy'));
          // A6 «Клинок Живёт»: загрузка активной вкладки завершилась — капсула
          // «разряжается» (класс на 500мс, CSS делает вспышку). До раннего
          // return ниже: prevWant обязан обновляться на каждом синке, иначе
          // повторная установка того же атрибута скипнула бы и разрядку
          if (!want && prevWant) {
            try {
              const de = window.document.documentElement;
              de.classList.add('blade-loaded');
              setTimeout(() => { try { de.classList.remove('blade-loaded'); } catch (e) {} }, 500);
            } catch (e) {}
          }
          prevWant = want;
          if (want === (toolbox.getAttribute('data-blade-loading') === '1')) return;
          if (want) toolbox.setAttribute('data-blade-loading', '1');
          else toolbox.removeAttribute('data-blade-loading');
        } catch (e) {}
      };
      window.gBrowser.tabContainer.addEventListener('TabAttrModified', (ev) => {
        if (ev.target === window.gBrowser.selectedTab) syncLaser();
      });
      window.gBrowser.tabContainer.addEventListener('TabSelect', syncLaser);
      syncLaser();
      mark('OK laser');
    } catch (e) { mark('ERR laser ' + e); }

    // A1 «Клинок Живёт»: карточка-призрак на месте закрываемой вкладки —
    // CSS (.blade-ghost + ::before/::after) рисует угасание и искры.
    // rect вкладки — VIEWPORT-координаты, а призрак позиционируется внутри
    // тулбокса: вычитаем rect хоста, иначе призрак уезжает вниз на высоту шапки
    try {
      window.gBrowser.tabContainer.addEventListener('TabClose', (ev) => {
        try {
          const r = ev.target.getBoundingClientRect();
          if (!r.width) return;
          const host = window.document.getElementById('navigator-toolbox');
          if (!host) return;
          const hr = host.getBoundingClientRect();
          const g = window.document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
          g.className = 'blade-ghost';
          g.style.left = (r.left - hr.left) + 'px';
          g.style.top = (r.top - hr.top) + 'px';
          g.style.width = r.width + 'px';
          g.style.height = r.height + 'px';
          // Настоящие искры (драма-пас 1.9.2): каждая частица — div со своим
          // вектором в --dx/--dy; CSS летит translate(var(--dx), var(--dy)) —
          // настоящий радиальный разлёт, transform-only (композитор)
          const H = 'http://www.w3.org/1999/xhtml';
          for (let i = 0; i < 7; i++) {
            const p = window.document.createElementNS(H, 'div');
            p.className = 'blade-spark';
            const ang = (Math.PI * 2 * i) / 7 + (Math.random() - 0.5) * 0.7;
            const dist = 26 + Math.random() * 34;
            p.style.setProperty('--dx', Math.round(Math.cos(ang) * dist) + 'px');
            p.style.setProperty('--dy', Math.round(Math.sin(ang) * dist - 20) + 'px');
            p.style.animationDelay = (Math.random() * 60) + 'ms';
            g.appendChild(p);
          }
          host.appendChild(g);
          setTimeout(() => { try { g.remove(); } catch (e) {} }, 850);
        } catch (e) {}
      });
    } catch (e) {}

    // Сплеш-заставка: клинок вспыхивает при старте браузера (только первое
    // окно сессии — новые окна сплешем не мучаем)
    try {
      let winCount = 0;
      const en0 = Services.wm.getEnumerator('navigator:browser');
      while (en0.hasMoreElements()) { en0.getNext(); winCount++; }
      if (winCount <= 1) {
        const d = window.document;
        let logoUri = '';
        try {
          const logo = getImgDir().clone();
          logo.append('btn_blade.png');
          logoUri = PathUtils.toFileURI(logo.path);
        } catch (e2) {}
        const ov = d.createElementNS('http://www.w3.org/1999/xhtml', 'div');
        ov.id = 'blade-splash';
        ov.innerHTML = (logoUri ? '<img src="' + logoUri + '">' : '') +
          '<div class="word">B L A D E</div>';
        const st = d.createElementNS('http://www.w3.org/1999/xhtml', 'style');
        st.textContent = [
          '#blade-splash { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;',
          '  background: radial-gradient(ellipse 60% 50% at 50% 60%, #1a0505, #050303 75%);',
          '  display: flex; flex-direction: column; align-items: center; justify-content: center;',
          '  gap: 18px; transition: opacity .45s ease; position: relative; }',
          '#blade-splash img { width: 120px; filter: drop-shadow(0 0 18px color-mix(in srgb, var(--accent, #ff2a2a) 75%, transparent));',
          '  animation: bladeSplashImgIn .55s cubic-bezier(.2,.9,.3,1.3) forwards; }',
          '#blade-splash .word { font-family: var(--blade-display, "Unbounded", "Segoe UI", sans-serif);',
          '  color: var(--accent, #ff2a2a); font-weight: 800; font-size: 46px;',
          '  letter-spacing: 20px; text-shadow: 0 0 32px color-mix(in srgb, var(--accent, #ff2a2a) 75%, transparent), 0 0 10px var(--accent, #ff2a2a);',
          '  animation: bladeSplashWordIn .7s cubic-bezier(.2,.8,.2,1) forwards; position: relative; }',
          '#blade-splash::after { content: ""; position: absolute; left: 50%; top: calc(50% + 72px); width: 240px; height: 2px;',
          '  margin-left: -120px; border-radius: 2px; background: linear-gradient(90deg, transparent, var(--accent, #ff2a2a) 50%, transparent);',
          '  box-shadow: 0 0 12px var(--accent, #ff2a2a); pointer-events: none;',
          '  transform: scaleX(0); animation: bladeSplashSheen .9s cubic-bezier(.2,.8,.2,1) forwards; }',
          '@keyframes bladeSplashImgIn { from { opacity: 0; transform: scale(.78); } to { opacity: 1; transform: scale(1); } }',
          '@keyframes bladeSplashWordIn { from { opacity: 0; transform: scale(.88); } to { opacity: 1; transform: scale(1); } }',
          '@keyframes bladeSplashSheen { 0% { opacity: 0; transform: scaleX(0); } 50% { opacity: 1; } 100% { opacity: .85; transform: scaleX(1); } }'
        ].join('\n');
        d.documentElement.appendChild(ov);
        d.documentElement.appendChild(st);
        setTimeout(() => { try { ov.style.opacity = '0'; } catch (e3) {} }, 1050);
        setTimeout(() => { try { ov.remove(); st.remove(); } catch (e3) {} }, 1550);
        mark('OK splash');
      }
    } catch (e) { mark('ERR splash ' + e); }

    // ЗАСТАВКА ПРОСТОЯ: 3+ минуты без ввода — экран с логотипом и часами.
    // Гварды показа: преф выключен / окно в fullscreen / любая вкладка играет
    // звук (человек смотрит видео или слушает — не мешаем). Оверлей с
    // pointer-events: none — никогда не перехватывает ввод, любое движение
    // его мгновенно убирает. Стили — только читаемая база: наведёт красоту
    // CSS-волна по селекторам #blade-idle / .bi-word / .bi-clock.
    try {
      const d = window.document;
      const H2 = 'http://www.w3.org/1999/xhtml';
      let lastActivity = Date.now();
      let idleShown = false;
      let clockTimer = null;
      let idleOv = null;
      let clockEl = null;

      const ensureIdleOverlay = () => {
        // id-гварды и оверлея, и стиля: повторный вызов ничего не плодит
        let ov = d.getElementById('blade-idle');
        if (ov) { idleOv = ov; clockEl = ov.querySelector('.bi-clock'); return ov; }
        ov = d.createElementNS(H2, 'div');
        ov.id = 'blade-idle';
        const word = d.createElementNS(H2, 'div');
        word.className = 'bi-word';
        word.textContent = 'B L A D E';
        const clock = d.createElementNS(H2, 'div');
        clock.className = 'bi-clock';
        clock.textContent = '--:--';
        ov.append(word, clock);
        const st = d.createElementNS(H2, 'style');
        st.textContent = [
          '#blade-idle { position: fixed; inset: 0; z-index: 2147483640;',
          '  display: none; background: #040406; pointer-events: none;',
          '  flex-direction: column; align-items: center; justify-content: center; gap: 24px;',
          '  animation: bladeIdleFadeIn .6s cubic-bezier(.2,.8,.2,1) forwards; position: relative; }',
          '#blade-idle::before { content: ""; position: absolute; inset: 0;',
          '  background: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--accent, #ff2a2a) 16%, transparent), transparent 70%);',
          '  pointer-events: none; animation: bladeIdleBreathe 7.5s ease-in-out infinite alternate; }',
          '#blade-idle .bi-word { font-family: var(--blade-display, "Unbounded", "Segoe UI", sans-serif);',
          '  font-size: 26px; font-weight: 800; letter-spacing: 14px; color: var(--accent, #ff2a2a);',
          '  text-shadow: 0 0 20px color-mix(in srgb, var(--accent, #ff2a2a) 60%, transparent); opacity: .85;',
          '  z-index: 1; animation: bladeIdleWordPulse 6s ease-in-out infinite alternate; }',
          '#blade-idle .bi-clock { font-family: var(--blade-mono, "JetBrains Mono", monospace);',
          '  font-size: 96px; font-weight: 200; color: #d8d8de;',
          '  text-shadow: 0 0 28px color-mix(in srgb, var(--accent, #ff2a2a) 30%, transparent), 0 0 8px rgba(255,255,255,.1);',
          '  z-index: 1; }',
          '@keyframes bladeIdleFadeIn { from { opacity: 0; transform: scale(.97); } to { opacity: 1; transform: scale(1); } }',
          '@keyframes bladeIdleBreathe { from { opacity: .25; } to { opacity: .85; } }',
          '@keyframes bladeIdleWordPulse { from { opacity: .75; transform: scale(.99); } to { opacity: .95; transform: scale(1.01); } }'
        ].join('\n');
        d.documentElement.append(st, ov);
        idleOv = ov;
        clockEl = clock;
        return ov;
      };

      const clockTick = () => {
        try {
          const n = new Date();
          clockEl.textContent =
            String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
        } catch (e) {}
      };

      const showIdle = () => {
        try {
          ensureIdleOverlay();
          idleOv.style.display = 'flex';
          idleShown = true;
          clockTick(); // при показе сразу актуальное время, а не «--:--»
          if (!clockTimer) clockTimer = (window.Blade && Blade.every ? Blade.every(clockTick, 1000) : setInterval(clockTick, 1000));
        } catch (e) { mark('ERR idleShow ' + e); }
      };

      const hideIdle = () => {
        try {
          if (idleOv) idleOv.style.display = 'none';
          if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
          idleShown = false;
        } catch (e) {}
      };

      // activity-события только обновляют lastActivity; если оверлей уже
      // виден — первое же движение скрывает его (hideIdle внутри)
      const onActivity = () => {
        lastActivity = Date.now();
        if (idleShown) hideIdle();
      };
      for (const t of ['mousemove', 'keydown', 'mousedown', 'wheel']) {
        window.addEventListener(t, onActivity, { capture: true, passive: true });
      }

      const idleAllowed = () => {
        try {
          if (!Services.prefs.getBoolPref('blade.idle.on', true)) return false;
          if (window.fullScreen) return false;
          // экономия батареи (волна «Сок»): заставка не поднимается
          if (window.document.documentElement.hasAttribute('data-blade-battery')) return false;
          // звук в любой вкладке = юзер при деле: заставку не поднимаем
          if (window.document.querySelector('tab[soundplaying]')) return false;
          return true;
        } catch (e) { return false; }
      };

      // Реестр BladeCore (2.0): снятие на unload автоматом, ручной хендлер срезан
      if (window.Blade && window.Blade.every) {
        Blade.every(() => {
          try {
            if (!idleShown && Date.now() - lastActivity > 3 * 60e3 && idleAllowed()) showIdle();
          } catch (e) {}
        }, 15e3);
      } else {
        const idleTimer = setInterval(() => {
          try {
            if (!idleShown && Date.now() - lastActivity > 3 * 60e3 && idleAllowed()) showIdle();
          } catch (e) {}
        }, 15e3);
        window.addEventListener('unload', () => {
          clearInterval(idleTimer);
          if (clockTimer) clearInterval(clockTimer);
        }, { once: true });
      }
      mark('OK idle');
    } catch (e) { mark('ERR idle ' + e); }
  } catch (e) {
    mark('ERR fatal', e);
  }
})();
