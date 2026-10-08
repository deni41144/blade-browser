// ==UserScript==
// @name            Blade Chrome Motion
// @description     РўРµРјР°С‚РёС‡РµСЃРєРёР№ РєРѕРЅС‚СѓСЂ РІРєР»Р°РґРєРё, СЃРјРµРЅР° С‚РµРјС‹ Рё СЂРµР°Р»СЊРЅР°СЏ Р·Р°РіСЂСѓР·РєР°
// @include         main
// @version         1.0.0
// @loadOrder       11
// ==/UserScript==
(function () {
  if (window.BladeChromeMotion || !window.gBrowser) return;
  const H = 'http://www.w3.org/1999/xhtml';
  const root = document.documentElement;
  const host = document.getElementById('navigator-toolbox');
  const nav = document.getElementById('nav-bar');
  if (!host || !nav) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const allowed = () => !reduced.matches && !document.hidden &&
    !root.hasAttribute('data-blade-battery') &&
    root.getAttribute('data-blade-fx-mode') !== 'eco' &&
    (window.BladeEffects ? window.BladeEffects.canAnimate() : document.hasFocus());
  const theme = () => root.getAttribute('data-blade-theme') || 'red';
  const accent = () => getComputedStyle(root).getPropertyValue('--accent').trim() || '#ff2a2a';
  const css = `
    .blade-chrome-contour,.blade-chrome-loading,.blade-chrome-theme-edge {
      position:absolute!important;pointer-events:none!important;z-index:1002!important;
      box-sizing:border-box!important;contain:paint!important;
      --motion-color:var(--accent,#ff2a2a);--motion-surface:linear-gradient(90deg,transparent,var(--motion-color),transparent);
    }
    .blade-chrome-contour {overflow:hidden!important;border-radius:9px 9px 0 0!important;
      border:1px solid color-mix(in srgb,var(--motion-color) 65%,transparent)!important;
      border-bottom:0!important;animation:blade-chrome-contour .72s ease-out both!important;}
    .blade-chrome-contour::before {content:'';position:absolute;inset:0 auto auto -55px;width:55px;height:2px;
      background:var(--motion-surface);animation:blade-chrome-edge .62s cubic-bezier(.2,.65,.2,1) both;}
    .blade-chrome-contour::after {content:'';position:absolute;inset:1px 1px auto;height:1px;
      background:linear-gradient(90deg,transparent,#ffffff36,transparent);opacity:.65;}
    [data-motion-theme='blood'] {--motion-color:#8c1328;--motion-surface:linear-gradient(90deg,transparent,#30040c 15%,#8b1428 55%,#bb56664f 62%,#440612 80%,transparent);}
    .blade-chrome-contour[data-motion-theme='blood'] {border-color:#650d20!important;border-width:1.5px!important;border-radius:10px 8px 0 0!important;}
    .blade-chrome-contour[data-motion-theme='blood']::before {height:3px;border-radius:35% 60% 30% 40%;}
    [data-motion-theme='volt'] {--motion-surface:linear-gradient(90deg,transparent,#f6e9ad 25%,var(--motion-color) 35%,transparent 40%,#e6cf7a 55%,transparent);}
    .blade-chrome-contour[data-motion-theme='volt']::before {height:4px;clip-path:polygon(0 40%,25% 40%,35% 0,48% 65%,60% 20%,75% 55%,100% 35%,100% 60%,70% 80%,60% 50%,48% 100%,35% 40%,25% 65%,0 65%);}
    [data-motion-theme='grey'] {--motion-surface:linear-gradient(90deg,transparent,#545963 20%,#ccd0d5 46%,#f2f3f4 50%,#838993 65%,transparent);}
    [data-motion-theme='midnight'] {--motion-surface:linear-gradient(90deg,transparent,#3c568d 35%,#ccd8ff 49%,#637cac 54%,transparent);}
    [data-motion-theme='cherry'] {--motion-surface:linear-gradient(90deg,transparent,#a64776 25%,#e4a5bf 48%,#904165 68%,transparent);}
    .blade-chrome-contour[data-motion-theme='cherry']::before {border-radius:90% 10% 90% 10%;height:3px;}
    [data-motion-theme='orange'] {--motion-surface:linear-gradient(90deg,transparent,#9c390c 20%,#db8b40 50%,#864014 75%,transparent);}
    [data-motion-theme='green'] {--motion-surface:repeating-linear-gradient(90deg,transparent 0 5px,#479568 5px 12px,transparent 12px 16px);}
    .blade-chrome-contour[data-motion-theme='green']::before {height:3px;}
    [data-motion-theme='purple'] {--motion-surface:linear-gradient(90deg,transparent,#544a9a 20%,#afa1dc 48%,#6c4d99 70%,transparent);}
    .blade-chrome-contour[data-motion-theme='purple']::before {clip-path:polygon(0 50%,25% 0,75% 0,100% 50%,75% 100%,25% 100%);height:3px;}
    [data-motion-theme='red'] {--motion-surface:linear-gradient(90deg,transparent,#641b21 20%,#d76067 48%,#8d262e 70%,transparent);}
    .blade-chrome-contour[data-motion-theme='custom']::before {height:3px;background:linear-gradient(180deg,var(--motion-color) 0 30%,transparent 30% 70%,var(--motion-color) 70%);}
    .blade-chrome-contour[data-motion-theme='red']::before {clip-path:polygon(0 100%,18% 0,100% 0,82% 100%);}
    .blade-chrome-loading {height:2px!important;overflow:hidden!important;background:color-mix(in srgb,var(--motion-color) 12%,transparent)!important;}
    .blade-chrome-loading::before {content:'';position:absolute;inset:0 auto 0 0;width:26%;background:var(--motion-surface);
      animation:blade-chrome-loading 1.2s ease-in-out infinite;}
    .blade-chrome-loading[data-state='done'],.blade-chrome-loading[data-state='cancel'],.blade-chrome-loading[data-state='error'] {
      animation:blade-chrome-finish .24s ease-out both!important;background:var(--motion-color)!important;}
    .blade-chrome-loading[data-state='error'] {--motion-color:#9e4050;}
    .blade-chrome-loading[data-state='cancel'] {opacity:.35!important;}
    .blade-chrome-loading:not([data-state='loading'])::before {display:none;}
    .blade-chrome-theme-edge {height:1px!important;background:var(--motion-color)!important;animation:blade-chrome-finish .36s ease-out both!important;}
    @keyframes blade-chrome-contour {0%{opacity:0}18%{opacity:.92}60%{opacity:.7}100%{opacity:0}}
    @keyframes blade-chrome-edge {0%{transform:translateX(0);opacity:0}12%{opacity:1}100%{transform:translateX(var(--motion-span));opacity:0}}
    @keyframes blade-chrome-loading {0%{transform:translateX(-100%)}100%{transform:translateX(485%)}}
    @keyframes blade-chrome-finish {0%{opacity:.7}100%{opacity:0}}
    :root[data-blade-chrome-motion] .blade-tab-hit,:root[data-blade-chrome-motion] .blade-theme-wave {display:none!important;}
    :root[data-blade-motion-static] .blade-chrome-loading::before {animation:none!important;width:100%;opacity:.45;}
    :root[data-blade-fx-paused='true'] .blade-chrome-loading::before {animation-play-state:paused!important;}
  `;
  const style = document.createElementNS(H, 'style');
  style.id = 'blade-chrome-motion-style'; style.textContent = css;
  root.appendChild(style); root.setAttribute('data-blade-chrome-motion', '1');
  let contour = null, loading = null, themeEdge = null;
  let contourTimer = 0, finishTimer = 0, themeTimer = 0;
  let lastTheme = theme(), lastAccent = accent(), disposed = false;
  const transitions = [];
  const make = name => {const node=document.createElementNS(H,'div');node.className=name;node.setAttribute('aria-hidden','true');node.dataset.motionTheme=theme();node.style.setProperty('--motion-color',accent());host.appendChild(node);return node;};
  function align(node, rect) {
    const base=host.getBoundingClientRect();
    Object.assign(node.style,{left:`${rect.left-base.left}px`,top:`${rect.top-base.top}px`,width:`${rect.width}px`});
  }
  function clearContour() {clearTimeout(contourTimer);contour?.remove();contour=null;}
  function select() {
    syncLoading(); clearContour();
    if (!allowed()) return;
    const rect=gBrowser.selectedTab.getBoundingClientRect();if (!rect.width) return;
    contour=make('blade-chrome-contour');align(contour,rect);contour.style.height=`${rect.height}px`;
    contour.style.setProperty('--motion-span',`${rect.width+55}px`);
    contourTimer=setTimeout(clearContour,760);
  }
  function removeLoading() {clearTimeout(finishTimer);loading?.remove();loading=null;}
  function showLoading() {
    clearTimeout(finishTimer);
    if (!loading) loading=make('blade-chrome-loading');
    loading.dataset.state='loading';loading.dataset.motionTheme=theme();loading.style.setProperty('--motion-color',accent());
    const rect=nav.getBoundingClientRect();align(loading,{...rect,left:rect.left,top:rect.bottom-2,width:rect.width});
    stateChanged();
  }
  function syncLoading() {
    if(gBrowser.selectedBrowser.webProgress?.isLoadingDocument) showLoading();else removeLoading();
  }
  function finish(status) {
    if(!loading) return;
    loading.dataset.state=status===Components.results.NS_BINDING_ABORTED?'cancel':Components.isSuccessCode(status)?'done':'error';
    if(!allowed()){removeLoading();return;}finishTimer=setTimeout(removeLoading,260);
  }
  function clearTheme() {clearTimeout(themeTimer);themeEdge?.remove();themeEdge=null;for(const animation of transitions.splice(0))animation.cancel();}
  function themeChanged() {
    const next=theme(), color=accent();if(next===lastTheme&&color===lastAccent)return;
    const oldAccent=lastAccent;lastTheme=next;lastAccent=color;
    clearContour();clearTheme();if(loading){loading.dataset.motionTheme=next;loading.style.setProperty('--motion-color',color);}
    if(!allowed()) return;
    themeEdge=make('blade-chrome-theme-edge');themeEdge.style.setProperty('--motion-color',oldAccent);
    const rect=nav.getBoundingClientRect();align(themeEdge,{left:rect.left,top:rect.bottom-1,width:rect.width});
    for(const [index,element] of [document.getElementById('TabsToolbar'),nav].entries()) {
      if(element)transitions.push(element.animate([{opacity:.8,transform:'translateY(1px)'},{opacity:1,transform:'translateY(0)'}],{duration:340,delay:index*30,easing:'cubic-bezier(.2,.7,.3,1)'}));
    }
    themeTimer=setTimeout(clearTheme,390);
  }
  function stateChanged() {
    root.toggleAttribute('data-blade-motion-static',!allowed());
    if(!allowed()){clearContour();clearTheme();}
  }
  const progress={
    QueryInterface:ChromeUtils.generateQI(['nsIWebProgressListener','nsISupportsWeakReference']),
    onStateChange(browser,progress,request,flags,status) {
      if(browser!==gBrowser.selectedBrowser || progress?.isTopLevel === false || !(flags&Ci.nsIWebProgressListener.STATE_IS_WINDOW))return;
      if(flags&Ci.nsIWebProgressListener.STATE_START)showLoading();
      if(flags&Ci.nsIWebProgressListener.STATE_STOP)finish(status);
    },
    onLocationChange(browser){if(browser===gBrowser.selectedBrowser && browser.webProgress?.isLoadingDocument)showLoading();},
  };
  const observer=new MutationObserver(records=>{if(disposed)return;if(records.some(r=>r.attributeName==='data-blade-theme'||r.attributeName==='style'))themeChanged();stateChanged();});
  observer.observe(root,{attributes:true,attributeFilter:['data-blade-theme','style','data-blade-fx-mode','data-blade-fx-paused','data-blade-battery']});
  gBrowser.addTabsProgressListener(progress);
  gBrowser.tabContainer.addEventListener('TabSelect',select);
  window.addEventListener('resize',syncLoading);reduced.addEventListener('change',stateChanged);
  function destroy() {
    if(disposed)return;disposed=true;observer.disconnect();clearContour();clearTheme();removeLoading();
    gBrowser.removeTabsProgressListener(progress);gBrowser.tabContainer.removeEventListener('TabSelect',select);
    window.removeEventListener('resize',syncLoading);reduced.removeEventListener('change',stateChanged);
    root.removeAttribute('data-blade-chrome-motion');root.removeAttribute('data-blade-motion-static');style.remove();
  }
  window.BladeChromeMotion={destroy,state:()=>({theme:theme(),allowed:allowed(),loading:loading?.dataset.state||null}),sync:syncLoading};
  window.addEventListener('unload',destroy,{once:true});
  syncLoading();stateChanged();window.Blade?.mark('chrome_motion','v1.0.0 OK');
})();

