import shutil, sys

LOADER = '''// skip 1st line
try {

  let cmanifest = Cc['@mozilla.org/file/directory_service;1'].getService(Ci.nsIProperties).get('UChrm', Ci.nsIFile);
  cmanifest.append('utils');
  cmanifest.append('chrome.manifest');

  if(cmanifest.exists()){
    Components.manager.QueryInterface(Ci.nsIComponentRegistrar).autoRegister(cmanifest);
    ChromeUtils.importESModule('chrome://userchromejs/content/boot.sys.mjs');
  }

} catch(ex) {};

'''

targets = [
    r'C:\Users\Deni\AppData\Local\Blade\App\Blade\config.js',
    r'F:\firefox michael edition\Skeleton-Stage\config.js',
    r'F:\App\Blade\config.js',
]

for t in targets:
    src = open(t, 'r', encoding='utf-8').read()
    lines = src.split('\n')
    # автосид-часть: от pref("blade.debug.loader"...) до конца (пропускаем только строку "// skip 1st line")
    rest = [l for l in lines[1:] if True]
    autoseed = '\n'.join(rest).lstrip('\n')
    if 'boot.sys.mjs' in src and 'bladeAutoSeed' in src:
        print(f'{t}: ALREADY COMBINED, skip')
        continue
    if 'bladeAutoSeed' not in src:
        print(f'{t}: no autoseed?! skip (manual review)')
        continue
    combined = LOADER + autoseed
    shutil.copy2(t, t + '.blade-bak-pre-loaderfix')
    open(t, 'w', encoding='utf-8', newline='\n').write(combined)
    ok = 'boot.sys.mjs' in combined and 'bladeAutoSeed' in combined
    print(f'{t}: FIXED loader+autoseed combined = {ok}, lines={combined.count(chr(10)) + 1}')
