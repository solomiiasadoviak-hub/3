/* Full video gallery: /videos */
(function () {
  const { t } = window.F;
  window.F.contentPromise.then(c => {
    const vids = c.videos.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    const cats = ['all', ...new Set(vids.map(v => v.category))];
    const catsEl = document.getElementById('vj-cats');
    const grid = document.getElementById('vj-grid');
    let cur = 'all';
    const render = () => {
      catsEl.innerHTML = cats.map(k => `<button type="button" class="chip${cur === k ? ' on' : ''}" data-c="${k}">${k === 'all' ? t('vj.all') : t('vj.cat.' + k)}</button>`).join('');
      grid.innerHTML = vids.filter(v => cur === 'all' || v.category === cur).map(v => window.Media.videoCard(v, c.projects)).join('');
      window.F.observeReveal(grid);
    };
    catsEl.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { cur = b.dataset.c; render(); } });
    window.Media.bindVideos(grid, vids);
    render();
  });
})();
