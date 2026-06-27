#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.TMDB_API_KEY;
const BASE = 'https://api.themoviedb.org/3';
const SITE_URL = 'https://whatchu.netlify.app';
const IMG = 'https://image.tmdb.org/t/p/';

if (!API_KEY) {
  console.error('Missing TMDB_API_KEY in environment');
  process.exit(1);
}

async function api(ep, params = {}) {
  const u = new URL(`${BASE}${ep}`);
  u.searchParams.set('api_key', API_KEY);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) u.searchParams.set(k, v);
  }
  const r = await fetch(u);
  if (!r.ok) throw new Error(`TMDB ${r.status} ${ep}`);
  return r.json();
}

const slugify = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const ensureDir = p => fs.mkdirSync(p, { recursive: true });
const esc = s => String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const fmtYear = d => d ? String(new Date(d).getFullYear() || '') : '';
const fmtRuntime = d => d.runtime ? `${d.runtime} min` : (d.episode_run_time && d.episode_run_time[0] ? `${d.episode_run_time[0]} min/ep` : 'N/A');
const firstCertification = data => (((data.results || []).find(r => r.iso_3166_1 === 'US') || {}).release_dates || []).find(r => r.certification)?.certification || 'N/A';

function pageHtml({ type, detail, credits, providers, videos, releaseDates }) {
  const title = detail.title || detail.name || 'Untitled';
  const year = fmtYear(detail.release_date || detail.first_air_date);
  const poster = detail.poster_path ? `${IMG}w780${detail.poster_path}` : `${SITE_URL}/assets/img/og-default.jpg`;
  const overview = detail.overview || 'No overview available.';
  const runtime = fmtRuntime(detail);
  const rating = detail.vote_average ? detail.vote_average.toFixed(1) : 'N/A';
  const genres = (detail.genres || []).map(g => g.name).join(', ');
  const cast = (credits.cast || []).slice(0, 10);
  const cert = type === 'movie' ? firstCertification(releaseDates) : 'N/A';
  const url = `${SITE_URL}/${type}/${detail.id}-${slugify(title)}/`;
  const descBase = `${title}${year ? ` (${year})` : ''} — ${runtime}, rated ${rating}/10.`;
  const desc = `${descBase} ${genres ? `Genres: ${genres}. ` : ''}${overview}`.replace(/\s+/g, ' ').slice(0, 158);
  const providerResults = providers.results || {};
  const region = providerResults.IN || providerResults.US || Object.values(providerResults)[0] || null;
  const providerNames = region ? ['flatrate','rent','buy','free'].flatMap(k => (region[k] || []).map(p => p.provider_name)) : [];
  const trailer = (videos.results || []).find(v => v.site === 'YouTube' && v.type === 'Trailer') || (videos.results || []).find(v => v.site === 'YouTube');
  const ld = {
    '@context': 'https://schema.org',
    '@type': type === 'movie' ? 'Movie' : 'TVSeries',
    name: title,
    image: poster,
    dateCreated: detail.release_date || detail.first_air_date || undefined,
    genre: (detail.genres || []).map(g => g.name),
    actor: cast.map(c => ({ '@type': 'Person', name: c.name })),
    aggregateRating: detail.vote_average ? { '@type': 'AggregateRating', ratingValue: detail.vote_average, ratingCount: detail.vote_count || 0 } : undefined
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}${year ? ` (${year})` : ''} - Where to Watch, Cast & Reviews</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}${year ? ` (${year})` : ''} - Where to Watch, Cast & Reviews">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${poster}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}${year ? ` (${year})` : ''}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${poster}">
<link rel="icon" href="${SITE_URL}/assets/img/favicon.png">
<link rel="stylesheet" href="${SITE_URL}/assets/css/style.css">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
  <main style="max-width:1100px;margin:0 auto;padding:24px;color:#2C2416;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <a href="${SITE_URL}/" style="color:#8B6914;text-decoration:none;font-weight:700">← Back to home</a>
    <section style="display:grid;grid-template-columns:minmax(220px,280px) 1fr;gap:24px;margin-top:18px;align-items:start;">
      <div><img src="${poster}" alt="${esc(title)} poster" style="width:100%;border-radius:16px;border:1px solid #D4C8B8"></div>
      <div>
        <h1 style="font-size:clamp(28px,5vw,48px);margin:0 0 8px">${esc(title)}${year ? ` <span style="color:#8C7A5C;font-weight:700">(${year})</span>` : ''}</h1>
        <p style="margin:0 0 12px;color:#5C4A30">${esc(genres || 'Movie / TV')} · ${esc(runtime)} · Rating ${esc(rating)}/10 · Certification ${esc(cert)}</p>
        <p style="font-size:16px;line-height:1.7;color:#5C4A30">${esc(overview)}</p>
        ${providerNames.length ? `<h2>Where to watch</h2><p>${esc(providerNames.join(', '))}</p>` : ''}
        ${cast.length ? `<h2>Cast</h2><ul>${cast.map(c => `<li>${esc(c.name)}${c.character ? ` as ${esc(c.character)}` : ''}</li>`).join('')}</ul>` : ''}
        ${trailer ? `<h2>Trailer</h2><p><a href="https://www.youtube.com/watch?v=${trailer.key}" target="_blank" rel="noopener">Watch trailer</a></p>` : ''}
      </div>
    </section>
  </main>
  <script>window.__STATIC_DETAIL__={id:${detail.id},type:${JSON.stringify(type)}};</script>
  <script src="${SITE_URL}/assets/js/api.js"></script>
  <script src="${SITE_URL}/assets/js/router.js"></script>
  <script type="module" src="${SITE_URL}/assets/js/app.js"></script>
