// ==UserScript==
// @name            Blade Tile Panel
// @description     Редактор сайтов и обложек в меню B
// @include         main
// @version         1.0.0
// @loadOrder       120
// ==/UserScript==
(function () {
  if (window.BladeTilePanel) return;
  const H = 'http://www.w3.org/1999/xhtml';
  let mounted = null;
  const api = () => window.BladeTileSettings;
  const node = (tag, cls, text) => {
    const el = document.createElementNS(H, tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const button = (text, label, action, cls = '') => {
    const el = node('button', cls, text);
    el.type = 'button'; el.title = label; el.setAttribute('aria-label', label);
    el.addEventListener('click', e => {e.stopPropagation(); action();});
    return el;
  };
  const style = node('style'); style.id = 'blade-tile-panel-style';
  style.textContent = `
    .bt-panel {font:12px var(--blade-ui,Rubik,"Segoe UI",sans-serif);color:#ececf2;--bt-accent:var(--bp-accent,var(--bob-accent,#ff2a2a));}
    .bt-head,.bt-actions,.bt-order {display:flex;align-items:center;gap:6px;}
    .bt-head {justify-content:space-between;margin-bottom:10px;}
    .bt-head strong {font-size:14px;}.bt-hint {margin:0 0 12px;color:#aaa6b3;font-size:11px;line-height:1.5;}
    .bt-panel button,.bt-panel input {font:inherit;box-sizing:border-box;}
    .bt-panel button {appearance:none;border:1px solid #ffffff1c;border-radius:7px;background:#ffffff06;color:inherit;padding:6px 8px;min-height:30px;cursor:pointer;}
    .bt-panel button:hover {background:#ffffff0e;border-color:var(--bt-accent);}
    .bt-panel button:disabled {opacity:.35;cursor:default;}
    .bt-panel :is(button,input):focus-visible {outline:2px solid var(--bt-accent);outline-offset:2px;}
    .bt-panel .bt-primary {background:color-mix(in srgb,var(--bt-accent) 15%,#131116);border-color:color-mix(in srgb,var(--bt-accent) 60%,#ffffff20);}
    .bt-list {display:grid;gap:7px;}.bt-row {display:flex;gap:9px;align-items:center;padding:8px;border:1px solid #ffffff12;border-radius:9px;background:linear-gradient(135deg,#ffffff05,#00000026);}
    .bt-row {cursor:grab;transition:border-color .12s,background .12s;}
    .bt-row.bt-dragging {opacity:.4;cursor:grabbing;}
    .bt-row.bt-drop {border-color:var(--bt-accent);background:color-mix(in srgb,var(--bt-accent) 12%,#151217);box-shadow:inset 0 2px var(--bt-accent);}
    .bt-grip {color:#807a89;font-size:16px;user-select:none;flex:none;}
    .bt-thumb {width:78px;height:46px;flex:none;border-radius:5px;overflow:hidden;border:1px solid #ffffff18;position:relative;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 20%,color-mix(in srgb,var(--bt-accent) 15%,transparent),#111116);}
    .bt-thumb img,.bt-preview img {position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
    .bt-monogram {font-family:var(--blade-display,Unbounded,sans-serif);font-size:15px;font-weight:800;color:var(--bt-accent);}
    .bt-copy {min-width:0;flex:1;}.bt-name {font-weight:600;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .bt-domain {display:block;font-size:10px;color:#a49fad;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:4px;}
    .bt-order {gap:3px;flex-direction:column;}.bt-panel .bt-order button {min-height:21px;padding:0 6px;font-size:11px;}
    .bt-panel .bt-edit {padding:5px 8px;}
    .bt-form {display:grid;gap:10px;padding:12px;margin-bottom:12px;background:#00000030;border:1px solid color-mix(in srgb,var(--bt-accent) 30%,#ffffff15);border-radius:10px;}
    .bt-form label {display:grid;gap:5px;font-size:11px;color:#bdb8c6;}
    .bt-form input {width:100%;background:#0d0c10;border:1px solid #ffffff24;border-radius:6px;color:#f1eef5;padding:9px;min-width:0;}
    .bt-preview {width:168px;max-width:100%;height:94px;position:relative;overflow:hidden;border:1px solid color-mix(in srgb,var(--bt-accent) 35%,#ffffff18);border-radius:8px;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 20%,color-mix(in srgb,var(--bt-accent) 18%,transparent),#111116);}
    .bt-preview-name {position:relative;z-index:1;max-width:100%;padding:6px 10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700;font-size:14px;text-shadow:0 1px 5px #000;}
    .bt-cover {display:flex;align-items:center;gap:10px;}.bt-cover-actions {display:grid;gap:6px;flex:1;}
    .bt-message {font-size:11px;line-height:1.5;color:#edc7ba;margin:9px 0;}.bt-success {color:#c6dfcf;}
    .bt-delete {margin-left:auto;color:#f0b1b7 !important;}.bt-empty {padding:20px 10px;text-align:center;color:#b4aebb;line-height:1.6;border:1px dashed #ffffff20;border-radius:9px;}
    @media(max-width:400px) {.bt-thumb {width:62px;}.bt-row {gap:6px;padding:6px;}.bt-cover {align-items:stretch;}.bt-preview {width:145px;}}
  `;
  document.documentElement.append(style);

  function destroy() {
    if (!mounted) return;
    mounted.unsubscribe?.(); mounted.popup?.removeEventListener('popuphidden', mounted.hide);
    mounted = null;
  }
  function message(text, good = false) {
    if (!mounted?.host.isConnected) return;
    const old = mounted.host.querySelector('.bt-message'); old?.remove();
    const el = node('p', 'bt-message' + (good ? ' bt-success' : ''), text);
    el.setAttribute('role', 'status'); mounted.host.append(el);
  }
  async function perform(action, success) {
    const state = mounted;
    if (!state || state.busy) return;
    state.busy = true; state.host.setAttribute('aria-busy', 'true');
    try {
      await action();
      if (mounted !== state || !state.host.isConnected) return;
      state.edit = null; render(); if (success) message(success, true);
    } catch (e) { if (mounted === state) message(e.message || 'Не удалось сохранить плитку.'); }
    finally {state.busy = false; state.host.removeAttribute('aria-busy');}
  }
  function picture(box, item, preview = false) {
    box.replaceChildren();
    const uri = api().coverURI(item);
    if (uri) {
      const img = node('img'); img.alt = ''; img.decoding = 'async'; img.src = uri;
      img.addEventListener('error', () => img.remove(), {once:true}); box.append(img);
    }
    if (preview || !uri) box.append(node('span', preview ? 'bt-preview-name' : 'bt-monogram', preview ? item.title || 'Название сайта' : (item.title || 'B').slice(0, 2).toUpperCase()));
  }
  function form(state) {
    const item = state.edit, box = node('form', 'bt-form');
    box.append(node('strong', '', item.url ? 'Настроить плитку' : 'Новая плитка'));
    const titleLabel = node('label', '', 'Название'), title = node('input');
    title.maxLength = 80; title.value = item.title || ''; title.placeholder = 'Например, YouTube'; title.required = true; titleLabel.append(title);
    const urlLabel = node('label', '', 'Адрес сайта'), url = node('input');
    url.value = item.url || ''; url.placeholder = 'example.com или https://…'; url.required = true; url.maxLength = 2048; urlLabel.append(url);
    const cover = node('div', 'bt-cover'), preview = node('div', 'bt-preview'), coverActions = node('div', 'bt-cover-actions');
    let chosen = item.cover;
    const refresh = () => {picture(preview, {url:url.value, title:title.value, cover:chosen}, true);};
    const choose = button('Своя обложка', 'Выбрать изображение плитки', async () => {
      if (state.picking) return;
      state.picking = true;
      const anchor = state.popup?.anchorNode;
      try { const value = await api().chooseCover(); if (mounted !== state || !box.isConnected) return; if (value) {chosen = value; refresh();} }
      catch (e) {message(e.message || 'Не удалось открыть изображение.');}
      finally {
        state.picking = false;
        if (mounted === state && state.popup?.state === 'closed' && anchor?.isConnected) {
          state.popup._bladeTileResume = true;
          state.popup.openPopup(anchor, 'after_start', 0, 0, false, false);
        }
      }
    });
    const reset = button('По теме', 'Вернуть тематическую обложку', () => {chosen = null; refresh();});
    coverActions.append(choose, reset); cover.append(preview, coverActions);
    title.addEventListener('input', refresh); url.addEventListener('input', refresh);
    const actions = node('div', 'bt-actions');
    const save = button('Сохранить', 'Сохранить плитку', () => box.requestSubmit(), 'bt-primary');
    const cancel = button('Отмена', 'Отменить редактирование', () => {state.edit = null; render();});
    actions.append(save, cancel);
    if (item.url) actions.append(button('Удалить', 'Удалить плитку', () => {
      perform(() => api().remove(item.url), 'Плитка удалена.');
    }, 'bt-delete'));
    box.append(titleLabel, urlLabel, cover, actions);
    box.addEventListener('submit', e => {
      e.preventDefault(); e.stopPropagation();
      perform(() => api().save({url:url.value, title:title.value, cover:chosen}, item.url || undefined), 'Плитка сохранена.');
    });
    refresh(); state.host.append(box);
    window.setTimeout(() => {if (box.isConnected) title.focus();}, 0);
  }
  function render() {
    const state = mounted;
    if (!state?.host.isConnected) return;
    const {host} = state; host.replaceChildren();
    const head = node('div', 'bt-head'), links = api().list();
    head.append(node('strong', '', `Мои плитки · ${links.length}`));
    head.append(button('+ Добавить', 'Добавить сайт', () => {state.edit = {}; render();}, 'bt-primary'));
    host.append(head, node('p', 'bt-hint', 'Перетаскивайте плитки за карточку. Нажмите ✎, чтобы изменить сайт и обложку.'));
    if (state.edit) form(state);
    const list = node('div', 'bt-list'); host.append(list);
    if (!links.length) list.append(node('div', 'bt-empty', 'Пока нет плиток. Добавьте первый сайт — адрес и название можно указать вручную.'));
    links.forEach((item, i) => {
      const row = node('div', 'bt-row'), thumb = node('div', 'bt-thumb'); picture(thumb, item);
      row.draggable = true;
      row.dataset.tileUrl = item.url;
      row.addEventListener('dragstart', e => {
        if (state.busy || e.target.closest('button')) {e.preventDefault(); return;}
        state.dragged = item.url;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.url);
        row.classList.add('bt-dragging');
      });
      row.addEventListener('dragover', e => {
        if (!state.dragged || state.dragged === item.url) return;
        e.preventDefault(); e.dataTransfer.dropEffect = 'move';
        list.querySelectorAll('.bt-drop').forEach(el => {if (el !== row) el.classList.remove('bt-drop');});
        row.classList.add('bt-drop');
        const scroller = host.closest('.bp-body');
        if (scroller) {
          const bounds = scroller.getBoundingClientRect();
          if (e.clientY < bounds.top + 40) scroller.scrollTop -= 12;
          else if (e.clientY > bounds.bottom - 40) scroller.scrollTop += 12;
        }
      });
      row.addEventListener('dragleave', e => {if (!row.contains(e.relatedTarget)) row.classList.remove('bt-drop');});
      row.addEventListener('drop', e => {
        if (!state.dragged) return;
        e.preventDefault(); e.stopPropagation();
        const source = state.dragged; state.dragged = null;
        perform(() => api().moveTo(source, item.url));
      });
      row.addEventListener('dragend', () => {
        state.dragged = null;
        list.querySelectorAll('.bt-dragging,.bt-drop').forEach(el => el.classList.remove('bt-dragging','bt-drop'));
      });
      const copy = node('div', 'bt-copy'); copy.append(node('span', 'bt-name', item.title));
      let domain; try {domain = new URL(item.url).hostname;} catch {domain = item.url;}
      copy.append(node('span', 'bt-domain', domain));
      const edit = button('✎', 'Настроить: ' + item.title, () => {state.edit = {...item}; render();}, 'bt-edit');
      const grip = node('span', 'bt-grip', '⠿'); grip.setAttribute('aria-hidden','true');
      row.append(grip, thumb, copy, edit); list.append(row);
    });
  }
  function mount(host) {
    destroy(); host.classList.add('bt-panel');
    if (!api()) {host.textContent = 'Редактор плиток загружается…'; return;}
    const state = {host, edit:null, busy:false, popup:host.closest('panel')}; mounted = state;
    state.unsubscribe = api().subscribe(() => {if (mounted === state && !state.edit && !state.busy) render();});
    state.hide = e => {if (e.target === state.popup && !state.picking && !['open','showing'].includes(state.popup.state)) destroy();};
    state.popup?.addEventListener('popuphidden', state.hide); render();
  }
  window.BladeTilePanel = {mount, destroy};
  window.addEventListener('unload', () => {destroy(); style.remove();}, {once:true});
})();
