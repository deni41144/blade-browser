'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const updaterPath = path.join(__dirname, '..', 'FirefoxPortable', 'Data', 'profile', 'chrome', 'JS', 'BladeUpdater.uc.js');
const source = fs.readFileSync(updaterPath, 'utf8');
const script = new vm.Script(source, { filename: updaterPath });
const SCHEMA_PREF = 'blade.registration.schema';
const PS_EXE = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const win = path.win32;

function machine(options = {}) {
  const local = options.local || 'C:\\Users\\Test User\\AppData\\Local';
  const root = win.join(local, 'Blade');
  const profile = win.join(root, 'Data', 'profile');
  const exe = win.join(root, 'App', options.engine || 'Blade', 'firefox.exe');
  const prefs = new Map(Object.entries(options.prefs || {}));
  const processes = [];
  const prefWrites = [];
  const notifications = [];
  const logs = [];
  let shared = new Map();
  const timers = [];
  const missing = new Set((options.missing || []).map(p => win.normalize(p).toLowerCase()));
  const behavior = { spawnError: !!options.spawnError, prefError: !!options.prefError };

  class File {
    constructor(value = '') { this.path = value; }
    initWithPath(value) {
      assert.ok(win.isAbsolute(value), 'Firefox file path must be absolute');
      this.path = value;
    }
    clone() { return new File(this.path); }
    append(value) { this.path = win.join(this.path, value); }
    normalize() { this.path = win.normalize(this.path); }
    equals(other) { return this.path.toLowerCase() === other.path.toLowerCase(); }
    exists() { return !missing.has(win.normalize(this.path).toLowerCase()); }
  }

  const Ci = { nsIFile: {}, nsIProcess: {} };
  const Cc = {
    '@mozilla.org/file/local;1': { createInstance: () => new File() },
    '@mozilla.org/process/util;1': {
      createInstance() {
        return {
          init(file) { this.executable = file.path; },
          run() { assert.fail('Registration must not use detached run'); },
          runAsync() { assert.fail('Registration must use wide runwAsync'); },
          runwAsync(args, count, observer, weak) {
            assert.equal(count, args.length);
            assert.equal(weak, false, 'Process observer must be strongly held');
            assert.equal(this.startHidden, true);
            assert.equal(this.noShell, true);
            if (behavior.spawnError) throw new Error('mock process launch failure');
            this.args = Array.from(args);
            this.command = Buffer.from(args[7], 'base64').toString('utf16le');
            this.observer = observer;
            processes.push(this);
          },
          QueryInterface(iid) { assert.equal(iid, Ci.nsIProcess); return this; },
        };
      },
    },
  };

  const prefService = {
    getIntPref(name, fallback) {
      if (!prefs.has(name)) return fallback;
      if (typeof prefs.get(name) !== 'number') throw new Error('Wrong preference type');
      return prefs.get(name);
    },
    getBoolPref(name, fallback) { return prefs.has(name) ? prefs.get(name) : fallback; },
    getStringPref(name, fallback) { return prefs.has(name) ? prefs.get(name) : fallback; },
    setIntPref(name, value) {
      if (behavior.prefError) throw new Error('mock preference failure');
      assert.equal(name, SCHEMA_PREF, 'Registration may only write schema preference');
      prefWrites.push({ name, value });
      prefs.set(name, value);
    },
  };

  function openWindow(overrides = {}) {
    const actualProfile = overrides.profile || profile;
    const actualExe = overrides.exe || exe;
    const dirs = {
      ProfD: actualProfile, XREExeF: actualExe,
      CurProcD: overrides.curProc || win.dirname(actualExe),
      UChrm: win.join(actualProfile, 'chrome'),
    };
    const window = {
      gNotificationBox: {
        PRIORITY_INFO_HIGH: 1,
        appendNotification(kind, details) {
          notifications.push({ kind, label: details.label });
          return {};
        },
      },
    };
    const context = vm.createContext({
      window, Ci, Cc,
      Services: {
        // Windows Gecko has no hidden DOM window. Fail if implementation depends on it.
        appShell: { get hiddenDOMWindow() { assert.fail('Windows hiddenDOMWindow unavailable'); } },
        ppmm: { sharedData: {
          get: key => structuredClone(shared.get(key)),
          set: (key, value) => shared.set(key, structuredClone(value)),
        } },
        prefs: prefService,
        env: { get: name => name === 'LOCALAPPDATA' ? local : '' },
        dirsvc: {
          get(name) {
            if (overrides.dirFailure) throw new Error('mock directory service failure');
            assert.ok(Object.hasOwn(dirs, name), 'Unexpected Firefox directory ' + name);
            return new File(dirs[name]);
          },
        },
      },
      PathUtils: { join: win.join, parent: win.dirname },
      IOUtils: {
        async readUTF8(file) {
          if (win.basename(file) === 'VERSION') return '2.3.4';
          if (win.basename(file) === 'CODENAME') return '';
          throw new Error('No update result fixture');
        },
        async writeUTF8(file, value) { logs.push({ file, value }); },
        async remove() { assert.fail('No real profile files may be removed'); },
      },
      btoa: value => Buffer.from(value, 'latin1').toString('base64'),
      setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
      clearTimeout() {},
      fetch() { assert.fail('Fixture must not use network'); },
      console,
    });
    script.runInContext(context);
    return { context, api: window.BladeUpdater, reinject: () => script.runInContext(context) };
  }

  function finish(proc, exit, topic = 'process-finished') {
    proc.exitValue = exit;
    proc.observer.observe(proc, topic, null);
  }
  return {
    local, root, profile, exe, prefs, processes, prefWrites, notifications, logs, missing, behavior, timers,
    openWindow, finish, restart() { shared = new Map(); },
  };
}

