/**
 * 预览弹窗模块
 * 负责显示图片预览、缩放、旋转、切换等功能。
 */

import { CONFIG } from "../config.js";
import { Utils } from "../utils/index.js";
import { Downloader } from "./Downloader.js";
import { Notification } from "../services/Notification.js";

class PreviewModalService {
    constructor() {
        this.currentItem = null;
        this.currentIndex = -1;
        this.imageList = [];
        this.modal = null;
        this.escapeHandler = null;
        // 缩放/旋转/位移状态
        this.transform = { scale: 1, rotate: 0, x: 0, y: 0 };
        this.dragState = null;
        this.wheelTimer = null;
    }

    /**
     * 初始化预览模态框
     */
    init() {
        this.modal = document.getElementById("imagePreviewModal");
        if (!this.modal) return;

        const closeBtn = this.modal.querySelector("#previewClose");
        if (closeBtn) closeBtn.addEventListener("click", () => this.hide());

        this.modal.addEventListener("click", (e) => {
            if (e.target === this.modal) this.hide();
        });

        const previewDownloadBtn = document.getElementById("previewDownload");
        if (previewDownloadBtn) {
            previewDownloadBtn.addEventListener("click", () => {
                if (this.currentItem) {
                    Downloader.downloadImage(this.currentItem, this.currentItem.originalName, this.currentItem.originalFormat);
                }
            });
        }

        const previewCopyBtn = document.getElementById("previewCopy");
        if (previewCopyBtn) {
            previewCopyBtn.addEventListener("click", async () => {
                if (this.currentItem) {
                    // 假设 Clipboard 模块存在并提供 copyUrls 方法
                    // await Clipboard.copyUrls([this.currentItem]);
                    if (CONFIG.features.enableNotifications) Notification.show("复制功能待实现", "info");
                }
            });
        }

        const previewPrevBtn = document.getElementById("previewPrev");
        if (previewPrevBtn) previewPrevBtn.addEventListener("click", (e) => { e.stopPropagation(); this.navigate(-1); });

        const previewNextBtn = document.getElementById("previewNext");
        if (previewNextBtn) previewNextBtn.addEventListener("click", (e) => { e.stopPropagation(); this.navigate(1); });

        // 工具栏
        const previewZoomInBtn = document.getElementById("previewZoomIn");
        if (previewZoomInBtn) previewZoomInBtn.addEventListener("click", (e) => { e.stopPropagation(); this.zoom(1.25); });

        const previewZoomOutBtn = document.getElementById("previewZoomOut");
        if (previewZoomOutBtn) previewZoomOutBtn.addEventListener("click", (e) => { e.stopPropagation(); this.zoom(1 / 1.25); });

        const previewRotateBtn = document.getElementById("previewRotate");
        if (previewRotateBtn) previewRotateBtn.addEventListener("click", (e) => { e.stopPropagation(); this.rotate(90); });

        const previewResetBtn = document.getElementById("previewReset");
        if (previewResetBtn) previewResetBtn.addEventListener("click", (e) => { e.stopPropagation(); this.resetTransform(); });

        // 滚轮缩放
        const stage = document.getElementById("previewStage");
        if (stage) {
            stage.addEventListener("wheel", (e) => {
                e.preventDefault();
                const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
                this.zoom(factor);
            }, { passive: false });
        }

        // 拖拽平移
        const wrapper = document.getElementById("previewImgWrapper");
        if (wrapper) {
            wrapper.addEventListener("mousedown", (e) => this._startDrag(e));
            wrapper.addEventListener("touchstart", (e) => this._startDrag(e), { passive: false });
        }
    }

    /**
     * 缩放图片
     * @param {number} factor - 缩放因子
     */
    zoom(factor) {
        const newScale = Math.min(8, Math.max(0.2, this.transform.scale * factor));
        this.transform.scale = newScale;
        this._applyTransform();
        this._showZoomIndicator();
    }

