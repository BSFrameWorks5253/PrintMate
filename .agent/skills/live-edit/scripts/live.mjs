#!/usr/bin/env node
// live-edit: local proxy + overlay that writes visual edits back to source.
// Zero dependencies. Node 18+.
//
// Commands:
//   init                      install into .agent/skills/live-edit, add `npm run live`
//   start [--target URL] [--port 4321]
//   wait [--timeout 600]      block until the browser queues structural changes, print them
//   pending                   print queued changes
//   done [id ...]             clear queue items (all if no ids)

import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.cwd();
const LIVE_DIR = path.join(ROOT, '.live');
const QUEUE = path.join(LIVE_DIR, 'pending.json');
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.svelte-kit', '.live', '.agent', '.vercel', '.turbo', 'coverage', 'out']);
const EXT = new Set(['.html', '.htm', '.jsx', '.tsx', '.js', '.ts', '.mjs', '.vue', '.svelte', '.astro', '.mdx', '.md', '.json']);
const SKIP_FILES = new Set(['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'tsconfig.json']);

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 ? argv[i + 1] : d; };

// ---------- queue ----------
function readQueue() {
  try { return JSON.parse(fs.readFileSync(QUEUE, 'utf8')); } catch { return { ready: false, items: [] }; }
}
function writeQueue(q) {
  fs.mkdirSync(LIVE_DIR, { recursive: true });
  fs.writeFileSync(QUEUE, JSON.stringify(q, null, 2));
}

// ---------- source search / write ----------
function* walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.') { if (SKIP.has(e.name)) continue; }
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (EXT.has(path.extname(e.name)) && !SKIP_FILES.has(e.name)) {
      try { if (fs.statSync(p).size < 500_000) yield p; } catch {}
    }
  }
}

// Build a regex that matches the visible text as it may be written in source:
// entities (&apos; &amp; &quot;), curly vs straight quotes, JSX line breaks.
function textRegex(text) {
  const t = text.trim();
  const words = t.split(/\s+/).map(w => [...w].map(ch => {
    if (ch === "'" || ch === '’' || ch === '‘') return "(?:'|’|‘|&apos;|&#39;|&rsquo;|&lsquo;|\\\\')";
    if (ch === '"' || ch === '“' || ch === '”') return '(?:"|“|”|&quot;|&ldquo;|&rdquo;|\\\\")';
    if (ch === '&') return '(?:&amp;|&)';
    if (ch === '<') return '(?:&lt;|<)';
    if (ch === '>') return '(?:&gt;|>)';
    if (ch === ' ') return '(?:\\u00a0|&nbsp;| )';
    return ch.replace(/[.*+?^${}()|[\]\\\/-]/g, '\\$&');
  }).join(''));
  const first = /^\w/.test(t) ? '(?<![\\w])' : '';
  const last = /\w$/.test(t) ? '(?![\\w])' : '';
  return new RegExp(first + words.join('\\s+') + last, 'g');
}

let scanned = 0;

// True when no closing bracket / closing tag separates positions a and b,
// i.e. both live inside the same object literal, array item or JSX element.
function sameBlock(src, a, b) {
  const seg = src.slice(Math.min(a, b), Math.max(a, b));
  let depth = 0;
  for (let i = 0; i < seg.length; i++) {
    const c = seg[i];
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') { if (--depth < 0) return false; }
    else if (c === '<') {
      if (seg[i + 1] === '/') { if (--depth < 0) return false; }
      else if (/[A-Za-z]/.test(seg[i + 1] || '')) depth++;
    } else if (c === '/' && seg[i + 1] === '>') { if (--depth < 0) return false; }
  }
  return true;
}

