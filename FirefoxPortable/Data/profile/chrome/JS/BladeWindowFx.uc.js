// ==UserScript==
// @name            Blade Window Fx
// @description     Визуальные эффекты окна: лазерный луч загрузки, призрак закрытия вкладки, сплеш-заставка старта, заставка простоя
// @author          Blade-Creations
// @include         main
// @version         1.2.0
// @loadOrder       12
// ==/UserScript==
(function () {
  if (window.BladeWindowFx) return;
  window.BladeWindowFx = true;
  const canAnimate = () => !window.BladeEffects || window.BladeEffects.canAnimate();

  let markPath = '';
  try {
    const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
    d.append('JS');
    markPath = d.path + '\\BladeWindowFx_mark.txt';
  } catch (e) {}
  const mark = (m, e) => {
    try {
      if (!markPath) return;
      const text = 'v1.2.0 ' + m + (e ? '\n' + String(e) + '\n' + (e && e.stack || '') : '');
      IOUtils.writeUTF8(markPath, text).catch(() => {});
    } catch (e2) {}
  };

  mark('START');

  // Стили эффектов — AUTHOR-инъекция, не userChrome.css. Эти ноды — HTML
  // (createElementNS xhtml), а userChrome.css грузится USER_SHEET'ом, который
  // в XUL-документе не достаёт HTML-элементов: правила молча не матчатся,
  // нода остаётся static/opacity:1 и эффект невидим (баг被发现 через probe:
  // canary #navigator-toolbox получал position:relative, а .blade-ghost — нет)
  try {
    const doc = window.document;
    if (!doc.getElementById('blade-fx-style')) {
      const FX_CSS = `
/* Transient accents are etched contours, not additive white flashes. */
.blade-ghost {
  position: absolute !important; pointer-events: none !important; z-index: 1000 !important;
  border-radius: 8px 8px 0 0 !important; background: transparent !important;
  border: 1px solid color-mix(in srgb,var(--accent,#ff2a2a) 50%,transparent) !important;
  border-bottom: none !important; box-shadow: none !important;
  animation: blade-ghost-fade .52s cubic-bezier(.2,.8,.25,1) forwards !important;
}
@keyframes blade-ghost-fade {
  0% { opacity:.62; transform:translateY(0) scaleX(1); }
  100% { opacity:0; transform:translateY(-4px) scaleX(.94); }
}
.blade-ghost::before,.blade-ghost::after { content:none !important; }
.blade-spark {
  position:absolute !important; top:0 !important; width:14px !important; height:1px !important;
  border-radius:0 !important; background:linear-gradient(90deg,transparent,var(--accent,#ff2a2a),transparent) !important;
  box-shadow:none !important; pointer-events:none !important;
  animation:blade-spark-fly .48s cubic-bezier(.2,.8,.3,1) forwards !important;
}
@keyframes blade-spark-fly {
  0% { opacity:0; transform:translate(0,0) scaleX(.5); }
  18% { opacity:.75; }
  100% { opacity:0; transform:translate(var(--dx,12px),var(--dy,-6px)) scaleX(.7); }
}
.blade-shard {
  position:absolute !important; width:18px !important; height:1px !important;
  background:color-mix(in srgb,var(--accent,#ff2a2a) 65%,transparent) !important;
  border:none !important; box-shadow:none !important; pointer-events:none !important;
  animation:blade-shard-fly .55s ease-out forwards !important;
}
@keyframes blade-shard-fly {
  0% { opacity:.6; transform:translate(0,0); }
  100% { opacity:0; transform:translate(var(--dx,0px),var(--dy,-5px)); }
}
.blade-burst {
  position:absolute !important; width:42px !important; height:1px !important;
  margin:0 0 0 -21px !important; border:none !important; border-radius:0 !important;
  background:linear-gradient(90deg,transparent,var(--accent,#ff2a2a),transparent) !important;
  box-shadow:none !important; pointer-events:none !important; z-index:1001 !important;
  animation:blade-burst-ring .45s ease-out forwards !important;
}
@keyframes blade-burst-ring {
  0% { opacity:.5; transform:scaleX(.3); }
  100% { opacity:0; transform:scaleX(1.4); }
}
.blade-theme-wave {
  position:absolute !important; bottom:0 !important; top:auto !important;
  width:220px !important; height:1px !important; left:0 !important;
  pointer-events:none !important; z-index:998 !important;
  background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--accent,#ff2a2a) 75%,transparent) 55%,transparent) !important;
  box-shadow:none !important; opacity:0 !important;
  animation:blade-theme-wave-sweep .75s cubic-bezier(.25,.6,.3,1) forwards !important;
}
@keyframes blade-theme-wave-sweep {
  0% { opacity:0; transform:translateX(-220px); }
  20% { opacity:.85; }
  75% { opacity:.65; }
  100% { opacity:0; transform:translateX(100vw); }
}
.blade-tab-hit {
  position:absolute !important; pointer-events:none !important; z-index:997 !important;
  border-radius:8px 8px 0 0 !important; overflow:hidden !important;
  background:transparent !important; box-shadow:none !important;
  animation:blade-tab-hit-flash .58s cubic-bezier(.2,.8,.3,1) forwards !important;
}
@keyframes blade-tab-hit-flash {
  0% { opacity:0; transform:scaleX(.97); }
  20% { opacity:.8; transform:scaleX(1); }
  100% { opacity:0; transform:scaleX(1); }
}
.blade-tab-hit::before {
  content:""; position:absolute; inset:0; pointer-events:none; border-radius:inherit;
  border:1px solid color-mix(in srgb,var(--accent,#ff2a2a) 55%,transparent); border-bottom:0;
  background:transparent; animation:blade-tab-crown .58s ease-out forwards;
}
@keyframes blade-tab-crown {
  0% { opacity:0; transform:translateY(3px); }
  25% { opacity:1; transform:translateY(0); }
  100% { opacity:0; transform:translateY(0); }
}
.blade-tab-hit::after {
  content:""; position:absolute; width:34px; height:1px; left:0; top:0;
  background:linear-gradient(90deg,transparent,var(--accent,#ff2a2a),transparent);
  box-shadow:none; animation:blade-hit-slice .58s ease-out forwards;
}
@keyframes blade-hit-slice {
  0% { opacity:0; transform:translateX(-34px); }
  24% { opacity:.9; }
  100% { opacity:0; transform:translateX(var(--blade-tab-span,160px)); }
}
:root[data-blade-fx-mode="balanced"] .blade-tab-hit::after { display:none; }
:root[data-blade-fx-paused="true"] :is(.blade-ghost,.blade-ghost *,.blade-burst,.blade-tab-hit,.blade-theme-wave),
:root[data-blade-fx-paused="true"] .blade-tab-hit::before,
:root[data-blade-fx-paused="true"] .blade-tab-hit::after { animation-play-state:paused !important; }
:root[data-blade-fx-mode="eco"] .blade-ghost,
:root[data-blade-fx-mode="eco"] .blade-burst,
:root[data-blade-fx-mode="eco"] .blade-tab-hit,
:root[data-blade-fx-mode="eco"] .blade-theme-wave { display:none !important; }
`;
      const st = doc.createElementNS('http://www.w3.org/1999/xhtml', 'style');
      st.id = 'blade-fx-style';
      st.textContent = FX_CSS;
      doc.documentElement.appendChild(st);
      mark('OK fx-style');
    }
  } catch (e) { mark('ERR fx-style ' + e); }

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
          if (window.BladeChromeMotion) return;
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
      window.gBrowser.tabContainer.addEventListener('TabSelect', (ev) => {
        syncLaser();
        // Контур выбранной вкладки раскрывается коротким точным штрихом.
        // Одноразовый, дедуп — при быстром переборе вкладок хвост снимается,
        // чтобы не копить слои
        try {
          if (window.BladeChromeMotion) return;
          if (!canAnimate()) return;
          const host = window.document.getElementById('navigator-toolbox');
          if (!host) return;
          const prev = host.querySelector('.blade-tab-hit');
          if (prev) prev.remove();
          const r = ev.target.getBoundingClientRect();
          if (!r.width) return;
          const hr = host.getBoundingClientRect();
          const H2 = 'http://www.w3.org/1999/xhtml';
          const hit = window.document.createElementNS(H2, 'div');
          hit.className = 'blade-tab-hit';
          hit.style.left = (r.left - hr.left) + 'px';
          hit.style.width = r.width + 'px';
          hit.style.top = (r.top - hr.top) + 'px';
          hit.style.height = r.height + 'px';
          hit.style.setProperty('--blade-tab-span', r.width + 'px');
          host.appendChild(hit);
          setTimeout(() => { try { hit.remove(); } catch (e) {} }, 950);
        } catch (e) {}
      });
      syncLaser();
      mark('OK laser');
    } catch (e) { mark('ERR laser ' + e); }

    // A1 «Клинок Живёт»: карточка-призрак на месте закрываемой вкладки —
    // CSS рисует угасание тонкого контура и короткие следы.
    // rect вкладки — VIEWPORT-координаты, а призрак позиционируется внутри
    // тулбокса: вычитаем rect хоста, иначе призрак уезжает вниз на высоту шапки
    try {
      window.gBrowser.tabContainer.addEventListener('TabClose', (ev) => {
        try {
          if (window.BladeTabDestruction) return;
          if (!canAnimate()) return;
          const r = ev.target.getBoundingClientRect();
          if (!r.width) return;
          const host = window.document.getElementById('navigator-toolbox');
          if (!host) return;
          // Closing many tabs cannot leave dozens of particle layers alive.
          while (host.querySelectorAll('.blade-ghost').length >= 3) host.querySelector('.blade-ghost').remove();
          while (host.querySelectorAll('.blade-burst').length >= 3) host.querySelector('.blade-burst').remove();
          const hr = host.getBoundingClientRect();
          const g = window.document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
          g.className = 'blade-ghost';
          g.style.left = (r.left - hr.left) + 'px';
          g.style.top = (r.top - hr.top) + 'px';
          g.style.width = r.width + 'px';
          g.style.height = r.height + 'px';
          const H = 'http://www.w3.org/1999/xhtml';
          // Короткие направленные штрихи вдоль верхнего контура. Никакого
          // радиального взрыва, белой заливки или разлетающихся карточек.
          const balanced = window.BladeEffects && window.BladeEffects.mode() === 'balanced';
          const strokes = balanced ? 2 : 5;
          for (let i = 0; i < strokes; i++) {
            const p = window.document.createElementNS(H, 'div');
            p.className = 'blade-spark';
            p.style.left = Math.round((i + .5) * r.width / strokes) + 'px';
            p.style.setProperty('--dx', (i % 2 ? 14 : -14) + 'px');
            p.style.setProperty('--dy', (-3 - i % 3 * 2) + 'px');
            p.style.animationDelay = i * 18 + 'ms';
            g.appendChild(p);
          }
          if (!balanced) {
            for (let i = 0; i < 2; i++) {
              const p = window.document.createElementNS(H, 'div');
              p.className = 'blade-shard';
              p.style.left = (i ? Math.max(0, r.width - 18) : 0) + 'px';
              p.style.top = Math.round(r.height * .45) + 'px';
              p.style.setProperty('--dx', (i ? 6 : -6) + 'px');
              p.style.setProperty('--dy', '-4px');
              g.appendChild(p);
            }
          }
          // Тонкий остаточный штрих вместо расширяющегося неонового кольца.
          const burst = window.document.createElementNS(H, 'div');
          burst.className = 'blade-burst';
          burst.style.left = Math.round(r.left - hr.left + r.width / 2) + 'px';
          burst.style.top = Math.round(r.top - hr.top + r.height / 2) + 'px';
          host.appendChild(burst);
          setTimeout(() => { try { burst.remove(); } catch (e) {} }, 800);
          host.appendChild(g);
          setTimeout(() => { try { g.remove(); } catch (e) {} }, 1250);
        } catch (e) {}
      });
    } catch (e) {}

    // A12 Перезарядка темы: при смене темы (шина theme:changed) по тулбоксу
    // слева направо пробегает тонкий штрих — тема не переключается
    // вслепую, виден момент «применения». Одноразовый, ~0.9с
    try {
      const H = 'http://www.w3.org/1999/xhtml';
      if (!window.Blade || !window.Blade.bus) throw new Error('no bus');
      window.Blade.bus.on('theme:changed', () => {
        try {
          if (window.BladeChromeMotion) return;
          if (!canAnimate()) return;
          const host = window.document.getElementById('navigator-toolbox');
          if (!host) return;
          // Снимаем хвост предыдущего разряда, если тема сменилась дважды
          // подряд (хоткеи, авто-тема): иначе копятся слои
          const old = host.querySelector('.blade-theme-wave');
          if (old) old.remove();
          const w = window.document.createElementNS(H, 'div');
          w.className = 'blade-theme-wave';
          host.appendChild(w);
          setTimeout(() => { try { w.remove(); } catch (e) {} }, 1000);
        } catch (e) {}
      });
      mark('OK theme-wave');
    } catch (e) { mark('ERR theme-wave ' + e); }

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
          if (!canAnimate()) return false;
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
