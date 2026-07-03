/**
 * 下载模块
 * 负责图片的下载，包括单张下载和批量打包下载（ZIP）。
 */

import { CONFIG } from "../config.js";
import { Utils } from "../utils/index.js";
import { Notification } from "../services/Notification.js";

// 确保 JSZip 库已加载
// @require      https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
// 假设 JSZip 在全局作用域可用

class DownloaderService {
    constructor() {
        this._cancelFlag = false;
    }

    /**
     * 内联 saveAs 实现，替代 FileSaver.js
     * @param {Blob} blob - 要保存的 Blob 对象
     * @param {string} filename - 文件名
     */
    _saveAs(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 200);
    }

    /**
     * 通过 GM_xmlhttpRequest 获取 Blob（跨域友好），失败回退到 fetch
     * @param {string} url - 资源 URL
     * @returns {Promise<Blob>} Blob 对象
     */
    _fetchBlob(url) {
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest !== "undefined" && !url.startsWith("blob:") && !url.startsWith("data:")) {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: url,
                    responseType: "blob",
                    onload: (resp) => {
                        if (resp.status >= 200 && resp.status < 300) {
                            resolve(resp.response instanceof Blob ? resp.response : new Blob([resp.response]));
                        } else {
                            reject(new Error("HTTP " + resp.status));
                        }
                    },
                    onerror: () => reject(new Error("GM_xmlhttpRequest 网络错误")),
                    ontimeout: () => reject(new Error("请求超时"))
                });
            } else {
                fetch(url)
                    .then(r => r.ok ? r.blob() : Promise.reject(new Error("HTTP " + r.status)))
                    .then(resolve)
                    .catch(reject);
            }
        });
    }

    /**
     * 带重试机制的 Blob 获取
     * @param {string} url - 资源 URL
     * @returns {Promise<Blob>} Blob 对象
     */
    async _fetchBlobWithRetry(url) {
        const maxRetry = CONFIG.batchDownload.retryCount;
        let lastErr;
        for (let i = 0; i <= maxRetry; i++) {
            try {
                return await this._fetchBlob(url);
            } catch (e) {
                lastErr = e;
                if (i < maxRetry) {
                    await new Promise(r => setTimeout(r, CONFIG.batchDownload.retryDelay * (i + 1)));
                }
            }
        }
        throw lastErr;
    }

    /**
     * 下载单张图片
     * @param {Object} imgItem - 图片信息对象
     * @param {string} originalName - 原始文件名
     * @param {string} originalFormat - 原始文件格式
     */
    async downloadImage(imgItem, originalName, originalFormat) {
        const baseName = originalName || imgItem.name;
        const completedFileName = Utils.sanitizeFilename(Utils.completeImageSuffix(baseName, originalFormat));

        if (completedFileName.endsWith(".svg") && imgItem.svgContent) {
            try {
                const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>${Utils.ensureSvgNamespace(imgItem.svgContent)}`;
                const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
                this._saveAs(blob, completedFileName);
                if (CONFIG.features.enableNotifications) Notification.show(`下载成功: ${completedFileName}`, "success");
                return;
            } catch (svgErr) {
                console.warn("SVG专属下载失败，尝试备用方案:", svgErr);
            }
        }

        const mimeType = completedFileName.endsWith(".svg")
            ? "image/svg+xml"
            : `image/${completedFileName.split(".").pop().toLowerCase()}`;

        if (typeof GM_download !== "undefined" && !imgItem.url.startsWith("blob:") && !imgItem.url.startsWith("data:")) {
            GM_download({
                url: imgItem.url,
                name: completedFileName,
                mimetype: mimeType,
                onload: () => { if (CONFIG.features.enableNotifications) Notification.show(`下载成功: ${completedFileName}`, "success"); },
                onerror: (e) => {
                    console.error("GM_download 失败，回退到 fetch:", e);
                    // 回退方案：fetch + saveAs
                    this._fetchBlobWithRetry(imgItem.url)
                        .then(blob => {
                            this._saveAs(blob, completedFileName);
                            if (CONFIG.features.enableNotifications) Notification.show(`下载成功: ${completedFileName}`, "success");
                        })
                        .catch(() => { if (CONFIG.features.enableNotifications) Notification.show(`下载失败: ${completedFileName}`, "error"); });
                }
            });
        } else {
            this._fetchBlobWithRetry(imgItem.url)
                .then(blob => {
                    this._saveAs(blob, completedFileName);
                    if (CONFIG.features.enableNotifications) Notification.show(`下载成功: ${completedFileName}`, "success");
                })
                .catch(() => { if (CONFIG.features.enableNotifications) Notification.show(`下载失败: ${completedFileName}`, "error"); });
        }
    }

    /**
     * 取得用于 zip 内的文件名（处理重名冲突）
     * @param {Set<string>} usedSet - 已使用的文件名集合
     * @param {string} baseName - 基础文件名
     * @returns {string} 唯一的文件名
     */
    _resolveUniqueName(usedSet, baseName) {
        let candidate = Utils.sanitizeFilename(baseName);
        if (!usedSet.has(candidate)) {
            usedSet.add(candidate);
            return candidate;
        }
        const dotIdx = candidate.lastIndexOf(".");
        const stem = dotIdx > 0 ? candidate.slice(0, dotIdx) : candidate;
        const ext = dotIdx > 0 ? candidate.slice(dotIdx) : "";
        let n = 1;
        while (usedSet.has(`${stem}_${n}${ext}`)) n++;
        const final = `${stem}_${n}${ext}`;
        usedSet.add(final);
        return final;
    }

    /**
     * 单项转 Blob（统一入口，给 zip 用）
     * @param {Object} imgItem - 图片信息对象
     * @returns {Promise<Blob>} Blob 对象
     */
    async _itemToBlob(imgItem) {
        const baseName = imgItem.originalName || imgItem.name;
        const completedFileName = Utils.completeImageSuffix(baseName, imgItem.originalFormat);
        if (completedFileName.endsWith(".svg") && imgItem.svgContent) {
            const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>${Utils.ensureSvgNamespace(imgItem.svgContent)}`;
            return new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
        }
        return await this._fetchBlobWithRetry(imgItem.url);
    }

    /**
     * 显示批量下载进度面板
     * @param {number} total - 总下载数量
     */
    _showProgress(total) {
        const overlay = document.getElementById("batchProgressOverlay");
        if (!overlay) return; // 如果元素不存在，则不显示进度

        document.getElementById("batchProgressBar").style.width = "0%";
        document.getElementById("batchProgressCurrent").textContent = "0";
        document.getElementById("batchProgressTotal").textContent = String(total);
        document.getElementById("batchProgressOk").textContent = "0";
        document.getElementById("batchProgressFail").textContent = "0";
        document.getElementById("batchProgressStatus").textContent = "正在准备...";
        const cancelBtn = document.getElementById("batchProgressCancel");
        if (cancelBtn) {
            cancelBtn.disabled = false;
            cancelBtn.textContent = "取消下载";
        }
        overlay.style.display = "flex";
    }

    /**
     * 隐藏批量下载进度面板
     */
    _hideProgress() {
        const overlay = document.getElementById("batchProgressOverlay");
        if (overlay) {
            overlay.style.display = "none";
        }
    }

    /**
     * 更新批量下载进度
     * @param {number} done - 已完成数量
     * @param {number} total - 总数量
     * @param {number} ok - 成功数量
     * @param {number} fail - 失败数量
     * @param {string} statusText - 状态文本
     */
    _updateProgress(done, total, ok, fail, statusText) {
        const pct = total > 0 ? (done / total * 100) : 0;
        const progressBar = document.getElementById("batchProgressBar");
        const progressCurrent = document.getElementById("batchProgressCurrent");
        const progressOk = document.getElementById("batchProgressOk");
        const progressFail = document.getElementById("batchProgressFail");
        const progressStatus = document.getElementById("batchProgressStatus");

        if (progressBar) progressBar.style.width = pct + "%";
        if (progressCurrent) progressCurrent.textContent = String(done);
        if (progressOk) progressOk.textContent = String(ok);
        if (progressFail) progressFail.textContent = String(fail);
        if (progressStatus && statusText) progressStatus.textContent = statusText;
    }

    /**
     * 并发批量下载，使用 jszip 打包为单个 zip
     * @param {Array<Object>} selectedItems - 选中的图片信息数组
     */
    async downloadMultipleImages(selectedItems) {
        const totalCount = selectedItems.length;
        if (totalCount === 0) return;

        this._cancelFlag = false;
        this._showProgress(totalCount);

        let downloadedCount = 0;
        let successCount = 0;
        let failCount = 0;
        const usedNames = new Set();

        if (CONFIG.batchDownload.useZip) {
            // ZIP 打包下载
            if (typeof JSZip === "undefined") {
                Notification.show("JSZip 库未加载，无法打包下载", "error");
                this._hideProgress();
                return;
            }
            const zip = new JSZip();
            const downloadPromises = [];

            for (let i = 0; i < totalCount; i++) {
                if (this._cancelFlag) break;
                const imgItem = selectedItems[i];
                const originalName = imgItem.originalName || imgItem.name;
                const completedFileName = Utils.completeImageSuffix(originalName, imgItem.originalFormat);
                const uniqueFileName = this._resolveUniqueName(usedNames, completedFileName);

                const promise = this._itemToBlob(imgItem)
                    .then(blob => {
                        if (this._cancelFlag) throw new Error("下载已取消");
                        zip.file(uniqueFileName, blob);
                        successCount++;
                    })
                    .catch(error => {
                        console.error(`下载图片失败: ${imgItem.url}`, error);
                        failCount++;
                    })
                    .finally(() => {
                        downloadedCount++;
                        this._updateProgress(downloadedCount, totalCount, successCount, failCount, `正在下载: ${downloadedCount}/${totalCount}`);
                    });
                downloadPromises.push(promise);

                // 控制并发
                if (downloadPromises.length >= CONFIG.batchDownload.concurrentDownloads) {
                    await Promise.race(downloadPromises);
                    // 移除已完成的 promise
                    const index = await Promise.race(downloadPromises.map((p, idx) => p.then(() => idx)));
                    downloadPromises.splice(index, 1);
                }
            }
            await Promise.all(downloadPromises); // 等待所有剩余的下载完成

            if (this._cancelFlag) {
                Notification.show("批量下载已取消", "warning");
                this._hideProgress();
                return;
            }

            this._updateProgress(totalCount, totalCount, successCount, failCount, "正在生成 ZIP 文件...");
            zip.generateAsync({ type: "blob" })
                .then(content => {
                    this._saveAs(content, `${CONFIG.batchDownload.zipFilenamePrefix}_${Date.now()}.zip`);
                    if (CONFIG.features.enableNotifications) Notification.show(`批量下载完成: 成功 ${successCount} 失败 ${failCount}`, "success");
                })
                .catch(error => {
                    console.error("生成 ZIP 文件失败:", error);
                    if (CONFIG.features.enableNotifications) Notification.show("生成 ZIP 文件失败", "error");
                })
                .finally(() => {
                    this._hideProgress();
                });

        } else {
            // 逐个下载
            for (let i = 0; i < totalCount; i++) {
                if (this._cancelFlag) break;
                const imgItem = selectedItems[i];
                const originalName = imgItem.originalName || imgItem.name;
                const completedFileName = Utils.completeImageSuffix(originalName, imgItem.originalFormat);

                this._updateProgress(downloadedCount, totalCount, successCount, failCount, `正在下载: ${originalName}`);

                try {
                    await this.downloadImage(imgItem, originalName, imgItem.originalFormat);
                    successCount++;
                } catch (error) {
                    console.error(`下载图片失败: ${imgItem.url}`, error);
                    failCount++;
                }
                downloadedCount++;
            }

            if (this._cancelFlag) {
                if (CONFIG.features.enableNotifications) Notification.show("批量下载已取消", "warning");
            } else {
                if (CONFIG.features.enableNotifications) Notification.show(`批量下载完成: 成功 ${successCount} 失败 ${failCount}`, "success");
            }
            this._hideProgress();
        }
    }

    /**
     * 取消批量下载
     */
    cancelBatch() {
        this._cancelFlag = true;
        this._updateProgress(0, 0, 0, 0, "下载已取消");
        if (CONFIG.features.enableNotifications) Notification.show("批量下载已取消", "warning");
        this._hideProgress();
    }
}

export const Downloader = new DownloaderService();
