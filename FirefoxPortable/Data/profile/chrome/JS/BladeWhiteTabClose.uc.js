// ==UserScript==
// @name            Blade WHITE Tab Close
// @description     Immediate native close with bounded monochrome paper shards
// @author          Blade-Creations
// @include         main
// @version         1.0.0
// @loadOrder       121
// ==/UserScript==
(function () {
  'use strict';
  if (window.BladeWhiteTabClose || !window.gBrowser?.tabContainer) return;
  const XHTML = 'http://www.w3.org/1999/xhtml';
  const root = document.documentElement;
  const tabs = window.gBrowser.tabContainer;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const bus = window.Blade?.bus;
  const MAX_ACTIVE = 3, BURST_LIMIT = 6, BURST_WINDOW = 600;
  const MOTION_END = 480, LIFETIME = 560, MIN_REMAINING = 80;
  const scenes = new Set(), pending = new Set(), admissions = [], listeners = [];
  const FONT_PROPERTIES = ['font','font-family','font-size','font-style','font-weight',
    'font-stretch','font-variant','line-height','letter-spacing','direction','text-transform','text-align'];
  let disposed = false, overlay = null, frameId = 0, spawned = 0, skipped = 0, peakActive = 0;
  const now = () => window.performance.now();

  function localEligibility() {
    return !disposed && !window.closed && !document.hidden && !reduced.matches &&
      root.getAttribute('data-blade-theme') === 'white' &&
      root.getAttribute('data-blade-fx-mode') !== 'eco' &&
      root.getAttribute('data-blade-fx-paused') !== 'true' &&
      root.getAttribute('data-blade-material-motion') !== 'off';
  }
  function enabled() {
    if (!localEligibility()) return false;
    if (window.STATE_MINIMIZED !== undefined && window.windowState === window.STATE_MINIMIZED) return false;
    const effects = window.BladeEffects;
    if (typeof effects?.canAnimate !== 'function') return false;
    try { return !!effects.canAnimate(); } catch (error) { return false; }
  }
  function styled(tag, className, declarations) {
    const node = document.createElementNS(XHTML, tag);
    node.className = className;
    for (const [property, value] of Object.entries(declarations || {})) node.style.setProperty(property, String(value));
    node.style.setProperty('pointer-events', 'none', 'important');
    return node;
  }
  function ensureOverlay() {
    if (overlay?.isConnected) return overlay;
    overlay = styled('div','blade-white-tab-close-overlay',{
      position:'fixed',inset:'0','z-index':'1004',overflow:'hidden',isolation:'isolate',
      contain:'strict','user-select':'none'
    });
    overlay.id = 'blade-white-tab-close-overlay';
    overlay.setAttribute('aria-hidden','true'); overlay.setAttribute('inert',''); overlay.inert = true;
    root.appendChild(overlay);
    return overlay;
  }
  function retire(record) {
    if (!scenes.delete(record)) return;
    pending.delete(record); window.clearTimeout(record.timer);
    for (const animation of record.animations) {
      try { animation.cancel(); } catch (error) { /* An already detached effect cannot block retirement. */ }
    }
    record.animations.length = 0; record.node?.remove(); record.node = null; record.snapshot = null;
    if (!pending.size && frameId) { window.cancelAnimationFrame(frameId); frameId = 0; }
    if (!scenes.size) { overlay?.remove(); overlay = null; }
  }
  function clear() {
    for (const record of Array.from(scenes)) retire(record);
    if (frameId) { window.cancelAnimationFrame(frameId); frameId = 0; }
    pending.clear(); admissions.length = 0; overlay?.remove(); overlay = null;
  }
  function validRect(rect) {
    return !!rect && ['left','top','right','bottom','width','height'].every(k => Number.isFinite(rect[k])) &&
      rect.width > 0 && rect.height > 0;
  }
  function captureLabel(tab, rect) {
    const label = tab.querySelector('.tab-label');
    if (!label) return null;
    const labelRect = label.getBoundingClientRect(), labelStyle = window.getComputedStyle(label);
    if (!validRect(labelRect) || labelStyle.display === 'none' || labelStyle.visibility !== 'visible') return null;
    const font = {};
    for (const property of FONT_PROPERTIES) {
      const value = labelStyle.getPropertyValue(property);
      if (value) font[property] = value;
    }
    return {text:String(tab.label || label.value || label.textContent || '').slice(0,2048),
      left:labelRect.left-rect.left,top:labelRect.top-rect.top,width:labelRect.width,height:labelRect.height,font};
  }
  // PERF: rect полосы (#TabsToolbar) одинаков для всех вкладок в пределах одной
  // серии закрытий — кэш по размеру окна + TTL 1с вместо getBoundingClientRect
  // на каждое закрытие (серия до 6 за 600мс давала 6 лишних layout-flush).
  // TTL ловит сдвиг полосы при toggle меню-бара/панели закладок МЕЖДУ сериями
  // (innerHeight при этом не меняется): новая серия >1с читает свежий rect.
  // Индивидуальные rect вкладок НЕ кэшим.
  let stripCache = null;
  function getStripRect() {
    const w = window.innerWidth, h = window.innerHeight, now = performance.now();
    if (stripCache && stripCache.w === w && stripCache.h === h && now - stripCache.t < 1000) return stripCache.r;
    const strip = document.getElementById('TabsToolbar') || tabs;
    const r = strip.getBoundingClientRect();
    stripCache = {w, h, t: now, r};
    return r;
  }
  function snapshot(tab) {
    if (!tab?.isConnected || tab.localName !== 'tab') return null;
    const surface = tab.querySelector('.tab-background') || tab;
    const rect = surface.getBoundingClientRect(), stripRect = getStripRect();
    if (!validRect(rect) || !validRect(stripRect)) return null;
    const style = window.getComputedStyle(surface);
    if (style.display === 'none' || style.visibility !== 'visible') return null;
    const left = Math.max(rect.left,stripRect.left,0), top = Math.max(rect.top,stripRect.top,0);
    const right = Math.min(rect.right,stripRect.right,window.innerWidth);
    const bottom = Math.min(rect.bottom,stripRect.bottom,window.innerHeight);
    if (right <= left || bottom <= top) return null;
    return {left:rect.left,top:rect.top,width:rect.width,height:rect.height,
      radius:style.getPropertyValue('border-radius') || '8px',label:captureLabel(tab,rect)};
  }
  function makeFace(s) {
    const face = styled('div','blade-white-tab-close-face',{
      position:'absolute',inset:'0','box-sizing':'border-box','border-radius':s.radius,
      border:'1px solid #bdbdbd',background:'#eeeeee',color:'#171717',overflow:'hidden'
    });
    if (!s.label) return face;
    const label = styled('div','blade-white-tab-close-label',{
      position:'absolute',left:`${s.label.left}px`,top:`${s.label.top}px`,width:`${s.label.width}px`,
      height:`${s.label.height}px`,display:'flex','align-items':'center',overflow:'hidden'
    });
    const text = styled('span','blade-white-tab-close-label-text',{
      ...s.label.font,display:'block',flex:'1 1 auto','min-width':'0','white-space':'nowrap',
      overflow:'hidden','text-overflow':'ellipsis',color:'#171717'
    });
    text.textContent = s.label.text; label.appendChild(text); face.appendChild(label);
    return face;
  }
  function polygons(columns) {
    const top = [], bottom = [], pieces = [];
    for (let i=0;i<=columns;i++) {
      const edge = i === 0 || i === columns, base = i*100/columns;
      const tilt = edge ? 0 : (i%2 ? -1 : 1)*100/columns*.20;
      top.push(base+tilt); bottom.push(base-tilt);
    }
    const add = points => pieces.push({points,
      x:points.reduce((sum,p)=>sum+p[0],0)/3,y:points.reduce((sum,p)=>sum+p[1],0)/3});
    for (let i=0;i<columns;i++) {
      add([[top[i],0],[top[i+1],0],[bottom[i+1],100]]);
      add([[top[i],0],[bottom[i+1],100],[bottom[i],100]]);
    }
    return pieces;
  }
  function animateFragment(record,scene,face,piece,index,remaining) {
    const fragment = styled('div','blade-white-tab-close-fragment',{
      position:'absolute',inset:'0',
      'clip-path':`polygon(${piece.points.map(p=>`${p[0]}% ${p[1]}%`).join(',')})`,
      'transform-origin':`${piece.x}% ${piece.y}%`,'backface-visibility':'hidden'
    });
    // Only clone our own inert HTML proxy, never a native XUL tab or browser.
    fragment.appendChild(face.cloneNode(true)); scene.appendChild(fragment);
    const sign=index%2 ? 1 : -1, dx=10+piece.x*.22+sign*8, dy=14+piece.y*.32+(index%3)*5;
    const turn=sign*(9+index%4*3), fold=sign*(20+index%3*9);
    const delay=Math.min(index*7,Math.floor(remaining*.16));
    const motion=(amount,sx=1,sy=1)=>`translate3d(${dx*amount}px,${dy*amount}px,0) rotate(${turn*amount}deg) rotateX(${fold*amount}deg) scale(${sx},${sy})`;
    record.animations.push(fragment.animate([
      {offset:0,opacity:.98,transform:motion(0)},
      {offset:.16,opacity:.96,transform:motion(.10)},
      {offset:.64,opacity:.68,transform:motion(.60,.82,.94)},
      {offset:1,opacity:0,transform:motion(1,.28,.72)}
    ],{duration:remaining-delay,delay,easing:'cubic-bezier(.2,.7,.25,1)',fill:'both'}));
  }
  function render(record) {
    if (!scenes.has(record)) return;
    const remaining=MOTION_END-(now()-record.born);
    if (!enabled() || remaining<=MIN_REMAINING) { skipped++; retire(record); return; }
    try {
      const s=record.snapshot;
      const scene=styled('div','blade-white-tab-close',{
        position:'absolute',left:`${s.left}px`,top:`${s.top}px`,width:`${s.width}px`,height:`${s.height}px`,
        perspective:'420px','user-select':'none'
      });
      record.node=scene;
      const face=makeFace(s);
      polygons(record.mode==='balanced' ? 2 : 3).forEach((piece,index)=>animateFragment(record,scene,face,piece,index,remaining));
      ensureOverlay().appendChild(scene); spawned++;
    } catch (error) { retire(record); window.console.error('[BladeWhiteTabClose] render failed',error); }
  }
  function flush() {
    frameId=0;
    for (const record of Array.from(pending)) { pending.delete(record); render(record); }
  }
  function admit(timestamp) {
    while (admissions.length && timestamp-admissions[0]>=BURST_WINDOW) admissions.shift();
    return admissions.length<BURST_LIMIT;
  }
  function closed(event) {
    if (!enabled() || event.detail?.adoptedBy) { skipped++; return; }
    const timestamp=now();
    if (!admit(timestamp)) { skipped++; return; }
    let record=null;
    try {
      // Capture primitive geometry/text before bubbling native consumers run.
      // No method replacement, preventDefault, promise, timer or wait in close.
      const s=snapshot(event.target);
      if (!s) { skipped++; return; }
      while (scenes.size>=MAX_ACTIVE) retire(scenes.values().next().value);
      admissions.push(timestamp);
      record={born:timestamp,snapshot:s,mode:window.BladeEffects.mode(),node:null,animations:[],timer:0};
      scenes.add(record); pending.add(record); peakActive=Math.max(peakActive,scenes.size);
      record.timer=window.setTimeout(()=>retire(record),LIFETIME);
      if (!frameId) frameId=window.requestAnimationFrame(flush);
    } catch (error) {
      skipped++; if (record) retire(record);
      window.console.error('[BladeWhiteTabClose] capture failed',error);
    }
  }
  function sync() { clear(); }
  function blurred(event) { if (event.target===window) clear(); }
  function listen(target,name,callback,options=false) {
    target.addEventListener(name,callback,options);
    listeners.push(()=>target.removeEventListener(name,callback,options));
  }
  const observer=new MutationObserver(sync);
  function destroy() {
    if (disposed) return;
    disposed=true; clear(); observer.disconnect();
    for (const removeListener of listeners.splice(0)) removeListener();
    if (typeof bus?.off==='function') { bus.off('fx:changed',sync); bus.off('theme:changed',sync); }
  }
  observer.observe(root,{attributes:true,attributeFilter:[
    'data-blade-theme','data-blade-fx-mode','data-blade-fx-paused','data-blade-battery','data-blade-material-motion','style'
  ]});
  listen(tabs,'TabClose',closed,{capture:true,passive:true});
  listen(reduced,'change',sync); listen(document,'visibilitychange',sync,true);
  listen(window,'blur',blurred,true); listen(window,'sizemodechange',sync);
  listen(window,'resize',sync); listen(window,'unload',destroy,{once:true});
  if (typeof bus?.on==='function') { bus.on('fx:changed',sync); bus.on('theme:changed',sync); }
  window.BladeWhiteTabClose=Object.freeze({destroy,ownsTheme:theme=>theme==='white',
    status:()=>Object.freeze({active:scenes.size,pending:pending.size,maxActive:MAX_ACTIVE,
      peakActive,spawned,skipped,disposed,enabled:enabled()})});
})();
