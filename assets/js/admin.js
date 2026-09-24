/* Ananta Property — admin panel.
   Talks directly to the `admin-api` Supabase Edge Function (service-role
   writes gated by a shared x-admin-token header — see supabase/functions).
   No framework: one form is built from ARRAY_FIELDS schemas below and
   serialized back into the same shape project-render.js reads. */
(() => {
  const SUPABASE_URL = 'https://slunqshpbugvwgliefyo.supabase.co';
  const API = SUPABASE_URL + '/functions/v1/admin-api';
  const TOKEN_KEY = 'ananta_admin_token';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ---- array-field schemas: drives both the row markup and serialization ----
  const ARRAY_FIELDS = {
    stats: { fields: [{ key: 'label', type: 'text', ph: 'LOTS' }, { key: 'value', type: 'text', ph: '120' }] },
    units: { fields: [{ key: 'code', type: 'text', ph: 'A' }, { key: 'name', type: 'text', ph: 'Type A' }, { key: 'area', type: 'text', ph: '248 m2 · 3 bedrooms' }] },
    specs: { fields: [{ key: 'label', type: 'text', ph: 'Master bedroom' }, { key: 'value', type: 'text', ph: '28 m2' }] },
    amenities: { fields: [{ key: 'name', type: 'text', ph: 'Infinity Pool' }, { key: 'image_url', type: 'image' }] },
    gallery: { fields: [{ key: 'image_url', type: 'image' }, { key: 'alt', type: 'text', ph: 'Villa exterior at golden hour' }] },
    pano_rooms: {
      fields: [
        { key: 'id', type: 'text', ph: 'Living' }, { key: 'label', type: 'text', ph: 'Living' },
        { key: 'src', type: 'image', label: 'Panorama' }, { key: 'poster', type: 'image', label: 'Poster' },
        { key: 'x', type: 'number', ph: '50' }, { key: 'y', type: 'number', ph: '50' }, { key: 'heading', type: 'number', ph: '0' },
      ],
    },
    location_points: { fields: [{ key: 'label', type: 'text', ph: 'Beach club' }, { key: 'value', type: 'text', ph: '6 MIN' }] },
  };
  const STRING_ARRAY_FIELDS = ['card_facts'];

  let token = sessionStorage.getItem(TOKEN_KEY) || '';
  let projects = [];
  let currentId = null; // null = unsaved new project
  let arrState = {}; // fieldName -> array of row objects, mutated in place by the UI
  let heroImages = { hero_image: '', card_image: '' };
  let brochureUrl = '';

  // ---------------------------------------------------------------- auth --
  async function apiFetch(path, opts = {}) {
    const headers = Object.assign({ 'x-admin-token': token }, opts.headers || {});
    const res = await fetch(API + path, Object.assign({}, opts, { headers }));
    if (res.status === 401) { signOut(); throw new Error('Session expired'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('Request failed (' + res.status + ')'));
    return data;
  }

  function signOut() {
    token = '';
    sessionStorage.removeItem(TOKEN_KEY);
    $('#app').hidden = true;
    $('#login-screen').hidden = false;
  }

  async function tryToken(candidate) {
    const res = await fetch(API + '/projects', { headers: { 'x-admin-token': candidate } });
    if (!res.ok) return false;
    token = candidate;
    sessionStorage.setItem(TOKEN_KEY, candidate);
    return true;
  }

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#login-token');
    const err = $('#login-error');
    err.hidden = true;
    const ok = await tryToken(input.value.trim());
    if (!ok) { err.hidden = false; return; }
    $('#login-screen').hidden = true;
    $('#app').hidden = false;
    boot();
  });

  $('#logout-btn').addEventListener('click', signOut);

  // -------------------------------------------------------------- image field --
  function imageField(container, key, value, onChange, labelText) {
    const wrap = document.createElement('div');
    wrap.className = 'img-field';
    const inputId = 'img-' + key + '-' + Math.random().toString(36).slice(2, 8);
    wrap.innerHTML =
      '<span>' + (labelText || key.replace(/_/g, ' ')) + '</span>' +
      '<div class="img-preview" data-preview>' + (value ? '<img src="' + escAttr(value) + '" alt="">' : 'No image') + '</div>' +
      '<div class="img-controls">' +
      '<input type="text" data-url value="' + escAttr(value || '') + '" placeholder="Image URL, or upload below">' +
      '<button type="button" class="btn-line" data-pick>UPLOAD</button>' +
      '<button type="button" class="btn-line" data-clear>CLEAR</button>' +
      '<input type="file" accept="image/*" class="img-upload-input" data-file id="' + inputId + '">' +
      '</div><p class="hint" data-status style="margin:0"></p>';
    container.appendChild(wrap);

    const preview = $('[data-preview]', wrap);
    const urlInput = $('[data-url]', wrap);
    const status = $('[data-status]', wrap);
    const fileInput = $('[data-file]', wrap);

    function setValue(v) {
      value = v || '';
      urlInput.value = value;
      preview.innerHTML = value ? '<img src="' + escAttr(value) + '" alt="">' : 'No image';
      onChange(value);
    }

    urlInput.addEventListener('change', () => setValue(urlInput.value.trim()));
    $('[data-pick]', wrap).addEventListener('click', () => fileInput.click());
    $('[data-clear]', wrap).addEventListener('click', () => setValue(''));
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      status.textContent = 'Uploading…';
      try {
        const form = new FormData();
        form.append('file', file);
        form.append('folder', ($('#f-slug').value.trim() || 'misc'));
        const res = await fetch(API + '/upload', { method: 'POST', headers: { 'x-admin-token': token }, body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        setValue(data.url);
        status.textContent = 'Uploaded.';
        setTimeout(() => { status.textContent = ''; }, 2000);
      } catch (err) {
        status.textContent = 'Error: ' + err.message;
      }
      fileInput.value = '';
    });

    return wrap;
  }

  // Non-image file (e.g. a brochure PDF): same upload endpoint, no preview.
  function fileField(container, key, value, onChange, labelText, accept) {
    const wrap = document.createElement('div');
    wrap.className = 'file-field';
    const inputId = 'file-' + key + '-' + Math.random().toString(36).slice(2, 8);
    wrap.innerHTML =
      '<span>' + (labelText || key.replace(/_/g, ' ')) + '</span>' +
      '<div class="file-status" data-status-line>' +
      (value ? '<a href="' + escAttr(value) + '" target="_blank" rel="noopener" data-current-link>Current file &#8599;</a>' : '<span data-current-link>No file uploaded</span>') +
      '</div>' +
      '<div class="img-controls">' +
      '<input type="text" data-url value="' + escAttr(value || '') + '" placeholder="File URL, or upload below">' +
      '<button type="button" class="btn-line" data-pick>UPLOAD</button>' +
      '<button type="button" class="btn-line" data-clear>CLEAR</button>' +
      '<input type="file"' + (accept ? ' accept="' + accept + '"' : '') + ' class="img-upload-input" data-file id="' + inputId + '">' +
      '</div><p class="hint" data-status style="margin:0"></p>';
    container.appendChild(wrap);

    const linkWrap = $('[data-status-line]', wrap);
    const urlInput = $('[data-url]', wrap);
    const status = $('[data-status]', wrap);
    const fileInput = $('[data-file]', wrap);

    function setValue(v) {
      value = v || '';
      urlInput.value = value;
      linkWrap.innerHTML = value
        ? '<a href="' + escAttr(value) + '" target="_blank" rel="noopener">Current file &#8599;</a>'
        : '<span>No file uploaded</span>';
      onChange(value);
    }

    urlInput.addEventListener('change', () => setValue(urlInput.value.trim()));
    $('[data-pick]', wrap).addEventListener('click', () => fileInput.click());
    $('[data-clear]', wrap).addEventListener('click', () => setValue(''));
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      status.textContent = 'Uploading…';
      try {
        const form = new FormData();
        form.append('file', file);
        form.append('folder', ($('#f-slug').value.trim() || 'misc'));
        const res = await fetch(API + '/upload', { method: 'POST', headers: { 'x-admin-token': token }, body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        setValue(data.url);
        status.textContent = 'Uploaded.';
        setTimeout(() => { status.textContent = ''; }, 2000);
      } catch (err) {
        status.textContent = 'Error: ' + err.message;
      }
      fileInput.value = '';
    });

    return wrap;
  }

  function escAttr(s) { return String(s).replace(/"/g, '&quot;'); }

  // -------------------------------------------------------------- array rows --
  function renderArraySection(key) {
    const schema = ARRAY_FIELDS[key];
    const host = $('#arr-' + key);
    host.innerHTML = '';
    const rows = arrState[key] || [];

    if (STRING_ARRAY_FIELDS.includes(key)) {
      rows.forEach((val, i) => {
        const row = document.createElement('div');
        row.className = 'arr-row';
        row.innerHTML =
          '<div class="arr-row-fields"><label class="field"><span>Fact</span>' +
          '<input type="text" data-str value="' + escAttr(val) + '"></label></div>' +
          '<div class="arr-row-actions"><button type="button" data-up>↑</button><button type="button" data-down>↓</button><button type="button" class="rm" data-rm>✕</button></div>';
        $('[data-str]', row).addEventListener('input', (e) => { rows[i] = e.target.value; });
        wireRowActions(row, key, i);
        host.appendChild(row);
      });
      return;
    }

    rows.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'arr-row';
      const fieldsWrap = document.createElement('div');
      fieldsWrap.className = 'arr-row-fields';
      row.appendChild(fieldsWrap);

      schema.fields.forEach((f) => {
        if (f.type === 'image') {
          imageField(fieldsWrap, key + i + f.key, item[f.key] || '', (v) => { item[f.key] = v; }, f.label || f.key);
        } else {
          const label = document.createElement('label');
          label.className = 'field';
          label.innerHTML = '<span>' + f.key.replace(/_/g, ' ') + '</span><input type="' + (f.type === 'number' ? 'number' : 'text') + '" value="' + escAttr(item[f.key] ?? '') + '" placeholder="' + escAttr(f.ph || '') + '">';
          const input = $('input', label);
          input.addEventListener('input', () => { item[f.key] = f.type === 'number' ? Number(input.value || 0) : input.value; });
          fieldsWrap.appendChild(label);
        }
      });

      const actions = document.createElement('div');
      actions.className = 'arr-row-actions';
      actions.innerHTML = '<button type="button" data-up>↑</button><button type="button" data-down>↓</button><button type="button" class="rm" data-rm>✕</button>';
      row.appendChild(actions);
      wireRowActions(row, key, i);
      host.appendChild(row);
    });
  }

  function wireRowActions(row, key, i) {
    $('[data-rm]', row).addEventListener('click', () => { arrState[key].splice(i, 1); renderArraySection(key); });
    $('[data-up]', row).addEventListener('click', () => {
      if (i === 0) return;
      const a = arrState[key]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; renderArraySection(key);
    });
    $('[data-down]', row).addEventListener('click', () => {
      const a = arrState[key];
      if (i === a.length - 1) return;
      [a[i + 1], a[i]] = [a[i], a[i + 1]]; renderArraySection(key);
    });
  }

  function defaultRow(key) {
    if (STRING_ARRAY_FIELDS.includes(key)) return '';
    const row = {};
    ARRAY_FIELDS[key].fields.forEach((f) => { row[f.key] = f.type === 'number' ? 0 : ''; });
    return row;
  }

  $$('[data-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.add;
      arrState[key] = arrState[key] || [];
      arrState[key].push(defaultRow(key));
      renderArraySection(key);
    });
  });

  // -------------------------------------------------------------- project list --
  function renderList() {
    const host = $('#project-list');
    host.innerHTML = '';
    projects.forEach((p) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'project-row' + (p.id === currentId ? ' is-active' : '');
      row.innerHTML =
        '<span class="pr-name">' + escHtml(p.name || '(untitled)') + '</span>' +
        '<span class="pr-meta"><span class="pr-badge ' + (p.published ? 'pub' : 'draft') + '">' + (p.published ? 'PUBLISHED' : 'DRAFT') + '</span><span>' + escHtml(p.slug || '') + '</span></span>';
      row.addEventListener('click', () => loadIntoForm(p));
      host.appendChild(row);
    });
  }
  function escHtml(s) { return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

  async function refreshList() {
    const data = await apiFetch('/projects');
    projects = data.projects || [];
    renderList();
  }

  // -------------------------------------------------------------- form <-> data --
  const TEXT_FIELDS = [
    'slug', 'name', 'location_label', 'location_short', 'location_region', 'location_city',
    'tagline', 'intro_eyebrow', 'intro_title', 'intro_body', 'gallery_kicker', 'home_meta', 'home_lede',
  ];

  function blankProject() {
    const p = { category: 'Villa', status: 'Under construction', year: new Date().getFullYear(), sort_order: 0, published: false, featured_home: false, copy: {} };
    TEXT_FIELDS.forEach((k) => { p[k] = ''; });
    Object.keys(ARRAY_FIELDS).forEach((k) => { p[k] = []; });
    STRING_ARRAY_FIELDS.forEach((k) => { p[k] = []; });
    p.hero_image = ''; p.card_image = ''; p.brochure_url = '';
    return p;
  }

  function loadIntoForm(p) {
    currentId = p.id || null;
    $('#empty-state').hidden = true;
    $('#project-form').hidden = false;
    $('#form-title').textContent = p.id ? p.name || '(untitled)' : 'New project';
    $('#save-status').textContent = '';
    $('#save-status').className = 'save-status';
    $('#delete-btn').hidden = !p.id;
    $('#duplicate-btn').hidden = !p.id;

    TEXT_FIELDS.forEach((k) => { $('#f-' + k).value = p[k] || ''; });
    $('#f-category').value = p.category || 'Villa';
    $('#f-status').value = p.status || 'Under construction';
    $('#f-year').value = p.year || '';
    $('#f-sort_order').value = p.sort_order ?? 0;
    $('#f-published').checked = !!p.published;
    $('#f-featured_home').checked = !!p.featured_home;

    const copy = p.copy || {};
    $('#f-copy_units_heading').value = copy.units_heading || '';
    $('#f-copy_tour_cta_label').value = copy.tour_cta_label || '';
    $('#f-copy_download_label').value = copy.download_label || '';
    $('#f-copy_plan_views').value = (copy.plan_views || []).join(', ');

    arrState = {};
    Object.keys(ARRAY_FIELDS).forEach((k) => { arrState[k] = JSON.parse(JSON.stringify(p[k] || [])); renderArraySection(k); });
    STRING_ARRAY_FIELDS.forEach((k) => { arrState[k] = JSON.parse(JSON.stringify(p[k] || [])); renderArraySection(k); });

    heroImages = { hero_image: p.hero_image || '', card_image: p.card_image || '' };
    const heroHost = $('#img-hero_image');
    heroHost.innerHTML = '';
    imageField(heroHost, 'hero_image', heroImages.hero_image, (v) => { heroImages.hero_image = v; }, 'Hero image');
    imageField(heroHost, 'card_image', heroImages.card_image, (v) => { heroImages.card_image = v; }, 'Card image');

    brochureUrl = p.brochure_url || '';
    const brochureHost = $('#file-brochure_url');
    brochureHost.innerHTML = '';
    fileField(brochureHost, 'brochure_url', brochureUrl, (v) => { brochureUrl = v; }, 'Brochure PDF', 'application/pdf');

    renderList();
  }

  function serializeForm() {
    const out = {};
    TEXT_FIELDS.forEach((k) => { out[k] = $('#f-' + k).value.trim(); });
    out.category = $('#f-category').value;
    out.status = $('#f-status').value;
    out.year = Number($('#f-year').value || 0) || null;
    out.sort_order = Number($('#f-sort_order').value || 0);
    out.published = $('#f-published').checked;
    out.featured_home = $('#f-featured_home').checked;
    out.hero_image = heroImages.hero_image;
    out.card_image = heroImages.card_image;
    out.brochure_url = brochureUrl;

    out.copy = {
      units_heading: $('#f-copy_units_heading').value.trim(),
      tour_cta_label: $('#f-copy_tour_cta_label').value.trim(),
      download_label: $('#f-copy_download_label').value.trim(),
      plan_views: $('#f-copy_plan_views').value.split(',').map((s) => s.trim()).filter(Boolean),
    };

    Object.keys(ARRAY_FIELDS).forEach((k) => { out[k] = arrState[k] || []; });
    STRING_ARRAY_FIELDS.forEach((k) => { out[k] = (arrState[k] || []).filter((s) => s.trim()); });

    return out;
  }

  // -------------------------------------------------------------- save/delete --
  $('#project-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = $('#save-status');
    status.className = 'save-status';
    status.textContent = 'Saving…';
    try {
      const body = serializeForm();
      if (!body.slug || !body.name || !body.category) throw new Error('Slug, name and category are required.');
      let saved;
      if (currentId) {
        saved = (await apiFetch('/projects?id=' + encodeURIComponent(currentId), {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })).project;
      } else {
        saved = (await apiFetch('/projects', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })).project;
      }
      status.className = 'save-status ok';
      status.textContent = 'Saved.';
      await refreshList();
      loadIntoForm(saved);
    } catch (err) {
      status.className = 'save-status err';
      status.textContent = 'Error: ' + err.message;
    }
  });

  $('#delete-btn').addEventListener('click', async () => {
    if (!currentId) return;
    if (!confirm('Delete this project? This cannot be undone.')) return;
    try {
      await apiFetch('/projects?id=' + encodeURIComponent(currentId), { method: 'DELETE' });
      currentId = null;
      $('#project-form').hidden = true;
      $('#empty-state').hidden = false;
      await refreshList();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  });

  $('#duplicate-btn').addEventListener('click', () => {
    const body = serializeForm();
    body.id = null;
    body.slug = body.slug + '-copy';
    body.name = body.name + ' (copy)';
    body.published = false;
    currentId = null;
    loadIntoForm(body);
  });

  $('#new-project-btn').addEventListener('click', () => {
    currentId = null;
    loadIntoForm(blankProject());
  });

  // --------------------------------------------------------------- enquiries --
  let enquiries = [];

  function fmtDate(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function updateBadge() {
    const open = enquiries.filter((e) => !e.handled).length;
    const badge = $('#enq-badge');
    badge.textContent = String(open);
    badge.hidden = open === 0;
  }

  function renderEnquiries() {
    const onlyOpen = $('#enq-only-open').checked;
    const list = enquiries.filter((e) => !onlyOpen || !e.handled);
    const host = $('#enq-list');
    host.innerHTML = '';
    if (!list.length) {
      host.innerHTML = '<p class="hint" style="margin:0">' + (onlyOpen ? 'No unhandled enquiries.' : 'No enquiries yet.') + '</p>';
      return;
    }
    list.forEach((e) => {
      const card = document.createElement('article');
      card.className = 'enq-card' + (e.handled ? ' is-handled' : '');
      const wa = String(e.whatsapp || '').replace(/[^\d]/g, '');
      const tags = [e.project_type, e.project_ref && ('Project: ' + e.project_ref), e.visit_slot && ('Viewing: ' + e.visit_slot)]
        .concat(e.deliverables || []).filter(Boolean);
      card.innerHTML =
        '<div class="enq-head"><span class="enq-name">' + escHtml(e.name) + (e.company ? ' · ' + escHtml(e.company) : '') + '</span>' +
        '<span class="enq-meta">' + escHtml(fmtDate(e.created_at)) + '</span></div>' +
        '<div class="enq-contact"><a href="mailto:' + escAttr(e.email) + '">' + escHtml(e.email) + '</a>' +
        (wa ? '<a href="https://wa.me/' + wa + '" target="_blank" rel="noopener">' + escHtml(e.whatsapp) + ' (WhatsApp)</a>' : '') + '</div>' +
        (tags.length ? '<div class="enq-tags">' + tags.map((t) => '<span>' + escHtml(t) + '</span>').join('') + '</div>' : '') +
        (e.brief ? '<p class="enq-brief">' + escHtml(e.brief) + '</p>' : '') +
        '<div class="enq-actions"><button type="button" class="btn-line btn-sm" data-toggle>' + (e.handled ? 'MARK UNHANDLED' : 'MARK HANDLED') + '</button>' +
        '<button type="button" class="btn-line btn-sm danger" data-del>DELETE</button></div>';
      $('[data-toggle]', card).addEventListener('click', async () => {
        try {
          await apiFetch('/enquiries?id=' + encodeURIComponent(e.id), {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handled: !e.handled }),
          });
          e.handled = !e.handled;
          updateBadge();
          renderEnquiries();
        } catch (err) { $('#enq-status').textContent = 'Error: ' + err.message; }
      });
      $('[data-del]', card).addEventListener('click', async () => {
        if (!confirm('Delete this enquiry permanently?')) return;
        try {
          await apiFetch('/enquiries?id=' + encodeURIComponent(e.id), { method: 'DELETE' });
          enquiries = enquiries.filter((x) => x.id !== e.id);
          updateBadge();
          renderEnquiries();
        } catch (err) { $('#enq-status').textContent = 'Error: ' + err.message; }
      });
      host.appendChild(card);
    });
  }

  async function loadEnquiries() {
    $('#enq-status').textContent = 'Loading…';
    try {
      enquiries = (await apiFetch('/enquiries')).enquiries || [];
      $('#enq-status').textContent = '';
      updateBadge();
      renderEnquiries();
    } catch (err) {
      $('#enq-status').textContent = 'Error: ' + err.message;
    }
  }

  function showView(view) {
    const isEnq = view === 'enquiries';
    $('.admin-shell').classList.toggle('is-enquiries', isEnq);
    $('#enquiries-view').hidden = !isEnq;
    $$('.admin-tab').forEach((t) => {
      const on = t.dataset.view === view;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
    });
    if (isEnq) loadEnquiries();
  }

  $$('.admin-tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));
  $('#enq-only-open').addEventListener('change', renderEnquiries);
  $('#enq-refresh').addEventListener('click', loadEnquiries);

  // -------------------------------------------------------------------- boot --
  async function boot() {
    showView('projects');
    try {
      await refreshList();
    } catch (err) {
      alert('Could not load projects: ' + err.message);
    }
    // Populate the unhandled-count badge without switching views.
    try {
      enquiries = (await apiFetch('/enquiries')).enquiries || [];
      updateBadge();
    } catch { /* badge is best-effort */ }
  }

  if (token) {
    $('#login-screen').hidden = true;
    $('#app').hidden = false;
    boot();
  }
})();
