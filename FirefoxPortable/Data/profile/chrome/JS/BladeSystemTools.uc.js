// ==UserScript==
// @name            Blade System Tools
// @description     Системные утилиты: уведомления (gNotificationBox) и запуск
//                  бэкапа профиля через PowerShell. Экспортирует
//                  window.BladeSystemTools.launchBackup для меню B и палитры
// @author          Blade-Creations
// @include         main
// @version         1.0.0
// @loadOrder       12
// ==/UserScript==
(function () {
  if (window.BladeSystemTools) return;
  window.BladeSystemTools = true;

  let markPath = '';
  try {
    const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
    d.append('JS');
    markPath = d.path + '\\BladeSystemTools_mark.txt';
  } catch (e) {}
  const mark = (m, e) => {
    try {
      if (!markPath) return;
      const text = 'v1.0.0 ' + m + (e ? '\n' + String(e) + '\n' + (e && e.stack || '') : '');
      IOUtils.writeUTF8(markPath, text).catch(() => {});
    } catch (e2) {}
  };

  // Шаг 4 декомпозиции BobliksSettings: системные утилиты вынесены из монолита.
  // DoH/RAM-чистка остались в клик-диспетчере меню (шаг 8) — они намертво
  // пришиты к dispatcher; этот модуль забрал только автономные функции.
  function notifyBlade(label) {
    try {
      const nb = window.gNotificationBox;
      nb.appendNotification('blade-backup-notification', {
        label,
        image: 'chrome://browser/skin/notification-icons/popup.svg',
        priority: nb.PRIORITY_INFO_HIGH,
      }, [], false);
    } catch (e) { mark('ERR notify ' + e); }
  }

  // Бэкап профиля: BladeCore.runPsEncoded гонит resources\blade-backup.ps1
  // через powershell.exe -EncodedCommand (base64 UTF-16LE, без аргументов
  // командной строки — пробелы в путях не рвутся)
  function launchBackup() {
    try {
      const script = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      script.append('resources'); script.append('blade-backup.ps1');
      if (!script.exists()) {
        notifyBlade('нет chrome\\resources\\blade-backup.ps1');
        return;
      }
      const q = (s) => String(s).replace(/'/g, "''");
      const profDir = Services.dirsvc.get('ProfD', Ci.nsIFile).path;
      const psLine = "& '" + q(script.path) + "' -ProfileDir '" + q(profDir) + "'";
      try {
        window.Blade.runPsEncoded(psLine);
        notifyBlade('⚡ Бэкап профиля создаётся — архив появится в папке Backups рядом с браузером.');
      } catch (e) {
        notifyBlade('не удалось запустить бэкап: ' + e.message);
      }
    } catch (e) { mark('ERR backup ' + e); }
  }

  mark('START');

  window.BladeSystemTools = { launchBackup, notify: notifyBlade };

  mark('OK tools');
})();
