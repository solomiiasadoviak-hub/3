'use strict';
/*
 * Formica — zero-dependency Node server.
 *  - serves the static site from /public
 *  - stores content (projects, videos, team, settings, estimator rates) in DATA_DIR/content.json
 *  - stores every lead in DATA_DIR/leads.jsonl BEFORE forwarding it anywhere, so nothing is lost
 *  - forwards leads to Kommo / any webhook / Telegram / Meta Conversions API when configured
 *  - admin panel at /admin protected by ADMIN_PASSWORD (HTTP Basic auth, user "admin")
 */
const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const UPLOADS = path.join(DATA_DIR, 'uploads');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const LEADS_FILE = path.join(DATA_DIR, 'leads.jsonl');
const SEED_FILE = path.join(ROOT, 'seed', 'content.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

fs.mkdirSync(UPLOADS, { recursive: true });
if (!fs.existsSync(CONTENT_FILE)) fs.copyFileSync(SEED_FILE, CONTENT_FILE);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2'
};

const PAGES = {
  '/': 'index.html', '/en': 'index.html', '/ru': 'index.html',
  '/videos': 'videos.html', '/privacy': 'privacy.html', '/admin': 'admin.html'
};

/* ---------- helpers ---------- */
function send(res, status, body, headers = {}) {
  const isObj = body !== null && typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  });
  res.end(isObj ? JSON.stringify(body) : body);
}

function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Payload too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const buf = await readBody(req);
  try { return JSON.parse(buf.toString('utf8') || '{}'); }
  catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}

function isAdmin(req) {
  if (!ADMIN_PASSWORD) return false;
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const [, pass = ''] = Buffer.from(h.slice(6), 'base64').toString().split(/:(.*)/s);
  const a = Buffer.from(pass), b = Buffer.from(ADMIN_PASSWORD);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  if (!ADMIN_PASSWORD) { send(res, 503, 'Admin is disabled: set the ADMIN_PASSWORD environment variable.'); return false; }
  send(res, 401, 'Authentication required', { 'WWW-Authenticate': 'Basic realm="Formica admin", charset="UTF-8"' });
  return false;
}

async function serveFile(res, file, req) {
  try {
    const st = await fsp.stat(file);
    if (!st.isFile()) throw new Error('not file');
    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const cache = ext === '.html' ? 'no-cache' : 'public, max-age=86400';
    // Range support so video seeking works on iOS Safari
    const range = req.headers.range;
    if (range && /^bytes=/.test(range)) {
      const [s, e] = range.replace('bytes=', '').split('-');
      const start = parseInt(s, 10) || 0;
      const end = e ? Math.min(parseInt(e, 10), st.size - 1) : st.size - 1;
      if (start >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': cache });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  } catch {
    send(res, 404, 'Not found');
  }
}

function safeJoin(base, p) {
  const full = path.normalize(path.join(base, decodeURIComponent(p)));
  return full.startsWith(base + path.sep) || full === base ? full : null;
}

/* ---------- leads ---------- */
function clean(v, max = 2000) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
}

function checkPhone(code, number) {
  const digits = (String(code || '') + String(number || '')).replace(/\D/g, '');
  const local = String(number || '').replace(/\D/g, '');
  if (!local) return { phone: '', phoneStatus: 'missing' };
  const ok = digits.length >= 9 && digits.length <= 15 && local.length >= 6;
  return { phone: '+' + digits, phoneStatus: ok ? 'ok' : 'needs_check' };
}

async function appendLead(lead) {
  await fsp.appendFile(LEADS_FILE, JSON.stringify(lead) + '\n', 'utf8');
}

async function readLeads() {
  try {
    const txt = await fsp.readFile(LEADS_FILE, 'utf8');
    const byId = new Map();
    for (const line of txt.split('\n')) {
      if (!line.trim()) continue;
      try { const l = JSON.parse(line); byId.set(l.id, { ...(byId.get(l.id) || {}), ...l }); } catch { /* skip */ }
    }
    return [...byId.values()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch { return []; }
}

function leadSummary(l) {
  const rows = [
    `New lead — ${l.formType}`,
    `Name: ${l.name}`,
    `Phone: ${l.phone || '—'}${l.phoneStatus === 'needs_check' ? ' (NEEDS CHECK)' : ''}`,
    l.email && `Email: ${l.email}`,
    l.propertyType && `Property: ${l.propertyType}`,
    l.service && `Service: ${l.service}`,
    l.area && `Area: ${l.area} m²`,
    l.community && `Community: ${l.community}`,
    l.start && `Start: ${l.start}`,
    l.project && `Viewed project: ${l.project}`,
    l.estimate && l.estimate.total && `Estimate: AED ${l.estimate.total.min.toLocaleString('en')} – ${l.estimate.total.max.toLocaleString('en')}`,
    l.message && `Message: ${l.message}`,
    `Source: ${l.source.page}${l.source.utm_source ? ` · utm_source=${l.source.utm_source}` : ''}${l.source.utm_campaign ? ` · utm_campaign=${l.source.utm_campaign}` : ''}`,
    `Lang: ${l.lang}`
  ];
  return rows.filter(Boolean).join('\n');
}

async function postJson(url, payload, headers = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload), signal: ctrl.signal });
    return { ok: r.ok, status: r.status };
  } finally { clearTimeout(t); }
}

