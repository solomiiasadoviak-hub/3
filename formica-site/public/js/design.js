/* Site design settings (fonts, colours, sizes) edited in the admin "Дизайн" tab.
   Shared by the site and the admin preview. Every font listed here supports Cyrillic,
   except Marcellus, which falls back to Cormorant Garamond for Russian text. */
(function () {
  const FONTS = [
    // name, kind (serif|sans), Google Fonts axis spec ('' = single weight)
    ['Marcellus', 'serif', ''],
    ['Cormorant Garamond', 'serif', ':wght@400;500;600'],
    ['Playfair Display', 'serif', ':wght@400;500;600'],
    ['Prata', 'serif', ''],
    ['Forum', 'serif', ''],
    ['Lora', 'serif', ':wght@400;500;600'],
    ['PT Serif', 'serif', ':wght@400;700'],
    ['Spectral', 'serif', ':wght@300;400;500;600'],
    ['Tenor Sans', 'sans', ''],
    ['Manrope', 'sans', ':wght@300;400;500;600'],
    ['Inter', 'sans', ':wght@300;400;500;600'],
    ['Montserrat', 'sans', ':wght@300;400;500;600'],
    ['Raleway', 'sans', ':wght@300;400;500;600'],
    ['Jost', 'sans', ':wght@300;400;500;600'],
    ['Rubik', 'sans', ':wght@300;400;500;600'],
    ['Open Sans', 'sans', ':wght@300;400;500;600'],
    ['Roboto', 'sans', ':wght@300;400;500;700'],
    ['Nunito Sans', 'sans', ':wght@300;400;600'],
    ['PT Sans', 'sans', ':wght@400;700'],
    ['Oswald', 'sans', ':wght@300;400;500;600'],
    ['Unbounded', 'sans', ':wght@300;400;500;600']
  ];

  const DEFAULTS = {
    fontHeading: 'Marcellus', fontBody: 'Manrope', fontLabel: 'Manrope',
    bg: '#0b0b0c', bg2: '#111113', text: '#f1eee8', muted: '#a9a59f', accent: '#c9b38a',
    btnBg: '#f2efe9', btnText: '#111111',
    headingScale: 100, textScale: 100, uppercase: true
  };

  const PRESETS = {
    'Тёмная (как сейчас)': DEFAULTS,
    'Светлая': { fontHeading: 'Marcellus', fontBody: 'Manrope', fontLabel: 'Manrope', bg: '#f6f3ee', bg2: '#ece7df', text: '#1d1b18', muted: '#6b655d', accent: '#9c7b45', btnBg: '#1d1b18', btnText: '#f6f3ee', headingScale: 100, textScale: 100, uppercase: true },
    'Графит и бронза': { fontHeading: 'Cormorant Garamond', fontBody: 'Inter', fontLabel: 'Inter', bg: '#1b1c1e', bg2: '#232427', text: '#ecebe8', muted: '#a3a19c', accent: '#b98a5a', btnBg: '#b98a5a', btnText: '#1b1c1e', headingScale: 108, textScale: 100, uppercase: false },
    'Белая минималистичная': { fontHeading: 'Tenor Sans', fontBody: 'Montserrat', fontLabel: 'Montserrat', bg: '#ffffff', bg2: '#f3f3f1', text: '#111111', muted: '#666666', accent: '#111111', btnBg: '#111111', btnText: '#ffffff', headingScale: 95, textScale: 100, uppercase: true },
    'Тёмно-синяя': { fontHeading: 'Playfair Display', fontBody: 'Raleway', fontLabel: 'Raleway', bg: '#0d1420', bg2: '#131c2b', text: '#eef1f5', muted: '#a2acbb', accent: '#c9a96e', btnBg: '#c9a96e', btnText: '#0d1420', headingScale: 100, textScale: 100, uppercase: false }
  };

  const known = name => FONTS.find(f => f[0] === name);
  function stack(name, fallbackKind) {
    const f = known(name);
    const kind = f ? f[1] : fallbackKind;
    const cyr = name === 'Marcellus' ? ", 'Cormorant Garamond'" : '';
    return `'${String(name).replace(/'/g, '')}'${cyr}, ${kind === 'serif' ? 'Georgia, serif' : "system-ui, -apple-system, 'Segoe UI', sans-serif"}`;
  }
  function loadFont(name) {
    const f = known(name); if (!f) return;
    const id = 'gf-' + name.replace(/\s+/g, '-');
    if (document.getElementById(id)) return;
    const l = document.createElement('link');
    l.id = id; l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, '+')}${f[2]}&display=swap`;
    document.head.appendChild(l);
  }
  const hex = v => (/^#[0-9a-fA-F]{6}$/.test(v || '') ? v : null);

  function apply(design, target) {
    const d = Object.assign({}, DEFAULTS, design || {});
    const el = target || document.documentElement;
    const set = (k, v) => el.style.setProperty(k, v);
    [['--bg', d.bg], ['--bg-2', d.bg2], ['--text', d.text], ['--muted', d.muted], ['--gold', d.accent], ['--btn-bg', d.btnBg], ['--btn-text', d.btnText]]
      .forEach(([k, v]) => { if (hex(v)) set(k, v); });
    set('--display', stack(d.fontHeading, 'serif'));
    set('--body', stack(d.fontBody, 'sans'));
    set('--label', stack(d.fontLabel, 'sans'));
    set('--hs', String(Math.min(140, Math.max(70, Number(d.headingScale) || 100)) / 100));
    set('--ts', String(Math.min(130, Math.max(85, Number(d.textScale) || 100)) / 100));
    set('--hcase', d.uppercase === false ? 'none' : 'uppercase');
    [d.fontHeading, d.fontBody, d.fontLabel, d.fontHeading === 'Marcellus' ? 'Cormorant Garamond' : null].forEach(n => n && loadFont(n));
    if (!target) {
      const meta = document.querySelector('meta[name="theme-color"]'); if (meta && hex(d.bg)) meta.content = d.bg;
    }
    return d;
  }

  // Apply the last known design immediately to avoid a flash of the default theme.
  if (!window.__ADMIN__) { try { const cached = JSON.parse(localStorage.getItem('design') || 'null'); if (cached) apply(cached); } catch (e) { /* ignore */ } }

  window.Design = {
    FONTS, DEFAULTS, PRESETS, apply, loadFont, stack,
    remember(d) { try { localStorage.setItem('design', JSON.stringify(d || {})); } catch (e) { /* ignore */ } }
  };
})();
