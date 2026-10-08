// ==UserScript==
// @name            Blade Account Panel
// @description     Account switching and management inside menu B
// @include         main
// @version         1.2.0
// @loadOrder       119
// ==/UserScript==
(function () {
  if (window.BladeAccountPanel) return;
  const H='http://www.w3.org/1999/xhtml', hosts=new Set(), states=new WeakMap(), watchedPanels=new Set();
  const colors={blue:'#37adff',turquoise:'#00c7cf',green:'#51cd78',yellow:'#e8d650',orange:'#ff9850',red:'#ef5962',pink:'#f483bd',purple:'#b68afa'};
  let disposed=false;
  const make=(tag,cls,text)=>{const n=document.createElementNS(H,tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const button=(cls,text,action)=>{const n=make('button',cls,text);n.type='button';n.addEventListener('click',e=>{e.stopPropagation();action();});return n;};
  const style=make('style');style.id='blade-account-panel-style';style.textContent=`
    .ba-panel {color:#eee9f2;font:12px var(--blade-ui,Rubik,"Segoe UI",sans-serif);--ba-accent:var(--bob-accent,#ff2a2a);}
    .ba-head {display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;}
    .ba-head strong {font-size:14px;} .ba-hint {font-size:11px;color:#afa5b9;line-height:1.5;margin:0 0 10px;}
    .ba-panel button,.ba-panel input,.ba-panel select {font:inherit;box-sizing:border-box;}
    .ba-panel button {border:1px solid #ffffff16;background:#ffffff05;color:inherit;cursor:pointer;border-radius:7px;min-height:29px;padding:5px 8px;}
    .ba-panel button:hover {background:#ffffff0d;border-color:var(--ba-accent);}
    .ba-panel :is(button,input,select):focus-visible {outline:2px solid var(--ba-accent);outline-offset:2px;}
    .ba-search,.ba-name,.ba-color {width:100%;border:1px solid #ffffff20;background:#0e0c12;color:#eee9f2;padding:8px;border-radius:7px;}
    .ba-search {margin-bottom:9px;} .ba-list {display:grid;gap:6px;max-height:290px;overflow:auto;padding:2px;}
    .ba-row {display:flex;align-items:stretch;gap:5px;}
    .ba-panel .ba-switch {flex:1;min-width:0;text-align:left;display:flex;align-items:center;gap:9px;padding:9px;}
    .ba-row[data-current=true] .ba-switch {border-color:var(--ba-accent);background:color-mix(in srgb,var(--ba-accent) 10%,#121017);}
    .ba-dot {width:9px;height:9px;flex:none;border-radius:50%;background:var(--account-color,#aaa);box-shadow:0 0 0 3px #ffffff07;}
    .ba-copy {min-width:0;flex:1;} .ba-title {display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;}
    .ba-meta {display:block;color:#a89dac;font-size:10px;margin-top:3px;} .ba-edit {flex:none;}
    .ba-panel .ba-google {flex:none;font-size:10px;padding:5px 7px;}
    .ba-form {display:grid;gap:8px;padding:11px;border:1px solid #ffffff18;background:#00000028;border-radius:9px;margin:10px 0;}
    .ba-form-actions {display:flex;gap:6px;} .ba-panel .ba-save {background:color-mix(in srgb,var(--ba-accent) 15%,#151018);border-color:var(--ba-accent);}
    .ba-message {font-size:11px;line-height:1.5;color:#f2baac;margin:8px 0;} .ba-footer {display:flex;justify-content:space-between;margin-top:12px;}
  `;document.documentElement.append(style);
  function site() {try {const u=new URL(gBrowser.selectedBrowser.currentURI.spec);return /^https?:$/.test(u.protocol)?u.host:'';}catch(e){return '';}}
  function error(host,message){let node=host.querySelector('.ba-message');if(!node){node=make('p','ba-message');node.setAttribute('role','status');host.append(node);}node.textContent=message;}
  function form(host,account=null){
    const state=states.get(host);state.edit=true;host.querySelector('.ba-form')?.remove();
    const box=make('form','ba-form'),label=make('label','',account?'Имя аккаунта':'Новый аккаунт');
    const name=make('input','ba-name');name.maxLength=64;name.placeholder='Например, личный или рабочий';name.value=account?.name||'';name.setAttribute('aria-label','Имя аккаунта');label.append(name);
    const color=make('select','ba-color');color.setAttribute('aria-label','Цвет аккаунта');
    const colorNames={blue:'Синий',turquoise:'Бирюзовый',green:'Зелёный',yellow:'Жёлтый',orange:'Оранжевый',red:'Красный',pink:'Розовый',purple:'Фиолетовый',gray:'Серый'};
    for(const {color:id} of window.BladeAccounts.colors()){const option=make('option','',colorNames[id]||id);option.value=id;color.append(option);}color.value=account?.color||'blue';
    const actions=make('div','ba-form-actions');const save=button('ba-save','Сохранить',()=>box.requestSubmit());const cancel=button('','Отмена',()=>{state.edit=false;render(host);});actions.append(save,cancel);box.append(label,color,actions);host.querySelector('.ba-head').after(box);
    box.addEventListener('submit',e=>{e.preventDefault();e.stopPropagation();try {if(account)window.BladeAccounts.update(account.userContextId,{name:name.value,color:color.value});else window.BladeAccounts.create(name.value,color.value);state.edit=false;render(host);}catch(err){error(host,err.message);}});
    box.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();state.edit=false;render(host);}});name.focus();
  }
  function list(host){
    const state=states.get(host),listNode=host.querySelector('.ba-list');listNode.replaceChildren();
    const term=state.term.toLocaleLowerCase(),accounts=window.BladeAccounts.list(true).filter(a=>a.name.toLocaleLowerCase().includes(term)).sort((a,b)=>Number(b.current)-Number(a.current)||b.siteTabs-a.siteTabs||b.tabs-a.tabs);
    for(const a of accounts){
      const row=make('div','ba-row');row.dataset.current=String(a.current);row.dataset.account=String(a.userContextId);
      const open=button('ba-switch','',()=>{try {window.BladeAccounts.switchTo(a.userContextId,true);document.getElementById('bobliks-settings-popup')?.hidePopup();}catch(e){error(host,e.message);}});
      open.setAttribute('aria-label',`Переключить: ${a.name}`);open.setAttribute('aria-pressed',String(a.current));
      const dot=make('span','ba-dot');dot.style.setProperty('--account-color',a.colorCode||colors[a.color]||'#aaa');
      const count=n=>`${n} ${n%100>=11&&n%100<=14?'вкладок':n%10===1?'вкладка':n%10>=2&&n%10<=4?'вкладки':'вкладок'}`;
      const copy=make('span','ba-copy');copy.append(make('span','ba-title',a.name),make('span','ba-meta',[a.current?'Текущий':null,count(a.tabs),a.siteTabs?`${a.siteTabs} на этом сайте`:null].filter(Boolean).join(' · ')));open.append(dot,copy);row.append(open);
      const fresh=button('ba-new','+',()=>{try {window.BladeAccounts.open(a.userContextId,false);document.getElementById('bobliks-settings-popup')?.hidePopup();}catch(e){error(host,e.message);}});fresh.title=`Новая вкладка: ${a.name}`;fresh.setAttribute('aria-label',fresh.title);row.append(fresh);
      const google=button('ba-google','Google',()=>{try {window.BladeAccounts.openSite(a.userContextId,'https://accounts.google.com/');document.getElementById('bobliks-settings-popup')?.hidePopup();}catch(e){error(host,e.message);}});google.title=`Войти в Google: ${a.name}`;google.setAttribute('aria-label',google.title);row.append(google);
      if(a.userContextId){const edit=button('ba-edit','✎',()=>form(host,a));edit.title='Имя и цвет';edit.setAttribute('aria-label',`Изменить: ${a.name}`);row.append(edit);}listNode.append(row);
    }
    if(!accounts.length)listNode.append(make('p','ba-hint','Аккаунты не найдены.'));
  }
  function render(host){
    if(disposed||!host.isConnected)return;const state=states.get(host);if(state.edit)return;host.replaceChildren();
    const api=window.BladeAccounts;if(!api?.available()){host.append(make('p','ba-hint','Аккаунты недоступны в этом окне.'));return;}
    const head=make('div','ba-head');head.append(make('strong','','Аккаунты'),button('ba-add','+ Добавить',()=>form(host)));host.append(head);
    host.append(make('p','ba-hint',site()?`Переключение для ${site()}. Каждый аккаунт сохраняет отдельный вход.`:'Выбери аккаунт для вкладок. Входы на сайты хранятся отдельно.'));
    host.append(make('p','ba-hint','Для входа через Google сначала войди в Google внутри нужного аккаунта кнопкой справа. Этот вход сохраняется отдельно.'));
    const search=make('input','ba-search');search.placeholder='Найти аккаунт';search.value=state.term;search.setAttribute('aria-label','Поиск аккаунтов');search.addEventListener('input',()=>{state.term=search.value.slice(0,64);list(host);});host.append(search,make('div','ba-list'));
    const footer=make('div','ba-footer');footer.append(button('','Настройки контейнеров',()=>{try{api.manage();document.getElementById('bobliks-settings-popup')?.hidePopup();}catch(e){error(host,e.message);}}));host.append(footer);list(host);
  }
  function watch(panel){if(!panel||watchedPanels.has(panel))return;panel.addEventListener('popuphidden',hidden);watchedPanels.add(panel);}
  function mount(host){if(disposed)return;for(const old of hosts)if(!old.isConnected)hosts.delete(old);hosts.add(host);watch(host.closest('#bobliks-settings-popup'));if(!states.has(host))states.set(host,{term:'',edit:false});host.classList.add('ba-panel');render(host);}
  function refresh(){if(disposed)return;for(const host of hosts){if(!host.isConnected){hosts.delete(host);continue;}render(host);}}
  function open(){
    if(disposed)return;
    const menu=window.BladeMenuPopup,anchor=document.getElementById('bobliks-settings-button');
    if(!menu?.ensurePopup||!anchor)throw new Error('Меню B недоступно');
    const panel=menu.ensurePopup(document);
    panel.querySelector('.bp-tab[data-tab="system"]')?.click();
    menu.open(anchor);
  }
  const hidden=e=>{if(['open','showing'].includes(e.target.state))return;if(e.target.id==='bobliks-settings-popup'){for(const host of hosts)if(e.target.contains(host)){hosts.delete(host);states.delete(host);}}};
  window.addEventListener('blade-accounts-changed',refresh);
  function destroy(){if(disposed)return;disposed=true;window.removeEventListener('blade-accounts-changed',refresh);for(const panel of watchedPanels)panel.removeEventListener('popuphidden',hidden);watchedPanels.clear();window.removeEventListener('unload',destroy);for(const host of hosts)host.replaceChildren();hosts.clear();style.remove();}
  window.BladeAccountPanel={mount,open,refresh,destroy,status:()=>({disposed,hosts:hosts.size,open:document.getElementById('bobliks-settings-popup')?.state==='open'})};window.addEventListener('unload',destroy,{once:true});window.Blade?.mark('account_panel','v1.2.0 OK');
})();
