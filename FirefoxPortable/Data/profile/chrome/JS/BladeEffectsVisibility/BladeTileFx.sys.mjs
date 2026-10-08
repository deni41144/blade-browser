// Local, bounded tile choreography. No frame loop or wallpaper overlays.
const HTML = 'http://www.w3.org/1999/xhtml';
const SVG = 'http://www.w3.org/2000/svg';
const COLORS = {red:'#ff2a2a',blood:'#a80f0f',volt:'#fff820',cherry:'#d02d4e',orange:'#ff6a1f',midnight:'#2f6bff',green:'#00ff88',grey:'#8a8f98',purple:'#b44bff',custom:'#ff2a2a'};
const CSS = `
.blade-tile-scene {position:absolute;inset:0;overflow:hidden;border-radius:inherit;pointer-events:none;z-index:5;isolation:isolate;contain:paint;}
.blade-tile-scene > * {position:absolute;display:block;pointer-events:none;box-sizing:border-box;animation-duration:var(--t,1100ms);animation-delay:var(--d,0ms);animation-fill-mode:both;animation-timing-function:cubic-bezier(.2,.65,.3,1);}
.blade-tile-scene .fx-slash {width:125%;height:2px;left:-12%;top:var(--y,50%);background:linear-gradient(90deg,transparent 3%,var(--fx-accent) 28%,#ffe7e2 57%,var(--fx-accent) 78%,transparent);box-shadow:0 0 6px var(--fx-accent);animation-name:blade-scene-slash;}
.blade-tile-scene .fx-fragment {width:var(--size,5px);height:2px;left:var(--fx-x);top:var(--fx-y);background:var(--fx-accent);animation-name:blade-scene-burst;}
.blade-tile-scene .fx-drip {height:var(--length,65%);width:var(--width,6px);top:-1px;transform-origin:top;animation-name:blade-scene-drip;filter:drop-shadow(1px 1px 1px rgba(0,0,0,.6));}
.blade-tile-scene .fx-drop {width:3px;height:7px;top:var(--tip,60%);background:radial-gradient(ellipse at 30% 35%,#ab2938 0%,#7a0b1b 40%,#34050d 100%);border-radius:65% 35% 55% 45%;transform-origin:top;animation-name:blade-scene-drop;}
.blade-tile-scene .fx-lightning {inset:0;width:100%;height:100%;animation-name:blade-scene-lightning;animation-timing-function:linear;}
.blade-tile-scene .fx-spark {width:2px;height:2px;left:var(--fx-x);top:var(--fx-y);background:var(--fx-accent);box-shadow:0 0 4px var(--fx-accent);animation-name:blade-scene-burst;}
.blade-tile-scene .fx-petal {width:var(--size,12px);height:var(--size,12px);left:var(--x);top:var(--y);animation-name:blade-scene-petal;}
.blade-tile-scene .fx-ember {width:var(--size,3px);height:calc(var(--size,3px) * 1.6);left:var(--x);bottom:-6px;border-radius:65% 35% 55% 45%;background:linear-gradient(#ffe5a9,var(--fx-accent));box-shadow:0 0 4px var(--fx-accent);animation-name:blade-scene-ember;}
.blade-tile-scene .fx-heat {left:-15%;bottom:-16%;width:130%;height:27%;border-top:1px solid var(--fx-accent);border-radius:50%;background:radial-gradient(ellipse at bottom,var(--fx-accent),transparent 65%);animation-name:blade-scene-heat;}
.blade-tile-scene .fx-star {left:var(--x);top:var(--y);width:var(--size,2px);height:var(--size,2px);border-radius:50%;background:#b9dbff;box-shadow:0 0 4px var(--fx-accent);animation-name:blade-scene-star;}
.blade-tile-scene .fx-comet {width:70px;height:2px;left:var(--x);top:var(--y);background:linear-gradient(90deg,transparent,var(--fx-accent) 70%,#cfedff);animation-name:blade-scene-comet;}
.blade-tile-scene .fx-scan {left:0;top:-8px;width:100%;height:9px;background:linear-gradient(transparent,var(--fx-accent) 65%,transparent);animation-name:blade-scene-scan;}
.blade-tile-scene .fx-data {left:var(--x);top:var(--y);width:var(--w,20px);height:2px;background:var(--fx-accent);animation-name:blade-scene-data;animation-timing-function:steps(2,end);}
.blade-tile-scene .fx-chrome {left:-40%;top:-20%;width:45%;height:140%;background:linear-gradient(90deg,transparent,rgba(210,225,244,.15) 30%,rgba(238,244,255,.55) 47%,transparent 54%,rgba(198,211,231,.2) 66%,transparent);animation-name:blade-scene-chrome;}
.blade-tile-scene .fx-metal {left:var(--x);top:var(--y);width:12px;height:5px;clip-path:polygon(0 0,100% 25%,55% 100%,16% 75%);background:linear-gradient(130deg,#bcc8d8,#f0f3f8 35%,#677788 50%,#bac6d6);animation-name:blade-scene-metal;}
.blade-tile-scene .fx-frame {inset:var(--inset,4px);border:1px solid var(--fx-accent);border-radius:5px;box-shadow:inset 0 0 3px color-mix(in srgb,var(--fx-accent) 60%,transparent);animation-name:blade-scene-frame;}
.blade-tile-scene .fx-prism {left:var(--x);top:var(--y);width:9px;height:14px;clip-path:polygon(50% 0,100% 60%,50% 100%,0 60%);background:linear-gradient(125deg,var(--fx-accent) 35%,#e9d4ff 36% 42%,color-mix(in srgb,var(--fx-accent) 35%,transparent) 43%);animation-name:blade-scene-metal;}
.blade-tile-scene .fx-ring {left:var(--fx-x);top:var(--fx-y);width:86px;height:86px;margin:-43px;border-radius:50%;background:conic-gradient(transparent 0deg 45deg,var(--fx-accent) 60deg 150deg,transparent 165deg 230deg,var(--fx-accent) 250deg 340deg,transparent 355deg);mask:radial-gradient(circle,transparent 62%,#000 63% 66%,transparent 67%);animation-name:blade-scene-ring;}
@keyframes blade-scene-slash {0%{opacity:0;transform:translateX(-95%) rotate(var(--r,-25deg));}15%{opacity:1;}48%{opacity:.95;transform:translateX(0) rotate(var(--r,-25deg));}100%{opacity:0;transform:translateX(95%) rotate(var(--r,-25deg));}}
@keyframes blade-scene-burst {0%{opacity:0;transform:translate(0,0) rotate(var(--r,0deg)) scale(.2);}18%{opacity:1;}100%{opacity:0;transform:translate(var(--dx),var(--dy)) rotate(var(--r,0deg)) scale(.3);}}
@keyframes blade-scene-drip {0%{opacity:0;transform:scaleY(.08);}12%{opacity:.95;transform:scaleY(.2);}45%{opacity:.95;transform:scaleY(.65);}72%{opacity:.95;transform:scaleY(1);}87%{opacity:.75;transform:scaleY(1.025);}100%{opacity:0;transform:scaleY(1.04);}}
@keyframes blade-scene-drop {0%{opacity:0;transform:translateY(-4px) scaleY(.5);}12%{opacity:.9;transform:translateY(0) scaleY(1);}40%{opacity:.9;transform:translateY(8px) scaleY(1.65);}100%{opacity:0;transform:translateY(52px) scaleY(1.1);} }
@keyframes blade-scene-lightning {0%,9%,25%,39%,56%,71%,91%,100%{opacity:0;transform:translateX(0);}10%,17%,40%,47%,72%,78%{opacity:1;transform:translateX(-1px);}18%,24%,48%,55%,79%,88%{opacity:.35;transform:translateX(1px);}}
@keyframes blade-scene-petal {0%{opacity:0;transform:translate(0,-12px) rotate(0deg) rotateY(0deg) scale(.65);}16%{opacity:.9;}53%{opacity:.95;transform:translate(calc(var(--dx) * .45),28px) rotate(var(--r)) rotateY(105deg) scale(1);}100%{opacity:0;transform:translate(var(--dx),var(--dy)) rotate(calc(var(--r) * 2)) rotateY(220deg) scale(.75);}}
@keyframes blade-scene-ember {0%{opacity:0;transform:translate(0,0) scale(.4);}20%{opacity:1;}62%{opacity:.8;transform:translate(calc(var(--dx) * -.35),-42px) scale(1);}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.3);}}
@keyframes blade-scene-heat {0%{opacity:0;transform:scale(.8);}28%{opacity:.6;}100%{opacity:0;transform:translateY(-55px) scale(1.1);}}
@keyframes blade-scene-star {0%{opacity:0;transform:scale(.15);}30%{opacity:.85;transform:scale(1);}66%{opacity:.35;transform:scale(.7);}100%{opacity:0;transform:scale(.4);}}
@keyframes blade-scene-comet {0%{opacity:0;transform:translate(-65px,-22px) rotate(25deg);}20%{opacity:1;}100%{opacity:0;transform:translate(140px,74px) rotate(25deg);}}
@keyframes blade-scene-scan {0%{opacity:0;transform:translateY(0);}16%{opacity:.8;}100%{opacity:0;transform:translateY(110px);}}
@keyframes blade-scene-data {0%{opacity:0;transform:translateX(0);}24%{opacity:.8;transform:translateX(3px);}37%{opacity:.25;transform:translateX(-7px);}53%{opacity:.9;transform:translateX(5px);}100%{opacity:0;transform:translateX(-2px);}}
@keyframes blade-scene-chrome {0%{opacity:0;transform:translateX(0) skewX(-18deg);}22%{opacity:.9;}100%{opacity:0;transform:translateX(330%) skewX(-18deg);}}
@keyframes blade-scene-metal {0%{opacity:0;transform:translate(0,0) rotate(0deg) scale(.3);}25%{opacity:.85;}100%{opacity:0;transform:translate(var(--dx),var(--dy)) rotate(var(--r)) scale(.6);}}
@keyframes blade-scene-frame {0%{opacity:0;transform:scale(.94);}24%{opacity:.95;transform:scale(1);}42%{opacity:.35;transform:scale(1);}60%{opacity:.8;transform:scale(1);}100%{opacity:0;transform:scale(1.05);}}
@keyframes blade-scene-ring {0%{opacity:0;transform:scale(.15) rotate(-45deg);}30%{opacity:.9;}100%{opacity:0;transform:scale(2.4) rotate(160deg);}}
`;

