import { createTileFx } from 'chrome://userscripts/content/BladeEffectsVisibility/BladeTileFx.sys.mjs';
import { createTileDrag } from 'chrome://userscripts/content/BladeEffectsVisibility/BladeTileDrag.sys.mjs';

export class BladeEffectsVisibilityChild extends JSWindowActorChild {
  actorCreated() {
    this.parentPaused = true;
    this.fxState = {paused:true, mode:'eco', theme:'red', accent:'#ff2a2a'};
    this.update();
    this.sendAsyncMessage('Blade:RequestEffects');
  }
  update() {
    const doc = this.document;
    if (doc.documentElement) {
      doc.documentElement.toggleAttribute('data-blade-fx-content-paused', doc.hidden || this.parentPaused);
      if (!this.tileFx) this.tileFx = createTileFx(doc);
      if (!this.tileDrag) this.tileDrag = createTileDrag(doc);
      const state = {...this.fxState, paused:doc.hidden || this.parentPaused};
      this.tileFx.setState(state);
      this.tileDrag.setState(state);
    }
  }
  handleEvent(event) {
    this.update();
    if (event.type === 'pageshow') this.sendAsyncMessage('Blade:RequestEffects');
  }
  receiveMessage(message) {
    if (message.name !== 'Blade:PauseEffects') return;
    this.fxState = message.data;
    this.parentPaused = !!message.data.paused;
    this.update();
  }
  didDestroy() {
    this.tileFx?.destroy();
    this.tileDrag?.destroy();
    this.tileFx = null;
    this.tileDrag = null;
  }
}
