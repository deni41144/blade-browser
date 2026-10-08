// ==UserScript==
// @name            Blade Hero Atmosphere
// @description     Vector material scenes surrounding the new-tab clock
// @author          Blade-Creations
// @include         main
// @version         1.6.0
// @loadOrder       97
// ==/UserScript==
(function () {
  if (window.BladeHeroAtmosphere) return;
  const H = 'http://www.w3.org/1999/xhtml';
  const root = document.documentElement;
  const colors = {red:'#ff354a',blood:'#970b17',volt:'#c8de54',cherry:'#ef9bbd',orange:'#ff9a42',midnight:'#91b5f6',green:'#75d7a8',grey:'#c4cad3',purple:'#b7a0ff',custom:'#dd9eff'};
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let wrap, layer, electric = null, theme = '', signature = '', disposed = false, running = false;
  const style = document.createElementNS(H, 'style');
  style.id = 'blade-hero-atmosphere-style';
  style.textContent = `
    :root[data-blade-hero-atmosphere="ready"]:is([data-blade-theme="blood"],[data-blade-theme="volt"],[data-blade-theme="cherry"],[data-blade-theme="grey"]) #blade-atmosphere {display:none!important;}
    :root[data-blade-theme="custom"] :is(#blade-atmosphere,#blade-hero-atmosphere-v2) {display:none!important;}
    #blade-hero-atmosphere-v2 {position:absolute;inset:0;overflow:hidden;pointer-events:none;contain:paint;z-index:0;isolation:isolate;}
    #blade-hero-atmosphere-v2 svg {position:absolute;inset:0;width:100%;height:100%;overflow:hidden;}
    #blade-hero-atmosphere-v2 canvas {position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
    #blade-hero-atmosphere-v2 .bha-motion {transform-box:fill-box;transform-origin:center;animation:blade-atmo-rain var(--duration,12s) linear var(--delay,0s) infinite;}
    #blade-hero-atmosphere-v2 .bha-petal {animation-name:blade-atmo-petal;}
    #blade-hero-atmosphere-v2 .bha-up {animation-name:blade-atmo-up;}
    #blade-hero-atmosphere-v2 .bha-firefly {animation-name:blade-atmo-firefly;}
    #blade-hero-atmosphere-v2 .bha-red-ember {animation-name:blade-atmo-red-ember;}
    #blade-hero-atmosphere-v2 .bha-razor {animation-name:blade-atmo-razor;}
    #blade-hero-atmosphere-v2 .bha-feather {animation-name:blade-atmo-feather;}
    #blade-hero-atmosphere-v2 .bha-blood-stream {transform-box:fill-box;transform-origin:center top;animation:blade-atmo-blood-stream var(--cycle,9s) linear var(--phase,0s) infinite;}
    #blade-hero-atmosphere-v2 .bha-blood-bulb {transform-box:fill-box;transform-origin:center top;animation:blade-atmo-blood-bulb var(--cycle,9s) linear var(--phase,0s) infinite;}
    #blade-hero-atmosphere-v2 .bha-blood-neck {transform-box:fill-box;transform-origin:center top;animation:blade-atmo-blood-neck var(--cycle,9s) linear var(--phase,0s) infinite;}
    #blade-hero-atmosphere-v2 .bha-blood-detach {transform-box:fill-box;transform-origin:center top;animation:blade-atmo-blood-detach var(--cycle,9s) linear var(--phase,0s) infinite;}
    #blade-hero-atmosphere-v2 .bha-meteor {animation-name:blade-atmo-meteor;}
    #blade-hero-atmosphere-v2 .bha-aurora {animation-name:blade-atmo-aurora;animation-timing-function:ease-in-out;}
    #blade-hero-atmosphere-v2 .bha-smoke {animation-name:blade-atmo-smoke;animation-timing-function:ease-in-out;}
    #blade-hero-atmosphere-v2 .bha-star {animation-name:blade-atmo-star;animation-timing-function:ease-in-out;}
    #blade-hero-atmosphere-v2 .bha-discharge {animation-name:blade-atmo-discharge;}
    #blade-hero-atmosphere-v2 .bha-petal-wave {transform-box:fill-box;transform-origin:center;opacity:0;animation:blade-atmo-petal-wave var(--wave-cycle,23s) linear var(--wave-phase,0s) infinite;}
    #blade-hero-atmosphere-v2 .bha-razor-shards {opacity:0;transform-box:fill-box;transform-origin:center;animation:blade-atmo-razor-shards 16s linear var(--delay,0s) infinite;}
    #blade-hero-atmosphere-v2[data-paused="true"] * {animation-play-state:paused!important;}
    :root[data-blade-hero-legacy-paused="true"] #blade-atmosphere * {animation-play-state:paused!important;}
    #blade-hero-atmosphere-v2[data-disabled="true"] {display:none!important;}
    #blade-hero-wrap > #blade-hero {z-index:1;}
    @keyframes blade-atmo-rain {
      0%{opacity:0;transform:translate(0,-160px)}8%{opacity:.68}
      86%{opacity:.55}100%{opacity:0;transform:translate(var(--sway,24px),900px)}
    }
    @keyframes blade-atmo-petal {
      0%{opacity:0;transform:translate(-16px,-90px) rotate(-35deg) scaleX(.85)}9%{opacity:.82}
      25%{transform:translate(38px,180px) rotate(55deg) scaleX(.35)}
      50%{opacity:.75;transform:translate(-12px,420px) rotate(135deg) scaleX(1)}
      75%{transform:translate(57px,680px) rotate(230deg) scaleX(.42)}
      100%{opacity:0;transform:translate(8px,940px) rotate(315deg) scaleX(.9)}
    }
    @keyframes blade-atmo-up {
      0%{opacity:0;transform:translate(0,910px) rotate(-12deg)}12%{opacity:.78}
      40%{transform:translate(-17px,535px) rotate(28deg)}75%{opacity:.58;transform:translate(24px,165px) rotate(-9deg)}
      100%{opacity:0;transform:translate(-12px,-110px) rotate(44deg)}
    }
    @keyframes blade-atmo-firefly {
      0%{opacity:0;transform:translate(-35px,900px) scale(.7)}15%{opacity:.78}
      27%{transform:translate(58px,635px) scale(1)}55%{opacity:.38;transform:translate(-28px,365px) scale(.6)}
      78%{opacity:.83;transform:translate(31px,145px) scale(1.1)}100%{opacity:0;transform:translate(-12px,-110px) scale(.5)}
    }
    @keyframes blade-atmo-red-ember {
      0%{opacity:0;transform:translate(45px,900px) rotate(-23deg)}8%{opacity:.82}
      47%{opacity:.75;transform:translate(-9px,410px) rotate(-39deg)}
      80%{opacity:.6;transform:translate(-53px,80px) rotate(-21deg)}100%{opacity:0;transform:translate(-75px,-140px) rotate(-32deg)}
    }
    @keyframes blade-atmo-feather {
      0%{opacity:0;transform:translate(-20px,-100px) rotate(-30deg)}10%{opacity:.62}
      26%{transform:translate(66px,170px) rotate(37deg)}
      51%{opacity:.68;transform:translate(-21px,420px) rotate(-26deg)}
      78%{transform:translate(52px,680px) rotate(42deg)}
      100%{opacity:0;transform:translate(-3px,930px) rotate(-15deg)}
    }
    @keyframes blade-atmo-razor {
      0%,42%{opacity:0;transform:translate(-20px,12px) scaleX(.1)}
      43.2%{opacity:.76;transform:translate(0,0) scaleX(1)}
      46%,100%{opacity:0;transform:translate(22px,-13px) scaleX(1.1)}
    }
    @keyframes blade-atmo-blood-stream {
      0%{opacity:.92;transform:scaleY(.4)}46%,85%{opacity:.94;transform:scaleY(1)}
      90%{opacity:.9;transform:scaleY(.92)}100%{opacity:.92;transform:scaleY(.4)}
    }
    @keyframes blade-atmo-blood-bulb {
      0%,50%{opacity:0;transform:scale(.35,.35)}53%{opacity:.92;transform:scale(.45,.4)}
      68%{opacity:.94;transform:scale(.9,.8)}76%{opacity:.94;transform:scale(1.12,1.18)}
      80%{opacity:.94;transform:scale(.9,1.3)}81%,100%{opacity:0;transform:scale(.35,.35)}
    }
    @keyframes blade-atmo-blood-neck {
      0%,50%{opacity:0;transform:scaleX(1)}53%,73%{opacity:.9;transform:scaleX(1)}
      79.5%{opacity:.82;transform:scaleX(.2)}81%,100%{opacity:0;transform:scaleX(.2)}
    }
    @keyframes blade-atmo-blood-detach {
      0%,80%{opacity:0;transform:translateY(0) scale(.86,1.05)}81%{opacity:.93;transform:translateY(0) scale(.86,1.05)}
      82%{opacity:.93;transform:translateY(9px) scale(.85,1.15)}
      83%{opacity:.91;transform:translateY(18px) scale(.86,1.12)}
      85%{opacity:.84;transform:translateY(48px) scale(.86,1.08)}
      88%{opacity:.54;transform:translateY(100px) scale(.86,1.04)}
      92%,100%{opacity:0;transform:translateY(210px) scale(.86,1)}
    }
    @keyframes blade-atmo-meteor {0%,62%,100%{opacity:0;transform:translate(0,-120px)}64%{opacity:.85}77%{opacity:.55;transform:translate(-540px,590px)}79%{opacity:0;transform:translate(-610px,680px)}}
    @keyframes blade-atmo-aurora {0%,100%{opacity:.2;transform:translate(-40px,-8px) scaleY(.82)}50%{opacity:.55;transform:translate(65px,24px) scaleY(1.04)}}
    @keyframes blade-atmo-smoke {
      0%{opacity:0;transform:translate(-25px,850px) scale(.7)}18%{opacity:.22}
      65%{opacity:.3;transform:translate(26px,170px) scale(1.15)}
      100%{opacity:0;transform:translate(-30px,-150px) scale(1.45)}
    }
    @keyframes blade-atmo-star {0%,100%{opacity:.15;transform:scale(.7)}42%{opacity:.84;transform:scale(1)}65%{opacity:.4}}
    @keyframes blade-atmo-discharge {0%,69%,74%,79%,100%{opacity:0}70%,72%,76%,78%{opacity:.8}}
    @keyframes blade-atmo-petal-wave {
      0%,65%{opacity:0;transform:translate(-100px,-85px) rotate(-28deg) scaleX(.72)}
      66%{opacity:.9}72%{transform:translate(-20px,150px) rotate(64deg) scaleX(.36)}
      79%{opacity:.8;transform:translate(105px,430px) rotate(155deg) scaleX(1)}
      86%{transform:translate(145px,670px) rotate(255deg) scaleX(.45)}
      91%,100%{opacity:0;transform:translate(225px,920px) rotate(338deg) scaleX(.85)}
    }
    @keyframes blade-atmo-razor-shards {
      0%,43.1%{opacity:0;transform:translate(0,0) rotate(0deg) scale(1)}
      43.5%{opacity:.82;transform:translate(0,0) rotate(0deg) scale(1)}
      46%{opacity:.45;transform:translate(var(--shard-x,16px),22px) rotate(var(--shard-turn,48deg)) scale(.85)}
      49%,100%{opacity:0;transform:translate(var(--shard-x,16px),48px) rotate(var(--shard-turn,48deg)) scale(.65)}
    }
    @media(max-width:800px) {#blade-hero-atmosphere-v2 svg{opacity:.78}}
  `;
  root.appendChild(style);
  const path = (d, attrs = '') => `<path d="${d}" ${attrs}/>`;
  const line = (d, width = 1, opacity = 1, stroke = 'url(#bha-edge)') => path(d, `fill="none" stroke="${stroke}" stroke-width="${width}" opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"`);
  const motion = (contents, kind, index, duration = 12, x = 0, y = 0) => `<g transform="translate(${x} ${y})"><g class="bha-motion ${kind}" style="--delay:-${(index*2.71+.8).toFixed(2)}s;--duration:${duration}s;--sway:${index%2?-21:26}px">${contents}</g></g>`;
  const side = i => i%2 ? 1040+(i*67)%360 : 28+(i*53)%330;
  function build(name, accent, balanced) {
    const count = balanced ? 7 : 10;
    let body = '';
    switch (name) {
      case 'blood': {
        // Accepted tile material and shapes, attached to the top edge of the glass.
        // Four independent fill / neck / detach cycles; nothing spawns in mid-air.
        const trails=[
          {x:115,width:6,length:88,d:'M2 -2C5 0 7 -1 9 1C8 12 7 19 8 28C9 39 7 51 7 62C7 74 10 81 9 89C8 98 4 102 2 94C0 87 3 77 3 66C4 52 2 43 3 33C4 19 1 10 2 -2Z',shine:'M6 8C5 23 6 36 5 48M5 69C5 76 7 84 6 91'},
          {x:293,width:4.5,length:154,d:'M4 -2L9 0C6 16 10 22 8 35C6 48 8 57 6 68C5 79 8 85 7 94C6 103 3 101 2 94C1 87 4 77 3 66C2 53 5 44 4 34C2 20 5 12 4 -2Z',shine:'M6 5C5 18 7 23 6 32M5 53L4 72M5 86L4 95'},
          {x:1140,width:7,length:64,d:'M1 -2L10 0C7 8 9 22 7 34C5 44 8 55 7 63C6 75 10 79 8 89C7 99 3 102 1 94C-1 86 3 78 3 67C4 52 1 44 3 33C5 18 0 11 1 -2Z',shine:'M5 5C6 16 5 22 5 32M4 47C5 58 4 64 5 70M5 83L4 93'},
          {x:1330,width:5,length:117,d:'M3 -2L9 0C8 10 6 15 7 28C8 41 5 46 6 59C7 72 5 76 7 88C8 96 4 102 2 94C0 87 3 80 2 70C1 57 4 49 3 39C2 26 5 14 3 -2Z',shine:'M6 8L5 20M5 35C5 43 4 48 4 58M4 73L4 91'}
        ];
        for(let i=0;i<trails.length;i++) {
          const trail=trails[i], tip=trail.width*.46, cycle=8.4+i*1.1+(balanced?2:0);
          const cy=trail.length-1,cx=tip;
          const bulb=`M${cx} ${cy-2.8}C${cx-1.3} ${cy-2.6} ${cx-2.1} ${cy-1.2} ${cx-2.1} ${cy+.6}C${cx-2.1} ${cy+2.3} ${cx-.9} ${cy+3.4} ${cx+.4} ${cy+3.4}C${cx+1.8} ${cy+3.2} ${cx+2.1} ${cy+1.8} ${cx+2.1} ${cy+.4}C${cx+1.9} ${cy-1.5} ${cx+1.2} ${cy-2.7} ${cx} ${cy-2.8}Z`;
          const dropShine=`M${cx-.9} ${cy-1.4}Q${cx-1.2} ${cy} ${cx-.8} ${cy+.8}`;
          body+=`<g transform="translate(${trail.x} 0)" style="--cycle:${cycle}s;--phase:-${i*2.23}s">`
            +`<g transform="scale(${trail.width/12} ${trail.length/100})"><g class="bha-blood-stream">`
            +path(trail.d,'fill="url(#bha-blood-wet)" stroke="#37050e" stroke-width=".35"')
            +line(trail.shine,.45,.35,'#d17783')+`</g></g>`
            +`<g class="bha-blood-bulb">`
            +path(bulb,'fill="url(#bha-blood-wet)" stroke="#37050e" stroke-width=".25"')
            +line(dropShine,.35,.35,'#d17783')+`</g>`
            +`<g class="bha-blood-neck">`
            +path(`M${cx-.6} ${cy-5}C${cx-.3} ${cy-3} ${cx-.35} ${cy-2} ${cx-.45} ${cy}L${cx+.55} ${cy}C${cx+.3} ${cy-2} ${cx+.3} ${cy-3} ${cx+.65} ${cy-5}Z`,'fill="url(#bha-blood-wet)"')+`</g>`
            +`<g class="bha-blood-detach">`
            +path(bulb,'fill="url(#bha-blood-wet)" stroke="#37050e" stroke-width=".25"')
            +line(dropShine,.35,.35,'#d17783')+`</g></g>`;
        }
        return `<svg viewBox="0 0 1440 800" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="bha-blood-wet" x1="0%" x2="100%"><stop offset="0%" stop-color="#30040c"/><stop offset="28%" stop-color="#6e0918"/><stop offset="62%" stop-color="#a91e30"/><stop offset="100%" stop-color="#440612"/></linearGradient></defs>${body}</svg>`;
      }
      case 'cherry':
        for(let i=0;i<count;i++) {
          const z=.72+i%4*.16;
          body+=motion(path(`M${10*z} ${18*z}C${-z} ${13*z} 0 ${2*z} ${7*z} ${2*z}L${10*z} ${6*z}L${13*z} ${2*z}C${20*z} ${2*z} ${21*z} ${13*z} ${10*z} ${18*z}Z`,'fill="url(#bha-material)"')+line(`M${10*z} ${16*z}Q${9*z} ${11*z} ${10*z} ${7*z} M${10*z} ${13*z}L${6*z} ${9*z} M${10*z} ${12*z}L${14*z} ${8*z}`, .48,.28,'#fff0f3'),'bha-petal',i,15+i%6,side(i),0);
        }
        // A brief gust carries a small cluster through the existing rain, with
        // the accepted cleft petal silhouette and a fine vein rather than tails.
        for(let i=0;i<(balanced?2:3);i++) {
          const z=1+i*.15;
          body+=`<g transform="translate(${180+i*395} 0)"><g class="bha-petal-wave" style="--wave-cycle:23s;--wave-phase:-${i*.48}s">`
            +path(`M${10*z} ${18*z}C${-z} ${13*z} 0 ${2*z} ${7*z} ${2*z}L${10*z} ${6*z}L${13*z} ${2*z}C${20*z} ${2*z} ${21*z} ${13*z} ${10*z} ${18*z}Z`,'fill="url(#bha-material)"')
            +line(`M${10*z} ${16*z}Q${9*z} ${11*z} ${10*z} ${7*z} M${10*z} ${13*z}L${6*z} ${9*z} M${10*z} ${12*z}L${14*z} ${8*z}`,.48,.35,'#fff0f3')+`</g></g>`;
        }
        break;
      case 'grey':
        for(let i=0;i<(balanced?5:7);i++) {
          const len=24+i%3*9;
          body+=motion(path(`M0 ${-len} C18 ${-len*.7} 15 -4 1 9 C-12 -2 -15 ${-len*.75} 0 ${-len}Z`,'fill="url(#bha-material)"')+line(`M0 ${-len+3}L0 15 M0 ${-len*.7}L7 ${-len*.83} M0 ${-len*.45}L9 ${-len*.6} M0 ${-len*.2}L-9 ${-len*.38} M0 0L8 -5`,.6,.58,'#dce1e9'),'bha-feather',i,17+i%5,side(i),0);
        }
        body+=motion(path('M0 -2L3 0 1 2 -1 0Z','fill="#c8cbd3"'),'',9,13,side(5),0);
        for(let i=0;i<(balanced?1:2);i++) {
          body+=motion(line('M-32 29L82 -41',2,.2,'#bbc4d1')+line('M-28 27L78 -38',.75,.86,'#e4e8ee'),'bha-razor',i+4,16,side(i),190+i*220);
          body+=`<g transform="translate(${side(i)+25} ${190+i*220})" style="--delay:-${((i+4)*2.71+.8).toFixed(2)}s">`;
          for(let j=0;j<(balanced?2:3);j++) body+=path(`M${j*17} ${-j*10}l${3+j} -2 -1 ${5+j} -3 -1Z`,`class="bha-razor-shards" fill="${j%2?'#e4e8ee':'#9da9b9'}" style="--shard-x:${j%2?-18:14+j*9}px;--shard-turn:${j%2?-72:55+j*30}deg"`);
          body+='</g>';
        }
        break;
    }
    return `<svg viewBox="0 0 1440 800" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="bha-edge"><stop stop-color="${accent}" stop-opacity=".04"/><stop offset=".75" stop-color="${accent}"/><stop offset="1" stop-color="${accent}" stop-opacity=".18"/></linearGradient><linearGradient id="bha-material" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${name==='blood'?'#cb0000':accent}"/><stop offset=".5" stop-color="${accent}"/><stop offset=".59" stop-color="${name==='blood'?'#ff3020':'#ece3ef'}" stop-opacity="${name==='blood'?1:.65}"/><stop offset="1" stop-color="${name==='blood'?'#e00000':accent}" stop-opacity="${name==='blood'?1:.6}"/></linearGradient><linearGradient id="bha-veil" x1="0" x2="0" y1="0" y2="1"><stop stop-color="${accent}" stop-opacity="0"/><stop offset=".5" stop-color="${accent}" stop-opacity=".24"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></linearGradient><linearGradient id="bha-rain" x1="0" x2="0" y1="0" y2="1"><stop stop-color="${accent}" stop-opacity=".1"/><stop offset=".8" stop-color="${accent}" stop-opacity=".65"/><stop offset="1" stop-color="#d2ffe6"/></linearGradient></defs>${body}</svg>`;
  }
  function clearScene() {
    electric?.destroy();
    electric = null;
    layer.replaceChildren();
    signature = '';
  }
  function resizeElectric() {
    if (!electric || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    electric.resize(rect.width, rect.height);
  }
  function sync() {
    if (disposed || !layer) return;
    const wasRunning = running;
    const fx = window.BladeEffects?.contentState() || {mode:'vivid',paused:false};
    const next = root.getAttribute('data-blade-theme') || 'red';
    theme = colors[next] ? next : 'red';
    const accent = theme==='custom' && /^#[0-9a-f]{6}$/i.test(fx.accent || '') ? fx.accent : colors[theme];
    const replacement = ['blood','volt','cherry','grey'].includes(theme);
    const suppressed = fx.mode==='eco' || fx.battery || root.hasAttribute('data-blade-battery');
    const disabled = !replacement || suppressed;
    running = theme!=='custom' && !suppressed && !fx.paused && !reduced.matches && !document.hidden && wrap.classList.contains('blade-on');
    root.setAttribute('data-blade-hero-legacy-paused',String(!running || replacement));
    layer.dataset.paused = String(!running);
    layer.dataset.disabled = String(disabled);
    if(disabled) {
      clearScene();layer.dataset.theme=theme;
      if(!replacement) root.removeAttribute('data-blade-hero-atmosphere');
      return;
    }
    const key = theme+'|'+accent+'|'+fx.mode;
    if(signature!==key) {
      clearScene();
      if (theme === 'volt') {
        if (!window.BladeElectricArc) return;
        const canvas = document.createElementNS(H, 'canvas');
        canvas.setAttribute('aria-hidden', 'true');
        layer.appendChild(canvas);
        electric = window.BladeElectricArc.create(canvas, {kind:'ambient'});
        resizeElectric();
      } else {
        const source = build(theme,accent,fx.mode==='balanced').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
        const parsed = new DOMParser().parseFromString(source,'image/svg+xml');
        if (parsed.documentElement.localName === 'parsererror') return;
        layer.replaceChildren(document.importNode(parsed.documentElement,true));
      }
      signature=key;layer.dataset.theme=theme;
      root.setAttribute('data-blade-hero-atmosphere','ready');
    }
    // The hero uses display:none off newtab; measure again when it reappears.
    if (electric && running && !wasRunning) resizeElectric();
    electric?.setActive(running, {balanced:fx.mode==='balanced'});
  }
  const rootObserver = new MutationObserver(sync);
  const wrapObserver = new MutationObserver(sync);
  const bootObserver = new MutationObserver(boot);
  function boot() {
    if(disposed || layer) return;
    wrap=document.getElementById('blade-hero-wrap');
    if(!wrap) return;
    layer=document.createElementNS(H,'div');layer.id='blade-hero-atmosphere-v2';layer.setAttribute('aria-hidden','true');
    wrap.prepend(layer);bootObserver.disconnect();
    wrapObserver.observe(wrap,{attributes:true,attributeFilter:['class']});
    sync();
    window.Blade?.mark('hero_atmosphere','v1.6.0 OK');
  }
  rootObserver.observe(root,{attributes:true,attributeFilter:['data-blade-theme','style','data-blade-fx-mode','data-blade-fx-paused','data-blade-battery']});
  document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
  window.addEventListener('resize',resizeElectric);
  boot();if(!layer) bootObserver.observe(root,{childList:true,subtree:true});
  function destroy() {
    disposed=true;rootObserver.disconnect();wrapObserver.disconnect();bootObserver.disconnect();
    document.removeEventListener('visibilitychange',sync);reduced.removeEventListener('change',sync);
    window.removeEventListener('resize',resizeElectric);
    electric?.destroy();electric=null;
    layer?.remove();style.remove();root.removeAttribute('data-blade-hero-atmosphere');root.removeAttribute('data-blade-hero-legacy-paused');
  }
  window.BladeHeroAtmosphere={sync,status:()=>({theme,renderer:theme==='volt'?'electric':['blood','cherry','grey'].includes(theme)?'vector':theme==='custom'?'none':'legacy',running,nodes:layer?.querySelectorAll('*').length||0,electric:electric?.state()||null,disabled:layer?.dataset.disabled==='true',ready:root.getAttribute('data-blade-hero-atmosphere')==='ready'}),destroy};
  window.addEventListener('unload',destroy,{once:true});
})();
