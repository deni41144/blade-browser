import {fitLayout} from 'chrome://userscripts/content/BladeHomeLayoutModel.sys.mjs';

// Only a transform of the existing React-owned list; no wrappers or navigation.
export class BladeHomeLayout {
  constructor(actor) {
    this.actor = actor; this.doc = actor.document; this.win = this.doc.defaultView;
    this.state = null; this.frame = 0; this.target = null; this.lastRect = '';
    this.schedule = () => {if (!this.frame) this.frame = this.win.requestAnimationFrame(() => {this.frame = 0; this.render();});};
    this.observer = new this.win.MutationObserver(this.schedule);
    this.observer.observe(this.doc, {childList:true, subtree:true});
    this.win.addEventListener('resize', this.schedule);
    this.original = null;
  }
  restore() {
    if (!this.target || !this.original) return;
    for (const [name, value, priority] of this.original) {
      if (value) this.target.style.setProperty(name, value, priority);
      else this.target.style.removeProperty(name);
    }
  }
  apply(state) {this.state = state; this.schedule();}
  render() {
    if (!this.state || this.actor.destroyed) return;
    const target = this.doc.querySelector('.top-sites-list');
    if (!target) return;
    if (this.target !== target) {
      this.restore(); this.target = target;
      this.original = ['translate','scale','transform-origin'].map(name => [name, target.style.getPropertyValue(name), target.style.getPropertyPriority(name)]);
    }
    this.restore();
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const viewport = {width:this.win.innerWidth, height:this.win.innerHeight};
    // Tile artwork is lifted 20px by the existing material CSS. Frame the
    // visible cards, rather than their React layout boxes.
    const cards = [...target.querySelectorAll('.top-site-outer:not(.placeholder) .tile')].map(node=>node.getBoundingClientRect()).filter(box=>box.width && box.height);
    const left = cards.length ? Math.min(...cards.map(box=>box.left)) : rect.left;
    const right = cards.length ? Math.max(...cards.map(box=>box.right)) : rect.right;
    const top = cards.length ? Math.min(...cards.map(box=>box.top)) : rect.top;
    const bottom = cards.length ? Math.max(...cards.map(box=>box.bottom)) : rect.bottom;
    const base = {x:(left+right)/2, y:(top+bottom)/2, width:right-left, height:bottom-top};
    const point = this.state.tiles;
    const result = point ? fitLayout(base, point, viewport) : {...base, s:1};
    if (point) {
      target.style.setProperty('transform-origin',`${base.x-rect.left}px ${base.y-rect.top}px`,'important');
      target.style.setProperty('translate',`${result.x-base.x}px ${result.y-base.y}px`,'important');
      target.style.setProperty('scale',String(result.s),'important');
    }
    const data = {bg:this.state.bg, base, rect:result};
    const signature = JSON.stringify(data);
    if (signature !== this.lastRect || this.state.editing) {
      this.lastRect = signature;
      this.actor.sendAsyncMessage('Blade:HomeLayoutRect',data);
    }
  }
  destroy() {
    this.observer.disconnect(); this.win.removeEventListener('resize',this.schedule);
    this.win.cancelAnimationFrame(this.frame); this.restore(); this.target = null;
  }
}
