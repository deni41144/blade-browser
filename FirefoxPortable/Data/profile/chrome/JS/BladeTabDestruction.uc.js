// ==UserScript==
// @name            Blade Tab Destruction
// @description     Bounded theme-specific tab closing scenes
// @author          Blade-Creations
// @include         main
// @version         1.3.0
// @loadOrder       11
// ==/UserScript==
(function () {
  if (window.BladeTabDestruction || !window.gBrowser) return;
  const H = 'http://www.w3.org/1999/xhtml';
  const root = document.documentElement;
  const host = document.getElementById('navigator-toolbox');
  if (!host) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const scenes = new Map();
  let bloodSequence = 0;
  const allowed = () => !reduced.matches && !!window.BladeEffects?.canAnimate();
  const style = document.createElementNS(H,'style');
  style.id = 'blade-tab-destruction-style';
  style.textContent = `
    .blade-tab-destruction {position:absolute;pointer-events:none;z-index:1003;isolation:isolate;}
    .blade-tab-destruction * {pointer-events:none!important;box-sizing:border-box;}
    .bd-fragment,.bd-face {position:absolute;inset:0;border:1px solid color-mix(in srgb,var(--bd-accent) 45%,transparent);border-radius:8px 8px 0 0;
      background:var(--blade-material,linear-gradient(#23252a,#14161b));overflow:hidden;}
    .bd-title {position:absolute;left:31px;right:22px;top:50%;transform:translateY(-50%);font:12px system-ui;color:#e2e4e9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .bd-icon {position:absolute;left:10px;top:50%;width:16px;height:16px;transform:translateY(-50%);}
    .bd-particle {position:absolute;background:var(--bd-accent);}
    .blade-tab-destruction[data-theme=blood] .bd-blood {position:absolute;inset:0;overflow:visible;}
    .blade-tab-destruction[data-theme=blood] .bd-fragment {border-color:#6e091266;}
    .blade-tab-destruction[data-theme=volt] .bd-particle {width:42px;height:8px;background:linear-gradient(90deg,transparent,var(--bd-accent),#fffbd6,transparent);
      clip-path:polygon(0 45%,22% 45%,35% 0,48% 67%,64% 16%,78% 48%,100% 35%,100% 55%,77% 75%,65% 46%,48% 100%,35% 38%,23% 65%,0 65%);}
    .blade-tab-destruction[data-theme=cherry] .bd-particle {width:9px;height:12px;border-radius:80% 15% 75% 30%;background:linear-gradient(130deg,#f5afc4,var(--bd-accent) 55%,#852c4c);}
    .blade-tab-destruction[data-theme=orange] .bd-particle {width:2px;height:5px;border-radius:60% 25% 50% 35%;background:linear-gradient(#ffd496,#cd5828);}
    .blade-tab-destruction[data-theme=midnight] .bd-particle {width:2px;height:2px;border-radius:50%;background:#b9d0ef;box-shadow:0 0 3px #587fb1;}
    .blade-tab-destruction[data-theme=green] .bd-particle {width:8px;height:3px;background:linear-gradient(90deg,var(--bd-accent) 50%,transparent 50%);}
    .blade-tab-destruction[data-theme=purple] .bd-particle {width:6px;height:12px;clip-path:polygon(50% 0,100% 65%,50% 100%,0 65%);background:linear-gradient(120deg,#ccb7e8,var(--bd-accent) 45%,#56426f);}
    .blade-tab-destruction[data-theme=custom] .bd-particle {width:28px;height:28px;margin:-14px;border:1px solid var(--bd-accent);border-radius:50%;background:transparent;}
    .blade-tab-destruction[data-theme=grey] .bd-fragment {border-color:#7f88935c;}
  `;
  root.appendChild(style);
  function remove(scene) {
    const record=scenes.get(scene);if(!record)return;
    clearTimeout(record.timer);for(const animation of record.animations)animation.cancel();
    scene.remove();scenes.delete(scene);
  }
  function clear() {for(const scene of [...scenes.keys()])remove(scene);}
  function closed(event) {
    if (!allowed()) return;
    const tab=event.target, rect=tab.getBoundingClientRect(), base=host.getBoundingClientRect();
    // Do not animate tabs outside the visible tab strip or a closing window.
    const strip=document.getElementById('TabsToolbar')?.getBoundingClientRect();
    if(!rect.width || !strip || rect.right<=strip.left || rect.left>=strip.right || window.closed)return;
    while(scenes.size>=3)remove(scenes.keys().next().value);
    const theme=root.getAttribute('data-blade-theme')||'red';
    const scene=document.createElementNS(H,'div');scene.className='blade-tab-destruction';scene.dataset.theme=theme;scene.setAttribute('aria-hidden','true');
    Object.assign(scene.style,{left:`${rect.left-base.left}px`,top:`${rect.top-base.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});
    scene.style.setProperty('--bd-accent',getComputedStyle(root).getPropertyValue('--accent').trim()||'#ff2a2a');
    scene.style.setProperty('--blade-material',getComputedStyle(root).getPropertyValue('--blade-material').trim()||'linear-gradient(#23252a,#14161b)');
    const animations=[];
    const animate=(node,frames,duration,delay=0)=>animations.push(node.animate(frames,{duration,delay,easing:'cubic-bezier(.2,.65,.3,1)',fill:'both'}));
    const make=kind=>{const node=document.createElementNS(H,'span');node.className='bd-'+kind;scene.appendChild(node);return node;};
    const face=(node)=>{
      const title=document.createElementNS(H,'span');title.className='bd-title';title.textContent=tab.label||'';node.appendChild(title);
      const original=tab.querySelector('.tab-icon-image');
      if(original?.getAttribute('src')) {const icon=document.createElementNS(H,'img');icon.className='bd-icon';icon.src=original.getAttribute('src');node.appendChild(icon);}
    };
    const balanced=window.BladeEffects.mode()==='balanced';
    const fractured=['red','grey','purple','green','volt'].includes(theme);
    host.appendChild(scene);
    if(theme==='blood') {
      const plate=make('face');face(plate);
      animate(plate,[{opacity:.85},{opacity:.62,offset:.6},{opacity:0}],1050);
      const S='http://www.w3.org/2000/svg';
      const svg=document.createElementNS(S,'svg');svg.classList.add('bd-blood');
      svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height+75}`);svg.setAttribute('preserveAspectRatio','none');
      svg.setAttribute('width',rect.width);svg.setAttribute('height',rect.height+75);
      svg.setAttribute('aria-hidden','true');scene.appendChild(svg);
      const element=(name,attrs,parent)=>{const node=document.createElementNS(S,name);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);parent.appendChild(node);return node;};
      const defs=element('defs',{},svg),id='bd-blood-wet-'+(++bloodSequence);
      const gradient=element('linearGradient',{id,x1:'0%',x2:'100%'},defs);
      // Same silhouettes and wet material as the accepted tile renderer.
      [['0%','#30040c'],['28%','#6e0918'],['62%','#a91e30'],['100%','#440612']].forEach(([offset,color])=>element('stop',{offset,'stop-color':color},gradient));
      const trails=[
        {x:.13,w:6,len:24,d:'M2 -2C5 0 7 -1 9 1C8 12 7 19 8 28C9 39 7 51 7 62C7 74 10 81 9 89C8 98 4 102 2 94C0 87 3 77 3 66C4 52 2 43 3 33C4 19 1 10 2 -2Z',shine:'M6 8C5 23 6 36 5 48M5 69C5 76 7 84 6 91'},
        {x:.38,w:4.5,len:34,d:'M4 -2L9 0C6 16 10 22 8 35C6 48 8 57 6 68C5 79 8 85 7 94C6 103 3 101 2 94C1 87 4 77 3 66C2 53 5 44 4 34C2 20 5 12 4 -2Z',shine:'M6 5C5 18 7 23 6 32M5 53L4 72M5 86L4 95'},
        {x:.62,w:7,len:18,d:'M1 -2L10 0C7 8 9 22 7 34C5 44 8 55 7 63C6 75 10 79 8 89C7 99 3 102 1 94C-1 86 3 78 3 67C4 52 1 44 3 33C5 18 0 11 1 -2Z',shine:'M5 5C6 16 5 22 5 32M4 47C5 58 4 64 5 70M5 83L4 93'},
        {x:.85,w:5,len:28,d:'M3 -2L9 0C8 10 6 15 7 28C8 41 5 46 6 59C7 72 5 76 7 88C8 96 4 102 2 94C0 87 3 80 2 70C1 57 4 49 3 39C2 26 5 14 3 -2Z',shine:'M6 8L5 20M5 35C5 43 4 48 4 58M4 73L4 91'},
      ];
      const flow=(node,frames,duration,delay=0,easing='linear')=>animations.push(node.animate(frames,{duration,delay,easing,fill:'both'}));
      const wet=()=>({fill:`url(#${id})`,stroke:'#37050e','stroke-width':'.35'});
      (balanced?trails.slice(0,3):trails).forEach((trail,i)=>{
        const x=trail.x*rect.width,y=rect.height-2,delay=i*60;
        const stream=element('svg',{x,y,width:trail.w,height:trail.len,viewBox:'0 0 12 100',preserveAspectRatio:'none',overflow:'visible','class':'bd-blood-stream'},svg);
        stream.style.transformBox='fill-box';stream.style.transformOrigin='center top';
        element('path',{d:trail.d,...wet()},stream);
        element('path',{d:trail.shine,fill:'none',stroke:'#d17783','stroke-width':'.45',opacity:'.35','stroke-linecap':'round'},stream);
        flow(stream,[{opacity:0,transform:'scaleY(.04)'},{opacity:.95,transform:'scaleY(.2)',offset:.12},{opacity:.95,transform:'scaleY(.62)',offset:.5},{opacity:.95,transform:'scaleY(1)',offset:.78},{opacity:0,transform:'scaleY(1.02)'}],1120,delay);
        const cx=x+trail.w*.43,cy=y+trail.len-2;
        const shape=`M${cx} ${cy-2}C${cx-1.1} ${cy-.5} ${cx-2} ${cy+1.1} ${cx-1.8} ${cy+2.5}C${cx-1.4} ${cy+5.1} ${cx+1.8} ${cy+5} ${cx+2} ${cy+2.6}C${cx+2.2} ${cy+1} ${cx+.9} ${cy-.6} ${cx} ${cy-2}Z`;
        const reservoir=element('path',{d:shape,...wet(),'class':'bd-blood-reservoir'},svg);
        reservoir.style.transformBox='fill-box';reservoir.style.transformOrigin='center top';
        flow(reservoir,[{opacity:0,transform:'scale(.15,.1)'},{opacity:.95,transform:'scale(.3,.35)',offset:.25},{opacity:.95,transform:'scale(.85,.85)',offset:.65},{opacity:.95,transform:'scale(1,1.1)',offset:.84},{opacity:.95,transform:'scale(1,1.1)',offset:.92},{opacity:0,transform:'scale(.8,1.3)'}],160,875+delay);
        const neck=element('path',{d:`M${cx-.7} ${cy-5}L${cx+.7} ${cy-5}L${cx+.7} ${cy+1}L${cx-.7} ${cy+1}Z`,...wet(),'class':'bd-blood-neck'},svg);
        neck.style.transformBox='fill-box';neck.style.transformOrigin='center top';
        flow(neck,[{opacity:0,transform:'scaleX(1)'},{opacity:.95,transform:'scaleX(1)',offset:.25},{opacity:.95,transform:'scaleX(1)',offset:.78},{opacity:.95,transform:'scaleX(.15)',offset:.9},{opacity:0,transform:'scaleX(.05)'}],160,875+delay);
        const drop=element('path',{d:shape,...wet(),'class':'bd-blood-drop'},svg);
        flow(drop,[{opacity:0,transform:'translateY(0)'},{opacity:.95,transform:'translateY(0)',offset:.07},{opacity:.9,transform:'translateY(10px)',offset:.55},{opacity:0,transform:'translateY(42px)'}],360,1035+delay,'cubic-bezier(.5,0,.9,.4)');
      });
    } else if(fractured) {
      const count=balanced?3:5;
      for(let i=0;i<count;i++) {
        const node=make('fragment');face(node);
        const l=i*100/count,r=(i+1)*100/count,skew=theme==='grey'?9:theme==='red'?16:4;
        node.style.clipPath=`polygon(${l}% 0,${r}% 0,${r-skew}% 100%,${l-skew}% 100%)`;
        const dx=theme==='red'?(i-2)*11:theme==='grey'?(i-2)*7:theme==='volt'?(i%2?12:-12):(i-2)*5;
        const dy=theme==='grey'?12+i*4:theme==='green'?(i%2?7:-7):theme==='purple'?-12-i*3:-6-i*2;
        animate(node,[{opacity:.9,transform:'translate(0,0) scale(1)'},{opacity:.65,transform:`translate(${dx*.35}px,${dy*.35}px) rotate(${i%2?2:-2}deg)`,offset:.35},{opacity:0,transform:`translate(${dx}px,${dy}px) rotate(${theme==='grey'?(i-2)*6:0}deg) scale(${theme==='green'?'.15':'.85'})`}],620,i*24);
      }
    } else {
      const node=make('face');face(node);
      animate(node,[{opacity:.85,transform:'scale(1)'},{opacity:0,transform:theme==='blood'?'scaleY(.15)':theme==='custom'?'scaleX(.15)':'scale(.85)'}],theme==='blood'?310:400);
    }
    if(!['grey','red','blood'].includes(theme)) {
      const count=balanced?4:theme==='custom'?3:theme==='blood'?4:theme==='volt'?5:10;
      for(let i=0;i<count;i++) {
        const node=make('particle');const x=(i+.5)*rect.width/count;
        node.style.left=x+'px';node.style.top=(theme==='blood'?3:8+i%3*7)+'px';
        if(theme==='blood') {
          node.style.height=(17+i%3*7)+'px';node.style.width=(3+i%2*1.5)+'px';
          animate(node,[{opacity:0,transform:'scaleY(.15)'},{opacity:.9,transform:'scaleY(1)',offset:.35},{opacity:0,transform:`translateY(${15+i*4}px) scaleY(1.3)`}],720,i*30);
        } else {
          const dx=(i%2?1:-1)*(8+i*3),dy=theme==='cherry'?17+i%3*8:theme==='orange'?-16-i%3*9:theme==='midnight'?-8-i%4*5:(i%2?14:-14);
          animate(node,[{opacity:0,transform:'translate(0,0) scale(.3)'},{opacity:.85,transform:'translate(0,0) scale(1)',offset:.2},{opacity:0,transform:`translate(${dx}px,${dy}px) rotate(${theme==='cherry'?70+i*15:0}deg) scale(${theme==='custom'?2:'.4'})`}],620,i*18);
        }
      }
    }
    scenes.set(scene,{animations,timer:setTimeout(()=>remove(scene),theme==='blood'?1600:1000)});
  }
  const changed=()=>{if(!allowed())clear();};
  gBrowser.tabContainer.addEventListener('TabClose',closed);
  reduced.addEventListener('change',changed);window.Blade.bus.on('fx:changed',changed);
  function destroy(){clear();gBrowser.tabContainer.removeEventListener('TabClose',closed);reduced.removeEventListener('change',changed);window.Blade?.bus.off('fx:changed',changed);style.remove();}
  window.BladeTabDestruction={destroy,active:()=>scenes.size};
  window.addEventListener('unload',destroy,{once:true});
  window.Blade?.mark('tab_destruction','v1.3.0 OK');
})();

