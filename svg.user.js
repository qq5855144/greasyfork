// ==UserScript==
// @name         资源嗅探 Pro
// @namespace    http://tampermonkey.net/
// @version      4.3.0
// @description  基于 v4.2.12 稳定架构增强：持续嗅探图片/视频/音频/SVG，支持懒加载、动态 DOM、fetch/XHR、HLS/DASH、MSE 识别、预览、下载与悬浮按钮位置记忆。
// @author       增强版
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_openInTab
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @connect      *
// @run-at       document-start
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';
    if (location.protocol === 'chrome:' || location.protocol === 'edge:' || !location.hostname) return;

    var KEY_POS = 'rs-fab-position-v1';
    var ROOT = '_rs_root_43';
    var resources = { video: [], audio: [], image: [], other: [] };
    var seen = { video: {}, audio: {}, image: {}, other: {} };
    var currentTab = 'all';
    var searchText = '';
    var fab = null;
    var modal = null;
    var list = null;
    var countBadge = null;
    var observer = null;
    var scanTimer = null;
    var hookedPage = false;

    var imageExt = ['jpg','jpeg','png','gif','bmp','webp','svg','ico','avif','tif','tiff','heic'];
    var videoExt = ['mp4','m4v','webm','m3u8','mpd','flv','avi','wmv','mov','mkv','ts','m2ts','mpeg','mpg'];
    var audioExt = ['mp3','m4a','aac','wav','ogg','oga','opus','flac','wma','weba'];
    var lazyAttrs = ['data-src','data-original','data-lazy-src','data-srcset','data-url','data-echo','data-lazy','data-full','data-real-src','data-real','data-bg','data-bg-url','data-image','data-img','data-load','data-lazyload','data-original-src','data-highres','data-large','data-medium','data-small','data-video','data-video-src','data-audio','data-file','data-source'];

    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function abs(url) {
        if (!url || typeof url !== 'string') return '';
        try { return new URL(url, location.href).href; } catch (e) { return ''; }
    }
    function typeByMime(mime) {
        mime = String(mime || '').toLowerCase().split(';')[0].trim();
        if (mime.indexOf('image/') === 0) return 'image';
        if (mime.indexOf('video/') === 0 || mime === 'application/vnd.apple.mpegurl' || mime === 'application/x-mpegurl' || mime === 'application/dash+xml') return 'video';
        if (mime.indexOf('audio/') === 0) return 'audio';
        return '';
    }
    function typeByUrl(url) {
        var u = String(url || '').toLowerCase();
        if (!u) return 'other';
        if (u.indexOf('data:image/') === 0 || u.indexOf('blob:image') === 0) return 'image';
        if (u.indexOf('data:video/') === 0 || u.indexOf('data:audio/') === 0) return u.indexOf('data:video/') === 0 ? 'video' : 'audio';
        var clean = u.split('?')[0].split('#')[0];
        var m = clean.match(/\.([a-z0-9]+)$/);
        if (m) {
            var ext = m[1];
            if (imageExt.indexOf(ext) >= 0) return 'image';
            if (videoExt.indexOf(ext) >= 0) return 'video';
            if (audioExt.indexOf(ext) >= 0) return 'audio';
        }
        if (/\/m3u8(?:$|[?&#/])|\.m3u8(?:$|[?&#])|playlist|master\.m3u8|manifest\.mpd|\.mpd(?:$|[?&#])/.test(u)) return 'video';
        if (/\/image(?:s)?\/|\/img\/|\/photo(?:s)?\/|\/thumbnail\/|\/thumb\/|\/avatar\/|image\?|img\?|format=image/.test(u)) return 'image';
        if (/\/video(?:s)?\/|\/stream\/|\/media\/|video\?|playurl|videourl|\.ts(?:$|[?&#])/.test(u)) return 'video';
        if (/\/audio(?:s)?\/|audio\?|sound\?|music\?|stream.*audio/.test(u)) return 'audio';
        return 'other';
    }
    function addResource(type, url, meta) {
        url = abs(url) || url;
        if (!url || !resources[type] || seen[type][url]) return false;
        seen[type][url] = true;
        resources[type].push({ url: url, mime: meta && meta.mime || '', source: meta && meta.source || 'DOM', time: Date.now() });
        if (list) renderList();
        updateBadge();
        return true;
    }
    function addUrl(url, mime, source) {
        if (!url || typeof url !== 'string') return;
        var type = typeByMime(mime) || typeByUrl(url);
        addResource(type, url, { mime: mime || '', source: source || 'network' });
    }
    function addSrcset(value, source) {
        if (!value) return;
        String(value).split(',').forEach(function (part) {
            var u = part.trim().split(/\s+/)[0];
            if (u) addUrl(u, '', source || 'srcset');
        });
    }
    function scanElement(el) {
        if (!el || el.nodeType !== 1) return;
        if (el.id === ROOT || (el.closest && el.closest('#' + ROOT))) return;
        var tag = String(el.tagName || '').toLowerCase();
        var attrs = [];
        if (tag === 'img' || tag === 'video' || tag === 'audio' || tag === 'source' || tag === 'image') {
            if (el.currentSrc) addUrl(el.currentSrc, el.getAttribute('type') || '', tag);
            if (el.src) addUrl(el.src, el.getAttribute('type') || '', tag);
            if (el.href) addUrl(el.href, el.getAttribute('type') || '', tag);
            if (el.srcset) addSrcset(el.srcset, tag + ':srcset');
            if (el.poster) addUrl(el.poster, 'image/*', 'poster');
        }
        lazyAttrs.forEach(function (a) {
            var v = el.getAttribute(a);
            if (v) {
                if (a.indexOf('srcset') >= 0) addSrcset(v, 'lazy-srcset');
                else addUrl(v, '', 'lazy:' + a);
            }
        });
        var style = el.getAttribute('style');
        if (style) {
            var re = /url\(\s*["']?([^"')]+)["']?\s*\)/gi, m;
            while ((m = re.exec(style))) addUrl(m[1], 'image/*', 'CSS');
        }
    }
    function scanDOM() {
        if (!document.documentElement) return;
        var nodes = document.querySelectorAll('img,video,audio,source,image,object,embed,iframe,[style*="url"],[style*="background"],[' + lazyAttrs.join('],[') + ']');
        for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            scanElement(el);
            if (el.tagName && (el.tagName.toLowerCase() === 'object' || el.tagName.toLowerCase() === 'embed')) addUrl(el.data || el.src || '', el.type || '', 'object');
        }
        var metas = document.querySelectorAll('meta[property^="og:"],meta[name*="image"],meta[name*="video"],meta[name*="audio"],link[rel="preload"],link[rel="prefetch"],link[rel*="icon"]');
        for (var j = 0; j < metas.length; j++) addUrl(metas[j].content || metas[j].href || '', metas[j].getAttribute('type') || '', 'meta/link');
    }

    function installNetworkHook() {
        if (hookedPage) return;
        hookedPage = true;
        window.addEventListener('message', function (ev) {
            var d = ev && ev.data;
            if (d && d.__RS_MEDIA__ === 1) addUrl(d.url, d.mime, d.source || 'fetch/XHR');
        });
        try {
            var script = document.createElement('script');
            script.textContent = "(function(){if(window.__RS_MEDIA_HOOK__)return;window.__RS_MEDIA_HOOK__=1;function emit(u,m,s){try{if(u)window.postMessage({__RS_MEDIA__:1,url:String(u),mime:String(m||''),source:s},'*')}catch(e){}}var f=window.fetch;if(f){window.fetch=function(){var a=arguments,u='';try{u=typeof a[0]==='string'?a[0]:(a[0]&&a[0].url)||''}catch(e){}return f.apply(this,a).then(function(r){try{emit(r.url||u,r.headers.get('content-type')||'','fetch')}catch(e){emit(u,'','fetch')}return r})}}var o=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){this.__rsurl=u;return o.apply(this,arguments)};var s=XMLHttpRequest.prototype.send;XMLHttpRequest.prototype.send=function(){this.addEventListener('loadend',function(){try{emit(this.responseURL||this.__rsurl,this.getResponseHeader('content-type')||'','xhr')}catch(e){}},{once:true});return s.apply(this,arguments)}})();";
            (document.documentElement || document.head || document.body).appendChild(script);
            script.remove();
        } catch (e) {}
    }
    function installPerformanceHook() {
        try {
            var po = new PerformanceObserver(function (entryList) {
                var entries = entryList.getEntries();
                for (var i = 0; i < entries.length; i++) addUrl(entries[i].name, '', 'Performance');
            });
            po.observe({ entryTypes: ['resource'] });
        } catch (e) {}
        setInterval(function () {
            try {
                var es = performance.getEntriesByType('resource');
                for (var i = 0; i < es.length; i++) addUrl(es[i].name, '', 'Performance');
            } catch (e) {}
        }, 5000);
    }
    function installMediaHook() {
        var oldSetAttribute = null;
        try {
            var p = HTMLMediaElement.prototype;
            oldSetAttribute = p.setAttribute;
            p.setAttribute = function (name, value) {
                if (name === 'src') addUrl(value, this.getAttribute('type') || '', 'media:setAttribute');
                return oldSetAttribute.apply(this, arguments);
            };
        } catch (e) {}
        document.addEventListener('loadedmetadata', function (e) {
            var el = e.target;
            if (el && (el.tagName === 'VIDEO' || el.tagName === 'AUDIO')) addUrl(el.currentSrc || el.src, el.getAttribute('type') || '', 'media');
        }, true);
        try {
            if (window.MediaSource && window.MediaSource.prototype) {
                var ms = window.MediaSource.prototype.addSourceBuffer;
                if (ms) window.MediaSource.prototype.addSourceBuffer = function (mime) {
                    addUrl('mse:' + String(mime), mime, 'MSE');
                    return ms.apply(this, arguments);
                };
            }
        } catch (e) {}
    }

    function css() {
        GM_addStyle('#' + ROOT + '{all:initial;position:fixed;z-index:2147483646;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#eee}#' + ROOT + ' *{box-sizing:border-box}#' + ROOT + ' .fab{position:fixed;width:52px;height:52px;border-radius:50%;border:0;background:linear-gradient(135deg,#6c63ff,#00c9a7);color:#fff;font-size:23px;box-shadow:0 5px 20px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;touch-action:none;user-select:none}#' + ROOT + ' .badge{position:absolute;right:-4px;top:-4px;min-width:19px;height:19px;padding:0 5px;border-radius:10px;background:#ff4d6d;color:#fff;font-size:10px;display:flex;align-items:center;justify-content:center}#' + ROOT + ' .panel{position:fixed;left:3vw;right:3vw;top:7vh;bottom:5vh;background:#11131a;border:1px solid #33384a;border-radius:16px;box-shadow:0 15px 60px rgba(0,0,0,.6);display:none;flex-direction:column;overflow:hidden;color:#eee}#' + ROOT + ' .panel.show{display:flex}#' + ROOT + ' .head{height:54px;display:flex;align-items:center;gap:8px;padding:0 12px;border-bottom:1px solid #292d3a;flex-shrink:0}#' + ROOT + ' .title{font-size:16px;font-weight:700;flex:1}#' + ROOT + ' button{font:inherit}#' + ROOT + ' .head button,#' + ROOT + ' .tabs button,#' + ROOT + ' .actions button{border:1px solid #363b4d;background:#1a1e28;color:#ddd;border-radius:9px;padding:7px 10px}#' + ROOT + ' .search{margin:9px 12px;padding:9px 11px;border-radius:9px;border:1px solid #34394a;background:#0d0f15;color:#fff;outline:none}#' + ROOT + ' .tabs{display:flex;gap:5px;padding:0 12px 9px;overflow:auto}#' + ROOT + ' .tabs button.active{background:#6c63ff;color:#fff}#' + ROOT + ' .list{flex:1;overflow:auto;padding:5px 12px 12px}#' + ROOT + ' .item{display:flex;align-items:center;gap:9px;padding:9px;border:1px solid #292e3b;background:#171a22;border-radius:10px;margin-bottom:6px}#' + ROOT + ' .thumb{width:44px;height:44px;object-fit:cover;border-radius:7px;background:#272b35;flex:0 0 44px}#' + ROOT + ' .info{min-width:0;flex:1}.url{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.meta{font-size:10px;color:#8e96a8;margin-top:4px}.actions{display:flex;gap:4px}.actions button{padding:6px 7px;font-size:11px}.empty{text-align:center;color:#788092;padding:45px 10px}.preview{position:fixed;inset:0;background:rgba(0,0,0,.94);display:none;align-items:center;justify-content:center;z-index:2147483647}.preview.show{display:flex}.preview img,.preview video,.preview audio{max-width:94vw;max-height:88vh}.preview .close{position:absolute;right:14px;top:14px;background:#333;color:#fff;border:0;border-radius:50%;width:40px;height:40px}');
    }
    function createUI() {
        var root = document.createElement('div');
        root.id = ROOT;
        root.innerHTML = '<button class="fab" title="资源嗅探">⌕<span class="badge">0</span></button><div class="panel"><div class="head"><div class="title">资源嗅探 Pro <small>4.3.0</small></div><button class="clear">清空</button><button class="close">×</button></div><input class="search" placeholder="搜索 URL / 类型 / 来源"><div class="tabs"><button data-t="all" class="active">全部 <b>0</b></button><button data-t="image">图片 <b>0</b></button><button data-t="video">视频 <b>0</b></button><button data-t="audio">音频 <b>0</b></button><button data-t="other">其他 <b>0</b></button></div><div class="list"></div></div><div class="preview"><button class="close">×</button><div class="body"></div></div>';
        (document.body || document.documentElement).appendChild(root);
        fab = root.querySelector('.fab'); modal = root.querySelector('.panel'); list = root.querySelector('.list'); countBadge = root.querySelector('.badge');
        root.querySelector('.close').addEventListener('click', function () { modal.classList.remove('show'); });
        root.querySelector('.clear').addEventListener('click', function () { resources={video:[],audio:[],image:[],other:[]};seen={video:{},audio:{},image:{},other:{}};renderList(); });
        root.querySelector('.search').addEventListener('input', function () { searchText = this.value.toLowerCase(); renderList(); });
        var tabs = root.querySelectorAll('.tabs button');
        for (var i=0;i<tabs.length;i++) tabs[i].addEventListener('click', function(){ currentTab=this.getAttribute('data-t'); for(var j=0;j<tabs.length;j++)tabs[j].classList.remove('active');this.classList.add('active');renderList(); });
        fab.addEventListener('click', function () { if (!fab.__dragged) { modal.classList.add('show'); renderList(); } fab.__dragged=false; });
        enableFabDrag();
        updateBadge();
    }
    function getPosition() { try { return JSON.parse(GM_getValue(KEY_POS, 'null')); } catch(e) { return null; } }
    function savePosition(left, top) { try { GM_setValue(KEY_POS, JSON.stringify({left:left,top:top})); } catch(e) {} }
    function clampPosition(left, top) { var w=window.innerWidth||document.documentElement.clientWidth; var h=window.innerHeight||document.documentElement.clientHeight; return {left:Math.max(4,Math.min(left,w-56)),top:Math.max(4,Math.min(top,h-56))}; }
    function restorePosition() { var p=getPosition(); if (!p) { fab.style.right='16px'; fab.style.bottom='80px'; return; } var c=clampPosition(Number(p.left)||0,Number(p.top)||0); fab.style.left=c.left+'px';fab.style.top=c.top+'px';fab.style.right='auto';fab.style.bottom='auto'; }
    function enableFabDrag() {
        restorePosition();
        var sx=0,sy=0,sl=0,st=0,moved=false,dragging=false;
        function down(e){var p=e.touches?e.touches[0]:e;sx=p.clientX;sy=p.clientY;var r=fab.getBoundingClientRect();sl=r.left;st=r.top;moved=false;dragging=true;}
        function move(e){if(!dragging)return;var p=e.touches?e.touches[0]:e;var dx=p.clientX-sx,dy=p.clientY-sy;if(Math.abs(dx)+Math.abs(dy)>6)moved=true;if(moved){var c=clampPosition(sl+dx,st+dy);fab.style.left=c.left+'px';fab.style.top=c.top+'px';fab.style.right='auto';fab.style.bottom='auto';if(e.cancelable)e.preventDefault();}}
        function up(){if(!dragging)return;dragging=false;if(moved){var r=fab.getBoundingClientRect();savePosition(r.left,r.top);fab.__dragged=true;}}
        fab.addEventListener('pointerdown',down);fab.addEventListener('pointermove',move);fab.addEventListener('pointerup',up);fab.addEventListener('pointercancel',up);
        fab.addEventListener('touchstart',down,{passive:false});fab.addEventListener('touchmove',move,{passive:false});fab.addEventListener('touchend',up,{passive:true});
        window.addEventListener('resize',function(){var r=fab.getBoundingClientRect();var c=clampPosition(r.left,r.top);fab.style.left=c.left+'px';fab.style.top=c.top+'px';fab.style.right='auto';fab.style.bottom='auto';if(getPosition())savePosition(c.left,c.top);});
    }
    function updateBadge() {
        var total=resources.video.length+resources.audio.length+resources.image.length+resources.other.length;
        if (countBadge) countBadge.textContent=total>999?'999+':String(total);
        if (!modal) return;
        var bs=modal.querySelectorAll('.tabs button');
        var types=['all','image','video','audio','other'];
        for(var i=0;i<bs.length;i++){var n=types[i]==='all'?total:resources[types[i]].length;bs[i].querySelector('b').textContent=n;}
    }
    function filtered() {
        var arr=[];
        var types=currentTab==='all'?['image','video','audio','other']:[currentTab];
        for(var i=0;i<types.length;i++){var a=resources[types[i]];for(var j=0;j<a.length;j++){var x=a[j],hay=(x.url+' '+types[i]+' '+x.mime+' '+x.source).toLowerCase();if(!searchText||hay.indexOf(searchText)>=0)arr.push({type:types[i],data:x});}}
        return arr;
    }
    function renderList() {
        if(!list)return;updateBadge();var arr=filtered();if(!arr.length){list.innerHTML='<div class="empty">暂未发现资源<br><small>继续滚动、播放媒体或等待页面懒加载</small></div>';return;}
        var html='';
        for(var i=arr.length-1;i>=0;i--){var it=arr[i],x=it.data,t=it.type;var media=t==='image'?'<img class="thumb" src="'+esc(x.url)+'" loading="lazy">':t==='video'?'▶️':t==='audio'?'🎵':'📄';html+='<div class="item"><div>'+media+'</div><div class="info"><div class="url" title="'+esc(x.url)+'">'+esc(x.url)+'</div><div class="meta">'+esc(t)+' · '+esc(x.mime||'未知 MIME')+' · '+esc(x.source)+'</div></div><div class="actions"><button data-act="copy" data-url="'+esc(x.url)+'">复制</button><button data-act="open" data-url="'+esc(x.url)+'">打开</button><button data-act="download" data-url="'+esc(x.url)+'">下载</button></div></div>';}
        list.innerHTML=html;
        var buttons=list.querySelectorAll('button');for(var k=0;k<buttons.length;k++)buttons[k].addEventListener('click',function(){var u=this.getAttribute('data-url'),a=this.getAttribute('data-act');if(a==='copy'){if(navigator.clipboard)navigator.clipboard.writeText(u);else{var ta=document.createElement('textarea');ta.value=u;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}}else if(a==='open'){try{GM_openInTab(u,{active:true,insert:true,setParent:true});}catch(e){window.open(u,'_blank');}}else downloadUrl(u);});
        var imgs=list.querySelectorAll('img');for(var z=0;z<imgs.length;z++)imgs[z].addEventListener('click',function(){showPreview(this.src,'image');});
    }
    function downloadUrl(url) {
        if(!url)return;
        try{GM_download({url:url,name:filename(url),saveAs:false,onerror:function(){window.open(url,'_blank');}});}catch(e){window.open(url,'_blank');}
    }
    function filename(url){try{var p=new URL(url).pathname.split('/').pop()||'resource';return decodeURIComponent(p).replace(/[\\/:*?"<>|]/g,'_').slice(-160);}catch(e){return 'resource';}}
    function showPreview(url,type){var p=document.querySelector('#'+ROOT+' .preview'),b=p.querySelector('.body');b.innerHTML='';if(type==='image')b.innerHTML='<img src="'+esc(url)+'">';else if(type==='video')b.innerHTML='<video src="'+esc(url)+'" controls autoplay></video>';else if(type==='audio')b.innerHTML='<audio src="'+esc(url)+'" controls autoplay></audio>';else{b.innerHTML='<div style="color:white;padding:20px;word-break:break-all">'+esc(url)+'</div>';}p.classList.add('show');p.querySelector('.close').onclick=function(){p.classList.remove('show');b.innerHTML='';};}

    function boot() {
        if (window.__RS_43_BOOTED__) return;
        window.__RS_43_BOOTED__ = true;
        css();
        function ready() { if (!document.body) { setTimeout(ready,100); return; } createUI(); scanDOM(); installNetworkHook(); installPerformanceHook(); installMediaHook();
            observer = new MutationObserver(function(ms){var need=false;for(var i=0;i<ms.length;i++){if(ms[i].type==='childList'&&ms[i].addedNodes.length){need=true;break;}if(ms[i].type==='attributes'){need=true;break;}}if(need){clearTimeout(scanTimer);scanTimer=setTimeout(scanDOM,120);}});
            observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src','srcset','href','style','poster'].concat(lazyAttrs)});
            window.addEventListener('scroll',function(){clearTimeout(scanTimer);scanTimer=setTimeout(scanDOM,120);},{passive:true});
            setInterval(scanDOM,4000);
        }
        ready();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
