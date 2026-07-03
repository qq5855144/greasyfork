// ==UserScript==
// @name         网页图片采集器 Pro
// @namespace    http://tampermonkey.net/
// @version      v2.2
// @description  支持动态加载、智能去重、大图预览的网页图片下载工具 | 七彩毛玻璃UI
// @author       YourName
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_setClipboard
// @grant        GM_notification
// @grant        GM_download
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
// @icon         https://cdn-icons-png.flaticon.com/512/2107/2107957.png
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 配置模块 ====================
    const CONFIG = {
        buttonSize: 36,
        zIndex: 99999,
        positionOffset: 20,
        touchDelay: 300,
        supportFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico', 'avif'],
        maxPreviewSize: 48,
        loadTimeout: 5000,
        infoTruncateLength: 4,
        panelSafeMargin: '16px',
        panelMinSize: '380px',
        defaultImageFormat: 'png',
        fixedFontSize: '11px',
        scrollCheckInterval: 500,
        clickDetectDelay: 1500,
        clickLoadSelectors: [
            '.load-more', '.load-btn', '.next-page', '.load-more-btn',
            '[data-action="load-more"]', '[class*="load"]', '[class*="more"]',
            '.pagination-next', '.next-btn', '.load-additional'
        ],
        maxBlobUrlCount: 100,
        blobCleanupNotification: true,
        previewZoom: {
            maxWidth: '92vw',
            maxHeight: '85vh',
            background: 'rgba(0,0,0,0.85)',
            closeButtonSize: '40px',
            headerHeight: '56px',
            footerHeight: '64px'
        },
        deduplication: {
            enabled: true,
            similarityThreshold: 0.95,
            checkContent: true,
            maxFileSizeForCheck: 5 * 1024 * 1024,
            urlNormalization: true
        },
        // 七彩毛玻璃配色
        rainbowColors: [
            '#ff6b6b', '#ff9f43', '#feca57', '#54a0ff',
            '#5f27cd', '#ff6fb7', '#00d2d3', '#1dd1a1'
        ],
        glassOpacity: 0.75,
        glassBlur: '20px',
        glassBorder: 'rgba(255,255,255,0.25)',
        panelBg: 'rgba(255,255,255,0.72)',
        panelBgDark: 'rgba(30,30,40,0.88)'
    };

    // ==================== 全局样式注入 ====================
    GM_addStyle(`
        /* ===== 七彩毛玻璃基础样式 ===== */
        #svgSnifferModal,
        #svgSnifferModal * {
            font-size: ${CONFIG.fixedFontSize} !important;
            line-height: 1.45 !important;
            box-sizing: border-box;
        }

        /* ===== 悬浮按钮 - 七彩毛玻璃设计 ===== */
        .rainbow-fab-container {
            position: fixed;
            z-index: ${CONFIG.zIndex};
            cursor: move;
            transition: transform 0.2s;
            touch-action: none;
            user-select: none;
        }
        .rainbow-fab {
            width: ${CONFIG.buttonSize}px;
            height: ${CONFIG.buttonSize}px;
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
        .rainbow-fab:hover {
            transform: scale(1.08);
            filter: drop-shadow(0 10px 24px rgba(0,0,0,0.35));
        }
        .rainbow-fab:active {
            transform: scale(0.94);
        }
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

        @keyframes rainbow-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* ===== 主面板 - 七彩毛玻璃设计 ===== */
        #svgSnifferModal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            margin: ${CONFIG.panelSafeMargin};
            max-width: calc(100vw - 2 * ${CONFIG.panelSafeMargin});
            max-height: calc(100vh - 2 * ${CONFIG.panelSafeMargin});
            min-width: ${CONFIG.panelMinSize};
            min-height: ${CONFIG.panelMinSize};
            width: auto;
            height: auto;
            z-index: 100000;
            display: none;
            flex-direction: column;
            font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif;
            overflow: hidden;
            border-radius: 18px;
            background: ${CONFIG.panelBg};
            backdrop-filter: blur(${CONFIG.glassBlur});
            -webkit-backdrop-filter: blur(${CONFIG.glassBlur});
            box-shadow:
                0 8px 40px rgba(0,0,0,0.18),
                0 2px 8px rgba(0,0,0,0.08),
                inset 0 1px 0 rgba(255,255,255,0.5);
            border: 1.5px solid ${CONFIG.glassBorder};
        }
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
        @keyframes rainbow-border-shift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }

        /* 面板内部需要在彩虹边框之上 */
        #svgSnifferModal > * {
            position: relative;
            z-index: 1;
        }

        /* ===== 面板头部 - 七彩毛玻璃 ===== */
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
        @keyframes rainbow-header-shift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }
        .modal-header h2 {
            margin: 0;
            font-weight: 700;
            font-size: 13px !important;
            letter-spacing: 0.5px;
        }
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

        /* ===== 操作栏 - 毛玻璃 ===== */
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
        .select-all-control {
            display: flex;
            align-items: center;
            gap: 6px;
            font-weight: 500;
        }
        .select-all-control input[type="checkbox"] {
            width: 16px;
            height: 16px;
            accent-color: #ff6b6b;
        }
        .action-buttons {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            align-items: center;
        }
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
            background: linear-gradient(135deg, rgba(255,111,183,0.75), rgba(255,107,107,0.75));
            text-shadow: 0 1px 2px rgba(0,0,0,0.15);
        }
        .filter-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 14px rgba(255,111,183,0.35);
        }
        .dedupe-control {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-left: 4px;
        }
        .dedupe-toggle {
            width: 15px;
            height: 15px;
            cursor: pointer;
            accent-color: #ff6b6b;
        }
        .dedupe-label {
            color: #555;
            font-size: 10px;
            white-space: nowrap;
        }

        /* ===== 搜索栏 ===== */
        .search-bar {
            display: flex;
            gap: 6px;
            padding: 8px 18px;
            background: rgba(255,255,255,0.5);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border-bottom: 1px solid rgba(0,0,0,0.05);
            flex-shrink: 0;
        }
        .search-input {
            flex: 1;
            padding: 6px 12px;
            border: 1px solid rgba(0,0,0,0.12);
            border-radius: 8px;
            font-size: 11px !important;
            background: rgba(255,255,255,0.7);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            outline: none;
            transition: all 0.25s;
        }
        .search-input:focus {
            border-color: rgba(255,107,107,0.5);
            box-shadow: 0 0 0 3px rgba(255,107,107,0.1);
            background: rgba(255,255,255,0.9);
        }
        .sort-select {
            padding: 6px 8px;
            border: 1px solid rgba(0,0,0,0.12);
            border-radius: 8px;
            font-size: 10px !important;
            background: rgba(255,255,255,0.7);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            outline: none;
            cursor: pointer;
        }
        .format-filter {
            padding: 6px 8px;
            border: 1px solid rgba(0,0,0,0.12);
            border-radius: 8px;
            font-size: 10px !important;
            background: rgba(255,255,255,0.7);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            outline: none;
            cursor: pointer;
        }
        .view-toggle {
            display: flex;
            gap: 4px;
        }
        .view-btn {
            width: 28px;
            height: 28px;
            border: 1px solid rgba(0,0,0,0.12);
            border-radius: 6px;
            background: rgba(255,255,255,0.6);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            font-size: 10px;
        }
        .view-btn svg {
            width: 14px;
            height: 14px;
            fill: currentColor;
        }
        .view-btn.active {
            background: linear-gradient(135deg, rgba(255,107,107,0.3), rgba(255,159,67,0.3));
            border-color: rgba(255,107,107,0.4);
            color: #ff6b6b;
        }

        /* ===== 内容区 ===== */
        .modal-content {
            padding: 12px;
            overflow-y: auto;
            flex-grow: 1;
            min-height: 0;
            background: rgba(255,255,255,0.3);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
        }
        .modal-content::-webkit-scrollbar {
            width: 6px;
        }
        .modal-content::-webkit-scrollbar-track {
            background: transparent;
            border-radius: 3px;
        }
        .modal-content::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, #ff6b6b, #ff9f43, #54a0ff);
            border-radius: 3px;
        }

        /* ===== 图片列表项 - 毛玻璃卡片 ===== */
        .svg-item {
            display: flex;
            align-items: center;
            padding: 10px 12px;
            margin-bottom: 6px;
            border-radius: 12px;
            background: rgba(255,255,255,0.55);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border: 1px solid rgba(255,255,255,0.5);
            transition: all 0.3s;
            justify-content: space-between;
            gap: 10px;
            min-width: 0;
        }
        .svg-item:hover {
            background: rgba(255,255,255,0.75);
            transform: translateY(-1px);
            box-shadow: 0 4px 16px rgba(0,0,0,0.08);
            border-color: rgba(255,107,107,0.3);
        }
        .svg-item.selected {
            background: rgba(255,107,107,0.08);
            border-color: rgba(255,107,107,0.35);
            box-shadow: 0 0 0 2px rgba(255,107,107,0.1);
        }
        .svg-checkbox {
            width: 17px;
            height: 17px;
            cursor: pointer;
            flex-shrink: 0;
            accent-color: #ff6b6b;
        }
        .svg-preview {
            width: ${CONFIG.maxPreviewSize}px;
            height: ${CONFIG.maxPreviewSize}px;
            border: 1px solid rgba(0,0,0,0.08);
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 10px;
            background-image:
                linear-gradient(45deg, rgba(0,0,0,0.03) 25%, transparent 25%),
                linear-gradient(-45deg, rgba(0,0,0,0.03) 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, rgba(0,0,0,0.03) 75%),
                linear-gradient(-45deg, transparent 75%, rgba(0,0,0,0.03) 75%);
            background-size: 8px 8px;
            background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
            background-color: rgba(255,255,255,0.5);
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            overflow: hidden;
            flex-shrink: 0;
            min-width: ${CONFIG.maxPreviewSize}px;
            min-height: ${CONFIG.maxPreviewSize}px;
            position: relative;
            cursor: pointer;
            transition: all 0.3s;
        }
        .svg-preview:hover {
            transform: scale(1.08);
            box-shadow: 0 6px 18px rgba(0,0,0,0.12);
            border-color: rgba(255,107,107,0.25);
        }
        .svg-preview svg {
            width: 100% !important;
            height: 100% !important;
            object-fit: contain !important;
            display: block !important;
            max-width: ${CONFIG.maxPreviewSize}px !important;
            max-height: ${CONFIG.maxPreviewSize}px !important;
        }
        .svg-preview img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            display: block;
            border-radius: 10px;
        }
        .svg-info {
            flex-grow: 1;
            min-width: 0;
        }
        .svg-name {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #2c3e50;
            font-weight: 600;
            margin-bottom: 2px;
            max-width: 120px;
            font-size: 10px !important;
        }
        .svg-meta {
            color: #777;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            font-size: 9px !important;
        }
        .svg-meta span {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 80px;
        }
        .svg-size {
            color: #ff6b6b;
            font-weight: 600;
        }
        .item-download-btn {
            padding: 5px 12px;
            background: linear-gradient(135deg, rgba(255,107,107,0.8), rgba(255,159,67,0.8));
            color: #fff;
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 8px;
            cursor: pointer;
            white-space: nowrap;
            flex-shrink: 0;
            transition: all 0.25s;
            font-size: 10px !important;
            font-weight: 600;
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            text-shadow: 0 1px 1px rgba(0,0,0,0.1);
        }
        .item-download-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 3px 10px rgba(255,107,107,0.3);
        }

        /* ===== 遮罩层 ===== */
        .rainbow-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 99999;
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
        }

        /* ===== 大图预览 - 毛玻璃设计 ===== */
        #imagePreviewModal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: ${CONFIG.previewZoom.background};
            z-index: 100001;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
        }
        .preview-container {
            position: relative;
            width: ${CONFIG.previewZoom.maxWidth};
            height: ${CONFIG.previewZoom.maxHeight};
            display: flex;
            flex-direction: column;
            background: rgba(255,255,255,0.78);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.35);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255,255,255,0.4);
        }
        .preview-container::before {
            content: '';
            position: absolute;
            inset: -1px;
            border-radius: 17px;
            padding: 1px;
            background: linear-gradient(
                135deg, #ff6b6b, #ff9f43, #feca57, #54a0ff,
                #5f27cd, #ff6fb7, #00d2d3, #1dd1a1
            );
            background-size: 200% 200%;
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
            animation: rainbow-border-shift 6s ease infinite;
            pointer-events: none;
        }
        .preview-header {
            width: 100%;
            height: ${CONFIG.previewZoom.headerHeight};
            padding: 0 18px;
            background: linear-gradient(
                135deg,
                rgba(255,107,107,0.5),
                rgba(255,159,67,0.45),
                rgba(84,160,255,0.45),
                rgba(95,39,205,0.45)
            );
            background-size: 200% 200%;
            animation: rainbow-header-shift 8s ease infinite;
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-bottom: 1px solid rgba(255,255,255,0.3);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
            box-sizing: border-box;
            position: relative;
            z-index: 1;
        }
        .preview-title {
            font-weight: 600;
            color: #fff;
            font-size: 13px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: calc(100% - 60px);
            text-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }
        .preview-close {
            background: rgba(255,255,255,0.15);
            border: 1px solid rgba(255,255,255,0.3);
            cursor: pointer;
            color: #fff;
            width: ${CONFIG.previewZoom.closeButtonSize};
            height: ${CONFIG.previewZoom.closeButtonSize};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.25s;
            flex-shrink: 0;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
        }
        .preview-close svg {
            pointer-events: none;
        }
        .preview-close:hover {
            background: rgba(255,255,255,0.35);
            transform: rotate(90deg) scale(1.1);
        }
        .preview-content {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: auto;
            padding: 16px;
            box-sizing: border-box;
            min-height: 0;
            position: relative;
            z-index: 1;
        }
        .preview-image {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
        .preview-svg {
            max-width: 100%;
            max-height: 100%;
            border-radius: 10px;
        }
        .preview-nav {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            width: 42px;
            height: 42px;
            border-radius: 50%;
            background: rgba(255,255,255,0.2);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border: 1px solid rgba(255,255,255,0.35);
            color: #fff;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.25s;
            z-index: 5;
            font-size: 18px;
            pointer-events: auto;
        }
        .preview-nav:hover {
            background: rgba(255,255,255,0.35);
            transform: translateY(-50%) scale(1.1);
            box-shadow: 0 0 16px rgba(255,255,255,0.25);
        }
        .preview-nav:active {
            transform: translateY(-50%) scale(0.95);
        }
        .preview-nav.prev {
            left: 12px;
        }
        .preview-nav.next {
            right: 12px;
        }
        .preview-nav svg {
            width: 20px;
            height: 20px;
            fill: #fff;
        }
        .preview-nav.disabled {
            opacity: 0.3;
            pointer-events: none;
            cursor: default;
        }
        .preview-counter {
            position: absolute;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            color: #fff;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 11px;
            z-index: 5;
            pointer-events: none;
            border: 1px solid rgba(255,255,255,0.2);
        }
        .preview-footer {
            width: 100%;
            height: ${CONFIG.previewZoom.footerHeight};
            padding: 0 18px;
            background: rgba(255,255,255,0.5);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-top: 1px solid rgba(255,255,255,0.4);
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
            flex-shrink: 0;
            box-sizing: border-box;
            position: relative;
            z-index: 1;
        }
        .preview-btn {
            padding: 8px 18px;
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 11px;
            transition: all 0.25s;
            white-space: nowrap;
            color: #fff;
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            text-shadow: 0 1px 1px rgba(0,0,0,0.1);
        }
        .preview-download {
            background: linear-gradient(135deg, rgba(29,209,161,0.8), rgba(0,210,211,0.8));
        }
        .preview-download:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(29,209,161,0.35);
        }
        .preview-copy {
            background: linear-gradient(135deg, rgba(84,160,255,0.8), rgba(95,39,205,0.8));
        }
        .preview-copy:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(84,160,255,0.35);
        }

        /* ===== 通知 - 毛玻璃 ===== */
        .copy-notification {
            position: fixed;
            top: 30px;
            left: 50%;
            transform: translateX(-50%);
            padding: 10px 22px;
            border-radius: 10px;
            z-index: 100000;
            opacity: 0;
            transition: opacity 0.4s;
            pointer-events: none;
            white-space: nowrap;
            font-weight: 600;
            font-size: 12px;
            color: #fff;
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            border: 1px solid rgba(255,255,255,0.3);
            text-shadow: 0 1px 2px rgba(0,0,0,0.15);
            box-shadow: 0 4px 20px rgba(0,0,0,0.18);
        }

        /* ===== 加载动画 ===== */
        .loading {
            text-align: center;
            padding: 30px;
            color: #888;
            font-size: 11px !important;
        }
        .loading::after {
            content: '';
            display: inline-block;
            width: 16px;
            height: 16px;
            margin-left: 8px;
            border: 2px solid rgba(255,107,107,0.3);
            border-top-color: #ff6b6b;
            border-radius: 50%;
            animation: rainbow-spin 1s linear infinite;
            vertical-align: middle;
        }

        .temp-visible-for-scan {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            position: absolute !important;
            top: -9999px !important;
            left: -9999px !important;
            width: auto !important;
            height: auto !important;
        }

        /* ===== 网格视图 ===== */
        .modal-content.grid-view {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-content: flex-start;
        }
        .modal-content.grid-view .svg-item {
            flex-direction: column;
            width: calc(33.33% - 8px);
            min-width: 120px;
            padding: 10px;
            gap: 6px;
            text-align: center;
        }
        .modal-content.grid-view .svg-preview {
            width: 72px;
            height: 72px;
            min-width: 72px;
            min-height: 72px;
        }
        .modal-content.grid-view .svg-info {
            text-align: center;
        }
        .modal-content.grid-view .svg-name {
            max-width: 100px;
            margin: 0 auto;
        }
        .modal-content.grid-view .item-download-btn {
            width: 100%;
        }

        /* ===== 响应式 ===== */
        @media (max-width: 600px) {
            #svgSnifferModal {
                margin: 4px;
                max-width: calc(100vw - 8px);
                max-height: calc(100vh - 8px);
                min-width: 300px;
                border-radius: 14px;
            }
            .action-bar {
                flex-direction: column;
                align-items: stretch;
                gap: 6px;
            }
            .action-buttons {
                justify-content: center;
            }
            .search-bar {
                flex-wrap: wrap;
            }
            .modal-content.grid-view .svg-item {
                width: calc(50% - 6px);
            }
        }
    `);

    // ==================== 工具函数模块 ====================
    const Utils = {
        truncateTo4Bytes(text) {
            if (!text || typeof text !== 'string') return '';
            let byteCount = 0;
            let result = '';
            for (let i = 0; i < text.length; i++) {
                const charBytes = /[\u4e00-\u9fa5]/.test(text[i]) ? 2 : 1;
                if (byteCount + charBytes > CONFIG.infoTruncateLength) break;
                result += text[i];
                byteCount += charBytes;
                if (byteCount === CONFIG.infoTruncateLength) break;
            }
            return result;
        },

        completeImageSuffix(fileName, originalFormat) {
            const extMatch = fileName.match(/\.([^.]+)$/);
            const hasValidSuffix = extMatch
                ? CONFIG.supportFormats.includes(extMatch[1].toLowerCase())
                : false;
            if (hasValidSuffix) return fileName;
            const targetFormat = (originalFormat && CONFIG.supportFormats.includes(originalFormat.toLowerCase()))
                ? originalFormat.toLowerCase()
                : CONFIG.defaultImageFormat;
            return fileName.endsWith('.')
                ? `${fileName}${targetFormat}`
                : `${fileName}.${targetFormat}`;
        },

        getFileExtension(url) {
            try {
                const path = new URL(url).pathname;
                const lastPart = path.split('/').pop();
                const extMatch = lastPart.match(/\.([^.]+)$/);
                return extMatch ? extMatch[1].toLowerCase() : '';
            } catch {
                return '';
            }
        },

        getImageName(url, altText) {
            if (altText && altText.trim()) return altText.trim();
            try {
                const path = new URL(url).pathname;
                const fileName = path.split('/').pop().split('?')[0].split('#')[0];
                return fileName || `未知图片-${Date.now().toString().slice(-6)}`;
            } catch {
                return `未知图片-${Date.now().toString().slice(-6)}`;
            }
        },

        normalizeUrl(url) {
            try {
                const urlObj = new URL(url, window.location.href);
                const paramsToRemove = ['v', 'version', 'ts', 'timestamp', 't', 'time', 'width', 'height', 'size'];
                paramsToRemove.forEach(param => {
                    if (urlObj.searchParams.has(param)) urlObj.searchParams.delete(param);
                });
                return urlObj.href;
            } catch {
                return url;
            }
        },

        async simpleHash(arrayBuffer) {
            const hashBuffer = await crypto.subtle.digest('SHA-1', arrayBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
        },

        formatFileSize(bytes) {
            if (!bytes || bytes === '未知') return '未知';
            const n = parseInt(bytes);
            if (isNaN(n)) return '未知';
            if (n < 1024) return n + 'B';
            if (n < 1048576) return (n / 1024).toFixed(1) + 'KB';
            return (n / 1048576).toFixed(1) + 'MB';
        },

        debounce(fn, delay) {
            let timer;
            return function(...args) {
                clearTimeout(timer);
                timer = setTimeout(() => fn.apply(this, args), delay);
            };
        }
    };

    // ==================== SVG处理模块 ====================
    const SVGProcessor = {
        processForPreview(svgContent) {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(svgContent, 'image/svg+xml');
                const svgElement = doc.documentElement;
                svgElement.removeAttribute('width');
                svgElement.removeAttribute('height');
                const viewBox = svgElement.getAttribute('viewBox') || `0 0 ${CONFIG.maxPreviewSize} ${CONFIG.maxPreviewSize}`;
                svgElement.setAttribute('viewBox', viewBox);
                svgElement.setAttribute('style', 'width:100%;height:100%;object-fit:contain;');
                return svgElement.outerHTML;
            } catch (error) {
                console.warn('SVG处理失败，使用原始内容:', error);
                return svgContent;
            }
        },

        normalizeContent(svgContent) {
            if (!svgContent) return '';
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(svgContent, 'image/svg+xml');
                const svgElement = doc.documentElement;
                const attributesToRemove = ['id', 'class', 'style'];
                attributesToRemove.forEach(attr => {
                    if (svgElement.hasAttribute(attr)) svgElement.removeAttribute(attr);
                });
                const paths = svgElement.querySelectorAll('path');
                paths.forEach(path => {
                    if (path.hasAttribute('d')) {
                        const d = path.getAttribute('d')
                            .replace(/\s+/g, ' ')
                            .replace(/([a-zA-Z])\s+/g, '$1')
                            .trim();
                        path.setAttribute('d', d);
                    }
                });
                return svgElement.outerHTML;
            } catch (error) {
                console.warn('SVG标准化失败:', error);
                return svgContent;
            }
        }
    };

    // ==================== 去重模块 ====================
    const Deduplication = {
        async generateContentSignature(url) {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const contentLength = response.headers.get('content-length');
                if (contentLength && parseInt(contentLength) > CONFIG.deduplication.maxFileSizeForCheck) {
                    return 'oversized';
                }
                const blob = await response.blob();
                const arrayBuffer = await blob.arrayBuffer();
                const hash = await Utils.simpleHash(arrayBuffer);
                return `content-${hash}`;
            } catch (error) {
                return `error-${error.message}`;
            }
        },

        async generateImageSignature(imgItem) {
            const urlSignature = Utils.normalizeUrl(imgItem.url);
            if (CONFIG.deduplication.checkContent &&
                !imgItem.url.startsWith('blob:') &&
                !imgItem.url.startsWith('data:')) {
                try {
                    const contentSignature = await this.generateContentSignature(imgItem.url);
                    return `${urlSignature}|${contentSignature}`;
                } catch (error) {
                    console.warn('内容签名生成失败，使用URL签名:', error);
                }
            }
            return urlSignature;
        },

        async checkAndRemoveDuplicates(newImageItems, imageSignatureMap) {
            if (!CONFIG.deduplication.enabled) return newImageItems;
            const uniqueItems = [];
            const seenSignatures = new Set();
            for (const imgItem of newImageItems) {
                try {
                    let signature;
                    if (imgItem.format === 'svg' && imgItem.svgContent) {
                        const normalizedContent = SVGProcessor.normalizeContent(imgItem.svgContent);
                        signature = await Utils.simpleHash(new TextEncoder().encode(normalizedContent));
                        signature = `svg-${signature}`;
                    } else {
                        signature = await this.generateImageSignature(imgItem);
                    }
                    if (!seenSignatures.has(signature)) {
                        seenSignatures.add(signature);
                        imageSignatureMap.set(imgItem.id, signature);
                        uniqueItems.push(imgItem);
                    }
                } catch (error) {
                    console.warn('去重检查失败，保留图片:', imgItem.name, error);
                    uniqueItems.push(imgItem);
                }
            }
            const removedCount = newImageItems.length - uniqueItems.length;
            if (removedCount > 0) {
                Notification.show(`已自动过滤 ${removedCount} 张重复图片`, 'info');
            }
            return uniqueItems;
        }
    };

    // ==================== Blob管理模块 ====================
    const BlobManager = {
        blobUrlMap: new Map(),

        createManagedBlobUrl(blob) {
            const blobUrl = URL.createObjectURL(blob);
            const now = Date.now();
            this.blobUrlMap.set(blobUrl, now);
            if (this.blobUrlMap.size > CONFIG.maxBlobUrlCount) {
                const sortedUrls = Array.from(this.blobUrlMap.entries()).sort((a, b) => a[1] - b[1]);
                const urlsToClean = sortedUrls.slice(0, this.blobUrlMap.size - CONFIG.maxBlobUrlCount);
                urlsToClean.forEach(([url]) => this.cleanupSingle(url));
                if (CONFIG.blobCleanupNotification) {
                    Notification.show(`Blob URL超限，已清理${urlsToClean.length}个历史URL`, 'info');
                }
            }
            return blobUrl;
        },

        cleanupSingle(url) {
            if (this.blobUrlMap.has(url)) {
                try {
                    URL.revokeObjectURL(url);
                    this.blobUrlMap.delete(url);
                } catch (error) {
                    console.warn('清理Blob URL失败:', url, error);
                }
            }
        },

        cleanupAll() {
            this.blobUrlMap.forEach((_, url) => this.cleanupSingle(url));
            this.blobUrlMap.clear();
            if (CONFIG.blobCleanupNotification) {
                Notification.show('已清理所有Blob URL', 'info');
            }
        }
    };

    // ==================== 通知模块 ====================
    const Notification = {
        element: null,

        init() {
            this.element = document.createElement('div');
            this.element.className = 'copy-notification';
            document.body.appendChild(this.element);
        },

        show(message, type = 'info') {
            const colors = {
                info: 'rgba(52,152,219,0.8)',
                success: 'rgba(39,174,96,0.8)',
                warning: 'rgba(243,156,18,0.8)',
                error: 'rgba(231,76,60,0.8)'
            };
            this.element.textContent = message;
            this.element.style.backgroundColor = colors[type] || colors.info;
            this.element.style.opacity = '1';
            setTimeout(() => { this.element.style.opacity = '0'; }, 3000);
        }
    };

    // ==================== DOM构建模块 ====================
    const DOMBuilder = {
        createFabButton() {
            const container = document.createElement('div');
            container.className = 'rainbow-fab-container';
            container.id = 'rainbowFabContainer';

            const button = document.createElement('div');
            button.className = 'rainbow-fab';
            button.id = 'rainbowFab';
            button.innerHTML = `
                <div class="rainbow-fab-inner">
                    <div class="rainbow-fab-icon">
                        <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
                            <path d="M512 955.3408c-243.712 0-442.0096-198.2976-442.0096-442.0096S268.288 71.2704 512 71.2704s442.0096 198.2976 442.0096 442.0096-198.2976 442.0608-442.0096 442.0608z m0-802.1504c-198.5536 0-360.0896 161.536-360.0896 360.0896s161.536 360.0896 360.0896 360.0896 360.0896-161.536 360.0896-360.0896S710.5536 153.1904 512 153.1904z" fill="#4385F5"/>
                            <path d="M512 513.3312m-213.6064 0a213.6064 213.6064 0 1 0 427.2128 0 213.6064 213.6064 0 1 0-427.2128 0Z" fill="#D9FFEC"/>
                            <path d="M486.6048 686.7456c-112.5888 0-204.1856-91.5968-204.1856-204.2368 0-112.5888 91.5968-204.1856 204.1856-204.1856 112.5888 0 204.2368 91.5968 204.2368 204.1856-0.0512 112.64-91.648 204.2368-204.2368 204.2368z m0-331.6224c-70.2464 0-127.3856 57.1392-127.3856 127.3856s57.1392 127.4368 127.3856 127.4368 127.4368-57.1392 127.4368-127.4368-57.1904-127.3856-127.4368-127.3856z" fill="#34A853"/>
                            <path d="M703.232 733.6448a38.2976 38.2976 0 0 1-27.5456-11.6224l-86.4768-88.9344c-14.7968-15.2064-14.4384-39.5264 0.768-54.3232 15.2064-14.7968 39.5264-14.4384 54.3232 0.768l86.4768 88.9344c14.7968 15.2064 14.4384 39.5264-0.768 54.3232a38.50752 38.50752 0 0 1-26.7776 10.8544z" fill="#34A853"/>
                        </svg>
                    </div>
                </div>
                <div class="rainbow-fab-badge" id="fabBadge">0</div>
            `;
            container.appendChild(button);
            document.body.appendChild(container);
            return { container, button, badge: button.querySelector('.rainbow-fab-badge') };
        },

        createMainModal() {
            const modal = document.createElement('div');
            modal.id = 'svgSnifferModal';
            modal.innerHTML = `
                <div class="modal-header">
                    <h2>网页图片资源列表</h2>
                    <div class="modal-header-actions">
                        <button class="close-btn">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                </div>
                <div class="search-bar" id="searchBar">
                    <input type="text" class="search-input" id="searchInput" placeholder="搜索图片名称...">
                    <select class="sort-select" id="sortSelect">
                        <option value="default">默认排序</option>
                        <option value="name-asc">名称 A-Z</option>
                        <option value="name-desc">名称 Z-A</option>
                        <option value="format">格式分组</option>
                        <option value="type">类型分组</option>
                    </select>
                    <select class="format-filter" id="formatFilter">
                        <option value="all">全部格式</option>
                        ${CONFIG.supportFormats.map(f => `<option value="${f}">${f.toUpperCase()}</option>`).join('')}
                    </select>
                    <div class="view-toggle">
                        <button class="view-btn active" id="listViewBtn" title="列表视图">
                            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="3" rx="1"/><rect x="3" y="10.5" width="18" height="3" rx="1"/><rect x="3" y="17" width="18" height="3" rx="1"/></svg>
                        </button>
                        <button class="view-btn" id="gridViewBtn" title="网格视图">
                            <svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>
                        </button>
                    </div>
                </div>
                <div class="action-bar">
                    <div class="select-all-control">
                        <input type="checkbox" id="selectAll">
                        <label for="selectAll">全选（共<span id="imageCount">0</span>张）</label>
                    </div>
                    <div class="action-buttons">
                        <button class="action-btn download-btn" id="batchDownloadBtn">批量下载</button>
                        <button class="action-btn copy-btn" id="batchCopyBtn">复制链接</button>
                        <button class="action-btn filter-btn" id="invertSelectBtn">反选</button>
                        <div class="dedupe-control">
                            <input type="checkbox" id="dedupeToggle" class="dedupe-toggle" ${CONFIG.deduplication.enabled ? 'checked' : ''}>
                            <label for="dedupeToggle" class="dedupe-label">智能去重</label>
                        </div>
                    </div>
                </div>
                <div class="modal-content" id="svgList">
                    <div class="loading">正在扫描页面图片资源...</div>
                </div>
            `;
            document.body.appendChild(modal);
            return modal;
        },

        createPreviewModal() {
            const modal = document.createElement('div');
            modal.id = 'imagePreviewModal';
            modal.innerHTML = `
                <div class="preview-container">
                    <div class="preview-header">
                        <div class="preview-title" id="previewTitle">图片预览</div>
                        <button class="preview-close">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                    <div class="preview-content" id="previewContent">
                        <div class="loading">加载中...</div>
                        <button class="preview-nav prev" id="previewPrev" title="上一张">
                            <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </button>
                        <button class="preview-nav next" id="previewNext" title="下一张">
                            <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </button>
                        <div class="preview-counter" id="previewCounter">1 / 1</div>
                    </div>
                    <div class="preview-footer">
                        <button class="preview-btn preview-download" id="previewDownload">下载图片</button>
                        <button class="preview-btn preview-copy" id="previewCopy">复制链接</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            return modal;
        },

        createOverlay() {
            const overlay = document.createElement('div');
            overlay.className = 'rainbow-overlay';
            document.body.appendChild(overlay);
            return overlay;
        }
    };

    // ==================== 图片采集模块 ====================
    const ImageCollector = {
        hiddenElements: [],

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
        },

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
        },

        collectBasicImages() {
            const images = [];
            document.querySelectorAll('img').forEach((img, index) => {
                const src = img.src || img.dataset.src || img.currentSrc;
                if (src && !src.startsWith('data:')) {
                    const originalFormat = Utils.getFileExtension(src).toLowerCase();
                    images.push({
                        id: `basic-img-${index}`,
                        url: src,
                        name: Utils.truncateTo4Bytes(img.alt || '未命名图片'),
                        format: Utils.truncateTo4Bytes(originalFormat || CONFIG.defaultImageFormat),
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
        },

        async collectImagesFromCss(cssUrl) {
            const imageUrls = [];
            try {
                const response = await fetch(cssUrl, {
                    headers: { 'Accept': 'text/css,*/*;q=0.1' },
                    credentials: 'same-origin'
                });
                if (!response.ok) throw new Error(`CSS请求失败: ${response.status}`);
                const cssText = await response.text();
                const bgUrlRegex = /background-image\s*:\s*url\(["']?([^"']+)["']?\)/gi;
                let match;
                while ((match = bgUrlRegex.exec(cssText)) !== null) {
                    if (match[1]) {
                        const fullUrl = new URL(match[1], cssUrl).href;
                        const ext = Utils.getFileExtension(fullUrl).toLowerCase();
                        if (CONFIG.supportFormats.includes(ext)) imageUrls.push(fullUrl);
                    }
                }
            } catch (e) {
                console.warn('采集CSS中的图片失败:', cssUrl, e);
            }
            return imageUrls;
        },

        async collectAllCssResources() {
            const cssUrls = [];
            document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
                const href = link.getAttribute('href');
                if (href) cssUrls.push(new URL(href, window.location.href).href);
            });
            document.querySelectorAll('style').forEach(style => {
                const bgUrlRegex = /background-image\s*:\s*url\(["']?([^"']+)["']?\)/gi;
                let match;
                while ((match = bgUrlRegex.exec(style.textContent)) !== null) {
                    if (match[1]) {
                        const fullUrl = new URL(match[1], window.location.href).href;
                        const ext = Utils.getFileExtension(fullUrl).toLowerCase();
                        if (CONFIG.supportFormats.includes(ext)) cssUrls.push(`inline:${fullUrl}`);
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
        },

        async collectAllImages(imageSignatureMap) {
            const imageItems = [];
            const processedUrls = new Set();

            // 基础img标签
            this.collectBasicImages().forEach(img => {
                if (!processedUrls.has(img.url)) {
                    processedUrls.add(img.url);
                    imageItems.push(img);
                }
            });

            // CSS资源
            let cssImageUrls = [];
            try { cssImageUrls = await this.collectAllCssResources(); } catch (e) {
                console.warn('CSS图片采集异常:', e);
            }

            this.tempShowHiddenElements();
            try {
                // 动态img标签
                for (const img of document.querySelectorAll('img')) {
                    try {
                        let imgUrl = img.src || img.dataset.src || img.dataset.original || img.currentSrc;
                        if (!imgUrl || processedUrls.has(imgUrl) || imgUrl.startsWith('data:')) continue;
                        const fullUrl = new URL(imgUrl, window.location.href).href;
                        const originalFormat = Utils.getFileExtension(fullUrl).toLowerCase();
                        if (!CONFIG.supportFormats.includes(originalFormat) && originalFormat) continue;
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
                                id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                                url: fullUrl, name: Utils.truncateTo4Bytes(originalName),
                                format: Utils.truncateTo4Bytes(originalFormat || CONFIG.defaultImageFormat),
                                width: img.width || '未知', height: img.height || '未知',
                                type: 'img-tag', preview: fullUrl,
                                originalName, originalFormat, svgContent, fileSize: '未知'
                            }), CONFIG.loadTimeout);
                            if (img.complete) {
                                clearTimeout(timer);
                                resolve({
                                    id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                                    url: fullUrl, name: Utils.truncateTo4Bytes(originalName),
                                    format: Utils.truncateTo4Bytes(originalFormat || CONFIG.defaultImageFormat),
                                    width: img.naturalWidth || img.width || '未知',
                                    height: img.naturalHeight || img.height || '未知',
                                    type: 'img-tag', preview: fullUrl,
                                    originalName, originalFormat, svgContent, fileSize: '未知'
                                });
                            } else {
                                img.onload = () => {
                                    clearTimeout(timer);
                                    resolve({
                                        id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                                        url: fullUrl, name: Utils.truncateTo4Bytes(originalName),
                                        format: Utils.truncateTo4Bytes(originalFormat || CONFIG.defaultImageFormat),
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
                                id: `bg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                                url: fullUrl, name: Utils.truncateTo4Bytes(originalName),
                                format: Utils.truncateTo4Bytes(originalFormat || CONFIG.defaultImageFormat),
                                width: '背景图', height: '背景图',
                                type: Utils.truncateTo4Bytes('背景图'),
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
                            id: `css-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                            url: fullUrl, name: Utils.truncateTo4Bytes(originalName),
                            format: Utils.truncateTo4Bytes(originalFormat || CONFIG.defaultImageFormat),
                            width: 'CSS引用', height: 'CSS引用',
                            type: Utils.truncateTo4Bytes('CSS图片'),
                            preview: fullUrl, originalName, originalFormat,
                            originalType: 'CSS图片', svgContent, fileSize: '未知'
                        });
                        processedUrls.add(imgUrl);
                    } catch (e) { /* ignore */ }
                }

                // SVG标签
                for (const svg of document.querySelectorAll('svg')) {
                    try {
                        const svgContent = svg.outerHTML;
                        const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
                        const svgUrl = BlobManager.createManagedBlobUrl(svgBlob);
                        const originalName = `SVG图片-${Date.now().toString().slice(-4)}`;
                        imageItems.push({
                            id: `svg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                            url: svgUrl, name: Utils.truncateTo4Bytes(originalName),
                            format: Utils.truncateTo4Bytes('svg'),
                            width: svg.naturalWidth || svg.width.baseVal.value || '自适应',
                            height: svg.naturalHeight || svg.height.baseVal.value || '自适应',
                            type: Utils.truncateTo4Bytes('SVG标签'),
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
    };

    // ==================== 下载模块 ====================
    const Downloader = {
        downloadImage(imgItem, originalName, originalFormat) {
            const baseName = originalName || imgItem.name;
            const completedFileName = Utils.completeImageSuffix(baseName, originalFormat);
            if (completedFileName.endsWith('.svg') && imgItem.svgContent) {
                try {
                    const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>${imgItem.svgContent}`;
                    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
                    saveAs(blob, completedFileName);
                    Notification.show(`下载成功: ${completedFileName}`, 'success');
                    return;
                } catch (svgErr) {
                    console.warn('SVG专属下载失败，尝试备用方案:', svgErr);
                }
            }
            const mimeType = completedFileName.endsWith('.svg')
                ? 'image/svg+xml'
                : `image/${completedFileName.split('.').pop().toLowerCase()}`;
            GM_download({
                url: imgItem.url,
                name: completedFileName,
                mimetype: mimeType,
                onload: () => Notification.show(`下载成功: ${completedFileName}`, 'success'),
                onerror: (e) => {
                    console.error('下载失败:', e);
                    Notification.show(`下载失败: ${completedFileName}`, 'error');
                }
            });
        },

        async downloadMultipleImages(selectedItems) {
            const zip = new JSZip();
            let downloadedCount = 0;
            const totalCount = selectedItems.length;
            for (const imgItem of selectedItems) {
                try {
                    const baseName = imgItem.originalName || imgItem.name;
                    const originalFormat = imgItem.originalFormat || '';
                    const completedFileName = Utils.completeImageSuffix(baseName, originalFormat);
                    if (completedFileName.endsWith('.svg') && imgItem.svgContent) {
                        const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>${imgItem.svgContent}`;
                        zip.file(completedFileName, svgContent);
                        downloadedCount++;
                        continue;
                    }
                    const response = await fetch(imgItem.url);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const blob = await response.blob();
                    zip.file(completedFileName, blob);
                    downloadedCount++;
                } catch (error) {
                    const errBaseName = imgItem.originalName || imgItem.name;
                    const errFileName = Utils.completeImageSuffix(`${errBaseName}_加载失败`, 'txt');
                    zip.file(errFileName, `图片加载失败: ${imgItem.url}\n错误原因: ${error.message}`);
                    console.error(`下载失败 ${errBaseName}:`, error);
                }
            }
            if (downloadedCount === 0) { alert('所有图片下载失败'); return; }
            try {
                const content = await zip.generateAsync({
                    type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 }
                });
                const zipFileName = `网页图片_${location.hostname}_${new Date().toISOString().slice(0, 10)}.zip`;
                saveAs(content, zipFileName);
                Notification.show(`批量下载成功: ${zipFileName}（共${downloadedCount}/${totalCount}个）`, 'success');
                if (downloadedCount < totalCount) {
                    alert(`部分图片下载失败，成功下载 ${downloadedCount}/${totalCount} 个资源`);
                }
            } catch (error) {
                console.error('创建ZIP失败:', error);
                Notification.show('创建ZIP文件失败', 'error');
                alert('创建ZIP文件失败');
            }
        }
    };

    // ==================== 复制模块 ====================
    const Clipboard = {
        async copyUrls(items) {
            if (items.length === 0) {
                Notification.show('请至少选择一张图片', 'warning');
                return;
            }
            try {
                const urls = items.map(item => {
                    if (item.format === 'svg' && item.svgContent) {
                        const svgBlob = new Blob([item.svgContent], { type: 'image/svg+xml' });
                        return BlobManager.createManagedBlobUrl(svgBlob);
                    }
                    return item.url;
                });
                const urlsText = urls.join('\n');
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(urlsText);
                } else {
                    const textArea = document.createElement('textarea');
                    textArea.value = urlsText;
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-999999px';
                    textArea.style.top = '-999999px';
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    const successful = document.execCommand('copy');
                    document.body.removeChild(textArea);
                    if (!successful) throw new Error('execCommand 复制失败');
                }
                Notification.show(`成功复制 ${items.length} 个图片链接`, 'success');
            } catch (error) {
                console.error('复制失败:', error);
                Notification.show('复制失败，请重试', 'error');
            }
        }
    };

    // ==================== UI渲染模块 ====================
    const UIRenderer = {
        _visibleItems: [],

        getVisibleItems() {
            return this._visibleItems;
        },
        createImageItemElement(item) {
            const itemElement = document.createElement('div');
            itemElement.className = 'svg-item';
            const fullName = item.originalName || item.name;
            const fullFormat = item.originalFormat || CONFIG.defaultImageFormat;
            const fullType = item.originalType || item.type;
            const completedFileName = Utils.completeImageSuffix(fullName, fullFormat);

            let previewHtml = '';
            if (item.format === 'svg' && item.svgContent) {
                previewHtml = item.svgContent;
            } else {
                previewHtml = `<img src="${item.preview}" alt="${fullName}" loading="lazy" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHJ4PSIxNSIgZmlsbD0iI2Y0ZjRmNCIvPjxwYXRoIGQ9Ik0yMCAyNUMyMCAyNSAyMiAyMiAyNSAyMkMyOCAyMiAzMCAyNSAzMCAyNUMyMCAyNSAyOCAyOCAyNSAyOEMyMiAyOCAyMCAyNSAyMCAyNVoiIHN0cm9rZT0iIzc3NyIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+'">`;
            }

            itemElement.innerHTML = `
                <div style="display: flex; align-items: center; min-width: 0; gap: 10px;">
                    <input type="checkbox" class="svg-checkbox" data-id="${item.id}" checked>
                    <div class="svg-preview" data-img-id="${item.id}">${previewHtml}</div>
                    <div class="svg-info">
                        <div class="svg-name" title="文件名：${completedFileName}">${item.name}</div>
                        <div class="svg-meta">
                            <span title="格式：${fullFormat || CONFIG.defaultImageFormat}">${item.format}</span>
                            <span title="类型：${fullType}">${item.type}</span>
                            <span class="svg-size" title="尺寸：${item.width}×${item.height}">${item.width}×${item.height}</span>
                        </div>
                    </div>
                </div>
                <button class="item-download-btn" data-img-id="${item.id}" title="下载 ${completedFileName}">下载</button>
            `;

            const previewElement = itemElement.querySelector('.svg-preview');
            previewElement.addEventListener('click', (e) => {
                e.stopPropagation();
                const imgId = e.currentTarget.dataset.imgId;
                const imgItem = App.imageItemCache.get(imgId);
                if (imgItem) {
                    const visibleItems = UIRenderer.getVisibleItems();
                    const idx = visibleItems.findIndex(it => it.id === imgId);
                    PreviewModal.show(imgItem, visibleItems, idx >= 0 ? idx : 0);
                }
            });

            const itemDownloadBtn = itemElement.querySelector('.item-download-btn');
            itemDownloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const imgId = e.currentTarget.dataset.imgId;
                const imgItem = App.imageItemCache.get(imgId);
                if (imgItem) Downloader.downloadImage(imgItem, imgItem.originalName, imgItem.originalFormat);
            });

            return itemElement;
        },

        renderImageList(items, imageItemCache) {
            this._visibleItems = items;
            const svgList = document.getElementById('svgList');
            svgList.innerHTML = '';
            if (items.length === 0) {
                svgList.innerHTML = '<div class="loading">没有找到任何图片资源</div>';
                return;
            }
            const fragment = document.createDocumentFragment();
            items.forEach(item => {
                imageItemCache.set(item.id, item);
                fragment.appendChild(this.createImageItemElement(item));
            });
            svgList.appendChild(fragment);
        },

        applyFilterAndSort(items, searchTerm, sortBy, formatFilter) {
            let filtered = [...items];

            // 搜索过滤
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                filtered = filtered.filter(item =>
                    (item.originalName || item.name || '').toLowerCase().includes(term) ||
                    (item.url || '').toLowerCase().includes(term)
                );
            }

            // 格式过滤
            if (formatFilter && formatFilter !== 'all') {
                filtered = filtered.filter(item =>
                    (item.originalFormat || item.format || '').toLowerCase() === formatFilter.toLowerCase()
                );
            }

            // 排序
            switch (sortBy) {
                case 'name-asc':
                    filtered.sort((a, b) => (a.originalName || a.name).localeCompare(b.originalName || b.name));
                    break;
                case 'name-desc':
                    filtered.sort((a, b) => (b.originalName || b.name).localeCompare(a.originalName || a.name));
                    break;
                case 'format':
                    filtered.sort((a, b) => (a.format || '').localeCompare(b.format || ''));
                    break;
                case 'type':
                    filtered.sort((a, b) => (a.type || '').localeCompare(b.type || ''));
                    break;
                default:
                    break;
            }

            return filtered;
        }
    };

    // ==================== 预览弹窗模块 ====================
    const PreviewModal = {
        currentItem: null,
        currentIndex: -1,
        imageList: [],
        modal: null,
        escapeHandler: null,

        init() {
            this.modal = document.getElementById('imagePreviewModal');
            const closeBtn = this.modal.querySelector('.preview-close');
            closeBtn.addEventListener('click', () => this.hide());
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.hide();
            });
            document.getElementById('previewDownload').addEventListener('click', () => {
                if (this.currentItem) {
                    Downloader.downloadImage(this.currentItem, this.currentItem.originalName, this.currentItem.originalFormat);
                }
            });
            document.getElementById('previewCopy').addEventListener('click', async () => {
                if (this.currentItem) {
                    await Clipboard.copyUrls([this.currentItem]);
                }
            });
            document.getElementById('previewPrev').addEventListener('click', () => this.navigate(-1));
            document.getElementById('previewNext').addEventListener('click', () => this.navigate(1));
        },

        navigate(direction) {
            if (this.imageList.length === 0) return;
            const newIndex = this.currentIndex + direction;
            if (newIndex < 0 || newIndex >= this.imageList.length) return;
            this.show(this.imageList[newIndex], this.imageList, newIndex);
        },

        updateNavButtons() {
            const prevBtn = document.getElementById('previewPrev');
            const nextBtn = document.getElementById('previewNext');
            const counter = document.getElementById('previewCounter');
            if (this.imageList.length <= 1) {
                prevBtn.classList.add('disabled');
                nextBtn.classList.add('disabled');
                counter.style.display = 'none';
            } else {
                if (this.currentIndex <= 0) prevBtn.classList.add('disabled');
                else prevBtn.classList.remove('disabled');
                if (this.currentIndex >= this.imageList.length - 1) nextBtn.classList.add('disabled');
                else nextBtn.classList.remove('disabled');
                counter.style.display = 'block';
                counter.textContent = `${this.currentIndex + 1} / ${this.imageList.length}`;
            }
        },

        show(imgItem, imageList, index) {
            if (imageList) {
                this.imageList = imageList;
                this.currentIndex = index !== undefined ? index : imageList.indexOf(imgItem);
            } else {
                this.imageList = [imgItem];
                this.currentIndex = 0;
            }
            this.currentItem = imgItem;
            const title = document.getElementById('previewTitle');
            const content = document.getElementById('previewContent');
            const completedFileName = Utils.completeImageSuffix(imgItem.originalName || imgItem.name, imgItem.originalFormat);
            title.textContent = completedFileName;

            // 保留导航按钮，只替换加载内容
            const loadingEl = content.querySelector('.loading');
            if (!loadingEl) {
                const existingLoading = document.createElement('div');
                existingLoading.className = 'loading';
                // 清除除了 nav 按钮和 counter 之外的内容
                const navPrev = content.querySelector('.preview-nav.prev');
                const navNext = content.querySelector('.preview-nav.next');
                const counter = content.querySelector('.preview-counter');
                content.innerHTML = '';
                content.appendChild(existingLoading);
                content.appendChild(navPrev);
                content.appendChild(navNext);
                content.appendChild(counter);
            }

            this.modal.style.display = 'flex';
            this.updateNavButtons();

            let previewContent = '';
            if (imgItem.format === 'svg' && imgItem.svgContent) {
                const processedSvg = SVGProcessor.processForPreview(imgItem.svgContent);
                previewContent = `<div class="preview-svg">${processedSvg}</div>`;
            } else {
                previewContent = `<img class="preview-image" src="${imgItem.url}" alt="${completedFileName}" onload="this.style.opacity='1'" style="opacity:0;transition:opacity 0.3s">`;
            }

            const loadingEl2 = content.querySelector('.loading');
            if (loadingEl2) loadingEl2.remove();
            const insertBefore = content.querySelector('.preview-nav.prev');
            const wrapper = document.createElement('div');
            wrapper.innerHTML = previewContent;
            const previewEl = wrapper.firstElementChild;
            content.insertBefore(previewEl, insertBefore);

            this.escapeHandler = (e) => {
                if (e.key === 'Escape') this.hide();
                if (e.key === 'ArrowLeft') this.navigate(-1);
                if (e.key === 'ArrowRight') this.navigate(1);
            };
            document.addEventListener('keydown', this.escapeHandler);
        },

        hide() {
            this.modal.style.display = 'none';
            this.currentItem = null;
            this.imageList = [];
            this.currentIndex = -1;
            if (this.escapeHandler) {
                document.removeEventListener('keydown', this.escapeHandler);
                this.escapeHandler = null;
            }
        }
    };

    // ==================== 拖拽模块 ====================
    const Draggable = {
        container: null,
        isDragging: false,
        hasMoved: false,
        startX: 0, startY: 0, startLeft: 0, startTop: 0,
        dragStartTime: 0,
        touchTimer: null,

        init(container, onClickCallback) {
            this.container = container;
            this.onClickCallback = onClickCallback;

            container.addEventListener('mousedown', (e) => this.startDrag(e));
            container.addEventListener('touchstart', (e) => this.startDrag(e), { passive: false });
        },

        startDrag(e) {
            if (e.target.closest && e.target.closest('.rainbow-fab-badge')) return;
            e.preventDefault();
            const clientX = e.clientX || e.touches[0].clientX;
            const clientY = e.clientY || e.touches[0].clientY;
            const computedStyle = window.getComputedStyle(this.container);
            this.startLeft = parseInt(computedStyle.left) || 0;
            this.startTop = parseInt(computedStyle.top) || 0;
            if (computedStyle.right !== 'auto') {
                const rightPos = parseInt(computedStyle.right);
                this.startLeft = window.innerWidth - rightPos - CONFIG.buttonSize;
                this.container.style.right = 'auto';
                this.container.style.left = `${this.startLeft}px`;
            }
            this.startX = clientX;
            this.startY = clientY;
            this.dragStartTime = Date.now();
            this.hasMoved = false;
            const self = this;
            if (e.type === 'touchstart') {
                this.touchTimer = setTimeout(() => {
                    self.isDragging = true;
                    self.container.style.transition = 'none';
                }, CONFIG.touchDelay);
            } else {
                this.isDragging = true;
                this.container.style.transition = 'none';
            }
            document.addEventListener('mousemove', this._dragHandler);
            document.addEventListener('touchmove', this._dragHandler, { passive: false });
            document.addEventListener('mouseup', this._endDragHandler);
            document.addEventListener('touchend', this._endDragHandler);
        },

        _dragHandler(e) {
            if (!Draggable.isDragging) return;
            Draggable.hasMoved = true;
            e.preventDefault();
            const clientX = e.clientX || e.touches[0].clientX;
            const clientY = e.clientY || e.touches[0].clientY;
            Draggable.container.style.left = `${Draggable.startLeft + clientX - Draggable.startX}px`;
            Draggable.container.style.top = `${Draggable.startTop + clientY - Draggable.startY}px`;
            Draggable.container.style.right = 'auto';
        },

        _endDragHandler(e) {
            if (Draggable.touchTimer) {
                clearTimeout(Draggable.touchTimer);
                Draggable.touchTimer = null;
            }
            if (!Draggable.isDragging) {
                if (Date.now() - Draggable.dragStartTime < CONFIG.touchDelay) {
                    Draggable.onClickCallback();
                }
                return;
            }
            // 如果没移动，视为点击
            if (!Draggable.hasMoved) {
                Draggable.onClickCallback();
            }
            Draggable.isDragging = false;
            Draggable.container.style.transition = '';
            document.removeEventListener('mousemove', Draggable._dragHandler);
            document.removeEventListener('touchmove', Draggable._dragHandler);
            document.removeEventListener('mouseup', Draggable._endDragHandler);
            document.removeEventListener('touchend', Draggable._endDragHandler);
            const domain = location.hostname.replace(/\./g, '-');
            const positionKey = `radarPosition_${domain}`;
            const rect = Draggable.container.getBoundingClientRect();
            GM_setValue(positionKey, { x: rect.left, y: rect.top });
        }
    };

    // ==================== 动态监听模块 ====================
    const DynamicListener = {
        scrollTimer: null,
        lastScrollHeight: document.documentElement.scrollHeight,
        isClickDetecting: false,

        init() {
            window.addEventListener('scroll', this._handleScroll.bind(this), { passive: true });
            document.addEventListener('click', this._handleClick.bind(this), true);
            this.lastScrollHeight = document.documentElement.scrollHeight;
        },

        async _handleScroll() {
            clearTimeout(this.scrollTimer);
            this.scrollTimer = setTimeout(async () => {
                const currentScrollHeight = document.documentElement.scrollHeight;
                if (currentScrollHeight > this.lastScrollHeight) {
                    await App.detectNewImages();
                }
            }, CONFIG.scrollCheckInterval);
        },

        _handleClick(e) {
            if (e.target.closest('#rainbowFabContainer') || e.target.closest('#svgSnifferModal')) return;
            const isLoadButton = CONFIG.clickLoadSelectors.some(selector => e.target.closest(selector));
            if (isLoadButton && !this.isClickDetecting) {
                this.isClickDetecting = true;
                setTimeout(async () => {
                    try { await App.detectNewImages(); } finally {
                        this.isClickDetecting = false;
                    }
                }, CONFIG.clickDetectDelay);
            }
        },

        destroy() {
            window.removeEventListener('scroll', this._handleScroll);
            document.removeEventListener('click', this._handleClick, true);
            clearTimeout(this.scrollTimer);
            if (Draggable.touchTimer) clearTimeout(Draggable.touchTimer);
        }
    };

    // ==================== 主应用模块 ====================
    const App = {
        globalImageItems: [],
        imageItemCache: new Map(),
        imageSignatureMap: new Map(),
        fabElements: null,
        mainModal: null,
        overlay: null,
        currentView: 'list',

        async init() {
            Notification.init();

            // 构建DOM
            this.fabElements = DOMBuilder.createFabButton();
            this.mainModal = DOMBuilder.createMainModal();
            DOMBuilder.createPreviewModal();
            this.overlay = DOMBuilder.createOverlay();

            // 初始化各模块
            PreviewModal.init();
            this._initFabPosition();
            this._initFabEvents();
            this._initModalEvents();
            this._initSearchBar();
            DynamicListener.init();

            // 键盘快捷键
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.mainModal.style.display === 'flex') {
                    const previewModal = document.getElementById('imagePreviewModal');
                    if (previewModal && previewModal.style.display === 'flex') {
                        PreviewModal.hide();
                    } else {
                        this.hideModal();
                    }
                }
                if (e.ctrlKey && e.key === 'f' && this.mainModal.style.display === 'flex') {
                    e.preventDefault();
                    document.getElementById('searchInput').focus();
                }
            });

            // 页面卸载清理
            window.addEventListener('beforeunload', () => {
                BlobManager.cleanupAll();
                DynamicListener.destroy();
            });

            // 初始化全局图像计数
            this._updateGlobalCount();
        },

        _initFabPosition() {
            const domain = location.hostname.replace(/\./g, '-');
            const positionKey = `radarPosition_${domain}`;
            const savedPosition = GM_getValue(positionKey);
            if (savedPosition) {
                this.fabElements.container.style.left = `${savedPosition.x}px`;
                this.fabElements.container.style.top = `${savedPosition.y}px`;
            } else {
                this.fabElements.container.style.right = `${CONFIG.positionOffset}px`;
                this.fabElements.container.style.bottom = `${CONFIG.positionOffset}px`;
            }
        },

        _initFabEvents() {
            Draggable.init(this.fabElements.container, () => this.showModal());
        },

        _initModalEvents() {
            const closeBtn = this.mainModal.querySelector('.close-btn');
            closeBtn.addEventListener('click', () => this.hideModal());
            this.overlay.addEventListener('click', () => this.hideModal());

            const selectAll = document.getElementById('selectAll');
            selectAll.addEventListener('change', (e) => {
                this.mainModal.querySelectorAll('.svg-checkbox').forEach(cb => {
                    cb.checked = e.target.checked;
                });
            });

            document.getElementById('batchDownloadBtn').addEventListener('click', () => {
                const selectedItems = this._getSelectedItems();
                if (selectedItems.length === 0) {
                    alert('请至少选择一张图片');
                    return;
                }
                if (selectedItems.length === 1) {
                    Downloader.downloadImage(selectedItems[0], selectedItems[0].originalName, selectedItems[0].originalFormat);
                } else {
                    Downloader.downloadMultipleImages(selectedItems);
                }
            });

            document.getElementById('batchCopyBtn').addEventListener('click', () => {
                Clipboard.copyUrls(this._getSelectedItems());
            });

            document.getElementById('invertSelectBtn').addEventListener('click', () => {
                this.mainModal.querySelectorAll('.svg-checkbox').forEach(cb => {
                    cb.checked = !cb.checked;
                });
            });

            const dedupeToggle = document.getElementById('dedupeToggle');
            if (dedupeToggle) {
                dedupeToggle.addEventListener('change', (e) => {
                    CONFIG.deduplication.enabled = e.target.checked;
                    Notification.show(`智能去重 ${e.target.checked ? '已启用' : '已禁用'}`, 'info');
                });
            }
        },

        _initSearchBar() {
            const searchInput = document.getElementById('searchInput');
            const sortSelect = document.getElementById('sortSelect');
            const formatFilter = document.getElementById('formatFilter');
            const listViewBtn = document.getElementById('listViewBtn');
            const gridViewBtn = document.getElementById('gridViewBtn');

            const applyFilters = Utils.debounce(() => {
                const filtered = UIRenderer.applyFilterAndSort(
                    this.globalImageItems,
                    searchInput.value,
                    sortSelect.value,
                    formatFilter.value
                );
                UIRenderer.renderImageList(filtered, this.imageItemCache);
                document.getElementById('imageCount').textContent = filtered.length;
                document.getElementById('selectAll').checked = false;
            }, 250);

            searchInput.addEventListener('input', applyFilters);
            sortSelect.addEventListener('change', applyFilters);
            formatFilter.addEventListener('change', applyFilters);

            // 视图切换
            listViewBtn.addEventListener('click', () => {
                this.currentView = 'list';
                document.getElementById('svgList').classList.remove('grid-view');
                listViewBtn.classList.add('active');
                gridViewBtn.classList.remove('active');
                applyFilters();
            });

            gridViewBtn.addEventListener('click', () => {
                this.currentView = 'grid';
                document.getElementById('svgList').classList.add('grid-view');
                gridViewBtn.classList.add('active');
                listViewBtn.classList.remove('active');
                applyFilters();
            });
        },

        _getSelectedItems() {
            const checkboxes = this.mainModal.querySelectorAll('.svg-checkbox:checked');
            const selectedIds = Array.from(checkboxes).map(cb => cb.dataset.id);
            return selectedIds.map(id => this.imageItemCache.get(id)).filter(Boolean);
        },

        async _updateGlobalCount() {
            // 快速后台扫描更新计数
            try {
                const basic = ImageCollector.collectBasicImages();
                if (basic.length > 0) {
                    this.fabElements.badge.textContent = basic.length;
                    this.fabElements.badge.style.display = 'flex';
                }
            } catch (e) { /* ignore */ }
        },

        async showModal() {
            const svgList = document.getElementById('svgList');
            const imageCountEl = document.getElementById('imageCount');
            svgList.innerHTML = '<div class="loading">正在扫描页面图片资源（含CSS/隐藏元素/动态加载/智能去重）...</div>';
            this.mainModal.style.display = 'flex';
            this.overlay.style.display = 'block';

            try {
                this.imageSignatureMap.clear();
                const imageItems = await ImageCollector.collectAllImages(this.imageSignatureMap);
                this.globalImageItems = imageItems;
                this.imageItemCache.clear();
                imageCountEl.textContent = imageItems.length;

                if (imageItems.length === 0) {
                    svgList.innerHTML = '<div class="loading">没有找到任何图片资源（已尝试采集隐藏元素、CSS和动态加载）</div>';
                    return;
                }

                // 应用当前过滤条件
                const searchInput = document.getElementById('searchInput');
                const sortSelect = document.getElementById('sortSelect');
                const formatFilter = document.getElementById('formatFilter');
                const filtered = UIRenderer.applyFilterAndSort(
                    imageItems,
                    searchInput ? searchInput.value : '',
                    sortSelect ? sortSelect.value : 'default',
                    formatFilter ? formatFilter.value : 'all'
                );
                UIRenderer.renderImageList(filtered, this.imageItemCache);
                imageCountEl.textContent = filtered.length;

                // 更新悬浮按钮计数
                this.fabElements.badge.textContent = imageItems.length;
                this.fabElements.badge.style.display = 'flex';
            } catch (error) {
                console.error('扫描图片失败:', error);
                svgList.innerHTML = '<div class="loading">扫描失败，请刷新页面重试</div>';
            }
        },

        hideModal() {
            this.mainModal.style.display = 'none';
            this.overlay.style.display = 'none';
            BlobManager.cleanupAll();
        },

        async detectNewImages() {
            if (this.mainModal.style.display !== 'flex') return;
            const processedUrls = new Set(this.globalImageItems.map(item => item.url));
            const newImageItems = [];

            ImageCollector.tempShowHiddenElements();
            try {
                // 动态img
                for (const img of document.querySelectorAll('img')) {
                    try {
                        let imgUrl = img.src || img.dataset.src || img.dataset.original || img.currentSrc;
                        if (!imgUrl || processedUrls.has(imgUrl) || imgUrl.startsWith('data:')) continue;
                        const fullUrl = new URL(imgUrl, window.location.href).href;
                        const originalFormat = Utils.getFileExtension(fullUrl).toLowerCase();
                        if (!CONFIG.supportFormats.includes(originalFormat) && originalFormat) continue;
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
                            if (img.complete) {
                                resolve({
                                    id: `dynamic-img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                                    url: fullUrl, name: Utils.truncateTo4Bytes(originalName),
                                    format: Utils.truncateTo4Bytes(originalFormat || CONFIG.defaultImageFormat),
                                    width: img.naturalWidth || img.width || '未知',
                                    height: img.naturalHeight || img.height || '未知',
                                    type: 'dynamic-img', preview: fullUrl,
                                    originalName, originalFormat, svgContent, fileSize: '未知'
                                });
                            } else {
                                img.onload = () => resolve({
                                    id: `dynamic-img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                                    url: fullUrl, name: Utils.truncateTo4Bytes(originalName),
                                    format: Utils.truncateTo4Bytes(originalFormat || CONFIG.defaultImageFormat),
                                    width: img.naturalWidth || img.width || '未知',
                                    height: img.naturalHeight || img.height || '未知',
                                    type: 'dynamic-img', preview: fullUrl,
                                    originalName, originalFormat, svgContent, fileSize: '未知'
                                });
                                img.onerror = () => resolve(null);
                            }
                        });
                        if (imgInfo) { processedUrls.add(imgUrl); newImageItems.push(imgInfo); }
                    } catch (e) { /* ignore */ }
                }

                // 动态背景图
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
                            const originalName = `动态背景图-${el.tagName.toLowerCase()}-${Date.now().toString().slice(-4)}`;
                            newImageItems.push({
                                id: `dynamic-bg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                                url: fullUrl, name: Utils.truncateTo4Bytes(originalName),
                                format: Utils.truncateTo4Bytes(originalFormat || CONFIG.defaultImageFormat),
                                width: '动态背景', height: '动态背景',
                                type: Utils.truncateTo4Bytes('动态背景'),
                                preview: fullUrl, originalName, originalFormat,
                                originalType: '动态背景图', svgContent, fileSize: '未知'
                            });
                            processedUrls.add(imgUrl);
                        }
                    } catch (e) { /* ignore */ }
                }

                if (newImageItems.length > 0) {
                    const uniqueNewItems = await Deduplication.checkAndRemoveDuplicates(newImageItems, this.imageSignatureMap);
                    const finalNewItems = uniqueNewItems.filter(newItem => {
                        return !this.globalImageItems.some(existingItem =>
                            this.imageSignatureMap.get(existingItem.id) === this.imageSignatureMap.get(newItem.id)
                        );
                    });
                    if (finalNewItems.length > 0) {
                        this.globalImageItems.push(...finalNewItems);
                        finalNewItems.forEach(item => this.imageItemCache.set(item.id, item));
                        document.getElementById('imageCount').textContent = this.globalImageItems.length;
                        const fragment = document.createDocumentFragment();
                        finalNewItems.forEach(item => fragment.appendChild(UIRenderer.createImageItemElement(item)));
                        document.getElementById('svgList').appendChild(fragment);
                        this.fabElements.badge.textContent = this.globalImageItems.length;
                        Notification.show(`发现新图片：${finalNewItems.length}张`, 'success');
                    }
                }
                DynamicListener.lastScrollHeight = document.documentElement.scrollHeight;
            } catch (error) {
                console.error('动态图片采集失败:', error);
                Notification.show('动态图片采集失败', 'error');
            } finally {
                ImageCollector.restoreHiddenElements();
            }
        }
    };

    // ==================== 启动应用 ====================
    App.init();
})();