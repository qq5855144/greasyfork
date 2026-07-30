// ==UserScript==
// @name         脚本查找大师（四大脚本库合一显数版）
// @namespace    doveboy_js
// @version     2.0.0
// @description  聚合 GreasyFork、SleazyFork、ScriptCat、GitHub Gist。U形悬浮球毛玻璃设计，移动端优先底部弹出面板，支持拖拽、自动缩回、两步交互。
// @author       AI优化
// @icon         https://scriptcat.org/favicon.ico?favicon.12.kxvew6xulu.ico
// @license      Zlib/Libpng License
// @match        *://*/*
// @exclude      https://github.com/new
// @exclude      https://github.com/settings/*
// @exclude      https://gist.github.com/mine
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      greasyfork.org
// @connect      sleazyfork.org
// @connect      scriptcat.org
// @connect      gist.github.com
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const host = window.location.hostname;
    const domain = host.split('.').slice(-2).join('.');

    const isAtGreasyFork = host.includes('greasyfork.org') || host.includes('sleazyfork.org');
    const isAtGitHub = host.includes('github.com') || host.includes('gist.github.com');
    const isAtGoogle = host.includes('google.');
    const disableGitHubSearch = isAtGreasyFork || isAtGitHub || isAtGoogle;

    let currentSource = 'gf';
    let isWallAccessible = false;
    let gfData = [], scData = [], ghData = [];
    let gfLoaded = false, scLoaded = false, ghLoaded = false;
    let ghPage = 1, ghLoading = false, ghHasMore = true, ghTotal = 0;

    // --- 通用日期格式化 ---
    function formatToDate(str) {
        if (!str) return "未知";
        const cleanStr = str.replace(/(发布于：|更新于：|发布于|更新于)/g, '').trim();
        try {
            const d = new Date(cleanStr);
            if (isNaN(d.getTime())) return cleanStr;
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch(e) { return cleanStr; }
    }

    // --- SVG 图标 ---
    const icons = {};
    icons.search = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>';
    icons.sparkle = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    icons.close = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    icons.drag = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" opacity="0.25"><circle cx="9" cy="5" r="2"/><circle cx="15" cy="5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="19" r="2"/><circle cx="15" cy="19" r="2"/></svg>';
    icons.script = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>';
    icons.download = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

    // ============================================================
    //  样式 — 移动端优先 U形悬浮球 + 底部面板
    // ============================================================
    GM_addStyle(`
/* ========== 全局重置 ========== */
#ag-root {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px;
    line-height: 1.4;
    -webkit-text-size-adjust: 100%;
}

/* ========== U形悬浮球开关（半圆外壳 + 内嵌圆形图标） ========== */
#ag-btn {
    all: initial;
    position: fixed;
    z-index: 2147483647;
    right: 0;
    top: 50%;
    transform: translateY(calc(var(--ag-btn-offset, -50%))) translateX(calc(100% - 10px));
    width: 50px;
    height: 40px;
    border-radius: 20px 0 0 20px;
    border: none;
    background: rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    box-shadow: -2px 0 18px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding-left: 4px;
    box-sizing: border-box;
    transition: transform 0.40s cubic-bezier(0.22, 1, 0.36, 1), background 0.3s, box-shadow 0.3s;
    touch-action: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
}
#ag-btn.extend {
    transform: translateY(calc(var(--ag-btn-offset, -50%))) translateX(0);
    background: rgba(255, 255, 255, 0.32);
    box-shadow: -3px 0 22px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.6);
}
#ag-btn.extend:active {
    transform: translateY(calc(var(--ag-btn-offset, -50%))) translateX(0) scale(0.93);
}
#ag-btn:hover {
    background: rgba(255, 255, 255, 0.32);
}

/* 内层圆形图标容器 */
#ag-btn .ag-btn-inner {
    position: relative;
    z-index: 1;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25), 0 1px 3px rgba(0,0,0,0.15);
    transition: box-shadow 0.3s, transform 0.3s, background 0.3s;
    flex-shrink: 0;
    background: #666;
    color: #fff;
    font-size: 12px;
    font-weight: bold;
}
#ag-btn.extend .ag-btn-inner {
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35), 0 2px 5px rgba(0,0,0,0.2);
}
#ag-btn:hover .ag-btn-inner {
    transform: scale(1.05);
}

/* 图标 */
#ag-btn .ag-btn-icon {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.3s ease, opacity 0.3s ease;
}
#ag-btn:not(.extend) .ag-btn-icon {
    opacity: 0.75;
}
#ag-btn.extend .ag-btn-icon {
    opacity: 1;
    transform: scale(1.08);
}

/* 球体颜色状态 */
#ag-btn .ag-btn-inner.ag-color-green { background: linear-gradient(135deg, #28a745, #20c997); }
#ag-btn .ag-btn-inner.ag-color-orange { background: linear-gradient(135deg, #ff8c00, #fd7e14); }
#ag-btn .ag-btn-inner.ag-color-black { background: linear-gradient(135deg, #333, #000); }

/* ========== 遮罩（移动端） ========== */
#ag-overlay {
    all: initial;
    position: fixed;
    inset: 0;
    z-index: 2147483646;
    background: rgba(0,0,0,0.45);
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
    display: none;
    -webkit-tap-highlight-color: transparent;
}
#ag-overlay.show {
    display: block;
    opacity: 1;
    pointer-events: auto;
}

/* ========== 面板（移动端优先：底部弹出） ========== */
#ag-panel {
    all: initial;
    position: fixed;
    z-index: 2147483647;
    left: 0; right: 0; bottom: 0;
    max-height: 88vh;
    background: #0d0c1d;
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -8px 40px rgba(0,0,0,0.6);
    transform: translateY(100%);
    transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
    display: flex;
    flex-direction: column;
    color: #e0e0e0;
    overflow: hidden;
    will-change: transform;
}
#ag-panel.show { transform: translateY(0); }

/* 拖拽条 */
#ag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 0 4px;
    cursor: grab;
    flex-shrink: 0;
    touch-action: none;
    user-select: none;
    color: rgba(255,255,255,0.15);
}
#ag-handle:active { cursor: grabbing; }

/* 工具栏 */
#ag-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 14px 8px;
    flex-shrink: 0;
    border-bottom: 1px solid rgba(108, 99, 255, 0.12);
}
#ag-head .ag-title {
    font-size: 17px;
    font-weight: 700;
    color: #fff;
    display: flex;
    align-items: center;
    gap: 6px;
}
#ag-head .ag-title span { color: #00f5d4; }
#ag-head .ag-close-btn {
    background: rgba(108,99,255,0.12);
    border: 1px solid rgba(108,99,255,0.15);
    color: #a0a0c0;
    width: 36px; height: 36px;
    border-radius: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    padding: 0;
}
#ag-head .ag-close-btn:active {
    background: rgba(0,245,212,0.15);
    color: #00f5d4;
    transform: scale(0.9);
}

/* 切换器 */
#ag-switcher {
    display: flex;
    gap: 6px;
    padding: 8px 12px;
    overflow-x: auto;
    overflow-y: hidden;
    flex-shrink: 0;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    border-bottom: 1px solid rgba(108, 99, 255, 0.06);
}
#ag-switcher::-webkit-scrollbar { display: none; }
.ag-switch-btn {
    flex-shrink: 0;
    background: transparent;
    border: 1px solid rgba(108,99,255,0.12);
    padding: 7px 14px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    color: #888;
    border-radius: 18px;
    transition: all 0.25s;
    white-space: nowrap;
    font-family: inherit;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    min-height: 40px;
    display: flex;
    align-items: center;
    gap: 4px;
}
.ag-switch-btn:active { transform: scale(0.95); }
.ag-switch-btn.active {
    color: #fff;
    background: rgba(108,99,255,0.2);
    font-weight: 600;
    border-color: rgba(108,99,255,0.3);
}
.ag-switch-btn .ag-count {
    display: inline-block;
    background: rgba(0,245,212,0.12);
    color: #00f5d4;
    font-size: 10px;
    border-radius: 8px;
    padding: 0 5px;
    font-weight: 600;
    margin-left: 2px;
}

/* 内容区 */
#ag-body {
    flex-grow: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 4px 12px 12px;
}

/* 脚本条目 */
.ag-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 12px;
    border-radius: 12px;
    margin-bottom: 8px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(108,99,255,0.06);
    transition: background 0.2s;
    animation: agFadeIn 0.3s ease both;
}
.ag-item:active {
    background: rgba(108,99,255,0.08);
    transform: scale(0.99);
}
.ag-item-title-row {
    display: flex;
    align-items: center;
    gap: 10px;
}
.ag-name {
    text-decoration: none;
    font-size: 15px;
    font-weight: 700;
    line-height: 1.4;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #00f5d4;
}
.ag-install-btn {
    background: linear-gradient(135deg, #28a745, #20c997);
    color: white;
    border: none;
    padding: 6px 14px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 12px;
    font-weight: bold;
    white-space: nowrap;
    height: 30px;
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: inherit;
    transition: all 0.2s;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
}
.ag-install-btn:active {
    background: #1e7e34;
    transform: scale(0.95);
}
.ag-desc {
    font-size: 13px;
    color: #a0a0c0;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-all;
}
.ag-meta-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #888;
}
.ag-meta-row .ag-dot { color: rgba(108,99,255,0.3); }
.ag-score { color: #f0a500; font-weight: bold; }
.ag-installs { color: #00f5d4; font-weight: 600; }
.ag-installs-total { color: #6c63ff; font-weight: 600; }

/* 空状态 */
.ag-empty {
    text-align: center;
    color: #666;
    padding: 50px 20px;
    font-size: 14px;
    line-height: 1.6;
}
.ag-empty svg {
    display: block;
    margin: 0 auto 10px;
    opacity: 0.4;
}

/* 加载状态 */
#ag-load-status {
    padding: 15px;
    text-align: center;
    color: #888;
    font-size: 12px;
}

/* 动画 */
@keyframes agFadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
}

/* 滚动条 */
#ag-panel ::-webkit-scrollbar { width: 4px; height: 4px; }
#ag-panel ::-webkit-scrollbar-track { background: transparent; }
#ag-panel ::-webkit-scrollbar-thumb { background: rgba(108,99,255,0.25); border-radius: 4px; }

/* ========== 桌面适配（≥640px） ========== */
@media (min-width: 640px) {
    #ag-btn {
        right: 0;
        width: 46px;
        height: 38px;
        border-radius: 19px 0 0 19px;
        transform: translateY(calc(var(--ag-btn-offset, -50%))) translateX(calc(100% - 10px));
    }
    #ag-btn.extend {
        transform: translateY(calc(var(--ag-btn-offset, -50%))) translateX(0);
    }
    #ag-btn .ag-btn-inner {
        width: 34px;
        height: 34px;
    }
    #ag-panel {
        left: auto; right: 24px; bottom: 88px;
        width: 480px;
        max-height: 600px;
        border-radius: 16px;
        box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 20px rgba(108,99,255,0.08);
        transform: scale(0.95);
        opacity: 0;
        transition: transform 0.25s ease, opacity 0.25s ease;
    }
    #ag-panel.show {
        transform: scale(1);
        opacity: 1;
    }
    #ag-overlay.show { display: none; }
    #ag-handle { display: none; }
    #ag-head { padding: 12px 16px 10px; cursor: grab; }
    #ag-head:active { cursor: grabbing; }
}
`);

    // ============================================================
    //  DOM 构建
    // ============================================================
    const root = document.createElement('div');
    root.id = 'ag-root';

    // 遮罩
    const overlay = document.createElement('div');
    overlay.id = 'ag-overlay';

    // U形悬浮球按钮
    const btn = document.createElement('div');
    btn.id = 'ag-btn';
    btn.innerHTML = `
        <div class="ag-btn-inner ag-color-black">
            <div class="ag-btn-icon">...</div>
        </div>
    `;
    btn.title = '点击展开 · 脚本查找';
    btn.style.setProperty('--ag-btn-offset', '-50%');

    // 面板
    const panel = document.createElement('div');
    panel.id = 'ag-panel';
    panel.innerHTML = `
        <div id="ag-handle">${icons.drag}</div>
        <div id="ag-head">
            <div class="ag-title">${icons.script}<span>脚本查找大师</span></div>
            <button class="ag-close-btn" id="ag-close-btn" title="关闭">${icons.close}</button>
        </div>
        <div id="ag-switcher"></div>
        <div id="ag-body">
            <div id="ag-list"></div>
            <div id="ag-load-status" style="display:none;">载入中...</div>
        </div>
    `;

    root.appendChild(overlay);
    root.appendChild(btn);
    root.appendChild(panel);
    document.body.appendChild(root);

    // DOM 引用
    const listContainer = panel.querySelector('#ag-list');
    const statusText = panel.querySelector('#ag-load-status');
    const bodyPanel = panel.querySelector('#ag-body');
    const switcher = panel.querySelector('#ag-switcher');
    const btnInner = btn.querySelector('.ag-btn-inner');
    const btnIcon = btn.querySelector('.ag-btn-icon');

    // ============================================================
    //  状态管理
    // ============================================================
    let isPanelOpen = false;
    let isBtnExtended = false;
    let retractTimer = null;
    let btnY = 0;

    // 更新按钮图标
    function updateBtnIcon() {
        if (isPanelOpen) {
            btnIcon.innerHTML = icons.close;
            btn.title = '关闭面板';
        } else if (isBtnExtended) {
            btnIcon.innerHTML = icons.search;
            btn.title = '打开脚本查找';
        } else {
            btnIcon.innerHTML = '...';
            btn.title = '点击展开 · 脚本查找';
        }
    }

    // 更新球体颜色
    function updateBallColor() {
        const total = gfData.length + scData.length + (disableGitHubSearch ? 0 : ghTotal);
        btnInner.classList.remove('ag-color-green', 'ag-color-orange', 'ag-color-black');
        if ((gfLoaded && scLoaded) && total === 0) {
            btnInner.classList.add('ag-color-black');
        } else if (isWallAccessible) {
            btnInner.classList.add('ag-color-green');
        } else {
            btnInner.classList.add('ag-color-orange');
        }
        // 更新数字显示
        if (gfLoaded || scLoaded || (disableGitHubSearch || ghLoaded)) {
            btnIcon.innerHTML = total;
        } else {
            btnIcon.innerHTML = '...';
        }
    }

    // 伸出
    function extendBtn() {
        if (isBtnExtended) return;
        isBtnExtended = true;
        btn.classList.add('extend');
        clearTimeout(retractTimer);
        updateBtnIcon();
    }

    // 缩回
    function scheduleRetract(delay) {
        clearTimeout(retractTimer);
        retractTimer = setTimeout(() => {
            if (isPanelOpen) return;
            isBtnExtended = false;
            btn.classList.remove('extend');
            updateBtnIcon();
        }, delay || 2000);
    }

    // 打开面板
    function openPanel() {
        isPanelOpen = true;
        panel.classList.add('show');
        overlay.classList.add('show');
        extendBtn();
        updateBtnIcon();
        updateBallColor();
        render();
    }

    // 关闭面板
    function closePanel() {
        isPanelOpen = false;
        panel.classList.remove('show');
        overlay.classList.remove('show');
        updateBtnIcon();
        updateBallColor();
        scheduleRetract(2000);
    }

    // ============================================================
    //  按钮交互 — 两步交互 + 拖拽
    // ============================================================

    // 鼠标悬停视觉伸出
    btn.addEventListener('mouseenter', () => {
        btn.classList.add('extend');
        clearTimeout(retractTimer);
    });
    btn.addEventListener('mouseleave', () => {
        if (!isPanelOpen && !isBtnExtended) {
            btn.classList.remove('extend');
        }
        if (!isPanelOpen) scheduleRetract(1500);
    });

    // 初始伸出后自动缩回
    isBtnExtended = true;
    btn.classList.add('extend');
    updateBtnIcon();
    scheduleRetract(3000);

    // 核心点击逻辑：两步交互
    let _touchActivated = false;

    btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        _touchActivated = true;
        setTimeout(() => { _touchActivated = false; }, 600);

        if (!isBtnExtended) {
            extendBtn();
            scheduleRetract(4000);
        } else {
            isPanelOpen ? closePanel() : openPanel();
        }
    }, { passive: false });

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (_touchActivated) return;

        if (!isBtnExtended) {
            extendBtn();
            scheduleRetract(4000);
        } else {
            isPanelOpen ? closePanel() : openPanel();
        }
    });

    // 按钮拖拽（上下移动）
    (function() {
        let isDragging = false;
        let startY = 0;
        let startBtnY = 0;

        function getClientY(e) {
            return e.touches ? e.touches[0].clientY : e.clientY;
        }

        btn.addEventListener('mousedown', startDrag);
        btn.addEventListener('touchstart', startDrag, { passive: true });

        function startDrag(e) {
            const clientY = getClientY(e);
            startY = clientY;
            startBtnY = btnY;
            isDragging = false;
            document.addEventListener('mousemove', onDrag);
            document.addEventListener('mouseup', endDrag);
            document.addEventListener('touchmove', onDrag, { passive: true });
            document.addEventListener('touchend', endDrag);
            setTimeout(() => { if (Math.abs(btnY - startBtnY) > 3) isDragging = true; }, 150);
        }

        function onDrag(e) {
            const clientY = getClientY(e);
            const delta = clientY - startY;
            btnY = Math.max(-window.innerHeight / 2 + 50, Math.min(window.innerHeight / 2 - 50, startBtnY + delta));
            btn.style.setProperty('--ag-btn-offset', `calc(-50% + ${btnY}px)`);
            if (Math.abs(delta) > 5) isDragging = true;
            // 拖拽时保存位置
            localStorage.setItem('ag-btn-offset', btnY);
        }

        function endDrag() {
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('mouseup', endDrag);
            document.removeEventListener('touchmove', onDrag);
            document.removeEventListener('touchend', endDrag);
            if (isDragging) {
                btn.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); }, { once: true });
            }
            isDragging = false;
        }
    })();

    // 加载保存的按钮位置
    function loadBtnPosition() {
        const saved = localStorage.getItem('ag-btn-offset');
        if (saved !== null) {
            btnY = parseInt(saved) || 0;
            btn.style.setProperty('--ag-btn-offset', `calc(-50% + ${btnY}px)`);
        }
    }

    // 关闭按钮
    document.getElementById('ag-close-btn').addEventListener('click', closePanel);
    overlay.addEventListener('click', closePanel);

    // ============================================================
    //  数据获取（保持原有逻辑）
    // ============================================================
    function fetchGreasyFork() {
        const urls = [
            `https://greasyfork.org/scripts/by-site/${domain}?filter_locale=0&sort=updated&_t=${Date.now()}`,
            `https://sleazyfork.org/scripts/by-site/${domain}?filter_locale=0&sort=updated&_t=${Date.now()}`
        ];
        let results = [];
        let completed = 0;
        return new Promise((resolve) => {
            urls.forEach(url => {
                GM_xmlhttpRequest({
                    method: 'GET', url: url, timeout: 5000,
                    onload: (r) => {
                        try {
                            const doc = new DOMParser().parseFromString(r.responseText, "text/html");
                            const nodes = doc.querySelectorAll('li[data-script-id]');
                            const data = Array.from(nodes).map(node => ({
                                id: node.getAttribute('data-script-id'),
                                name: node.querySelector('.script-link')?.innerText.trim(),
                                url: (url.includes('sleazy') ? 'https://sleazyfork.org' : 'https://greasyfork.org') + node.querySelector('.script-link')?.getAttribute('href'),
                                desc: node.querySelector('.script-description')?.innerText.split('Ver.')[0].trim() || "暂无描述",
                                updatedRaw: node.getAttribute('data-script-updated-date'),
                                created: formatToDate(node.getAttribute('data-script-created-date')),
                                score: node.getAttribute('data-script-rating-score') || "0.0",
                                daily: parseInt(node.getAttribute('data-script-daily-installs') || "0").toLocaleString(),
                                total: parseInt(node.getAttribute('data-script-total-installs') || "0").toLocaleString(),
                                installUrl: node.querySelector('.install-link')?.getAttribute('href') || (url.includes('sleazy') ? `https://sleazyfork.org/scripts/${node.getAttribute('data-script-id')}/code/script.user.js` : `https://greasyfork.org/scripts/${node.getAttribute('data-script-id')}/code/script.user.js`)
                            })).filter(i => i.name);
                            results = results.concat(data);
                        } catch(e) {}
                        if (++completed === urls.length) {
                            const uniqueMap = new Map();
                            results.forEach(item => uniqueMap.set(item.id, item));
                            gfData = Array.from(uniqueMap.values()).sort((a, b) => new Date(b.updatedRaw) - new Date(a.updatedRaw));
                            gfLoaded = true; resolve(results.length > 0);
                        }
                    },
                    onerror: () => { if (++completed === urls.length) { gfLoaded = true; resolve(results.length > 0); } },
                    ontimeout: () => { if (++completed === urls.length) { gfLoaded = true; resolve(results.length > 0); } }
                });
            });
        });
    }

    function fetchScriptCat() {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET', url: `https://scriptcat.org/zh-CN/search?domain=${domain}&sort=createtime`,
                onload: (r) => {
                    const doc = new DOMParser().parseFromString(r.responseText, "text/html");
                    scData = Array.from(doc.querySelectorAll('.ant-card-body')).map(card => {
                        const titleLink = card.querySelector('a[href*="/script-show-page/"]');
                        if (!titleLink) return null;
                        const scriptId = titleLink.getAttribute('href').match(/\d+/)[0];
                        const scriptName = (titleLink.getAttribute('title') || titleLink.innerText).trim();
                        const rawDate = card.querySelector('.anticon-calendar')?.closest('.flex')?.innerText || "";
                        return {
                            name: scriptName, url: 'https://scriptcat.org' + titleLink.getAttribute('href'),
                            installUrl: `https://scriptcat.org/scripts/code/${scriptId}/${encodeURIComponent(scriptName)}.user.js`,
                            desc: card.querySelector('.line-clamp-2')?.getAttribute('title') || "暂无描述",
                            date: formatToDate(rawDate),
                            downloads: card.querySelector('.anticon-download')?.closest('.flex')?.innerText.trim() || "0"
                        };
                    }).filter(i => i);
                    scLoaded = true; resolve(true);
                }
            });
        });
    }

    function fetchGist(page = 1) {
        if (disableGitHubSearch) { ghLoaded = true; ghHasMore = false; updateUI(); return; }
        if (ghLoading || !ghHasMore) return;
        ghLoading = true;
        GM_xmlhttpRequest({
            method: 'GET', url: `https://gist.github.com/search?o=desc&p=${page}&q="%3D%3DUserScript%3D%3D"+${domain}&s=updated`,
            onload: (res) => {
                const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
                const h3 = Array.from(doc.querySelectorAll('h3')).find(el => el.innerText.includes('gist results'));
                if (h3) {
                    const match = h3.innerText.match(/(\d[\d,]*)/);
                    if (match) ghTotal = parseInt(match[1].replace(/,/g, '')) || 0;
                }
                const snippets = doc.querySelectorAll('.gist-snippet');
                if (snippets.length === 0) { ghHasMore = false; } else {
                    snippets.forEach(snippet => {
                        const fileStrong = snippet.querySelector('strong.css-truncate-target');
                        const fileName = fileStrong ? fileStrong.innerText.trim() : 'script.user.js';
                        const gistPath = fileStrong ? fileStrong.closest('a').getAttribute('href') : '';
                        let description = '暂无描述', installUrl = '';
                        snippet.querySelectorAll('.blob-code-inner').forEach(line => {
                            const text = line.innerText;
                            if (text.includes('@description')) description = text.split('@description')[1].trim();
                        });
                        if (!installUrl && gistPath) installUrl = `https://gist.github.com${gistPath}/raw/${encodeURIComponent(fileName)}`;
                        const timeEl = snippet.querySelector('relative-time');
                        ghData.push({
                            name: fileName, url: `https://gist.github.com${gistPath}`, installUrl, desc: description,
                            stars: snippet.querySelector('a[href$="/stargazers"]')?.innerText.trim() || '0',
                            updated: formatToDate(timeEl ? timeEl.getAttribute('datetime') : null)
                        });
                    });
                    ghHasMore = !!doc.querySelector('.next_page'); ghPage++;
                }
                ghLoaded = true; ghLoading = false;
                if (currentSource === 'gh' && isPanelOpen) render(); else updateUI();
            }
        });
    }

    // ============================================================
    //  UI 更新
    // ============================================================
    function updateUI() {
        updateBallColor();

        let order = disableGitHubSearch
            ? (isWallAccessible ? ['gf', 'sc'] : ['sc', 'gf'])
            : (isWallAccessible ? ['gf', 'gh', 'sc'] : ['sc', 'gf', 'gh']);

        const labels = {
            gf: 'GreasyFork',
            gh: 'GitHub Gist',
            sc: 'ScriptCat'
        };
        const counts = {
            gf: gfData.length,
            gh: ghTotal,
            sc: scData.length
        };
        switcher.innerHTML = order.map(type => {
            const active = currentSource === type ? ' active' : '';
            return `<button class="ag-switch-btn${active}" data-type="${type}">${labels[type]}<span class="ag-count">${counts[type]}</span></button>`;
        }).join('');
        switcher.querySelectorAll('.ag-switch-btn').forEach(btnEl => {
            btnEl.addEventListener('click', (e) => {
                e.stopPropagation();
                currentSource = btnEl.getAttribute('data-type');
                render();
            });
        });
    }

    function render() {
        updateUI();
        const data = currentSource === 'gf' ? gfData : (currentSource === 'sc' ? scData : ghData);
        statusText.style.display = (currentSource === 'gh' && (ghHasMore || ghLoading)) ? 'block' : 'none';
        if (data.length === 0) {
            listContainer.innerHTML = `<div class="ag-empty">${icons.search}<br>该平台暂未发现脚本</div>`;
            return;
        }
        listContainer.innerHTML = data.map(s => {
            const theme = currentSource;
            let metaHtml = '';
            if (theme === 'gf') {
                metaHtml = `<span>🔄 更新: ${formatToDate(s.updatedRaw)}</span><span class="ag-dot">|</span><span>📅 发布: ${s.created}</span><span class="ag-dot">|</span><span class="ag-score">⭐ ${s.score}</span><span class="ag-dot">|</span><span class="ag-installs">📥 今日: ${s.daily}</span><span class="ag-dot">|</span><span class="ag-installs-total">📊 总计: ${s.total}</span>`;
            } else if (theme === 'sc') {
                metaHtml = `<span>📅 发布: ${s.date}</span><span class="ag-dot">|</span><span class="ag-installs">📥 下载: ${s.downloads}</span>`;
            } else {
                metaHtml = `<span class="ag-score">★ ${s.stars}</span><span class="ag-dot">|</span><span>🕒 更新: ${s.updated}</span>`;
            }
            return `
                <div class="ag-item">
                    <div class="ag-item-title-row">
                        <button class="ag-install-btn" data-url="${esc(s.installUrl)}">${icons.download} 安装</button>
                        <a class="ag-name" href="${esc(s.url)}" target="_blank" title="${esc(s.name)}">${esc(s.name)}</a>
                    </div>
                    <span class="ag-desc">${esc(s.desc)}</span>
                    <div class="ag-meta-row">${metaHtml}</div>
                </div>`;
        }).join('');

        // 绑定安装按钮事件
        listContainer.querySelectorAll('.ag-install-btn').forEach(btnEl => {
            btnEl.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const url = btnEl.getAttribute('data-url');
                if (url) window.open(url);
            });
        });
    }

    function esc(s) { return String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m])); }

    // 滚动加载更多 Gist
    bodyPanel.addEventListener('scroll', () => {
        if (currentSource === 'gh' && !disableGitHubSearch && bodyPanel.scrollTop + bodyPanel.clientHeight >= bodyPanel.scrollHeight - 50) {
            fetchGist(ghPage);
        }
    }, { passive: true });

    // ============================================================
    //  初始化
    // ============================================================
    async function init() {
        loadBtnPosition();

        const gfPromise = fetchGreasyFork();
        const scPromise = fetchScriptCat();
        const ghPromise = disableGitHubSearch ? Promise.resolve() : fetchGist(1);

        scPromise.then(() => {
            if (!gfLoaded && scData.length > 0) { currentSource = 'sc'; }
            updateUI();
        });

        gfPromise.then(ok => {
            isWallAccessible = ok;
            if (!isPanelOpen) { currentSource = isWallAccessible ? 'gf' : 'sc'; }
            updateUI();
            if (isPanelOpen) render();
        });
        if (!disableGitHubSearch) ghPromise.then(() => updateUI());

        setTimeout(() => {
            if (!gfLoaded || !scLoaded) { gfLoaded = true; scLoaded = true; updateUI(); }
        }, 5500);
    }
    init();
})();