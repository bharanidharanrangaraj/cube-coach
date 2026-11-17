/* camera.js - start/stop the camera and grab the grid square from the live video, on the device. */
(function (G) {
  'use strict';
  class Camera {
    constructor(video) {
      this.video = video; this.stream = null; this.facing = 'environment'; this.mirrored = false;
      this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = 160;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
      this.torchOn = false;
    }
    get running() { return !!this.stream; }
    get ready() { return this.video.readyState >= 2 && this.video.videoWidth > 0; }
    async start(facing) {
      this.stop();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('nocamera');
      const want = facing || this.facing;
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false, video: { facingMode: { ideal: want }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      this.video.srcObject = this.stream;
      this.video.setAttribute('playsinline', ''); this.video.muted = true;
      await this.video.play().catch(() => {});
      const track = this.stream.getVideoTracks()[0], st = track.getSettings ? track.getSettings() : {};
      let f = st.facingMode;
      if (!f) {        // laptops usually don't say: a computer with one camera faces the user
        const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
        f = cams.length <= 1 ? 'user' : want;
      }
      this.facing = f === 'environment' ? 'environment' : 'user';
      this.mirrored = this.facing === 'user';
      this.video.style.transform = this.mirrored ? 'scaleX(-1)' : '';
      this.track = track;
      this.canTorch = !!(track.getCapabilities && track.getCapabilities().torch);
      return this.facing;
    }
    stop() {
      if (this.stream) this.stream.getTracks().forEach(t => t.stop());
      this.stream = null; this.video.srcObject = null; this.torchOn = false;
    }
    async switch() { return this.start(this.facing === 'user' ? 'environment' : 'user'); }
    async torch(on) {
      if (!this.canTorch) return false;
      try { await this.track.applyConstraints({ advanced: [{ torch: on }] }); this.torchOn = on; return true; } catch (e) { return false; }
    }
    /** square on screen (element pixels) -> ImageData of what the camera sees there, not mirrored */
    grab(sq) {
      const v = this.video, ew = v.clientWidth, eh = v.clientHeight, vw = v.videoWidth, vh = v.videoHeight;
      if (!vw || !ew) return null;
      const s = Math.max(ew / vw, eh / vh), ox = (ew - vw * s) / 2, oy = (eh - vh * s) / 2;
      const ex = this.mirrored ? ew - sq.x - sq.size : sq.x;
      const sx = (ex - ox) / s, sy = (sq.y - oy) / s, ss = sq.size / s;
      const N = this.canvas.width;
      this.ctx.drawImage(v, sx, sy, ss, ss, 0, 0, N, N);
      return this.ctx.getImageData(0, 0, N, N);
    }
  }
  G.Camera = Camera;
})(typeof self !== 'undefined' ? self : globalThis);
