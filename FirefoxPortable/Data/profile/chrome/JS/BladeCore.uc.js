// ==UserScript==
// @name            Blade Core
// @description     Общий контракт window.Blade: темы, встроенные фоны, преф-хэш,
//                  mark-логи, шина событий, запуск PowerShell, реестр таймеров
//                  и слушателей с авто-очисткой на unload (2.0 «Переплавка»)
// @author          Blade-Creations
// @include         main
// @version         1.1.0
// @loadOrder       5
// ==/UserScript==
// ОТКЛЮЧАТЬ НЕЛЬЗЯ: THEMES/builtinBgs/bgPrefId отсюда потребляют
// Settings/ChromeStyle/Covers. loadOrder 5 — исполняется ДО всех обычных
// скриптов (их дефолт 10), поэтому window.Blade у них уже готов.
(function () {
  if (window.Blade) return;

  // Темы: единый источник правды (до этого массив жил в BobliksSettings и
  // дублировался бы в ChromeStyle). page — фон контентных страниц (--bob-page),
  // дословно из userContent.css. selFg — цвет текста выделения на акценте:
  // светлые акценты (green/grey/orange/volt) требуют тёмный текст, иначе
  // выделение нечитаемо.
  const THEMES = [
    { id: 'red',    label: 'GX Red (default)', pref: null,                 accent: '#ff2a2a', page: '#0a0a0c', selFg: '#ffffff' },
    { id: 'blood',  label: 'Demonic Blood',    pref: 'bobliks.theme.blood',  accent: '#a80f0f', page: '#0d0506', selFg: '#ffffff' },
    { id: 'purple', label: 'Neon Purple',      pref: 'bobliks.theme.purple', accent: '#b44bff', page: '#0c0a10', selFg: '#ffffff' },
    { id: 'green',  label: 'Cyber Green',      pref: 'bobliks.theme.green',  accent: '#00ff88', page: '#060a08', selFg: '#000000' },
    { id: 'grey',   label: 'Minimal Grey',     pref: 'bobliks.theme.grey',   accent: '#8a8f98', page: '#0e0f11', selFg: '#000000' },
    { id: 'orange', label: 'Blood Orange',     pref: 'bobliks.theme.orange', accent: '#ff6a1f', page: '#0c0a08', selFg: '#000000' },
    { id: 'cherry', label: 'Cherry',           pref: 'bobliks.theme.cherry', accent: '#d02d4e', page: '#100508', selFg: '#ffffff' },
    { id: 'midnight', label: 'Midnight Blue',  pref: 'bobliks.theme.midnight', accent: '#2f6bff', page: '#04060d', selFg: '#ffffff' },
    { id: 'volt',     label: 'Volt Yellow',    pref: 'bobliks.theme.volt',     accent: '#fff820', page: '#0d0d05', selFg: '#000000' },
    { id: 'custom',   label: 'Своя (конструктор)', pref: 'bobliks.theme.custom', accent: '#ff2a2a', selFg: '#ffffff' }, // page считается из цвета (customVars)
  ];

  const BUILTIN_BGS = [
    { id: 'inferno',   label: 'Inferno (Red)',      file: 'bg_inferno.jpg' },
    { id: 'cherrybg',  label: 'Cherry',             file: 'bg_cherry.jpg' },
    { id: 'bloodmoon', label: 'Blood Moon',         file: 'bg_bloodmoon.jpg' },
    { id: 'midnight',  label: 'Midnight Blue',      file: 'bg_midnight.jpg' },
    { id: 'violet',    label: 'Violet',             file: 'bg_violet.jpg' },
    { id: 'toxic',     label: 'Toxic Green',        file: 'bg_toxic.jpg' },
    { id: 'ashen',     label: 'Ashen Grey',         file: 'bg_ashen.jpg' },
    { id: 'ember',     label: 'Ember Orange',       file: 'bg_ember.jpg' },
    { id: 'voltbg',    label: 'Volt Yellow',        file: 'bg_volt.jpg' },
    { id: 'blade',   label: 'Blade',         file: 'bg_blade.jpg' },
    { id: 'acheron', label: 'Acheron',       file: 'bg_acheron.jpg' },
    // серия V2.0 (2026-09-15, обои владельца «BLADE WALLPAPER V2.0»): 2560x1440,
    // палитра каждой подобрана под соотв. тему (red/blood/cherry/midnight/
    // violet/toxic/ashen/ember/volt)
    { id: 'v2red',     label: 'V2 Red',     file: 'bg_v2_red.jpg' },
    { id: 'v2blood',   label: 'V2 Blood',   file: 'bg_v2_blood.jpg' },
    { id: 'v2cherry',  label: 'V2 Cherry',  file: 'bg_v2_cherry.jpg' },
    { id: 'v2midnight',label: 'V2 Midnight',file: 'bg_v2_midnight.jpg' },
    { id: 'v2violet',  label: 'V2 Violet',  file: 'bg_v2_violet.jpg' },
    { id: 'v2toxic',   label: 'V2 Toxic',   file: 'bg_v2_toxic.jpg' },
    { id: 'v2ashen',   label: 'V2 Ashen',   file: 'bg_v2_ashen.jpg' },
    { id: 'v2ember',   label: 'V2 Ember',   file: 'bg_v2_ember.jpg' },
    { id: 'v2volt',    label: 'V2 Volt',    file: 'bg_v2_volt.jpg' },
    // живые фоны: WebP-анимация (файл) и CSS-анимация (file: null — только преф)
    { id: 'emberflow', label: 'Ember Flow (WebP)',      file: 'bg_emberflow.webp' },
    { id: 'pulse',     label: 'Pulse (CSS-анимация)',   file: null },
    { id: 'flow',      label: 'Blood Flow (CSS-анимация)', file: null },
  ];

  const Blade = {
    themes: THEMES,
    builtinBgs: BUILTIN_BGS,
    // Имена файлов в chrome/img, которые НЕ являются кастомными обоями:
    // встроенные фоны + btn_blade.png (кнопка) + current_bg.jpg (мёртвый
    // артефакт старого механизма). Set в нижнем регистре — сравнение с
    // leafName.toLowerCase() у потребителей
    reservedImgFiles() {
      const reserved = new Set();
      for (const b of BUILTIN_BGS) { if (b.file) reserved.add(b.file.toLowerCase()); }
      reserved.add('btn_blade.png');
      reserved.add('current_bg.jpg');
      return reserved;
    },
    // Стабильный хэш имени файла для префа bobliks.bg.file_*: кириллица и
    // пробелы без коллизий (Без названия.jpg раньше превращался в
    // file______________jpg — раунд 23). Единая реализация для Settings
    // (преф) и Covers (те же правила в covers.css)
    bgPrefId(fileName) {
      let h = 0;
      const s = String(fileName);
      for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h) + s.charCodeAt(i);
        h |= 0;
      }
      const safe = s.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 10);
      return 'file_' + safe + '_' + (h >>> 0).toString(16);
    },
    // Диагностический след: chrome\JS\<name>_mark.txt (перезапись). Имя БЕЗ
    // суффикса — дописывается здесь: mark('blade_core') → blade_core_mark.txt
    mark(name, text) {
      try {
        const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
        d.append('JS');
        d.append(String(name) + '_mark.txt');
        IOUtils.writeUTF8(d.path, String(text || '')).catch(() => {});
      } catch (e) {}
    },
    prefStr(name, dflt) {
      try { return Services.prefs.getStringPref(name, dflt); }
      catch (e) { return dflt; }
    },
    bus: null, // назначается ниже (нужна Map из замыкания)
    // Запуск PowerShell одним -EncodedCommand (приём из BladeUpdater):
    // nsIProcess НЕ квотит аргументы — пути с пробелами ("F:\firefox michael
    // edition\...") рвутся на части и powershell умирает. Поэтому весь вызов
    // уезжает base64 от UTF-16LE, без пробелов вообще.
    runPsEncoded(psLine) {
      const ps = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
      ps.initWithPath('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
      if (!ps.exists()) throw new Error('powershell.exe не найден');
      const u16 = [];
      for (const ch of String(psLine)) {
        const c = ch.charCodeAt(0);
        u16.push(c & 0xff, (c >> 8) & 0xff);
      }
      // String.fromCharCode.apply не переваривает огромные массивы — чанками
      let bin = '';
      for (let i = 0; i < u16.length; i += 0x8000) {
        bin += String.fromCharCode.apply(null, u16.slice(i, i + 0x8000));
      }
      const encoded = btoa(bin);
      const proc = Cc['@mozilla.org/process/util;1'].createInstance(Ci.nsIProcess);
      proc.init(ps);
      const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded];
      proc.run(false, args, args.length); // detached: живёт после выхода браузера
    },
  };

  // Шина событий: слабосвязанные Blade-скрипты общаются без прямых ссылок
  // друг на друга. Ошибка одного обработчика не роняет остальных
  const topics = new Map();
  Blade.bus = {
    on(topic, fn) {
      if (typeof fn !== 'function') return;
      if (!topics.has(topic)) topics.set(topic, new Set());
      topics.get(topic).add(fn);
    },
    off(topic, fn) {
      const subs = topics.get(topic);
      if (!subs) return;
      subs.delete(fn);
      if (!subs.size) topics.delete(topic);
    },
    emit(topic, data) {
      const subs = topics.get(topic);
      if (!subs) return;
      for (const fn of subs) {
        try { fn(data); } catch (e) { console.error('Blade bus [' + topic + ']', e); }
      }
    },
  };

  // Реестр таймеров/слушателей (2.0): Blade.every/Blade.listen снимают всё
  // сами на unload окна — интервалы и слушатели больше не размазаны по
  // ручным unload-хендлерам в каждом скрипте. Слушатели на window умирают
  // с окном и так — реестр для тех, что на чужих объектах (tabContainer,
  // gBrowser) и для интервалов: единая точка уборки.
  const intervals = new Set();
  const listeners = new Set();
  Blade.every = (fn, ms) => {
    const id = window.setInterval(fn, ms);
    intervals.add(id);
    return id;
  };
  Blade.clearEvery = (id) => {
    window.clearInterval(id);
    intervals.delete(id);
  };
  Blade.listen = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    listeners.add({ target, type, fn, opts });
  };
  window.addEventListener('unload', () => {
    for (const id of intervals) { try { window.clearInterval(id); } catch (e) {} }
    for (const l of listeners) {
      try { l.target.removeEventListener(l.type, l.fn, l.opts); } catch (e) {}
    }
  }, { once: true });

  window.Blade = Blade;
  Blade.mark('blade_core', 'v1.1.0 START');
})();
