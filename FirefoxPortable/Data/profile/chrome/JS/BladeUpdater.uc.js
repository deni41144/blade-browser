// ==UserScript==
// @name            Blade Updater
// @description     Автопроверка и установка обновлений Blade с GitHub (приватный репо, в один клик)
// @author          Bobliks-Creations
// @include         main
// @version         1.3.9
// @ignorecache
// ==/UserScript==
(function () {
  if (window.BladeUpdater) return;
  const MODULE_VERSION = '1.3.9';
  const REGISTRATION_SCHEMA = 2;
  const REGISTRATION_SESSION = '__bladeUpdaterRegistrationSchema2';

  // ---- Конфиг по умолчанию; префы blade.update.* переопределяют без правки
  // ---- скрипта.
  const DEFAULT_REPO = 'deni41144/blade-browser';
  // Токен в код НЕ вшивается (секрет в клиенте = утечка). Репо публичный —
  // запросы идут анонимно; приватный — задай токен префом blade.update.token
  // или направь запросы через свой шлюз префом blade.update.apiBase.
  const API_DEFAULT = 'https://api.github.com';

  const PREF = {
    repo:      'blade.update.repo',
    token:     'blade.update.token',
    apiBase:   'blade.update.apiBase',
    auto:      'blade.update.auto',
    lastCheck: 'blade.update.lastCheck',
    avail:     'blade.update.availableVersion',
    registrationSchema: 'blade.registration.schema',
  };

  // Лог по конвенции проекта (как у остальных uc.js)
  let markPath = '';
  try {
    const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
    d.append('JS');
    markPath = d.path + '\\update_mark.txt';
  } catch (e) {}
  const mark = (m, e) => {
    try {
      if (!markPath) return;
      const text = 'v' + MODULE_VERSION + ' ' + m + (e ? '\n' + String(e) + '\n' + (e && e.stack || '') : '');
      IOUtils.writeUTF8(markPath, text).catch(() => {});
    } catch (e2) {}
  };

  const prefStr = (p, dflt) => {
    try { return Services.prefs.getStringPref(p, '') || dflt; } catch (e) { return dflt; }
  };
  const repo    = () => prefStr(PREF.repo, DEFAULT_REPO);
  const token   = () => prefStr(PREF.token, '');
  const apiBase = () => prefStr(PREF.apiBase, API_DEFAULT);

  let localVersion = '';
  let localCodename = '';
  let remoteInfo = null;   // { version, assetId, assetName, size, isFull, codename, notes }
  let downloading = false;
  let abortCtl = null;
  let panelVisible = false; // панель #blade-update-panel сейчас открыта

  // Версия сборки из chrome\VERSION (тот же источник, что у меню B)
  (async () => {
    try {
      const vd = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      vd.append('VERSION');
      localVersion = (await IOUtils.readUTF8(vd.path)).trim();
    } catch (e) { mark('ERR readVersion ' + e); }
  })();

  // Кодовое имя релиза из chrome\CODENAME — после автообновления аплайер
  // кладёт туда файл нового релиза, панель-хроника читает его при старте
  async function readLocalCodename() {
    try {
      const cd = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      cd.append('CODENAME');
      localCodename = (await IOUtils.readUTF8(cd.path)).trim();
    } catch (e) {}
    return localCodename;
  }
  readLocalCodename();

  function compareVersions(a, b) {
    const pa = String(a || '').split('.');
    const pb = String(b || '').split('.');
    const n = Math.max(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
      const xa = parseInt(pa[i], 10) || 0;
      const xb = parseInt(pb[i], 10) || 0;
      if (xa < xb) return -1;
      if (xa > xb) return 1;
    }
    return 0;
  }

  function availableVersion() {
    const av = Services.prefs.getStringPref(PREF.avail, '');
    return (av && localVersion && compareVersions(av, localVersion) > 0) ? av : null;
  }

  function ghHeaders(extra) {
    const h = { Accept: 'application/vnd.github+json' };
    if (token()) h.Authorization = 'Bearer ' + token();
    return Object.assign(h, extra || {});
  }

  // ---- Уведомления (паттерн fx-autoconfig showNotification — FF155-сигнатура) ----
  function notify(label, buttons, type) {
    try {
      const nb = window.gNotificationBox;
      if (!nb) return null;
      return nb.appendNotification(
        type || 'blade-update-notification',
        {
          label,
          image: 'chrome://browser/skin/notification-icons/popup.svg',
          priority: nb.PRIORITY_INFO_HIGH,
        },
        buttons || [],
        false
      );
    } catch (e) { mark('ERR notify ' + e); return null; }
  }
  const notifyError = (msg) => notify('Blade: ' + msg, null, 'blade-update-error');

  function setNotifLabel(n, text) {
    if (!n) return;
    try { n.label = text; } catch (e) {}
    try { n.message = text; } catch (e) {}
  }

  // ---- Единая панель обновлений Blade ----
  const PANEL_ID = 'blade-update-panel';
  const PANEL_CSS = `
    #blade-update-panel::part(content) {
      appearance: none; -moz-appearance: none;
      border: 1px solid color-mix(in srgb, var(--accent, #d7192d) 56%, #44333a);
      border-radius: 18px;
      padding: 0;
      background: linear-gradient(155deg, #21171d 0%, #151116 52%, #0c0b0f 100%);
      box-shadow: 0 20px 54px rgba(0,0,0,.62), 0 0 34px color-mix(in srgb, var(--accent, #d7192d) 16%, transparent);
      overflow: hidden;
    }
    .bu-wrap { box-sizing: border-box; width: min(420px, 90vw); padding: 16px 17px 15px; font-family: var(--blade-ui, 'Rubik', 'Segoe UI', sans-serif); color: #f4eef0; animation: bu-in .18s ease-out; }
    @keyframes bu-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
    .bu-head { display: flex; align-items: center; gap: 10px; }
    .bu-mark { flex: none; display: grid; place-items: center; width: 36px; height: 36px; border: 1px solid color-mix(in srgb, var(--accent, #d7192d) 48%, transparent); border-radius: 11px; background: linear-gradient(145deg, color-mix(in srgb, var(--accent, #d7192d) 24%, #24191e), #100d11); color: var(--accent, #e52539); font-family: var(--blade-display, 'Unbounded', sans-serif); font-size: 20px; font-weight: 900; box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 5px 18px rgba(0,0,0,.2); }
    .bu-brand { flex: 1; min-width: 0; }
    .bu-title { color: #fff; font-family: var(--blade-display, 'Unbounded', sans-serif); font-size: 12px; font-weight: 800; letter-spacing: 1.8px; }
    .bu-kicker { margin-top: 3px; color: #9e8e95; font-size: 9px; font-weight: 700; letter-spacing: 1.3px; text-transform: uppercase; }
    .bu-pill { flex: none; padding: 5px 9px; border: 1px solid color-mix(in srgb, var(--accent, #d7192d) 48%, #38252c); border-radius: 999px; background: color-mix(in srgb, var(--accent, #d7192d) 12%, #171116); color: #ff6674; font-family: var(--blade-mono, 'JetBrains Mono', monospace); font-size: 10px; font-weight: 800; }
    .bu-divider { height: 1px; margin: 14px 0 13px; background: linear-gradient(90deg, color-mix(in srgb, var(--accent, #d7192d) 54%, transparent), rgba(255,255,255,.07) 54%, transparent); }
    .bu-legend { color: #fff; font-size: 18px; font-weight: 750; line-height: 1.35; overflow-wrap: anywhere; }
    .bu-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; color: #c0adb3; font-size: 10px; font-weight: 650; }
    .bu-meta-chip { padding: 4px 7px; border: 1px solid rgba(255,255,255,.08); border-radius: 7px; background: rgba(255,255,255,.035); }
    .bu-body { box-sizing: border-box; max-height: 34vh; overflow-y: auto; margin-top: 13px; padding: 12px 12px 10px; border: 1px solid rgba(255,255,255,.075); border-radius: 11px; background: rgba(8,7,10,.42); color: #d9cfd2; font-size: 12px; line-height: 1.55; scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--accent, #d7192d) 46%, transparent) transparent; }
    .bu-notes:empty { display: none; }
    .bu-note-heading { margin: 0 0 7px; color: #fff; font-size: 12px; font-weight: 750; }
    .bu-note-paragraph { margin: 0 0 7px; }
    .bu-note-list { margin: 0 0 8px; padding-inline-start: 19px; }
    .bu-note-list li { padding-inline-start: 2px; margin: 2px 0; }
    .bu-note-list li::marker { color: var(--accent, #e52539); }
    .bu-status { margin-top: 13px; min-height: 16px; color: #b5a5aa; font-size: 10.5px; line-height: 1.4; }
    .bu-progress { padding-top: 7px; }
    .bu-progress[hidden] { display: none; }
    .bu-track { height: 7px; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.09); }
    .bu-bar { width: 100%; height: 100%; border-radius: inherit; background: linear-gradient(90deg, color-mix(in srgb, var(--accent, #d7192d) 78%, #a4081c), #ff5968); transform: scaleX(0); transform-origin: left center; transition: transform .16s ease-out; box-shadow: 0 0 12px color-mix(in srgb, var(--accent, #d7192d) 52%, transparent); }
    .bu-bar.is-indeterminate { width: 34%; transform: translateX(-110%); animation: bu-progress 1.15s ease-in-out infinite; }
    @keyframes bu-progress { to { transform: translateX(330%); } }
    .bu-progress-meta { display: flex; justify-content: space-between; gap: 10px; margin-top: 6px; color: #95858b; font-family: var(--blade-mono, 'JetBrains Mono', monospace); font-size: 10px; }
    .bu-pct { color: #f05b68; font-weight: 800; }
    .bu-actions { display: flex; gap: 9px; margin-top: 15px; }
    .bu-btn { appearance: none; flex: 1; min-height: 38px; padding: 8px 12px; border: 1px solid transparent; border-radius: 9px; cursor: pointer; font-family: var(--blade-ui, 'Rubik', sans-serif); font-size: 11.5px; font-weight: 750; transition: background .14s ease, border-color .14s ease, color .14s ease, transform .14s ease; }
    .bu-btn:active { transform: translateY(1px); }
    .bu-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
    .bu-btn:disabled { cursor: default; opacity: .55; }
    .bu-accept { border-color: color-mix(in srgb, var(--accent, #d7192d) 72%, #5b202a); background: linear-gradient(135deg, color-mix(in srgb, var(--accent, #d7192d) 90%, #a40920), #8f1322); color: #fff; box-shadow: 0 5px 16px color-mix(in srgb, var(--accent, #d7192d) 20%, transparent); }
    .bu-accept:hover:not(:disabled) { border-color: #ff8791; background: linear-gradient(135deg, #e52a3b, #a81326); }
    .bu-ghost { border-color: rgba(255,255,255,.12); background: rgba(255,255,255,.035); color: #c1b3b8; }
    .bu-ghost:hover:not(:disabled) { border-color: rgba(255,255,255,.26); background: rgba(255,255,255,.075); color: #fff; }
    @media (prefers-reduced-motion: reduce) { .bu-wrap { animation: none; } .bu-btn, .bu-bar { transition: none; } .bu-bar.is-indeterminate { animation: none; transform: none; } }
  `;

  // Якорь панели: кнопка меню B -> часы Blade -> нет (фолбэк на stock notify)
  function panelAnchor() {
    const doc = window.document;
    return doc.getElementById('bobliks-settings-button') || doc.getElementById('blade-clock-widget');
  }

  // Якорь «лёг в layout»: кнопка, ушедшая в оверфлоу или ещё не построенная,
  // даёт нулевой rect — openPopup по такому якорю сажает панель на тулбар.
  function anchorLaidOut(a) {
    try {
      const r = a.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    } catch (e) { return false; }
  }

  // На старте скрипт исполняется на DOMContentLoaded: якорь может ещё не
  // существовать. Ждём его геометрию (≤5 сек), иначе фолбэк на stock notify.
  async function waitAnchorReady() {
    for (let i = 0; i < 20; i++) {
      const a = panelAnchor();
      if (a && anchorLaidOut(a)) return a;
      await new Promise(res => setTimeout(res, 250));
    }
    const a = panelAnchor();
    return (a && anchorLaidOut(a)) ? a : null;
  }

  // Меню B сидит на том же якоре: не закрыв его, панель обновления лезет
  // прямо поверх меню. Закрываем меню, попап открываем через тик — rollup
  // закрываемого меню прибивает панель, открытую в том же тике.
  function openPanelNearAnchor(panel, anchor) {
    const open = () => {
      try {
        // y=8: after_start даёт нулевой зазор — заголовок панели со свечением
        // клеится к иконке Blade; небольшой отступ опускает чейнджлог ниже
        panel.openPopup(anchor, 'after_start', 0, 8, false, false);
        panelVisible = true;
      } catch (e) { mark('ERR openPanel ' + e); }
    };
    const menuB = anchor.ownerDocument.getElementById('bobliks-settings-popup');
    if (menuB && menuB.state !== 'closed') {
      try { menuB.hidePopup(); } catch (e) {}
      setTimeout(open, 80);
    } else {
      open();
    }
  }

  function ensureUpdatePanel() {
    const doc = window.document;
    if (!doc.getElementById('blade-update-panel-style')) {
      const st = doc.createElementNS('http://www.w3.org/1999/xhtml', 'style');
      st.id = 'blade-update-panel-style';
      st.textContent = PANEL_CSS;
      doc.documentElement.appendChild(st);
    }
    let panel = doc.getElementById(PANEL_ID);
    if (panel) return panel;
    const host = doc.getElementById('mainPopupSet') || doc.documentElement;
    panel = host.appendChild(doc.createXULElement('panel'));
    panel.id = PANEL_ID;
    panel.setAttribute('aria-label', 'Обновление Blade');
    panel.addEventListener('popuphidden', () => { panelVisible = false; });
    const H = 'http://www.w3.org/1999/xhtml';
    const mk = (tag, cls) => { const el = doc.createElementNS(H, tag); if (cls) el.className = cls; return el; };
    const wrap = mk('div', 'bu-wrap');
    const head = mk('div', 'bu-head');
    const mark = mk('span', 'bu-mark'); mark.textContent = 'B';
    const brand = mk('div', 'bu-brand');
    const title = mk('div', 'bu-title'); title.textContent = 'BLADE';
    const kicker = mk('div', 'bu-kicker'); kicker.textContent = 'BROWSER UPDATE';
    brand.append(title, kicker);
    const pill = mk('span', 'bu-pill');
    head.append(mark, brand, pill);
    const divider = mk('div', 'bu-divider');
    const legend = mk('div', 'bu-legend');
    const meta = mk('div', 'bu-meta');
    const body = mk('div', 'bu-body');
    body.hidden = true;
    const status = mk('div', 'bu-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const progress = mk('div', 'bu-progress');
    progress.hidden = true;
    const track = mk('div', 'bu-track');
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-label', 'Загрузка обновления');
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');
    const bar = mk('div', 'bu-bar');
    const progressMeta = mk('div', 'bu-progress-meta');
    const bytes = mk('span', 'bu-bytes');
    const pct = mk('span', 'bu-pct');
    track.appendChild(bar);
    progressMeta.append(bytes, pct);
    progress.append(track, progressMeta);
    const actions = mk('div', 'bu-actions');
    wrap.append(head, divider, legend, meta, body, status, progress, actions);
    panel.appendChild(wrap);
    return panel;
  }

  function fillPanel(panel, o) {
    const q = (cls) => panel.querySelector(cls);
    const title = q('.bu-title'); if (title) title.textContent = o.title;
    const pill = q('.bu-pill'); if (pill) pill.textContent = o.pill || '';
    const legend = q('.bu-legend'); if (legend) legend.textContent = o.legend || '';
    const meta = q('.bu-meta');
    if (meta) {
      meta.textContent = '';
      for (const item of (Array.isArray(o.meta) ? o.meta : (o.meta ? [o.meta] : []))) {
        const chip = panel.ownerDocument.createElementNS('http://www.w3.org/1999/xhtml', 'span');
        chip.className = 'bu-meta-chip';
        chip.textContent = item;
        meta.appendChild(chip);
      }
    }
    const body = q('.bu-body');
    if (body) {
      body.hidden = !o.body;
      if (o.notes) renderReleaseNotes(body, o.body || '');
      else { body.textContent = o.body || ''; body.classList.remove('bu-notes'); }
    }
    const status = q('.bu-status');
    if (status) status.textContent = o.status || '';
    const progress = q('.bu-progress');
    if (progress) {
      progress.hidden = !o.progress;
      if (o.progress) updatePanelProgress(panel, 0, 0, o.status || 'Подготовка обновления');
    }
  }

  function renderReleaseNotes(target, source) {
    target.textContent = '';
    target.classList.add('bu-notes');
    const lines = String(source || '').replace(/\r\n?/g, '\n').slice(0, 5000).split('\n');
    let paragraph = [];
    let list = null;
    let code = false;
    let codeLines = [];
    const flushParagraph = () => {
      if (!paragraph.length) return;
      const p = target.ownerDocument.createElementNS('http://www.w3.org/1999/xhtml', 'p');
      p.className = 'bu-note-paragraph';
      p.textContent = paragraph.join(' ');
      target.appendChild(p);
      paragraph = [];
    };
    const closeList = () => { list = null; };
    const closeCode = () => {
      if (!codeLines.length) return;
      const pre = target.ownerDocument.createElementNS('http://www.w3.org/1999/xhtml', 'pre');
      pre.className = 'bu-note-paragraph';
      pre.textContent = codeLines.join('\n');
      target.appendChild(pre);
      codeLines = [];
    };
    for (const raw of lines) {
      const line = raw.trim();
      if (/^```/.test(line)) {
        flushParagraph(); closeList();
        if (code) closeCode();
        code = !code;
        continue;
      }
      if (code) { codeLines.push(raw); continue; }
      if (!line) { flushParagraph(); closeList(); continue; }
      const heading = /^(#{1,3})\s+(.+)$/.exec(line);
      if (heading) {
        flushParagraph(); closeList();
        const h = target.ownerDocument.createElementNS('http://www.w3.org/1999/xhtml', 'div');
        h.className = 'bu-note-heading';
        h.textContent = cleanNoteLine(heading[2]);
        target.appendChild(h);
        continue;
      }
      const bullet = /^(?:[-*+]\s+)(.+)$/.exec(line);
      const ordered = /^\d+[.)]\s+(.+)$/.exec(line);
      if (bullet || ordered) {
        flushParagraph();
        const kind = ordered ? 'ol' : 'ul';
        if (!list || list.localName !== kind) {
          closeList();
          list = target.ownerDocument.createElementNS('http://www.w3.org/1999/xhtml', kind);
          list.className = 'bu-note-list';
          target.appendChild(list);
        }
        const li = target.ownerDocument.createElementNS('http://www.w3.org/1999/xhtml', 'li');
        li.textContent = cleanNoteLine(bullet ? bullet[1] : ordered[1]);
        list.appendChild(li);
        continue;
      }
      closeList();
      paragraph.push(cleanNoteLine(line));
    }
    flushParagraph();
    closeCode();
  }

  function formatBytes(bytes) {
    const mb = Math.max(0, bytes) / 1048576;
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: mb < 10 ? 1 : 0 }).format(mb) + ' МБ';
  }

  function cleanNoteLine(line) {
    return String(line || '').replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\*\*(.*?)\*\*/g, '$1').replace(/__(.*?)__/g, '$1')
      .replace(/`([^`]+)`/g, '$1').replace(/^>\s?/, '');
  }

  function updatePanelProgress(panel, done, total, stage) {
    const track = panel.querySelector('.bu-track');
    const bar = panel.querySelector('.bu-bar');
    const bytes = panel.querySelector('.bu-bytes');
    const pct = panel.querySelector('.bu-pct');
    const status = panel.querySelector('.bu-status');
    if (!track || !bar) return;
    const known = Number.isFinite(total) && total > 0;
    const percent = known ? Math.max(0, Math.min(100, Math.round(done * 100 / total))) : null;
    if (known) {
      bar.classList.remove('is-indeterminate');
      bar.style.transform = 'scaleX(' + (percent / 100) + ')';
      track.setAttribute('aria-valuenow', String(percent));
      track.setAttribute('aria-valuetext', `${percent}% · ${formatBytes(done)} из ${formatBytes(total)}`);
      if (pct) pct.textContent = percent + '%';
      if (bytes) bytes.textContent = `${formatBytes(done)} / ${formatBytes(total)}`;
    } else {
      bar.classList.add('is-indeterminate');
      bar.style.transform = '';
      track.removeAttribute('aria-valuenow');
      track.setAttribute('aria-valuetext', `${stage || 'Скачивание'} · ${formatBytes(done)}`);
      if (pct) pct.textContent = formatBytes(done);
      if (bytes) bytes.textContent = 'Размер уточняется';
    }
    if (status) status.textContent = stage || 'Скачивание обновления';
  }

  function setPanelActions(panel, defs) {
    const actions = panel.querySelector('.bu-actions');
    if (!actions) return;
    actions.textContent = '';
    const doc = panel.ownerDocument;
    for (const d of defs) {
      const b = doc.createElementNS('http://www.w3.org/1999/xhtml', 'button');
      b.type = 'button';
      b.className = 'bu-btn ' + d.cls;
      b.textContent = d.label;
      b.setAttribute('aria-label', d.label);
      b.disabled = !!d.disabled;
      b.addEventListener('click', d.fn);
      actions.appendChild(b);
    }
  }

  // ---- Режимы панели ----
  function showUpdatePanel() {
    try {
      const anchor = panelAnchor();
      if (!anchor || !anchorLaidOut(anchor)) return false;
      const info = remoteInfo;
      if (!info) return false;
      const panel = ensureUpdatePanel();
      const sizeMB = Math.max(1, Math.round(info.size / 1048576));
      const chapter = info.codename || 'Blade';
      fillPanel(panel, {
        title: 'BLADE // UPDATE',
        pill: chapter,
        legend: 'Готово к установке',
        meta: [sizeMB + ' МБ', info.isFull ? 'Полный пакет' : 'Лёгкий патч'],
        body: info.notes || '',
        notes: true,
        status: 'Что нового в этой версии',
        progress: false,
      });
      setPanelActions(panel, [
        // Панель не закрываем: startInstall переключит её в режим прогресса
        { cls: 'bu-accept', label: 'Скачать и обновить', fn: () => { startInstall(); } },
        { cls: 'bu-ghost', label: 'Позже', fn: () => { try { panel.hidePopup(); } catch (e) {} } },
      ]);
      openPanelNearAnchor(panel, anchor);
      return true;
    } catch (e) { mark('ERR updPanel ' + e); return false; }
  }

  function enterProgressMode(panel) {
    try {
      const info = remoteInfo;
      const chapter = info ? (info.codename || 'Blade') : '';
      fillPanel(panel, {
        title: 'BLADE // UPDATE',
        pill: chapter,
        legend: 'Подготовка обновления',
        meta: info ? [info.isFull ? 'Полный пакет' : 'Лёгкий патч', 'После установки браузер перезапустится'] : [],
        body: info && info.notes ? info.notes : '',
        notes: true,
        status: 'Подключаемся к серверу…',
        progress: true,
      });
      // «Принять»/«Позже» блокируются: остаётся только отмена
      setPanelActions(panel, [
        { cls: 'bu-ghost', label: 'Отмена', fn: () => { try { if (abortCtl) abortCtl.abort(); } catch (e) {} } },
      ]);
    } catch (e) { mark('ERR progMode ' + e); }
  }

  async function showChroniclePanel() {
    try {
      const anchor = await waitAnchorReady();
      if (!anchor) return false;
      const panel = ensureUpdatePanel();
      const chronicle = await readChronicle();
      const codename = localCodename || await readLocalCodename();
      fillPanel(panel, {
        title: 'BLADE // READY',
        pill: codename || 'BLADE',
        legend: 'Обновление установлено' + (codename ? ' · ' + codename : ''),
        meta: ['Хроника изменений'],
        body: chronicle || 'Обновление применено. С возвращением.',
        notes: true,
        status: 'Blade запущен на актуальной версии',
        progress: false,
      });
      setPanelActions(panel, [
        { cls: 'bu-accept', label: 'Закрыть', fn: () => { try { panel.hidePopup(); } catch (e) {} } },
      ]);
      openPanelNearAnchor(panel, anchor);
      return true;
    } catch (e) { mark('ERR chronPanel ' + e); return false; }
  }

  // Хроника релиза: chrome\JS\update_chronicle.txt кладёт Build-Blade-Patch,
  // после применения патча он оказывается в живой установке. BOM срезаем,
  // как у update_result.txt.
  async function readChronicle() {
    try {
      const p = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      p.append('JS');
      p.append('update_chronicle.txt');
      return (await IOUtils.readUTF8(p.path)).replace(/^\uFEFF/, '').trim();
    } catch (e) { return ''; }
  }

  // Поддерживает старые названия с версией и новые названия-главы.
  function parseCodename(name) {
    const title = String(name || '').trim();
    const current = /^Blade\s*[—–-]\s*(.+)$/i.exec(title);
    if (current) return current[1].trim();
    const legacy = /^Blade\s+v[\d.]+\s*[—–-]\s*(.+)$/i.exec(title);
    return legacy ? legacy[1].trim() : '';
  }

  // Нормализуем GitHub Markdown; при отображении заметки строятся DOM-узлами,
  // поэтому release notes никогда не интерпретируются как HTML.
  function cleanNotes(src) {
    let t = String(src || '').replace(/\r\n?/g, '\n').trim();
    if (t.length > 5000) t = t.slice(0, 5000).trim() + '\n…';
    return t;
  }

  // ---- Проверка релиза ----
  async function checkForUpdate(manual) {
    if (downloading) return;
    const r = repo();
    if (!r) {
      if (manual) notifyError('репозиторий обновлений не настроен');
      return;
    }
    try {
      let tokenHealed = false;
      let resp = await fetch(apiBase() + '/repos/' + r + '/releases/latest', {
        headers: ghHeaders(),
        signal: AbortSignal.timeout(15000),
      });
      // Самолечение: 401 при выставленном токене = токен протух (например,
      // остался с приватного периода репо). Чистим преф и повторяем анонимно —
      // репо публичный, анонимного доступа достаточно. Однократно: после
      // очистки префа token() пуст и ветка больше не срабатывает.
      if (resp.status === 401 && token()) {
        try { Services.prefs.clearUserPref(PREF.token); } catch (e2) {}
        tokenHealed = true;
        mark('token 401 — преф очищен, повтор анонимно');
        resp = await fetch(apiBase() + '/repos/' + r + '/releases/latest', {
          headers: ghHeaders(),
          signal: AbortSignal.timeout(15000),
        });
      }
      if (resp.status === 401) throw new Error('токен доступа недействителен (401)');
      if (resp.status === 404) throw new Error('релизов нет или нет доступа (404)');
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const rel = await resp.json();
      const tag = String(rel.tag_name || '').replace(/^v/i, '').trim();
      const assets = Array.isArray(rel.assets) ? rel.assets : [];
      const zips = assets.filter(a => Number.isInteger(a.id) && /\.zip$/i.test(a.name || ''));
      const asset = zips.find(a => /patch/i.test(a.name || '')) ||
        zips.find(a => /full/i.test(a.name || '')) || zips[0];
      const checksum = asset && assets.find(a => Number.isInteger(a.id) &&
        String(a.name || '').toLowerCase() === (asset.name + '.sha256').toLowerCase());
      if (!/^\d+(\.\d+){0,3}$/.test(tag) || !asset || !checksum || !Number.isFinite(asset.size) || asset.size <= 0) {
        throw new Error('в релизе нет подходящего ZIP и SHA-256');
      }
      remoteInfo = {
        version: tag,
        assetId: asset.id,
        assetName: asset.name,
        size: asset.size || 0,
        checksumAssetId: checksum.id,
        isFull: /full/i.test(asset.name || ''),
        codename: parseCodename(rel.name),
        notes: cleanNotes(rel.body),
      };
      // Ставим суточный интервал только после проверки JSON, версии и пары ZIP/SHA.
      Services.prefs.setIntPref(PREF.lastCheck, Math.floor(Date.now() / 1000));
      Services.prefs.setStringPref(PREF.avail, tag);
      mark('remote v' + tag + ' local v' + localVersion + ' asset ' + asset.name);
      if (compareVersions(tag, localVersion) > 0) {
        showUpdateNotification();
      } else if (manual || tokenHealed) {
        notify('⚡ Blade актуален' +
               (tokenHealed ? ' — старый токен обновлений очищен, дальше анонимно' : ''));
      }
    } catch (e) {
      mark('ERR check ' + e);
      if (manual) notifyError('не удалось проверить обновления — ' + (e.message || e));
    }
  }

  function showUpdateNotification() {
    const info = remoteInfo;
    if (!info) return;
    // Основной путь: кастомная панель у якоря (кнопка B / часы)
    if (showUpdatePanel()) return;
    // Фолбэк: якоря нет — стоковая нотификация
    const sizeMB = Math.max(1, Math.round(info.size / 1048576));
    const kind = info.isFull ? 'полный пакет' : 'лёгкий патч';
    notify('⚡ Доступно обновление «' + (info.codename || 'Blade') + '» · ' + sizeMB + ' МБ · ' + kind, [
      {
        label: 'Обновить сейчас',
        callback: () => { startInstall(); return false; },
      },
      {
        label: 'Позже',
        callback: () => false,
      },
    ]);
  }

  // ---- Скачивание: стрим чанками на диск (200 МБ не грузим в память) ----
  async function downloadAsset(destPath, assetId, onProgress, controller) {
    const url = apiBase() + '/repos/' + repo() + '/releases/assets/' + assetId;
    let bos = null, fos = null, reader = null, done = 0, firstChunk = true, completed = false;
    try {
      let resp = await fetch(url, {
        headers: ghHeaders({ Accept: 'application/octet-stream' }),
        signal: controller.signal,
      });
      if (resp.status === 401 && token()) {
        try { Services.prefs.clearUserPref(PREF.token); } catch (e) {}
        mark('token 401 (asset) — преф очищен, повтор анонимно');
        resp = await fetch(url, {
          headers: ghHeaders({ Accept: 'application/octet-stream' }),
          signal: controller.signal,
        });
      }
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      if (!resp.body) throw new Error('сервер не передал поток файла');
      const total = parseInt(resp.headers.get('content-length') || '0', 10) || 0;

      // Пишем по частям на диск, не загружая архив целиком в оперативную память.
      try {
        const file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
        file.initWithPath(destPath);
        fos = Cc['@mozilla.org/network/file-output-stream;1'].createInstance(Ci.nsIFileOutputStream);
        fos.init(file, 0x02 | 0x08 | 0x20, 0o600, 0);
        const BOS = '@mozilla.org/binaryoutputstream;1';
        if (Cc[BOS]) {
          bos = Cc[BOS].createInstance(Ci.nsIBinaryOutputStream);
          bos.setOutputStream(fos);
        } else {
          fos.close();
          fos = null;
          mark('WARN no binaryoutputstream — IOUtils fallback');
        }
      } catch (e) {
        try { if (fos) fos.close(); } catch (closeError) {}
        bos = null;
        fos = null;
        mark('WARN stream fallback ' + e);
      }

      reader = resp.body.getReader();
      for (;;) {
        if (controller.signal.aborted) throw new DOMException('Скачивание отменено', 'AbortError');
        const { value, done: finished } = await reader.read();
        if (finished) break;
        if (bos) bos.writeByteArray(value, value.length);
        else {
          await IOUtils.write(destPath, value, { mode: firstChunk ? 'overwrite' : 'append' });
          firstChunk = false;
        }
        done += value.length;
        if (onProgress) onProgress(done, total);
      }
      if (total && done !== total) throw new Error('архив скачан не полностью');
      if (!done) throw new Error('пустой ответ сервера');
      completed = true;
      return done;
    } catch (e) {
      try { await IOUtils.remove(destPath, { ignoreAbsent: true }); } catch (cleanupError) {}
      throw e;
    } finally {
      try { if (reader) await reader.cancel(); } catch (e) {}
      try { if (bos) bos.close(); else if (fos) fos.close(); } catch (e) {}
      if (!completed) abortCtl = null;
    }
  }

  // ---- Запуск аплайера (локальный ps1; из сети код не исполняется) ----
  function fileExists(p) {
    try {
      const f = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
      f.initWithPath(p);
      return f.exists();
    } catch (e) { return false; }
  }

  // Корень установки: поднимаемся от папки firefox.exe вверх, пока не найдём
  // движок (App\Blade или App\Firefox64). CurProcD может прийти с хвостовым
  // слешем — фиксированное число parent() промахивается, маркер надёжнее.
  function findBladeRoot() {
    let dir = Services.dirsvc.get('CurProcD', Ci.nsIFile).path.replace(/[\\/]+$/, '');
    for (let i = 0; i < 4; i++) {
      if (fileExists(PathUtils.join(dir, 'App', 'Blade', 'firefox.exe')) ||
          fileExists(PathUtils.join(dir, 'App', 'Firefox64', 'firefox.exe'))) {
        return dir;
      }
      const parent = PathUtils.parent(dir);
      if (!parent || parent === dir) break;
      dir = parent;
    }
    return null;
  }

  // PS-вызов одним -EncodedCommand (base64 от UTF-16LE): nsIProcess НЕ
  // квотит аргументы — пути с пробелами ("C:\Program Files\...")
  // рвутся на части и powershell умирает. Общий энкодер для обоих ps-скриптов.
  const PS_EXE = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
  const q = (s) => String(s).replace(/'/g, "''");

  function encodePsCommand(psLine) {
    const u16 = [];
    for (let i = 0; i < psLine.length; i++) {
      const c = psLine.charCodeAt(i);
      u16.push(c & 0xff, (c >> 8) & 0xff);
    }
    let bin = '';
    for (let i = 0; i < u16.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, u16.slice(i, i + 0x8000));
    }
    return btoa(bin);
  }

  function runPsEncoded(psLine) {
    const encoded = encodePsCommand(psLine);
    const ps = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
    ps.initWithPath(PS_EXE);
    const proc = Cc['@mozilla.org/process/util;1'].createInstance(Ci.nsIProcess);
    proc.init(ps);
    const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded];
    proc.run(false, args, args.length); // detached: живёт после выхода браузера
  }

  function launchApplier(zipPath) {
    const applier = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
    applier.append('resources');
    applier.append('blade-apply-update.ps1');
    if (!applier.exists()) throw new Error('нет chrome\\resources\\blade-apply-update.ps1');
    const profDir = Services.dirsvc.get('ProfD', Ci.nsIFile).path;
    const root = findBladeRoot();
    if (!root) throw new Error('не смог определить папку установки Blade');
    const ps = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
    ps.initWithPath(PS_EXE);
    if (!ps.exists()) throw new Error('powershell.exe не найден');
    // 1.3.6, инцидент 2026-09-14: powershell наследует CWD firefox = каталог
    // движка (Setup/ярлыки ставят WorkingDirectory=App\Blade) — applier сам
    // запирал свой Move-Item. Уводим CWD в USERPROFILE ещё ДО старта applier:
    // страховка и для старых applier'ов без self-fix.
    const psLine =
      "Set-Location $env:USERPROFILE; & '" + q(applier.path) + "' -ZipPath '" + q(zipPath) +
      "' -BladeRoot '" + q(root) + "' -ProfileDir '" + q(profDir) + "' -Auto";
    runPsEncoded(psLine);
    mark('applier launched root=' + root);
  }

  // ---- Установка в один клик ----
  async function startInstall() {
    if (downloading) return;
    if (!remoteInfo) {
      // «Обновить» могли нажать в окне, где проверки ещё не было — тихо перепроверяем
      await checkForUpdate(false);
      if (!remoteInfo) { notifyError('обновление недоступно, попробуй позже'); return; }
    }
    if (compareVersions(remoteInfo.version, localVersion) <= 0) {
      notify('⚡ Blade актуален');
      return;
    }
    downloading = true;
    const info = remoteInfo;
    const controller = new AbortController();
    abortCtl = controller;
    let zipPath = '';
    let checksumPath = '';
    // Панель открыта — переключаем её в режим прогресса (scaleX-бар + отмена);
    // иначе стоковая нотификация, как раньше
    const panel = (panelVisible && window.document.getElementById(PANEL_ID)) || null;
    let notif = null;
    if (panel) {
      enterProgressMode(panel);
    } else {
      notif = notify('⚡ «' + (info.codename || 'Blade') + '»: подготовка…', [
        {
          label: 'Отмена',
          callback: () => { try { if (abortCtl) abortCtl.abort(); } catch (e) {} return false; },
        },
      ]);
    }
    try {
      const profDir = Services.dirsvc.get('ProfD', Ci.nsIFile).path;
      const updDir = PathUtils.join(profDir, 'updates');
      await IOUtils.makeDirectory(updDir, { createRecursively: true });
      const updDirFile = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
      updDirFile.initWithPath(updDir);
      if (updDirFile.isSymlink()) throw new Error('папка обновлений перенаправлена ссылкой');
      if (controller.signal.aborted) throw new DOMException('Скачивание отменено', 'AbortError');
      const safeName = String(info.assetName || ('Blade-v' + info.version + '.zip')).replace(/[^\w.\-]+/g, '_');
      zipPath = PathUtils.join(updDir, safeName);
      checksumPath = zipPath + '.sha256';
      mark('download ' + safeName);
      let lastUiAt = 0, lastUiPercent = -1;
      const reportProgress = (label) => (done, total) => {
        const pct = total ? Math.round(done * 100 / total) : null;
        const now = Date.now();
        if (now - lastUiAt < 140 && pct === lastUiPercent) return;
        lastUiAt = now;
        lastUiPercent = pct;
        if (panel) updatePanelProgress(panel, done, total, label);
        else {
          const progress = pct === null
            ? `${formatBytes(done)} · размер уточняется`
            : `${pct}% · ${formatBytes(done)} / ${formatBytes(total)}`;
          setNotifLabel(notif, `«${info.codename || 'Blade'}»: ${label.toLowerCase()} · ${progress}`);
        }
      };
      const archiveBytes = await downloadAsset(zipPath, info.assetId, reportProgress('Скачиваем обновление'), controller);
      if (archiveBytes !== info.size) throw new Error('размер архива не совпадает с релизом');

      if (panel) updatePanelProgress(panel, 0, 0, 'Проверяем контрольную сумму');
      else setNotifLabel(notif, '«' + (info.codename || 'Blade') + '»: скачиваем SHA-256…');
      const checksumBytes = await downloadAsset(checksumPath, info.checksumAssetId,
        reportProgress('Скачиваем контрольную сумму'), controller);
      if (checksumBytes > 4096) throw new Error('файл контрольной суммы слишком большой');
      const checksumText = (await IOUtils.readUTF8(checksumPath)).replace(/^\uFEFF/, '').trim();
      const checksumMatch = /^([a-f\d]{64})(?:\s+\*?(.+?))?$/i.exec(checksumText.split(/\r?\n/, 1)[0] || '');
      if (!checksumMatch || (checksumMatch[2] && checksumMatch[2].trim() !== info.assetName)) {
        throw new Error('контрольная сумма не соответствует архиву обновления');
      }
      if (panel) {
        updatePanelProgress(panel, 1, 1, 'SHA-256 получен · установщик проверит архив перед применением');
        setPanelActions(panel, [{ cls: 'bu-ghost', label: 'Запускаем установщик…', disabled: true, fn: () => {} }]);
      } else setNotifLabel(notif, '«' + (info.codename || 'Blade') + '»: целостность проверена, запускаем обновление…');
      abortCtl = null;
      mark('downloaded ' + safeName + ' ok');
      launchApplier(zipPath);
      // Даём аплайеру подняться, затем закрываем браузер сами
      // (аплайер подстрахует: дождётся и добьёт зависшие процессы)
      setTimeout(() => {
        try { Services.startup.quit(Services.startup.eAttemptQuit); } catch (e) { mark('ERR quit ' + e); }
      }, 2000);
    } catch (e) {
      downloading = false;
      abortCtl = null;
      try { if (zipPath) await IOUtils.remove(zipPath, { ignoreAbsent: true }); } catch (cleanupError) {}
      try { if (checksumPath) await IOUtils.remove(checksumPath, { ignoreAbsent: true }); } catch (cleanupError) {}
      mark('ERR install ' + e);
      const msg = (e && e.name === 'AbortError') ? 'скачивание отменено' : ('обновление не удалось — ' + (e.message || e));
      notifyError(msg);
      // Панель из режима прогресса возвращаем к предложению обновления
      if (panel && panelVisible) showUpdatePanel();
    }
  }

  // ---- Результат прошлого обновления (пишет аплайер) ----
  async function checkStartupResult() {
    try {
      const resPath = PathUtils.join(Services.dirsvc.get('ProfD', Ci.nsIFile).path, 'update_result.txt');
      const txt = (await IOUtils.readUTF8(resPath)).replace(/^\uFEFF/, '').trim();
      await IOUtils.remove(resPath, { ignoreAbsent: true });
      if (txt.startsWith('OK')) {
        // Детали и имя главы для панели пишет applier в update_chronicle.txt.
        const shown = await showChroniclePanel();
        if (!shown) notify('⚡ Blade обновлён' + (localCodename ? ' · ' + localCodename : ''));
        // Фанфара «клинок обновлён» (BladeSounds 1.1+; тихо, если звуки выключены)
        try { if (window.BladeSounds && window.BladeSounds.fanfare) window.BladeSounds.fanfare(); } catch (e) {}
        // A4 «Клинок Живёт»: вспышка каймы окна к фанфаре обновления
        try { if (window.BladeSounds && window.BladeSounds.windowFlash) window.BladeSounds.windowFlash(); } catch (e) {}
      } else if (txt.startsWith('ERR')) {
        notifyError('обновление не удалось — ' + txt.replace(/^ERR\s*/, ''));
      }
    } catch (e) { /* файла нет — норма */ }
  }

  // Shared across browser windows; failed repair retries only on next startup.
  function registrationSession() {
    return Services.ppmm.sharedData.get(REGISTRATION_SESSION) ||
      { attempted: false, pending: null, nextTask: 0 };
  }

  // RegisterOnly never changes UserChoice or opens UI; explicit action asks Windows.
  function launchDefaultScript(registerOnly = false) {
    if (!canSetDefault()) throw new Error('В тестовой сборке регистрация браузером по умолчанию отключена.');
    const session = registrationSession();
    if (session.pending) throw new Error('Регистрация уже выполняется. Повтори после завершения.');
    const script = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
    script.append('resources');
    script.append('set-blade-default.ps1');
    if (!script.exists()) throw new Error('нет chrome/resources/set-blade-default.ps1');
    const root = PathUtils.join(Services.env.get('LOCALAPPDATA'), 'Blade');
    const ps = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
    ps.initWithPath(PS_EXE);
    if (!ps.exists()) throw new Error('powershell.exe не найден');
    const psLine = "& '" + q(script.path) + "' -EnginePath '" + q(root) + "'" +
      (registerOnly ? ' -RegisterOnly' : '');
    const args = ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden',
      '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodePsCommand(psLine)];
    const proc = Cc['@mozilla.org/process/util;1'].createInstance(Ci.nsIProcess);
    proc.init(ps);
    proc.startHidden = true;
    proc.noShell = true;
    const task = { id: session.nextTask + 1, observer: null };
    task.observer = {
      observe(subject, topic) {
        const current = registrationSession();
        if (current.pending !== task.id || !['process-finished', 'process-failed'].includes(topic)) return;
        let exit = -1;
        if (topic === 'process-finished') {
          try { exit = subject.QueryInterface(Ci.nsIProcess).exitValue; } catch (e) {}
        }
        current.pending = null;
        Services.ppmm.sharedData.set(REGISTRATION_SESSION, current);
        if (registerOnly && exit === 0) {
          try {
            Services.prefs.setIntPref(PREF.registrationSchema, REGISTRATION_SCHEMA);
            mark('registration repair schema=' + REGISTRATION_SCHEMA + ' complete');
          } catch (e) { mark('ERR registration schema preference', e); }
        } else if (!registerOnly && exit === 2) {
          notify('Открыты настройки Windows. Выбери Blade Browser и нажми «Set default».');
          mark('default-browser Windows UI opened');
        } else if (!registerOnly && exit === 0) {
          notify('Регистрация Blade обновлена. Браузер по умолчанию выбирается в настройках Windows.');
        } else {
          mark('ERR registration ' + topic + ' exit=' + exit);
          if (!registerOnly) notifyError('регистрация не завершена (код ' + exit + '). Повтори попытку.');
        }
      },
    };
    session.nextTask = task.id;
    session.pending = task.id;
    Services.ppmm.sharedData.set(REGISTRATION_SESSION, session);
    try {
      proc.runwAsync(args, args.length, task.observer, false);
    } catch (e) {
      const current = registrationSession();
      if (current.pending === task.id) {
        current.pending = null;
        Services.ppmm.sharedData.set(REGISTRATION_SESSION, current);
      }
      throw e;
    }
    mark('registration launched mode=' + (registerOnly ? 'repair' : 'Windows UI') + ' root=' + root);
  }

  function repairRegistrationOnStartup() {
    try {
      if (!canSetDefault()) return;
      let schema = 0;
      try { schema = Services.prefs.getIntPref(PREF.registrationSchema, 0); } catch (e) {}
      if (schema >= REGISTRATION_SCHEMA) return;
      const session = registrationSession();
      if (session.attempted) return;
      session.attempted = true;
      Services.ppmm.sharedData.set(REGISTRATION_SESSION, session);
      launchDefaultScript(true);
    } catch (e) { mark('ERR startup registration repair', e); }
  }

  // ---- Старт: результат прошлого обновления + автопроверка раз в сутки ----
  checkStartupResult();
  setTimeout(() => {
    try {
      if (!Services.prefs.getBoolPref(PREF.auto, true)) return;
      const last = Services.prefs.getIntPref(PREF.lastCheck, 0);
      if (Math.floor(Date.now() / 1000) - last < 86400) return;
    } catch (e) { return; }
    checkForUpdate(false);
  }, 10000);

  // Association changes are explicit, and only the installed build may do them.
  function canSetDefault() {
    try {
      const expected = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
      expected.initWithPath(Services.env.get('LOCALAPPDATA')); expected.append('Blade');
      expected.append('Data'); expected.append('profile'); expected.normalize();
      const actual = Services.dirsvc.get('ProfD',Ci.nsIFile).clone();actual.normalize();
      if (!actual.equals(expected)) return false;
      const exe = Services.dirsvc.get('XREExeF',Ci.nsIFile).clone();exe.normalize();
      return ['Blade','Firefox64'].some(name=>{
        const installed = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
        installed.initWithPath(Services.env.get('LOCALAPPDATA'));installed.append('Blade');installed.append('App');installed.append(name);installed.append('firefox.exe');
        installed.normalize();
        return exe.equals(installed);
      });
    } catch (_) {return false;}
  }

  // ---- API для меню B (BobliksSettings) ----
  window.BladeUpdater = {
    moduleVersion: MODULE_VERSION,
    canSetDefault,
    check: (manual) => checkForUpdate(!!manual),
    install: () => startInstall(),
    setDefault: () => {
      try {
        launchDefaultScript();
        notify('Подготавливаю регистрацию Blade и страницу выбора браузера в Windows.');
        return true;
      } catch (e) {
        notifyError('не удалось запустить регистрацию: ' + (e.message || e));
        return false;
      }
    },
    state: () => ({
      current: localVersion,
      available: availableVersion(),
      downloading,
    }),
  };
  mark('START');
  repairRegistrationOnStartup();
})();