    /**
     * 旋转图片
     * @param {number} deg - 旋转角度
     */
    rotate(deg) {
        this.transform.rotate = (this.transform.rotate + deg) % 360;
        this._applyTransform();
        this._showZoomIndicator();
    }

    /**
     * 重置图片变换
     */
    resetTransform() {
        this.transform = { scale: 1, rotate: 0, x: 0, y: 0 };
        this._applyTransform();
        this._showZoomIndicator();
    }

    /**
     * 应用图片变换
     * @private
     */
    _applyTransform() {
        const wrapper = document.getElementById("previewImgWrapper");
        if (!wrapper) return;
        const t = this.transform;
        wrapper.style.transform = `translate(${t.x}px, ${t.y}px) rotate(${t.rotate}deg) scale(${t.scale})`;
    }

    /**
     * 显示缩放指示器
     * @private
     */
    _showZoomIndicator() {
        const ind = document.getElementById("previewZoomIndicator");
        if (!ind) return;
        const t = this.transform;
        ind.textContent = `${Math.round(t.scale * 100)}% · ${t.rotate}°${t.x || t.y ? " · 已平移" : ""}`;
        ind.classList.add("show");
        clearTimeout(this.wheelTimer);
        this.wheelTimer = setTimeout(() => ind.classList.remove("show"), 1200);
    }

    /**
     * 开始拖拽图片
     * @param {Event} e - 事件对象
     * @private
     */
    _startDrag(e) {
        // 仅当放大或旋转时才允许拖动
        if (this.transform.scale <= 1.05 && this.transform.rotate === 0) return;
        e.preventDefault();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        this.dragState = {
            startX: clientX, startY: clientY,
            originX: this.transform.x, originY: this.transform.y
        };
        const wrapper = document.getElementById("previewImgWrapper");
        if (wrapper) wrapper.classList.add("dragging");
        document.addEventListener("mousemove", this._dragMoveHandler.bind(this));
        document.addEventListener("touchmove", this._dragMoveHandler.bind(this), { passive: false });
        document.addEventListener("mouseup", this._dragEndHandler.bind(this));
        document.addEventListener("touchend", this._dragEndHandler.bind(this));
    }

    /**
     * 处理图片拖拽移动
     * @param {Event} e - 事件对象
     * @private
     */
    _dragMoveHandler(e) {
        if (!this.dragState) return;
        e.preventDefault();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        const ds = this.dragState;
        this.transform.x = ds.originX + (clientX - ds.startX);
        this.transform.y = ds.originY + (clientY - ds.startY);
        this._applyTransform();
    }

    /**
     * 处理图片拖拽结束
     * @private
     */
    _dragEndHandler() {
        if (!this.dragState) return;
        this.dragState = null;
        const wrapper = document.getElementById("previewImgWrapper");
        if (wrapper) wrapper.classList.remove("dragging");
        document.removeEventListener("mousemove", this._dragMoveHandler.bind(this));
        document.removeEventListener("touchmove", this._dragMoveHandler.bind(this));
        document.removeEventListener("mouseup", this._dragEndHandler.bind(this));
        document.removeEventListener("touchend", this._dragEndHandler.bind(this));
    }

    /**
     * 导航到上一张或下一张图片
     * @param {number} direction - -1 为上一张，1 为下一张
     */
    navigate(direction) {
        if (this.imageList.length === 0) return;
        const newIndex = this.currentIndex + direction;
        if (newIndex < 0 || newIndex >= this.imageList.length) return;
        this.show(this.imageList[newIndex], this.imageList, newIndex);
    }

    /**
     * 更新导航按钮状态
     * @private
     */
    _updateNavButtons() {
        const prevBtn = document.getElementById("previewPrev");
        const nextBtn = document.getElementById("previewNext");
        const counter = document.getElementById("previewCounter");
        if (!prevBtn || !nextBtn || !counter) return;

        if (this.imageList.length <= 1) {
            prevBtn.classList.add("disabled");
            nextBtn.classList.add("disabled");
            counter.style.display = "none";
        } else {
            if (this.currentIndex <= 0) prevBtn.classList.add("disabled");
            else prevBtn.classList.remove("disabled");
            if (this.currentIndex >= this.imageList.length - 1) nextBtn.classList.add("disabled");
            else nextBtn.classList.remove("disabled");
            counter.style.display = "block";
            counter.textContent = `${this.currentIndex + 1} / ${this.imageList.length}`;
        }
    }

