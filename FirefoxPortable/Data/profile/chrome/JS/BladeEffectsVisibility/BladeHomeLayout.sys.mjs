import {fitLayout} from 'chrome://userscripts/content/BladeHomeLayoutModel.sys.mjs';

// Only a transform of the existing React-owned list; no wrappers or navigation.
export class BladeHomeLayout {
  constructor(actor) {
    this.actor = actor; this.doc = actor.document; this.win = this.doc.defaultView;
    this.state = null; this.frame = 0; this.target = null; this.lastRect = '';
    // PERF: observer висит на ВСЕМ документе (childList+subtree) — каждая
    // вставка узла React планировала render() с forced reflow (restore→rect→
    // rect-плиток→запись). Троттлим до ≥200мс между пересчётами и не считаем
    // скрытый документ. render() читает live DOM, поэтому coalescing мутаций
    // не теряет состояние — просто реже делает полный проход. editing — сразу.
    this.timer = 0; this.last = 0;
    this.schedule = () => {
      if (this.timer || this.frame) return;
      const editing = this.state && this.state.editing;
      const wait = editing ? 0 : Math.max(0, 200 - (this.win.performance.now() - this.last));
      this.timer = this.win.setTimeout(() => {
        this.timer = 0;
        if (this.doc.hidden) return;
        if (!this.frame) this.frame = this.win.requestAnimationFrame(() => {
          this.frame = 0; this.last = this.win.performance.now(); this.render();
        });
      }, wait);
    };
    this.observer = new this.win.MutationObserver(this.schedule);
    this.observer.observe(this.doc, {childList:true, subtree:true});
    // fix: resize — немедленно (last=0 → wait=0), иначе плитки отстают до 200мс
    // при перетаскивании окна. Мутации observer'а остаются троттлёными ≥200мс.
    this.onResize = () => { this.last = 0; this.schedule(); };
    this.win.addEventListener('resize', this.onResize);
    // fix: скрытый документ выбрасывает отложенный render (ветка doc.hidden).
    // Без пересчёта при возврате на вкладку раскладка плиток устаревает.
    // visibilitychange планирует render, когда документ снова видим.
    this.onVis = () => { if (!this.doc.hidden) this.schedule(); };
    this.doc.addEventListener('visibilitychange', this.onVis);
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
    // PERF: один проход без аллокации DOMRect-массивов и spread-аргументов
    // Math.min/max (было ~6 массивов на render). Тот же bounding-box плиток.
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity, seen = 0;
    for (const node of target.querySelectorAll('.top-site-outer:not(.placeholder) .tile')) {
      const box = node.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      seen++;
      if (box.left < left) left = box.left;
      if (box.right > right) right = box.right;
      if (box.top < top) top = box.top;
      if (box.bottom > bottom) bottom = box.bottom;
    }
    if (!seen) { left = rect.left; right = rect.right; top = rect.top; bottom = rect.bottom; }
    const base = {x:(left+right)/2, y:(top+bottom)/2, width:right-left, height:bottom-top};
    const point = this.state.tiles;
    const result = point ? fitLayout(base, point, viewport) : {...base, s:1};
    if (point) {
      target.style.setProperty('transform-origin',`${base.x-rect.left}px ${base.y-rect.top}px`,'important');
      target.style.setProperty('translate',`${result.x-base.x}px ${result.y-base.y}px`,'important');
      target.style.setProperty('scale',String(result.s),'important');
    }
    const data = {bg:this.state.bg, base, rect:result, viewport};
    const signature = JSON.stringify(data);
    if (signature !== this.lastRect || this.state.editing) {
      this.lastRect = signature;
      this.actor.sendAsyncMessage('Blade:HomeLayoutRect',data);
    }
  }
  destroy() {
    this.observer.disconnect(); this.win.removeEventListener('resize',this.onResize);
    this.doc.removeEventListener('visibilitychange',this.onVis);
    this.win.clearTimeout(this.timer); this.timer = 0;
    this.win.cancelAnimationFrame(this.frame); this.frame = 0; this.restore(); this.target = null;
  }
}
