// Тестовый прогон BladeProfileGuard.uc.js под node: заглушки Services/IOUtils/Cc/Ci,
// проверяются хэш-векторы и полная INI-хирургия на реальном содержимом profiles.ini.
'use strict';
const fs = require('fs');
const path = require('path');

const SCRIPT = fs.readFileSync(process.argv[2], 'utf8');
const APPDATA = 'C:\\Users\\Test\\AppData\\Roaming';
const ENGINE_DIR = 'C:\\Users\\Deni\\AppData\\Local\\Blade\\App\\Blade';
const ENGINE_DIR2 = 'F:\\firefox michael edition\\FirefoxPortable\\App\\Firefox64';
const PROF_DIR = 'C:\\Users\\Deni\\AppData\\Local\\Blade\\Data\\profile';
// каталог движка страж выводит из РОДИТЕЛЯ exe (XREExeF.parent — баг-фикс 1.0.1)
const BLADE_EXE = 'C:\\Users\\Deni\\AppData\\Local\\Blade\\App\\Blade\\firefox.exe';
const DEV_EXE = 'F:\\firefox michael edition\\FirefoxPortable\\App\\Firefox64\\firefox.exe';
const STAGE_EXE = 'F:\\firefox michael edition\\Skeleton-Stage\\firefox.exe';
const STAGE_DIR = 'F:\\firefox michael edition\\Skeleton-Stage';

const files = {};          // виртуальная FS: path -> string|Uint8Array
const written = [];        // журнал записей [path, content]
let curEngineExe = BLADE_EXE; // null = ключ XREExeF недоступен
let curGreBinD = null;        // null = ключ GreBinD недоступен
let curProfDir = PROF_DIR;    // P2-аудит (1.0.3): кейс инъекции \r\n в профиле
const dirsvcAsked = [];       // журнал запрошенных ключей (гвард XCurProcD)

function nsFile(p) {
  const cut = p.lastIndexOf('\\');
  return {
    path: p,
    clone() { return nsFile(p); },
    append(name) { this.path += '\\' + name; },
    get parent() { return cut < 0 ? null : nsFile(p.slice(0, cut)); }
  };
}

globalThis.Cc = { '@mozilla.org/process/environment;1': { getService: () => ({ get: (k) => k === 'APPDATA' ? APPDATA : '' }) } };
globalThis.Ci = { nsIFile: 'nsIFile' };
globalThis.Services = {
  appinfo: { processID: 1234 }, // P2-аудит (1.0.3): tmp уникален per-process
  dirsvc: { get: (key) => {
    dirsvcAsked.push(key);
    if (key === 'XREExeF') {
      if (curEngineExe === null) throw new Error('no XREExeF');
      return nsFile(curEngineExe);
    }
    if (key === 'GreBinD') {
      if (curGreBinD === null) throw new Error('no GreBinD');
      return nsFile(curGreBinD);
    }
    if (key === 'ProfD') return nsFile(curProfDir);
    if (key === 'UChrm') return nsFile('F:\\chrome');
    throw new Error('unknown key ' + key);
  } },
  env: { get: (k) => k === 'APPDATA' ? APPDATA : '' },
  wm: { getEnumerator: () => ({ hasMoreElements: () => true, getNext: () => globalThis.__win }) },
};
globalThis.IOUtils = {
  readUTF8: async (p) => {
    if (!(p in files)) { const e = new Error('NotFound'); e.name = 'NotFoundError'; throw e; }
    return files[p];
  },
  read: async (p) => {
    if (!(p in files)) { const e = new Error('NotFound'); e.name = 'NotFoundError'; throw e; }
    return new TextEncoder().encode(files[p]);
  },
  write: async (p, data) => {
    // бэкапы пишутся байтами — декодируем для удобства проверок
    const text = Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8');
    files[p] = text; written.push([p, 'write', text]); return data.length;
  },
  writeUTF8: async (p, text, opts) => {
    files[p] = text;
    written.push([p, 'writeUTF8' + (opts && opts.tmpPath ? '+tmp' : ''), text, opts && opts.tmpPath]);
    return text.length;
  },
  stat: async (p) => { if (!(p in files)) { const e = new Error('NotFound'); e.name = 'NotFoundError'; throw e; } return {}; },
};
globalThis.__win = { setTimeout: (fn) => { globalThis.__timer = fn; return 0; } };
globalThis.window = globalThis.__win;
globalThis.TextEncoder = TextEncoder;

