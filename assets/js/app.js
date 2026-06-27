import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, set, serverTimestamp, get } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

const api = window.api;
const IMG = window.IMG;

const firebaseConfig = {
  apiKey:"AIzaSyDLPyDNPw6g30_9KLYmKEgz26ODXl88IT8",
  authDomain:"myown-c1a03.firebaseapp.com",
  databaseURL:"https://myown-c1a03-default-rtdb.firebaseio.com",
  projectId:"myown-c1a03",
  storageBucket:"myown-c1a03.firebasestorage.app",
  messagingSenderId:"231315717244",
  appId:"1:231315717244:web:f2e1d33f9f5080e16b1df9"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* ── User ID ── */
let myUid = localStorage.getItem('cs_uid');
if(!myUid){ myUid='u_'+Math.random().toString(36).substr(2,12); localStorage.setItem('cs_uid',myUid); }
window._myUid = myUid;
window._setMyUid = (uid) => { localStorage.setItem('cs_uid',uid); myUid=uid; window._myUid=uid; };

/* ── Subscribe ── */
let _unsubPlaylists = null;
function subscribeToUser(uid){
  if(_unsubPlaylists) _unsubPlaylists();
  const unsub = onValue(ref(db,`users/${uid}/playlists`), snap => {
    _playlists = snap.exists() ? snap.val() : {};
    window._playlists = _playlists;
    if(window._onPlaylistsChange) window._onPlaylistsChange();
  });
  _unsubPlaylists = unsub;
}
window._switchUser = async (newUid) => {
  myUid = newUid; window._myUid = newUid; window._setMyUid(newUid);
  subscribeToUser(newUid);
};

let _playlists = {};
subscribeToUser(myUid);

window._createPlaylist = async (name) => { const r=push(ref(db,`users/${myUid}/playlists`),{name,createdAt:serverTimestamp(),items:{}}); return r.key; };
window._deletePlaylist = (plId) => remove(ref(db,`users/${myUid}/playlists/${plId}`));
window._addToPlaylist = async (plId, item) => {
  const items=(_playlists[plId]&&_playlists[plId].items)?_playlists[plId].items:{};
  const exists=Object.values(items).some(i=>String(i.id)===String(item.id)&&i.type===item.type);
  if(exists) return 'exists';
  await push(ref(db,`users/${myUid}/playlists/${plId}/items`),{...item,addedAt:Date.now()});
  return 'added';
};
window._removeFromPlaylist = (plId,itemFbKey) => remove(ref(db,`users/${myUid}/playlists/${plId}/items/${itemFbKey}`));
window._isInPlaylist = (plId,mediaId,mediaType) => { const items=(_playlists[plId]&&_playlists[plId].items)?_playlists[plId].items:{}; return Object.values(items).some(i=>String(i.id)===String(mediaId)&&i.type===mediaType); };
window._fetchSharedPlaylist = async (uid,plId) => { const snap=await get(ref(db,`users/${uid}/playlists/${plId}`)); return snap.exists()?snap.val():null; };

/* ── Search Engines ── */
const engRef = ref(db,'search_engines');
let fbEngines=[],activeEngId=null;
function sortEngines(){
  fbEngines.sort((a,b)=>{
    const ao=Number.isFinite(Number(a.order))?Number(a.order):a._idx;
    const bo=Number.isFinite(Number(b.order))?Number(b.order):b._idx;
    if(ao!==bo)return ao-bo;
    return String(a.name||'').localeCompare(String(b.name||''));
  });
}
onValue(engRef,snap=>{
  fbEngines=[];
  let idx=0;
  if(snap.exists())snap.forEach(ch=>{fbEngines.push({fbKey:ch.key,_idx:idx++,...ch.val()});});
  sortEngines();
  window._fbEngines=fbEngines;
  refreshEngUI();
  renderEngList();
});
window._fbEngines=fbEngines;
window._activeEngId=()=>activeEngId;
window._setActiveEngId=id=>{activeEngId=id;};
window._addEngineFB=(name,url,domain,desc)=>push(engRef,{name,url,domain,desc:desc||'',addedBy:myUid,order:Date.now(),ts:serverTimestamp()});
window._deleteEngineFB=key=>remove(ref(db,`search_engines/${key}`));
window._moveEngineFB=async(key,dir)=>{
  sortEngines();
  const i=fbEngines.findIndex(e=>e.fbKey===key);
  if(i<0)return;
  const ni=i+dir;
  if(ni<0||ni>=fbEngines.length)return;
  const reordered=[...fbEngines];
  const [item]=reordered.splice(i,1);
  reordered.splice(ni,0,item);
  await Promise.all(reordered.map((e,idx)=>set(ref(db,`search_engines/${e.fbKey}/order`),(idx+1)*1000)));
};

function faviconUrl(domain){return`https://www.google.com/s2/favicons?domain=${domain}&sz=64`;}
window.faviconUrl=faviconUrl;

function refreshEngUI(){ const wrap=document.getElementById('ws-engines-wrap'); if(wrap)renderEngButtons(wrap); renderEngTableInDetail(); }
function renderEngButtons(wrap){ if(!fbEngines.length){wrap.innerHTML='<div class="ws-no-engines">No search engines — tap "Manage" to add one.</div>';return;} if(!activeEngId||!fbEngines.find(e=>e.fbKey===activeEngId))activeEngId=fbEngines[0].fbKey; wrap.innerHTML=fbEngines.map(e=>{const fav=faviconUrl(e.domain||e.url);return`<button class="ws-engine-btn${e.fbKey===activeEngId?' active':''}" onclick="selectEng('${e.fbKey}')" id="eng-btn-${e.fbKey}"><span class="ws-engine-logo"><img src="${fav}" alt="${escH(e.name)}" onerror="this.style.display='none'"/></span>${escH(e.name)}</button>`;}).join('');}
function renderEngTableInDetail(){ const tbody=document.getElementById('eng-tbl-body'); if(!tbody)return; if(!fbEngines.length){tbody.innerHTML=`<tr><td colspan="4" class="no-eng-row">No engines added yet.</td></tr>`;return;} tbody.innerHTML=fbEngines.map(e=>{const fav=faviconUrl(e.domain||e.url);return`<tr><td class="et-logo-cell"><div class="et-logo-wrap"><img src="${fav}" alt="${escH(e.name)}" onerror="this.style.display='none'"/></div></td><td class="et-name">${escH(e.name)}</td><td class="et-desc">${escH(e.desc||'')}</td><td><button class="et-search-btn" onclick="wsGoWith('${escA(e.fbKey)}')">Search</button></td></tr>`;}).join('');}
function renderEngList(){
  const list=document.getElementById('eng-list');
  if(!list)return;
  if(!fbEngines.length){list.innerHTML='<div class="eng-no-engines">No engines yet — add one above!</div>';return;}
  list.innerHTML=fbEngines.map((e,i)=>{const fav=faviconUrl(e.domain||e.url);return`<div class="eng-item">
    <div class="eng-reorder">
      <button class="eng-order-btn" onclick="moveEngine('${e.fbKey}',-1)" ${i===0?'disabled':''} title="Move up" aria-label="Move ${escH(e.name)} up">↑</button>
      <button class="eng-order-btn" onclick="moveEngine('${e.fbKey}',1)" ${i===fbEngines.length-1?'disabled':''} title="Move down" aria-label="Move ${escH(e.name)} down">↓</button>
    </div>
    <div class="eng-item-logo"><img src="${fav}" alt="${escH(e.name)}" onerror="this.style.display='none'"/></div>
    <div class="eng-item-info"><div class="eng-item-name">${escH(e.name)}</div><div class="eng-item-desc">${escH(e.desc||e.url)}</div></div>
    <button class="eng-item-del" onclick="deleteEngine('${e.fbKey}')">✕</button>
  </div>`;}).join('');
}

window.selectEng=key=>{activeEngId=key;document.querySelectorAll('.ws-engine-btn').forEach(b=>b.classList.remove('active'));const btn=document.getElementById('eng-btn-'+key);if(btn)btn.classList.add('active');};
window.deleteEngine=key=>window._deleteEngineFB(key);
window.moveEngine=(key,dir)=>{if(window._moveEngineFB)window._moveEngineFB(key,dir);};
function extractDomain(url){try{return new URL(url).hostname.replace(/^www\./,'');}catch(e){return null;}}
function domainToName(domain){if(!domain)return'';const n=domain.split('.')[0];return n.charAt(0).toUpperCase()+n.slice(1);}
window.previewEngine=url=>{const prev=document.getElementById('eng-preview'),img=document.getElementById('eng-preview-img'),nameEl=document.getElementById('eng-preview-name'),domEl=document.getElementById('eng-preview-domain');if(!prev||!img||!nameEl||!domEl)return;const domain=extractDomain(url);if(!domain||!url.includes('{query}')){prev.classList.remove('show');return;}img.src=faviconUrl(domain);nameEl.textContent=domainToName(domain);domEl.textContent=domain;prev.classList.add('show');};
window.extractDomain=extractDomain;
window.domainToName=domainToName;

/* =================== CONSTANTS =================== */
let heroItems=[],heroIdx=0,heroTimer=null;
let genreMap={};
let prevViewStack=[];
let searchDebounce=null;
let currentFilter='all',allResults=[];
let recentSearches=JSON.parse(localStorage.getItem('cs_recent')||'[]');
let searchBuilt=false,moviesBuilt=false,tvBuilt=false;
let activePlId=null;
let pendingPlItem=null;
let compareSelection=[];

/* =================== THEME MODE =================== */
const THEME_KEY='jw_theme';
function applyTheme(theme){
  const next=theme==='dark'?'dark':'light';
  document.documentElement.setAttribute('data-theme',next);
  localStorage.setItem(THEME_KEY,next);
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute('content',next==='dark'?'#0F1115':'#FAF8F5');
  const label=document.getElementById('theme-card-label');
  if(label)label.textContent=next==='dark'?'Dark Mode':'Light Mode';
  const icon=document.getElementById('theme-card-icon');
  if(icon)icon.textContent=next==='dark'?'☀️':'🌙';
}
function toggleTheme(){
  const current=document.documentElement.getAttribute('data-theme')||localStorage.getItem(THEME_KEY)||'light';
  applyTheme(current==='dark'?'light':'dark');
  if(typeof showToast==='function')showToast((current==='dark'?'Light':'Dark')+' mode enabled');
}
(function initTheme(){
  const saved=localStorage.getItem(THEME_KEY);
  const prefersDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved||(prefersDark?'dark':'light'));
})();