    /**
     * 更新信息栏
     * @param {Object} imgItem - 图片信息对象
     * @private
     */
    _updateInfoBar(imgItem) {
        const formatEl = document.getElementById("previewInfoFormat");
        const sizeEl = document.getElementById("previewInfoSize");
        const filesizeEl = document.getElementById("previewInfoFilesize");
        if (!formatEl || !sizeEl || !filesizeEl) return;

        const fullFormat = imgItem.originalFormat || imgItem.format || "-";
        formatEl.textContent = String(fullFormat).toUpperCase();
        const w = imgItem.width, h = imgItem.height;
        sizeEl.textContent = (w && h && w !== "未知") ? `${w} × ${h}` : "-";
        filesizeEl.textContent = imgItem.fileSize && imgItem.fileSize !== "未知"
            ? Utils.formatFileSize(imgItem.fileSize) : "计算中...";
    }

    /**
     * 显示预览模态框
     * @param {Object} imgItem - 要预览的图片信息对象
     * @param {Array<Object>} [imageList] - 完整的图片列表
     * @param {number} [index] - 当前图片在列表中的索引
     */
    show(imgItem, imageList, index) {
        if (!this.modal) return;

        if (imageList) {
            this.imageList = imageList;
            this.currentIndex = index !== undefined ? index : imageList.indexOf(imgItem);
        } else {
            this.imageList = [imgItem];
            this.currentIndex = 0;
        }
        this.currentItem = imgItem;

        const title = document.getElementById("previewTitle");
        const subtitle = document.getElementById("previewSubtitle");
        if (title) {
            const completedFileName = Utils.completeImageSuffix(imgItem.originalName || imgItem.name, imgItem.originalFormat);
            title.textContent = completedFileName;
        }
        if (subtitle) {
            const fullType = imgItem.originalType || imgItem.type || "";
            subtitle.textContent = `${fullType ? fullType + " · " : ""}${imgItem.url || ""}`;
        }

        const wrapper = document.getElementById("previewImgWrapper");
        if (!wrapper) return;

        // 清理旧图片
        wrapper.innerHTML = '<div class="loading">加载中...</div>';
        // 重置变换
        this.resetTransform();

        this.modal.style.display = "flex";
        this._updateNavButtons();
        this._updateInfoBar(imgItem);

        // 渲染图片
        if (imgItem.format === "svg" && imgItem.svgContent) {
            // 假设 SVGProcessor 模块存在并提供 processForPreview 方法
            // const processedSvg = SVGProcessor.processForPreview(
            //     Utils.ensureSvgNamespace(imgItem.svgContent)
            // );
            const processedSvg = Utils.ensureSvgNamespace(imgItem.svgContent); // 暂时直接使用
            wrapper.innerHTML = `<div class="preview-svg">${processedSvg}</div>`;
            // SVG 通常无 fileSize，标注为内容长度
            if (imgItem.fileSize === "未知" || !imgItem.fileSize) {
                const bytes = new Blob([imgItem.svgContent]).size;
                const fsEl = document.getElementById("previewInfoFilesize");
                if (fsEl) fsEl.textContent = Utils.formatFileSize(bytes);
            }
        } else {
            const img = document.createElement("img");
            img.className = "preview-image";
            img.alt = imgItem.originalName || imgItem.name;
            try { img.referrerPolicy = "no-referrer"; } catch (e) { /* ignore */ }
            img.style.opacity = "0";
            img.style.transition = "opacity 0.3s";
            img.onload = () => {
                img.style.opacity = "1";
                // 更新尺寸/大小信息
                const sizeEl = document.getElementById("previewInfoSize");
                if (sizeEl && imgItem.width === "未知") {
                    sizeEl.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
                }
            };
            let pvRetried = false;
            img.onerror = () => {
                if (pvRetried) {
                    wrapper.innerHTML = '<div class="loading" style="color:#fff;">图片加载失败</div>';
                    return;
                }
                pvRetried = true;
                // 第二次尝试：去掉 referer policy 限制
                try { img.removeAttribute("referrerpolicy"); } catch (e) { /* ignore */ }
                const sep = imgItem.url.indexOf("?") >= 0 ? "&" : "?";
                img.src = imgItem.url + sep + "_pvretry=1";
            };
            // 异步获取文件大小
            this._fetchFileSize(imgItem);
            img.src = imgItem.url;
            wrapper.innerHTML = "";
            wrapper.appendChild(img);
        }

        this.escapeHandler = (e) => {
            if (e.key === "Escape") this.hide();
            if (e.key === "ArrowLeft") this.navigate(-1);
            if (e.key === "ArrowRight") this.navigate(1);
            if (e.key === "+" || e.key === "=") this.zoom(1.25);
            if (e.key === "-" || e.key === "_") this.zoom(1 / 1.25);
            if (e.key === "0") this.resetTransform();
            if (e.key === "r" || e.key === "R") this.rotate(90);
        };
        document.addEventListener("keydown", this.escapeHandler);
    }

