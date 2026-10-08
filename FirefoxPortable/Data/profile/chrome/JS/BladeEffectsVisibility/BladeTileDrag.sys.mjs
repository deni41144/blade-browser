// Visual accompaniment to Firefox's own Top Sites drag/reorder implementation.
// Never intercepts native events or writes Top Sites preferences/order.
const HTML = 'http://www.w3.org/1999/xhtml';
const SVG = 'http://www.w3.org/2000/svg';
const PATHS = {
  red:'M8 72 L47 22 M67 72 L106 22 M127 72 L158 30',
  blood:'M8 18 C25 10 21 35 40 27 S65 48 89 34 S123 58 158 48',
  volt:'M8 58 L40 37 L49 57 L87 20 L78 47 L111 35 L122 53 L162 26',
  cherry:'M12 66 Q57 19 82 49 T159 29 M47 28 Q52 14 60 27 Q55 35 47 28',
  orange:'M9 72 Q27 63 22 48 Q40 69 55 48 Q62 20 77 41 Q92 60 113 35 Q124 56 157 46',
  midnight:'M12 68 Q75 79 151 24 M42 27 L42 33 M39 30 L45 30 M110 65 L110 71 M107 68 L113 68',
  green:'M9 24 H56 V44 H106 V66 H158 M9 30 H35 M127 60 H158',
  grey:'M8 72 L45 26 H65 L29 72 M97 72 L134 26 H155 L118 72',
  purple:'M85 15 L137 47 L85 79 L33 47 Z M85 27 L116 47 L85 67 L54 47 Z',
  custom:'M16 47 C16 8 154 8 154 47 S16 86 16 47 M34 47 C34 22 136 22 136 47 S34 72 34 47'
};
const CSS = `
.top-sites-list [data-blade-drag-lift] {position:relative;z-index:12;}
.top-sites-list [data-blade-drag-lift] > .top-site-inner,
.top-sites-list[data-blade-drag-active] .top-site-outer.dragged > .top-site-inner {translate:0 -8px;scale:1.035;filter:drop-shadow(0 14px 9px rgba(0,0,0,.4));}
.blade-tile-landing {position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:6;overflow:hidden;border-radius:inherit;}
.blade-tile-landing svg {width:100%;height:100%;fill:none;stroke:var(--blade-land-accent,#ff2a2a);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;}
.blade-tile-landing[data-theme=blood] svg {stroke-width:2.8;filter:drop-shadow(.6px .6px .4px #260207);}
.blade-tile-landing[data-theme=grey] svg {stroke:#d2dce7;stroke-width:1;}
.blade-tile-landing[data-theme=midnight] svg {stroke-width:1;}
@media (prefers-reduced-motion:reduce) {.top-sites-list [data-blade-drag-lift] > .top-site-inner, .top-sites-list[data-blade-drag-active] .top-site-outer.dragged > .top-site-inner {translate:none;scale:none;filter:none;} .blade-tile-landing {display:none;}}
`;

