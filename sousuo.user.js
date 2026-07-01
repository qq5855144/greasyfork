// ==UserScript==
// @name         聚合搜索引擎切换导航(移动端优化)(重构版)
// @namespace    http://tampermonkey.net/
// @version      v2.0.0
// @author       晚风知我意
// @match        *://*/*searchstring=*
// @match        *://*/*searchquery=*
// @match        *://*/*searchword=*
// @match        *://*/*searchterm=*
// @match        *://*/*searchtext=*
// @match        *://*/*searchkey=*
// @match        *://*/*keywords=*
// @match        *://*/*searchfor=*
// @match        *://*/*findword=*
// @match        *://*/*findtext=*
// @match        *://*/*findkey=*
// @match        *://*/*keyword=*
// @match        *://*/*question=*
// @match        *://*/*subject=*
// @match        *://*/*lookfor=*
// @match        *://*/*lookup=*
// @match        *://*/*request=*
// @match        *://*/*pattern=*
// @match        *://*/*search=*
// @match        *://*/*string=*
// @match        *://*/*phrase=*
// @match        *://*/*query=*
// @match        *://*/*terms=*
// @match        *://*/*value=*
// @match        *://*/*title=*
// @match        *://*/*topic=*
// @match        *://*/*seek=*
// @match        *://*/*word=*
// @match        *://*/*text=*
// @match        *://*/*find=*
// @match        *://*/*ask=*
// @match        *://*/*name=*
// @match        *://*/*web=*
// @match        *://*/*key=*
// @match        *://*/*wd=*
// @match        *://*/*kw=*
// @match        *://*/*q=*
// @match        *://*/*p=*
// @match        *://*/*s=*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @icon         https://hub.gitmirror.com/https://raw.githubusercontent.com/qq5855144/greasyfork/main/shousuo.svg
// @run-at       document-end
// @license      MIT
// @description  聚合搜索导航重构版：底部搜索引擎栏、快捷搜索、管理面板、拖拽排序、自定义引擎、页面识别、偏移设置、数据迁移与稳定性修复
// ==/UserScript==

