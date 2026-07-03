/**
 * 图片采集模块
 * 负责从页面中收集图片资源，包括 img 标签、CSS 背景图、动态加载的图片等。
 */

import { CONFIG } from "../config.js";
import { Utils } from "../utils/index.js";
import { BlobManager } from "../services/BlobManager.js";
import { Deduplication } from "./Deduplication.js";

class ImageCollectorService {
    constructor() {
        this.hiddenElements = [];
    }

    /**
     * 临时显示隐藏元素，以便采集其中的图片
     */
    tempShowHiddenElements() {
        this.hiddenElements = [];
        const hiddenSelectors = [
            'div[style*="display:none"]',
            'div[style*="visibility:hidden"]',
            'div[style*="opacity:0"]',
            '.errorpage[style*="display:none"]',
            '[class*="hidden"]',
            '[hidden]'
        ];
        hiddenSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                const originalStyle = {
                    display: el.style.display,
                    visibility: el.style.visibility,
                    opacity: el.style.opacity,
                    position: el.style.position,
                    top: el.style.top,
                    left: el.style.left,
                    width: el.style.width,
                    height: el.style.height,
                    className: el.className
                };
                this.hiddenElements.push({ el, originalStyle });
                el.classList.add('temp-visible-for-scan');
                el.style.display = '';
                el.style.visibility = '';
                el.style.opacity = '';
            });
        });
    }

    /**
     * 恢复之前隐藏的元素
     */
    restoreHiddenElements() {
        this.hiddenElements.forEach(({ el, originalStyle }) => {
            el.classList.remove('temp-visible-for-scan');
            el.style.display = originalStyle.display;
            el.style.visibility = originalStyle.visibility;
            el.style.opacity = originalStyle.opacity;
            el.style.position = originalStyle.position;
            el.style.top = originalStyle.top;
            el.style.left = originalStyle.left;
            el.style.width = originalStyle.width;
            el.style.height = originalStyle.height;
            el.className = originalStyle.className;
        });
        this.hiddenElements = [];
    }

    /**
     * 收集基本的 img 标签图片
     * @returns {Array<Object>} 图片信息数组
     */
    collectBasicImages() {
        const images = [];
        document.querySelectorAll('img').forEach((img, index) => {
            const src = img.src || img.dataset.src || img.currentSrc;
            if (src && !src.startsWith('data:')) {
                const originalFormat = Utils.getFileExtension(src).toLowerCase();
                images.push({
                    id: Utils.generateUniqueId(),
                    url: src,
                    name: Utils.truncateTo4Bytes(img.alt || '未命名图片'),
                    format: Utils.truncateTo4Bytes(originalFormat || CONFIG.image.defaultImageFormat),
                    width: img.naturalWidth || img.width || '未知',
                    height: img.naturalHeight || img.height || '未知',
                    type: 'img-tag',
                    preview: src,
                    element: img,
                    originalName: img.alt || '未命名图片',
                    originalFormat: originalFormat,
                    svgContent: '',
                    fileSize: '未知'
                });
            }
        });
        return images;
    }

    /**
     * 从 CSS 文件中收集图片 URL
     * @param {string} cssUrl - CSS 文件的 URL
     * @returns {Promise<Array<string>>} 图片 URL 数组
     */
    async collectImagesFromCss(cssUrl) {
        const imageUrls = [];
        try {
            const response = await fetch(cssUrl, {
                headers: { 'Accept': 'text/css,*/*;q=0.1' },
                credentials: 'same-origin'
            });
            if (!response.ok) throw new Error(`CSS请求失败: ${response.status}`);
            const cssText = await response.text();
            const bgUrlRegex = /url\(["']?([^"']+)["']?\)/gi; // 匹配所有 url() 格式
            let match;
            while ((match = bgUrlRegex.exec(cssText)) !== null) {
                if (match[1]) {
                    const fullUrl = new URL(match[1], cssUrl).href;
                    const ext = Utils.getFileExtension(fullUrl).toLowerCase();
                    if (CONFIG.image.supportFormats.includes(ext)) imageUrls.push(fullUrl);
                }
            }
        } catch (e) {
            console.warn('采集CSS中的图片失败:', cssUrl, e);
        }
        return imageUrls;
    }

    /**
     * 收集所有 CSS 资源中的图片 URL
     * @returns {Promise<Array<string>>} 所有 CSS 图片 URL 数组
     */
    async collectAllCssResources() {
        const cssUrls = [];
        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
            const href = link.getAttribute('href');
            if (href) cssUrls.push(new URL(href, window.location.href).href);
        });
        document.querySelectorAll('style').forEach(style => {
            const bgUrlRegex = /url\(["']?([^"']+)["']?\)/gi;
            let match;
            while ((match = bgUrlRegex.exec(style.textContent)) !== null) {
                if (match[1]) {
                    const fullUrl = new URL(match[1], window.location.href).href;
                    const ext = Utils.getFileExtension(fullUrl).toLowerCase();
                    if (CONFIG.image.supportFormats.includes(ext)) cssUrls.push(`inline:${fullUrl}`);
                }
            }
        });
        const allImageUrls = [];
        for (const cssUrl of cssUrls) {
            if (cssUrl.startsWith('inline:')) {
                allImageUrls.push(cssUrl.replace('inline:', ''));
            } else {
                const images = await this.collectImagesFromCss(cssUrl);
                allImageUrls.push(...images);
            }
        }
        return allImageUrls;
    }

    /**
     * 收集页面上所有图片资源
     * @param {Map<string, string>} imageSignatureMap - 用于去重的图片签名 Map
     * @returns {Promise<Array<Object>>} 收集到的图片信息数组
     */
    async collectAllImages(imageSignatureMap) {
        const imageItems = [];
        const processedUrls = new Set();

        // 基础 img 标签
        this.collectBasicImages().forEach(img => {
            if (!processedUrls.has(img.url)) {
                processedUrls.add(img.url);
                imageItems.push(img);
            }
        });

        // CSS 资源
        let cssImageUrls = [];
        try { cssImageUrls = await this.collectAllCssResources(); } catch (e) {
            console.warn('CSS图片采集异常:', e);
        }

        this.tempShowHiddenElements();
        try {
            // 动态 img 标签
            for (const img of document.querySelectorAll('img')) {
                try {
                    let imgUrl = img.src || img.dataset.src || img.dataset.original || img.currentSrc;
                    if (!imgUrl || processedUrls.has(imgUrl) || imgUrl.startsWith('data:')) continue;
                    const fullUrl = new URL(imgUrl, window.location.href).href;
                    const originalFormat = Utils.getFileExtension(fullUrl).toLowerCase();
                    if (!CONFIG.image.supportFormats.includes(originalFormat) && originalFormat) continue;
                    if (processedUrls.has(fullUrl)) continue;

                    const originalName = Utils.getImageName(fullUrl, img.alt);
                    let svgContent = '';
                    if (originalFormat === 'svg') {
                        try {
                            const svgResponse = await fetch(fullUrl);
                            if (svgResponse.ok) svgContent = await svgResponse.text();
                        } catch (svgErr) { /* ignore */ }
                    }

                    const imgInfo = await new Promise((resolve) => {
                        const timer = setTimeout(() => resolve({
                            id: Utils.generateUniqueId(),
                            url: fullUrl, name: Utils.truncateTo4Bytes(originalName),
                            format: Utils.truncateTo4Bytes(originalFormat || CONFIG.image.defaultImageFormat),
                            width: img.width || '未知', height: img.height || '未知',
                            type: 'img-tag', preview: fullUrl,
                            originalName, originalFormat, svgContent, fileSize: '未知'
                        }), CONFIG.image.loadTimeout);
                        if (img.complete) {
                            clearTimeout(timer);
                            resolve({
                                id: Utils.generateUniqueId(),
                                url: fullUrl, name: Utils.truncateTo4Bytes(originalName),
                                format: Utils.truncateTo4Bytes(originalFormat || CONFIG.image.defaultImageFormat),
                                width: img.naturalWidth || img.width || '未知',
                                height: img.naturalHeight || img.height || '未知',
                                type: 'img-tag', preview: fullUrl,
                                originalName, originalFormat, svgContent, fileSize: '未知'
                            });
                        } else {
                            img.onload = () => {
                                clearTimeout(timer);
                                resolve({
                                    id: Utils.generateUniqueId(),
                                    url: fullUrl, name: Utils.truncateTo4Bytes(originalName),
                                    format: Utils.truncateTo4Bytes(originalFormat || CONFIG.image.defaultImageFormat),
                                    width: img.naturalWidth || img.width || '未知',
                                    height: img.naturalHeight || img.height || '未知',
                                    type: 'img-tag', preview: fullUrl,
                                    originalName, originalFormat, svgContent, fileSize: '未知'
                                });
                            };
                            img.onerror = () => { clearTimeout(timer); resolve(null); };
                        }
                    });
                    if (imgInfo) { processedUrls.add(imgUrl); imageItems.push(imgInfo); }
                } catch (e) { console.warn('采集<img>标签失败:', e); }
            }

            // 背景图
            for (const el of document.querySelectorAll('*')) {
                try {
                    const bgStyle = window.getComputedStyle(el).backgroundImage;
                    if (!bgStyle || bgStyle === 'none' || processedUrls.has(bgStyle)) continue;
                    const bgUrls = bgStyle.match(/url\(["']?([^"']+)["']?\)/g);
                    if (!bgUrls) continue;
                    for (const bgUrl of bgUrls) {
                        const match = bgUrl.match(/url\(["']?([^"']+)["']?\)/);
                        if (!match || !match[1]) continue;
                        let imgUrl = match[1];
                        if (processedUrls.has(imgUrl)) continue;
                        const fullUrl = new URL(imgUrl, window.location.href).href;
                        const originalFormat = Utils.getFileExtension(fullUrl).toLowerCase();
                        let svgContent = '';
                        if (originalFormat === 'svg') {
                            try {
                                const svgResponse = await fetch(fullUrl);
                                if (svgResponse.ok) svgContent = await svgResponse.text();
                            } catch (svgErr) { /* ignore */ }
                        }
                        const originalName = `背景图-${el.tagName.toLowerCase()}-${Date.now().toString().slice(-4)}`;
                        imageItems.push({
                            id: Utils.generateUniqueId(),
                            url: fullUrl, name: Utils.truncateTo4Bytes(originalName),
                            format: Utils.truncateTo4Bytes(originalFormat || CONFIG.image.defaultImageFormat),
                            width: '背景图', height: '背景图',
                            type: '背景图',
                            preview: fullUrl, originalName, originalFormat,
                            originalType: '背景图', svgContent, fileSize: '未知'
                        });
                        processedUrls.add(imgUrl);
                    }
                } catch (e) { /* ignore */ }
            }

            // CSS图片
            for (const imgUrl of cssImageUrls) {
                try {
                    if (!imgUrl || processedUrls.has(imgUrl)) continue;
                    const fullUrl = new URL(imgUrl, window.location.href).href;
                    const originalFormat = Utils.getFileExtension(fullUrl).toLowerCase();
                    let svgContent = '';
                    if (originalFormat === 'svg') {
                        try {
                            const svgResponse = await fetch(fullUrl);
                            if (svgResponse.ok) svgContent = await svgResponse.text();
                        } catch (svgErr) { /* ignore */ }
                    }
                    const originalName = `CSS图片-${Date.now().toString().slice(-4)}`;
                    imageItems.push({
                        id: Utils.generateUniqueId(),
                        url: fullUrl, name: Utils.truncateTo4Bytes(originalName),
                        format: Utils.truncateTo4Bytes(originalFormat || CONFIG.image.defaultImageFormat),
                        width: 'CSS引用', height: 'CSS引用',
                        type: 'CSS图片',
                        preview: fullUrl, originalName, originalFormat,
                        originalType: 'CSS图片', svgContent, fileSize: '未知'
                    });
                    processedUrls.add(imgUrl);
                } catch (e) { /* ignore */ }
            }

            // SVG 标签
            for (const svg of document.querySelectorAll('svg')) {
                try {
                    const svgContent = svg.outerHTML;
                    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
                    const svgUrl = BlobManager.createManagedBlobUrl(svgBlob);
                    const originalName = `SVG图片-${Date.now().toString().slice(-4)}`;
                    imageItems.push({
                        id: Utils.generateUniqueId(),
                        url: svgUrl, name: Utils.truncateTo4Bytes(originalName),
                        format: Utils.truncateTo4Bytes('svg'),
                        width: svg.naturalWidth || svg.width.baseVal.value || '自适应',
                        height: svg.naturalHeight || svg.height.baseVal.value || '自适应',
                        type: 'SVG标签',
                        preview: svgUrl, svgContent,
                        originalName, originalFormat: 'svg',
                        originalType: 'SVG标签', fileSize: '未知'
                    });
                } catch (e) { /* ignore */ }
            }
        } finally {
            this.restoreHiddenElements();
        }

        return await Deduplication.checkAndRemoveDuplicates(imageItems, imageSignatureMap);
    }

    /**
     * 辅助函数：从 URL 获取文件扩展名
     * @param {string} url - 图片 URL
     * @returns {string} 文件扩展名
     */
    static getFileExtension(url) {
        const parts = url.split('.');
        if (parts.length > 1) {
            return parts.pop().split('?')[0].split('#')[0];
        }
        return '';
    }

    /**
     * 辅助函数：截断字符串到指定字节长度 (UTF-8)
     * @param {string} str - 原始字符串
     * @param {number} maxLength - 最大字节长度
     * @returns {string} 截断后的字符串
     */
    static truncateTo4Bytes(str, maxLength = CONFIG.image.infoTruncateLength) {
        if (!str) return '';
        let result = '';
        let byteLength = 0;
        for (let i = 0; i < str.length; i++) {
            const charCode = str.charCodeAt(i);
            let charByteLength;
            if (charCode <= 0x007f) {
                charByteLength = 1;
            } else if (charCode <= 0x07ff) {
                charByteLength = 2;
            } else if (charCode <= 0xffff) {
                charByteLength = 3;
            } else {
                charByteLength = 4;
            }

            if (byteLength + charByteLength > maxLength) {
                return result + '...';
            }
            byteLength += charByteLength;
            result += str.charAt(i);
        }
        return result;
    }

    /**
     * 辅助函数：从 URL 获取图片名称
     * @param {string} url - 图片 URL
     * @param {string} alt - 图片 alt 属性
     * @returns {string} 图片名称
     */
    static getImageName(url, alt) {
        if (alt && alt.trim() !== '') return alt;
        try {
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/');
            let name = pathSegments[pathSegments.length - 1];
            if (name.includes('.')) {
                name = name.substring(0, name.lastIndexOf('.'));
            }
            return name || '未命名图片';
        } catch (e) {
            return '未命名图片';
        }
    }

    /**
     * 辅助函数：确保 SVG 包含 xmlns 属性
     * @param {string} svgContent - SVG 字符串
     * @returns {string} 包含 xmlns 的 SVG 字符串
     */
    static ensureSvgNamespace(svgContent) {
        if (!svgContent.includes('xmlns="http://www.w3.org/2000/svg"')) {
            return svgContent.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        return svgContent;
    }

    /**
     * 辅助函数：补全图片后缀
     * @param {string} filename - 文件名
     * @param {string} format - 格式
     * @returns {string} 补全后缀的文件名
     */
    static completeImageSuffix(filename, format) {
        if (!filename) return `image.${format}`;
        if (filename.includes('.') && filename.split('.').pop().toLowerCase() === format.toLowerCase()) {
            return filename;
        }
        return `${filename}.${format}`;
    }

    /**
     * 辅助函数：清理文件名，移除非法字符
     * @param {string} filename - 原始文件名
     * @returns {string} 清理后的文件名
     */
    static sanitizeFilename(filename) {
        return filename.replace(/[/\\?%*:|"<>]|\s/g, '_');
    }
}

export const ImageCollector = new ImageCollectorService();
