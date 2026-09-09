// ==UserScript==
// @name         资源嗅探 Pro
// @namespace    http://tampermonkey.net/
// @version      5.2.0
// @description  图片/视频/音频/SVG 持续嗅探，支持懒加载、动态页面、Resource Timing、fetch/XHR、预览和下载。
// @author       增强版
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @connect      *
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    /*
     * v5.2.0
     * 这是可直接运行的单文件版本。
     * 不依赖 CommonJS、ES Module、构建器或 window.module。
     * 特意避免可选链、空值合并、import/export 等旧解析器容易报错的语法。
     */

    var RS = {
        items: [],
        map: Object.create(null),
        running: false,
        panel: null,
        list: null,
        badge: null,
        search: '',
        filter: 'all',
        observer: null,
        perfTimer: null,
        scanTimer: null,
        drag: null
    };

    function safeString(value) {
        return value === null || value === undefined ? '' : String(value);
    }

    function absoluteUrl(value) {
        var s = safeString(value).trim();
        if (!s) return '';
        try {
            return new URL(s, location.href).href;
        } catch (e) {
            return s;
        }
    }

    function cleanUrl(value) {
        var url = absoluteUrl(value);
        if (!url) return '';
        if (/^(javascript|about|mailto|tel):/i.test(url)) return '';
        return url;
    }

    function typeFromMime(mime) {
        var m = safeString(mime).toLowerCase().split(';')[0].trim();
        if (m.indexOf('image/') === 0) return 'image';
        if (m.indexOf('video/') === 0) return 'video';
        if (m.indexOf('audio/') === 0) return 'audio';
        if (m === 'application/vnd.apple.mpegurl' || m === 'application/x-mpegurl' || m === 'application/dash+xml') return 'video';
        return '';
    }

    function typeFromUrl(url) {
        var u = safeString(url).toLowerCase().split('#')[0].split('?')[0];
        if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|tif|tiff|ico|avif|jxl|heic|heif)(?:$|\.)/i.test(u)) return 'image';
        if (/\.(mp4|webm|mov|m4v|mkv|avi|flv|wmv|mpeg|mpg|m2ts|ts|3gp|ogv|m3u8|mpd)(?:$|\.)/i.test(u)) return 'video';
        if (/\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|wma|aiff)(?:$|\.)/i.test(u)) return 'audio';
        if (/(?:^|[?&_/.-])(image|img|photo|picture|avatar|thumb|thumbnail)(?:[?&_/.-]|$)/i.test(u)) return 'image';
        if (/(?:^|[?&_/.-])(video|videoplayback|stream|manifest|m3u8|mpd)(?:[?&_/.-]|$)/i.test(u)) return 'video';
        if (/(?:^|[?&_/.-])(audio|music|song|sound)(?:[?&_/.-]|$)/i.test(u)) return 'audio';
        return '';
    }

    function typeFor(url, mime, hint) {
        return typeFromMime(mime) || typeFromUrl(url) || typeFromMime(hint) || '';
    }

    function fileName(url, type) {
        var name = '';
        try {
            var u = new URL(url, location.href);
            name = decodeURIComponent(u.pathname.split('/').pop() || '');
        } catch (e) {}
        name = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
        if (!name) name = 'resource-' + Date.now();
        if (!/\.[a-z0-9]{2,8}$/i.test(name)) {
            name += type === 'image' ? '.img' : type === 'audio' ? '.audio' : '.video';
        }
        return name;
    }

    function isInternalElement(el) {
        if (!el || !el.closest) return false;
        return !!el.closest('#rs-pro-root');
    }

    function add(url, type, mime, source) {
        url = cleanUrl(url);
        if (!url || !type) return false;
        if (isInternalElement(document.activeElement)) return false;
        var key = type + '|' + url;
        if (RS.map[key]) return false;
        RS.map[key] = true;
        RS.items.push({
            id: RS.items.length + 1,
            url: url,
            type: type,
            mime: safeString(mime),
            source: safeString(source || 'scan'),
            time: Date.now()
        });
        updateBadge();
        if (RS.panel && RS.panel.style.display !== 'none') renderList();
        return true;
    }

    function addCandidate(url, mime, source) {
        var type = typeFor(url, mime, '');
        if (type) add(url, type, mime, source);
    }

    function scanSrcset(value, source) {
        safeString(value).split(',').forEach(function (part) {
            var v = part.trim().split(/\s+/)[0];
            if (v) addCandidate(v, '', source || 'srcset');
        });
    }

    var lazyAttrs = [
        'data-src', 'data-original', 'data-lazy-src', 'data-url', 'data-image',
        'data-img', 'data-image-url', 'data-full', 'data-full-src', 'data-highres',
        'data-original-url', 'data-poster', 'data-video', 'data-video-src',
        'data-audio', 'data-audio-src', 'data-file', 'data-media'
    ];

    function scanElement(el) {
        if (!el || el.nodeType !== 1 || isInternalElement(el)) return;
        var tag = safeString(el.tagName).toLowerCase();
        if (tag === 'img') {
            addCandidate(el.currentSrc || el.src, el.getAttribute('type') || '', 'img');
            scanSrcset(el.srcset, 'img-srcset');
        } else if (tag === 'video') {
            addCandidate(el.currentSrc || el.src, el.getAttribute('type') || 'video/*', 'video');
            addCandidate(el.poster, 'image/*', 'poster');
        } else if (tag === 'audio') {
            addCandidate(el.currentSrc || el.src, el.getAttribute('type') || 'audio/*', 'audio');
        } else if (tag === 'source') {
            addCandidate(el.src, el.getAttribute('type') || '', 'source');
            addCandidate(el.getAttribute('srcset'), '', 'source-srcset');
        } else {
            var bg = '';
            try { bg = getComputedStyle(el).backgroundImage || ''; } catch (e) {}
            var matches = bg.match(/url\(["']?([^"')]+)["']?\)/g) || [];
            matches.forEach(function (x) {
                var m = x.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
                addCandidate(m, 'image/*', 'css');
            });
        }
        lazyAttrs.forEach(function (attr) {
            var value = el.getAttribute(attr);
            if (value) {
                if (/srcset/i.test(attr)) scanSrcset(value, 'lazy-srcset');
                else addCandidate(value, '', 'lazy-' + attr);
            }
        });
        scanSrcset(el.getAttribute('srcset'), 'srcset');
    }

    function scanDom(root) {
        root = root || document;
        try {
            scanElement(root.documentElement || root.body || root);
            var nodes = root.querySelectorAll ? root.querySelectorAll('img,video,audio,source,[src],[srcset],[poster],[data-src],[data-url]') : [];
            for (var i = 0; i < nodes.length; i++) scanElement(nodes[i]);
        } catch (e) {}
    }

    function scanPerformance() {
        try {
            if (!performance || !performance.getEntriesByType) return;
            var entries = performance.getEntriesByType('resource') || [];
            for (var i = 0; i < entries.length; i++) {
                var e = entries[i];
                var initiator = safeString(e.initiatorType).toLowerCase();
                var type = typeFromUrl(e.name);
                if (initiator === 'img') type = 'image';
                else if (initiator === 'video') type = 'video';
                else if (initiator === 'audio') type = 'audio';
                if (type) add(e.name, type, '', 'resource-timing');
            }
        } catch (e) {}
    }

    function installPageNetworkHook() {
        var marker = '__RS_PRO_NETWORK_HOOK__';
        try {
            if (window[marker]) return;
            window[marker] = true;
            window.addEventListener('message', function (event) {
                var d = event && event.data;
                if (!d || d.__RS_PRO_MEDIA__ !== true) return;
                addCandidate(d.url, d.mime, d.source || 'page-network');
            }, false);
            var script = document.createElement('script');
            script.textContent = "(function(){if(window.__RS_PRO_PAGE_HOOK__)return;window.__RS_PRO_PAGE_HOOK__=true;function emit(url,mime,source){try{if(url)window.postMessage({__RS_PRO_MEDIA__:true,url:String(url),mime:String(mime||''),source:String(source||'page')},'*')}catch(e){}}var f=window.fetch;if(f){window.fetch=function(){var u='';try{var x=arguments[0];u=typeof x==='string'?x:(x&&x.url)||''}catch(e){}return f.apply(this,arguments).then(function(r){try{emit(r.url||u,r.headers.get('content-type')||'','fetch')}catch(e){emit(u,'','fetch')}return r})}}var o=XMLHttpRequest.prototype.open,s=XMLHttpRequest.prototype.send;XMLHttpRequest.prototype.open=function(m,u){this.__rsUrl=u;return o.apply(this,arguments)};XMLHttpRequest.prototype.send=function(){var x=this;try{x.addEventListener('loadend',function(){emit(x.responseURL||x.__rsUrl,x.getResponseHeader('content-type')||'','xhr')},{once:true})}catch(e){}return s.apply(this,arguments)}})();";
            (document.documentElement || document.head || document.body).appendChild(script);
            script.remove();
        } catch (e) {}
    }

    function scanAll() {
        scanDom(document);
        scanPerformance();
    }

    function updateBadge() {
        if (!RS.badge) return;
        RS.badge.textContent = String(RS.items.length > 999 ? '999+' : RS.items.length);
        RS.badge.style.display = RS.items.length ? 'flex' : 'none';
    }

    function esc(value) {
        return safeString(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function visibleItems() {
        var term = RS.search.toLowerCase();
        return RS.items.filter(function (item) {
            if (RS.filter !== 'all' && item.type !== RS.filter) return false;
            if (!term) return true;
            return (item.url + ' ' + item.mime).toLowerCase().indexOf(term) !== -1;
        });
    }

    function renderList() {
        if (!RS.list) return;
        var items = visibleItems();
        if (!items.length) {
            RS.list.innerHTML = '<div class="rs-empty">暂未发现匹配资源<br><small>滚动、播放或触发懒加载后会持续自动捕获</small></div>';
            return;
        }
        var html = '';
        items.slice().reverse().forEach(function (item) {
            var icon = item.type === 'image' ? '🖼️' : item.type === 'video' ? '🎬' : '🎵';
            html += '<div class="rs-item" data-id="' + item.id + '">';
            html += '<div class="rs-thumb">' + icon + '</div>';
            html += '<div class="rs-info"><div class="rs-name">' + esc(fileName(item.url, item.type)) + '</div>';
            html += '<div class="rs-url" title="' + esc(item.url) + '">' + esc(item.url) + '</div>';
            html += '<div class="rs-meta">' + esc(item.type.toUpperCase()) + ' · ' + esc(item.source) + (item.mime ? ' · ' + esc(item.mime) : '') + '</div></div>';
            html += '<div class="rs-actions"><button data-act="preview" data-id="' + item.id + '">预览</button><button data-act="copy" data-id="' + item.id + '">复制</button><button data-act="download" data-id="' + item.id + '">下载</button></div>';
            html += '</div>';
        });
        RS.list.innerHTML = html;
    }

    function getItem(id) {
        for (var i = 0; i < RS.items.length; i++) if (RS.items[i].id === Number(id)) return RS.items[i];
        return null;
    }

    function downloadItem(item) {
        if (!item) return;
        var name = fileName(item.url, item.type);
        try {
            if (typeof GM_download === 'function') {
                GM_download({ url: item.url, name: name, saveAs: false, onerror: function () { fallbackDownload(item); } });
                return;
            }
        } catch (e) {}
        fallbackDownload(item);
    }

    function fallbackDownload(item) {
        try {
            var a = document.createElement('a');
            a.href = item.url;
            a.download = fileName(item.url, item.type);
            a.target = '_blank';
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (e) { window.open(item.url, '_blank'); }
    }

    function copyText(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text);
                return;
            }
        } catch (e) {}
        try {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
        } catch (e) {}
    }

    function previewItem(item) {
        if (!item) return;
        var overlay = document.createElement('div');
        overlay.className = 'rs-preview';
        var close = document.createElement('button');
        close.className = 'rs-preview-close';
        close.textContent = '×';
        close.onclick = function () { overlay.remove(); };
        overlay.appendChild(close);
        var box = document.createElement('div');
        box.className = 'rs-preview-box';
        if (item.type === 'image') {
            var img = document.createElement('img');
            img.src = item.url;
            img.alt = '';
            box.appendChild(img);
        } else if (item.type === 'video') {
            var video = document.createElement('video');
            video.src = item.url;
            video.controls = true;
            video.autoplay = true;
            video.playsInline = true;
            box.appendChild(video);
        } else {
            var audio = document.createElement('audio');
            audio.src = item.url;
            audio.controls = true;
            audio.autoplay = true;
            box.appendChild(audio);
        }
        var label = document.createElement('div');
        label.className = 'rs-preview-label';
        label.textContent = item.url;
        box.appendChild(label);
        overlay.appendChild(box);
        overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };
        document.body.appendChild(overlay);
    }

    function clearItems() {
        RS.items = [];
        RS.map = Object.create(null);
        updateBadge();
        renderList();
    }

    function createUI() {
        if (document.getElementById('rs-pro-root')) return;
        var root = document.createElement('div');
        root.id = 'rs-pro-root';
        root.innerHTML = '<button id="rs-pro-fab" title="资源嗅探 Pro">⌕<span id="rs-pro-badge">0</span></button>' +
            '<section id="rs-pro-panel" style="display:none"><header><strong>资源嗅探 Pro</strong><span class="rs-count"></span><button class="rs-close">×</button></header>' +
            '<div class="rs-toolbar"><input class="rs-search" placeholder="搜索 URL / 类型"><button data-filter="all">全部</button><button data-filter="image">图片</button><button data-filter="video">视频</button><button data-filter="audio">音频</button><button class="rs-clear">清空</button></div><div class="rs-list"></div></section>';
        document.body.appendChild(root);
        RS.panel = root.querySelector('#rs-pro-panel');
        RS.list = root.querySelector('.rs-list');
        RS.badge = root.querySelector('#rs-pro-badge');
        var fab = root.querySelector('#rs-pro-fab');
        fab.addEventListener('click', function () {
            RS.panel.style.display = RS.panel.style.display === 'none' ? 'flex' : 'none';
            if (RS.panel.style.display !== 'none') renderList();
        });
        root.querySelector('.rs-close').addEventListener('click', function () { RS.panel.style.display = 'none'; });
        root.querySelector('.rs-search').addEventListener('input', function (e) { RS.search = e.target.value; renderList(); });
        root.querySelector('.rs-clear').addEventListener('click', clearItems);
        root.querySelectorAll('[data-filter]').forEach(function (button) {
            button.addEventListener('click', function () { RS.filter = button.getAttribute('data-filter'); renderList(); });
        });
        RS.list.addEventListener('click', function (e) {
            var button = e.target.closest ? e.target.closest('button[data-act]') : null;
            if (!button) return;
            var item = getItem(button.getAttribute('data-id'));
            var act = button.getAttribute('data-act');
            if (act === 'preview') previewItem(item);
            else if (act === 'copy' && item) copyText(item.url);
            else if (act === 'download') downloadItem(item);
        });
        installDrag(fab);
        updateBadge();
    }

    function installDrag(fab) {
        var start = null;
        function begin(e) {
            var p = e.touches ? e.touches[0] : e;
            start = { x: p.clientX, y: p.clientY, left: fab.getBoundingClientRect().left, top: fab.getBoundingClientRect().top, moved: false };
        }
        function move(e) {
            if (!start) return;
            var p = e.touches ? e.touches[0] : e;
            var dx = p.clientX - start.x, dy = p.clientY - start.y;
            if (Math.abs(dx) + Math.abs(dy) > 6) start.moved = true;
            if (!start.moved) return;
            e.preventDefault();
            fab.style.left = Math.max(4, Math.min(window.innerWidth - 48, start.left + dx)) + 'px';
            fab.style.top = Math.max(4, Math.min(window.innerHeight - 48, start.top + dy)) + 'px';
            fab.style.right = 'auto';
            fab.style.bottom = 'auto';
        }
        function end() { start = null; }
        fab.addEventListener('mousedown', begin);
        document.addEventListener('mousemove', move, { passive: false });
        document.addEventListener('mouseup', end);
        fab.addEventListener('touchstart', begin, { passive: true });
        document.addEventListener('touchmove', move, { passive: false });
        document.addEventListener('touchend', end);
    }

    function installObservers() {
        try {
            RS.observer = new MutationObserver(function (mutations) {
                var shouldScan = false;
                mutations.forEach(function (m) {
                    if (m.type === 'childList' && m.addedNodes.length) shouldScan = true;
                    if (m.type === 'attributes') shouldScan = true;
                    for (var i = 0; i < m.addedNodes.length; i++) {
                        if (m.addedNodes[i].nodeType === 1) scanElement(m.addedNodes[i]);
                    }
                });
                if (shouldScan) {
                    clearTimeout(RS.scanTimer);
                    RS.scanTimer = setTimeout(function () { scanDom(document); }, 120);
                }
            });
            RS.observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'srcset', 'poster', 'data-src', 'data-srcset', 'data-url', 'data-image', 'data-video', 'data-audio'] });
        } catch (e) {}
        window.addEventListener('scroll', function () { scanDom(document); }, { passive: true });
        window.addEventListener('load', scanAll, false);
        window.addEventListener('pageshow', scanAll, false);
        try {
            RS.perfTimer = setInterval(scanPerformance, 2000);
        } catch (e) {}
    }

    function boot() {
        if (RS.running) return;
        RS.running = true;
        try {
            createUI();
            installPageNetworkHook();
            scanAll();
            installObservers();
        } catch (error) {
            RS.running = false;
            try { console.error('[资源嗅探 Pro] 初始化失败', error); } catch (e) {}
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }

})();
