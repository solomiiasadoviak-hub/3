/* Shared: language, header/menu/footer, content loading, analytics, lead submission. */
(function () {
  const qs = new URLSearchParams(location.search);
  const pathLang = (location.pathname.match(/^\/(en|ru)(\/|$)/) || [])[1];
  let stored = null;
  try { stored = localStorage.getItem('lang'); } catch (e) { /* private mode */ }
  const LANG = pathLang || qs.get('lang') || stored || ((navigator.language || '').startsWith('ru') ? 'ru' : 'en');
  const lang = LANG === 'ru' ? 'ru' : 'en';
  try { localStorage.setItem('lang', lang); } catch (e) { /* ignore */ }
  document.documentElement.lang = lang;

  const dict = window.I18N[lang];
  const t = (k) => (dict[k] !== undefined ? dict[k] : (window.I18N.en[k] !== undefined ? window.I18N.en[k] : k));
  const L = (obj) => (obj && typeof obj === 'object' ? (obj[lang] || obj.en || '') : (obj || ''));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Math.round(n).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US');
  const homeUrl = lang === 'ru' ? '/ru' : '/en';
  const link = (p) => p + (p.includes('?') ? '&' : '?') + 'lang=' + lang;

  function applyI18n(root) {
    (root || document).querySelectorAll('[data-i18n]').forEach(el => { el.innerHTML = t(el.dataset.i18n); });
    (root || document).querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    (root || document).querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  }

  function otherLangUrl() {
    const other = lang === 'ru' ? 'en' : 'ru';
    if (location.pathname === '/' || /^\/(en|ru)\/?$/.test(location.pathname)) return '/' + other + location.hash;
    const u = new URL(location.href); u.searchParams.set('lang', other); return u.pathname + u.search + u.hash;
  }

  // ---------- UTM / source capture (first touch kept for the session) ----------
  const SRC_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
  let src = {};
  try { src = JSON.parse(sessionStorage.getItem('src') || '{}'); } catch (e) { /* ignore */ }
  if (SRC_KEYS.some(k => qs.get(k))) { src = {}; SRC_KEYS.forEach(k => { if (qs.get(k)) src[k] = qs.get(k); }); }
  if (!src.referrer && document.referrer && !document.referrer.includes(location.host)) src.referrer = document.referrer;
  try { sessionStorage.setItem('src', JSON.stringify(src)); } catch (e) { /* ignore */ }
  const cookie = (n) => (document.cookie.match('(^|;)\\s*' + n + '=([^;]*)') || [])[2] || '';

  // ---------- content ----------
  const contentPromise = fetch('/api/content').then(r => r.json());

  // ---------- header / menu / footer ----------
  const NAV = [['about', 'nav.about'], ['projects', 'nav.projects'], ['videos', 'nav.videos'], ['how', 'nav.how'], ['estimate', 'nav.estimate']];
  const isHome = !!document.getElementById('hero');
  const navHref = (id) => (isHome ? '#' + id : homeUrl + '#' + id);

  function logo() {
    return `<a class="brand" href="${homeUrl}" aria-label="Formica — ${t('nav.home')}">
      <img class="brand-mark" src="/img/logo.svg" alt="" width="40" height="40">
      <span class="brand-text"><span class="brand-name">Formica BC</span><span class="brand-sub"><span class="brand-sub-pre">Formica </span>Building Contracting LLC</span></span></a>`;
  }

  function renderChrome(c) {
    const s = c.settings;
    const header = document.getElementById('site-header');
    if (header) {
      header.innerHTML = `<div class="header-inner">${logo()}
        <nav class="header-nav" aria-label="Main">${NAV.map(([id, k]) => `<a href="${navHref(id)}">${t(k)}</a>`).join('')}</nav>
        <div class="header-actions">
          <a class="lang-switch" href="${otherLangUrl()}" hreflang="${lang === 'ru' ? 'en' : 'ru'}">${t('lang.code')}</a>
          <button class="menu-btn" type="button" aria-expanded="false" aria-controls="menu"><span>${t('menu')}</span><i></i></button>
        </div></div>`;
    }
    const menu = document.createElement('div');
    menu.id = 'menu'; menu.className = 'menu'; menu.hidden = true;
    menu.innerHTML = `<div class="menu-inner">
      <nav>${NAV.map(([id, k], i) => `<a href="${navHref(id)}"><small>0${i + 1}</small>${t(k)}</a>`).join('')}</nav>
      <div class="menu-contacts">
        <a href="https://wa.me/${s.whatsapp}">WhatsApp</a>
        <a href="tel:${s.phone.replace(/\s/g, '')}">${esc(s.phone)}</a>
        <a href="mailto:${s.email}">${esc(s.email)}</a>
        <a href="https://instagram.com/${s.instagram}" target="_blank" rel="noopener">@${esc(s.instagram)}</a>
      </div></div>`;
    document.body.appendChild(menu);
    const btn = header && header.querySelector('.menu-btn');
    const setMenu = (open) => {
      menu.hidden = !open; document.body.classList.toggle('menu-open', open);
      if (btn) { btn.setAttribute('aria-expanded', open); btn.querySelector('span').textContent = open ? t('close') : t('menu'); }
    };
    if (btn) btn.addEventListener('click', () => setMenu(menu.hidden));
    menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });

    const onScroll = () => header && header.classList.toggle('scrolled', scrollY > 40);
    addEventListener('scroll', onScroll, { passive: true }); onScroll();

    const footer = document.getElementById('site-footer');
    if (footer) {
      footer.innerHTML = `<div class="container">
        <div class="footer-top">${logo()}
          <nav class="footer-nav" aria-label="${t('ft.nav')}">${NAV.map(([id, k]) => `<a href="${navHref(id)}">${t(k)}</a>`).join('')}</nav></div>
        <div class="footer-grid">
          <div><h4>${t('ft.office')}</h4><p>${esc(L(s.address)).replace(/\n/g, '<br>')}</p></div>
          <div><h4>${t('ft.contact')}</h4>
            <p><a href="tel:${s.phone.replace(/\s/g, '')}">${esc(s.phone)}</a></p>
            <p><a href="https://wa.me/${s.whatsapp}" target="_blank" rel="noopener">WhatsApp</a></p>
            <p><a href="mailto:${s.email}">${esc(s.email)}</a></p></div>
          <div><h4>${t('ft.instagram')}</h4><p><a href="https://instagram.com/${s.instagram}" target="_blank" rel="noopener">@${esc(s.instagram)}</a></p></div>
          <div><h4>${t('ft.licence')}</h4><p>${esc(L(s.licence)).replace(/\n/g, '<br>')}</p></div>
        </div>
        <div class="footer-bottom">
          <span>© ${new Date().getFullYear()} ${esc(s.company)}. ${t('ft.rights')}</span>
          <a href="${link('/privacy')}">${t('nav.privacy')}</a>
          <a href="${otherLangUrl()}">${t('lang.other')}</a>
        </div></div>`;
    }
    const fab = document.createElement('a');
    fab.className = 'wa-fab'; fab.href = `https://wa.me/${s.whatsapp}`; fab.target = '_blank'; fab.rel = 'noopener'; fab.setAttribute('aria-label', 'WhatsApp');
    fab.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.2Z"/></svg>';
    document.body.appendChild(fab);
  }

  // ---------- analytics (GTM / GA4 / Meta Pixel), ids from settings ----------
  function loadAnalytics(a) {
    if (!a) return;
    window.dataLayer = window.dataLayer || [];
    if (a.gtmId) {
      window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      const s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(a.gtmId); document.head.appendChild(s);
    }
    if (a.ga4Id) {
      const s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(a.ga4Id); document.head.appendChild(s);
      window.gtag = function () { window.dataLayer.push(arguments); }; window.gtag('js', new Date()); window.gtag('config', a.ga4Id);
    }
    if (a.metaPixelId) {
      /* eslint-disable */
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */
      window.fbq('init', a.metaPixelId); window.fbq('track', 'PageView');
    }
  }
  function track(event, params) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event }, params || {}));
    if (window.gtag) window.gtag('event', event, params || {});
  }

  // ---------- leads ----------
  const PHONE_CODES = ['+971', '+7', '+380', '+44', '+49', '+33', '+39', '+34', '+1', '+91', '+966', '+974', '+965', '+968', '+973', '+20', '+90', '+375', '+77', '+48', '+31', '+41', '+43', '+86', '+61'];
  function phoneField(nameCode = 'phoneCode', nameNum = 'phone') {
    return `<div class="phone-row">
      <div class="select-wrap code"><select name="${nameCode}" aria-label="Country code">${PHONE_CODES.map(c => `<option>${c}</option>`).join('')}</select></div>
      <input name="${nameNum}" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="50 123 4567" required></div>`;
  }

  async function submitLead(payload) {
    const eventId = 'lead-' + Date.now();
    const body = Object.assign({}, payload, {
      lang,
      source: Object.assign({}, src, { page: location.pathname + location.hash, url: location.href, fbp: cookie('_fbp'), fbc: cookie('_fbc') })
    });
    const r = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) throw new Error(data.error || 'Request failed');
    track('generate_lead', { form_type: payload.formType, service: payload.service || '' });
    if (window.fbq) window.fbq('track', 'Lead', { content_category: payload.service || payload.formType }, { eventID: data.id || eventId });
    return data;
  }

  function waText(payload) {
    const rows = [t('wa.hello')];
    if (payload.name) rows.push(`${t('f.name')}: ${payload.name}`);
    if (payload.propertyType) rows.push(`${t('f.property')}: ${payload.propertyType}`);
    if (payload.service) rows.push(`${t('f.service')}: ${payload.service}`);
    if (payload.area) rows.push(`${t('f.area')}: ${payload.area}`);
    if (payload.project) rows.push(`${t('f.project')}: ${payload.project}`);
    if (payload.estimateText) rows.push(payload.estimateText);
    if (payload.message) rows.push(payload.message);
    return encodeURIComponent(rows.join('\n'));
  }

  // ---------- reveal on scroll ----------
  function observeReveal(root) {
    const els = (root || document).querySelectorAll('.reveal:not(.in)');
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach(e => io.observe(e));
  }

  window.F = { lang, t, L, esc, fmt, link, homeUrl, applyI18n, contentPromise, submitLead, waText, phoneField, track, observeReveal };

  applyI18n();
  contentPromise.then(c => { renderChrome(c); loadAnalytics(c.settings.analytics); observeReveal(); }).catch(e => console.error(e));
})();
