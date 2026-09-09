/** DOM 构建模块 */
import { CONFIG } from "../config.js";
import { IconSystem } from "../icons.js";
import { StyleManager } from "../styles.js";

class DOMBuilderService {
    constructor(){this.modal=null;this.previewModal=null;this.batchProgressOverlay=null;}
    _icon(name){
        if(name==='camera') return IconSystem.getIconString('collector');
        return IconSystem.getIconString(name);
    }
    _style(name){
        const map={fab:'fab',modal:'modal',actionBar:'actionBar',searchBar:'searchBar',imageList:'imageList',previewModal:'previewModal',batchProgress:'batchProgress',overlay:'overlay'};
        return StyleManager.getStyle(map[name]||name);
    }
    _addStyle(name){const css=this._style(name);if(css)GM_addStyle(css);}
    createFabButton(){
        const c=document.createElement('div');c.id='rainbowFabContainer';c.className='rainbow-fab-container';
        const b=document.createElement('button');b.className='rainbow-fab';b.title='网页资源嗅探器';
        const inner=document.createElement('div');inner.className='rainbow-fab-inner';const icon=document.createElement('div');icon.className='rainbow-fab-icon';icon.innerHTML=this._icon('camera');
        const badge=document.createElement('span');badge.className='rainbow-fab-badge';badge.textContent='0';badge.style.display='none';inner.appendChild(icon);b.appendChild(inner);b.appendChild(badge);c.appendChild(b);document.body.appendChild(c);this._addStyle('fab');return{container:c,fab:b,icon,badge};
    }
    createMainModal(){
        if(this.modal)return this.modal;const modal=document.createElement('div');modal.id='svgSnifferModal';modal.className='svg-sniffer-modal';
        const formats=[...(CONFIG.image.supportFormats||[]),...(CONFIG.media?.supportFormats||[])];
        modal.innerHTML=`<div class="modal-header"><h2>${this._icon('camera')} 网页资源嗅探器 Pro</h2><button class="close-btn" title="关闭">${this._icon('close')}</button></div>
        <div class="action-bar"><div class="select-all-control"><input type="checkbox" id="selectAll"><label for="selectAll">全选</label><span id="imageCount">0</span> 个资源</div><div class="action-buttons"><button class="action-btn batch-download-btn" id="batchDownloadBtn">${this._icon('download')} 批量下载</button><button class="action-btn copy-btn" id="batchCopyBtn">${this._icon('copy')} 复制链接</button><button class="action-btn invert-select-btn" id="invertSelectBtn">${this._icon('invert')}</button><div class="batch-mode-toggle"><button id="batchModeZip" class="toggle-btn active">ZIP</button><button id="batchModeSingle" class="toggle-btn">单文件</button></div></div></div>
        <div class="search-bar"><div class="search-input-wrapper">${this._icon('search')}<input type="text" id="searchInput" placeholder="搜索资源名称、URL、图片/视频/音频..."></div><select id="sortSelect"><option value="default">默认排序</option><option value="name-asc">名称升序</option><option value="name-desc">名称降序</option><option value="format">按格式</option><option value="type">按媒体类型</option></select><select id="formatFilter"><option value="all">所有格式</option>${formats.filter((v,i,a)=>a.indexOf(v)===i).map(f=>`<option value="${f}">${String(f).toUpperCase()}</option>`).join('')}</select><div class="view-toggle"><button id="listViewBtn" class="toggle-btn active">${this._icon('listView')}</button><button id="gridViewBtn" class="toggle-btn">${this._icon('gridView')}</button></div><div class="dedupe-toggle"><input type="checkbox" id="dedupeToggle" ${CONFIG.deduplication.enabled?'checked':''}><label for="dedupeToggle">${this._icon('dedupe')}</label></div></div>
        <div class="modal-content"><div id="svgList" class="image-list"></div></div>`;
        document.body.appendChild(modal);this._addStyle('modal');this._addStyle('actionBar');this._addStyle('searchBar');this._addStyle('imageList');return modal;
    }
    createPreviewModal(){
        if(this.previewModal)return this.previewModal;const modal=document.createElement('div');modal.id='imagePreviewModal';modal.className='image-preview-modal';
        modal.innerHTML=`<div class="preview-header"><div class="preview-info"><span id="previewTitle" class="preview-title"></span><span id="previewSubtitle" class="preview-subtitle"></span></div><button id="previewClose" class="close-btn">${this._icon('close')}</button></div><div class="preview-stage" id="previewStage"><div class="preview-img-wrapper" id="previewImgWrapper"></div><div class="preview-nav prev" id="previewPrev">${this._icon('arrowLeft')}</div><div class="preview-nav next" id="previewNext">${this._icon('arrowRight')}</div><div class="preview-zoom-indicator" id="previewZoomIndicator"></div></div><div class="preview-footer"><div class="preview-toolbar"><button id="previewZoomOut">${this._icon('zoomOut')}</button><button id="previewZoomIn">${this._icon('zoomIn')}</button><button id="previewRotate">${this._icon('rotate')}</button><button id="previewReset">${this._icon('reset')}</button></div><div class="preview-meta"><span id="previewInfoFormat">-</span><span id="previewInfoSize">-</span><span id="previewInfoFilesize">-</span><span id="previewCounter">1 / 1</span></div><div class="preview-actions"><button id="previewDownload" class="action-btn">${this._icon('download')} 下载</button><button id="previewCopy" class="action-btn">${this._icon('copy')} 复制</button></div></div>`;
        document.body.appendChild(modal);this._addStyle('previewModal');return modal;
    }
    createBatchProgressOverlay(){if(this.batchProgressOverlay)return this.batchProgressOverlay;const o=document.createElement('div');o.id='batchProgressOverlay';o.className='batch-progress-overlay';o.innerHTML='<div class="progress-card"><h3>批量下载进度</h3><div class="progress-bar-container"><div class="progress-bar" id="batchProgressBar"></div></div><p>已完成: <span id="batchProgressCurrent">0</span> / <span id="batchProgressTotal">0</span></p><p>成功: <span id="batchProgressOk">0</span> 失败: <span id="batchProgressFail">0</span></p><p id="batchProgressStatus">正在准备...</p><button id="batchProgressCancel" class="action-btn cancel-btn">取消下载</button></div>';document.body.appendChild(o);this.batchProgressOverlay=o;this._addStyle('batchProgress');return o;}
    createOverlay(){const o=document.createElement('div');o.className='rainbow-overlay';document.body.appendChild(o);this._addStyle('overlay');return o;}
}
export const DOMBuilder=new DOMBuilderService();