export function createTileFx(doc) {
  const win = doc.defaultView;
  const scenes = new Map();
  let state = {paused:true,mode:'vivid',theme:'red',accent:COLORS.red};
  let destroyed = false;
  let bloodSequence = 0;
  let pendingHit = null;
  const style = doc.createElementNS(HTML,'style');
  style.id = 'blade-tile-scene-style';
  style.textContent = CSS;
  doc.documentElement.appendChild(style);
  const remove = tile => {
    const record = scenes.get(tile);
    if (!record) return;
    win.clearTimeout(record.timer);
    record.scene.remove();
    scenes.delete(tile);
  };
  const clear = () => { for (const tile of [...scenes.keys()]) remove(tile); };
  const tileOf = target => {
    if (!target || typeof target.closest !== 'function') return null;
    const button = target.closest('.top-site-outer .top-site-button');
    return button?.querySelector('.tile') || null;
  };
  const spawn = (tile,event) => {
    if (destroyed || state.paused || state.mode === 'eco' || doc.hidden || scenes.has(tile)) return;
    if (scenes.size >= 3) remove(scenes.keys().next().value);
    const rect = tile.getBoundingClientRect();
    const x = event.type === 'pointerover' ? Math.max(8,Math.min(92,(event.clientX-rect.left)/Math.max(1,rect.width)*100)) : 50;
    const y = event.type === 'pointerover' ? Math.max(8,Math.min(92,(event.clientY-rect.top)/Math.max(1,rect.height)*100)) : 50;
    const scene = doc.createElementNS(HTML,'span');
    scene.className = 'blade-tile-scene';
    scene.setAttribute('aria-hidden','true');
    scene.dataset.theme = state.theme;
    scene.style.setProperty('--fx-accent',state.accent);
    scene.style.setProperty('--fx-x',x+'%');
    scene.style.setProperty('--fx-y',y+'%');
    const balanced = state.mode === 'balanced';
    const part = (kind,vars={},path=null) => {
      const node = doc.createElementNS(path ? SVG : HTML,path ? 'svg' : 'i');
      node.setAttribute('class','fx-'+kind);
      for (const [name,value] of Object.entries(vars)) node.style.setProperty(name,String(value));
      if (path) {
        node.setAttribute('viewBox',path.view || '0 0 170 95');
        const p = doc.createElementNS(SVG,'path');
        p.setAttribute('d',path.d);
        p.setAttribute('fill',path.fill || 'none');
        if (path.stroke) {p.setAttribute('stroke',path.stroke);p.setAttribute('stroke-width',path.width || '1.3');p.setAttribute('stroke-linecap','round');p.setAttribute('stroke-linejoin','round');}
        node.appendChild(p);
      }
      scene.appendChild(node);
      return node;
    };
    const burst = (kind,count,delay=80) => {
      for (let i=0;i<count;i++) {
        const angle = i * Math.PI*2/count + .27;
        part(kind,{'--d':(delay+i*13)+'ms','--dx':(Math.cos(angle)*(24+i*4))+'px','--dy':(Math.sin(angle)*(18+i*3))+'px','--r':(i*47)+'deg','--size':(3+i%3)+'px'});
      }
    };
    switch (state.theme) {
      case 'red':
        for(let i=0;i<3;i++) part('slash',{'--d':i*130+'ms','--t':'700ms','--y':(37+i*16)+'%','--r':(-27+i*9)+'deg'});
        burst('fragment',balanced?5:9,170);
        break;
      case 'blood': {
        // Thin, irregular rivulets instead of repeated round lollipop silhouettes.
        const trails = [
          {left:13,width:6,length:57,d:'M2 -2C5 0 7 -1 9 1C8 12 7 19 8 28C9 39 7 51 7 62C7 74 10 81 9 89C8 98 4 102 2 94C0 87 3 77 3 66C4 52 2 43 3 33C4 19 1 10 2 -2Z',shine:'M6 8C5 23 6 36 5 48M5 69C5 76 7 84 6 91'},
          {left:38,width:4.5,length:79,d:'M4 -2L9 0C6 16 10 22 8 35C6 48 8 57 6 68C5 79 8 85 7 94C6 103 3 101 2 94C1 87 4 77 3 66C2 53 5 44 4 34C2 20 5 12 4 -2Z',shine:'M6 5C5 18 7 23 6 32M5 53L4 72M5 86L4 95'},
          {left:62,width:7,length:43,d:'M1 -2L10 0C7 8 9 22 7 34C5 44 8 55 7 63C6 75 10 79 8 89C7 99 3 102 1 94C-1 86 3 78 3 67C4 52 1 44 3 33C5 18 0 11 1 -2Z',shine:'M5 5C6 16 5 22 5 32M4 47C5 58 4 64 5 70M5 83L4 93'},
          {left:85,width:5,length:66,d:'M3 -2L9 0C8 10 6 15 7 28C8 41 5 46 6 59C7 72 5 76 7 88C8 96 4 102 2 94C0 87 3 80 2 70C1 57 4 49 3 39C2 26 5 14 3 -2Z',shine:'M6 8L5 20M5 35C5 43 4 48 4 58M4 73L4 91'}
        ];
        const gradientId = 'blade-blood-wet-' + (++bloodSequence);
        const selected = balanced ? trails.slice(0,3) : trails;
        for (let i=0;i<selected.length;i++) {
          const trail = selected[i];
          const stream = part('drip',{left:trail.left+'%','--width':trail.width+'px','--length':trail.length+'%','--d':i*75+'ms','--t':'1280ms'},
            {view:'0 0 12 100',d:trail.d,fill:'url(#'+gradientId+')',stroke:'#37050e',width:'.35'});
          stream.setAttribute('preserveAspectRatio','none');
          if (i === 0) {
            const defs = doc.createElementNS(SVG,'defs');
            const gradient = doc.createElementNS(SVG,'linearGradient');
            gradient.id = gradientId;
            gradient.setAttribute('x1','0%'); gradient.setAttribute('x2','100%');
            for (const [offset,color] of [['0%','#30040c'],['28%','#6e0918'],['62%','#a91e30'],['100%','#440612']]) {
              const stop = doc.createElementNS(SVG,'stop');
              stop.setAttribute('offset',offset); stop.setAttribute('stop-color',color); gradient.appendChild(stop);
            }
            defs.appendChild(gradient); stream.prepend(defs);
          }
          const sheen = doc.createElementNS(SVG,'path');
          sheen.setAttribute('d',trail.shine); sheen.setAttribute('fill','none');
          sheen.setAttribute('stroke','#d17783'); sheen.setAttribute('stroke-width','.45');
          sheen.setAttribute('opacity','.35'); sheen.setAttribute('stroke-linecap','round');
          stream.appendChild(sheen);
          part('drop',{left:'calc('+trail.left+'% + '+(trail.width*.4-1.5)+'px)','--tip':(trail.length-1)+'%','--d':(860+i*75)+'ms','--t':'450ms'});
        }
        break;
      }
      case 'volt': {
        const paths = ['M2 63L12 52L18 55L27 41L31 47L38 45L42 52L49 39L46 35L56 27L65 15L62 31L70 33L76 42L84 37L88 40L97 29L104 30L108 43L113 40L119 50L126 38L132 41L139 29L147 31L156 23L165 18','M65 15L59 9L55 12L51 6L47 11L42 16','M76 42L71 51L76 55L73 63L82 65L80 69L86 71','M104 30L99 21L104 18L101 10L109 11L108 5L115 3','M119 50L128 53L125 59L139 67L141 61L146 64L153 60','M27 41L19 38L20 32L12 24L9 29L2 28','M139 67L131 76L136 79L133 86L141 86L139 90L147 94'];
        for(let i=0;i<(balanced?4:7);i++) part('lightning',{'--d':i*35+'ms','--t':'1250ms'}, {d:paths[i],stroke:i===0?'#fff9a8':state.accent,width:i===0?'1.8':'1.15'});
        burst('spark',balanced?4:7,170);
        break;
      }
      case 'cherry':
        for(let i=0;i<(balanced?7:12);i++) part('petal',{'--x':(7+(i*29)%85)+'%','--y':(i%3*16-8)+'%','--d':i*22+'ms','--t':'1150ms','--size':(8+i%4*2)+'px','--dx':((i%2?-1:1)*(15+i*3))+'px','--dy':(76+i%4*14)+'px','--r':(35+i*17)+'deg'}, {view:'0 0 20 20',d:'M10 18C-1 13 0 2 7 2L10 6L13 2C20 2 21 13 10 18Z',fill:i%3===0?'#f7bacb':state.accent});
        break;
      case 'orange':
        part('heat',{'--t':'1250ms'});
        for(let i=0;i<(balanced?7:12);i++) part('ember',{'--x':(4+i*31%92)+'%','--d':i*22+'ms','--t':(900+i%3*95)+'ms','--size':(2+i%3)+'px','--dx':(i%2?-18-i:14+i)+'px','--dy':(-75-i%4*13)+'px'});
        break;
      case 'midnight':
        for(let i=0;i<(balanced?7:12);i++) part('star',{'--x':(6+i*37%89)+'%','--y':(8+i*23%77)+'%','--d':i*19+'ms','--size':(i%3===0?2.4:1.4)+'px'});
        for(let i=0;i<2;i++) part('comet',{'--x':(i*21-20)+'%','--y':(14+i*25)+'%','--d':(120+i*280)+'ms','--t':'900ms'});
        break;
      case 'green':
        part('scan',{'--t':'1100ms'});
        for(let i=0;i<(balanced?7:13);i++) part('data',{'--x':(3+i*31%84)+'%','--y':(9+i*17%78)+'%','--w':(8+i%4*7)+'px','--d':(70+i*32)+'ms','--t':'950ms'});
        break;
      case 'grey':
        for(let i=0;i<2;i++) part('chrome',{'--d':i*190+'ms','--t':'1000ms'});
        for(let i=0;i<(balanced?4:8);i++) part('metal',{'--x':(x+(i%2?12:-12))+'%','--y':y+'%','--d':(130+i*27)+'ms','--dx':(i%2?30+i*3:-30-i*3)+'px','--dy':(i%3*20-18)+'px','--r':(i*39)+'deg'});
        break;
      case 'purple':
        for(let i=0;i<3;i++) part('frame',{'--inset':(3+i*5)+'px','--d':i*95+'ms','--t':'1080ms'});
        for(let i=0;i<(balanced?4:8);i++) part('prism',{'--x':(12+i*31%77)+'%','--y':(i%2?83:9)+'%','--d':(100+i*31)+'ms','--dx':(i%2?-16:16)+'px','--dy':(i%2?-35:35)+'px','--r':(i*45)+'deg'});
        break;
      default:
        for(let i=0;i<3;i++) part('ring',{'--d':i*105+'ms','--t':'1100ms'});
        burst('spark',balanced?6:12,80);
    }
    tile.appendChild(scene);
    scenes.set(tile,{scene,timer:win.setTimeout(()=>remove(tile),1550)});
  };
  const enter = event => {
    const tile = tileOf(event.target);
    if (!tile) return;
    const button = tile.closest('.top-site-button');
    if (event.relatedTarget && button?.contains(event.relatedTarget)) return;
    if (state.paused || state.mode === 'eco') {
      // Actor state can arrive just after a trusted pointer/focus entry.
      // Keep only the latest hit and revalidate it once that state arrives.
      pendingHit = {tile,type:event.type,clientX:event.clientX,clientY:event.clientY};
      return;
    }
    spawn(tile,event);
  };
  const leave = event => {
    const tile = tileOf(event.target);
    if (!tile) return;
    const button = tile.closest('.top-site-button');
    if (event.relatedTarget && button?.contains(event.relatedTarget)) return;
    if (pendingHit?.tile === tile) pendingHit = null;
    // Keyboard focus and pointer hover can coexist; don't cancel the other.
    if (event.type === 'pointerout' && button?.contains(doc.activeElement)) return;
    if (event.type === 'focusout' && button?.matches(':hover')) return;
    remove(tile);
  };
  doc.addEventListener('pointerover',enter);
  doc.addEventListener('pointerout',leave);
  doc.addEventListener('focusin',enter);
  doc.addEventListener('focusout',leave);
  return {
    setState(next) {
      if (destroyed) return;
      const theme = Object.hasOwn(COLORS,next.theme) ? next.theme : 'red';
      const accent = /^#[0-9a-f]{6}$/i.test(next.accent || '') ? next.accent : COLORS[theme];
      const changed = state.theme !== theme || state.mode !== next.mode || state.accent !== accent;
      state = {paused:!!next.paused,mode:next.mode || 'vivid',theme,accent};
      if (state.paused || state.mode === 'eco' || changed) clear();
      if (!state.paused && state.mode !== 'eco' && pendingHit) {
        const hit = pendingHit;
        pendingHit = null;
        const button = hit.tile.closest('.top-site-button');
        if (hit.tile.isConnected && !doc.hidden && button &&
            (button.matches(':hover') || button.matches(':focus-visible'))) {
          spawn(hit.tile,hit);
        }
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      pendingHit = null;
      // A reloaded newtab may release its document before actor teardown.
      if (Components.utils.isDeadWrapper(doc) || Components.utils.isDeadWrapper(style)) {
        scenes.clear();
        return;
      }
      clear();
      style.remove();
      doc.removeEventListener('pointerover',enter);
      doc.removeEventListener('pointerout',leave);
      doc.removeEventListener('focusin',enter);
      doc.removeEventListener('focusout',leave);
    }
  };
}
