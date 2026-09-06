#!/usr/bin/env node
// Local dev server + deck registrar.
//
//   ./dev.sh          → http://localhost:8080
//                       /         the real index (hash-nav works, unlike file://)
//                       /_admin   pick an unregistered deck, fill the human fields,
//                                 and it writes decks.json + rebuilds the index
//
// Everything a machine can read off a deck (slides, languages, notes, title) is
// derived and shown read-only. You only ever type the parts that are a judgement
// call. Nothing here ships — it is a local tool, not part of the site.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const PORT = Number(process.env.PORT || 8080);
const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css', '.js': 'text/javascript',
  '.md': 'text/markdown; charset=utf-8', '.sh': 'text/plain; charset=utf-8', '.mjs': 'text/javascript' };

const readCfg = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'decks.json'), 'utf8'));

// same derivation the generator uses — one definition of "what is a deck"
function inspect(file) {
  const s = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const slides = (s.match(/class="slide"/g) || []).length;
  return {
    slides,
    bilingual: /class="[^"]*\bth\b[^"]*"|lang-th/.test(s) && /btn-th|langsw/.test(s),
    notes: /id="notes"/.test(s),
    stamp: (s.match(/class="build"[^>]*>([^<]*)/) || [])[1] || null,
    title: (s.match(/<title>([^<]*)<\/title>/) || [])[1] || file,
    firstHash: (s.match(/data-hash="([^"]+)"/) || [])[1] || 'start',
  };
}

function survey() {
  const cfg = readCfg();
  const listed = new Set(cfg.decks.map(d => d.file));
  const fullOf = new Set(cfg.decks.map(d => d.full).filter(Boolean));
  const candidates = fs.readdirSync(ROOT)
    .filter(f => f.endsWith('.html') && f !== 'index.html' && f !== 'deck-template.html')
    .map(f => ({ file: f, ...inspect(f) }))
    .filter(d => d.slides > 0);
  return {
    registered: candidates.filter(d => listed.has(d.file))
      .map(d => ({ ...d, entry: cfg.decks.find(x => x.file === d.file) })),
    unregistered: candidates.filter(d => !listed.has(d.file) && !fullOf.has(d.file)),
    fulls: candidates.filter(d => fullOf.has(d.file)).map(d => d.file),
    accents: ['ma', 'prism', 'dna'],
  };
}

// NB: res.writeHead() returns the response (truthy), so `writeHead(...) || end()`
// silently never ends the response. Keep these as two statements.
function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}

