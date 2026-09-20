/* Ananta Property — page-leave fade for browsers that lack native
   cross-document view transitions (see "Page transitions" in styles.css).
   Chromium and Safari return early and let the browser animate. */
(() => {
  if (window.CSSViewTransitionRule) return;

  const root = document.documentElement;
  const LEAVE_MS = 260;
  const norm = (p) => p.replace(/index\.html$/, '');

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;

    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    // Same page (in-page anchors, "back to top"): let the browser scroll.
    if (norm(url.pathname) === norm(location.pathname) && url.search === location.search) return;

    e.preventDefault();
    root.classList.add('is-leaving');
    setTimeout(() => { location.href = url.href; }, LEAVE_MS);
    // If the navigation never happens, don't leave the page faded out.
    setTimeout(() => root.classList.remove('is-leaving'), 2500);
  });

  // Coming back from the back/forward cache: the old fade-out must not stick.
  window.addEventListener('pageshow', (e) => { if (e.persisted) root.classList.remove('is-leaving'); });
})();