/* =================== SVG ICONS =================== */
const IC={
  film:`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>`,
  tv:`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg>`,
  play:`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
  star:`<svg width="12" height="12" viewBox="0 0 24 24" fill="#8B6914"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`,
  cal:`<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20 3h-1V1h-2v2H7V1H5v2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H4V8h16v13z"/></svg>`,
  copy:`<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`,
  srch:`<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`,
  warn:`<svg width="32" height="32" viewBox="0 0 24 24" fill="#8B6914"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`,
  noplay:`<svg width="38" height="38" viewBox="0 0 24 24" fill="rgba(139,105,20,0.28)"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 12l-5-3 5-3v6z"/></svg>`,
  share:`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>`,
  plus:`<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`,
  trash:`<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
  playlist:`<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/></svg>`,
  user:`<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>`,
  edit:`<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
  id:`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="5" width="20" height="14" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="12" r="2"/><path d="M14 9h4M14 12h4M14 15h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  link:`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>`,
  check:`<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`,
  add:`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`,
};

/* =================== HELPERS =================== */
function showToast(msg,dur=2200){
  const t=document.getElementById('copy-toast');
  t.textContent=msg;t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),dur);
}
function escH(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function escA(s){return String(s).replace(/'/g,'&#39;').replace(/"/g,'&quot;');}

const noAv=`data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='84' height='84'%3E%3Crect width='84' height='84' rx='10' fill='%23EDE8E0'/%3E%3Ccircle cx='42' cy='32' r='14' fill='%23C4AC8C' opacity='.7'/%3E%3Cellipse cx='42' cy='66' rx='21' ry='14' fill='%23C4AC8C' opacity='.5'/%3E%3C/svg%3E`;
const noThumb=`data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='70' height='44'%3E%3Crect width='70' height='44' fill='%23EDE8E0'/%3E%3Cpolygon points='28,14 28,30 46,22' fill='%238B6914' opacity='.6'/%3E%3C/svg%3E`;
const noPoster=`data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='98' height='147'%3E%3Crect width='98' height='147' fill='%23EDE8E0'/%3E%3Ctext x='49' y='80' text-anchor='middle' font-size='32' fill='%23C4AC8C'%3E🎬%3C/text%3E%3C/svg%3E`;

const imgUrl=(p,s='w342')=>p?`${IMG}${s}${p}`:null;
const money=n=>!n?'N/A':n>=1e9?`$${(n/1e9).toFixed(2)}B`:n>=1e6?`$${(n/1e6).toFixed(1)}M`:`$${n.toLocaleString()}`;
const fmtDate=d=>{if(!d)return'N/A';const dt=new Date(d);return isNaN(dt)?'N/A':dt.toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});};
const fmtYear=d=>d?new Date(d).getFullYear()||'':'';
const errBox=m=>`<div class="err-box"><div class="err-icon">${IC.warn}</div><div class="err-txt">${m}</div><div class="err-sub">TMDB API</div></div>`;
const skels=n=>Array(n).fill('<div class="skel"></div>').join('');
const secH=(id,t,n=6)=>`<div class="section"><div class="section-head"><div class="section-bar"></div><div class="section-title">${t}</div></div><div class="h-row" id="${id}">${skels(n)}</div></div>`;
const dateISO=d=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
const thisWeekRange=()=>{const now=new Date();const start=new Date(now);start.setDate(now.getDate()-6);return{from:dateISO(start),to:dateISO(now)}};
async function ensureGenres(){if(Object.keys(genreMap).length)return genreMap;try{const [m,t]=await Promise.all([api('/genre/movie/list'),api('/genre/tv/list')]);genreMap={movie:m.genres||[],tv:t.genres||[]};}catch(e){genreMap={movie:[],tv:[]};}return genreMap;}
async function loadRowCustom(rowId,loader,type){const row=document.getElementById(rowId);if(!row)return;try{const items=await loader();renderRow(row,items,type);}catch(e){row.innerHTML=errBox('Failed to load');}}
async function fetchNewThisWeek(kind){const {from,to}=thisWeekRange();const p=kind==='movie'?{'primary_release_date.gte':from,'primary_release_date.lte':to,sort_by:'primary_release_date.desc'}:{'first_air_date.gte':from,'first_air_date.lte':to,sort_by:'first_air_date.desc'};const d=await api(`/discover/${kind}`,p);return d.results||[];}
async function fetchUpcoming2026(){const d=await api('/discover/movie',{'primary_release_date.gte':'2026-01-01','primary_release_date.lte':'2026-12-31',sort_by:'primary_release_date.asc'});return d.results||[];}
async function fetchByGenre(kind,id){const d=await api(`/discover/${kind}`,{with_genres:id,sort_by:'popularity.desc'});return d.results||[];}
async function fetchUnderratedByGenre(id){const d=await api('/discover/movie',{with_genres:id,vote_average_gte:6.3,vote_average_lte:7.8,vote_count_gte:250,sort_by:'vote_average.desc'});return d.results||[];}

function copyTitle(t){
  if(navigator.clipboard)navigator.clipboard.writeText(t).catch(()=>{});
  else{const ta=document.createElement('textarea');ta.value=t;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);}
  showToast(`Copied: "${t.substring(0,28)}${t.length>28?'…':''}"`);
}
function copyActorName(name){
  if(navigator.clipboard)navigator.clipboard.writeText(name).catch(()=>{});
  else{const ta=document.createElement('textarea');ta.value=name;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);}
  showToast(`Copied: "${name}"`);
}
function showPreview(id,type,title,poster,rating,year,typeLabel,overview){
  const overlay=document.getElementById('preview-overlay');
  const posterImg=poster?`<img class="preview-poster" src="${poster}" alt="${escH(title)}" onerror="this.style.display='none'"/>`:`<div style="width:100%;aspect-ratio:2/3;background:var(--beige);display:flex;align-items:center;justify-content:center;font-size:48px">🎬</div>`;
  const safeId=parseInt(id),safeType=type;
  overlay.innerHTML=`
    <div class="preview-card" onclick="event.stopPropagation()">
      <div class="preview-poster-wrap">
        ${posterImg}
        <span class="preview-badge">${typeLabel}</span>
        <button class="preview-close" onclick="closePreview()">✕</button>
      </div>
      <div class="preview-info">
        <div class="preview-title">${escH(title)}</div>
        <div class="preview-meta">
          ${rating?`<span class="preview-rating">${IC.star} ${rating}</span>`:''}
          ${year?`<span class="preview-year">${year}</span>`:''}
          <span class="preview-type">${typeLabel}</span>
        </div>
        <div class="preview-ov">${escH(overview)}</div>
        <div class="preview-btns">
          <button class="preview-btn preview-btn-primary" onclick="closePreview();openDetail(${id},'${type}')">${IC.play} View Details</button>
          <button class="preview-btn preview-btn-secondary" onclick="openPlPicker(${id},'${type}','${escA(title)}','${poster?escA(poster.replace(IMG+'w342','')):''}')">${IC.plus} Add</button>
        </div>
      </div>
    </div>`;
  overlay.classList.remove('hidden');
}
function closePreview(){
  document.getElementById('preview-overlay').classList.add('hidden');
}
document.addEventListener('click',function(e){
  const overlay=document.getElementById('preview-overlay');
  if(!e.target.closest('.preview-card')&&!e.target.closest('.result-card')){
    closePreview();
  }
});

/* =================== UID MANAGEMENT =================== */
function openUidModal(){
  const input=document.getElementById('uid-modal-input');
  if(input)input.value=window._myUid||'';
  document.getElementById('uid-modal').classList.remove('hidden');
  setTimeout(()=>input&&input.focus(),100);
}
function closeUidModal(){document.getElementById('uid-modal').classList.add('hidden');}
async function saveUid(){
  const input=document.getElementById('uid-modal-input');
  const val=(input?input.value:'').trim();
  if(!val||val.length<3){showToast('ID must be at least 3 characters');return;}
  if(!/^[a-zA-Z0-9_\-]+$/.test(val)){showToast('Only letters, numbers, _ and - allowed');return;}
  if(val===window._myUid){closeUidModal();return;}
  closeUidModal();
  if(window._switchUser) await window._switchUser(val);
  showToast(`Switched to ID: ${val} ✓`);
  if(document.getElementById('mylist-view').classList.contains('active'))buildMyListView();
}
window.openUidModal=openUidModal;
window.closeUidModal=closeUidModal;
window.saveUid=saveUid;

/* =================== SHARE =================== */
function shareDetail(id,type,title){
  const url=`${SITE_URL}/#detail/${type}/${id}`;
  if(navigator.share){navigator.share({title,text:`Check out "${title}" on justwatchh!`,url}).catch(()=>{});}
  else{navigator.clipboard&&navigator.clipboard.writeText(url).then(()=>showToast('Link copied!'));}
}
function sharePlaylist(ownerUid,plId,plName,e){
  if(e)e.stopPropagation();
  const url=`${SITE_URL}/#playlist/${ownerUid}/${plId}`;
  if(navigator.share){navigator.share({title:plName,text:`Check out my playlist "${plName}" on justwatchh!`,url}).catch(()=>{});}
  else{navigator.clipboard&&navigator.clipboard.writeText(url).then(()=>showToast('Playlist link copied!'));}
}

