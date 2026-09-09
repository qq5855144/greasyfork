/**
 * 资源列表 UI：图片 / SVG / 视频 / 音频统一展示。
 */
import { CONFIG } from "../config.js";
import { Utils } from "../utils/index.js";
import { Icons } from "../icons.js";
import { PreviewModal } from "./PreviewModal.js";
import { Downloader } from "./Downloader.js";
import { Clipboard } from "./Clipboard.js";
import { Notification } from "../services/Notification.js";

class UIRendererService {
    constructor() { this.imageItemCache = new Map(); }

    renderImageList(items, imageItemCache) {
        const list=document.getElementById('svgList'); if(!list)return;
        list.innerHTML=''; this.imageItemCache=imageItemCache;
        if(!items.length){ list.innerHTML='<div class="loading" style="text-align:center;padding:20px;color:#888;">没有找到资源</div>'; return; }
        const frag=document.createDocumentFragment(); items.forEach(i=>frag.appendChild(this.createImageItemElement(i))); list.appendChild(frag);
    }

    _escape(value){ const d=document.createElement('div'); d.textContent=String(value??''); return d.innerHTML; }

    _preview(item){
        const src=this._escape(item.preview||item.url);
        if(item.format==='svg' && item.svgContent) return `<div class="svg-content-preview">${Utils.ensureSvgNamespace(item.svgContent)}</div>`;
        if(item.mediaType==='video') return `<video src="${src}" preload="metadata" muted playsinline controls></video>`;
        if(item.mediaType==='audio') return `<div style="padding:12px 8px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;font-size:28px;">🎵<audio src="${src}" preload="metadata" controls style="width:100%;max-width:260px"></audio></div>`;
        return `<img src="${src}" alt="${this._escape(item.name)}" loading="lazy">`;
    }

    createImageItemElement(item){
        const div=document.createElement('div'); div.className='svg-item'; div.dataset.id=item.id;
        const checkboxId=`checkbox-${item.id}`;
        div.innerHTML=`
          <div class="item-checkbox"><input type="checkbox" id="${checkboxId}" class="svg-checkbox" data-id="${item.id}"><label for="${checkboxId}"></label></div>
          <div class="item-preview" data-id="${item.id}">${this._preview(item)}</div>
          <div class="item-info"><div class="info-row"><span class="info-name" title="${this._escape(item.originalName||item.name)}">${this._escape(item.name)}</span><span class="info-format">${this._escape(String(item.format).toUpperCase())}</span></div>
          <div class="info-row"><span class="info-size">${this._escape(String(item.width))} × ${this._escape(String(item.height))}</span><span class="info-type">${this._escape(item.type||item.mediaType||'资源')}</span></div></div>
          <div class="item-actions"><button class="action-btn preview-btn" data-id="${item.id}" title="预览">${Icons.eye}</button><button class="action-btn download-btn" data-id="${item.id}" title="下载">${Icons.download}</button><button class="action-btn copy-btn" data-id="${item.id}" title="复制链接">${Icons.copy}</button></div>`;

        const getItem=e=>this.imageItemCache.get(e.currentTarget.dataset.id);
        div.querySelector('.item-preview').addEventListener('click',e=>{const x=getItem(e);if(x)PreviewModal.show(x,Array.from(this.imageItemCache.values()),Array.from(this.imageItemCache.values()).indexOf(x));});
        div.querySelector('.preview-btn').addEventListener('click',e=>{const x=getItem(e);if(x)PreviewModal.show(x,Array.from(this.imageItemCache.values()),Array.from(this.imageItemCache.values()).indexOf(x));});
        div.querySelector('.download-btn').addEventListener('click',e=>{const x=getItem(e);if(x)Downloader.downloadImage(x,x.originalName,x.originalFormat);});
        div.querySelector('.copy-btn').addEventListener('click',e=>{const x=getItem(e);if(x)Clipboard.copyUrls([x]);});
        return div;
    }

    applyFilterAndSort(items,searchTerm,sortBy,formatFilter){
        let filtered=[...items];
        if(searchTerm){const t=searchTerm.toLowerCase();filtered=filtered.filter(i=>(i.originalName||i.name||'').toLowerCase().includes(t)||(i.url||'').toLowerCase().includes(t)||(i.mediaType||'').toLowerCase().includes(t));}
        if(formatFilter&&formatFilter!=='all') filtered=filtered.filter(i=>(i.originalFormat||i.format||'').toLowerCase()===formatFilter.toLowerCase());
        switch(sortBy){
            case 'name-asc':filtered.sort((a,b)=>(a.originalName||a.name||'').localeCompare(b.originalName||b.name||''));break;
            case 'name-desc':filtered.sort((a,b)=>(b.originalName||b.name||'').localeCompare(a.originalName||a.name||''));break;
            case 'format':filtered.sort((a,b)=>(a.format||'').localeCompare(b.format||''));break;
            case 'type':filtered.sort((a,b)=>(a.mediaType||a.type||'').localeCompare(b.mediaType||b.type||''));break;
        }
        return filtered;
    }
}
export const UIRenderer=new UIRendererService();
