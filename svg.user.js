// ==UserScript==
// @name         资源嗅探
// @namespace    http://tampermonkey.net/
// @version      v4.2.4
// @description  自动嗅探网页图片/视频/音频/SVG资源，含源码查看、可视化编辑、SEO检测。移动端适配。
// @author       增强版
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_openInTab
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

    // ============================================================
    //  2. 嗅探引擎
    // ============================================================
    if (location.protocol === 'chrome:' || location.protocol === 'edge:' || location.hostname === '') return;

    const resourceTypes = {
        video: new Set(['.mp4', '.flv', '.m3u8', '.avi', '.wmv', '.mov']),
        audio: new Set(['.mp3', '.wav', '.ogg', '.m4a']),
        image: new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'])
    };

    // 常规扩展名检查
    const imageExtSet = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.avif', '.tiff', '.tif']);
    const videoExtSet = new Set(['.mp4', '.flv', '.m3u8', '.avi', '.wmv', '.mov', '.webm', '.mkv', '.ts', '.mpeg']);
    const audioExtSet = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma']);

    function categorizeUrl(url) {
        if (!url || typeof url !== 'string') return;
        // 跳过空字符串、纯数字ID（无法直接访问的资源标记）
        if (url.trim() === '') return;
        try {
            const urlObj = new URL(url);
            let type = 'other';
            if (urlObj.protocol === 'data:') {
                const mime = urlObj.pathname.split(';')[0];
                if (mime.startsWith('image/')) type = 'image';
                else if (mime.startsWith('video/')) type = 'video';
                else if (mime.startsWith('audio/')) type = 'audio';
                addResource(type, url);
                return;
            }
            // 检查文件扩展名
            const path = urlObj.pathname;
            const dotIdx = path.lastIndexOf('.');
            if (dotIdx !== -1) {
                const ext = path.substring(dotIdx).toLowerCase().split('?')[0].split('#')[0];
                if (imageExtSet.has(ext)) type = 'image';
                else if (videoExtSet.has(ext)) type = 'video';
                else if (audioExtSet.has(ext)) type = 'audio';
            } else {
                // 无扩展名：检查是否包含图片服务常见关键词
                const lowerUrl = url.toLowerCase();
                if (lowerUrl.includes('/image/') || lowerUrl.includes('/img/') || lowerUrl.includes('/photo/') ||
                    lowerUrl.includes('/thumbnail/') || lowerUrl.includes('/thumb/') || lowerUrl.includes('/picture/') ||
                    lowerUrl.includes('image') || lowerUrl.includes('img') || 
                    lowerUrl.startsWith('//') && (lowerUrl.includes('.webp') || lowerUrl.includes('.jpg') || lowerUrl.includes('.png'))) {
                    type = 'image';
                }
            }
            addResource(type, url);
        } catch (e) { /* 忽略 */ }
    }

    // 智能检查一个URL是否为图片（通过尝试加载）
    function isImageUrl(url) {
        if (!url || typeof url !== 'string') return false;
        // 先通过扩展名快速判断
        try {
            const urlObj = new URL(url);
            const path = urlObj.pathname;
            const dotIdx = path.lastIndexOf('.');
            if (dotIdx !== -1) {
                const ext = path.substring(dotIdx).toLowerCase().split('?')[0].split('#')[0];
                if (imageExtSet.has(ext)) return true;
            }
            // data URL
            if (url.startsWith('data:image/')) return true;
            // 包含图片特征但不一定是
            if (url.startsWith('blob:')) return true;
        } catch(e) {}
        return false;
    }

    function addResource(type, url) {
        if (!url || allResources[type].includes(url)) return;
        allResources[type].push(url);
        if (window._hyUIReady) window._hyAddResourceItem(type, url);
    }

    // 常见懒加载图片属性列表
    const lazyAttrs = ['data-src', 'data-original', 'data-lazy-src', 'data-srcset', 'data-url', 'data-echo', 'data-lazy', 'data-full', 'data-real-src', 'data-bg', 'data-bg-url', 'data-image', 'data-img', 'data-load', 'data-lazyload', 'data-original-src', 'data-highres', 'data-normal', 'data-small', 'data-medium', 'data-large'];

    function scanDOM() {
        // 1. 标准标签的 src / srcset
        ['video', 'audio', 'img', 'image'].forEach(tag => {
            document.querySelectorAll(tag).forEach(el => {
                if (el.src) categorizeUrl(el.src);
                if (el.srcset) {
                    el.srcset.split(',').forEach(s => {
                        const url = s.trim().split(' ')[0];
                        categorizeUrl(url);
                    });
                }
                // 懒加载属性
                lazyAttrs.forEach(attr => {
                    const val = el.getAttribute(attr);
                    if (val) categorizeUrl(val);
                });
            });
        });

        // 2. 单独扫描所有元素的懒加载属性（用于那些非标准标签或自定义元素）
        const lazySelector = lazyAttrs.map(a => '[' + a + ']').join(',');
        if (lazySelector) {
            document.querySelectorAll(lazySelector).forEach(el => {
                lazyAttrs.forEach(attr => {
                    const val = el.getAttribute(attr);
                    if (val) categorizeUrl(val);
                });
            });
        }

        // 3. 内联 SVG
        document.querySelectorAll('svg').forEach(svg => {
            if (!svg.querySelector('*') && (!svg.textContent || !svg.textContent.trim())) return;
            if (svg.closest('img')) return;
            try {
                const clone = svg.cloneNode(true);
                if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                const svgStr = new XMLSerializer().serializeToString(clone);
                if (svgStr.length < 50) return;
                addResource('image', 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr));
            } catch (e) { /* 忽略 */ }
        });

        // 4. object/embed SVG
        document.querySelectorAll('object[type="image/svg+xml"], object[data$=".svg"], embed[type="image/svg+xml"], embed[src$=".svg"]').forEach(el => {
            const url = el.data || el.src;
            if (url) categorizeUrl(url);
        });

        // 5. <picture>/<video>/<audio> 中的 <source> 标签
        document.querySelectorAll('picture source, video source, audio source').forEach(el => {
            if (el.src) categorizeUrl(el.src);
            if (el.srcset) {
                el.srcset.split(',').forEach(s => {
                    const url = s.trim().split(' ')[0];
                    if (url) categorizeUrl(url);
                });
            }
            lazyAttrs.forEach(attr => {
                const val = el.getAttribute(attr);
                if (val) categorizeUrl(val);
            });
        });

        // 6. <video> poster 属性
        document.querySelectorAll('video[poster]').forEach(el => {
            if (el.poster) categorizeUrl(el.poster);
        });

        // 7. <link rel="preload" / prefetch> — 同时支持 image/video/audio
        document.querySelectorAll('link[rel="preload"][as="image"], link[rel="preload"][as="video"], link[rel="preload"][as="audio"], link[rel="prefetch"][as="image"], link[rel="prefetch"][as="video"], link[rel="prefetch"][as="audio"]').forEach(el => {
            if (el.href) categorizeUrl(el.href);
        });

        // 8. <link rel="apple-touch-icon"> 等图标
        document.querySelectorAll('link[rel*="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-startup-image"], link[rel="manifest"]').forEach(el => {
            if (el.href) categorizeUrl(el.href);
        });

        // 9. <meta property="og:image"> / <meta name="twitter:image"> / og:video / og:audio
        document.querySelectorAll('meta[property="og:image"], meta[property="og:image:url"], meta[property="og:image:secure_url"], meta[property="og:video"], meta[property="og:video:url"], meta[property="og:video:secure_url"], meta[property="og:audio"], meta[property="og:audio:url"], meta[name="twitter:image"], meta[name="twitter:image:src"], meta[name="twitter:player"], meta[itemprop="image"]').forEach(el => {
            if (el.content) categorizeUrl(el.content);
        });

        // 10. <iframe> 中的视频平台嵌入链接
        document.querySelectorAll('iframe[src]').forEach(el => {
            const src = el.src;
            if (src) {
                // YouTube / YouTube Shorts / Bilibili / Vimeo / Dailymotion / Tencent Video / Youku
                const videoPlatforms = ['youtube.com/embed/', 'youtube.com/watch?v=', 'youtu.be/', 'bilibili.com/', 'player.bilibili.com',
                    'vimeo.com/', 'dailymotion.com/embed/', 'v.qq.com/', 'v.youku.com/', 'miguvideo.com/'];
                if (videoPlatforms.some(p => src.includes(p))) {
                    categorizeUrl(src);
                }
            }
        });

        // 11. CSS background-image（内联样式）
        document.querySelectorAll('[style*="background"]').forEach(el => {
            const s = el.getAttribute('style');
            if (s) {
                const matches = s.match(/url\(['"]?([^'")\s]+)['"]?\)/gi);
                if (matches) {
                    matches.forEach(m => {
                        const url = m.replace(/url\(['"]?/, '').replace(/['"]?\)/, '').trim();
                        if (url && isImageUrl(url)) categorizeUrl(url);
                    });
                }
            }
        });

        // 12. <meta name="msapplication-TileImage">
        document.querySelectorAll('meta[name="msapplication-TileImage"]').forEach(el => {
            if (el.content) categorizeUrl(el.content);
        });
    }

    try {
        new PerformanceObserver(list => list.getEntries().forEach(e => categorizeUrl(e.name)))
            .observe({ entryTypes: ['resource'] });
    } catch (e) { /* 忽略 */ }

    function startDomObserver() {
        if (!document.body) { setTimeout(startDomObserver, 100); return; }
        scanDOM();
        // 增强 MutationObserver：同时监听属性变化（尤其是 src 和懒加载属性）
        const observer = new MutationObserver((mutations) => {
            let needsScan = false;
            for (const m of mutations) {
                if (m.type === 'childList' && m.addedNodes.length > 0) {
                    needsScan = true;
                    break;
                }
                if (m.type === 'attributes') {
                    const attr = m.attributeName;
                    if (attr === 'src' || attr === 'srcset' || attr === 'href' || lazyAttrs.includes(attr) || attr === 'style' || attr === 'data') {
                        needsScan = true;
                        break;
                    }
                }
            }
            if (needsScan) scanDOM();
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src', 'srcset', 'href', 'style', 'data', ...lazyAttrs]
        });

        // 定期扫描（捕获懒加载和动态添加的资源）
        setInterval(scanDOM, 3000);

        // 注意：无需劫持 Image 构造函数。
        // MutationObserver 已监听 attributes + attributeFilter:['src']
        // 当 JS 设置 img.src = url 时，属性变化会触发扫描，足够捕获动态图片。
        // 劫持 Image 会阻断浏览器正常的图片加载流程，导致网页图片不显示。
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startDomObserver);
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
        'maximize': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>'
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
/* 导航箭头（左右半区点击） */
#_hy-gallery ._hy-gallery-prev,
#_hy-gallery ._hy-gallery-next {
    position: absolute;
    top: 0; bottom: 0;
    width: 35%;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: rgba(255,255,255,0.6);
    opacity: 0;
    transition: opacity 0.3s, background 0.3s;
    -webkit-tap-highlight-color: transparent;
}
#_hy-gallery ._hy-gallery-prev { left: 0; }
#_hy-gallery ._hy-gallery-next { right: 0; }
#_hy-gallery:hover ._hy-gallery-prev,
#_hy-gallery:hover ._hy-gallery-next { opacity: 1; }
#_hy-gallery ._hy-gallery-prev:active,
#_hy-gallery ._hy-gallery-next:active {
    background: rgba(255,255,255,0.04);
    opacity: 1;
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
/* 桌面端箭头始终可见 */
@media (hover: hover) {
    #_hy-gallery ._hy-gallery-prev,
    #_hy-gallery ._hy-gallery-next { opacity: 0; }
    #_hy-gallery:hover ._hy-gallery-prev,
    #_hy-gallery:hover ._hy-gallery-next { opacity: 1; }
}
/* 移动端箭头常显半透明 */
@media (hover: none) {
    #_hy-gallery ._hy-gallery-prev,
    #_hy-gallery ._hy-gallery-next { opacity: 0.5; }
    #_hy-gallery ._hy-gallery-prev:active,
    #_hy-gallery ._hy-gallery-next:active { opacity: 1; }
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
                    <p><strong>版本：</strong>v4.2.4（油猴移动版）</p>
                    <p><strong>智能嗅探：</strong>全自动嗅探网页图片、音视频、内嵌SVG资源。</p>
                    <p><strong>源码查看：</strong>一键查看并复制网页完整源代码。</p>
                    <p><strong>可视化编辑：</strong>开启后可直接在网页上编辑文字（移动端双击进入编辑状态）。</p>
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

        // --- 状态 ---
        let currentTab = 'image';
        let sourceCodeFetched = false;
        let seoFetched = false;
        let isPanelOpen = false;
        let isBtnExtended = false;
        let retractTimer = null;
        let btnY = 0; // 垂直偏移（px）

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
            el.className = '_hy-tab' + (t.id === 'image' ? ' active' : '');
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
        }

        // 缩回（延迟后）
        function scheduleRetract(delay) {
            clearTimeout(retractTimer);
            retractTimer = setTimeout(() => {
                if (isPanelOpen) return;
                isBtnExtended = false;
                btnEl.classList.remove('extend');
                updateBtnIcon();
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

        // 初始3秒后自动缩回
        isBtnExtended = true;
        btnEl.classList.add('extend');
        updateBtnIcon();
        scheduleRetract(3000);

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
                }
                isDragging = false;
            }

            function preventClick(e) {
                e.stopPropagation();
                e.preventDefault();
            }
        })();

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
        }

        function closePanel() {
            isPanelOpen = false;
            panelEl.classList.remove('show');
            overlayEl.classList.remove('show');
            updateBtnIcon();
            scheduleRetract(2000);
        }

        overlayEl.addEventListener('click', closePanel);
        document.getElementById('_hy-close-btn').addEventListener('click', closePanel);

        // ============================================================
        //  标签切换
        // ============================================================
        function switchTab(tabId) {
            currentTab = tabId;
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
    <button class="_hy-preview-btn" data-url="${url}">${icon('image')} 预览</button>
    <button class="_hy-copy-btn" data-url="${url}">${icon('copy')} 复制</button>
    <button class="_hy-open-btn" data-url="${url}">${icon('external')} 打开</button>
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
            setTimeout(() => {
                try {
                    sourceCodeEl.textContent = document.documentElement.outerHTML;
                    sourceCodeFetched = true;
                } catch (e) {
                    sourceCodeEl.textContent = '无法加载源代码。';
                }
            }, 100);
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
                navigator.clipboard.writeText(url).then(() => {
                    target.innerHTML = icon('check') + ' 已复制';
                    setTimeout(() => target.innerHTML = icon('copy') + ' 复制', 1200);
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

        // 点击"预览"按钮打开画廊
resourceListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('._hy-preview-btn');
    if (!btn) return;
    const item = btn.closest('._hy-resource-item');
    if (!item) return;
    const url = item.dataset.hyUrl;
    if (!url) return;
    const type = currentTab;
    const list = allResources[type] || [];
    if (!list.length) return;
    const idx = list.indexOf(url);
    if (idx === -1) return;
    openGallery(list, idx);
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

        // ----- 可视化编辑（修复移动端） -----
        const editBtn = document.getElementById('_hy-edit-mode-btn');
        editBtn.addEventListener('click', function () {
            if (document.designMode === 'on') {
                document.designMode = 'off';
                this.innerHTML = icon('edit') + ' 可视化编辑';
                showToast('已关闭编辑模式');
            } else {
                document.designMode = 'on';
                this.innerHTML = icon('lock') + ' 关闭编辑';
                showToast('编辑模式已开启，点击页面内容即可编辑');
                // 移动端：提示双击进入编辑状态
                if (window.innerWidth < 640) {
                    showToast('已开启编辑模式，点击页面文字即可编辑');
                }
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