/* =================== DEEP LINK =================== */
/* =================== SHARED PLAYLIST =================== */
async function openSharedPlaylist(ownerUid,plId){
  const curActive=document.querySelector('.view.active');
  if(curActive)prevViewStack.push(curActive.id);
  showView('shared-playlist-view');setBnav(null);
  const sv=document.getElementById('shared-playlist-view');
  sv.innerHTML=`<button class="detail-back" onclick="closeSharedPlaylist()">‹</button><div style="display:flex;align-items:center;justify-content:center;height:100%"><div class="ring"></div></div>`;
  try{
    const pl=await window._fetchSharedPlaylist(ownerUid,plId);
    if(!pl){sv.innerHTML=`<button class="detail-back" onclick="closeSharedPlaylist()">‹</button>${errBox('Playlist not found')}`;return;}
    const items=pl.items?Object.entries(pl.items):[];
    const name=pl.name||'Untitled';
    let grid='';
    if(!items.length){
      grid=`<div style="padding:40px 20px;text-align:center;grid-column:span 3"><div style="font-size:36px;opacity:0.3;margin-bottom:8px">🎬</div><div style="font-size:13px;color:var(--text-light)">No titles in this playlist yet</div></div>`;
    } else {
      grid=items.map(([fbKey,it])=>{
        const poster=it.poster?`${IMG}w342${it.poster}`:null;
        return`<div class="pl-item-card" onclick="openDetail(${it.id},'${it.type}')">
          ${poster?`<img src="${poster}" alt="${escH(it.title||'')}" loading="lazy" onerror="this.src='${noPoster}'">`:`<div class="pl-item-ph">🎬</div>`}
          <div class="pl-item-label">${escH(it.title||'')}</div>
        </div>`;
      }).join('');
    }
    sv.innerHTML=`
      <button class="detail-back" onclick="closeSharedPlaylist()">‹</button>
      <button class="detail-share-btn" onclick="sharePlaylist('${escA(ownerUid)}','${escA(plId)}','${escA(name)}')" title="Share">${IC.share}</button>
      <div class="shared-pl-body">
        <div class="shared-pl-header">
          <div class="shared-pl-icon">${IC.playlist}</div>
          <div class="shared-pl-info">
            <h2 class="shared-pl-title">${escH(name)}</h2>
            <div class="shared-pl-meta">${items.length} title${items.length!==1?'s':''} · by ${escH(ownerUid)}</div>
          </div>
        </div>
        <div class="playlist-items-grid">${grid}</div>
      </div>`;
  }catch(e){sv.innerHTML=`<button class="detail-back" onclick="closeSharedPlaylist()">‹</button>${errBox('Failed to load playlist')}`;}
}
function closeSharedPlaylist(){
  if(window.location.hash.startsWith('#playlist'))history.replaceState(null,'',window.location.pathname+window.location.search);
  const prev=prevViewStack.pop();
  showView(prev||'home-view');
  if(!prev||prev==='home-view')setBnav('bnav-home');
  else if(prev==='movies-view')setBnav('bnav-movies');
  else if(prev==='tv-view')setBnav('bnav-tv');
  else if(prev==='search-view')setBnav('bnav-search');
  else if(prev==='mylist-view')setBnav('bnav-mylist');
}

/* =================== NAV =================== */
function showView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const el=document.getElementById(id);
  if(el){el.classList.add('active');if(!['detail-view','person-view','shared-playlist-view'].includes(id))el.scrollTop=0;}
}
function setBnav(id){
  document.querySelectorAll('.bnav-item').forEach(b=>b.classList.remove('active'));
  if(id){const el=document.getElementById(id);if(el)el.classList.add('active');}
}
function goHome(){prevViewStack=[];showView('home-view');setBnav('bnav-home');}
function goMovies(){showView('movies-view');setBnav('bnav-movies');if(!moviesBuilt){moviesBuilt=true;buildMoviesView();}}
function goTV(){showView('tv-view');setBnav('bnav-tv');if(!tvBuilt){tvBuilt=true;buildTVView();}}
function goSearch(){showView('search-view');setBnav('bnav-search');if(!searchBuilt){searchBuilt=true;buildSearchView();}else renderSearchHome();setTimeout(()=>{const i=document.getElementById('main-search-input');if(i)i.focus();},200);}
function goMyList(){showView('mylist-view');setBnav('bnav-mylist');buildMyListView();}

/* =================== ROW RENDER =================== */
function renderRow(row,items,type){
  if(!items||!items.length){row.innerHTML=errBox('No content');return;}
  const f=items.filter(i=>i.poster_path);
  if(!f.length){row.innerHTML=errBox('No poster data');return;}
  row.innerHTML=f.map(item=>{
    const t=item.title||item.name||'',p=imgUrl(item.poster_path,'w342'),mt=item.media_type||type;
    return`<div class="poster-card" onclick="openDetail(${item.id},'${mt}')"><img src="${p}" alt="${escH(t)}" loading="lazy" onerror="this.parentElement.style.display='none'"/></div>`;
  }).join('');
}
async function loadRow(rowId,ep,type,params={}){
  const row=document.getElementById(rowId);if(!row)return;
  try{const d=await api(ep,params);renderRow(row,d.results,type);}
  catch(e){if(row)row.innerHTML=errBox('Failed to load');}
}

/* =================== HOME =================== */
async function buildHomeView(){
  const hv=document.getElementById('home-view');
  hv.innerHTML=`
    <div class="hero"><div class="hero-bg" id="hero-bg"></div><div class="hero-grad"></div><div class="hero-content" id="hero-content"><div class="small-ring"></div></div></div>
    <div class="hero-dots" id="hero-dots"></div>
    ${secH('tr-movie','Trending Movies')}${secH('new-movie','New Movies This Week')}${secH('tr-tv','Trending TV')}${secH('new-tv','New TV This Week')}`;
  try{
    const d=await api('/trending/movie/week');
    heroItems=d.results.filter(i=>i.backdrop_path).slice(0,8);
    heroIdx=0;renderHero();clearInterval(heroTimer);startHeroTimer();
  }catch(e){const hc=document.getElementById('hero-content');if(hc)hc.innerHTML=errBox('Failed');}
  loadRow('tr-movie','/trending/movie/week','movie');
  loadRowCustom('new-movie',()=>fetchNewThisWeek('movie'),'movie');
  loadRow('tr-tv','/trending/tv/week','tv');
  loadRowCustom('new-tv',()=>fetchNewThisWeek('tv'),'tv');
}
function renderHero(){
  if(!heroItems.length)return;
  const item=heroItems[heroIdx];
  const bg=document.getElementById('hero-bg'),cnt=document.getElementById('hero-content'),dots=document.getElementById('hero-dots');
  if(!bg||!cnt||!dots)return;
  bg.style.backgroundImage=`url(${imgUrl(item.backdrop_path,'w780')})`;
  bg.style.opacity=0;requestAnimationFrame(()=>{bg.style.transition='opacity 0.65s';bg.style.opacity=1;});
  const t=item.title||item.name||'',r=item.vote_average?item.vote_average.toFixed(1):'N/A';
  const y=fmtYear(item.release_date||item.first_air_date),mt=item.media_type==='tv'?'TV Show':'Movie';
  const ov=(item.overview||'').substring(0,100)+((item.overview||'').length>100?'…':'');
  cnt.innerHTML=`<div class="hero-badge">${IC.film} Trending</div>
    <div class="hero-title">${escH(t)}</div>
    <div class="hero-meta"><div class="hero-rating">${IC.star} ${r}</div><div class="hero-pill">${y}</div><div class="hero-pill">${mt}</div></div>
    <div class="hero-ov">${escH(ov)}</div>
    <button class="hero-btn" onclick="openDetail(${item.id},'${item.media_type||(item.first_air_date?'tv':'movie')}')">${IC.play} View Details</button>`;
  dots.innerHTML=heroItems.map((_,i)=>`<div class="hero-dot${i===heroIdx?' active':''}" onclick="setHero(${i})"></div>`).join('');
}
function setHero(i){heroIdx=i;renderHero();clearInterval(heroTimer);startHeroTimer();}
function startHeroTimer(){heroTimer=setInterval(()=>{heroIdx=(heroIdx+1)%heroItems.length;renderHero();},5500);}