const ADMIN = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Deck registrar</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Noto+Sans+Thai:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--g:#eef0f3;--i:#151a21;--t:#3a424d;--f:#6b7480;--r:#d5dae1;--a:#c2410c;--ok:#0f7a5a}
@media(prefers-color-scheme:dark){:root{--g:#0f1318;--i:#eef1f5;--t:#c3cad3;--f:#8c96a3;--r:#262d37;--a:#fb8a3c;--ok:#3fbf93}}
*{box-sizing:border-box}body{margin:0;background:var(--g);color:var(--i);font:16px/1.5 Inter,'Noto Sans Thai',system-ui,sans-serif}
main{max-width:940px;margin:0 auto;padding:48px 24px 80px;display:flex;flex-direction:column;gap:30px}
h1{font-size:30px;margin:0;letter-spacing:-.02em}h2{font-size:15px;margin:0 0 12px;text-transform:uppercase;letter-spacing:.12em;color:var(--f);font-family:JetBrains Mono,monospace}
.row{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;padding:13px 0;border-bottom:1px solid var(--r)}
.row b{font-family:JetBrains Mono,monospace;font-size:14px;font-weight:500}
.meta{font-family:JetBrains Mono,monospace;font-size:12.5px;color:var(--f);margin-top:3px}
.pill{font-family:JetBrains Mono,monospace;font-size:11px;padding:3px 9px;border-radius:99px;border:1px solid var(--r);color:var(--f)}
.pill.ok{color:var(--ok);border-color:var(--ok)}
button{font:inherit;font-size:14px;padding:8px 15px;border-radius:6px;border:1px solid var(--a);background:var(--a);color:#fff;cursor:pointer}
button.ghost{background:none;color:var(--a)}
a{color:var(--a)}
form{display:none;flex-direction:column;gap:12px;padding:20px;border:1px solid var(--r);border-radius:8px;margin-top:14px;background:color-mix(in srgb,var(--i) 4%,transparent)}
form.open{display:flex}
label{display:flex;flex-direction:column;gap:5px;font-size:13px;color:var(--f)}
input,select{font:inherit;font-size:14px;padding:9px 11px;border-radius:6px;border:1px solid var(--r);background:var(--g);color:var(--i)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.derived{font-family:JetBrains Mono,monospace;font-size:12.5px;color:var(--f);padding:10px 12px;border-left:2px solid var(--ok);background:color-mix(in srgb,var(--ok) 7%,transparent)}
#msg{font-family:JetBrains Mono,monospace;font-size:13px;padding:12px 14px;border-radius:6px;display:none}
#msg.show{display:block}#msg.good{color:var(--ok);border:1px solid var(--ok)}#msg.bad{color:#b42318;border:1px solid #b42318}
@media(max-width:640px){.two{grid-template-columns:1fr}}
</style></head><body><main>
<h1>Deck registrar</h1>
<p style="color:var(--t);margin:0">Serving this repo over http, so hash navigation and relative assets work — <code>file://</code> breaks both. Pick an unregistered deck, fill only the fields that are a judgement call, and it writes <code>decks.json</code> and rebuilds <code>index.html</code>.</p>
<div id="msg"></div>
<section><h2>Unregistered</h2><div id="un"></div></section>
<section><h2>Registered</h2><div id="reg"></div></section>
<section><h2>Full versions (linked, not carded)</h2><div id="full" class="meta"></div></section>
<p><a href="/">← the index</a></p>
</main><script>
const msg=(t,ok)=>{const m=document.getElementById('msg');m.textContent=t;m.className='show '+(ok?'good':'bad');};
const dv=d=>\`\${d.slides} slides · \${d.bilingual?'en+th':'en only'} · notes:\${d.notes?'yes':'no'} · #\${d.firstHash} · \${d.stamp||'unstamped'}\`;
async function load(){
  const s=await (await fetch('/_admin/data')).json();
  document.getElementById('un').innerHTML = s.unregistered.length ? s.unregistered.map((d,i)=>\`
    <div class="row"><div><b>\${d.file}</b><div class="meta">\${dv(d)}</div></div>
      <div><a class="pill" href="/\${d.file}" target="_blank">preview</a>
      <button class="ghost" onclick="document.getElementById('f\${i}').classList.toggle('open')">register</button></div></div>
    <form id="f\${i}" onsubmit="return reg(event,'\${d.file}','\${d.firstHash}')">
      <div class="derived">derived automatically — not stored: \${dv(d)}</div>
      <div class="two">
        <label>Title lead (EN)<input name="lead" required placeholder="Multi-Agent"></label>
        <label>Title accent (EN)<input name="accent" required placeholder="Workflows"></label>
        <label>Title lead (TH)<input name="leadTh" placeholder="เวิร์กโฟลว์"></label>
        <label>Title accent (TH)<input name="accentTh" placeholder="หลายเอเจนต์"></label>
      </div>
      <label>Blurb EN<input name="blurbEn" required placeholder="One sentence."></label>
      <label>Blurb TH<input name="blurbTh" placeholder="หนึ่งประโยค"></label>
      <div class="two">
        <label>Accent colour<select name="colour">\${s.accents.map(a=>\`<option>\${a}</option>\`).join('')}</select></label>
        <label>Full version file (optional)<input name="full" placeholder="my-deck-full.html"></label>
      </div>
      <div><button type="submit">Write to decks.json + rebuild</button></div>
    </form>\`).join('') : '<p class="meta">None — every deck is registered.</p>';
  document.getElementById('reg').innerHTML = s.registered.map(d=>\`
    <div class="row"><div><b>\${d.file}</b><div class="meta">\${dv(d)}</div></div>
      <span class="pill ok">\${d.entry.accent}</span></div>\`).join('');
  document.getElementById('full').textContent = s.fulls.join(' · ') || '—';
}
async function reg(e,file,hash){
  e.preventDefault();
  const f=new FormData(e.target), g=k=>(f.get(k)||'').trim();
  const body={file,anchor:hash,accent:g('colour'),
    title:{lead:g('lead'),accent:g('accent')},
    titleTh:{lead:g('leadTh')||g('lead'),accent:g('accentTh')||g('accent')},
    blurb:{en:g('blurbEn'),th:g('blurbTh')||g('blurbEn')},
    foot:{en:'notes · N',th:'มีโน้ต · กด N'}};
  if(g('full')) body.full=g('full');
  const r=await fetch('/_admin/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json();
  if(r.ok){msg('Registered '+file+' → '+j.decks+' decks. index.html rebuilt.',true);load();}
  else msg('Failed: '+j.error,false);
  return false;
}
load();
</script></body></html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = decodeURIComponent(url.pathname);

  if (p === '/_admin') return send(res, 200, ADMIN, 'text/html; charset=utf-8');
  if (p === '/_admin/data') return send(res, 200, JSON.stringify(survey()));

  if (p === '/_admin/register' && req.method === 'POST') {
    let raw = '';
    for await (const c of req) raw += c;
    try {
      const d = JSON.parse(raw);
      if (!d.file || !fs.existsSync(path.join(ROOT, d.file))) throw new Error(`no such file: ${d.file}`);
      const cfg = readCfg();
      if (cfg.decks.some(x => x.file === d.file)) throw new Error(`${d.file} is already registered`);
      if (!d.title?.lead || !d.blurb?.en) throw new Error('title and English blurb are required');
      cfg.decks.push(d);
      fs.writeFileSync(path.join(ROOT, 'decks.json'), JSON.stringify(cfg, null, 2) + '\n');
      execFileSync('node', [path.join(ROOT, 'build-index.mjs')], { cwd: ROOT, stdio: 'pipe' });
      return send(res, 200, JSON.stringify({ ok: true, decks: cfg.decks.length }));
    } catch (e) {
      return send(res, 400, JSON.stringify({ error: e.message }));
    }
  }

  // static, scoped to the repo
  let file = path.join(ROOT, p === '/' ? 'index.html' : p);
  if (!file.startsWith(ROOT)) return send(res, 403, 'forbidden', 'text/plain');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'not found', 'text/plain');
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`  deck server   http://localhost:${PORT}/`);
  console.log(`  registrar     http://localhost:${PORT}/_admin`);
  const s = survey();
  console.log(`  ${s.registered.length} registered · ${s.unregistered.length} unregistered · ${s.fulls.length} full versions`);
});
