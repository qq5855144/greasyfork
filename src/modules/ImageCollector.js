/**
 * 图片采集模块
 * 增强版：DOM + 懒加载属性 + srcset + CSS + Resource Timing + MutationObserver。
 * 重点解决无限滚动/虚拟列表中后续图片无法被发现，以及 CDN 图片 URL 无扩展名的问题。
 */

import { CONFIG } from "../config.js";
import { Utils } from "../utils/index.js";
import { BlobManager } from "../services/BlobManager.js";
import { Deduplication } from "./Deduplication.js";

class ImageCollectorService {
    constructor() {
        this.hiddenElements = [];
        this.observer = null;
        this.pendingNetworkImages = new Map();
        this.networkSnifferInstalled = false;
        this.lazyAttrs = [
            'data-src', 'data-original', 'data-lazy-src', 'data-srcset', 'data-url',
            'data-echo', 'data-lazy', 'data-full', 'data-real-src', 'data-bg', 'data-bg-url',
            'data-image', 'data-img', 'data-load', 'data-lazyload', 'data-original-src',
            'data-highres', 'data-normal', 'data-small', 'data-medium', 'data-large',
            'data-fallback', 'data-zoom', 'data-full-src', 'data-original-url'
        ];
        this._installNetworkSniffer();
    }

    _installNetworkSniffer() {
        if (this.networkSnifferInstalled) return;
        this.networkSnifferInstalled = true;
        const record = (url, initiatorType = '') => {
            if (!url || typeof url !== 'string' || url.startsWith('data:')) return;
            try {
                const fullUrl = new URL(url, window.location.href).href;
                if (initiatorType === 'img' || initiatorType === 'image') {
                    this.pendingNetworkImages.set(fullUrl, { url: fullUrl, initiatorType, time: Date.now() });
                }
            } catch (_) {}
        };
        try {
            performance.getEntriesByType('resource').forEach(entry => record(entry.name, entry.initiatorType));
        } catch (_) {}
        try {
            const po = new PerformanceObserver(list => {
                list.getEntries().forEach(entry => record(entry.name, entry.initiatorType));
            });
            po.observe({ type: 'resource', buffered: true });
            this.performanceObserver = po;
        } catch (_) {
            try {
                const po = new PerformanceObserver(list => {
                    list.getEntries().forEach(entry => record(entry.name, entry.initiatorType));
                });
                po.observe({ entryTypes: ['resource'] });
                this.performanceObserver = po;
            } catch (_) {}
        }
    }

    startLiveObserver() {
        if (this.observer || !document.documentElement) return;
        try {
            this.observer = new MutationObserver(() => {});
            this.observer.observe(document.documentElement, {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: ['src', 'srcset', 'style', ...this.lazyAttrs]
            });
        } catch (_) {}
    }

