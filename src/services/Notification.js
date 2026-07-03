/**
 * 通知模块
 * 负责在页面上显示临时通知
 */

import { CONFIG } from "../config.js";

class NotificationService {
    constructor() {
        this.element = null;
        this.init();
    }

    init() {
        if (!this.element) {
            this.element = document.createElement("div");
            this.element.className = "copy-notification";
            document.body.appendChild(this.element);
        }
    }

    /**
     * 显示通知
     * @param {string} message - 通知消息
     * @param {('info'|'success'|'warning'|'error')} type - 通知类型
     */
    show(message, type = "info") {
        const colors = CONFIG.notification.colors;
        this.element.textContent = message;
        this.element.style.backgroundColor = colors[type] || colors.info;
        this.element.style.opacity = "1";
        setTimeout(() => {
            this.element.style.opacity = "0";
        }, CONFIG.notification.duration);
    }

    /**
     * 销毁通知元素
     */
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
            this.element = null;
        }
    }
}

export const Notification = new NotificationService();
