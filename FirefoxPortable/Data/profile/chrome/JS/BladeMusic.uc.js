// ==UserScript==
// @name            Blade Music
// @description     YouTube Music controls in menu B through the native tab media session
// @include         main
// @version         1.2.0
// @loadOrder       116
// ==/UserScript==
(function () {
  if (window.BladeMusic) return;
  const ns='http://www.w3.org/1999/xhtml', svgNS='http://www.w3.org/2000/svg';
  const events=['activated','deactivated','metadatachange','playbackstatechange','supportedkeyschange'];
  const controllers=new Set();
  let popup=null, card=null, target=null, frame=0, disposed=false;
  const hotkeyPref='blade.music.hotkeys';
  const hotkeyLabels={previous:'Предыдущий трек',next:'Следующий трек',backward:'Назад на 10 с',forward:'Вперёд на 10 с'};
  const actionKeys={previous:'previoustrack',next:'nexttrack',backward:'seekbackward',forward:'seekforward'};
  try {
    ChromeUtils.registerWindowActor('BladeMusicContent', {
      parent:{esModuleURI:'chrome://userscripts/content/BladeMusicContent/BladeMusicContentParent.sys.mjs'},
      child:{esModuleURI:'chrome://userscripts/content/BladeMusicContent/BladeMusicContentChild.sys.mjs'},
      matches:['https://music.youtube.com/*'], remoteTypes:['web','webIsolated'],
      safeForUntrustedWebProcess:true, allFrames:false,
    });
  } catch(e) { if(e.name!=='NotSupportedError')window.Blade?.mark('music_actor',String(e)); }
  function contentActor(tab) {
    if(!tab || tab.hasAttribute('pending') || !ytTab(tab))return null;
    try { return tab.linkedBrowser.browsingContext.currentWindowGlobal.getActor('BladeMusicContent'); } catch(_) {return null;}
  }
  let bindings={}, recording=null, handledPrintable=null;
  const keyset=document.createXULElement('keyset');keyset.id='blade-music-keyset';
  document.documentElement.append(keyset);
  const style=document.createElementNS(ns,'style'); style.id='blade-music-style';
  style.textContent=`
    #bobliks-settings-popup .bp-music { display:grid; grid-template-columns:32px minmax(0,1fr) auto; gap:9px; align-items:center; flex:none; margin:0 12px 10px; padding:10px; border:1px solid #ffffff16; border-radius:10px; background:linear-gradient(125deg,#ffffff05,#00000024); }
    #bobliks-settings-popup .bp-music-mark { display:grid; place-items:center; width:30px; height:30px; color:var(--bob-accent,#ff2a2a); background:#00000030; border:1px solid #ffffff12; border-radius:9px; }
    #bobliks-settings-popup .bp-music svg { width:16px; height:16px; fill:currentColor; }
    #bobliks-settings-popup .bp-music-copy { min-width:0; }
    #bobliks-settings-popup .bp-music-title { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#f2edf5; font-size:11px; font-weight:600; }
    #bobliks-settings-popup .bp-music-status { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#aaa3b3; font-size:10px; margin-top:3px; }
    #bobliks-settings-popup .bp-music-controls { display:flex; gap:3px; }
    #bobliks-settings-popup .bp-music button { display:grid; place-items:center; width:26px; height:28px; padding:0; border:1px solid transparent; border-radius:7px; background:transparent; color:#e1dbe8; cursor:pointer; }
    #bobliks-settings-popup .bp-music button:hover:enabled { border-color:#ffffff20; background:#ffffff0b; color:var(--bob-accent,#ff2a2a); }
    #bobliks-settings-popup .bp-music button:disabled { opacity:.28; cursor:default; }
    #bobliks-settings-popup .bp-music button:focus-visible { outline:2px solid var(--bob-accent,#ff2a2a); outline-offset:1px; }
    #bobliks-settings-popup .bp-music [data-music-action=toggle] { background:#ffffff07; border-color:#ffffff15; }
    #bobliks-settings-popup .bp-music-hotkeys { grid-column:1/-1; border-top:1px solid #ffffff12; padding-top:7px; }
    #bobliks-settings-popup .bp-music .bp-music-settings { display:flex; width:100%; height:23px; justify-content:space-between; padding:0 3px; color:#aaa3b3; font-size:10px; }
    #bobliks-settings-popup .bp-music-hotkey-list { display:grid; gap:5px; padding-top:7px; }
    #bobliks-settings-popup .bp-music-hotkey-list[hidden] { display:none; }
    #bobliks-settings-popup .bp-music-hotkey-row { display:grid; grid-template-columns:minmax(0,1fr) minmax(90px,auto) 23px; gap:5px; align-items:center; font-size:10px; color:#ccc5d4; }
    #bobliks-settings-popup .bp-music .bp-music-shortcut { width:100%; min-height:25px; height:auto; padding:4px 7px; border-color:#ffffff17; background:#00000027; font-size:10px; }
    #bobliks-settings-popup .bp-music .bp-music-shortcut[data-recording=true] { border-color:var(--bob-accent,#ff2a2a); color:#fff; }
    #bobliks-settings-popup .bp-music-hotkey-note { font-size:10px; line-height:1.4; color:#aaa3b3; margin:4px 0 0; }
    #bobliks-settings-popup .bp-music-hotkey-note[data-error=true] { color:#ffb3b3; }
  `;
  document.documentElement.append(style);
  const icons={
    previous:'M6 4H4v16h2V4Zm13 0L8 12l11 8V4Z',
    next:'M18 4h2v16h-2V4ZM5 4l11 8-11 8V4Z',
    play:'M7 4v16l13-8L7 4Z', pause:'M6 4h4v16H6V4Zm8 0h4v16h-4V4Z',
    open:'M4 4h16v16H4V4Zm2 2v12h12V6H6Zm3 2 7 4-7 4V8Z',
  };
  function icon(node,name) {
    node.replaceChildren(); const svg=document.createElementNS(svgNS,'svg');
    svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('aria-hidden','true');
    const path=document.createElementNS(svgNS,'path');path.setAttribute('d',icons[name]);svg.append(path);node.append(svg);
  }
  function ytTab(tab) {
    try { return !tab.closing && tab.linkedBrowser.currentURI.host==='music.youtube.com'; } catch(e) { return false; }
  }
  function ytTabs() { return Array.from(gBrowser.tabs).filter(ytTab); }
  function validChord(chord) {
    return chord && typeof chord==='object' && typeof chord.code==='string' &&
      /^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-9]|2[0-4])|Arrow(Left|Right|Up|Down)|Home|End|PageUp|PageDown|Insert|Space)$/.test(chord.code) &&
      typeof chord.ctrl==='boolean' && typeof chord.alt==='boolean' && typeof chord.shift==='boolean' && (chord.ctrl||chord.alt);
  }
  function virtualKey(code) {
    if(code.startsWith('Key'))return 'VK_'+code.slice(3);
    if(code.startsWith('Digit'))return 'VK_'+code.slice(5);
    return 'VK_'+({ArrowLeft:'LEFT',ArrowRight:'RIGHT',ArrowUp:'UP',ArrowDown:'DOWN',PageUp:'PAGE_UP',PageDown:'PAGE_DOWN'}[code]||code.toUpperCase());
  }
  function signature(chord) {return [virtualKey(chord.code),chord.ctrl,chord.alt,chord.shift].join(':');}
  function label(chord) {return chord ? [chord.ctrl?'Ctrl':'',chord.alt?'Alt':'',chord.shift?'Shift':'',chord.code.replace(/^Key|^Digit/,'').replace('Arrow','')].filter(Boolean).join(' + ') : 'Назначить';}
  function conflict(action,chord) {
    // Firefox handles caret browsing imperatively, outside its visible keysets.
    if(chord.code==='F7')return 'F7 используется браузером для курсорной навигации';
    if(chord.alt&&!chord.ctrl&&!chord.shift&&['F4','Space'].includes(chord.code))return 'Сочетание используется системой';
    for(const [other,value] of Object.entries(bindings))if(other!==action&&signature(value)===signature(chord))return 'Уже назначено: '+hotkeyLabels[other];
    for(const key of document.querySelectorAll('key')) {
      if(keyset.contains(key))continue;
      const modifiers=(key.getAttribute('modifiers')||'').toLowerCase().split(/[\s,]+/);
      // "any" permits additional modifiers; such a native key must stay untouched.
      const ctrl=modifiers.includes('control')||modifiers.includes('ctrl')||modifiers.includes('accel');
      const alt=modifiers.includes('alt'),shift=modifiers.includes('shift');
      const nativeKey=(key.getAttribute('keycode')||('VK_'+(key.getAttribute('key')||'').toUpperCase())).toUpperCase();
      if(nativeKey!==virtualKey(chord.code))continue;
      if(modifiers.includes('any') ? (!ctrl||chord.ctrl)&&(!alt||chord.alt)&&(!shift||chord.shift) : ctrl===chord.ctrl&&alt===chord.alt&&shift===chord.shift)
        return 'Сочетание уже используется браузером';
    }
    return '';
  }
  function setHotkey(action,chord) {
    if(!Object.hasOwn(hotkeyLabels,action))return {ok:false,error:'Неизвестное действие'};
    if(chord!==null&&!validChord(chord))return {ok:false,error:'Добавь Ctrl или Alt к букве, стрелке или F-клавише'};
    const error=chord&&conflict(action,chord);if(error)return {ok:false,error};
    if(chord)bindings[action]={code:chord.code,ctrl:chord.ctrl,alt:chord.alt,shift:chord.shift};else delete bindings[action];
    Services.prefs.setStringPref(hotkeyPref,JSON.stringify(bindings));
    rebuildKeys();renderHotkeys();return {ok:true};
  }
  function enabled(action) {
    const tab=selectTarget(),c=controller(tab);
    return !!contentActor(tab) || !!c?.isActive && new Set(c.supportedKeys||[]).has(actionKeys[action]);
  }
  function refreshKeys() {
    for(const key of keyset.children) {
      if(recording||!enabled(key.dataset.musicHotkey))key.setAttribute('disabled','true');
      else key.removeAttribute('disabled');
    }
  }
  function rebuildKeys() {
    keyset.replaceChildren();
    for(const [action,chord] of Object.entries(bindings)) {
      if(conflict(action,chord))continue;
      const key=document.createXULElement('key');key.dataset.musicHotkey=action;key.id='blade-music-key-'+action;
      if(/^(Key|Digit)/.test(chord.code))key.setAttribute('key',chord.code.replace(/^Key|^Digit/,'').toLowerCase());
      else key.setAttribute('keycode',virtualKey(chord.code));
      key.setAttribute('reserved','true');
      key.setAttribute('modifiers',[chord.ctrl?'control':'',chord.alt?'alt':'',chord.shift?'shift':''].filter(Boolean).join(','));
      key.addEventListener('command',()=>{
        // A physical printable key can already have been handled before Gecko's
        // character-based keyset lookup (including another keyboard layout).
        if(handledPrintable?.action===action&&Date.now()-handledPrintable.time<250)return;
        act(action);
      });keyset.append(key);
    }
    refreshKeys();
  }
  function note(message,error=false) {
    const node=card?.querySelector('.bp-music-hotkey-note');if(node){node.textContent=message;node.dataset.error=String(error);}
  }
  function renderHotkeys() {
    for(const button of card?.querySelectorAll('[data-music-bind]')||[]) {
      const action=button.dataset.musicBind;button.textContent=recording===action?'Нажми сочетание…':label(bindings[action]);button.dataset.recording=String(recording===action);
      button.setAttribute('aria-label',hotkeyLabels[action]+': '+button.textContent);
    }
    refreshKeys();
  }
  function cancelRecording() {recording=null;renderHotkeys();}
  function keydown(ev) {
    if(!ev.isTrusted)return;
    if(!recording) {
      refreshKeys();
      // Holding a chord should skip once, rather than racing through the queue.
      const match=Object.keys(bindings).find(a=>{const c=bindings[a];return ev.code===c.code&&ev.ctrlKey===c.ctrl&&ev.altKey===c.alt&&ev.shiftKey===c.shift;});
      if(ev.repeat&&match&&enabled(match)) {ev.preventDefault();ev.stopImmediatePropagation();}
      else if(match&&/^(Key|Digit)/.test(ev.code)&&!ev.metaKey&&!ev.getModifierState('AltGraph')&&act(match)) {
        handledPrintable={action:match,time:Date.now()};ev.preventDefault();ev.stopImmediatePropagation();
      }
      return;
    }
    ev.preventDefault();ev.stopImmediatePropagation();
    if(ev.repeat)return;
    if(ev.key==='Escape'){cancelRecording();note('Назначение отменено');return;}
    if(ev.key==='Backspace'||ev.key==='Delete'){const action=recording;cancelRecording();setHotkey(action,null);note('Сочетание удалено');return;}
    if(['Control','Alt','Shift','Meta'].includes(ev.key))return;
    if(ev.metaKey||ev.getModifierState('AltGraph')){note('Выбери сочетание с Ctrl или Alt',true);return;}
    const result=setHotkey(recording,{code:ev.code,ctrl:ev.ctrlKey,alt:ev.altKey,shift:ev.shiftKey});
    if(result.ok){cancelRecording();note('Сохранено · работает в окне браузера');}else note(result.error,true);
  }
  function prefChanged() {
    let saved={};try{saved=JSON.parse(Services.prefs.getStringPref(hotkeyPref,'{}'));}catch(e){}
    bindings={};for(const action of Object.keys(hotkeyLabels))if(validChord(saved?.[action]))bindings[action]={...saved[action]};
    rebuildKeys();renderHotkeys();
  }
  function controller(tab) {
    // Reading a live context is harmless; never restore a pending tab for metadata.
    if (!tab || tab.hasAttribute('pending')) return null;
    try { return tab.linkedBrowser.browsingContext?.mediaController || null; } catch(e) { return null; }
  }
  function selectTarget() {
    const tabs=ytTabs();
    return tabs.find(t=>controller(t)?.isPlaying) ||
      (tabs.includes(gBrowser.selectedTab) ? gBrowser.selectedTab : null) ||
      tabs.find(t=>controller(t)?.isActive) || tabs[0] || null;
  }
  function visible() { return popup && ['open','showing'].includes(popup.state); }
  function detach() {
    for(const c of controllers) for(const event of events) c.removeEventListener(event,schedule);
    controllers.clear();
    if(frame) { window.cancelAnimationFrame(frame);frame=0; }
    target=null;
  }
  function schedule() {
    if(disposed || !visible() || frame) return;
    frame=window.requestAnimationFrame(()=>{frame=0;sync();});
  }
  function sync() {
    if(!card || !visible() || disposed) return;
    const live=new Set(ytTabs().map(controller).filter(Boolean));
    for(const c of controllers) if(!live.has(c)) { for(const event of events)c.removeEventListener(event,schedule);controllers.delete(c); }
    for(const c of live) if(!controllers.has(c)) { controllers.add(c);for(const event of events)c.addEventListener(event,schedule); }
    target=selectTarget(); const c=controller(target);
    let meta={}; try { if(c?.isActive) meta=c.getMetadata() || {}; } catch(e) {}
    const title=card.querySelector('.bp-music-title'), status=card.querySelector('.bp-music-status');
    title.textContent=meta.title || 'YouTube Music'; title.title=title.textContent;
    const state=target?.hasAttribute('pending') ? 'Вкладка спит' : c?.isActive ? (c.isPlaying ? 'Играет' : 'На паузе') : target ? 'Выбери трек на сайте' : 'Открыть музыку';
    status.textContent=[meta.artist,state].filter(Boolean).join(' · '); status.title=status.textContent;
    const supported=new Set(c?.supportedKeys || []);
    for(const action of ['previous','next']) card.querySelector(`[data-music-action=${action}]`).disabled=!enabled(action);
    const toggle=card.querySelector('[data-music-action=toggle]');
    const key=c?.isPlaying ? 'pause' : 'play';
    toggle.disabled=!c?.isActive || !(supported.has(key)||supported.has('playpause'));
    icon(toggle,c?.isPlaying ? 'pause' : 'play');toggle.title=c?.isPlaying ? 'Пауза' : 'Продолжить';toggle.setAttribute('aria-label',toggle.title);
    card.dataset.playing=String(!!c?.isPlaying);
  }
  function act(action) {
    if(disposed) return false;
    const tab=selectTarget(), c=controller(tab);
    if(action==='open') {
      popup?.hidePopup();
      if(tab) gBrowser.selectedTab=tab;
      else window.openTrustedLinkIn('https://music.youtube.com/','tab');
      return true;
    }
    const actor=Object.hasOwn(actionKeys,action)&&contentActor(tab);
    if(actor) {
      // YouTube Music does not consistently advertise all four MediaSession actions.
      // Its own player controls and media element remain usable without those flags.
      actor.sendQuery('BladeMusic:Action',{action}).then(handled=>{
        if(!handled&&!disposed&&!tab.closing&&ytTab(tab))nativeAct(tab,action);
        schedule();
      }).catch(()=>{if(!disposed&&!tab.closing&&ytTab(tab))nativeAct(tab,action);});
      return true;
    }
    return nativeAct(tab,action);
  }
  function nativeAct(tab,action) {
    const c=controller(tab);
    if(!c?.isActive) return false;
    const supported=new Set(c.supportedKeys);
    let handled=false;
    try {
      if(action==='previous' && supported.has('previoustrack')) {c.prevTrack();handled=true;}
      else if(action==='next' && supported.has('nexttrack')) {c.nextTrack();handled=true;}
      else if(action==='backward' && supported.has('seekbackward')) {c.seekBackward(10);handled=true;}
      else if(action==='forward' && supported.has('seekforward')) {c.seekForward(10);handled=true;}
      else if(action==='toggle') {
        const key=c.isPlaying ? 'pause' : 'play';
        if(supported.has(key)||supported.has('playpause')) {
          if(c.isPlaying)c.pause('user');else c.play();
          handled=true;
        }
      }
    } catch(e) { handled=false;const status=card?.querySelector('.bp-music-status');if(status)status.textContent='Открой вкладку музыки'; }
    schedule();
    return handled;
  }
  function mount(panel) {
    if(disposed || !panel) return;
    if(popup!==panel) { detach();popup?.removeEventListener('popuphidden',hidden);popup=panel;popup.addEventListener('popuphidden',hidden);card?.remove();card=null; }
    if(card?.isConnected) { sync();return; }
    const wrap=popup.querySelector('.bp-wrap'), sound=popup.querySelector('.bp-sound');
    if(!wrap || !sound)return;
    card=document.createElementNS(ns,'div');card.className='bp-music';card.id='blade-menu-music';
    const mark=document.createElementNS(ns,'span');mark.className='bp-music-mark';icon(mark,'open');
    const copy=document.createElementNS(ns,'div');copy.className='bp-music-copy';
    const title=document.createElementNS(ns,'span');title.className='bp-music-title';title.textContent='YouTube Music';
    const status=document.createElementNS(ns,'span');status.className='bp-music-status';status.textContent='Открыть музыку';copy.append(title,status);
    const controls=document.createElementNS(ns,'div');controls.className='bp-music-controls';
    for(const [action,label,glyph] of [['previous','Предыдущий трек','previous'],['toggle','Продолжить','play'],['next','Следующий трек','next'],['open','Открыть YouTube Music','open']]) {
      const button=document.createElementNS(ns,'button');button.type='button';button.dataset.musicAction=action;button.title=label;button.setAttribute('aria-label',label);button.disabled=action!=='open';icon(button,glyph);
      button.addEventListener('click',ev=>{ev.stopPropagation();act(action);});controls.append(button);
    }
    const settings=document.createElementNS(ns,'div');settings.className='bp-music-hotkeys';
    const disclosure=document.createElementNS(ns,'button');disclosure.type='button';disclosure.className='bp-music-settings';disclosure.textContent='Клавиши управления музыкой  ▾';disclosure.setAttribute('aria-expanded','false');disclosure.setAttribute('aria-controls','blade-music-hotkey-list');
    const list=document.createElementNS(ns,'div');list.className='bp-music-hotkey-list';list.id='blade-music-hotkey-list';list.hidden=true;
    disclosure.addEventListener('click',ev=>{ev.stopPropagation();list.hidden=!list.hidden;disclosure.setAttribute('aria-expanded',String(!list.hidden));if(list.hidden)cancelRecording();});
    for(const [action,labelText] of Object.entries(hotkeyLabels)) {
      const row=document.createElementNS(ns,'div');row.className='bp-music-hotkey-row';
      const caption=document.createElementNS(ns,'span');caption.textContent=labelText;
      const assign=document.createElementNS(ns,'button');assign.type='button';assign.className='bp-music-shortcut';assign.dataset.musicBind=action;
      assign.addEventListener('click',ev=>{ev.stopPropagation();recording=recording===action?null:action;renderHotkeys();note(recording?'Нажми сочетание · Esc — отмена · Delete — удалить':'Работает в окне браузера, когда открыт YouTube Music');});
      const clear=document.createElementNS(ns,'button');clear.type='button';clear.textContent='×';clear.title='Удалить сочетание: '+labelText;clear.setAttribute('aria-label',clear.title);
      clear.addEventListener('click',ev=>{ev.stopPropagation();cancelRecording();setHotkey(action,null);note('Сочетание удалено');});
      row.append(caption,assign,clear);list.append(row);
    }
    const hint=document.createElementNS(ns,'p');hint.className='bp-music-hotkey-note';hint.setAttribute('role','status');hint.textContent='Работает в окне браузера, когда открыт YouTube Music';list.append(hint);settings.append(disclosure,list);
    card.append(mark,copy,controls,settings);wrap.insertBefore(card,sound);renderHotkeys();sync();
  }
  function showing(ev) { if(ev.target.id==='bobliks-settings-popup') {mount(ev.target);schedule();} }
  function hidden(ev) { if(ev.target===popup && !visible()){cancelRecording();detach();} }
  function tabEvent(ev) { if(ev.type==='TabClose' && ev.target===target)target=null;refreshKeys();schedule(); }
  const tabEvents=['TabOpen','TabClose','TabSelect','TabAttrModified'];
  function destroy() {
    if(disposed)return;disposed=true;detach();
    window.removeEventListener('popupshowing',showing);window.removeEventListener('popupshown',showing);popup?.removeEventListener('popuphidden',hidden);
    for(const event of tabEvents)gBrowser.tabContainer.removeEventListener(event,tabEvent);
    window.removeEventListener('keydown',keydown,true);Services.prefs.removeObserver(hotkeyPref,prefChanged);keyset.remove();
    window.removeEventListener('unload',destroy);card?.remove();style.remove();popup=null;card=null;
  }
  window.BladeMusic={mount,destroy,act,setHotkey,hotkeys:()=>JSON.parse(JSON.stringify(bindings)),status:()=>({disposed,listeners:controllers.size,visible:!!visible(),target:target?.linkedBrowser?.currentURI?.spec || '',card:!!card?.isConnected,recording,hotkeys:Object.keys(bindings).length})};
  Services.prefs.addObserver(hotkeyPref,prefChanged);prefChanged();window.addEventListener('keydown',keydown,true);
  window.addEventListener('popupshowing',showing);window.addEventListener('popupshown',showing);
  for(const event of tabEvents)gBrowser.tabContainer.addEventListener(event,tabEvent);
  window.addEventListener('unload',destroy,{once:true});
  mount(document.getElementById('bobliks-settings-popup'));
  window.Blade?.mark('music','v1.2.0 OK');
})();
