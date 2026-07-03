// ==UserScript==
// @name         网页图片采集器 Pro
// @namespace    http://tampermonkey.net/
// @version      v4.0
// @description  支持动态加载、智能去重、大图预览、批量打包下载的网页图片下载工具 | 七彩毛玻璃UI
// @author       YourName
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @connect      *
// @require      https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
// @icon         data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%23ff6b6b%22%2F%3E%3Cstop%20offset%3D%220.5%22%20stop-color%3D%22%23feca57%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%231dd1a1%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20x%3D%223%22%20y%3D%223%22%20width%3D%2218%22%20height%3D%2218%22%20rx%3D%223%22%20fill%3D%22url(%23g)%22%2F%3E%3Ccircle%20cx%3D%228.5%22%20cy%3D%228.5%22%20r%3D%221.6%22%20fill%3D%22%23fff%22%2F%3E%3Cpath%20d%3D%22M21%2015l-5-5L7%2019%22%20stroke%3D%22%23fff%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3Cpath%20d%3D%22M12%2017v-4%22%20stroke%3D%22%23fff%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%2F%3E%3Cpath%20d%3D%22M9.5%2013L12%2010.5L14.5%2013%22%20stroke%3D%22%23fff%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';


    // ==================== src/config.js ====================
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
    
    // ==================== src/styles.js ====================
    /**
     * 全局样式管理模块
     * 集中管理所有 CSS 样式
     */
    
    const StyleManager = {
        // 所有样式定义
        styles: {
            // 基础样式
            base: `
                #svgSnifferModal,
                #svgSnifferModal * {
                    font-size: ${CONFIG.ui.fixedFontSize} !important;
                    line-height: 1.45 !important;
                    box-sizing: border-box;
                }
    
                /* 重置默认样式 */
                #svgSnifferModal button {
                    cursor: pointer;
                    border: none;
                    outline: none;
                    background: none;
                    padding: 0;
                    margin: 0;
                }
    
                #svgSnifferModal input,
                #svgSnifferModal select {
                    border: none;
                    outline: none;
                    padding: 0;
                    margin: 0;
                }
            `,
    
            // 浮动按钮样式
            fab: `
                /* 浮动按钮容器 */
                .rainbow-fab-container {
                    position: fixed;
                    z-index: ${CONFIG.ui.zIndex};
                    cursor: move;
                    transition: transform 0.2s;
                    touch-action: none;
                    user-select: none;
                }
    
                /* 浮动按钮 */
                .rainbow-fab {
                    width: ${CONFIG.ui.buttonSize}px;
                    height: ${CONFIG.ui.buttonSize}px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    border: none;
                    outline: none;
                    position: relative;
                    overflow: visible;
                    user-select: none;
                    -webkit-tap-highlight-color: transparent;
                    background: transparent;
                    transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.3s;
                    filter: drop-shadow(0 6px 16px rgba(0,0,0,0.25));
                }
    
                /* 浮动按钮彩虹边框 */
                .rainbow-fab::before {
                    content: '';
                    position: absolute;
                    inset: -2px;
                    border-radius: 50%;
                    padding: 2px;
                    background: conic-gradient(
                        from 0deg,
                        #ff6b6b, #ff9f43, #feca57, #54a0ff,
                        #5f27cd, #ff6fb7, #00d2d3, #1dd1a1,
                        #ff6b6b
                    );
                    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                    -webkit-mask-composite: xor;
                    mask-composite: exclude;
                    animation: rainbow-spin 4s linear infinite;
                }
    
                /* 浮动按钮内部 */
                .rainbow-fab-inner {
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(30,30,40,0.82);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    position: relative;
                    z-index: 1;
                    overflow: hidden;
                    box-shadow: inset 0 0 20px rgba(255,255,255,0.08);
                }
    
                /* 浮动按钮光晕效果 */
                .rainbow-fab-inner::after {
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: radial-gradient(
                        circle at 50% 50%,
                        rgba(255,255,255,0.15) 0%,
                        transparent 60%
                    );
                    opacity: 0;
                    transition: opacity 0.3s;
                }
    
                .rainbow-fab:hover .rainbow-fab-inner::after {
                    opacity: 1;
                }
    
                /* 浮动按钮悬停效果 */
                .rainbow-fab:hover {
                    transform: scale(1.08);
                    filter: drop-shadow(0 10px 24px rgba(0,0,0,0.35));
                }
    
                /* 浮动按钮按下效果 */
                .rainbow-fab:active {
                    transform: scale(0.94);
                }
    
                /* 浮动按钮图标 */
                .rainbow-fab-icon {
                    width: 18px;
                    height: 18px;
                    position: relative;
                    z-index: 2;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    filter: drop-shadow(0 0 3px rgba(255,255,255,0.4));
                }
    
                .rainbow-fab-icon svg {
                    width: 100%;
                    height: 100%;
                }
    
                /* 浮动按钮徽章 */
                .rainbow-fab-badge {
                    position: absolute;
                    top: -3px;
                    right: -3px;
                    min-width: 16px;
                    height: 16px;
                    border-radius: 8px;
                    background: linear-gradient(135deg, #ff6b6b, #ff9f43);
                    color: #fff;
                    font-size: 9px;
                    font-weight: 700;
                    display: none;
                    align-items: center;
                    justify-content: center;
                    padding: 0 4px;
                    z-index: 10;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                    border: 1.5px solid rgba(255,255,255,0.4);
                    backdrop-filter: blur(4px);
                    -webkit-backdrop-filter: blur(4px);
                }
    
                /* 脉冲动画 */
                .rainbow-fab.pulse {
                    animation: fab-pulse 0.6s ease-out;
                }
    
                @keyframes fab-pulse {
                    0% {
                        box-shadow: 0 0 0 0 rgba(255, 107, 107, 0.7);
                    }
                    70% {
                        box-shadow: 0 0 0 10px rgba(255, 107, 107, 0);
                    }
                    100% {
                        box-shadow: 0 0 0 0 rgba(255, 107, 107, 0);
                    }
                }
    
                /* 加载状态 */
                .rainbow-fab.loading .rainbow-fab-icon {
                    animation: spin 1s linear infinite;
                }
    
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
    
                @keyframes rainbow-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `,
    
            // 主模态框样式
            modal: `
                /* 主模态框 */
                #svgSnifferModal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    margin: ${CONFIG.ui.panelSafeMargin};
                    max-width: calc(100vw - 2 * ${CONFIG.ui.panelSafeMargin});
                    max-height: calc(100vh - 2 * ${CONFIG.ui.panelSafeMargin});
                    min-width: ${CONFIG.ui.panelMinSize};
                    min-height: ${CONFIG.ui.panelMinSize};
                    width: auto;
                    height: auto;
                    z-index: 100000;
                    display: none;
                    flex-direction: column;
                    font-family: ${CONFIG.fonts.family};
                    overflow: hidden;
                    border-radius: 18px;
                    background: ${CONFIG.glass.panelBg};
                    backdrop-filter: blur(${CONFIG.glass.blur});
                    -webkit-backdrop-filter: blur(${CONFIG.glass.blur});
                    box-shadow:
                        0 8px 40px rgba(0,0,0,0.18),
                        0 2px 8px rgba(0,0,0,0.08),
                        inset 0 1px 0 rgba(255,255,255,0.5);
                    border: 1.5px solid ${CONFIG.glass.border};
                }
    
                /* 模态框彩虹边框 */
                #svgSnifferModal::before {
                    content: '';
                    position: absolute;
                    inset: -1.5px;
                    border-radius: 19px;
                    padding: 1.5px;
                    background: linear-gradient(
                        135deg,
                        #ff6b6b, #ff9f43, #feca57, #54a0ff,
                        #5f27cd, #ff6fb7, #00d2d3, #1dd1a1,
                        #ff6b6b
                    );
                    background-size: 200% 200%;
                    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                    -webkit-mask-composite: xor;
                    mask-composite: exclude;
                    animation: rainbow-border-shift 6s ease infinite;
                    pointer-events: none;
                    z-index: 0;
                }
    
                /* 模态框内容在边框之上 */
                #svgSnifferModal > * {
                    position: relative;
                    z-index: 1;
                }
    
                @keyframes rainbow-border-shift {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }
    
                /* 模态框头部 */
                .modal-header {
                    padding: 14px 22px;
                    background: linear-gradient(
                        135deg,
                        rgba(255,107,107,0.65),
                        rgba(255,159,67,0.65),
                        rgba(254,202,87,0.5),
                        rgba(84,160,255,0.6),
                        rgba(95,39,205,0.6),
                        rgba(255,111,183,0.55),
                        rgba(0,210,211,0.55),
                        rgba(29,209,161,0.55)
                    );
                    background-size: 200% 200%;
                    animation: rainbow-header-shift 8s ease infinite;
                    backdrop-filter: blur(14px);
                    -webkit-backdrop-filter: blur(14px);
                    color: #fff;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-shrink: 0;
                    border-bottom: 1px solid rgba(255,255,255,0.3);
                    text-shadow: 0 1px 3px rgba(0,0,0,0.2);
                }
    
                .modal-header h2 {
                    margin: 0;
                    font-weight: 700;
                    font-size: 13px !important;
                    letter-spacing: 0.5px;
                }
    
                @keyframes rainbow-header-shift {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }
    
                /* 关闭按钮 */
                .close-btn {
                    background: rgba(255,255,255,0.15);
                    border: 1px solid rgba(255,255,255,0.3);
                    color: #fff;
                    cursor: pointer;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.25s;
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                }
    
                .close-btn svg {
                    pointer-events: none;
                }
    
                .close-btn:hover {
                    background: rgba(255,255,255,0.35);
                    transform: rotate(90deg) scale(1.1);
                    box-shadow: 0 0 16px rgba(255,255,255,0.35);
                }
    
                /* 操作栏 */
                .action-bar {
                    padding: 10px 18px;
                    background: rgba(248,249,250,0.65);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border-bottom: 1px solid rgba(0,0,0,0.06);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-shrink: 0;
                    flex-wrap: wrap;
                    gap: 8px;
                }
    
                /* 搜索栏 */
                .search-bar {
                    padding: 12px 16px;
                    background: rgba(248,249,250,0.5);
                    border-bottom: 1px solid rgba(0,0,0,0.05);
                    display: flex;
                    gap: 8px;
                    align-items: center;
                    flex-wrap: wrap;
                }
    
                .search-input {
                    flex: 1;
                    min-width: 150px;
                    padding: 8px 12px;
                    border: 1px solid rgba(0,0,0,0.1);
                    border-radius: 6px;
                    font-size: 12px;
                    background: rgba(255,255,255,0.8);
                    backdrop-filter: blur(4px);
                }
    
                .search-input::placeholder {
                    color: rgba(0,0,0,0.4);
                }
    
                .sort-select,
                .format-filter {
                    padding: 8px 10px;
                    border: 1px solid rgba(0,0,0,0.1);
                    border-radius: 6px;
                    font-size: 12px;
                    background: rgba(255,255,255,0.8);
                    backdrop-filter: blur(4px);
                    cursor: pointer;
                }
    
                /* 视图切换按钮 */
                .view-toggle {
                    display: flex;
                    gap: 4px;
                }
    
                .view-btn {
                    width: 32px;
                    height: 32px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255,255,255,0.6);
                    border: 1px solid rgba(0,0,0,0.1);
                    cursor: pointer;
                    transition: all 0.2s;
                    color: rgba(0,0,0,0.6);
                }
    
                .view-btn:hover {
                    background: rgba(255,255,255,0.8);
                    color: rgba(0,0,0,0.8);
                }
    
                .view-btn.active {
                    background: linear-gradient(135deg, rgba(29,209,161,0.8), rgba(0,210,211,0.8));
                    color: #fff;
                    border-color: transparent;
                }
    
                .view-btn svg {
                    width: 16px;
                    height: 16px;
                }
    
                /* 操作按钮 */
                .action-btn {
                    padding: 7px 14px;
                    border: 1px solid rgba(255,255,255,0.3);
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    white-space: nowrap;
                    transition: all 0.25s;
                    font-size: 11px !important;
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    color: #fff;
                }
    
                .download-btn {
                    background: linear-gradient(135deg, rgba(29,209,161,0.8), rgba(0,210,211,0.8));
                    text-shadow: 0 1px 2px rgba(0,0,0,0.15);
                }
    
                .download-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 14px rgba(29,209,161,0.35);
                }
    
                .copy-btn {
                    background: linear-gradient(135deg, rgba(84,160,255,0.8), rgba(95,39,205,0.8));
                    text-shadow: 0 1px 2px rgba(0,0,0,0.15);
                }
    
                .copy-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 14px rgba(84,160,255,0.35);
                }
    
                .filter-btn {
                    background: linear-gradient(135deg, rgba(255,159,67,0.8), rgba(255,107,107,0.8));
                    text-shadow: 0 1px 2px rgba(0,0,0,0.15);
                }
    
                .filter-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 14px rgba(255,159,67,0.35);
                }
    
                /* 模态框内容 */
                .modal-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 12px;
                    background: rgba(255,255,255,0.3);
                }
    
                .modal-content::-webkit-scrollbar {
                    width: 6px;
                }
    
                .modal-content::-webkit-scrollbar-track {
                    background: transparent;
                }
    
                .modal-content::-webkit-scrollbar-thumb {
                    background: rgba(0,0,0,0.2);
                    border-radius: 3px;
                }
    
                .modal-content::-webkit-scrollbar-thumb:hover {
                    background: rgba(0,0,0,0.3);
                }
    
                /* 加载状态 */
                .loading {
                    text-align: center;
                    padding: 40px 20px;
                    color: rgba(0,0,0,0.5);
                    font-size: 12px;
                }
    
                /* 通知 */
                .copy-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 12px 20px;
                    border-radius: 8px;
                    color: #fff;
                    font-size: 12px;
                    z-index: 999999;
                    opacity: 0;
                    transition: opacity 0.3s;
                    backdrop-filter: blur(8px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                }
            `,
    
            // 图片列表样式
            imageList: `
                /* 图片列表 */
                #svgList {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
    
                #svgList.grid-view {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
                    gap: 8px;
                }
    
                /* 图片项 */
                .image-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px;
                    background: rgba(255,255,255,0.6);
                    border-radius: 8px;
                    border: 1px solid rgba(0,0,0,0.05);
                    transition: all 0.2s;
                    cursor: pointer;
                }
    
                .image-item:hover {
                    background: rgba(255,255,255,0.8);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
    
                .image-item.selected {
                    background: rgba(29,209,161,0.15);
                    border-color: rgba(29,209,161,0.3);
                }
    
                /* 网格视图中的图片项 */
                #svgList.grid-view .image-item {
                    flex-direction: column;
                    justify-content: center;
                    aspect-ratio: 1;
                    padding: 8px;
                }
    
                /* 图片缩略图 */
                .image-thumbnail {
                    width: 48px;
                    height: 48px;
                    border-radius: 6px;
                    object-fit: cover;
                    background: rgba(0,0,0,0.05);
                    border: 1px solid rgba(0,0,0,0.1);
                }
    
                #svgList.grid-view .image-thumbnail {
                    width: 100%;
                    height: 100%;
                }
    
                /* 图片信息 */
                .image-info {
                    flex: 1;
                    min-width: 0;
                }
    
                #svgList.grid-view .image-info {
                    display: none;
                }
    
                .image-name {
                    font-weight: 500;
                    font-size: 12px;
                    color: rgba(0,0,0,0.8);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
    
                .image-meta {
                    font-size: 10px;
                    color: rgba(0,0,0,0.5);
                    margin-top: 2px;
                }
    
                /* 复选框 */
                .svg-checkbox {
                    width: 16px;
                    height: 16px;
                    cursor: pointer;
                    accent-color: #ff6b6b;
                }
            `,
    
            // 预览模态框样式
            preview: `
                /* 预览模态框 */
                #imagePreviewModal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 100001;
                    display: none;
                    flex-direction: column;
                    background: ${CONFIG.preview.background};
                    backdrop-filter: blur(8px);
                }
    
                .preview-container {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                }
    
                .preview-header {
                    padding: 16px 20px;
                    background: rgba(0,0,0,0.3);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-shrink: 0;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }
    
                .preview-title-wrap {
                    color: #fff;
                }
    
                .preview-title {
                    font-weight: 600;
                    font-size: 14px;
                }
    
                .preview-subtitle {
                    font-size: 11px;
                    color: rgba(255,255,255,0.7);
                    margin-top: 4px;
                }
    
                .preview-close {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.15);
                    border: 1px solid rgba(255,255,255,0.3);
                    color: #fff;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
    
                .preview-close:hover {
                    background: rgba(255,255,255,0.25);
                    transform: scale(1.1);
                }
    
                /* 预览内容 */
                .preview-content {
                    flex: 1;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                }
    
                .preview-stage {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
    
                .preview-img-wrapper {
                    max-width: ${CONFIG.preview.maxWidth};
                    max-height: ${CONFIG.preview.maxHeight};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                }
    
                .preview-img-wrapper img,
                .preview-img-wrapper svg {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                }
    
                /* 预览导航按钮 */
                .preview-nav {
                    position: absolute;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.15);
                    border: 1px solid rgba(255,255,255,0.3);
                    color: #fff;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    z-index: 10;
                }
    
                .preview-nav:hover {
                    background: rgba(255,255,255,0.25);
                    transform: translateY(-50%) scale(1.1);
                }
    
                .preview-nav.prev {
                    left: 20px;
                }
    
                .preview-nav.next {
                    right: 20px;
                }
    
                .preview-nav svg {
                    width: 20px;
                    height: 20px;
                }
    
                /* 预览工具栏 */
                .preview-toolbar {
                    position: absolute;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    gap: 10px;
                    background: rgba(0,0,0,0.4);
                    padding: 10px 15px;
                    border-radius: 12px;
                    backdrop-filter: blur(8px);
                    z-index: 10;
                }
    
                .preview-tool-btn {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.15);
                    border: 1px solid rgba(255,255,255,0.3);
                    color: #fff;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
    
                .preview-tool-btn:hover {
                    background: rgba(255,255,255,0.25);
                    transform: scale(1.1);
                }
    
                .preview-tool-btn svg {
                    width: 18px;
                    height: 18px;
                }
    
                /* 缩放指示器 */
                .preview-zoom-indicator {
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    background: rgba(0,0,0,0.4);
                    color: #fff;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 11px;
                    backdrop-filter: blur(8px);
                    z-index: 10;
                }
            `,
    
            // 批量下载进度条样式
            batchProgress: `
                /* 批量下载进度覆盖层 */
                #batchProgressOverlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.6);
                    z-index: 100002;
                    display: none;
                    align-items: center;
                    justify-content: center;
                    backdrop-filter: blur(4px);
                }
    
                .batch-progress-container {
                    background: white;
                    border-radius: 12px;
                    padding: 30px;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }
    
                .batch-progress-title {
                    font-weight: 600;
                    font-size: 14px;
                    margin-bottom: 20px;
                    color: #333;
                }
    
                .batch-progress-bar {
                    width: 100%;
                    height: 8px;
                    background: rgba(0,0,0,0.1);
                    border-radius: 4px;
                    overflow: hidden;
                    margin-bottom: 10px;
                }
    
                .batch-progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #1dd1a1, #00d2d3);
                    transition: width 0.3s ease;
                    border-radius: 4px;
                }
    
                .batch-progress-text {
                    font-size: 11px;
                    color: rgba(0,0,0,0.6);
                    text-align: center;
                    margin-bottom: 20px;
                }
    
                .batch-progress-actions {
                    display: flex;
                    gap: 10px;
                    justify-content: center;
                }
    
                #batchProgressCancel {
                    padding: 8px 16px;
                    background: rgba(0,0,0,0.1);
                    border: 1px solid rgba(0,0,0,0.2);
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s;
                }
    
                #batchProgressCancel:hover {
                    background: rgba(0,0,0,0.15);
                }
            `
        },
    
        /**
         * 注入所有样式到页面
         */
        injectStyles() {
            const allStyles = Object.values(this.styles).join('\\n');
            GM_addStyle(allStyles);
        },
    
        /**
         * 获取特定样式
         * @param {string} styleName - 样式名称
         * @returns {string} CSS 字符串
         */
        getStyle(styleName) {
            return this.styles[styleName] || '';
        },
    
        /**
         * 添加自定义样式
         * @param {string} styleName - 样式名称
         * @param {string} css - CSS 字符串
         */
        addStyle(styleName, css) {
            this.styles[styleName] = css;
        },
    
        /**
         * 注入单个样式
         * @param {string} css - CSS 字符串
         */
        injectCustomStyle(css) {
            GM_addStyle(css);
        }
    };
    
    // 导出 (兼容 CommonJS 和 ES Module)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = StyleManager;
    }
    
    // ==================== src/icons.js ====================
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
    
    // ==================== src/utils/debounce.js ====================
    /**
     * 防抖函数
     * @param {Function} func - 要执行的函数
     * @param {number} delay - 延迟时间 (毫秒)
     * @returns {Function} 防抖后的函数
     */
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }
    
    // ==================== src/utils/hash.js ====================
    /**
     * 简单的哈希函数，用于生成内容的签名
     * @param {ArrayBuffer} buffer - 输入的 ArrayBuffer
     * @returns {Promise<string>} 哈希字符串
     */
    async function simpleHash(buffer) {
        const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hexHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
        return hexHash;
    }
    
    // ==================== src/utils/url.js ====================
    /**
     * URL 处理工具函数
     */
    
    /**
     * 规范化 URL，移除查询参数和哈希，用于去重
     * @param {string} url - 原始 URL
     * @returns {string} 规范化后的 URL
     */
    function normalizeUrl(url) {
        try {
            const urlObj = new URL(url);
            urlObj.search = ""; // 移除查询参数
            urlObj.hash = "";     // 移除哈希
            return urlObj.toString();
        } catch (e) {
            return url; // 无效 URL 返回原始值
        }
    }
    
    // ==================== src/utils/index.js ====================
    /**
     * 通用工具函数模块
     * 统一导出所有工具函数
     */
    
    
    
    
    const Utils = {
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
    
    // ==================== src/services/Notification.js ====================
    /**
     * 通知模块
     * 负责在页面上显示临时通知
     */
    
    
    class NotificationService {
        constructor() {
            this.element = null;
            this.init();
        }
    
        init() {
            if (!this.element) {
                this.element = document.createElement("div");
                this.element.className = "copy-notification";
                document.body.appendChild(this.element);
            }
        }
    
        /**
         * 显示通知
         * @param {string} message - 通知消息
         * @param {('info'|'success'|'warning'|'error')} type - 通知类型
         */
        show(message, type = "info") {
            const colors = CONFIG.notification.colors;
            this.element.textContent = message;
            this.element.style.backgroundColor = colors[type] || colors.info;
            this.element.style.opacity = "1";
            setTimeout(() => {
                this.element.style.opacity = "0";
            }, CONFIG.notification.duration);
        }
    
        /**
         * 销毁通知元素
         */
        destroy() {
            if (this.element && this.element.parentNode) {
                this.element.parentNode.removeChild(this.element);
                this.element = null;
            }
        }
    }
    
    const Notification = new NotificationService();
    
    // ==================== src/services/BlobManager.js ====================
    /**
     * Blob 管理模块
     * 负责创建和清理 Blob URL
     */
    
    
    
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
    
    const BlobManager = new BlobManagerService();
    
    // ==================== src/modules/Deduplication.js ====================
    /**
     * 去重模块
     * 负责图片的去重逻辑，包括 URL 去重和内容签名去重。
     */
    
    
    
    
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
    
    const Deduplication = new DeduplicationService();
    
    // ==================== src/modules/Downloader.js ====================
    /**
     * 下载模块
     * 负责图片的下载，包括单张下载和批量打包下载（ZIP）。
     */
    
    
    
    
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
    
    const Downloader = new DownloaderService();
    
    // ==================== src/modules/ImageCollector.js ====================
    /**
     * 图片采集模块
     * 负责从页面中收集图片资源，包括 img 标签、CSS 背景图、动态加载的图片等。
     */
    
    
    
    
    
    class ImageCollectorService {
        constructor() {
            this.hiddenElements = [];
        }
    
        /**
         * 临时显示隐藏元素，以便采集其中的图片
         */
        tempShowHiddenElements() {
            this.hiddenElements = [];
            const hiddenSelectors = [
                'div[style*="display:none"]',
                'div[style*="visibility:hidden"]',
                'div[style*="opacity:0"]',
                '.errorpage[style*="display:none"]',
                '[class*="hidden"]',
                '[hidden]'
            ];
            hiddenSelectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => {
                    const originalStyle = {
                        display: el.style.display,
                        visibility: el.style.visibility,
                        opacity: el.style.opacity,
                        position: el.style.position,
                        top: el.style.top,
                        left: el.style.left,
                        width: el.style.width,
                        height: el.style.height,
                        className: el.className
                    };
                    this.hiddenElements.push({ el, originalStyle });
                    el.classList.add('temp-visible-for-scan');
                    el.style.display = '';
                    el.style.visibility = '';
                    el.style.opacity = '';
                });
            });
        }
    
        /**
         * 恢复之前隐藏的元素
         */
        restoreHiddenElements() {
            this.hiddenElements.forEach(({ el, originalStyle }) => {
                el.classList.remove('temp-visible-for-scan');
                el.style.display = originalStyle.display;
                el.style.visibility = originalStyle.visibility;
                el.style.opacity = originalStyle.opacity;
                el.style.position = originalStyle.position;
                el.style.top = originalStyle.top;
                el.style.left = originalStyle.left;
                el.style.width = originalStyle.width;
                el.style.height = originalStyle.height;
                el.className = originalStyle.className;
            });
            this.hiddenElements = [];
        }
    
        /**
         * 收集基本的 img 标签图片
         * @returns {Array<Object>} 图片信息数组
         */
        collectBasicImages() {
            const images = [];
            document.querySelectorAll('img').forEach((img, index) => {
                const src = img.src || img.dataset.src || img.currentSrc;
                if (src && !src.startsWith('data:')) {
                    const originalFormat = Utils.getFileExtension(src).toLowerCase();
                    images.push({
                        id: Utils.generateUniqueId(),
                        url: src,
                        name: Utils.truncateTo4Bytes(img.alt || '未命名图片'),
                        format: Utils.truncateTo4Bytes(originalFormat || CONFIG.image.defaultImageFormat),
                        width: img.naturalWidth || img.width || '未知',
                        height: img.naturalHeight || img.height || '未知',
                        type: 'img-tag',
                        preview: src,
                        element: img,
                        originalName: img.alt || '未命名图片',
                        originalFormat: originalFormat,
                        svgContent: '',
                        fileSize: '未知'
                    });
                }
            });
            return images;
        }
    
        /**
         * 从 CSS 文件中收集图片 URL
         * @param {string} cssUrl - CSS 文件的 URL
         * @returns {Promise<Array<string>>} 图片 URL 数组
         */
        async collectImagesFromCss(cssUrl) {
            const imageUrls = [];
            try {
                const response = await fetch(cssUrl, {
                    headers: { 'Accept': 'text/css,*/*;q=0.1' },
                    credentials: 'same-origin'
                });
                if (!response.ok) throw new Error(`CSS请求失败: ${response.status}`);
                const cssText = await response.text();
                const bgUrlRegex = /url\(["']?([^"']+)["']?\)/gi; // 匹配所有 url() 格式
                let match;
                while ((match = bgUrlRegex.exec(cssText)) !== null) {
                    if (match[1]) {
                        const fullUrl = new URL(match[1], cssUrl).href;
                        const ext = Utils.getFileExtension(fullUrl).toLowerCase();
                        if (CONFIG.image.supportFormats.includes(ext)) imageUrls.push(fullUrl);
                    }
                }
            } catch (e) {
                console.warn('采集CSS中的图片失败:', cssUrl, e);
            }
            return imageUrls;
        }
    
        /**
         * 收集所有 CSS 资源中的图片 URL
         * @returns {Promise<Array<string>>} 所有 CSS 图片 URL 数组
         */
        async collectAllCssResources() {
            const cssUrls = [];
            document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
                const href = link.getAttribute('href');
                if (href) cssUrls.push(new URL(href, window.location.href).href);
            });
            document.querySelectorAll('style').forEach(style => {
                const bgUrlRegex = /url\(["']?([^"']+)["']?\)/gi;
                let match;
                while ((match = bgUrlRegex.exec(style.textContent)) !== null) {
                    if (match[1]) {
                        const fullUrl = new URL(match[1], window.location.href).href;
                        const ext = Utils.getFileExtension(fullUrl).toLowerCase();
                        if (CONFIG.image.supportFormats.includes(ext)) cssUrls.push(`inline:${fullUrl}`);
                    }
                }
            });
            const allImageUrls = [];
            for (const cssUrl of cssUrls) {
                if (cssUrl.startsWith('inline:')) {
                    allImageUrls.push(cssUrl.replace('inline:', ''));
                } else {
                    const images = await this.collectImagesFromCss(cssUrl);
                    allImageUrls.push(...images);
                }
            }
            return allImageUrls;
        }
    
        /**
         * 收集页面上所有图片资源
         * @param {Map<string, string>} imageSignatureMap - 用于去重的图片签名 Map
         * @returns {Promise<Array<Object>>} 收集到的图片信息数组
         */
        async collectAllImages(imageSignatureMap) {
            const imageItems = [];
            const processedUrls = new Set();
    
            // 基础 img 标签
            this.collectBasicImages().forEach(img => {
                if (!processedUrls.has(img.url)) {
                    processedUrls.add(img.url);
                    imageItems.push(img);
                }
            });
    
            // CSS 资源
            let cssImageUrls = [];
            try { cssImageUrls = await this.collectAllCssResources(); } catch (e) {
                console.warn('CSS图片采集异常:', e);
            }
    
            this.tempShowHiddenElements();
            try {
                // 动态 img 标签
                for (const img of document.querySelectorAll('img')) {
                    try {
                        let imgUrl = img.src || img.dataset.src || img.dataset.original || img.currentSrc;
                        if (!imgUrl || processedUrls.has(imgUrl) || imgUrl.startsWith('data:')) continue;
                        const fullUrl = new URL(imgUrl, window.location.href).href;
                        const originalFormat = Utils.getFileExtension(fullUrl).toLowerCase();
                        if (!CONFIG.image.supportFormats.includes(originalFormat) && originalFormat) continue;
                        if (processedUrls.has(fullUrl)) continue;
    
                        const originalName = Utils.getImageName(fullUrl, img.alt);
                        let svgContent = '';
                        if (originalFormat === 'svg') {
                            try {
                                const svgResponse = await fetch(fullUrl);
                                if (svgResponse.ok) svgContent = await svgResponse.text();
                            } catch (svgErr) { /* ignore */ }
                        }
    
                        const imgInfo = await new Promise((resolve) => {
                            const timer = setTimeout(() => resolve({
                                id: Utils.generateUniqueId(),
                                url: fullUrl, name: Utils.truncateTo4Bytes(originalName),
                                format: Utils.truncateTo4Bytes(originalFormat || CONFIG.image.defaultImageFormat),
                                width: img.width || '未知', height: img.height || '未知',
                                type: 'img-tag', preview: fullUrl,
                                originalName, originalFormat, svgContent, fileSize: '未知'
                            }), CONFIG.image.loadTimeout);
                            if (img.complete) {
                                clearTimeout(timer);
                                resolve({
                                    id: Utils.generateUniqueId(),
                                    url: fullUrl, name: Utils.truncateTo4Bytes(originalName),
                                    format: Utils.truncateTo4Bytes(originalFormat || CONFIG.image.defaultImageFormat),
                                    width: img.naturalWidth || img.width || '未知',
                                    height: img.naturalHeight || img.height || '未知',
                                    type: 'img-tag', preview: fullUrl,
                                    originalName, originalFormat, svgContent, fileSize: '未知'
                                });
                            } else {
                                img.onload = () => {
                                    clearTimeout(timer);
                                    resolve({
                                        id: Utils.generateUniqueId(),
                                        url: fullUrl, name: Utils.truncateTo4Bytes(originalName),
                                        format: Utils.truncateTo4Bytes(originalFormat || CONFIG.image.defaultImageFormat),
                                        width: img.naturalWidth || img.width || '未知',
                                        height: img.naturalHeight || img.height || '未知',
                                        type: 'img-tag', preview: fullUrl,
                                        originalName, originalFormat, svgContent, fileSize: '未知'
                                    });
                                };
                                img.onerror = () => { clearTimeout(timer); resolve(null); };
                            }
                        });
                        if (imgInfo) { processedUrls.add(imgUrl); imageItems.push(imgInfo); }
                    } catch (e) { console.warn('采集<img>标签失败:', e); }
                }
    
                // 背景图
                for (const el of document.querySelectorAll('*')) {
                    try {
                        const bgStyle = window.getComputedStyle(el).backgroundImage;
                        if (!bgStyle || bgStyle === 'none' || processedUrls.has(bgStyle)) continue;
                        const bgUrls = bgStyle.match(/url\(["']?([^"']+)["']?\)/g);
                        if (!bgUrls) continue;
                        for (const bgUrl of bgUrls) {
                            const match = bgUrl.match(/url\(["']?([^"']+)["']?\)/);
                            if (!match || !match[1]) continue;
                            let imgUrl = match[1];
                            if (processedUrls.has(imgUrl)) continue;
                            const fullUrl = new URL(imgUrl, window.location.href).href;
                            const originalFormat = Utils.getFileExtension(fullUrl).toLowerCase();
                            let svgContent = '';
                            if (originalFormat === 'svg') {
                                try {
                                    const svgResponse = await fetch(fullUrl);
                                    if (svgResponse.ok) svgContent = await svgResponse.text();
                                } catch (svgErr) { /* ignore */ }
                            }
                            const originalName = `背景图-${el.tagName.toLowerCase()}-${Date.now().toString().slice(-4)}`;
                            imageItems.push({
                                id: Utils.generateUniqueId(),
                                url: fullUrl, name: Utils.truncateTo4Bytes(originalName),
                                format: Utils.truncateTo4Bytes(originalFormat || CONFIG.image.defaultImageFormat),
                                width: '背景图', height: '背景图',
                                type: '背景图',
                                preview: fullUrl, originalName, originalFormat,
                                originalType: '背景图', svgContent, fileSize: '未知'
                            });
                            processedUrls.add(imgUrl);
                        }
                    } catch (e) { /* ignore */ }
                }
    
                // CSS图片
                for (const imgUrl of cssImageUrls) {
                    try {
                        if (!imgUrl || processedUrls.has(imgUrl)) continue;
                        const fullUrl = new URL(imgUrl, window.location.href).href;
                        const originalFormat = Utils.getFileExtension(fullUrl).toLowerCase();
                        let svgContent = '';
                        if (originalFormat === 'svg') {
                            try {
                                const svgResponse = await fetch(fullUrl);
                                if (svgResponse.ok) svgContent = await svgResponse.text();
                            } catch (svgErr) { /* ignore */ }
                        }
                        const originalName = `CSS图片-${Date.now().toString().slice(-4)}`;
                        imageItems.push({
                            id: Utils.generateUniqueId(),
                            url: fullUrl, name: Utils.truncateTo4Bytes(originalName),
                            format: Utils.truncateTo4Bytes(originalFormat || CONFIG.image.defaultImageFormat),
                            width: 'CSS引用', height: 'CSS引用',
                            type: 'CSS图片',
                            preview: fullUrl, originalName, originalFormat,
                            originalType: 'CSS图片', svgContent, fileSize: '未知'
                        });
                        processedUrls.add(imgUrl);
                    } catch (e) { /* ignore */ }
                }
    
                // SVG 标签
                for (const svg of document.querySelectorAll('svg')) {
                    try {
                        const svgContent = svg.outerHTML;
                        const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
                        const svgUrl = BlobManager.createManagedBlobUrl(svgBlob);
                        const originalName = `SVG图片-${Date.now().toString().slice(-4)}`;
                        imageItems.push({
                            id: Utils.generateUniqueId(),
                            url: svgUrl, name: Utils.truncateTo4Bytes(originalName),
                            format: Utils.truncateTo4Bytes('svg'),
                            width: svg.naturalWidth || svg.width.baseVal.value || '自适应',
                            height: svg.naturalHeight || svg.height.baseVal.value || '自适应',
                            type: 'SVG标签',
                            preview: svgUrl, svgContent,
                            originalName, originalFormat: 'svg',
                            originalType: 'SVG标签', fileSize: '未知'
                        });
                    } catch (e) { /* ignore */ }
                }
            } finally {
                this.restoreHiddenElements();
            }
    
            return await Deduplication.checkAndRemoveDuplicates(imageItems, imageSignatureMap);
        }
    
        /**
         * 辅助函数：从 URL 获取文件扩展名
         * @param {string} url - 图片 URL
         * @returns {string} 文件扩展名
         */
        static getFileExtension(url) {
            const parts = url.split('.');
            if (parts.length > 1) {
                return parts.pop().split('?')[0].split('#')[0];
            }
            return '';
        }
    
        /**
         * 辅助函数：截断字符串到指定字节长度 (UTF-8)
         * @param {string} str - 原始字符串
         * @param {number} maxLength - 最大字节长度
         * @returns {string} 截断后的字符串
         */
        static truncateTo4Bytes(str, maxLength = CONFIG.image.infoTruncateLength) {
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
        }
    
        /**
         * 辅助函数：从 URL 获取图片名称
         * @param {string} url - 图片 URL
         * @param {string} alt - 图片 alt 属性
         * @returns {string} 图片名称
         */
        static getImageName(url, alt) {
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
        }
    
        /**
         * 辅助函数：确保 SVG 包含 xmlns 属性
         * @param {string} svgContent - SVG 字符串
         * @returns {string} 包含 xmlns 的 SVG 字符串
         */
        static ensureSvgNamespace(svgContent) {
            if (!svgContent.includes('xmlns="http://www.w3.org/2000/svg"')) {
                return svgContent.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
            }
            return svgContent;
        }
    
        /**
         * 辅助函数：补全图片后缀
         * @param {string} filename - 文件名
         * @param {string} format - 格式
         * @returns {string} 补全后缀的文件名
         */
        static completeImageSuffix(filename, format) {
            if (!filename) return `image.${format}`;
            if (filename.includes('.') && filename.split('.').pop().toLowerCase() === format.toLowerCase()) {
                return filename;
            }
            return `${filename}.${format}`;
        }
    
        /**
         * 辅助函数：清理文件名，移除非法字符
         * @param {string} filename - 原始文件名
         * @returns {string} 清理后的文件名
         */
        static sanitizeFilename(filename) {
            return filename.replace(/[/\\?%*:|"<>]|\s/g, '_');
        }
    }
    
    const ImageCollector = new ImageCollectorService();
    
    // ==================== src/modules/DynamicListener.js ====================
    /**
     * 动态监听模块
     * 负责监听页面的滚动和点击事件，触发图片重新扫描。
     */
    
    
    class DynamicListenerService {
        constructor() {
            this.scrollTimer = null;
            this.lastScrollHeight = document.documentElement.scrollHeight;
            this.isClickDetecting = false;
            this.appDetectNewImagesCallback = null; // 用于外部注入 App.detectNewImages
        }
    
        /**
         * 初始化事件监听器
         * @param {Function} appDetectNewImagesCallback - App 模块的 detectNewImages 方法
         */
        init(appDetectNewImagesCallback) {
            this.appDetectNewImagesCallback = appDetectNewImagesCallback;
            window.addEventListener("scroll", this._handleScroll.bind(this), { passive: true });
            document.addEventListener("click", this._handleClick.bind(this), true);
            this.lastScrollHeight = document.documentElement.scrollHeight;
        }
    
        /**
         * 处理滚动事件
         * @private
         */
        async _handleScroll() {
            clearTimeout(this.scrollTimer);
            this.scrollTimer = setTimeout(async () => {
                const currentScrollHeight = document.documentElement.scrollHeight;
                if (currentScrollHeight > this.lastScrollHeight) {
                    if (this.appDetectNewImagesCallback) {
                        await this.appDetectNewImagesCallback();
                    }
                }
                this.lastScrollHeight = currentScrollHeight; // 更新上一次的滚动高度
            }, CONFIG.ui.scrollCheckInterval);
        }
    
        /**
         * 处理点击事件
         * @param {Event} e - 点击事件对象
         * @private
         */
        _handleClick(e) {
            // 避免点击浮动按钮或模态框内部时触发
            if (e.target.closest("#rainbowFabContainer") || e.target.closest("#svgSnifferModal")) return;
    
            const isLoadButton = CONFIG.clickDetection.selectors.some(selector => e.target.closest(selector));
            if (isLoadButton && !this.isClickDetecting) {
                this.isClickDetecting = true;
                setTimeout(async () => {
                    try {
                        if (this.appDetectNewImagesCallback) {
                            await this.appDetectNewImagesCallback();
                        }
                    } finally {
                        this.isClickDetecting = false;
                    }
                }, CONFIG.ui.clickDetectDelay);
            }
        }
    
        /**
         * 销毁事件监听器
         */
        destroy() {
            window.removeEventListener("scroll", this._handleScroll);
            document.removeEventListener("click", this._handleClick, true);
            clearTimeout(this.scrollTimer);
            // Draggable.touchTimer 在 Draggable 模块中管理
        }
    }
    
    const DynamicListener = new DynamicListenerService();
    
    // ==================== src/modules/Draggable.js ====================
    /**
     * 拖拽模块
     * 负责 UI 元素的拖拽功能，支持位置记忆。
     */
    
    
    class DraggableService {
        constructor() {
            this.container = null;
            this.onClickCallback = null;
            this.isDragging = false;
            this.hasMoved = false;
            this.startX = 0;
            this.startY = 0;
            this.startLeft = 0;
            this.startTop = 0;
            this.dragStartTime = 0;
            this.touchTimer = null;
        }
    
        /**
         * 初始化拖拽功能
         * @param {HTMLElement} container - 可拖拽的 DOM 元素
         * @param {Function} onClickCallback - 点击回调函数
         */
        init(container, onClickCallback) {
            this.container = container;
            this.onClickCallback = onClickCallback;
    
            container.addEventListener("mousedown", this._handleDragStart.bind(this));
            container.addEventListener("touchstart", this._handleDragStart.bind(this), { passive: false });
        }
    
        /**
         * 处理拖拽开始
         * @param {Event} e - 事件对象
         * @private
         */
        _handleDragStart(e) {
            // 避免点击徽章时触发拖拽
            if (e.target.closest && e.target.closest(".rainbow-fab-badge")) return;
    
            e.preventDefault();
            const clientX = e.clientX || e.touches[0].clientX;
            const clientY = e.clientY || e.touches[0].clientY;
            const computedStyle = window.getComputedStyle(this.container);
    
            this.startLeft = parseInt(computedStyle.left) || 0;
            this.startTop = parseInt(computedStyle.top) || 0;
    
            // 如果是右侧定位，需要转换为 left
            if (computedStyle.right !== "auto") {
                const rightPos = parseInt(computedStyle.right);
                this.startLeft = window.innerWidth - rightPos - this.container.offsetWidth;
                this.container.style.right = "auto";
                this.container.style.left = `${this.startLeft}px`;
            }
    
            this.startX = clientX;
            this.startY = clientY;
            this.dragStartTime = Date.now();
            this.hasMoved = false;
    
            if (e.type === "touchstart") {
                this.touchTimer = setTimeout(() => {
                    this.isDragging = true;
                    this.container.style.transition = "none";
                }, CONFIG.ui.touchDelay);
            } else {
                this.isDragging = true;
                this.container.style.transition = "none";
            }
    
            document.addEventListener("mousemove", this._handleDragMove.bind(this));
            document.addEventListener("touchmove", this._handleDragMove.bind(this), { passive: false });
            document.addEventListener("mouseup", this._handleDragEnd.bind(this));
            document.addEventListener("touchend", this._handleDragEnd.bind(this));
        }
    
        /**
         * 处理拖拽移动
         * @param {Event} e - 事件对象
         * @private
         */
        _handleDragMove(e) {
            if (!this.isDragging) return;
    
            this.hasMoved = true;
            e.preventDefault();
    
            const clientX = e.clientX || e.touches[0].clientX;
            const clientY = e.clientY || e.touches[0].clientY;
    
            const newLeft = this.startLeft + clientX - this.startX;
            const newTop = this.startTop + clientY - this.startY;
    
            this.container.style.left = `${newLeft}px`;
            this.container.style.top = `${newTop}px`;
            this.container.style.right = "auto"; // 确保 right 属性被清除
            this.container.style.bottom = "auto"; // 确保 bottom 属性被清除
        }
    
        /**
         * 处理拖拽结束
         * @param {Event} e - 事件对象
         * @private
         */
        _handleDragEnd(e) {
            if (this.touchTimer) {
                clearTimeout(this.touchTimer);
                this.touchTimer = null;
            }
    
            if (!this.isDragging) {
                // 如果没有开始拖拽，但触摸时间短于延迟，则视为点击
                if (Date.now() - this.dragStartTime < CONFIG.ui.touchDelay) {
                    this.onClickCallback();
                }
                return;
            }
    
            // 如果没有移动，视为点击
            if (!this.hasMoved) {
                this.onClickCallback();
            } else {
                // 保存位置
                this._savePosition();
            }
    
            this.isDragging = false;
            this.container.style.transition = ""; // 恢复过渡效果
    
            document.removeEventListener("mousemove", this._handleDragMove.bind(this));
            document.removeEventListener("touchmove", this._handleDragMove.bind(this));
            document.removeEventListener("mouseup", this._handleDragEnd.bind(this));
            document.removeEventListener("touchend", this._handleDragEnd.bind(this));
        }
    
        /**
         * 保存按钮位置到本地存储
         * @private
         */
        _savePosition() {
            const domain = location.hostname.replace(/\./g, "-");
            const positionKey = `${CONFIG.storage.prefix}${CONFIG.storage.positionKey}_${domain}`;
            const rect = this.container.getBoundingClientRect();
            GM_setValue(positionKey, { x: rect.left, y: rect.top });
        }
    
        /**
         * 恢复保存的位置
         */
        restorePosition() {
            const domain = location.hostname.replace(/\./g, "-");
            const positionKey = `${CONFIG.storage.prefix}${CONFIG.storage.positionKey}_${domain}`;
            const savedPosition = GM_getValue(positionKey);
    
            if (savedPosition) {
                this.container.style.left = `${savedPosition.x}px`;
                this.container.style.top = `${savedPosition.y}px`;
                this.container.style.right = "auto";
                this.container.style.bottom = "auto";
            } else {
                // 默认位置：右下角
                this.container.style.right = `${CONFIG.ui.positionOffset}px`;
                this.container.style.bottom = `${CONFIG.ui.positionOffset}px`;
                this.container.style.left = "auto";
                this.container.style.top = "auto";
            }
        }
    }
    
    const Draggable = new DraggableService();
    
    // ==================== src/modules/PreviewModal.js ====================
    /**
     * 预览弹窗模块
     * 负责显示图片预览、缩放、旋转、切换等功能。
     */
    
    
    
    
    
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
    
    const PreviewModal = new PreviewModalService();
    
    // ==================== src/modules/UIRenderer.js ====================
    /**
     * UI 渲染模块
     * 负责渲染图片列表、处理筛选和排序，以及生成图片项的 DOM 结构。
     */
    
    
    
    
    
    class UIRendererService {
        constructor() {
            this.imageItemCache = new Map(); // 用于存储图片项的完整信息
        }
    
        /**
         * 渲染图片列表
         * @param {Array<Object>} items - 要渲染的图片项数组
         * @param {Map<string, Object>} imageItemCache - 图片缓存 Map
         */
        renderImageList(items, imageItemCache) {
            const svgList = document.getElementById("svgList");
            if (!svgList) return;
    
            svgList.innerHTML = ""; // 清空现有列表
            this.imageItemCache = imageItemCache; // 更新缓存引用
    
            if (items.length === 0) {
                svgList.innerHTML = 
                    `<div class="loading" style="text-align: center; padding: 20px; color: #888;">
                        没有找到任何图片资源
                    </div>`;
                return;
            }
    
            const fragment = document.createDocumentFragment();
            items.forEach(item => {
                fragment.appendChild(this.createImageItemElement(item));
            });
            svgList.appendChild(fragment);
        }
    
        /**
         * 创建单个图片项的 DOM 元素
         * @param {Object} item - 图片信息对象
         * @returns {HTMLElement} 图片项的 DOM 元素
         */
        createImageItemElement(item) {
            const itemDiv = document.createElement("div");
            itemDiv.className = "svg-item";
            itemDiv.dataset.id = item.id;
    
            const checkboxId = `checkbox-${item.id}`;
            const previewSrc = item.preview || item.url;
    
            itemDiv.innerHTML = `
                <div class="item-checkbox">
                    <input type="checkbox" id="${checkboxId}" class="svg-checkbox" data-id="${item.id}">
                    <label for="${checkboxId}"></label>
                </div>
                <div class="item-preview" data-id="${item.id}">
                    ${item.format === "svg" && item.svgContent
                        ? `<div class="svg-content-preview">${Utils.ensureSvgNamespace(item.svgContent)}</div>`
                        : `<img src="${previewSrc}" alt="${item.name}" loading="lazy">`
                    }
                </div>
                <div class="item-info">
                    <div class="info-row">
                        <span class="info-name" title="${item.originalName || item.name}">${item.name}</span>
                        <span class="info-format">${String(item.format).toUpperCase()}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-size">${item.width} × ${item.height}</span>
                        <span class="info-type">${item.type}</span>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="action-btn preview-btn" data-id="${item.id}" title="预览">${Icons.eye}</button>
                    <button class="action-btn download-btn" data-id="${item.id}" title="下载">${Icons.download}</button>
                    <button class="action-btn copy-btn" data-id="${item.id}" title="复制链接">${Icons.copy}</button>
                </div>
            `;
    
            // 添加事件监听器
            itemDiv.querySelector(".item-preview").addEventListener("click", (e) => {
                const id = e.currentTarget.dataset.id;
                const item = this.imageItemCache.get(id);
                if (item) PreviewModal.show(item, Array.from(this.imageItemCache.values()), Array.from(this.imageItemCache.values()).indexOf(item));
            });
    
            itemDiv.querySelector(".preview-btn").addEventListener("click", (e) => {
                const id = e.currentTarget.dataset.id;
                const item = this.imageItemCache.get(id);
                if (item) PreviewModal.show(item, Array.from(this.imageItemCache.values()), Array.from(this.imageItemCache.values()).indexOf(item));
            });
    
            itemDiv.querySelector(".download-btn").addEventListener("click", (e) => {
                const id = e.currentTarget.dataset.id;
                const item = this.imageItemCache.get(id);
                if (item) Downloader.downloadImage(item, item.originalName, item.originalFormat);
            });
    
            itemDiv.querySelector(".copy-btn").addEventListener("click", (e) => {
                const id = e.currentTarget.dataset.id;
                const item = this.imageItemCache.get(id);
                if (item) {
                    // 假设 Clipboard 模块存在并提供 copyUrls 方法
                    // Clipboard.copyUrls([item]);
                    if (CONFIG.features.enableNotifications) Notification.show("复制功能待实现", "info");
                }
            });
    
            return itemDiv;
        }
    
        /**
         * 应用筛选和排序
         * @param {Array<Object>} items - 原始图片项数组
         * @param {string} searchTerm - 搜索关键词
         * @param {string} sortBy - 排序方式
         * @param {string} formatFilter - 格式筛选
         * @returns {Array<Object>} 筛选和排序后的图片项数组
         */
        applyFilterAndSort(items, searchTerm, sortBy, formatFilter) {
            let filtered = [...items];
    
            // 搜索过滤
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                filtered = filtered.filter(item =>
                    (item.originalName || item.name || "").toLowerCase().includes(term) ||
                    (item.url || "").toLowerCase().includes(term)
                );
            }
    
            // 格式过滤
            if (formatFilter && formatFilter !== "all") {
                filtered = filtered.filter(item =>
                    (item.originalFormat || item.format || "").toLowerCase() === formatFilter.toLowerCase()
                );
            }
    
            // 排序
            switch (sortBy) {
                case "name-asc":
                    filtered.sort((a, b) => (a.originalName || a.name).localeCompare(b.originalName || b.name));
                    break;
                case "name-desc":
                    filtered.sort((a, b) => (b.originalName || b.name).localeCompare(a.originalName || a.name));
                    break;
                case "format":
                    filtered.sort((a, b) => (a.format || "").localeCompare(b.format || ""));
                    break;
                case "type":
                    filtered.sort((a, b) => (a.type || "").localeCompare(b.type || ""));
                    break;
                default:
                    break;
            }
    
            return filtered;
        }
    }
    
    const UIRenderer = new UIRendererService();
    
    // ==================== src/modules/Clipboard.js ====================
    /**
     * 剪贴板模块
     * 负责复制图片链接到剪贴板。
     */
    
    
    
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
    
    const Clipboard = new ClipboardService();
    
    // ==================== src/modules/DOMBuilder.js ====================
    /**
     * DOM 构建模块
     * 负责创建和管理所有 UI 元素的 DOM 结构。
     */
    
    
    
    
    
    class DOMBuilderService {
        constructor() {
            this.modal = null;
            this.previewModal = null;
            this.batchProgressOverlay = null;
        }
    
        /**
         * 创建浮动按钮
         * @returns {{container: HTMLElement, fab: HTMLElement, icon: HTMLElement, badge: HTMLElement}}
         */
        createFabButton() {
            const container = document.createElement("div");
            container.id = "rainbowFabContainer";
            container.className = "rainbow-fab-container";
    
            const fab = document.createElement("button");
            fab.className = "rainbow-fab";
            fab.title = "网页图片采集器";
    
            const fabInner = document.createElement("div");
            fabInner.className = "rainbow-fab-inner";
    
            const icon = document.createElement("div");
            icon.className = "rainbow-fab-icon";
            icon.innerHTML = Icons.camera; // 使用相机图标
    
            const badge = document.createElement("span");
            badge.className = "rainbow-fab-badge";
            badge.textContent = "0";
            badge.style.display = "none";
    
            fabInner.appendChild(icon);
            fab.appendChild(fabInner);
            fab.appendChild(badge);
            container.appendChild(fab);
            document.body.appendChild(container);
    
            // 注入样式
            GM_addStyle(Styles.fabStyles);
    
            return { container, fab, icon, badge };
        }
    
        /**
         * 创建主模态框
         * @returns {HTMLElement}
         */
        createMainModal() {
            if (this.modal) return this.modal;
    
            const modal = document.createElement("div");
            modal.id = "svgSnifferModal";
            modal.className = "svg-sniffer-modal";
            modal.innerHTML = `
                <div class="modal-header">
                    <h2>${Icons.camera} 网页图片采集器 Pro</h2>
                    <button class="close-btn" title="关闭">${Icons.close}</button>
                </div>
                <div class="action-bar">
                    <div class="select-all-control">
                        <input type="checkbox" id="selectAll">
                        <label for="selectAll">全选</label>
                        <span id="imageCount">0</span> 张图片
                    </div>
                    <div class="action-buttons">
                        <button class="action-btn batch-download-btn" id="batchDownloadBtn" title="批量下载">${Icons.download} 批量下载</button>
                        <button class="action-btn copy-btn" id="batchCopyBtn" title="复制所有选中图片链接">${Icons.copy} 复制链接</button>
                        <button class="action-btn invert-select-btn" id="invertSelectBtn" title="反选">${Icons.invert}</button>
                        <div class="batch-mode-toggle">
                            <button id="batchModeZip" class="toggle-btn active" title="打包为ZIP">ZIP</button>
                            <button id="batchModeSingle" class="toggle-btn" title="单文件下载">单文件</button>
                        </div>
                    </div>
                </div>
                <div class="search-bar">
                    <div class="search-input-wrapper">
                        ${Icons.search}
                        <input type="text" id="searchInput" placeholder="搜索图片名称或URL...">
                    </div>
                    <select id="sortSelect" title="排序方式">
                        <option value="default">默认排序</option>
                        <option value="name-asc">名称升序</option>
                        <option value="name-desc">名称降序</option>
                        <option value="format">按格式</option>
                        <option value="type">按类型</option>
                    </select>
                    <select id="formatFilter" title="格式筛选">
                        <option value="all">所有格式</option>
                        ${CONFIG.image.supportFormats.map(f => `<option value="${f}">${f.toUpperCase()}</option>`).join("")}
                    </select>
                    <div class="view-toggle">
                        <button id="listViewBtn" class="toggle-btn active" title="列表视图">${Icons.list}</button>
                        <button id="gridViewBtn" class="toggle-btn" title="网格视图">${Icons.grid}</button>
                    </div>
                    <div class="dedupe-toggle">
                        <input type="checkbox" id="dedupeToggle" ${CONFIG.deduplication.enabled ? "checked" : ""}>
                        <label for="dedupeToggle" title="智能去重">${Icons.dedupe}</label>
                    </div>
                </div>
                <div class="modal-content">
                    <div id="svgList" class="image-list"></div>
                </div>
            `;
            document.body.appendChild(modal);
            this.modal = modal;
    
            // 注入样式
            GM_addStyle(Styles.modalStyles);
            GM_addStyle(Styles.actionBarStyles);
            GM_addStyle(Styles.searchBarStyles);
            GM_addStyle(Styles.imageListStyles);
    
            return modal;
        }
    
        /**
         * 创建图片预览模态框
         * @returns {HTMLElement}
         */
        createPreviewModal() {
            if (this.previewModal) return this.previewModal;
    
            const modal = document.createElement("div");
            modal.id = "imagePreviewModal";
            modal.className = "image-preview-modal";
            modal.innerHTML = `
                <div class="preview-header">
                    <div class="preview-info">
                        <span id="previewTitle" class="preview-title"></span>
                        <span id="previewSubtitle" class="preview-subtitle"></span>
                    </div>
                    <button id="previewClose" class="close-btn" title="关闭">${Icons.close}</button>
                </div>
                <div class="preview-stage" id="previewStage">
                    <div class="preview-img-wrapper" id="previewImgWrapper"></div>
                    <div class="preview-nav prev" id="previewPrev" title="上一张">${Icons.arrowLeft}</div>
                    <div class="preview-nav next" id="previewNext" title="下一张">${Icons.arrowRight}</div>
                    <div class="preview-zoom-indicator" id="previewZoomIndicator"></div>
                </div>
                <div class="preview-footer">
                    <div class="preview-toolbar">
                        <button id="previewZoomOut" title="缩小">${Icons.zoomOut}</button>
                        <button id="previewZoomIn" title="放大">${Icons.zoomIn}</button>
                        <button id="previewRotate" title="旋转">${Icons.rotate}</button>
                        <button id="previewReset" title="重置">${Icons.reset}</button>
                    </div>
                    <div class="preview-meta">
                        <span id="previewInfoFormat">-</span>
                        <span id="previewInfoSize">-</span>
                        <span id="previewInfoFilesize">-</span>
                        <span id="previewCounter">1 / 1</span>
                    </div>
                    <div class="preview-actions">
                        <button id="previewDownload" class="action-btn" title="下载">${Icons.download} 下载</button>
                        <button id="previewCopy" class="action-btn" title="复制链接">${Icons.copy} 复制</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            this.previewModal = modal;
    
            // 注入样式
            GM_addStyle(Styles.previewModalStyles);
    
            return modal;
        }
    
        /**
         * 创建批量下载进度覆盖层
         * @returns {HTMLElement}
         */
        createBatchProgressOverlay() {
            if (this.batchProgressOverlay) return this.batchProgressOverlay;
    
            const overlay = document.createElement("div");
            overlay.id = "batchProgressOverlay";
            overlay.className = "batch-progress-overlay";
            overlay.innerHTML = `
                <div class="progress-card">
                    <h3>${Icons.download} 批量下载进度</h3>
                    <div class="progress-bar-container">
                        <div class="progress-bar" id="batchProgressBar"></div>
                    </div>
                    <p>已完成: <span id="batchProgressCurrent">0</span> / <span id="batchProgressTotal">0</span></p>
                    <p>成功: <span id="batchProgressOk" style="color: #28a745;">0</span> 失败: <span id="batchProgressFail" style="color: #dc3545;">0</span></p>
                    <p id="batchProgressStatus">正在准备...</p>
                    <button id="batchProgressCancel" class="action-btn cancel-btn">取消下载</button>
                </div>
            `;
            document.body.appendChild(overlay);
            this.batchProgressOverlay = overlay;
    
            // 注入样式
            GM_addStyle(Styles.batchProgressStyles);
    
            return overlay;
        }
    
        /**
         * 创建全局覆盖层 (用于模态框背景)
         * @returns {HTMLElement}
         */
        createOverlay() {
            const overlay = document.createElement("div");
            overlay.className = "rainbow-overlay";
            document.body.appendChild(overlay);
    
            // 注入样式
            GM_addStyle(Styles.overlayStyles);
    
            return overlay;
        }
    
        /**
         * 格式化文件大小
         * @param {number} bytes - 字节数
         * @returns {string}
         */
        static formatFileSize(bytes) {
            if (bytes === 0) return "0 B";
            const k = 1024;
            const sizes = ["B", "KB", "MB", "GB", "TB"];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
        }
    }
    
    const DOMBuilder = new DOMBuilderService();
    
    // ==================== src/modules/App.js ====================
    /**
     * 主应用模块
     * 负责初始化、协调各个模块，并处理整体逻辑。
     */
    
    
    
    
    
    
    
    
    
    
    
    
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
    
    const App = new AppService();
    
    // 初始化应用
    window.addEventListener('load', function() {
        App.init();
    });

    // 如果页面已加载，立即初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            App.init();
        });
    } else {
        App.init();
    }
})();
