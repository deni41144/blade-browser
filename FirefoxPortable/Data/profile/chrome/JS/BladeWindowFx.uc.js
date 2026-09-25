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

  // Стили эффектов — AUTHOR-инъекция, не userChrome.css. Эти ноды — HTML
  // (createElementNS xhtml), а userChrome.css грузится USER_SHEET'ом, который
  // в XUL-документе не достаёт HTML-элементов: правила молча не матчатся,
  // нода остаётся static/opacity:1 и эффект невидим (баг被发现 через probe:
  // canary #navigator-toolbox получал position:relative, а .blade-ghost — нет)
  try {
    const doc = window.document;
    if (!doc.getElementById('blade-fx-style')) {
      const FX_CSS = `
.blade-ghost {
  position: absolute !important;
  pointer-events: none !important;
  z-index: 1000 !important;
  border-radius: 8px 8px 0 0 !important;
  background: color-mix(in srgb, var(--accent, #ff2a2a) 35%, #14141a) !important;
  border: 1px solid var(--accent, #ff2a2a) !important;
  border-bottom: none !important;
  box-shadow: 0 0 16px var(--accent-glow, rgba(255, 42, 42, 0.45)), 0 -2px 8px var(--accent, #ff2a2a) !important;
  animation: blade-ghost-fade 0.8s cubic-bezier(0.2, 0.8, 0.25, 1) forwards !important;
}
@keyframes blade-ghost-fade {
  0% { opacity: 0.95; transform: scale(1) translateY(0); }
  30% { opacity: 0.8; transform: scale(0.97) translateY(-2px); }
  100% { opacity: 0; transform: scale(0.85) translateY(-8px); }
}
.blade-ghost::before { content: none !important; }
.blade-spark {
  position: absolute !important;
  left: 50%;
  top: 40% !important;
  width: 3px !important;
  height: 3px !important;
  border-radius: 50% !important;
  background: #ffffff !important;
  box-shadow: 0 0 7px var(--accent, #ff2a2a), 0 0 3px #ffffff !important;
  pointer-events: none !important;
  animation: blade-spark-fly 0.75s cubic-bezier(0.2, 0.8, 0.3, 1) forwards !important;
}
.blade-spark:nth-child(even) {
  background: var(--accent, #ff2a2a) !important;
  box-shadow: 0 0 7px #ffffff, 0 0 3px var(--accent, #ff2a2a) !important;
}
.blade-dust {
  position: absolute !important;
  top: 40% !important;
  width: 2px !important;
  height: 2px !important;
  border-radius: 50% !important;
  background: var(--accent, #ff2a2a) !important;
  box-shadow: 0 0 4px var(--accent, #ff2a2a) !important;
  pointer-events: none !important;
  opacity: 0 !important;
  animation: blade-dust-fall 0.95s cubic-bezier(0.3, 0.7, 0.35, 1) forwards !important;
}
.blade-dust:nth-child(odd) { width: 3px !important; height: 3px !important; }
.blade-dust:nth-child(3n) { background: #ffffff !important; box-shadow: 0 0 4px #ffffff !important; }
@keyframes blade-dust-fall {
  0% { opacity: 0; transform: translate(0, 0) scale(1); }
  15% { opacity: 1; }
  100% { opacity: 0; transform: translate(var(--dx, 0px), var(--dy, 80px)) scale(0.4); }
}
@keyframes blade-spark-fly {
  0% { opacity: 1; transform: translate(0, 0) scale(1.2); }
  25% { opacity: 1; transform: translate(calc(var(--dx, 0px) * 0.35), calc(var(--dy, -40px) * 0.35)) scale(1); }
  100% { opacity: 0; transform: translate(var(--dx, 0px), var(--dy, -40px)) scale(0.2); }
}
.blade-ghost::after {
  content: "" !important;
  position: absolute !important;
  inset: 0 !important;
  pointer-events: none !important;
  border-radius: 8px 8px 0 0 !important;
  background: radial-gradient(ellipse at center, #ffffff 0%, rgba(255, 255, 255, 0.85) 20%, color-mix(in srgb, var(--accent, #ff2a2a) 65%, transparent) 50%, transparent 75%) !important;
  animation: blade-ghost-flash 0.65s cubic-bezier(0.2, 0.8, 0.25, 1) forwards !important;
}
@keyframes blade-ghost-flash {
  0% { opacity: 1; transform: scale(0.5); }
  100% { opacity: 0; transform: scale(1.4); }
}
.blade-shard {
  position: absolute !important;
  width: 26px !important;
  height: 48% !important;
  background: color-mix(in srgb, var(--accent, #ff2a2a) 35%, #14141a) !important;
  border: 1px solid var(--accent, #ff2a2a) !important;
  box-shadow: 0 0 6px var(--accent, #ff2a2a) !important;
  pointer-events: none !important;
  opacity: 0 !important;
  animation: blade-shard-fly 0.95s cubic-bezier(0.25, 0.7, 0.3, 1) forwards !important;
}
@keyframes blade-shard-fly {
  0% { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(1); }
  25% { opacity: 1; }
  100% { opacity: 0; transform: translate(var(--dx, 0px), var(--dy, 0px)) rotate(var(--rot, 0deg)) scale(0.45); }
}
.blade-burst {
  position: absolute !important;
  width: 24px !important;
  height: 24px !important;
  margin: -12px 0 0 -12px !important;
  border-radius: 50% !important;
  border: 2px solid var(--accent, #ff2a2a) !important;
  box-shadow: 0 0 14px var(--accent, #ff2a2a), inset 0 0 6px var(--accent, #ff2a2a) !important;
  pointer-events: none !important;
  z-index: 1001 !important;
  opacity: 0 !important;
  animation: blade-burst-ring 0.7s cubic-bezier(0.2, 0.8, 0.3, 1) forwards !important;
}
@keyframes blade-burst-ring {
  0% { opacity: 0.95; transform: scale(0.3); }
  100% { opacity: 0; transform: scale(3.4); }
}
.blade-theme-wave {
  position: absolute !important;
  top: 0 !important;
  bottom: 0 !important;
  width: 160px !important;
  left: 0 !important;
  pointer-events: none !important;
  z-index: 998 !important;
  background: linear-gradient(90deg, transparent 0%, var(--accent, #ff2a2a) 60%, #ffffff 90%, transparent 100%) !important;
  box-shadow: 0 0 18px var(--accent, #ff2a2a), 0 0 6px #ffffff !important;
  mask-image: linear-gradient(180deg, transparent 0%, #000 24%, #000 76%, transparent 100%) !important;
  -webkit-mask-image: linear-gradient(180deg, transparent 0%, #000 24%, #000 76%, transparent 100%) !important;
  opacity: 0 !important;
  animation: blade-theme-wave-sweep 0.9s cubic-bezier(0.25, 0.6, 0.3, 1) forwards !important;
}
@keyframes blade-theme-wave-sweep {
  0% { opacity: 0; transform: translateX(-160px); }
  12% { opacity: 1; }
  85% { opacity: 1; }
  100% { opacity: 0; transform: translateX(calc(100vw)); }
}
.blade-tab-hit {
  position: absolute !important;
  height: 2px !important;
  pointer-events: none !important;
  z-index: 997 !important;
  background: var(--accent, #ff2a2a) !important;
  box-shadow: 0 0 10px var(--accent, #ff2a2a), 0 0 4px #ffffff !important;
  opacity: 0 !important;
  transform-origin: center !important;
  animation: blade-tab-hit-flash 0.5s cubic-bezier(0.2, 0.8, 0.3, 1) forwards !important;
}
@keyframes blade-tab-hit-flash {
  0% { opacity: 0; transform: scaleX(0.2); }
  25% { opacity: 1; transform: scaleX(1); }
  100% { opacity: 0; transform: scaleX(1); }
}
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
        // A13 Удар клинка: под выбранной вкладкой вспыхивает акцентная линия.
        // Одноразовый, дедуп — при быстром переборе вкладок хвост снимается,
        // чтобы не копить слои
        try {
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
          hit.style.top = (r.bottom - hr.top - 1) + 'px';
          host.appendChild(hit);
          setTimeout(() => { try { hit.remove(); } catch (e) {} }, 550);
        } catch (e) {}
      });
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
          const H = 'http://www.w3.org/1999/xhtml';
          // РАСПЫЛЕНИЕ: 12 искр разлетаются радиально ВО ВСЕ стороны (старт
          // разбросан по ширине вкладки, а не из центра), каждая со своим
          // вектором в --dx/--dy — transform-only, композитор (конвенция 6)
          const ang0 = Math.random() * Math.PI * 2;
          for (let i = 0; i < 12; i++) {
            const p = window.document.createElementNS(H, 'div');
            p.className = 'blade-spark';
            p.style.left = (6 + Math.random() * Math.max(2, r.width - 12)) + 'px';
            const ang = ang0 + (Math.PI * 2 * i) / 12 + (Math.random() - 0.5) * 0.5;
            const dist = 22 + Math.random() * 48;
            p.style.setProperty('--dx', Math.round(Math.cos(ang) * dist) + 'px');
            p.style.setProperty('--dy', Math.round(Math.sin(ang) * dist * 0.75 - 14) + 'px');
            p.style.animationDelay = (Math.random() * 70) + 'ms';
            g.appendChild(p);
          }
          // ПЕПЕЛ: 8 пылинок осыпаются ВНИЗ с горизонтальным дрейфом —
          // вкладка не гаснет, а рассыпается
          for (let i = 0; i < 8; i++) {
            const p = window.document.createElementNS(H, 'div');
            p.className = 'blade-dust';
            p.style.left = (8 + Math.random() * Math.max(2, r.width - 16)) + 'px';
            p.style.setProperty('--dx', Math.round((Math.random() - 0.5) * 70) + 'px');
            p.style.setProperty('--dy', Math.round(46 + Math.random() * 54) + 'px');
            p.style.animationDelay = (Math.random() * 110) + 'ms';
            g.appendChild(p);
          }
          // ОСКОЛКИ: 8 фрагментов самой вкладки разлетаются с вращением —
          // карточка не затухает, а рассыпается на куски
          for (let i = 0; i < 8; i++) {
            const p = window.document.createElementNS(H, 'div');
            p.className = 'blade-shard';
            p.style.left = Math.round(i * (r.width / 8) + (Math.random() - 0.5) * 6) + 'px';
            p.style.top = (i % 2 === 0 ? 0 : Math.round(r.height * 0.5)) + 'px';
            p.style.setProperty('--dx', Math.round((Math.random() - 0.5) * r.width * 1.2) + 'px');
            p.style.setProperty('--dy', (i % 2 === 0
              ? Math.round(-30 - Math.random() * 50)
              : Math.round(30 + Math.random() * 50)) + 'px');
            p.style.setProperty('--rot', Math.round((Math.random() - 0.5) * 180) + 'deg');
            p.style.animationDelay = (Math.random() * 60) + 'ms';
            g.appendChild(p);
          }
          // УДАРНАЯ ВОЛНА: кольцо из центра вкладки — импульс распада
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
    // слева направо пробегает акцентный разряд — тема не переключается
    // вслепую, виден момент «применения». Одноразовый, ~0.9с
    try {
      const H = 'http://www.w3.org/1999/xhtml';
      if (!window.Blade || !window.Blade.bus) throw new Error('no bus');
      window.Blade.bus.on('theme:changed', () => {
        try {
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
