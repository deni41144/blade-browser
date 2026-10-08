// ==UserScript==
// @name            Blade Theme Events
// @description     Occasional material events over the original theme atmospheres
// @include         main
// @version         1.0.0
// @loadOrder       98
// ==/UserScript==
(function () {
  if (window.BladeThemeEvents) return;
  const H='http://www.w3.org/1999/xhtml', S='http://www.w3.org/2000/svg';
  const root=document.documentElement, reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const supported=new Set(['red','orange','midnight','green','purple']);
  let wrap, layer, clock, clockLayer, signature='', theme='', disposed=false, running=false;
  const style=document.createElementNS(H,'style');
  style.id='blade-theme-events-style';
  style.textContent=`
    #blade-theme-events{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;contain:paint;}
    #blade-theme-events>svg{width:100%;height:100%;}
    .bte-clock{position:absolute;inset:-8px -12px;z-index:3;width:calc(100% + 24px);height:calc(100% + 16px);pointer-events:none;overflow:visible;}
    .bte-event{opacity:0;transform-box:fill-box;transform-origin:center;animation:bte-flash var(--cycle,12s) linear var(--phase,0s) infinite;}
    .bte-shard{animation-name:bte-shard;}
    .bte-ember{animation-name:bte-ember;}
    .bte-ring{animation-name:bte-ring;}
    .bte-code{animation-name:bte-code;}
    .bte-clock .bte-event{animation-duration:9s;}
    #blade-theme-events[data-paused=true] *, .bte-clock[data-paused=true] *{animation-play-state:paused!important;}
    #blade-theme-events[data-disabled=true], .bte-clock[data-disabled=true]{display:none!important;}
    @keyframes bte-flash{0%,68%,73%,100%{opacity:0}69%{opacity:.9}70%{opacity:.28}71%{opacity:.8}72%{opacity:.1}}
    @keyframes bte-shard{0%,68%{opacity:0;transform:translate(0,0) rotate(0)}69%{opacity:.8}76%{opacity:.35;transform:translate(var(--dx,15px),var(--dy,26px)) rotate(22deg)}82%,100%{opacity:0;transform:translate(var(--dx,15px),var(--dy,26px)) rotate(38deg)}}
    @keyframes bte-ember{0%,59%{opacity:0;transform:translate(0,0) rotate(-14deg) scale(.4)}60%{opacity:.8}67%{opacity:.9;transform:translate(var(--dx,15px),-72px) rotate(46deg) scale(1)}76%,100%{opacity:0;transform:translate(var(--dx,15px),-145px) rotate(100deg) scale(.15)}}
    @keyframes bte-ring{0%,68%{opacity:0;transform:scale(.12)}69%{opacity:.55}76%{opacity:.12;transform:scale(1)}79%,100%{opacity:0;transform:scale(1.16)}}
    @keyframes bte-code{0%,61%,76%,100%{opacity:0;transform:translateY(0)}62%,64%{opacity:.75}65%{opacity:.15}66%,69%{opacity:.8;transform:translateY(12px)}70%{opacity:.2}72%,74%{opacity:.6;transform:translateY(24px)}}
  `;
  root.appendChild(style);
  function node(name,attrs,parent){const n=document.createElementNS(S,name);for(const [key,value] of Object.entries(attrs))n.setAttribute(key,value);parent.appendChild(n);return n;}
  function event(parent,kind,index,cycle=12){return node('g',{class:'bte-event '+kind,style:`--cycle:${cycle}s;--phase:-${index*2.37}s;--dx:${index%2?-19:24}px;--dy:${22+index*5}px`},parent);}
  function line(parent,d,color,width=1,opacity=1){return node('path',{d,fill:'none',stroke:color,'stroke-width':width,opacity,'stroke-linejoin':'bevel'},parent);}
  function shard(parent,x,y,color,index){const g=event(node('g',{transform:`translate(${x} ${y})`},parent),'bte-shard',index);node('path',{d:'M0 -8L5 -1 2 7 -4 2Z',fill:color},g);line(g,'M0 -8L1 0 2 7M1 0L5 -1','#ebe3ff',.55,.75);}
  function draw(parent,isClock,balanced){
    const width=isClock?420:1440, height=isClock?120:800;
    parent.setAttribute('viewBox',`0 0 ${width} ${height}`);parent.setAttribute('preserveAspectRatio','none');
    if(theme==='orange'){
      const count=isClock?4:balanced?6:10;
      for(let i=0;i<count;i++){
        const x=isClock?55+i*80:(i%2?1160:75)+(i%5)*32,y=isClock?98:765;
        const g=event(node('g',{transform:`translate(${x} ${y})`},parent),'bte-ember',i,11+i%3);
        node('path',{d:'M-2 -5L2 -3 3 1 0 5 -3 1Z',fill:i%2?'#ff8a28':'#ffc069'},g);
        line(g,'M0 -3L1 1','#ffe7bd',.6);
      }
    }else if(theme==='midnight'){
      for(let i=0;i<(isClock?2:3);i++){
        const x=isClock?115+i*195:125+i*590,y=isClock?48:155+i%2*390;
        const anchor=node('g',{transform:`translate(${x} ${y})`},parent);
        const flash=event(anchor,'',i,14+i*2);
        line(flash,'M-22 0L22 0M0 -22L0 22','#9bcfff',.8,.7);
        line(flash,'M-7 -7L7 7M7 -7L-7 7','#ebf4ff',.7,.85);
        node('circle',{r:1.8,fill:'#e6f3ff'},flash);
        node('circle',{r:22,fill:'none',stroke:'#77a9de','stroke-width':.6,class:'bte-event bte-ring',style:`--cycle:${14+i*2}s;--phase:-${i*2.37}s`},anchor);
      }
    }else if(theme==='green'){
      for(let i=0;i<(isClock?3:balanced?3:5);i++){
        const x=isClock?70+i*132:i%2?1260-i*18:55+i*41,y=isClock?30:55+i*111;
        const g=event(node('g',{transform:`translate(${x} ${y})`},parent),'bte-code',i,9+i*.7);
        line(g,'M0 0H7V7H0ZM12 10H16V16H12ZM0 24H5V29H0ZM10 35H17V42H10Z','#6ee7aa',.9,.85);
        line(g,'M0 4H5M12 13H16M10 39H16','#d4ffe9',.6,.9);
      }
    }else if(theme==='purple'){
      for(let i=0;i<(isClock?3:balanced?4:6);i++){
        const x=isClock?65+i*145:i%2?1170+i*24:55+i*43,y=isClock?64:190+i*58;
        shard(parent,x,y,'#a889e0',i);
        const g=event(node('g',{transform:`translate(${x} ${y})`},parent),'',i,12);
        line(g,'M-16 0H16M0 -16V16','#c8b1f1',.55,.55);
      }
    }else if(theme==='red'){
      const count=isClock?2:balanced?2:3;
      for(let i=0;i<count;i++){
        const x=isClock?38+i*265:i%2?1130:45+i*60,y=isClock?65:220+i*170;
        const g=event(node('g',{transform:`translate(${x} ${y})`},parent),'',i,13+i);
        line(g,'M0 19L87 -24','#ff3946',3,.2);line(g,'M2 18L83 -22','#ff9a98',.8,.9);
        shard(parent,x+48,y-7,'#df3b48',i);shard(parent,x+76,y-19,'#ff7778',i+count);
      }
    }
  }
  function sync(){
    if(disposed||!layer)return;
    theme=root.getAttribute('data-blade-theme')||'red';
    const fx=window.BladeEffects?.contentState()||{mode:'vivid'};
    const disabled=!supported.has(theme)||fx.mode==='eco'||fx.battery||root.hasAttribute('data-blade-battery');
    running=!disabled&&!fx.paused&&!reduced.matches&&!document.hidden&&wrap.classList.contains('blade-on');
    for(const target of [layer,clockLayer]){target.dataset.paused=String(!running);target.dataset.disabled=String(disabled);}
    const key=disabled?'':theme+'|'+fx.mode;
    if(key===signature)return;
    signature=key;layer.replaceChildren();clockLayer.replaceChildren();
    if(disabled)return;
    const svg=node('svg',{'aria-hidden':'true'},layer);draw(svg,false,fx.mode==='balanced');draw(clockLayer,true,fx.mode==='balanced');
  }
  const rootObserver=new MutationObserver(sync), wrapObserver=new MutationObserver(sync), bootObserver=new MutationObserver(boot);
  function boot(){
    if(disposed||layer)return;
    wrap=document.getElementById('blade-hero-wrap');clock=document.querySelector('#blade-hero .bh-clock');
    if(!wrap||!clock)return;
    layer=document.createElementNS(H,'div');layer.id='blade-theme-events';layer.setAttribute('aria-hidden','true');wrap.prepend(layer);
    clockLayer=node('svg',{class:'bte-clock','aria-hidden':'true'},clock);
    bootObserver.disconnect();wrapObserver.observe(wrap,{attributes:true,attributeFilter:['class']});sync();
    window.Blade?.mark('theme_events','v1.0.0 OK');
  }
  rootObserver.observe(root,{attributes:true,attributeFilter:['data-blade-theme','data-blade-fx-mode','data-blade-fx-paused','data-blade-battery']});
  document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
  function destroy(){disposed=true;rootObserver.disconnect();wrapObserver.disconnect();bootObserver.disconnect();document.removeEventListener('visibilitychange',sync);reduced.removeEventListener('change',sync);layer?.remove();clockLayer?.remove();style.remove();}
  window.BladeThemeEvents={sync,destroy,status:()=>({theme,running,nodes:(layer?.querySelectorAll('*').length||0)+(clockLayer?.querySelectorAll('*').length||0),disabled:layer?.dataset.disabled==='true'})};
  boot();if(!layer)bootObserver.observe(root,{childList:true,subtree:true});window.addEventListener('unload',destroy,{once:true});
})();