    tempShowHiddenElements() {
        this.hiddenElements = [];
        const hiddenSelectors = [
            'div[style*="display:none"]', 'div[style*="visibility:hidden"]',
            'div[style*="opacity:0"]', '.errorpage[style*="display:none"]',
            '[class*="hidden"]', '[hidden]'
        ];
        hiddenSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                const originalStyle = {
                    display: el.style.display, visibility: el.style.visibility, opacity: el.style.opacity,
                    position: el.style.position, top: el.style.top, left: el.style.left,
                    width: el.style.width, height: el.style.height, className: el.className
                };
                this.hiddenElements.push({ el, originalStyle });
                el.classList.add('temp-visible-for-scan');
                el.style.display = ''; el.style.visibility = ''; el.style.opacity = '';
            });
        });
    }

    restoreHiddenElements() {
        this.hiddenElements.forEach(({ el, originalStyle }) => {
            el.classList.remove('temp-visible-for-scan');
            el.style.display = originalStyle.display; el.style.visibility = originalStyle.visibility;
            el.style.opacity = originalStyle.opacity; el.style.position = originalStyle.position;
            el.style.top = originalStyle.top; el.style.left = originalStyle.left;
            el.style.width = originalStyle.width; el.style.height = originalStyle.height;
            el.className = originalStyle.className;
        });
        this.hiddenElements = [];
    }

    normalizeImageUrl(url) {
        if (!url || typeof url !== 'string') return '';
        const value = url.trim().replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
        if (!value || value === '#' || value.startsWith('data:')) return '';
        try { return new URL(value, window.location.href).href; } catch (_) { return ''; }
    }

    /** Resource Timing 明确标记为 img 的请求，即使 URL 没有图片扩展名也纳入。 */
    collectNetworkImages(processedUrls, imageItems) {
        try {
            performance.getEntriesByType('resource').forEach(entry => {
                if (entry.initiatorType !== 'img' && entry.initiatorType !== 'image') return;
                const url = this.normalizeImageUrl(entry.name);
                if (url) this.pendingNetworkImages.set(url, { url, initiatorType: entry.initiatorType, time: Date.now() });
            });
        } catch (_) {}
        for (const [url] of this.pendingNetworkImages) {
            if (processedUrls.has(url)) continue;
            const originalFormat = Utils.getFileExtension(url).toLowerCase();
            const originalName = ImageCollectorService.getImageName(url, '');
            processedUrls.add(url);
            imageItems.push({
                id: Utils.generateUniqueId(), url,
                name: Utils.truncateTo4Bytes(originalName),
                format: Utils.truncateTo4Bytes(originalFormat || CONFIG.image.defaultImageFormat),
                width: '网络资源', height: '网络资源', type: 'network-img', preview: url,
                originalName, originalFormat, svgContent: '', fileSize: '未知'
            });
        }
    }

    collectBasicImages() {
        const images = [];
        const seen = new Set();
        const push = (img, rawUrl, type = 'img-tag') => {
            const url = this.normalizeImageUrl(rawUrl);
            if (!url || url.startsWith('data:') || seen.has(url)) return;
            seen.add(url);
            const originalFormat = Utils.getFileExtension(url).toLowerCase();
            const originalName = img?.alt || ImageCollectorService.getImageName(url, '未命名图片');
            images.push({
                id: Utils.generateUniqueId(), url,
                name: Utils.truncateTo4Bytes(originalName),
                format: Utils.truncateTo4Bytes(originalFormat || CONFIG.image.defaultImageFormat),
                width: img?.naturalWidth || img?.width || '未知', height: img?.naturalHeight || img?.height || '未知',
                type, preview: url, element: img, originalName, originalFormat,
                svgContent: '', fileSize: '未知'
            });
        };
        document.querySelectorAll('img').forEach(img => {
            push(img, img.currentSrc || img.src || img.getAttribute('src'));
            this.lazyAttrs.forEach(attr => {
                const val = img.getAttribute(attr);
                if (!val) return;
                if (attr.includes('srcset')) this._parseSrcset(val).forEach(u => push(img, u, 'lazy-srcset'));
                else push(img, val, 'lazy-img');
            });
            if (img.srcset) this._parseSrcset(img.srcset).forEach(u => push(img, u, 'srcset'));
        });
        document.querySelectorAll('picture source, source[srcset]').forEach(source => {
            if (source.srcset) this._parseSrcset(source.srcset).forEach(u => push(source, u, 'source-srcset'));
            if (source.src) push(source, source.src, 'source');
        });
        const selector = this.lazyAttrs.map(a => `[${a}]`).join(',');
        if (selector) document.querySelectorAll(selector).forEach(el => {
            this.lazyAttrs.forEach(attr => {
                const val = el.getAttribute(attr);
                if (!val) return;
                if (attr.includes('srcset')) this._parseSrcset(val).forEach(u => push(el, u, 'lazy-srcset'));
                else push(el, val, 'lazy-attr');
            });
        });
        return images;
    }

    _parseSrcset(srcset) {
        if (!srcset) return [];
        return String(srcset).split(',').map(part => part.trim().split(/\s+/)[0]).filter(Boolean);
    }

    async collectImagesFromCss(cssUrl) {
        const imageUrls = [];
        try {
            const response = await fetch(cssUrl, { headers: { 'Accept': 'text/css,*/*;q=0.1' }, credentials: 'same-origin' });
            if (!response.ok) throw new Error(`CSS请求失败: ${response.status}`);
            const cssText = await response.text();
            const re = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
            let match;
            while ((match = re.exec(cssText)) !== null) {
                try { imageUrls.push(new URL(match[1], cssUrl).href); } catch (_) {}
            }
        } catch (e) { console.warn('采集CSS中的图片失败:', cssUrl, e); }
        return imageUrls;
    }

    async collectAllCssResources() {
        const cssUrls = [];
        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
            const href = link.getAttribute('href');
            if (href) try { cssUrls.push(new URL(href, window.location.href).href); } catch (_) {}
        });
        const inlineUrls = [];
        document.querySelectorAll('style').forEach(style => {
            const re = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
            let m;
            while ((m = re.exec(style.textContent || '')) !== null) {
                try { inlineUrls.push(new URL(m[1], window.location.href).href); } catch (_) {}
            }
        });
        const result = [...inlineUrls];
        for (const cssUrl of cssUrls) result.push(...await this.collectImagesFromCss(cssUrl));
        return [...new Set(result)];
    }

    async collectAllImages(imageSignatureMap) {
        this.startLiveObserver();
        this._installNetworkSniffer();
        const imageItems = [];
        const processedUrls = new Set();

        this.collectBasicImages().forEach(img => {
            if (!processedUrls.has(img.url)) { processedUrls.add(img.url); imageItems.push(img); }
        });

        // 关键增强：不要等页面高度变化才扫描；直接读取所有已完成的 img 网络请求。
        this.collectNetworkImages(processedUrls, imageItems);

        let cssImageUrls = [];
        try { cssImageUrls = await this.collectAllCssResources(); } catch (e) { console.warn('CSS图片采集异常:', e); }
        cssImageUrls.forEach(url => {
            const fullUrl = this.normalizeImageUrl(url);
            if (!fullUrl || processedUrls.has(fullUrl)) return;
            const originalFormat = Utils.getFileExtension(fullUrl).toLowerCase();
            const originalName = ImageCollectorService.getImageName(fullUrl, 'CSS图片');
            processedUrls.add(fullUrl);
            imageItems.push({
                id: Utils.generateUniqueId(), url: fullUrl,
                name: Utils.truncateTo4Bytes(originalName),
                format: Utils.truncateTo4Bytes(originalFormat || CONFIG.image.defaultImageFormat),
                width: 'CSS引用', height: 'CSS引用', type: 'CSS图片', preview: fullUrl,
                originalName, originalFormat, originalType: 'CSS图片', svgContent: '', fileSize: '未知'
            });
        });

        this.tempShowHiddenElements();
        try {
            for (const el of document.querySelectorAll('*')) {
                try {
                    const bgStyle = window.getComputedStyle(el).backgroundImage;
                    if (!bgStyle || bgStyle === 'none') continue;
                    const re = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
                    let match;
                    while ((match = re.exec(bgStyle)) !== null) {
                        const fullUrl = this.normalizeImageUrl(match[1]);
                        if (!fullUrl || processedUrls.has(fullUrl)) continue;
                        const originalFormat = Utils.getFileExtension(fullUrl).toLowerCase();
                        const originalName = `背景图-${el.tagName.toLowerCase()}-${Date.now().toString().slice(-4)}`;
                        processedUrls.add(fullUrl);
                        imageItems.push({
                            id: Utils.generateUniqueId(), url: fullUrl,
                            name: Utils.truncateTo4Bytes(originalName),
                            format: Utils.truncateTo4Bytes(originalFormat || CONFIG.image.defaultImageFormat),
                            width: '背景图', height: '背景图', type: '背景图', preview: fullUrl,
                            originalName, originalFormat, originalType: '背景图', svgContent: '', fileSize: '未知'
                        });
                    }
                } catch (_) {}
            }
            for (const svg of document.querySelectorAll('svg')) {
                try {
                    const svgContent = svg.outerHTML;
                    if (!svgContent || svgContent.length < 20) continue;
                    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
                    const svgUrl = BlobManager.createManagedBlobUrl(svgBlob);
                    const originalName = `SVG图片-${Date.now().toString().slice(-4)}`;
                    imageItems.push({
                        id: Utils.generateUniqueId(), url: svgUrl,
                        name: Utils.truncateTo4Bytes(originalName), format: 'svg',
                        width: svg.width?.baseVal?.value || '自适应', height: svg.height?.baseVal?.value || '自适应',
                        type: 'SVG标签', preview: svgUrl, svgContent,
                        originalName, originalFormat: 'svg', originalType: 'SVG标签', fileSize: '未知'
                    });
                } catch (_) {}
            }
        } finally { this.restoreHiddenElements(); }

        return await Deduplication.checkAndRemoveDuplicates(imageItems, imageSignatureMap);
    }

    static getFileExtension(url) {
        if (!url) return '';
        try {
            const u = new URL(url, window.location.href);
            const match = (u.pathname || '').match(/\.([a-z0-9]{1,8})$/i);
            if (match) return match[1];
            const filename = u.searchParams.get('filename') || u.searchParams.get('file') || u.searchParams.get('name') || '';
            const fm = filename.match(/\.([a-z0-9]{1,8})$/i);
            return fm ? fm[1] : '';
        } catch (_) {
            const match = String(url).match(/\.([a-z0-9]{1,8})(?:[?#]|$)/i);
            return match ? match[1] : '';
        }
    }

    static truncateTo4Bytes(str, maxLength = CONFIG.image.infoTruncateLength) {
        if (!str) return '';
        let result = '', byteLength = 0;
        for (let i = 0; i < str.length; i++) {
            const charCode = str.charCodeAt(i);
            const charByteLength = charCode <= 0x007f ? 1 : charCode <= 0x07ff ? 2 : 3;
            if (byteLength + charByteLength > maxLength) return result + '...';
            byteLength += charByteLength; result += str.charAt(i);
        }
        return result;
    }

    static getImageName(url, alt) {
        if (alt && alt.trim() !== '') return alt;
        try {
            const u = new URL(url, window.location.href);
            const filename = u.searchParams.get('filename') || u.searchParams.get('file') || u.searchParams.get('name');
            if (filename) return filename.replace(/\.[^.]+$/, '') || filename;
            const pathSegments = u.pathname.split('/').filter(Boolean);
            let name = pathSegments[pathSegments.length - 1] || '未命名图片';
            if (name.includes('.')) name = name.substring(0, name.lastIndexOf('.'));
            return decodeURIComponent(name) || '未命名图片';
        } catch (_) { return '未命名图片'; }
    }

    static ensureSvgNamespace(svgContent) {
        if (!svgContent.includes('xmlns="http://www.w3.org/2000/svg"')) return svgContent.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        return svgContent;
    }

    static completeImageSuffix(filename, format) {
        if (!filename) return `image.${format}`;
        if (filename.includes('.') && filename.split('.').pop().toLowerCase() === format.toLowerCase()) return filename;
        return `${filename}.${format}`;
    }

    static sanitizeFilename(filename) { return filename.replace(/[/\\?%*:|"<>]|\s/g, '_'); }
}

export const ImageCollector = new ImageCollectorService();
