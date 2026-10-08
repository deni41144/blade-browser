// ==UserScript==
// @name            Blade Desktop Icon
// @description     Значок ярлыка Blade в цвет выбранной темы
// @include         main
// @version         1.0.0
// @loadOrder       124
// ==/UserScript==
(function () {
  if (window.BladeDesktopIcon || Services.appinfo.OS !== 'WINNT') return;
  const icons = {red:'1RED',blood:'2BLOOD',purple:'3PURPLE',green:'4GREEN',grey:'5WHITE',orange:'6ORANGE',cherry:'7CHERRY',midnight:'8BLUE',volt:'9YELLOW',custom:'1RED'};
  let timer = 0, stopped = false, previous = '';
  const quote = value => "'" + String(value).replace(/'/g, "''") + "'";
  function update() {
    timer = 0;
    if (stopped || Services.prefs.getBoolPref('marionette.enabled', false)) return;
    const theme = document.documentElement.getAttribute('data-blade-theme') || 'red';
    if (previous === theme) return;
    try {
      const chrome = Services.dirsvc.get('UChrm', Ci.nsIFile).path;
      const executable = Services.dirsvc.get('XREExeF', Ci.nsIFile).path;
      const helper = chrome + '\\resources\\sync-desktop-icon.ps1';
      window.Blade.runPsEncoded('& ' + quote(helper) + ' -ChromePath ' + quote(chrome) + ' -ExecutablePath ' + quote(executable) + ' -IconName ' + quote(icons[theme] || icons.red) + ' -RequestStamp ' + Date.now());
      previous = theme;
    } catch (error) { window.Blade?.mark('desktop_icon', 'ERR ' + error); }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(update, 400); }
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {attributes:true,attributeFilter:['data-blade-theme']});
  function destroy() { stopped = true; clearTimeout(timer); observer.disconnect(); delete window.BladeDesktopIcon; }
  window.addEventListener('unload', destroy, {once:true});
  window.BladeDesktopIcon = {update, destroy};
  schedule();
})();
