/* Shared media helpers: video cards, video modal, photo fallback. */
(function () {
  const { t, L, esc } = window.F;

  function parseVideo(src) {
    if (!src) return { kind: 'none' };
    let m = src.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
    if (m) return { kind: 'youtube', id: m[1] };
    m = src.match(/instagram\.com\/(?:reel|reels|p|tv)\/([\w-]+)/);
    if (m) return { kind: 'instagram', id: m[1], url: src };
    m = src.match(/vimeo\.com\/(\d+)/);
    if (m) return { kind: 'vimeo', id: m[1] };
    return { kind: 'file', url: src };
  }

  function videoCard(v, projects) {
    const proj = v.project && projects ? projects.find(p => p.slug === v.project) : null;
    return `<article class="video-card reveal">
      <button type="button" class="video-thumb" data-video="${esc(v.id)}" aria-label="${esc(L(v.title))}">
        <img src="${esc(v.cover)}" alt="" loading="lazy" onerror="this.remove()">
        <span class="play"><svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M8 5v14l11-7z"/></svg></span>
        <span class="video-cat">${t('vj.cat.' + v.category)}</span>
      </button>
      <h3>${esc(L(v.title))}</h3>
      ${proj ? `<a class="link-arrow small" href="${window.F.link('/project/' + proj.slug)}">${t('vj.toProject')}</a>` : ''}
    </article>`;
  }

  function openVideo(v) {
    const modal = document.getElementById('video-modal');
    const body = modal.querySelector('.modal-body');
    const p = parseVideo(v.src);
    let html = '';
    if (p.kind === 'file') html = `<video src="${esc(p.url)}" poster="${esc(v.cover)}" controls playsinline muted autoplay preload="metadata"></video>`;
    else if (p.kind === 'youtube') html = `<iframe src="https://www.youtube-nocookie.com/embed/${p.id}?autoplay=1&mute=1&playsinline=1&rel=0" allow="autoplay; encrypted-media; fullscreen" allowfullscreen title="${esc(L(v.title))}"></iframe>`;
    else if (p.kind === 'vimeo') html = `<iframe src="https://player.vimeo.com/video/${p.id}?autoplay=1&muted=1" allow="autoplay; fullscreen" allowfullscreen title="${esc(L(v.title))}"></iframe>`;
    else if (p.kind === 'instagram') html = `<iframe class="ig" src="https://www.instagram.com/reel/${p.id}/embed" allowfullscreen title="${esc(L(v.title))}"></iframe><a class="link-arrow" href="${esc(p.url)}" target="_blank" rel="noopener">${t('vj.instagram')}</a>`;
    else html = `<div class="video-soon"><img src="${esc(v.cover)}" alt="" onerror="this.remove()"><p>${t('vj.soon')}</p></div>`;
    body.className = 'modal-body' + (p.kind === 'instagram' ? ' vertical' : '');
    body.innerHTML = html + `<p class="modal-caption">${esc(L(v.title))}</p>`;
    modal.hidden = false; document.body.classList.add('modal-open');
    window.F.track('video_open', { video: v.id });
  }

  function closeModal() {
    const modal = document.getElementById('video-modal');
    if (!modal || modal.hidden) return;
    modal.hidden = true; modal.querySelector('.modal-body').innerHTML = ''; document.body.classList.remove('modal-open');
  }

  function bindVideos(container, videos) {
    container.addEventListener('click', e => {
      const b = e.target.closest('[data-video]'); if (!b) return;
      const v = videos.find(x => x.id === b.dataset.video); if (v) openVideo(v);
    });
  }

  document.addEventListener('click', e => {
    const modal = document.getElementById('video-modal');
    if (modal && !modal.hidden && (e.target === modal || e.target.closest('.modal-close'))) closeModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  window.Media = { videoCard, bindVideos, openVideo, parseVideo };
})();
