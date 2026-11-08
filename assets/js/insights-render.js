/* Ananta Property — Insights renderers.
   - Insights list (insights.html): featured article + all published articles.
   - Article page (article.html, ?slug=…): header, body, TOC, next reads, SEO.
   Both read the public `articles` table (RLS: published rows only). If the
   fetch fails or nothing is published, the static HTML already on the page is
   left exactly as it is. */
(() => {
  const SUPABASE_URL = 'https://slunqshpbugvwgliefyo.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_sXrbQ0YVe492bNBtL0lzRw_MO2oieqL';
  const HEADERS = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY };
  const CAT_LABEL = { Developer: 'DEVELOPER MARKETING', Visualization: 'VISUALIZATION', Immersive: 'IMMERSIVE TECH', Market: 'MARKET NOTES' };

  const q = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^(https?:\/\/|mailto:|\/|[a-z0-9._-]+\.html|assets\/)/i.test(u) ? u : '#');
  const catLabel = (a) => CAT_LABEL[a.category] || String(a.category || '').toUpperCase();
  const words = (t) => (String(t || '').match(/\S+/g) || []).length;
  const minutes = (a) => a.read_minutes || Math.max(1, Math.round(words(a.body) / 200));
  const longDate = (d) => { const x = new Date(d); return isNaN(x) ? '' : x.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase(); };
  const href = (a) => 'article.html?slug=' + encodeURIComponent(a.slug);

  async function fetchArticles(extra = '') {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/articles?published=eq.true&select=*&order=published_at.desc,created_at.desc${extra}`, { headers: HEADERS });
      return res.ok ? await res.json() : [];
    } catch { return []; }
  }

  // ---- body markup -> safe HTML -------------------------------------------
  function inline(s) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => `<a class="u-link" href="${safeUrl(url.replace(/&amp;/g, '&')).replace(/&/g, '&amp;')}">${text}</a>`);
  }

  function renderBody(text) {
    const toc = [];
    let n = 0;
    const html = String(text || '').replace(/\r\n/g, '\n').split(/\n{2,}/).map((raw) => {
      const block = raw.trim();
      if (!block) return '';
      if (/^## /.test(block)) {
        n += 1;
        const label = block.replace(/^##\s+/, '').split('\n')[0];
        toc.push({ id: 'sec-' + String(n).padStart(2, '0'), label });
        return `<h2 id="sec-${String(n).padStart(2, '0')}">${inline(label)}</h2>`;
      }
      const img = block.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
      if (img) {
        return `<figure class="art-figure"><div class="media"><img src="${esc(safeUrl(img[2]))}" loading="lazy" decoding="async" alt="${esc(img[1])}"></div>` +
          (img[1] ? `<figcaption>${esc(img[1])}</figcaption>` : '') + '</figure>';
      }
      if (/^\[box\]/i.test(block)) {
        const lines = block.split('\n');
        const title = lines[0].replace(/^\[box\]\s*/i, '');
        const items = lines.slice(1).filter((l) => /^[-*]\s+/.test(l)).map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ''))}</li>`);
        return `<div class="art-box"><h3>${esc(title.toUpperCase())}</h3><ol>${items.join('')}</ol></div>`;
      }
      if (/^>\s?/.test(block)) {
        return `<blockquote class="art-quote"><p>${inline(block.split('\n').map((l) => l.replace(/^>\s?/, '')).join(' '))}</p></blockquote>`;
      }
      const lines = block.split('\n');
      if (lines.every((l) => /^[-*]\s+/.test(l))) {
        return `<ul class="pkg-list">${lines.map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`;
      }
      return `<p>${inline(lines.join(' '))}</p>`;
    }).join('\n');
    return { html, toc };
  }

  function setHead(selector, tag, attrs) {
    let el = q(selector);
    if (!el) { el = document.createElement(tag); document.head.appendChild(el); }
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  }

  // ---- Insights list --------------------------------------------------------
  async function renderList() {
    const rows = await fetchArticles();
    if (!rows.length) return;
    const featured = rows.find((a) => a.featured) || rows[0];
    const thumb = (a) => a.thumb_image || a.hero_image;

    const feat = q('[data-featured]');
    if (feat) {
      const img = thumb(featured);
      q('.media', feat).setAttribute('href', href(featured));
      q('.media', feat).innerHTML = img
        ? `<img src="${esc(img)}" loading="lazy" decoding="async" alt="${esc(featured.hero_alt || featured.title)}">`
        : '<div class="placeholder"><span>Image to come</span></div>';
      q('.meta-row span', feat).textContent = `${catLabel(featured)} · ${minutes(featured)} MIN`;
      q('h2', feat).textContent = featured.title;
      q('.featured-text > p:not(.meta-row)', feat).textContent = featured.excerpt || '';
      q('.btn', feat).setAttribute('href', href(featured));
    }

    const list = q('.ins-list');
    list.querySelectorAll('.ins-item').forEach((el) => el.remove());
    const empty = q('[data-empty]', list);
    const itemHtml = rows.map((a) => {
      const isFeat = a === featured;
      const img = thumb(a);
      return `<a class="ins-item" href="${esc(href(a))}" data-cat="${esc(a.category)}"${isFeat ? ' data-featured-item hidden' : ''}>` +
        `<div class="media">${img ? `<img src="${esc(img)}" loading="lazy" decoding="async" alt="${esc(a.hero_alt || a.title)}">` : '<div class="placeholder"><span>Image to come</span></div>'}</div>` +
        `<div class="ins-item-text"><span>${esc(catLabel(a))} · ${minutes(a)} MIN</span><span>${esc(a.title)}</span><span>${esc(a.excerpt || '')}</span></div>` +
        '<span class="ins-arrow" aria-hidden="true">&#10230;</span></a>';
    }).join('');
    empty.insertAdjacentHTML('beforebegin', itemHtml);
    const count = q('[data-count]');
    if (count) count.textContent = rows.length === 1 ? '1 ARTICLE' : rows.length + ' ARTICLES';
  }

  // ---- Article page ----------------------------------------------------------
  async function renderArticle() {
    const slug = new URLSearchParams(location.search).get('slug');
    let rows = slug ? await fetchArticles(`&slug=eq.${encodeURIComponent(slug)}&limit=1`) : [];
    let article = rows[0];
    let all = null;
    if (!article && !slug) { // bare article.html: show the featured / newest published article
      all = await fetchArticles();
      article = all.find((a) => a.featured) || all[0];
    }
    if (!article) return; // keep the static copy (also covers unknown slugs on a failed fetch)

    q('.art-cat').textContent = catLabel(article);
    q('.art-meta').textContent = `${minutes(article)} MIN READ · ${longDate(article.published_at)}`;
    q('.art-title').textContent = article.title;
    q('.art-lede').textContent = article.excerpt || '';
    const initials = (article.author || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'AP';
    q('.byline .avatar').textContent = initials;
    const bySpans = document.querySelectorAll('.byline div span');
    if (bySpans[0]) bySpans[0].textContent = article.author || '';
    if (bySpans[1]) bySpans[1].textContent = article.author_role || '';

    const hero = q('.art-hero');
    if (article.hero_image) {
      hero.hidden = false;
      hero.innerHTML = `<img src="${esc(article.hero_image)}" loading="eager" decoding="async" alt="${esc(article.hero_alt || article.title)}">`;
    } else {
      hero.hidden = true;
    }

    const { html, toc } = renderBody(article.body);
    const tags = (article.tags || []).map((t) => `<span>${esc(t)}</span>`).join('');
    q('.art-body').innerHTML = html +
      `<div class="art-foot"><div class="art-tags">${tags}</div><a class="u-link" href="insights.html">&#8592; BACK TO INSIGHTS</a></div>`;

    const tocBlock = q('.toc') && q('.toc').closest('.aside-block');
    if (toc.length) {
      q('.toc').innerHTML = toc.map((t) => `<a href="#${t.id}">${esc(t.label)}</a>`).join('');
      if (tocBlock) tocBlock.hidden = false;
    } else if (tocBlock) {
      tocBlock.hidden = true;
    }

    if (!all) all = await fetchArticles();
    const others = all.filter((a) => a.id !== article.id).slice(0, 2);
    const nextBlock = q('.next-read') && q('.next-read').closest('.aside-block');
    if (nextBlock) {
      nextBlock.querySelectorAll('.next-read').forEach((el) => el.remove());
      nextBlock.insertAdjacentHTML('beforeend', others.map((a) =>
        `<a class="next-read" href="${esc(href(a))}"><span>${esc(catLabel(a))} · ${minutes(a)} MIN</span><span>${esc(a.title)}</span></a>`).join(''));
      nextBlock.hidden = !others.length;
    }

    // SEO + sharing
    const url = location.origin + '/' + href(article);
    const img = article.hero_image || article.thumb_image;
    const imgAbs = img ? new URL(img, location.href).href : '';
    document.title = `${article.title} — Ananta Property`;
    const desc = (article.excerpt || '').slice(0, 160);
    setHead('meta[name="description"]', 'meta', { name: 'description', content: desc });
    setHead('link[rel="canonical"]', 'link', { rel: 'canonical', href: url });
    const og = { 'og:type': 'article', 'og:site_name': 'Ananta Property', 'og:title': article.title, 'og:description': desc, 'og:url': url };
    if (imgAbs) og['og:image'] = imgAbs;
    Object.entries(og).forEach(([k, v]) => setHead(`meta[property="${k}"]`, 'meta', { property: k, content: v }));
    const tw = { 'twitter:card': 'summary_large_image', 'twitter:title': article.title, 'twitter:description': desc };
    if (imgAbs) tw['twitter:image'] = imgAbs;
    Object.entries(tw).forEach(([k, v]) => setHead(`meta[name="${k}"]`, 'meta', { name: k, content: v }));
    let ld = q('script[type="application/ld+json"]');
    if (!ld) { ld = document.createElement('script'); ld.type = 'application/ld+json'; document.head.appendChild(ld); }
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'Article', headline: article.title, description: desc,
      datePublished: article.published_at, author: { '@type': 'Organization', name: article.author || 'Ananta Property' },
      publisher: { '@type': 'Organization', name: 'Ananta Property' }, mainEntityOfPage: url, image: imgAbs ? [imgAbs] : undefined,
    });
    // pages.js builds share links from location/title on load; refresh the title-based one
    const wa = q('[data-share="whatsapp"]');
    if (wa) wa.href = 'https://wa.me/?text=' + encodeURIComponent(document.title + ' ' + url);
    window.AnantaReveal && window.AnantaReveal.rescan();
  }

  const start = () => {
    if (q('[data-insights]')) renderList();
    if (q('.art-body')) renderArticle();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
