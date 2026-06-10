/* Touch controls: a floating virtual joystick on the left, an interact
   rune on the right, and a small menu column. Activates only on devices
   that can touch. */
'use strict';

const TouchUI = {
  active: false,
  vec: { x: 0, y: 0 },
  sprint: false,
  _joyId: null,
  _anchor: null,
  _pinch0: 0,
  _zoom0: 1,

  init() {
    if (!('ontouchstart' in window) && navigator.maxTouchPoints === 0) return;
    this.active = true;
    document.body.classList.add('touch');
    const startEl = document.getElementById('title-start');
    if (startEl) startEl.textContent = '— tap anywhere to begin —';

    const zone = document.getElementById('joy-zone');
    zone.addEventListener('touchstart', (e) => this._joyStart(e), { passive: false });
    zone.addEventListener('touchmove', (e) => this._joyMove(e), { passive: false });
    zone.addEventListener('touchend', (e) => this._joyEnd(e));
    zone.addEventListener('touchcancel', (e) => this._joyEnd(e));

    document.getElementById('btn-interact').addEventListener('click', () => pressE());
    document.getElementById('btn-map').addEventListener('click', () => {
      if (game.mode === 'playing') UI.toggleMap();
    });
    document.getElementById('btn-journal').addEventListener('click', () => {
      if (game.mode === 'playing') UI.toggleJournal();
    });
    document.getElementById('btn-sound').addEventListener('click', () => game.audio.toggleMute());

    // pinch to zoom the world map
    const map = document.getElementById('map-canvas');
    map.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        this._pinch0 = this._dist(e.touches);
        this._zoom0 = UI.mapZoom;
      }
    }, { passive: true });
    map.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && this._pinch0 > 0) {
        e.preventDefault();
        UI.mapZoom = Math.max(0.35, Math.min(3,
          this._zoom0 * (this._dist(e.touches) / this._pinch0)));
        UI.drawMap();
      }
    }, { passive: false });

    window.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  _dist(touches) {
    return Math.hypot(touches[0].clientX - touches[1].clientX,
                      touches[0].clientY - touches[1].clientY);
  },

  _joyStart(e) {
    e.preventDefault();
    if (this._joyId !== null) return;
    const t = e.changedTouches[0];
    this._joyId = t.identifier;
    this._anchor = { x: t.clientX, y: t.clientY };
    const base = document.getElementById('joy-base');
    base.style.left = (t.clientX - 55) + 'px';
    base.style.top = (t.clientY - 55) + 'px';
    base.classList.remove('hidden');
    this._setKnob(0, 0);
  },

  _joyMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== this._joyId) continue;
      const R = 48;
      let dx = t.clientX - this._anchor.x;
      let dy = t.clientY - this._anchor.y;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx = dx / len * R; dy = dy / len * R; }
      this._setKnob(dx, dy);
      const mag = Math.min(1, len / R);
      if (mag < 0.18) {                      // dead zone
        this.vec.x = 0; this.vec.y = 0; this.sprint = false;
      } else {
        this.vec.x = dx / R; this.vec.y = dy / R;
        this.sprint = mag >= 0.95;
      }
    }
  },

  _joyEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier !== this._joyId) continue;
      this._joyId = null;
      this.vec.x = 0; this.vec.y = 0; this.sprint = false;
      document.getElementById('joy-base').classList.add('hidden');
    }
  },

  _setKnob(dx, dy) {
    document.getElementById('joy-knob').style.transform =
      'translate(' + dx + 'px,' + dy + 'px)';
  },
};
