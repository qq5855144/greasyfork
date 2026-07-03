/**
 * 剪贴板模块
 * 负责复制图片链接到剪贴板。
 */

import { Notification } from "../services/Notification.js";
import { CONFIG } from "../config.js";

class ClipboardService {
    /**
     * 复制图片 URL 到剪贴板
     * @param {Array<Object>} imageItems - 图片信息对象数组
     */
    async copyUrls(imageItems) {
        if (!imageItems || imageItems.length === 0) {
            if (CONFIG.features.enableNotifications) Notification.show("没有图片可供复制", "warning");
            return;
        }

        const urls = imageItems.map(item => item.url).join("\n");

        try {
            await navigator.clipboard.writeText(urls);
            if (CONFIG.features.enableNotifications) Notification.show(`成功复制 ${imageItems.length} 条链接到剪贴板`, "success");
        } catch (err) {
            console.error("复制到剪贴板失败:", err);
            if (CONFIG.features.enableNotifications) Notification.show("复制到剪贴板失败", "error");
            // 提供备用方案：创建一个临时的 textarea
            const textarea = document.createElement("textarea");
            textarea.value = urls;
            textarea.style.position = "fixed"; // 防止页面滚动
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            try {
                const successful = document.execCommand("copy");
                if (successful) {
                    if (CONFIG.features.enableNotifications) Notification.show(`成功复制 ${imageItems.length} 条链接到剪贴板 (备用方案)`, "success");
                } else {
                    if (CONFIG.features.enableNotifications) Notification.show("复制到剪贴板失败 (请手动复制)", "error");
                }
            } catch (copyErr) {
                console.error("手动复制失败:", copyErr);
                if (CONFIG.features.enableNotifications) Notification.show("复制到剪贴板失败 (请手动复制)", "error");
            }
            document.body.removeChild(textarea);
        }
    }
}

export const Clipboard = new ClipboardService();
