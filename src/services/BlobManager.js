/**
 * Blob 管理模块
 * 负责创建和清理 Blob URL
 */

import { CONFIG } from "../config.js";
import { Notification } from "./Notification.js";

class BlobManagerService {
    constructor() {
        this.blobUrlMap = new Map();
    }

    /**
     * 创建一个受管理的 Blob URL
     * @param {Blob} blob - Blob 对象
     * @returns {string} Blob URL
     */
    createManagedBlobUrl(blob) {
        const blobUrl = URL.createObjectURL(blob);
        const now = Date.now();
        this.blobUrlMap.set(blobUrl, now);

        // 清理旧的 Blob URL 以防止内存泄漏
        if (this.blobUrlMap.size > CONFIG.blob.maxBlobUrlCount) {
            const sortedUrls = Array.from(this.blobUrlMap.entries()).sort((a, b) => a[1] - b[1]);
            const urlsToClean = sortedUrls.slice(0, this.blobUrlMap.size - CONFIG.blob.maxBlobUrlCount);
            urlsToClean.forEach(([url]) => this.cleanupSingle(url));
            if (CONFIG.blob.cleanupNotification) {
                Notification.show(`Blob URL超限，已清理${urlsToClean.length}个历史URL`, "info");
            }
        }
        return blobUrl;
    }

    /**
     * 清理单个 Blob URL
     * @param {string} url - 要清理的 Blob URL
     */
    cleanupSingle(url) {
        if (this.blobUrlMap.has(url)) {
            try {
                URL.revokeObjectURL(url);
                this.blobUrlMap.delete(url);
            } catch (error) {
                console.warn("清理Blob URL失败:", url, error);
            }
        }
    }

    /**
     * 清理所有 Blob URL
     */
    cleanupAll() {
        this.blobUrlMap.forEach((_, url) => this.cleanupSingle(url));
        this.blobUrlMap.clear();
        if (CONFIG.blob.cleanupNotification) {
            Notification.show("已清理所有Blob URL", "info");
        }
    }
}

export const BlobManager = new BlobManagerService();
