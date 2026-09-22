/* Ananta Property — home page interactions.
   Ports the behaviour of the Claude Design logic class: module viewer with
   20s auto-advance, walkthrough preview, staggered reveal, parallax and hero fade. */
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = (n) => String(n).padStart(2, '0');
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ── Digital Sales Gallery: module viewer ──────────────────────────────
  const gallery = document.querySelector('[data-gallery]');
  if (gallery) {
    const slides = $$('[data-slide]', gallery);
    const tabs = $$('[data-module]', gallery);
    const nameEl = gallery.querySelector('[data-active-name]');
    const counterEl = gallery.querySelector('[data-counter]');
    const badge = gallery.querySelector('[data-badge]');
    let active = 0;
    let timer = 0;

    const show = (i) => {
      active = (i + slides.length) % slides.length;
      slides.forEach((s, k) => {
        s.classList.toggle('is-active', k === active);
        s.setAttribute('aria-hidden', String(k !== active));
      });
      tabs.forEach((t, k) => {
        t.classList.toggle('is-active', k === active);
        t.setAttribute('aria-pressed', String(k === active));
      });
      nameEl.textContent = tabs[active].dataset.name;
      counterEl.textContent = pad(active + 1) + ' / ' + pad(slides.length);
      badge.hidden = !tabs[active].hasAttribute('data-badge');
    };
    const cycle = () => {
      clearInterval(timer);
      if (!reduce) timer = setInterval(() => show(active + 1), 20000);
    };
    const go = (i) => { show(i); cycle(); };

    tabs.forEach((t, k) => t.addEventListener('click', () => go(k)));
    gallery.querySelector('[data-prev]').addEventListener('click', () => go(active - 1));
    gallery.querySelector('[data-next]').addEventListener('click', () => go(active + 1));
    show(0);
    cycle();
  }

  // ── Walkthrough preview (full-screen dialog) ───────────────────────────
  // The dialog's room tabs and pano config are filled in by home-render.js
  // from the featured project's data, which arrives after an async fetch —
  // so unlike the gallery above, this doesn't run itself. home-render.js
  // calls window.AnantaWalkthrough.init() once the dialog's content is
  // actually in the DOM. Safe to call even if #walkthrough doesn't exist
  // (e.g. on pages other than Home) or the fetch never resolves.
  function initWalkthrough() {
    const dialog = document.getElementById('walkthrough');
    if (!dialog) return;
    const roomTabs = $$('[data-room-tab]', dialog);
    if (!roomTabs.length) return;
    const nameEl = dialog.querySelector('[data-room-name]');
    const counterEl = dialog.querySelector('[data-room-counter]');
    const closeBtn = dialog.querySelector('[data-close]');
    let room = 0;
    let lastFocus = null;

    const setRoom = (i) => {
      room = i;
      roomTabs.forEach((t, k) => {
        t.classList.toggle('is-active', k === room);
        t.setAttribute('aria-pressed', String(k === room));
      });
      nameEl.textContent = roomTabs[room].dataset.label;
      counterEl.textContent = pad(room + 1) + ' / ' + pad(roomTabs.length);
      const pano = dialog.querySelector('[data-pano]');
      if (pano && pano.__pano) pano.__pano.show(room);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      const focusable = $$('button, a[href]', dialog);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    const open = () => {
      lastFocus = document.activeElement;
      dialog.hidden = false;
      document.body.classList.add('is-locked');
      document.addEventListener('keydown', onKey);
      closeBtn.focus();
    };
    const close = () => {
      dialog.hidden = true;
      document.body.classList.remove('is-locked');
      document.removeEventListener('keydown', onKey);
      if (lastFocus) lastFocus.focus();
    };

    $$('[data-open-walkthrough]').forEach((b) => b.addEventListener('click', open));
    closeBtn.addEventListener('click', close);
    roomTabs.forEach((t, k) => t.addEventListener('click', () => setRoom(k)));
    setRoom(0);
  }
  window.AnantaWalkthrough = { init: initWalkthrough };

  // ── Mobile nav: hamburger toggle ───────────────────────────────────────
  const navToggle = document.querySelector('.nav-toggle');
  const siteNav = document.querySelector('.site-nav');
  if (navToggle && siteNav) {
    const closeNav = () => {
      siteNav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    };
    navToggle.addEventListener('click', () => {
      const open = siteNav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
    siteNav.addEventListener('click', (e) => { if (e.target.tagName === 'A') closeNav(); });
    window.addEventListener('resize', () => { if (window.innerWidth > 820) closeNav(); });
  }

  if (reduce) return;

  // ── Staggered reveal on entry ────────────────────────────────────────
  // rescan() lets a render script (home-render.js, projects-index-render.js)
  // arm elements it just inserted — observe() is a no-op on an
  // already-observed target, and the "armed" flag below skips elements a
  // second call would otherwise re-animate.
  if ('IntersectionObserver' in window && Element.prototype.animate) {
    document.documentElement.classList.add('js-motion');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const sibs = Array.from(el.parentElement.children).filter((c) => c.hasAttribute('data-reveal'));
        const delay = Math.min(Math.max(0, sibs.indexOf(el)) * 85, 420);
        el.classList.add('is-in');
        el.animate(
          [{ opacity: 0, transform: 'translateY(28px)' }, { opacity: 1, transform: 'none' }],
          { duration: 900, delay, easing: 'cubic-bezier(.22,.72,.2,1)', fill: 'backwards' }
        );
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    const arm = (el) => {
      if (el.dataset.revealArmed) return;
      el.dataset.revealArmed = '1';
      io.observe(el);
    };
    $$('[data-reveal]').forEach(arm);
    window.AnantaReveal = { rescan: () => $$('[data-reveal]').forEach(arm) };
  }

  // ── Parallax layers, hero fade and scroll cue ────────────────────────
  // rescan() re-queries [data-px] so layers added after this script ran
  // (the projects-index hero rotation) get the scroll-linked transform too.
  let layers = $$('[data-px]');
  const hero = document.querySelector('[data-hero-fade]');
  const cue = document.querySelector('[data-cue]');
  let raf = 0;

  const tick = () => {
    raf = 0;
    const vh = window.innerHeight || 800;
    layers.forEach((el) => {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -240 || r.top > vh + 240) return;
      const speed = parseFloat(el.dataset.px) || 0.2;
      const centered = (r.top + r.height / 2 - vh / 2) / vh;
      el.style.transform = 'translate3d(0,' + (-centered * speed * 120).toFixed(2) + 'px,0)';
    });
    const y = window.pageYOffset || 0;
    if (hero) {
      const p = Math.min(1, y / (vh * 0.85));
      hero.style.opacity = String(1 - p * 0.92);
      hero.style.transform = 'translate3d(0,' + (y * 0.14).toFixed(1) + 'px,0)';
    }
    if (cue) {
      cue.style.opacity = String(Math.max(0, 1 - y / 200));
      cue.style.pointerEvents = y > 160 ? 'none' : 'auto';
    }
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  window.AnantaParallax = { rescan: () => { layers = $$('[data-px]'); tick(); } };
  tick();
})();
