/**
 * 全局配置模块
 * 集中管理所有可配置的常量和参数
 */

const CONFIG = {
    // ==================== UI 配置 ====================
    ui: {
        buttonSize: 36,
        zIndex: 99999,
        positionOffset: 20,
        panelSafeMargin: '16px',
        panelMinSize: '380px',
        fixedFontSize: '11px',
        touchDelay: 300,
        clickDetectDelay: 1500,
        scrollCheckInterval: 500
    },

    // ==================== 毛玻璃效果配置 ====================
    glass: {
        opacity: 0.75,
        blur: '20px',
        border: 'rgba(255,255,255,0.25)',
        panelBg: 'rgba(255,255,255,0.72)',
        panelBgDark: 'rgba(30,30,40,0.88)'
    },

    // ==================== 颜色配置 ====================
    colors: {
        // 七彩渐变色
        rainbow: [
            '#ff6b6b', '#ff9f43', '#feca57', '#54a0ff',
            '#5f27cd', '#ff6fb7', '#00d2d3', '#1dd1a1'
        ],
        // 主要颜色
        primary: '#ff6b6b',
        success: '#1dd1a1',
        warning: '#feca57',
        error: '#ff6b6b',
        info: '#54a0ff',
        // 文本颜色
        textPrimary: '#333333',
        textSecondary: '#666666',
        textLight: '#ffffff',
        // 背景颜色
        bgLight: '#f8f9fa',
        bgDark: '#1e1e28'
    },

    // ==================== 图片采集配置 ====================
    image: {
        supportFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico', 'avif'],
        maxPreviewSize: 48,
        loadTimeout: 5000,
        infoTruncateLength: 4,
        defaultImageFormat: 'png'
    },

    // ==================== 预览配置 ====================
    preview: {
        maxWidth: '94vw',
        maxHeight: '88vh',
        background: 'rgba(0,0,0,0.88)',
        closeButtonSize: '40px',
        headerHeight: '52px',
        footerHeight: '60px',
        sidePadding: '64px'
    },

    // ==================== 批量下载配置 ====================
    batchDownload: {
        useZip: true,              // 默认打包为 zip
        zipFilenamePrefix: 'images',
        concurrentDownloads: 6,    // 并发下载数
        retryCount: 2,             // 失败重试次数
        retryDelay: 800
    },

    // ==================== 去重配置 ====================
    deduplication: {
        enabled: true,
        similarityThreshold: 0.95,
        checkContent: true,
        maxFileSizeForCheck: 5 * 1024 * 1024,
        urlNormalization: true
    },

    // ==================== Blob 管理配置 ====================
    blob: {
        maxBlobUrlCount: 100,
        cleanupNotification: true
    },

    // ==================== 点击加载检测配置 ====================
    clickDetection: {
        selectors: [
            '.load-more', '.load-btn', '.next-page', '.load-more-btn',
            '[data-action="load-more"]', '[class*="load"]', '[class*="more"]',
            '.pagination-next', '.next-btn', '.load-additional'
        ]
    },

    // ==================== 字体配置 ====================
    fonts: {
        family: "'Segoe UI', 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif",
        sizes: {
            xs: '10px',
            sm: '11px',
            base: '12px',
            lg: '13px',
            xl: '14px'
        }
    },

    // ==================== 动画配置 ====================
    animation: {
        duration: {
            fast: '0.15s',
            normal: '0.25s',
            slow: '0.35s'
        },
        easing: {
            ease: 'ease',
            easeIn: 'ease-in',
            easeOut: 'ease-out',
            easeInOut: 'ease-in-out',
            spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
        }
    },

    // ==================== 间距配置 ====================
    spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        xxl: '24px'
    },

    // ==================== 圆角配置 ====================
    radius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        full: '50%'
    },

    // ==================== 阴影配置 ====================
    shadow: {
        sm: '0 2px 4px rgba(0,0,0,0.1)',
        md: '0 4px 8px rgba(0,0,0,0.15)',
        lg: '0 8px 16px rgba(0,0,0,0.2)',
        xl: '0 12px 24px rgba(0,0,0,0.25)',
        inner: 'inset 0 0 20px rgba(255,255,255,0.08)'
    },

    // ==================== 通知配置 ====================
    notification: {
        duration: 3000,
        colors: {
            info: 'rgba(52,152,219,0.8)',
            success: 'rgba(39,174,96,0.8)',
            warning: 'rgba(243,156,18,0.8)',
            error: 'rgba(231,76,60,0.8)'
        }
    },

    // ==================== 存储配置 ====================
    storage: {
        prefix: 'imgCollector_',
        positionKey: 'radarPosition',
        settingsKey: 'settings',
        historyKey: 'downloadHistory'
    },

    // ==================== 功能开关 ====================
    features: {
        enableDragFab: true,
        enablePreview: true,
        enableBatchDownload: true,
        enableDeduplication: true,
        enableDynamicLoading: true,
        enableNotifications: true
    },

    // ==================== 获取方法 ====================

    /**
     * 获取配置值 (支持嵌套路径)
     * @param {string} path - 配置路径 (e.g., 'ui.buttonSize' 或 'colors.rainbow')
     * @param {*} defaultValue - 默认值
     * @returns {*} 配置值
     */
    get(path, defaultValue = undefined) {
        const keys = path.split('.');
        let value = this;
        for (const key of keys) {
            value = value?.[key];
            if (value === undefined) return defaultValue;
        }
        return value;
    },

    /**
     * 设置配置值 (支持嵌套路径)
     * @param {string} path - 配置路径
     * @param {*} value - 新值
     */
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let obj = this;
        for (const key of keys) {
            if (!(key in obj)) obj[key] = {};
            obj = obj[key];
        }
        obj[lastKey] = value;
    },

    /**
     * 合并配置 (用于扩展或覆盖配置)
     * @param {Object} newConfig - 新配置对象
     */
    merge(newConfig) {
        Object.assign(this, newConfig);
    }
};

// 导出 (兼容 CommonJS 和 ES Module)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
