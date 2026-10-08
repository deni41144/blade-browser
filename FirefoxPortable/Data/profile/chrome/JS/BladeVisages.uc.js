// ==UserScript==
// @name            Blade Visages
// @description     Облики (пресеты «тема+фон» одним кликом), «Мой Облик» и
//                  выбор своего файла обоев. Шаг 6 декомпозиции BobliksSettings
// @author          Blade-Creations
// @include         main
// @version         1.1.0
// @loadOrder       12
// ==/UserScript==
(function () {
  if (window.BladeVisages) return;
  window.BladeVisages = true;

  let markPath = '';
  try {
    const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
    d.append('JS');
    markPath = d.path + '\\BladeVisages_mark.txt';
  } catch (e) {}
  const mark = (m, e) => {
    try {
      if (!markPath) return;
      const text = 'v1.1.0 ' + m + (e ? '\n' + String(e) + '\n' + (e && e.stack || '') : '');
      IOUtils.writeUTF8(markPath, text).catch(() => {});
    } catch (e2) {}
  };

  // Облики — готовые сочетания «тема + фон», один клик вместо двух меню.
  // Вынесены из монолита (BLADE_VISAGES + userVisage/allVisages/applyVisage/
  // saveVisage/chooseCustomWallpaper). Применение и чтение текущей темы/фона
  // идут через window.BladeSettings — шагом 7 это уедет в BladeThemeEngine.
  const BLADE_VISAGES = [
    { id: 'hunter', label: 'Кровавый Охотник', theme: 'blood',    bg: 'bloodmoon' },
    { id: 'coder',  label: 'Полуночный Кодер', theme: 'midnight', bg: 'midnight' },
    { id: 'neon',   label: 'Неоновый Город',   theme: 'purple',   bg: 'v2violet' },
    { id: 'volt',   label: 'Высокое Напряжение', theme: 'volt',   bg: 'voltbg' },
    { id: 'cherry', label: 'Вишнёвый Сад',     theme: 'cherry',   bg: 'cherrybg' },
  ];

  const api = () => {
    const s = window.BladeSettings;
    if (s && s.setTheme && s.setBg && s.activeTheme && s.activeBg &&
        s.getImgDir && s.invalidateBgCache) return s;
    mark('NO_API');
    return null;
  };

  function userVisage() {
    // fail-soft: битый JSON или отсутствие префа — просто нет «своего» облика
    try {
      const raw = Services.prefs.getStringPref('blade.visage.mine', '');
      if (!raw) return null;
      const v = JSON.parse(raw);
      if (v && typeof v.theme === 'string' && typeof v.bg === 'string') {
        const value = { theme: v.theme, bg: window.BladeEngine?.normalizeBgId(v.bg) || v.bg };
        if (/^#[0-9a-f]{6}$/i.test(v.customColor || '')) value.customColor = v.customColor;
        if (['vivid', 'balanced', 'eco'].includes(v.mode)) value.mode = v.mode;
        return value;
      }
      return null;
    } catch (e) { return null; }
  }
  function allVisages() {
    const list = BLADE_VISAGES.slice();
    const mine = userVisage();
    if (mine) list.push({ ...mine, id: 'mine', label: 'Мой Облик' });
    return list;
  }
  function applyVisage(id) {
    const s = api(); if (!s) return;
    const v = allVisages().find(x => x.id === id);
    if (!v) { mark('FAIL visage ' + id); return; }
    Services.prefs.setBoolPref('blade.autotheme.on', false);
    if (v.theme === 'custom' && v.customColor) Services.prefs.setStringPref('blade.theme.customColor', v.customColor);
    if (v.mode && window.BladeEffects) window.BladeEffects.setMode(v.mode);
    s.setTheme(v.theme);
    s.setBg(v.bg);
    mark('OK visage ' + id);
  }
  function saveVisage() {
    const s = api(); if (!s) return;
    // Пользовательский слот независим: совпадение с builtin-обликом не
    // мешает — сохраняем текущее сочетание как есть
    const value = { theme: s.activeTheme(), bg: s.activeBg() };
    const color = Services.prefs.getStringPref('blade.theme.customColor', '#ff2a2a');
    if (value.theme === 'custom' && /^#[0-9a-f]{6}$/i.test(color)) value.customColor = color;
    if (window.BladeEffects) value.mode = window.BladeEffects.mode();
    Services.prefs.setStringPref('blade.visage.mine', JSON.stringify(value));
    mark('OK visage saved');
  }
  // Проводник: init требует BrowsingContext (window больше не конвертится —
  // раунд 23), open() — callback-based (Promise-вариант от Gemini ждал бы
  // undefined). Имя файла: транслит-безопасное + таймстамп от коллизий
  function chooseCustomWallpaper() {
    const s = api(); if (!s) return;
    try {
      const fp = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);
      const parentBC = window.browsingContext || (window.docShell && window.docShell.browsingContext) || null;
      fp.init(parentBC, 'Выберите изображение для фона Blade', Ci.nsIFilePicker.modeOpen);
      fp.appendFilters(Ci.nsIFilePicker.filterImages);
      fp.open((res) => {
        try {
          if (res !== Ci.nsIFilePicker.returnOK || !fp.file) return;
          const ext = fp.file.leafName.split('.').pop().toLowerCase();
          if (!['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'].includes(ext)) return;
          const cleanBase = fp.file.leafName.replace(/[.][^.]+$/, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20) || 'wallpaper';
          let safeName = 'custom_' + cleanBase + '_' + Date.now().toString(36) + '.' + ext;
          const imgDir = window.BladeEngine.getCustomBgDir();
          let target = imgDir.clone(); target.append(safeName);
          // Never remove another import made in the same millisecond.
          while (target.exists()) {
            safeName = 'custom_' + cleanBase + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
            target = imgDir.clone(); target.append(safeName);
          }
          target.normalize();
          if (!imgDir.contains(target, true)) throw new Error('Invalid wallpaper destination');
          fp.file.copyTo(imgDir, safeName);
          // новый файл = новый скан каталога и новый преф bobliks.bg.file_*
          s.invalidateBgCache();
          // Тумблер для BobliksCovers (@onlyonce, слушает преф): правило под
          // новый преф должно появиться в covers.css без перезапуска
          try {
            Services.prefs.setBoolPref('bobliks.covers.dirty', !Services.prefs.getBoolPref('bobliks.covers.dirty', false));
          } catch (e) {}
          s.setBg('file:' + safeName);
        } catch (e) { mark('ERR pickCopy ' + e); }
      });
    } catch (e) { mark('ERR pickBg ' + e); }
  }

  mark('START');

  window.BladeVisages = { allVisages, applyVisage, saveVisage, chooseCustomWallpaper };

  mark('OK visages');
})();
