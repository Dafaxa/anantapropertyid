// Dynamic sitemap: the fixed pages plus every published project from the CMS,
// so a project added in the admin panel is listed without touching this file.
const SITE = 'https://anantaproperty.id';
const SUPABASE_URL = 'https://slunqshpbugvwgliefyo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_sXrbQ0YVe492bNBtL0lzRw_MO2oieqL'; // public by design (RLS: published rows only)

const PRETTY = { residences: 'residences.html', 'sky-suites': 'sky-suites.html', 'grand-masterplan': 'grand-masterplan.html' };
const STATIC = [
  ['', 'weekly', '1.0'], ['projects.html', 'weekly', '0.9'],
  ['package-brand-visual.html', 'monthly', '0.7'], ['package-launch.html', 'monthly', '0.7'],
  ['package-luxury-launch.html', 'monthly', '0.7'], ['package-experience.html', 'monthly', '0.7'],
  ['package-destination.html', 'monthly', '0.7'], ['insights.html', 'weekly', '0.6'],
  ['article.html', 'monthly', '0.5'], ['contact.html', 'monthly', '0.6'],
];
const xml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
const entry = (path, freq, prio, last) =>
  `  <url><loc>${xml(SITE + '/' + path)}</loc><lastmod>${last}</lastmod><changefreq>${freq}</changefreq><priority>${prio}</priority></url>`;

module.exports = async (req, res) => {
  let projects = [];
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/projects?published=eq.true&select=slug,updated_at&order=sort_order.asc`,
      { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } });
    if (r.ok) projects = await r.json();
  } catch { /* fall back to the fixed pages only */ }

  const today = day();
  const urls = STATIC.map(([p, f, pr]) => entry(p, f, pr, today))
    .concat(projects.map((p) => entry(PRETTY[p.slug] || 'project.html?slug=' + encodeURIComponent(p.slug), 'weekly', '0.8', day(p.updated_at))));

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
};
