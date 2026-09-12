// ==UserScript==
// @name            Blade Updater
// @description     Автопроверка и установка обновлений Blade с GitHub (приватный репо, в один клик)
// @author          Bobliks-Creations
// @include         main
// @version         1.3.4
// ==/UserScript==
(function () {
  if (window.BladeUpdater) return;

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
    setdefaultDone: 'blade.setdefault.done',
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
      const text = 'v1.3.4 ' + m + (e ? '\n' + String(e) + '\n' + (e && e.stack || '') : '');
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

  // ---- Кастомная панель обновлений (паттерн BobliksSettings: XUL panel в
  // ---- #mainPopupSet, XHTML-контент, рамка через ::part(content), CSS с
  // ---- id-гвардом, кнопки через createElement) ----
  const PANEL_ID = 'blade-update-panel';
  const PANEL_CSS = `
    #blade-update-panel::part(content) {
      appearance: none; -moz-appearance: none;
      border: 1px solid color-mix(in srgb, var(--accent, #ff2a2a) 80%, transparent);
      border-radius: 14px;
      padding: 0;
      background: linear-gradient(180deg, #17171f 0%, #0a0a0e 100%);
      box-shadow: 0 14px 50px rgba(0,0,0,0.85), 0 0 30px color-mix(in srgb, var(--accent, #ff2a2a) 20%, transparent);
      overflow: hidden;
    }
    .bu-wrap { width: 360px; font-family: var(--blade-ui, 'Rubik', 'Segoe UI', sans-serif); color: #e9e9ee; animation: bu-in .16s ease-out; }
    @keyframes bu-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
    .bu-head { display: flex; align-items: center; justify-content: space-between; gap: 9px; padding: 12px 14px 8px; }
    .bu-title { font-family: var(--blade-display, 'Unbounded', sans-serif); font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #fff; text-shadow: 0 0 14px color-mix(in srgb, var(--accent, #ff2a2a) 70%, transparent); }
    .bu-pill { flex: none; font-size: 10.5px; font-weight: 700; color: var(--accent, #ff2a2a); border: 1px solid color-mix(in srgb, var(--accent, #ff2a2a) 45%, transparent); background: color-mix(in srgb, var(--accent, #ff2a2a) 12%, transparent); border-radius: 20px; padding: 2px 9px; font-family: var(--blade-mono, 'JetBrains Mono', monospace); }
    .bu-legend { padding: 0 14px 2px; font-size: 15px; font-weight: 700; color: #fff; font-family: var(--blade-ui, 'Rubik', sans-serif); }
    .bu-meta { padding: 0 14px 10px; font-size: 11px; color: #8f8f9c; font-family: var(--blade-mono, 'JetBrains Mono', monospace); }
    .bu-body { max-height: 40vh; overflow-y: auto; padding: 4px 14px 10px; font-size: 12.5px; line-height: 1.55; color: #cfcfd8; white-space: pre-wrap; font-family: var(--blade-ui, 'Rubik', sans-serif); scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--accent, #ff2a2a) 55%, transparent) transparent; }
    .bu-progress { display: flex; align-items: center; gap: 10px; padding: 6px 14px 4px; }
    .bu-track { flex: 1; height: 3px; border-radius: 2px; background: rgba(255,255,255,0.09); overflow: hidden; }
    .bu-bar { height: 100%; background: var(--accent, #ff2a2a); transform: scaleX(0); transform-origin: left; transition: transform .18s ease-out; box-shadow: 0 0 8px color-mix(in srgb, var(--accent, #ff2a2a) 60%, transparent); }
    .bu-pct { flex: none; width: 40px; text-align: right; font-size: 11px; font-weight: 700; color: var(--accent, #ff2a2a); font-family: var(--blade-mono, 'JetBrains Mono', monospace); }
    .bu-actions { display: flex; gap: 10px; padding: 10px 14px 14px; }
    .bu-btn { flex: 1; text-align: center; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; padding: 8px 0; border-radius: 8px; cursor: pointer; font-family: var(--blade-ui, 'Rubik', sans-serif); }
    .bu-accept { color: var(--accent, #ff2a2a); border: 1px solid color-mix(in srgb, var(--accent, #ff2a2a) 80%, transparent); }
    .bu-accept:hover { color: #fff; background: color-mix(in srgb, var(--accent, #ff2a2a) 20%, transparent); }
    .bu-ghost { color: #9a9aa6; border: 1px solid rgba(255,255,255,0.12); }
    .bu-ghost:hover { color: #fff; border-color: rgba(255,255,255,0.3); }
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
    panel.addEventListener('popuphidden', () => { panelVisible = false; });
    const H = 'http://www.w3.org/1999/xhtml';
    const mk = (cls) => { const el = doc.createElementNS(H, 'div'); el.className = cls; return el; };
    const wrap = mk('bu-wrap');
    const head = mk('bu-head');
    const title = mk('bu-title'); title.textContent = 'BLADE // ХРОНИКА ОБНОВЛЕНИЙ';
    const pill = mk('bu-pill');
    head.append(title, pill);
    const legend = mk('bu-legend');
    const meta = mk('bu-meta');
    const body = mk('bu-body');
    const progress = mk('bu-progress');
    const track = mk('bu-track');
    const bar = mk('bu-bar');
    const pct = mk('bu-pct');
    track.appendChild(bar);
    progress.append(track, pct);
    const actions = mk('bu-actions');
    wrap.append(head, legend, meta, body, progress, actions);
    panel.appendChild(wrap);
    return panel;
  }

  function fillPanel(panel, o) {
    const q = (cls) => panel.querySelector(cls);
    const title = q('.bu-title'); if (title) title.textContent = o.title;
    const pill = q('.bu-pill'); if (pill) pill.textContent = o.pill || '';
    const legend = q('.bu-legend'); if (legend) legend.textContent = o.legend || '';
    const meta = q('.bu-meta'); if (meta) meta.textContent = o.meta || '';
    const body = q('.bu-body'); if (body) body.textContent = o.body || '';
    const progress = q('.bu-progress');
    if (progress) {
      progress.style.display = o.progress ? '' : 'none';
      if (o.progress) {
        const bar = q('.bu-bar'); if (bar) bar.style.transform = 'scaleX(0)';
        const pct = q('.bu-pct'); if (pct) pct.textContent = '0%';
      }
    }
  }

  function setPanelActions(panel, defs) {
    const actions = panel.querySelector('.bu-actions');
    if (!actions) return;
    actions.textContent = '';
    const doc = panel.ownerDocument;
    for (const d of defs) {
      const b = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      b.className = 'bu-btn ' + d.cls;
      b.textContent = d.label;
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
      const kind = info.isFull ? 'движок + кастомизация' : 'кастомизация';
      fillPanel(panel, {
        title: 'BLADE // ХРОНИКА ОБНОВЛЕНИЙ',
        pill: 'v' + info.version,
        legend: 'Грядёт: v' + info.version + (info.codename ? ' · ' + info.codename : ''),
        meta: sizeMB + ' МБ · ' + kind,
        body: info.notes || '',
        progress: false,
      });
      setPanelActions(panel, [
        // Панель не закрываем: startInstall переключит её в режим прогресса
        { cls: 'bu-accept', label: 'Принять', fn: () => { startInstall(); } },
        { cls: 'bu-ghost', label: 'Позже', fn: () => { try { panel.hidePopup(); } catch (e) {} } },
      ]);
      openPanelNearAnchor(panel, anchor);
      return true;
    } catch (e) { mark('ERR updPanel ' + e); return false; }
  }

  function enterProgressMode(panel) {
    try {
      const info = remoteInfo;
      fillPanel(panel, {
        title: 'BLADE // ХРОНИКА ОБНОВЛЕНИЙ',
        pill: info ? 'v' + info.version : '',
        legend: 'Скачивание v' + (info ? info.version : '') + '…',
        meta: 'браузер закроется сам и вернётся обновлённым',
        body: info && info.notes ? info.notes : '',
        progress: true,
      });
      // «Принять»/«Позже» блокируются: остаётся только отмена
      setPanelActions(panel, [
        { cls: 'bu-ghost', label: 'Отмена', fn: () => { try { if (abortCtl) abortCtl.abort(); } catch (e) {} } },
      ]);
    } catch (e) { mark('ERR progMode ' + e); }
  }

  async function showChroniclePanel(newVer) {
    try {
      const anchor = await waitAnchorReady();
      if (!anchor) return false;
      const panel = ensureUpdatePanel();
      const chronicle = await readChronicle();
      const codename = localCodename || await readLocalCodename();
      fillPanel(panel, {
        title: 'КЛИНОК ОБНОВЛЁН',
        pill: newVer ? 'v' + newVer : '',
        legend: (newVer ? 'v' + newVer : '') + (codename ? ' · ' + codename : ''),
        meta: 'хроника изменений',
        body: chronicle || 'Обновление применено. С возвращением.',
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

  // «Blade v1.7.0 — Пепельный Венец» -> «Пепельный Венец»
  function parseCodename(name) {
    const m = /^Blade\s+v[\d.]+\s+[—–-]\s+(.+)$/.exec(String(name || '').trim());
    return m ? m[1].trim() : '';
  }

  // Лёгкая зачистка markdown для панели: #/жирный/код -> прочь,
  // ссылки [текст](url) -> текст, обрезаем до ~3000 символов
  function cleanNotes(src) {
    let t = String(src || '');
    t = t.replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1');
    t = t.replace(/[#*`]/g, '');
    t = t.replace(/\r\n/g, '\n').trim();
    if (t.length > 3000) t = t.slice(0, 3000).trim() + '…';
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
      // lastCheck после успешного ответа: сбой сети не должен блокировать
      // проверку на сутки (дубль от второго окна за время запроса допустим)
      Services.prefs.setIntPref(PREF.lastCheck, Math.floor(Date.now() / 1000));
      const rel = await resp.json();
      const tag = String(rel.tag_name || '').replace(/^v/i, '').trim();
      const zips = (rel.assets || []).filter(a => /\.zip$/i.test(a.name || ''));
      const asset = zips[0] || (rel.assets || [])[0];
      if (!tag || !asset) throw new Error('в релизе нет версии или архива');
      remoteInfo = {
        version: tag,
        assetId: asset.id,
        assetName: asset.name,
        size: asset.size || 0,
        isFull: /full/i.test(asset.name || ''),
        codename: parseCodename(rel.name),
        notes: cleanNotes(rel.body),
      };
      Services.prefs.setStringPref(PREF.avail, tag);
      mark('remote v' + tag + ' local v' + localVersion + ' asset ' + asset.name);
      if (compareVersions(tag, localVersion) > 0) {
        showUpdateNotification();
      } else if (manual || tokenHealed) {
        notify('⚡ У тебя последняя версия Blade (v' + (localVersion || '?') + ')' +
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
    const kind = info.isFull ? 'движок + кастомизация' : 'кастомизация';
    notify('⚡ Доступен Blade v' + info.version + ' (' + sizeMB + ' МБ, ' + kind + ')', [
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
  async function downloadAsset(destPath, onProgress) {
    const url = apiBase() + '/repos/' + repo() + '/releases/assets/' + remoteInfo.assetId;
    abortCtl = new AbortController();
    let resp = await fetch(url, {
      headers: ghHeaders({ Accept: 'application/octet-stream' }),
      signal: abortCtl.signal,
    });
    // 401 с токеном — та же самолечилка, что в checkForUpdate: чистим преф,
    // повторяем анонимно (скачивание ассета тоже ходит с авторизацией)
    if (resp.status === 401 && token()) {
      try { Services.prefs.clearUserPref(PREF.token); } catch (e2) {}
      mark('token 401 (asset) — преф очищен, повтор анонимно');
      resp = await fetch(url, {
        headers: ghHeaders({ Accept: 'application/octet-stream' }),
        signal: abortCtl.signal,
      });
    }
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const total = parseInt(resp.headers.get('content-length') || '0', 10) || 0;

    // Основной путь: один файловый стрим (быстро). Контракт именно
    // "binaryoutputstream" — одним словом, не binary-output-stream.
    let bos = null, fos = null;
    try {
      const file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
      file.initWithPath(destPath);
      fos = Cc['@mozilla.org/network/file-output-stream;1'].createInstance(Ci.nsIFileOutputStream);
      fos.init(file, 0x02 | 0x08 | 0x20, 0o600, 0); // PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE
      const BOS = '@mozilla.org/binaryoutputstream;1';
      if (Cc[BOS]) {
        bos = Cc[BOS].createInstance(Ci.nsIBinaryOutputStream);
        bos.setOutputStream(fos);
      } else {
        mark('WARN no binaryoutputstream — IOUtils append');
      }
    } catch (e) {
      mark('WARN stream fallback ' + e);
      try { if (fos) fos.close(); } catch (e2) {}
      bos = null; fos = null;
    }

    let done = 0, firstChunk = true;
    try {
      const reader = resp.body.getReader();
      for (;;) {
        const { value, done: fin } = await reader.read();
        if (fin) break;
        if (bos) {
          bos.writeByteArray(value, value.length);
        } else {
          await IOUtils.write(destPath, value, { mode: firstChunk ? 'overwrite' : 'append' });
          firstChunk = false;
        }
        done += value.length;
        if (onProgress) onProgress(done, total);
      }
    } finally {
      try { if (bos) bos.close(); else if (fos) fos.close(); } catch (e) {}
      abortCtl = null;
    }
    if (total && done < total) throw new Error('архив скачан не полностью');
    if (!done) throw new Error('пустой ответ сервера');
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
  // квотит аргументы — пути с пробелами ("F:\firefox michael edition\...")
  // рвутся на части и powershell умирает. Общий энкодер для обоих ps-скриптов.
  const PS_EXE = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
  const q = (s) => String(s).replace(/'/g, "''");

  function runPsEncoded(psLine) {
    const u16 = [];
    for (const ch of psLine) {
      const c = ch.charCodeAt(0);
      u16.push(c & 0xff, (c >> 8) & 0xff);
    }
    let bin = '';
    for (let i = 0; i < u16.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, u16.slice(i, i + 0x8000));
    }
    const encoded = btoa(bin);
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
    const psLine =
      "& '" + q(applier.path) + "' -ZipPath '" + q(zipPath) +
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
      notify('⚡ У тебя последняя версия Blade (v' + (localVersion || '?') + ')');
      return;
    }
    downloading = true;
    const info = remoteInfo;
    // Панель открыта — переключаем её в режим прогресса (scaleX-бар + отмена);
    // иначе стоковая нотификация, как раньше
    const panel = (panelVisible && window.document.getElementById(PANEL_ID)) || null;
    let notif = null;
    if (panel) {
      enterProgressMode(panel);
    } else {
      notif = notify('⚡ Blade v' + info.version + ': подготовка…', [
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
      const safeName = String(info.assetName || ('Blade-v' + info.version + '.zip')).replace(/[^\w.\-]+/g, '_');
      const zipPath = PathUtils.join(updDir, safeName);
      mark('download ' + safeName);
      await downloadAsset(zipPath, (done, total) => {
        const pct = total ? Math.round(done * 100 / total) : 0;
        if (panel) {
          // transform, не width: без layout-перерисовки панели
          try {
            const bar = panel.querySelector('.bu-bar');
            if (bar) bar.style.transform = 'scaleX(' + (pct / 100) + ')';
            const pctEl = panel.querySelector('.bu-pct');
            if (pctEl) pctEl.textContent = pct + '%';
          } catch (e) {}
        } else {
          setNotifLabel(notif, '⚡ Скачивание Blade v' + info.version + ': ' + pct + '% (' + Math.round(done / 1048576) + ' МБ)');
        }
      });
      mark('downloaded ' + safeName + ' ok');
      launchApplier(zipPath);
      // Даём аплайеру подняться, затем закрываем браузер сами
      // (аплайер подстрахует: дождётся и добьёт зависшие процессы)
      setTimeout(() => {
        try { Services.startup.quit(Services.startup.eAttemptQuit); } catch (e) { mark('ERR quit ' + e); }
      }, 2000);
    } catch (e) {
      downloading = false;
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
        // 'OK v1.6.3 -> v1.7.0 (кастомизация)' — показываем панель-хронику
        // с codename нового релиза и записью update_chronicle.txt
        const m = /^OK\s+v?([\d.]+)\s*->\s*v?([\d.]+)/.exec(txt);
        const shown = await showChroniclePanel(m ? m[2] : '');
        if (!shown) notify('⚡ Blade обновлён: ' + txt.replace(/^OK\s*/, ''));
        // Фанфара «клинок обновлён» (BladeSounds 1.1+; тихо, если звуки выключены)
        try { if (window.BladeSounds && window.BladeSounds.fanfare) window.BladeSounds.fanfare(); } catch (e) {}
      } else if (txt.startsWith('ERR')) {
        notifyError('обновление не удалось — ' + txt.replace(/^ERR\s*/, ''));
      }
    } catch (e) { /* файла нет — норма */ }
  }

  // ---- Регистрация Blade браузером по умолчанию (set-blade-default.ps1) ----
  // Скрипт едет в патче (chrome\resources\): HKCU-регистрация в Windows,
  // ассоциации .html/.htm с валидным UserChoice-хешем, http/https где
  // позволяет система; на укреплённых сборках Win11 сам откроет Settings
  // для одного клика. Преф-щит: гоняем один раз (после установки/обновления).
  function launchDefaultScript() {
    const script = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
    script.append('resources');
    script.append('set-blade-default.ps1');
    if (!script.exists()) throw new Error('нет chrome\\resources\\set-blade-default.ps1');
    const root = findBladeRoot();
    if (!root) throw new Error('не смог определить папку установки Blade');
    const ps = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
    ps.initWithPath(PS_EXE);
    if (!ps.exists()) throw new Error('powershell.exe не найден');
    // -EncodedCommand через общий runPsEncoded (см. комментарий там)
    const psLine = "& '" + q(script.path) + "' -EnginePath '" + q(root) + "'";
    runPsEncoded(psLine);
    mark('default-browser script launched root=' + root);
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

  // ---- Старт: однократная регистрация как браузер по умолчанию ----
  // Один раз на установку: пользователь может сознательно выбрать другой
  // браузер позже — Blade не будет отвоёвывать дефолт повторно.
  setTimeout(() => {
    try {
      if (Services.prefs.getBoolPref(PREF.setdefaultDone, false)) return;
      launchDefaultScript();
      Services.prefs.setBoolPref(PREF.setdefaultDone, true);
      mark('default-browser: скрипт запущен (однократно)');
    } catch (e) { mark('default-browser: отложено до следующего старта — ' + e); }
  }, 15000);

  // ---- API для меню B (BobliksSettings) ----
  window.BladeUpdater = {
    check: (manual) => checkForUpdate(!!manual),
    install: () => startInstall(),
    setDefault: () => {
      try {
        launchDefaultScript();
        notify('⚡ Регистрирую Blade как браузер по умолчанию — если Windows открыл настройки, выбери Blade и нажми «Set default».');
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
})();
