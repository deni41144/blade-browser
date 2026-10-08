export class BladeMusicContentChild extends JSWindowActorChild {
  receiveMessage(message) {
    if (message.name !== 'BladeMusic:Action') return false;
    const doc = this.document;
    if (doc.location.protocol !== 'https:' || doc.location.hostname !== 'music.youtube.com') return false;
    const action = message.data?.action;
    if (action === 'previous' || action === 'next') {
      const bar = doc.querySelector('ytmusic-player-bar');
      const selector = action === 'previous' ? '.previous-button, #previous-button' : '.next-button, #next-button';
      const control = bar?.querySelector(selector);
      if (!control || control.disabled || control.hasAttribute('disabled') || control.getAttribute('aria-disabled') === 'true') return false;
      control.click();
      return true;
    }
    if (action === 'backward' || action === 'forward') {
      const media = doc.querySelector('#movie_player video') || doc.querySelector('video');
      if (!media || media.readyState < 1 || !Number.isFinite(media.currentTime)) return false;
      let position = Math.max(0, media.currentTime + (action === 'backward' ? -10 : 10));
      if (Number.isFinite(media.duration)) position = Math.min(position, media.duration);
      if (media.seekable.length) {
        const ranges = media.seekable;
        position = Math.max(ranges.start(0), Math.min(position, ranges.end(ranges.length - 1)));
      }
      try { media.currentTime = position; return true; } catch (_) { return false; }
    }
    return false;
  }
}
