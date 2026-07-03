/**
 * UI 渲染模块
 * 负责渲染图片列表、处理筛选和排序，以及生成图片项的 DOM 结构。
 */

import { CONFIG } from "../config.js";
import { Utils } from "../utils/index.js";
import { Icons } from "../icons.js";
import { PreviewModal } from "./PreviewModal.js";

class UIRendererService {
    constructor() {
        this.imageItemCache = new Map(); // 用于存储图片项的完整信息
    }

    /**
     * 渲染图片列表
     * @param {Array<Object>} items - 要渲染的图片项数组
     * @param {Map<string, Object>} imageItemCache - 图片缓存 Map
     */
    renderImageList(items, imageItemCache) {
        const svgList = document.getElementById("svgList");
        if (!svgList) return;

        svgList.innerHTML = ""; // 清空现有列表
        this.imageItemCache = imageItemCache; // 更新缓存引用

        if (items.length === 0) {
            svgList.innerHTML = 
                `<div class="loading" style="text-align: center; padding: 20px; color: #888;">
                    没有找到任何图片资源
                </div>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        items.forEach(item => {
            fragment.appendChild(this.createImageItemElement(item));
        });
        svgList.appendChild(fragment);
    }

    /**
     * 创建单个图片项的 DOM 元素
     * @param {Object} item - 图片信息对象
     * @returns {HTMLElement} 图片项的 DOM 元素
     */
    createImageItemElement(item) {
        const itemDiv = document.createElement("div");
        itemDiv.className = "svg-item";
        itemDiv.dataset.id = item.id;

        const checkboxId = `checkbox-${item.id}`;
        const previewSrc = item.preview || item.url;

        itemDiv.innerHTML = `
            <div class="item-checkbox">
                <input type="checkbox" id="${checkboxId}" class="svg-checkbox" data-id="${item.id}">
                <label for="${checkboxId}"></label>
            </div>
            <div class="item-preview" data-id="${item.id}">
                ${item.format === "svg" && item.svgContent
                    ? `<div class="svg-content-preview">${Utils.ensureSvgNamespace(item.svgContent)}</div>`
                    : `<img src="${previewSrc}" alt="${item.name}" loading="lazy">`
                }
            </div>
            <div class="item-info">
                <div class="info-row">
                    <span class="info-name" title="${item.originalName || item.name}">${item.name}</span>
                    <span class="info-format">${String(item.format).toUpperCase()}</span>
                </div>
                <div class="info-row">
                    <span class="info-size">${item.width} × ${item.height}</span>
                    <span class="info-type">${item.type}</span>
                </div>
            </div>
            <div class="item-actions">
                <button class="action-btn preview-btn" data-id="${item.id}" title="预览">${Icons.eye}</button>
                <button class="action-btn download-btn" data-id="${item.id}" title="下载">${Icons.download}</button>
                <button class="action-btn copy-btn" data-id="${item.id}" title="复制链接">${Icons.copy}</button>
            </div>
        `;

        // 添加事件监听器
        itemDiv.querySelector(".item-preview").addEventListener("click", (e) => {
            const id = e.currentTarget.dataset.id;
            const item = this.imageItemCache.get(id);
            if (item) PreviewModal.show(item, Array.from(this.imageItemCache.values()), Array.from(this.imageItemCache.values()).indexOf(item));
        });

        itemDiv.querySelector(".preview-btn").addEventListener("click", (e) => {
            const id = e.currentTarget.dataset.id;
            const item = this.imageItemCache.get(id);
            if (item) PreviewModal.show(item, Array.from(this.imageItemCache.values()), Array.from(this.imageItemCache.values()).indexOf(item));
        });

        itemDiv.querySelector(".download-btn").addEventListener("click", (e) => {
            const id = e.currentTarget.dataset.id;
            const item = this.imageItemCache.get(id);
            if (item) Downloader.downloadImage(item, item.originalName, item.originalFormat);
        });

        itemDiv.querySelector(".copy-btn").addEventListener("click", (e) => {
            const id = e.currentTarget.dataset.id;
            const item = this.imageItemCache.get(id);
            if (item) {
                // 假设 Clipboard 模块存在并提供 copyUrls 方法
                // Clipboard.copyUrls([item]);
                if (CONFIG.features.enableNotifications) Notification.show("复制功能待实现", "info");
            }
        });

        return itemDiv;
    }

    /**
     * 应用筛选和排序
     * @param {Array<Object>} items - 原始图片项数组
     * @param {string} searchTerm - 搜索关键词
     * @param {string} sortBy - 排序方式
     * @param {string} formatFilter - 格式筛选
     * @returns {Array<Object>} 筛选和排序后的图片项数组
     */
    applyFilterAndSort(items, searchTerm, sortBy, formatFilter) {
        let filtered = [...items];

        // 搜索过滤
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(item =>
                (item.originalName || item.name || "").toLowerCase().includes(term) ||
                (item.url || "").toLowerCase().includes(term)
            );
        }

        // 格式过滤
        if (formatFilter && formatFilter !== "all") {
            filtered = filtered.filter(item =>
                (item.originalFormat || item.format || "").toLowerCase() === formatFilter.toLowerCase()
            );
        }

        // 排序
        switch (sortBy) {
            case "name-asc":
                filtered.sort((a, b) => (a.originalName || a.name).localeCompare(b.originalName || b.name));
                break;
            case "name-desc":
                filtered.sort((a, b) => (b.originalName || b.name).localeCompare(a.originalName || a.name));
                break;
            case "format":
                filtered.sort((a, b) => (a.format || "").localeCompare(b.format || ""));
                break;
            case "type":
                filtered.sort((a, b) => (a.type || "").localeCompare(b.type || ""));
                break;
            default:
                break;
        }

        return filtered;
    }
}

export const UIRenderer = new UIRendererService();