(function () {
    'use strict';

    const SCRIPT_ID = 'sousuo-refactor';
    const SESSION_CURRENT_INPUT = 'currentInput';

    const STORAGE_KEYS = Object.freeze({
        CONFIG: 'sousuo_config_v2',
        USAGE_COUNTS: 'sousuo_usage_counts_v2',
        USER_SEARCH_ENGINES: 'userSearchEngines',
        PUNK_SETUP_SEARCH: 'punk_setup_search',
        ENGINE_BAR_OFFSET: 'engineBarOffset',
        LEGACY_USAGE_COUNTS: 'engine_usage_counts'
    });

    const SEARCH_PARAM_KEYS = [
        'q', 'query', 'search', 'keyword', 'keywords', 'wd', 'word', 'key', 'text',
        'p', 's', 'term', 'question', 'kw', 'searchword', 'searchquery', 'searchtext',
        'searchterm', 'searchstring', 'searchkey', 'searchfor', 'find', 'findword',
        'findtext', 'findkey', 'phrase', 'terms', 'topic', 'subject', 'ask', 'lookup',
        'lookfor', 'request', 'pattern', 'title', 'name', 'web', 'value', 'seek'
    ];

    const SEARCH_INPUT_SELECTOR = [
        'input[type="search"]',
        'input[type="text"]',
        'input[name*="search" i]',
        'input[name*="query" i]',
        'input[name*="keyword" i]',
        'input[name="q" i]',
        'input[name="wd" i]',
        'input[name="kw" i]',
        'textarea'
    ].join(',');

    const DEFAULT_ENGINE_ORDER = [
        'Bing', 'Google', 'Baidu', 'MetaSo', 'YandexSearch',
        'Bilibili', 'ApkPure', 'Quark', 'Zhihu'
    ];

    const DEFAULT_ENGINES = Object.freeze([
        {
            id: 'Bing',
            name: '必应',
            searchUrl: 'https://www.bing.com/search?q={keyword}',
            queryKeys: ['q'],
            hostPatterns: ['bing.com'],
            color: '#008373',
            iconText: 'Bi'
        },
        {
            id: 'Google',
            name: '谷歌',
            searchUrl: 'https://www.google.com/search?q={keyword}',
            queryKeys: ['q'],
            hostPatterns: ['google.'],
            color: '#4285f4',
            iconText: 'G'
        },
        {
            id: 'Baidu',
            name: '百度',
            searchUrl: 'https://www.baidu.com/s?wd={keyword}',
            queryKeys: ['wd', 'word'],
            hostPatterns: ['baidu.com'],
            color: '#2932e1',
            iconText: '百'
        },
        {
            id: 'MetaSo',
            name: '密塔',
            searchUrl: 'https://metaso.cn/?s=itab1&q={keyword}',
            queryKeys: ['q'],
            hostPatterns: ['metaso.cn'],
            color: '#6b46ff',
            iconText: '密'
        },
        {
            id: 'YandexSearch',
            name: 'Yandex',
            searchUrl: 'https://yandex.com/search/?text={keyword}',
            queryKeys: ['text'],
            hostPatterns: ['yandex.com', 'yandex.ru'],
            color: '#ff0000',
            iconText: 'Y'
        },
        {
            id: 'Bilibili',
            name: '哔哩哔哩',
            searchUrl: 'https://m.bilibili.com/search?keyword={keyword}',
            queryKeys: ['keyword'],
            hostPatterns: ['bilibili.com'],
            color: '#fb7299',
            iconText: 'B站'
        },
        {
            id: 'ApkPure',
            name: 'ApkPure',
            searchUrl: 'https://apkpure.com/search?q={keyword}',
            queryKeys: ['q'],
            hostPatterns: ['apkpure.com'],
            color: '#24c466',
            iconText: 'Ap'
        },
        {
            id: 'Quark',
            name: '夸克',
            searchUrl: 'https://quark.sm.cn/s?q={keyword}',
            queryKeys: ['q'],
            hostPatterns: ['quark.sm.cn', 'quark.cn'],
            color: '#ffb300',
            iconText: '夸'
        },
        {
            id: 'Zhihu',
            name: '知乎',
            searchUrl: 'https://www.zhihu.com/search?type=content&q={keyword}',
            queryKeys: ['q'],
            hostPatterns: ['zhihu.com'],
            color: '#1677ff',
            iconText: '知'
        }
    ]);

    const state = {
        initialized: false,
        config: null,
        usageCounts: null,
        currentQuery: '',
        ui: {
            root: null,
            bar: null,
            menu: null,
            quickSearch: null,
            panel: null,
            toast: null
        },
        flags: {
            menuOpen: false,
            quickSearchOpen: false,
            panelOpen: false
        },
        panel: {
            draftConfig: null,
            dirty: false,
            editingEngineId: null,
            formDraft: createEmptyFormDraft()
        }
    };

    function createEmptyFormDraft() {
        return {
            id: '',
            name: '',
            searchUrl: '',
            queryKeys: 'q',
            iconText: '',
            color: '#4455ee'
        };
    }

    function safeGetValue(key, fallback) {
        try {
            const value = GM_getValue(key);
            return value === undefined ? fallback : value;
        } catch (error) {
            return fallback;
        }
    }

    function safeSetValue(key, value) {
        try {
            GM_setValue(key, value);
        } catch (error) {
            console.warn(`[${SCRIPT_ID}] 持久化失败`, key, error);
        }
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function hashString(input) {
        let hash = 0;
        for (let i = 0; i < input.length; i += 1) {
            hash = ((hash << 5) - hash) + input.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    function normalizeId(input, fallbackSource) {
        const source = String(input || fallbackSource || '').trim();
        const normalized = source.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '');
        if (normalized) {
            return normalized;
        }
        return `engine-${hashString(fallbackSource || Date.now().toString(36))}`;
    }

    function pickColor(seed) {
        const palette = [
            '#4455ee', '#0f9d58', '#ff6f00', '#7b61ff', '#d81b60',
            '#039be5', '#8e24aa', '#00897b', '#ef6c00', '#5e35b1'
        ];
        return palette[hashString(String(seed)) % palette.length];
    }

    function inferIconText(name, id) {
        const source = String(name || id || '').trim();
        if (!source) {
            return '?';
        }
        const stripped = source.replace(/\s+/g, '');
        if (/^[A-Za-z0-9]+$/.test(stripped)) {
            return stripped.slice(0, 2).toUpperCase();
        }
        return stripped.slice(0, 2);
    }

    function splitQueryKeys(input) {
        const keys = String(input || '')
            .split(/[,\s]+/)
            .map((item) => item.trim())
            .filter(Boolean);
        return keys.length ? Array.from(new Set(keys)) : ['q'];
    }

    function ensureSearchPlaceholder(url, queryKeys) {
        const raw = String(url || '').trim();
        if (!raw) {
            return '';
        }
        if (/\{keyword\}|%s/i.test(raw)) {
            return raw.replace(/%s/g, '{keyword}');
        }
        try {
            const parsed = new URL(raw, window.location.origin);
            const key = splitQueryKeys(queryKeys)[0] || 'q';
            parsed.searchParams.set(key, '{keyword}');
            return parsed.toString();
        } catch (error) {
            const separator = raw.includes('?') ? '&' : '?';
            return `${raw}${separator}${splitQueryKeys(queryKeys)[0]}={keyword}`;
        }
    }

    function normalizeEngine(engine, options = {}) {
        const builtin = Boolean(options.builtin);
        const id = normalizeId(engine.id || engine.mark, engine.name || engine.searchUrl || 'engine');
        const name = String(engine.name || id).trim();
        const queryKeys = Array.isArray(engine.queryKeys) ? engine.queryKeys : (engine.searchkeyName || []);
        const normalizedQueryKeys = splitQueryKeys(queryKeys.join ? queryKeys.join(',') : queryKeys);
        const searchUrl = ensureSearchPlaceholder(engine.searchUrl || engine.url || '', normalizedQueryKeys);
        const hostPatterns = Array.isArray(engine.hostPatterns)
            ? engine.hostPatterns.map((item) => String(item).trim()).filter(Boolean)
            : [];
        const color = String(engine.color || '').trim() || pickColor(id);
        const iconText = String(engine.iconText || '').trim() || inferIconText(name, id);
        return {
            id,
            name,
            searchUrl,
            queryKeys: normalizedQueryKeys,
            hostPatterns,
            color,
            iconText,
            builtin
        };
    }

    function getBuiltInEngines() {
        return DEFAULT_ENGINES.map((engine) => normalizeEngine(engine, { builtin: true }));
    }

    function loadUsageCounts() {
        const current = safeGetValue(STORAGE_KEYS.USAGE_COUNTS, null);
        if (current && typeof current === 'object') {
            return current;
        }
        const legacy = safeGetValue(STORAGE_KEYS.LEGACY_USAGE_COUNTS, {});
        return legacy && typeof legacy === 'object' ? legacy : {};
    }

    function saveUsageCounts() {
        safeSetValue(STORAGE_KEYS.USAGE_COUNTS, state.usageCounts);
    }

    function normalizeConfig(rawConfig) {
        const base = {
            version: 2,
            barOffset: 0,
            order: [],
            hiddenIds: [],
            customEngines: []
        };

        const builtins = getBuiltInEngines();
        const builtinIds = new Set(builtins.map((item) => item.id));
        const source = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
        const usedIds = new Set(builtinIds);
        const normalizedCustomEngines = [];

        (Array.isArray(source.customEngines) ? source.customEngines : []).forEach((engine, index) => {
            const normalized = normalizeEngine(engine, { builtin: false });
            let candidateId = normalized.id;
            while (usedIds.has(candidateId)) {
                candidateId = `${normalized.id}-${index + 1}-${hashString(normalized.name).toString(36).slice(0, 4)}`;
            }
            usedIds.add(candidateId);
            normalized.id = candidateId;
            normalizedCustomEngines.push(normalized);
        });

        const allIds = [...builtins.map((item) => item.id), ...normalizedCustomEngines.map((item) => item.id)];
        const order = [];
        (Array.isArray(source.order) ? source.order : []).forEach((id) => {
            if (allIds.includes(id) && !order.includes(id)) {
                order.push(id);
            }
        });
        allIds.forEach((id) => {
            if (!order.includes(id)) {
                order.push(id);
            }
        });

        const hiddenIds = Array.isArray(source.hiddenIds)
            ? source.hiddenIds.filter((id, index, arr) => allIds.includes(id) && arr.indexOf(id) === index)
            : [];

        const barOffset = Number.isFinite(Number(source.barOffset)) ? Number(source.barOffset) : 0;

        return {
            ...base,
            version: 2,
            barOffset: Math.max(0, Math.min(240, Math.round(barOffset))),
            order,
            hiddenIds,
            customEngines: normalizedCustomEngines
        };
    }

    function migrateLegacyConfig() {
        const legacyCustom = safeGetValue(STORAGE_KEYS.USER_SEARCH_ENGINES, []);
        const legacyOrderValue = safeGetValue(STORAGE_KEYS.PUNK_SETUP_SEARCH, DEFAULT_ENGINE_ORDER.join('-'));
        const legacyOffsetValue = safeGetValue(STORAGE_KEYS.ENGINE_BAR_OFFSET, 0);

        const builtins = getBuiltInEngines();
        const legacyCustomEngines = Array.isArray(legacyCustom)
            ? legacyCustom.map((engine) => {
                const hostPatterns = [];
                try {
                    const url = new URL(engine.searchUrl || '', window.location.origin);
                    hostPatterns.push(url.hostname.replace(/^www\./, ''));
                } catch (error) {
                    // ignore invalid legacy host
                }
                return normalizeEngine({
                    id: engine.mark || engine.id,
                    name: engine.name,
                    searchUrl: engine.searchUrl,
                    queryKeys: engine.searchkeyName,
                    hostPatterns,
                    color: pickColor(engine.mark || engine.name || engine.searchUrl),
                    iconText: inferIconText(engine.name, engine.mark)
                }, { builtin: false });
            })
            : [];

        const allIds = [...builtins.map((item) => item.id), ...legacyCustomEngines.map((item) => item.id)];
        const activeIds = String(legacyOrderValue || '')
            .split('-')
            .map((item) => item.trim())
            .filter(Boolean);
        const order = [];
        activeIds.forEach((id) => {
            if (allIds.includes(id) && !order.includes(id)) {
                order.push(id);
            }
        });
        allIds.forEach((id) => {
            if (!order.includes(id)) {
                order.push(id);
            }
        });

        const hiddenIds = allIds.filter((id) => !activeIds.includes(id));

        return normalizeConfig({
            version: 2,
            barOffset: Number(legacyOffsetValue || 0),
            order,
            hiddenIds,
            customEngines: legacyCustomEngines
        });
    }

    function loadConfig() {
        const config = safeGetValue(STORAGE_KEYS.CONFIG, null);
        if (config && typeof config === 'object' && !Array.isArray(config)) {
            return normalizeConfig(config);
        }
        const migrated = migrateLegacyConfig();
        safeSetValue(STORAGE_KEYS.CONFIG, migrated);
        return migrated;
    }

    function saveConfig(config) {
        state.config = normalizeConfig(config);
        safeSetValue(STORAGE_KEYS.CONFIG, state.config);
    }

    function getAllEngines(config = state.config) {
        const normalized = normalizeConfig(config);
        return [...getBuiltInEngines(), ...normalized.customEngines];
    }

    function getEngineMap(config = state.config) {
        const map = new Map();
        getAllEngines(config).forEach((engine) => {
            map.set(engine.id, engine);
        });
        return map;
    }

    function getOrderedEngines(config = state.config) {
        const normalized = normalizeConfig(config);
        const engineMap = getEngineMap(normalized);
        return normalized.order
            .map((id) => engineMap.get(id))
            .filter(Boolean);
    }

    function getVisibleEngines(config = state.config) {
        const normalized = normalizeConfig(config);
        const hiddenSet = new Set(normalized.hiddenIds);
        return getOrderedEngines(normalized).filter((engine) => !hiddenSet.has(engine.id));
    }

    function getEnabledEngineCount(config = state.config) {
        return getVisibleEngines(config).length;
    }

    function getCustomEngineById(id, config = state.panel.draftConfig || state.config) {
        const normalized = normalizeConfig(config);
        return normalized.customEngines.find((engine) => engine.id === id) || null;
    }

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function injectStyles() {
        if (document.getElementById(`${SCRIPT_ID}-style`)) {
            return;
        }

        const css = `
            :root {
                --${SCRIPT_ID}-bottom-offset: 0px;
                --${SCRIPT_ID}-z-index: 2147483000;
                --${SCRIPT_ID}-safe-bottom: calc(env(safe-area-inset-bottom, 0px) + var(--${SCRIPT_ID}-bottom-offset));
                --${SCRIPT_ID}-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            }

            #${SCRIPT_ID}-root {
                position: fixed;
                inset: 0;
                pointer-events: none;
                z-index: var(--${SCRIPT_ID}-z-index);
                font-family: var(--${SCRIPT_ID}-font);
            }

            #${SCRIPT_ID}-bar {
                position: fixed;
                left: 10px;
                right: 10px;
                bottom: calc(10px + var(--${SCRIPT_ID}-safe-bottom));
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px;
                border-radius: 18px;
                background: rgba(22, 24, 35, 0.84);
                box-shadow: 0 16px 48px rgba(0, 0, 0, 0.28);
                backdrop-filter: blur(14px);
                pointer-events: auto;
                min-height: 56px;
            }

            #${SCRIPT_ID}-bar[hidden] {
                display: none;
            }

            .${SCRIPT_ID}-scroll {
                display: flex;
                align-items: center;
                gap: 8px;
                overflow-x: auto;
                scrollbar-width: none;
                flex: 1;
                min-width: 0;
            }

            .${SCRIPT_ID}-scroll::-webkit-scrollbar {
                display: none;
            }

            .${SCRIPT_ID}-action,
            .${SCRIPT_ID}-engine-button,
            .${SCRIPT_ID}-menu-item,
            .${SCRIPT_ID}-panel-button,
            .${SCRIPT_ID}-overlay-button,
            .${SCRIPT_ID}-chip {
                border: none;
                cursor: pointer;
                font: inherit;
            }

            .${SCRIPT_ID}-action {
                width: 40px;
                height: 40px;
                border-radius: 12px;
                background: rgba(255, 255, 255, 0.12);
                color: #fff;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                flex: 0 0 auto;
            }

            .${SCRIPT_ID}-engine-button {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                min-height: 40px;
                border-radius: 999px;
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
                white-space: nowrap;
                transition: transform 0.15s ease, background 0.15s ease;
            }

            .${SCRIPT_ID}-engine-button:hover,
            .${SCRIPT_ID}-engine-button:focus-visible,
            .${SCRIPT_ID}-action:hover,
            .${SCRIPT_ID}-action:focus-visible,
            .${SCRIPT_ID}-menu-item:hover,
            .${SCRIPT_ID}-menu-item:focus-visible,
            .${SCRIPT_ID}-panel-button:hover,
            .${SCRIPT_ID}-panel-button:focus-visible,
            .${SCRIPT_ID}-overlay-button:hover,
            .${SCRIPT_ID}-overlay-button:focus-visible,
            .${SCRIPT_ID}-chip:hover,
            .${SCRIPT_ID}-chip:focus-visible {
                outline: none;
                transform: translateY(-1px);
            }

            .${SCRIPT_ID}-engine-button.is-active {
                background: rgba(255, 255, 255, 0.18);
                box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
            }

            .${SCRIPT_ID}-engine-icon {
                width: 24px;
                height: 24px;
                border-radius: 999px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: #fff;
                font-size: 11px;
                font-weight: 700;
                flex: 0 0 auto;
            }

            .${SCRIPT_ID}-engine-name {
                font-size: 13px;
                line-height: 1;
            }

            .${SCRIPT_ID}-menu,
            .${SCRIPT_ID}-quick-search,
            .${SCRIPT_ID}-panel {
                position: fixed;
                pointer-events: auto;
            }

            .${SCRIPT_ID}-menu {
                left: 10px;
                bottom: calc(74px + var(--${SCRIPT_ID}-safe-bottom));
                display: flex;
                flex-direction: column;
                gap: 8px;
                min-width: 220px;
                padding: 12px;
                border-radius: 18px;
                background: rgba(18, 20, 30, 0.94);
                box-shadow: 0 18px 50px rgba(0, 0, 0, 0.32);
                backdrop-filter: blur(14px);
            }

            .${SCRIPT_ID}-menu[hidden],
            .${SCRIPT_ID}-quick-search[hidden],
            .${SCRIPT_ID}-panel[hidden] {
                display: none;
            }

            .${SCRIPT_ID}-menu-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 12px 14px;
                border-radius: 14px;
                background: rgba(255, 255, 255, 0.08);
                color: #fff;
                text-align: left;
            }

            .${SCRIPT_ID}-menu-item small {
                color: rgba(255, 255, 255, 0.68);
                font-size: 12px;
            }

            .${SCRIPT_ID}-mask {
                position: fixed;
                inset: 0;
                background: rgba(9, 12, 20, 0.54);
                backdrop-filter: blur(4px);
            }

            .${SCRIPT_ID}-quick-search,
            .${SCRIPT_ID}-panel {
                inset: 0;
            }

            .${SCRIPT_ID}-quick-search .${SCRIPT_ID}-mask,
            .${SCRIPT_ID}-panel .${SCRIPT_ID}-mask {
                pointer-events: auto;
            }

            .${SCRIPT_ID}-quick-card,
            .${SCRIPT_ID}-panel-card {
                position: fixed;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%);
                width: min(920px, calc(100vw - 24px));
                max-height: calc(100vh - 24px);
                overflow: auto;
                border-radius: 24px;
                background: #ffffff;
                box-shadow: 0 30px 80px rgba(0, 0, 0, 0.28);
                color: #0f172a;
                pointer-events: auto;
            }

            .${SCRIPT_ID}-quick-card {
                width: min(720px, calc(100vw - 24px));
            }

            .${SCRIPT_ID}-section {
                padding: 20px;
            }

            .${SCRIPT_ID}-section + .${SCRIPT_ID}-section {
                border-top: 1px solid #e9eef8;
            }

            .${SCRIPT_ID}-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 16px;
            }

            .${SCRIPT_ID}-title {
                margin: 0;
                font-size: 22px;
                line-height: 1.2;
            }

            .${SCRIPT_ID}-subtitle {
                margin: 8px 0 0;
                color: #64748b;
                font-size: 14px;
            }

            .${SCRIPT_ID}-close {
                width: 40px;
                height: 40px;
                border-radius: 999px;
                border: none;
                background: #f1f5f9;
                color: #0f172a;
                cursor: pointer;
                font: inherit;
                font-size: 18px;
            }

            .${SCRIPT_ID}-search-input,
            .${SCRIPT_ID}-text-input,
            .${SCRIPT_ID}-number-input {
                width: 100%;
                box-sizing: border-box;
                border: 1px solid #d7dfeb;
                border-radius: 14px;
                padding: 14px 16px;
                font: inherit;
                color: #0f172a;
                background: #fff;
            }

            .${SCRIPT_ID}-search-input:focus,
            .${SCRIPT_ID}-text-input:focus,
            .${SCRIPT_ID}-number-input:focus {
                outline: none;
                border-color: #4f46e5;
                box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
            }

            .${SCRIPT_ID}-overlay-grid,
            .${SCRIPT_ID}-stats-grid,
            .${SCRIPT_ID}-panel-grid {
                display: grid;
                gap: 12px;
            }

            .${SCRIPT_ID}-overlay-grid {
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            }

            .${SCRIPT_ID}-stats-grid {
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            }

            .${SCRIPT_ID}-panel-grid {
                grid-template-columns: minmax(0, 1.7fr) minmax(300px, 1fr);
                align-items: start;
            }

            .${SCRIPT_ID}-stat {
                padding: 16px;
                border-radius: 18px;
                background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
                border: 1px solid #dbe5ff;
            }

            .${SCRIPT_ID}-stat b {
                display: block;
                font-size: 24px;
                margin-bottom: 6px;
            }

            .${SCRIPT_ID}-overlay-button {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 14px;
                border-radius: 18px;
                background: #f8fafc;
                color: #0f172a;
                text-align: left;
            }

            .${SCRIPT_ID}-overlay-button .${SCRIPT_ID}-engine-name {
                font-size: 14px;
                font-weight: 600;
                color: #0f172a;
            }

            .${SCRIPT_ID}-overlay-meta {
                color: #64748b;
                font-size: 12px;
            }

            .${SCRIPT_ID}-toolbar {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
            }

            .${SCRIPT_ID}-panel-button,
            .${SCRIPT_ID}-chip {
                padding: 10px 14px;
                border-radius: 999px;
                background: #eef2ff;
                color: #24317d;
            }

            .${SCRIPT_ID}-panel-button.is-primary {
                background: #4f46e5;
                color: #fff;
            }

            .${SCRIPT_ID}-panel-button.is-danger {
                background: #fee2e2;
                color: #b91c1c;
            }

            .${SCRIPT_ID}-panel-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .${SCRIPT_ID}-panel-item {
                display: grid;
                grid-template-columns: auto auto minmax(0, 1fr) auto;
                gap: 12px;
                align-items: center;
                padding: 12px;
                border-radius: 18px;
                border: 1px solid #e2e8f0;
                background: #fff;
            }

            .${SCRIPT_ID}-panel-item.is-hidden {
                opacity: 0.65;
                background: #f8fafc;
            }

            .${SCRIPT_ID}-panel-item.is-dragging {
                opacity: 0.4;
            }

            .${SCRIPT_ID}-drag-handle {
                width: 34px;
                height: 34px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border-radius: 12px;
                background: #f1f5f9;
                color: #475569;
                cursor: grab;
                user-select: none;
            }

            .${SCRIPT_ID}-toggle {
                width: 18px;
                height: 18px;
            }

            .${SCRIPT_ID}-item-main {
                min-width: 0;
            }

            .${SCRIPT_ID}-item-title {
                display: flex;
                align-items: center;
                gap: 8px;
                min-width: 0;
            }

            .${SCRIPT_ID}-item-title strong {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .${SCRIPT_ID}-tag {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border-radius: 999px;
                padding: 4px 8px;
                font-size: 12px;
                background: #e2e8f0;
                color: #334155;
            }

            .${SCRIPT_ID}-item-url {
                margin-top: 6px;
                font-size: 12px;
                color: #64748b;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .${SCRIPT_ID}-item-actions {
                display: flex;
                gap: 8px;
            }

            .${SCRIPT_ID}-item-actions button {
                border: none;
                border-radius: 12px;
                padding: 8px 10px;
                background: #f1f5f9;
                color: #0f172a;
                cursor: pointer;
                font: inherit;
            }

            .${SCRIPT_ID}-form-grid {
                display: grid;
                grid-template-columns: 1fr;
                gap: 14px;
            }

            .${SCRIPT_ID}-field {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .${SCRIPT_ID}-field label {
                font-size: 13px;
                color: #334155;
            }

            .${SCRIPT_ID}-preview {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 14px;
                border-radius: 18px;
                border: 1px solid #e2e8f0;
                background: #f8fafc;
            }

            .${SCRIPT_ID}-range-row {
                display: grid;
                grid-template-columns: 1fr auto;
                gap: 12px;
                align-items: center;
            }

            .${SCRIPT_ID}-range-row input[type="range"] {
                width: 100%;
            }

            .${SCRIPT_ID}-muted {
                color: #64748b;
                font-size: 13px;
            }

            #${SCRIPT_ID}-toast {
                position: fixed;
                right: 12px;
                bottom: calc(86px + var(--${SCRIPT_ID}-safe-bottom));
                max-width: min(360px, calc(100vw - 24px));
                padding: 12px 14px;
                border-radius: 14px;
                background: rgba(16, 24, 40, 0.92);
                color: #fff;
                box-shadow: 0 14px 40px rgba(0, 0, 0, 0.25);
                pointer-events: auto;
            }

            #${SCRIPT_ID}-toast[hidden] {
                display: none;
            }

            @media (max-width: 768px) {
                #${SCRIPT_ID}-bar {
                    left: 8px;
                    right: 8px;
                    bottom: calc(8px + var(--${SCRIPT_ID}-safe-bottom));
                }

                .${SCRIPT_ID}-quick-card,
                .${SCRIPT_ID}-panel-card {
                    width: calc(100vw - 12px);
                    max-height: calc(100vh - 12px);
                    border-radius: 20px;
                }

                .${SCRIPT_ID}-panel-grid {
                    grid-template-columns: 1fr;
                }

                .${SCRIPT_ID}-panel-item {
                    grid-template-columns: auto minmax(0, 1fr) auto;
                }

                .${SCRIPT_ID}-toggle {
                    order: -1;
                }
            }
        `;

        if (typeof GM_addStyle === 'function') {
            GM_addStyle(css);
            const marker = document.createElement('style');
            marker.id = `${SCRIPT_ID}-style`;
            marker.textContent = '';
            document.head.appendChild(marker);
        } else {
            const style = document.createElement('style');
            style.id = `${SCRIPT_ID}-style`;
            style.textContent = css;
            document.head.appendChild(style);
        }
    }

    function setCssOffset(offset) {
        document.documentElement.style.setProperty(`--${SCRIPT_ID}-bottom-offset`, `${offset}px`);
    }

    function createEl(tag, className, text) {
        const element = document.createElement(tag);
        if (className) {
            element.className = className;
        }
        if (text !== undefined) {
            element.textContent = text;
        }
        return element;
    }

    function ensureRoot() {
        if (state.ui.root && document.body.contains(state.ui.root)) {
            return;
        }

        const root = createEl('div');
        root.id = `${SCRIPT_ID}-root`;

        const bar = createEl('div');
        bar.id = `${SCRIPT_ID}-bar`;

        const menu = createEl('div', `${SCRIPT_ID}-menu`);
        menu.hidden = true;

        const quickSearch = createEl('div', `${SCRIPT_ID}-quick-search`);
        quickSearch.hidden = true;

        const panel = createEl('div', `${SCRIPT_ID}-panel`);
        panel.hidden = true;

        const toast = createEl('div');
        toast.id = `${SCRIPT_ID}-toast`;
        toast.hidden = true;

        root.appendChild(bar);
        root.appendChild(menu);
        root.appendChild(quickSearch);
        root.appendChild(panel);
        root.appendChild(toast);
        document.body.appendChild(root);

        state.ui.root = root;
        state.ui.bar = bar;
        state.ui.menu = menu;
        state.ui.quickSearch = quickSearch;
        state.ui.panel = panel;
        state.ui.toast = toast;

        bindGlobalUiEvents();
    }

    let toastTimer = null;
    function showToast(message, type) {
        ensureRoot();
        const toast = state.ui.toast;
        toast.hidden = false;
        toast.textContent = message;
        toast.style.background = type === 'error' ? 'rgba(185, 28, 28, 0.94)' : 'rgba(16, 24, 40, 0.92)';
        if (toastTimer) {
            clearTimeout(toastTimer);
        }
        toastTimer = window.setTimeout(() => {
            toast.hidden = true;
        }, 2600);
    }

    function recordUsage(engineId) {
        state.usageCounts[engineId] = (state.usageCounts[engineId] || 0) + 1;
        saveUsageCounts();
    }

    function isTextInput(target) {
        if (!target || !(target instanceof HTMLElement)) {
            return false;
        }
        if (target instanceof HTMLTextAreaElement) {
            return true;
        }
        if (target instanceof HTMLInputElement) {
            const type = (target.type || 'text').toLowerCase();
            return ['text', 'search', 'url', 'email', 'number'].includes(type);
        }
        return false;
    }

    function isElementVisible(element) {
        if (!(element instanceof HTMLElement)) {
            return false;
        }
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function readQueryFromLocation() {
        const url = new URL(window.location.href);
        for (const key of SEARCH_PARAM_KEYS) {
            const value = url.searchParams.get(key);
            if (value && value.trim()) {
                return value.trim();
            }
        }
        return '';
    }

    function readQueryFromInputs() {
        const active = document.activeElement;
        if (isTextInput(active) && String(active.value || '').trim()) {
            return String(active.value).trim();
        }

        const candidates = Array.from(document.querySelectorAll(SEARCH_INPUT_SELECTOR));
        for (const element of candidates) {
            if (!isTextInput(element) || !isElementVisible(element)) {
                continue;
            }
            const value = String(element.value || '').trim();
            if (value) {
                return value;
            }
        }
        return '';
    }

    function hasSearchInputCandidate() {
        return Array.from(document.querySelectorAll(SEARCH_INPUT_SELECTOR)).some((element) => isTextInput(element) && isElementVisible(element));
    }

    function getCurrentQuery() {
        if (state.flags.quickSearchOpen) {
            const quickInput = document.getElementById(`${SCRIPT_ID}-quick-input`);
            if (quickInput && String(quickInput.value || '').trim()) {
                return String(quickInput.value).trim();
            }
        }
        return readQueryFromInputs() || readQueryFromLocation() || sessionStorage.getItem(SESSION_CURRENT_INPUT) || '';
    }

    function syncCurrentQuery() {
        const query = getCurrentQuery().trim();
        state.currentQuery = query;
        if (query) {
            sessionStorage.setItem(SESSION_CURRENT_INPUT, query);
        }
        return query;
    }

    function buildSearchUrl(engine, keyword) {
        return String(engine.searchUrl).replace(/\{keyword\}/g, encodeURIComponent(keyword));
    }

    function openSearch(engine, keyword) {
        const finalKeyword = String(keyword || '').trim() || syncCurrentQuery();
        if (!finalKeyword) {
            showQuickSearch();
            return;
        }
        const url = buildSearchUrl(engine, finalKeyword);
        recordUsage(engine.id);
        window.open(url, '_blank', 'noopener');
    }

    function isActiveEngine(engine) {
        const host = window.location.hostname;
        return (engine.hostPatterns || []).some((pattern) => host.includes(pattern));
    }

    function shouldDisplayBar() {
        return getVisibleEngines().length > 0 && (Boolean(syncCurrentQuery()) || hasSearchInputCandidate());
    }

    function makeEngineBadge(engine) {
        const badge = createEl('span', `${SCRIPT_ID}-engine-icon`, engine.iconText);
        badge.style.background = engine.color;
        badge.title = engine.name;
        return badge;
    }

    function renderBar() {
        ensureRoot();
        const bar = state.ui.bar;
        const visibleEngines = getVisibleEngines();
        bar.hidden = !shouldDisplayBar();
        if (bar.hidden) {
            hideMenu();
            return;
        }

        bar.innerHTML = '';

        const menuButton = createEl('button', `${SCRIPT_ID}-action`);
        menuButton.type = 'button';
        menuButton.title = '菜单';
        menuButton.textContent = '≡';
        menuButton.addEventListener('click', () => {
            if (state.flags.menuOpen) {
                hideMenu();
            } else {
                showMenu();
            }
        });

        const quickButton = createEl('button', `${SCRIPT_ID}-action`);
        quickButton.type = 'button';
        quickButton.title = '快捷搜索';
        quickButton.textContent = '⌕';
        quickButton.addEventListener('click', () => {
            showQuickSearch();
        });

        const scroll = createEl('div', `${SCRIPT_ID}-scroll`);
        visibleEngines.forEach((engine) => {
            const button = createEl('button', `${SCRIPT_ID}-engine-button${isActiveEngine(engine) ? ' is-active' : ''}`);
            button.type = 'button';
            button.title = `${engine.name}${state.currentQuery ? `：搜索“${state.currentQuery}”` : ''}`;
            button.appendChild(makeEngineBadge(engine));
            button.appendChild(createEl('span', `${SCRIPT_ID}-engine-name`, engine.name));
            button.addEventListener('click', () => {
                openSearch(engine, state.currentQuery);
            });
            scroll.appendChild(button);
        });

        bar.appendChild(menuButton);
        bar.appendChild(scroll);
        bar.appendChild(quickButton);
        setCssOffset(state.config.barOffset);
    }

    function renderMenu() {
        ensureRoot();
        const menu = state.ui.menu;
        menu.innerHTML = '';

        const items = [
            {
                title: '快捷搜索',
                desc: '在面板内编辑关键词并快速切换',
                onClick: () => showQuickSearch()
            },
            {
                title: '管理引擎',
                desc: '启用、排序、添加、编辑自定义引擎',
                onClick: () => showPanel()
            },
            {
                title: '识别当前站点',
                desc: '尝试把当前搜索页提取为新引擎',
                onClick: () => {
                    showPanel();
                    populateFormFromCurrentPage();
                }
            },
            {
                title: '复制当前关键词',
                desc: state.currentQuery || '当前尚未识别到关键词',
                onClick: async () => {
                    const keyword = syncCurrentQuery();
                    if (!keyword) {
                        showToast('当前没有可复制的关键词', 'error');
                        return;
                    }
                    try {
                        await navigator.clipboard.writeText(keyword);
                        showToast('已复制当前关键词');
                    } catch (error) {
                        showToast('复制失败，请手动复制', 'error');
                    }
                }
            }
        ];

        items.forEach((item) => {
            const button = createEl('button', `${SCRIPT_ID}-menu-item`);
            button.type = 'button';
            button.innerHTML = `<span>${escapeHtml(item.title)}</span><small>${escapeHtml(item.desc)}</small>`;
            button.addEventListener('click', () => {
                hideMenu();
                item.onClick();
            });
            menu.appendChild(button);
        });
    }

    function showMenu() {
        renderMenu();
        state.ui.menu.hidden = false;
        state.flags.menuOpen = true;
    }

    function hideMenu() {
        if (!state.ui.menu) {
            return;
        }
        state.ui.menu.hidden = true;
        state.flags.menuOpen = false;
    }

    function renderQuickSearch() {
        ensureRoot();
        const panel = state.ui.quickSearch;
        const visibleEngines = getVisibleEngines();
        const currentQuery = syncCurrentQuery();

        panel.innerHTML = `
            <div class="${SCRIPT_ID}-mask" data-close="quick-search"></div>
            <div class="${SCRIPT_ID}-quick-card" role="dialog" aria-modal="true" aria-labelledby="${SCRIPT_ID}-quick-title">
                <div class="${SCRIPT_ID}-section">
                    <div class="${SCRIPT_ID}-header">
                        <div>
                            <h2 class="${SCRIPT_ID}-title" id="${SCRIPT_ID}-quick-title">快捷搜索</h2>
                            <p class="${SCRIPT_ID}-subtitle">编辑关键词后，直接跳转到任意已启用引擎。</p>
                        </div>
                        <button class="${SCRIPT_ID}-close" type="button" data-close="quick-search" aria-label="关闭">×</button>
                    </div>
                </div>
                <div class="${SCRIPT_ID}-section">
                    <input id="${SCRIPT_ID}-quick-input" class="${SCRIPT_ID}-search-input" type="search" placeholder="输入关键词后回车，或点击下方引擎" value="${escapeHtml(currentQuery)}">
                </div>
                <div class="${SCRIPT_ID}-section">
                    <div class="${SCRIPT_ID}-overlay-grid" id="${SCRIPT_ID}-quick-grid"></div>
                </div>
            </div>
        `;

        const grid = panel.querySelector(`#${SCRIPT_ID}-quick-grid`);
        visibleEngines.forEach((engine) => {
            const button = createEl('button', `${SCRIPT_ID}-overlay-button`);
            button.type = 'button';
            button.appendChild(makeEngineBadge(engine));
            const info = createEl('div');
            info.appendChild(createEl('div', `${SCRIPT_ID}-engine-name`, engine.name));
            info.appendChild(createEl('div', `${SCRIPT_ID}-overlay-meta`, `已使用 ${state.usageCounts[engine.id] || 0} 次`));
            button.appendChild(info);
            button.addEventListener('click', () => {
                const input = document.getElementById(`${SCRIPT_ID}-quick-input`);
                const keyword = input ? input.value.trim() : syncCurrentQuery();
                if (!keyword) {
                    showToast('请先输入关键词', 'error');
                    return;
                }
                openSearch(engine, keyword);
                hideQuickSearch();
            });
            grid.appendChild(button);
        });

        const quickInput = panel.querySelector(`#${SCRIPT_ID}-quick-input`);
        quickInput.addEventListener('input', () => {
            state.currentQuery = quickInput.value.trim();
            sessionStorage.setItem(SESSION_CURRENT_INPUT, state.currentQuery);
            renderBar();
        });
        quickInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                const first = visibleEngines[0];
                if (first) {
                    openSearch(first, quickInput.value.trim());
                    hideQuickSearch();
                }
            }
        });
    }

    function showQuickSearch() {
        hideMenu();
        renderQuickSearch();
        state.ui.quickSearch.hidden = false;
        state.flags.quickSearchOpen = true;
        const quickInput = document.getElementById(`${SCRIPT_ID}-quick-input`);
        if (quickInput) {
            window.setTimeout(() => {
                quickInput.focus();
                quickInput.select();
            }, 16);
        }
    }

    function hideQuickSearch() {
        if (!state.ui.quickSearch) {
            return;
        }
        state.ui.quickSearch.hidden = true;
        state.flags.quickSearchOpen = false;
    }

    function markPanelDirty(dirty) {
        state.panel.dirty = dirty;
        const dirtyEl = document.getElementById(`${SCRIPT_ID}-dirty-text`);
        if (dirtyEl) {
            dirtyEl.textContent = dirty ? '有未保存更改' : '当前已保存';
        }
    }

    function cloneConfigForPanel() {
        state.panel.draftConfig = normalizeConfig(clone(state.config));
        state.panel.editingEngineId = null;
        state.panel.formDraft = createEmptyFormDraft();
        markPanelDirty(false);
    }

    function renderPanelEngineList() {
        const list = document.getElementById(`${SCRIPT_ID}-panel-list`);
        if (!list) {
            return;
        }
        list.innerHTML = '';

        const normalized = normalizeConfig(state.panel.draftConfig);
        const hiddenSet = new Set(normalized.hiddenIds);
        const ordered = getOrderedEngines(normalized);

        ordered.forEach((engine) => {
            const item = createEl('div', `${SCRIPT_ID}-panel-item${hiddenSet.has(engine.id) ? ' is-hidden' : ''}`);
            item.draggable = true;
            item.dataset.engineId = engine.id;

            const dragHandle = createEl('div', `${SCRIPT_ID}-drag-handle`, '⋮⋮');
            dragHandle.title = '拖拽排序';

            const toggle = createEl('input', `${SCRIPT_ID}-toggle`);
            toggle.type = 'checkbox';
            toggle.checked = !hiddenSet.has(engine.id);
            toggle.title = '启用/隐藏';
            toggle.addEventListener('change', () => {
                toggleEngineVisible(engine.id, toggle.checked);
            });

            const main = createEl('div', `${SCRIPT_ID}-item-main`);
            const titleRow = createEl('div', `${SCRIPT_ID}-item-title`);
            titleRow.appendChild(makeEngineBadge(engine));
            const strong = createEl('strong', null, engine.name);
            strong.title = engine.name;
            titleRow.appendChild(strong);
            titleRow.appendChild(createEl('span', `${SCRIPT_ID}-tag`, engine.builtin ? '内置' : '自定义'));
            main.appendChild(titleRow);
            const metaUrl = createEl('div', `${SCRIPT_ID}-item-url`, engine.searchUrl);
            metaUrl.title = engine.searchUrl;
            main.appendChild(metaUrl);

            const actions = createEl('div', `${SCRIPT_ID}-item-actions`);
            if (!engine.builtin) {
                const editButton = createEl('button', null, '编辑');
                editButton.type = 'button';
                editButton.addEventListener('click', () => {
                    loadCustomEngineToForm(engine.id);
                });
                actions.appendChild(editButton);
            }

            const usageButton = createEl('button', null, `使用 ${state.usageCounts[engine.id] || 0}`);
            usageButton.type = 'button';
            usageButton.disabled = true;
            usageButton.style.cursor = 'default';
            actions.appendChild(usageButton);

            if (!engine.builtin) {
                const removeButton = createEl('button', null, '删除');
                removeButton.type = 'button';
                removeButton.addEventListener('click', () => {
                    deleteCustomEngine(engine.id);
                });
                actions.appendChild(removeButton);
            }

            item.appendChild(dragHandle);
            item.appendChild(toggle);
            item.appendChild(main);
            item.appendChild(actions);
            list.appendChild(item);
        });

        bindDragSorting(list);
        updatePanelStats();
    }

    function buildPreviewEngineFromFormDraft() {
        const draft = state.panel.formDraft;
        return normalizeEngine({
            id: draft.id || draft.name || 'preview',
            name: draft.name || '新引擎',
            searchUrl: draft.searchUrl || 'https://example.com/search?q={keyword}',
            queryKeys: splitQueryKeys(draft.queryKeys),
            color: draft.color,
            iconText: draft.iconText
        }, { builtin: false });
    }

    function refreshPanelFormPreview() {
        const preview = document.getElementById(`${SCRIPT_ID}-form-preview`);
        const saveButton = document.getElementById(`${SCRIPT_ID}-save-engine`);
        if (preview) {
            preview.innerHTML = makePreviewHtml(buildPreviewEngineFromFormDraft());
        }
        if (saveButton) {
            saveButton.textContent = state.panel.editingEngineId ? '保存当前引擎' : '添加到列表';
        }
    }

    function renderPanelForm() {
        const container = document.getElementById(`${SCRIPT_ID}-form-area`);
        if (!container) {
            return;
        }

        const draft = state.panel.formDraft;
        const previewEngine = buildPreviewEngineFromFormDraft();

        container.innerHTML = `
            <div class="${SCRIPT_ID}-form-grid">
                <div class="${SCRIPT_ID}-field">
                    <label for="${SCRIPT_ID}-field-name">名称</label>
                    <input id="${SCRIPT_ID}-field-name" class="${SCRIPT_ID}-text-input" type="text" value="${escapeHtml(draft.name)}" placeholder="例如：DuckDuckGo">
                </div>
                <div class="${SCRIPT_ID}-field">
                    <label for="${SCRIPT_ID}-field-id">标识</label>
                    <input id="${SCRIPT_ID}-field-id" class="${SCRIPT_ID}-text-input" type="text" value="${escapeHtml(draft.id)}" placeholder="建议唯一，例如 duckduckgo">
                </div>
                <div class="${SCRIPT_ID}-field">
                    <label for="${SCRIPT_ID}-field-url">搜索链接模板</label>
                    <input id="${SCRIPT_ID}-field-url" class="${SCRIPT_ID}-text-input" type="text" value="${escapeHtml(draft.searchUrl)}" placeholder="必须包含 {keyword}">
                </div>
                <div class="${SCRIPT_ID}-field">
                    <label for="${SCRIPT_ID}-field-keys">关键词参数</label>
                    <input id="${SCRIPT_ID}-field-keys" class="${SCRIPT_ID}-text-input" type="text" value="${escapeHtml(draft.queryKeys)}" placeholder="例如：q,query">
                </div>
                <div class="${SCRIPT_ID}-field">
                    <label for="${SCRIPT_ID}-field-icon">图标文本</label>
                    <input id="${SCRIPT_ID}-field-icon" class="${SCRIPT_ID}-text-input" type="text" value="${escapeHtml(draft.iconText)}" placeholder="例如：G 或 百">
                </div>
                <div class="${SCRIPT_ID}-field">
                    <label for="${SCRIPT_ID}-field-color">主题色</label>
                    <input id="${SCRIPT_ID}-field-color" class="${SCRIPT_ID}-text-input" type="text" value="${escapeHtml(draft.color)}" placeholder="#4455ee">
                </div>
                <div class="${SCRIPT_ID}-preview" id="${SCRIPT_ID}-form-preview">
                    ${makePreviewHtml(previewEngine)}
                </div>
                <div class="${SCRIPT_ID}-toolbar">
                    <button type="button" class="${SCRIPT_ID}-panel-button is-primary" id="${SCRIPT_ID}-save-engine">
                        ${state.panel.editingEngineId ? '保存当前引擎' : '添加到列表'}
                    </button>
                    <button type="button" class="${SCRIPT_ID}-panel-button" id="${SCRIPT_ID}-new-engine">新建空白</button>
                </div>
            </div>
        `;

        [
            ['name', `${SCRIPT_ID}-field-name`],
            ['id', `${SCRIPT_ID}-field-id`],
            ['searchUrl', `${SCRIPT_ID}-field-url`],
            ['queryKeys', `${SCRIPT_ID}-field-keys`],
            ['iconText', `${SCRIPT_ID}-field-icon`],
            ['color', `${SCRIPT_ID}-field-color`]
        ].forEach(([key, elementId]) => {
            const input = document.getElementById(elementId);
            input.addEventListener('input', () => {
                state.panel.formDraft[key] = input.value;
                refreshPanelFormPreview();
            });
        });

        document.getElementById(`${SCRIPT_ID}-save-engine`).addEventListener('click', savePanelEngineFromForm);
        document.getElementById(`${SCRIPT_ID}-new-engine`).addEventListener('click', () => {
            state.panel.editingEngineId = null;
            state.panel.formDraft = createEmptyFormDraft();
            renderPanelForm();
        });
    }

    function makePreviewHtml(engine) {
        return `
            <span class="${SCRIPT_ID}-engine-icon" style="background:${escapeHtml(engine.color)}">${escapeHtml(engine.iconText)}</span>
            <div>
                <div><strong>${escapeHtml(engine.name)}</strong></div>
                <div class="${SCRIPT_ID}-muted">${escapeHtml(engine.searchUrl)}</div>
            </div>
        `;
    }

    function updatePanelStats() {
        const normalized = normalizeConfig(state.panel.draftConfig);
        const stats = {
            total: getOrderedEngines(normalized).length,
            enabled: getVisibleEngines(normalized).length,
            custom: normalized.customEngines.length
        };
        const mapping = {
            total: `${SCRIPT_ID}-stat-total`,
            enabled: `${SCRIPT_ID}-stat-enabled`,
            custom: `${SCRIPT_ID}-stat-custom`
        };
        Object.entries(mapping).forEach(([key, id]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = String(stats[key]);
            }
        });
    }

    function renderPanel() {
        ensureRoot();
        const panel = state.ui.panel;
        const config = normalizeConfig(state.panel.draftConfig);

        panel.innerHTML = `
            <div class="${SCRIPT_ID}-mask" data-close="panel"></div>
            <div class="${SCRIPT_ID}-panel-card" role="dialog" aria-modal="true" aria-labelledby="${SCRIPT_ID}-panel-title">
                <div class="${SCRIPT_ID}-section">
                    <div class="${SCRIPT_ID}-header">
                        <div>
                            <h2 class="${SCRIPT_ID}-title" id="${SCRIPT_ID}-panel-title">搜索引擎管理中心</h2>
                            <p class="${SCRIPT_ID}-subtitle">新架构支持：数据迁移、启用/隐藏、拖拽排序、自定义引擎编辑、页面自动识别、底部偏移设置。</p>
                        </div>
                        <button class="${SCRIPT_ID}-close" type="button" data-close="panel" aria-label="关闭">×</button>
                    </div>
                </div>

                <div class="${SCRIPT_ID}-section">
                    <div class="${SCRIPT_ID}-stats-grid">
                        <div class="${SCRIPT_ID}-stat"><b id="${SCRIPT_ID}-stat-total">0</b>总引擎</div>
                        <div class="${SCRIPT_ID}-stat"><b id="${SCRIPT_ID}-stat-enabled">0</b>已启用</div>
                        <div class="${SCRIPT_ID}-stat"><b id="${SCRIPT_ID}-stat-custom">0</b>自定义</div>
                    </div>
                </div>

                <div class="${SCRIPT_ID}-section">
                    <div class="${SCRIPT_ID}-toolbar">
                        <button type="button" class="${SCRIPT_ID}-panel-button" id="${SCRIPT_ID}-panel-extract">识别当前站点</button>
                        <button type="button" class="${SCRIPT_ID}-panel-button" id="${SCRIPT_ID}-panel-reset">恢复默认</button>
                        <button type="button" class="${SCRIPT_ID}-panel-button is-primary" id="${SCRIPT_ID}-panel-save">保存全部配置</button>
                        <span class="${SCRIPT_ID}-muted" id="${SCRIPT_ID}-dirty-text">${state.panel.dirty ? '有未保存更改' : '当前已保存'}</span>
                    </div>
                </div>

                <div class="${SCRIPT_ID}-section">
                    <div class="${SCRIPT_ID}-field">
                        <label for="${SCRIPT_ID}-offset-range">底部偏移（适配输入法、手势条和底部工具栏）</label>
                        <div class="${SCRIPT_ID}-range-row">
                            <input id="${SCRIPT_ID}-offset-range" type="range" min="0" max="240" step="2" value="${config.barOffset}">
                            <input id="${SCRIPT_ID}-offset-number" class="${SCRIPT_ID}-number-input" type="number" min="0" max="240" step="2" value="${config.barOffset}">
                        </div>
                    </div>
                </div>

                <div class="${SCRIPT_ID}-section">
                    <div class="${SCRIPT_ID}-panel-grid">
                        <div>
                            <div class="${SCRIPT_ID}-header" style="margin-bottom:12px;">
                                <div>
                                    <h3 class="${SCRIPT_ID}-title" style="font-size:18px;">引擎列表</h3>
                                    <p class="${SCRIPT_ID}-subtitle">拖拽排序，勾选表示在底部栏显示。</p>
                                </div>
                            </div>
                            <div class="${SCRIPT_ID}-panel-list" id="${SCRIPT_ID}-panel-list"></div>
                        </div>
                        <div>
                            <div class="${SCRIPT_ID}-header" style="margin-bottom:12px;">
                                <div>
                                    <h3 class="${SCRIPT_ID}-title" style="font-size:18px;">自定义引擎</h3>
                                    <p class="${SCRIPT_ID}-subtitle">编辑或新增自定义引擎，链接模板必须包含 <code>{keyword}</code>。</p>
                                </div>
                            </div>
                            <div id="${SCRIPT_ID}-form-area"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        renderPanelEngineList();
        renderPanelForm();

        const offsetRange = document.getElementById(`${SCRIPT_ID}-offset-range`);
        const offsetNumber = document.getElementById(`${SCRIPT_ID}-offset-number`);
        const syncOffsetInputs = (value) => {
            const offset = Math.max(0, Math.min(240, Number(value) || 0));
            offsetRange.value = String(offset);
            offsetNumber.value = String(offset);
            state.panel.draftConfig.barOffset = offset;
            setCssOffset(offset);
            markPanelDirty(true);
        };
        offsetRange.addEventListener('input', () => syncOffsetInputs(offsetRange.value));
        offsetNumber.addEventListener('input', () => syncOffsetInputs(offsetNumber.value));

        document.getElementById(`${SCRIPT_ID}-panel-extract`).addEventListener('click', populateFormFromCurrentPage);
        document.getElementById(`${SCRIPT_ID}-panel-reset`).addEventListener('click', restoreDraftToDefault);
        document.getElementById(`${SCRIPT_ID}-panel-save`).addEventListener('click', savePanelConfig);
    }

    function showPanel() {
        hideMenu();
        if (!state.panel.draftConfig) {
            cloneConfigForPanel();
        }
        renderPanel();
        state.ui.panel.hidden = false;
        state.flags.panelOpen = true;
    }

    function hidePanel() {
        if (!state.ui.panel) {
            return;
        }
        if (state.panel.dirty && !window.confirm('当前有未保存更改，确定关闭吗？')) {
            return;
        }
        state.ui.panel.hidden = true;
        state.flags.panelOpen = false;
        state.panel.draftConfig = null;
        state.panel.formDraft = createEmptyFormDraft();
        state.panel.editingEngineId = null;
        markPanelDirty(false);
        setCssOffset(state.config.barOffset);
    }

    function toggleEngineVisible(engineId, visible) {
        const hiddenSet = new Set(state.panel.draftConfig.hiddenIds);
        if (visible) {
            hiddenSet.delete(engineId);
        } else {
            hiddenSet.add(engineId);
        }
        const ordered = getOrderedEngines(state.panel.draftConfig);
        const visibleCount = ordered.filter((engine) => !hiddenSet.has(engine.id)).length;
        if (visibleCount === 0) {
            showToast('至少保留一个启用引擎', 'error');
            return;
        }
        state.panel.draftConfig.hiddenIds = Array.from(hiddenSet);
        markPanelDirty(true);
        renderPanelEngineList();
    }

    function loadCustomEngineToForm(engineId) {
        const engine = getCustomEngineById(engineId, state.panel.draftConfig);
        if (!engine) {
            showToast('未找到可编辑的自定义引擎', 'error');
            return;
        }
        state.panel.editingEngineId = engine.id;
        state.panel.formDraft = {
            id: engine.id,
            name: engine.name,
            searchUrl: engine.searchUrl,
            queryKeys: engine.queryKeys.join(','),
            iconText: engine.iconText,
            color: engine.color
        };
        renderPanelForm();
    }

    function savePanelEngineFromForm() {
        const form = state.panel.formDraft;
        const name = String(form.name || '').trim();
        const id = normalizeId(form.id || form.name, form.searchUrl || form.name);
        const queryKeys = splitQueryKeys(form.queryKeys);
        const searchUrl = ensureSearchPlaceholder(form.searchUrl, queryKeys);
        const color = String(form.color || '').trim() || pickColor(id);
        const iconText = String(form.iconText || '').trim() || inferIconText(name, id);

        if (!name) {
            showToast('引擎名称不能为空', 'error');
            return;
        }
        if (!searchUrl || !/\{keyword\}/.test(searchUrl)) {
            showToast('搜索链接必须包含 {keyword}', 'error');
            return;
        }

        let hostPatterns = [];
        try {
            const parsed = new URL(searchUrl);
            hostPatterns = [parsed.hostname.replace(/^www\./, '')];
        } catch (error) {
            showToast('搜索链接格式无效', 'error');
            return;
        }

        const normalized = normalizeEngine({
            id,
            name,
            searchUrl,
            queryKeys,
            hostPatterns,
            color,
            iconText
        }, { builtin: false });

        const builtinIds = new Set(getBuiltInEngines().map((engine) => engine.id));
        const draftCustoms = [...state.panel.draftConfig.customEngines];
        const otherCustoms = draftCustoms.filter((engine) => engine.id !== state.panel.editingEngineId);
        if (builtinIds.has(normalized.id) || otherCustoms.some((engine) => engine.id === normalized.id)) {
            showToast('标识重复，请修改后重试', 'error');
            return;
        }

        if (state.panel.editingEngineId) {
            state.panel.draftConfig.customEngines = draftCustoms.map((engine) => (
                engine.id === state.panel.editingEngineId ? normalized : engine
            ));
            state.panel.draftConfig.order = state.panel.draftConfig.order.map((item) => (
                item === state.panel.editingEngineId ? normalized.id : item
            ));
            state.panel.draftConfig.hiddenIds = state.panel.draftConfig.hiddenIds.map((item) => (
                item === state.panel.editingEngineId ? normalized.id : item
            ));
        } else {
            state.panel.draftConfig.customEngines = [...draftCustoms, normalized];
            state.panel.draftConfig.order.push(normalized.id);
        }

        state.panel.editingEngineId = normalized.id;
        state.panel.formDraft = {
            id: normalized.id,
            name: normalized.name,
            searchUrl: normalized.searchUrl,
            queryKeys: normalized.queryKeys.join(','),
            iconText: normalized.iconText,
            color: normalized.color
        };
        state.panel.draftConfig = normalizeConfig(state.panel.draftConfig);
        markPanelDirty(true);
        renderPanelEngineList();
        renderPanelForm();
        showToast('已更新引擎草稿');
    }

    function deleteCustomEngine(engineId) {
        const engine = getCustomEngineById(engineId, state.panel.draftConfig);
        if (!engine) {
            return;
        }
        if (!window.confirm(`确定删除自定义引擎“${engine.name}”吗？`)) {
            return;
        }
        state.panel.draftConfig.customEngines = state.panel.draftConfig.customEngines.filter((item) => item.id !== engineId);
        state.panel.draftConfig.order = state.panel.draftConfig.order.filter((item) => item !== engineId);
        state.panel.draftConfig.hiddenIds = state.panel.draftConfig.hiddenIds.filter((item) => item !== engineId);
        if (state.panel.editingEngineId === engineId) {
            state.panel.editingEngineId = null;
            state.panel.formDraft = createEmptyFormDraft();
        }
        state.panel.draftConfig = normalizeConfig(state.panel.draftConfig);
        markPanelDirty(true);
        renderPanelEngineList();
        renderPanelForm();
        showToast('已删除自定义引擎');
    }

    function restoreDraftToDefault() {
        if (!window.confirm('确定恢复默认配置吗？这会移除全部自定义引擎并重置排序。')) {
            return;
        }
        state.panel.draftConfig = normalizeConfig({
            version: 2,
            barOffset: 0,
            order: [...DEFAULT_ENGINE_ORDER],
            hiddenIds: [],
            customEngines: []
        });
        state.panel.editingEngineId = null;
        state.panel.formDraft = createEmptyFormDraft();
        markPanelDirty(true);
        renderPanel();
        showToast('已恢复默认草稿');
    }

    function savePanelConfig() {
        const normalized = normalizeConfig(state.panel.draftConfig);
        if (getEnabledEngineCount(normalized) === 0) {
            showToast('至少需要启用一个引擎', 'error');
            return;
        }
        saveConfig(normalized);
        markPanelDirty(false);
        renderBar();
        renderQuickSearch();
        showToast('配置已保存');
    }

    function bindDragSorting(listElement) {
        let draggingId = null;

        listElement.querySelectorAll(`.${SCRIPT_ID}-panel-item`).forEach((item) => {
            item.addEventListener('dragstart', () => {
                draggingId = item.dataset.engineId;
                item.classList.add('is-dragging');
            });
            item.addEventListener('dragend', () => {
                item.classList.remove('is-dragging');
                draggingId = null;
            });
            item.addEventListener('dragover', (event) => {
                event.preventDefault();
            });
            item.addEventListener('drop', (event) => {
                event.preventDefault();
                const targetId = item.dataset.engineId;
                if (!draggingId || !targetId || draggingId === targetId) {
                    return;
                }
                reorderDraftEngines(draggingId, targetId);
            });
        });
    }

    function reorderDraftEngines(sourceId, targetId) {
        const order = [...state.panel.draftConfig.order];
        const sourceIndex = order.indexOf(sourceId);
        const targetIndex = order.indexOf(targetId);
        if (sourceIndex < 0 || targetIndex < 0) {
            return;
        }
        const [source] = order.splice(sourceIndex, 1);
        order.splice(targetIndex, 0, source);
        state.panel.draftConfig.order = order;
        markPanelDirty(true);
        renderPanelEngineList();
    }

    function deriveSiteName() {
        const metaSite = document.querySelector('meta[property="og:site_name"], meta[name="application-name"]');
        const content = metaSite ? String(metaSite.getAttribute('content') || '').trim() : '';
        if (content) {
            return content;
        }
        return window.location.hostname.replace(/^www\./, '').split('.')[0];
    }

    function detectSearchForm() {
        const forms = Array.from(document.forms || []);
        for (const form of forms) {
            const input = form.querySelector(SEARCH_INPUT_SELECTOR);
            if (!input || !isTextInput(input)) {
                continue;
            }
            const name = input.getAttribute('name') || 'q';
            const action = form.getAttribute('action') || window.location.pathname;
            let baseUrl = '';
            try {
                baseUrl = new URL(action, window.location.origin).toString();
            } catch (error) {
                continue;
            }
            return {
                name: deriveSiteName(),
                id: normalizeId(deriveSiteName(), window.location.hostname),
                searchUrl: ensureSearchPlaceholder(baseUrl, [name]),
                queryKeys: [name],
                hostPatterns: [window.location.hostname.replace(/^www\./, '')],
                color: pickColor(window.location.hostname),
                iconText: inferIconText(deriveSiteName(), window.location.hostname)
            };
        }
        return null;
    }

    function detectSearchFromLocation() {
        const url = new URL(window.location.href);
        for (const key of SEARCH_PARAM_KEYS) {
            const value = url.searchParams.get(key);
            if (!value) {
                continue;
            }
            const cleanUrl = new URL(window.location.origin + window.location.pathname);
            return {
                name: deriveSiteName(),
                id: normalizeId(deriveSiteName(), window.location.hostname),
                searchUrl: ensureSearchPlaceholder(cleanUrl.toString(), [key]),
                queryKeys: [key],
                hostPatterns: [window.location.hostname.replace(/^www\./, '')],
                color: pickColor(window.location.hostname),
                iconText: inferIconText(deriveSiteName(), window.location.hostname)
            };
        }
        return null;
    }

    function populateFormFromCurrentPage() {
        const detected = detectSearchForm() || detectSearchFromLocation();
        if (!detected) {
            showToast('当前页面未识别到可提取的搜索表单', 'error');
            return;
        }
        state.panel.editingEngineId = null;
        state.panel.formDraft = {
            id: detected.id,
            name: detected.name,
            searchUrl: detected.searchUrl,
            queryKeys: detected.queryKeys.join(','),
            iconText: detected.iconText,
            color: detected.color
        };
        renderPanelForm();
        showToast(`已识别站点：${detected.name}`);
    }

    function bindGlobalUiEvents() {
        document.addEventListener('keydown', (event) => {
            if (event.altKey && event.key.toLowerCase() === 's') {
                event.preventDefault();
                showQuickSearch();
                return;
            }
            if (event.altKey && event.key.toLowerCase() === 'm') {
                event.preventDefault();
                if (state.flags.menuOpen) {
                    hideMenu();
                } else {
                    showMenu();
                }
                return;
            }
            if (event.key === 'Escape') {
                if (state.flags.panelOpen) {
                    hidePanel();
                } else if (state.flags.quickSearchOpen) {
                    hideQuickSearch();
                } else if (state.flags.menuOpen) {
                    hideMenu();
                }
            }
        }, true);

        document.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) {
                return;
            }
            const closeTarget = target.getAttribute('data-close');
            if (closeTarget === 'quick-search') {
                hideQuickSearch();
            } else if (closeTarget === 'panel') {
                hidePanel();
            } else if (
                state.flags.menuOpen &&
                state.ui.menu &&
                !state.ui.menu.contains(target) &&
                state.ui.bar &&
                !state.ui.bar.contains(target)
            ) {
                hideMenu();
            }
        }, true);
    }

    function isInternalUiTarget(target) {
        return Boolean(
            target &&
            state.ui.root &&
            target instanceof Node &&
            state.ui.root.contains(target)
        );
    }

    function bindPageObservers() {
        document.addEventListener('input', (event) => {
            const target = event.target;
            if (isInternalUiTarget(target)) {
                return;
            }
            if (!isTextInput(target)) {
                return;
            }
            const value = String(target.value || '').trim();
            if (value) {
                state.currentQuery = value;
                sessionStorage.setItem(SESSION_CURRENT_INPUT, value);
                renderBar();
            }
        }, true);

        document.addEventListener('focusin', (event) => {
            const target = event.target;
            if (isInternalUiTarget(target)) {
                return;
            }
            if (isTextInput(target) && String(target.value || '').trim()) {
                state.currentQuery = String(target.value).trim();
                sessionStorage.setItem(SESSION_CURRENT_INPUT, state.currentQuery);
                renderBar();
            }
        }, true);

        const dispatchUrlChange = () => {
            window.dispatchEvent(new Event(`${SCRIPT_ID}:urlchange`));
        };

        ['pushState', 'replaceState'].forEach((method) => {
            const original = history[method];
            history[method] = function patchedHistoryState() {
                const result = original.apply(this, arguments);
                dispatchUrlChange();
                return result;
            };
        });

        window.addEventListener('popstate', dispatchUrlChange);
        window.addEventListener('hashchange', dispatchUrlChange);
        window.addEventListener(`${SCRIPT_ID}:urlchange`, () => {
            syncCurrentQuery();
            renderBar();
            if (state.flags.quickSearchOpen) {
                renderQuickSearch();
            }
        });
    }

    function refreshUi() {
        syncCurrentQuery();
        renderBar();
        if (state.flags.menuOpen) {
            renderMenu();
        }
        if (state.flags.quickSearchOpen) {
            renderQuickSearch();
        }
        if (state.flags.panelOpen) {
            renderPanel();
        }
    }

    function init() {
        if (state.initialized) {
            refreshUi();
            return;
        }

        state.config = loadConfig();
        state.usageCounts = loadUsageCounts();

        injectStyles();
        ensureRoot();
        setCssOffset(state.config.barOffset);
        syncCurrentQuery();
        renderBar();
        bindPageObservers();

        state.initialized = true;
        console.info(`[${SCRIPT_ID}] initialized`);
    }

    if (document.body) {
        init();
    } else {
        window.addEventListener('DOMContentLoaded', init, { once: true });
    }
})();
