// ==UserScript==
// @name            Blade Accounts
// @description     Раздельные аккаунты сайта и переключение без выхода
// @author          Blade-Creations
// @include         main
// @version         1.1.0
// @loadOrder       10
// ==/UserScript==
(function () {
  if (window.BladeAccounts) return;
  const { ContextualIdentityService: identities } = ChromeUtils.importESModule(
    'moz-src:///toolkit/components/contextualidentity/ContextualIdentityService.sys.mjs');
  const { PrivateBrowsingUtils } = ChromeUtils.importESModule('resource://gre/modules/PrivateBrowsingUtils.sys.mjs');
  const topics = ['contextual-identity-created', 'contextual-identity-updated',
    'contextual-identity-deleted', 'contextual-identity-reordered'];
  const tabEvents = ['TabOpen', 'TabClose', 'TabSelect', 'TabAttrModified', 'SSTabRestored'];
  let disposed = false, pending = false;
  function available() {
    return !disposed && !PrivateBrowsingUtils.isWindowPrivate(window) &&
      Services.prefs.getBoolPref('privacy.userContext.enabled', false);
  }
  function requireAvailable() {
    if (!available()) throw new Error('Аккаунты недоступны в этом окне');
  }
  function tabId(tab) { return Number(tab?.userContextId || 0); }
  function originOf(tab) {
    try {
      const url = new URL(tab.linkedBrowser.currentURI.spec);
      return ['https:', 'http:'].includes(url.protocol) ? url.origin : null;
    } catch (_) { return null; }
  }
  function liveTabs() { return Array.from(gBrowser.tabs).filter(tab => !tab.closing); }
  function descriptor(identity) {
    const id = identity?.userContextId || 0;
    const tabs = liveTabs().filter(tab => tabId(tab) === id);
    const origin = originOf(gBrowser.selectedTab);
    return {
      userContextId: id,
      name: id ? identities.getUserContextLabel(id) : 'Основной',
      color: identity?.color || 'gray',
      colorCode: identities.getContainerColorCode(identity?.color || 'gray'),
      icon: identity?.icon || 'fingerprint',
      tabs: tabs.length,
      siteTabs: origin ? tabs.filter(tab => originOf(tab) === origin).length : 0,
      current: tabId(gBrowser.selectedTab) === id,
    };
  }
  function list(includeDefault = false) {
    if (!available()) return [];
    const result = identities.getPublicIdentities().map(descriptor);
    if (includeDefault) result.unshift(descriptor(null));
    return result;
  }
  function current() {
    if (!available()) return null;
    const id = tabId(gBrowser.selectedTab);
    return descriptor(id ? identities.getPublicIdentityFromId(id) : null);
  }
  function colors() {
    return identities.containerColors.map(color => ({ color, colorCode: identities.getContainerColorCode(color) }));
  }
  function validIdentity(id, allowDefault = true) {
    requireAvailable();
    if (!Number.isInteger(id) || id < 0 || (!allowDefault && id === 0)) throw new Error('Неизвестный аккаунт');
    const identity = id ? identities.getPublicIdentityFromId(id) : null;
    if (id && !identity) throw new Error('Неизвестный аккаунт');
    return identity;
  }
  function validName(name) {
    if (typeof name !== 'string') throw new Error('Укажи имя аккаунта');
    const clean = name.trim();
    if (!clean || clean.length > 64 || /[\x00-\x1f\x7f]/.test(clean)) throw new Error('Имя должно содержать от 1 до 64 символов');
    return clean;
  }
  function validColor(color) {
    if (!identities.containerColors.includes(color)) throw new Error('Неизвестный цвет аккаунта');
    return color;
  }
  function create(name, color = 'blue') {
    requireAvailable();
    return descriptor(identities.create(validName(name), 'fingerprint', validColor(color)));
  }
  function update(id, changes) {
    const identity = validIdentity(id, false);
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new Error('Укажи имя или цвет аккаунта');
    const name = validName(changes.name === undefined ? identities.getUserContextLabel(id) : changes.name);
    const color = validColor(changes.color === undefined ? identity.color : changes.color);
    if (!identities.update(id, name, identity.icon || 'fingerprint', color)) throw new Error('Не удалось обновить аккаунт');
    return descriptor(identities.getPublicIdentityFromId(id));
  }
  function rename(id, name) { return update(id, { name }); }
  function addTab(id, url) {
    const tab = gBrowser.addTab(url, { userContextId: id, allowInheritPrincipal: false,
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() });
    gBrowser.selectedTab = tab;
    return tab;
  }
  function open(id, sameSite = false) {
    validIdentity(id);
    let url = 'about:newtab';
    if (sameSite) {
      const origin = originOf(gBrowser.selectedTab);
      if (!origin) throw new Error('В другом аккаунте можно открыть только HTTP(S) сайт');
      // Только origin: не переносим userinfo, path, query, fragment, opener или данные сайта.
      url = origin + '/';
    }
    return addTab(id, url);
  }
  function switchTo(id, sameSite = true) {
    validIdentity(id);
    const origin = sameSite ? originOf(gBrowser.selectedTab) : null;
    const candidates = liveTabs().filter(tab => tabId(tab) === id && (!origin || originOf(tab) === origin));
    const existing = candidates.includes(gBrowser.selectedTab) ? gBrowser.selectedTab :
      candidates.sort((a, b) => Number(b.lastAccessed || 0) - Number(a.lastAccessed || 0))[0];
    if (existing) { gBrowser.selectedTab = existing; return existing; }
    return addTab(id, origin ? origin + '/' : 'about:newtab');
  }
  function manage() { requireAvailable(); window.openTrustedLinkIn('about:preferences#containers', 'tab'); }
  function decorate(tab) {
    const identity = tabId(tab) && identities.getPublicIdentityFromId(tabId(tab));
    let label = tab.querySelector('.blade-account-label');
    if (!available() || !identity) { if (label) label.remove(); return; }
    identities.setTabStyle(tab);
    const host = tab.querySelector('.tab-label-container');
    if (!host) return;
    if (!label) {
      label = document.createXULElement('label');
      label.classList.add('blade-account-label');
      host.appendChild(label);
    }
    const name = identities.getUserContextLabel(tabId(tab));
    label.setAttribute('value', name);
    label.setAttribute('tooltiptext', name);
  }
  function refresh() {
    if (disposed) return;
    for (const tab of liveTabs()) decorate(tab);
    const detail = { current: current(), accounts: list(true) };
    window.Blade.bus.emit('blade-accounts-changed', detail);
    window.dispatchEvent(new CustomEvent('blade-accounts-changed', { detail }));
  }
  function scheduleRefresh() {
    if (disposed || pending) return;
    pending = true;
    queueMicrotask(() => { pending = false; refresh(); });
  }
  function onTabEvent(event) {
    if (event.type === 'TabAttrModified' && !event.detail?.changed?.includes('usercontextid')) return;
    scheduleRefresh();
  }
  const progress = { onLocationChange: scheduleRefresh };
  const observer = { observe: scheduleRefresh };
  const prefObserver = { observe: scheduleRefresh };
  function destroy() {
    if (disposed) return;
    disposed = true;
    for (const topic of topics) Services.obs.removeObserver(observer, topic);
    Services.prefs.removeObserver('privacy.userContext.enabled', prefObserver);
    for (const event of tabEvents) gBrowser.tabContainer.removeEventListener(event, onTabEvent);
    gBrowser.removeTabsProgressListener(progress);
    window.removeEventListener('unload', destroy);
    for (const tab of gBrowser.tabs) tab.querySelector('.blade-account-label')?.remove();
  }
  window.BladeAccounts = { available, list, current, colors, create, update, rename, open, switchTo, manage, destroy };
  for (const event of tabEvents) gBrowser.tabContainer.addEventListener(event, onTabEvent);
  gBrowser.addTabsProgressListener(progress);
  for (const topic of topics) Services.obs.addObserver(observer, topic);
  Services.prefs.addObserver('privacy.userContext.enabled', prefObserver);
  window.addEventListener('unload', destroy, { once: true });
  refresh();
  window.Blade.mark('BladeAccounts', 'v1.1.0 OK init');
})();