export function createTileDrag(doc) {
  const win = doc.defaultView;
  let state = {paused:true,mode:'vivid',theme:'red',accent:'#ff2a2a'};
  let destroyed = false;
  let drag = null;
  let previous = new Map();
  let frame = 0;
  let endTimer = 0;
  const animations = new Set();
  const landings = new Map();
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  const style = doc.createElementNS(HTML,'style');
  style.id = 'blade-tile-drag-style';
  style.textContent = CSS;
  doc.documentElement.appendChild(style);
  const allowed = () => !destroyed && !state.paused && state.mode !== 'eco' && !state.battery && !doc.hidden && !motion.matches;
  const outerOf = target => target?.closest?.('.top-sites-list .top-site-outer:not(.add-button-tile):not(.placeholder):not(.drag-ghost)');
  const hrefOf = outer => outer.querySelector('.top-site-button')?.getAttribute('href');
  const clearLanding = node => {
    const timer = landings.get(node);
    if (timer !== undefined) win.clearTimeout(timer);
    landings.delete(node);
    node.remove();
  };
  const animate = (node,keys,options) => {
    const animation = node.animate(keys,options);
    animations.add(animation);
    animation.finished.then(() => animations.delete(animation),() => animations.delete(animation));
    return animation;
  };
  const snapshot = list => {
    const boxes = new Map();
    const counts = new Map();
    // URL plus occurrence survives React replacing the node during a preview.
    for (const outer of [...list.querySelectorAll('.top-site-outer')].slice(0,64)) {
      if (outer.classList.contains('placeholder') || outer.classList.contains('drag-ghost')) continue;
      const href = hrefOf(outer);
      const inner = outer.querySelector('.top-site-inner');
      if (!href || !inner) continue;
      const occurrence = counts.get(href) || 0;
      counts.set(href,occurrence+1);
      const rect = outer.getBoundingClientRect();
      boxes.set(href+'\u0000'+occurrence,{inner,href,x:rect.left,y:rect.top});
    }
    return boxes;
  };
  const reflow = () => {
    frame = 0;
    if (!drag || !allowed()) return;
    const next = snapshot(drag.list);
    const changes = [];
    for (const [key,box] of next) {
      const old = previous.get(key);
      if (!old || box.href === drag.href) continue;
      const x = old.x-box.x, y = old.y-box.y;
      if (Math.abs(x)>.5 || Math.abs(y)>.5) changes.push({box,x,y});
    }
    previous = next;
    // Read all geometry before writing animations. One scheduled frame per
    // native React update, not a continuous animation/timer loop.
    for (const {box,x,y} of changes) {
      for (const animation of [...animations]) {
        if (animation.effect?.target === box.inner) animation.cancel();
      }
      animate(box.inner,[{translate:`${x}px ${y}px`},{translate:'0px 0px'}],{duration:state.mode==='balanced'?160:230,easing:'cubic-bezier(.2,.75,.25,1)'});
    }
  };
  const observer = new win.MutationObserver(() => {
    if (!frame && drag && allowed()) frame = win.requestAnimationFrame(reflow);
  });
  const releaseDrag = () => {
    observer.disconnect();
    if (frame) win.cancelAnimationFrame(frame);
    frame = 0;
    if (drag) {
      drag.outer.removeAttribute('data-blade-drag-lift');
      drag.list.removeAttribute('data-blade-drag-active');
      for (const node of drag.list.querySelectorAll('[data-blade-drag-lift]')) node.removeAttribute('data-blade-drag-lift');
    }
    previous.clear();
    drag = null;
  };
  const clear = () => {
    win.clearTimeout(endTimer);
    endTimer = 0;
    releaseDrag();
    for (const animation of [...animations]) animation.cancel();
    animations.clear();
    for (const node of [...landings.keys()]) clearLanding(node);
  };
  const land = (list,href) => {
    if (!allowed() || !list.isConnected) return;
    const outer = [...list.querySelectorAll('.top-site-outer')].find(node => hrefOf(node) === href && !node.classList.contains('placeholder') && !node.classList.contains('drag-ghost'));
    const tile = outer?.querySelector('.tile');
    const inner = outer?.querySelector('.top-site-inner');
    if (!tile || !inner) return;
    animate(inner,[{translate:'0 -6px',scale:'1.025'},{translate:'0 1px',scale:'0.995',offset:.7},{translate:'0 0',scale:'1'}],{duration:280,easing:'cubic-bezier(.2,.7,.35,1)'});
    for (const node of [...landings.keys()]) clearLanding(node);
    const node = doc.createElementNS(HTML,'span');
    node.className = 'blade-tile-landing';
    node.setAttribute('aria-hidden','true');
    node.dataset.theme = state.theme;
    node.style.setProperty('--blade-land-accent',/^#[\da-f]{3,8}$/i.test(state.accent)?state.accent:'#ff2a2a');
    const svg = doc.createElementNS(SVG,'svg');
    svg.setAttribute('viewBox','0 0 170 95');
    const path = doc.createElementNS(SVG,'path');
    path.setAttribute('d',PATHS[state.theme] || PATHS.red);
    svg.appendChild(path);
    node.appendChild(svg);
    tile.appendChild(node);
    animate(node,[{opacity:0,transform:'scale(.92)'},{opacity:state.theme==='blood'?.8:.65,transform:'scale(1)',offset:.25},{opacity:0,transform:'scale(1.035)'}],{duration:550,easing:'ease-out'});
    landings.set(node,win.setTimeout(() => clearLanding(node),600));
  };
  const start = event => {
    const outer = outerOf(event.target);
    if (!outer || !allowed()) return;
    clear();
    const list = outer.closest('.top-sites-list');
    const href = hrefOf(outer);
    if (!href) return;
    drag = {outer,list,href};
    previous = snapshot(list);
    outer.setAttribute('data-blade-drag-lift','');
    list.setAttribute('data-blade-drag-active','');
    observer.observe(list,{childList:true,subtree:true,attributes:true,attributeFilter:['class','href']});
    // Safety bound for aborted OS drag sessions that never dispatch dragend.
    endTimer = win.setTimeout(clear,30000);
    win.queueMicrotask(() => { if (event.defaultPrevented && drag?.outer === outer) clear(); });
  };
  const drop = event => {
    if (!drag || !drag.list.contains(event.target)) return;
    const {list,href} = drag;
    // Let Firefox process the real event and persist its order first.
    win.clearTimeout(endTimer);
    endTimer = win.setTimeout(() => {
      const accepted = event.defaultPrevented;
      releaseDrag();
      if (accepted) land(list,href);
      endTimer = 0;
    },100);
    drag.dropped = true;
  };
  const end = () => { if (drag && !drag.dropped) clear(); };
  const visibility = () => { if (!allowed()) clear(); };
  const escape = event => { if (event.key === 'Escape' && drag) clear(); };
  const events = [['dragstart',start],['drop',drop],['dragend',end],['visibilitychange',visibility],['keydown',escape]];
  for (const [name,fn] of events) doc.addEventListener(name,fn,true);
  motion.addEventListener('change',visibility);
  return {
    setState(next) {
      const previousState = state;
      state = {...state,...next};
      if (!allowed() || previousState.theme !== state.theme || previousState.mode !== state.mode || previousState.accent !== state.accent) clear();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clear();
      for (const [name,fn] of events) doc.removeEventListener(name,fn,true);
      motion.removeEventListener('change',visibility);
      style.remove();
    }
  };
}

