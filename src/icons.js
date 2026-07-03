/**
 * 图标系统模块 - 集中管理所有 SVG 图标
 * 提供统一的图标创建和渲染接口
 */

const IconSystem = {
    // 图标库定义
    icons: {
        // 主按钮图标 - 图片采集器
        collector: `
            <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
                <path d="M512 955.3408c-243.712 0-442.0096-198.2976-442.0096-442.0096S268.288 71.2704 512 71.2704s442.0096 198.2976 442.0096 442.0096-198.2976 442.0608-442.0096 442.0608z m0-802.1504c-198.5536 0-360.0896 161.536-360.0896 360.0896s161.536 360.0896 360.0896 360.0896 360.0896-161.536 360.0896-360.0896S710.5536 153.1904 512 153.1904z" fill="#4385F5"/>
                <path d="M512 513.3312m-213.6064 0a213.6064 213.6064 0 1 0 427.2128 0 213.6064 213.6064 0 1 0-427.2128 0Z" fill="#D9FFEC"/>
                <path d="M486.6048 686.7456c-112.5888 0-204.1856-91.5968-204.1856-204.2368 0-112.5888 91.5968-204.1856 204.1856-204.1856 112.5888 0 204.2368 91.5968 204.2368 204.1856-0.0512 112.64-91.648 204.2368-204.2368 204.2368z m0-331.6224c-70.2464 0-127.3856 57.1392-127.3856 127.3856s57.1392 127.4368 127.3856 127.4368 127.4368-57.1392 127.4368-127.4368-57.1904-127.3856-127.4368-127.3856z" fill="#34A853"/>
                <path d="M703.232 733.6448a38.2976 38.2976 0 0 1-27.5456-11.6224l-86.4768-88.9344c-14.7968-15.2064-14.4384-39.5264 0.768-54.3232 15.2064-14.7968 39.5264-14.4384 54.3232 0.768l86.4768 88.9344c14.7968 15.2064 14.4384 39.5264-0.768 54.3232a38.50752 38.50752 0 0 1-26.7776 10.8544z" fill="#34A853"/>
            </svg>
        `,

        // 关闭按钮图标
        close: `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        `,

        // 列表视图图标
        listView: `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="4" width="18" height="3" rx="1"/>
                <rect x="3" y="10.5" width="18" height="3" rx="1"/>
                <rect x="3" y="17" width="18" height="3" rx="1"/>
            </svg>
        `,

        // 网格视图图标
        gridView: `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="8" height="8" rx="1.5"/>
                <rect x="13" y="3" width="8" height="8" rx="1.5"/>
                <rect x="3" y="13" width="8" height="8" rx="1.5"/>
                <rect x="13" y="13" width="8" height="8" rx="1.5"/>
            </svg>
        `,

        // 下载图标
        download: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
        `,

        // 复制图标
        copy: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
            </svg>
        `,

        // 放大图标
        zoomIn: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                <circle cx="11" cy="11" r="7"/>
                <line x1="11" y1="8" x2="11" y2="14"/>
                <line x1="8" y1="11" x2="14" y2="11"/>
                <line x1="16.5" y1="16.5" x2="21" y2="21"/>
            </svg>
        `,

        // 缩小图标
        zoomOut: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                <circle cx="11" cy="11" r="7"/>
                <line x1="8" y1="11" x2="14" y2="11"/>
                <line x1="16.5" y1="16.5" x2="21" y2="21"/>
            </svg>
        `,

        // 旋转图标
        rotate: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12a9 9 0 1 1-3-6.7"/>
                <polyline points="21 3 21 9 15 9"/>
            </svg>
        `,

        // 上一张图标
        prevArrow: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"/>
            </svg>
        `,

        // 下一张图标
        nextArrow: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"/>
            </svg>
        `,

        // 下载图标 (另一种风格)
        downloadAlt: `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9H13V6h-2v5H8.5l3.5 3.5 3.5-3.5z"/>
            </svg>
        `,

        // 搜索图标
        search: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
        `,

        // 筛选图标
        filter: `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 6h16v2H4V6zm2 5h12v2H6v-2zm3 5h6v2H9v-2z"/>
            </svg>
        `,

        // 排序图标
        sort: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="12 5 19 12 12 19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
        `,

        // 全选图标
        selectAll: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
        `,

        // 反选图标
        invertSelect: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M9 11l3 3L22 6"/>
            </svg>
        `,

        // 打包图标
        package: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
        `,

        // 加载中图标
        loading: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
            </svg>
        `,

        // 成功图标
        success: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
        `,

        // 错误图标
        error: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
        `,

        // 警告图标
        warning: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
        `,

        // 信息图标
        info: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
        `,

        // 设置图标
        settings: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24"/>
            </svg>
        `,

        // 刷新图标
        refresh: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36M20.49 15a9 9 0 0 1-14.85 3.36"/>
            </svg>
        `,

        // 删除图标
        delete: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
        `,

        // 更多操作图标
        moreOptions: `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2"/>
                <circle cx="12" cy="12" r="2"/>
                <circle cx="12" cy="19" r="2"/>
            </svg>
        `,

        // 展开图标
        expand: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 21 12 15 6"/>
                <polyline points="9 18 15 12 9 6"/>
            </svg>
        `,

        // 收起图标
        collapse: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 3 12 9 6"/>
                <polyline points="15 18 9 12 15 6"/>
            </svg>
        `
    },

    /**
     * 根据图标名称获取 SVG 元素
     * @param {string} iconName - 图标名称
     * @param {Object} options - 配置选项
     * @param {string} options.className - 添加到 SVG 元素的 CSS 类名
     * @param {string} options.size - 图标大小 (e.g., '24px', '1em')
     * @param {string} options.color - 图标颜色
     * @returns {HTMLElement|null} SVG DOM 元素或 null (如果图标不存在)
     */
    createIcon(iconName, options = {}) {
        const svgString = this.icons[iconName];
        if (!svgString) {
            console.warn(`Icon "${iconName}" not found`);
            return null;
        }

        // 创建临时容器并解析 SVG
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = svgString.trim();
        const svgElement = tempDiv.firstChild;

        // 应用选项
        if (options.className) {
            svgElement.classList.add(...options.className.split(' '));
        }
        if (options.size) {
            svgElement.setAttribute('width', options.size);
            svgElement.setAttribute('height', options.size);
        }
        if (options.color) {
            svgElement.style.color = options.color;
        }

        return svgElement;
    },

    /**
     * 获取 SVG 字符串 (用于直接嵌入 HTML)
     * @param {string} iconName - 图标名称
     * @returns {string} SVG 字符串或空字符串 (如果图标不存在)
     */
    getIconString(iconName) {
        return this.icons[iconName] || '';
    },

    /**
     * 注册自定义图标
     * @param {string} iconName - 图标名称
     * @param {string} svgString - SVG 字符串
     */
    registerIcon(iconName, svgString) {
        this.icons[iconName] = svgString;
    },

    /**
     * 获取所有可用的图标名称
     * @returns {Array<string>} 图标名称数组
     */
    getAvailableIcons() {
        return Object.keys(this.icons);
    },

    /**
     * 检查图标是否存在
     * @param {string} iconName - 图标名称
     * @returns {boolean}
     */
    hasIcon(iconName) {
        return iconName in this.icons;
    }
};

// 导出 (兼容 CommonJS 和 ES Module)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IconSystem;
}
