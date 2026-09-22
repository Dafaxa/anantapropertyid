/* Ananta Property — Projects index renderer.
   Fetches published projects and builds the rotating hero, the "now
   showing" picks and the project-card grid, then hands off to
   pages.js (filtering/hero rotation) and main.js (parallax/reveal). */
(() => {
  const SUPABASE_URL = 'https://slunqshpbugvwgliefyo.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_sXrbQ0YVe492bNBtL0lzRw_MO2oieqL';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  // The three original projects keep their pretty filenames (already
  // linked from elsewhere on the site); anything created later in the
  // admin panel gets project.html?slug=… instead.
  const PRETTY_SLUGS = { residences: 'residences.html', 'sky-suites': 'sky-suites.html', 'grand-masterplan': 'grand-masterplan.html' };
  const urlFor = (slug) => PRETTY_SLUGS[slug] || ('project.html?slug=' + encodeURIComponent(slug));

  function heroSection(projects) {
    const shown = projects.slice(0, 5);
    document.querySelector('.hero-layers').innerHTML = shown.map((p, i) =>
      `<div class="px-layer${i === 0 ? ' is-active' : ''}" data-px="0.24" data-hero-layer>` +
      `<img src="${esc(p.card_image || p.hero_image)}" alt="" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></div>`
    ).join('');

    const showing = document.querySelector('.showing');
    showing.innerHTML = '<p>NOW SHOWING</p>' + shown.map((p, i) =>
      `<button type="button" class="showing-item${i === 0 ? ' is-active' : ''}" data-hero-pick aria-pressed="${i === 0}">` +
      `<span class="n">${String(i + 1).padStart(2, '0')}</span>` +
      `<span class="t"><span class="name">${esc(p.name)}</span><span class="meta">${esc((p.category || '').toUpperCase())} · ${esc(p.location_city)}</span></span>` +
      `</button>`
    ).join('') + '<a class="text-link" href="#index">BROWSE ALL &#8595;</a>';
  }

  function card(p) {
    const isLaunching = p.status === 'Launching';
    const facts = (p.card_facts && p.card_facts.length ? p.card_facts : []).slice(0, 2);
    return `<a class="p-card" href="${esc(urlFor(p.slug))}" data-reveal ` +
      `data-category="${esc(p.category)}" data-location="${esc(p.location_short)}" data-status="${esc(p.status)}" ` +
      `data-year="${esc(p.year)}" data-name="${esc(p.name)}">` +
      `<div class="media"><img src="${esc(p.card_image || p.hero_image)}" loading="lazy" decoding="async" alt="${esc(p.name)}">` +
      `<span class="p-tag cat">${esc((p.category || '').toUpperCase())}</span>` +
      `<span class="p-tag status${isLaunching ? ' is-launching' : ''}">${esc((p.status || '').toUpperCase())}</span></div>` +
      `<div class="p-body"><div class="p-title"><span>${esc(p.name)}</span><span>${esc(p.year)}</span></div>` +
      `<p class="p-loc">${esc(p.location_city)}</p>` +
      `<div class="p-facts">${facts.map((f) => `<span>${esc(f)}</span>`).join('')}</div>` +
      `<div class="p-foot"><span>VIEW PROJECT</span><span aria-hidden="true">&#10230;</span></div></div></a>`;
  }

  async function boot() {
    let projects = [];
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/projects?published=eq.true&select=*&order=sort_order.asc`,
        { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } },
      );
      projects = res.ok ? await res.json() : [];
    } catch (err) {
      console.error('projects-index-render: fetch failed', err);
    }

    heroSection(projects);

    const grid = document.querySelector('[data-project-grid]');
    const slot = grid.querySelector('.p-slot');
    // Full replace, not insert: the shell's grid holds only the "Your
    // project here" slot statically, so a second boot() (there won't be
    // one, but insertAdjacentHTML would silently duplicate if there were)
    // can't leave stray old cards behind.
    grid.querySelectorAll('.p-card').forEach((el) => el.remove());
    slot.insertAdjacentHTML('beforebegin', projects.map(card).join(''));

    document.querySelector('[data-choice-group="category"] [data-choice="All"]').textContent = 'ALL ' + String(projects.length).padStart(2, '0');

    window.AnantaProjectsIndex && window.AnantaProjectsIndex.init();
    window.AnantaParallax && window.AnantaParallax.rescan();
    window.AnantaReveal && window.AnantaReveal.rescan();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
