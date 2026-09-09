import { Downloader } from './Downloader.js';

class MediaPreviewService {
    constructor() { this.overlay = null; }
    init() {
        if (this.overlay) return;
        const o = document.createElement('div');
        o.id = '_rs_media_preview';
        o.style.cssText = 'display:none;position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.92);align-items:center;justify-content:center;padding:24px;box-sizing:border-box';
        o.innerHTML = '<button type="button" data-rs-close style="position:absolute;right:16px;top:12px;width:42px;height:42px;border:0;border-radius:50%;background:rgba(255,255,255,.16);color:#fff;font-size:26px">×</button><div data-rs-stage style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px"><div data-rs-title style="max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:14px"></div><div data-rs-player style="max-width:96%;max-height:82%;display:flex;align-items:center;justify-content:center"></div><button type="button" data-rs-download style="border:0;border-radius:8px;padding:9px 16px;background:#fff;color:#222">下载资源</button></div>';
        document.documentElement.appendChild(o);
        o.querySelector('[data-rs-close]').onclick = () => this.hide();
        o.onclick = e => { if (e.target === o) this.hide(); };
        o.querySelector('[data-rs-download]').onclick = () => { if (this.item) Downloader.downloadImage(this.item, this.item.originalName, this.item.originalFormat); };
        this.overlay = o;
    }
    show(item) {
        this.init(); this.item = item;
        const p = this.overlay.querySelector('[data-rs-player]');
        const title = this.overlay.querySelector('[data-rs-title]');
        p.innerHTML = '';
        title.textContent = `${item.type || '媒体'} · ${item.originalName || item.url}`;
        const el = document.createElement(item.type === '音频' ? 'audio' : 'video');
        el.controls = true; el.autoplay = false; el.preload = 'metadata'; el.style.cssText = 'max-width:92vw;max-height:76vh;width:auto;height:auto';
        try { el.referrerPolicy = 'no-referrer'; } catch (_) {}
        el.src = item.url;
        p.appendChild(el);
        this.overlay.style.display = 'flex';
    }
    hide() { if (this.overlay) { this.overlay.style.display = 'none'; const p=this.overlay.querySelector('[data-rs-player]'); if(p) p.innerHTML=''; } }
}
export const MediaPreview = new MediaPreviewService();
