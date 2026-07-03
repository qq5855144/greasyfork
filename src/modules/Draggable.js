/**
 * 拖拽模块
 * 负责 UI 元素的拖拽功能，支持位置记忆。
 */

import { CONFIG } from "../config.js";

class DraggableService {
    constructor() {
        this.container = null;
        this.onClickCallback = null;
        this.isDragging = false;
        this.hasMoved = false;
        this.startX = 0;
        this.startY = 0;
        this.startLeft = 0;
        this.startTop = 0;
        this.dragStartTime = 0;
        this.touchTimer = null;
    }

    /**
     * 初始化拖拽功能
     * @param {HTMLElement} container - 可拖拽的 DOM 元素
     * @param {Function} onClickCallback - 点击回调函数
     */
    init(container, onClickCallback) {
        this.container = container;
        this.onClickCallback = onClickCallback;

        container.addEventListener("mousedown", this._handleDragStart.bind(this));
        container.addEventListener("touchstart", this._handleDragStart.bind(this), { passive: false });
    }

    /**
     * 处理拖拽开始
     * @param {Event} e - 事件对象
     * @private
     */
    _handleDragStart(e) {
        // 避免点击徽章时触发拖拽
        if (e.target.closest && e.target.closest(".rainbow-fab-badge")) return;

        e.preventDefault();
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        const computedStyle = window.getComputedStyle(this.container);

        this.startLeft = parseInt(computedStyle.left) || 0;
        this.startTop = parseInt(computedStyle.top) || 0;

        // 如果是右侧定位，需要转换为 left
        if (computedStyle.right !== "auto") {
            const rightPos = parseInt(computedStyle.right);
            this.startLeft = window.innerWidth - rightPos - this.container.offsetWidth;
            this.container.style.right = "auto";
            this.container.style.left = `${this.startLeft}px`;
        }

        this.startX = clientX;
        this.startY = clientY;
        this.dragStartTime = Date.now();
        this.hasMoved = false;

        if (e.type === "touchstart") {
            this.touchTimer = setTimeout(() => {
                this.isDragging = true;
                this.container.style.transition = "none";
            }, CONFIG.ui.touchDelay);
        } else {
            this.isDragging = true;
            this.container.style.transition = "none";
        }

        document.addEventListener("mousemove", this._handleDragMove.bind(this));
        document.addEventListener("touchmove", this._handleDragMove.bind(this), { passive: false });
        document.addEventListener("mouseup", this._handleDragEnd.bind(this));
        document.addEventListener("touchend", this._handleDragEnd.bind(this));
    }

    /**
     * 处理拖拽移动
     * @param {Event} e - 事件对象
     * @private
     */
    _handleDragMove(e) {
        if (!this.isDragging) return;

        this.hasMoved = true;
        e.preventDefault();

        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;

        const newLeft = this.startLeft + clientX - this.startX;
        const newTop = this.startTop + clientY - this.startY;

        this.container.style.left = `${newLeft}px`;
        this.container.style.top = `${newTop}px`;
        this.container.style.right = "auto"; // 确保 right 属性被清除
        this.container.style.bottom = "auto"; // 确保 bottom 属性被清除
    }

    /**
     * 处理拖拽结束
     * @param {Event} e - 事件对象
     * @private
     */
    _handleDragEnd(e) {
        if (this.touchTimer) {
            clearTimeout(this.touchTimer);
            this.touchTimer = null;
        }

        if (!this.isDragging) {
            // 如果没有开始拖拽，但触摸时间短于延迟，则视为点击
            if (Date.now() - this.dragStartTime < CONFIG.ui.touchDelay) {
                this.onClickCallback();
            }
            return;
        }

        // 如果没有移动，视为点击
        if (!this.hasMoved) {
            this.onClickCallback();
        } else {
            // 保存位置
            this._savePosition();
        }

        this.isDragging = false;
        this.container.style.transition = ""; // 恢复过渡效果

        document.removeEventListener("mousemove", this._handleDragMove.bind(this));
        document.removeEventListener("touchmove", this._handleDragMove.bind(this));
        document.removeEventListener("mouseup", this._handleDragEnd.bind(this));
        document.removeEventListener("touchend", this._handleDragEnd.bind(this));
    }

    /**
     * 保存按钮位置到本地存储
     * @private
     */
    _savePosition() {
        const domain = location.hostname.replace(/\./g, "-");
        const positionKey = `${CONFIG.storage.prefix}${CONFIG.storage.positionKey}_${domain}`;
        const rect = this.container.getBoundingClientRect();
        GM_setValue(positionKey, { x: rect.left, y: rect.top });
    }

    /**
     * 恢复保存的位置
     */
    restorePosition() {
        const domain = location.hostname.replace(/\./g, "-");
        const positionKey = `${CONFIG.storage.prefix}${CONFIG.storage.positionKey}_${domain}`;
        const savedPosition = GM_getValue(positionKey);

        if (savedPosition) {
            this.container.style.left = `${savedPosition.x}px`;
            this.container.style.top = `${savedPosition.y}px`;
            this.container.style.right = "auto";
            this.container.style.bottom = "auto";
        } else {
            // 默认位置：右下角
            this.container.style.right = `${CONFIG.ui.positionOffset}px`;
            this.container.style.bottom = `${CONFIG.ui.positionOffset}px`;
            this.container.style.left = "auto";
            this.container.style.top = "auto";
        }
    }
}

export const Draggable = new DraggableService();
