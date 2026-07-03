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
