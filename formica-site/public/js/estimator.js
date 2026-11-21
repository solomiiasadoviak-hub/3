/* Preliminary estimate wizard + consultation form. Rates come from content.estimator (editable in /admin). */
(function () {
  const { t, esc, fmt, L } = window.F;

  const SERVICES = ['full', 'rental', 'commercial'];
  const PROPS = { full: ['apartment', 'townhouse', 'villa'], rental: ['apartment', 'townhouse', 'villa'], commercial: ['office', 'retail', 'salon', 'restaurant'] };
  const FINISHES = ['standard', 'premium', 'luxury'];
  const EXTRAS = ['layout', 'furniture', 'joinery', 'ac', 'smart', 'outdoor'];
  const ICONS = {
    full: '<path d="M4 20V9l8-5 8 5v11M9 20v-6h6v6"/>',
    rental: '<path d="M4 20V9l8-5 8 5v11"/><circle cx="12" cy="13" r="2.4"/><path d="M13.7 14.7 17 18"/>',
    commercial: '<rect x="4" y="5" width="16" height="15"/><path d="M8 9h2M14 9h2M8 13h2M14 13h2M10 20v-3h4v3"/>',
    apartment: '<rect x="6" y="3" width="12" height="18"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
    townhouse: '<path d="M3 20V10l5-4 5 4v10M13 20V10l4-3 4 3v10M6 20v-4h4v4"/>',
    villa: '<path d="M2 20h20M4 20v-8l8-6 8 6v8M9 20v-5h6v5"/><path d="M15 9V5h3v6"/>',
    office: '<rect x="4" y="4" width="16" height="16"/><path d="M4 10h16M10 10v10"/>',
    retail: '<path d="M4 9h16l-1-5H5L4 9Zm0 0v11h16V9M9 20v-6h6v6"/>',
    salon: '<circle cx="7" cy="17" r="3"/><circle cx="17" cy="17" r="3"/><path d="M9 15 19 4M15 15 5 4"/>',
    restaurant: '<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5a2 2 0 0 0 4 0V3M17 21V3c-2 0-3 3-3 7h3"/>'
  };
  const icon = k => `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ''}</svg>`;
  const typeLabel = k => t('type.' + k);
  const svcLabel = k => t('cat.' + k);

  let R = null; // rates
  const state = { step: 0, service: '', property: '', area: 0, unit: 'm2', kitchens: 1, bathrooms: 2, design: 'have', finish: 'premium', extras: [], start: '' };
  const DEFAULT_AREA = { apartment: 110, townhouse: 220, villa: 350, office: 200, retail: 120, salon: 120, restaurant: 180 };
  const STEPS = ['service', 'property', 'size', 'design', 'extras', 'result'];

  /* ---------------- calculation ---------------- */
  function compute(s) {
    const A = Math.max(10, Number(s.area) || 0);
    const f = R.propertyFactor[s.property] || 1;
    const rate = R.rates[s.service][s.finish];
    const items = [];
    const add = (key, min, max) => { if (max > 0) items.push({ key, min, max }); };
    const gMin = rate[0] * A * f, gMax = rate[1] * A * f;
    const split = s.service === 'full' ? [['demolition', .1], ['mep', .28], ['finishes', .42], ['joinery', .2]]
      : s.service === 'rental' ? [['refresh', 1]] : [['fitout', .78], ['joinery', .22]];
    split.forEach(([k, p]) => add(k, gMin * p, gMax * p));

    let kb = [0, 0];
    if (s.service !== 'commercial' && s.kitchens > 0) {
      const k = s.service === 'rental' ? R.rentalKitchen : R.kitchen[s.finish];
      add('kitchen', k[0] * s.kitchens, k[1] * s.kitchens); kb[0] += k[0] * s.kitchens; kb[1] += k[1] * s.kitchens;
    }
    if (s.bathrooms > 0) {
      const b = s.service === 'rental' ? R.rentalBathroom : R.bathroom[s.finish];
      const m = s.service === 'commercial' ? .8 : 1;
      add('bathrooms', b[0] * s.bathrooms * m, b[1] * s.bathrooms * m); kb[0] += b[0] * s.bathrooms * m; kb[1] += b[1] * s.bathrooms * m;
    }
    if (s.design === 'need') {
      const d = R.designPerM2[s.finish], m = s.service === 'rental' ? .5 : 1;
      add('design', d[0] * A * m, d[1] * A * m);
    }
    if (s.service !== 'rental' || s.extras.includes('layout')) {
      const ap = R.approvals[s.service === 'commercial' ? 'commercial' : s.property] || R.approvals.apartment;
      add('approvals', ap[0], ap[1]);
    }
    const baseMin = gMin + kb[0], baseMax = gMax + kb[1];
    s.extras.forEach(x => {
      const e = R.extras[x]; if (!e) return;
      if (x === 'outdoor' && !['villa', 'townhouse'].includes(s.property)) return;
      if (x === 'furniture' && s.service === 'commercial') return;
      const key = x === 'joinery' ? 'joinery2' : x;
      if (e.type === 'pct') add(key, baseMin * e.value[0], baseMax * e.value[1]);
      else if (e.type === 'm2') add(key, e.value[0] * A, e.value[1] * A);
      else add(key, e.value[0], e.value[1]);
    });
    const r1000 = n => Math.round(n / 1000) * 1000;
    items.forEach(i => { i.min = r1000(i.min); i.max = r1000(i.max); });
    const total = { min: items.reduce((a, i) => a + i.min, 0), max: items.reduce((a, i) => a + i.max, 0) };
    const W = R.weeks;
    let w = W.base + W.perM2 * A;
    if (s.service === 'rental') w *= .45;
    if (s.finish === 'luxury') w *= 1.2;
    if (s.design === 'need') w += 4;
    if (s.extras.includes('layout')) w += 3;
    w = Math.min(W.max, Math.max(W.min, Math.round(w)));
    return { total, perM2: { min: Math.round(total.min / A), max: Math.round(total.max / A) }, weeks: { min: w, max: Math.round(w * 1.25) }, items, area: A };
  }

  /* ---------------- rendering ---------------- */
  let root;
  function card(group, value, title, desc, selected, ic) {
    return `<button type="button" class="choice${selected ? ' on' : ''}" data-group="${group}" data-value="${value}" aria-pressed="${selected}">
      ${ic ? `<span class="choice-ic">${icon(ic)}</span>` : ''}
      <span class="choice-t">${title}</span>${desc ? `<span class="choice-d">${desc}</span>` : ''}</button>`;
  }
  function stepper(name, label, val) {
    return `<div class="stepper"><span class="label">${label}</span>
      <div class="stepper-ctl"><button type="button" data-dec="${name}" aria-label="−">−</button><output>${val}</output><button type="button" data-inc="${name}" aria-label="+">+</button></div></div>`;
  }

  function render() {
    const key = STEPS[state.step];
    const total = STEPS.length - 1;
    let body = '';
    if (key === 'service') {
      body = `<h3 class="q">${t('est.q.service')}</h3><div class="choices">${SERVICES.map(s => card('service', s, svcLabel(s), t('est.svc.' + s + '.d'), state.service === s, s)).join('')}</div>`;
    } else if (key === 'property') {
      body = `<h3 class="q">${t('est.q.property')}</h3><div class="choices grid-2">${PROPS[state.service].map(p => card('property', p, typeLabel(p), '', state.property === p, p)).join('')}</div>`;
    } else if (key === 'size') {
      const shown = state.unit === 'm2' ? state.area : Math.round(state.area * 10.7639);
      const max = state.unit === 'm2' ? 1500 : 16000, min = state.unit === 'm2' ? 20 : 200, stepv = state.unit === 'm2' ? 5 : 50;
      body = `<h3 class="q">${t('est.q.size')}</h3>
        <div class="area-box">
          <div class="area-top"><label class="label" for="est-area">${t('est.area')}</label>
            <div class="unit-toggle" role="group"><button type="button" data-unit="m2" class="${state.unit === 'm2' ? 'on' : ''}">${t('est.unitM2')}</button><button type="button" data-unit="sqft" class="${state.unit === 'sqft' ? 'on' : ''}">${t('est.unitSqft')}</button></div></div>
          <div class="area-input"><input id="est-area" type="number" inputmode="numeric" min="${min}" max="${max * 3}" value="${shown}"><span>${state.unit === 'm2' ? t('est.unitM2') : t('est.unitSqft')}</span></div>
          <input type="range" id="est-range" min="${min}" max="${max}" step="${stepv}" value="${Math.min(shown, max)}" aria-label="${t('est.area')}">
        </div>
        <div class="steppers">${state.service !== 'commercial' ? stepper('kitchens', t('est.kitchens'), state.kitchens) : ''}${stepper('bathrooms', t('est.bathrooms'), state.bathrooms)}</div>`;
    } else if (key === 'design') {
      body = `<h3 class="q">${t('est.q.design')}</h3>
        <div class="choices grid-2">${card('design', 'have', t('est.design.have'), t('est.design.have.d'), state.design === 'have')}${card('design', 'need', t('est.design.need'), t('est.design.need.d'), state.design === 'need')}</div>
        <h3 class="q mt">${t('est.q.finish')}</h3>
        <div class="choices">${FINISHES.map(f => card('finish', f, t('est.fin.' + f), t('est.fin.' + f + '.d'), state.finish === f)).join('')}</div>`;
    } else if (key === 'extras') {
      const list = EXTRAS.filter(x => !(x === 'outdoor' && !['villa', 'townhouse'].includes(state.property)) && !(x === 'furniture' && state.service === 'commercial') && !(x === 'joinery' && state.service === 'commercial'));
      body = `<h3 class="q">${t('est.q.extras')}</h3><p class="muted small">${t('est.extras.hint')}</p>
        <div class="toggles">${list.map(x => `<button type="button" class="toggle${state.extras.includes(x) ? ' on' : ''}" data-extra="${x}" aria-pressed="${state.extras.includes(x)}"><i></i>${t('est.x.' + x)}</button>`).join('')}</div>
        <h3 class="q mt">${t('est.q.start')}</h3>
        <div class="toggles">${['asap', '3m', 'later'].map(x => `<button type="button" class="toggle radio${state.start === x ? ' on' : ''}" data-start-opt="${x}" aria-pressed="${state.start === x}"><i></i>${t('est.start.' + x)}</button>`).join('')}</div>`;
    } else {
      body = renderResult();
    }
    const canNext = key === 'service' ? !!state.service : key === 'property' ? !!state.property : key === 'size' ? state.area >= 10 : true;
    root.innerHTML = `
      ${key !== 'result' ? `<div class="progress"><span>${t('est.step')} ${state.step + 1} ${t('est.of')} ${total}</span><div class="bar"><i style="width:${((state.step + 1) / total) * 100}%"></i></div></div>` : ''}
      <div class="wiz-body">${body}</div>
      ${key !== 'result' ? `<div class="wiz-nav">
        ${state.step > 0 ? `<button type="button" class="btn btn-ghost" data-nav="back">${t('est.back')}</button>` : '<span></span>'}
        <button type="button" class="btn btn-solid" data-nav="next" ${canNext ? '' : 'disabled'}>${state.step === total - 1 ? t('est.calc') : t('est.next')}</button></div>` : ''}`;
    if (key === 'result') bindLead();
  }

  let lastResult = null;
  function renderResult() {
    const r = compute(state); lastResult = r;
    const maxItem = Math.max(...r.items.map(i => i.max));
    window.F.track('estimate_calculated', { service: state.service, property: state.property, value: r.total.min });
    return `<div class="result">
      <p class="eyebrow">${t('est.res.eyebrow')}</p>
      <p class="result-meta">${svcLabel(state.service)} · ${typeLabel(state.property)} · ${fmt(r.area)} ${t('est.unitM2')} · ${t('est.fin.' + state.finish)}</p>
      <div class="result-total"><span class="label">${t('est.res.range')}</span>
        <div class="big">AED ${fmt(r.total.min)} <em>–</em> ${fmt(r.total.max)}</div></div>
      <div class="result-kpis">
        <div><span class="label">${t('est.res.perm2')}</span><b>AED ${fmt(r.perM2.min)} – ${fmt(r.perM2.max)}</b></div>
        <div><span class="label">${t('est.res.weeks')}</span><b>${r.weeks.min}–${r.weeks.max} ${t('est.res.weeksUnit')}</b></div>
      </div>
      <p class="label mt">${t('est.res.breakdown')}</p>
      <ul class="breakdown">${r.items.map(i => `<li><div class="bd-row"><span>${t('br.' + i.key)}</span><b>${fmt(i.min)} – ${fmt(i.max)}</b></div><div class="bd-bar"><i style="width:${Math.max(3, (i.max / maxItem) * 100)}%"></i></div></li>`).join('')}</ul>
      <p class="disclaimer">${t('est.res.disclaimer')}</p>
      <div class="lead-box">
        <h3 class="h3">${t('est.res.lead')}</h3><p class="muted">${t('est.res.lead.d')}</p>
        <form class="form" id="est-lead" novalidate>
          <label class="field"><span class="label">${t('f.name')}</span><input name="name" autocomplete="name" placeholder="${t('f.name.ph')}" required></label>
          <label class="field"><span class="label">${t('f.phone')}</span>${window.F.phoneField()}</label>
          <label class="field"><span class="label">${t('f.email')} · ${t('f.optional')}</span><input name="email" type="email" autocomplete="email" placeholder="name@email.com"></label>
          <label class="field"><span class="label">${t('f.community')} · ${t('f.optional')}</span><input name="community" placeholder="${t('f.community.ph')}"></label>
          <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
          <button class="btn btn-solid full" type="submit">${t('est.res.send')}</button>
          <p class="consent">${t('f.consent')} <a href="${window.F.link('/privacy')}">${t('nav.privacy')}</a>.</p>
        </form>
      </div>
      <div class="result-actions">
        <button type="button" class="btn btn-ghost" data-nav="restart">${t('est.res.restart')}</button>
        <button type="button" class="btn btn-ghost" data-nav="back">${t('est.back')}</button>
      </div></div>`;
  }

  function estimateText(r) {
    return `${svcLabel(state.service)} · ${typeLabel(state.property)} · ${r.area} m² · ${t('est.fin.' + state.finish)}\nAED ${fmt(r.total.min)} – ${fmt(r.total.max)}`;
  }

  function successHtml(payload, phoneStatus) {
    return `<div class="success"><span class="success-ic">✓</span><h3 class="h3">${t('f.ok.t')}</h3><p>${t('f.ok.d')}</p>
      ${phoneStatus === 'needs_check' ? `<p class="warn">${t('f.ok.check')}</p>` : ''}
      <a class="btn btn-solid" target="_blank" rel="noopener" href="https://wa.me/${window.F.settings.whatsapp}?text=${window.F.waText(payload)}">${t('f.ok.wa')}</a></div>`;
  }
  function errorHtml(payload) {
    return `<p class="warn">${t('f.err')}</p><a class="btn btn-solid" target="_blank" rel="noopener" href="https://wa.me/${window.F.settings.whatsapp}?text=${window.F.waText(payload)}">WhatsApp</a>`;
  }

  async function sendForm(form, payload, done) {
    const btn = form.querySelector('[type=submit]');
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = t('f.sending');
    try {
      const res = await window.F.submitLead(payload);
      done.innerHTML = successHtml(payload, res.phoneStatus);
      done.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {
      btn.disabled = false; btn.textContent = label;
      let er = form.querySelector('.form-error');
      if (!er) { er = document.createElement('div'); er.className = 'form-error'; form.appendChild(er); }
      er.innerHTML = errorHtml(payload);
    }
  }

  function markInvalid(form) {
    let ok = true;
    form.querySelectorAll('[required]').forEach(el => {
      const bad = !el.value.trim();
      el.closest('.field').classList.toggle('invalid', bad);
      if (bad) ok = false;
    });
    return ok;
  }

  function bindLead() {
    const form = root.querySelector('#est-lead');
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!markInvalid(form)) return;
      const fd = new FormData(form);
      const r = lastResult;
      const payload = {
        formType: 'estimate', name: fd.get('name'), phoneCode: fd.get('phoneCode'), phone: fd.get('phone'), email: fd.get('email'),
        community: fd.get('community'), website: fd.get('website'),
        propertyType: typeLabel(state.property), service: svcLabel(state.service), area: String(r.area),
        start: state.start ? t('est.start.' + state.start) : '',
        message: `${state.design === 'need' ? t('est.design.need') : t('est.design.have')} · ${t('est.fin.' + state.finish)} · ${t('est.kitchens')}: ${state.kitchens} · ${t('est.bathrooms')}: ${state.bathrooms}${state.extras.length ? ' · ' + state.extras.map(x => t('est.x.' + x)).join(', ') : ''}`,
        estimate: { total: r.total, perM2: r.perM2, weeks: r.weeks, items: r.items, inputs: Object.assign({}, state) },
        estimateText: estimateText(r)
      };
      sendForm(form, payload, root.querySelector('.lead-box'));
    });
  }

  function onClick(e) {
    const b = e.target.closest('button'); if (!b || !root.contains(b)) return;
    if (b.dataset.group) {
      state[b.dataset.group] = b.dataset.value;
      if (b.dataset.group === 'service') { state.property = ''; state.extras = []; }
      if (b.dataset.group === 'property') {
        state.area = DEFAULT_AREA[state.property];
        state.bathrooms = state.property === 'villa' ? 4 : state.property === 'townhouse' ? 3 : state.service === 'commercial' ? 1 : 2;
        state.kitchens = state.service === 'commercial' ? 0 : 1;
      }
      render();
      if (['service', 'property'].includes(b.dataset.group)) setTimeout(() => go(1), 180);
      return;
    }
    if (b.dataset.unit) { state.unit = b.dataset.unit; render(); return; }
    if (b.dataset.inc) { state[b.dataset.inc] = Math.min(12, state[b.dataset.inc] + 1); render(); return; }
    if (b.dataset.dec) { state[b.dataset.dec] = Math.max(0, state[b.dataset.dec] - 1); render(); return; }
    if (b.dataset.extra) { const x = b.dataset.extra; state.extras = state.extras.includes(x) ? state.extras.filter(y => y !== x) : state.extras.concat(x); render(); return; }
    if (b.dataset.startOpt) { state.start = b.dataset.startOpt; render(); return; }
    if (b.dataset.nav === 'next') go(1);
    if (b.dataset.nav === 'back') go(-1);
    if (b.dataset.nav === 'restart') { Object.assign(state, { step: 0, service: '', property: '', extras: [], start: '' }); render(); scrollTop(); }
  }
  function go(d) { state.step = Math.max(0, Math.min(STEPS.length - 1, state.step + d)); render(); scrollTop(); }
  function scrollTop() {
    const box = root.closest('.estimate-box');
    if (box && box.getBoundingClientRect().top < 0) box.scrollIntoView({ behavior: 'smooth' });
  }
  function onInput(e) {
    if (e.target.id === 'est-area' || e.target.id === 'est-range') {
      const v = Number(e.target.value) || 0;
      state.area = state.unit === 'm2' ? v : Math.round(v / 10.7639);
      const other = root.querySelector(e.target.id === 'est-area' ? '#est-range' : '#est-area');
      if (other) other.value = v;
      const next = root.querySelector('[data-nav=next]'); if (next) next.disabled = state.area < 10;
    }
  }

  /* ---------------- consultation form ---------------- */
  function renderConsult(el) {
    const props = ['apartment', 'villa', 'townhouse', 'office', 'retail', 'salon', 'restaurant'];
    const svcs = [['full', svcLabel('full')], ['rental', svcLabel('rental')], ['commercial', svcLabel('commercial')], ['design', t('svc.design')], ['concept', t('svc.concept')], ['other', t('svc.other')]];
    el.innerHTML = `<form class="form" id="consult-form" novalidate>
      <div class="project-ref" hidden><span class="label">${t('f.project')}</span><b></b></div>
      <label class="field"><span class="label">${t('f.name')}</span><input name="name" autocomplete="name" placeholder="${t('f.name.ph')}" required></label>
      <label class="field"><span class="label">${t('f.phone')}</span>${window.F.phoneField()}</label>
      <label class="field"><span class="label">${t('f.property')}</span><div class="select-wrap"><select name="propertyType">${props.map(p => `<option value="${p}">${typeLabel(p)}</option>`).join('')}</select></div></label>
      <label class="field"><span class="label">${t('f.service')}</span><div class="select-wrap"><select name="service">${svcs.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div></label>
      <label class="field"><span class="label">${t('f.message')} · ${t('f.optional')}</span><textarea name="message" rows="3" placeholder="${t('f.message.ph')}"></textarea></label>
      <input type="hidden" name="project">
      <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <button class="btn btn-solid full" type="submit">${t('f.submit')}</button>
      <p class="consent">${t('f.consent')} <a href="${window.F.link('/privacy')}">${t('nav.privacy')}</a>.</p>
    </form>`;
    const form = el.querySelector('form');
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!markInvalid(form)) return;
      const fd = new FormData(form);
      const svcSel = form.service.selectedOptions[0];
      const payload = {
        formType: 'consultation', name: fd.get('name'), phoneCode: fd.get('phoneCode'), phone: fd.get('phone'), website: fd.get('website'),
        propertyType: form.propertyType.selectedOptions[0].textContent, service: svcSel.textContent, message: fd.get('message'), project: fd.get('project')
      };
      sendForm(form, payload, el);
    });
  }

  /* ---------------- public API ---------------- */
  function switchTab(name) {
    document.querySelectorAll('.estimate-box .tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.pane === name)));
    document.getElementById('pane-calc').hidden = name !== 'calc';
    document.getElementById('pane-consult').hidden = name !== 'consult';
  }

  window.Estimator = {
    init(content) {
      R = content.estimator;
      window.F.settings = content.settings;
      root = document.getElementById('pane-calc');
      if (!root) return;
      root.addEventListener('click', onClick);
      root.addEventListener('input', onInput);
      render();
      renderConsult(document.getElementById('pane-consult'));
      document.querySelectorAll('.estimate-box .tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.pane)));
    },
    consult({ project, service } = {}) {
      switchTab('consult');
      const form = document.getElementById('consult-form');
      if (!form) return;
      if (form.closest('.pane').querySelector('.success')) renderConsult(document.getElementById('pane-consult'));
      const f = document.getElementById('consult-form');
      if (project) { f.project.value = project; const ref = f.querySelector('.project-ref'); ref.hidden = false; ref.querySelector('b').textContent = project; }
      if (service) f.service.value = service;
      document.getElementById('estimate').scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => f.name.focus({ preventScroll: true }), 700);
    },
    compute: s => compute(s)
  };
})();
