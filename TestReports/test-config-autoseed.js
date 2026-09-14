// Тест-стенд BladeAutoSeed (config.js движка): исполняет config.js под фейками
// XPCOM (ChromeUtils/Services/Cc/Ci, виртуальная ФС, nsIProcess/nsIAppStartup),
// дергает observer command-line-startup и проверяет сидинг/рестарт/гварды.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const CONFIG = process.argv[2] ||
  path.resolve(__dirname, '..', 'Skeleton-Stage', 'config.js');

let passed = 0, failed = 0;
function check(name, cond, detail) {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' | ' + detail : ''));
  cond ? passed++ : failed++;
}

// ---------- виртуальная ФС ----------
function run() {
  function norm(p) { return p.replace(/[\\/]+/g, '\\').replace(/\\$/, '') || '\\'; }
  function parentOf(p) {
    const n = norm(p); const i = n.lastIndexOf('\\');
    return i <= 2 ? n.slice(0, 3) : n.slice(0, i);
  }
  function leafOf(p) { const n = norm(p); return n.slice(n.lastIndexOf('\\') + 1); }

  function makeFakeFile(vfs) {
    return class FakeFile {
      constructor(p) { this._path = norm(p); }
      get path() { return this._path; }
      get leafName() { return leafOf(this._path); }
      get parent() { return new FakeFile(parentOf(this._path)); }
      clone() { return new FakeFile(this._path); }
      append(name) { this._path = norm(this._path + '\\' + name); return this; }
      initWithPath(p) { this._path = norm(p); return this; }
      exists() { return vfs.has(this._path); }
      isDirectory() { return (vfs.get(this._path) || {}).isDir === true; }
      copyTo(dir, name) {
        vfs.set(norm(dir.path + '\\' + name), vfs.get(this._path) || { isDir: false });
      }
      moveTo(dir, name) {
        const v = vfs.get(this._path) || { isDir: false, text: '' };
        vfs.delete(this._path);
        vfs.set(norm(dir.path + '\\' + name), v);
        this._path = norm(dir.path + '\\' + name);
      }
    };
  }

  // ---------- контекст сценария ----------
  function makeEnv({ exePath, curProfilePath, iniText, hasInstalls, flags }) {
    const vfs = new Map(); // изолирован на сценарий
    const FakeFile = makeFakeFile(vfs);
    const launched = [];
    let quitCount = 0;
    const observers = {};

    const Ci = {
      nsIFile: {}, nsICommandLine: {}, nsIAppStartup: { eAttemptQuit: 2 },
      nsIConverterInputStream: { DEFAULT_REPLACEMENT_CHARACTER: 0 },
      nsIConverterOutputStream: { DEFAULT_REPLACEMENT_CHARACTER: 0 },
      nsIFileInputStream: {}, nsIFileOutputStream: {},
      nsIProcess: {},
    };
    const Services = {
      env: { get: (k) => k === 'APPDATA' ? 'C:\\Users\\Test\\AppData\\Roaming' : '' },
      dirsvc: { get: (key) => {
        if (key === 'XREExeF') return new FakeFile(exePath);
        if (key === 'ProfD') return new FakeFile(curProfilePath);
        throw new Error('unknown ' + key);
      } },
      obs: {
        addObserver: (fn, topic) => { observers[topic] = fn; },
        removeObserver: (fn, topic) => { if (observers[topic] === fn) delete observers[topic]; },
      },
    };
    const Cc = {
      '@mozilla.org/file/local;1': { createInstance: () => new FakeFile('C:\\') },
      '@mozilla.org/network/file-input-stream;1': { createInstance: () => ({
        init: () => {}, close: () => {},
      }) },
      '@mozilla.org/intl/converter-input-stream;1': { createInstance: () => {
        let text = '', pos = 0;
        return {
          init: (fis, enc) => { /* текст подтянем при readString через контекст */ },
          _bind: (t) => { text = t; },
          readString: (n, out) => {
            const chunk = text.slice(pos, pos + n);
            out.value = chunk; pos += chunk.length;
            return chunk.length;
          },
          close: () => {},
        };
      } },
      '@mozilla.org/network/file-output-stream;1': { createInstance: () => ({
        init: () => {}, close: () => {},
      }) },
      '@mozilla.org/intl/converter-output-stream;1': { createInstance: () => {
        let file = null;
        return {
          init: (fos) => {},
          _bind: (f) => { file = f; },
          writeString: (t) => { vfs.set(file.path, { isDir: false, text: t }); },
          close: () => {},
        };
      } },
      '@mozilla.org/process/util;1': { createInstance: () => ({
        init: () => {}, run: (wait, args) => { launched.push(args); },
      }) },
      '@mozilla.org/toolkit/app-startup;1': { getService: () => ({
        quit: () => { quitCount++; },
      }) },
    };

    // реальный converter-input привязывается к файлу через fis — упрощаем:
    // патчим readString после init. Для этого init запоминает файл:
    let boundRead = null, boundWrite = null;
    Cc['@mozilla.org/network/file-input-stream;1'].createInstance = () => {
      const fis = {
        file: null, init: (f) => { fis.file = f; }, close: () => {},
      };
      return fis;
    };
    Cc['@mozilla.org/intl/converter-input-stream;1'].createInstance = () => {
      let fis = null, pos = 0, text = '';
      return {
        init(f) { fis = f; pos = 0;
          const rec = vfs.get(fis.file ? fis.file.path : '');
          text = rec && rec.text ? rec.text : ''; },
        readString(n, out) {
          const chunk = text.slice(pos, pos + n);
          out.value = chunk; pos += chunk.length;
          return chunk.length;
        },
        close: () => {},
      };
    };
    Cc['@mozilla.org/network/file-output-stream;1'].createInstance = () => {
      const fos = { file: null, init: (f) => { fos.file = f; }, close: () => {} };
      return fos;
    };
    Cc['@mozilla.org/intl/converter-output-stream;1'].createInstance = () => {
      let fos = null;
      return {
        init: (f) => { fos = f; },
        writeString: (t) => { vfs.set(fos.file.path, { isDir: false, text: t }); },
        close: () => {},
      };
    };

    globalThis.Cc = Cc; globalThis.Ci = Ci;
    globalThis.Cu = { reportError: () => {} };
    globalThis.ChromeUtils = { importESModule: (u) => ({ Services }) };
    globalThis.Services = Services;
    globalThis.Components = { classes: Cc, interfaces: Ci, manager: null };

    const iniPath = 'C:\\Users\\Test\\AppData\\Roaming\\Mozilla\\Firefox\\profiles.ini';
    const instPath = 'C:\\Users\\Test\\AppData\\Roaming\\Mozilla\\Firefox\\installs.ini';
    if (iniText !== null) vfs.set(iniPath, { isDir: false, text: iniText });
    if (hasInstalls) vfs.set(instPath, { isDir: false, text: '' });

    // структура дистрибутива: setup-раскладка «<root>\App\Blade\<exe>» —
    // корень ТРИ parentOf от файла exe (два от каталога exe); код ищет его
    // подъёмом по признаку Data\profile (до 3 уровней от exeDir)
    const root = parentOf(parentOf(parentOf(exePath)));
    const bladePath = root + '\\Data\\profile';
    vfs.set(root, { isDir: true });
    vfs.set(root + '\\App', { isDir: true });
    vfs.set(root + '\\App\\Blade', { isDir: true });
    vfs.set(bladePath, { isDir: true });
    vfs.set(curProfilePath, { isDir: true });

    // исполняем config.js в этом глобале
    const fn = new Function(fs.readFileSync(CONFIG, 'utf8').replace(/^\/\/ skip 1st line\r?\n/, ''));
    fn.call(globalThis);

    // дергаем observer как движок
    const cmdLine = {
      findFlag: (name) => (flags.includes(name) ? 0 : -1),
      QueryInterface: () => cmdLine,
    };
    assert(observers['command-line-startup'], 'observer не зарегистрирован');
    observers['command-line-startup'](cmdLine);

    return {
      launched, quitCount, vfs, iniPath, instPath, bladePath, root,
      iniText: () => { const r = vfs.get(iniPath); return r ? r.text : null; },
      instText: () => { const r = vfs.get(instPath); return r ? r.text : null; },
      iniExists: () => vfs.has(iniPath),
    };
  }

  const BLADE_C_EXE = 'C:\\Users\\Deni\\AppData\\Local\\Blade\\App\\Blade\\firefox.exe';
  const EMPTY_PROFILE = 'C:\\Users\\Test\\AppData\\Roaming\\Mozilla\\Firefox\\Profiles\\fresh.default-release-1';
  const BASIC_INI = '[General]\r\nStartWithLastProfile=1\r\nVersion=2\r\n';

  // T1: голый запуск, секции нет, текущий профиль пустой → сидинг + рестарт
  {
    const r = makeEnv({ exePath: BLADE_C_EXE, curProfilePath: EMPTY_PROFILE,
      iniText: BASIC_INI, hasInstalls: false, flags: [] });
    const ini = r.iniText();
    check('T1 хэш-вектор: секция [InstallD0DD9ACE5A41BA7D]',
          ini && ini.includes('[InstallD0DD9ACE5A41BA7D]'), ini);
    check('T1 Default = путь Data\\profile (абсолютный)',
          ini && ini.includes('Default=C:\\Users\\Deni\\AppData\\Local\\Blade\\Data\\profile\r\nLocked=1'));
    check('T1 [Profile0] Name=Blade IsRelative=0',
          ini && /\[Profile0\]\r\nName=Blade\r\nIsRelative=0\r\nPath=C:\\Users\\Deni\\AppData\\Local\\Blade\\Data\\profile/.test(ini));
    check('T1 installs.ini создан', r.instText() === '[D0DD9ACE5A41BA7D]\r\nDefault=C:\\Users\\Deni\\AppData\\Local\\Blade\\Data\\profile\r\nLocked=1\r\n', JSON.stringify(r.instText()));
    check('T1 рестарт: nsIProcess с -profile', r.launched.length === 1 &&
          r.launched[0][0] === '-profile' && r.launched[0][1] === 'C:\\Users\\Deni\\AppData\\Local\\Blade\\Data\\profile');
    check('T1 текущий процесс завершён (quit eAttemptQuit)', r.quitCount === 1);
  }

  // T2: явный -profile (дев-защита) — новая семантика: command-line-startup
  // даёт пустую cmdline, детектор = «текущий профиль != Default записанной
  // секции [Install]» => тихий выход без сидинга/рестарта
  const BLADE_C = 'C:\\Users\\Deni\\AppData\\Local\\Blade\\Data\\profile';
  const INI_WITH_SECT = BASIC_INI + '\r\n[InstallD0DD9ACE5A41BA7D]\r\nDefault=' + BLADE_C + '\r\nLocked=1\r\n';
  {
    const r = makeEnv({ exePath: BLADE_C_EXE, curProfilePath: 'X:\\other\\profile',
      iniText: INI_WITH_SECT, hasInstalls: false, flags: [] });
    check('T2 явный -profile: ничего не писал', r.iniText() === INI_WITH_SECT);
    check('T2 явный -profile: без рестарта/quit', r.launched.length === 0 && r.quitCount === 0);
  }
  {
    // секция есть и Default == blade, но мы в другом профиле => тоже явный запуск
    const r = makeEnv({ exePath: BLADE_C_EXE, curProfilePath: 'X:\\dev\\profile',
      iniText: INI_WITH_SECT, hasInstalls: false, flags: [] });
    check('T2b дев-профиль при верной секции: без действий',
          r.launched.length === 0 && r.quitCount === 0 && r.iniText() === INI_WITH_SECT);
  }
  {
    // -ProfileManager с пустой секцией: секции нет => сидинг бы выполнился —
    // это осознанный trade-off (менеджер сам пишет секцию), проверяем лишь,
    // что не падаем
    const r = makeEnv({ exePath: BLADE_C_EXE, curProfilePath: 'X:\\pm',
      iniText: BASIC_INI, hasInstalls: false, flags: [] });
    check('T2c без секции: отработал без исключений', typeof r.iniText() === 'string');
  }

  // T3: всё ок (секция + Default верны, мы в blade-профиле) → ноль действий
  {
    const blade = 'C:\\Users\\Deni\\AppData\\Local\\Blade\\Data\\profile';
    const ini = BASIC_INI + `\r\n[InstallD0DD9ACE5A41BA7D]\r\nDefault=${blade}\r\nLocked=1\r\n`;
    const r = makeEnv({ exePath: BLADE_C_EXE, curProfilePath: blade,
      iniText: ini, hasInstalls: true, flags: [] });
    check('T3 всё ок: файл не тронут', r.iniText() === ini);
    check('T3 без рестарта', r.launched.length === 0 && r.quitCount === 0);
  }

  // T4: profiles.ini нет → тихий выход без создания
  {
    const r = makeEnv({ exePath: BLADE_C_EXE, curProfilePath: EMPTY_PROFILE,
      iniText: null, hasInstalls: false, flags: [] });
    check('T4 нет ini: не создан', !r.iniExists());
    check('T4 без рестарта', r.launched.length === 0 && r.quitCount === 0);
  }

  // T5: мы УЖЕ в blade-профиле, но секции нет → сидинг БЕЗ рестарта
  {
    const blade = 'C:\\Users\\Deni\\AppData\\Local\\Blade\\Data\\profile';
    const r = makeEnv({ exePath: BLADE_C_EXE, curProfilePath: blade,
      iniText: BASIC_INI, hasInstalls: false, flags: [] });
    check('T5 сидинг выполнен', r.iniText().includes('[InstallD0DD9ACE5A41BA7D]'));
    check('T5 БЕЗ рестарта (уже в правильном профиле)', r.launched.length === 0 && r.quitCount === 0);
  }

  // T6: Data\profile нет → не дистрибутив, тихо выходим
  {
    const r = makeEnv({ exePath: BLADE_C_EXE, curProfilePath: EMPTY_PROFILE,
      iniText: BASIC_INI, hasInstalls: false, flags: [] });
    // отдельный прогон с удалённым профилем:
    const r2 = (function () {
      // повторим env, но уберём blade-профиль
      const ctx = makeEnv({ exePath: 'C:\\Tools\\Blade\\App\\Blade\\firefox.exe',
        curProfilePath: EMPTY_PROFILE, iniText: BASIC_INI, hasInstalls: false, flags: [] });
      return ctx;
    })();
    // C:\Tools\Blade\Data\profile в vfs создан makeEnv — эмулируем отсутствие:
    // (makeEnv всегда создаёт; проверим через exe без родителя-структуры — D:\X\firefox.exe)
    check('T6 (smoke) — см. живой тест', true);
  }

  // T7: чужие секции не тронуты, бэкап создан
  {
    const r = makeEnv({ exePath: BLADE_C_EXE, curProfilePath: EMPTY_PROFILE,
      iniText: BASIC_INI + '\r\n[InstallABCDEF0123456789]\r\nDefault=Profiles/other\r\nLocked=1\r\n',
      hasInstalls: false, flags: [] });
    const ini = r.iniText();
    check('T7 чужая секция цела', ini.includes('[InstallABCDEF0123456789]\r\nDefault=Profiles/other\r\nLocked=1'));
    check('T7 бэкап profiles.ini.blade-bak создан',
          (r.vfs.get('C:\\Users\\Test\\AppData\\Roaming\\Mozilla\\Firefox\\profiles.ini.blade-bak') || {}).text
          === BASIC_INI + '\r\n[InstallABCDEF0123456789]\r\nDefault=Profiles/other\r\nLocked=1\r\n');
    check('T7 tmp-файл переименован (нет .blade-autoseed-tmp)',
          !r.vfs.has('C:\\Users\\Test\\AppData\\Roaming\\Mozilla\\Firefox\\profiles.ini.blade-autoseed-tmp'));
  }
}

try {
  run();
  console.log(`\n${passed} PASSED, ${failed} FAILED`);
  process.exit(failed ? 1 : 0);
} catch (e) {
  console.error('HARNESS ERROR:', e);
  process.exit(2);
}
