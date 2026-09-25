/* Ananta Property — package pages: standalone "Selected work" + floating CTA.
   The work shown here is its own list (public.portfolio_items, one set per
   package, edited under "Package portfolio" in the admin panel) and is
   separate from the Projects list. The section, and its sub-nav link, hide
   themselves when a package has no published work or the fetch fails. */
(() => {
  const SUPABASE_URL = 'https://slunqshpbugvwgliefyo.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_sXrbQ0YVe492bNBtL0lzRw_MO2oieqL';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function card(it) {
    const linked = !!it.link_url;
    const tag = it.tag ? `<span class="p-tag cat">${esc(it.tag.toUpperCase())}</span>` : '';
    const media = it.image_url
      ? `<img src="${esc(it.image_url)}" loading="lazy" decoding="async" alt="${esc(it.title)}">`
      : '<div class="placeholder"><span>Image to come</span></div>';
    const body =
      `<div class="media">${media}${tag}</div>` +
      `<div class="p-body"><div class="p-title"><span>${esc(it.title)}</span><span>${esc(it.year || '')}</span></div>` +
      (it.subtitle ? `<p class="p-loc">${esc(it.subtitle)}</p>` : '') +
      (it.description ? `<p class="p-desc">${esc(it.description)}</p>` : '') +
      (linked ? '<div class="p-foot"><span>VIEW WORK</span><span aria-hidden="true">&#10230;</span></div>' : '') +
      '</div>';
    return linked
      ? `<a class="p-card" href="${esc(it.link_url)}" target="_blank" rel="noopener" data-reveal>${body}</a>`
      : `<article class="p-card" data-reveal>${body}</article>`;
  }

  async function portfolio() {
    const grid = document.querySelector('[data-portfolio]');
    if (!grid) return;
    const section = grid.closest('section');
    const hide = () => {
      if (section) section.style.display = 'none';
      const link = document.querySelector('.subnav nav a[href="#portfolio"]');
      if (link) link.remove();
    };
    let rows = [];
    try {
      const pkg = encodeURIComponent(grid.dataset.package || '');
      const res = await fetch(`${SUPABASE_URL}/rest/v1/portfolio_items?published=eq.true&package=eq.${pkg}&select=*&order=sort_order.asc`,
        { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } });
      rows = res.ok ? await res.json() : [];
    } catch { /* section hides below */ }
    if (!rows.length) return hide();

    grid.innerHTML = rows.slice(0, 9).map(card).join('');
    window.AnantaReveal && window.AnantaReveal.rescan();
  }

  // Floating CTA: appears once the hero has scrolled away, hides again over
  // the closing CTA band so it never sits on top of a second identical button.
  function floatingCta() {
    const hero = document.querySelector('.pdp-hero');
    const main = hero && hero.querySelector('.btn-gold');
    if (!hero || !main) return;
    const bar = document.createElement('a');
    bar.className = 'pkg-float';
    bar.href = main.getAttribute('href');
    bar.textContent = main.textContent.trim();
    bar.setAttribute('aria-hidden', 'true');
    bar.tabIndex = -1;
    document.body.appendChild(bar);

    let heroOut = false, bandIn = false;
    const sync = () => {
      const show = heroOut && !bandIn;
      bar.classList.toggle('is-on', show);
      bar.setAttribute('aria-hidden', String(!show));
      bar.tabIndex = show ? 0 : -1;
    };
    new IntersectionObserver(([e]) => { heroOut = !e.isIntersecting; sync(); }).observe(hero);
    const band = document.querySelector('.cta-band');
    if (band) new IntersectionObserver(([e]) => { bandIn = e.isIntersecting; sync(); }).observe(band);
  }


  const start = () => { portfolio(); floatingCta(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