const sha256 = s => crypto.createHash('sha256').update(String(s).trim().toLowerCase()).digest('hex');

async function forwardLead(lead, req) {
  const results = {};
  const tasks = [];
  // Kommo: create an "Incoming lead" via a Kommo webhook/Integration URL, or any generic webhook (Make, Zapier, n8n).
  if (process.env.KOMMO_WEBHOOK_URL) tasks.push(['kommo', () => postJson(process.env.KOMMO_WEBHOOK_URL, { ...lead, summary: leadSummary(lead) })]);
  if (process.env.LEAD_WEBHOOK_URL) tasks.push(['webhook', () => postJson(process.env.LEAD_WEBHOOK_URL, { ...lead, summary: leadSummary(lead) })]);
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    tasks.push(['telegram', () => postJson(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { chat_id: process.env.TELEGRAM_CHAT_ID, text: leadSummary(lead) })]);
  }
  if (process.env.META_PIXEL_ID && process.env.META_CAPI_TOKEN) {
    const user_data = {
      client_ip_address: (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(),
      client_user_agent: req.headers['user-agent'] || ''
    };
    if (lead.phone) user_data.ph = [sha256(lead.phone.replace(/\D/g, ''))];
    if (lead.email) user_data.em = [sha256(lead.email)];
    if (lead.source.fbp) user_data.fbp = lead.source.fbp;
    if (lead.source.fbc) user_data.fbc = lead.source.fbc;
    tasks.push(['meta_capi', () => postJson(`https://graph.facebook.com/v19.0/${process.env.META_PIXEL_ID}/events?access_token=${encodeURIComponent(process.env.META_CAPI_TOKEN)}`, {
      data: [{ event_name: 'Lead', event_time: Math.floor(Date.now() / 1000), event_id: lead.id, action_source: 'website', event_source_url: lead.source.url, user_data,
        custom_data: { content_category: lead.service || lead.formType, currency: 'AED', value: lead.estimate && lead.estimate.total ? lead.estimate.total.min : 0 } }]
    })]);
  }
  await Promise.all(tasks.map(async ([name, fn]) => {
    try { results[name] = await fn(); } catch (e) { results[name] = { ok: false, error: e.message }; }
  }));
  return results;
}

async function handleLead(req, res) {
  const b = await readJson(req);
  if (b.website) return send(res, 200, { ok: true }); // honeypot
  const name = clean(b.name, 120);
  const { phone, phoneStatus } = checkPhone(clean(b.phoneCode, 6), clean(b.phone, 40));
  if (!name && !phone && !clean(b.email)) return send(res, 400, { ok: false, error: 'Please leave a name or a phone number.' });
  const src = b.source || {};
  const lead = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: 'new',
    formType: clean(b.formType, 40) || 'consultation',
    lang: clean(b.lang, 5) || 'en',
    name, phone, phoneRaw: clean(b.phone, 40), phoneStatus,
    email: clean(b.email, 160),
    propertyType: clean(b.propertyType, 80),
    service: clean(b.service, 80),
    area: clean(b.area, 20),
    community: clean(b.community, 120),
    start: clean(b.start, 80),
    project: clean(b.project, 160),
    message: clean(b.message, 3000),
    estimate: b.estimate && typeof b.estimate === 'object' ? JSON.parse(JSON.stringify(b.estimate).slice(0, 8000)) : null,
    source: {
      page: clean(src.page, 300), url: clean(src.url, 600), referrer: clean(src.referrer, 600),
      utm_source: clean(src.utm_source, 120), utm_medium: clean(src.utm_medium, 120), utm_campaign: clean(src.utm_campaign, 200),
      utm_content: clean(src.utm_content, 200), utm_term: clean(src.utm_term, 200), fbclid: clean(src.fbclid, 300), gclid: clean(src.gclid, 300),
      fbp: clean(src.fbp, 200), fbc: clean(src.fbc, 300)
    }
  };
  // 1) store first — the lead is never lost even if every integration fails
  await appendLead(lead);
  send(res, 200, { ok: true, id: lead.id, phoneStatus });
  // 2) forward in the background, record the outcome
  forwardLead(lead, req).then(r => {
    if (Object.keys(r).length) appendLead({ id: lead.id, delivery: r, deliveredAt: new Date().toISOString() }).catch(() => {});
  }).catch(() => {});
}

