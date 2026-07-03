/**
 * URL 处理工具函数
 */

/**
 * 规范化 URL，移除查询参数和哈希，用于去重
 * @param {string} url - 原始 URL
 * @returns {string} 规范化后的 URL
 */
export function normalizeUrl(url) {
    try {
        const urlObj = new URL(url);
        urlObj.search = ""; // 移除查询参数
        urlObj.hash = "";     // 移除哈希
        return urlObj.toString();
    } catch (e) {
        return url; // 无效 URL 返回原始值
    }
}