/* =================== MOVIES =================== */
async function buildMoviesView(){
  await ensureGenres();
  const mv=document.getElementById('movies-view');
  const genres=(genreMap.movie||[]).slice(0,8).map(g=>`<button class="genre-chip" onclick="movieGenrePick(${g.id},this)">${escH(g.name)}</button>`).join('');
  mv.innerHTML=`<div class="vtbar"><div class="section-bar"></div><h2>Movies</h2></div><div class="genres-scroll"><button class="genre-chip active" onclick="buildMoviesView()">All</button>${genres}</div>
    ${secH('mv-trending','Trending Now (Weekly)')}${secH('mv-toprated','Top Rated / Best of All Time')}${secH('mv-upcoming','Upcoming Movies (2026)')}${secH('mv-underrated','Underrated by Genre')}${secH('mv-genre','Browse by Genre')}`;
  loadRow('mv-trending','/trending/movie/week','movie');
  loadRow('mv-toprated','/movie/top_rated','movie');
  loadRowCustom('mv-upcoming',fetchUpcoming2026,'movie');
  const first=(genreMap.movie||[])[0];
  if(first){loadRowCustom('mv-underrated',()=>fetchUnderratedByGenre(first.id),'movie');loadRowCustom('mv-genre',()=>fetchByGenre('movie',first.id),'movie');}
}
function movieGenrePick(id,btn){document.querySelectorAll('#movies-view .genre-chip').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');loadRowCustom('mv-underrated',()=>fetchUnderratedByGenre(id),'movie');loadRowCustom('mv-genre',()=>fetchByGenre('movie',id),'movie');}

/* =================== TV =================== */
async function buildTVView(){
  await ensureGenres();
  const tv=document.getElementById('tv-view');
  const genres=(genreMap.tv||[]).slice(0,8).map(g=>`<button class="genre-chip" onclick="tvGenrePick(${g.id},this)">${escH(g.name)}</button>`).join('');
  tv.innerHTML=`<div class="vtbar"><div class="section-bar"></div><h2>TV Shows</h2></div><div class="genres-scroll"><button class="genre-chip active" onclick="buildTVView()">All</button>${genres}</div>
    ${secH('tv-daily','Trending Today')}${secH('tv-trending','Trending This Week')}${secH('tv-toprated','Top Rated / Best of All Time')}${secH('tv-new','New TV This Week')}${secH('tv-genre','Browse by Genre')}`;
  loadRow('tv-daily','/trending/tv/day','tv');
  loadRow('tv-trending','/trending/tv/week','tv');
  loadRow('tv-toprated','/tv/top_rated','tv');
  loadRowCustom('tv-new',()=>fetchNewThisWeek('tv'),'tv');
  const first=(genreMap.tv||[])[0];
  if(first)loadRowCustom('tv-genre',()=>fetchByGenre('tv',first.id),'tv');
}
function tvGenrePick(id,btn){document.querySelectorAll('#tv-view .genre-chip').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');loadRowCustom('tv-genre',()=>fetchByGenre('tv',id),'tv');}

/* =================== SEARCH =================== */
function buildSearchView(){
  const sv=document.getElementById('search-view');
  sv.innerHTML=`<div class="search-view-inner"><div class="search-box-wrap"><div class="search-box" id="search-box">${IC.srch}
    <input type="text" id="main-search-input" placeholder="Movies, shows..." autocomplete="off" inputmode="search"/>
    <button class="search-clear-btn" id="search-clear" onclick="clearSearch()">✕</button></div>
    <div id="autocomplete-drop"></div></div>
    <div id="search-body"></div></div>`;
  setupSearchInput();renderSearchHome();
}
function setupSearchInput(){
  const inp=document.getElementById('main-search-input'),box=document.getElementById('search-box');
  if(!inp||!box)return;
  inp.addEventListener('focus',()=>box.classList.add('focused'));
  inp.addEventListener('blur',()=>setTimeout(()=>box.classList.remove('focused'),200));
  inp.addEventListener('input',function(){
    const q=this.value.trim();
    const clr=document.getElementById('search-clear');if(clr)clr.classList.toggle('show',q.length>0);
    clearTimeout(searchDebounce);
    if(q.length<1){hideAC();renderSearchHome();return;}
    if(q.length<2){hideAC();return;}
    searchDebounce=setTimeout(()=>fetchAC(q),300);
  });
  inp.addEventListener('keydown',function(e){
    if(e.key!=='Enter')return;
    const q=this.value.trim();if(!q)return;
    this.blur();hideAC();saveRecent(q);doSearch(q);
  });
}
async function fetchAC(q){
  const drop=document.getElementById('autocomplete-drop');if(!drop)return;
  drop.style.display='block';drop.innerHTML='<div class="small-ring" style="margin:10px auto"></div>';
  try{
    const[mv,tv,pp]=await Promise.all([api('/search/movie',{query:q}),api('/search/tv',{query:q}),api('/search/person',{query:q})]);
    const mvF=mv.results.slice(0,4).filter(r=>r.poster_path||r.backdrop_path);
    const tvF=tv.results.slice(0,4).filter(r=>r.poster_path||r.backdrop_path);
    const ppF=pp.results.slice(0,3);
    let html=`<div class="ac-query-row" onclick="acQuery('${escA(q)}')"><div class="ac-q-icon">${IC.srch}</div><div class="ac-q-text">Search <b>"${escH(q)}"</b></div></div>`;
    if(mvF.length){html+=`<div class="ac-section-label">Movies</div>`;mvF.forEach(r=>{const t=r.title||'';const p=imgUrl(r.poster_path,'w92');const yr=fmtYear(r.release_date);const rt=r.vote_average?r.vote_average.toFixed(1):'';html+=`<div class="ac-item" onclick="acItem(${r.id},'movie')">${p?`<img class="ac-poster" src="${p}" alt="${escH(t)}" onerror="this.style.display='none'"/>`:`<div class="ac-ph">${IC.film}</div>`}<div class="ac-info"><div class="ac-title">${escH(t)}</div><div class="ac-meta"><span class="ac-type">Movie</span><span class="ac-year">${yr}</span>${rt?`<span class="ac-rating">${IC.star}${rt}</span>`:''}</div></div></div>`;});}
    if(tvF.length){html+=`<div class="ac-section-label">TV Shows</div>`;tvF.forEach(r=>{const t=r.name||'';const p=imgUrl(r.poster_path,'w92');const yr=fmtYear(r.first_air_date);const rt=r.vote_average?r.vote_average.toFixed(1):'';html+=`<div class="ac-item" onclick="acItem(${r.id},'tv')">${p?`<img class="ac-poster" src="${p}" alt="${escH(t)}" onerror="this.style.display='none'"/>`:`<div class="ac-ph">${IC.tv}</div>`}<div class="ac-info"><div class="ac-title">${escH(t)}</div><div class="ac-meta"><span class="ac-type">TV Show</span><span class="ac-year">${yr}</span>${rt?`<span class="ac-rating">${IC.star}${rt}</span>`:''}</div></div></div>`;});}
    if(ppF.length){html+=`<div class="ac-section-label">People</div>`;ppF.forEach(r=>{const p=imgUrl(r.profile_path,'w92');html+=`<div class="ac-item" onclick="openPerson(${r.id})">${p?`<img class="ac-poster" src="${p}" alt="${escH(r.name)}" onerror="this.style.display='none'"/>`:`<div class="ac-ph">👤</div>`}<div class="ac-info"><div class="ac-title">${escH(r.name)}</div><div class="ac-meta"><span class="ac-type">Person</span><span class="ac-year">${escH(r.known_for_department||'')}</span></div></div></div>`;});}
    if(!mvF.length&&!tvF.length&&!ppF.length)html=`<div style="padding:14px;text-align:center;font-size:12px;color:var(--text-light)">No suggestions</div>`;
    drop.innerHTML=html;
  }catch(e){drop.innerHTML=`<div style="padding:12px;text-align:center;font-size:11px;color:var(--accent)">Failed</div>`;}
}
function hideAC(){const d=document.getElementById('autocomplete-drop');if(d)d.style.display='none';}
function acItem(id,type){hideAC();openDetail(id,type);}
function acQuery(q){hideAC();const inp=document.getElementById('main-search-input');if(inp)inp.value=q;saveRecent(q);doSearch(q);}
function clearSearch(){const inp=document.getElementById('main-search-input'),clr=document.getElementById('search-clear');if(inp)inp.value='';if(clr)clr.classList.remove('show');hideAC();renderSearchHome();}
function saveRecent(q){recentSearches=[q,...recentSearches.filter(s=>s.toLowerCase()!==q.toLowerCase())].slice(0,10);localStorage.setItem('cs_recent',JSON.stringify(recentSearches));}
function removeRecent(q,e){e.stopPropagation();recentSearches=recentSearches.filter(s=>s!==q);localStorage.setItem('cs_recent',JSON.stringify(recentSearches));renderSearchHome();}
function clearAllRecent(){recentSearches=[];localStorage.setItem('cs_recent',JSON.stringify(recentSearches));renderSearchHome();}
function recentClick(q){const inp=document.getElementById('main-search-input'),clr=document.getElementById('search-clear');if(inp){inp.value=q;if(clr)clr.classList.add('show');}doSearch(q);}
async function renderSearchHome(){
  const body=document.getElementById('search-body');if(!body)return;
  let html='';
  if(recentSearches.length)html+=`<div class="recent-section"><div class="recent-header"><div class="recent-title">Recent</div><div class="recent-clear" onclick="clearAllRecent()">Clear all</div></div><div class="recent-chips">${recentSearches.map(q=>`<div class="recent-chip" onclick="recentClick('${escA(q)}')">${escH(q)}<span class="recent-chip-x" onclick="removeRecent('${escA(q)}',event)">×</span></div>`).join('')}</div></div>`;
  html+=`<div class="trending-section"><div class="section-head" style="padding:0 0 8px"><div class="section-bar"></div><div class="section-title">Trending</div></div><div class="trending-grid" id="trend-grid">${Array(8).fill('<div style="height:52px;border-radius:8px;background:var(--beige);border:1px solid var(--taupe)"></div>').join('')}</div></div>`;
  body.innerHTML=html;
  try{
    const d=await api('/trending/all/day');
    const items=d.results.filter(i=>i.poster_path||i.backdrop_path).slice(0,8);
    const grid=document.getElementById('trend-grid');if(!grid)return;
    grid.innerHTML=items.map((item,idx)=>{
      const t=item.title||item.name||'',sub=item.media_type==='tv'?'TV Show':'Movie';
      const thumb=imgUrl(item.poster_path||item.backdrop_path,'w92');
      const mt=item.media_type||'movie';
      return`<div class="trending-card" onclick="openDetail(${item.id},'${mt}')"><div class="trending-num">${idx+1}</div><div class="trending-info"><div class="trending-title">${escH(t)}</div><div class="trending-sub">${sub}</div></div>${thumb?`<img class="trending-thumb" src="${thumb}" alt="${escH(t)}" loading="lazy" onerror="this.style.display='none'"/>`:''}</div>`;
    }).join('');
  }catch(e){const g=document.getElementById('trend-grid');if(g)g.innerHTML=errBox('Failed');}
}
async function doSearch(q){
  const body=document.getElementById('search-body');if(!body)return;
  currentFilter='all';allResults=[];
  body.innerHTML=`<div class="results-area"><div class="results-header"><div class="results-title">Searching <b>"${escH(q)}"</b></div></div><div class="small-ring"></div></div>`;
  try{
    const[mv,tv,pp]=await Promise.all([api('/search/movie',{query:q}),api('/search/tv',{query:q}),api('/search/person',{query:q})]);
    allResults=[...mv.results.map(r=>({...r,_t:'movie'})),...tv.results.map(r=>({...r,_t:'tv'})).filter(r=>r.poster_path),...pp.results.map(r=>({...r,_t:'person'}))].filter(r=>r.poster_path||r.profile_path);
    allResults.sort((a,b)=>(b.popularity||0)-(a.popularity||0));
    renderResults(q);
  }catch(e){if(body)body.innerHTML=errBox('Search failed');}
}
function renderResults(q){
  const body=document.getElementById('search-body');if(!body)return;
  const filtered=currentFilter==='all'?allResults:allResults.filter(r=>r._t===currentFilter);
  let html=`<div class="results-area">
    <div class="results-header"><div class="results-title">Results for <b>"${escH(q)}"</b></div><div class="results-count">${filtered.length} found</div></div>
    <div class="results-filter">
      <button class="filter-btn${currentFilter==='all'?' active':''}" onclick="setFilter('all','${escA(q)}')">All (${allResults.length})</button>
      <button class="filter-btn${currentFilter==='movie'?' active':''}" onclick="setFilter('movie','${escA(q)}')">Movies (${allResults.filter(r=>r._t==='movie').length})</button>
      <button class="filter-btn${currentFilter==='tv'?' active':''}" onclick="setFilter('tv','${escA(q)}')">TV (${allResults.filter(r=>r._t==='tv').length})</button>
      <button class="filter-btn${currentFilter==='person'?' active':''}" onclick="setFilter('person','${escA(q)}')">People (${allResults.filter(r=>r._t==='person').length})</button>
      <button class="filter-btn" onclick="compareTopTwo('${escA(q)}')">Compare Top 2</button>
    </div>`;
  if(!filtered.length)html+=`<div class="no-results"><div class="no-results-icon">🎬</div><div class="no-results-text">No results</div><div class="no-results-sub">Try different keywords</div></div>`;
  else html+=`<div class="results-grid">${filtered.map(r=>{if(r._t==='person'){const p=imgUrl(r.profile_path,'w342');return`<div class="result-card" onclick="openPerson(${r.id})"><img src="${p||noPoster}" alt="${escH(r.name||'')}" loading="lazy" onerror="this.src='${noPoster}'"/></div>`;}const t=r.title||r.name||'';const p=imgUrl(r.poster_path,'w342');const rt=r.vote_average?r.vote_average.toFixed(1):'';const yr=r.release_date?fmtYear(r.release_date):(r.first_air_date?fmtYear(r.first_air_date):'');const mt=r._t==='tv'?'TV Show':'Movie';const ov=(r.overview||'No description available.').substring(0,150)+'...';return`<div class="result-card" onclick="showPreview(${r.id},'${r._t}','${escA(t)}','${p||''}','${rt}','${yr}','${mt}','${escA(ov)}')"><img src="${p}" alt="${escH(t)}" loading="lazy" onerror="this.src='${noPoster}'"/></div>`;}).join('')}</div>`;
  html+='</div>';body.innerHTML=html;
}
function setFilter(type,q){currentFilter=type;renderResults(q);}
async function compareTopTwo(q){const top=allResults.filter(r=>r._t==='movie'||r._t==='tv').slice(0,2);if(top.length<2){showToast('Need 2 titles to compare');return;}await openCompare(top[0],top[1]);}

/* =================== MY LIST VIEW =================== */
function getPlaylistStats(){
  const pls=window._playlists||{};
  const keys=Object.keys(pls);
  let titles=0;
  keys.forEach(k=>{ titles+=pls[k]&&pls[k].items?Object.keys(pls[k].items).length:0; });
  return {playlists:keys.length,titles};
}
function updateMyListStats(){
  const st=getPlaylistStats();
  const p=document.getElementById('ml-stat-playlists');
  const t=document.getElementById('ml-stat-titles');
  const u=document.getElementById('ml-user-id');
  const c=document.getElementById('ml-section-count');
  if(p)p.textContent=st.playlists;
  if(t)t.textContent=st.titles;
  if(u)u.textContent=window._myUid||'...';
  if(c)c.textContent=`${st.playlists} playlist${st.playlists!==1?'s':''} • ${st.titles} title${st.titles!==1?'s':''}`;
}
function buildMyListView(){
  const v=document.getElementById('mylist-view');
  const st=getPlaylistStats();
  v.innerHTML=`
    <div class="mylist-scroll-area mylist-redesign" id="mylist-scroll">
      <div class="ml-hero-card">
        <div class="ml-hero-top">
          <div class="ml-hero-icon">${IC.playlist}</div>
          <div class="ml-hero-copy">
            <div class="ml-kicker">Personal Library</div>
            <h2>My List</h2>
            <p>Save, organize and share your favourite movies and shows.</p>
          </div>
        </div>
        <div class="ml-user-strip" onclick="openUidModal()">
          <span class="ml-user-label">User ID</span>
          <span class="ml-user-value" id="ml-user-id">${escH(window._myUid||'...')}</span>
          <span class="ml-user-edit">Edit</span>
        </div>
      </div>

      <div class="ml-stats-grid">
        <div class="ml-stat-card">
          <span class="ml-stat-num" id="ml-stat-playlists">${st.playlists}</span>
          <span class="ml-stat-label">Playlists</span>
        </div>
        <div class="ml-stat-card">
          <span class="ml-stat-num" id="ml-stat-titles">${st.titles}</span>
          <span class="ml-stat-label">Saved titles</span>
        </div>
      </div>

      <div class="ml-actions-grid">
        <button class="ml-action-card primary" onclick="openPlCreateModal()">
          <span class="ml-action-icon">${IC.add}</span>
          <span><b>New Playlist</b><small>Create a collection</small></span>
        </button>
        <button class="ml-action-card" onclick="toggleTheme()" aria-label="Toggle dark mode">
          <span class="ml-action-icon" id="theme-card-icon">🌙</span>
          <span><b id="theme-card-label">Light Mode</b><small>Change appearance</small></span>
        </button>
      </div>

      <div class="ml-section-head">
        <div>
          <div class="ml-section-kicker">Collections</div>
          <h3>Your Playlists</h3>
        </div>
        <div class="ml-section-count" id="ml-section-count">${st.playlists} playlist${st.playlists!==1?'s':''} • ${st.titles} title${st.titles!==1?'s':''}</div>
      </div>
      <div class="playlist-section ml-playlist-section" id="mylist-pl-section"></div>
    </div>`;
  applyTheme(document.documentElement.getAttribute('data-theme')||localStorage.getItem(THEME_KEY)||'light');
  renderPlaylistsSection(document.getElementById('mylist-pl-section'));
  updateMyListStats();
  window._onPlaylistsChange=()=>{
    const sec=document.getElementById('mylist-pl-section');
    if(sec)renderPlaylistsSection(sec);
    updateMyListStats();
  };
}

function renderPlaylistsSection(sec){
  const pls=window._playlists||{};
  const keys=Object.keys(pls).sort((a,b)=>{
    const at=pls[a]&&pls[a].createdAt?pls[a].createdAt:0;
    const bt=pls[b]&&pls[b].createdAt?pls[b].createdAt:0;
    return bt-at;
  });
  const ownerUid=window._myUid||'';
  if(!keys.length){
    sec.innerHTML=`
      <div class="pl-empty ml-empty-redesign">
        <div class="pl-empty-icon ml-empty-icon">
          <svg width="58" height="58" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="16" rx="4" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 2"/>
            <path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="pl-empty-title">Start your library</div>
        <div class="pl-empty-sub">Create playlists for favourites, watch later, Bollywood, K-drama or anything you like.</div>
        <button class="ml-empty-btn" onclick="openPlCreateModal()">${IC.add} Create first playlist</button>
      </div>`;
    return;
  }
  sec.innerHTML=keys.map(plId=>{
    const pl=pls[plId]||{};
    const items=pl.items?Object.values(pl.items):[];
    const count=items.length;
    const thumbs=items.slice(0,4).map(it=>{
      const src=it.poster?`${IMG}w185${it.poster}`:null;
      return src
        ?`<img class="pl-thumb" src="${src}" alt="" loading="lazy" onerror="this.outerHTML='<div class=pl-thumb-ph>🎬</div>'">`
        :`<div class="pl-thumb-ph">🎬</div>`;
    }).join('');
    const latest=items[0]&&items[0].title?items[0].title:'Add titles from detail pages';
    return`
      <div class="pl-card ml-pl-card" onclick="openPlaylist('${escA(plId)}')">
        <div class="pl-card-thumbs ml-pl-collage">
          ${thumbs||'<div class="pl-thumb-ph">+</div>'}
        </div>
        <div class="pl-card-info ml-pl-info">
          <div class="pl-card-name">${escH(pl.name||'Untitled')}</div>
          <div class="pl-card-meta ml-pl-meta">
            <span>${count} title${count!==1?'s':''}</span>
            <span>•</span>
            <span>${escH(latest)}</span>
          </div>
        </div>
        <div class="pl-card-actions ml-pl-actions">
          <button class="pl-action-btn pl-share-btn" onclick="sharePlaylist('${escA(ownerUid)}','${escA(plId)}','${escA(pl.name||'Untitled')}',event)" title="Share" aria-label="Share playlist">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
          </button>
          <button class="pl-action-btn pl-del-btn" onclick="event.stopPropagation();confirmDeletePlaylist('${escA(plId)}','${escA(pl.name||'Untitled')}')" title="Delete" aria-label="Delete playlist">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </div>`;
  }).join('');
}


/* open playlist detail */
function openPlaylist(plId){
  activePlId=plId;
  const curActive=document.querySelector('.view.active');
  if(curActive)prevViewStack.push(curActive.id);
  renderPlaylistDetail(plId);
  showView('mylist-view');
}
function renderPlaylistDetail(plId){
  const v=document.getElementById('mylist-view');
  const pl=(window._playlists||{})[plId];
  if(!pl){v.innerHTML=errBox('Playlist not found');return;}
  const items=pl.items?Object.entries(pl.items):[];
  const name=pl.name||'Untitled';
  const ownerUid=window._myUid||'';
  let grid='';
  if(!items.length){
    grid=`<div class="pl-detail-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 2"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      <div>No titles yet</div>
      <div class="pl-detail-empty-sub">Add movies &amp; shows from their detail pages</div>
    </div>`;
  } else {
    grid=items.map(([fbKey,it])=>{
      const poster=it.poster?`${IMG}w342${it.poster}`:null;
      return`<div class="pl-item-card">
        ${poster?`<img src="${poster}" alt="${escH(it.title||'')}" loading="lazy" onerror="this.src='${noPoster}'" onclick="openDetail(${it.id},'${it.type}')">`:`<div class="pl-item-ph" onclick="openDetail(${it.id},'${it.type}')">🎬</div>`}
        <button class="pl-item-remove" onclick="removeFromPlaylist('${escA(plId)}','${escA(fbKey)}')" title="Remove">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
        <div class="pl-item-label" onclick="openDetail(${it.id},'${it.type}')">${escH(it.title||'')}</div>
      </div>`;
    }).join('');
  }
  v.innerHTML=`
    <button class="detail-back" onclick="closePlaylistDetail()">‹</button>
    <button class="detail-share-btn" onclick="sharePlaylist('${escA(ownerUid)}','${escA(plId)}','${escA(name)}')" title="Share">${IC.share}</button>
    <div class="pl-detail-scroll">
      <div class="pl-detail-header">
        <div class="pl-detail-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/></svg>
        </div>
        <div class="pl-detail-info">
          <h2 class="pl-detail-title">${escH(name)}</h2>
          <div class="pl-detail-count">${items.length} title${items.length!==1?'s':''}</div>
        </div>
      </div>
      <div class="playlist-items-grid">${grid}</div>
    </div>`;
  window._onPlaylistsChange=()=>renderPlaylistDetail(plId);
}
function closePlaylistDetail(){
  window._onPlaylistsChange=()=>{const sec=document.getElementById('mylist-pl-section');if(sec)renderPlaylistsSection(sec);};
  const prev=prevViewStack.pop();
  if(prev==='mylist-view'||!prev){activePlId=null;buildMyListView();showView('mylist-view');setBnav('bnav-mylist');}
  else{showView(prev);}
}
function removeFromPlaylist(plId,fbKey){
  if(window._removeFromPlaylist)window._removeFromPlaylist(plId,fbKey);
  showToast('Removed from playlist');
}

/* ── Playlist create modal ── */
function openPlCreateModal(){
  document.getElementById('pl-create-modal').classList.remove('hidden');
  document.getElementById('pl-name-input').value='';
  setTimeout(()=>document.getElementById('pl-name-input').focus(),100);
}
function closePlCreateModal(){document.getElementById('pl-create-modal').classList.add('hidden');}
async function confirmCreatePlaylist(){
  const name=document.getElementById('pl-name-input').value.trim();
  if(!name){showToast('Enter a playlist name');return;}
  closePlCreateModal();
  if(window._createPlaylist)await window._createPlaylist(name);
  showToast(`"${name}" created!`);
}

/* ── Playlist picker ── */
function openPlPicker(mediaId,mediaType,mediaTitle,mediaPoster){
  pendingPlItem={id:mediaId,type:mediaType,title:mediaTitle,poster:mediaPoster||''};
  document.getElementById('pl-picker-modal').classList.remove('hidden');
  renderPlPickerList();
}
function closePlPicker(){document.getElementById('pl-picker-modal').classList.add('hidden');pendingPlItem=null;}
function renderPlPickerList(){
  const list=document.getElementById('pl-picker-list');if(!list)return;
  const pls=window._playlists||{};const keys=Object.keys(pls);
  if(!keys.length){list.innerHTML=`<div style="padding:20px;text-align:center;font-size:13px;color:var(--text-light)">No playlists yet.<br><span style="color:var(--accent);cursor:pointer" onclick="closePlPicker();openPlCreateModal()">Create one first</span></div>`;return;}
  list.innerHTML=keys.map(plId=>{
    const pl=pls[plId];
    const alreadyIn=pendingPlItem&&window._isInPlaylist&&window._isInPlaylist(plId,pendingPlItem.id,pendingPlItem.type);
    return`<div class="playlist-picker-item${alreadyIn?' already-in':''}" onclick="addItemToPlaylist('${escA(plId)}')">
      <div class="playlist-picker-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/></svg>
      </div>
      <div class="playlist-picker-name">${escH(pl.name||'Untitled')}</div>
      ${alreadyIn?`<div class="playlist-picker-check"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>`:''}
    </div>`;
  }).join('');
}
async function addItemToPlaylist(plId){
  if(!pendingPlItem){closePlPicker();return;}
  const result=await window._addToPlaylist(plId,pendingPlItem);
  closePlPicker();
  if(result==='exists')showToast('Already in this playlist');
  else showToast('Added to playlist ✓');
}

/* ── Confirm modal ── */
function showConfirm(icon,title,sub,cb){
  document.getElementById('confirm-icon').textContent=icon;
  document.getElementById('confirm-title').textContent=title;
  document.getElementById('confirm-sub').textContent=sub;
  const btn=document.getElementById('confirm-ok-btn');
  btn.onclick=()=>{closeConfirmModal();cb&&cb();};
  document.getElementById('confirm-modal').classList.remove('hidden');
}
function closeConfirmModal(){document.getElementById('confirm-modal').classList.add('hidden');}
function confirmDeletePlaylist(plId,name){
  showConfirm('🗑',`Delete "${name}"?`,'All titles in this playlist will be lost.',()=>{
    if(window._deletePlaylist)window._deletePlaylist(plId);
    showToast('Playlist deleted');
  });
}

/* =================== WHERE TO WATCH =================== */
function switchWtwTab(key,btn){
  btn.closest('.where-to-watch').querySelectorAll('.wtw-tab').forEach(t=>t.classList.remove('active'));btn.classList.add('active');
  btn.closest('.where-to-watch').querySelectorAll('.wtw-providers').forEach(p=>p.style.display='none');
  const target=document.getElementById('wtw-'+key);if(target)target.style.display='flex';
}

/* =================== USER SCORE =================== */
function buildUserScore(detail){
  const rating=detail.vote_average||0,votes=detail.vote_count||0;
  const pct=Math.round(rating*10),exc=Math.round(pct*0.4),good=Math.round(pct*0.3),avg=Math.round(pct*0.2);
  let col='#22c55e';if(pct<50)col='#ef4444';else if(pct<70)col='#f59e0b';
  return`<div class="user-score-section">
    <div class="user-score-title">⭐ User Score</div>
    <div class="user-score-content">
      <div class="score-circle"><div class="score-number" style="color:${col}">${pct}</div><div class="score-label">%</div></div>
      <div class="score-details">
        <div class="score-bar-row"><div class="score-bar-label">Excellent</div><div class="score-bar-track"><div class="score-bar-fill" style="width:${exc}%;background:${col}"></div></div><div class="score-bar-val">${exc}%</div></div>
        <div class="score-bar-row"><div class="score-bar-label">Good</div><div class="score-bar-track"><div class="score-bar-fill" style="width:${good}%;background:var(--tan)"></div></div><div class="score-bar-val">${good}%</div></div>
        <div class="score-bar-row"><div class="score-bar-label">Average</div><div class="score-bar-track"><div class="score-bar-fill" style="width:${avg}%;background:var(--taupe)"></div></div><div class="score-bar-val">${avg}%</div></div>
        <div class="score-votes">${votes.toLocaleString()} votes · ${rating.toFixed(1)}/10 TMDB</div>
      </div>
    </div>
  </div>`;
}

/* =================== PERSON =================== */
async function openPerson(personId){
  const curActive=document.querySelector('.view.active');
  if(curActive)prevViewStack.push(curActive.id);
  const pv=document.getElementById('person-view');
  showView('person-view');
  pv.innerHTML=`<button class="detail-back" onclick="closePerson()">‹</button><div style="display:flex;align-items:center;justify-content:center;height:100%"><div class="ring"></div></div>`;
  try{
    const[person,credits]=await Promise.all([api(`/person/${personId}`),api(`/person/${personId}/combined_credits`)]);
    renderPerson(pv,person,credits);
  }catch(e){pv.innerHTML=`<button class="detail-back" onclick="closePerson()">‹</button>${errBox('Failed to load person')}`;}
}
function renderPerson(pv,person,credits){
  const name=person.name||'',photo=imgUrl(person.profile_path,'w342'),dept=person.known_for_department||'Acting';
  const bday=person.birthday?fmtDate(person.birthday):'',dday=person.deathday?fmtDate(person.deathday):'';
  const place=person.place_of_birth||'',bio=person.biography||'',popularity=person.popularity?person.popularity.toFixed(1):'';
  const castItems=(credits.cast||[]).map(m=>({id:m.id,title:m.title||m.name||'',poster:m.poster_path,date:m.release_date||m.first_air_date||'',type:m.media_type||'movie',vote:m.vote_average||0}));
  const crewItems=(credits.crew||[]).map(m=>({id:m.id,title:m.title||m.name||'',poster:m.poster_path,date:m.release_date||m.first_air_date||'',type:m.media_type||'movie',vote:m.vote_average||0}));
  const seen=new Set();
  const allCredits=[...castItems,...crewItems].filter(m=>{if(seen.has(m.id))return false;seen.add(m.id);return true;}).filter(m=>m.poster).sort((a,b)=>{if(!a.date&&!b.date)return b.vote-a.vote;if(!a.date)return 1;if(!b.date)return -1;return b.date.localeCompare(a.date);});
  const metaPills=[bday?`Born: ${bday}`:'',dday?`Died: ${dday}`:'',place,popularity?`Popularity: ${popularity}`:''].filter(Boolean).map(p=>`<span class="person-meta-pill">${escH(p)}</span>`).join('');
  const bioId='pbio-'+person.id,bioShort=bio.length>280;
  const bioHtml=bio?`<div class="person-bio${bioShort?' person-bio-short':''}" id="${bioId}">${escH(bio)}</div>${bioShort?`<span class="person-bio-toggle" onclick="expandBio('${bioId}',this)">Read more ▾</span>`:''}`:' ';
  const filmGrid=allCredits.length?allCredits.map(m=>{const p=imgUrl(m.poster,'w342'),yr=m.date?fmtYear(m.date):'',mt=m.type==='tv'?'tv':'movie';return`<div class="film-card" onclick="openDetail(${m.id},'${mt}')"><img src="${p}" alt="${escH(m.title)}" loading="lazy" onerror="this.outerHTML='<div class=film-card-ph>🎬</div>'"/>${yr?`<div class="film-card-year">${yr}</div>`:''}<div class="film-card-label">${escH(m.title)}</div></div>`;}).join(''):`<div style="padding:30px;text-align:center;font-size:13px;color:var(--text-light);grid-column:span 3">No filmography available</div>`;
  pv.innerHTML=`
    <button class="detail-back" onclick="closePerson()">‹</button>
    <div style="padding-top:calc(56px + var(--safe-top));overflow-y:auto;height:100%">
      <div class="person-hero">
        <div class="person-avatar-wrap"><img src="${photo||noAv}" alt="${escH(name)}" onerror="this.src='${noAv}'"/></div>
        <div class="person-info">
          <div class="person-name">${escH(name)}</div>
          <div class="person-dept">${escH(dept)}</div>
          <div class="person-meta-row">${metaPills}</div>
        </div>
      </div>
      ${bioHtml}
      <div style="padding:0 14px 10px"><div class="sec-lbl">Filmography <span style="color:var(--text-light);font-size:9px;font-weight:600;text-transform:none;letter-spacing:0">(${allCredits.length} titles)</span><div class="sec-lbl-line"></div></div></div>
      <div class="filmography-grid">${filmGrid}</div>
    </div>`;
}
function expandBio(id,btn){const el=document.getElementById(id);if(el){el.classList.remove('person-bio-short');btn.style.display='none';}}
function closePerson(){const prev=prevViewStack.pop();showView(prev||'home-view');}

/* =================== DETAIL =================== */
async function openDetail(id,type){
  const curActive=document.querySelector('.view.active');
  if(curActive&&curActive.id!=='detail-view')prevViewStack.push(curActive.id);
  const dv=document.getElementById('detail-view');
  showView('detail-view');
  dv.innerHTML=`<button class="detail-back" onclick="closeDetail()">‹</button><div style="display:flex;align-items:center;justify-content:center;height:100%"><div class="ring"></div></div>`;
  try{
    const reqs=[
      api(`/${type}/${id}`),api(`/${type}/${id}/credits`),api(`/${type}/${id}/videos`),
      api(`/${type}/${id}/images`),api(`/${type}/${id}/watch/providers`),api(`/${type}/${id}/reviews`),
      api(`/${type}/${id}/recommendations`),api(`/${type}/${id}/similar`),
      type==='movie'?api(`/movie/${id}/release_dates`):Promise.resolve({results:[]}),
      type==='movie'?api(`/movie/${id}/keywords`):api(`/tv/${id}/keywords`)
    ];
    const[detail,credits,videos,images,providers,reviews,recommendations,similar,releaseDates,keywords]=await Promise.all(reqs);
    let collection=null;
    if(type==='movie'&&detail.belongs_to_collection&&detail.belongs_to_collection.id){try{collection=await api(`/collection/${detail.belongs_to_collection.id}`);}catch(e){}}
    renderDetail(dv,detail,credits,videos,images,type,providers,reviews,recommendations,similar,releaseDates,keywords,collection);
  }catch(e){dv.innerHTML=`<button class="detail-back" onclick="closeDetail()">‹</button>${errBox('Failed to load')}`;}
}
async function openCompare(a,b){
  const curActive=document.querySelector('.view.active');
  if(curActive&&curActive.id!=='detail-view')prevViewStack.push(curActive.id);
  const dv=document.getElementById('detail-view');
  showView('detail-view');
  dv.innerHTML=`<button class="detail-back" onclick="closeDetail()">‹</button><div style="display:flex;align-items:center;justify-content:center;height:100%"><div class="ring"></div></div>`;
  try{
    const [d1,d2,c1,c2]=await Promise.all([api(`/${a._t}/${a.id}`),api(`/${b._t}/${b.id}`),api(`/${a._t}/${a.id}/credits`),api(`/${b._t}/${b.id}/credits`)]);
    const cast1=new Set((c1.cast||[]).slice(0,20).map(x=>x.name));
    const overlap=(c2.cast||[]).filter(x=>cast1.has(x.name)).slice(0,10).map(x=>x.name).join(', ')||'None';
    const rt1=d1.runtime||(d1.episode_run_time||[])[0]||'N/A';
    const rt2=d2.runtime||(d2.episode_run_time||[])[0]||'N/A';
    dv.innerHTML=`<button class="detail-back" onclick="closeDetail()">‹</button><div class="detail-body"><div class="sec-lbl">Comparison<div class="sec-lbl-line"></div></div><table class="info-tbl"><tbody><tr><td>Title</td><td>${escH(d1.title||d1.name)}</td><td>${escH(d2.title||d2.name)}</td></tr><tr><td>Rating</td><td>${d1.vote_average?.toFixed(1)||'N/A'}</td><td>${d2.vote_average?.toFixed(1)||'N/A'}</td></tr><tr><td>Runtime</td><td>${rt1}</td><td>${rt2}</td></tr><tr><td>Release</td><td>${fmtDate(d1.release_date||d1.first_air_date)}</td><td>${fmtDate(d2.release_date||d2.first_air_date)}</td></tr><tr><td>Cast overlap</td><td colspan="2">${escH(overlap)}</td></tr></tbody></table></div>`;
  }catch(e){dv.innerHTML=`<button class="detail-back" onclick="closeDetail()">‹</button>${errBox('Comparison failed')}`;}
}
function buildWebSearcher(title){
  const engs=window._fbEngines||[];
  const activeId=window._activeEngId?window._activeEngId():null;
  let engPills=engs.length?engs.map(e=>{const fav=window.faviconUrl?window.faviconUrl(e.domain||e.url):'';return`<button class="ws-engine-btn${e.fbKey===activeId?' active':''}" onclick="selectEng('${e.fbKey}')" id="eng-btn-${e.fbKey}"><span class="ws-engine-logo"><img src="${fav}" alt="${escH(e.name)}" onerror="this.style.display='none'"/></span>${escH(e.name)}</button>`;}).join(''):'<div class="ws-no-engines">No engines added — tap ⚙️ Manage to add one.</div>';
  let engRows=engs.length?engs.map(e=>{const fav=window.faviconUrl?window.faviconUrl(e.domain||e.url):'';return`<tr><td class="et-logo-cell"><div class="et-logo-wrap"><img src="${fav}" onerror="this.style.display='none'"/></div></td><td class="et-name">${escH(e.name)}</td><td class="et-desc">${escH(e.desc||'')}</td><td><button class="et-search-btn" onclick="wsGoWith('${escA(e.fbKey)}')">Search</button></td></tr>`;}).join(''):`<tr><td colspan="4" class="no-eng-row">No engines added yet.</td></tr>`;
  return`<div class="web-searcher-section">
    <div class="sec-lbl">Web Search<div class="sec-lbl-line"></div></div>
    <div class="ws-query-row" style="margin-bottom:10px"><input class="ws-query-input" id="ws-main-input" value="${escA(title)}" placeholder="Search query..." inputmode="search" onkeydown="if(event.key==='Enter'){this.blur();wsGo();}"/><button class="ws-go-btn" onclick="wsGo()">Search</button></div>
    <div class="ws-engines-wrap" id="ws-engines-wrap">${engPills}</div>
    <button class="ws-manage-btn" onclick="openEngModal()">⚙️ Manage Engines</button>
    <div style="margin-top:14px"><div class="eng-table-wrap"><table class="eng-table"><thead><tr><th class="et-logo-cell"></th><th>Engine</th><th>Description</th><th></th></tr></thead><tbody id="eng-tbl-body">${engRows}</tbody></table></div></div>
  </div>`;
}
function wsGo(){const inp=document.getElementById('ws-main-input');if(!inp)return;const q=inp.value.trim();if(!q)return;const engs=window._fbEngines||[];if(!engs.length){showToast('Add a search engine first');openEngModal();return;}const eng=engs.find(e=>e.fbKey===(window._activeEngId?window._activeEngId():null))||engs[0];if(!eng)return;window.open(eng.url.replace('{query}',encodeURIComponent(q)),'_blank');}
function wsGoWith(fbKey){const inp=document.getElementById('ws-main-input');const q=inp?inp.value.trim():'';if(!q)return;const eng=(window._fbEngines||[]).find(e=>e.fbKey===fbKey);if(!eng)return;window.open(eng.url.replace('{query}',encodeURIComponent(q)),'_blank');}

async function renderDetail(dv,detail,credits,videos,images,type,providersData,reviews={results:[]},recommendations={results:[]},similar={results:[]},releaseDates={results:[]},keywords={},collection=null){
  const title=detail.title||detail.name||'';
  const backdrop=imgUrl(detail.backdrop_path,'w780'),poster=imgUrl(detail.poster_path,'w342');
  const overview=detail.overview||'No overview available.',tagline=detail.tagline||'';
  const rating=detail.vote_average?detail.vote_average.toFixed(1):'N/A',votes=detail.vote_count?detail.vote_count.toLocaleString():'0';
  const releaseDate=fmtDate(detail.release_date||detail.first_air_date);
  const genres=(detail.genres||[]).map(g=>g.name).join(', ')||'N/A';
  const budget=money(detail.budget),revenue=money(detail.revenue);
  const runtime=detail.runtime?`${detail.runtime} min`:(detail.episode_run_time&&detail.episode_run_time[0]?`${detail.episode_run_time[0]} min/ep`:'N/A');
  const status=detail.status||'N/A',langs=(detail.spoken_languages||[]).map(l=>l.english_name).join(', ')||'N/A';
  const origLang=detail.original_language?detail.original_language.toUpperCase():'N/A';
  const country=(detail.production_countries||[]).map(c=>c.name).join(', ')||'N/A';
  const studios=(detail.production_companies||[]).slice(0,3);
  const studioNames=studios.map(c=>c.name).join(', ')||'N/A';
  const seasons=detail.number_of_seasons,epTotal=detail.number_of_episodes;
  const validSeasons=(detail.seasons||[]).filter(s=>s.season_number>0);
  const trailer=(videos.results||[]).find(v=>v.type==='Trailer'&&v.site==='YouTube')||(videos.results||[]).find(v=>v.site==='YouTube');
  const cast=(credits.cast||[]).slice(0,16);
  const directorsList=(credits.crew||[]).filter(c=>c.job==='Director');
  const writersList=(credits.crew||[]).filter(c=>c.department==='Writing').slice(0,3);
  const directorsHtml=directorsList.length?directorsList.map(c=>`<span class="person-link" onclick="openPerson(${c.id})">${escH(c.name)}</span>`).join(', '):'N/A';
  const writersHtml=writersList.length?writersList.map(c=>`<span class="person-link" onclick="openPerson(${c.id})">${escH(c.name)}</span>`).join(', '):'N/A';
  const backdrops=(images.backdrops||[]).slice(0,12);
  const cert=type==='movie'?((((releaseDates.results||[]).find(r=>r.iso_3166_1==='US')||{}).release_dates||[]).find(r=>r.certification)||{}).certification||'N/A':'N/A';
  const tRows=[
    ['Release',releaseDate],['Genre',genres],['Rating',`${IC.star} ${rating}/10 (${votes} votes)`],
    ['Status',status],['Runtime',runtime],['Certification',cert],['Language',langs],['Orig. Lang',origLang],['Country',country],['Studio',studioNames],
    ...(type==='movie'?[['Director',directorsHtml],['Writer',writersHtml],['Budget',budget],['Revenue',revenue]]:[]),
    ...(seasons?[['Seasons',`${seasons}`]]:[]),
    ...(epTotal?[['Episodes',`${epTotal}`]]:[])
  ];
  const trailerSec=trailer
    ?`<div class="detail-trailer-top"><iframe src="https://www.youtube.com/embed/${trailer.key}?rel=0&modestbranding=1&playsinline=1&autoplay=0" allowfullscreen allow="accelerometer;autoplay;encrypted-media;gyroscope;picture-in-picture"></iframe></div>`
    :backdrop
    ?`<div class="detail-trailer-top" style="position:relative;overflow:hidden"><div class="detail-trailer-fallback" style="background-image:url(${backdrop})"></div><div class="detail-trailer-fallback-grad"></div><div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px">${IC.noplay}<span style="font-size:11px;color:var(--text-light)">No trailer</span></div></div>`
    :`<div class="detail-trailer-top" style="display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px">${IC.noplay}<span style="font-size:11px;color:var(--text-light)">No trailer</span></div>`;
  const scrSec=backdrops.length?`<div class="sec-lbl">Screenshots<div class="sec-lbl-line"></div></div><div class="screenshots-row">${backdrops.map(b=>`<img class="screenshot-img" src="${imgUrl(b.file_path,'w780')}" loading="lazy" alt="Screenshot" onerror="this.style.display='none'"/>`).join('')}</div>`:'';
  let wtwHtml='';
  try{
    const results=providersData&&providersData.results?providersData.results:{};
    const regionData=results['IN']||results['US']||Object.values(results)[0]||null;
    if(regionData){
      const tabs=[{key:'flatrate',label:'Stream 📺'},{key:'rent',label:'Rent 💰'},{key:'buy',label:'Buy 🛒'},{key:'free',label:'Free 🎁'}];
      let tabsHtml='',contentHtml='',firstActive='';
      tabs.forEach(tab=>{
        const providers=regionData[tab.key]||[];
        if(providers.length){
          if(!firstActive)firstActive=tab.key;
          tabsHtml+=`<button class="wtw-tab${firstActive===tab.key?' active':''}" onclick="switchWtwTab('${tab.key}',this)">${tab.label}</button>`;
          const provHtml=providers.map(p=>{const logo=p.logo_path?`${IMG}w92${p.logo_path}`:null;return`<div class="wtw-provider">${logo?`<img class="wtw-logo" src="${logo}" alt="${escH(p.provider_name)}" loading="lazy" onerror="this.outerHTML='<div class=wtw-logo-ph>📺</div>'">`:`<div class="wtw-logo-ph">📺</div>`}<div class="wtw-name">${escH(p.provider_name)}</div></div>`;}).join('');
          contentHtml+=`<div class="wtw-providers" id="wtw-${tab.key}" style="display:${firstActive===tab.key?'flex':'none'};flex-wrap:wrap;gap:10px">${provHtml}</div>`;
        }
      });
      wtwHtml=firstActive?`<div class="where-to-watch"><div class="wtw-title">🎬 Where to Watch</div><div class="wtw-tabs">${tabsHtml}</div>${contentHtml}</div>`:`<div class="where-to-watch"><div class="wtw-title">🎬 Where to Watch</div><div class="wtw-empty">No streaming info available</div></div>`;
    }else{wtwHtml=`<div class="where-to-watch"><div class="wtw-title">🎬 Where to Watch</div><div class="wtw-empty">Not available in your region</div></div>`;}
  }catch(e){wtwHtml='';}
  const castHtml=cast.length?`<div class="sec-lbl">Cast<div class="sec-lbl-line"></div></div><div class="cast-row">${cast.map(a=>{const ph=imgUrl(a.profile_path,'w185');return`<div class="cast-item"><div class="cast-avatar" onclick="openPerson(${a.id})"><img src="${ph||noAv}" alt="${escH(a.name)}" loading="lazy" onerror="this.src='${noAv}'"/></div><div class="cast-name cast-name-link" onclick="copyActorName('${escA(a.name)}')">${escH(a.name)} <span class="copy-icon">${IC.copy}</span></div><div class="cast-char">${escH((a.character||'').substring(0,22))}</div></div>`;}).join('')}</div>`:'';
  const kwList=type==='movie'?(keywords.keywords||[]):(keywords.results||[]);
  const kwHtml=`<div class="sec-lbl">Keywords<div class="sec-lbl-line"></div></div><div class="recent-chips">${kwList.length?kwList.slice(0,16).map(k=>`<div class="recent-chip" onclick="recentClick('${escA(k.name)}')">${escH(k.name)}</div>`).join(''):'<div class="wtw-empty">No keywords</div>'}</div>`;
  const revArr=(reviews.results||[]).slice(0,3);
  const revHtml=`<div class="sec-lbl">Reviews<div class="sec-lbl-line"></div></div>${revArr.length?revArr.map(r=>`<div class="user-score-section"><div class="user-score-title">${escH(r.author||'User')}</div><div style="font-size:12px;color:var(--text-mid);line-height:1.55">${escH((r.content||'').slice(0,320))}${(r.content||'').length>320?'…':''}</div></div>`).join(''):'<div class="wtw-empty">No reviews available</div>'}`;
  const recHtml=(recommendations.results||[]).length?`<div class="section"><div class="section-head"><div class="section-bar"></div><div class="section-title">Recommendations</div></div><div class="h-row">${recommendations.results.filter(i=>i.poster_path).slice(0,12).map(i=>`<div class="poster-card" onclick="openDetail(${i.id},'${type}')"><img src="${imgUrl(i.poster_path,'w342')}" alt="${escH(i.title||i.name||'')}" loading="lazy"/></div>`).join('')}</div></div>`:'';
  const simHtml=(similar.results||[]).length?`<div class="section"><div class="section-head"><div class="section-bar"></div><div class="section-title">Similar Titles</div></div><div class="h-row">${similar.results.filter(i=>i.poster_path).slice(0,12).map(i=>`<div class="poster-card" onclick="openDetail(${i.id},'${type}')"><img src="${imgUrl(i.poster_path,'w342')}" alt="${escH(i.title||i.name||'')}" loading="lazy"/></div>`).join('')}</div></div>`:'';
  const collectionHtml=collection&&collection.parts&&collection.parts.length?`<div class="section"><div class="section-head"><div class="section-bar"></div><div class="section-title">Franchise / Collection</div></div><div style="padding:0 14px 8px;font-size:12px;color:var(--text-mid)">${escH(collection.name)}</div><div class="h-row">${collection.parts.filter(i=>i.poster_path).slice(0,12).map(i=>`<div class="poster-card" onclick="openDetail(${i.id},'movie')"><img src="${imgUrl(i.poster_path,'w342')}" alt="${escH(i.title||'')}" loading="lazy"/></div>`).join('')}</div></div>`:'';
  const safeTitle=escA(title),safePoster=escA(detail.poster_path||'');
  dv.innerHTML=`
    <button class="detail-back" onclick="closeDetail()">‹</button>
    <button class="detail-share-btn detail-share-side-btn" onclick="shareDetail(${detail.id},'${type}','${safeTitle}')" title="Share">${IC.share}</button>
    <button class="detail-playlist-btn" onclick="openPlPicker(${detail.id},'${type}','${safeTitle}','${safePoster}')" title="Add to Playlist">${IC.plus}</button>
    <button class="detail-share-btn" style="top:auto;bottom:calc(var(--nav-h) + 10px + var(--safe-bottom));right:132px;width:48px;height:48px;border:1.5px solid var(--accent);background:rgba(250,248,245,0.95)" onclick="compareFromDetail(${detail.id},'${type}','${safeTitle}')" title="Compare">⚖️</button>
    ${trailerSec}
    <div class="detail-body">
      <div class="dprow">
        ${poster?`<div class="dposter"><img src="${poster}" alt="${escH(title)}" onerror="this.style.display='none'"/></div>`:''}
        <div class="dpinfo">
          <div class="dbadges"><span class="badge-r">${type==='tv'?'TV Show':'Movie'}</span><span class="badge-o">${IC.star} ${rating}</span></div>
          <div class="dtitle" onclick="copyTitle('${escA(title)}')">${escH(title)} <span style="display:inline-flex;margin-left:4px;vertical-align:middle;opacity:0.35">${IC.copy}</span></div>
          ${tagline?`<div class="dtagline">"${escH(tagline)}"</div>`:''}
          <div class="ddate">${IC.cal} ${releaseDate}</div>
        </div>
      </div>
      <div class="doverview">${escH(overview)}</div>
      ${buildUserScore(detail)}
      ${wtwHtml}
      ${buildWebSearcher(title)}
      <div class="sec-lbl">Details<div class="sec-lbl-line"></div></div>
      <table class="info-tbl"><tbody>${tRows.map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</tbody></table>
      ${scrSec}
      ${castHtml}
      ${kwHtml}
      ${revHtml}
      ${recHtml}
      ${simHtml}
      ${collectionHtml}
      ${type==='tv'&&validSeasons.length?`<div class="sec-lbl">Episodes<div class="sec-lbl-line"></div></div><div class="season-sel" id="season-sel">${validSeasons.map((s,i)=>`<button class="season-btn${i===0?' active':''}" onclick="loadSeason(${detail.id},${s.season_number},this)">Season ${s.season_number}</button>`).join('')}</div><div class="ep-list" id="ep-list"><div class="small-ring"></div></div>`:''}
    </div>`;
  if(!document.getElementById('person-link-style')){const st=document.createElement('style');st.id='person-link-style';st.textContent=`.person-link{color:var(--accent);cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;font-weight:700}.person-link:active{opacity:0.6}`;document.head.appendChild(st);}
  if(type==='tv'&&validSeasons.length)loadSeason(detail.id,validSeasons[0].season_number,null);
}

async function loadSeason(showId,seasonNum,btnEl){
  if(btnEl){document.querySelectorAll('.season-btn').forEach(b=>b.classList.remove('active'));btnEl.classList.add('active');}
  const list=document.getElementById('ep-list');if(!list)return;
  list.innerHTML='<div class="small-ring"></div>';
  try{
    const d=await api(`/tv/${showId}/season/${seasonNum}`);
    const eps=d.episodes||[];
    if(!eps.length){list.innerHTML=errBox('No episodes');return;}
    list.innerHTML=eps.map(ep=>{
      const thumb=imgUrl(ep.still_path,'w300'),airDate=fmtDate(ep.air_date);
      const epRt=ep.vote_average?ep.vote_average.toFixed(1):'',epRun=ep.runtime?`${ep.runtime}m`:'';
      return`<div class="ep-card"><div class="ep-num">E${ep.episode_number}</div><div class="ep-info"><div class="ep-title">${escH(ep.name||`Episode ${ep.episode_number}`)}</div><div class="ep-meta"><span class="ep-date">${IC.cal} ${airDate}</span>${epRt?`<span class="ep-rating">${IC.star}${epRt}</span>`:''} ${epRun?`<span class="ep-rt">${epRun}</span>`:''}</div>${ep.overview?`<div class="ep-ov">${escH(ep.overview)}</div>`:''}</div><img class="ep-thumb" src="${thumb||noThumb}" alt="E${ep.episode_number}" loading="lazy" onerror="this.src='${noThumb}'"/></div>`;
    }).join('');
  }catch(e){if(list)list.innerHTML=errBox('Failed to load episodes');}
}

function compareFromDetail(id,type,title){
  compareSelection.push({id,_t:type,title});
  compareSelection=compareSelection.slice(-2);
  if(compareSelection.length<2){showToast('Pick one more title to compare');return;}
  openCompare(compareSelection[0],compareSelection[1]);
}
function closeDetail(){
  if(window.location.hash.startsWith('#detail'))history.replaceState(null,'',window.location.pathname+window.location.search);
  const prev=prevViewStack.pop();
  showView(prev||'home-view');
  if(!prev||prev==='home-view')setBnav('bnav-home');
  else if(prev==='movies-view')setBnav('bnav-movies');
  else if(prev==='tv-view')setBnav('bnav-tv');
  else if(prev==='search-view')setBnav('bnav-search');
  else if(prev==='mylist-view')setBnav('bnav-mylist');
}

/* =================== ENGINE MODAL =================== */
function openEngModal(){
  document.getElementById('eng-modal').classList.remove('hidden');
  document.getElementById('eng-url-inp').value='';document.getElementById('eng-desc-inp').value='';
  document.getElementById('eng-preview').classList.remove('show');
}
function closeEngModal(){document.getElementById('eng-modal').classList.add('hidden');}
function addEngine(){
  const url=document.getElementById('eng-url-inp').value.trim();
  if(!url||!url.includes('{query}')){showToast('URL must contain {query}');return;}
  if(!url.startsWith('http')){showToast('URL must start with http');return;}
  const domain=window.extractDomain?window.extractDomain(url):null;
  if(!domain){showToast('Enter a valid URL');return;}
  const name=window.domainToName?window.domainToName(domain):domain;
  const desc=document.getElementById('eng-desc-inp').value.trim();
  if(window._addEngineFB)window._addEngineFB(name,url,domain,desc);
  document.getElementById('eng-url-inp').value='';document.getElementById('eng-desc-inp').value='';
  document.getElementById('eng-preview').classList.remove('show');
  showToast(`${name} added!`);
}

/* =================== INIT =================== */
async function init(){
  await buildHomeView();
  document.getElementById('global-loading').style.display='none';
  handleDeepLink();
  window._onPlaylistsChange=()=>{
    if(document.getElementById('mylist-view').classList.contains('active')){
      const sec=document.getElementById('mylist-pl-section');
      if(sec)renderPlaylistsSection(sec);
    }
  };
}
init();