function toCsv(leads) {
  const cols = ['createdAt', 'status', 'formType', 'name', 'phone', 'phoneStatus', 'email', 'propertyType', 'service', 'area', 'community', 'start', 'project', 'message', 'estimateMin', 'estimateMax', 'utm_source', 'utm_campaign', 'page', 'lang'];
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = leads.map(l => cols.map(c => {
    if (c === 'estimateMin') return esc(l.estimate?.total?.min);
    if (c === 'estimateMax') return esc(l.estimate?.total?.max);
    if (c === 'utm_source' || c === 'utm_campaign' || c === 'page') return esc(l.source?.[c]);
    return esc(l[c]);
  }).join(','));
  return '﻿' + [cols.join(','), ...rows].join('\n');
}

/* ---------- router ---------- */
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname.replace(/\/+$/, '') || '/';

    if (p === '/healthz') return send(res, 200, 'ok');

    // public API
    if (p === '/api/content' && req.method === 'GET') {
      const txt = await fsp.readFile(CONTENT_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
      return res.end(txt);
    }
    if (p === '/api/lead' && req.method === 'POST') return await handleLead(req, res);

    // admin API
    if (p.startsWith('/api/admin') || p === '/admin') {
      if (!requireAdmin(req, res)) return;
    }
    if (p === '/api/admin/content' && req.method === 'PUT') {
      const body = await readBody(req, 5e6);
      let parsed;
      try { parsed = JSON.parse(body.toString('utf8')); } catch { return send(res, 400, { ok: false, error: 'Invalid JSON' }); }
      if (!parsed || !Array.isArray(parsed.projects) || !parsed.settings) return send(res, 400, { ok: false, error: 'Content must have "projects" and "settings".' });
      try { await fsp.copyFile(CONTENT_FILE, CONTENT_FILE + '.bak'); } catch { /* first save */ }
      await fsp.writeFile(CONTENT_FILE + '.tmp', JSON.stringify(parsed, null, 2));
      await fsp.rename(CONTENT_FILE + '.tmp', CONTENT_FILE);
      return send(res, 200, { ok: true });
    }
    if (p === '/api/admin/leads' && req.method === 'GET') return send(res, 200, await readLeads());
    if (p === '/api/admin/leads.csv' && req.method === 'GET') {
      return send(res, 200, toCsv(await readLeads()), { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="formica-leads.csv"' });
    }
    if (p === '/api/admin/lead-status' && req.method === 'POST') {
      const b = await readJson(req);
      await appendLead({ id: clean(b.id, 60), status: clean(b.status, 30) });
      return send(res, 200, { ok: true });
    }
    if (p === '/api/admin/upload' && req.method === 'POST') {
      let orig = 'file';
      try { orig = clean(decodeURIComponent(req.headers['x-filename'] || 'file'), 200); } catch { /* keep default */ }
      const ext = path.extname(orig).toLowerCase();
      if (!['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.mp4', '.webm', '.mov'].includes(ext)) return send(res, 400, { ok: false, error: 'Unsupported file type' });
      const buf = await readBody(req, 300e6);
      const base = path.basename(orig, ext).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'file';
      const name = `${Date.now().toString(36)}-${base}${ext}`;
      await fsp.writeFile(path.join(UPLOADS, name), buf);
      return send(res, 200, { ok: true, url: `/uploads/${name}` });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');

    // pages
    if (PAGES[p]) return serveFile(res, path.join(PUBLIC, PAGES[p]), req);
    if (/^\/(en\/|ru\/)?project\/[a-z0-9-]+$/.test(p)) return serveFile(res, path.join(PUBLIC, 'project.html'), req);
    if (p.startsWith('/uploads/')) {
      const f = safeJoin(UPLOADS, p.slice('/uploads/'.length));
      return f ? serveFile(res, f, req) : send(res, 404, 'Not found');
    }
    const f = safeJoin(PUBLIC, p.slice(1));
    if (!f) return send(res, 404, 'Not found');
    return serveFile(res, f, req);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { ok: false, error: e.status ? e.message : 'Server error' });
  }
});

server.listen(PORT, () => console.log(`Formica site on http://localhost:${PORT}  (data: ${DATA_DIR})`));
