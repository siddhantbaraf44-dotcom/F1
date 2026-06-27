window.handleDeepLink = function handleDeepLink(){
  const m = window.location.hash.match(/^#detail\/(movie|tv)\/(\d+)$/);
  if(m){ window.openDetail(parseInt(m[2]), m[1]); return true; }
  const p = window.location.hash.match(/^#playlist\/([^\/]+)\/([^\/]+)$/);
  if(p){ window.openSharedPlaylist(p[1], p[2]); return true; }
  return false;
};

window.showView = function showView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const el=document.getElementById(id);
  if(el){el.classList.add('active');if(!['detail-view','person-view','shared-playlist-view'].includes(id))el.scrollTop=0;}
};
window.setBnav = function setBnav(id){
  document.querySelectorAll('.bnav-item').forEach(b=>b.classList.remove('active'));
  if(id){const el=document.getElementById(id);if(el)el.classList.add('active');}
};
window.goHome = function(){window.showView('home-view');window.setBnav('bnav-home');};
window.goMovies = function(){window.showView('movies-view');window.setBnav('bnav-movies');if(!window.moviesBuilt){window.moviesBuilt=true;window.buildMoviesView();}};
window.goTV = function(){window.showView('tv-view');window.setBnav('bnav-tv');if(!window.tvBuilt){window.tvBuilt=true;window.buildTVView();}};
window.goSearch = function(){window.showView('search-view');window.setBnav('bnav-search');if(!window.searchBuilt){window.searchBuilt=true;window.buildSearchView();}else window.renderSearchHome();setTimeout(()=>{const i=document.getElementById('main-search-input');if(i)i.focus();},200);};
window.goMyList = function(){window.showView('mylist-view');window.setBnav('bnav-mylist');window.buildMyListView();};
