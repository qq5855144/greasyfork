// ==UserScript==
// @name         全站链接小窗
// @namespace    https://bbs.binmt.cc/
// @version      2.4.0
// @description  全站链接小窗浏览器：多标签、历史导航、拖拽高度、站点记忆、媒体预览、黑白名单、沉浸式顶栏；支持新标签页模式与 iframe 拦截自动兜底，兼容页面内用户脚本
// @match        *://*/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  var FRAME_MODE = window.top !== window.self;
  if (!FRAME_MODE) {
    if (window.__MT_GLOBAL_LINK_WINDOW__) return;
    window.__MT_GLOBAL_LINK_WINDOW__ = true;
    // 供同源 iframe 快速识别小窗宿主并读取当前配置
    try {
      Object.defineProperty(window, '__MT_SW_PANEL_HOST__', {
        get: function () { return { openMode: cfg.openMode }; },
        configurable: true
      });
    } catch (e) {}
  } else {
    // 供其他用户脚本识别"我正运行在小窗 iframe 中"
    try { window.__MT_SW_FRAME__ = true; } catch (e) {}
  }

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
    openMode: 'window',   // 'window' 小窗 iframe 预览 | 'tab' 浏览器新标签页（用户脚本100%生效）
    autoFallback: true,   // iframe 被 X-Frame-Options/CSP 拦截时自动转新标签页
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
    opened: false, tabs: [], active: -1, panel: null, mask: null,
    head: null, tabbar: null, content: null,
    color: {r:83,g:188,b:245,a:1},
    historyMarker: false, closingByHistory: false, drag: null
  };

  function loadConfig() {
    try { return merge(DEFAULTS, JSON.parse(localStorage.getItem(KEY) || 'null') || {}); }
    catch (e) { return merge(DEFAULTS, {}); }
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

  function saveConfig() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} }

  function hostOf(url) {
    try { return new URL(url, location.href).hostname.toLowerCase().replace(/^www\./, ''); }
    catch (e) { return ''; }
  }

  function domainMatch(host, domain) {
    domain = String(domain || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    return !!domain && (host === domain || host.endsWith('.' + domain));
  }

  function inList(host, list) { return (list || []).some(function (d) { return domainMatch(host, d); }); }
  function isSearchEngine(url) { return inList(hostOf(url), cfg.searchEngines); }

  function isWeb(url) {
    try { var p = new URL(url, location.href).protocol; return p === 'http:' || p === 'https:'; }
    catch (e) { return false; }
  }

  function shouldIntercept(a) {
    if (!a || !a.href || !isWeb(a.href)) return false;
    if (a.closest && a.closest('.mt-sw-root')) return false;
    if (a.hasAttribute('download')) return false;
    if ((a.getAttribute('rel') || '').toLowerCase().split(/\s+/).indexOf('external') >= 0) return false;
    var url = a.href, host = hostOf(url);
    if (isSearchEngine(url) || inList(host, cfg.whitelist) || inList(host, cfg.blacklist)) return false;
    try {
      var u = new URL(url), c = new URL(location.href);
      if (u.origin === c.origin && u.pathname === c.pathname && u.search === c.search && u.hash && u.hash !== c.hash) return false;
    } catch (e) {}
    return true;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'"'}[c];
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
      '.mt-sw-root{position:fixed;inset:0;z-index:2147483646;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}' +
      '.mt-sw-mask{position:absolute;inset:0;background:rgba(0,0,0,.45);opacity:0;transition:opacity .25s ease;pointer-events:auto}' +
      '.mt-sw-panel{position:absolute;left:0;right:0;bottom:0;height:var(--mt-sw-height,92vh);max-height:98vh;min-height:45vh;background:#fff;border-radius:18px 18px 0 0;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 -5px 28px rgba(0,0,0,.22);transform:translateY(100%);transition:transform .28s cubic-bezier(.32,.72,.36,1);pointer-events:auto}' +
      '.mt-sw-show .mt-sw-mask{opacity:1}.mt-sw-show .mt-sw-panel{transform:translateY(0)}' +
      '.mt-sw-resize{height:7px;flex:none;cursor:ns-resize;touch-action:none;background:transparent;position:relative;z-index:4}.mt-sw-resize:after{content:"";position:absolute;left:50%;top:3px;width:42px;height:4px;border-radius:4px;transform:translateX(-50%);background:rgba(0,0,0,.18)}' +
      '.mt-sw-head{display:flex;align-items:center;gap:5px;padding:4px 8px;background:var(--mt-sw-color,#53BCF5);color:var(--mt-sw-fg,#fff);transition:background .22s ease,color .22s ease;flex:none}' +
      '.mt-sw-nav{display:flex;gap:4px;flex:none}.mt-sw-btn{width:32px;height:32px;border:0;border-radius:50%;padding:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.2);color:inherit;cursor:pointer}.mt-sw-btn:active{transform:scale(.94)}.mt-sw-btn:disabled{opacity:.38}' +
      '.mt-sw-title{min-width:0;flex:1;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 4px}' +
      '.mt-sw-tabbar{display:flex;align-items:center;gap:4px;padding:4px 7px;background:var(--mt-sw-color,#53BCF5);color:var(--mt-sw-fg,#fff);border-bottom:1px solid rgba(255,255,255,.24);overflow-x:auto;scrollbar-width:none;flex:none;transition:background .22s ease,color .22s ease}.mt-sw-tabbar::-webkit-scrollbar{display:none}' +
      '.mt-sw-tab{height:30px;min-width:64px;max-width:76px;display:flex;align-items:center;gap:3px;padding:0 7px;border:0;border-radius:8px;background:rgba(255,255,255,.18);font-size:12px;color:inherit;flex:none;cursor:pointer;transition:background .18s ease,color .18s ease}.mt-sw-tab.active{background:rgba(255,255,255,.92);color:#222;box-shadow:none}.mt-sw-tab span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;text-align:center}.mt-sw-tab b{font-weight:400;font-size:15px;line-height:1;color:inherit;opacity:.72}.mt-sw-add{width:30px;height:30px;border:0;border-radius:8px;background:rgba(255,255,255,.14);color:inherit;flex:none}' +
      '.mt-sw-content{position:relative;flex:1;min-height:0;background:#fff}.mt-sw-frame{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff}.mt-sw-media{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#111}.mt-sw-audio{position:absolute;left:16px;right:16px;top:50%;transform:translateY(-50%);width:calc(100% - 32px)}' +
      '.mt-sw-error{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#666;background:#fff;padding:24px;text-align:center}.mt-sw-error button{border:0;border-radius:9px;padding:9px 14px;background:#eee}' +
      '.mt-sw-settings{position:absolute;inset:0;background:rgba(255,255,255,.98);z-index:8;overflow:auto;padding:18px;display:none}.mt-sw-settings.show{display:block}.mt-sw-settings h3{margin:0 0 16px;font-size:18px}.mt-sw-setting{padding:12px 0;border-bottom:1px solid #eee}.mt-sw-setting label{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:14px}.mt-sw-setting input[type=number]{width:76px}.mt-sw-setting select{font-size:14px;padding:6px 8px;border:1px solid #ddd;border-radius:8px;background:#fff;color:#333}.mt-sw-setting textarea{width:100%;box-sizing:border-box;min-height:70px;margin-top:8px;border:1px solid #ddd;border-radius:8px;padding:8px;resize:vertical}.mt-sw-settings-actions{display:flex;gap:8px;margin-top:16px}.mt-sw-settings-actions button{flex:1;border:0;border-radius:9px;padding:10px}.mt-sw-primary{background:#53BCF5;color:#fff}.mt-sw-secondary{background:#eee}.mt-sw-tip{font-size:11px;color:#999;line-height:1.5;margin-top:5px}';

    (document.head || document.documentElement).appendChild(s);

    // 严格 CSP 站点可能拦截内联 <style>，改用 CSSOM insertRule 兜底（不受 style-src 限制）
    var needCssom = false;
    try { needCssom = !s.sheet || !s.sheet.cssRules || s.sheet.cssRules.length === 0; }
    catch (e) { needCssom = true; }
    if (needCssom) {
      try {
        var css = s.textContent; s.textContent = '';
        var parts = css.split('}');
        for (var i = 0; i < parts.length; i++) {
          var rule = parts[i].trim();
          if (rule && s.sheet) s.sheet.insertRule(rule + '}', s.sheet.cssRules.length);
        }
      } catch (e) {}
    }
  }

  function mediaType(url) {
    if (!cfg.mediaPreview) return 'html';
    var p = '';
    try { p = new URL(url).pathname.toLowerCase(); } catch (e) {}
    if (/\.(png|jpe?g|gif|webp|bmp|svg|avif|ico)(?:$|\?)/i.test(p)) return 'image';
    if (/\.(mp4|webm|m4v|mov|ogv)(?:$|\?)/i.test(p)) return 'video';
    if (/\.(mp3|m4a|aac|ogg|wav|flac)(?:$|\?)/i.test(p)) return 'audio';
    if (/\.pdf(?:$|\?)/i.test(p)) return 'pdf';
    return 'html';
  }

  function createTab(url, title, activate) {
    var t = {id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),url:url,title:title||hostOf(url)||'网页',history:[url],historyIndex:0,view:null,frame:null,element:null,loading:true,sameOrigin:false,fallbackTried:false};
    state.tabs.push(t);
    if (activate !== false) state.active=state.tabs.length-1;
    return t;
  }

  function activeTab() { return state.tabs[state.active] || null; }

  function setPanelHeight(percent) {
    percent=Math.max(45,Math.min(98,Number(percent)||92));
    state.panel.style.setProperty('--mt-sw-height',percent+'vh');
    state.panel.dataset.height=percent;
  }

  function getSiteHeight(host) {
    try { var s=JSON.parse(localStorage.getItem(KEY+':sites')||'{}'); return s[host]&&Number(s[host].height); }
    catch(e){return null;}
  }

  function saveSiteHeight(host,height) {
    if(!cfg.rememberHeight||!host)return;
    try { var s=JSON.parse(localStorage.getItem(KEY+':sites')||'{}');s[host]={height:Math.round(height)};localStorage.setItem(KEY+':sites',JSON.stringify(s)); } catch(e){}
  }

  function luma(c){return(c.r*299+c.g*587+c.b*114)/1000;}

  function parseColor(v){
    if(!v||v==='transparent')return null;
    var m=String(v).match(/^rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)(?:\D+([\d.]+))?\s*\)$/i);
    if(m&&(m[4]==null||parseFloat(m[4])>.05))return{r:+m[1],g:+m[2],b:+m[3],a:m[4]==null?1:+m[4]};
    m=String(v).match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if(m){var h=m[1];if(h.length===3)h=h.split('').map(function(x){return x+x}).join('');return{r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16),a:1};}
    return null;
  }

  function gradientColor(v){
    if(!v||v==='none')return null;
    var m=String(v).match(/(?:linear|radial)-gradient\([^)]*?((?:#[0-9a-f]{3,6}|rgba?\([^)]*\)))/i);
    return m?parseColor(m[1]):null;
  }

  function colorDistance(a,b){return Math.sqrt(Math.pow(a.r-b.r,2)+Math.pow(a.g-b.g,2)+Math.pow(a.b-b.b,2));}

  function detectTopColor(t,done){
    var fallback={r:83,g:188,b:245,a:1};
    try{
      var doc=t.frame&&t.frame.contentDocument, win=t.frame&&t.frame.contentWindow;
      if(!doc||!win)throw 0;

      var meta=doc.querySelector('meta[name="theme-color"],meta[name="msapplication-navbutton-color"]');
      var mc=meta&&parseColor(meta.content);
      if(mc && (luma(mc)<245 || colorDistance(mc,{r:255,g:255,b:255})>18)) return done(mc);

      var candidates=[];
      var selectors=[
        'header','nav','[role="banner"]',
        '.header','.navbar','.nav','.topbar','.top-bar','.site-header','.page-header',
        '.header-wrap','.header-inner','.top-header','.main-header',
        '.head','.headbar','.top','.topnav','.menu','.menu-bar'
      ];
      selectors.forEach(function(sel){
        try{Array.prototype.slice.call(doc.querySelectorAll(sel)).slice(0,12).forEach(function(el){candidates.push(el);});}catch(e){}
      });

      // 补充扫描首屏顶部元素，兼容论坛使用自定义 class 的情况。
      try{
        Array.prototype.slice.call(doc.body.querySelectorAll('*')).slice(0,800).forEach(function(el){
          var r=el.getBoundingClientRect();
          if(r.top<=80 && r.bottom>=20 && r.width>=Math.min(win.innerWidth*.55,360) && r.height>=24 && r.height<=180) candidates.push(el);
        });
      }catch(e){}

      var best=null,bestScore=-Infinity,seen=[];
      candidates.forEach(function(el){
        if(seen.indexOf(el)>=0)return; seen.push(el);
        try{
          var r=el.getBoundingClientRect();
          if(!r||r.width<win.innerWidth*.35||r.height<18||r.top>140||r.bottom<0)return;
          var cs=win.getComputedStyle(el);
          var c=parseColor(cs.backgroundColor)||gradientColor(cs.backgroundImage);
          if(!c)return;

          var area=Math.min(r.width,win.innerWidth)*Math.min(r.height,180);
          var topBonus=Math.max(0,100-Math.max(0,r.top))*3;
          var heightBonus=Math.min(r.height,100);
          var nonWhiteBonus=luma(c)<238 ? 260 : 0;
          var score=area*.003+topBonus+heightBonus+nonWhiteBonus;

          // 白色/接近白色的 body 大背景不能把真正的彩色顶部覆盖掉。
          if(luma(c)>248 && r.height>120) score-=500;
          if(score>bestScore){bestScore=score;best=c;}
        }catch(e){}
      });

      if(best)return done(best);
      done(fallback);
    }catch(e){done(fallback);}
  }

  function detectColor(t,done){
    detectTopColor(t,function(c){
      done(c);
    });
  }

  function applyColor(t){
    if(!state.head||!cfg.adaptiveColor)return;
    detectColor(t,function(c){
      state.color=c;
      var color='rgb('+c.r+','+c.g+','+c.b+')';
      var fg=luma(c)>205?'rgba(0,0,0,.65)':'#fff';
      state.head.style.setProperty('--mt-sw-color',color);
      state.head.style.setProperty('--mt-sw-fg',fg);
      if(state.panel){state.panel.style.setProperty('--mt-sw-color',color);state.panel.style.setProperty('--mt-sw-fg',fg);}
    });
  }

  function retryColor(t){
    if(!cfg.adaptiveColor||!t||!t.frame)return;
    [80,260,700,1400].forEach(function(delay){
      setTimeout(function(){
        if(state.opened&&activeTab()===t&&!t.frame)return;
        if(state.opened&&activeTab()===t)applyColor(t);
      },delay);
    });
  }

  function updateNav(){
    var t=activeTab(),back=state.panel&&state.panel.querySelector('[data-act=back]'),fwd=state.panel&&state.panel.querySelector('[data-act=forward]');
    if(back)back.disabled=!t||t.historyIndex<=0;
    if(fwd)fwd.disabled=!t||t.historyIndex>=t.history.length-1;
    var title=state.panel&&state.panel.querySelector('.mt-sw-title');
    if(title)title.textContent=t?t.title:'网页小窗';
  }

  function tabLabel(title){
    var text=String(title||'网页').replace(/\s+/g,' ').trim();
    var chars=Array.from(text);
    return chars.length>4?chars.slice(0,4).join('')+'…':chars.join('');
  }

  function updateTabs(){
    if(!state.tabbar)return;
    state.tabbar.innerHTML='';
    state.tabs.forEach(function(t,i){
      var b=document.createElement('button');b.className='mt-sw-tab'+(i===state.active?' active':'');b.title=t.title||'网页';
      b.innerHTML='<span>'+esc(tabLabel(t.title))+'</span><b title="关闭">×</b>';
      b.onclick=function(e){if(e.target===b.querySelector('b'))closeTab(i);else activateTab(i);};
      state.tabbar.appendChild(b);
    });
    var add=document.createElement('button');add.className='mt-sw-add';add.innerHTML=icon('plus');add.title='新标签页';
    add.onclick=function(){createTab('about:blank','新标签页');renderTabs();};
    state.tabbar.appendChild(add);
    updateNav();
  }

  function activateTab(i){
    if(i<0||i>=state.tabs.length)return;
    state.active=i;
    state.tabs.forEach(function(t,n){if(t.element)t.element.style.display=n===i?'block':'none';});
    updateTabs();
    var t=activeTab();if(t)applyColor(t);
  }

  function closeTab(i){
    var t=state.tabs[i];if(!t)return;
    if(t.element)t.element.remove();
    state.tabs.splice(i,1);
    if(!state.tabs.length){closePanel(true);return;}
    if(state.active>i)state.active--;else if(state.active>=state.tabs.length)state.active=state.tabs.length-1;
    activateTab(state.active);
  }

  function renderTabs(){
    state.tabs.forEach(function(t,i){if(t.element)t.element.style.display=i===state.active?'block':'none';});
    updateTabs();
  }

  function pushHistory(t,url){
    if(!url||url==='about:blank')return;
    if(t.history[t.historyIndex]===url)return;
    t.history=t.history.slice(0,t.historyIndex+1);t.history.push(url);t.historyIndex=t.history.length-1;
  }

  function navigateTab(t,url,addHistory){
    if(!t)return;
    if(addHistory)pushHistory(t,url);
    t.url=url;t.loading=true;t.frame=null;t.fallbackTried=false;
    if(t.view){t.view.remove();t.view=null;}
    renderTabContent(t);updateNav();
  }

  function renderTabContent(t){
    if(!state.content)return;
    var type=mediaType(t.url),el;
    if(type==='image'){
      el=document.createElement('img');el.className='mt-sw-media';el.src=t.url;el.onerror=function(){showTabError(t,'图片无法加载');};
    }else if(type==='video'){
      el=document.createElement('video');el.className='mt-sw-media';el.controls=true;el.playsInline=true;el.src=t.url;el.onerror=function(){showTabError(t,'视频无法播放');};
    }else if(type==='audio'){
      el=document.createElement('audio');el.className='mt-sw-audio';el.controls=true;el.src=t.url;el.onerror=function(){showTabError(t,'音频无法播放');};
    }else{
      el=document.createElement('iframe');el.className='mt-sw-frame';el.src=t.url;el.setAttribute('loading','eager');
      // 不添加 sandbox（保证用户脚本可注入），并尽量放开能力，接近真实标签页环境
      el.setAttribute('allowfullscreen','');
      el.setAttribute('allow','accelerometer; autoplay; camera; clipboard-read; clipboard-write; display-capture; encrypted-media; fullscreen; geolocation; gyroscope; microphone; midi; payment; picture-in-picture; screen-wake-lock; usb; web-share; xr-spatial-tracking');
      t.frame=el;
      el.addEventListener('load',function(){
        t.loading=false;
        try{t.sameOrigin=!!el.contentDocument;}catch(e){t.sameOrigin=false;}
        applyColor(t);retryColor(t);installSameOriginBridge(t);
        if(t.title==='网页'||t.title==='新标签页'){try{t.title=el.contentDocument.title||hostOf(t.url)||'网页';}catch(e){}}
        updateTabs();
      });
      el.addEventListener('error',function(){
        t.frame=null;
        var autoOpened=false;
        if(cfg.autoFallback&&!t.fallbackTried){
          t.fallbackTried=true;
          try{autoOpened=!!window.open(t.url,'_blank','noopener');}catch(e){}
        }
        showTabError(t,'页面无法嵌入，可能被网站禁止 iframe。'+(autoOpened?'已自动在新标签页打开。':(cfg.autoFallback?'自动转新标签页可能被浏览器拦截，请点击下方按钮。':'点击下方按钮用新标签页打开。')));
      });
    }
    t.view=el;t.element=el;state.content.appendChild(el);
    state.tabs.forEach(function(x,i){if(x.element)x.element.style.display=i===state.active?'block':'none';});
  }

  function showTabError(t,msg){
    if(t.frame){t.frame=null;}
    var box=document.createElement('div');box.className='mt-sw-error';box.innerHTML='<div>'+esc(msg)+'</div><button>在新窗口打开</button>';
    box.querySelector('button').onclick=function(){window.open(t.url,'_blank','noopener');};
    if(t.element)t.element.remove();t.view=box;t.element=box;state.content.appendChild(box);renderTabs();
  }

  function installSameOriginBridge(t){
    if(!cfg.sameOriginHistory||!t.frame)return;
    try{
      var doc=t.frame.contentDocument;
      if(!doc||doc.__MT_SW_BRIDGED__)return;
      doc.__MT_SW_BRIDGED__=true;
      doc.addEventListener('click',function(e){
        if(e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
        var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;
        if(!a||!isWeb(a.href)||a.hasAttribute('download'))return;
        var h=hostOf(a.href);
        if(isSearchEngine(a.href)||inList(h,cfg.whitelist)||inList(h,cfg.blacklist))return;
        try{
          var current=new URL(t.url),next=new URL(a.href,doc.location.href);
          if(next.origin===current.origin&&next.pathname===current.pathname&&next.search===current.search&&next.hash&&next.hash!==current.hash)return;
        }catch(err){}
        e.preventDefault();e.stopPropagation();
        if(cfg.multiTab){
          var nt=createTab(a.href,titleFromAnchor(a),true);
          renderTabContent(nt);updateTabs();
        }else{
          navigateTab(t,a.href,true);
        }
      },true);
    }catch(e){}
  }

  function openTab(url,title){
    if(!isWeb(url))return;
    if(!state.opened)openPanel(url);
    var t=createTab(url,title,true);
    if(cfg.multiTab||state.tabs.length===1)renderTabContent(t);
    else{
      var old=state.tabs[state.tabs.length-2];
      navigateTab(old,url,true);state.tabs.pop();
    }
    updateTabs();
  }

  function openPanel(initialUrl){
    if(state.opened)return;
    addStyle();state.opened=true;state.tabs=[];state.active=-1;
    var root=document.createElement('div');root.className='mt-sw-root';
    var mask=document.createElement('div');mask.className='mt-sw-mask';
    var panel=document.createElement('div');panel.className='mt-sw-panel';
    var resize=document.createElement('div');resize.className='mt-sw-resize';resize.title='拖动调整小窗高度';
    var head=document.createElement('div');head.className='mt-sw-head';
    var nav=document.createElement('div');nav.className='mt-sw-nav';
    function btn(act,title,ic){var b=document.createElement('button');b.className='mt-sw-btn';b.dataset.act=act;b.title=title;b.innerHTML=icon(ic);return b;}
    var back=btn('back','后退','back'),forward=btn('forward','前进','forward'),reload=btn('reload','刷新','reload');nav.append(back,forward,reload);
    var title=document.createElement('div');title.className='mt-sw-title';title.textContent='网页小窗';
    var actions=document.createElement('div');actions.className='mt-sw-nav';
    var settings=btn('settings','设置','settings'),external=btn('external','新窗口打开','external'),close=btn('close','关闭','close');actions.append(settings,external,close);head.append(nav,title,actions);
    var tabbar=document.createElement('div');tabbar.className='mt-sw-tabbar';
    var content=document.createElement('div');content.className='mt-sw-content';
    var settingsBox=document.createElement('div');settingsBox.className='mt-sw-settings';
    panel.append(resize,head,tabbar,content,settingsBox);root.append(mask,panel);document.body.appendChild(root);
    state.panel=panel;state.mask=mask;state.head=head;state.tabbar=tabbar;state.content=content;
    var savedHeight=initialUrl&&cfg.rememberHeight?getSiteHeight(hostOf(initialUrl)):null;setPanelHeight(savedHeight||cfg.height);
    back.onclick=function(){goHistory(-1);};forward.onclick=function(){goHistory(1);};
    reload.onclick=function(){var t=activeTab();if(t){if(t.frame)t.frame.src=t.url;else navigateTab(t,t.url,false);}};
    external.onclick=function(){var t=activeTab();if(t)window.open(t.url,'_blank','noopener');};
    close.onclick=function(){closePanel(true);};mask.onclick=function(){closePanel(true);};settings.onclick=function(){toggleSettings(true);};
    resize.addEventListener('pointerdown',function(e){e.preventDefault();state.drag={startY:e.clientY,startHeight:panel.getBoundingClientRect().height,host:hostOf(activeTab()&&activeTab().url)};resize.setPointerCapture&&resize.setPointerCapture(e.pointerId);});
    resize.addEventListener('pointermove',function(e){if(!state.drag)return;var h=state.drag.startHeight+(state.drag.startY-e.clientY);setPanelHeight(Math.max(45,Math.min(98,h/window.innerHeight*100)));});
    resize.addEventListener('pointerup',function(){if(!state.drag)return;var host=state.drag.host;if(host)saveSiteHeight(host,parseFloat(panel.dataset.height)||92);state.drag=null;});
    buildSettings(settingsBox);
    updateTabs();requestAnimationFrame(function(){root.classList.add('mt-sw-show');});
    if(!state.historyMarker){try{history.pushState({mtGlobalWindow:true},'',location.href);state.historyMarker=true;}catch(e){}}
  }

  function closePanel(useHistory){
    if(!state.opened)return;
    if(useHistory&&state.historyMarker&&!state.closingByHistory){state.closingByHistory=true;try{history.back();}catch(e){finishClose();}return;}
    finishClose();
  }

  function finishClose(){
    state.tabs.forEach(function(t){if(t.element)t.element.remove();});state.tabs=[];state.active=-1;state.opened=false;
    if(state.panel&&state.panel.parentNode)state.panel.parentNode.parentNode.removeChild(state.panel.parentNode);
    state.panel=state.mask=state.head=state.tabbar=state.content=null;state.historyMarker=false;state.closingByHistory=false;
  }

  function goHistory(delta){
    var t=activeTab();if(!t)return;var next=t.historyIndex+delta;if(next<0||next>=t.history.length)return;
    t.historyIndex=next;t.url=t.history[next];renderTabContent(t);updateTabs();
  }

  function toggleSettings(show){var box=state.panel&&state.panel.querySelector('.mt-sw-settings');if(box)box.classList.toggle('show',show);}

  function buildSettings(box){
    box.innerHTML='<h3>小窗设置</h3>'+
      '<div class="mt-sw-setting"><label>默认高度 <input data-set="height" type="number" min="45" max="98" step="1" value="'+esc(cfg.height)+'"> %</label></div>'+
      '<div class="mt-sw-setting"><label>自适应顶栏颜色 <input data-set="adaptiveColor" type="checkbox" '+(cfg.adaptiveColor?'checked':'')+'></label><div class="mt-sw-tip">同源页面优先读取 theme-color、顶部导航、渐变背景；跨域 iframe 无法读取 DOM 时自动使用安全兜底色。</div></div>'+
      '<div class="mt-sw-setting"><label>记忆网站小窗高度 <input data-set="rememberHeight" type="checkbox" '+(cfg.rememberHeight?'checked':'')+'></label></div>'+
      '<div class="mt-sw-setting"><label>多标签模式 <input data-set="multiTab" type="checkbox" '+(cfg.multiTab?'checked':'')+'></label></div>'+
      '<div class="mt-sw-setting"><label>媒体智能预览 <input data-set="mediaPreview" type="checkbox" '+(cfg.mediaPreview?'checked':'')+'></label><div class="mt-sw-tip">图片、视频、音频、PDF 优先使用对应预览器。</div></div>'+
      '<div class="mt-sw-setting"><label>链接打开方式 <select data-set="openMode"><option value="window"'+(cfg.openMode!=='tab'?' selected':'')+'>小窗预览（iframe）</option><option value="tab"'+(cfg.openMode==='tab'?' selected':'')+'>浏览器新标签页</option></select></label><div class="mt-sw-tip">新标签页模式下已安装的用户脚本 100% 生效；小窗模式依赖脚本管理器允许向 iframe 注入脚本（见下方说明）。</div></div>'+
      '<div class="mt-sw-setting"><label>被拦截时自动转新标签页 <input data-set="autoFallback" type="checkbox" '+(cfg.autoFallback?'checked':'')+'></label><div class="mt-sw-tip">部分网站通过 X-Frame-Options / CSP frame-ancestors 禁止被嵌入 iframe，开启后自动改用新标签页打开（可能被浏览器弹窗拦截）。</div></div>'+
      '<div class="mt-sw-setting"><b>关于用户脚本生效</b><div class="mt-sw-tip">Tampermonkey / Violentmonkey 等管理器默认会向小窗内的 iframe 注入用户脚本，且本小窗 iframe 未加 sandbox，已开启全屏、剪贴板、自动播放等权限。若某个脚本在小窗中不生效，通常是该脚本声明了 @noframes 或检测 top!==self 主动退出，本脚本无法代为修改；此类情况请点击顶栏 ⧉ 按钮或改用「新标签页模式」打开。</div></div>'+
      '<div class="mt-sw-setting"><b>白名单域名</b><textarea data-set="whitelist" placeholder="每行一个，例如 example.com">'+esc(cfg.whitelist.join('\n'))+'</textarea><div class="mt-sw-tip">白名单网站的链接保持正常浏览器打开。</div></div>'+
      '<div class="mt-sw-setting"><b>黑名单域名</b><textarea data-set="blacklist" placeholder="每行一个">'+esc(cfg.blacklist.join('\n'))+'</textarea><div class="mt-sw-tip">黑名单网站完全不进入小窗。</div></div>'+
      '<div class="mt-sw-settings-actions"><button class="mt-sw-secondary" data-cancel>取消</button><button class="mt-sw-primary" data-save>保存</button></div>';
    box.querySelector('[data-cancel]').onclick=function(){toggleSettings(false);};
    box.querySelector('[data-save]').onclick=function(){
      cfg.height=Math.max(45,Math.min(98,Number(box.querySelector('[data-set=height]').value)||92));
      ['adaptiveColor','rememberHeight','multiTab','mediaPreview','autoFallback'].forEach(function(k){cfg[k]=box.querySelector('[data-set='+k+']').checked;});
      cfg.openMode=box.querySelector('[data-set=openMode]').value==='tab'?'tab':'window';
      ['whitelist','blacklist'].forEach(function(k){cfg[k]=box.querySelector('[data-set='+k+']').value.split(/\r?\n|,/).map(function(x){return x.trim().toLowerCase();}).filter(Boolean);});
      saveConfig();setPanelHeight(cfg.height);toggleSettings(false);var t=activeTab();if(t)applyColor(t);
    };
  }

  function titleFromAnchor(a){return(a.getAttribute('title')||a.getAttribute('aria-label')||a.textContent||hostOf(a.href)||'网页').replace(/\s+/g,' ').trim().slice(0,80);}

  function postFrameLink(url,title){
    try{
      window.top.postMessage({
        type:'MT_GLOBAL_LINK_WINDOW_OPEN',
        url:url,
        title:title||hostOf(url)||'网页'
      },'*');
    }catch(e){}
  }

  var frameBridge = { ready: false, cfg: null };

  function initFrameMode(){
    // 同源快速通道：直接读外层宿主标记（跨域时抛异常，走下面的握手）
    try{
      if(window.top && window.top.__MT_SW_PANEL_HOST__){
        frameBridge.ready = true;
        frameBridge.cfg = window.top.__MT_SW_PANEL_HOST__;
      }
    }catch(e){}

    // 握手：向外层发送 HELLO，只有小窗宿主会回复 CFG。
    // 这样本脚本在"其他网站的 iframe"里运行时不会劫持链接点击。
    function hello(){
      if(frameBridge.ready)return;
      try{ window.top.postMessage({type:'MT_GLOBAL_LINK_WINDOW_HELLO'}, '*'); }catch(e){}
    }
    hello();
    [300,1000,2500,5000].forEach(function(d){ setTimeout(hello, d); });

    window.addEventListener('message',function(e){
      var d=e.data;
      if(!d||d.type!=='MT_GLOBAL_LINK_WINDOW_CFG')return;
      try{ if(e.source!==window.top)return; }catch(err){return;}
      frameBridge.ready=true;
      frameBridge.cfg=d.cfg||{};
    });

    // 小窗 iframe 中不再创建第二层小窗，只把点击请求交给外层小窗（或按配置直接开新标签页）
    document.addEventListener('click',function(e){
      if(!frameBridge.ready)return;
      if(e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
      var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;
      if(!shouldIntercept(a))return;
      // 用外层配置再过滤一次，避免吞掉外层白名单/黑名单/搜索引擎的链接
      var fcfg=frameBridge.cfg;
      if(fcfg){
        var h=hostOf(a.href);
        if(inList(h,fcfg.whitelist||[])||inList(h,fcfg.blacklist||[])||inList(h,fcfg.searchEngines||[]))return;
      }
      e.preventDefault();e.stopImmediatePropagation();
      if(fcfg&&fcfg.openMode==='tab'){
        try{ window.open(a.href,'_blank','noopener'); }catch(err){}
      }else{
        postFrameLink(a.href,titleFromAnchor(a));
      }
    },true);
  }

  function findFrameBySource(source){
    for(var i=0;i<state.tabs.length;i++){
      var t=state.tabs[i];
      if(t.frame&&t.frame.contentWindow===source)return t;
    }
    return null;
  }

  function installFrameMessageBridge(){
    window.addEventListener('message',function(e){
      var d=e.data;
      if(!d)return;

      // iframe 握手：确认父页面是小窗宿主后才回复配置
      if(d.type==='MT_GLOBAL_LINK_WINDOW_HELLO'){
        if(!state.opened)return;
        var t0=findFrameBySource(e.source);
        if(!t0)return;
        try{
          e.source.postMessage({
            type:'MT_GLOBAL_LINK_WINDOW_CFG',
            cfg:{openMode:cfg.openMode,whitelist:cfg.whitelist,blacklist:cfg.blacklist,searchEngines:cfg.searchEngines}
          },'*');
        }catch(err){}
        return;
      }

      if(d.type!=='MT_GLOBAL_LINK_WINDOW_OPEN'||!state.opened)return;
      var matched=findFrameBySource(e.source);
      if(!matched||!isWeb(d.url))return;
      try{
        var expected=new URL(matched.url).origin;
        if(e.origin!==''&&e.origin!==expected)return;
      }catch(err){return;}
      var host=hostOf(d.url);
      if(isSearchEngine(d.url)||inList(host,cfg.whitelist)||inList(host,cfg.blacklist))return;
      openTab(d.url,String(d.title||host||'网页').slice(0,80));
    });
  }

  document.addEventListener('click',function(e){
    if(FRAME_MODE)return;
    if(e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
    var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;
    if(!shouldIntercept(a))return;
    e.preventDefault();e.stopPropagation();
    if(cfg.openMode==='tab'){
      try{ window.open(a.href,'_blank','noopener'); }catch(err){}
      return;
    }
    openTab(a.href,titleFromAnchor(a));
  },true);

  window.addEventListener('popstate',function(e){
    if(FRAME_MODE)return;
    if(state.historyMarker&&!e.state){
      state.historyMarker=false;
      if(state.opened)finishClose();
    }
  });

  function init(){
    if(FRAME_MODE){initFrameMode();return;}
    addStyle();
    installFrameMessageBridge();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
