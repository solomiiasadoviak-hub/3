/* Formica admin panel: leads, projects, videos, team, settings, estimator rates. */
(function () {
  const main = document.getElementById('main');
  const statusEl = document.getElementById('status');
  let content = null, dirty = false, tab = 'leads', curProject = 0;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const setStatus = (s) => { statusEl.textContent = s; };
  const markDirty = () => { dirty = true; setStatus('Unsaved changes'); };
  const T = () => ({ en: '', ru: '' });

  // ---------- path binding: data-k="projects.0.title.en" ----------
  function get(path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), content); }
  function set(path, val) {
    const ks = path.split('.'); const last = ks.pop();
    const o = ks.reduce((o, k) => (o[k] == null ? (o[k] = {}) : o[k]), content);
    o[last] = val;
  }
  function input(path, label, type = 'text', extra = '') {
    const v = get(path);
    if (type === 'textarea') return `<label>${label}<textarea data-k="${path}" ${extra}>${esc(v)}</textarea></label>`;
    if (type === 'checkbox') return `<label class="check"><input type="checkbox" data-k="${path}" ${v ? 'checked' : ''}> ${label}</label>`;
    return `<label>${label}<input type="${type}" data-k="${path}" value="${esc(v)}" ${extra}></label>`;
  }
  function select(path, label, options) {
    const v = get(path);
    return `<label>${label}<select data-k="${path}">${options.map(o => { const [val, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${val === v ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select></label>`;
  }
  function media(path, label) {
    return `<label>${label}<div class="upl"><input type="text" data-k="${path}" value="${esc(get(path))}"><button type="button" class="btn sm" data-upload="${path}">Upload</button></div></label>`;
  }
  function bi(path, label, type = 'text') { // bilingual pair
    if (!get(path) || typeof get(path) !== 'object') set(path, T());
    return input(path + '.en', label + ' (EN)', type) + input(path + '.ru', label + ' (RU)', type);
  }
  main.addEventListener('input', e => {
    const el = e.target.closest('[data-k]'); if (!el) return;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'number') v = el.value === '' ? '' : Number(el.value);
    set(el.dataset.k, v); markDirty();
    if (el.dataset.rerender) render();
  });
  main.addEventListener('change', e => { if (e.target.matches('select[data-k], input[type=checkbox][data-k]')) render(); });

  // ---------- uploads ----------
  async function upload(file) {
    setStatus(`Uploading ${file.name}…`);
    const r = await fetch('/api/admin/upload', { method: 'POST', headers: { 'X-Filename': encodeURIComponent(file.name) }, body: file });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || 'Upload failed');
    setStatus('Uploaded'); return d.url;
  }
  function pickFile(accept) {
    return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept || 'image/*,video/*'; i.multiple = true; i.onchange = () => res([...i.files]); i.click(); });
  }
  main.addEventListener('click', async e => {
    const b = e.target.closest('[data-upload]'); if (!b) return;
    const [f] = await pickFile(); if (!f) return;
    try { set(b.dataset.upload, await upload(f)); markDirty(); render(); } catch (er) { alert(er.message); }
  });

  // ---------- save ----------
  document.getElementById('save').addEventListener('click', async () => {
    setStatus('Saving…');
    const r = await fetch('/api/admin/content', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(content) });
    const d = await r.json().catch(() => ({}));
    if (d.ok) { dirty = false; setStatus('Saved ✓'); } else setStatus('Error: ' + (d.error || r.status));
  });
  addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- tabs ----------
  document.getElementById('tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    tab = b.dataset.tab; document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b)); render();
  });

  function render() {
    const y = scrollY;
    ({ leads: renderLeads, projects: renderProjects, videos: renderVideos, team: renderTeam, settings: renderSettings, estimator: renderEstimator, texts: renderTexts, design: renderDesign })[tab]();
    scrollTo(0, y);
  }

  // ---------- leads ----------
  let leads = [];
  async function renderLeads() {
    main.innerHTML = '<p>Loading…</p>';
    leads = await fetch('/api/admin/leads').then(r => r.json());
    const fmt = n => Number(n || 0).toLocaleString('en');
    main.innerHTML = `<div style="display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
      <b>${leads.length} leads</b><span class="spacer"></span>
      <a class="btn" href="/api/admin/leads.csv">Download CSV (Excel)</a></div>
      <div style="overflow-x:auto"><table><thead><tr><th>Date</th><th>Form</th><th>Name</th><th>Phone</th><th>Request</th><th>Estimate</th><th>Source</th><th>Delivery</th><th>Status</th></tr></thead><tbody>
      ${leads.map(l => `<tr>
        <td>${new Date(l.createdAt).toLocaleString()}</td>
        <td><span class="badge">${esc(l.formType)}</span><br><small>${esc(l.lang)}</small></td>
        <td>${esc(l.name)}${l.email ? `<br><small>${esc(l.email)}</small>` : ''}</td>
        <td>${l.phone ? `<a href="https://wa.me/${esc(l.phone.replace(/\D/g, ''))}" target="_blank">${esc(l.phone)}</a>` : '—'}<br>${l.phoneStatus === 'needs_check' ? '<span class="badge warn">check number</span>' : ''}</td>
        <td class="detail">${esc([l.service, l.propertyType, l.area && l.area + ' m²', l.community, l.start, l.project && 'Project: ' + l.project, l.message].filter(Boolean).join('\n'))}</td>
        <td>${l.estimate && l.estimate.total ? `AED ${fmt(l.estimate.total.min)}–${fmt(l.estimate.total.max)}` : '—'}</td>
        <td class="detail">${esc([l.source && l.source.utm_source, l.source && l.source.utm_campaign, l.source && l.source.page].filter(Boolean).join('\n'))}</td>
        <td>${l.delivery ? Object.entries(l.delivery).map(([k, v]) => `<span class="badge ${v.ok ? 'ok' : 'warn'}">${k}</span>`).join(' ') : '<small>stored</small>'}</td>
        <td><select data-lead="${l.id}">${['new', 'contacted', 'meeting', 'proposal', 'won', 'lost', 'spam'].map(s => `<option ${l.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
      </tr>`).join('')}</tbody></table></div>`;
    main.querySelectorAll('[data-lead]').forEach(s => s.addEventListener('change', async () => {
      await fetch('/api/admin/lead-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.dataset.lead, status: s.value }) });
      setStatus('Lead status updated');
    }));
  }

  // ---------- projects ----------
  const CATS = [['full', 'Full Renovation'], ['rental', 'Rental-Ready Renovation'], ['commercial', 'Commercial Fit-Out']];
  const TYPES = ['apartment', 'villa', 'townhouse', 'office', 'retail', 'salon', 'restaurant'];
  function mediaRows(listPath) {
    const list = get(listPath) || [];
    return `${list.map((g, i) => `<div class="row">
        <img src="${esc(g.src)}" alt="" onerror="this.style.visibility='hidden'">
        <div class="upl"><input type="text" data-k="${listPath}.${i}.src" value="${esc(g.src)}" placeholder="Image URL"><button type="button" class="btn sm" data-upload="${listPath}.${i}.src">Upload</button></div>
        <input type="text" data-k="${listPath}.${i}.caption.en" value="${esc(g.caption && g.caption.en)}" placeholder="Caption EN (e.g. Living room)">
        <input type="text" data-k="${listPath}.${i}.caption.ru" value="${esc(g.caption && g.caption.ru)}" placeholder="Подпись RU (напр. Гостиная)">
        <div class="actions"><button type="button" class="btn sm" data-move="${listPath}|${i}|-1">↑</button><button type="button" class="btn sm" data-move="${listPath}|${i}|1">↓</button><button type="button" class="btn sm danger" data-del="${listPath}|${i}">✕</button></div>
      </div>`).join('')}
      <div class="actions" style="margin-top:8px"><button type="button" class="btn sm" data-addrow="${listPath}">+ Add by URL</button><button type="button" class="btn sm" data-addfiles="${listPath}">+ Upload photos</button></div>`;
  }
  main.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.move) {
      const [p, i, d] = b.dataset.move.split('|'); const arr = get(p); const j = Number(i) + Number(d);
      if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; markDirty(); render();
    } else if (b.dataset.del) {
      const [p, i] = b.dataset.del.split('|'); get(p).splice(Number(i), 1); markDirty(); render();
    } else if (b.dataset.addrow) {
      if (!get(b.dataset.addrow)) set(b.dataset.addrow, []);
      get(b.dataset.addrow).push({ src: '', caption: T() }); markDirty(); render();
    } else if (b.dataset.addfiles) {
      const files = await pickFile('image/*');
      if (!get(b.dataset.addfiles)) set(b.dataset.addfiles, []);
      for (const f of files) { try { get(b.dataset.addfiles).push({ src: await upload(f), caption: T() }); } catch (er) { alert(er.message); } }
      markDirty(); render();
    }
  });

  function renderProjects() {
    const ps = content.projects;
    ps.sort((a, b) => (a.order || 0) - (b.order || 0));
    if (curProject >= ps.length) curProject = 0;
    const p = ps[curProject];
    const base = `projects.${curProject}`;
    main.innerHTML = `<div class="layout">
      <div class="list">
        <button class="btn primary" id="add-project">+ New project</button>
        <button class="btn" id="load-real">⤓ Загрузить проекты с formicadxb.com</button>
        <button class="btn" id="copy-images">Скопировать фото на свой сервер</button>
        ${ps.map((x, i) => `<div class="item${i === curProject ? ' on' : ''}" data-pi="${i}"><img src="${esc(x.cover)}" alt="" onerror="this.style.visibility='hidden'"><span>${esc((x.title && x.title.en) || x.slug)}<br><small style="color:var(--muted)">${x.category} · ${x.type}${x.featured ? ' · ★' : ''}</small></span>
          <button class="btn sm" data-porder="${i}|-1" title="Move up">↑</button><button class="btn sm" data-porder="${i}|1" title="Move down">↓</button></div>`).join('')}
        <p class="hint">Order here = order on the site. ★ = shown first in the portfolio block.</p>
      </div>
      ${p ? `<div class="panel">
        <div class="grid">
          ${input(base + '.slug', 'URL slug (latin, dashes)')}
          ${select(base + '.category', 'Category', CATS)}
          ${select(base + '.type', 'Property type', TYPES)}
          ${input(base + '.area', 'Area, m²', 'number')}
        </div>
        <div style="margin-top:12px">${input(base + '.featured', 'Show on the home page first (featured)', 'checkbox')}</div>
        <h2>Main</h2>
        <div class="grid">${bi(base + '.title', 'Title')}${bi(base + '.location', 'Location')}${bi(base + '.scope', 'Scope (short)')}</div>
        <div style="margin-top:12px">${media(base + '.cover', 'Cover image')}</div>
        <h2>Project page texts</h2>
        <div class="grid">${bi(base + '.brief', "Client's brief", 'textarea')}${bi(base + '.works', 'Scope of works', 'textarea')}${bi(base + '.involvement', "Client's involvement", 'textarea')}${bi(base + '.features', 'Project highlights', 'textarea')}</div>
        <h2>Gallery (with room captions)</h2>${mediaRows(base + '.gallery')}
        <h2>Before</h2>${mediaRows(base + '.before')}
        <h2>After</h2>${mediaRows(base + '.after')}
        <p class="hint">Before/After photos are shown in pairs: Before #1 next to After #1, etc.</p>
        <div style="margin-top:22px;display:flex;gap:8px"><a class="btn" target="_blank" href="/project/${esc(p.slug)}">Preview page</a><span class="spacer"></span><button class="btn danger" id="del-project">Delete project</button></div>
      </div>` : '<p>No projects yet.</p>'}
    </div>`;
    main.querySelectorAll('[data-pi]').forEach(el => el.addEventListener('click', e => { if (e.target.closest('button')) return; curProject = Number(el.dataset.pi); render(); }));
    main.querySelectorAll('[data-porder]').forEach(el => el.addEventListener('click', () => {
      const [i, d] = el.dataset.porder.split('|').map(Number); const j = i + d; if (j < 0 || j >= ps.length) return;
      [ps[i], ps[j]] = [ps[j], ps[i]]; ps.forEach((x, k) => { x.order = k + 1; }); if (curProject === i) curProject = j; markDirty(); render();
    }));
    document.getElementById('load-real').onclick = async () => {
      if (!confirm('Заменить все проекты на 21 реальный проект Formica (фото и данные с formicadxb.com)? Текущие проекты будут удалены.')) return;
      const real = await fetch('/data/formica-projects.json').then(r => r.json());
      content.projects = real;
      const bys = Object.fromEntries(real.map(x => [x.slug, x]));
      const isDemo = u => !u || /unsplash\.com/.test(u);
      const hero = content.settings.hero || (content.settings.hero = {});
      const villa = bys.albarari && bys.albarari.gallery[0] && bys.albarari.gallery[0].src;
      if (villa && isDemo(hero.image)) hero.image = villa;
      if (villa && isDemo(hero.imageMobile)) hero.imageMobile = villa;
      const picks = ['lasirena', 'albarari', 'beachfront', 'fields', 'office', 'forte', 'citywalk', 'burjroyal'];
      const suf = { completed: [' — walkthrough', ' — обзор'], process: [' — work in progress', ' — процесс работ'], beforeafter: [' — before & after', ' — до и после'] };
      (content.videos || []).forEach((v, i) => {
        if (!isDemo(v.cover) && bys[v.project]) return;
        const pr = bys[picks[i % picks.length]]; if (!pr) return;
        v.project = pr.slug; v.cover = (pr.gallery[1] || pr.gallery[0]).src;
        const sf = suf[v.category] || suf.completed; v.title = { en: pr.title.en + sf[0], ru: pr.title.ru + sf[1] };
      });
      curProject = 0; markDirty(); render();
      setStatus('Загружено ' + real.length + ' проектов — нажмите Save changes');
    };
    document.getElementById('copy-images').onclick = async () => {
      if (dirty) { alert('Сначала нажмите Save changes, потом копируйте фото.'); return; }
      if (!confirm('Скачать все фото со старого сайта (Tilda) на ваш сервер? Это займёт 1–3 минуты. Нужен подключённый Volume /data, иначе фото пропадут при обновлении.')) return;
      setStatus('Копирую фото… не закрывайте страницу');
      const r = await fetch('/api/admin/import-images', { method: 'POST' }).then(x => x.json()).catch(() => ({}));
      if (!r.ok) { setStatus('Ошибка копирования'); return; }
      content = await fetch('/api/content').then(x => x.json()); render();
      setStatus(`Скопировано ${r.copied} из ${r.total} фото` + (r.failed ? `, не удалось: ${r.failed}` : ''));
    };
    document.getElementById('add-project').onclick = () => {
      ps.push({ slug: 'new-project-' + Date.now().toString(36), category: 'full', type: 'apartment', featured: false, order: ps.length + 1, title: { en: 'New project', ru: 'Новый проект' }, location: T(), area: 100, scope: T(), brief: T(), works: T(), involvement: T(), features: T(), cover: '', gallery: [], before: [], after: [] });
      curProject = ps.length - 1; markDirty(); render();
    };
    const del = document.getElementById('del-project');
    if (del) del.onclick = () => { if (confirm('Delete this project?')) { ps.splice(curProject, 1); curProject = 0; markDirty(); render(); } };
  }

  // ---------- videos ----------
  function renderVideos() {
    const vs = content.videos;
    vs.sort((a, b) => (a.order || 0) - (b.order || 0));
    const projOpts = [['', '— none —'], ...content.projects.map(p => [p.slug, (p.title && p.title.en) || p.slug])];
    main.innerHTML = `<p class="hint" style="margin-bottom:14px">Video source can be: an uploaded MP4 (best quality and speed — compress to ~1080p, H.264), a YouTube / Vimeo link, or an Instagram Reel link (opens the Instagram player). Each video has its own cover. Videos never start with sound.</p>
      <button class="btn primary" id="add-video">+ New video</button>
      ${vs.map((v, i) => `<div class="panel" style="margin-top:14px">
        <div class="grid">
          ${bi(`videos.${i}.title`, 'Title')}
          ${select(`videos.${i}.category`, 'Category', [['completed', 'Completed projects'], ['process', 'Work in progress'], ['beforeafter', 'Before / After']])}
          ${select(`videos.${i}.project`, 'Linked project', projOpts)}
        </div>
        <div class="grid" style="margin-top:12px">${media(`videos.${i}.src`, 'Video (MP4 upload or YouTube/Instagram URL)')}${media(`videos.${i}.cover`, 'Cover image')}</div>
        <div style="display:flex;gap:16px;align-items:center;margin-top:12px;flex-wrap:wrap">
          ${input(`videos.${i}.featured`, 'Show on home page', 'checkbox')}
          <span class="spacer"></span>
          <button class="btn sm" data-vorder="${i}|-1">↑</button><button class="btn sm" data-vorder="${i}|1">↓</button>
          <button class="btn sm danger" data-vdel="${i}">Delete</button>
        </div></div>`).join('')}`;
    document.getElementById('add-video').onclick = () => { vs.unshift({ id: 'v' + Date.now().toString(36), category: 'completed', featured: true, order: 0, title: T(), src: '', cover: '', project: '' }); vs.forEach((x, k) => { x.order = k + 1; }); markDirty(); render(); };
    main.querySelectorAll('[data-vorder]').forEach(el => el.onclick = () => {
      const [i, d] = el.dataset.vorder.split('|').map(Number); const j = i + d; if (j < 0 || j >= vs.length) return;
      [vs[i], vs[j]] = [vs[j], vs[i]]; vs.forEach((x, k) => { x.order = k + 1; }); markDirty(); render();
    });
    main.querySelectorAll('[data-vdel]').forEach(el => el.onclick = () => { if (confirm('Delete video?')) { vs.splice(Number(el.dataset.vdel), 1); markDirty(); render(); } });
  }

  // ---------- team ----------
  function renderTeam() {
    const tm = content.team;
    main.innerHTML = `<button class="btn primary" id="add-member">+ Add team member</button>
      ${tm.map((m, i) => `<div class="panel" style="margin-top:14px"><div class="grid">
        ${input(`team.${i}.name`, 'Name')}${bi(`team.${i}.role`, 'Role')}${bi(`team.${i}.note`, 'One line about responsibility')}${media(`team.${i}.photo`, 'Photo')}
      </div><div style="display:flex;gap:6px;margin-top:10px;justify-content:flex-end">
        <button class="btn sm" data-move="team|${i}|-1">↑</button><button class="btn sm" data-move="team|${i}|1">↓</button><button class="btn sm danger" data-del="team|${i}">Delete</button></div></div>`).join('')}`;
    document.getElementById('add-member').onclick = () => { tm.push({ name: '', role: T(), note: T(), photo: '' }); markDirty(); render(); };
  }

  // ---------- settings ----------
  function renderSettings() {
    const s = 'settings';
    main.innerHTML = `<div class="panel">
      <h2 style="margin-top:0">Contacts</h2>
      <div class="grid">${input(s + '.phone', 'Phone (display)')}${input(s + '.whatsapp', 'WhatsApp number (digits only, e.g. 971585951312)')}${input(s + '.email', 'Email')}${input(s + '.instagram', 'Instagram username')}${input(s + '.company', 'Company legal name')}</div>
      <div class="grid" style="margin-top:12px">${bi(s + '.address', 'Address', 'textarea')}${bi(s + '.licence', 'Licence', 'textarea')}</div>
      <h2>Hero (main screen)</h2>
      <div class="grid">${media(s + '.hero.video', 'Background video, desktop (MP4, muted, 10–20 s)')}${media(s + '.hero.videoMobile', 'Background video, mobile (vertical MP4)')}${media(s + '.hero.image', 'Background photo, desktop (also video poster)')}${media(s + '.hero.imageMobile', 'Background photo, mobile')}</div>
      <h2>Analytics & advertising</h2>
      <div class="grid">${input(s + '.analytics.gtmId', 'Google Tag Manager ID (GTM-XXXX)')}${input(s + '.analytics.ga4Id', 'Google Analytics 4 ID (G-XXXX)')}${input(s + '.analytics.metaPixelId', 'Meta Pixel ID')}</div>
      <p class="hint">Meta Conversions API, Kommo CRM, Telegram notifications are configured with server environment variables (see README).</p>
    </div>`;
  }

  // ---------- estimator (JSON) ----------
  function renderEstimator() {
    main.innerHTML = `<div class="panel">
      <p class="hint" style="margin-top:0">All prices in AED. Pairs are [min, max].<br>
      <b>rates</b> — general works per m² (walls, ceilings, floors, MEP, doors) by service and finish level; kitchens and bathrooms are added separately per unit.<br>
      <b>propertyFactor</b> — multiplier per property type. <b>designPerM2</b> — design fee per m² when the client needs a design. <b>approvals</b> — fixed permits/insurance.<br>
      <b>extras</b>: type "pct" = % of works, "m2" = per m², "fixed" = fixed amount. <b>weeks</b> — duration formula: base + perM2 × area.</p>
      <textarea class="code" id="est-json">${esc(JSON.stringify(content.estimator, null, 2))}</textarea>
      <p id="est-err" class="hint"></p>
    </div>`;
    const ta = document.getElementById('est-json');
    ta.addEventListener('input', () => {
      try { content.estimator = JSON.parse(ta.value); document.getElementById('est-err').textContent = '✓ valid'; markDirty(); }
      catch (er) { document.getElementById('est-err').textContent = '✕ ' + er.message; }
    });
  }

  // ---------- site texts (every UI string, EN + RU) ----------
  const GROUPS = [
    ['hero', 'Главный экран (Hero)'], ['about', 'О компании (About)'], ['exp', 'Опыт — цифры'], ['team', 'Команда — заголовок'],
    ['why', 'Почему Formica'], ['pf', 'Портфолио'], ['cat', 'Категории проектов'], ['type', 'Типы объектов'], ['proj', 'Страница проекта'],
    ['vj', 'Видеожурнал'], ['how', 'Как мы работаем — заголовок'], ['opt1', 'Вариант 1 (есть дизайн)'], ['opt2', 'Вариант 2 (с нуля)'],
    ['resp', 'Ваше участие / Наша ответственность'], ['steps', 'Этапы — заголовок'], ['step', 'Этапы работы'], ['faq', 'Частые вопросы (FAQ)'],
    ['est', 'Калькулятор'], ['br', 'Калькулятор — статьи сметы'], ['f', 'Формы заявок'], ['svc', 'Формы — виды услуг'],
    ['nav', 'Меню'], ['ft', 'Футер'], ['', 'Прочее']
  ];
  let textFilter = '';
  function groupOf(k) {
    const pre = k.split('.')[0];
    return GROUPS.some(g => g[0] === pre) ? pre : '';
  }
  function renderTexts() {
    if (!content.texts) content.texts = { en: {}, ru: {} };
    ['en', 'ru'].forEach(l => { if (!content.texts[l]) content.texts[l] = {}; });
    const D = window.I18N;
    const keys = Object.keys(D.en);
    const q = textFilter.toLowerCase();
    const val = (l, k) => (content.texts[l][k] != null ? content.texts[l][k] : (D[l][k] != null ? D[l][k] : ''));
    const match = k => !q || k.toLowerCase().includes(q) || String(val('en', k)).toLowerCase().includes(q) || String(val('ru', k)).toLowerCase().includes(q);
    const html = GROUPS.map(([g, title]) => {
      const ks = keys.filter(k => groupOf(k) === g && match(k));
      if (!ks.length) return '';
      return `<details class="grp" ${q ? 'open' : ''}><summary>${esc(title)} <span style="color:var(--muted);font-weight:400;margin-left:auto;margin-right:14px">${ks.length}</span></summary>
        ${ks.map(k => `<div class="trow">
          <div class="key"><span>${esc(k)}</span>${(content.texts.en[k] != null || content.texts.ru[k] != null) ? `<button type="button" class="btn sm" data-treset="${esc(k)}">Вернуть исходный текст</button>` : ''}</div>
          <label>English<textarea data-tkey="${esc(k)}" data-tlang="en" class="${content.texts.en[k] != null ? 'changed' : ''}">${esc(val('en', k))}</textarea></label>
          <label>Русский<textarea data-tkey="${esc(k)}" data-tlang="ru" class="${content.texts.ru[k] != null ? 'changed' : ''}">${esc(val('ru', k))}</textarea></label>
        </div>`).join('')}</details>`;
    }).join('');
    main.innerHTML = `<div class="panel" style="margin-bottom:14px">
        <p class="hint" style="margin-top:0">Здесь все тексты сайта на двух языках. Откройте нужный блок, исправьте текст и нажмите <b>Save changes</b> вверху справа.
        Изменённые поля подсвечиваются золотым. <code>&lt;br&gt;</code> — перенос строки (например, в заголовке главного экрана).
        Тексты проектов, видео, команды и контакты редактируются в своих вкладках.</p>
        <input type="search" id="tsearch" placeholder="Поиск по тексту, например: warranty или гарантия" value="${esc(textFilter)}">
      </div>${html || '<p>Ничего не найдено.</p>'}`;
    const s = document.getElementById('tsearch');
    s.addEventListener('input', () => { textFilter = s.value; const pos = s.selectionStart; renderTexts(); const n = document.getElementById('tsearch'); n.focus(); n.setSelectionRange(pos, pos); });
    main.querySelectorAll('textarea[data-tkey]').forEach(ta => ta.addEventListener('input', () => {
      const k = ta.dataset.tkey, l = ta.dataset.tlang;
      if (ta.value === (D[l][k] || '')) delete content.texts[l][k]; else content.texts[l][k] = ta.value;
      ta.classList.toggle('changed', content.texts[l][k] != null);
      markDirty();
    }));
    main.querySelectorAll('[data-treset]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.treset; delete content.texts.en[k]; delete content.texts.ru[k]; markDirty(); renderTexts();
    }));
  }

  // ---------- design: fonts, colours, sizes ----------
  function renderDesign() {
    const DS = window.Design;
    if (!content.settings.design) content.settings.design = Object.assign({}, DS.DEFAULTS);
    const d = content.settings.design;
    Object.keys(DS.DEFAULTS).forEach(k => { if (d[k] === undefined) d[k] = DS.DEFAULTS[k]; });
    DS.FONTS.forEach(f => DS.loadFont(f[0]));
    const fontSel = (key, label) => `<label>${label}<select data-dz="${key}">${DS.FONTS.map(f => `<option value="${esc(f[0])}" ${d[key] === f[0] ? 'selected' : ''} style="font-family:${esc(DS.stack(f[0], f[1]))}; font-size:16px">${esc(f[0])}</option>`).join('')}</select></label>
      <p class="hint" data-sample="${key}" style="font-family:${esc(DS.stack(d[key], 'sans'))}; font-size:20px; color:var(--text); margin:6px 0 0">Formica — Полная реновация 2026</p>`;
    const color = (key, label) => `<label>${label}<div class="color"><input type="color" data-dz="${key}" value="${esc(d[key])}"><input type="text" data-dz="${key}" value="${esc(d[key])}" maxlength="7"></div></label>`;
    main.innerHTML = `<div class="dz">
      <div>
        <div class="panel">
          <h2 style="margin-top:0">Готовые темы</h2>
          <div class="presets">${Object.keys(DS.PRESETS).map(n => `<button type="button" class="btn" data-preset="${esc(n)}">${esc(n)}</button>`).join('')}</div>
          <p class="hint">Нажмите тему — все настройки ниже заполнятся. Потом можно поправить что угодно вручную.</p>
        </div>
        <div class="panel" style="margin-top:14px">
          <h2 style="margin-top:0">Шрифты</h2>
          <div class="grid" style="grid-template-columns:1fr">
            ${fontSel('fontHeading', 'Заголовки')}
            ${fontSel('fontBody', 'Основной текст')}
            ${fontSel('fontLabel', 'Подписи, меню и кнопки (мелкие заглавные надписи)')}
          </div>
          <p class="hint">Все шрифты поддерживают русский язык. У Marcellus нет кириллицы — для русской версии он автоматически заменяется на Cormorant Garamond.</p>
        </div>
        <div class="panel" style="margin-top:14px">
          <h2 style="margin-top:0">Цвета</h2>
          <div class="colors">
            ${color('bg', 'Фон сайта')}
            ${color('bg2', 'Фон второстепенных блоков')}
            ${color('text', 'Основной текст и заголовки')}
            ${color('muted', 'Второстепенный текст')}
            ${color('accent', 'Акцент (надписи, линии, рамки)')}
            ${color('btnBg', 'Кнопка — фон')}
            ${color('btnText', 'Кнопка — текст')}
          </div>
          <p class="hint">Текст на фотографиях (главный экран, обложка проекта) всегда остаётся светлым, чтобы его было видно.</p>
        </div>
        <div class="panel" style="margin-top:14px">
          <h2 style="margin-top:0">Размеры</h2>
          <label>Размер заголовков<div class="range"><input type="range" min="70" max="140" step="5" data-dz="headingScale" value="${esc(d.headingScale)}"><output>${esc(d.headingScale)}%</output></div></label>
          <label style="margin-top:12px">Размер основного текста<div class="range"><input type="range" min="85" max="130" step="5" data-dz="textScale" value="${esc(d.textScale)}"><output>${esc(d.textScale)}%</output></div></label>
          <label class="check" style="margin-top:14px"><input type="checkbox" data-dz="uppercase" ${d.uppercase !== false ? 'checked' : ''}> Заголовки ЗАГЛАВНЫМИ БУКВАМИ</label>
        </div>
        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
          <button type="button" class="btn" id="dz-reset">Вернуть исходный дизайн</button>
          <a class="btn" href="/" target="_blank">Открыть сайт</a>
        </div>
        <p class="hint">После изменений нажмите <b>Save changes</b> вверху справа и обновите сайт.</p>
      </div>
      <div class="preview"><div class="pv" id="pv">
        <p class="pv-eyebrow">О компании · About</p>
        <h1>Полная реновация. Полное спокойствие.</h1>
        <div class="pv-line"></div>
        <p>Formica — строительная компания в Дубае. От дизайна и согласований до строительства, отделки и сдачи объекта.</p>
        <p class="muted">Второстепенный текст: подписи, описания, пояснения под заголовками.</p>
        <span class="pv-btn">Рассчитать стоимость</span><span class="pv-btn ghost">Проекты</span>
        <div class="pv-alt"><p class="pv-eyebrow">Портфолио</p><h2>Наши проекты</h2><p class="muted" style="margin:0">Так выглядят второстепенные блоки сайта.</p></div>
      </div></div>
    </div>`;
    const pv = document.getElementById('pv');
    const refresh = () => { DS.apply(d, pv); };
    refresh();
    main.querySelectorAll('[data-dz]').forEach(el => el.addEventListener('input', () => {
      const k = el.dataset.dz;
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.type === 'range') { v = Number(v); el.nextElementSibling.textContent = v + '%'; }
      if (el.type === 'text' && !/^#[0-9a-fA-F]{6}$/.test(v)) return;
      d[k] = v;
      if (el.type === 'color' || el.type === 'text') main.querySelectorAll(`[data-dz="${k}"]`).forEach(o => { if (o !== el) o.value = v; });
      const sample = main.querySelector(`[data-sample="${k}"]`); if (sample) sample.style.fontFamily = DS.stack(v, 'sans');
      markDirty(); refresh();
    }));
    main.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
      content.settings.design = Object.assign({}, DS.PRESETS[b.dataset.preset]); markDirty(); renderDesign();
    }));
    document.getElementById('dz-reset').onclick = () => { content.settings.design = Object.assign({}, DS.DEFAULTS); markDirty(); renderDesign(); };
  }

  fetch('/api/content').then(r => r.json()).then(c => { content = c; render(); });
})();
