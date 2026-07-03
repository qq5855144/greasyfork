/**
 * 主应用模块
 * 负责初始化、协调各个模块，并处理整体逻辑。
 */

import { CONFIG } from "../config.js";
import { Utils } from "../utils/index.js";
import { Notification } from "../services/Notification.js";
import { BlobManager } from "../services/BlobManager.js";
import { Draggable } from "./Draggable.js";
import { ImageCollector } from "./ImageCollector.js";
import { PreviewModal } from "./PreviewModal.js";
import { Downloader } from "./Downloader.js";
import { UIRenderer } from "./UIRenderer.js";
import { DynamicListener } from "./DynamicListener.js";
import { Clipboard } from "./Clipboard.js";
import { DOMBuilder } from "./DOMBuilder.js"; // 假设 DOMBuilder 模块也已重构

class AppService {
    constructor() {
        this.globalImageItems = [];
        this.imageItemCache = new Map(); // 用于存储图片项的完整信息
        this.imageSignatureMap = new Map(); // 用于去重
        this.fabElements = null;
        this.mainModal = null;
        this.overlay = null;
        this.currentView = "list"; // 默认视图
    }

    /**
     * 初始化应用
     */
    async init() {
        Notification.init();

        // 构建DOM
        this.fabElements = DOMBuilder.createFabButton();
        this.mainModal = DOMBuilder.createMainModal();
        DOMBuilder.createPreviewModal();
        DOMBuilder.createBatchProgressOverlay();
        this.overlay = DOMBuilder.createOverlay();

        // 初始化各模块
        PreviewModal.init();
        this._initFabPosition();
        this._initFabEvents();
        this._initModalEvents();
        this._initSearchBar();
        DynamicListener.init(this.detectNewImages.bind(this)); // 注入 detectNewImages 方法

        // 键盘快捷键
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && this.mainModal.style.display === "flex") {
                const previewModalElement = document.getElementById("imagePreviewModal");
                if (previewModalElement && previewModalElement.style.display === "flex") {
                    PreviewModal.hide();
                } else {
                    this.hideModal();
                }
            }
            if (e.ctrlKey && e.key === "f" && this.mainModal.style.display === "flex") {
                e.preventDefault();
                const searchInput = document.getElementById("searchInput");
                if (searchInput) searchInput.focus();
            }
        });

        // 页面卸载清理
        window.addEventListener("beforeunload", () => {
            BlobManager.cleanupAll();
            DynamicListener.destroy();
        });

        // 首次检测图片
        await this.detectNewImages();

        // 初始化全局图像计数
        this._updateGlobalCount();
    }

    /**
     * 初始化浮动按钮位置
     * @private
     */
    _initFabPosition() {
        Draggable.restorePosition();
    }

    /**
     * 初始化浮动按钮事件
     * @private
     */
    _initFabEvents() {
        Draggable.init(this.fabElements.container, () => this.showModal());
    }

    /**
     * 初始化模态框事件
     * @private
     */
    _initModalEvents() {
        const closeBtn = this.mainModal.querySelector(".close-btn");
        if (closeBtn) closeBtn.addEventListener("click", () => this.hideModal());
        if (this.overlay) this.overlay.addEventListener("click", () => this.hideModal());

        const selectAll = document.getElementById("selectAll");
        if (selectAll) {
            selectAll.addEventListener("change", (e) => {
                this.mainModal.querySelectorAll(".svg-checkbox").forEach(cb => {
                    cb.checked = e.target.checked;
                });
            });
        }

        const batchDownloadBtn = document.getElementById("batchDownloadBtn");
        if (batchDownloadBtn) {
            batchDownloadBtn.addEventListener("click", () => {
                const selectedItems = this._getSelectedItems();
                if (selectedItems.length === 0) {
                    if (CONFIG.features.enableNotifications) Notification.show("请至少选择一张图片", "warning");
                    return;
                }
                if (selectedItems.length === 1) {
                    Downloader.downloadImage(selectedItems[0], selectedItems[0].originalName, selectedItems[0].originalFormat);
                } else {
                    Downloader.downloadMultipleImages(selectedItems);
                }
            });
        }

        // 批量下载模式切换
        const batchModeZip = document.getElementById("batchModeZip");
        const batchModeSingle = document.getElementById("batchModeSingle");
        if (batchModeZip) {
            batchModeZip.addEventListener("click", () => {
                CONFIG.batchDownload.useZip = true;
                batchModeZip.classList.add("active");
                if (batchModeSingle) batchModeSingle.classList.remove("active");
            });
        }
        if (batchModeSingle) {
            batchModeSingle.addEventListener("click", () => {
                CONFIG.batchDownload.useZip = false;
                batchModeSingle.classList.add("active");
                if (batchModeZip) batchModeZip.classList.remove("active");
            });
        }

        // 取消批量下载
        const batchProgressCancel = document.getElementById("batchProgressCancel");
        if (batchProgressCancel) {
            batchProgressCancel.addEventListener("click", () => {
                Downloader.cancelBatch();
            });
        }

        const batchCopyBtn = document.getElementById("batchCopyBtn");
        if (batchCopyBtn) {
            batchCopyBtn.addEventListener("click", () => {
                Clipboard.copyUrls(this._getSelectedItems());
            });
        }

        const invertSelectBtn = document.getElementById("invertSelectBtn");
        if (invertSelectBtn) {
            invertSelectBtn.addEventListener("click", () => {
                this.mainModal.querySelectorAll(".svg-checkbox").forEach(cb => {
                    cb.checked = !cb.checked;
                });
            });
        }

        const dedupeToggle = document.getElementById("dedupeToggle");
        if (dedupeToggle) {
            dedupeToggle.checked = CONFIG.deduplication.enabled; // 初始化状态
            dedupeToggle.addEventListener("change", (e) => {
                CONFIG.deduplication.enabled = e.target.checked;
                if (CONFIG.features.enableNotifications) Notification.show(`智能去重 ${e.target.checked ? "已启用" : "已禁用"}`, "info");
            });
        }
    }

    /**
     * 初始化搜索栏和筛选排序功能
     * @private
     */
    _initSearchBar() {
        const searchInput = document.getElementById("searchInput");
        const sortSelect = document.getElementById("sortSelect");
        const formatFilter = document.getElementById("formatFilter");
        const listViewBtn = document.getElementById("listViewBtn");
        const gridViewBtn = document.getElementById("gridViewBtn");

        const applyFilters = Utils.debounce(() => {
            const filtered = UIRenderer.applyFilterAndSort(
                this.globalImageItems,
                searchInput ? searchInput.value : "",
                sortSelect ? sortSelect.value : "",
                formatFilter ? formatFilter.value : "all"
            );
            UIRenderer.renderImageList(filtered, this.imageItemCache);
            const imageCountElement = document.getElementById("imageCount");
            if (imageCountElement) imageCountElement.textContent = String(filtered.length);
            const selectAllCheckbox = document.getElementById("selectAll");
            if (selectAllCheckbox) selectAllCheckbox.checked = false;
        }, 250);

        if (searchInput) searchInput.addEventListener("input", applyFilters);
        if (sortSelect) sortSelect.addEventListener("change", applyFilters);
        if (formatFilter) formatFilter.addEventListener("change", applyFilters);

        // 视图切换
        if (listViewBtn) {
            listViewBtn.addEventListener("click", () => {
                this.currentView = "list";
                const svgList = document.getElementById("svgList");
                if (svgList) svgList.classList.remove("grid-view");
                listViewBtn.classList.add("active");
                if (gridViewBtn) gridViewBtn.classList.remove("active");
                applyFilters();
            });
        }

        if (gridViewBtn) {
            gridViewBtn.addEventListener("click", () => {
                this.currentView = "grid";
                const svgList = document.getElementById("svgList");
                if (svgList) svgList.classList.add("grid-view");
                gridViewBtn.classList.add("active");
                if (listViewBtn) listViewBtn.classList.remove("active");
                applyFilters();
            });
        }
    }

    /**
     * 获取所有选中的图片项
     * @returns {Array<Object>} 选中的图片项数组
     * @private
     */
    _getSelectedItems() {
        const selectedCheckboxes = this.mainModal.querySelectorAll(".svg-checkbox:checked");
        const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.id);
        return selectedIds.map(id => this.imageItemCache.get(id)).filter(item => item);
    }

    /**
     * 检测并添加新图片
     */
    async detectNewImages() {
        const newImages = await ImageCollector.collectAllImages(this.imageSignatureMap);
        if (newImages.length > 0) {
            this.globalImageItems.push(...newImages);
            newImages.forEach(item => this.imageItemCache.set(item.id, item));
            this._updateGlobalCount();
            this._renderImageList(); // 重新渲染列表以显示新图片
        }
    }

    /**
     * 更新浮动按钮上的图片计数
     * @private
     */
    _updateGlobalCount() {
        const count = this.globalImageItems.length;
        const badge = this.fabElements.badge;
        if (count > 0) {
            badge.textContent = String(count);
            badge.style.display = "flex";
        } else {
            badge.style.display = "none";
        }
    }

    /**
     * 渲染图片列表 (内部调用，考虑当前筛选和排序)
     * @private
     */
    _renderImageList() {
        const searchInput = document.getElementById("searchInput");
        const sortSelect = document.getElementById("sortSelect");
        const formatFilter = document.getElementById("formatFilter");

        const filtered = UIRenderer.applyFilterAndSort(
            this.globalImageItems,
            searchInput ? searchInput.value : "",
            sortSelect ? sortSelect.value : "",
            formatFilter ? formatFilter.value : "all"
        );
        UIRenderer.renderImageList(filtered, this.imageItemCache);
        const imageCountElement = document.getElementById("imageCount");
        if (imageCountElement) imageCountElement.textContent = String(filtered.length);
        const selectAllCheckbox = document.getElementById("selectAll");
        if (selectAllCheckbox) selectAllCheckbox.checked = false;

        // 确保视图模式正确应用
        const svgList = document.getElementById("svgList");
        if (svgList) {
            if (this.currentView === "grid") {
                svgList.classList.add("grid-view");
            } else {
                svgList.classList.remove("grid-view");
            }
        }
    }

    /**
     * 显示主模态框
     */
    showModal() {
        if (this.mainModal) this.mainModal.style.display = "flex";
        if (this.overlay) this.overlay.style.display = "block";
        this._renderImageList(); // 每次打开都重新渲染，确保最新数据
    }

    /**
     * 隐藏主模态框
     */
    hideModal() {
        if (this.mainModal) this.mainModal.style.display = "none";
        if (this.overlay) this.overlay.style.display = "none";
        PreviewModal.hide(); // 确保预览模态框也关闭
    }
}

export const App = new AppService();
