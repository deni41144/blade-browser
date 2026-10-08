export class BladeEffectsVisibilityParent extends JSWindowActorParent {
  receiveMessage(message) {
    if (message.name !== 'Blade:RequestEffects') return;
    const browser = this.browsingContext.top.embedderElement;
    const owner = browser?.ownerDocument?.defaultView;
    const effects = (owner?.wrappedJSObject || owner)?.BladeEffects;
    // A new document can request state between blur and the next focus event.
    // Refresh from the current active window instead of returning stale pause.
    effects?.refresh();
    const state = effects?.contentState();
    this.sendAsyncMessage('Blade:PauseEffects', state || {paused:true, mode:'eco', theme:'red', accent:'#ff2a2a'});
  }
}
