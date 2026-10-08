// ==UserScript==
// @name            Blade Action Panels
// @description     Material download cards and contextual menus, with native commands
// @author          Blade-Creations
// @include         main
// @version         1.0.0
// @loadOrder       115
// ==/UserScript==
(function () {
  if (window.BladeActionPanels) return;
  const root=document.documentElement, ns='http://www.w3.org/1999/xhtml';
  const menus=new Set(), icons=new Map(), images=new Map(), metrics=new Map();
  const menuIds=new Set(['contentAreaContextMenu','tabContextMenu','downloadsContextMenu','toolbar-context-menu']);
  let panel=null, list=null, header=null, observer=null, frame=0, disposed=false;
  const iconMap={
    context_openANewTab:'plus',context_reloadTab:'reload',context_reloadSelectedTabs:'reload',
    context_duplicateTab:'edit-copy',context_duplicateTabs:'edit-copy',context_closeTab:'close',
    context_closeDuplicateTabs:'close',context_closeTabOptions:'close',context_undoCloseTab:'undo',
    context_moveTabOptions:'arrow-left',context_selectAllTabs:'edit-outline',
    context_bookmarkTab:'bookmark',context_bookmarkSelectedTabs:'bookmark',
    downloadsCmd_show:'folder',downloadsCmd_copyLocation:'link',downloadsCmd_deleteFile:'delete',
    cmd_delete:'delete',downloadsCmd_openReferrer:'open-in-new',
  };
  const style=document.createElementNS(ns,'style');style.id='blade-action-panels-style';
  style.textContent=`
    :root[data-blade-actions] menupopup[data-blade-action-menu]::part(content),
    :root[data-blade-actions] #downloadsPanel::part(content) {
      background-image:var(--blade-material,linear-gradient(160deg,#261b21,#111217)) !important;
      background-color:#121317 !important; backdrop-filter:none !important;
      border:1px solid color-mix(in srgb,var(--bob-accent,var(--accent,#ff2a2a)) 32%,#45454f) !important;
      border-radius:15px !important;
      box-shadow:0 16px 38px #0009,inset 0 1px #ffffff20 !important;
    }
    :root[data-blade-actions] menupopup[data-blade-action-menu] {
      --panel-padding:6px; --panel-border-radius:15px; --panel-background:#121317;
      color:#ececf2 !important;
    }
    :root[data-blade-actions] menupopup[data-blade-action-menu] > :is(menuitem,menu) {
      min-height:30px !important; padding:6px 10px !important; margin:2px 4px !important;
      border:1px solid transparent !important; border-radius:7px !important;
      font-family:var(--blade-ui,'Rubik','Segoe UI',sans-serif) !important;
      font-size:12px !important; font-weight:400 !important; color:#e1dde8 !important;
      background:transparent !important; box-shadow:none !important;
      transition:background-color 100ms ease-out,border-color 100ms ease-out !important;
    }
    :root[data-blade-actions] menupopup[data-blade-action-menu] > :is(menuitem,menu)[_moz-menuactive="true"]:not([disabled="true"]) {
      background:linear-gradient(100deg,color-mix(in srgb,var(--accent,#ff2a2a) 12%,#211c25),#ffffff06) !important;
      border-color:color-mix(in srgb,var(--accent,#ff2a2a) 32%,#ffffff16) !important;
      box-shadow:inset 2px 0 var(--accent,#ff2a2a),inset 0 1px #ffffff0b !important;
      color:#f5f1fa !important;
    }
    :root[data-blade-actions] menupopup[data-blade-action-menu] > :is(menuitem,menu)[disabled="true"] { color:#827c8c !important; }
    :root[data-blade-actions] menupopup[data-blade-action-menu] .menu-icon { opacity:.85; }
    :root[data-blade-actions] menupopup[data-blade-action-menu] .menu-accel { color:#97909f !important; font-size:10px !important; }
    :root[data-blade-actions] menupopup[data-blade-action-menu] > menuseparator {
      padding:0 !important; margin:6px 14px !important; height:1px !important;
      border:0 !important; background:#ffffff12 !important;
    }
    :root[data-blade-actions] #downloadsPanel {
      --panel-border-radius:15px; --panel-background:#121317;
      font-family:var(--blade-ui,'Rubik','Segoe UI',sans-serif) !important;
    }
    :root[data-blade-actions] #downloadsPanel-mainView { background:transparent !important; }
    :root[data-blade-actions] #downloadsListBox {
      padding:0 12px 10px !important; width:390px !important; min-width:0 !important;
      max-width:calc(100vw - 48px) !important; box-sizing:border-box;
    }
    #blade-download-head { display:flex; align-items:center; gap:10px; padding:16px 16px 12px; color:#eee9f4; }
    #blade-download-head > span { display:grid; place-items:center; width:32px; height:34px; font-size:22px;
      border:1px solid #ffffff20; border-radius:9px 3px 9px 3px; color:var(--accent,#ff2a2a); background:#ffffff06; }
    #blade-download-head strong { display:block; font-size:15px; font-weight:600; }
    #blade-download-head small { display:block; margin-top:3px; font-size:10px; color:#aaa3b5; }
    :root[data-blade-actions] #downloadsListBox > richlistitem {
      margin:4px 0 !important; padding:3px !important; min-height:78px !important;
      border:1px solid #ffffff12 !important; border-radius:10px !important;
      background:#00000025 !important; color:#eae5f0 !important;
    }
    :root[data-blade-actions] #downloadsListBox > richlistitem:is(:hover,[selected]) {
      background:#ffffff06 !important; border-color:color-mix(in srgb,var(--accent,#ff2a2a) 32%,#ffffff16) !important;
      box-shadow:inset 0 1px #ffffff0b !important;
    }
    :root[data-blade-actions] #downloadsPanel .downloadMainArea { padding:9px 8px !important; background:transparent !important; }
    :root[data-blade-actions] #downloadsPanel .downloadTypeIcon {
      width:40px !important; height:40px !important; padding:6px !important;
      border:1px solid #ffffff10; border-radius:9px; background:#0003; margin-inline-end:12px !important;
    }
    :root[data-blade-actions] #downloadsPanel .downloadTarget { font-size:12px !important; font-weight:600 !important; color:#f1edf6 !important; }
    :root[data-blade-actions] #downloadsPanel .downloadDetails { font-size:10px !important; color:#aea7b9 !important; opacity:1 !important; margin-top:5px !important; }
    :root[data-blade-actions] #downloadsPanel .downloadProgress {
      height:5px !important; margin-top:7px !important; border:0 !important;
      background:#ffffff0e !important; border-radius:5px !important;
    }
    :root[data-blade-actions] #downloadsPanel .downloadProgress::-moz-progress-bar {
      background:linear-gradient(90deg,color-mix(in srgb,var(--accent,#ff2a2a) 70%,#fff),var(--accent,#ff2a2a)) !important;
      border-radius:5px !important; box-shadow:none !important;
    }
    :root[data-blade-actions] #downloadsPanel .downloadButton {
      border:1px solid #ffffff12 !important; border-radius:7px !important; background:#ffffff04 !important;
      margin-inline:5px !important;
    }
    :root[data-blade-actions] #downloadsPanel .downloadButton:hover { background:#ffffff0c !important; }
    :root[data-blade-actions] #downloadsHistory {
      border-top:1px solid #ffffff12 !important; background:#0002 !important;
      color:#bab2c5 !important; font-size:11px !important; padding:12px !important;
    }
    :root[data-blade-actions] #emptyDownloads { color:#aaa3b5 !important; font-size:12px !important; }
    .blade-download-thumb { width:52px; height:52px; object-fit:cover; flex:none; border-radius:8px;
      border:1px solid #ffffff20; margin-inline-end:12px; }
    .blade-download-metrics { display:flex; justify-content:space-between; gap:8px; margin:6px 4px 0;
      font-size:10px; color:#d0c8dc; font-variant-numeric:tabular-nums; }
    .blade-download-metrics[hidden] { display:none !important; }
    :root[data-blade-actions] #downloadsListBox > richlistitem[data-blade-thumb] .downloadTypeIcon { display:none !important; }
    @media (prefers-reduced-motion:reduce) {
      :root[data-blade-actions] menupopup[data-blade-action-menu] > :is(menuitem,menu) { transition:none !important; }
    }
  `;
  root.append(style);root.setAttribute('data-blade-actions','true');
  function clearImages() {
    for(const [row,img] of images){img.onload=null;img.onerror=null;img.removeAttribute('src');img.remove();row.removeAttribute('data-blade-thumb');}
    images.clear();
    for(const node of metrics.values())node.remove();metrics.clear();
  }
  function sync() {
    frame=0;if(disposed || !panel)return;
    if(!['open','showing'].includes(panel.state)){observer?.disconnect();clearImages();return;}
    const rows=[...list.children], active=rows.filter(row=>row._shell?.download && !row._shell.download.stopped).length;
    const detail=header.querySelector('small'),summary=active ? `${active} в процессе` : 'Последние файлы';
    if(detail.textContent!==summary)detail.textContent=summary;
    for(const [row,node] of metrics)if(!row.isConnected){node.remove();metrics.delete(row);}
    for(const [row,img] of images)if(!row.isConnected){img.removeAttribute('src');img.remove();images.delete(row);}
    for(const row of rows){
      const d=row._shell?.download;
      if(d && !d.stopped){
        let node=metrics.get(row);
        if(!node){node=document.createElementNS(ns,'div');node.className='blade-download-metrics';
          node.append(document.createElementNS(ns,'span'),document.createElementNS(ns,'span'));
          row.querySelector('.downloadContainer')?.append(node);metrics.set(row,node);}
        node.hidden=false;
        let rate='Расчёт скорости…',eta='';
        if(d.speed>0){const units=['Б/с','КБ/с','МБ/с'],index=Math.min(2,Math.floor(Math.log2(Math.max(1,d.speed))/10));
          rate=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(d.speed/1024**index)+' '+units[index];
          if(d.hasProgress){const seconds=Math.max(0,Math.ceil((d.totalBytes-d.currentBytes)/d.speed));
            eta='≈ '+(seconds<60?seconds+' с':seconds<3600?Math.ceil(seconds/60)+' мин':Math.ceil(seconds/3600)+' ч');}}
        if(node.firstChild.textContent!==rate)node.firstChild.textContent=rate;
        if(node.lastChild.textContent!==eta)node.lastChild.textContent=eta;
      }else if(metrics.has(row)){metrics.get(row).hidden=true;}
      if(images.has(row) || !d?.succeeded || !row.hasAttribute('exists') || !/\.(png|jpe?g|webp)$/i.test(d.target.path))continue;
      // Decode only bounded completed local images, and only while the panel is open.
      const img=document.createElementNS(ns,'img');img.className='blade-download-thumb';img.alt='';img.draggable=false;img.hidden=true;
      images.set(row,img);
      IOUtils.stat(d.target.path).then(stat=>{
        if(disposed || images.get(row)!==img || !row.isConnected || !['open','showing'].includes(panel.state) || stat.size>8*1024*1024)return;
        img.onload=()=>{if(images.get(row)===img && row.isConnected){img.hidden=false;row.setAttribute('data-blade-thumb','true');}};
        img.onerror=()=>{img.removeAttribute('src');img.remove();row.removeAttribute('data-blade-thumb');};
        const file=Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);file.initWithPath(d.target.path);
        img.src=Services.io.newFileURI(file).spec;
        row.querySelector('.downloadMainArea')?.prepend(img);
      }).catch(()=>{});
    }
  }
  function schedule(){if(!frame)frame=window.requestAnimationFrame(sync);}
  function decorateMenu(menu) {
    menu.setAttribute('data-blade-action-menu','true');menus.add(menu);
    for(const item of menu.querySelectorAll('menuitem,menu')){
      const name=iconMap[item.id] || iconMap[item.getAttribute('command')];if(!name || icons.has(item))continue;
      icons.set(item,{value:item.style.getPropertyValue('--menuitem-icon'),priority:item.style.getPropertyPriority('--menuitem-icon'),iconic:item.classList.contains('menuitem-iconic')});
      const uri=name==='bookmark' ? 'chrome://browser/skin/bookmark-hollow.svg' : `chrome://global/skin/icons/${name}.svg`;
      item.classList.add('menuitem-iconic');item.style.setProperty('--menuitem-icon',`url("${uri}")`);
    }
  }
  function showing(event) {
    const target=event.target;
    if(target.localName==='menupopup' && (menuIds.has(target.id) || target.parentElement?.closest('menupopup[data-blade-action-menu]')))decorateMenu(target);
    if(target.id!=='downloadsPanel')return;
    if(panel!==target){panel?.removeEventListener('popuphidden',hidden);panel=target;panel.addEventListener('popuphidden',hidden);}
    list=document.getElementById('downloadsListBox');if(!list)return;
    if(!header){header=document.createElementNS(ns,'div');header.id='blade-download-head';
      const emblem=document.createElementNS(ns,'span');emblem.textContent='↓';emblem.setAttribute('aria-hidden','true');
      const text=document.createElementNS(ns,'div'),title=document.createElementNS(ns,'strong'),detail=document.createElementNS(ns,'small');
      title.textContent='Загрузки';text.append(title,detail);header.append(emblem,text);list.parentNode.prepend(header);}
    observer?.disconnect();observer=new MutationObserver(schedule);
    observer.observe(list,{childList:true,subtree:true,attributes:true,attributeFilter:['state','exists','value']});schedule();
  }
  function hidden(event) {
    if(event.target!==panel)return;
    observer?.disconnect();if(frame)window.cancelAnimationFrame(frame);frame=0;clearImages();
    // XUL may dispatch an old hidden event while a popup is reopening.
    frame=window.requestAnimationFrame(()=>{frame=0;if(!disposed && panel.state==='open')showing({target:panel});});
  }
  function destroy() {
    if(disposed)return;disposed=true;observer?.disconnect();if(frame)window.cancelAnimationFrame(frame);frame=0;
    window.removeEventListener('popupshowing',showing);panel?.removeEventListener('popuphidden',hidden);window.removeEventListener('unload',destroy);
    clearImages();header?.remove();style.remove();root.removeAttribute('data-blade-actions');
    for(const menu of menus)menu.removeAttribute('data-blade-action-menu');menus.clear();
    for(const [item,old] of icons){if(old.value)item.style.setProperty('--menuitem-icon',old.value,old.priority);else item.style.removeProperty('--menuitem-icon');
      if(!old.iconic)item.classList.remove('menuitem-iconic');}icons.clear();
  }
  window.addEventListener('popupshowing',showing);
  window.addEventListener('unload',destroy,{once:true});
  window.BladeActionPanels={destroy,status:()=>({disposed,images:images.size,metrics:metrics.size,menus:menus.size,pending:!!frame})};
  window.Blade?.mark('actions','v1.0.0 OK');
})();
