// ==UserScript==
// @name            Blade Auto Theme
// @description     Авто-тема день/ночь по системным часам (60с через реестр
//                  BladeCore). Внешний клиент API: читает текущую тему из
//                  data-blade-theme, переключает через window.BladeSettings.setTheme
// @author          Blade-Creations
// @include         main
// @version         1.0.0
// @loadOrder       12
// ==/UserScript==
(function () {
  if (window.BladeAutoTheme) return;
  window.BladeAutoTheme = true;

  let markPath = '';
  try {
    const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
    d.append('JS');
    markPath = d.path + '\\BladeAutoTheme_mark.txt';
  } catch (e) {}
  const mark = (m, e) => {
    try {
      if (!markPath) return;
      const text = 'v1.0.0 ' + m + (e ? '\n' + String(e) + '\n' + (e && e.stack || '') : '');
      IOUtils.writeUTF8(markPath, text).catch(() => {});
    } catch (e2) {}
  };

  // Шаг 3 декомпозиции BobliksSettings: циклер вынесен как внешний клиент API.
  // Текущая тема читается с документа (setTheme вешает data-blade-theme), а не
  // из замыкания монолита — модуль не зависит от внутренних состояний ядра.
  const activeTheme = () => {
    try {
      const t = window.document.documentElement.getAttribute('data-blade-theme');
      return t || 'red';
    } catch (e) { return 'red'; }
  };

  function autoThemeTick() {
    try {
      if (!Services.prefs.getBoolPref('blade.autotheme.on', false)) return;
      const hour = new Date().getHours();
      const prefName = (hour >= 8 && hour < 20) ? 'blade.autotheme.day' : 'blade.autotheme.night';
      const target = Services.prefs.getStringPref(prefName, prefName === 'blade.autotheme.day' ? 'grey' : 'blood');
      if (activeTheme() !== target) {
        const set = window.BladeSettings && window.BladeSettings.setTheme;
        if (set) set(target);
      }
    } catch (e) { mark('ERR autoTheme ' + e); }
  }

  mark('START');

  // Порядок загрузки: BladeSettings (loadOrder 10, дефолт) уже отработал к
  // моменту @loadOrder 12 — API гарантированно жив. Если по какой-то причине
  // его нет — тихий NO_API в mark, браузер продолжает работать.
  if (!(window.BladeSettings && window.BladeSettings.setTheme)) {
    mark('NO_API');
    return;
  }

  // Авто-тема: интервал через реестр BladeCore (2.0), ручной unload срезан.
  // Каждое окно циклит само; setTheme идемпотентен — гонки между окнами
  // безвредны (граница часа ловится с точностью до 60 с).
  autoThemeTick();
  if (window.Blade && window.Blade.every) Blade.every(autoThemeTick, 60e3);
  else {
    const autoThemeTimer = setInterval(autoThemeTick, 60e3);
    window.addEventListener('unload', () => { clearInterval(autoThemeTimer); }, { once: true });
  }
  mark('OK autoTheme');
})();
