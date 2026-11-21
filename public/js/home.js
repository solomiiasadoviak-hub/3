/* Home page: hero, team, portfolio, video journal, contacts. */
(function () {
  const { t, L, esc, link, fmt } = window.F;
  const byOrder = (a, b) => (a.order || 0) - (b.order || 0);

  window.F.contentPromise.then(c => {
    const s = c.settings;
    window.Estimator.init(c);

    /* hero: video if set, otherwise photo; separate mobile sources */
    const media = document.getElementById('hero-media');
    const mobile = matchMedia('(max-width: 760px)').matches;
    const vid = (mobile && s.hero.videoMobile) || s.hero.video;
    const img = (mobile && s.hero.imageMobile) || s.hero.image;
    if (vid && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      media.innerHTML = `<video autoplay muted loop playsinline preload="auto" poster="${esc(img)}"><source src="${esc(vid)}"></video>`;
    } else {
      media.innerHTML = `<img src="${esc(img)}" alt="" fetchpriority="high" onerror="this.remove()">`;
    }

    /* team */
    document.getElementById('team').innerHTML = c.team.map(m => {
      const initials = (m.name || L(m.role)).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
      return `<figure class="member reveal">
        <div class="member-photo">${m.photo ? `<img src="${esc(m.photo)}" alt="${esc(m.name)}" loading="lazy">` : `<span>${esc(initials)}</span>`}</div>
        <figcaption>${m.name ? `<b>${esc(m.name)}</b>` : ''}<span class="role">${esc(L(m.role))}</span>${L(m.note) ? `<small>${esc(L(m.note))}</small>` : ''}</figcaption></figure>`;
    }).join('');

    /* direct contacts */
    document.getElementById('direct').innerHTML = `
      <li><a href="https://wa.me/${s.whatsapp}" target="_blank" rel="noopener">WhatsApp</a></li>
      <li><a href="tel:${s.phone.replace(/\s/g, '')}">${esc(s.phone)}</a></li>
      <li><a href="mailto:${s.email}">${esc(s.email)}</a></li>
      <li><a href="https://instagram.com/${s.instagram}" target="_blank" rel="noopener">@${esc(s.instagram)}</a></li>`;

    /* "Build my design" / "Start my project" */
    document.querySelectorAll('[data-start]').forEach(a => a.addEventListener('click', e => {
      e.preventDefault(); window.Estimator.consult({ service: a.dataset.start });
    }));

    /* ---------------- portfolio ---------------- */
    const projects = c.projects.slice().sort(byOrder);
    const pf = { cat: 'full', type: 'all', idx: 0, photo: 0 };
    const cats = ['full', 'rental', 'commercial'];
    const catsEl = document.getElementById('pf-cats');
    const typesEl = document.getElementById('pf-types');
    const featEl = document.getElementById('pf-feature');
    const cardsEl = document.getElementById('pf-cards');

    function list() {
      return projects.filter(p => p.category === pf.cat && (pf.cat !== 'full' || pf.type === 'all' || p.type === pf.type));
    }

    function renderPortfolio() {
      catsEl.innerHTML = cats.map(k => `<button type="button" role="tab" class="tab" aria-selected="${pf.cat === k}" data-cat="${k}">${t('cat.' + k)}</button>`).join('');
      typesEl.innerHTML = pf.cat === 'full'
        ? [['all', 'type.all'], ['apartment', 'type.apartments'], ['villa', 'type.villas']].map(([v, k]) => `<button type="button" class="chip${pf.type === v ? ' on' : ''}" data-type="${v}">${t(k)}</button>`).join('')
        : '';
      const items = list();
      if (!items.length) { featEl.innerHTML = `<p class="empty">${t('pf.empty')}</p>`; cardsEl.innerHTML = ''; return; }
      if (pf.idx >= items.length) pf.idx = 0;
      renderFeature(items[pf.idx]);
      cardsEl.innerHTML = items.map((p, i) => `<a class="card${i === pf.idx ? ' current' : ''}" href="${link('/project/' + p.slug)}">
          <div class="card-img"><img src="${esc(p.cover)}" alt="${esc(L(p.title))}" loading="lazy" onerror="this.remove()"></div>
          <div class="card-body"><span class="eyebrow small">${t('type.' + p.type)} · ${p.area} m²</span><h3>${esc(L(p.title))}</h3><p>${esc(L(p.location))}</p></div></a>`).join('');
    }

    function renderFeature(p) {
      const gal = p.gallery && p.gallery.length ? p.gallery : [{ src: p.cover, caption: {} }];
      if (pf.photo >= gal.length) pf.photo = 0;
      const ph = gal[pf.photo];
      const rooms = [];
      gal.forEach((g, i) => { const c = L(g.caption); if (c && !rooms.some(r => r.c === c)) rooms.push({ c, i }); });
      featEl.innerHTML = `<div class="feature">
        <div class="feature-media">
          <div class="feature-img"><img src="${esc(ph.src)}" alt="${esc(L(ph.caption) || L(p.title))}" onerror="this.remove()"></div>
          <div class="feature-bar"><span>${esc(L(ph.caption))}${L(ph.caption) ? ' · ' : ''}${pf.photo + 1} / ${gal.length}</span>
            <div class="arrows"><button type="button" data-ph="-1" aria-label="Previous">‹</button><button type="button" data-ph="1" aria-label="Next">›</button></div></div>
        </div>
        <div class="feature-info">
          <p class="eyebrow">${t('type.' + p.type)}</p>
          <h3 class="h2 s">${esc(L(p.title))}</h3>
          <dl class="spec">
            <div><dt>${t('pf.location')}</dt><dd>${esc(L(p.location))}</dd></div>
            <div><dt>${t('pf.property')}</dt><dd>${t('type.' + p.type)}</dd></div>
            <div><dt>${t('pf.area')}</dt><dd>${fmt(p.area)} m²</dd></div>
            <div><dt>${t('pf.scope')}</dt><dd>${esc(L(p.scope))}</dd></div>
            <div><dt>${t('pf.photos')}</dt><dd>${gal.length}</dd></div>
          </dl>
          ${L(p.involvement) ? `<p class="involve"><span class="label">${t('pf.involvement')}</span>${esc(L(p.involvement))}</p>` : ''}
          ${rooms.length > 1 ? `<div class="chips rooms">${rooms.map(r => `<button type="button" class="chip${L(ph.caption) === r.c ? ' on' : ''}" data-room="${r.i}">${esc(r.c)}</button>`).join('')}</div>` : ''}
          <a class="btn btn-solid full" href="${link('/project/' + p.slug)}">${t('pf.viewAll')}</a>
          <button type="button" class="btn btn-ghost full" data-discuss="${esc(L(p.title))}">${t('pf.discuss')}</button>
        </div></div>`;
      // preload neighbour
      const nx = gal[(pf.photo + 1) % gal.length]; if (nx) { const im = new Image(); im.src = nx.src; }
    }

    let touchX = null;
    document.getElementById('projects').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const items = list();
      if (b.dataset.cat) { pf.cat = b.dataset.cat; pf.type = 'all'; pf.idx = 0; pf.photo = 0; renderPortfolio(); }
      else if (b.dataset.type) { pf.type = b.dataset.type; pf.idx = 0; pf.photo = 0; renderPortfolio(); }
      else if (b.dataset.ph) {
        const n = (items[pf.idx].gallery || []).length || 1;
        pf.photo = (pf.photo + Number(b.dataset.ph) + n) % n; renderFeature(items[pf.idx]);
      } else if (b.dataset.room) { pf.photo = Number(b.dataset.room); renderFeature(items[pf.idx]); }
      else if (b.dataset.discuss) window.Estimator.consult({ project: b.dataset.discuss, service: pf.cat });
    });
    featEl.addEventListener('touchstart', e => { if (e.target.closest('.feature-img')) touchX = e.touches[0].clientX; }, { passive: true });
    featEl.addEventListener('touchend', e => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX; touchX = null;
      if (Math.abs(dx) > 40) featEl.querySelector(`[data-ph="${dx < 0 ? 1 : -1}"]`).click();
    });
    // hover on a card previews it in the feature panel (desktop)
    cardsEl.addEventListener('mouseover', e => {
      const a = e.target.closest('.card'); if (!a || !matchMedia('(hover: hover)').matches) return;
      const i = [...cardsEl.children].indexOf(a);
      if (i !== pf.idx) { pf.idx = i; pf.photo = 0; renderFeature(list()[i]); [...cardsEl.children].forEach((x, j) => x.classList.toggle('current', j === i)); }
    });
    renderPortfolio();

    /* ---------------- video journal ---------------- */
    const vids = c.videos.slice().sort(byOrder);
    const featured = vids.filter(v => v.featured).slice(0, 4);
    const grid = document.getElementById('vj-grid');
    grid.innerHTML = (featured.length ? featured : vids.slice(0, 4)).map(v => window.Media.videoCard(v, projects)).join('');
    window.Media.bindVideos(grid, vids);
    document.getElementById('vj-all').href = link('/videos');

    window.F.observeReveal();
    const qp = new URLSearchParams(location.search);
    if (qp.get('project') || qp.get('service')) { window.Estimator.consult({ project: qp.get('project') || '', service: qp.get('service') || '' }); return; }
    if (location.hash) { const el = document.querySelector(location.hash); if (el) setTimeout(() => el.scrollIntoView(), 50); }
  });
})();
