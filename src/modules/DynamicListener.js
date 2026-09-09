/**
 * 动态监听模块
 * 增强：滚动不再依赖页面高度变化；同时监听 DOM 动态插入/懒加载属性变化。
 */

import { CONFIG } from "../config.js";

class DynamicListenerService {
    constructor() {
        this.scrollTimer = null;
        this.scanTimer = null;
        this.lastScrollHeight = document.documentElement.scrollHeight;
        this.isClickDetecting = false;
        this.appDetectNewImagesCallback = null;
        this.mutationObserver = null;
        this.boundScroll = this._handleScroll.bind(this);
        this.boundClick = this._handleClick.bind(this);
        this.lazyAttrs = [
            'src', 'srcset', 'data-src', 'data-original', 'data-lazy-src', 'data-srcset',
            'data-url', 'data-full', 'data-real-src', 'data-image', 'data-img', 'data-highres',
            'data-original-src', 'style'
        ];n    }

    init(appDetectNewImagesCallback) {
        this.appDetectNewImagesCallback = appDetectNewImagesCallback;
        window.addEventListener("scroll", this.boundScroll, { passive: true });
        document.addEventListener("click", this.boundClick, true);
        this.lastScrollHeight = document.documentElement.scrollHeight;

        // 监听无限滚动/虚拟列表：很多网站替换 src，而页面总高度并不会变化。
        try {
            this.mutationObserver = new MutationObserver(mutations => {
                let relevant = false;
                for (const m of mutations) {
                    if (m.type === 'childList' && m.addedNodes.length) { relevant = true; break; }
                    if (m.type === 'attributes' && this.lazyAttrs.includes(m.attributeName)) { relevant = true; break; }
                }
                if (relevant) this._scheduleDetect(180);
            });
            this.mutationObserver.observe(document.documentElement, {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: this.lazyAttrs
            });
        } catch (_) {}

        // 处理脚本初始化后才开始加载的图片。
        this._scheduleDetect(500);
    }

    _scheduleDetect(delay = CONFIG.ui.scrollCheckInterval) {
        clearTimeout(this.scanTimer);
        this.scanTimer = setTimeout(async () => {
            if (!this.appDetectNewImagesCallback) return;
            try { await this.appDetectNewImagesCallback(); } catch (e) { console.warn('动态图片检测失败:', e); }
        }, delay);
    }

    async _handleScroll() {
        clearTimeout(this.scrollTimer);
        this.scrollTimer = setTimeout(async () => {
            const currentScrollHeight = document.documentElement.scrollHeight;
            // 不再要求 scrollHeight 增长：懒加载、虚拟列表经常高度不变。
            this._scheduleDetect(80);
            this.lastScrollHeight = currentScrollHeight;
        }, Math.min(CONFIG.ui.scrollCheckInterval || 300, 250));
    }

    _handleClick(e) {
        if (e.target.closest("#rainbowFabContainer") || e.target.closest("#svgSnifferModal")) return;
        const isLoadButton = CONFIG.clickDetection.selectors.some(selector => e.target.closest(selector));
        if (isLoadButton && !this.isClickDetecting) {
            this.isClickDetecting = true;
            setTimeout(async () => {
                try {
                    if (this.appDetectNewImagesCallback) await this.appDetectNewImagesCallback();
                } finally { this.isClickDetecting = false; }
            }, CONFIG.ui.clickDetectDelay);
        }
    }

    destroy() {
        window.removeEventListener("scroll", this.boundScroll);
        document.removeEventListener("click", this.boundClick, true);
        clearTimeout(this.scrollTimer);
        clearTimeout(this.scanTimer);
        if (this.mutationObserver) {
            try { this.mutationObserver.disconnect(); } catch (_) {}
            this.mutationObserver = null;
        }
    }
}

export const DynamicListener = new DynamicListenerService();
