export class BladeEffectsVisibilityParent extends JSWindowActorParent {
  receiveMessage(message) {
    if (message.name !== 'Blade:RequestEffects') return;
    const browser = this.browsingContext.top.embedderElement;
    const owner = browser?.ownerDocument?.defaultView;
    const state = (owner?.wrappedJSObject || owner)?.BladeEffects?.contentState();
    this.sendAsyncMessage('Blade:PauseEffects', state || {paused:true, mode:'eco', theme:'red', accent:'#ff2a2a'});
  }
}