    /**
     * 异步获取文件大小
     * @param {Object} imgItem - 图片信息对象
     * @private
     */
    async _fetchFileSize(imgItem) {
        const fsEl = document.getElementById("previewInfoFilesize");
        if (!fsEl) return;
        if (imgItem.fileSize && imgItem.fileSize !== "未知") {
            fsEl.textContent = Utils.formatFileSize(imgItem.fileSize);
            return;
        }
        try {
            // blob: / data: 直接读取
            if (imgItem.url.startsWith("blob:") || imgItem.url.startsWith("data:")) {
                const response = await fetch(imgItem.url);
                const blob = await response.blob();
                const bytes = blob.size;
                fsEl.textContent = Utils.formatFileSize(bytes);
                imgItem.fileSize = bytes;
                return;
            }

            // GM_xmlhttpRequest 获取文件大小
            if (typeof GM_xmlhttpRequest !== "undefined") {
                GM_xmlhttpRequest({
                    method: "HEAD",
                    url: imgItem.url,
                    onload: (resp) => {
                        const len = resp.responseHeaders.match(/content-length:\s*(\d+)/i);
                        if (len && len[1]) {
                            const bytes = parseInt(len[1]);
                            fsEl.textContent = Utils.formatFileSize(bytes);
                            imgItem.fileSize = bytes;
                        } else {
                            fsEl.textContent = "未知";
                        }
                    },
                    onerror: () => { fsEl.textContent = "未知"; }
                });
            } else {
                const resp = await fetch(imgItem.url, { method: "HEAD" });
                const len = resp.headers.get("content-length");
                if (len) {
                    const bytes = parseInt(len);
                    fsEl.textContent = Utils.formatFileSize(bytes);
                    imgItem.fileSize = bytes;
                } else {
                    fsEl.textContent = "未知";
                }
            }
        } catch (e) {
            fsEl.textContent = "未知";
        }
    }

    /**
     * 隐藏预览模态框
     */
    hide() {
        if (this.modal) this.modal.style.display = "none";
        this.currentItem = null;
        this.imageList = [];
        this.currentIndex = -1;
        if (this.escapeHandler) {
            document.removeEventListener("keydown", this.escapeHandler);
            this.escapeHandler = null;
        }
        // 清理拖拽监听
        document.removeEventListener("mousemove", this._dragMoveHandler.bind(this));
        document.removeEventListener("touchmove", this._dragMoveHandler.bind(this));
        document.removeEventListener("mouseup", this._dragEndHandler.bind(this));
        document.removeEventListener("touchend", this._dragEndHandler.bind(this));
        this.dragState = null;
    }
}

export const PreviewModal = new PreviewModalService();
