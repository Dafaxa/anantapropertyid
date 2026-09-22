/* Ananta Property — Home page data renderer.
   Patches the existing static content in place (it stays as a fallback if
   the fetch fails) rather than emptying anything out first:
     - .work-grid: top 3 published projects, replacing the 3 cards
     - .feature section + #walkthrough dialog: the featured project
   See project-render.js for why patching existing elements — rather than
   recreating them — is what lets pages.js / pano.js work unmodified. */
(() => {
  const SUPABASE_URL = 'https://slunqshpbugvwgliefyo.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_sXrbQ0YVe492bNBtL0lzRw_MO2oieqL';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
  const q = (sel, root = document) => root.querySelector(sel);

  const PRETTY_SLUGS = { residences: 'residences.html', 'sky-suites': 'sky-suites.html', 'grand-masterplan': 'grand-masterplan.html' };
  const urlFor = (slug) => PRETTY_SLUGS[slug] || ('project.html?slug=' + encodeURIComponent(slug));

  function renderWorkGrid(projects) {
    const grid = q('.work-grid');
    if (!grid || !projects.length) return;
    grid.innerHTML = projects.slice(0, 3).map((p) =>
      `<a class="work-card" href="${esc(urlFor(p.slug))}" data-reveal>` +
      `<div class="media"><img src="${esc(p.card_image || p.hero_image)}" loading="lazy" decoding="async" alt="${esc(p.name)}"></div>` +
      `<div class="work-meta"><div class="work-meta-row"><span class="work-name">${esc(p.name)}</span><span class="work-arrow" aria-hidden="true">→</span></div>` +
      `<div class="work-meta-row"><span class="work-tag">${esc((p.category || '').toUpperCase())} · ${esc(p.location_city)}</span><span class="work-tag">${esc(p.year)}</span></div></div></a>`
    ).join('');
  }

  function renderFeature(p) {
    const detailUrl = urlFor(p.slug);
    q('.feature .px-layer[data-px] img').setAttribute('src', p.hero_image || '');
    q('#feature-title').textContent = p.name;
    q('.feature-meta').textContent = p.home_meta || p.location_label || '';
    q('.feature-lede').textContent = p.home_lede || p.intro_body || '';
    q('.feature-main .btn-line-light').setAttribute('href', detailUrl);

    const rows = (p.stats || []).slice(0, 3);
    q('.feature-aside dl').innerHTML = rows.map((s) =>
      `<div class="glance-row"><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('');
  }

  function renderWalkthrough(p) {
    const dialog = document.getElementById('walkthrough');
    if (!dialog) return;
    const rooms = p.pano_rooms || [];

    q('#try-title', dialog).textContent = 'TRY THE WALKTHROUGH · ' + (p.name || '').toUpperCase();
    q('.try-tabs', dialog).innerHTML = rooms.map((r, i) =>
      `<button type="button" class="try-tab${i === 0 ? ' is-active' : ''}" data-room-tab ` +
      `data-label="${esc(r.label)}" aria-pressed="${i === 0}">${esc((r.label || r.id || '').toUpperCase())}</button>`
    ).join('');
    q('.try-cta', dialog).setAttribute('href', urlFor(p.slug));

    const config = { rooms: rooms.map((r) => ({
      id: r.id, label: r.label, src: r.src || '', poster: r.poster || '',
      x: r.x ?? 50, y: r.y ?? 50, heading: r.heading ?? 0,
    })) };
    q('[data-pano-config]', dialog).textContent = JSON.stringify(config);
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
      console.error('home-render: fetch failed', err);
    }
    if (!projects.length) return; // keep the static fallback content as-is

    renderWorkGrid(projects);

    const featured = projects.find((p) => p.featured_home) || projects[0];
    renderFeature(featured);
    renderWalkthrough(featured);

    window.AnantaWalkthrough && window.AnantaWalkthrough.init();
    window.AnantaPano && window.AnantaPano.init();
    window.AnantaReveal && window.AnantaReveal.rescan();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
