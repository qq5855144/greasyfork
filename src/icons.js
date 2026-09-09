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
                <path d="M512 955.3408c-243.712 0-442.0096-198.2976-442.0096-442.0096S268.288 71.2704 512 71.2704s442.0608 198.2976 442.0608 442.0608S755.712 955.3408 512 955.3408z m0-802.1504c-198.5536 0-360.0896 161.536-360.0896 360.0896s161.536 360.0896 360.0896 360.0896 360.0896-161.536 360.0896-360.0896S710.5536 153.1904 512 153.1904z" fill="#4385F5"/>
                <path d="M512 513.3312m-213.6064 0a213.6064 213.6064 0 1 0 427.2128 0 213.6064 213.6064 0 1 0-427.2128 0Z" fill="#D9FFEC"/>
                <path d="M486.6048 686.7456c-112.5888 0-204.1856-91.5968-204.1856-204.2368 0-112.5888 91.5968-204.1856 204.1856-204.1856 112.5888 0 204.2368 91.5968 204.2368 204.1856-0.0512 112.64-91.648 204.2368-204.2368 204.2368z m0-331.6224c-70.2464 0-127.3856 57.1392-127.3856 127.3856s57.1392 127.4368 127.3856 127.4368 127.4368-57.1904 127.4368-127.4368-57.1904-127.3856-127.4368-127.3856z" fill="#34A853"/>
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
        listView: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="18" height="3" rx="1"/><rect x="3" y="10.5" width="18" height="3" rx="1"/><rect x="3" y="17" width="18" height="3" rx="1"/></svg>`,
        gridView: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>`,
        search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>`,
        download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>`,
        copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/></svg>`,
        invert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 7h12M8 12h12M8 17h12"/><path d="m4 7 1 1 2-2M4 12l1 1 2-2M4 17l1 1 2-2"/></svg>`,
        dedupe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 8h10v10H8z"/><path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
        arrowLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>`,
        arrowRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>`,
        zoomOut: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M16 16l5 5"/></svg>`,
        zoomIn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M11 8v6M16 16l5 5"/></svg>`,
        rotate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12a8 8 0 0 1 13.7-5.7L20 8"/><path d="M20 4v4h-4"/><path d="M20 12a8 8 0 0 1-13.7 5.7L4 16"/><path d="M4 20v-4h4"/></svg>`,
        reset: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v6h6"/></svg>`
    },
    createIcon(iconName, options = {}) {
        const svgString = this.icons[iconName];
        if (!svgString) { console.warn(`Icon "${iconName}" not found`); return null; }
        const tempDiv = document.createElement('div'); tempDiv.innerHTML = svgString.trim();
        const svgElement = tempDiv.firstChild;
        if (options.className) svgElement.classList.add(...options.className.split(' '));
        if (options.size) { svgElement.setAttribute('width', options.size); svgElement.setAttribute('height', options.size); }
        if (options.color) svgElement.style.color = options.color;
        return svgElement;
    },
    getIconString(iconName) { return this.icons[iconName] || ''; },
    registerIcon(iconName, svgString) { this.icons[iconName] = svgString; },
    getAvailableIcons() { return Object.keys(this.icons); },
    hasIcon(iconName) { return iconName in this.icons; }
};

// 兼容旧版模块使用的 Icons.xxx 属性访问方式。
// camera 旧名称映射到 collector，避免构建后的 userscript 因未导出的别名直接中断初始化。
const Icons = new Proxy(IconSystem.icons, {
    get(target, property) {
        if (property === 'camera') return target.collector || '';
        return target[property] || '';
    }
});

if (typeof module !== 'undefined' && module.exports) module.exports = IconSystem;
