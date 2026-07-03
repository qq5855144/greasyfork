/**
 * 动态监听模块
 * 负责监听页面的滚动和点击事件，触发图片重新扫描。
 */

import { CONFIG } from "../config.js";

class DynamicListenerService {
    constructor() {
        this.scrollTimer = null;
        this.lastScrollHeight = document.documentElement.scrollHeight;
        this.isClickDetecting = false;
        this.appDetectNewImagesCallback = null; // 用于外部注入 App.detectNewImages
    }

    /**
     * 初始化事件监听器
     * @param {Function} appDetectNewImagesCallback - App 模块的 detectNewImages 方法
     */
    init(appDetectNewImagesCallback) {
        this.appDetectNewImagesCallback = appDetectNewImagesCallback;
        window.addEventListener("scroll", this._handleScroll.bind(this), { passive: true });
        document.addEventListener("click", this._handleClick.bind(this), true);
        this.lastScrollHeight = document.documentElement.scrollHeight;
    }

    /**
     * 处理滚动事件
     * @private
     */
    async _handleScroll() {
        clearTimeout(this.scrollTimer);
        this.scrollTimer = setTimeout(async () => {
            const currentScrollHeight = document.documentElement.scrollHeight;
            if (currentScrollHeight > this.lastScrollHeight) {
                if (this.appDetectNewImagesCallback) {
                    await this.appDetectNewImagesCallback();
                }
            }
            this.lastScrollHeight = currentScrollHeight; // 更新上一次的滚动高度
        }, CONFIG.ui.scrollCheckInterval);
    }

    /**
     * 处理点击事件
     * @param {Event} e - 点击事件对象
     * @private
     */
    _handleClick(e) {
        // 避免点击浮动按钮或模态框内部时触发
        if (e.target.closest("#rainbowFabContainer") || e.target.closest("#svgSnifferModal")) return;

        const isLoadButton = CONFIG.clickDetection.selectors.some(selector => e.target.closest(selector));
        if (isLoadButton && !this.isClickDetecting) {
            this.isClickDetecting = true;
            setTimeout(async () => {
                try {
                    if (this.appDetectNewImagesCallback) {
                        await this.appDetectNewImagesCallback();
                    }
                } finally {
                    this.isClickDetecting = false;
                }
            }, CONFIG.ui.clickDetectDelay);
        }
    }

    /**
     * 销毁事件监听器
     */
    destroy() {
        window.removeEventListener("scroll", this._handleScroll);
        document.removeEventListener("click", this._handleClick, true);
        clearTimeout(this.scrollTimer);
        // Draggable.touchTimer 在 Draggable 模块中管理
    }
}

export const DynamicListener = new DynamicListenerService();