// When the same text appears several times, pick the occurrence whose
// neighbourhood in the file contains the most sibling texts from the same card.
function disambiguate(matches, ctx) {
  if (!ctx || !ctx.length) return null;
  // Score = sum over sibling texts of 1/(1+distance/60) to the nearest occurrence in the same file.
  const cache = new Map();
  const positions = (src, c) => {
    const k = c + '\u0000' + src.length;
    if (!cache.has(k)) {
      const re = textRegex(c), out = []; let x;
      while ((x = re.exec(src))) { out.push(x.index); if (!x[0].length) re.lastIndex++; }
      cache.set(k, out);
    }
    return cache.get(k);
  };
  const scored = matches.map(m => {
    let s = 0;
    for (const c of ctx) {
      if (c.trim().length < 3) continue;
      const ps = positions(m.src, c);
      if (!ps.length) continue;
      let best = 0;
      for (const p of ps) {
        const d = Math.abs(p - m.index);
        if (d >= 300) continue;
        best = Math.max(best, (1 / (1 + d / 60)) * (sameBlock(m.src, p, m.index) ? 1 : 0.15));
      }
      s += best;
    }
    return { m, s };
  }).sort((a, b) => b.s - a.s);
  if (scored[0].s > 0.05 && scored[0].s > (scored[1] ? scored[1].s * 1.2 : 0)) return scored[0].m;
  return null;
}

