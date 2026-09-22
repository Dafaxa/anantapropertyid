/* Ananta Property — inner-page interactions.
   Ports the Claude Design logic for Projects, the project detail pages,
   Insights, Article and Contact. Loaded after main.js (reveal + parallax).

   Project data (cards, stats, units, tour rooms, …) now comes from Supabase
   and is injected by project-render.js / projects-index-render.js AFTER
   this script has already run — so every click handler below is bound via
   delegation on `document` rather than on the target elements directly.
   Delegation resolves its target at click time, so it doesn't matter
   whether the button existed when this script loaded or was added a
   moment ago by a fetch that just resolved. The one thing that can't work
   this way is content that depends on *data* being present, not just a
   click — the projects-index hero rotation and filters — so that block is
   exposed as window.AnantaProjectsIndex.init() for projects-index-render.js
   to call once it has built the cards. */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const params = new URLSearchParams(location.search);

  // ── Single-select button groups (delegated) ────────────────────────────
  // <div data-choice-group="name"><button data-choice="value">…</button></div>
  const select = (group, btn) => {
    $$('[data-choice]', group).forEach((b) => {
      const on = b === btn;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    group.dispatchEvent(new CustomEvent('choice', { detail: btn }));
  };
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-choice]');
    const group = btn && btn.closest('[data-choice-group]');
    if (group) select(group, btn);
  });
  const onChoice = (name, fn) => {
    const group = $('[data-choice-group="' + name + '"]');
    if (group) group.addEventListener('choice', (e) => fn(e.detail, group));
    return group;
  };
  const activeChoice = (group) => group && $('[data-choice].is-active', group);

  // ── Full-screen dialogs (360° tour, delegated open) ────────────────────
  const openDialog = (dialog) => {
    const last = document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      const f = $$('button, a[href]', dialog);
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    };
    const close = () => {
      dialog.hidden = true;
      document.body.classList.remove('is-locked');
      document.removeEventListener('keydown', onKey);
      dialog.removeEventListener('click', onClose);
      if (last) last.focus();
    };
    const onClose = (e) => { if (e.target.closest('[data-close]')) close(); };
    dialog.hidden = false;
    document.body.classList.add('is-locked');
    // The 360° viewer measures 0x0 while the overlay is hidden — tell it to
    // re-measure now that it has a size.
    window.dispatchEvent(new Event('resize'));
    document.addEventListener('keydown', onKey);
    dialog.addEventListener('click', onClose);
    const first = $('[data-close]', dialog);
    if (first) first.focus();
  };
  const tour = document.getElementById('tour');
  if (tour) {
    document.addEventListener('click', (e) => { if (e.target.closest('[data-open-tour]')) openDialog(tour); });
    onChoice('room', (btn) => { $('[data-room-name]', tour).textContent = btn.dataset.label; });
  }

  // ── Project detail: unit type tabs ─────────────────────────────────────
  onChoice('unit', (btn) => {
    $$('[data-unit-name]').forEach((el) => { el.textContent = btn.dataset.name; });
    $$('[data-unit-area]').forEach((el) => { el.textContent = btn.dataset.area; });
  });

  // ── Project detail: private-viewing "confirm slot" (delegated) ────────
  document.addEventListener('click', (e) => {
    const confirmBtn = e.target.closest('[data-confirm-slot]');
    if (!confirmBtn) return;
    const day = activeChoice($('[data-choice-group="day"]'));
    const time = activeChoice($('[data-choice-group="time"]'));
    const visit = [day && day.dataset.choice, time && time.dataset.choice].filter(Boolean).join(', ');
    const url = new URL(confirmBtn.getAttribute('href'), location.href);
    if (visit) url.searchParams.set('visit', visit);
    confirmBtn.setAttribute('href', url.pathname.split('/').pop() + url.search);
  });

  // ── Projects index: rotating hero + filters ───────────────────────────
  // Called by projects-index-render.js once it has built the hero layers,
  // "now showing" picks and the project cards from fetched data.
  function initProjectsIndex() {
    const heroLayers = $$('[data-hero-layer]');
    const heroPicks = $$('[data-hero-pick]');
    if (heroLayers.length) {
      let hero = 0;
      let timer = 0;
      const show = (i) => {
        hero = i;
        heroLayers.forEach((l, k) => l.classList.toggle('is-active', k === i));
        heroPicks.forEach((b, k) => {
          b.classList.toggle('is-active', k === i);
          b.setAttribute('aria-pressed', String(k === i));
        });
      };
      heroPicks.forEach((b, k) => b.addEventListener('click', () => { clearInterval(timer); show(k); }));
      if (!reduce) timer = setInterval(() => show((hero + 1) % heroLayers.length), 6000);
    }

    const grid = $('[data-project-grid]');
    if (!grid) return;
    const cards = $$('.p-card', grid);
    const slot = $('.p-slot', grid);
    const loc = $('#f-loc');
    const status = $('#f-status');
    const sort = $('#f-sort');
    const clear = $('[data-clear]');
    const count = $('[data-count]');
    const empty = $('[data-empty]');
    const cats = $('[data-choice-group="category"]');
    const category = () => activeChoice(cats).dataset.choice;

    const apply = () => {
      const c = category();
      const visible = cards.filter((card) => {
        const d = card.dataset;
        const match = (c === 'All' || d.category === c) &&
          (loc.value === 'All' || d.location === loc.value) &&
          (status.value === 'All' || d.status === status.value);
        card.hidden = !match;
        return match;
      });
      const order = [...cards].sort((a, b) =>
        sort.value === 'Name' ? a.dataset.name.localeCompare(b.dataset.name)
          : sort.value === 'Oldest' ? a.dataset.year - b.dataset.year
          : b.dataset.year - a.dataset.year);
      order.forEach((card) => grid.insertBefore(card, slot));
      count.textContent = visible.length === 1 ? '1 PROJECT' : visible.length + ' PROJECTS';
      empty.hidden = visible.length > 0;
      slot.hidden = visible.length === 0;
      clear.hidden = c === 'All' && loc.value === 'All' && status.value === 'All' && sort.value === 'Newest';
    };
    const reset = () => {
      select(cats, $('[data-choice="All"]', cats));
      loc.value = 'All'; status.value = 'All'; sort.value = 'Newest';
      apply();
    };
    cats.addEventListener('choice', apply);
    [loc, status, sort].forEach((s) => s.addEventListener('change', apply));
    $$('[data-reset]').forEach((b) => b.addEventListener('click', reset));

    const wanted = (params.get('type') || '').toLowerCase();
    const pre = $$('[data-choice]', cats).find((b) => b.dataset.choice.toLowerCase() === wanted);
    if (pre) select(cats, pre); else apply();
  }
  window.AnantaProjectsIndex = { init: initProjectsIndex };

  // ── Insights: category filter ─────────────────────────────────────────
  const insights = $('[data-insights]');
  if (insights) {
    const items = $$('.ins-item', insights);
    const featured = $('[data-featured]');
    const count = $('[data-count]');
    const label = $('[data-filter-label]');
    const empty = $('[data-empty]');
    onChoice('topic', (btn) => {
      const topic = btn.dataset.choice;
      const all = topic === 'All';
      const matching = items.filter((it) => all || it.dataset.cat === topic);
      items.forEach((it) => { it.hidden = !matching.includes(it) || (all && it.hasAttribute('data-featured-item')); });
      featured.hidden = !all;
      const n = matching.length;
      count.textContent = n === 1 ? '1 ARTICLE' : n + ' ARTICLES';
      label.textContent = btn.dataset.label;
      empty.hidden = n > 0;
    });
  }

  // ── Article: share links ──────────────────────────────────────────────
  const shareLinkedIn = $('[data-share="linkedin"]');
  if (shareLinkedIn) {
    const url = location.href.split('#')[0];
    const title = document.title;
    shareLinkedIn.href = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url);
    $('[data-share="whatsapp"]').href = 'https://wa.me/?text=' + encodeURIComponent(title + ' ' + url);
    const copy = $('[data-share="copy"]');
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(url); copy.textContent = 'LINK COPIED'; }
      catch { copy.textContent = 'COPY FAILED'; }
      setTimeout(() => { copy.textContent = 'COPY LINK'; }, 2000);
    });
  }

  // ── Contact: enquiry form ─────────────────────────────────────────────
  const form = $('[data-enquiry]');
  if (form) {
    const note = $('[data-note]');
    const brief = $('#c-brief');
    const typeInput = $('input[name="type"]', form);
    const drop = $('.drop', form);
    const fileInput = $('input[type="file"]', form);
    const dropLabel = $('.drop div span:first-child', form);
    const whatsapp = $('[data-whatsapp]');

    onChoice('type', (btn) => { typeInput.value = btn.dataset.choice; });

    // Prefill from project pages: ?project=…&visit=…
    const project = params.get('project');
    if (project && !brief.value) {
      const visit = params.get('visit');
      brief.value = 'Project: ' + project + (visit ? ' — private viewing requested for ' + visit + '.' : '.') + '\n';
    }

    ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, () => drop.classList.add('is-over')));
    ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('is-over')));
    fileInput.addEventListener('change', () => {
      const names = Array.from(fileInput.files).map((f) => f.name);
      dropLabel.textContent = names.length ? names.join(', ') : 'Drop files here or click to upload';
    });

    const summary = () => {
      const v = (id) => ($('#' + id).value || '').trim();
      const deliverables = $$('input[name="deliverables"]:checked', form).map((c) => c.value);
      return [
        'Name: ' + v('c-name'),
        v('c-company') && 'Company: ' + v('c-company'),
        'Email: ' + v('c-email'),
        'WhatsApp: +62 ' + v('c-wa'),
        'Project type: ' + typeInput.value,
        deliverables.length && 'Deliverables: ' + deliverables.join(', '),
        v('c-brief') && '\n' + v('c-brief')
      ].filter(Boolean).join('\n');
    };

    whatsapp.addEventListener('click', () => {
      const name = $('#c-name').value.trim();
      const text = 'Hi Ananta, ' + (name ? 'this is ' + name + '. ' : '') + 'I would like to discuss a ' + typeInput.value.toLowerCase() + ' project.';
      whatsapp.href = 'https://wa.me/6285162863108?text=' + encodeURIComponent(text);
    });

    // Enquiries POST to the Supabase table configured on the <form> element.
    // The publishable key is public by design: row-level security allows
    // inserts only, so nothing can be read back with it.
    const endpoint = form.dataset.endpoint;
    const apiKey = form.dataset.key;
    const submitBtn = form.querySelector('button[type="submit"]');
    const val = (id) => ($('#' + id).value || '').trim();

    const openMailApp = () => {
      const subject = 'Project enquiry — ' + typeInput.value + ' — ' + val('c-name');
      location.href = 'mailto:hello@anantaproperty.com?subject=' +
        encodeURIComponent(subject) + '&body=' + encodeURIComponent(summary());
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const required = $$('[required]', form);
      required.forEach((f) => f.setAttribute('aria-invalid', String(!f.checkValidity())));
      const invalid = required.find((f) => !f.checkValidity());
      if (invalid) {
        note.className = 'form-note is-error';
        note.textContent = 'Please add your name, a valid email and your WhatsApp number.';
        invalid.focus();
        return;
      }

      // Honeypot: real visitors never see or fill this field. Bots that
      // auto-fill every input do — quietly pretend to succeed instead of
      // telling them why, and skip the network request entirely.
      if (val('c-hp')) {
        note.className = 'form-note is-sent';
        note.textContent = 'Thank you — your request has reached our team. We will get back to you soon.';
        form.reset();
        return;
      }

      if (!endpoint || !apiKey) {
        openMailApp();
        note.className = 'form-note is-sent';
        note.textContent = 'Thank you — your email app has opened with your request. We will get back to you soon.';
        return;
      }

      const label = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.textContent = 'SENDING…';
      note.className = 'form-note';
      note.textContent = 'Sending your request…';

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: apiKey,
            Authorization: 'Bearer ' + apiKey,
            Prefer: 'return=minimal'
          },
          body: JSON.stringify({
            name: val('c-name'),
            company: val('c-company') || null,
            email: val('c-email'),
            whatsapp: '+62 ' + val('c-wa'),
            project_type: typeInput.value,
            deliverables: $$('input[name="deliverables"]:checked', form).map((c) => c.value),
            brief: val('c-brief') || null,
            project_ref: params.get('project'),
            visit_slot: params.get('visit'),
            source_page: location.href.slice(0, 300)
          })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);

        note.className = 'form-note is-sent';
        note.textContent = 'Thank you — your request has reached our team. We will get back to you soon.' +
          (fileInput.files.length ? ' Please email your files to hello@anantaproperty.com.' : '');
        form.reset();
        dropLabel.textContent = 'Drop files here or click to upload';
        const types = $('[data-choice-group="type"]');
        const fallbackType = $('[data-choice="Apartment"]', types);
        if (fallbackType) select(types, fallbackType);
        required.forEach((f) => f.removeAttribute('aria-invalid'));
      } catch (err) {
        console.warn('enquiry submit failed', err);
        note.className = 'form-note is-error';
        note.textContent = 'We could not send that automatically — opening your email app instead.';
        openMailApp();
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = label;
      }
    });
  }
})();
