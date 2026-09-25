/* Ananta Property — package pages: "Selected work" portfolio + floating CTA.
   The portfolio reads published projects from the CMS (same public,
   RLS-protected table the rest of the site uses), so it follows whatever is
   published in the admin panel. Projects whose category matches the page's
   data-prefer list are shown first. If the fetch fails or nothing is
   published, the whole section hides itself. */
(() => {
  const SUPABASE_URL = 'https://slunqshpbugvwgliefyo.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_sXrbQ0YVe492bNBtL0lzRw_MO2oieqL';
  const PRETTY = { residences: 'residences.html', 'sky-suites': 'sky-suites.html', 'grand-masterplan': 'grand-masterplan.html' };
  const urlFor = (slug) => PRETTY[slug] || ('project.html?slug=' + encodeURIComponent(slug));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function card(p) {
    const facts = (p.card_facts || []).slice(0, 2);
    const launching = p.status === 'Launching';
    return `<a class="p-card" href="${esc(urlFor(p.slug))}" data-reveal>` +
      `<div class="media"><img src="${esc(p.card_image || p.hero_image)}" loading="lazy" decoding="async" alt="${esc(p.name)}">` +
      `<span class="p-tag cat">${esc((p.category || '').toUpperCase())}</span>` +
      `<span class="p-tag status${launching ? ' is-launching' : ''}">${esc((p.status || '').toUpperCase())}</span></div>` +
      `<div class="p-body"><div class="p-title"><span>${esc(p.name)}</span><span>${esc(p.year)}</span></div>` +
      `<p class="p-loc">${esc(p.location_city)}</p>` +
      `<div class="p-facts">${facts.map((f) => `<span>${esc(f)}</span>`).join('')}</div>` +
      `<div class="p-foot"><span>VIEW PROJECT</span><span aria-hidden="true">&#10230;</span></div></div></a>`;
  }

  async function portfolio() {
    const grid = document.querySelector('[data-portfolio]');
    if (!grid) return;
    const section = grid.closest('section');
    const hide = () => { if (section) section.style.display = 'none'; };
    let rows = [];
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/projects?published=eq.true&select=*&order=sort_order.asc`,
        { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } });
      rows = res.ok ? await res.json() : [];
    } catch { /* section hides below */ }
    if (!rows.length) return hide();

    const prefer = (grid.dataset.prefer || '').split(',').map((s) => s.trim()).filter(Boolean);
    const rank = (p) => { const i = prefer.indexOf(p.category); return i === -1 ? prefer.length : i; };
    rows.sort((a, b) => rank(a) - rank(b));
    grid.innerHTML = rows.slice(0, 6).map(card).join('');
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
