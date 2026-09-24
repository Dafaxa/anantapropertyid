/* Ananta Property — project detail renderer.
   Used by residences.html, sky-suites.html, grand-masterplan.html (each
   carries <meta name="project-slug" content="…">) and by the generic
   project.html (reads ?slug=… instead), which any project created in the
   admin panel without one of those three fixed filenames links to.

   Fetches one row from the public "projects" table (anon/publishable key —
   safe to expose; RLS only allows reading published rows) and fills the
   page's static shell (every section already exists in the HTML; this
   script only ever replaces innerHTML/textContent on existing elements —
   it never recreates a container), then hands off to pages.js / pano.js
   for the interactive bits (unit tabs, tour dialog, 360° viewer). Those
   scripts use event delegation, so they work on content filled in after
   they load — see the comment at the top of pages.js. */
(() => {
  const SUPABASE_URL = 'https://slunqshpbugvwgliefyo.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_sXrbQ0YVe492bNBtL0lzRw_MO2oieqL';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
  const encQ = (name) => encodeURIComponent(name || '');
  const q = (sel, root = document) => root.querySelector(sel);
  const qa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const PLACEHOLDER_ICON =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/>' +
    '<circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
  const PLAN_ICON =
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/>' +
    '<path d="M3 9h18M9 21V9"/></svg>';
  const MAP_ICON =
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/>' +
    '<path d="M9 3v15M15 6v15"/></svg>';

  function media(url, alt, placeholderLabel) {
    return url
      ? `<img src="${esc(url)}" loading="lazy" decoding="async" alt="${esc(alt || '')}">`
      : `<div class="placeholder">${PLACEHOLDER_ICON}<span>${esc(placeholderLabel || 'Image to come')}</span></div>`;
  }

  function renderHero(p) {
    q('.pdp-hero .fill').innerHTML = `<img src="${esc(p.hero_image)}" alt="" fetchpriority="high" decoding="async">`;
    q('.pdp-kicker').textContent = p.location_label || '';
    q('.pdp-title').textContent = p.name;
    q('.pdp-tagline').textContent = p.tagline || '';
    qa('[aria-label^="Enquire about"]').forEach((el) => el.setAttribute('aria-label', 'Enquire about ' + p.name));
  }

  function renderStats(p) {
    q('.pdp-stats').innerHTML = (p.stats || [])
      .map((s) => `<dl class="pdp-stat"><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></dl>`).join('');
  }

  function renderIntro(p) {
    q('.pdp-intro .eyebrow').textContent = p.intro_eyebrow || 'THE PROJECT';
    q('.pdp-intro h2').innerHTML = esc(p.intro_title || '').replace(/\n/g, '<br>');
    q('.pdp-intro > p').textContent = p.intro_body || '';
  }

  function renderUnits(p) {
    const copy = p.copy || {};
    const units = p.units || [];
    q('#units-title').textContent = copy.units_heading || 'Unit types & floorplans';
    q('.tabs[data-choice-group="unit"]').innerHTML = units.map((u, i) => {
      const active = i === 0;
      return `<button type="button" class="tab${active ? ' is-active' : ''}" data-choice="${esc(u.code)}" ` +
        `data-name="${esc(u.name)}" data-area="${esc(u.area)}" aria-pressed="${active}">${esc((u.code || '').toUpperCase())}</button>`;
    }).join('');

    const views = (copy.plan_views && copy.plan_views.length) ? copy.plan_views : ['GROUND', 'UPPER', 'ROOF'];
    q('.plan-views').innerHTML = views.map((v, i) =>
      `<span${i === 0 ? ' style="background:var(--ink);border-color:var(--ink);color:var(--ivory)"' : ''}>${esc(v)}</span>`).join('');

    const first = units[0] || { name: '', area: '' };
    q('.unit-name [data-unit-name]').textContent = first.name;
    q('.unit-name [data-unit-area]').textContent = first.area;
    q('.unit-specs').innerHTML = (p.specs || [])
      .map((s) => `<div class="spec-row"><span>${esc(s.label)}</span><span>${esc(s.value)}</span></div>`).join('');
    q('.unit-detail .btn-ink').textContent = copy.tour_cta_label || 'WALK THIS VILLA IN 360°';
    applyUnit(p, units[0]);
  }

  // Floorplan image and plan PDF follow the selected unit type.
  function applyUnit(p, u) {
    const copy = p.copy || {};
    q('.plan-frame').innerHTML = u && u.floorplan_image
      ? `<img src="${esc(u.floorplan_image)}" alt="${esc((u.name || '') + ' floorplan')}" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:contain;background:#fff">`
      : `<div class="placeholder">${PLAN_ICON}<span>Floorplan drawing to come</span></div>`;
    const dl = q('.unit-detail .btn-line-ink');
    if (u && u.plan_pdf) {
      dl.textContent = copy.download_label || 'DOWNLOAD PLAN PDF';
      dl.setAttribute('href', u.plan_pdf);
      dl.setAttribute('target', '_blank');
      dl.setAttribute('rel', 'noopener');
    } else {
      dl.textContent = 'REQUEST PLAN PDF';
      dl.setAttribute('href', 'contact.html?project=' + encQ(p.name));
      dl.removeAttribute('target');
      dl.removeAttribute('rel');
    }
  }

  function renderAmenities(p) {
    q('.amenities').innerHTML = (p.amenities || []).map((a) =>
      `<div class="amenity"><div class="media">${media(a.image_url, a.name, 'Render to come')}</div><p>${esc((a.name || '').toUpperCase())}</p></div>`
    ).join('');
  }

  function renderLocation(p) {
    q('#location-title + p').textContent = p.location_region || '';
    const openLink = p.map_url ? `<a class="map-open" href="${esc(p.map_url)}" target="_blank" rel="noopener">OPEN IN MAPS &#8599;</a>` : '';
    q('.map-frame').innerHTML = (p.map_image
      ? `<img src="${esc(p.map_image)}" alt="Map of ${esc(p.name)}" loading="lazy" decoding="async">`
      : `<div class="placeholder">${MAP_ICON}<span>Location map to come</span></div>`) + openLink;
    q('.location-points').innerHTML = (p.location_points || [])
      .map((l) => `<div class="spec-row"><span>${esc(l.label)}</span><span>${esc(l.value)}</span></div>`).join('');
  }

  function renderGallery(p) {
    q('#gallery-title + p').textContent = p.gallery_kicker || '';
    q('.gallery-grid').innerHTML = (p.gallery || []).map((g) =>
      `<div class="media">${media(g.image_url, g.alt, g.alt || 'Image to come')}</div>`).join('');
  }

  function renderEnquiryLinks(p) {
    const confirmLink = q('.enquiry-card [data-confirm-slot]');
    if (confirmLink) confirmLink.setAttribute('href', 'contact.html?project=' + encQ(p.name));

    const wa = q('.enquiry-card a[href^="https://wa.me"]');
    if (wa) {
      wa.setAttribute('href', wa.getAttribute('href').split('?')[0] + '?text=' + encodeURIComponent('Hi Ananta, I would like to know more about ' + p.name + '.'));
    }

    const brochureLink = q('.enquiry-card [data-brochure-link]');
    if (brochureLink) {
      if (p.brochure_url) {
        brochureLink.textContent = 'DOWNLOAD BROCHURE';
        brochureLink.setAttribute('href', p.brochure_url);
        brochureLink.setAttribute('target', '_blank');
        brochureLink.setAttribute('rel', 'noopener');
      } else {
        brochureLink.textContent = 'REQUEST BROCHURE';
        brochureLink.setAttribute('href', 'contact.html?project=' + encQ(p.name));
        brochureLink.removeAttribute('target');
        brochureLink.removeAttribute('rel');
      }
    }
  }

  function renderTour(p) {
    const rooms = p.pano_rooms || [];
    const first = rooms[0] || { id: '', label: '' };
    q('.tour-viewing [data-unit-name]').textContent = (p.units && p.units[0] && p.units[0].name) || '';
    q('.tour-viewing [data-room-name]').textContent = first.label || first.id || '';

    const config = { rooms: rooms.map((r) => ({
      id: r.id, label: r.label, src: r.src || '', poster: r.poster || '',
      x: r.x ?? 50, y: r.y ?? 50, heading: r.heading ?? 0,
    })) };
    q('[data-pano-config]').textContent = JSON.stringify(config);

    q('.tour-rooms').innerHTML = rooms.map((r, i) =>
      `<button type="button" class="tour-room${i === 0 ? ' is-active' : ''}" data-choice="${esc(r.id)}" ` +
      `data-label="${esc(r.label)}" aria-pressed="${i === 0}">${esc((r.label || r.id || '').toUpperCase())}</button>`
    ).join('');
  }

  function renderJsonLd(p) {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'Residence',
      name: p.name,
      description: p.intro_body || p.tagline || '',
      url: location.href.split('?')[0] + (p.slug ? '?slug=' + encodeURIComponent(p.slug) : ''),
      image: p.hero_image ? [p.hero_image] : undefined,
      address: p.location_city || p.location_region || undefined,
    };
    let tag = q('script[type="application/ld+json"]');
    if (!tag) {
      tag = document.createElement('script');
      tag.type = 'application/ld+json';
      document.head.appendChild(tag);
    }
    tag.textContent = JSON.stringify(data);
  }

  function notFound() {
    const main = q('main');
    main.innerHTML =
      '<section style="padding:clamp(80px,10vw,140px) var(--pad-x);text-align:center;display:flex;flex-direction:column;gap:16px;align-items:center">' +
      '<h1 style="font:500 clamp(26px,3vw,38px)/1.2 var(--serif)">Project not found</h1>' +
      '<p style="font:300 13px/1.7 var(--sans);color:var(--slate)">It may have been unpublished or the link is out of date.</p>' +
      '<a class="btn btn-ink" href="projects.html">SEE ALL PROJECTS</a></section>';
    const subnav = q('.subnav');
    if (subnav) subnav.style.display = 'none';
    const tour = document.getElementById('tour');
    if (tour) tour.remove();
  }

  async function boot() {
    const slug = q('meta[name="project-slug"]')?.content || new URLSearchParams(location.search).get('slug');
    if (!slug) return notFound();

    let p;
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/projects?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } },
      );
      const rows = res.ok ? await res.json() : [];
      p = rows[0];
    } catch (err) {
      console.error('project-render: fetch failed', err);
    }
    if (!p) return notFound();

    document.title = `${p.name} — Ananta Property`;
    const metaDesc = q('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', p.intro_body ? p.intro_body.slice(0, 155) : p.name);

    renderHero(p);
    renderStats(p);
    renderIntro(p);
    renderUnits(p);
    renderAmenities(p);
    renderLocation(p);
    renderGallery(p);
    renderEnquiryLinks(p);
    renderTour(p);
    renderJsonLd(p);

    document.addEventListener('click', (e) => {
      const tab = e.target.closest('.tabs[data-choice-group="unit"] .tab');
      if (!tab) return;
      const idx = Array.from(tab.parentElement.children).indexOf(tab);
      applyUnit(p, (p.units || [])[idx]);
    });

    q('main').classList.remove('is-loading');
    window.AnantaPano && window.AnantaPano.init();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
