// ==UserScript==
// @name            Blade Palette
// @description     Командная палитра Ctrl+K в стиле терминала: темы, фоны,
//                  облики, обновления и быстрые действия браузера
// @author          Blade-Creations
// @include         main
// @version         1.1.0
// ==/UserScript==
(function () {
  if (window.BladePalette) return; // анти-дубль: uc.js исполняется в каждом окне

  // ---- mark-файл по конвенции проекта (как update_mark.txt у BladeUpdater):
  // ---- chrome\JS\palette_mark.txt, перезапись, IOUtils, ошибки глотаются
  let markPath = '';
  try {
    const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
    d.append('JS');
    markPath = d.path + '\\palette_mark.txt';
  } catch (e) {}
  const mark = (m, e) => {
    try {
      if (!markPath) return;
      const text = 'v1.1.0 ' + m + (e ? '\n' + String(e) + '\n' + (e && e.stack || '') : '');
      IOUtils.writeUTF8(markPath, text).catch(() => {});
    } catch (e2) {}
  };

  const PANEL_ID = 'blade-palette';
  const STYLE_ID = 'blade-palette-style';
  const KEY_ID = 'blade-key-palette';
  const PALETTE_W = 560;  // дубль фикс-ширины .blp-wrap: нужен для центровки на экране
  const MAX_ROWS = 12;    // терминальная палитра — длинный список только мешает

  // ---- Реестр команд ------------------------------------------------------
  // commands — единственный источник истины; внешние модули добавляют команды
  // через window.BladePalette.register({ id, label, hint, kw, fn }).
  const commands = []; // { id, label, hint, kw, fn, dyn }
  const cmdIds = new Set();

  function register(cmd) {
    try {
      if (!cmd || typeof cmd !== 'object') return false;
      if (typeof cmd.id !== 'string' || !cmd.id) return false;
      if (typeof cmd.label !== 'string' || !cmd.label) return false;
      if (typeof cmd.fn !== 'function') return false;
      if (cmdIds.has(cmd.id)) return false; // дубль id молча игнорируем
      commands.push({
        id: cmd.id,
        label: cmd.label,
        hint: String(cmd.hint || ''),
        kw: String(cmd.kw || ''),
        fn: cmd.fn,
        dyn: !!cmd.dyn, // dyn = наши перегенерируемые команды (темы/фоны/облики)
      });
      cmdIds.add(cmd.id);
      return true;
    } catch (e) { return false; }
  }

  // Снимаем только собственные dyn-команды; чужие (через публичный register)
  // не трогаем. filter без splice в цикле — без скрытой O(N^2).
  function unregisterDynamic() {
    for (let i = 0; i < commands.length; i++) {
      if (commands[i].dyn) cmdIds.delete(commands[i].id);
    }
    const kept = commands.filter(c => !c.dyn);
    commands.length = 0;
    for (const c of kept) commands.push(c);
  }

  // Нул-гварды контракта окружения: палитра не должна падать, если
  // BladeSettings/BladeUpdater ещё нет (параллельная правка / отключен скрипт)
  const hasBS = () => typeof window.BladeSettings === 'object' && !!window.BladeSettings;
  const hasBU = () => typeof window.BladeUpdater === 'object' && !!window.BladeUpdater;

  // Темы/фоны/облики перечитываются ПРИ КАЖДОМ ОТКРЫТИИ, а не один раз на
  // старте: uc.js грузятся по алфавиту, BobliksSettings (владелец
  // window.BladeSettings) исполняется ПОСЛЕ нас — на старте его ещё нет.
  // Побочный бонус: список всегда свежий, без перезапуска браузера.
  function refreshDynamicCommands() {
    unregisterDynamic();
    if (!hasBS()) return;
    const BS = window.BladeSettings;
    try {
      if (typeof BS.themes === 'function') {
        for (const t of BS.themes()) {
          if (!t || !t.id || !t.label) continue;
          register({
            id: 'blade-theme-' + t.id,
            label: 'Тема: ' + t.label,
            hint: 'тема',
            kw: 'тема theme ' + t.id,
            dyn: true,
            fn: () => {
              if (hasBS() && typeof window.BladeSettings.setTheme === 'function') {
                window.BladeSettings.setTheme(t.id);
              }
            },
          });
        }
      }
    } catch (e) { mark('ERR themes ' + e); }
    try {
      if (typeof BS.bgs === 'function') {
        for (const b of BS.bgs()) {
          if (!b || !b.id || !b.label) continue;
          register({
            id: 'blade-bg-' + b.id,
            label: 'Фон: ' + b.label,
            hint: 'фон',
            kw: 'фон background bg ' + b.id,
            dyn: true,
            fn: () => {
              if (hasBS() && typeof window.BladeSettings.setBg === 'function') {
                window.BladeSettings.setBg(b.id);
              }
            },
          });
        }
      }
    } catch (e) { mark('ERR bgs ' + e); }
    try {
      if (typeof BS.visages === 'function') {
        for (const v of BS.visages()) {
          if (!v || !v.id || !v.label) continue;
          register({
            id: 'blade-visage-' + v.id,
            label: 'Облик: ' + v.label,
            hint: 'облик',
            kw: 'облик visage ' + v.id,
            dyn: true,
            fn: () => {
              if (hasBS() && typeof window.BladeSettings.applyVisage === 'function') {
                window.BladeSettings.applyVisage(v.id);
              }
            },
          });
        }
      }
    } catch (e) { mark('ERR visages ' + e); }
    try {
      if (typeof BS.saveVisage === 'function') {
        register({
          id: 'blade-visage-save',
          label: 'Облик: сохранить текущий',
          hint: 'облик',
          kw: 'облик visage сохранить save',
          dyn: true,
          fn: () => { if (hasBS()) window.BladeSettings.saveVisage(); },
        });
      }
    } catch (e) { mark('ERR saveVisage ' + e); }
  }

  // ---- Статические команды: регистрируются один раз на старте, гварды ----
  // ---- контракта проверяются в момент выполнения ----
  function registerStatic() {
    register({
      id: 'blade-cmd-update-check',
      label: 'Обновления: проверить сейчас',
      hint: 'Blade',
      kw: 'обновление update check github',
      fn: () => {
        if (hasBU() && typeof window.BladeUpdater.check === 'function') {
          window.BladeUpdater.check(true);
        }
      },
    });
    register({
      id: 'blade-cmd-update-install',
      label: 'Обновления: установить',
      hint: 'Blade',
      kw: 'обновление update install установить',
      fn: () => {
        if (hasBU() && typeof window.BladeUpdater.install === 'function') {
          window.BladeUpdater.install();
        }
      },
    });
    register({
      id: 'blade-cmd-set-default',
      label: 'Браузер по умолчанию',
      hint: 'система',
      kw: 'браузер по умолчанию default',
      fn: () => {
        if (hasBU() && typeof window.BladeUpdater.setDefault === 'function') {
          window.BladeUpdater.setDefault();
        }
      },
    });
    register({
      id: 'blade-cmd-backup',
      label: 'Бэкап профиля',
      hint: 'профиль',
      kw: 'бэкап backup профиль сохранить',
      fn: () => { if (hasBS()) window.BladeSettings.backup(); },
    });
    register({
      id: 'blade-cmd-private-window',
      label: 'Приватное окно',
      hint: 'окно',
      kw: 'приватное private окно инкогнито',
      fn: () => {
        if (typeof window.OpenBrowserWindow === 'function') {
          window.OpenBrowserWindow({ private: true });
        }
      },
    });
    register({
      id: 'blade-cmd-new-tab',
      label: 'Новая вкладка',
      hint: 'вкладка',
      kw: 'вкладка tab новая new',
      fn: () => { if (typeof window.BrowserOpenTab === 'function') window.BrowserOpenTab(); },
    });
    register({
      id: 'blade-cmd-restart',
      label: 'Перезапуск браузера',
      hint: 'перезапуск',
      kw: 'перезапуск restart рестарт выйти',
      fn: () => {
        Services.startup.quit(Services.startup.eAttemptQuit | Services.startup.eRestart);
      },
    });
    register({
      id: 'blade-cmd-sounds',
      label: 'Звуки: переключить',
      hint: 'звук',
      kw: 'звук звук sounds вкл выкл mute',
      fn: () => {
        if (hasBS() && typeof window.BladeSettings.toggleSounds === 'function') {
          window.BladeSettings.toggleSounds();
        }
      },
    });
    register({
      id: 'blade-cmd-reader-dark',
      label: 'Тёмный режим сайтов: переключить',
      hint: 'читалка',
      kw: 'тёмный dark режим reader сайты',
      // Дословно toggleReader из BobliksSettings (~1287): flip префа +
      // content-override 1/2 (2 = светлые сайты, 1 = тёмные)
      fn: () => {
        const on = Services.prefs.getBoolPref('blade.reader.on', false);
        Services.prefs.setBoolPref('blade.reader.on', !on);
        Services.prefs.setIntPref('layout.css.prefers-color-scheme.content-override', on ? 2 : 1);
      },
    });
    register({
      id: 'blade-cmd-idle',
      label: 'Заставка простоя: вкл/выкл',
      hint: 'атмосфера',
      kw: 'заставка idle скринсейвер',
      fn: () => {
        const v = !Services.prefs.getBoolPref('blade.idle.on', true);
        Services.prefs.setBoolPref('blade.idle.on', v);
      },
    });
  }

  // ---- UI ------------------------------------------------------------------
  const PALETTE_CSS = `
    #blade-palette::part(content) {
      appearance: none; -moz-appearance: none;
      border: 1px solid color-mix(in srgb, var(--accent, #ff2a2a) 35%, transparent);
      border-radius: 12px;
      padding: 0;
      background: rgba(10, 10, 14, 0.97);
      box-shadow: 0 14px 50px rgba(0,0,0,0.85), 0 0 30px color-mix(in srgb, var(--accent, #ff2a2a) 18%, transparent);
      overflow: hidden;
      transition: border-color .15s ease, box-shadow .15s ease;
    }
    .blp-wrap {
      position: relative; /* якорь для ::before-приглашения ❯ у инпута */
      width: 560px;
      font-family: var(--blade-ui, 'Rubik', 'Segoe UI', sans-serif);
      color: #e9e9ee;
      border-radius: 12px;
      box-shadow: inset 0 0 0 1px transparent;
      transition: box-shadow .15s ease;
      animation: blp-in .12s ease-out;
    }
    /* A12: Пульс ввода в палитре (акцентный box-shadow на самом wrap в light DOM) */
    .blp-wrap.blp-typing {
      box-shadow: inset 0 0 0 1px var(--accent, #ff2a2a), inset 0 0 18px color-mix(in srgb, var(--accent, #ff2a2a) 30%, transparent), 0 0 24px color-mix(in srgb, var(--accent, #ff2a2a) 45%, transparent);
    }
    /* терминальный префикс-приглашение: чистый CSS-декор .blp-wrap,
       HTML-структуру из JS не трогаем; pointer-events — клики идут в инпут */
    .blp-wrap::before {
      content: '❯';
      position: absolute; left: 16px; top: 14px;
      font-family: var(--blade-mono, 'JetBrains Mono', 'Consolas', monospace);
      font-size: 15px; color: var(--accent, #ff2a2a);
      text-shadow: 0 0 8px color-mix(in srgb, var(--accent, #ff2a2a) 60%, transparent);
      pointer-events: none;
    }
    /* въезд панели — только transform/opacity, без reflow-свойств */
    @keyframes blp-in { from { opacity: 0; transform: translateY(-6px) scaleY(.98); } to { opacity: 1; transform: none; } }
    #blade-palette-input {
      display: block; box-sizing: border-box; width: 100%;
      padding: 14px 16px 10px 38px; /* 38 = 16 поля + ❯ + зазор до ввода */
      background: transparent; border: none; outline: none;
      color: #fff; caret-color: var(--accent, #ff2a2a);
      font-family: var(--blade-mono, 'JetBrains Mono', 'Consolas', monospace);
      font-size: 15px;
    }
    #blade-palette-input::placeholder { color: rgba(255,255,255,0.28); }
    .blp-list {
      max-height: 46vh; overflow-y: auto; padding: 0 6px 4px;
      /* едва заметная развёртка (статика, без анимации): 1px линия / 3px шаг */
      background: repeating-linear-gradient(to bottom,
        rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px,
        transparent 1px, transparent 3px);
      scrollbar-width: thin;
      scrollbar-color: color-mix(in srgb, var(--accent, #ff2a2a) 55%, transparent) transparent;
    }
    .blp-row {
      display: flex; align-items: center; gap: 12px;
      padding: 7px 10px; border-radius: 8px; cursor: pointer;
    }
    /* dotted-разделитель label↔hint без правки JS: ::before строки —
       полноценный flex-item, order 1 зажимает его между label (0) и hint (2) */
    .blp-row::before {
      content: ''; order: 1; flex: 1; min-width: 12px; align-self: center;
      border-bottom: 1px dotted rgba(255,255,255,0.12);
    }
    .blp-row.on {
      background: color-mix(in srgb, var(--accent, #ff2a2a) 18%, transparent);
      box-shadow: inset 2px 0 0 var(--accent, #ff2a2a); /* тонкая акцентная полоса, паттерн .bp-row:hover в BobliksSettings */
    }
    .blp-label {
      order: 0; font-size: 12.5px; color: #cfcfd8;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      transition: transform .1s ease;
    }
    .blp-row.on .blp-label { color: #fff; transform: translateX(2px); }
    .blp-hint {
      order: 2; flex: none; font-size: 10px; color: #6f6f7c;
      text-transform: uppercase; letter-spacing: 1px;
      font-family: var(--blade-mono, 'JetBrains Mono', 'Consolas', monospace);
    }
    .blp-row.on .blp-hint { color: rgba(255,255,255,0.75); }
    .blp-empty { padding: 14px 12px; font-size: 12px; color: #6f6f7c; font-family: var(--blade-mono, 'JetBrains Mono', 'Consolas', monospace); }
    .blp-foot {
      position: relative;
      padding: 8px 16px 10px; font-size: 9.5px; color: #9a9aa6; opacity: .5;
      font-family: var(--blade-mono, 'JetBrains Mono', 'Consolas', monospace);
      transition: opacity .15s ease;
    }
    .blp-wrap.blp-typing .blp-foot {
      opacity: .85;
    }
    .blp-foot::after {
      content: '●';
      position: absolute; right: 16px; top: 8px;
      font-size: 8px; color: var(--accent, #ff2a2a);
      opacity: 0;
      text-shadow: 0 0 6px var(--accent, #ff2a2a);
      transition: opacity .15s ease;
      pointer-events: none;
    }
    .blp-wrap.blp-typing .blp-foot::after {
      opacity: 1;
      animation: blp-cursor-blink .3s ease-in-out infinite alternate;
    }
    @keyframes blp-cursor-blink {
      from { opacity: .35; transform: scale(.8); }
      to   { opacity: 1;   transform: scale(1.2); }
    }
  `;

  let panel = null;   // лениво: DOM не грузим на старте браузера
  let inputEl = null;
  let listEl = null;
  let filtered = [];  // текущее отфильтрованное подмножество commands
  let selIdx = -1;

  // Панель строится при первом открытии (паттерн ensureUpdatePanel):
  // XUL panel в #mainPopupSet, XHTML-контент, id-гварды от повторного запуска
  function ensurePalette() {
    const doc = window.document;
    if (!doc.getElementById(STYLE_ID)) {
      const st = doc.createElementNS('http://www.w3.org/1999/xhtml', 'style');
      st.id = STYLE_ID;
      st.textContent = PALETTE_CSS;
      doc.documentElement.appendChild(st);
    }
    let p = doc.getElementById(PANEL_ID);
    if (p) { panel = p; return p; }
    const host = doc.getElementById('mainPopupSet') || doc.documentElement;
    p = host.appendChild(doc.createXULElement('panel'));
    p.id = PANEL_ID;
    const H = 'http://www.w3.org/1999/xhtml';
    const mk = (cls) => { const el = doc.createElementNS(H, 'div'); el.className = cls; return el; };
    const wrap = mk('blp-wrap');
    const inp = doc.createElementNS(H, 'input');
    inp.id = 'blade-palette-input';
    inp.setAttribute('type', 'text');
    inp.setAttribute('placeholder', 'Команда клинка…');
    const list = mk('blp-list');
    list.id = 'blade-palette-list';
    const foot = mk('blp-foot');
    foot.textContent = '↑↓ выбрать · Enter выполнить · Esc закрыть';
    wrap.append(inp, list, foot);
    p.appendChild(wrap);
    panel = p;
    inputEl = inp;
    listEl = list;

    p.addEventListener('popupshown', () => {
      try {
        refreshDynamicCommands();
        inputEl.value = '';
        renderList('');
        inputEl.focus();
      } catch (e) { mark('ERR shown ' + e); }
    });
    p.addEventListener('popuphidden', () => {
      try {
        inputEl.value = '';
        filtered = [];
        selIdx = -1;
        listEl.textContent = '';
        // A12: сброс пульса ввода при закрытии — класс и таймер не должны
        // пережить палитру (иначе открытая снова панель мигает «вводом»)
        wrap.classList.remove('blp-typing');
        clearTimeout(typingTimer);
      } catch (e) {}
    });
    inp.addEventListener('input', () => {
      try { renderList(inp.value); } catch (e) { mark('ERR input ' + e); }
    });
    inp.addEventListener('keydown', onKeydown);
    // A12 «Клинок Живёт»: живой отклик на ввод — класс на wrap, гаснет через 300мс
    let typingTimer = null;
    inp.addEventListener('input', () => {
      try {
        wrap.classList.add('blp-typing');
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => { try { wrap.classList.remove('blp-typing'); } catch (e) {} }, 300);
      } catch (e) {}
    });
    return p;
  }

  // Фильтр: case-insensitive вхождение в (label + ' ' + kw); пустой запрос =
  // все команды. Ранжирование: label начинается с запроса > просто содержит
  // (sort стабилен — исходный порядок внутри групп сохраняется).
  function renderList(query) {
    const q = String(query || '').trim().toLowerCase();
    let items;
    if (!q) {
      items = commands.slice();
    } else {
      items = [];
      for (const c of commands) {
        if ((c.label + ' ' + c.kw).toLowerCase().includes(q)) items.push(c);
      }
      const rank = (c) => (c.label.toLowerCase().startsWith(q) ? 0 : 1);
      items.sort((a, b) => rank(a) - rank(b));
    }
    filtered = items.slice(0, MAX_ROWS);
    selIdx = filtered.length ? 0 : -1;

    const doc = window.document;
    const H = 'http://www.w3.org/1999/xhtml';
    listEl.textContent = '';
    filtered.forEach((c, i) => {
      const row = doc.createElementNS(H, 'div');
      row.className = 'blp-row';
      const lab = doc.createElementNS(H, 'div');
      lab.className = 'blp-label';
      lab.textContent = c.label;
      const hint = doc.createElementNS(H, 'div');
      hint.className = 'blp-hint';
      hint.textContent = c.hint || '';
      row.append(lab, hint);
      row.addEventListener('mouseenter', () => { try { setSel(i); } catch (e) {} });
      row.addEventListener('click', () => { try { execIdx(i); } catch (e) { mark('ERR click ' + e); } });
      listEl.appendChild(row);
    });
    if (!filtered.length) {
      const empty = doc.createElementNS(H, 'div');
      empty.className = 'blp-empty';
      empty.textContent = q ? '— нет таких команд —' : '— команд нет —';
      listEl.appendChild(empty);
      return;
    }
    setSel(0);
  }

  function setSel(i) {
    selIdx = i;
    const rows = listEl.children;
    for (let r = 0; r < rows.length; r++) {
      rows[r].classList.toggle('on', r === i);
    }
    const el = rows[i];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }

  function onKeydown(e) {
    try {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filtered.length) setSel((selIdx + 1) % filtered.length); // wrap-around
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        // при пустом списке не двигаемся и не падаем на -1
        if (filtered.length) setSel((selIdx - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selIdx >= 0 && selIdx < filtered.length) execIdx(selIdx);
      }
      // Escape НЕ превентим: panel закрывает себя по Esc сам
    } catch (err) { mark('ERR keydown ' + err); }
  }

  // Выполнение: ошибка команды не должна оставлять палитру висеть —
  // закрываем всегда, сбой логируем в mark и консоль
  function execIdx(i) {
    const c = filtered[i];
    if (!c) return;
    try { c.fn(); }
    catch (e) {
      console.error('Blade palette [' + c.id + ']', e);
      mark('ERR cmd ' + c.id + ' ' + e);
    }
    close();
  }

  function open() {
    try {
      const p = ensurePalette();
      const w = window;
      const x = w.screenX + Math.round((w.outerWidth - PALETTE_W) / 2);
      const y = w.screenY + Math.round(w.outerHeight * 0.16);
      p.openPopupAtScreen(x, y, false);
    } catch (e) { mark('ERR open ' + e); }
  }

  function close() {
    try {
      if (panel && panel.state !== 'closed') panel.hidePopup();
    } catch (e) {}
  }

  // ---- Ctrl+K: настоящий <key> в mainKeyset (паттерн mkKey BobliksSettings,
  // ---- срабатывает при любом фокусе) перекрывает дефолтный фокус поиска ----
  try {
    const doc = window.document;
    const keyset = doc.getElementById('mainKeyset');
    if (keyset && !doc.getElementById(KEY_ID)) {
      const k = doc.createXULElement('key');
      k.setAttribute('id', KEY_ID);
      k.setAttribute('keycode', 'VK_K'); // виртуальная клавиша, не символ
      k.setAttribute('modifiers', 'accel');
      k.addEventListener('command', () => {
        try {
          const p = doc.getElementById(PANEL_ID);
          if (p && p.state !== 'closed') p.hidePopup(); // toggle: открыта → закрыть
          else open();
        } catch (e) { mark('ERR toggle ' + e); }
      });
      keyset.appendChild(k);
    }
  } catch (e) { mark('ERR key ' + e); }

  // ---- Публичный API -------------------------------------------------------
  // Будущие модули: регистрируйте свои команды через
  //   window.BladePalette.register({ id: 'my-...', label: '...', hint: '...',
  //                                  kw: '...', fn: () => {...} });
  // id уникален (дубли игнорируются), команды видны в палитре сразу.
  window.BladePalette = { register, open, close };

  registerStatic();
  refreshDynamicCommands(); // на старте может быть пусто (см. комментарий выше)
  mark('START');
})();