const FAILURES = [];
function check(name, cond, detail) {
  if (cond) console.log('PASS ' + name + (detail ? ' | ' + detail : ''));
  else { console.log('FAIL ' + name + (detail ? ' | ' + detail : '')); FAILURES.push(name); }
}

// live profiles.ini владельца (образец формата) + несуществующий installs.ini
const LIVE_PROFILES_INI = `[General]\r\nStartWithLastProfile=1\r\nVersion=2\r\n\r\n[Profile0]\r\nName=default-release\r\nIsRelative=1\r\nPath=Profiles/6716v8rr.default-release\r\n\r\n[Install841AB720B1601E88]\r\nDefault=Profiles/6716v8rr.default-release\r\nLocked=1\r\n\r\n[Profile2]\r\nName=default-release-1\r\nIsRelative=1\r\nPath=Profiles/r8fcseh1.default-release-1\r\n\r\n[InstallD0DD9ACE5A41BA7D]\r\nDefault=C:\\Users\\Deni\\AppData\\Local\\Blade\\Data\\profile\r\nLocked=1\r\n\r\n[Profile1]\r\nName=default\r\nIsRelative=1\r\nPath=Profiles/zkbk2cdz.default\r\nDefault=1\r\n\r\n[Profile3]\r\nName=Blade\r\nIsRelative=0\r\nPath=C:\\Users\\Deni\\AppData\\Local\\Blade\\Data\\profile\r\n`;

async function loadAndRun() {
  delete globalThis.window.BladeProfileGuard;
  globalThis.__timer = undefined;
  globalThis.__win = { setTimeout: (fn) => { globalThis.__timer = fn; return 0; } };
  globalThis.window = globalThis.__win;
  // исполнение скрипта в глобале (как injectClassicScriptIntoGlobal)
  const fn = new Function(SCRIPT);
  fn.call(globalThis.window);
  const run = globalThis.__timer;
  if (typeof run !== 'function') throw new Error('setTimeout не зарегистрирован');
  await run();
  await new Promise((r) => setTimeout(r, 20)); // дренаж микрозадач
}

