/**
 * DOM 构建模块
 * 负责创建和管理所有 UI 元素的 DOM 结构。
 */

import { CONFIG } from "../config.js";
import { Icons } from "../icons.js";
import { Styles } from "../styles.js";
import { Utils } from "../utils/index.js";

class DOMBuilderService {
    constructor() {
        this.modal = null;
        this.previewModal = null;
        this.batchProgressOverlay = null;
    }

    /**
     * 创建浮动按钮
     * @returns {{container: HTMLElement, fab: HTMLElement, icon: HTMLElement, badge: HTMLElement}}
     */
    createFabButton() {
        const container = document.createElement("div");
        container.id = "rainbowFabContainer";
        container.className = "rainbow-fab-container";

        const fab = document.createElement("button");
        fab.className = "rainbow-fab";
        fab.title = "网页图片采集器";

        const fabInner = document.createElement("div");
        fabInner.className = "rainbow-fab-inner";

        const icon = document.createElement("div");
        icon.className = "rainbow-fab-icon";
        icon.innerHTML = Icons.camera; // 使用相机图标

        const badge = document.createElement("span");
        badge.className = "rainbow-fab-badge";
        badge.textContent = "0";
        badge.style.display = "none";

        fabInner.appendChild(icon);
        fab.appendChild(fabInner);
        fab.appendChild(badge);
        container.appendChild(fab);
        document.body.appendChild(container);

        // 注入样式
        GM_addStyle(Styles.fabStyles);

        return { container, fab, icon, badge };
    }

    /**
     * 创建主模态框
     * @returns {HTMLElement}
     */
    createMainModal() {
        if (this.modal) return this.modal;

        const modal = document.createElement("div");
        modal.id = "svgSnifferModal";
        modal.className = "svg-sniffer-modal";
        modal.innerHTML = `
            <div class="modal-header">
                <h2>${Icons.camera} 网页图片采集器 Pro</h2>
                <button class="close-btn" title="关闭">${Icons.close}</button>
            </div>
            <div class="action-bar">
                <div class="select-all-control">
                    <input type="checkbox" id="selectAll">
                    <label for="selectAll">全选</label>
                    <span id="imageCount">0</span> 张图片
                </div>
                <div class="action-buttons">
                    <button class="action-btn batch-download-btn" id="batchDownloadBtn" title="批量下载">${Icons.download} 批量下载</button>
                    <button class="action-btn copy-btn" id="batchCopyBtn" title="复制所有选中图片链接">${Icons.copy} 复制链接</button>
                    <button class="action-btn invert-select-btn" id="invertSelectBtn" title="反选">${Icons.invert}</button>
                    <div class="batch-mode-toggle">
                        <button id="batchModeZip" class="toggle-btn active" title="打包为ZIP">ZIP</button>
                        <button id="batchModeSingle" class="toggle-btn" title="单文件下载">单文件</button>
                    </div>
                </div>
            </div>
            <div class="search-bar">
                <div class="search-input-wrapper">
                    ${Icons.search}
                    <input type="text" id="searchInput" placeholder="搜索图片名称或URL...">
                </div>
                <select id="sortSelect" title="排序方式">
                    <option value="default">默认排序</option>
                    <option value="name-asc">名称升序</option>
                    <option value="name-desc">名称降序</option>
                    <option value="format">按格式</option>
                    <option value="type">按类型</option>
                </select>
                <select id="formatFilter" title="格式筛选">
                    <option value="all">所有格式</option>
                    ${CONFIG.image.supportFormats.map(f => `<option value="${f}">${f.toUpperCase()}</option>`).join("")}
                </select>
                <div class="view-toggle">
                    <button id="listViewBtn" class="toggle-btn active" title="列表视图">${Icons.list}</button>
                    <button id="gridViewBtn" class="toggle-btn" title="网格视图">${Icons.grid}</button>
                </div>
                <div class="dedupe-toggle">
                    <input type="checkbox" id="dedupeToggle" ${CONFIG.deduplication.enabled ? "checked" : ""}>
                    <label for="dedupeToggle" title="智能去重">${Icons.dedupe}</label>
                </div>
            </div>
            <div class="modal-content">
                <div id="svgList" class="image-list"></div>
            </div>
        `;
        document.body.appendChild(modal);
        this.modal = modal;

        // 注入样式
        GM_addStyle(Styles.modalStyles);
        GM_addStyle(Styles.actionBarStyles);
        GM_addStyle(Styles.searchBarStyles);
        GM_addStyle(Styles.imageListStyles);

        return modal;
    }

