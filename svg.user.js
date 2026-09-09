// ==UserScript==
// @name         资源嗅探
// @namespace    http://tampermonkey.net/
// @version      v4.3.3
// @description  自动嗅探网页图片/视频/音频/SVG资源，含源码查看、可视化编辑、SEO检测。移动端适配。
// @author       增强版
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_openInTab
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// @icon         data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%23ff6b6b%22%2F%3E%3Cstop%20offset%3D%220.5%22%20stop-color%3D%22%23feca57%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%231dd1a1%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20x%3D%223%22%20y%3D%223%22%20width%3D%2218%22%20height%3D%2218%22%20rx%3D%223%22%20fill%3D%22url(%23g)%22%2F%3E%3Ccircle%20cx%3D%228.5%22%20cy%3D%228.5%22%20r%3D%221.6%22%20fill%3D%22%23fff%22%2F%3E%3Cpath%20d%3D%22M21%2015l-5-5L7%2019%22%20stroke%3D%22%23fff%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3Cpath%20d%3D%22M12%2017v-4%22%20stroke%3D%22%23fff%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%2F%3E%3Cpath%20d%3D%22M9.5%2013L12%2010.5L14.5%2013%22%20stroke%3D%22%23fff%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    //  1. 存储层
    // ============================================================
    const allResources = { video: [], audio: [], image: [], other: [] };
    const resourceSets = Object.fromEntries(Object.keys(allResources).map(type => [type, new Set()]));

    // ============================================================
    //  2. 嗅探引擎
    // ============================================================
    if (location.protocol === 'chrome:' || location.protocol === 'edge:' || location.hostname === '') return;
    const imageExtSet = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.avif', '.tiff', '.tif', '.heic', '.heif', '.apng', '.jxl']);
    // 只将可独立播放的文件或流清单列入视频；ts/m4s 等媒体分片不能单独播放。
    const videoExtSet = new Set(['.mp4', '.flv', '.m3u8', '.avi', '.wmv', '.mov', '.webm', '.mkv', '.mpeg', '.mpg', '.mpd', '.m4v', '.ogv', '.3gp']);
    const segmentExtSet = new Set(['.ts', '.m2ts', '.m4s', '.cmfv', '.cmfa', '.isma', '.ismv']);
    const audioExtSet = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma', '.opus']);
    const lazyAttrs = ['data-src', 'data-original', 'data-lazy-src', 'data-srcset', 'data-original-set', 'data-url', 'data-echo', 'data-lazy', 'data-full', 'data-real-src', 'data-bg', 'data-bg-url', 'data-background', 'data-background-image', 'data-image', 'data-img', 'data-load', 'data-lazyload', 'data-original-src', 'data-highres', 'data-normal', 'data-small', 'data-medium', 'data-large', 'data-thumb', 'data-thumbnail'];
    const observedAttrs = ['src', 'srcset', 'href', 'poster', 'style', 'data', ...lazyAttrs];
    const srcsetAttrs = new Set(['srcset', 'data-srcset', 'data-original-set']);
    function absoluteUrl(raw) {
        if (!raw || typeof raw !== 'string') return '';
        const value = raw.trim().replace(/^['"]|['"]$/g, '');
        if (!value || value === '#' || /^(javascript|mailto|tel):/i.test(value)) return '';
        try { return new URL(value, document.baseURI || location.href).href; } catch (_) { return '' }
    }
    function urlExtension(url) {
        try {
            const match = new URL(url).pathname.toLowerCase().match(/\.[a-z0-9]+$/);
            return match ? match[0] : '';
        } catch (_) { return '' }
    }
    function typeFromMime(mime) {
        mime = String(mime || '').toLowerCase().split(';')[0].trim();
        if (mime.startsWith('image/')) return 'image';
        if (/mpegurl|dash\+xml/.test(mime)) return 'video';
        if (mime.startsWith('video/') && !/mp2t/.test(mime)) return 'video';
        if (mime.startsWith('audio/')) return 'audio';
        return '';
    }
    function isLikelyMediaSegment(url, mime = '') {
        const ext = urlExtension(url);
        if (segmentExtSet.has(ext) || /video\/mp2t/i.test(mime)) return true;
        try {
            const u = new URL(url);
            const path = decodeURIComponent(u.pathname).toLowerCase();
            // 常见 HLS/DASH 分片命名；清单和完整媒体文件不受影响。
            return /(?:^|[\/_-])(?:seg(?:ment)?|chunk|frag(?:ment)?|part|init)(?:[\/_\-.]|\d)/i.test(path) && !videoExtSet.has(ext);
        } catch (_) { return false }
    }
    function hasPlayableEndpoint(url) {
        try {
            const u = new URL(url);
            const path = decodeURIComponent(u.pathname).toLowerCase();
            if (/googlevideo\.com$/i.test(u.hostname) && /\/videoplayback(?:\/|$)/.test(path)) return true;
            // 明确的播放端点可以位于路径中；video/media/play 等歧义词仅在路径末端视为接口，避免把 /video/标题 当作视频。
            if (/(?:^|\/)(?:videoplayback|playback|getvideo|getstream|streaming)(?:\/|$)/i.test(path)) return true;
            if (/(?:^|\/)(?:play|stream|media|video)\/?$/i.test(path)) return true;
            const declaredMime = u.searchParams.get('mime') || u.searchParams.get('type') || u.searchParams.get('content-type') || '';
            return /^video\//i.test(declaredMime) || /mpegurl|dash\+xml/i.test(declaredMime);
        } catch (_) { return false }
    }
    function isPlayableVideo(url, mime, trust = '') {
        if (!/^https?:/i.test(url)) return false; // blob/data 不能作为可复用下载地址
        try {
            const u = new URL(url);
            // B 站 /video/... 是内容页路由，不是媒体 CDN；真实资源使用 bilivideo.com 等域名。
            if (/(?:^|\.)bilibili\.com$/i.test(u.hostname) && /^\/video(?:\/|$)/i.test(u.pathname)) return false;
        } catch (_) { return false }
        const ext = urlExtension(url);
        if (isLikelyMediaSegment(url, mime)) return false;
        if (videoExtSet.has(ext)) return true;
        const mediaType = String(mime || '').toLowerCase();
        if (/^(?:text\/html|application\/(?:xhtml\+xml|json)|text\/json)(?:;|$)/.test(mediaType)) return false;
        if (/mpegurl|dash\+xml|^video\/(?!mp2t)/.test(mediaType)) return true;
        if (hasPlayableEndpoint(url)) return true;
        if (!trust) return false;
        if (/\.(?:html?|json|js|css|txt|xml|php|aspx?|jsp)$/i.test(ext)) return false;
        // DOM、媒体元数据及结构化播放器数据中的无后缀地址具有明确播放语义。
        return trust === 'dom' || trust === 'meta' || trust === 'structured';
    }
    function addResource(type, rawUrl) {
        const url = absoluteUrl(rawUrl);
        if (!url || !allResources[type] || resourceSets[type].has(url)) return;
        resourceSets[type].add(url);
        allResources[type].push(url);
        if (window._hyUIReady) window._hyAddResourceItem(type, url);
    }
    function categorizeUrl(rawUrl, hintType, mime) {
        const url = absoluteUrl(rawUrl);
        if (!url) return;
        const videoTrust = hintType === 'video-dom' ? 'dom' : hintType === 'video-meta' ? 'meta' : hintType === 'video-structured' ? 'structured' : '';
        const normalizedHint = hintType?.replace(/-(?:dom|network|meta|structured)$/, '');
        let type = typeFromMime(mime) || normalizedHint || 'other';
        try {
            const u = new URL(url);
            if (u.protocol === 'data:') type = typeFromMime(u.pathname.split(';')[0]) || type;
            if (!normalizedHint && !typeFromMime(mime)) {
                const ext = urlExtension(url);
                if (imageExtSet.has(ext)) type = 'image';
                else if (videoExtSet.has(ext)) type = 'video';
                else if (audioExtSet.has(ext)) type = 'audio';
                else if (/\/(?:images?|imgs?|photos?|pictures?|thumb(?:nail)?s?)(?:\/|$)/i.test(u.pathname)) type = 'image';
            }
            if (type === 'video' && !isPlayableVideo(url, mime, videoTrust)) return;
            addResource(type, url);
        } catch (_) { /* 忽略无效地址 */ }
    }
    function parseSrcset(value, hintType = 'image') {
        if (!value) return;
        const candidates = String(value).match(/(?:data:[^\s]+|[^\s,]+)(?:\s+\d+(?:\.\d+)?[wx])?(?=\s*(?:,|$))/gi) || [];
        candidates.forEach(candidate => {
            const url = candidate.trim().replace(/\s+(?:\d+(?:\.\d+)?[wx])\s*$/i, '');
            if (url) categorizeUrl(url, hintType);
        });
    }
    function extractCssUrls(cssText) {
        if (!cssText || !/url\s*\(/i.test(cssText)) return;
        const re = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
        let match;
        while ((match = re.exec(cssText))) {
            if (match[2] && !match[2].startsWith('#')) categorizeUrl(match[2], 'image');
        }
    }
    function extractMediaUrlsFromText(text, baseUrl = document.baseURI || location.href) {
        if (typeof text !== 'string' || text.length > 2_000_000 || !/(?:m3u8|\.mpd|\.mp4|\.webm|\.mkv|\.flv|\.mov|videoplayback|playback|stream(?:ing)?|[?&](?:mime|type)=video)/i.test(text)) return;
        const decoded = text.replace(/\\u002[fF]/g, '/').replace(/\\u0026/gi, '&').replace(/\\u003[dD]/g, '=').replace(/\\\//g, '/').replace(/&amp;/g, '&');
        const re = /(?:https?:)?\/\/[^\s'"<>\\]+|(?:\.\.\/|\.\/|\/)?[^\s/'"<>\\]+(?:\/[^\s'"<>\\]+)*\.(?:m3u8|mpd|mp4|webm|mkv|flv|mov)(?:\?[^\s'"<>\\]*)?/gi;
        let match;
        while ((match = re.exec(decoded))) {
            let candidate = match[0].replace(/[),;\]}]+$/, '');
            try { candidate = new URL(candidate, baseUrl).href; } catch (_) { continue; }
            if (videoExtSet.has(urlExtension(candidate)) || hasPlayableEndpoint(candidate)) categorizeUrl(candidate, 'video-structured');
        }
    }
    function extractStructuredMedia(root, baseUrl = document.baseURI || location.href) {
        if (!root || typeof root !== 'object') return;
        const seen = new WeakSet();
        let visited = 0;
        const walk = (value, depth) => {
            if (!value || typeof value !== 'object' || depth > 10 || visited++ > 10000 || seen.has(value)) return;
            seen.add(value);
            if (Array.isArray(value)) { value.forEach(item => walk(item, depth + 1)); return; }
            const mime = String(value.mimeType || value.contentType || value.mime || '').toLowerCase();
            for (const [key, item] of Object.entries(value)) {
                if (typeof item === 'string' && /^(?:url|src|file|play_?url|playback_?url|video_?url|stream_?url|manifest_?url|hls_?url|dash_?url)$/i.test(key)) {
                    let candidate = item;
                    try { candidate = new URL(candidate, baseUrl).href; } catch (_) { continue; }
                    const strongVideoKey = /^(?:play_?url|playback_?url|video_?url|stream_?url|manifest_?url|hls_?url|dash_?url)$/i.test(key);
                    if (/^audio\//.test(mime)) categorizeUrl(candidate, 'audio', mime);
                    else if (strongVideoKey || /^video\/|mpegurl|dash\+xml/.test(mime) || videoExtSet.has(urlExtension(candidate)) || hasPlayableEndpoint(candidate)) {
                        categorizeUrl(candidate, 'video-structured', mime);
                    }
                } else if (key === 'signatureCipher' && typeof item === 'string') {
                    const params = new URLSearchParams(item);
                    // 带 s 的地址仍需播放器算法解密，不能作为“可播放资源”展示。
                    if (!params.get('s') && params.get('url')) {
                        categorizeUrl(params.get('url'), /^audio\//.test(mime) ? 'audio' : 'video-structured', mime);
                    }
                } else if (item && typeof item === 'object') walk(item, depth + 1);
            }
        };
        walk(root, 0);
    }
    function scanElement(el) {
        if (!el || el.nodeType !== 1 || el.closest?.('#_hy-root')) return;
        const tag = el.localName?.toLowerCase();
        const mediaHint = tag === 'img' || tag === 'image' || tag === 'picture' ? 'image' :
            tag === 'video' ? 'video-dom' : tag === 'audio' ? 'audio' : '';
        if (tag === 'img') {
            categorizeUrl(el.currentSrc || el.src || el.getAttribute('src'), 'image');
            parseSrcset(el.getAttribute('srcset'));
        } else if (tag === 'video' || tag === 'audio') {
            categorizeUrl(el.currentSrc || el.src || el.getAttribute('src'), mediaHint);
            if (tag === 'video') categorizeUrl(el.poster || el.getAttribute('poster'), 'image');
        } else if (tag === 'source') {
            const parentHint = el.parentElement?.localName === 'picture' ? 'image' :
                el.parentElement?.localName === 'video' ? 'video-dom' : el.parentElement?.localName;
            categorizeUrl(el.src || el.getAttribute('src'), parentHint);
            parseSrcset(el.getAttribute('srcset'), parentHint || 'image');
        } else if (tag === 'image') {
            categorizeUrl(el.href?.baseVal || el.getAttribute('href') || el.getAttribute('xlink:href'), 'image');
        } else if (tag === 'object' || tag === 'embed') {
            categorizeUrl(el.data || el.src || el.getAttribute('data') || el.getAttribute('src'), typeFromMime(el.type));
        } else if (tag === 'link') {
            const as = el.getAttribute('as');
            const rel = el.rel || '';
            if (/icon/i.test(rel) || ['image', 'video', 'audio'].includes(as)) categorizeUrl(el.href, /icon/i.test(rel) ? 'image' : as === 'video' ? 'video-meta' : as);
        } else if (tag === 'meta') {
            const key = `${el.getAttribute('property') || ''} ${el.name || ''} ${el.getAttribute('itemprop') || ''}`;
            if (/image|thumbnail|tileimage/i.test(key)) categorizeUrl(el.content, 'image');
            else if (/video/i.test(key)) categorizeUrl(el.content, 'video-meta');
            else if (/audio/i.test(key)) categorizeUrl(el.content, 'audio');
        } else if (tag === 'script' && (!el.src || /json|ld\+json/i.test(el.type || ''))) {
            extractMediaUrlsFromText(el.textContent || '');
        }
        for (const attr of lazyAttrs) {
            const value = el.getAttribute(attr);
            if (!value) continue;
            if (srcsetAttrs.has(attr)) parseSrcset(value, mediaHint || 'image');
            else if (/bg|background|image|img|thumb|small|medium|large|highres/i.test(attr)) categorizeUrl(value, 'image');
            else categorizeUrl(value, mediaHint || undefined);
        }
        extractCssUrls(el.getAttribute('style'));
        if (tag === 'svg' && !el.closest('svg svg')) {
            try {
                const clone = el.cloneNode(true);
                if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                const svg = new XMLSerializer().serializeToString(clone);
                if (svg.length >= 50) addResource('image', 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
            } catch (_) { /* 忽略 */ }
        }
        if (el.shadowRoot) {
            scanRoot(el.shadowRoot);
            observeRoot(el.shadowRoot);
        }
    }
    function scanRoot(root) {
        if (!root?.querySelectorAll) return;
        if (root.nodeType === 1) scanElement(root);
        root.querySelectorAll('img,video,audio,source,image,svg,object,embed,link,meta,script[type*="json" i],[style*="url(" i],' + lazyAttrs.map(a => `[${a}]`).join(','))
            .forEach(scanElement);
    }
    document.addEventListener('load', event => scanElement(event.target), true);
    document.addEventListener('error', event => scanElement(event.target), true);
    function collectPerformanceEntries(entries) {
        entries.forEach(entry => categorizeUrl(entry.name, entry.initiatorType === 'img' ? 'image' :
            entry.initiatorType === 'video' ? 'video-network' : entry.initiatorType === 'audio' ? 'audio' : undefined));
    }
    try {
        collectPerformanceEntries(performance.getEntriesByType('resource'));
        const po = new PerformanceObserver(list => collectPerformanceEntries(list.getEntries()));
        try { po.observe({ type: 'resource', buffered: true }); }
        catch (_) { po.observe({ entryTypes: ['resource'] }); }
    } catch (_) { /* 忽略 */ }

    // 响应头识别无扩展名媒体；JSON/脚本响应中只提取具有明确媒体后缀的真实地址。
    try {
        const inspectResponseText = (response, mime) => {
            if (!/(?:json|javascript|text\/plain)/i.test(mime || '')) return;
            const size = Number(response.headers?.get?.('content-length') || 0);
            if (size > 2_000_000) return;
            response.clone().text().then(text => extractMediaUrlsFromText(text, response.url)).catch(() => {});
        };
        const nativeFetch = window.fetch;
        if (nativeFetch) window.fetch = function (...args) {
            return nativeFetch.apply(this, args).then(response => {
                const mime = response.headers.get('content-type') || '';
                categorizeUrl(response.url || (typeof args[0] === 'string' ? args[0] : args[0]?.url), undefined, mime);
                inspectResponseText(response, mime);
                return response;
            });
        };
        const nativeOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url, ...rest) {
            this.__hyResourceUrl = url;
            this.addEventListener('loadend', () => {
                let mime = '';
                try { mime = this.getResponseHeader('content-type') || ''; } catch (_) {}
                categorizeUrl(this.responseURL || this.__hyResourceUrl, undefined, mime);
                try {
                    if (/(?:json|javascript|text\/plain)/i.test(mime) && (!this.responseType || this.responseType === 'text') && this.responseText.length <= 2_000_000) {
                        extractMediaUrlsFromText(this.responseText, this.responseURL || this.__hyResourceUrl);
                    }
                } catch (_) {}
            }, { once: true });
            return nativeOpen.call(this, method, url, ...rest);
        };
        const nativeJsonParse = JSON.parse;
        JSON.parse = function (text, reviver) {
            const result = nativeJsonParse.call(this, text, reviver);
            if (typeof text === 'string' && text.length <= 2_000_000) {
                queueMicrotask(() => {
                    extractMediaUrlsFromText(text);
                    extractStructuredMedia(result);
                });
            }
            return result;
        };
    } catch (_) { /* 不影响页面自身请求 */ }
    const observedRoots = new WeakSet();
    function observeRoot(root) {
        if (!root || observedRoots.has(root)) return;
        observedRoots.add(root);
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes') scanElement(mutation.target);
                else mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) scanRoot(node);
                });
            }
        });
        observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: observedAttrs });
    }

    function startDomObserver() {
        if (!document.documentElement) { setTimeout(startDomObserver, 50); return; }
        scanRoot(document);
        observeRoot(document.documentElement);
        // 虚拟列表可能复用节点且框架更新方式不触发预期属性事件，低频补扫兜底。
        setInterval(() => scanRoot(document), 5000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startDomObserver, { once: true });
    else startDomObserver();
    // ============================================================
    //  3. SVG 图标库（所有图标集中定义）
    // ============================================================
    const ICONS = {
        search: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
        close: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
        copy: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
        external: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
        check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
        edit: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
        lock: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
        clipboard: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>',
        title: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>',
        desc: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
        tag: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
        attachment: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
        grid: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
        video: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>',
        music: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
        file: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
        seo: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
        code: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
        info: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
        image: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
        sparkle: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5z"/><path d="M19 16l1 3.5L23 21l-3.5 1L19 25l-1-3.5L14 21l3.5-1z"/></svg>',
        drag: '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="9" y1="6" x2="15" y2="6"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="14" x2="15" y2="14"/><line x1="9" y1="18" x2="15" y2="18"/></svg>',
        'chevron-left': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
        'chevron-right': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
        'maximize': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>',
        'download': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
    };
    
    // SVG 图标辅助函数
    function icon(name) { return ICONS[name] || ''; }

    // ============================================================
    //  3. UI — 移动端优先浮动面板 + U形开关
    // ============================================================
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectUI);
    else injectUI();

    function injectUI() {
        if (document.getElementById('_hy-root')) return;

        // --- 样式 ---
        GM_addStyle(`
/* === 嗅探 - 完整样式 === */
#_hy-root {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px;
    line-height: 1.4;
    -webkit-text-size-adjust: 100%;
}

/* ========== U形开关按钮（半圆外壳 + 内嵌圆形图标容器） ========== */
/*
 * 外层U形槽：毛玻璃，完整半圆（左侧），无边框，右侧贴屏幕边缘
 * 内圆：青绿色，比槽小，向左贴弧形方向，与槽保留2px间隔
 */
#_hy-btn {
    all: initial;
    position: fixed;
    z-index: 2147483647;
    right: 0;
    top: 50%;
    /* 收回：右移，只露左侧约10px弧边 */
    transform: translateY(calc(var(--_hy-btn-offset, -50%))) translateX(calc(100% - 10px));
    width: 50px;
    height: 40px;
    /* 完美半圆：左侧radius = 半高 = 20px */
    border-radius: 20px 0 0 20px;
    border: none;
    /* 白色毛玻璃 */
    background: rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    box-shadow: -2px 0 18px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding-left: 4px;
    box-sizing: border-box;
    transition: transform 0.40s cubic-bezier(0.22, 1, 0.36, 1), background 0.3s, box-shadow 0.3s;
    touch-action: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
}
/* 伸出状态 */
#_hy-btn.extend {
    transform: translateY(calc(var(--_hy-btn-offset, -50%))) translateX(0);
    background: rgba(255, 255, 255, 0.32);
    box-shadow: -3px 0 22px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.6);
}
#_hy-btn.extend:active {
    transform: translateY(calc(var(--_hy-btn-offset, -50%))) translateX(0) scale(0.93);
}
#_hy-btn:hover {
    background: rgba(255, 255, 255, 0.32);
}

/* _hy-btn-bg 不使用 */
#_hy-btn ._hy-btn-bg {
    display: none;
}


/* 内层圆形图标容器：34px，青绿色 */
#_hy-btn ._hy-btn-inner {
    position: relative;
    z-index: 1;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    /* 青绿渐变 */
    background: linear-gradient(135deg, #00e5c0 0%, #00b4d8 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 12px rgba(0, 200, 180, 0.50), 0 1px 3px rgba(0,0,0,0.20);
    transition: box-shadow 0.3s, transform 0.3s;
    flex-shrink: 0;
}
#_hy-btn.extend ._hy-btn-inner {
    box-shadow: 0 4px 18px rgba(0, 200, 180, 0.65), 0 2px 5px rgba(0,0,0,0.22);
}
#_hy-btn:hover ._hy-btn-inner {
    transform: scale(1.05);
}

/* 图标：白色 */
#_hy-btn ._hy-btn-icon {
    position: relative;
    z-index: 1;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.25));
    transition: transform 0.3s ease, opacity 0.3s ease;
}
#_hy-btn:not(.extend) ._hy-btn-icon {
    opacity: 0.75;
}
#_hy-btn.extend ._hy-btn-icon {
    opacity: 1;
    transform: scale(1.08);
}

/* ========== 遮罩 ========== */
#_hy-overlay {
    all: initial;
    position: fixed;
    inset: 0;
    z-index: 2147483646;
    background: rgba(0,0,0,0.45);
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
    display: none;
    -webkit-tap-highlight-color: transparent;
}
#_hy-overlay.show {
    display: block;
    opacity: 1;
    pointer-events: auto;
}

/* ========== 面板 ========== */
#_hy-panel {
    all: initial;
    position: fixed;
    z-index: 2147483647;
    left: 0; right: 0; bottom: 0;
    max-height: 88vh;
    background: #0d0c1d;
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -8px 40px rgba(0,0,0,0.6);
    transform: translateY(100%);
    transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
    display: flex;
    flex-direction: column;
    color: #e0e0e0;
    overflow: hidden;
    will-change: transform;
}
#_hy-panel.show { transform: translateY(0); }

/* 拖拽条 */
#_hy-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 0 4px;
    cursor: grab;
    flex-shrink: 0;
    touch-action: none;
    user-select: none;
    color: rgba(255,255,255,0.15);
}
#_hy-handle:active { cursor: grabbing; }

/* 工具栏 */
#_hy-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 14px 8px;
    flex-shrink: 0;
    border-bottom: 1px solid rgba(108, 99, 255, 0.12);
}
#_hy-toolbar ._hy-title {
    font-size: 17px;
    font-weight: 700;
    color: #fff;
    display: flex;
    align-items: center;
    gap: 6px;
}
#_hy-toolbar ._hy-title span { color: #00f5d4; }
#_hy-toolbar ._hy-tool-actions { display: flex; gap: 6px; }
#_hy-toolbar ._hy-tool-actions button {
    background: rgba(108,99,255,0.12);
    border: 1px solid rgba(108,99,255,0.15);
    color: #a0a0c0;
    width: 36px; height: 36px;
    border-radius: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    padding: 0;
}
#_hy-toolbar ._hy-tool-actions button:active {
    background: rgba(0,245,212,0.15);
    color: #00f5d4;
    transform: scale(0.9);
}

/* 标签页 */
#_hy-tabs {
    display: flex;
    gap: 4px;
    padding: 6px 12px;
    overflow-x: auto;
    overflow-y: hidden;
    flex-shrink: 0;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    border-bottom: 1px solid rgba(108, 99, 255, 0.06);
}
#_hy-tabs::-webkit-scrollbar { display: none; }
._hy-tab {
    flex-shrink: 0;
    background: transparent;
    border: none;
    padding: 7px 14px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    color: #888;
    border-radius: 18px;
    transition: all 0.25s;
    white-space: nowrap;
    font-family: inherit;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    min-height: 40px;
    display: flex;
    align-items: center;
    gap: 4px;
}
._hy-tab:active { transform: scale(0.95); }
._hy-tab.active {
    color: #fff;
    background: rgba(108,99,255,0.2);
    font-weight: 600;
}
._hy-tab ._hy-count {
    display: inline-block;
    background: rgba(0,245,212,0.12);
    color: #00f5d4;
    font-size: 10px;
    border-radius: 8px;
    padding: 0 5px;
    font-weight: 600;
}

/* 内容区 */
#_hy-content {
    flex-grow: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 0;
}

/* 资源列表 */
#_hy-resource-list {
    flex-grow: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 4px 12px 12px;
}
._hy-resource-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 12px;
    margin-bottom: 6px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(108,99,255,0.06);
    transition: background 0.2s;
    min-height: 48px;
}
._hy-resource-item:active {
    background: rgba(108,99,255,0.08);
    transform: scale(0.99);
}
._hy-thumb {
    width: 40px; height: 40px;
    border-radius: 8px;
    object-fit: cover;
    background-color: #f5f5f5;
    background-image:
        linear-gradient(45deg, #e0e0e0 25%, transparent 25%),
        linear-gradient(-45deg, #e0e0e0 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #e0e0e0 75%),
        linear-gradient(-45deg, transparent 75%, #e0e0e0 75%);
    background-size: 12px 12px;
    background-position: 0 0, 0 6px, 6px -6px, -6px 0px;
    flex-shrink: 0;
    border: 1px solid rgba(108,99,255,0.12);
}
._hy-resource-info {
    flex-grow: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
}
._hy-resource-url {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #ccc;
    text-decoration: none;
    font-size: 13px;
    line-height: 1.3;
}
._hy-resource-meta {
    display: flex;
    gap: 5px;
    align-items: center;
    flex-wrap: wrap;
}
._hy-inline-badge {
    font-size: 10px;
    background: rgba(0,245,212,0.1);
    color: #00f5d4;
    border: 1px solid rgba(0,245,212,0.2);
    border-radius: 4px;
    padding: 1px 6px;
    white-space: nowrap;
    font-weight: 500;
}
._hy-resource-actions {
    display: flex;
    gap: 5px;
    flex-shrink: 0;
}
._hy-resource-actions button {
    background: rgba(0,245,212,0.06);
    border: 1px solid rgba(0,245,212,0.15);
    border-radius: 8px;
    color: #00f5d4;
    cursor: pointer;
    padding: 6px 8px;
    font-size: 11px;
    font-family: inherit;
    transition: all 0.2s;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    white-space: nowrap;
    min-height: 34px;
    display: flex;
    align-items: center;
    gap: 3px;
}
._hy-resource-actions button:active {
    background: #00f5d4;
    color: #0d0c1d;
    transform: scale(0.93);
}

/* 空状态 */
._hy-empty {
    text-align: center;
    color: #666;
    padding: 50px 20px;
    font-size: 14px;
    line-height: 1.6;
}
._hy-empty-icon {
    display: block;
    margin: 0 auto 10px;
    opacity: 0.4;
}

/* 查看器 */
._hy-viewer {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 8px 12px 12px;
}
._hy-viewer-toolbar {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
    flex-shrink: 0;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
}
._hy-viewer-btn {
    flex-shrink: 0;
    background: transparent;
    color: #a0a0c0;
    border: 1px solid rgba(108,99,255,0.15);
    border-radius: 10px;
    padding: 8px 12px;
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    min-height: 40px;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 4px;
}
._hy-viewer-btn:active {
    background: rgba(108,99,255,0.12);
    transform: scale(0.96);
}
._hy-viewer-btn.accent {
    border-color: rgba(0,245,212,0.3);
    color: #00f5d4;
}
._hy-viewer-btn.accent:active {
    background: #00f5d4;
    color: #0d0c1d;
}
._hy-viewer-content {
    flex-grow: 1;
    background: rgba(0,0,0,0.2);
    color: #c0c0e0;
    padding: 12px;
    border-radius: 10px;
    font-family: 'Fira Code', 'Consolas', 'SF Mono', monospace;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    border: 1px solid rgba(0,0,0,0.1);
    min-height: 0;
}
._hy-viewer-content.seo-style {
    font-family: inherit;
    white-space: normal !important;
    line-height: 1.7;
    font-size: 13px;
}

/* 关于 */
#_hy-about {
    padding: 12px 16px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
}
#_hy-about h4 {
    margin: 16px 0 8px;
    border-bottom: 1px solid rgba(108,99,255,0.12);
    padding-bottom: 6px;
    color: #00f5d4;
    font-size: 15px;
    display: flex;
    align-items: center;
    gap: 6px;
}
#_hy-about p {
    line-height: 1.6;
    color: #a0a0c0;
    margin: 6px 0;
    font-size: 13px;
}
#_hy-about p strong { color: #e0e0e0; }
#_hy-about ._hy-footer {
    margin-top: 16px;
    padding-top: 10px;
    border-top: 1px solid rgba(108,99,255,0.12);
    font-size: 12px;
}
#_hy-about ._hy-footer p { margin: 3px 0; color: rgba(255,255,255,0.35); }

/* ========== 图片画廊查看器（全屏） ========== */
#_hy-gallery {
    all: initial;
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    background-color: #f5f5f5;
    background-image:
        linear-gradient(45deg, #e0e0e0 25%, transparent 25%),
        linear-gradient(-45deg, #e0e0e0 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #e0e0e0 75%),
        linear-gradient(-45deg, transparent 75%, #e0e0e0 75%);
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
    display: none;
    flex-direction: column;
    opacity: 0;
    transition: opacity 0.25s ease;
    touch-action: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
}
#_hy-gallery.show {
    display: flex;
    opacity: 1;
}
/* 顶部栏 */
#_hy-gallery ._hy-gallery-top {
    position: absolute;
    top: 0; left: 0; right: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    z-index: 2;
    background: linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%);
}
#_hy-gallery ._hy-gallery-counter {
    color: rgba(255,255,255,0.85);
    font-size: 14px;
    font-weight: 500;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    letter-spacing: 0.5px;
}
#_hy-gallery ._hy-gallery-close {
    all: initial;
    width: 38px; height: 38px;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    transition: background 0.2s, transform 0.2s;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
}
#_hy-gallery ._hy-gallery-close:active {
    background: rgba(255,255,255,0.18);
    transform: scale(0.88);
}
/* 图片容器 */
#_hy-gallery ._hy-gallery-body {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    min-height: 0;
}
#_hy-gallery ._hy-gallery-body img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    transition: transform 0.3s ease;
    will-change: transform;
    user-select: none;
    -webkit-user-drag: none;
    pointer-events: none;
}
/* 导航箭头（居中固定在左右两侧） */
#_hy-gallery ._hy-gallery-prev,
#_hy-gallery ._hy-gallery-next {
position: absolute;
top: 50%;
transform: translateY(-50%);
width: 44px;
height: 44px;
border-radius: 50%;
z-index: 2;
display: flex;
align-items: center;
justify-content: center;
background: rgba(0,0,0,0.35);
color: #fff;
cursor: pointer;
opacity: 0.7;
transition: opacity 0.3s, background 0.3s;
-webkit-tap-highlight-color: transparent;
}
#_hy-gallery ._hy-gallery-prev { left: 12px; }
#_hy-gallery ._hy-gallery-next { right: 12px; }
#_hy-gallery:hover ._hy-gallery-prev,
#_hy-gallery:hover ._hy-gallery-next { opacity: 1; }
#_hy-gallery ._hy-gallery-prev:active,
#_hy-gallery ._hy-gallery-next:active {
background: rgba(255,255,255,0.2);
opacity: 1;
transform: translateY(-50%) scale(0.92);
}
/* 底部信息栏 */
#_hy-gallery ._hy-gallery-bottom {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    padding: 12px 16px 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: linear-gradient(0deg, rgba(0,0,0,0.6) 0%, transparent 100%);
    z-index: 2;
}
#_hy-gallery ._hy-gallery-bottom a {
    color: rgba(255,255,255,0.75);
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    text-decoration: none;
    padding: 6px 14px;
    border-radius: 18px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08);
    transition: background 0.2s;
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
}
#_hy-gallery ._hy-gallery-bottom a:active {
    background: rgba(255,255,255,0.14);
}
/* 底部移动端导航条 */
#_hy-gallery ._hy-gallery-dots {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 0 12px;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    max-width: 50%;
}
#_hy-gallery ._hy-gallery-dots::-webkit-scrollbar { display: none; }
#_hy-gallery ._hy-gallery-dot {
    all: initial;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: rgba(255,255,255,0.25);
    flex-shrink: 0;
    cursor: pointer;
    transition: background 0.25s, transform 0.25s;
    -webkit-tap-highlight-color: transparent;
}
#_hy-gallery ._hy-gallery-dot.active {
    background: #00f5d4;
    transform: scale(1.3);
    box-shadow: 0 0 8px rgba(0,245,212,0.5);
}
/* 桌面端箭头常显（半透明，悬停更亮） */
@media (hover: hover) {
#_hy-gallery ._hy-gallery-prev,
#_hy-gallery ._hy-gallery-next { opacity: 0.7; }
#_hy-gallery:hover ._hy-gallery-prev,
#_hy-gallery:hover ._hy-gallery-next { opacity: 1; }
}
/* 移动端箭头常显半透明 */
@media (hover: none) {
#_hy-gallery ._hy-gallery-prev,
#_hy-gallery ._hy-gallery-next { opacity: 0.7; }
#_hy-gallery ._hy-gallery-prev:active,
#_hy-gallery ._hy-gallery-next:active { opacity: 1; }
}
}

/* 动画 */
@keyframes _hyFadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
}
._hy-resource-item { animation: _hyFadeIn 0.3s ease both; }

/* Toast 反馈（移动端可视化编辑等场景） */
._hy-toast {
    position: fixed;
    bottom: 120px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,245,212,0.15);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(0,245,212,0.2);
    color: #00f5d4;
    padding: 10px 20px;
    border-radius: 12px;
    font-size: 14px;
    z-index: 2147483647;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease, transform 0.3s ease;
    transform: translateX(-50%) translateY(10px);
}
._hy-toast.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
}

/* 可视化编辑模式 */
body._hy-editing { cursor: text !important; }
body._hy-editing [contenteditable="true"]:focus {
    outline: 2px solid #00f5d4 !important;
    outline-offset: 2px;
    background: rgba(0,245,212,0.06) !important;
    border-radius: 3px;
}
body._hy-editing [contenteditable="true"] {
    cursor: text;
    -webkit-user-select: text;
    user-select: text;
}

/* ========== 桌面适配 ========== */
@media (min-width: 640px) {
    #_hy-btn {
        right: 0;
        width: 46px;
        height: 38px;
        border-radius: 19px 0 0 19px;
        transform: translateY(calc(var(--_hy-btn-offset, -50%))) translateX(calc(100% - 10px));
    }
    #_hy-btn.extend {
        transform: translateY(calc(var(--_hy-btn-offset, -50%))) translateX(0);
    }
    #_hy-btn ._hy-btn-inner {
        width: 34px;
        height: 34px;
    }
    #_hy-panel {
        left: auto; right: 24px; bottom: 88px;
        width: 440px;
        max-height: 600px;
        border-radius: 16px;
        box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 20px rgba(108,99,255,0.08);
        transform: scale(0.95);
        opacity: 0;
        transition: transform 0.25s ease, opacity 0.25s ease;
    }
    #_hy-panel.show {
        transform: scale(1);
        opacity: 1;
    }
    #_hy-overlay.show { display: none; }
    #_hy-handle { display: none; }
    #_hy-toolbar { padding: 12px 16px 10px; cursor: grab; }
    #_hy-toolbar:active { cursor: grabbing; }
}

/* 滚动条 */
#_hy-panel ::-webkit-scrollbar { width: 4px; height: 4px; }
#_hy-panel ::-webkit-scrollbar-track { background: transparent; }
#_hy-panel ::-webkit-scrollbar-thumb { background: rgba(108,99,255,0.25); border-radius: 4px; }
`);

        // --- DOM 构建 ---
        const root = document.createElement('div');
        root.id = '_hy-root';

        // Toast 反馈元素
        const toast = document.createElement('div');
        toast.className = '_hy-toast';
        toast.id = '_hy-toast';
        let toastTimer = null;
        function showToast(msg) {
            toast.textContent = msg;
            toast.classList.add('show');
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
        }

        // 遮罩
        const overlay = document.createElement('div');
        overlay.id = '_hy-overlay';

        // ---- 圆形悬浮开关按钮 ----
        const btn = document.createElement('div');
        btn.id = '_hy-btn';
        btn.innerHTML = `
            <div class="_hy-btn-bg"></div>
            <div class="_hy-btn-inner">
                <div class="_hy-btn-icon" id="_hy-btn-icon">${icon('sparkle')}</div>
            </div>
        `;
        btn.title = '点击展开 · 嗅探';
        // CSS变量：控制垂直位置（拖拽时更新）
        btn.style.setProperty('--_hy-btn-offset', '-50%');

        // ---- 面板 ----
        const panel = document.createElement('div');
        panel.id = '_hy-panel';
        panel.innerHTML = `
            <div id="_hy-handle">${icon('drag')}</div>
            <div id="_hy-toolbar">
                <div class="_hy-title">${icon('sparkle')}<span>资源嗅探</div>
                <div class="_hy-tool-actions">
                    <button id="_hy-close-btn" title="关闭">${icon('close')}</button>
                </div>
            </div>
            <div id="_hy-tabs"></div>
            <div id="_hy-content">
                <div id="_hy-resource-list"></div>
                <div class="_hy-viewer" id="_hy-seo-viewer" style="display:none;">
                    <div class="_hy-viewer-toolbar">
                        <button class="_hy-viewer-btn accent" id="_hy-copy-seo-btn">${icon('clipboard')} 复制SEO信息</button>
                    </div>
                    <div class="_hy-viewer-content seo-style" id="_hy-seo-content"></div>
                </div>
                <div class="_hy-viewer" id="_hy-source-viewer" style="display:none;">
                    <div class="_hy-viewer-toolbar">
                        <button class="_hy-viewer-btn accent" id="_hy-copy-source-btn">${icon('clipboard')} 复制源代码</button>
                        <button class="_hy-viewer-btn accent" id="_hy-edit-mode-btn">${icon('edit')} 可视化编辑</button>
                    </div>
                    <pre class="_hy-viewer-content" id="_hy-source-code"></pre>
                </div>
                <div id="_hy-about" style="display:none;">
                    <h4>${icon('info')} 功能介绍</h4>
                    <p><strong>版本：</strong>v4.3.3（油猴移动版）</p>
                    <p><strong>智能嗅探：</strong>全自动嗅探网页图片、音视频、内嵌SVG资源。</p>
                    <p><strong>源码查看：</strong>一键查看并复制网页完整源代码。</p>
                    <p><strong>可视化编辑：</strong>开启后点击页面文字即可编辑（支持移动端触摸）。</p>
                    <p><strong>SEO检测：</strong>快速获取网站标题、描述、关键词等元数据。</p>
                    <div class="_hy-footer">                                     
                    </div>
                </div>
            </div>
        `;

        // ---- 全屏画廊查看器 ----
        const gallery = document.createElement('div');
        gallery.id = '_hy-gallery';
        gallery.innerHTML = `
            <div class="_hy-gallery-top">
                <span class="_hy-gallery-counter" id="_hy-gallery-counter">0 / 0</span>
                <button class="_hy-gallery-close" id="_hy-gallery-close">${icon('close')}</button>
            </div>
            <div class="_hy-gallery-body" id="_hy-gallery-body">
                <div class="_hy-gallery-prev" id="_hy-gallery-prev">${icon('chevron-left')}</div>
                <img id="_hy-gallery-img" src="" alt="preview">
                <div class="_hy-gallery-next" id="_hy-gallery-next">${icon('chevron-right')}</div>
            </div>
            <div class="_hy-gallery-bottom">
                <a id="_hy-gallery-open" href="#" target="_blank" rel="noopener">${icon('maximize')} 原图</a>
            </div>
        `;

        root.appendChild(toast);
        root.appendChild(overlay);
        root.appendChild(btn);
        root.appendChild(panel);
        root.appendChild(gallery);
        document.body.appendChild(root);

        // --- 状态（跨页面记忆悬浮按钮位置、开合状态和当前标签） ---
        const UI_STATE_KEY = '_hy_resource_sniffer_ui_v1';
        function readUiState() {
            try {
                const value = typeof GM_getValue === 'function' ? GM_getValue(UI_STATE_KEY, {}) : {};
                return value && typeof value === 'object' && typeof value.then !== 'function' ? value : {};
            } catch (_) { return {}; }
        }
        const savedUiState = readUiState();
        const validTabs = new Set(['image', 'video', 'audio', 'other', 'seo', 'source', 'about']);
        let currentTab = validTabs.has(savedUiState.currentTab) ? savedUiState.currentTab : 'image';
        let sourceCodeFetched = false;
        let seoFetched = false;
        let isPanelOpen = savedUiState.panelOpen === true;
        let isBtnExtended = savedUiState.extended !== false;
        let retractTimer = null;
        const btnRange = () => Math.max(0, window.innerHeight / 2 - 50);
        let btnY = Math.max(-btnRange(), Math.min(btnRange(), Number(savedUiState.btnYRatio || 0) * btnRange()));
        let saveUiTimer = null;
        function saveUiState() {
            clearTimeout(saveUiTimer);
            saveUiTimer = setTimeout(() => {
                try {
                    const range = btnRange();
                    GM_setValue(UI_STATE_KEY, {
                        btnYRatio: range ? btnY / range : 0,
                        panelOpen: isPanelOpen,
                        extended: isBtnExtended,
                        currentTab
                    });
                } catch (_) { /* 无存储权限时静默降级 */ }
            }, 100);
        }

        // DOM 引用
        const panelEl = panel;
        const overlayEl = overlay;
        const btnEl = btn;
        const tabsEl = document.getElementById('_hy-tabs');
        const resourceListEl = document.getElementById('_hy-resource-list');
        const seoViewer = document.getElementById('_hy-seo-viewer');
        const sourceViewer = document.getElementById('_hy-source-viewer');
        const aboutEl = document.getElementById('_hy-about');
        const sourceCodeEl = document.getElementById('_hy-source-code');
        const seoContentEl = document.getElementById('_hy-seo-content');
        const galleryEl = document.getElementById('_hy-gallery');
        const galleryImg = document.getElementById('_hy-gallery-img');
        const galleryCounter = document.getElementById('_hy-gallery-counter');
        const galleryClose = document.getElementById('_hy-gallery-close');
        const galleryPrev = document.getElementById('_hy-gallery-prev');
        const galleryNext = document.getElementById('_hy-gallery-next');
        const galleryOpen = document.getElementById('_hy-gallery-open');
        let galleryIndex = 0;
        let galleryList = [];

        // --- 暴露接口 ---
        window._hyUIReady = true;
        window._hyAddResourceItem = function (type, url) {
            if (currentTab === type && resourceListEl.style.display !== 'none' && isPanelOpen) {
                addItemToDOM(type, url);
            }
            updateTabCounts();
        };

        // --- 构造标签 ---
        const tabDefs = [
            { id: 'image', label: icon('image') + ' 图片' },
            { id: 'video', label: icon('video') + ' 视频' },
            { id: 'audio', label: icon('music') + ' 音频' },
            { id: 'other', label: icon('file') + ' 其他' },
            { id: 'seo', label: icon('seo') + ' SEO' },
            { id: 'source', label: icon('code') + ' 源码' },
            { id: 'about', label: icon('info') + ' 关于' }
        ];
        tabDefs.forEach(t => {
            const el = document.createElement('button');
            el.className = '_hy-tab' + (t.id === currentTab ? ' active' : '');
            el.dataset.tab = t.id;
            el.innerHTML = t.label;
            el.addEventListener('click', () => switchTab(t.id));
            tabsEl.appendChild(el);
        });

        // ============================================================
        //  U形开关按钮逻辑（两步交互：收回→点击先伸出，伸出→点击才开面板）
        //  Bug修复：mouseenter不改变isBtnExtended，只做视觉hover；
        //           touchstart用pointerId去重，防止移动端模拟click绕过两步判断
        // ============================================================

        const btnIconEl = document.getElementById('_hy-btn-icon');

        // 更新按钮图标：收回=sparkle，伸出=search，面板打开=close
        function updateBtnIcon() {
            if (isPanelOpen) {
                btnIconEl.innerHTML = icon('close');
                btnEl.title = '关闭面板';
            } else if (isBtnExtended) {
                btnIconEl.innerHTML = icon('search');
                btnEl.title = '打开嗅探';
            } else {
                btnIconEl.innerHTML = icon('sparkle');
                btnEl.title = '点击展开 · 嗅探';
            }
        }

        // 伸出（仅状态变更，不干预hover）
        function extendBtn() {
            if (isBtnExtended) return;
            isBtnExtended = true;
            btnEl.classList.add('extend');
            clearTimeout(retractTimer);
            updateBtnIcon();
            saveUiState();
        }

        // 缩回（延迟后）
        function scheduleRetract(delay) {
            clearTimeout(retractTimer);
            retractTimer = setTimeout(() => {
                if (isPanelOpen) return;
                isBtnExtended = false;
                btnEl.classList.remove('extend');
                updateBtnIcon();
                saveUiState();
            }, delay || 2000);
        }

        // ---- 鼠标悬停：仅视觉伸出，不修改 isBtnExtended ----
        // 用CSS class '_hy-btn-hover-extend' 实现视觉，不影响点击逻辑判断
        btnEl.addEventListener('mouseenter', () => {
            btnEl.classList.add('extend');        // 视觉伸出
            clearTimeout(retractTimer);
        });
        btnEl.addEventListener('mouseleave', () => {
            if (!isPanelOpen && !isBtnExtended) {
                // 真实状态是收回的，离开后恢复收回视觉
                btnEl.classList.remove('extend');
            }
            if (!isPanelOpen) scheduleRetract(1500);
        });

        // 恢复上次按钮位置及开合状态；首次使用时保持原有的3秒展示。
        btnEl.style.setProperty('--_hy-btn-offset', `calc(-50% + ${btnY}px)`);
        btnEl.classList.toggle('extend', isBtnExtended || isPanelOpen);
        if (isPanelOpen) {
            panelEl.classList.add('show');
            overlayEl.classList.add('show');
            switchTab(currentTab);
        } else if (savedUiState.extended === undefined) {
            isBtnExtended = true;
            btnEl.classList.add('extend');
            scheduleRetract(3000);
        }
        updateBtnIcon();

        // ---- 核心点击逻辑：两步交互（touch专用，防止模拟click绕过） ----
        let _touchActivated = false; // touch已处理，阻止后续模拟click

        btnEl.addEventListener('touchend', (e) => {
            e.preventDefault(); // 阻止touchend后生成模拟click
            e.stopPropagation();
            _touchActivated = true;
            setTimeout(() => { _touchActivated = false; }, 600);

            if (!isBtnExtended) {
                // 第一步：收回状态 → 伸出
                extendBtn();
                scheduleRetract(4000);
            } else {
                // 第二步：已伸出 → 切换面板
                isPanelOpen ? closePanel() : openPanel();
            }
        }, { passive: false });

        btnEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (_touchActivated) return; // touch已处理，忽略模拟click

            if (!isBtnExtended) {
                // 第一步：收回状态 → 伸出
                extendBtn();
                scheduleRetract(4000);
            } else {
                // 第二步：已伸出 → 切换面板
                isPanelOpen ? closePanel() : openPanel();
            }
        });

        // ============================================================
        //  U形按钮：可上下拖拽
        // ============================================================
        (function () {
            let isDragging = false;
            let startY = 0;
            let startBtnY = 0;

            function getClientY(e) {
                return e.touches ? e.touches[0].clientY : e.clientY;
            }

            btnEl.addEventListener('mousedown', startDrag);
            btnEl.addEventListener('touchstart', startDrag, { passive: true });

            function startDrag(e) {
                const clientY = getClientY(e);
                startY = clientY;
                startBtnY = btnY;
                isDragging = false;
                document.addEventListener('mousemove', onDrag);
                document.addEventListener('mouseup', endDrag);
                document.addEventListener('touchmove', onDrag, { passive: true });
                document.addEventListener('touchend', endDrag);
                setTimeout(() => { if (Math.abs(btnY - startBtnY) > 3) isDragging = true; }, 150);
            }

            function onDrag(e) {
                const clientY = getClientY(e);
                const delta = clientY - startY;
                // btnY 为相对屏幕中心的偏移px，限制在可视范围内
                btnY = Math.max(-window.innerHeight / 2 + 50, Math.min(window.innerHeight / 2 - 50, startBtnY + delta));
                // 伸出状态：transform = translateY(calc(-50% + {btnY}px)) translateX(0)
                // 收回状态：transform = translateY(calc(-50% + {btnY}px)) translateX(calc(100% - 12px))
                // 用两个CSS变量分别控制
                btnEl.style.setProperty('--_hy-btn-offset', `calc(-50% + ${btnY}px)`);
                if (Math.abs(delta) > 5) isDragging = true;
            }

            function endDrag() {
                document.removeEventListener('mousemove', onDrag);
                document.removeEventListener('mouseup', endDrag);
                document.removeEventListener('touchmove', onDrag);
                document.removeEventListener('touchend', endDrag);
                if (isDragging) {
                    btnEl.addEventListener('click', preventClick, { once: true });
                    saveUiState();
                }
                isDragging = false;
            }

            function preventClick(e) {
                e.stopPropagation();
                e.preventDefault();
            }
        })();


        window.addEventListener('resize', () => {
            btnY = Math.max(-btnRange(), Math.min(btnRange(), btnY));
            btnEl.style.setProperty('--_hy-btn-offset', `calc(-50% + ${btnY}px)`);
            saveUiState();
        }, { passive: true });

        // ============================================================
        //  面板开关
        // ============================================================
        function openPanel() {
            isPanelOpen = true;
            panelEl.classList.add('show');
            overlayEl.classList.add('show');
            extendBtn();
            updateBtnIcon();
            switchTab(currentTab);
            saveUiState();
        }

        function closePanel() {
            isPanelOpen = false;
            panelEl.classList.remove('show');
            overlayEl.classList.remove('show');
            updateBtnIcon();
            scheduleRetract(2000);
            saveUiState();
        }

        overlayEl.addEventListener('click', closePanel);
        document.getElementById('_hy-close-btn').addEventListener('click', closePanel);

        // ============================================================
        //  标签切换
        // ============================================================
        function switchTab(tabId) {
            currentTab = tabId;
            saveUiState();
            document.querySelectorAll('._hy-tab').forEach(el => {
                el.classList.toggle('active', el.dataset.tab === tabId);
            });
            resourceListEl.style.display = 'none';
            seoViewer.style.display = 'none';
            sourceViewer.style.display = 'none';
            aboutEl.style.display = 'none';

            if (['image', 'video', 'audio', 'other'].includes(tabId)) {
                resourceListEl.style.display = 'block';
                renderResourceList(tabId);
            } else if (tabId === 'seo') {
                seoViewer.style.display = 'flex';
                fetchSeoData();
            } else if (tabId === 'source') {
                sourceViewer.style.display = 'flex';
                fetchSourceCode();
            } else if (tabId === 'about') {
                aboutEl.style.display = 'block';
            }
        }

        // ============================================================
        //  资源列表
        // ============================================================
        function renderResourceList(type) {
            const resources = allResources[type] || [];
            resourceListEl.innerHTML = '';
            if (resources.length === 0) {
                resourceListEl.innerHTML = `<div class="_hy-empty"><span class="_hy-empty-icon">${icon('search')}</span>还没有发现资源<br>刷新页面或浏览其他内容试试</div>`;
                return;
            }
            resources.forEach(url => addItemToDOM(type, url));
        }

        function addItemToDOM(type, url) {
            if (resourceListEl.querySelector(`[data-hy-url="${CSS.escape(url)}"]`)) return;

            const item = document.createElement('div');
            item.className = '_hy-resource-item';
            item.dataset.hyUrl = url;

            const isInlineSvg = url.startsWith('data:image/svg+xml');
            const isImg = type === 'image';
            const thumbHtml = isImg ? `<img src="${url}" class="_hy-thumb" alt="" loading="lazy">` : '';
            const badgeHtml = isInlineSvg ? '<span class="_hy-inline-badge">内嵌SVG</span>' : '';
            const displayUrl = isInlineSvg ? url.substring(0, 55) + '…' : url;

            // 根据类型选图标
            let typeIcon = icon('file');
            if (type === 'image') typeIcon = icon('image');
            else if (type === 'video') typeIcon = icon('video');
            else if (type === 'audio') typeIcon = icon('music');

            item.innerHTML = `
                ${thumbHtml}
                <div class="_hy-resource-info">
                    <a href="${url}" target="_blank" class="_hy-resource-url" title="${url}">${displayUrl}</a>
                    <div class="_hy-resource-meta">${badgeHtml}</div>
                </div>
                <div class="_hy-resource-actions">
    <button class="_hy-download-btn" data-url="${url}">下载</button>
    <button class="_hy-copy-btn" data-url="${url}">复制</button>
    <button class="_hy-open-btn" data-url="${url}">打开</button>
    </div>
            `;
            resourceListEl.appendChild(item);
        }

        function updateTabCounts() {
            document.querySelectorAll('._hy-tab').forEach(el => {
                const type = el.dataset.tab;
                if (['image', 'video', 'audio', 'other'].includes(type)) {
                    const count = (allResources[type] || []).length;
                    const existingCount = el.querySelector('._hy-count');
                    if (count > 0) {
                        if (existingCount) existingCount.textContent = count;
                        else el.innerHTML += ` <span class="_hy-count">${count}</span>`;
                    } else {
                        if (existingCount) existingCount.remove();
                    }
                }
            });
        }

        // ============================================================
        //  源代码
        // ============================================================
        function fetchSourceCode() {
            if (sourceCodeFetched && sourceCodeEl.textContent) return;
            sourceCodeEl.textContent = '加载中...';
            fetch(location.href, { credentials: 'include' })
                .then(res => res.text())
                .then(html => {
                    sourceCodeEl.textContent = html;
                    sourceCodeFetched = true;
                })
                .catch(() => {
                    sourceCodeEl.textContent = '无法加载源代码。';
                });
        }

        // ============================================================
        //  SEO
        // ============================================================
        function fetchSeoData() {
            if (seoFetched && seoContentEl.innerHTML) return;
            seoContentEl.innerHTML = '加载中...';
            setTimeout(() => {
                try {
                    const title = document.title || '无';
                    const desc = document.querySelector('meta[name="description"]')?.getAttribute('content')
                        || document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '无';
                    const keywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '无';
                    let otherMeta = '';
                    document.querySelectorAll('meta').forEach(meta => {
                        const name = meta.getAttribute('name') || meta.getAttribute('property') || meta.getAttribute('http-equiv');
                        const content = meta.getAttribute('content');
                        if (name && content && !['description', 'keywords'].includes(name.toLowerCase())) {
                            otherMeta += `<div style="margin-bottom:5px; padding-bottom:5px; border-bottom:1px solid rgba(255,255,255,0.05);"><strong>${name}:</strong><br><span style="word-break:break-all;font-size:12px;">${content}</span></div>`;
                        }
                    });
                    seoContentEl.innerHTML = `
                        <div style="margin-bottom:10px;"><strong>${icon('title')} 标题 (Title):</strong><br>${title}</div>
                        <div style="margin-bottom:10px;"><strong>${icon('desc')} 描述 (Description):</strong><br>${desc}</div>
                        <div style="margin-bottom:10px;"><strong>${icon('tag')} 关键词 (Keywords):</strong><br>${keywords}</div>
                        ${otherMeta ? '<div style="margin-top:12px; margin-bottom:6px; font-weight:bold; color:#00f5d4;">' + icon('attachment') + ' 其他 Meta</div>' + otherMeta : ''}
                    `;
                    seoFetched = true;
                } catch (e) {
                    seoContentEl.innerHTML = '无法加载SEO数据。';
                }
            }, 100);
        }

        // ============================================================
        //  事件委托（资源操作）
        // ============================================================
        resourceListEl.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;
            const url = target.dataset.url;
            if (!url) return;

            if (target.classList.contains('_hy-copy-btn')) {
                // 内嵌 SVG：解码 data URL，复制完整 SVG 代码
                let copyText = url;
                if (url.startsWith('data:image/svg+xml')) {
                    const commaIdx = url.indexOf(',');
                    if (commaIdx > -1) {
                        try {
                            copyText = decodeURIComponent(url.substring(commaIdx + 1));
                        } catch (_) {
                            copyText = url;
                        }
                    }
                }
                navigator.clipboard.writeText(copyText).then(() => {
                    target.innerHTML = '已复制';
                    setTimeout(() => target.innerHTML = '复制', 1200);
                });
            } else if (target.classList.contains('_hy-open-btn')) {
                window.open(url, '_blank');
            }
        });

        // ============================================================
        //  全屏画廊查看器（点击缩略图打开，支持上一张/下一张）
        // ============================================================

        function openGallery(list, idx) {
            galleryList = list;
            galleryIndex = idx;
            updateGallery();
            galleryEl.classList.add('show');
            // 关闭嗅探面板
            if (isPanelOpen) closePanel();
        }

        function updateGallery() {
            if (!galleryList.length) return;
            const url = galleryList[galleryIndex];
            galleryImg.src = url;
            galleryCounter.textContent = (galleryIndex + 1) + ' / ' + galleryList.length;
            galleryOpen.href = url;
            // 预加载相邻图片
            if (galleryIndex > 0) {
                const p = new Image();
                p.src = galleryList[galleryIndex - 1];
            }
            if (galleryIndex < galleryList.length - 1) {
                const n = new Image();
                n.src = galleryList[galleryIndex + 1];
            }
        }

        function closeGallery() {
            galleryEl.classList.remove('show');
            galleryImg.src = '';
            galleryList = [];
        }

        function prevGallery() {
            if (galleryList.length < 2) return;
            galleryIndex = (galleryIndex - 1 + galleryList.length) % galleryList.length;
            updateGallery();
        }

        function nextGallery() {
            if (galleryList.length < 2) return;
            galleryIndex = (galleryIndex + 1) % galleryList.length;
            updateGallery();
        }

        // 点击关闭按钮
        galleryClose.addEventListener('click', closeGallery);
        // 点击背景关闭（点击图片本身不关闭）
        galleryEl.addEventListener('click', (e) => {
            if (e.target === galleryEl || e.target === document.getElementById('_hy-gallery-body') || e.target.closest('._hy-gallery-body') === e.target) {
                closeGallery();
            }
        });
        // 上一张/下一张
        galleryPrev.addEventListener('click', (e) => { e.stopPropagation(); prevGallery(); });
        galleryNext.addEventListener('click', (e) => { e.stopPropagation(); nextGallery(); });
        // 键盘控制
        document.addEventListener('keydown', (e) => {
            if (!galleryEl.classList.contains('show')) return;
            if (e.key === 'Escape') closeGallery();
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prevGallery(); }
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); nextGallery(); }
        });
        // 触摸滑动
        let touchStartX = 0;
        galleryEl.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        galleryEl.addEventListener('touchend', (e) => {
            const diff = e.changedTouches[0].screenX - touchStartX;
            if (Math.abs(diff) > 50) {
                if (diff > 0) prevGallery();
                else nextGallery();
            }
        }, { passive: true });

        // 点击资源列表中的缩略图 → 打开画廊
        resourceListEl.addEventListener('click', (e) => {
            const thumb = e.target.closest('._hy-thumb');
            if (!thumb) return;
            const item = thumb.closest('._hy-resource-item');
            if (!item) return;
            const url = item.dataset.hyUrl;
            if (!url) return;
            // 获取当前分类的所有URL
            const type = currentTab;
            const list = allResources[type] || [];
            if (!list.length) return;
            const idx = list.indexOf(url);
            if (idx === -1) return;
            openGallery(list, idx);
        });

        // 点击"下载"按钮下载对应资源
resourceListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('._hy-download-btn');
    if (!btn) return;
    const url = btn.dataset.url;
    if (!url) return;
    // 创建临时 <a> 元素触发下载
    const a = document.createElement('a');
    a.href = url;
    a.download = url.split('/').pop() || 'download';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
});

        // ============================================================
        //  SEO / 源代码 / 可视化编辑
        // ============================================================

        document.getElementById('_hy-copy-seo-btn').addEventListener('click', function () {
            const text = seoContentEl.innerText || seoContentEl.textContent;
            if (text && text !== '加载中...') {
                navigator.clipboard.writeText(text).then(() => {
                    this.innerHTML = icon('check') + ' 已复制';
                    setTimeout(() => this.innerHTML = icon('clipboard') + ' 复制SEO信息', 1500);
                });
            }
        });

        document.getElementById('_hy-copy-source-btn').addEventListener('click', function () {
            const text = sourceCodeEl.textContent;
            if (text && text !== '加载中...' && text !== '无法加载源代码。') {
                navigator.clipboard.writeText(text).then(() => {
                    this.innerHTML = icon('check') + ' 已复制';
                    setTimeout(() => this.innerHTML = icon('clipboard') + ' 复制源代码', 1500);
                });
            }
        });

        // ----- 可视化编辑（适配移动端触摸操作） -----
        const editBtn = document.getElementById('_hy-edit-mode-btn');
        let editModeOn = false;
        let lastTouchX = 0, lastTouchY = 0;

        function isMobile() {
            return window.innerWidth < 640 || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
        }
        function isSelfUI(el) {
            return !!(el && el.closest && el.closest('[id^="_hy-"]'));
        }
        // 将光标定位到指定坐标（移动端点击后弹出键盘并定位光标）
        function placeCaretAtPoint(x, y) {
            let range = null;
            if (document.caretRangeFromPoint) {
                range = document.caretRangeFromPoint(x, y);
            } else if (document.caretPositionFromPoint) {
                const pos = document.caretPositionFromPoint(x, y);
                if (pos) {
                    range = document.createRange();
                    range.setStart(pos.offsetNode, pos.offset);
                    range.collapse(true);
                }
            }
            if (!range) return false;
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            return true;
        }
        // 让目标元素可编辑并聚焦、定位光标
        function makeEditableAndFocus(target, x, y) {
            if (!target || isSelfUI(target)) return false;
            // 选取最近的可编辑文本块，避免落到非文本容器
            const block = target.closest('h1,h2,h3,h4,h5,h6,p,span,a,li,td,th,label,figcaption,blockquote,em,strong,b,i,div');
            const el = block || target;
            if (isSelfUI(el)) return false;
            el.setAttribute('contenteditable', 'true');
            try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); }
            placeCaretAtPoint(x, y);
            return true;
        }
        function onEditTouchStart(e) {
            if (!editModeOn) return;
            const t = e.touches[0];
            if (t) { lastTouchX = t.clientX; lastTouchY = t.clientY; }
        }
        function onEditTouchEnd(e) {
            if (!editModeOn) return;
            const t = e.changedTouches[0];
            if (!t) return;
            const target = document.elementFromPoint(t.clientX, t.clientY);
            if (!target || isSelfUI(target)) return;
            e.preventDefault(); // 阻止默认滚动/选择，确保聚焦与键盘弹出
            makeEditableAndFocus(target, t.clientX, t.clientY);
        }
        function onEditClick(e) {
            if (!editModeOn) return;
            if (isSelfUI(e.target)) return;
            makeEditableAndFocus(e.target, e.clientX, e.clientY);
        }

        editBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (editModeOn) {
                // 关闭编辑：还原所有动态设置过的可编辑元素
                document.querySelectorAll('[contenteditable="true"]').forEach(el => {
                    el.removeAttribute('contenteditable');
                });
                document.body.classList.remove('_hy-editing');
                document.removeEventListener('touchstart', onEditTouchStart);
                document.removeEventListener('touchend', onEditTouchEnd);
                document.removeEventListener('click', onEditClick, true);
                editModeOn = false;
                this.innerHTML = icon('edit') + ' 可视化编辑';
                showToast('已关闭编辑模式');
            } else {
                document.body.classList.add('_hy-editing');
                document.addEventListener('touchstart', onEditTouchStart, { passive: true });
                document.addEventListener('touchend', onEditTouchEnd, { passive: false });
                document.addEventListener('click', onEditClick, true);
                editModeOn = true;
                this.innerHTML = icon('lock') + ' 关闭编辑';
                showToast(isMobile()
                    ? '编辑模式已开启，点击页面文字即可编辑'
                    : '编辑模式已开启，点击页面文字即可编辑');
            }
        });

        // ============================================================
        //  桌面拖拽面板
        // ============================================================
        (function () {
            if (window.innerWidth < 640) return;
            const toolbar = document.getElementById('_hy-toolbar');
            let dragging = false, startX, startY, origX, origY;

            toolbar.addEventListener('mousedown', (e) => {
                if (e.target.tagName === 'BUTTON') return;
                dragging = true;
                const rect = panelEl.getBoundingClientRect();
                origX = rect.left; origY = rect.top;
                startX = e.clientX; startY = e.clientY;
                panelEl.style.left = origX + 'px';
                panelEl.style.top = origY + 'px';
                panelEl.style.right = 'auto';
                panelEl.style.bottom = 'auto';
                document.addEventListener('mousemove', onDrag);
                document.addEventListener('mouseup', stopDrag);
            });

            function onDrag(e) {
                if (!dragging) return;
                panelEl.style.left = (origX + e.clientX - startX) + 'px';
                panelEl.style.top = (origY + e.clientY - startY) + 'px';
            }
            function stopDrag() {
                dragging = false;
                document.removeEventListener('mousemove', onDrag);
                document.removeEventListener('mouseup', stopDrag);
            }
        })();

        // ============================================================
        //  移动端拖拽关闭面板
        // ============================================================
        (function () {
            if (window.innerWidth >= 640) return;
            const handle = document.getElementById('_hy-handle');
            let startY = 0, currentY = 0, isDragging = false;

            handle.addEventListener('touchstart', (e) => {
                startY = e.touches[0].clientY;
                isDragging = true;
                panelEl.style.transition = 'none';
            }, { passive: true });

            document.addEventListener('touchmove', (e) => {
                if (!isDragging) return;
                currentY = e.touches[0].clientY;
                const delta = currentY - startY;
                if (delta > 0) panelEl.style.transform = 'translateY(' + delta + 'px)';
            }, { passive: true });

            document.addEventListener('touchend', () => {
                if (!isDragging) return;
                isDragging = false;
                panelEl.style.transition = 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)';
                const delta = currentY - startY;
                if (delta > 100) closePanel();
                else panelEl.style.transform = '';
                startY = 0; currentY = 0;
            }, { passive: true });
        })();

        // ============================================================
        //  初始渲染
        // ============================================================
        renderResourceList('image');
        updateTabCounts();
    }

})();