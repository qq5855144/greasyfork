// ==UserScript==
// @name         全站链接小窗
// @namespace    https://bbs.binmt.cc/
// @version      2.0.0
// @description  全站链接小窗浏览器：多标签、历史导航、拖拽高度、站点记忆、媒体预览、黑白名单与智能顶栏配色
// @match        *://*/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (window.top !== window.self) return;
  if (window.__MT_GLOBAL_LINK_WINDOW__) return;
  window.__MT_GLOBAL_LINK_WINDOW__ = true;

  var KEY = 'mt-global-link-window-v2';
  var DEFAULTS = {
    height: 92,
    animation: 280,
    adaptiveColor: true,
    rememberHeight: true,
    multiTab: true,
    sameOriginHistory: true,
    mediaPreview: true,
    openExternal: false,
    whitelist: [],
    blacklist: [],
    searchEngines: [
      'google.com','google.ad','google.ae','google.am','google.at','google.az',
      'google.ba','google.be','google.bg','google.ca','google.ch','google.cl',
      'google.co.id','google.co.il','google.co.in','google.co.jp','google.co.kr',
      'google.co.nz','google.pl','google.pt','google.ro','google.ru','google.sa',
      'google.se','google.sg','google.th','google.tr','google.tw','google.ua',
      'google.co.uk','google.com.au','google.com.br','google.com.hk',
      'google.com.sg','google.com.tw','google.com.vn','bing.com','bing.cn',
      'baidu.com','baidu.cn','sogou.com','sogou.cn','so.com','360.cn',
      'haosou.com','sm.cn','shenma.com','duckduckgo.com','search.yahoo.com',
      'yahoo.com','yandex.com','yandex.ru','yandex.eu','naver.com',
      'search.brave.com','brave.com','startpage.com','ecosia.org','qwant.com',
      'kagi.com','searx.be','searxng.org','perplexity.ai'
    ]
  };

  var cfg = loadConfig();
  var state = {
    opened: false,
    tabs: [],
    active: -1,
    panel: null,
    mask: null,
    head: null,
    tabbar: null,
    content: null,
    color: {r:83,g:188,b:245,a:1},
    historyMarker: false,
    closingByHistory: false,
    drag: null
  };

  function loadConfig() {
    try {
      var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      return merge(DEFAULTS, saved || {});
    } catch (e) {
      return merge(DEFAULTS, {});
    }
  }

  function merge(base, extra) {
    var out = {};
    Object.keys(base).forEach(function (k) {
      out[k] = Array.isArray(base[k]) ? base[k].slice() : base[k];
    });
    Object.keys(extra || {}).forEach(function (k) {
      out[k] = Array.isArray(extra[k]) ? extra[k].slice() : extra[k];
    });
    return out;
  }

  function saveConfig() {
    try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {}
  }

  function hostOf(url) {
    try { return new URL(url, location.href).hostname.toLowerCase().replace(/^www\\./, ''); }
    catch (e) { return ''; }
  }

  function domainMatch(host, domain) {
    domain = String(domain || '').toLowerCase().replace(/^https?:\\/\\//, '').replace(/^www\\./, '').split('/')[0];
    return !!domain && (host === domain || host.endsWith('.' + domain));
  }

  function inList(host, list) {
    return (list || []).some(function (d) { return domainMatch(host, d); });
  }

  function isSearchEngine(url) {
    return inList(hostOf(url), cfg.searchEngines);
  }

  function isWeb(url) {
    try {
      var p = new URL(url, location.href).protocol;
      return p === 'http:' || p === 'https:';
    } catch (e) { return false; }
  }

  function shouldIntercept(a) {
    if (!a || !a.href || !isWeb(a.href)) return false;
    if (a.closest && a.closest('.mt-sw-root')) return false;
    if (a.hasAttribute('download')) return false;
    if ((a.getAttribute('rel') || '').toLowerCase().split(/\\s+/).indexOf('external') >= 0) return false;

    var url = a.href, host = hostOf(url);
    if (isSearchEngine(url)) return false;
    if (inList(host, cfg.whitelist)) return false;
    if (inList(host, cfg.blacklist)) return false;

    try {
      var u = new URL(url), c = new URL(location.href);
      if (u.origin === c.origin && u.pathname === c.pathname && u.search === c.search && u.hash && u.hash !== c.hash) return false;
    } catch (e) {}
    return true;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }

  function icon(name) {
    var map = {
      back:'<path d="M10.5 3.5 5 8l5.5 4.5"/><path d="M5.5 8H14"/>',
      forward:'<path d="m5.5 3.5 5.5 4.5-5.5 4.5"/><path d="M10.5 8H2"/>',
      reload:'<path d="M13 5V2.5L15 4.5"/><path d="M13.8 4.2A6 6 0 1 0 14 9"/>',
      external:'<path d="M6 3H3v10h10V9"/><path d="M9.5 3H13v3.5"/><path d="M7.5 8.5 13 3"/>',
      close:'<path d="m3 3 10 10M13 3 3 13"/>',
      plus:'<path d="M8 3v10M3 8h10"/>',
      settings:'<circle cx="8" cy="8" r="2.2"/><path d="M8 1.8v1.3M8 12.9v1.3M1.8 8h1.3M12.9 8h1.3M3.6 3.6l.9.9M11.5 11.5l.9.9M12.4 3.6l-.9.9M4.5 11.5l-.9.9"/>'
    };
    return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + map[name] + '</svg>';
  }

  function addStyle() {
    if (document.getElementById('mt-sw-style-v2')) return;
    var s = document.createElement('style');
    s.id = 'mt-sw-style-v2';
    s.textContent =
      '.mt-sw-root{position:fixed;inset:0;z-index:2147483646;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}' +
      '.mt-sw-mask{position:absolute;inset:0;background:rgba(0,0,0,.45);opacity:0;transition:opacity .25s ease;pointer-events:auto;}' +
      '.mt-sw-panel{position:absolute;left:0;right:0;bottom:0;height:var(--mt-sw-height,92vh);max-height:98vh;min-height:45vh;background:#fff;border-radius:18px 18px 0 0;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 -5px 28px rgba(0,0,0,.22);transform:translateY(100%);transition:transform .28s cubic-bezier(.32,.72,.36,1);pointer-events:auto;}' +
      '.mt-sw-show .mt-sw-mask{opacity:1}.mt-sw-show .mt-sw-panel{transform:translateY(0)}' +
      '.mt-sw-resize{height:7px;flex:none;cursor:ns-resize;touch-action:none;background:transparent;position:relative;z-index:4}' +
      '.mt-sw-resize:after{content:"";position:absolute;left:50%;top:3px;width:42px;height:4px;border-radius:4px;transform:translateX(-50%);background:rgba(0,0,0,.18)}' +
      '.mt-sw-head{display:flex;align-items:center;gap:5px;padding:4px 8px;background:var(--mt-sw-color,#53BCF5);color:var(--mt-sw-fg,#fff);transition:background .22s ease,color .22s ease;flex:none}' +
      '.mt-sw-nav{display:flex;gap:4px;flex:none}.mt-sw-btn{width:32px;height:32px;border:0;border-radius:50%;padding:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.2);color:inherit;cursor:pointer}.mt-sw-btn:active{transform:scale(.94)}.mt-sw-btn:disabled{opacity:.38}' +
      '.mt-sw-title{min-width:0;flex:1;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 4px}' +
      '.mt-sw-tabbar{display:flex;align-items:center;gap:4px;padding:5px 7px;background:rgba(245,245,247,.96);border-bottom:1px solid rgba(0,0,0,.08);overflow-x:auto;scrollbar-width:none;flex:none}.mt-sw-tabbar::-webkit-scrollbar{display:none}' +
      '.mt-sw-tab{height:31px;min-width:88px;max-width:190px;display:flex;align-items:center;gap:6px;padding:0 8px;border-radius:9px;background:rgba(0,0,0,.055);font-size:12px;color:#555;flex:none;cursor:pointer}.mt-sw-tab.active{background:#fff;color:#222;box-shadow:0 1px 5px rgba(0,0,0,.12)}.mt-sw-tab span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}.mt-sw-tab b{font-weight:400;font-size:15px;line-height:1;color:#888}.mt-sw-add{width:31px;height:31px;border:0;border-radius:9px;background:transparent;color:#666;flex:none}' +
      '.mt-sw-content{position:relative;flex:1;min-height:0;background:#fff}.mt-sw-frame{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff}.mt-sw-media{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#111}.mt-sw-audio{position:absolute;left:16px;right:16px;top:50%;transform:translateY(-50%);width:calc(100% - 32px)}' +
      '.mt-sw-error{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#666;background:#fff;padding:24px;text-align:center}.mt-sw-error button{border:0;border-radius:9px;padding:9px 14px;background:#eee}' +
      '.mt-sw-settings{position:absolute;inset:0;background:rgba(255,255,255,.98);z-index:8;overflow:auto;padding:18px;display:none}.mt-sw-settings.show{display:block}.mt-sw-settings h3{margin:0 0 16px;font-size:18px}.mt-sw-setting{padding:12px 0;border-bottom:1px solid #eee}.mt-sw-setting label{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:14px}.mt-sw-setting input[type=number]{width:76px}.mt-sw-setting textarea{width:100%;box-sizing:border-box;min-height:70px;margin-top:8px;border:1px solid #ddd;border-radius:8px;padding:8px;resize:vertical}.mt-sw-settings-actions{display:flex;gap:8px;margin-top:16px}.mt-sw-settings-actions button{flex:1;border:0;border-radius:9px;padding:10px}.mt-sw-primary{background:#53BCF5;color:#fff}.mt-sw-secondary{background:#eee}' +
      '.mt-sw-tip{font-size:11px;color:#999;line-height:1.5;margin-top:5px}';
    (document.head || document.documentElement).appendChild(s);
  }

  function mediaType(url) {
    if (!cfg.mediaPreview) return 'html';
    var p = '';
    try { p = new URL(url).pathname.toLowerCase(); } catch (e) {}
    if (/\\.(png|jpe?g|gif|webp|bmp|svg|avif|ico)(?:$|\\?)/i.test(p)) return 'image';
    if (/\\.(mp4|webm|m4v|mov|ogv)(?:$|\\?)/i.test(p)) return 'video';
    if (/\\.(mp3|m4a|aac|ogg|wav|flac)(?:$|\\?)/i.test(p)) return 'audio';
    if (/\\.pdf(?:$|\\?)/i.test(p)) return 'pdf';
    return 'html';
  }

  function createTab(url, title, activate) {
    var t = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2,7),
      url: url,
      title: title || hostOf(url) || '网页',
      history: [url],
      historyIndex: 0,
      view: null,
      frame: null,
      element: null,
      loading: true,
      sameOrigin: false
    };
    state.tabs.push(t);
    if (activate !== false) state.active = state.tabs.length - 1;
    return t;
  }

  function activeTab() { return state.tabs[state.active] || null; }

  function setPanelHeight(percent) {
    percent = Math.max(45, Math.min(98, Number(percent) || 92));
    state.panel.style.setProperty('--mt-sw-height', percent + 'vh');
    state.panel.dataset.height = percent;
  }

  function getSiteHeight(host) {
    try {
      var s = JSON.parse(localStorage.getItem(KEY + ':sites') || '{}');
      return s[host] && Number(s[host].height);
    } catch (e) { return null; }
  }

  function saveSiteHeight(host, height) {
    if (!cfg.rememberHeight || !host) return;
    try {
      var s = JSON.parse(localStorage.getItem(KEY + ':sites') || '{}');
      s[host] = {height: Math.round(height)};
      localStorage.setItem(KEY + ':sites', JSON.stringify(s));
    } catch (e) {}
  }

  function luma(c) { return (c.r * 299 + c.g * 587 + c.b * 114) / 1000; }

  function parseColor(v) {
    if (!v || v === 'transparent') return null;
    var m = String(v).match(/^rgba?\\(\\s*(\\d+)\\D+(\\d+)\\D+(\\d+)(?:\\D+([\\d.]+))?\\s*\\)$/i);
    if (m && (m[4] == null || parseFloat(m[4]) > .05)) return {r:+m[1],g:+m[2],b:+m[3],a:m[4]==null?1:+m[4]};
    m = String(v).match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) { var h=m[1]; if(h.length===3) h=h.split('').map(function(x){return x+x}).join(''); return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16),a:1}; }
    return null;
  }

  function gradientColor(v) {
    if (!v || v === 'none') return null;
    var m = String(v).match(/(?:linear|radial)-gradient\\([^)]*?((?:#[0-9a-f]{3,6}|rgba?\\([^)]*\\)))/i);
    return m ? parseColor(m[1]) : null;
  }

  function detectColor(t, done) {
    var fallback = {r:83,g:188,b:245,a:1};
    try {
      var doc = t.frame && t.frame.contentDocument;
      if (!doc) throw 0;
      var meta = doc.querySelector('meta[name="theme-color"],meta[name="msapplication-navbutton-color"]');
      var mc = meta && parseColor(meta.content);
      if (mc) return done(mc);

      var selectors = ['header','[role="banner"]','nav','.header','.navbar','.topbar','.top-bar','.site-header','.page-header'];
      var list = [];
      selectors.forEach(function(sel){
        try { Array.prototype.slice.call(doc.querySelectorAll(sel)).slice(0,4).forEach(function(x){list.push(x);}); } catch(e){}
      });
      list.push(doc.body, doc.documentElement);
      for (var i=0;i<list.length;i++) {
        var el=list[i]; if(!el) continue;
        var r=el.getBoundingClientRect ? el.getBoundingClientRect() : null;
        if(r && (r.height<=0 || r.bottom<=0 || r.top>160)) continue;
        var cs=t.frame.contentWindow.getComputedStyle(el);
        var c=parseColor(cs.backgroundColor) || gradientColor(cs.backgroundImage);
        if(c) return done(c);
      }
      done(fallback);
    } catch(e) { done(fallback); }
  }

  function applyColor(t) {
    if (!state.head || !cfg.adaptiveColor) return;
    detectColor(t, function(c){
      state.color=c;
      state.head.style.setProperty('--mt-sw-color','rgb('+c.r+','+c.g+','+c.b+')');
      state.head.style.setProperty('--mt-sw-fg',luma(c)>205?'rgba(0,0,0,.65)':'#fff');
    });
  }

  function updateNav() {
    var t=activeTab(), back=state.panel && state.panel.querySelector('[data-act=back]'), fwd=state.panel && state.panel.querySelector('[data-act=forward]');
    if(back) back.disabled=!t || t.historyIndex<=0;
    if(fwd) fwd.disabled=!t || t.historyIndex>=t.history.length-1;
    var title=state.panel && state.panel.querySelector('.mt-sw-title');
    if(title) title.textContent=t ? t.title : '网页小窗';
  }

  function updateTabs() {
    if(!state.tabbar) return;
    state.tabbar.innerHTML='';
    state.tabs.forEach(function(t,i){
      var b=document.createElement('button'); b.className='mt-sw-tab'+(i===state.active?' active':'');
      b.innerHTML='<span>'+esc(t.title)+'</span><b title="关闭">×</b>';
      b.onclick=function(e){ if(e.target===b.querySelector('b')) closeTab(i); else activateTab(i); };
      state.tabbar.appendChild(b);
    });
    var add=document.createElement('button'); add.className='mt-sw-add'; add.innerHTML=icon('plus'); add.title='新标签页';
    add.onclick=function(){ createTab('about:blank','新标签页'); renderTabs(); };
    state.tabbar.appendChild(add);
    updateNav();
  }

  function activateTab(i) {
    if(i<0 || i>=state.tabs.length) return;
    state.active=i;
    state.tabs.forEach(function(t,n){ if(t.element) t.element.style.display=n===i?'block':'none'; });
    updateTabs();
    var t=activeTab();
    if(t) applyColor(t);
  }

  function closeTab(i) {
    var t=state.tabs[i];
    if(!t) return;
    if(t.element) t.element.remove();
    state.tabs.splice(i,1);
    if(!state.tabs.length) { closePanel(false); return; }
    if(state.active>i) state.active--;
    else if(state.active>=state.tabs.length) state.active=state.tabs.length-1;
    activateTab(state.active);
  }

  function renderTabs() {
    state.tabs.forEach(function(t,i){ if(t.element) t.element.style.display=i===state.active?'block':'none'; });
    updateTabs();
  }

  function pushHistory(t,url) {
    if(!url || url==='about:blank') return;
    if(t.history[t.historyIndex]===url) return;
    t.history=t.history.slice(0,t.historyIndex+1);
    t.history.push(url);
    t.historyIndex=t.history.length-1;
  }

  function navigateTab(t,url,addHistory) {
    if(!t) return;
    if(addHistory) pushHistory(t,url);
    t.url=url;
    t.loading=true;
    if(t.view) {
      t.view.remove();
      t.view=null;
      t.frame=null;
    }
    renderTabContent(t);
    updateNav();
  }

  function renderTabContent(t) {
    if(!state.content) return;
    var type=mediaType(t.url), el;
    if(type==='image'){
      el=document.createElement('img'); el.className='mt-sw-media'; el.src=t.url;
      el.onerror=function(){showTabError(t,'图片无法加载');};
    } else if(type==='video'){
      el=document.createElement('video'); el.className='mt-sw-media'; el.controls=true; el.playsInline=true; el.src=t.url;
      el.onerror=function(){showTabError(t,'视频无法播放');};
    } else if(type==='audio'){
      el=document.createElement('audio'); el.className='mt-sw-audio'; el.controls=true; el.src=t.url;
      el.onerror=function(){showTabError(t,'音频无法播放');};
    } else {
      el=document.createElement('iframe'); el.className='mt-sw-frame'; el.src=t.url; el.setAttribute('loading','eager');
      t.frame=el;
      el.addEventListener('load',function(){
        t.loading=false;
        try { t.sameOrigin=!!el.contentDocument; } catch(e){ t.sameOrigin=false; }
        applyColor(t);
        installSameOriginBridge(t);
        if(t.title==='网页' || t.title==='新标签页'){
          try { t.title=el.contentDocument.title || hostOf(t.url) || '网页'; } catch(e) {}
        }
        updateTabs();
      });
      el.addEventListener('error',function(){showTabError(t,'页面无法嵌入，可能被网站禁止 iframe。');});
    }
    t.view=el; t.element=el; state.content.appendChild(el);
    state.tabs.forEach(function(x,i){if(x.element)x.element.style.display=i===state.active?'block':'none';});
  }

  function showTabError(t,msg) {
    var box=document.createElement('div'); box.className='mt-sw-error';
    box.innerHTML='<div>'+esc(msg)+'</div><button>在新窗口打开</button>';
    box.querySelector('button').onclick=function(){window.open(t.url,'_blank');};
    if(t.element)t.element.remove();
    t.view=box;t.element=box;state.content.appendChild(box);
    renderTabs();
  }

  function installSameOriginBridge(t) {
    if(!cfg.sameOriginHistory || !t.frame) return;
    try {
      var doc=t.frame.contentDocument;
      if(!doc || doc.__MT_SW_BRIDGED__) return;
      doc.__MT_SW_BRIDGED__=true;
      doc.addEventListener('click',function(e){
        if(e.defaultPrevented || e.button!==0 || e.ctrlKey||e.metaKey||e.shiftKey||e.altKey) return;
        var a=e.target && e.target.closest ? e.target.closest('a[href]') : null;
        if(!a || !isWeb(a.href) || a.hasAttribute('download')) return;
        var h=hostOf(a.href);
        if(isSearchEngine(a.href)||inList(h,cfg.whitelist)||inList(h,cfg.blacklist)) return;
        e.preventDefault(); e.stopPropagation();
        navigateTab(t,a.href,true);
      },true);
    } catch(e) {}
  }

  function openTab(url,title) {
    if(!isWeb(url)) return;
    if(!state.opened) openPanel();
    var t=createTab(url,title,true);
    if(cfg.multiTab || state.tabs.length===1) renderTabContent(t);
    else {
      var old=state.tabs[state.tabs.length-2];
      navigateTab(old,url,true);
      state.tabs.pop();
    }
    updateTabs();
  }

  function openPanel(initialUrl,initialTitle) {
    if(state.opened) return;
    addStyle();
    state.opened=true;
    state.tabs=[];
    state.active=-1;

    var root=document.createElement('div'); root.className='mt-sw-root';
    var mask=document.createElement('div'); mask.className='mt-sw-mask';
    var panel=document.createElement('div'); panel.className='mt-sw-panel';
    var resize=document.createElement('div'); resize.className='mt-sw-resize'; resize.title='拖动调整小窗高度';

    var head=document.createElement('div'); head.className='mt-sw-head';
    var nav=document.createElement('div'); nav.className='mt-sw-nav';
    function btn(act,title,ic){var b=document.createElement('button');b.className='mt-sw-btn';b.dataset.act=act;b.title=title;b.innerHTML=icon(ic);return b;}
    var back=btn('back','后退','back'), forward=btn('forward','前进','forward'), reload=btn('reload','刷新','reload');
    nav.append(back,forward,reload);
    var title=document.createElement('div'); title.className='mt-sw-title'; title.textContent='网页小窗';
    var actions=document.createElement('div'); actions.className='mt-sw-nav';
    var settings=btn('settings','设置','settings'), external=btn('external','新窗口打开','external'), close=btn('close','关闭','close');
    actions.append(settings,external,close);
    head.append(nav,title,actions);

    var tabbar=document.createElement('div'); tabbar.className='mt-sw-tabbar';
    var content=document.createElement('div'); content.className='mt-sw-content';
    var settingsBox=document.createElement('div'); settingsBox.className='mt-sw-settings';

    panel.append(resize,head,tabbar,content,settingsBox);
    root.append(mask,panel); document.body.appendChild(root);
    state.panel=panel;state.mask=mask;state.head=head;state.tabbar=tabbar;state.content=content;

    var savedHeight=initialUrl && cfg.rememberHeight ? getSiteHeight(hostOf(initialUrl)) : null;
    setPanelHeight(savedHeight || cfg.height);

    back.onclick=function(){goHistory(-1);};
    forward.onclick=function(){goHistory(1);};
    reload.onclick=function(){var t=activeTab();if(t){if(t.view&&t.view.tagName==='IFRAME')t.frame.src=t.url;else navigateTab(t,t.url,false);}};
    external.onclick=function(){var t=activeTab();if(t)window.open(t.url,'_blank');};
    close.onclick=function(){closePanel(true);};
    mask.onclick=function(){closePanel(true);};
    settings.onclick=function(){toggleSettings(true);};

    resize.addEventListener('pointerdown',function(e){
      e.preventDefault();
      state.drag={startY:e.clientY,startHeight:panel.getBoundingClientRect().height,startPercent:parseFloat(panel.dataset.height)||92,host:hostOf(activeTab()&&activeTab().url)};
      resize.setPointerCapture && resize.setPointerCapture(e.pointerId);
    });
    resize.addEventListener('pointermove',function(e){
      if(!state.drag)return;
      var h=state.drag.startHeight+(state.drag.startY-e.clientY);
      var p=Math.max(45,Math.min(98,h/window.innerHeight*100));
      setPanelHeight(p);
    });
    resize.addEventListener('pointerup',function(){
      if(!state.drag)return;
      var host=state.drag.host;
      if(host)saveSiteHeight(host,parseFloat(panel.dataset.height)||92);
      state.drag=null;
    });

    buildSettings(settingsBox);
    if(initialUrl) {
      createTab(initialUrl,initialTitle || hostOf(initialUrl) || '网页',true);
      renderTabContent(activeTab());
    }
    updateTabs();

    requestAnimationFrame(function(){root.classList.add('mt-sw-show');});
    if(!state.historyMarker){
      try { history.pushState({mtGlobalWindow:true},'',location.href); state.historyMarker=true; } catch(e) {}
    }
  }

  function closePanel(useHistory) {
    if(!state.opened) return;
    if(useHistory && state.historyMarker && !state.closingByHistory){
      state.closingByHistory=true;
      try { history.back(); } catch(e) { finishClose(); }
      return;
    }
    finishClose();
  }

  function finishClose() {
    state.tabs.forEach(function(t){if(t.element)t.element.remove();});
    state.tabs=[];state.active=-1;state.opened=false;
    if(state.panel && state.panel.parentNode)state.panel.parentNode.parentNode.removeChild(state.panel.parentNode);
    state.panel=state.mask=state.head=state.tabbar=state.content=null;
    state.historyMarker=false;
    state.closingByHistory=false;
  }

  function goHistory(delta) {
    var t=activeTab(); if(!t) return;
    var next=t.historyIndex+delta;
    if(next<0 || next>=t.history.length) return;
    t.historyIndex=next;
    t.url=t.history[next];
    renderTabContent(t);
    updateTabs();
  }

  function toggleSettings(show) {
    var box=state.panel && state.panel.querySelector('.mt-sw-settings');
    if(box)box.classList.toggle('show',show);
  }

  function buildSettings(box) {
    box.innerHTML=
      '<h3>小窗设置</h3>' +
      '<div class="mt-sw-setting"><label>默认高度 <input data-set="height" type="number" min="45" max="98" step="1" value="'+esc(cfg.height)+'"> %</label></div>' +
      '<div class="mt-sw-setting"><label>自适应顶栏颜色 <input data-set="adaptiveColor" type="checkbox" '+(cfg.adaptiveColor?'checked':'')+'></label><div class="mt-sw-tip">同源页面优先读取 theme-color、顶部导航、渐变背景；跨域 iframe 无法读取 DOM 时自动使用安全兜底色。</div></div>' +
      '<div class="mt-sw-setting"><label>记忆网站小窗高度 <input data-set="rememberHeight" type="checkbox" '+(cfg.rememberHeight?'checked':'')+'></label></div>' +
      '<div class="mt-sw-setting"><label>多标签模式 <input data-set="multiTab" type="checkbox" '+(cfg.multiTab?'checked':'')+'></label></div>' +
      '<div class="mt-sw-setting"><label>媒体智能预览 <input data-set="mediaPreview" type="checkbox" '+(cfg.mediaPreview?'checked':'')+'></label><div class="mt-sw-tip">图片、视频、音频、PDF 优先使用对应预览器。</div></div>' +
      '<div class="mt-sw-setting"><b>白名单域名</b><textarea data-set="whitelist" placeholder="每行一个，例如 example.com">'+esc(cfg.whitelist.join('\\n'))+'</textarea><div class="mt-sw-tip">白名单网站的链接保持正常浏览器打开。</div></div>' +
      '<div class="mt-sw-setting"><b>黑名单域名</b><textarea data-set="blacklist" placeholder="每行一个">'+esc(cfg.blacklist.join('\\n'))+'</textarea><div class="mt-sw-tip">黑名单网站完全不进入小窗。</div></div>' +
      '<div class="mt-sw-settings-actions"><button class="mt-sw-secondary" data-cancel>取消</button><button class="mt-sw-primary" data-save>保存</button></div>';

    box.querySelector('[data-cancel]').onclick=function(){toggleSettings(false);};
    box.querySelector('[data-save]').onclick=function(){
      cfg.height=Math.max(45,Math.min(98,Number(box.querySelector('[data-set=height]').value)||92));
      ['adaptiveColor','rememberHeight','multiTab','mediaPreview'].forEach(function(k){cfg[k]=box.querySelector('[data-set='+k+']').checked;});
      ['whitelist','blacklist'].forEach(function(k){
        cfg[k]=box.querySelector('[data-set='+k+']').value.split(/\\r?\\n|,/).map(function(x){return x.trim().toLowerCase();}).filter(Boolean);
      });
      saveConfig(); setPanelHeight(cfg.height); toggleSettings(false);
      var t=activeTab();if(t)applyColor(t);
    };
  }

  function titleFromAnchor(a) {
    return (a.getAttribute('title')||a.getAttribute('aria-label')||a.textContent||hostOf(a.href)||'网页').replace(/\\s+/g,' ').trim().slice(0,80);
  }

  document.addEventListener('click',function(e){
    if(e.defaultPrevented || e.button!==0 || e.ctrlKey||e.metaKey||e.shiftKey||e.altKey) return;
    var a=e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if(!shouldIntercept(a)) return;
    e.preventDefault();e.stopPropagation();
    openTab(a.href,titleFromAnchor(a));
  },true);

  window.addEventListener('popstate',function(e){
    if(state.historyMarker && !e.state || (e.state && e.state.mtGlobalWindow)) {
      if(state.historyMarker){
        state.historyMarker=false;
        if(state.opened) finishClose();
      }
    }
  });

  function init(){
    addStyle();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();