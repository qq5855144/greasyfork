/**
 * 媒体功能桥接层。
 * 不重写既有 App/UI 结构，直接把视频/音频资源接入现有列表、筛选、预览和下载流程。
 */
import { App } from './App.js';
import { UIRenderer } from './UIRenderer.js';
import { MediaCollector } from './MediaCollector.js';
import { MediaPreview } from './MediaPreview.js';
import { Downloader } from './Downloader.js';
import { Notification } from '../services/Notification.js';

(function installMediaIntegration() {
    if (window.__RS_MEDIA_INTEGRATED__) return;
    window.__RS_MEDIA_INTEGRATED__ = true;

    const pending = [];
    const addItem = item => {
        if (!item || !item.url) return;
        const exists = App.globalImageItems.some(x => x.url === item.url && x.originalType === item.originalType);
        if (exists) return;
        if (!App.fabElements) { pending.push(item); return; }
        App.globalImageItems.push(item);
        App.imageItemCache.set(item.id, item);
        if (typeof App._updateGlobalCount === 'function') App._updateGlobalCount();
        if (App.mainModal && App.mainModal.style.display === 'flex' && typeof App._renderImageList === 'function') App._renderImageList();
    };

    MediaCollector.init(addItem);

    const originalInit = App.init.bind(App);
    App.init = async function() {
        const result = await originalInit();
        while (pending.length) addItem(pending.shift());
        if (typeof this._renderImageList === 'function') this._renderImageList();
        return result;
    };

    const originalCreate = UIRenderer.createImageItemElement.bind(UIRenderer);
    UIRenderer.createImageItemElement = function(item) {
        if (item && (item.type === '视频' || item.type === '音频')) {
            const div = document.createElement('div');
            div.className = 'svg-item rs-media-item';
            div.dataset.id = item.id;
            const isVideo = item.type === '视频';
            const safeName = String(item.name || item.url).replace(/[<>"']/g, '');
            const preview = document.createElement(isVideo ? 'video' : 'audio');
            preview.src = item.url;
            preview.preload = 'metadata';
            preview.controls = false;
            preview.muted = true;
            preview.playsInline = true;
            preview.style.cssText = isVideo ? 'width:100%;height:100%;object-fit:cover;background:#111' : 'width:100%;max-height:56px';
            const previewBox = document.createElement('div');
            previewBox.className = 'item-preview';
            previewBox.dataset.id = item.id;
            previewBox.style.cursor = 'pointer';
            previewBox.appendChild(preview);
            const checkbox = document.createElement('div');
            checkbox.className = 'item-checkbox';
            checkbox.innerHTML = `<input type="checkbox" id="checkbox-${item.id}" class="svg-checkbox" data-id="${item.id}"><label for="checkbox-${item.id}"></label>`;
            const info = document.createElement('div');
            info.className = 'item-info';
            info.innerHTML = `<div class="info-row"><span class="info-name" title="${safeName}">${safeName}</span><span class="info-format">${String(item.format || item.type).toUpperCase()}</span></div><div class="info-row"><span class="info-size">媒体流</span><span class="info-type">${item.originalType || item.type}</span></div>`;
            const actions = document.createElement('div');
            actions.className = 'item-actions';
            const mk = (cls, text, title) => { const b=document.createElement('button'); b.className=`action-btn ${cls}`; b.type='button'; b.title=title; b.textContent=text; return b; };
            const pBtn=mk('preview-btn','▶','预览'); const dBtn=mk('download-btn','↓','下载'); const cBtn=mk('copy-btn','⧉','复制链接');
            actions.append(pBtn,dBtn,cBtn);
            div.append(checkbox, previewBox, info, actions);
            previewBox.onclick = () => MediaPreview.show(item);
            pBtn.onclick = () => MediaPreview.show(item);
            dBtn.onclick = () => Downloader.downloadImage(item, item.originalName, item.originalFormat);
            cBtn.onclick = async () => { try { await navigator.clipboard.writeText(item.url); Notification.show('链接已复制','success'); } catch (_) { Notification.show('复制失败','error'); } };
            return div;
        }
        return originalCreate(item);
    };

    // 扩展格式筛选：UI 原有筛选会自动按 originalFormat 工作；为媒体补充 type 关键字搜索。
    const originalFilter = UIRenderer.applyFilterAndSort.bind(UIRenderer);
    UIRenderer.applyFilterAndSort = function(items, searchTerm, sortBy, formatFilter) {
        const result = originalFilter(items, searchTerm, sortBy, formatFilter);
        if (!searchTerm) return result;
        const term = String(searchTerm).toLowerCase();
        const seen = new Set(result.map(x => x.id));
        items.forEach(item => {
            const hay = `${item.type || ''} ${item.mime || ''} ${item.source || ''}`.toLowerCase();
            if (hay.includes(term) && !seen.has(item.id)) result.push(item);
        });
        return result;
    };
})();