    /**
     * 创建图片预览模态框
     * @returns {HTMLElement}
     */
    createPreviewModal() {
        if (this.previewModal) return this.previewModal;

        const modal = document.createElement("div");
        modal.id = "imagePreviewModal";
        modal.className = "image-preview-modal";
        modal.innerHTML = `
            <div class="preview-header">
                <div class="preview-info">
                    <span id="previewTitle" class="preview-title"></span>
                    <span id="previewSubtitle" class="preview-subtitle"></span>
                </div>
                <button id="previewClose" class="close-btn" title="关闭">${Icons.close}</button>
            </div>
            <div class="preview-stage" id="previewStage">
                <div class="preview-img-wrapper" id="previewImgWrapper"></div>
                <div class="preview-nav prev" id="previewPrev" title="上一张">${Icons.arrowLeft}</div>
                <div class="preview-nav next" id="previewNext" title="下一张">${Icons.arrowRight}</div>
                <div class="preview-zoom-indicator" id="previewZoomIndicator"></div>
            </div>
            <div class="preview-footer">
                <div class="preview-toolbar">
                    <button id="previewZoomOut" title="缩小">${Icons.zoomOut}</button>
                    <button id="previewZoomIn" title="放大">${Icons.zoomIn}</button>
                    <button id="previewRotate" title="旋转">${Icons.rotate}</button>
                    <button id="previewReset" title="重置">${Icons.reset}</button>
                </div>
                <div class="preview-meta">
                    <span id="previewInfoFormat">-</span>
                    <span id="previewInfoSize">-</span>
                    <span id="previewInfoFilesize">-</span>
                    <span id="previewCounter">1 / 1</span>
                </div>
                <div class="preview-actions">
                    <button id="previewDownload" class="action-btn" title="下载">${Icons.download} 下载</button>
                    <button id="previewCopy" class="action-btn" title="复制链接">${Icons.copy} 复制</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.previewModal = modal;

        // 注入样式
        GM_addStyle(Styles.previewModalStyles);

        return modal;
    }

    /**
     * 创建批量下载进度覆盖层
     * @returns {HTMLElement}
     */
    createBatchProgressOverlay() {
        if (this.batchProgressOverlay) return this.batchProgressOverlay;

        const overlay = document.createElement("div");
        overlay.id = "batchProgressOverlay";
        overlay.className = "batch-progress-overlay";
        overlay.innerHTML = `
            <div class="progress-card">
                <h3>${Icons.download} 批量下载进度</h3>
                <div class="progress-bar-container">
                    <div class="progress-bar" id="batchProgressBar"></div>
                </div>
                <p>已完成: <span id="batchProgressCurrent">0</span> / <span id="batchProgressTotal">0</span></p>
                <p>成功: <span id="batchProgressOk" style="color: #28a745;">0</span> 失败: <span id="batchProgressFail" style="color: #dc3545;">0</span></p>
                <p id="batchProgressStatus">正在准备...</p>
                <button id="batchProgressCancel" class="action-btn cancel-btn">取消下载</button>
            </div>
        `;
        document.body.appendChild(overlay);
        this.batchProgressOverlay = overlay;

        // 注入样式
        GM_addStyle(Styles.batchProgressStyles);

        return overlay;
    }

    /**
     * 创建全局覆盖层 (用于模态框背景)
     * @returns {HTMLElement}
     */
    createOverlay() {
        const overlay = document.createElement("div");
        overlay.className = "rainbow-overlay";
        document.body.appendChild(overlay);

        // 注入样式
        GM_addStyle(Styles.overlayStyles);

        return overlay;
    }

    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string}
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }
}

export const DOMBuilder = new DOMBuilderService();
