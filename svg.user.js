// ==UserScript==
// @name         SVG嗅探器增强版
// @namespace    http://tampermonkey.net/
// @version      2.0.5
// @description  扫描、预览、下载网页中的SVG图片 | 支持去重/搜索/排序/多格式导出(PNG/DataURI/React/Base64)/压缩/暗色模式
// @author       晚风知我意
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_setClipboard
// @grant        GM_notification
// @grant        GM_download
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
// @icon         https://raw.githubusercontent.com/qq5855144/greasyfork/main/download.svg
// @license      MIT
// @downloadURL  https://update.greasyfork.org/scripts/544921/SVG%E5%97%85%E6%8E%A2%E5%99%A8.user.js
// @updateURL    https://update.greasyfork.org/scripts/544921/SVG%E5%97%85%E6%8E%A2%E5%99%A8.meta.js
// ==/UserScript==

(function () {
    'use strict';

    /* ================================================================
     *  配置 & 常量
     * ================================================================ */
    const CONFIG = {
        buttonSize: 30,
        positionOffset: 25,
        touchDelay: 300,
        scanDelay: 300,
        maxNameLength: 50,
        toastDuration: 3000,
        maxToasts: 4,
    };

    const STORAGE_KEYS = {
        position: (domain) => `svgSniffer_pos_${domain}`,
        theme: 'svgSniffer_theme',
        viewMode: 'svgSniffer_viewMode',
        previewSize: 'svgSniffer_previewSize',
    };

    /* ================================================================
     *  状态管理
     * ================================================================ */
    const state = {
        svgItems: [],
        filteredItems: [],
        cache: new Map(),
        blobUrls: [],
        isDragging: false,
        dragStartTime: 0,
        touchTimer: null,
        startX: 0, startY: 0, startLeft: 0, startTop: 0,
        currentSort: 'position',
        currentFilter: '',
        viewMode: GM_getValue(STORAGE_KEYS.viewMode, 'list'),
        previewSize: GM_getValue(STORAGE_KEYS.previewSize, 'medium'),
        theme: GM_getValue(STORAGE_KEYS.theme, 'auto'),
    };

    /* ================================================================
     *  样式注入 — 现代设计系统 + 暗色模式
     * ================================================================ */
    function injectStyles() {
        GM_addStyle(`
        /* ========== 设计变量 ========== */
        .svg-sniffer-root {
            --ss-bg: #f8fafc;
            --ss-surface: #ffffff;
            --ss-surface-alt: #f8fafc;
            --ss-surface-hover: #eef2ff;
            --ss-text: #0f172a;
            --ss-text-secondary: #475569;
            --ss-text-muted: #94a3b8;
            --ss-border: #e2e8f0;
            --ss-border-light: #f1f5f9;
            --ss-primary: #6366f1;
            --ss-primary-light: #818cf8;
            --ss-primary-dark: #4f46e5;
            --ss-primary-bg: #eef2ff;
            --ss-success: #10b981;
            --ss-success-bg: #ecfdf5;
            --ss-warning: #f59e0b;
            --ss-warning-bg: #fffbeb;
            --ss-danger: #ef4444;
            --ss-danger-bg: #fef2f2;
            --ss-shadow-xs: 0 1px 2px rgba(0,0,0,.04);
            --ss-shadow-sm: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
            --ss-shadow-md: 0 4px 6px -1px rgba(0,0,0,.08), 0 2px 4px -2px rgba(0,0,0,.04);
            --ss-shadow-lg: 0 10px 15px -3px rgba(0,0,0,.08), 0 4px 6px -4px rgba(0,0,0,.04);
            --ss-shadow-xl: 0 20px 25px -5px rgba(0,0,0,.1), 0 8px 10px -6px rgba(0,0,0,.04);
            --ss-radius-sm: 8px;
            --ss-radius: 10px;
            --ss-radius-lg: 14px;
            --ss-radius-xl: 18px;
            --ss-glass: rgba(255,255,255,.72);
            --ss-glass-alt: rgba(248,250,252,.5);
            --ss-glass-item: rgba(255,255,255,.55);
            --ss-glass-border: rgba(255,255,255,.5);
            --ss-glass-header: rgba(99,102,241,.82);
            --ss-glass-hover: rgba(255,255,255,.65);
            --ss-blur: blur(20px) saturate(180%);
            --ss-transition: .25s cubic-bezier(.4,0,.2,1);
        }
        .svg-sniffer-root[data-theme="dark"] {
            --ss-bg: #0b1120;
            --ss-surface: #1a2332;
            --ss-surface-alt: #243044;
            --ss-surface-hover: #2d3a4f;
            --ss-text: #f1f5f9;
            --ss-text-secondary: #b4c0d0;
            --ss-text-muted: #94a3b8;
            --ss-border: #2d3a4f;
            --ss-border-light: #1a2332;
            --ss-primary: #818cf8;
            --ss-primary-light: #a5b4fc;
            --ss-primary-dark: #6366f1;
            --ss-primary-bg: #312e81;
            --ss-success: #34d399;
            --ss-success-bg: #064e3b;
            --ss-warning: #fbbf24;
            --ss-warning-bg: #78350f;
            --ss-danger: #f87171;
            --ss-danger-bg: #7f1d1d;
            --ss-shadow-xs: 0 1px 2px rgba(0,0,0,.3);
            --ss-shadow-sm: 0 1px 3px rgba(0,0,0,.35), 0 1px 2px rgba(0,0,0,.25);
            --ss-shadow-md: 0 4px 6px -1px rgba(0,0,0,.4), 0 2px 4px -2px rgba(0,0,0,.3);
            --ss-shadow-lg: 0 10px 15px -3px rgba(0,0,0,.45), 0 4px 6px -4px rgba(0,0,0,.3);
            --ss-shadow-xl: 0 20px 25px -5px rgba(0,0,0,.55), 0 8px 10px -6px rgba(0,0,0,.4);
            --ss-glass: rgba(26,35,50,.72);
            --ss-glass-alt: rgba(36,48,68,.5);
            --ss-glass-item: rgba(36,48,68,.45);
            --ss-glass-border: rgba(255,255,255,.08);
            --ss-glass-header: rgba(99,102,241,.45);
            --ss-glass-hover: rgba(45,58,79,.55);
        }
        .svg-sniffer-root *,
        .svg-sniffer-root *::before,
        .svg-sniffer-root *::after { box-sizing: border-box !important; margin: 0 !important; padding: 0 !important; }
        .svg-sniffer-root { all: initial; }
        .svg-sniffer-root { box-sizing: border-box !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important; }

        /* ========== 雷达浮动按钮 ========== */
        .ss-radar-container {
            position: fixed !important; z-index: 999999 !important;
            cursor: move !important; transition: transform .2s !important; touch-action: none !important;
            margin: 0 !important; padding: 0 !important;
        }
        .ss-radar-button {
            width: ${CONFIG.buttonSize}px !important; height: ${CONFIG.buttonSize}px !important;
            border-radius: 50% !important; display: flex !important; align-items: center !important; justify-content: center !important;
            background: var(--ss-glass-header) !important; backdrop-filter: var(--ss-blur) !important; -webkit-backdrop-filter: var(--ss-blur) !important;
            border: 1px solid var(--ss-glass-border) !important; outline: none !important; position: relative !important;
            overflow: hidden !important; user-select: none !important; -webkit-tap-highlight-color: transparent !important;
            animation: ss-pulse 2s infinite !important; transition: transform .3s, box-shadow .3s !important;
            box-shadow: 0 6px 18px rgba(99,102,241,.3), 0 0 0 4px rgba(255,255,255,.1), inset 0 1px 1px rgba(255,255,255,.2) !important;
            margin: 0 !important; padding: 0 !important; flex-shrink: 0 !important;
        }
        .ss-radar-button:hover { transform: scale(1.08) !important; box-shadow: 0 8px 24px rgba(99,102,241,.4), 0 0 0 4px rgba(255,255,255,.2), inset 0 1px 1px rgba(255,255,255,.3) !important; }
        .ss-radar-button:active { transform: scale(.95) !important; }
        .ss-radar-button svg { width: 20px !important; height: 20px !important; animation: ss-scan 4s linear infinite !important; display: block !important; }
        .ss-badge {
            position: absolute !important; top: -4px !important; right: -4px !important; min-width: 16px !important; height: 16px !important;
            border-radius: 8px !important; background: var(--ss-danger) !important; color: #fff !important;
            font-size: 10px !important; font-weight: 700 !important; display: flex !important; align-items: center !important; justify-content: center !important;
            padding: 0 4px !important; box-shadow: 0 2px 6px rgba(239,68,68,.4) !important; border: 2px solid var(--ss-glass) !important;
            line-height: 1 !important; margin: 0 !important;
        }

        /* ========== 遮罩层 ========== */
        .ss-overlay {
            position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important;
            z-index: 999998 !important; background: rgba(15,23,42,.55) !important;
            backdrop-filter: blur(8px) !important; -webkit-backdrop-filter: blur(8px) !important;
            display: none !important; animation: ss-fadeIn .25s ease !important; margin: 0 !important; padding: 0 !important;
        }

        /* ========== 模态框 ========== */
        .ss-modal {
            display: none !important; position: fixed !important; top: 50% !important; left: 50% !important;
            transform: translate(-50%,-50%) !important; width: 92% !important; max-width: 880px !important; max-height: 85vh !important; height: auto !important;
            background: var(--ss-glass) !important; backdrop-filter: var(--ss-blur) !important; -webkit-backdrop-filter: var(--ss-blur) !important;
            border: 1px solid var(--ss-glass-border) !important; z-index: 999999 !important; border-radius: var(--ss-radius-xl) !important;
            box-shadow: var(--ss-shadow-xl) !important; overflow: hidden !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            animation: ss-scaleIn .35s cubic-bezier(.16,1,.3,1) !important;
            flex-direction: column !important; margin: 0 !important; padding: 0 !important;
        }
        @media (max-width: 768px) { .ss-modal { width: 96% !important; max-height: 90vh !important; border-radius: var(--ss-radius-lg) !important; } }
        @media (max-width: 768px) { .ss-modal-content { max-height: calc(90vh - 300px) !important; padding: 12px 16px !important; } }
        @media (max-width: 768px) { .ss-toolbar { padding: 10px 16px !important; gap: 8px !important; } }
        @media (max-width: 768px) { .ss-stats { padding: 8px 16px !important; } }
        @media (max-width: 768px) { .ss-action-bar { padding: 10px 16px !important; } }
        @media (max-width: 768px) { .ss-modal-header { padding: 14px 18px !important; } }
        @media (max-width: 768px) { .ss-modal-header h2 { font-size: 1rem !important; } }

        .ss-modal-header {
            background: var(--ss-glass-header) !important; backdrop-filter: var(--ss-blur) !important; -webkit-backdrop-filter: var(--ss-blur) !important;
            border-bottom: 1px solid var(--ss-glass-border) !important; color: #fff !important; padding: 16px 24px !important;
            display: flex !important; justify-content: space-between !important; align-items: center !important;
            flex-shrink: 0 !important; margin: 0 !important; width: 100% !important;
            box-shadow: 0 1px 3px rgba(0,0,0,.05) !important;
        }
        .ss-modal-header h2 {
            margin: 0 !important; font-size: 1.1rem !important; font-weight: 700 !important; letter-spacing: -0.01em !important;
            display: flex !important; align-items: center !important; gap: 8px !important; color: #fff !important;
            line-height: 1.4 !important; padding: 0 !important;
        }
        .ss-modal-header h2 svg { width: 20px !important; height: 20px !important; flex-shrink: 0 !important; display: block !important; }
        .ss-header-actions { display: flex !important; gap: 6px !important; align-items: center !important; flex-shrink: 0 !important; margin: 0 !important; padding: 0 !important; }
        .ss-icon-btn {
            width: 34px !important; height: 34px !important; border-radius: 50% !important; border: none !important; cursor: pointer !important;
            display: flex !important; align-items: center !important; justify-content: center !important; background: rgba(255,255,255,.12) !important;
            color: #fff !important; transition: var(--ss-transition) !important; padding: 0 !important; margin: 0 !important; flex-shrink: 0 !important;
            -webkit-appearance: none !important; appearance: none !important;
        }
        .ss-icon-btn:hover { background: rgba(255,255,255,.25) !important; transform: scale(1.05) !important; }
        .ss-icon-btn svg { width: 16px !important; height: 16px !important; display: block !important; }

        /* ========== 工具栏 ========== */
        .ss-toolbar {
            display: flex !important; align-items: center !important; gap: 12px !important; padding: 12px 20px !important;
            background: var(--ss-glass-alt) !important; border-bottom: 1px solid var(--ss-border) !important;
            flex-wrap: wrap !important; flex-shrink: 0 !important; margin: 0 !important; width: 100% !important;
        }
        .ss-search-box { flex: 1 1 180px !important; min-width: 120px !important; position: relative !important; margin: 0 !important; padding: 0 !important; }
        .ss-search-box input {
            width: 100% !important; height: 36px !important; padding: 0 12px 0 38px !important; border: 2px solid var(--ss-border) !important;
            border-radius: var(--ss-radius) !important; font-size: 14px !important; color: var(--ss-text) !important;
            background: var(--ss-glass-item) !important; transition: var(--ss-transition) !important; outline: none !important;
            margin: 0 !important; -webkit-appearance: none !important; appearance: none !important;
            display: block !important; box-sizing: border-box !important;
        }
        .ss-search-box input:focus { border-color: var(--ss-primary) !important; box-shadow: 0 0 0 3px rgba(99,102,241,.15) !important; }
        .ss-search-box svg {
            position: absolute !important; left: 12px !important; top: 50% !important; transform: translateY(-50%) !important;
            width: 15px !important; height: 15px !important; color: var(--ss-text-muted) !important; pointer-events: none !important; display: block !important;
        }
        .ss-select {
            height: 36px !important; padding: 0 10px !important; border: 2px solid var(--ss-border) !important; border-radius: var(--ss-radius-sm) !important;
            font-size: 13px !important; color: var(--ss-text) !important; background: var(--ss-glass-item) !important;
            cursor: pointer !important; outline: none !important; transition: var(--ss-transition) !important;
            margin: 0 !important; -webkit-appearance: auto !important; appearance: auto !important; display: inline-block !important;
            flex-shrink: 0 !important;
        }
        .ss-select:focus { border-color: var(--ss-primary) !important; }
        .ss-view-toggle { display: flex !important; gap: 2px !important; background: var(--ss-border) !important; border-radius: var(--ss-radius) !important; padding: 3px !important; margin: 0 !important; flex-shrink: 0 !important; }
        .ss-view-toggle button {
            height: 30px !important; padding: 0 12px !important; border: none !important; border-radius: 8px !important; cursor: pointer !important;
            background: transparent !important; color: var(--ss-text-secondary) !important; font-size: 12px !important; transition: var(--ss-transition) !important;
            margin: 0 !important; display: flex !important; align-items: center !important; gap: 4px !important; -webkit-appearance: none !important; appearance: none !important;
        }
        .ss-view-toggle button svg { width: 14px !important; height: 14px !important; display: block !important; }
        .ss-view-toggle button.active { background: var(--ss-glass-hover) !important; color: var(--ss-primary) !important; font-weight: 600 !important; box-shadow: var(--ss-shadow-sm) !important; }

        /* ========== 统计栏 ========== */
        .ss-stats {
            display: flex !important; gap: 8px !important; padding: 10px 20px !important; background: var(--ss-glass-alt) !important;
            border-bottom: 1px solid var(--ss-border) !important; font-size: 12px !important; color: var(--ss-text-secondary) !important;
            flex-shrink: 0 !important; margin: 0 !important; width: 100% !important; flex-wrap: wrap !important; align-items: center !important;
        }
        .ss-stat-item { display: flex !important; align-items: center !important; gap: 4px !important; margin: 0 !important; padding: 0 !important; }
        .ss-stat-item strong { color: var(--ss-primary) !important; font-size: 14px !important; font-weight: 700 !important; }
        .ss-stat-pill {
            display: inline-flex !important; align-items: center !important; gap: 4px !important;
            background: var(--ss-glass-item) !important; border: 1px solid var(--ss-border) !important;
            padding: 4px 10px !important; border-radius: 999px !important; font-size: 12px !important;
            color: var(--ss-text-secondary) !important; margin: 0 !important; white-space: nowrap !important;
        }
        .ss-stat-pill strong { color: var(--ss-primary) !important; font-size: 13px !important; font-weight: 700 !important; }

        /* ========== 操作栏 ========== */
        .ss-action-bar {
            display: flex !important; justify-content: space-between !important; align-items: center !important;
            padding: 12px 20px !important; background: var(--ss-glass-alt) !important; border-top: 1px solid var(--ss-border) !important;
            flex-shrink: 0 !important; margin: 0 !important; width: 100% !important; gap: 8px !important;
        }
        .ss-select-all-control { display: flex !important; align-items: center !important; gap: 8px !important; font-size: 13px !important; color: var(--ss-text-secondary) !important; cursor: pointer !important; margin: 0 !important; padding: 0 !important; flex-shrink: 0 !important; }
        .ss-select-all-control input {
            width: 18px !important; height: 18px !important; cursor: pointer !important; accent-color: var(--ss-primary) !important;
            margin: 0 !important; -webkit-appearance: auto !important; appearance: auto !important; display: inline-block !important; visibility: visible !important; opacity: 1 !important;
        }
        .ss-action-buttons { display: flex !important; gap: 8px !important; flex-wrap: wrap !important; margin: 0 !important; padding: 0 !important; }
        .ss-btn {
            height: 36px !important; padding: 0 14px !important; border: none !important; border-radius: var(--ss-radius) !important; cursor: pointer !important;
            font-weight: 600 !important; font-size: 13px !important; transition: var(--ss-transition) !important;
            display: flex !important; align-items: center !important; gap: 5px !important; margin: 0 !important;
            -webkit-appearance: none !important; appearance: none !important; line-height: 1.4 !important; white-space: nowrap !important;
        }
        .ss-btn svg { width: 14px !important; height: 14px !important; display: block !important; flex-shrink: 0 !important; }
        .ss-btn-primary { background: var(--ss-primary) !important; color: #fff !important; }
        .ss-btn-primary:hover { background: var(--ss-primary-dark) !important; transform: translateY(-1px) !important; box-shadow: var(--ss-shadow-md) !important; filter: brightness(1.05) !important; }
        .ss-btn-success { background: var(--ss-success) !important; color: #fff !important; }
        .ss-btn-success:hover { filter: brightness(1.1) !important; transform: translateY(-1px) !important; box-shadow: var(--ss-shadow-md) !important; }
        .ss-btn-secondary { background: var(--ss-glass-item) !important; color: var(--ss-text) !important; border: 1px solid var(--ss-border) !important; }
        .ss-btn-secondary:hover { background: var(--ss-glass-hover) !important; border-color: var(--ss-primary) !important; transform: translateY(-1px) !important; box-shadow: var(--ss-shadow-md) !important; filter: brightness(1.02) !important; }
        .ss-btn-danger { background: var(--ss-danger) !important; color: #fff !important; }
        .ss-btn-danger:hover { filter: brightness(1.1) !important; transform: translateY(-1px) !important; box-shadow: var(--ss-shadow-md) !important; }

        /* ========== 内容区 ========== */
        .ss-modal-content { padding: 16px 20px !important; overflow-y: auto !important; flex: 0 1 auto !important; min-height: 0 !important; max-height: calc(85vh - 260px) !important; margin: 0 !important; width: 100% !important; }
        .ss-modal-content::-webkit-scrollbar { width: 6px !important; }
        .ss-modal-content::-webkit-scrollbar-track { background: transparent !important; }
        .ss-modal-content::-webkit-scrollbar-thumb { background: var(--ss-border) !important; border-radius: 3px !important; }
        .ss-modal-content::-webkit-scrollbar-thumb:hover { background: var(--ss-text-muted) !important; }

        /* ========== 列表视图 ========== */
        .ss-svg-list { display: flex !important; flex-direction: column !important; gap: 8px !important; margin: 0 !important; padding: 0 !important; list-style: none !important; }
        .ss-svg-item {
            display: flex !important; align-items: center !important; padding: 12px 14px !important; border: 1px solid var(--ss-border) !important;
            border-radius: 12px !important; transition: var(--ss-transition) !important; gap: 12px !important;
            background: var(--ss-glass-item) !important; margin: 0 !important; width: 100% !important;
        }
        .ss-svg-item:hover { background: var(--ss-glass-hover) !important; border-color: var(--ss-primary-light) !important; box-shadow: var(--ss-shadow-sm) !important; }
        .ss-svg-checkbox {
            width: 18px !important; height: 18px !important; cursor: pointer !important; accent-color: var(--ss-primary) !important; flex-shrink: 0 !important;
            margin: 0 !important; -webkit-appearance: auto !important; appearance: auto !important; display: inline-block !important; visibility: visible !important; opacity: 1 !important;
        }

        /* ========== 预览尺寸 ========== */
        .ss-preview { display: flex !important; align-items: center !important; justify-content: center !important; border-radius: 10px !important; background: var(--ss-glass-alt) !important; background-image: linear-gradient(45deg, var(--ss-border-light) 25%, transparent 25%), linear-gradient(-45deg, var(--ss-border-light) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--ss-border-light) 75%), linear-gradient(-45deg, transparent 75%, var(--ss-border-light) 75%) !important; background-size: 12px 12px !important; background-position: 0 0, 0 6px, 6px -6px, -6px 0px !important; border: 1px solid var(--ss-border) !important; flex-shrink: 0 !important; margin: 0 !important; overflow: hidden !important; }
        .ss-preview[data-size="small"] { width: 40px !important; height: 40px !important; }
        .ss-preview[data-size="medium"] { width: 52px !important; height: 52px !important; }
        .ss-preview[data-size="large"] { width: 72px !important; height: 72px !important; }
        .ss-preview svg { max-width: 80% !important; max-height: 80% !important; display: block !important; }
        .ss-preview[data-size="large"] svg { max-width: 80% !important; max-height: 80% !important; display: block !important; }

        .ss-svg-info { flex-grow: 1 !important; min-width: 0 !important; margin: 0 !important; padding: 0 !important; }
        .ss-svg-name { font-size: 14px !important; color: var(--ss-text) !important; font-weight: 500 !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; margin: 0 !important; padding: 0 !important; line-height: 1.4 !important; }
        .ss-svg-meta { font-size: 11px !important; color: var(--ss-text-muted) !important; margin-top: 2px !important; display: flex !important; gap: 6px !important; padding: 0 !important; }
        .ss-svg-tag { display: inline-block !important; padding: 2px 8px !important; border-radius: 999px !important; font-size: 10px !important; font-weight: 600 !important; margin: 0 !important; }
        .ss-svg-tag-size { background: var(--ss-primary-bg) !important; color: var(--ss-primary) !important; }
        .ss-svg-tag-dim { background: var(--ss-success-bg) !important; color: var(--ss-success) !important; }

        .ss-item-actions { display: flex !important; gap: 4px !important; flex-shrink: 0 !important; margin: 0 !important; padding: 0 !important; }
        .ss-item-btn {
            width: 30px !important; height: 30px !important; border: 1px solid var(--ss-border) !important; border-radius: 50% !important;
            background: var(--ss-glass-item) !important; cursor: pointer !important; display: flex !important; align-items: center !important; justify-content: center !important;
            transition: var(--ss-transition) !important; color: var(--ss-text-secondary) !important; padding: 0 !important; margin: 0 !important;
            -webkit-appearance: none !important; appearance: none !important; flex-shrink: 0 !important;
        }
        .ss-item-btn:hover { background: var(--ss-primary) !important; color: #fff !important; border-color: var(--ss-primary) !important; transform: scale(1.08) !important; }
        .ss-item-btn svg { width: 14px !important; height: 14px !important; display: block !important; }

        /* ========== 网格视图 ========== */
        .ss-svg-grid { display: grid !important; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)) !important; gap: 12px !important; margin: 0 !important; padding: 0 !important; list-style: none !important; }
        .ss-grid-card {
            border: 1px solid var(--ss-border) !important; border-radius: 12px !important; padding: 10px !important;
            background: var(--ss-glass-item) !important; transition: var(--ss-transition) !important; cursor: pointer !important; position: relative !important; margin: 0 !important;
        }
        .ss-grid-card:hover { border-color: var(--ss-primary-light) !important; box-shadow: var(--ss-shadow-md) !important; transform: translateY(-3px) !important; background: var(--ss-glass-hover) !important; }
        .ss-grid-card .ss-grid-preview {
            width: 100% !important; aspect-ratio: 1 !important; display: flex !important; align-items: center !important; justify-content: center !important;
            background: var(--ss-glass-alt) !important; background-image: linear-gradient(45deg, var(--ss-border-light) 25%, transparent 25%), linear-gradient(-45deg, var(--ss-border-light) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--ss-border-light) 75%), linear-gradient(-45deg, transparent 75%, var(--ss-border-light) 75%) !important; background-size: 12px 12px !important; background-position: 0 0, 0 6px, 6px -6px, -6px 0px !important; border: 1px solid var(--ss-border) !important; border-radius: 10px !important; margin-bottom: 6px !important; overflow: hidden !important;
        }
        .ss-grid-card .ss-grid-preview svg { max-width: 75% !important; max-height: 75% !important; display: block !important; }
        .ss-grid-card .ss-grid-name { font-size: 12px !important; color: var(--ss-text) !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; font-weight: 500 !important; margin: 0 !important; padding: 0 !important; }
        .ss-grid-card .ss-grid-meta { font-size: 10px !important; color: var(--ss-text-muted) !important; margin-top: 2px !important; padding: 0 !important; }
        .ss-grid-card .ss-grid-checkbox { position: absolute !important; top: 4px !important; left: 4px !important; width: 16px !important; height: 16px !important; accent-color: var(--ss-primary) !important; z-index: 1 !important; -webkit-appearance: auto !important; appearance: auto !important; display: inline-block !important; visibility: visible !important; opacity: 1 !important; }
        .ss-grid-card .ss-grid-actions { position: absolute !important; top: 4px !important; right: 4px !important; display: flex !important; gap: 3px !important; opacity: 0 !important; transition: var(--ss-transition) !important; margin: 0 !important; padding: 0 !important; }
        .ss-grid-card:hover .ss-grid-actions { opacity: 1 !important; }
        .ss-grid-card .ss-item-btn { width: 26px !important; height: 26px !important; }

        /* ========== 下拉菜单 ========== */
        .ss-dropdown {
            position: absolute !important; bottom: 100% !important; right: 0 !important; margin-bottom: 6px !important;
            background: var(--ss-glass) !important; backdrop-filter: var(--ss-blur) !important; -webkit-backdrop-filter: var(--ss-blur) !important;
            border: 1px solid var(--ss-glass-border) !important; border-radius: 12px !important;
            box-shadow: var(--ss-shadow-lg) !important; z-index: 10 !important; overflow: hidden !important; min-width: 170px !important;
            display: none !important; animation: ss-scaleIn .15s ease !important; padding: 0 !important;
        }
        .ss-dropdown.show { display: block !important; }
        .ss-dropdown-item {
            display: flex !important; align-items: center !important; gap: 8px !important; padding: 10px 14px !important; cursor: pointer !important;
            font-size: 13px !important; color: var(--ss-text) !important; transition: var(--ss-transition) !important; white-space: nowrap !important; margin: 0 !important;
        }
        .ss-dropdown-item:hover { background: var(--ss-glass-hover) !important; color: var(--ss-primary) !important; }
        .ss-dropdown-item svg { width: 14px !important; height: 14px !important; display: block !important; flex-shrink: 0 !important; }
        .ss-dropdown-item:first-child { border-radius: 12px 12px 0 0 !important; }
        .ss-dropdown-item:last-child { border-radius: 0 0 12px 12px !important; }
        .ss-dropdown-divider { height: 1px !important; background: var(--ss-border) !important; margin: 4px 0 !important; padding: 0 !important; }

        /* ========== 空状态/加载 ========== */
        .ss-empty, .ss-loading {
            text-align: center !important; padding: 60px 20px !important; color: var(--ss-text-muted) !important; font-size: 14px !important; margin: 0 !important;
        }
        .ss-loading svg { width: 36px !important; height: 36px !important; animation: ss-spin 1s linear infinite !important; margin-bottom: 16px !important; display: inline-block !important; }

        /* ========== Toast 通知 ========== */
        .ss-toast-container {
            position: fixed !important; top: 24px !important; left: 50% !important; transform: translateX(-50%) !important;
            z-index: 1000001 !important; display: flex !important; flex-direction: column !important; gap: 8px !important; align-items: center !important; pointer-events: none !important;
            margin: 0 !important; padding: 0 !important;
        }
        .ss-toast {
            padding: 12px 20px !important; border-radius: 12px !important; color: #fff !important; font-size: 14px !important; font-weight: 500 !important;
            backdrop-filter: var(--ss-blur) !important; -webkit-backdrop-filter: var(--ss-blur) !important; border: 1px solid var(--ss-glass-border) !important;
            box-shadow: var(--ss-shadow-lg) !important; display: flex !important; align-items: center !important; gap: 8px !important;
            animation: ss-slideDown .3s ease, ss-fadeOut .4s ease 2.6s forwards !important; max-width: 90vw !important; margin: 0 !important;
        }
        .ss-toast.success { background: rgba(16,185,129,.82) !important; }
        .ss-toast.error { background: rgba(239,68,68,.82) !important; }
        .ss-toast.warning { background: rgba(245,158,11,.82) !important; }
        .ss-toast.info { background: rgba(99,102,241,.82) !important; }

        /* ========== 动画 ========== */
        @keyframes ss-scan { to { transform: rotate(360deg); } }
        @keyframes ss-pulse {
            0% { box-shadow: 0 0 0 0 rgba(99,102,241,.4), 0 6px 18px rgba(99,102,241,.3), 0 0 0 4px rgba(255,255,255,.1); }
            70% { box-shadow: 0 0 0 12px rgba(99,102,241,0), 0 6px 18px rgba(99,102,241,.3), 0 0 0 4px rgba(255,255,255,.1); }
            100% { box-shadow: 0 0 0 0 rgba(99,102,241,0), 0 6px 18px rgba(99,102,241,.3), 0 0 0 4px rgba(255,255,255,.1); }
        }
        @keyframes ss-fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ss-fadeOut { to { opacity: 0; transform: translateY(-10px); } }
        @keyframes ss-scaleIn { from { opacity: 0; transform: scale(.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes ss-slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ss-spin { to { transform: rotate(360deg); } }
        `);
    }

    /* ================================================================
     *  工具函数
     * ================================================================ */
    const utils = {
        svgIcons: {
            radar: `<svg viewBox="0 0 1024 1024" fill="white"><path d="M512 625.8c-63 0-113.8-51-113.8-113.8s51-113.8 113.8-113.8 113.8 51 113.8 113.8-50.8 113.8-113.8 113.8z m0-165.6c-28.6 0-51.8 23.2-51.8 51.8 0 28.6 23.2 51.8 51.8 51.8 28.6 0 51.8-23.2 51.8-51.8 0-28.6-23.2-51.8-51.8-51.8zM843.2 791.4c-6.6 0-12.8-2-18.6-6.2-13.6-10.4-16.6-29.8-6.2-43.4 50-66.6 76.6-146.2 76.6-229.8s-26.4-163-76.6-229.8c-10.4-13.6-7.4-33.2 6.2-43.4 13.6-10.4 33.2-7.4 43.4 6.2 58.4 77.4 89 169.8 89 267s-30.6 189.6-89 267c-6.2 8.2-15.4 12.4-24.8 12.4zM180.8 791.4c-9.6 0-18.6-4.2-24.8-12.4-58.4-77.4-89-169.8-89-267S97.6 322.4 156 245c10.4-13.6 29.8-16.6 43.4-6.2 13.6 10.4 16.6 29.8 6.2 43.4-50 66.6-76.6 146.2-76.6 229.8s26.4 163 76.6 229.8c10.4 13.6 7.4 33.2-6.2 43.4-5.4 4.2-12 6.2-18.6 6.2zM710.8 692c-6.6 0-12.8-2-18.6-6.2-13.6-10.4-16.6-29.8-6.2-43.4 28.6-37.6 43.4-82.8 43.4-130.4s-15-92.8-43.4-130.4c-10.4-13.6-7.4-33.2 6.2-43.4 13.6-10.4 33.2-7.4 43.4 6.2 36.4 48.8 55.8 106.8 55.8 167.6s-19.4 119.2-55.8 167.6c-6.2 8.4-15.4 12.4-24.8 12.4zM313.4 692c-9.6 0-18.6-4.2-24.8-12.4-36.4-48.8-55.8-106.8-55.8-167.6s19.4-119.2 55.8-167.6c10.4-13.6 29.8-16.6 43.4-6.2 13.6 10.4 16.6 29.8 6.2 43.4-28.6 37.6-43.4 82.8-43.4 130.4s15 92.8 43.4 130.4c10.4 13.6 7.4 33.2-6.2 43.4-5.4 4.2-12 6.2-18.6 6.2z"></path></svg>`,
            search: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg>`,
            download: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>`,
            copy: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm2.32-1h4.36A2.32 2.32 0 0 1 13 3.32v4.36A2.32 2.32 0 0 1 10.68 10H9v-.5h1.68A1.82 1.82 0 0 0 12.5 7.68V3.32A1.82 1.82 0 0 0 10.68 1.5H6.32A1.82 1.82 0 0 0 4.5 3.32V4H4v-.68A2.32 2.32 0 0 1 6.32 1z"/><path d="M2 6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6zm2-1a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H4z"/></svg>`,
            close: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>`,
            sun: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8zm10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0zm-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707zM4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708z"/></svg>`,
            moon: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M6 .278a.768.768 0 0 1 .08.8.769.769 0 0 1-.8.768 5.5 5.5 0 1 0 5.5 5.5.769.769 0 0 1 .768-.8A.768.768 0 0 1 12.5 6.5 6.5 6.5 0 1 1 6 .278z"/></svg>`,
            list: `<svg viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/></svg>`,
            grid: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z"/></svg>`,
            settings: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/><path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319z"/></svg>`,
            code: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M10.478 1.547a.5.5 0 1 0-.956-.294l-4 13a.5.5 0 0 0 .956.294l4-13zM4.854 4.146a.5.5 0 0 1 0 .708L1.707 8l3.147 3.146a.5.5 0 0 1-.708.708l-3.5-3.5a.5.5 0 0 1 0-.708l3.5-3.5a.5.5 0 0 1 .708 0zm6.292 0a.5.5 0 0 0 0 .708L14.293 8l-3.147 3.146a.5.5 0 0 1-.708-.708l3.5-3.5a.5.5 0 0 1 0-.708l3.5-3.5z"/></svg>`,
            zip: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M6.5 7.75A1.75 1.75 0 0 1 8.25 6h1.5a1.75 1.75 0 0 1 1.75 1.75v8.5A1.75 1.75 0 0 1 9.75 18h-3.5A1.75 1.75 0 0 1 4.5 16.25v-8.5a1.75 1.75 0 0 1 1.75-1.75h.25V7a.5.5 0 0 1 1 0v.25h.75zM7.5 7.75v.5a.5.5 0 0 0 1 0v-.5a.5.5 0 0 0-1 0z"/></svg>`,
            optimize: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a.5.5 0 0 1 .4.2l3 4a.5.5 0 0 1-.8.6L8.5 1.5V7a.5.5 0 0 1-1 0V1.5L5.4 4.8a.5.5 0 1 1-.8-.6l3-4A.5.5 0 0 1 8 0zM3 8a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0v-6A.5.5 0 0 1 3 8zm10 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0v-6a.5.5 0 0 1 .5-.5z"/></svg>`,
            image: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/><path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-2.134-1.786a.5.5 0 0 0-.632 0L9.5 10.5l-2.734-2.286a.5.5 0 0 0-.632 0L1.002 12V3a1 1 0 0 1 1-1h12z"/></svg>`,
        },

        sanitizeFileName(name) {
            return name.replace(/[^\w\u4e00-\u9fa5\-\s]/g, '_').replace(/\s+/g, '_').substring(0, CONFIG.maxNameLength).trim() || 'unnamed_svg';
        },

        formatBytes(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / 1048576).toFixed(2) + ' MB';
        },

        getSvgSize(svgHtml) {
            return new Blob([svgHtml]).size;
        },

        getSvgDimensions(svg) {
            const w = svg.getAttribute('width') || svg.getAttribute('viewBox')?.split(/\s+/)[2];
            const h = svg.getAttribute('height') || svg.getAttribute('viewBox')?.split(/\s+/)[3];
            const rect = svg.getBoundingClientRect();
            return {
                width: w ? Math.round(parseFloat(w)) : Math.round(rect.width) || 0,
                height: h ? Math.round(parseFloat(h)) : Math.round(rect.height) || 0,
            };
        },

        detectAutoTheme() {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        },

        getEffectiveTheme() {
            return state.theme === 'auto' ? utils.detectAutoTheme() : state.theme;
        },

        minifySvg(svgHtml) {
            return svgHtml
                .replace(/<!--[\s\S]*?-->/g, '')
                .replace(/\s+/g, ' ')
                .replace(/>\s+</g, '><')
                .replace(/\s+\/>/g, '/>')
                .trim();
        },

        svgToDataUri(svgHtml) {
            const encoded = encodeURIComponent(svgHtml)
                .replace(/'/g, "%27")
                .replace(/"/g, "%22");
            return `data:image/svg+xml,${encoded}`;
        },

        svgToBase64(svgHtml) {
            return btoa(unescape(encodeURIComponent(svgHtml)));
        },

        svgToReactComponent(svgHtml, name) {
            const componentName = utils.sanitizeFileName(name)
                .replace(/[-_\s](.)/g, (_, c) => c.toUpperCase())
                .replace(/^(.)/, c => c.toUpperCase()) || 'SvgIcon';
            const reactSvg = svgHtml
                .replace(/\sclass=/g, ' className=')
                .replace(/\sfor=/g, ' htmlFor=')
                .replace(/\sstroke-width=/g, ' strokeWidth=')
                .replace(/\sstroke-linecap=/g, ' strokeLinecap=')
                .replace(/\sstroke-linejoin=/g, ' strokeLinejoin=')
                .replace(/\sfill-rule=/g, ' fillRule=')
                .replace(/\sclip-rule=/g, ' clipRule=')
                .replace(/\sxmlns:xlink=/g, ' xmlnsXlink=');
            return `const ${componentName} = (props) => (\n  ${reactSvg}\n);\n\nexport default ${componentName};`;
        },

        svgToCssBackground(svgHtml) {
            const dataUri = utils.svgToDataUri(svgHtml);
            return `background-image: url("${dataUri}");`;
        },

        async svgToPng(svgHtml, size = 512) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, size, size);
                    canvas.toBlob(blob => {
                        if (blob) resolve(blob);
                        else reject(new Error('PNG conversion failed'));
                    }, 'image/png');
                };
                img.onerror = () => reject(new Error('Image load failed'));
                img.src = utils.svgToDataUri(svgHtml);
            });
        },
    };

    /* ================================================================
     *  SVG 收集器 — 去重 + 尺寸检测 + 智能命名
     * ================================================================ */
    const svgCollector = {
        collect() {
            const svgElements = document.querySelectorAll('svg');
            const seen = new Set();
            const items = [];

            svgElements.forEach((svg, index) => {
                const html = svg.outerHTML;
                // Deduplicate by content hash (first 200 chars + length)
                const hash = html.length + ':' + html.substring(0, 200);
                if (seen.has(hash)) return;
                // Skip tiny SVGs (likely icons < 10px or hidden)
                const rect = svg.getBoundingClientRect();
                if (rect.width === 0 && rect.height === 0) {
                    const vb = svg.getAttribute('viewBox');
                    if (!vb) return;
                }
                seen.add(hash);

                const name = this.guessName(svg, index);
                const cloned = svg.cloneNode(true);
                this.cleanSvg(cloned);
                const dims = utils.getSvgDimensions(svg);
                const svgHtml = cloned.outerHTML;
                const size = utils.getSvgSize(svgHtml);

                items.push({
                    id: `svg-${index}-${Date.now()}`,
                    name,
                    svg: svgHtml,
                    size,
                    width: dims.width,
                    height: dims.height,
                    index,
                });
            });

            return items;
        },

        guessName(svg, index) {
            // Try aria-label or title
            const ariaLabel = svg.getAttribute('aria-label');
            if (ariaLabel) return ariaLabel.trim();
            const titleEl = svg.querySelector('title');
            if (titleEl && titleEl.textContent.trim()) return titleEl.textContent.trim();
            // Try id
            const id = svg.getAttribute('id');
            if (id) return id.replace(/[-_]/g, ' ').trim();
            // Try class
            const cls = svg.getAttribute('class');
            if (cls) {
                const meaningful = cls.split(/\s+/).find(c => c.length > 2 && !c.startsWith('ss-'));
                if (meaningful) return meaningful.replace(/[-_]/g, ' ');
            }
            // Try parent context
            let parent = svg.parentElement;
            while (parent && parent !== document.body) {
                const nameEl = parent.querySelector('h1, h2, h3, h4, [class*="title"], [class*="name"], [alt]');
                if (nameEl) {
                    const text = nameEl.getAttribute('alt') || nameEl.textContent.trim();
                    if (text && text.length < 80) return text.substring(0, CONFIG.maxNameLength);
                }
                parent = parent.parentElement;
            }
            return `SVG ${index + 1}`;
        },

        cleanSvg(svg) {
            svg.removeAttribute('onclick');
            svg.removeAttribute('onmouseover');
            svg.removeAttribute('onmouseout');
            svg.removeAttribute('onload');
            // Remove script tags inside SVG
            svg.querySelectorAll('script').forEach(s => s.remove());
        },
    };

    /* ================================================================
     *  下载管理器
     * ================================================================ */
    const downloadManager = {
        downloadSingle(item, format = 'svg') {
            const cleanName = utils.sanitizeFileName(item.name);

            if (format === 'svg') {
                this.downloadBlob(new Blob([`<?xml version="1.0" encoding="UTF-8"?>${item.svg}`], { type: 'image/svg+xml;charset=utf-8' }), `${cleanName}.svg`);
            } else if (format === 'minified') {
                const minified = utils.minifySvg(item.svg);
                this.downloadBlob(new Blob([`<?xml version="1.0" encoding="UTF-8"?>${minified}`], { type: 'image/svg+xml;charset=utf-8' }), `${cleanName}.min.svg`);
            } else if (format === 'png') {
                utils.svgToPng(item.svg, 512).then(blob => {
                    this.downloadBlob(blob, `${cleanName}.png`);
                    toast.show(`PNG导出成功: ${cleanName}.png`, 'success');
                }).catch(() => toast.show('PNG转换失败，可能含跨域资源', 'error'));
            }
        },

        downloadZip(items, format = 'svg') {
            const zip = new JSZip();
            const usedNames = new Set();

            items.forEach(item => {
                let name = utils.sanitizeFileName(item.name);
                let fileName = `${name}.${format === 'minified' ? 'min.svg' : format === 'png' ? 'png' : 'svg'}`;
                // Avoid duplicate filenames
                if (usedNames.has(fileName)) {
                    fileName = `${name}_${item.id.slice(-4)}.${format === 'minified' ? 'min.svg' : format === 'png' ? 'png' : 'svg'}`;
                }
                usedNames.add(fileName);

                let content;
                if (format === 'minified') {
                    content = `<?xml version="1.0" encoding="UTF-8"?>${utils.minifySvg(item.svg)}`;
                } else {
                    content = `<?xml version="1.0" encoding="UTF-8"?>${item.svg}`;
                }
                zip.file(fileName, content);
            });

            zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
                .then(content => {
                    const ts = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
                    const zipName = `svg_collection_${ts}.zip`;
                    this.downloadBlob(content, zipName);
                    toast.show(`批量下载成功: ${zipName} (${items.length}个)`, 'success');
                })
                .catch(() => {
                    toast.show('创建压缩包失败，尝试逐个下载', 'error');
                    items.slice(0, 3).forEach(i => this.downloadSingle(i, format));
                });
        },

        downloadBlob(blob, fileName) {
            try {
                saveAs(blob, fileName);
            } catch {
                const url = URL.createObjectURL(blob);
                state.blobUrls.push(url);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    state.blobUrls = state.blobUrls.filter(u => u !== url);
                }, 100);
            }
        },

        copyContent(content, label) {
            try {
                GM_setClipboard(content, 'text');
                toast.show(`已复制: ${label}`, 'success');
            } catch {
                const ta = document.createElement('textarea');
                ta.value = content;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                toast.show(`已复制: ${label}`, 'success');
            }
        },

        clearBlobUrls() {
            state.blobUrls.forEach(url => { try { URL.revokeObjectURL(url); } catch {} });
            state.blobUrls = [];
        },
    };

    /* ================================================================
     *  Toast 通知系统
     * ================================================================ */
    const toast = {
        container: null,
        init() {
            this.container = document.createElement('div');
            this.container.className = 'ss-toast-container';
            document.body.appendChild(this.container);
        },
        show(message, type = 'info') {
            if (!this.container) this.init();
            const el = document.createElement('div');
            el.className = `ss-toast ${type}`;
            el.textContent = message;
            this.container.appendChild(el);
            // Limit toasts
            while (this.container.children.length > CONFIG.maxToasts) {
                this.container.removeChild(this.container.firstChild);
            }
            setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, CONFIG.toastDuration);
        },
    };

    /* ================================================================
     *  UI 构建
     * ================================================================ */
    const ui = {
        root: null,
        radar: null,
        radarBtn: null,
        badge: null,
        overlay: null,
        modal: null,
        searchInput: null,
        sortSelect: null,
        selectAllCheckbox: null,
        contentEl: null,
        statsEl: null,
        copyDropdown: null,

        build() {
            this.root = document.createElement('div');
            this.root.className = 'svg-sniffer-root';
            this.root.dataset.theme = utils.getEffectiveTheme();
            document.body.appendChild(this.root);

            this.buildRadar();
            this.buildOverlay();
            this.buildModal();
            this.buildToast();
        },

        buildRadar() {
            this.radar = document.createElement('div');
            this.radar.className = 'ss-radar-container';
            this.radar.id = 'ss-radar';

            this.radarBtn = document.createElement('div');
            this.radarBtn.className = 'ss-radar-button';
            this.radarBtn.innerHTML = utils.svgIcons.radar;

            this.badge = document.createElement('div');
            this.badge.className = 'ss-badge';
            this.badge.style.setProperty('display', 'none', 'important');

            this.radar.appendChild(this.radarBtn);
            this.radar.appendChild(this.badge);
            this.root.appendChild(this.radar);
        },

        buildOverlay() {
            this.overlay = document.createElement('div');
            this.overlay.className = 'ss-overlay';
            this.root.appendChild(this.overlay);
        },

        buildModal() {
            this.modal = document.createElement('div');
            this.modal.className = 'ss-modal';
            this.modal.innerHTML = `
                <div class="ss-modal-header">
                    <h2>${utils.svgIcons.radar} SVG资源嗅探器</h2>
                    <div class="ss-header-actions">
                        <button class="ss-icon-btn" id="ss-theme-toggle" title="切换主题">${utils.svgIcons.sun}</button>
                        <button class="ss-icon-btn" id="ss-close-btn" title="关闭">${utils.svgIcons.close}</button>
                    </div>
                </div>
                <div class="ss-toolbar">
                    <div class="ss-search-box">
                        ${utils.svgIcons.search}
                        <input type="text" id="ss-search" placeholder="搜索SVG名称..." />
                    </div>
                    <select class="ss-select" id="ss-sort">
                        <option value="position">按位置排序</option>
                        <option value="name">按名称排序</option>
                        <option value="size-desc">按大小(大→小)</option>
                        <option value="size-asc">按大小(小→大)</option>
                    </select>
                    <select class="ss-select" id="ss-preview-size">
                        <option value="small">小预览</option>
                        <option value="medium">中预览</option>
                        <option value="large">大预览</option>
                    </select>
                    <div class="ss-view-toggle">
                        <button data-view="list" class="${state.viewMode === 'list' ? 'active' : ''}">${utils.svgIcons.list} 列表</button>
                        <button data-view="grid" class="${state.viewMode === 'grid' ? 'active' : ''}">${utils.svgIcons.grid} 网格</button>
                    </div>
                </div>
                <div class="ss-stats" id="ss-stats"></div>
                <div class="ss-modal-content" id="ss-content">
                    <div class="ss-loading">${utils.svgIcons.radar}<br>正在扫描页面SVG资源...</div>
                </div>
                <div class="ss-action-bar">
                    <label class="ss-select-all-control">
                        <input type="checkbox" id="ss-select-all"> 全选
                    </label>
                    <div class="ss-action-buttons">
                        <div style="position: relative; display: inline-flex;">
                            <button class="ss-btn ss-btn-secondary" id="ss-copy-btn">${utils.svgIcons.copy} 复制</button>
                            <div class="ss-dropdown" id="ss-copy-dropdown">
                                <div class="ss-dropdown-item" data-copy="svg">复制 SVG 源码</div>
                                <div class="ss-dropdown-item" data-copy="minified">复制压缩 SVG</div>
                                <div class="ss-dropdown-item" data-copy="datauri">复制 Data URI</div>
                                <div class="ss-dropdown-item" data-copy="base64">复制 Base64</div>
                                <div class="ss-dropdown-item" data-copy="react">复制 React 组件</div>
                                <div class="ss-dropdown-item" data-copy="css">复制 CSS 背景</div>
                            </div>
                        </div>
                        <div style="position: relative; display: inline-flex;">
                            <button class="ss-btn ss-btn-success" id="ss-download-btn">${utils.svgIcons.download} 下载</button>
                            <div class="ss-dropdown" id="ss-download-dropdown">
                                <div class="ss-dropdown-item" data-dl="svg">${utils.svgIcons.download} 下载 SVG</div>
                                <div class="ss-dropdown-item" data-dl="minified">${utils.svgIcons.optimize} 下载压缩 SVG</div>
                                <div class="ss-dropdown-item" data-dl="png">${utils.svgIcons.image} 下载 PNG (512px)</div>
                                <div class="ss-dropdown-item" data-dl="zip">${utils.svgIcons.zip} 打包 ZIP</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            this.root.appendChild(this.modal);

            this.searchInput = this.modal.querySelector('#ss-search');
            this.sortSelect = this.modal.querySelector('#ss-sort');
            this.selectAllCheckbox = this.modal.querySelector('#ss-select-all');
            this.contentEl = this.modal.querySelector('#ss-content');
            this.statsEl = this.modal.querySelector('#ss-stats');
            this.copyDropdown = this.modal.querySelector('#ss-copy-dropdown');
            this.previewSizeSelect = this.modal.querySelector('#ss-preview-size');

            // Restore saved settings
            this.previewSizeSelect.value = state.previewSize;
        },

        buildToast() {
            toast.init();
        },

        updateBadge(count) {
            if (count > 0) {
                this.badge.textContent = count > 99 ? '99+' : count;
                this.badge.style.setProperty('display', 'flex', 'important');
            } else {
                this.badge.style.setProperty('display', 'none', 'important');
            }
        },

        updateStats(total, filtered, totalSize) {
            this.statsEl.innerHTML = `
                <div class="ss-stat-pill">共 <strong>${total}</strong> 个</div>
                <div class="ss-stat-pill">显示 <strong>${filtered}</strong> 个</div>
                <div class="ss-stat-pill">总大小 <strong>${utils.formatBytes(totalSize)}</strong></div>
            `;
        },

        setTheme(theme) {
            state.theme = theme;
            GM_setValue(STORAGE_KEYS.theme, theme);
            this.root.dataset.theme = utils.getEffectiveTheme();
            const btn = this.modal.querySelector('#ss-theme-toggle');
            if (btn) btn.innerHTML = utils.getEffectiveTheme() === 'dark' ? utils.svgIcons.sun : utils.svgIcons.moon;
        },

        toggleTheme() {
            const current = utils.getEffectiveTheme();
            this.setTheme(current === 'dark' ? 'light' : 'dark');
        },
    };

    /* ================================================================
     *  列表渲染器
     * ================================================================ */
    const renderer = {
        render() {
            const items = controller.getFilteredItems();
            if (items.length === 0) {
                ui.contentEl.innerHTML = `<div class="ss-empty">暂无SVG资源</div>`;
                return;
            }

            if (state.viewMode === 'grid') {
                this.renderGrid(items);
            } else {
                this.renderList(items);
            }
            this.bindItemEvents();
        },

        renderList(items) {
            ui.contentEl.innerHTML = `<div class="ss-svg-list"></div>`;
            const listEl = ui.contentEl.querySelector('.ss-svg-list');

            items.forEach(item => {
                const el = document.createElement('div');
                el.className = 'ss-svg-item';
                el.dataset.id = item.id;
                el.innerHTML = `
                    <input type="checkbox" class="ss-svg-checkbox" data-id="${item.id}" checked>
                    <div class="ss-preview" data-size="${state.previewSize}">${item.svg}</div>
                    <div class="ss-svg-info">
                        <div class="ss-svg-name" title="${item.name}">${item.name}</div>
                        <div class="ss-svg-meta">
                            <span class="ss-svg-tag ss-svg-tag-size">${utils.formatBytes(item.size)}</span>
                            <span class="ss-svg-tag ss-svg-tag-dim">${item.width}×${item.height}</span>
                        </div>
                    </div>
                    <div class="ss-item-actions">
                        <button class="ss-item-btn" data-action="download" data-id="${item.id}" title="下载">${utils.svgIcons.download}</button>
                        <button class="ss-item-btn" data-action="copy" data-id="${item.id}" title="复制">${utils.svgIcons.copy}</button>
                    </div>
                `;
                listEl.appendChild(el);
            });
        },

        renderGrid(items) {
            ui.contentEl.innerHTML = `<div class="ss-svg-grid"></div>`;
            const gridEl = ui.contentEl.querySelector('.ss-svg-grid');

            items.forEach(item => {
                const el = document.createElement('div');
                el.className = 'ss-grid-card';
                el.dataset.id = item.id;
                el.innerHTML = `
                    <input type="checkbox" class="ss-grid-checkbox" data-id="${item.id}" checked>
                    <div class="ss-grid-preview">${item.svg}</div>
                    <div class="ss-grid-name" title="${item.name}">${item.name}</div>
                    <div class="ss-grid-meta">${utils.formatBytes(item.size)} · ${item.width}×${item.height}</div>
                    <div class="ss-grid-actions">
                        <button class="ss-item-btn" data-action="download" data-id="${item.id}" title="下载">${utils.svgIcons.download}</button>
                        <button class="ss-item-btn" data-action="copy" data-id="${item.id}" title="复制">${utils.svgIcons.copy}</button>
                    </div>
                `;
                gridEl.appendChild(el);
            });
        },

        bindItemEvents() {
            ui.contentEl.querySelectorAll('[data-action="download"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const item = state.cache.get(btn.dataset.id);
                    if (item) downloadManager.downloadSingle(item, 'svg');
                });
            });
            ui.contentEl.querySelectorAll('[data-action="copy"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const item = state.cache.get(btn.dataset.id);
                    if (item) {
                        downloadManager.copyContent(item.svg, item.name);
                    }
                });
            });
        },
    };

    /* ================================================================
     *  控制器 — 搜索/排序/选择
     * ================================================================ */
    const controller = {
        getFilteredItems() {
            let items = [...state.svgItems];

            // Filter
            if (state.currentFilter) {
                const q = state.currentFilter.toLowerCase();
                items = items.filter(i => i.name.toLowerCase().includes(q));
            }

            // Sort
            switch (state.currentSort) {
                case 'name':
                    items.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
                    break;
                case 'size-desc':
                    items.sort((a, b) => b.size - a.size);
                    break;
                case 'size-asc':
                    items.sort((a, b) => a.size - b.size);
                    break;
                default: // position — keep original order
                    items.sort((a, b) => a.index - b.index);
            }

            state.filteredItems = items;
            return items;
        },

        getSelectedItems() {
            const checkboxes = ui.contentEl.querySelectorAll((state.viewMode === 'grid' ? '.ss-grid-checkbox' : '.ss-svg-checkbox') + ':checked');
            const selected = [];
            checkboxes.forEach(cb => {
                const item = state.cache.get(cb.dataset.id);
                if (item) selected.push(item);
            });
            return selected;
        },

        refresh() {
            renderer.render();
            this.updateStats();
            this.updateSelectAllState();
        },

        updateStats() {
            const total = state.svgItems.length;
            const filtered = state.filteredItems.length;
            const totalSize = state.svgItems.reduce((sum, i) => sum + i.size, 0);
            ui.updateBadge(total);
            ui.updateStats(total, filtered, totalSize);
        },

        updateSelectAllState() {
            const checkboxes = ui.contentEl.querySelectorAll(state.viewMode === 'grid' ? '.ss-grid-checkbox' : '.ss-svg-checkbox');
            const checked = ui.contentEl.querySelectorAll((state.viewMode === 'grid' ? '.ss-grid-checkbox' : '.ss-svg-checkbox') + ':checked');
            ui.selectAllCheckbox.checked = checkboxes.length > 0 && checkboxes.length === checked.length;
            ui.selectAllCheckbox.indeterminate = checked.length > 0 && checked.length < checkboxes.length;
        },
    };

    /* ================================================================
     *  拖拽管理器
     * ================================================================ */
    const dragManager = {
        init() {
            const domain = location.hostname.replace(/\./g, '-');
            const savedPos = GM_getValue(STORAGE_KEYS.position(domain));
            if (savedPos) {
                ui.radar.style.left = `${savedPos.x}px`;
                ui.radar.style.top = `${savedPos.y}px`;
            } else {
                ui.radar.style.right = `${CONFIG.positionOffset}px`;
                ui.radar.style.bottom = `${CONFIG.positionOffset}px`;
            }

            ui.radar.addEventListener('mousedown', (e) => this.start(e));
            ui.radar.addEventListener('touchstart', (e) => this.start(e), { passive: false });
        },

        start(e) {
            const cx = e.clientX || e.touches[0].clientX;
            const cy = e.clientY || e.touches[0].clientY;
            const cs = window.getComputedStyle(ui.radar);
            state.startLeft = parseInt(cs.left) || 0;
            state.startTop = parseInt(cs.top) || 0;

            if (cs.right !== 'auto') {
                state.startLeft = window.innerWidth - parseInt(cs.right) - CONFIG.buttonSize;
                ui.radar.style.right = 'auto';
                ui.radar.style.left = `${state.startLeft}px`;
            }

            state.startX = cx;
            state.startY = cy;
            state.dragStartTime = Date.now();
            state.isDragging = false;

            if (e.type === 'touchstart') {
                e.preventDefault();
                state.touchTimer = setTimeout(() => {
                    state.isDragging = true;
                    ui.radar.style.transition = 'none';
                }, CONFIG.touchDelay);
            }

            document.addEventListener('mousemove', this._move = (e) => this.move(e));
            document.addEventListener('touchmove', this._moveT = (e) => this.move(e), { passive: false });
            document.addEventListener('mouseup', this._end = () => this.end());
            document.addEventListener('touchend', this._endT = () => this.end());
        },

        move(e) {
            const cx = e.clientX || e.touches[0].clientX;
            const cy = e.clientY || e.touches[0].clientY;
            const dx = cx - state.startX;
            const dy = cy - state.startY;

            if (!state.isDragging) {
                if (e.type === 'touchmove') return;
                if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
                state.isDragging = true;
                ui.radar.style.transition = 'none';
            }

            e.preventDefault();
            ui.radar.style.left = `${state.startLeft + dx}px`;
            ui.radar.style.top = `${state.startTop + dy}px`;
        },

        end() {
            if (state.touchTimer) { clearTimeout(state.touchTimer); state.touchTimer = null; }
            document.removeEventListener('mousemove', this._move);
            document.removeEventListener('touchmove', this._moveT);
            document.removeEventListener('mouseup', this._end);
            document.removeEventListener('touchend', this._endT);

            if (!state.isDragging) {
                modalManager.show();
                return;
            }

            state.isDragging = false;
            ui.radar.style.transition = '';

            const domain = location.hostname.replace(/\./g, '-');
            const rect = ui.radar.getBoundingClientRect();
            GM_setValue(STORAGE_KEYS.position(domain), { x: rect.left, y: rect.top });
        },
    };

    /* ================================================================
     *  模态框管理器
     * ================================================================ */
    const modalManager = {
        show() {
            ui.contentEl.innerHTML = `<div class="ss-loading">${utils.svgIcons.radar}<br>正在扫描页面SVG资源...</div>`;
            ui.modal.style.setProperty('display', 'flex', 'important');
            ui.overlay.style.setProperty('display', 'block', 'important');

            setTimeout(() => {
                try {
                    const items = svgCollector.collect();
                    state.svgItems = items;
                    state.cache.clear();
                    items.forEach(i => state.cache.set(i.id, i));

                    if (items.length === 0) {
                        ui.contentEl.innerHTML = `<div class="ss-empty">暂无SVG资源</div>`;
                        controller.updateStats();
                        return;
                    }
                    controller.refresh();
                } catch (err) {
                    ui.contentEl.innerHTML = `<div class="ss-empty">扫描出错: ${err.message}</div>`;
                }
            }, CONFIG.scanDelay);
        },

        hide() {
            ui.modal.style.setProperty('display', 'none', 'important');
            ui.overlay.style.setProperty('display', 'none', 'important');
            downloadManager.clearBlobUrls();
        },
    };

    /* ================================================================
     *  事件绑定
     * ================================================================ */
    function setupEvents() {
        // Close
        ui.modal.querySelector('#ss-close-btn').addEventListener('click', () => modalManager.hide());
        ui.overlay.addEventListener('click', () => modalManager.hide());

        // Theme toggle
        ui.modal.querySelector('#ss-theme-toggle').addEventListener('click', () => ui.toggleTheme());

        // Search
        ui.searchInput.addEventListener('input', (e) => {
            state.currentFilter = e.target.value.trim();
            controller.refresh();
        });

        // Sort
        ui.sortSelect.addEventListener('change', (e) => {
            state.currentSort = e.target.value;
            controller.refresh();
        });

        // Preview size
        ui.previewSizeSelect.addEventListener('change', (e) => {
            state.previewSize = e.target.value;
            GM_setValue(STORAGE_KEYS.previewSize, state.previewSize);
            controller.refresh();
        });

        // View toggle
        ui.modal.querySelectorAll('.ss-view-toggle button').forEach(btn => {
            btn.addEventListener('click', () => {
                state.viewMode = btn.dataset.view;
                GM_setValue(STORAGE_KEYS.viewMode, state.viewMode);
                ui.modal.querySelectorAll('.ss-view-toggle button').forEach(b => b.classList.toggle('active', b === btn));
                controller.refresh();
            });
        });

        // Select all
        ui.selectAllCheckbox.addEventListener('change', (e) => {
            const selector = state.viewMode === 'grid' ? '.ss-grid-checkbox' : '.ss-svg-checkbox';
            ui.contentEl.querySelectorAll(selector).forEach(cb => { cb.checked = e.target.checked; });
        });

        // Copy dropdown
        const copyBtn = ui.modal.querySelector('#ss-copy-btn');
        const copyDropdown = ui.copyDropdown;
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            copyDropdown.classList.toggle('show');
            ui.modal.querySelector('#ss-download-dropdown').classList.remove('show');
        });
        copyDropdown.addEventListener('click', (e) => {
            const item = e.target.closest('.ss-dropdown-item');
            if (!item) return;
            copyDropdown.classList.remove('show');
            const selected = controller.getSelectedItems();
            if (selected.length === 0) { toast.show('请至少选择一个SVG', 'warning'); return; }
            const type = item.dataset.copy;
            let content = '', label = '';
            if (selected.length === 1) {
                const svgItem = selected[0];
                switch (type) {
                    case 'svg': content = svgItem.svg; label = `${svgItem.name} (SVG源码)`; break;
                    case 'minified': content = utils.minifySvg(svgItem.svg); label = `${svgItem.name} (压缩SVG)`; break;
                    case 'datauri': content = utils.svgToDataUri(svgItem.svg); label = `${svgItem.name} (Data URI)`; break;
                    case 'base64': content = utils.svgToBase64(svgItem.svg); label = `${svgItem.name} (Base64)`; break;
                    case 'react': content = utils.svgToReactComponent(svgItem.svg, svgItem.name); label = `${svgItem.name} (React组件)`; break;
                    case 'css': content = utils.svgToCssBackground(svgItem.svg); label = `${svgItem.name} (CSS背景)`; break;
                }
            } else {
                content = selected.map(s => {
                    switch (type) {
                        case 'svg': return s.svg;
                        case 'minified': return utils.minifySvg(s.svg);
                        case 'datauri': return utils.svgToDataUri(s.svg);
                        case 'base64': return utils.svgToBase64(s.svg);
                        case 'react': return utils.svgToReactComponent(s.svg, s.name);
                        case 'css': return utils.svgToCssBackground(s.svg);
                    }
                }).join('\n\n');
                label = `${selected.length}个SVG (${type})`;
            }
            downloadManager.copyContent(content, label);
        });

        // Download dropdown
        const dlBtn = ui.modal.querySelector('#ss-download-btn');
        const dlDropdown = ui.modal.querySelector('#ss-download-dropdown');
        dlBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dlDropdown.classList.toggle('show');
            copyDropdown.classList.remove('show');
        });
        dlDropdown.addEventListener('click', (e) => {
            const item = e.target.closest('.ss-dropdown-item');
            if (!item) return;
            dlDropdown.classList.remove('show');
            const selected = controller.getSelectedItems();
            if (selected.length === 0) { toast.show('请至少选择一个SVG', 'warning'); return; }
            const format = item.dataset.dl;
            if (format === 'zip') {
                downloadManager.downloadZip(selected, 'svg');
            } else if (selected.length === 1) {
                downloadManager.downloadSingle(selected[0], format);
            } else {
                downloadManager.downloadZip(selected, format);
            }
        });

        // Close dropdowns on outside click
        document.addEventListener('click', () => {
            copyDropdown.classList.remove('show');
            dlDropdown.classList.remove('show');
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (ui.modal.style.display === 'none' || !ui.modal.style.display) return;
            if (e.key === 'Escape') { modalManager.hide(); }
            if (e.ctrlKey && e.key === 'f') { e.preventDefault(); ui.searchInput.focus(); }
            if (e.ctrlKey && e.key === 'a') {
                e.preventDefault();
                ui.selectAllCheckbox.checked = true;
                ui.selectAllCheckbox.dispatchEvent(new Event('change'));
            }
        });

        // Cleanup on unload
        window.addEventListener('beforeunload', () => downloadManager.clearBlobUrls());

        // Auto theme detection
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (state.theme === 'auto') ui.root.dataset.theme = utils.getEffectiveTheme();
        });
    }

    /* ================================================================
     *  初始化
     * ================================================================ */
    function init() {
        injectStyles();
        ui.build();
        dragManager.init();
        setupEvents();

        // Quick scan for badge count
        setTimeout(() => {
            const count = document.querySelectorAll('svg').length;
            ui.updateBadge(count);
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
