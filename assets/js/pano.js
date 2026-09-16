/* Ananta Property — 360° panorama viewer.
   Plain WebGL, no dependencies, no build step.

   Markup it expects inside a tour overlay:
     <div class="pano" data-pano>
       <script type="application/json" data-pano-config>
         { "rooms": [ { "id": "Living", "label": "Living pavilion",
                        "src": "assets/img/360/living.jpg",
                        "x": 30, "y": 60, "heading": 0 } ] }
       </script>
     </div>
   A room with an empty "src" renders the "image to come" state instead of a
   panorama, so pages work before the 360° renders exist.

   Room buttons reuse the existing [data-choice-group="room"] control: the
   viewer listens for the same "choice" event pages.js dispatches.

   Panorama files: equirectangular, 2:1 (e.g. 4096x2048), JPEG. */
(() => {
  const RAD = Math.PI / 180;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── 4x4 matrix helpers ───────────────────────────────────────────────
  const perspective = (fovy, aspect, near, far) => {
    const f = 1 / Math.tan(fovy / 2), d = near - far;
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / d, -1, 0, 0, (2 * far * near) / d, 0];
  };
  const rotX = (a) => {
    const c = Math.cos(a), s = Math.sin(a);
    return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
  };
  const rotY = (a) => {
    const c = Math.cos(a), s = Math.sin(a);
    return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
  };
  // Column-major a·b (the layout WebGL expects, so projection stays leftmost).
  const mul = (a, b) => {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  };

  // ── Sphere seen from the inside ──────────────────────────────────────
  function sphere(segW, segH) {
    const pos = [], uv = [], idx = [];
    for (let y = 0; y <= segH; y++) {
      const v = y / segH, theta = v * Math.PI;
      for (let x = 0; x <= segW; x++) {
        const u = x / segW, phi = u * 2 * Math.PI;
        pos.push(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi));
        uv.push(u, v);
      }
    }
    for (let y = 0; y < segH; y++) for (let x = 0; x < segW; x++) {
      const a = y * (segW + 1) + x, b = a + segW + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    return { pos: new Float32Array(pos), uv: new Float32Array(uv), idx: new Uint16Array(idx) };
  }

  const VS = 'attribute vec3 p;attribute vec2 t;uniform mat4 m;varying vec2 v;' +
    'void main(){v=t;gl_Position=m*vec4(p,1.0);}';
  const FS = 'precision mediump float;varying vec2 v;uniform sampler2D s;uniform float o;' +
    'void main(){vec4 c=texture2D(s,v);gl_FragColor=vec4(c.rgb,c.a*o);}';

  const ICON = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>' +
    '<path d="m21 15-5-5L5 21"/></svg>';

  class Pano {
    constructor(host, config) {
      this.host = host;
      this.rooms = (config.rooms || []).filter((r) => r && r.id);
      this.index = 0;
      this.yaw = 0;
      this.pitch = 0;
      this.fov = 75;
      this.vy = 0;
      this.dragging = false;
      this.textures = new Map();
      this.build();
      this.show(0, true);
    }

    build() {
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'pano-canvas';
      this.empty = document.createElement('div');
      this.empty.className = 'pano-empty';
      this.host.append(this.canvas, this.empty);

      this.gl = this.canvas.getContext('webgl', { alpha: true, antialias: true }) ||
        this.canvas.getContext('experimental-webgl');
      if (this.gl) this.initGL();

      this.map = this.host.parentElement.querySelector('[data-pano-map]');
      if (this.map) this.buildMap();

      const group = document.querySelector('[data-choice-group="room"]');
      if (group) {
        group.addEventListener('choice', (e) => {
          const i = this.rooms.findIndex((r) => r.id === e.detail.dataset.choice);
          if (i > -1) this.show(i);
        });
      }
      this.bindPointer();
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(this.host);
      window.addEventListener('resize', () => this.resize());
    }

    initGL() {
      const gl = this.gl;
      const sh = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return s;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      gl.useProgram(prog);
      this.prog = prog;

      const geo = sphere(64, 32);
      const buf = (target, data) => {
        const b = gl.createBuffer();
        gl.bindBuffer(target, b);
        gl.bufferData(target, data, gl.STATIC_DRAW);
        return b;
      };
      buf(gl.ARRAY_BUFFER, geo.pos);
      const pLoc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(pLoc);
      gl.vertexAttribPointer(pLoc, 3, gl.FLOAT, false, 0, 0);

      buf(gl.ARRAY_BUFFER, geo.uv);
      const tLoc = gl.getAttribLocation(prog, 't');
      gl.enableVertexAttribArray(tLoc);
      gl.vertexAttribPointer(tLoc, 2, gl.FLOAT, false, 0, 0);

      buf(gl.ELEMENT_ARRAY_BUFFER, geo.idx);
      this.count = geo.idx.length;
      this.uM = gl.getUniformLocation(prog, 'm');
      this.uO = gl.getUniformLocation(prog, 'o');
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    texture(src) {
      if (this.textures.has(src)) return this.textures.get(src);
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([11, 21, 24, 255]));
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // No UNPACK_FLIP_Y: the sphere's v starts at the north pole, which
        // already matches the first row of an equirectangular image.
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.host.classList.remove('is-loading');
        this.draw();
      };
      img.onerror = () => {
        this.host.classList.remove('is-loading');
        this.host.classList.add('is-empty');
        this.empty.innerHTML = ICON + '<span>Panorama could not be loaded</span>';
      };
      img.src = src;
      this.textures.set(src, tex);
      return tex;
    }

    show(i, initial) {
      const room = this.rooms[i];
      if (!room) return;
      this.index = i;
      const has = !!room.src && !!this.gl;
      this.host.classList.toggle('is-empty', !has);
      this.host.classList.toggle('is-loading', has);
      this.empty.innerHTML = this.gl
        ? ICON + '<span>' + (room.label || room.id) + ' 360° view coming soon</span>'
        : ICON + '<span>This browser cannot display 360° views</span>';
      // A flat render can stand in as a dimmed backdrop until the real
      // panorama exists — it is never fed to the sphere, only shown here.
      this.empty.style.backgroundImage = (!has && room.poster) ? 'url("' + room.poster + '")' : '';
      this.empty.classList.toggle('has-poster', !has && !!room.poster);
      if (has) {
        this.tex = this.texture(room.src);
        if (!initial) { this.yaw = (room.heading || 0) * RAD; this.pitch = 0; }
        this.resize();
      }
      this.updateMap();
    }

    // ── Interaction ────────────────────────────────────────────────────
    bindPointer() {
      const host = this.host;
      let px = 0, py = 0, id = null;
      host.addEventListener('pointerdown', (e) => {
        if (this.host.classList.contains('is-empty')) return;
        id = e.pointerId;
        host.setPointerCapture(id);
        this.dragging = true;
        this.vy = 0;
        px = e.clientX; py = e.clientY;
        host.classList.add('is-grabbing');
      });
      host.addEventListener('pointermove', (e) => {
        if (!this.dragging || e.pointerId !== id) return;
        const k = (this.fov * RAD) / host.clientHeight;
        const dx = (e.clientX - px) * k, dy = (e.clientY - py) * k;
        px = e.clientX; py = e.clientY;
        this.yaw -= dx;
        this.pitch = clamp(this.pitch - dy, -85 * RAD, 85 * RAD);
        this.vy = reduce ? 0 : -dx;
        this.draw();
        this.updateMap();
      });
      const end = (e) => {
        if (e.pointerId !== id) return;
        this.dragging = false;
        host.classList.remove('is-grabbing');
        if (Math.abs(this.vy) > 0.001) this.glide();
      };
      host.addEventListener('pointerup', end);
      host.addEventListener('pointercancel', end);
      host.addEventListener('wheel', (e) => {
        if (this.host.classList.contains('is-empty')) return;
        e.preventDefault();
        this.fov = clamp(this.fov + e.deltaY * 0.05, 40, 100);
        this.draw();
      }, { passive: false });
      host.tabIndex = 0;
      host.addEventListener('keydown', (e) => {
        const step = 4 * RAD;
        if (e.key === 'ArrowLeft') this.yaw += step;
        else if (e.key === 'ArrowRight') this.yaw -= step;
        else if (e.key === 'ArrowUp') this.pitch = clamp(this.pitch + step, -85 * RAD, 85 * RAD);
        else if (e.key === 'ArrowDown') this.pitch = clamp(this.pitch - step, -85 * RAD, 85 * RAD);
        else return;
        e.preventDefault();
        this.draw();
        this.updateMap();
      });
    }

    glide() {
      cancelAnimationFrame(this.raf);
      const step = () => {
        this.vy *= 0.94;
        this.yaw -= this.vy;
        this.draw();
        this.updateMap();
        if (Math.abs(this.vy) > 0.0006) this.raf = requestAnimationFrame(step);
      };
      this.raf = requestAnimationFrame(step);
    }

    // The viewer is built while the tour overlay is still hidden, so the host
    // measures 0x0 at mount. Re-measure on every draw and skip drawing until
    // the overlay is actually on screen.
    ensureSize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(this.host.clientWidth * dpr), h = Math.round(this.host.clientHeight * dpr);
      if (!w || !h) return false;
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w; this.canvas.height = h;
        this.gl.viewport(0, 0, w, h);
      }
      return true;
    }

    resize() {
      if (this.gl) this.draw();
    }

    draw() {
      const gl = this.gl;
      if (!gl || !this.tex || this.host.classList.contains('is-empty')) return;
      if (!this.ensureSize()) return;
      const aspect = this.canvas.width / this.canvas.height || 1;
      const m = mul(perspective(this.fov * RAD, aspect, 0.1, 10), mul(rotX(this.pitch), rotY(this.yaw)));
      gl.clearColor(0.043, 0.082, 0.094, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.uniformMatrix4fv(this.uM, false, new Float32Array(m));
      gl.uniform1f(this.uO, 1);
      gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    }

    // ── Mini plan ──────────────────────────────────────────────────────
    buildMap() {
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('class', 'pano-map-svg');
      this.dots = this.rooms.map((room, i) => {
        const g = document.createElementNS(ns, 'g');
        g.setAttribute('class', 'pano-dot');
        g.setAttribute('transform', 'translate(' + (room.x ?? 50) + ' ' + (room.y ?? 50) + ')');
        g.setAttribute('tabindex', '0');
        g.setAttribute('role', 'button');
        g.setAttribute('aria-label', room.label || room.id);
        const cone = document.createElementNS(ns, 'path');
        cone.setAttribute('class', 'pano-cone');
        cone.setAttribute('d', 'M0 0 L-9 -17 A19 19 0 0 1 9 -17 Z');
        const dot = document.createElementNS(ns, 'circle');
        dot.setAttribute('r', '3.4');
        const label = document.createElementNS(ns, 'text');
        label.setAttribute('y', '9.5');
        label.setAttribute('text-anchor', 'middle');
        label.textContent = (room.label || room.id).toUpperCase();
        g.append(cone, dot, label);
        const go = () => {
          this.show(i);
          const btn = document.querySelector('[data-choice-group="room"] [data-choice="' + room.id + '"]');
          if (btn) btn.click();
        };
        g.addEventListener('click', go);
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
        svg.appendChild(g);
        return { g, cone };
      });
      this.map.appendChild(svg);
    }

    updateMap() {
      if (!this.dots) return;
      this.dots.forEach((d, i) => {
        const on = i === this.index;
        d.g.classList.toggle('is-active', on);
        d.cone.style.display = on ? '' : 'none';
        if (on) d.cone.setAttribute('transform', 'rotate(' + (this.yaw / RAD) + ')');
      });
    }
  }

  const init = () => {
    document.querySelectorAll('[data-pano]').forEach((host) => {
      if (host.dataset.panoReady) return;
      const tag = host.querySelector('[data-pano-config]');
      let config = {};
      try { config = JSON.parse(tag ? tag.textContent : '{}'); } catch (e) { console.warn('pano: bad config', e); }
      if (!config.rooms || !config.rooms.length) return;
      host.dataset.panoReady = '1';
      host.__pano = new Pano(host, config);
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.AnantaPano = { init };
})();