(async () => {
  // ---------- ВЕКТОР 1: голый запуск на машине владельца (всё уже прошито вручную) ----------
  curEngineExe = BLADE_EXE; curGreBinD = null; dirsvcAsked.length = 0;
  files[APPDATA + '\\Mozilla\\Firefox\\profiles.ini'] = LIVE_PROFILES_INI;
  await loadAndRun();
  const hash1 = 'D0DD9ACE5A41BA7D';
  const mark1 = files['F:\\chrome\\JS\\BladeProfileGuard_mark.txt'];
  const noIniWrites = !written.some(([p]) => p.endsWith('profiles.ini'));
  check('V1 mark OK + hash', /^v1\.0\.3 OK D0DD9ACE5A41BA7D /.test(mark1), mark1);
  check('V1 движок спрошен через XREExeF (без GreBinD/XCurProcD)',
        dirsvcAsked.includes('XREExeF') && !dirsvcAsked.includes('GreBinD') && !dirsvcAsked.includes('XCurProcD'),
        JSON.stringify(dirsvcAsked));
  check('V1 идемпотентность: profiles.ini не тронут (Default уже верен)', noIniWrites);
  check('V1 installs.ini создан (не существовал)',
        files[APPDATA + '\\Mozilla\\Firefox\\installs.ini'] === `[${hash1}]\r\nDefault=${PROF_DIR}\r\nLocked=1\r\n`,
        JSON.stringify(files[APPDATA + '\\Mozilla\\Firefox\\installs.ini']));
  check('V1 бэкап installs.ini не делался (файла не было)', !written.some(([p]) => p.endsWith('.blade-bak')));

  // ---------- ВЕКТОР 2: dev-профиль F:, секций ещё нет, installs.ini существует ----------
  written.length = 0;
  curEngineExe = DEV_EXE;
  files[APPDATA + '\\Mozilla\\Firefox\\profiles.ini'] = `[General]\r\nStartWithLastProfile=1\r\nVersion=2\r\n\r\n[Install841AB720B1601E88]\r\nDefault=Profiles/6716v8rr.default-release\r\nLocked=1\r\n\r\n[Profile0]\r\nName=default-release\r\nIsRelative=1\r\nPath=Profiles/6716v8rr.default-release\r\n`;
  files[APPDATA + '\\Mozilla\\Firefox\\installs.ini'] = `[ABCDEF0123456789]\r\nDefault=Profiles/6716v8rr.default-release\r\nLocked=1\r\n`;
  await loadAndRun();
  const hash2 = '841AB720B1601E88';
  const pi = files[APPDATA + '\\Mozilla\\Firefox\\profiles.ini'];
  const ii = files[APPDATA + '\\Mozilla\\Firefox\\installs.ini'];
  check('V2 hash в mark', (files['F:\\chrome\\JS\\BladeProfileGuard_mark.txt'] || '').includes('OK ' + hash2),
        files['F:\\chrome\\JS\\BladeProfileGuard_mark.txt']);
  check('V2 [Install841AB720B1601E88] Default=абс. путь',
        /\[Install841AB720B1601E88\]\r\nDefault=C:\\Users\\Deni\\AppData\\Local\\Blade\\Data\\profile\r\nLocked=1/.test(pi));
  check('V2 [Profile1] добавлен Name=Blade IsRelative=0',
        /\[Profile1\]\r\nName=Blade\r\nIsRelative=0\r\nPath=C:\\Users\\Deni\\AppData\\Local\\Blade\\Data\\profile/.test(pi));
  check('V2 чужие секции не тронуты',
        pi.includes('[Profile0]\r\nName=default-release\r\nIsRelative=1\r\nPath=Profiles/6716v8rr.default-release'));
  check('V2 installs.ini: секция дописана, чужая цела',
        ii.startsWith('[ABCDEF0123456789]\r\nDefault=Profiles/6716v8rr.default-release\r\nLocked=1\r\n') &&
        ii.includes(`\r\n[${hash2}]\r\nDefault=${PROF_DIR}\r\nLocked=1\r\n`),
        JSON.stringify(ii));
  check('V2 бэкап profiles.ini.blade-bak создан', (files[APPDATA + '\\Mozilla\\Firefox\\profiles.ini.blade-bak'] || '').startsWith('[General]'));
  check('V2 атомарная запись через tmp', written.some(([p, how]) => p.endsWith('profiles.ini') && how === 'writeUTF8+tmp'));
  check('V2 tmp уникален per-process (P2-аудит 1.0.3)',
        written.some(([p, , , tmp]) => p.endsWith('profiles.ini') && tmp === p + '.1234.blade-tmp'),
        JSON.stringify(written.filter(([p]) => p.endsWith('profiles.ini')).map(([, , , t]) => t)));

  // ---------- ВЕКТОР 3: повторный прогон = ноль записей ----------
  written.length = 0;
  await loadAndRun();
  check('V3 второй прогон: ничего не пишет', written.filter(([p]) => !p.includes('_mark.txt')).length === 0,
        JSON.stringify(written.map(([p]) => path.basename(p))));
  check('V3 mark profiles-ok installs-ok', /profiles-ok installs-ok/.test(files['F:\\chrome\\JS\\BladeProfileGuard_mark.txt']));

  // ---------- ВЕКТОР 4: движок перезаписал Default мусором — страж чинит ----------
  files[APPDATA + '\\Mozilla\\Firefox\\profiles.ini'] =
    files[APPDATA + '\\Mozilla\\Firefox\\profiles.ini'].replace(
      '[Install841AB720B1601E88]\r\nDefault=C:\\Users\\Deni\\AppData\\Local\\Blade\\Data\\profile\r\nLocked=1',
      '[Install841AB720B1601E88]\r\nDefault=Profiles/garbage.default-release-173\r\nLocked=1');
  written.length = 0;
  await loadAndRun();
  const pi4 = files[APPDATA + '\\Mozilla\\Firefox\\profiles.ini'];
  check('V4 чужой Default перебит на наш путь',
        /\[Install841AB720B1601E88\]\r\nDefault=C:\\Users\\Deni\\AppData\\Local\\Blade\\Data\\profile\r\nLocked=1/.test(pi4));
  check('V4 [Profile1] не дублирован', (pi4.match(/\[Profile1\]/g) || []).length === 1);

  // ---------- ВЕКТОР 5: profiles.ini отсутствует → SKIP no-ini ----------
  written.length = 0;
  curEngineExe = DEV_EXE;
  delete files[APPDATA + '\\Mozilla\\Firefox\\profiles.ini'];
  await loadAndRun();
  check('V5 SKIP no-ini', /^v1\.0\.3 SKIP no-ini$/.test(files['F:\\chrome\\JS\\BladeProfileGuard_mark.txt']),
        files['F:\\chrome\\JS\\BladeProfileGuard_mark.txt']);
  check('V5 ничего не писал', written.length === 1 && written[0][0].includes('_mark.txt'));

  // ---------- ВЕКТОР 7: stage-движок — хэш от РОДИТЕЛЯ firefox.exe ----------
  // живой баг 1.0.0: XCurProcD отдавал ...\browser → мусорный 5BF0C4DCA731B12E;
  // правильный хэш каталога Skeleton-Stage (эталон cityhash_blade.py) — 5429A0681078FC6F
  dirsvcAsked.length = 0;
  curEngineExe = STAGE_EXE; curGreBinD = null;
  files[APPDATA + '\\Mozilla\\Firefox\\profiles.ini'] =
    '[General]\r\nStartWithLastProfile=1\r\nVersion=2\r\n';
  await loadAndRun();
  const pi7 = files[APPDATA + '\\Mozilla\\Firefox\\profiles.ini'];
  check('V7 stage-хэш = хэш РОДИТЕЛЯ exe (5429A0681078FC6F)',
        (files['F:\\chrome\\JS\\BladeProfileGuard_mark.txt'] || '').includes('OK 5429A0681078FC6F') &&
        pi7.includes('[Install5429A0681078FC6F]') &&
        !pi7.includes('5BF0C4DCA731B12E'),
        files['F:\\chrome\\JS\\BladeProfileGuard_mark.txt']);
  check('V7 движок получен через XREExeF, XCurProcD не запрашивался',
        dirsvcAsked.includes('XREExeF') && !dirsvcAsked.includes('XCurProcD') && !dirsvcAsked.includes('GreBinD'),
        JSON.stringify(dirsvcAsked));

  // ---------- ВЕКТОР 8: XREExeF недоступен — фолбэк GreBinD ----------
  curEngineExe = null; curGreBinD = STAGE_DIR;
  await loadAndRun();
  check('V8 фолбэк GreBinD: тот же правильный хэш, идемпотентно',
        (files['F:\\chrome\\JS\\BladeProfileGuard_mark.txt'] || '').includes('OK 5429A0681078FC6F profiles-ok'),
        files['F:\\chrome\\JS\\BladeProfileGuard_mark.txt']);

  // ---------- ВЕКТОР 9: оба ключа недоступны → ERR no-engine-dir ----------
  curGreBinD = null;
  await loadAndRun();
  check('V9 ERR no-engine-dir',
        files['F:\\chrome\\JS\\BladeProfileGuard_mark.txt'] === 'v1.0.3 ERR no-engine-dir',
        files['F:\\chrome\\JS\\BladeProfileGuard_mark.txt']);

  // ---------- ВЕКТОР 10: пропуск нумерации (Profile0, Profile2; нет Profile1) ----------
  // движок обрывает перебор на первом пропуске — страж обязан занять дырку [Profile1],
  // а не лепить [Profile3] (баг-фикс 1.0.2: maxN+1 сохранял пропуск)
  curEngineExe = DEV_EXE; curGreBinD = null;
  files[APPDATA + '\\Mozilla\\Firefox\\profiles.ini'] =
    '[General]\r\nStartWithLastProfile=1\r\nVersion=2\r\n\r\n[Profile0]\r\nName=default\r\nIsRelative=1\r\nPath=Profiles/zkbk2cdz.default\r\n\r\n[Profile2]\r\nName=default-release-1\r\nIsRelative=1\r\nPath=Profiles/r8fcseh1.default-release-1\r\n';
  files[APPDATA + '\\Mozilla\\Firefox\\installs.ini'] = '[ABCDEF0123456789]\r\nDefault=Profiles/6716v8rr.default-release\r\nLocked=1\r\n';
  written.length = 0;
  await loadAndRun();
  const pi10 = files[APPDATA + '\\Mozilla\\Firefox\\profiles.ini'];
  check('V10 занята дырка [Profile1], НЕ создан [Profile3]',
        /\[Profile1\]\r\nName=Blade\r\nIsRelative=0\r\nPath=C:\\Users\\Deni\\AppData\\Local\\Blade\\Data\\profile/.test(pi10) &&
        !pi10.includes('[Profile3]'),
        JSON.stringify(pi10));
  check('V10 чужие Profile0/Profile2 не тронуты (без перенумерации)',
        pi10.includes('[Profile0]\r\nName=default\r\nIsRelative=1\r\nPath=Profiles/zkbk2cdz.default') &&
        pi10.includes('[Profile2]\r\nName=default-release-1\r\nIsRelative=1\r\nPath=Profiles/r8fcseh1.default-release-1'));
  // повторный прогон: наша секция находится по Path — дырка не занимается дважды
  written.length = 0;
  await loadAndRun();
  check('V10 повторный прогон: ничего не пишет',
        written.filter(([p]) => !p.includes('_mark.txt')).length === 0);

  // ---------- ВЕКТОР 11: только Profile5 (нет 0-4) → создаём [Profile0] ----------
  curEngineExe = DEV_EXE;
  files[APPDATA + '\\Mozilla\\Firefox\\profiles.ini'] =
    '[General]\r\nStartWithLastProfile=1\r\nVersion=2\r\n\r\n[Profile5]\r\nName=stray\r\nIsRelative=1\r\nPath=Profiles/stray.profile\r\n';
  await loadAndRun();
  const pi11 = files[APPDATA + '\\Mozilla\\Firefox\\profiles.ini'];
  check('V11 создан [Profile0] (наименьший свободный)',
        /\[Profile0\]\r\nName=Blade\r\nIsRelative=0\r\nPath=C:\\Users\\Deni\\AppData\\Local\\Blade\\Data\\profile/.test(pi11),
        JSON.stringify(pi11));
  check('V11 чужой Profile5 не тронут, лишних ProfileN нет',
        (pi11.match(/\[Profile\d+\]/g) || []).length === 2 &&
        pi11.includes('[Profile5]\r\nName=stray\r\nIsRelative=1\r\nPath=Profiles/stray.profile'));
  check('GLOBAL XCurProcD ни разу не запрашивался за все прогоны', !dirsvcAsked.includes('XCurProcD'));

  // ---------- ВЕКТОР 12 (P2-аудит): инъекция \r\n в пути профиля ----------
  // dirsvc-путь с переводами строк в значении Path сломал бы парсер INI
  // (создал бы секцию [InjectedSection]) — 1.0.3 санитизирует пути
  curEngineExe = DEV_EXE; curGreBinD = null;
  curProfDir = 'C:\\Users\\Deni\\AppData\\Local\\Blade\\Data\\profile\r\n[InjectedSection]\r\nAdmin=1';
  files[APPDATA + '\\Mozilla\\Firefox\\profiles.ini'] =
    '[General]\r\nStartWithLastProfile=1\r\nVersion=2\r\n';
  written.length = 0;
  await loadAndRun();
  const pi12 = files[APPDATA + '\\Mozilla\\Firefox\\profiles.ini'];
  const pi12lines = pi12.split('\r\n');
  check('V12 \\r\\n в profDir: секции-инъекции нет (INI структурно цел)',
        !pi12lines.some((l) => l.trim().startsWith('[InjectedSection]')) &&
        !pi12lines.some((l) => l.trim() === 'Admin=1'),
        JSON.stringify(pi12lines));
  check('V12 Path санитизирован: \\r\\n вырезаны, значение однострочное',
        pi12lines.some((l) => l.startsWith('Path=C:\\Users\\Deni\\AppData\\Local\\Blade\\Data\\profile[InjectedSection]Admin=1')),
        JSON.stringify(pi12lines.filter((l) => l.startsWith('Path='))));
  check('V12 mark OK (не ERR)',
        /^v1\.0\.3 OK 841AB720B1601E88 /.test(files['F:\\chrome\\JS\\BladeProfileGuard_mark.txt'] || ''),
        files['F:\\chrome\\JS\\BladeProfileGuard_mark.txt']);
  curProfDir = PROF_DIR;

  // ---------- ВЕКТОР 6: не-первое окно молча выходит ----------
  written.length = 0;
  delete globalThis.window.BladeProfileGuard;
  globalThis.__timer = undefined;
  globalThis.__win = { setTimeout: (fn) => { globalThis.__timer = fn; return 0; } };
  globalThis.window = globalThis.__win;
  globalThis.Services.wm = { getEnumerator: () => ({ hasMoreElements: () => true, getNext: () => ({ other: true }) }) };
  const fn6 = new Function(SCRIPT);
  fn6.call(globalThis.window);
  check('V6 не-первое окно: таймер не взведён', globalThis.__timer === undefined || globalThis.__timer === null);

  console.log(FAILURES.length === 0 ? '\nALL TESTS PASSED' : '\nFAILED: ' + FAILURES.join(', '));
  process.exit(FAILURES.length === 0 ? 0 : 1);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
