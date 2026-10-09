import {setTimeout} from 'resource://gre/modules/Timer.sys.mjs';
import { createTileFx } from 'chrome://userscripts/content/BladeEffectsVisibility/BladeTileFx.sys.mjs';
import { createTileDrag } from 'chrome://userscripts/content/BladeEffectsVisibility/BladeTileDrag.sys.mjs';
import { BladeHomeLayout } from 'chrome://userscripts/content/BladeEffectsVisibility/BladeHomeLayout.sys.mjs';

export class BladeEffectsVisibilityChild extends JSWindowActorChild {
  actorCreated() {
    this.destroyed = false;
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
    if (event.type === 'pageshow' || (event.type === 'visibilitychange' && !this.document.hidden)) {
      this.sendAsyncMessage('Blade:RequestEffects');
    }
  }
  async receiveMessage(message) {
    if (message.name === 'Blade:HomeLayout') {
      if (!this.homeLayout) this.homeLayout = new BladeHomeLayout(this);
      this.homeLayout.apply(message.data);
      return;
    }
    if (message.name === 'Blade:PrepareWallpaper') {
      // Only the privileged parent sends this request to built-in new tabs.
      // Keep one decoded image per actor; never accumulate wallpaper caches.
      const url = message.data?.url;
      if (typeof url !== 'string' || !url.startsWith('file:')) return {ready:false};
      const request = (this.wallpaperRequest || 0) + 1;
      this.wallpaperRequest = request;
      let image;
      try {
        // DOM Image in about:newtab is restricted by its content policy.
        // Use the same privileged image loader as USER-sheet backgrounds.
        image = Cc['@mozilla.org/image/loader;1'].getService(Ci.imgILoader).loadImageXPCOM(
          Services.io.newURI(url), null, null,
          Services.scriptSecurityManager.getSystemPrincipal(), null, null, this.document, 0, null);
        image.startDecoding(0);
        const deadline = Date.now() + 6000;
        await new Promise((resolve, reject) => {
          const check = () => {
            if (this.destroyed || request !== this.wallpaperRequest || Date.now() > deadline ||
                (image.imageStatus & Ci.imgIRequest.STATUS_ERROR)) {
              reject(new Error('Wallpaper decode cancelled or failed'));
            } else if (image.imageStatus & Ci.imgIRequest.STATUS_FRAME_COMPLETE) {
              resolve();
            } else {
              setTimeout(check, 16);
            }
          };
          check();
        });
        this.preparedWallpaper?.cancelAndForgetObserver(Cr.NS_BINDING_ABORTED);
        this.preparedWallpaper = image;
        return {ready:true};
      } catch (e) {
        image?.cancelAndForgetObserver(Cr.NS_BINDING_ABORTED);
        return {ready:false, error:String(e)};
      }
    }
    if (message.name !== 'Blade:PauseEffects') return;
    this.fxState = message.data;
    this.parentPaused = !!message.data.paused;
    this.update();
  }
  didDestroy() {
    this.destroyed = true;
    this.wallpaperRequest = (this.wallpaperRequest || 0) + 1;
    this.preparedWallpaper?.cancelAndForgetObserver(Cr.NS_BINDING_ABORTED);
    this.preparedWallpaper = null;
    this.tileFx?.destroy();
    this.tileDrag?.destroy();
    this.homeLayout?.destroy();
    this.tileFx = null;
    this.tileDrag = null;
  }
}
