// ==UserScript==
// @name            Blade Hero Clock
// @description     Readable sculpted clock materials and ten precision motifs
// @include         main
// @version         1.4.6
// @loadOrder       96
// ==/UserScript==
(function () {
  if (window.BladeHeroClock) return;
  const NS = 'http://www.w3.org/1999/xhtml';
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Every value is opaque: a passing light never replaces the readable face.
  const faces = {
    red: ['#ffe0d8', '#c63b3b', '#511a22'],
    blood: ['#c11111', '#8f0a14', '#44060f'],
    volt: ['#fff820', '#fff820', '#4a3c00'],
    cherry: ['#ffe0ee', '#ce82a2', '#623048'],
    orange: ['#ffe5bf', '#dc8b38', '#68331b'],
    midnight: ['#d6eaff', '#588fb8', '#172b50'],
    green: ['#d2ffe3', '#54b883', '#174e37'],
    grey: ['#e5e9ed', '#a7b0bd', '#363f4c'],
    purple: ['#ecddff', '#a67fdd', '#4f2d78'],
    custom: ['var(--accent,#ff2a2a)', 'var(--accent,#ff2a2a)', '#303744'],
  };
  const coats = {
    red: 'linear-gradient(166deg,transparent 39%,#fff8 40%,#fff1 41%,transparent 43%),linear-gradient(180deg,#fff4 0%,transparent 21%,transparent 74%,#ad263b35 100%)',
    blood: 'radial-gradient(ellipse at 23% 12%,#ff302040 0%,#ff10001a 8%,transparent 12%),linear-gradient(110deg,transparent 57%,#ff321530 58%,transparent 60%),linear-gradient(180deg,transparent 57%,#a3000030 100%)',
    volt: 'repeating-linear-gradient(90deg,transparent 0px,transparent 27px,#ffe95e2e 27px,#ffe95e2e 28px),linear-gradient(180deg,#fff8 0%,transparent 22%,#ffb80033 58%,transparent 62%)',
    cherry: 'radial-gradient(ellipse at 35% 5%,#fff7,transparent 45%),linear-gradient(126deg,transparent 25%,#fff3 45%,transparent 65%)',
    orange: 'linear-gradient(180deg,#fff5 0%,transparent 18%,#93431420 67%,#fff3 68%,transparent 71%),repeating-linear-gradient(90deg,transparent 0px,transparent 9px,#ffe3b11a 10px)',
    midnight: 'radial-gradient(circle at 18% 26%,#fff9 0px,#fff9 .7px,transparent 1.3px),radial-gradient(circle at 72% 43%,#fff8 0px,#fff8 .6px,transparent 1.2px),linear-gradient(180deg,#fff4,transparent 35%,#38638e22)',
    green: 'repeating-linear-gradient(0deg,transparent 0px,transparent 5px,#d7ffe52a 5px,#d7ffe52a 6px),linear-gradient(180deg,#fff4,transparent 25%)',
    grey: 'repeating-linear-gradient(0deg,#fff2 0px,transparent 1px,transparent 3px),linear-gradient(180deg,#fff6 0%,transparent 31%,#66728830 48%,#fff4 49%,transparent 51%)',
    purple: 'conic-gradient(from 150deg at 38% 54%,transparent 0deg,#fff5 49deg,transparent 50deg,transparent 119deg,#fff3 120deg,transparent 170deg,#fff4 210deg,transparent 260deg)',
    custom: 'none',
  };
  // Small material pieces belong to the clock, not a generic decorative frame.
  const motifs = {
    red: [],
    blood: [],
    volt: [],
    cherry: ['M54 97 C43 92 44 81 51 81 L54 85 L57 81 C64 81 65 92 54 97 Z','M124 111 C113 106 114 95 121 95 L124 99 L127 95 C134 95 135 106 124 111 Z','M236 99 C225 94 226 83 233 83 L236 87 L239 83 C246 83 247 94 236 99 Z','M327 116 C316 111 317 100 324 100 L327 104 L330 100 C337 100 338 111 327 116 Z','M379 91 C368 86 369 75 376 75 L379 79 L382 75 C389 75 390 86 379 91 Z'],
    orange: [],
    midnight: [],
    green: [],
    grey: ['M35 100 L44 94 L49 100 L40 104 Z','M128 85 L138 81 L135 89 L125 91 Z','M222 115 L229 107 L235 113 L228 118 Z','M309 96 L320 91 L317 98 L308 101 Z','M377 115 L385 108 L393 112 L383 119 Z'],
    purple: [],
    custom: [],
  };
  const style = document.createElementNS(NS, 'style');
  style.id = 'blade-hero-clock-style';
  style.textContent = `
    /* Screenshot reference: v2.0.5 monolithic Unbounded dial, GX Red accent. */
    #blade-hero .bh-clock[data-hc-theme='red'] {
      font-family:var(--blade-display,'Unbounded','Segoe UI',sans-serif) !important;
      font-size:88px !important;font-weight:700 !important;letter-spacing:6px !important;
    }
    #blade-hero .bh-clock[data-hc-theme='red'] .bh-hm {
      background:linear-gradient(115deg,#ffffff 0%,#ffffff 38%,color-mix(in srgb,var(--accent,#ff2a2a) 70%,#fff) 46%,#ffffff 50%,color-mix(in srgb,var(--accent,#ff2a2a) 70%,#fff) 54%,#ffffff 62%,#ffffff 100%) !important;
      background-size:260% 100% !important;background-clip:text !important;
      color:transparent !important;-webkit-text-fill-color:transparent !important;
      filter:drop-shadow(0 0 2px #ffffff)
        drop-shadow(0 0 12px color-mix(in srgb,var(--accent,#ff2a2a) 85%,#ff4d4d))
        drop-shadow(0 0 32px color-mix(in srgb,var(--accent,#ff2a2a) 65%,transparent))
        drop-shadow(0 0 72px color-mix(in srgb,var(--accent,#ff2a2a) 35%,transparent))
        drop-shadow(0 4px 22px rgba(0,0,0,.98))
        drop-shadow(0 2px 4px rgba(0,0,0,.9)) !important;
      animation:hc-classic-red-glint 7.5s cubic-bezier(.22,1,.36,1) infinite !important;
    }
    @keyframes hc-classic-red-glint {
      0% {background-position:-60% 0;}
      22%,100% {background-position:160% 0;}
    }
    /* Minimal Grey: platinum Unbounded dial from v2.0.5. */
    #blade-hero .bh-clock[data-hc-theme='grey'] {
      font-family:var(--blade-display,'Unbounded','Segoe UI',sans-serif) !important;
      font-size:88px !important;font-weight:800 !important;letter-spacing:6px !important;
    }
    #blade-hero .bh-clock[data-hc-theme='grey'] .bh-hm {
      background:linear-gradient(115deg,#ffffff 0%,#ffffff 38%,#c5d5ea 46%,#ffffff 50%,#c5d5ea 54%,#ffffff 62%,#ffffff 100%) !important;
      background-size:260% 100% !important;background-clip:text !important;
      color:transparent !important;-webkit-text-fill-color:transparent !important;
      filter:drop-shadow(0 0 1px #ffffff)
        drop-shadow(0 0 10px rgba(255,255,255,.85))
        drop-shadow(0 0 24px rgba(216,225,238,.65))
        drop-shadow(0 0 55px rgba(170,185,205,.45))
        drop-shadow(0 4px 24px rgba(0,0,0,.98))
        drop-shadow(0 2px 4px rgba(0,0,0,.95)) !important;
      animation:hc-classic-red-glint 7.5s cubic-bezier(.22,1,.36,1) infinite !important;
    }
    #blade-hero .bh-clock[data-hc-theme='grey'] .bh-sec {
      font-family:var(--blade-display,'Unbounded','Segoe UI',sans-serif) !important;
      font-size:26px !important;font-weight:800 !important;letter-spacing:2px !important;
      color:#e4e8f0 !important;
      text-shadow:0 0 2px #ffffff,0 0 8px rgba(220,230,245,.7),0 2px 8px rgba(0,0,0,.95) !important;
    }
    #blade-hero .bh-clock:is([data-hc-theme='red'],[data-hc-theme='grey'])[data-hc-live='false'] .bh-hm {
      animation-play-state:paused !important;
    }
    #blade-hero[data-hc-ready="true"]::before,#blade-hero[data-hc-ready="true"]::after {display:none !important;}
    #blade-hero[data-hc-ready="true"] .bh-accent-line {visibility:hidden !important;box-shadow:none !important;}
    #blade-hero[data-hc-ready="true"] .bh-clock:is([data-hc-theme='orange']) {font-family:var(--blade-display,'Unbounded','Segoe UI',sans-serif) !important;font-weight:700 !important;letter-spacing:5px !important;}

    #blade-hero[data-hc-ready="true"] .bh-clock { isolation:isolate; animation:none !important; opacity:1 !important; transform:none !important; }
    #blade-hero[data-hc-ready="true"] .bh-hm {
      position:relative; z-index:2; color:var(--hc-face,#ffe0d8) !important;
      background:none !important; -webkit-text-fill-color:var(--hc-face,#ffe0d8) !important;
      filter:none !important; animation:none !important; transform:none !important; opacity:1 !important;
      -webkit-text-stroke:.45px color-mix(in srgb,var(--hc-face) 75%,white) !important;
      text-shadow:0 1px 0 #fff5,0 2px 0 var(--hc-edge),0 3px 0 var(--hc-edge),0 4px 0 var(--hc-depth),0 5px 0 var(--hc-depth),0 7px 3px #000c,0 12px 15px #000a !important;
      font-variant-numeric:tabular-nums;
    }
    #blade-hero[data-hc-ready="true"] .bh-clock[data-hc-theme='blood'] .bh-hm {
      -webkit-text-stroke:.45px #e00000 !important;
      text-shadow:0 1px 0 #8f0a14,0 2px 0 #6e0918,0 3px 0 #44060f,0 5px 2px #000a,0 9px 10px #0008 !important;
    }
    /* Blade glow-only: accent halo, fonts/sizes untouched. */
    #blade-hero[data-hc-ready="true"] .bh-clock[data-hc-theme='blood'] .bh-hm {
      filter:drop-shadow(0 0 5px #c80000) drop-shadow(0 0 18px #a80f0f) drop-shadow(0 0 46px #6e0918cc) !important;
    }
    #blade-hero[data-hc-ready="true"] .bh-clock[data-hc-theme='green'] .bh-hm {
      filter:drop-shadow(0 0 6px #00ff88) drop-shadow(0 0 20px #00ff88cc) drop-shadow(0 0 48px #00ff8866) !important;
    }
    #blade-hero[data-hc-ready="true"] .bh-clock[data-hc-theme='orange'] .bh-hm {
      filter:drop-shadow(0 0 6px #ff6a1f) drop-shadow(0 0 20px #ff6a1fcc) drop-shadow(0 0 48px #ff6a1f66) !important;
    }
    #blade-hero[data-hc-ready="true"] .bh-clock[data-hc-theme='cherry'] .bh-hm {
      filter:drop-shadow(0 0 6px #d02d4e) drop-shadow(0 0 20px #d02d4ecc) drop-shadow(0 0 48px #d02d4e66) !important;
    }
    #blade-hero[data-hc-ready="true"] .bh-clock[data-hc-theme='midnight'] .bh-hm {
      filter:drop-shadow(0 0 6px #2f6bff) drop-shadow(0 0 20px #2f6bffcc) drop-shadow(0 0 48px #2f6bff66) !important;
    }
    #blade-hero[data-hc-ready="true"] .bh-clock[data-hc-theme='blood'] .hc-sheen {stroke:#ff3822;stroke-width:.4;}

    #blade-hero[data-hc-ready="true"] .bh-clock[data-hc-theme='custom'] .bh-hm::after {content:none;}
    #blade-hero[data-hc-ready="true"] .bh-sec {
      z-index:2; color:var(--hc-face) !important; -webkit-text-fill-color:var(--hc-face) !important;
      opacity:.82 !important; background:none !important; filter:none !important; animation:none !important;
      text-shadow:0 2px 0 var(--hc-depth),0 3px 4px #000 !important; font-variant-numeric:tabular-nums;font-family:var(--blade-display,'Unbounded','Segoe UI',sans-serif) !important;font-weight:500 !important;
    }
    #blade-hero[data-hc-ready="true"] .bh-hm::after {
      content:attr(data-hc-time); position:absolute; inset:0; color:transparent;
      -webkit-text-fill-color:transparent; -webkit-text-stroke:0; text-shadow:none;
      background:var(--hc-coat);
      background-clip:text; pointer-events:none;
    }
    #blade-hero[data-hc-ready="true"] .hc-motif {position:absolute; z-index:1; inset:-17px -19px auto; width:calc(100% + 38px); height:calc(100% + 48px); overflow:visible; pointer-events:none; color:var(--hc-edge);}
    #blade-hero[data-hc-ready="true"] .bh-clock[data-hc-pulse='true'] .hc-motif {animation:hc-reveal 1150ms ease-out both;}
    #blade-hero[data-hc-ready="true"] .hc-motif .hc-life {fill:url(#blade-hc-material);stroke:var(--hc-edge);stroke-width:.45;stroke-linejoin:round;vector-effect:non-scaling-stroke;opacity:.7;transform-box:fill-box;transform-origin:center;animation:hc-cinder 7s ease-in-out infinite;animation-delay:var(--hc-delay,0ms);}
    #blade-hero[data-hc-ready="true"] .hc-motif .hc-sheen {fill:none;stroke:var(--hc-face);stroke-width:.65;opacity:.65;pointer-events:none;}
    #blade-hero[data-hc-ready="true"] .bh-clock[data-hc-live='false'] .hc-life {animation:none !important;opacity:.35;}
    #blade-hero[data-hc-ready="true"] .bh-clock[data-hc-theme='red'] .hc-life {animation-name:hc-cut;}
    #blade-hero[data-hc-ready="true"] .hc-blood-edge {position:absolute;z-index:3;height:65px;overflow:visible;pointer-events:none;}
    #blade-hero[data-hc-ready="true"] .hc-blood-grow {overflow:visible;transform-box:fill-box;transform-origin:50% 0%;animation:hc-blood-grow var(--hb-cycle) linear infinite;animation-delay:var(--hb-phase);}
    #blade-hero[data-hc-ready="true"] :is(.hc-blood-bulb,.hc-blood-neck,.hc-blood-drop) {transform-box:fill-box;transform-origin:center;animation-duration:var(--hb-cycle);animation-delay:var(--hb-phase);animation-iteration-count:infinite;animation-timing-function:linear;fill:url(#blade-hc-blood-wet);}
    #blade-hero[data-hc-ready="true"] .hc-blood-bulb {animation-name:hc-blood-bulb;}
    #blade-hero[data-hc-ready="true"] .hc-blood-neck {animation-name:hc-blood-neck;}
    #blade-hero[data-hc-ready="true"] .hc-blood-drop {animation-name:hc-blood-fall;}
    #blade-hero[data-hc-ready="true"] .bh-clock[data-hc-live='false'] .hc-blood-edge {display:none;}
    @keyframes hc-blood-grow {0%,100%{transform:scaleY(.12);opacity:.7}16%{transform:scaleY(.27);opacity:.95}45%{transform:scaleY(.76)}63%,84%{transform:scaleY(1);opacity:.95}96%{transform:scaleY(.92);opacity:.8}}
    @keyframes hc-blood-bulb {0%,60%,86%,100%{opacity:0;transform:scale(.25)}64%{opacity:.8;transform:scale(.35)}74%{opacity:1;transform:scale(.75)}81%{opacity:1;transform:scale(1)}84%{opacity:0;transform:scale(.7)}}
    @keyframes hc-blood-neck {0%,61%,85%,100%{opacity:0;transform:scaleX(.4)}63%,73%{opacity:.95;transform:scaleX(1)}79%{opacity:1;transform:scaleX(.5)}83%{opacity:.8;transform:scaleX(.08)}}
    @keyframes hc-blood-fall {0%,82%{opacity:0;transform:translateY(0)}83%{opacity:1;transform:translateY(0)}86%{opacity:1;transform:translateY(1px)}90%{opacity:1;transform:translateY(6px)}94%{opacity:.9;transform:translateY(16px)}98%{opacity:.55;transform:translateY(31px)}100%{opacity:0;transform:translateY(43px)}}
    #blade-hero[data-hc-ready="true"] .bh-clock[data-hc-theme='cherry'] .hc-life {animation-name:hc-petal;animation-duration:8s;}
    #blade-hero[data-hc-ready="true"] .bh-clock[data-hc-theme='orange'] .hc-life {animation-name:hc-cinder;}
    #blade-hero[data-hc-ready="true"] .bh-clock[data-hc-theme='midnight'] .hc-life {animation-name:hc-meteor;animation-duration:9s;}
    #blade-hero[data-hc-ready="true"] .bh-clock[data-hc-theme='green'] .hc-life {animation-name:hc-code;animation-duration:6s;}
    #blade-hero[data-hc-ready="true"] .bh-clock[data-hc-theme='grey'] .hc-life {animation-name:hc-ash;animation-duration:9s;}
    #blade-hero[data-hc-ready="true"] .bh-clock[data-hc-theme='purple'] .hc-life {stroke:none;animation-name:hc-mist;animation-duration:11s;}
    #blade-hero[data-hc-ready="true"] .bh-clock[data-hc-theme='custom'] .hc-life {animation-name:hc-liquid;animation-duration:9s;}
    @keyframes hc-cut {0%,75%,100%{opacity:.3;transform:none}81%{opacity:.95;transform:translateX(4px)}88%{opacity:.65;transform:translateX(-1px)}}
    @keyframes hc-petal {0%{opacity:0;transform:translate(-9px,-14px) rotate(-25deg) scale(.8)}20%{opacity:.85}75%{opacity:.6}100%{opacity:0;transform:translate(11px,15px) rotate(32deg) scale(1)}}
    @keyframes hc-cinder {0%{opacity:0;transform:translateY(13px) rotate(-12deg) scale(.7)}22%{opacity:.95}78%{opacity:.6}100%{opacity:0;transform:translate(7px,-23px) rotate(24deg) scale(.4)}}
    @keyframes hc-meteor {0%,69%{opacity:0;transform:translate(20px,-5px)}73%{opacity:.95}86%,100%{opacity:0;transform:translate(-42px,12px)}}
    @keyframes hc-code {0%{opacity:0;transform:translateY(-12px)}15%,60%{opacity:.9}100%{opacity:0;transform:translateY(17px)}}
    @keyframes hc-ash {0%{opacity:0;transform:translate(-5px,-10px) rotate(-14deg)}20%{opacity:.7}75%{opacity:.4}100%{opacity:0;transform:translate(10px,19px) rotate(48deg)}}
    @keyframes hc-mist {0%,100%{opacity:.15;transform:translateX(-8px) scaleX(.94)}50%{opacity:.45;transform:translate(7px,-3px) scaleX(1.07)}}
    @keyframes hc-liquid {0%,100%{opacity:.4;transform:translateX(-5px) scaleY(.9)}50%{opacity:.8;transform:translateX(5px) scaleY(1.08)}}
    @keyframes hc-reveal {0%{opacity:.15}25%{opacity:1}100%{opacity:.65}}
  `;
  document.documentElement.appendChild(style);
  let clock = null, hm = null, wrap = null, motif = null, minuteObserver = null, bloodEdge = null;
  let lastTheme = '', lastAccent = '', lastTime = '', lastVisible = false, timer = null, disposed = false;
  const svgNS = 'http://www.w3.org/2000/svg';
  function allowed() {
    return !disposed && wrap?.classList.contains('blade-on') && !document.hidden && !reduced.matches &&
      root.getAttribute('data-blade-fx-paused') !== 'true' && root.getAttribute('data-blade-fx-mode') !== 'eco' &&
      !root.hasAttribute('data-blade-battery');
  }
  function stop() {
    if (timer !== null) { window.clearTimeout(timer); timer = null; }
    clock?.removeAttribute('data-hc-pulse');
  }
  function pulse() {
    stop();
    if (!allowed() || (!motifs[lastTheme]?.length && lastTheme !== 'volt')) return;
    if (lastTheme === 'volt') return;
    clock.setAttribute('data-hc-pulse','true');
    timer = window.setTimeout(() => { clock?.removeAttribute('data-hc-pulse'); timer = null; }, 1500);
  }
  function mount() {
    if (clock) return true;
    clock = document.querySelector('#blade-hero .bh-clock');
    if (!clock) return false;
    hm = clock.querySelector('.bh-hm'); wrap = document.getElementById('blade-hero-wrap');
    motif = document.createElementNS(svgNS,'svg');
    motif.classList.add('hc-motif'); motif.setAttribute('viewBox','0 0 420 135');
    motif.setAttribute('preserveAspectRatio','none'); motif.setAttribute('aria-hidden','true');
    clock.prepend(motif);
    document.getElementById('blade-hero').setAttribute('data-hc-ready','true');
    window.Blade?.mark('hero_clock','v1.4.6 OK mounted');
    minuteObserver = new MutationObserver(() => {
      const time = hm.textContent;
      if (time === lastTime) return;
      lastTime = time; hm.setAttribute('data-hc-time',time); alignBlood(); pulse();
    });
    minuteObserver.observe(hm,{childList:true,characterData:true,subtree:true});
    visibilityObserver.observe(wrap,{attributes:true,attributeFilter:['class']});
    return true;
  }
  function sync() {
    if (disposed || !mount()) return;
    const candidate = root.getAttribute('data-blade-theme') || 'red';
    const theme = Object.hasOwn(faces,candidate) ? candidate : 'red';
    const hero=document.getElementById('blade-hero');
    // Red/Grey are v2.0.5; Purple is 2.1.0; Volt stays original.
    if(['volt','red','grey','purple'].includes(theme))hero.removeAttribute('data-hc-ready');else hero.setAttribute('data-hc-ready','true');
    const accent=getComputedStyle(root).getPropertyValue('--accent').trim()||'#ff2a2a';
    const changed = theme !== lastTheme || (theme === 'custom' && accent !== lastAccent);
    lastAccent=accent;
    if (changed) {
      lastTheme = theme; clock.setAttribute('data-hc-theme',theme);
      const palette = faces[theme];
      clock.style.setProperty('--hc-coat',coats[theme]);
      ['face','edge','depth'].forEach((name,i) => clock.style.setProperty('--hc-'+name,palette[i]));
      motif.replaceChildren();
      motif.style.display=motifs[theme].length && !['red','grey'].includes(theme) ? '' : 'none';
      bloodEdge?.remove(); bloodEdge=null;
      if (theme==='blood') buildBlood();

      if (motifs[theme].length && !['red','grey'].includes(theme)) {
      const defs=document.createElementNS(svgNS,'defs');
      const gradient=document.createElementNS(svgNS,'linearGradient');
      gradient.id='blade-hc-material';gradient.setAttribute('x1','0%');gradient.setAttribute('y1','0%');gradient.setAttribute('x2','100%');gradient.setAttribute('y2','90%');
      const colors=theme==='blood'?['#d70000','#ff1111','#ff3a22','#ff0808','#cb0000']:[palette[2],palette[1],palette[0],palette[1],palette[2]];
      colors.forEach((color,i)=>{const stop=document.createElementNS(svgNS,'stop');stop.setAttribute('offset',`${i*25}%`);stop.setAttribute('stop-color',color.includes('var(')?accent:color);gradient.appendChild(stop);});
      defs.appendChild(gradient);motif.appendChild(defs);
      motifs[theme].forEach((d,i)=>{
        const path=document.createElementNS(svgNS,'path');path.setAttribute('d',d);path.classList.add('hc-life');
        path.style.setProperty('--hc-delay',`${-i*1370}ms`);motif.appendChild(path);
      });
      const sheen=document.createElementNS(svgNS,'path');sheen.setAttribute('d',motifs[theme][0]);sheen.classList.add('hc-life','hc-sheen');motif.appendChild(sheen);
      }
    }
    lastTime=hm.textContent; hm.setAttribute('data-hc-time',lastTime);
    const visible=allowed();
    clock.setAttribute('data-hc-live',String(visible));
    if (theme==='blood' && visible) alignBlood();
    if (!visible) stop(); else if(changed || !lastVisible) pulse();
    lastVisible=visible;
  }
  function alignEffects() { alignBlood(); }
  function buildBlood() {
    bloodEdge=document.createElementNS(svgNS,'svg');bloodEdge.classList.add('hc-blood-edge');bloodEdge.setAttribute('aria-hidden','true');clock.appendChild(bloodEdge);
    const defs=document.createElementNS(svgNS,'defs'),gradient=document.createElementNS(svgNS,'linearGradient');gradient.id='blade-hc-blood-wet';gradient.setAttribute('x1','0%');gradient.setAttribute('x2','100%');
    [['0%','#30040c'],['28%','#6e0918'],['62%','#a91e30'],['100%','#440612']].forEach(([offset,color])=>{const stop=document.createElementNS(svgNS,'stop');stop.setAttribute('offset',offset);stop.setAttribute('stop-color',color);gradient.appendChild(stop);});defs.appendChild(gradient);bloodEdge.appendChild(defs);
    const trails=[
      {w:4.3,h:17,d:'M2 -2C5 0 7 -1 9 1C8 12 7 19 8 28C9 39 7 51 7 62C7 74 10 81 9 89C8 98 4 102 2 94C0 87 3 77 3 66C4 52 2 43 3 33C4 19 1 10 2 -2Z',shine:'M6 8C5 23 6 36 5 48M5 69C5 76 7 84 6 91'},
      {w:3.8,h:22,d:'M4 -2L9 0C6 16 10 22 8 35C6 48 8 57 6 68C5 79 8 85 7 94C6 103 3 101 2 94C1 87 4 77 3 66C2 53 5 44 4 34C2 20 5 12 4 -2Z',shine:'M6 5C5 18 7 23 6 32M5 53L4 72M5 86L4 95'},
      {w:4.8,h:15,d:'M3 -2L9 0C8 10 6 15 7 28C8 41 5 46 6 59C7 72 5 76 7 88C8 96 4 102 2 94C0 87 3 80 2 70C1 57 4 49 3 39C2 26 5 14 3 -2Z',shine:'M6 8L5 20M5 35C5 43 4 48 4 58M4 73L4 91'}
    ];
    trails.forEach((trail,i)=>{
      const group=document.createElementNS(svgNS,'g');group.setAttribute('data-hb-digit',[0,1,3][i]);group.style.setProperty('--hb-cycle',(6.4+i*.7)+'s');group.style.setProperty('--hb-phase',(-i*2.15)+'s');bloodEdge.appendChild(group);
      const reservoir=document.createElementNS(svgNS,'ellipse');reservoir.classList.add('hc-blood-reservoir');reservoir.setAttribute('cx','0');reservoir.setAttribute('cy','-1');reservoir.setAttribute('rx','1.45');reservoir.setAttribute('ry','1.8');reservoir.setAttribute('fill','url(#blade-hc-blood-wet)');group.appendChild(reservoir);
      const stream=document.createElementNS(svgNS,'svg');stream.setAttribute('viewBox','0 0 12 100');stream.setAttribute('preserveAspectRatio','none');stream.setAttribute('x',-trail.w/2);stream.setAttribute('y','-2');stream.setAttribute('width',trail.w);stream.setAttribute('height',trail.h);stream.classList.add('hc-blood-grow');group.appendChild(stream);
      const body=document.createElementNS(svgNS,'path');body.setAttribute('d',trail.d);body.setAttribute('fill','url(#blade-hc-blood-wet)');body.setAttribute('stroke','#37050e');body.setAttribute('stroke-width','.35');stream.appendChild(body);
      const shine=document.createElementNS(svgNS,'path');shine.setAttribute('d',trail.shine);shine.setAttribute('fill','none');shine.setAttribute('stroke','#d17783');shine.setAttribute('stroke-width','.45');shine.setAttribute('opacity','.35');shine.setAttribute('stroke-linecap','round');stream.appendChild(shine);
      const tip=trail.h-3;
      const neck=document.createElementNS(svgNS,'path');neck.setAttribute('d',`M-.8 ${tip-1}L.7 ${tip-1}L1 ${tip+3}L-1 ${tip+3}Z`);neck.classList.add('hc-blood-neck');group.appendChild(neck);
      const bulb=document.createElementNS(svgNS,'ellipse');bulb.setAttribute('cx','0');bulb.setAttribute('cy',tip+3);bulb.setAttribute('rx','1.9');bulb.setAttribute('ry','3');bulb.classList.add('hc-blood-bulb');group.appendChild(bulb);
      const drop=document.createElementNS(svgNS,'path');drop.setAttribute('d',`M0 ${tip}C-1.2 ${tip+2} -2 ${tip+3} -1.7 ${tip+5}C-1.2 ${tip+7} 1.3 ${tip+7} 1.8 ${tip+5}C2 ${tip+3} 1 ${tip+2} 0 ${tip}Z`);drop.classList.add('hc-blood-drop');group.appendChild(drop);
    });
  }
  function alignBlood() {
    if (!bloodEdge || !hm) return;
    const textNode=Array.from(hm.childNodes).find(node=>node.nodeType===3);
    if (!textNode) return;
    const text=textNode.textContent, digits=Array.from(text.matchAll(/[0-9]/g),match=>match.index);
    if (digits.length<4) {bloodEdge.style.visibility='hidden';return;}
    // Range locates each digit's advance; its raster silhouette locates the wet edge.
    // A shared descent or a fraction of the clock width can land in empty space (1/7).
    const probe=document.createElementNS(NS,'span');probe.style.cssText='display:inline-block;width:0;height:0;vertical-align:baseline;';hm.appendChild(probe);
    const hmRect=hm.getBoundingClientRect(),clockRect=clock.getBoundingClientRect(),baseline=probe.getBoundingClientRect().top;probe.remove();
    if (!hmRect.width) {bloodEdge.style.visibility='hidden';return;}
    const computed=getComputedStyle(hm),scale=Math.max(2,Math.min(3,window.devicePixelRatio||1));
    const canvas=document.createElementNS(NS,'canvas'),context=canvas.getContext('2d',{willReadFrequently:true});
    const font=`${computed.fontStyle} ${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`;
    context.font=font;context.fontKerning=computed.fontKerning;context.fontStretch=computed.fontStretch;
    const metrics=context.measureText(text),pad=4;
    const ascent=Math.ceil(metrics.actualBoundingBoxAscent||parseFloat(computed.fontSize)),descent=Math.ceil(metrics.actualBoundingBoxDescent||0);
    canvas.width=Math.ceil((hmRect.width+pad*2)*scale);canvas.height=Math.ceil((ascent+descent+pad*2)*scale);
    context.scale(scale,scale);context.font=font;context.fontKerning=computed.fontKerning;context.fontStretch=computed.fontStretch;context.fillStyle='#fff';
    const range=document.createRange(),ranges=[];
    // Draw separately at DOM-measured advances: works even without Canvas letterSpacing.
    for (let index=0;index<text.length;index++) {
      range.setStart(textNode,index);range.setEnd(textNode,index+1);
      const rect=range.getBoundingClientRect();ranges[index]=rect;
      context.fillText(text[index],pad+rect.left-hmRect.left,pad+ascent);
    }
    const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
    bloodEdge.style.left=(hmRect.left-clockRect.left)+'px';bloodEdge.style.top=(baseline-clockRect.top)+'px';bloodEdge.style.width=hmRect.width+'px';bloodEdge.setAttribute('viewBox',`0 0 ${hmRect.width} 65`);
    bloodEdge.style.visibility='';
    bloodEdge.querySelectorAll('[data-hb-digit]').forEach(group=>{
      const index=digits[Number(group.getAttribute('data-hb-digit'))],rect=ranges[index];
      const left=Math.max(0,Math.floor((pad+rect.left-hmRect.left)*scale)),right=Math.min(canvas.width,Math.ceil((pad+rect.right-hmRect.left)*scale));
      const columns=[];let bottom=-1;
      for (let x=left;x<right;x++) {
        for (let y=canvas.height-1;y>=0;y--) {
          if (pixels[(y*canvas.width+x)*4+3]>=160) {columns.push({x,y});bottom=Math.max(bottom,y);break;}
        }
      }
      if (bottom<0) {group.style.display='none';return;}
      group.style.display='';
      const centre=(columns[0].x+columns[columns.length-1].x)/2;
      // Stay on the lowest connected ink, with enough overlap for the reservoir.
      const candidates=columns.filter(point=>point.y>=bottom-Math.ceil(scale));
      candidates.sort((a,b)=>Math.abs(a.x-centre)-Math.abs(b.x-centre));
      const point=candidates[0],x=(point.x+.5)/scale-pad,y=(point.y+.5)/scale-pad-ascent;
      group.setAttribute('transform',`translate(${x} ${y})`);
      group.setAttribute('data-hb-contact',`${text[index]}:${index}:${x.toFixed(3)}:${y.toFixed(3)}`);
    });
    range.detach();canvas.width=canvas.height=0;
  }
  const visibilityObserver = new MutationObserver(sync);
  const rootObserver = new MutationObserver(sync);
  rootObserver.observe(root,{attributes:true,attributeFilter:['data-blade-theme','data-blade-fx-mode','data-blade-fx-paused','data-blade-battery','style']});
  const progress = {onLocationChange:sync};
  gBrowser.addTabsProgressListener(progress);
  gBrowser.tabContainer.addEventListener('TabSelect',sync);
  reduced.addEventListener('change',sync);
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('resize',alignEffects);
  const fontChanged=()=>{if(!disposed) alignEffects();};
  document.fonts?.addEventListener('loadingdone',fontChanged);
  document.fonts?.ready.then(()=>{if(!disposed) alignEffects();}).catch(()=>{});
  let mountObserver = null;
  if (!mount()) {
    mountObserver = new MutationObserver(() => {if(mount()){mountObserver.disconnect();mountObserver=null;sync();}});
    mountObserver.observe(document.getElementById('browser') || root,{childList:true,subtree:true});
  }
  function destroy() {
    if (disposed) return;
    disposed=true;stop();rootObserver.disconnect();visibilityObserver.disconnect();minuteObserver?.disconnect();mountObserver?.disconnect();
    gBrowser.removeTabsProgressListener(progress);gBrowser.tabContainer.removeEventListener('TabSelect',sync);
    reduced.removeEventListener('change',sync);document.removeEventListener('visibilitychange',sync);window.removeEventListener('resize',alignEffects);
    document.fonts?.removeEventListener('loadingdone',fontChanged);
    bloodEdge?.remove();motif?.remove();document.getElementById('blade-hero')?.removeAttribute('data-hc-ready');style.remove();
    hm?.removeAttribute('data-hc-time');clock?.removeAttribute('data-hc-theme');clock?.removeAttribute('data-hc-live');
    ['face','edge','depth','coat'].forEach(name=>clock?.style.removeProperty('--hc-'+name));
  }
  window.BladeHeroClock={sync,destroy,state:()=>({theme:lastTheme,time:lastTime,running:allowed(),pulse:timer!==null,electric:null,nodes:(motif?.querySelectorAll('*').length||0)+(bloodEdge?.querySelectorAll('*').length||0)})};
  window.addEventListener('unload',destroy,{once:true});
  sync();
})();
