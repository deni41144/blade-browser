// ==UserScript==
// @name            Blade Sidebar
// @description     История, закладки и аккаунты в материале меню B
// @include         main
// @version         1.0.0
// @loadOrder       118
// ==/UserScript==
(function () {
  if (window.BladeSidebar) return;
  const { PlacesUtils } = ChromeUtils.importESModule('resource://gre/modules/PlacesUtils.sys.mjs');
  const ns = 'http://www.w3.org/1999/xhtml';
  const make = (tag, className, text) => {
    const node = document.createElementNS(ns, tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const style = make('style');
  style.id = 'blade-sidebar-style';
  style.textContent = `
    #blade-sidebar { --side-accent:var(--bob-accent,var(--accent,#ff2a2a));
      display:flex; flex-direction:column; flex:0 0 308px; width:308px; min-width:0;
      max-width:38vw; min-height:0; margin:5px 6px 6px 0; padding:15px 10px 9px;
      box-sizing:border-box; background-color:#131216;
      background-image:var(--blade-material,linear-gradient(155deg,#261b21,#111217));
      border:1px solid #ffffff20; border-radius:14px; box-shadow:inset 0 1px #ffffff12,4px 0 18px #0003;
      color:#ecebf2; font:12px var(--blade-ui,'Rubik','Segoe UI',sans-serif);
    }
    #blade-sidebar[hidden] {display:none!important}
    #blade-sidebar * {box-sizing:border-box}
    #blade-sidebar button {font:inherit; color:inherit; cursor:pointer; border:0; background:none}
    #blade-sidebar .bs-heading {display:flex;align-items:center;gap:10px;padding:0 6px 13px}
    #blade-sidebar .bs-emblem {color:var(--side-accent);font-size:22px;line-height:1}
    #blade-sidebar .bs-title {font-size:16px;font-weight:650;flex:1}
    #blade-sidebar .bs-close {width:27px;height:27px;border-radius:6px;color:#a7a3b3}
    #blade-sidebar .bs-tabs {display:flex;gap:4px;padding:4px;background:#0003;border:1px solid #ffffff0e;border-radius:9px}
    #blade-sidebar .bs-tabs button {flex:1;padding:9px 2px;border-radius:6px;font-size:11px;color:#aaa6b6}
    #blade-sidebar .bs-tabs button[aria-selected=true] {color:#f4f1f7;background:color-mix(in srgb,var(--side-accent) 14%,#242027);box-shadow:inset 0 -2px var(--side-accent)}
    #blade-sidebar .bs-search {width:100%;margin:12px 0 8px;padding:10px 12px;border:1px solid #ffffff20;border-radius:8px;background:#08080b66;color:#eeeaf3;font:inherit;outline:none}
    #blade-sidebar .bs-search:focus {border-color:color-mix(in srgb,var(--side-accent) 60%,#ffffff20)}
    #blade-sidebar .bs-summary {padding:3px 6px 10px;color:#aaa4b3;font-size:10px;min-height:25px}
    #blade-sidebar .bs-list {flex:1;min-height:0;overflow:auto;scrollbar-width:thin;scrollbar-color:#ffffff30 transparent;display:flex;flex-direction:column;gap:4px}
    #blade-sidebar .bs-row {display:flex;align-items:center;gap:10px;text-align:left;width:100%;min-height:57px;flex-shrink:0;padding:9px 10px!important;border:1px solid #ffffff0c!important;border-radius:8px;background:#08080b38!important}
    #blade-sidebar .bs-row:hover,#blade-sidebar .bs-close:hover,#blade-sidebar .bs-footer:hover {background:color-mix(in srgb,var(--side-accent) 9%,#27232c)!important;border-color:#ffffff25!important}
    #blade-sidebar button:focus-visible {outline:2px solid var(--side-accent);outline-offset:-2px}
    #blade-sidebar .bs-site {flex:0 0 29px;width:29px;height:29px;display:grid;place-items:center;border:1px solid #ffffff14;border-radius:8px;background:#ffffff05;font-size:12px;color:#ccc5d7}
    #blade-sidebar .bs-copy {flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
    #blade-sidebar .bs-name {overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:550;font-size:12px}
    #blade-sidebar .bs-meta {overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:#a59eaf}
    #blade-sidebar .bs-date {font-size:10px;color:#827d8d;flex-shrink:0}
    #blade-sidebar .bs-empty {padding:25px 12px;color:#b2aabc;line-height:1.6;text-align:center}
    #blade-sidebar .bs-footer {margin-top:8px;padding:11px;border-top:1px solid #ffffff16;border-radius:6px;color:#bab3c4;text-align:left}
    #blade-sidebar-button .toolbarbutton-icon {list-style-image:url('chrome://browser/skin/library.svg')!important}
    #blade-sidebar-button[checked] .toolbarbutton-icon {background-color:color-mix(in srgb,var(--accent,#ff2a2a) 18%,transparent)!important}
    @media(max-width:800px){#blade-sidebar{flex-basis:260px;width:260px;max-width:45vw}}
  `;
  document.documentElement.appendChild(style);
  const aside = make('aside'); aside.id = 'blade-sidebar'; aside.hidden = true;
  aside.setAttribute('aria-label', 'Библиотека Blade');
  const heading = make('div', 'bs-heading');
  const close = make('button','bs-close','×'); close.title = 'Закрыть панель'; close.setAttribute('aria-label',close.title);
  heading.append(make('span','bs-emblem','◫'),make('span','bs-title','Библиотека'),close);
  const sections = make('div','bs-tabs'); sections.setAttribute('role','tablist');
  const search = make('input','bs-search'); search.type='search'; search.placeholder='Поиск по истории'; search.setAttribute('aria-label','Поиск по истории');
  const summary = make('div','bs-summary'); summary.setAttribute('aria-live','polite');
  const list = make('div','bs-list');
  const footer = make('button','bs-footer','Вся история');
  aside.append(heading,sections,search,summary,list,footer);
  let button, section = 'history', disposed = false, debounce = 0, generation = 0, mounted = false;
  const listeners = [];
  const listen = (node,event,fn) => { node.addEventListener(event,fn);listeners.push(()=>node.removeEventListener(event,fn)); };
  const tabs = new Map();
  for (const [id,label] of [['history','История'],['bookmarks','Закладки'],['accounts','Аккаунты']]) {
    const node=make('button','',label);node.setAttribute('role','tab');node.dataset.section=id;
    listen(node,'click',()=>select(id));sections.appendChild(node);tabs.set(id,node);
  }
  function setSummary(text){summary.textContent=text;}
  function empty(text){list.replaceChildren(make('div','bs-empty',text));}
  function host(url){try{return new URL(url).hostname||url;}catch{return url;}}
  function row(title,meta,icon,action,stamp){
    const node=make('button','bs-row');node.title=meta;
    const copy=make('span','bs-copy');copy.append(make('span','bs-name',title),make('span','bs-meta',meta));
    node.append(make('span','bs-site',icon),copy);
    if(stamp)node.append(make('span','bs-date',stamp));
    // Row handlers are released together with each row, no external references.
    node.addEventListener('click',action);return node;
  }
  function openURL(url){
    if(!/^(https?:|ftp:|file:|about:)/i.test(url))return;
    // Keep the current account. Opening history must not silently escape its container.
    window.openTrustedLinkIn(url,'tab',{userContextId:gBrowser.selectedTab.userContextId||0,allowInheritPrincipal:false});
  }
  function placesItems(term){
    const query=PlacesUtils.history.getNewQuery(); query.searchTerms=term;
    const options=PlacesUtils.history.getNewQueryOptions();
    options.maxResults=80;options.excludeQueries=true;
    options.queryType=section==='bookmarks'?options.QUERY_TYPE_BOOKMARKS:options.QUERY_TYPE_HISTORY;
    options.sortingMode=section==='bookmarks'?options.SORT_BY_DATEADDED_DESC:options.SORT_BY_DATE_DESC;
    const root=PlacesUtils.history.executeQuery(query,options).root;
    const items=[];root.containerOpen=true;
    try{
      for(let i=0;i<root.childCount;i++){
        const node=root.getChild(i);
        if(node.uri&&/^(https?:|ftp:|file:|about:)/i.test(node.uri))items.push({url:node.uri,title:node.title||host(node.uri),time:node.time});
      }
    }finally{root.containerOpen=false;}
    return items;
  }
  function render(){
    if(disposed||aside.hidden)return;
    const token=++generation;const term=search.value.trim().slice(0,200);
    try{
      list.replaceChildren();
      if(section==='accounts'){
        if(!window.BladeAccounts?.available()){empty('Аккаунты недоступны в этом окне.');setSummary('Отдельные входы на сайты');return;}
        const accounts=window.BladeAccounts.list(true).filter(item=>item.name.toLocaleLowerCase().includes(term.toLocaleLowerCase()));
        for(const account of accounts){
          const active=gBrowser.selectedTab.userContextId===account.userContextId;
          const node=row(account.name,`${active?'Текущий аккаунт · ':''}${account.tabs} вкладок`,'◉',()=>{try{window.BladeAccounts.switchTo(account.userContextId,true);}catch(e){setSummary(e.message);}});
          node.dataset.account=String(account.userContextId);list.appendChild(node);
        }
        setSummary(`${accounts.length} аккаунтов · независимые входы`);
        if(!accounts.length)empty(term?'Аккаунты не найдены.':'Добавь аккаунт в панели аккаунтов.');
      }else{
        const items=placesItems(term);if(token!==generation)return;
        let previousDay='';
        for(const item of items){
          const date=item.time?new Date(item.time/1000):null;
          const day=date?.toLocaleDateString('ru',{day:'numeric',month:'short'})||'';
          const node=row(item.title,host(item.url),host(item.url).slice(0,1).toUpperCase(),()=>openURL(item.url),section==='history'&&day!==previousDay?day:'');
          node.dataset.url=item.url;list.appendChild(node);previousDay=day;
        }
        setSummary(items.length===80?'Последние 80 · уточни поиск':`${items.length} ${section==='history'?'страниц':'закладок'}`);
        if(!items.length)empty(term?'Ничего не найдено. Попробуй название сайта или адрес.':section==='history'?'Посещённые страницы появятся здесь.':'Сохранённые сайты появятся здесь.');
      }
    }catch(e){empty('Не удалось загрузить список. Закрой и открой панель снова.');setSummary('Список недоступен');window.Blade?.mark('BladeSidebar','ERR '+e);}
  }
  function select(id){
    if(!tabs.has(id)||disposed)return;
    section=id;search.value='';
    for(const [key,node]of tabs)node.setAttribute('aria-selected',String(key===id));
    const label={history:'истории',bookmarks:'закладкам',accounts:'аккаунтам'}[id];
    search.placeholder='Поиск по '+label;search.setAttribute('aria-label',search.placeholder);
    footer.textContent={history:'Вся история',bookmarks:'Все закладки',accounts:'Управление аккаунтами'}[id];render();
  }
  function toggle(force){
    if(disposed)return;
    const open=typeof force==='boolean'?force:aside.hidden;
    aside.hidden=!open;button?.setAttribute('aria-expanded',String(open));
    if(open){button?.setAttribute('checked','true');render();}else{button?.removeAttribute('checked');clearTimeout(debounce);debounce=0;generation++;list.replaceChildren();}
  }
  listen(close,'click',()=>toggle(false));
  listen(search,'input',()=>{clearTimeout(debounce);debounce=setTimeout(()=>{debounce=0;render();},140);});
  listen(footer,'click',()=>{
    if(section==='accounts'){try{window.BladeAccountPanel.open();}catch(e){setSummary(e.message);}}
    else window.PlacesCommandHook.showPlacesOrganizer(section==='history'?'History':'AllBookmarks');
  });
  listen(gBrowser.tabContainer,'TabSelect',()=>{if(section==='accounts')render();});
  listen(window,'blade-accounts-changed',()=>{if(section==='accounts')render();});
  function mount(){
    if(disposed||mounted)return;
    const browser=document.getElementById('browser'),nav=document.getElementById('nav-bar');
    if(!browser||!nav)return;
    browser.prepend(aside);
    button=document.createXULElement('toolbarbutton');button.id='blade-sidebar-button';button.className='toolbarbutton-1 chromeclass-toolbar-additional';
    button.setAttribute('label','Библиотека');button.setAttribute('tooltiptext','История, закладки и аккаунты');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',aside.id);
    const icon=document.createXULElement('image');icon.className='toolbarbutton-icon';button.appendChild(icon);
    const anchor=document.getElementById('bobliks-settings-button')||document.getElementById('nav-bar-overflow-button');
    if(anchor?.parentNode===nav)nav.insertBefore(button,anchor);else nav.appendChild(button);
    listen(button,'command',()=>toggle());mounted=true;select('history');window.Blade?.mark('BladeSidebar','v1.0.0 OK');
  }
  const startup={observe(subject){if(subject!==window)return;Services.obs.removeObserver(startup,'browser-delayed-startup-finished');mount();}};
  const accountsObserver={observe(){if(section==='accounts')render();}};
  const topics=['contextual-identity-created','contextual-identity-updated','contextual-identity-deleted'];
  for(const topic of topics)Services.obs.addObserver(accountsObserver,topic);
  if(window.gBrowserInit?.delayedStartupFinished)mount();else Services.obs.addObserver(startup,'browser-delayed-startup-finished');
  function destroy(){
    if(disposed)return;disposed=true;clearTimeout(debounce);generation++;
    try{Services.obs.removeObserver(startup,'browser-delayed-startup-finished');}catch{}
    for(const topic of topics)Services.obs.removeObserver(accountsObserver,topic);
    for(const off of listeners)off();listeners.length=0;
    aside.remove();button?.remove();style.remove();window.removeEventListener('unload',destroy);
  }
  window.addEventListener('unload',destroy,{once:true});
  window.BladeSidebar={toggle,select,refresh:render,destroy,status:()=>({disposed,mounted,open:!aside.hidden,section,rows:list.querySelectorAll('.bs-row').length,pending:!!debounce})};
})();
