/**
 * 通用工具函数模块
 * 统一导出所有工具函数
 */

import { debounce } from './debounce.js';
import { simpleHash } from './hash.js';
import { normalizeUrl } from './url.js';

export const Utils = {
    debounce,
    simpleHash,
    normalizeUrl,

    /**
     * 检查给定值是否为有效的 URL
     * @param {string} urlString - 要检查的字符串
     * @returns {boolean}
     */
    isValidUrl(urlString) {
        try {
            new URL(urlString);
            return true;
        } catch (e) {
            return false;
        }
    },

    /**
     * 将 HTML 字符串转换为 DOM 元素
     * @param {string} htmlString - HTML 字符串
     * @returns {HTMLElement|null}
     */
    htmlToElement(htmlString) {
        const template = document.createElement("template");
        template.innerHTML = htmlString.trim();
        return template.content.firstChild;
    },

    /**
     * 生成唯一 ID
     * @returns {string}
     */
    generateUniqueId() {
        return `uid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * 从 URL 获取文件扩展名
     * @param {string} url - 图片 URL
     * @returns {string} 文件扩展名
     */
    getFileExtension(url) {
        const parts = url.split(".");
        if (parts.length > 1) {
            return parts.pop().split("?")[0].split("#")[0];
        }
        return "";
    },

    /**
     * 截断字符串到指定字节长度 (UTF-8)
     * @param {string} str - 原始字符串
     * @param {number} maxLength - 最大字节长度
     * @returns {string} 截断后的字符串
     */
    truncateTo4Bytes(str, maxLength = 4) {
        if (!str) return '';
        let result = '';
        let byteLength = 0;
        for (let i = 0; i < str.length; i++) {
            const charCode = str.charCodeAt(i);
            let charByteLength;
            if (charCode <= 0x007f) {
                charByteLength = 1;
            } else if (charCode <= 0x07ff) {
                charByteLength = 2;
            } else if (charCode <= 0xffff) {
                charByteLength = 3;
            } else {
                charByteLength = 4;
            }

            if (byteLength + charByteLength > maxLength) {
                return result + '...';
            }
            byteLength += charByteLength;
            result += str.charAt(i);
        }
        return result;
    },

    /**
     * 从 URL 获取图片名称
     * @param {string} url - 图片 URL
     * @param {string} alt - 图片 alt 属性
     * @returns {string} 图片名称
     */
    getImageName(url, alt) {
        if (alt && alt.trim() !== '') return alt;
        try {
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/');
            let name = pathSegments[pathSegments.length - 1];
            if (name.includes('.')) {
                name = name.substring(0, name.lastIndexOf('.'));
            }
            return name || '未命名图片';
        } catch (e) {
            return '未命名图片';
        }
    },

    /**
     * 确保 SVG 包含 xmlns 属性
     * @param {string} svgContent - SVG 字符串
     * @returns {string} 包含 xmlns 的 SVG 字符串
     */
    ensureSvgNamespace(svgContent) {
        if (!svgContent.includes('xmlns="http://www.w3.org/2000/svg"')) {
            return svgContent.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        return svgContent;
    },

    /**
     * 补全图片后缀
     * @param {string} filename - 文件名
     * @param {string} format - 格式
     * @returns {string} 补全后缀的文件名
     */
    completeImageSuffix(filename, format) {
        if (!filename) return `image.${format}`;
        if (filename.includes('.') && filename.split('.').pop().toLowerCase() === format.toLowerCase()) {
            return filename;
        }
        return `${filename}.${format}`;
    },

    /**
     * 清理文件名，移除非法字符
     * @param {string} filename - 原始文件名
     * @returns {string} 清理后的文件名
     */
    sanitizeFilename(filename) {
        return filename.replace(/[/\\?%*:|"<>]|\s/g, '_');
    }
};
