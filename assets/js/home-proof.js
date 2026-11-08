/* Ananta Property — homepage social proof (stats, testimonials, client logos).
   Reads public.social_proof_items (published rows only; edited under "Social
   proof" in the admin panel). The section stays hidden unless there is
   something to show, so nothing is ever claimed that was not added there. */
(() => {
  const SUPABASE_URL = 'https://slunqshpbugvwgliefyo.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_sXrbQ0YVe492bNBtL0lzRw_MO2oieqL';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function boot() {
    const section = document.getElementById('proof');
    if (!section) return;
    let rows = [];
    try {
      const res = await fetch(SUPABASE_URL + '/rest/v1/social_proof_items?published=eq.true&select=*&order=sort_order.asc',
        { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } });
      rows = res.ok ? await res.json() : [];
    } catch { /* stays hidden */ }
    if (!rows.length) return;

    const of = (k) => rows.filter((r) => r.kind === k);
    const stats = of('stat');
    const quotes = of('testimonial');
    const clients = of('client');

    const sEl = section.querySelector('[data-proof-stats]');
    sEl.innerHTML = stats.map((s) =>
      '<div class="proof-stat" data-reveal><dt>' + esc(s.title) + '</dt><dd>' + esc(s.value) + '</dd>' +
      (s.subtitle ? '<small>' + esc(s.subtitle) + '</small>' : '') + '</div>').join('');
    sEl.hidden = !stats.length;

    const qEl = section.querySelector('[data-proof-quotes]');
    qEl.innerHTML = quotes.map((t) =>
      '<figure class="proof-quote" data-reveal><blockquote><p>' + esc(t.body) + '</p></blockquote><figcaption>' +
      (t.image_url ? '<img src="' + esc(t.image_url) + '" alt="" loading="lazy" decoding="async">' : '') +
      '<cite><b>' + esc(t.title) + '</b>' + (t.subtitle ? '<span>' + esc(t.subtitle) + '</span>' : '') + '</cite></figcaption></figure>').join('');
    qEl.hidden = !quotes.length;

    const cEl = section.querySelector('[data-proof-clients]');
    cEl.innerHTML = clients.length
      ? '<p class="eyebrow">SELECTED CLIENTS</p><div class="proof-logos">' + clients.map((c) => c.image_url
        ? '<img src="' + esc(c.image_url) + '" alt="' + esc(c.title) + '" loading="lazy" decoding="async">'
        : '<span class="proof-client-name">' + esc(c.title.toUpperCase()) + '</span>').join('') + '</div>'
      : '';
    cEl.hidden = !clients.length;

    section.hidden = false;
    window.AnantaReveal && window.AnantaReveal.rescan();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