</body>
</html>`;
}

async function collectSeeds() {
  const seeds = [];
  const endpoints = ['/trending/movie/week', '/trending/tv/week', '/movie/popular', '/tv/popular'];
  for (const ep of endpoints) {
    try {
      const data = await api(ep);
      const type = ep.includes('/tv/') ? 'tv' : 'movie';
      for (const item of data.results || []) seeds.push({ id: item.id, type });
    } catch (e) {
      console.error('seed fail', ep, e.message);
    }
  }
  const map = new Map();
  for (const s of seeds) map.set(`${s.type}:${s.id}`, s);
  return Array.from(map.values()).slice(0, 300);
}

async function generate() {
  ensureDir(path.join(process.cwd(), 'movie'));
  ensureDir(path.join(process.cwd(), 'tv'));
  ensureDir(path.join(process.cwd(), 'person'));
  let ok = 0, failed = 0;
  const urls = [`${SITE_URL}/`];
  const seeds = await collectSeeds();
  for (const seed of seeds) {
    try {
      const reqs = [
        api(`/${seed.type}/${seed.id}`),
        api(`/${seed.type}/${seed.id}/watch/providers`),
        api(`/${seed.type}/${seed.id}/credits`),
        api(`/${seed.type}/${seed.id}/videos`),
        seed.type === 'movie' ? api(`/movie/${seed.id}/release_dates`) : Promise.resolve({ results: [] })
      ];
      const [detail, providers, credits, videos, releaseDates] = await Promise.all(reqs);
      const slug = `${detail.id}-${slugify(detail.title || detail.name)}`;
      const dir = path.join(process.cwd(), seed.type, slug);
      ensureDir(dir);
      fs.writeFileSync(path.join(dir, 'index.html'), pageHtml({ type: seed.type, detail, credits, providers, videos, releaseDates }));
      urls.push(`${SITE_URL}/${seed.type}/${slug}/`);
      ok++;
    } catch (e) {
      failed++;
      console.error('skip', seed.type, seed.id, e.message);
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(process.cwd(), 'sitemap.xml'), sitemap);
  fs.writeFileSync(path.join(process.cwd(), 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  console.log(`Generated ${ok} pages, ${failed} skipped/errors`);
}

generate().catch(err => { console.error(err); process.exit(1); });