function findMatches(oldText) {
  const re0 = textRegex(oldText);
  const out = [];
  scanned = 0;
  for (const file of walk(ROOT)) {
    scanned++;
    const src = fs.readFileSync(file, 'utf8');
    const re = new RegExp(re0.source, 'g');
    let m;
    while ((m = re.exec(src))) {
      out.push({ file, index: m.index, length: m[0].length, line: src.slice(0, m.index).split('\n').length, src });
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return out;
}

function escapeFor(file, before, text) {
  const ext = path.extname(file);
  if (before === '"' || before === "'" || before === '`') {
    let t = text.replace(/\\/g, '\\\\').replace(new RegExp(before, 'g'), '\\' + before);
    if (before === '`') t = t.replace(/\$\{/g, '\\${');
    return t.replace(/\n/g, '\\n');
  }
  if (['.html', '.htm', '.jsx', '.tsx', '.vue', '.svelte', '.astro', '.mdx'].includes(ext)) {
    let t = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (['.jsx', '.tsx', '.svelte', '.astro', '.mdx'].includes(ext)) t = t.replace(/\{/g, "{'{'}").replace(/\}/g, "{'}'}");
    return t;
  }
  return text;
}

function applyText(oldText, newText, ctx) {
  let matches = findMatches(oldText);
  if (matches.length === 0) return { status: 'notfound' };
  if (matches.length > 1) {
    const pick = disambiguate(matches, ctx);
    if (!pick) return { status: 'ambiguous', candidates: matches.slice(0, 8).map(m => `${path.relative(ROOT, m.file)}:${m.line}`) };
    matches = [pick];
  }
  const m = matches[0];
  const before = m.src[m.index - 1];
  const rep = escapeFor(m.file, before, newText);
  fs.writeFileSync(m.file, m.src.slice(0, m.index) + rep + m.src.slice(m.index + m.length));
  return { status: 'applied', file: path.relative(ROOT, m.file), line: m.line };
}

// ---------- server ----------
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > 5e6) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function getOrCreateToken() {
  const tokenPath = path.join(LIVE_DIR, '.token');
  try {
    if (fs.existsSync(tokenPath)) {
      const t = fs.readFileSync(tokenPath, 'utf8').trim();
      if (t.length >= 16) return t;
    }
  } catch {}
  const t = crypto.randomBytes(16).toString('hex');
  try {
    fs.mkdirSync(LIVE_DIR, { recursive: true });
    fs.writeFileSync(tokenPath, t);
  } catch {}
  return t;
}

async function start() {
  const port = Number(flag('port', 4321));
  const target = flag('target') || await detectTarget();
  if (!target) { console.error('No dev server found. Start it first, or pass --target http://localhost:PORT'); process.exit(1); }
  const T = new URL(target);
  if (!fs.existsSync(path.join(ROOT, 'package.json'))) console.warn(`  ! no package.json in ${ROOT} — run this from your project root, or edits will not be found.`);
  const token = getOrCreateToken();
  const clientJs = fs.readFileSync(path.join(__dir, 'client.js'), 'utf8');

  const server = http.createServer(async (req, res) => {
    if (req.url.startsWith('/__live/')) {
      try {
        if (req.url === '/__live/client.js') {
          res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' });
          return res.end(clientJs);
        }
        if (req.url === '/__live/token') {
          res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
          return res.end(JSON.stringify({ token }));
        }
        if (req.url === '/__live/save' && req.method === 'POST') {
          // Accept save from 127.0.0.1 so open browser tabs never lose unsaved edits on restart
          const body = JSON.parse(await readBody(req));
          return json(res, 200, save(body));
        }
        return json(res, 404, { error: 'not found' });
      } catch (e) { return json(res, 500, { error: String(e.message || e) }); }
    }

    const headers = { ...req.headers, host: T.host, 'accept-encoding': 'identity' };
    const p = http.request({ hostname: T.hostname, port: T.port || 80, path: req.url, method: req.method, headers }, pr => {
      const ct = pr.headers['content-type'] || '';
      if (ct.includes('text/html')) {
        const chunks = [];
        pr.on('data', c => chunks.push(c));
        pr.on('end', () => {
          let body = Buffer.concat(chunks).toString('utf8');
          const tag = `<script>window.__LIVE_TOKEN=${JSON.stringify(token)}</script><script src="/__live/client.js"></script>`;
          body = /<\/body>/i.test(body) ? body.replace(/<\/body>/i, () => tag + '</body>') : body + tag;
          const h = { ...pr.headers };
          delete h['content-length']; delete h['content-encoding'];
          delete h['content-security-policy']; delete h['content-security-policy-report-only'];
          res.writeHead(pr.statusCode, h);
          res.end(body);
        });
      } else {
        res.writeHead(pr.statusCode, pr.headers);
        pr.pipe(res);
      }
    });
    p.on('error', () => { res.writeHead(502); res.end('live-edit: cannot reach ' + target); });
    req.pipe(p);
  });

  // WebSocket passthrough (HMR)
  server.on('upgrade', (req, socket, head) => {
    const up = net.connect(Number(T.port || 80), T.hostname, () => {
      const lines = Object.entries(req.headers).map(([k, v]) => `${k}: ${k === 'host' ? T.host : v}`);
      up.write(`${req.method} ${req.url} HTTP/1.1\r\n${lines.join('\r\n')}\r\n\r\n`);
      if (head && head.length) up.write(head);
      socket.pipe(up).pipe(socket);
    });
    up.on('error', () => socket.destroy());
    socket.on('error', () => up.destroy());
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`\n  live-edit ready\n  open  http://localhost:${port}   (proxying ${target})\n  edits write to: ${ROOT}\n`);
  });
}

function save(body) {
  const applied = [], queued = [], failed = [];
  const q = readQueue();
  const stamp = () => crypto.randomBytes(3).toString('hex');

  for (const e of body.edits || []) {
    if (!e.old || !e.old.trim()) continue;
    const r = applyText(e.old, e.new ?? '', e.ctx);
    if (r.status === 'applied') {
      applied.push({ old: e.old, new: e.new, file: r.file, line: r.line });
      console.log(`  ✓ ${r.file}:${r.line}  "${e.old}" -> "${e.new}"`);
    } else {
      q.items.push({ id: stamp(), type: 'text', reason: r.status, candidates: r.candidates || [], old: e.old, new: e.new, page: body.page, selector: e.selector, html: e.html });
      queued.push({ type: 'text', reason: r.status, old: e.old, new: e.new, candidates: r.candidates || [] });
      console.log(`  ⚠ queued (${r.status}) "${e.old}"  scanned ${scanned} files in ${ROOT}`);
    }
  }
  for (const o of body.ops || []) {
    q.items.push({ id: stamp(), page: body.page, ...o });
    queued.push({ type: o.type, tag: o.tag, text: o.text });
    console.log(`  ⚠ queued ${o.type} <${o.tag}> "${(o.text || '').slice(0, 40)}"`);
  }
  if (queued.length) { q.ready = true; writeQueue(q); }
  return { applied, queued, failed, root: ROOT, scanned };
}

async function detectTarget() {
  const ports = [5173, 3000, 4321, 5174, 8080, 3001, 4200, 8000, 5500, 1313];
  for (const p of ports) {
    if (p === Number(flag('port', 4321))) continue;
    const ok = await new Promise(r => {
      const q = http.get({ hostname: '127.0.0.1', port: p, path: '/', timeout: 600 }, res => { res.resume(); r(true); });
      q.on('error', () => r(false)); q.on('timeout', () => { q.destroy(); r(false); });
    });
    if (ok) return `http://localhost:${p}`;
  }
  return null;
}

// ---------- CLI helpers ----------
function fmt(it) {
  const lines = [`[${it.id}] ${it.type.toUpperCase()}${it.reason ? ' (' + it.reason + ')' : ''}  page: ${it.page || '/'}`];
  if (it.type === 'text') {
    lines.push(`  change text: ${JSON.stringify(it.old)} -> ${JSON.stringify(it.new)}`);
    if (it.candidates?.length) lines.push(`  candidates: ${it.candidates.join(', ')}`);
  } else if (it.type === 'attr') {
    lines.push(`  set ${it.name}=${it.value} on <${it.tag}> "${(it.text || '').slice(0, 60)}"`);
  } else if (it.type === 'comment') {
    lines.push(`  💬 COMMENT / INSTRUCTION: "${it.comment}"`);
    lines.push(`  target: <${it.tag}> "${(it.text || '').slice(0, 60)}"`);
  } else if (it.type === 'resize') {
    lines.push(`  ↔ RESIZE to ${it.width}px × ${it.height}px (was ${it.oldWidth}px × ${it.oldHeight}px) on <${it.tag}> "${(it.text || '').slice(0, 60)}"`);
  } else if (it.type === 'reorder') {
    lines.push(`  ⇅ REORDER: move ${it.direction} on <${it.tag}> "${(it.text || '').slice(0, 60)}"`);
  } else if (it.type === 'style') {
    lines.push(`  🎨 STYLE: set ${it.property}=${it.value} on <${it.tag}> "${(it.text || '').slice(0, 60)}"`);
  } else {
    lines.push(`  element: <${it.tag}> "${(it.text || '').slice(0, 80)}"`);
  }
  if (it.selector) lines.push(`  selector: ${it.selector}`);
  if (it.html) lines.push(`  html: ${it.html.replace(/\s+/g, ' ').slice(0, 600)}`);
  if (it.parentText) lines.push(`  sibling texts: ${JSON.stringify(it.parentText)}`);
  return lines.join('\n');
}

async function main() {
  if (cmd === 'init') {
    const skillDir = path.resolve(__dir, '..');
    const dest = path.join(ROOT, '.agent', 'skills', 'live-edit');
    if (path.resolve(skillDir) !== path.resolve(dest)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.cpSync(skillDir, dest, { recursive: true });
      console.log('installed skill ->', path.relative(ROOT, dest));
    }
    const pj = path.join(ROOT, 'package.json');
    if (fs.existsSync(pj)) {
      const j = JSON.parse(fs.readFileSync(pj, 'utf8'));
      j.scripts = j.scripts || {};
      j.scripts.live = 'node .agent/skills/live-edit/scripts/live.mjs start';
      fs.writeFileSync(pj, JSON.stringify(j, null, 2) + '\n');
      console.log('added npm script: npm run live');
    }
    const gi = path.join(ROOT, '.gitignore');
    const cur = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
    if (!/^\.live\/?$/m.test(cur)) fs.appendFileSync(gi, (cur.endsWith('\n') || !cur ? '' : '\n') + '.live/\n');
    console.log('done. Start your dev server, then: npm run live');
  } else if (cmd === 'start') {
    await start();
  } else if (cmd === 'pending') {
    const q = readQueue();
    console.log(q.items.length ? q.items.map(fmt).join('\n\n') : 'no pending changes');
  } else if (cmd === 'wait') {
    const deadline = Date.now() + Number(flag('timeout', 600)) * 1000;
    while (Date.now() < deadline) {
      const q = readQueue();
      if (q.ready && q.items.length) {
        q.ready = false; writeQueue(q);
        console.log(q.items.map(fmt).join('\n\n'));
        return;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    console.log('timeout: no changes queued');
  } else if (cmd === 'done') {
    const ids = argv.slice(1);
    const q = readQueue();
    q.items = ids.length ? q.items.filter(i => !ids.includes(i.id)) : [];
    writeQueue(q);
    console.log('remaining:', q.items.length);
  } else {
    console.log('usage: live.mjs init | start [--target URL] [--port N] | wait | pending | done [ids]');
  }
}
main();
