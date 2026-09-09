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
        ];
    }

    init(appDetectNewImagesCallback) {
        this.appDetectNewImagesCallback = appDetectNewImagesCallback;
        window.addEventListener("scroll", this.boundScroll, { passive: true });
        document.addEventListener("click", this.boundClick, true);
        this.lastScrollHeight = document.documentElement.scrollHeight;

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
                subtree: true, childList: true, attributes: true,
                attributeFilter: this.lazyAttrs
            });
        } catch (_) {}

        this._scheduleDetect(500);
    }

    _scheduleDetect(delay = CONFIG.ui.scrollCheckInterval) {
        clearTimeout(this.scanTimer);
        this.scanTimer = setTimeout(async () => {
            if (!this.appDetectNewImagesCallback) return;
            try { await this.appDetectNewImagesCallback(); }
            catch (e) { console.warn('动态图片检测失败:', e); }
        }, delay);
    }

    async _handleScroll() {
        clearTimeout(this.scrollTimer);
        this.scrollTimer = setTimeout(async () => {
            const currentScrollHeight = document.documentElement.scrollHeight;
            // 关键修复：不再要求 scrollHeight 增长。
            // 图片懒加载、虚拟列表和轮播组件经常在页面高度不变时替换 src。
            this._scheduleDetect(80);
            this.lastScrollHeight = currentScrollHeight;
        }, Math.min(CONFIG.ui.scrollCheckInterval || 300, 250));
    }

    _handleClick(e) {
        const target = e.target && e.target.closest ? e.target : null;
        if (target && (target.closest("#rainbowFabContainer") || target.closest("#svgSnifferModal"))) return;
        const isLoadButton = CONFIG.clickDetection.selectors.some(selector => target && target.closest(selector));
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