function assertCommand(proc, expected) {
  assert.equal(proc.executable, PS_EXE);
  assert.deepEqual(proc.args.slice(0, 7), ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-EncodedCommand']);
  assert.equal(proc.args.length, 8);
  assert.equal(proc.command, expected);
  assert.equal(proc.args[7], Buffer.from(expected, 'utf16le').toString('base64'));
}

function expectedCommand(m, registerOnly = true) {
  const quote = value => value.replace(/'/g, "''");
  const registrar = win.join(m.profile, 'chrome', 'resources', 'set-blade-default.ps1');
  return "& '" + quote(registrar) + "' -EnginePath '" + quote(m.root) + "'" + (registerOnly ? ' -RegisterOnly' : '');
}

test('installed startup repairs schema2 independently of update prefs and old done flag', () => {
  const m = machine({ prefs: { 'blade.update.auto': false, 'blade.setdefault.done': true } });
  const w = m.openWindow();
  assert.equal(w.api.canSetDefault(), true);
  assert.equal(w.api.moduleVersion, '1.3.8');
  assert.equal(m.processes.length, 1);
  assertCommand(m.processes[0], expectedCommand(m));
  assert.equal(m.prefs.has(SCHEMA_PREF), false);
  assert.equal(m.notifications.length, 0);
  m.finish(m.processes[0], 0);
  assert.deepEqual(m.prefWrites, [{ name: SCHEMA_PREF, value: 2 }]);
  assert.equal(m.prefs.get('blade.setdefault.done'), true);
  assert.equal(m.notifications.length, 0);
  assert.ok(m.logs.every(entry => entry.value.startsWith('v1.3.8 ')));
});

test('repeated windows and reinjection cannot race pending repair', () => {
  const m = machine();
  const w = m.openWindow();
  w.reinject(); m.openWindow(); m.openWindow();
  assert.equal(m.processes.length, 1);
  assert.equal(w.api.setDefault(), false);
  assert.equal(m.processes.length, 1);
  m.finish(m.processes[0], 0);
  m.openWindow(); m.restart(); m.openWindow();
  assert.equal(m.processes.length, 1);
  assert.equal(m.prefWrites.length, 1);
});

for (const schema of [2, 3]) {
  test('schema ' + schema + ' skips repair but keeps explicit Windows choice', () => {
    const m = machine({ prefs: { [SCHEMA_PREF]: schema } });
    const w = m.openWindow();
    assert.equal(m.processes.length, 0);
    assert.equal(w.api.setDefault(), true);
    assertCommand(m.processes[0], expectedCommand(m, false));
    m.finish(m.processes[0], 2);
    assert.equal(m.prefs.get(SCHEMA_PREF), schema);
    assert.equal(m.prefWrites.length, 0);
    assert.ok(m.notifications.some(n => n.label.includes('Windows') && n.label.includes('Set default')));
  });
}

for (const exit of [1, 2, 7]) {
  test('repair exit ' + exit + ' never marks success and retries only next startup', () => {
    const m = machine({ prefs: { [SCHEMA_PREF]: 1 } });
    m.openWindow(); m.finish(m.processes[0], exit);
    assert.equal(m.prefs.get(SCHEMA_PREF), 1);
    assert.equal(m.prefWrites.length, 0);
    assert.equal(m.notifications.length, 0);
    m.openWindow(); assert.equal(m.processes.length, 1);
    m.restart(); m.openWindow(); assert.equal(m.processes.length, 2);
    m.finish(m.processes[1], 0); assert.equal(m.prefs.get(SCHEMA_PREF), 2);
  });
}

test('process-failed cannot mark schema even with exitValue zero', () => {
  const m = machine();
  m.openWindow(); m.finish(m.processes[0], 0, 'process-failed');
  assert.equal(m.prefWrites.length, 0);
  m.openWindow(); assert.equal(m.processes.length, 1);
  m.restart(); m.openWindow(); assert.equal(m.processes.length, 2);
});

test('spawn exception releases lock; manual retry remains possible', () => {
  const m = machine({ spawnError: true });
  const w = m.openWindow(); m.openWindow();
  assert.equal(m.processes.length, 0); assert.equal(m.prefWrites.length, 0);
  m.behavior.spawnError = false;
  assert.equal(w.api.setDefault(), true);
  assertCommand(m.processes[0], expectedCommand(m, false));
  m.finish(m.processes[0], 2); assert.equal(m.prefWrites.length, 0);
  m.restart(); m.openWindow(); assertCommand(m.processes[1], expectedCommand(m));
});

test('failed repair permits manual retry; stale observer cannot mark schema', () => {
  const m = machine(); const w = m.openWindow(); const old = m.processes[0];
  m.finish(old, 1); assert.equal(w.api.setDefault(), true);
  m.finish(old, 0); assert.equal(m.prefWrites.length, 0);
  assert.equal(w.api.setDefault(), false);
  m.finish(m.processes[1], 2); assert.equal(m.prefWrites.length, 0);
  assert.equal(w.api.setDefault(), true);
});

test('duplicate completion and unrelated topic cannot mark migration twice', () => {
  const m = machine(); m.openWindow();
  m.finish(m.processes[0], 0, 'unexpected-topic'); assert.equal(m.prefWrites.length, 0);
  m.openWindow(); assert.equal(m.processes.length, 1);
  m.finish(m.processes[0], 0); m.finish(m.processes[0], 0);
  assert.equal(m.prefWrites.length, 1);
});

for (const exit of [0, 1, 2]) {
  test('explicit exit ' + exit + ' reports observed result without forcing defaults', () => {
    const m = machine({ prefs: { [SCHEMA_PREF]: 2 } }); const w = m.openWindow();
    assert.equal(w.api.setDefault(), true); assertCommand(m.processes[0], expectedCommand(m, false));
    assert.ok(!m.notifications.some(n => n.label.includes('Set default')));
    m.finish(m.processes[0], exit); assert.equal(m.prefWrites.length, 0);
    const last = m.notifications.at(-1);
    assert.equal(last.kind, exit === 1 ? 'blade-update-error' : 'blade-update-notification');
    assert.equal(last.label.includes('Set default'), exit === 2);
  });
}

const development = 'F:\\dev\\FirefoxPortable';
for (const [name, overrides] of [
  ['development profile, installed executable', { profile: win.join(development, 'Data', 'profile') }],
  ['installed profile, development executable', { exe: win.join(development, 'App', 'Firefox64', 'firefox.exe') }],
  ['development executable and profile', { profile: win.join(development, 'Data', 'profile'), exe: win.join(development, 'App', 'Firefox64', 'firefox.exe') }],
  ['wrong executable filename', { exe: 'C:\\Users\\Test User\\AppData\\Local\\Blade\\App\\Blade\\other.exe' }],
  ['directory service failure', { dirFailure: true }],
]) {
  test(name + ' refuses automatic and explicit registration', () => {
    const m = machine(); const w = m.openWindow(overrides);
    assert.equal(w.api.canSetDefault(), false); assert.equal(w.api.setDefault(), false);
    assert.equal(m.processes.length, 0); assert.equal(m.prefWrites.length, 0);
    m.openWindow(); assert.equal(m.processes.length, 1, 'Rejected window cannot claim repair attempt');
  });
}

test('installed Firefox64 and canonical paths supported despite unrelated CWD', () => {
  const m = machine({ engine: 'Firefox64' });
  const w = m.openWindow({ profile: m.profile.toUpperCase(), exe: m.exe.toUpperCase(), curProc: 'F:\\unrelated-directory' });
  assert.equal(w.api.canSetDefault(), true); assert.equal(m.processes.length, 1);
  assert.ok(m.processes[0].command.includes("-EnginePath '" + m.root + "'"));
});

test('spaces, apostrophes and supplementary Unicode survive UTF16LE encoding', () => {
  const m = machine({ local: "C:\\Users\\O'Brien " + String.fromCodePoint(0x1f600) + "\\AppData\\Local" });
  m.openWindow(); assertCommand(m.processes[0], expectedCommand(m));
  assert.ok(m.processes[0].command.includes("O''Brien"));
});

for (const missing of ['registrar', 'powershell']) {
  test('missing ' + missing + ' leaves migration retryable, no per-window launches', () => {
    const m = machine();
    const file = missing === 'registrar' ? win.join(m.profile, 'chrome', 'resources', 'set-blade-default.ps1') : PS_EXE;
    m.missing.add(win.normalize(file).toLowerCase());
    const w = m.openWindow(); m.openWindow();
    assert.equal(m.processes.length, 0); assert.equal(m.prefWrites.length, 0);
    assert.ok(m.logs.every(entry => !entry.value.includes('\r')), 'Error paths must not contain accidental carriage returns');
    m.missing.clear(); assert.equal(w.api.setDefault(), true);
    m.finish(m.processes[0], 2); m.restart(); m.openWindow();
    assertCommand(m.processes[1], expectedCommand(m));
  });
}

test('preference write failure releases lock and retries next startup', () => {
  const m = machine({ prefError: true }); const w = m.openWindow();
  m.finish(m.processes[0], 0); assert.equal(m.prefWrites.length, 0);
  assert.equal(w.api.setDefault(), true); m.finish(m.processes[1], 2);
  m.behavior.prefError = false; m.restart(); m.openWindow();
  m.finish(m.processes[2], 0); assert.equal(m.prefs.get(SCHEMA_PREF), 2);
});
