// ==UserScript==
// @name            Blade Home Layout
// @description     Direct homepage composition, saved separately for each wallpaper
// @include         main
// @loadOrder       130
// @version         1.0.0
// ==/UserScript==
(function () {
  if (window.BladeHomeLayout) return;
  const {validateLayout, fitLayout} = ChromeUtils.importESModule('chrome://userscripts/content/BladeHomeLayoutModel.sys.mjs');
  const H = 'http://www.w3.org/1999/xhtml', PREF = 'blade.home.layouts';
  let editing = null, draft = null, editBg = '', overlay = null, gesture = null, frame = 0, clockOriginal = null;
  let tileBase = null, tileRect = null, applying = false, tileZoomX = 1, tileZoomY = 1;
  const isHome = browser => ['about:newtab','about:home'].includes(browser?.currentURI?.spec);
  const bg = () => window.BladeEngine?.activeBg() || 'acheron';
  const viewport = () => window.gBrowser.selectedBrowser.getBoundingClientRect();
  const read = () => {
    try { const data = JSON.parse(Services.prefs.getStringPref(PREF,'{}')); return data && !Array.isArray(data) && typeof data === 'object' ? data : {}; }
    catch (_) {return {};}
  };
  const saved = key => validateLayout(read()[key]);
  const current = () => editing ? draft : saved(bg());
  const state = browser => ({bg:bg(), tiles:(browser === editing ? draft : saved(bg()))?.tiles || null, editing:browser === editing});
  const send = browser => {
    if (!isHome(browser)) return;
    try {browser.browsingContext.currentWindowGlobal?.getActor('BladeEffectsVisibility').sendAsyncMessage('Blade:HomeLayout',state(browser));} catch (_) {}
  };
  const node = (tag, cls, text) => {
    const el = document.createElementNS(H,tag); el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  function clockGeometry() {
    const clock = document.getElementById('blade-hero');
    if (!clock || !isHome(window.gBrowser.selectedBrowser)) return null;
    if (!clockOriginal) clockOriginal = ['translate','scale','transform-origin'].map(name => [name,clock.style.getPropertyValue(name),clock.style.getPropertyPriority(name)]);
    for (const [name,value,priority] of clockOriginal) {
      if (value) clock.style.setProperty(name,value,priority); else clock.style.removeProperty(name);
    }
    const view = viewport(), box = clock.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    const base = {x:box.left + box.width/2-view.left, y:box.top + box.height/2-view.top,width:box.width,height:box.height};
    const point = current()?.clock;
    const result = point ? fitLayout(base,point,view) : {...base,s:1};
    if (point) {
      clock.style.setProperty('transform-origin','center','important');
      clock.style.setProperty('translate',`${result.x-base.x}px ${result.y-base.y}px`,'important');
      clock.style.setProperty('scale',String(result.s),'important');
    }
    return result;
  }
  function place(key, rect) {
    const box = overlay?.querySelector(`[data-part=${key}]`);
    if (!box) return;
    box.hidden = !rect;
    if (!rect) return;
    box.style.left = (rect.x-rect.width/2)+'px'; box.style.top = (rect.y-rect.height/2)+'px';
    box.style.width = rect.width+'px'; box.style.height = rect.height+'px';
    box.dataset.scale = rect.s;
    box.querySelector('.bhl-size').textContent = Math.round(rect.s*100)+'%';
  }
  function render() {
    const clock = clockGeometry();
    if (!editing || !overlay) return;
    const view = viewport();
    overlay.style.left=view.left+'px'; overlay.style.top=view.top+'px';
    overlay.style.width=view.width+'px'; overlay.style.height=view.height+'px';
    place('clock',clock);
    place('tiles',tileGeometry(view));
  }
  function tileGeometry(view) {
    if (!tileBase) return tileRect;
    return draft?.tiles ? fitLayout(tileBase,draft.tiles,{width:view.width,height:view.height,paddingX:tileZoomX*8,paddingY:tileZoomY*8}) : {...tileBase,s:1};
  }
  function refresh() {
    render();
    for (const browser of window.gBrowser.browsers) send(browser);
  }
  function setPoint(key, point) {
    draft ||= {clock:null,tiles:null}; draft[key] = point;
    render();
    if (key === 'tiles') send(editing);
  }
  function stop() {
    if (frame) window.cancelAnimationFrame(frame);
    frame=0; gesture=null;
    const previous = editing;
    editing=null; draft=null; editBg=''; overlay?.remove(); overlay=null;
    render(); if (previous) send(previous);
  }
  function commit() {
    if (!editing || editBg !== bg()) {stop(); return;}
    const value = draft ? validateLayout(draft) : null;
    if (draft && !value) return;
    const data = read();
    if (!value || (!value.clock && !value.tiles)) delete data[editBg];
    else data[editBg] = value;
    // Keep the current wallpaper and the most recently stored entries bounded.
    const entries = Object.entries(data).filter(([key])=>key !== editBg).slice(-127);
    if (data[editBg]) entries.push([editBg,data[editBg]]);
    applying = true;
    try {Services.prefs.setStringPref(PREF,JSON.stringify(Object.fromEntries(entries)));}
    finally {applying=false;}
    stop(); refresh();
  }
  function action(text, callback, cls='') {
    const button=node('button',cls,text);button.type='button';
    button.addEventListener('click',callback);return button;
  }
  function begin() {
    stop();
    let browser=window.gBrowser.selectedBrowser;
    if (!isHome(browser)) {
      const tab=window.gBrowser.addTrustedTab('about:newtab');window.gBrowser.selectedTab=tab;browser=tab.linkedBrowser;
    }
    editing=browser;editBg=bg();draft=saved(editBg);tileBase=null;tileRect=null;
    overlay=node('div','bhl-editor');overlay.id='blade-home-layout-editor';overlay.setAttribute('aria-label','Редактор главной');
    for (const [key,label] of [['clock','Часы'],['tiles','Плитки']]) {
      const box=node('div','bhl-frame');box.dataset.part=key;
      const tag=node('div','bhl-tag');tag.append(node('strong','',label),node('span','bhl-size','100%'));
      for (const [text,mult] of [['−',-.05],['+',.05]]) {
        const button=action(text,()=>{
          const rect=key==='clock'?clockGeometry():tileRect;if(!rect)return;
          const view=viewport();setPoint(key,{x:rect.x/view.width,y:rect.y/view.height,s:Math.max(.5,Math.min(1.5,(draft?.[key]?.s||rect.s)+mult))});
        });button.setAttribute('aria-label',`${mult<0?'Уменьшить':'Увеличить'}: ${label}`);tag.append(button);
      }
      const resize=node('div','bhl-resize','↘');resize.title='Потяните для изменения размера';
      box.append(tag,resize);overlay.append(box);
    }
    const bar=node('div','bhl-bar');
    bar.append(node('span','bhl-help','Перемещайте блоки · угол меняет размер'),action('Сбросить',()=>{draft=null;render();send(editing);}),action('Отмена',stop),action('Сохранить',commit,'bhl-save'));
    overlay.append(bar);document.documentElement.append(overlay);
    overlay.addEventListener('pointerdown',event=>{
      if (event.button!==0 || event.target.closest('button')) return;
      const box=event.target.closest('.bhl-frame');if(!box)return;
      const key=box.dataset.part, view=viewport();
      const rect=key==='clock'?clockGeometry():tileGeometry(view);
      if(!rect)return;
      gesture={key,rect,view,startX:event.clientX,startY:event.clientY,resize:!!event.target.closest('.bhl-resize'),id:event.pointerId};
      box.setPointerCapture(event.pointerId);box.classList.add('bhl-moving');event.preventDefault();
    });
    overlay.addEventListener('pointermove',event=>{
      if (!gesture || event.pointerId!==gesture.id) return;
      gesture.dx=event.clientX-gesture.startX;gesture.dy=event.clientY-gesture.startY;
      if(frame)return;
      frame=window.requestAnimationFrame(()=>{frame=0;updateGesture();});
    });
    const finish=()=>{if(!gesture)return;if(frame)window.cancelAnimationFrame(frame);frame=0;updateGesture();gesture=null;overlay?.querySelector('.bhl-moving')?.classList.remove('bhl-moving');};
    overlay.addEventListener('pointerup',finish);overlay.addEventListener('pointercancel',finish);
    refresh();
  }
  function updateGesture() {
    if(!gesture)return;
    const {key,rect,view,resize,dx=0,dy=0}=gesture;
    let x=rect.x,y=rect.y,s=rect.s;
    if(resize) {
      const projection=(dx*rect.width+dy*rect.height)/(rect.width**2+rect.height**2);
      s=Math.max(.5,Math.min(1.5,rect.s*(1+projection*2)));
    } else {x+=dx;y+=dy;}
    setPoint(key,{x:Math.max(0,Math.min(1,x/view.width)),y:Math.max(0,Math.min(1,y/view.height)),s});
  }
  const style=node('style','');style.textContent=`
    #blade-home-layout-editor {position:fixed;z-index:1000;pointer-events:none;font:12px var(--blade-ui,Rubik,"Segoe UI",sans-serif);color:#eee;--bhl-accent:var(--bob-accent,#ff2a2a);}
    .bhl-frame {position:absolute;border:1px dashed var(--bhl-accent);border-radius:10px;pointer-events:auto;cursor:grab;box-sizing:border-box;background:color-mix(in srgb,var(--bhl-accent) 4%,transparent);touch-action:none;}
    .bhl-frame[hidden] {display:none;}.bhl-moving {cursor:grabbing;border-style:solid;}
    .bhl-tag {position:absolute;top:-30px;left:0;display:flex;align-items:center;gap:8px;height:26px;padding:0 8px;background:#151117ed;border:1px solid #ffffff26;border-radius:6px;white-space:nowrap;}
    .bhl-size {color:#b8aebd;font-size:10px;}.bhl-tag button {padding:0 5px;min-width:22px;}
    .bhl-resize {position:absolute;right:-7px;bottom:-7px;width:24px;height:24px;border:1px solid var(--bhl-accent);border-radius:6px;display:grid;place-items:center;background:#171319;cursor:nwse-resize;font-size:16px;}
    .bhl-bar {position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;pointer-events:auto;background:#151117f5;border:1px solid #ffffff26;border-radius:12px;padding:10px 12px;box-shadow:0 10px 30px #0008;max-width:calc(100% - 24px);box-sizing:border-box;}
    .bhl-editor button {appearance:none;font:inherit;color:inherit;border:1px solid #ffffff25;background:#ffffff08;border-radius:6px;cursor:pointer;padding:7px 10px;white-space:nowrap;}
    .bhl-editor button:hover {border-color:var(--bhl-accent);background:#ffffff10;}.bhl-editor button:focus-visible {outline:2px solid var(--bhl-accent);outline-offset:2px;}
    .bhl-editor .bhl-save {border-color:var(--bhl-accent);background:color-mix(in srgb,var(--bhl-accent) 20%,#171319);}
    .bhl-help {color:#aaa0b1;font-size:11px;white-space:nowrap;margin-right:8px;}
    @media(max-width:800px) {.bhl-help {display:none;}.bhl-bar {gap:5px;padding:8px;}}
  `;document.documentElement.append(style);
  const prefs={observe(_subject,_topic,pref){if(applying)return;if(pref==='bobliks.bg.current'){stop();tileBase=null;tileRect=null;}refresh();}};
  Services.prefs.addObserver(PREF,prefs);Services.prefs.addObserver('bobliks.bg.current',prefs);
  const changed=()=>{stop();tileBase=null;tileRect=null;refresh();};
  window.gBrowser.tabContainer.addEventListener('TabSelect',changed);
  const navigation = {onLocationChange(browser,progress,_request,location) {
    if (!progress?.isTopLevel || browser !== window.gBrowser.selectedBrowser) return;
    if (!['about:newtab','about:home'].includes(location.spec)) {stop();return;}
    tileBase=null;tileRect=null;refresh();
  }};
  window.gBrowser.addTabsProgressListener(navigation);
  const resized=()=>{render();send(window.gBrowser.selectedBrowser);};window.addEventListener('resize',resized);
  const clockResize = new window.ResizeObserver(()=>render());
  const hero = document.getElementById('blade-hero'); if(hero) clockResize.observe(hero);
  const clockReady = event => {if(event.target.id==='blade-hero')render();};document.addEventListener('animationend',clockReady);
  const themeChanged=()=>{render();send(window.gBrowser.selectedBrowser);};window.Blade?.bus?.on('theme:changed',themeChanged);
  window.BladeHomeLayout={begin,stop,state,receive(browser,data){
    if(browser!==window.gBrowser.selectedBrowser || data?.bg!==bg())return;
    const valid=rect=>rect && ['x','y','width','height'].every(key=>Number.isFinite(rect[key])) && rect.width>0 && rect.height>0;
    if(!valid(data.base)||!valid(data.rect))return;
    const view=viewport();
    const sx=data.viewport?.width>0?view.width/data.viewport.width:1;
    const sy=data.viewport?.height>0?view.height/data.viewport.height:1;
    tileZoomX=sx;tileZoomY=sy;
    const chromeRect=rect=>({...rect,x:rect.x*sx,y:rect.y*sy,width:rect.width*sx,height:rect.height*sy});
    tileBase=chromeRect(data.base);tileRect=chromeRect(data.rect);render();
  }};
  window.setTimeout(refresh,0);
  window.addEventListener('unload',()=>{
    stop();style.remove();Services.prefs.removeObserver(PREF,prefs);Services.prefs.removeObserver('bobliks.bg.current',prefs);
    clockResize.disconnect();document.removeEventListener('animationend',clockReady);
    window.gBrowser.removeTabsProgressListener(navigation);
    window.gBrowser.tabContainer.removeEventListener('TabSelect',changed);window.removeEventListener('resize',resized);window.Blade?.bus?.off('theme:changed',themeChanged);
  },{once:true});
})();
