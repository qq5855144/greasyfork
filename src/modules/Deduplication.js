/**
 * 去重模块
 * 负责图片的去重逻辑，包括 URL 去重和内容签名去重。
 */

import { CONFIG } from "../config.js";
import { Utils } from "../utils/index.js";
import { Notification } from "../services/Notification.js";

class DeduplicationService {
    /**
     * 生成内容的哈希签名
     * @param {string} url - 图片 URL
     * @returns {Promise<string>} 内容哈希签名或 'oversized' / 'error-...'
     */
    async generateContentSignature(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const contentLength = response.headers.get("content-length");
            if (contentLength && parseInt(contentLength) > CONFIG.deduplication.maxFileSizeForCheck) {
                return "oversized"; // 文件过大，不进行内容检查
            }
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const hash = await Utils.simpleHash(arrayBuffer);
            return `content-${hash}`;
        } catch (error) {
            return `error-${error.message}`;
        }
    }

    /**
     * 生成图片签名 (URL + 内容)
     * @param {Object} imgItem - 图片信息对象
     * @returns {Promise<string>} 图片签名
     */
    async generateImageSignature(imgItem) {
        const urlSignature = Utils.normalizeUrl(imgItem.url);
        if (CONFIG.deduplication.checkContent &&
            !imgItem.url.startsWith("blob:") &&
            !imgItem.url.startsWith("data:")) {
            try {
                const contentSignature = await this.generateContentSignature(imgItem.url);
                return `${urlSignature}|${contentSignature}`;
            } catch (error) {
                console.warn("内容签名生成失败，使用URL签名:", error);
            }
        }
        return urlSignature;
    }

    /**
     * 检查并移除重复图片
     * @param {Array<Object>} newImageItems - 新发现的图片列表
     * @param {Map<string, string>} imageSignatureMap - 已存在的图片签名 Map
     * @returns {Promise<Array<Object>>} 去重后的图片列表
     */
    async checkAndRemoveDuplicates(newImageItems, imageSignatureMap) {
        if (!CONFIG.deduplication.enabled) return newImageItems;

        const uniqueItems = [];
        const seenSignatures = new Set();

        // 将已有的图片签名添加到 seenSignatures
        imageSignatureMap.forEach(signature => seenSignatures.add(signature));

        for (const imgItem of newImageItems) {
            try {
                let signature;
                if (imgItem.format === "svg" && imgItem.svgContent) {
                    // 对于 SVG，直接使用内容哈希
                    const normalizedContent = imgItem.svgContent; // 假设 SVGProcessor.normalizeContent 已经处理
                    signature = await Utils.simpleHash(new TextEncoder().encode(normalizedContent));
                    signature = `svg-${signature}`;
                } else {
                    signature = await this.generateImageSignature(imgItem);
                }

                if (!seenSignatures.has(signature)) {
                    seenSignatures.add(signature);
                    imageSignatureMap.set(imgItem.id, signature); // 存储新的图片签名
                    uniqueItems.push(imgItem);
                }
            } catch (error) {
                console.warn("去重检查失败，保留图片:", imgItem.name, error);
                uniqueItems.push(imgItem);
            }
        }
        const removedCount = newImageItems.length - uniqueItems.length;
        if (removedCount > 0 && CONFIG.features.enableNotifications) {
            Notification.show(`已自动过滤 ${removedCount} 张重复图片`, "info");
        }
        return uniqueItems;
    }
}

export const Deduplication = new DeduplicationService();
