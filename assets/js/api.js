window.API_KEY = window.__TMDB_API_KEY__ || '';
window.BASE = 'https://api.themoviedb.org/3';
window.IMG = 'https://image.tmdb.org/t/p/';
window.SITE_URL = window.location.origin;
window.PROXY_BASE = '/.netlify/functions/tmdb-proxy';

window.api = async function api(ep, params = {}) {
  const u = new URL(window.PROXY_BASE, window.location.origin);
  u.searchParams.set('path', ep);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) u.searchParams.set(k, v);
  });
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error(`TMDB proxy ${r.status}`);
  return r.json();
};

window.imgUrl = (p, s = 'w342') => p ? `${window.IMG}${s}${p}` : null;
window.money = n => !n ? 'N/A' : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${n.toLocaleString()}`;
window.fmtDate = d => { if (!d) return 'N/A'; const dt = new Date(d); return isNaN(dt) ? 'N/A' : dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); };
window.fmtYear = d => d ? (new Date(d).getFullYear() || '') : '';
window.dateISO = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
window.thisWeekRange = () => { const now = new Date(); const start = new Date(now); start.setDate(now.getDate() - 6); return { from: window.dateISO(start), to: window.dateISO(now) }; };
window.ensureGenres = async function ensureGenres() {
  if (window.genreMap && Object.keys(window.genreMap).length) return window.genreMap;
  try {
    const [m, t] = await Promise.all([window.api('/genre/movie/list'), window.api('/genre/tv/list')]);
    window.genreMap = { movie: m.genres || [], tv: t.genres || [] };
  } catch (e) {
    window.genreMap = { movie: [], tv: [] };
  }
  return window.genreMap;
};
window.fetchNewThisWeek = async function fetchNewThisWeek(kind) {
  const { from, to } = window.thisWeekRange();
  const p = kind === 'movie' ? { 'primary_release_date.gte': from, 'primary_release_date.lte': to, sort_by: 'primary_release_date.desc' } : { 'first_air_date.gte': from, 'first_air_date.lte': to, sort_by: 'first_air_date.desc' };
  const d = await window.api(`/discover/${kind}`, p);
  return d.results || [];
};
window.fetchUpcoming2026 = async function fetchUpcoming2026() {
  const d = await window.api('/discover/movie', { 'primary_release_date.gte': '2026-01-01', 'primary_release_date.lte': '2026-12-31', sort_by: 'primary_release_date.asc' });
  return d.results || [];
};
window.fetchByGenre = async function fetchByGenre(kind, id) {
  const d = await window.api(`/discover/${kind}`, { with_genres: id, sort_by: 'popularity.desc' });
  return d.results || [];
};
window.fetchUnderratedByGenre = async function fetchUnderratedByGenre(id) {
  const d = await window.api('/discover/movie', { with_genres: id, vote_average_gte: 6.3, vote_average_lte: 7.8, vote_count_gte: 250, sort_by: 'vote_average.desc' });
  return d.results || [];
};

