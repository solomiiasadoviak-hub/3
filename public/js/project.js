/* Project detail page: /project/:slug */
(function () {
  const { t, L, esc, fmt, link, homeUrl } = window.F;
  const slug = location.pathname.split('/').filter(Boolean).pop();
  const main = document.getElementById('project');

  window.F.contentPromise.then(c => {
    const p = c.projects.find(x => x.slug === slug);
    if (!p) { main.innerHTML = `<section class="section page-top"><div class="container"><p>${t('proj.notFound')}</p><a class="btn btn-ghost" href="${homeUrl}#projects">${t('proj.back')}</a></div></section>`; return; }
    document.title = `${L(p.title)} — Formica`;
    const gal = p.gallery || [];
    const vids = c.videos.filter(v => v.project === p.slug);
    const more = c.projects.filter(x => x.slug !== p.slug && x.category === p.category).slice(0, 3);
    const discussUrl = `${homeUrl}?project=${encodeURIComponent(L(p.title))}&service=${p.category}#estimate`;
    const section = (k, v) => v ? `<div class="pd-block reveal"><h2 class="eyebrow">${t(k)}</h2><p>${esc(v)}</p></div>` : '';

    const pairs = [];
    const n = Math.max((p.before || []).length, (p.after || []).length);
    for (let i = 0; i < n; i++) pairs.push([p.before[i], p.after[i]]);

    main.innerHTML = `
      <section class="pd-hero">
        <div class="pd-hero-img"><img src="${esc(p.cover)}" alt="${esc(L(p.title))}" onerror="this.remove()"></div>
        <div class="container pd-hero-text">
          <a class="link-back" href="${homeUrl}#projects">← ${t('proj.back')}</a>
          <p class="eyebrow light">${t('cat.' + p.category)} · ${t('type.' + p.type)}</p>
          <h1 class="display s">${esc(L(p.title))}</h1>
        </div>
      </section>
      <section class="section">
        <div class="container pd-grid">
          <aside class="pd-aside">
            <dl class="spec">
              <div><dt>${t('pf.location')}</dt><dd>${esc(L(p.location))}</dd></div>
              <div><dt>${t('pf.property')}</dt><dd>${t('type.' + p.type)}</dd></div>
              <div><dt>${t('pf.area')}</dt><dd>${fmt(p.area)} m²</dd></div>
              <div><dt>${t('pf.scope')}</dt><dd>${esc(L(p.scope))}</dd></div>
            </dl>
            <a class="btn btn-solid full" href="${discussUrl}">${t('pf.discuss')}</a>
          </aside>
          <div class="pd-main">
            ${section('proj.brief', L(p.brief))}
            ${section('proj.works', L(p.works))}
            ${section('proj.involvement', L(p.involvement))}
            ${section('proj.features', L(p.features))}
          </div>
        </div>
      </section>
      ${pairs.length ? `<section class="section alt"><div class="container">
        <h2 class="h2">${t('proj.beforeAfter')}</h2>
        ${pairs.map(([b, a]) => `<div class="ba reveal">
          ${b ? `<figure><img src="${esc(b.src)}" alt="" loading="lazy" onerror="this.remove()"><figcaption><span class="tag">${t('pf.before')}</span>${esc(L(b.caption))}</figcaption></figure>` : ''}
          ${a ? `<figure><img src="${esc(a.src)}" alt="" loading="lazy" onerror="this.remove()"><figcaption><span class="tag gold">${t('pf.after')}</span>${esc(L(a.caption))}</figcaption></figure>` : ''}
        </div>`).join('')}
      </div></section>` : ''}
      ${gal.length ? `<section class="section"><div class="container">
        <h2 class="h2">${t('proj.gallery')}</h2>
        <div class="gallery">${gal.map((g, i) => `<figure class="reveal${i % 3 === 0 ? ' wide' : ''}"><button type="button" data-lb="${i}"><img src="${esc(g.src)}" alt="${esc(L(g.caption))}" loading="lazy" onerror="this.remove()"></button>${L(g.caption) ? `<figcaption>${esc(L(g.caption))}</figcaption>` : ''}</figure>`).join('')}</div>
      </div></section>` : ''}
      ${vids.length ? `<section class="section alt"><div class="container"><h2 class="h2">${t('proj.videos')}</h2><div class="video-grid" id="pd-videos">${vids.map(v => window.Media.videoCard(v)).join('')}</div></div></section>` : ''}
      <section class="section center cta-band"><div class="container narrow">
        <h2 class="h2">${t('pf.discuss')}</h2>
        <a class="btn btn-solid" href="${discussUrl}">${t('pf.discuss')}</a>
      </div></section>
      ${more.length ? `<section class="section alt"><div class="container"><h2 class="h2">${t('proj.more')}</h2><div class="cards">${more.map(m => `<a class="card" href="${link('/project/' + m.slug)}"><div class="card-img"><img src="${esc(m.cover)}" alt="" loading="lazy" onerror="this.remove()"></div><div class="card-body"><span class="eyebrow small">${t('type.' + m.type)} · ${m.area} m²</span><h3>${esc(L(m.title))}</h3><p>${esc(L(m.location))}</p></div></a>`).join('')}</div></div></section>` : ''}
      <div class="lightbox" id="lb" hidden><button type="button" class="lb-close" aria-label="${t('close')}">×</button><button type="button" class="lb-nav prev" aria-label="Previous">‹</button><figure><img alt=""><figcaption></figcaption></figure><button type="button" class="lb-nav next" aria-label="Next">›</button></div>`;

    const pv = document.getElementById('pd-videos'); if (pv) window.Media.bindVideos(pv, vids);

    // lightbox
    const lb = document.getElementById('lb'); let cur = 0;
    const show = i => { cur = (i + gal.length) % gal.length; lb.querySelector('img').src = gal[cur].src; lb.querySelector('figcaption').textContent = `${L(gal[cur].caption)}  ${cur + 1} / ${gal.length}`; };
    main.addEventListener('click', e => {
      const b = e.target.closest('[data-lb]');
      if (b) { show(Number(b.dataset.lb)); lb.hidden = false; document.body.classList.add('modal-open'); }
    });
    lb.addEventListener('click', e => {
      if (e.target.closest('.prev')) show(cur - 1);
      else if (e.target.closest('.next')) show(cur + 1);
      else if (e.target.closest('.lb-close') || e.target === lb) { lb.hidden = true; document.body.classList.remove('modal-open'); }
    });
    document.addEventListener('keydown', e => {
      if (lb.hidden) return;
      if (e.key === 'ArrowLeft') show(cur - 1); if (e.key === 'ArrowRight') show(cur + 1);
      if (e.key === 'Escape') { lb.hidden = true; document.body.classList.remove('modal-open'); }
    });
    let tx = null;
    lb.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', e => { if (tx === null) return; const d = e.changedTouches[0].clientX - tx; tx = null; if (Math.abs(d) > 40) show(cur + (d < 0 ? 1 : -1)); });

    window.F.observeReveal();
  });
})();
