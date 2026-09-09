/**
 * 统一媒体采集模块
 * 图片 / SVG / 视频 / 音频：DOM、懒加载、CSS、Resource Timing、fetch/XHR、动态节点。
 * 重点解决无限滚动、虚拟列表、blob/无扩展名 CDN、懒加载和流媒体请求漏采集。
 */
import { CONFIG } from "../config.js";
import { Utils } from "../utils/index.js";
import { BlobManager } from "../services/BlobManager.js";
import { Deduplication } from "./Deduplication.js";

class ImageCollectorService {
    constructor() {
        this.networkSnifferInstalled = false;
        this.performanceObserver = null;
        this.mutationObserver = null;
        this.pendingResources = new Map();
        this.pageHookInstalled = false;
        this.lastScanAt = 0;
        this.lazyAttrs = [
            'data-src','data-original','data-lazy-src','data-srcset','data-url','data-echo',
            'data-lazy','data-full','data-real-src','data-bg','data-bg-url','data-image','data-img',
            'data-load','data-lazyload','data-original-src','data-highres','data-normal','data-small',
            'data-medium','data-large','data-fallback','data-zoom','data-full-src','data-original-url',
            'data-video','data-video-src','data-audio','data-audio-src','data-file','data-download',
            'data-media','data-poster'
        ];
        this._installNetworkSniffer();
    }

    _isUI(el) { return !!(el && el.closest && el.closest('#_hy-root')); }

    _normalize(url) {
        if (!url || typeof url !== 'string') return '';
        let value = url.trim();
        if (!value || value === '#' || value === 'about:blank' || value.startsWith('javascript:')) return '';
        if (/^url\(/i.test(value)) value = value.replace(/^url\(\s*["']?/, '').replace(/["']?\s*\)$/,'');
        try { return new URL(value, window.location.href).href; } catch (_) { return ''; }
    }

    _extension(url) {
        try {
            const u = new URL(url, location.href);
            const candidates = [u.pathname, u.searchParams.get('filename') || '', u.searchParams.get('file') || '', u.searchParams.get('name') || ''];
            for (const s of candidates) {
                const m = String(s).match(/\.([a-z0-9]{1,10})(?:$|[?#])/i);
                if (m) return m[1].toLowerCase();
            }
        } catch (_) {}
        return '';
    }

    _typeFrom(url, mime = '', hint = '') {
        const m = String(mime || '').toLowerCase().split(';')[0];
        if (m.startsWith('image/')) return 'image';
        if (m.startsWith('video/')) return 'video';
        if (m.startsWith('audio/')) return 'audio';
        const ext = this._extension(url);
        if (['jpg','jpeg','png','gif','bmp','webp','avif','svg','svgz','ico','tif','tiff','heic','heif','jxl'].includes(ext)) return 'image';
        if (['mp4','m4v','webm','mov','mkv','avi','flv','wmv','mpeg','mpg','m2ts','ts','3gp','ogv','m3u8','mpd'].includes(ext)) return 'video';
        if (['mp3','m4a','aac','wav','ogg','oga','opus','flac','wma','aiff','m3u','pls'].includes(ext)) return 'audio';
        const s = (String(url) + ' ' + String(hint)).toLowerCase();
        if (/\.m3u8(?:$|[?#])|(?:^|[/?])m3u8(?:[/?]|$)|videoplayback|manifest(?:\.mpd)?|\.mpd(?:$|[?#])/.test(s)) return 'video';
        if (/(?:^|[/?])(image|img|photo|picture|thumbnail|thumb)(?:[/?_-]|$)/.test(s)) return 'image';
        if (/(?:^|[/?])(audio|music|sound)(?:[/?_-]|$)/.test(s)) return 'audio';
        if (/(?:^|[/?])(video|media|stream)(?:[/?_-]|$)/.test(s)) return 'video';
        return 'other';
    }

    _formatFor(url, type, mime = '') {
        const ext = this._extension(url);
        if (ext) return ext;
        const m = String(mime).toLowerCase().split(';')[0];
        const map = {
            'image/jpeg':'jpg','image/png':'png','image/gif':'gif','image/webp':'webp','image/avif':'avif','image/svg+xml':'svg',
            'video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov','application/vnd.apple.mpegurl':'m3u8','application/x-mpegurl':'m3u8',
            'audio/mpeg':'mp3','audio/mp4':'m4a','audio/wav':'wav','audio/ogg':'ogg','audio/webm':'webm','audio/flac':'flac'
        };
        if (map[m]) return map[m];
        return type === 'image' ? CONFIG.image.defaultImageFormat : type === 'video' ? 'mp4' : type === 'audio' ? 'mp3' : 'bin';
    }

    _name(url, fallback = '资源') {
        try {
            const u = new URL(url, location.href);
            const q = u.searchParams.get('filename') || u.searchParams.get('file') || u.searchParams.get('name');
            if (q) return decodeURIComponent(q).replace(/\.[^.]+$/,'') || q;
            const p = u.pathname.split('/').filter(Boolean);
            if (p.length) return decodeURIComponent(p[p.length - 1]).replace(/\.[^.]+$/,'') || p[p.length - 1];
        } catch (_) {}
        return fallback;
    }

    _postPageResource(url, mime = '', source = 'page-hook') {
        if (!url || url.startsWith('data:')) return;
        const full = this._normalize(url);
        if (!full || full.startsWith('blob:')) return;
        const type = this._typeFrom(full, mime, source);
        if (type === 'other') return;
        this.pendingResources.set(full, { url: full, type, mime, source, time: Date.now() });
    }

    _installPageWorldHook() {
        if (this.pageHookInstalled) return;
        this.pageHookInstalled = true;
        try {
            const id = '__HY_RESOURCE_HOOK__';
            if (window[id]) return;
            window[id] = true;
            const script = document.createElement('script');
            script.textContent = `(() => {
                if (window.__HY_MEDIA_HOOK__) return;
                window.__HY_MEDIA_HOOK__ = true;
                const emit = (url, mime, source) => { try { if (url) window.postMessage({__HY_MEDIA_RESOURCE__:true,url:String(url),mime:String(mime||''),source:String(source||'hook')}, '*'); } catch(e) {} };
                const nativeFetch = window.fetch;
                if (nativeFetch) window.fetch = function(...args) {
                    const input = args[0]; const u = typeof input === 'string' ? input : (input && input.url);
                    return nativeFetch.apply(this,args).then(r => { try { emit(r.url || u, r.headers && r.headers.get('content-type'), 'fetch'); } catch(e) { emit(u,'','fetch'); } return r; }, e => { emit(u,'','fetch-error'); throw e; });
                };
                const XO = XMLHttpRequest.prototype.open, XS = XMLHttpRequest.prototype.send;
                XMLHttpRequest.prototype.open = function(method,url,...rest){ this.__hyUrl = url; return XO.call(this,method,url,...rest); };
                XMLHttpRequest.prototype.send = function(...args){ this.addEventListener('loadend', () => { try { emit(this.responseURL || this.__hyUrl, this.getResponseHeader('content-type') || '', 'xhr'); } catch(e) { emit(this.responseURL || this.__hyUrl,'','xhr'); } }); return XS.apply(this,args); };
                const setSrc = (proto, prop) => { try { const d = Object.getOwnPropertyDescriptor(proto, prop); if (!d || !d.set || !d.get) return; Object.defineProperty(proto, prop, { configurable:true, enumerable:d.enumerable, get:d.get, set(v){ try { emit(v,'',prop); } catch(e){} return d.set.call(this,v); } }); } catch(e){} };
                setSrc(HTMLMediaElement.prototype,'src');
                setSrc(HTMLImageElement.prototype,'src');
                setSrc(HTMLSourceElement.prototype,'src');
            })();`;
            (document.documentElement || document.head || document.body).appendChild(script);
            script.remove();
        } catch (_) {}
        window.addEventListener('message', e => {
            const d = e && e.data;
            if (!d || !d.__HY_MEDIA_RESOURCE__) return;
            this._postPageResource(d.url, d.mime, d.source);
        });
    }

    _installNetworkSniffer() {
        if (this.networkSnifferInstalled) return;
        this.networkSnifferInstalled = true;
        this._installPageWorldHook();
        const consume = entry => {
            if (!entry || !entry.name) return;
            const type = this._typeFrom(entry.name, '', entry.initiatorType || '');
            if (type === 'other') return;
            this.pendingResources.set(this._normalize(entry.name), { url:this._normalize(entry.name), type, mime:'', source:'performance', time:Date.now(), initiatorType:entry.initiatorType || '' });
        };
        try { performance.getEntriesByType('resource').forEach(consume); } catch (_) {}
        try {
            const po = new PerformanceObserver(list => list.getEntries().forEach(consume));
            po.observe({ type:'resource', buffered:true });
            this.performanceObserver = po;
        } catch (_) {
            try { const po = new PerformanceObserver(list => list.getEntries().forEach(consume)); po.observe({entryTypes:['resource']}); this.performanceObserver = po; } catch (_) {}
        }
    }

    startLiveObserver() {
        if (this.mutationObserver || !document.documentElement) return;
        try {
            let timer = null;
            this.mutationObserver = new MutationObserver(mutations => {
                let relevant = false;
                for (const m of mutations) {
                    if (m.type === 'childList' && m.addedNodes.length) { relevant = true; break; }
                    if (m.type === 'attributes') { relevant = true; break; }
                }
                if (!relevant) return;
                clearTimeout(timer);
                timer = setTimeout(() => this.collectAllImages(new Map()).catch(()=>{}), 180);
            });
            this.mutationObserver.observe(document.documentElement, {subtree:true, childList:true, attributes:true, attributeFilter:['src','srcset','poster','style',...this.lazyAttrs]});
        } catch (_) {}
    }

    _parseSrcset(value) {
        if (!value) return [];
        return String(value).split(',').map(x => x.trim().split(/\s+/)[0]).filter(Boolean);
    }

    _push(items, seen, url, type, element = null, mime = '', source = 'dom', extra = {}) {
        const full = this._normalize(url);
        if (!full || full.startsWith('data:') || seen.has(full)) return;
        const mediaType = type === 'other' ? this._typeFrom(full,mime,source) : type;
        if (!['image','video','audio'].includes(mediaType)) return;
        seen.add(full);
        const format = this._formatFor(full, mediaType, mime);
        const base = this._name(full, mediaType === 'video' ? '视频' : mediaType === 'audio' ? '音频' : '图片');
        const id = Utils.generateUniqueId();
        const item = {
            id, url:full, name:Utils.truncateTo4Bytes(base), originalName:base, originalFormat:format,
            format:Utils.truncateTo4Bytes(format), mediaType, type:source, preview:extra.preview || full,
            width:extra.width || element?.naturalWidth || element?.videoWidth || element?.width || '未知',
            height:extra.height || element?.naturalHeight || element?.videoHeight || element?.height || '未知',
            fileSize: extra.fileSize || '未知', element, svgContent: extra.svgContent || '',
            mime:mime || '', source
        };
        items.push(item);
    }

    _scanDOM(items, seen) {
        const addAttrs = (el, source = 'lazy-attr') => {
            for (const attr of this.lazyAttrs) {
                const val = el.getAttribute && el.getAttribute(attr);
                if (!val) continue;
                if (attr.includes('srcset')) this._parseSrcset(val).forEach(u => this._push(items,seen,u,'other',el,'',source));
                else this._push(items,seen,val,'other',el,'',source);
            }
        };
        document.querySelectorAll('img,video,audio,source,object,embed').forEach(el => {
            if (this._isUI(el)) return;
            const tag = el.tagName.toLowerCase();
            const type = tag === 'img' || tag === 'object' || tag === 'embed' ? 'image' : tag === 'video' ? 'video' : tag === 'audio' ? 'audio' : 'other';
            if (el.currentSrc || el.src) this._push(items,seen,el.currentSrc || el.src,type,el,'','element');
            if (el.srcset) this._parseSrcset(el.srcset).forEach(u => this._push(items,seen,u,'image',el,'','srcset'));
            if (el.poster && tag === 'video') this._push(items,seen,el.poster,'image',el,'','video-poster');
            addAttrs(el, 'lazy-attr');
            if (tag === 'video' || tag === 'audio') el.querySelectorAll('source').forEach(s => {
                if (s.src) this._push(items,seen,s.src,type,s,'','source');
                if (s.srcset) this._parseSrcset(s.srcset).forEach(u => this._push(items,seen,u,'image',s,'','source-srcset'));
                addAttrs(s,'source-lazy');
            });
        });
        const selector = this.lazyAttrs.map(a => `[${a}]`).join(',');
        if (selector) document.querySelectorAll(selector).forEach(el => { if (!this._isUI(el)) addAttrs(el); });

        document.querySelectorAll('link[rel="preload"],link[rel="prefetch"]').forEach(el => {
            const as = (el.getAttribute('as') || '').toLowerCase();
            const type = as === 'image' ? 'image' : as === 'video' ? 'video' : as === 'audio' ? 'audio' : 'other';
            if (el.href) this._push(items,seen,el.href,type,el,'','preload');
        });

        document.querySelectorAll('meta[property^="og:image"],meta[name="twitter:image"],meta[property^="og:video"],meta[property^="og:audio"]').forEach(el => {
            const p = (el.getAttribute('property') || el.getAttribute('name') || '').toLowerCase();
            const type = p.includes('video') ? 'video' : p.includes('audio') ? 'audio' : 'image';
            this._push(items,seen,el.content,type,el,'','meta');
        });

        document.querySelectorAll('svg').forEach(svg => {
            if (this._isUI(svg) || svg.closest('img')) return;
            try {
                const content = svg.outerHTML;
                if (!content || content.length < 20) return;
                const url = BlobManager.createManagedBlobUrl(new Blob([content],{type:'image/svg+xml'}));
                this._push(items,seen,url,'image',svg,'image/svg+xml','SVG标签',{svgContent:content,preview:url,width:svg.width?.baseVal?.value || '自适应',height:svg.height?.baseVal?.value || '自适应'});
            } catch (_) {}
        });

        const bgSelector = '[style*="background"], [style*="background-image"]';
        document.querySelectorAll(bgSelector).forEach(el => {
            if (this._isUI(el)) return;
            const value = el.style.backgroundImage || '';
            this._parseCssUrls(value).forEach(u => this._push(items,seen,u,'image',el,'','background'));
        });
    }

    _parseCssUrls(css) {
        const out=[]; const re=/url\(\s*["']?([^"')]+)["']?\s*\)/gi; let m;
        while ((m=re.exec(String(css||'')))) out.push(m[1]);
        return out;
    }

    async _scanStylesheets(items, seen) {
        const urls=[];
        document.querySelectorAll('link[rel="stylesheet"]').forEach(l => { if(l.href) urls.push(l.href); });
        document.querySelectorAll('style').forEach(s => this._parseCssUrls(s.textContent).forEach(u => urls.push(this._normalize(u))));
        for (const cssUrl of urls) {
            if (!cssUrl || !/^https?:/i.test(cssUrl)) continue;
            try {
                const text = await fetch(cssUrl,{credentials:'same-origin'}).then(r => r.ok ? r.text() : '');
                this._parseCssUrls(text).forEach(u => this._push(items,seen,u,'image',null,'','css'));
            } catch (_) {}
        }
    }

    _consumeNetwork(items, seen) {
        try { performance.getEntriesByType('resource').forEach(e => {
            const full=this._normalize(e.name); if(!full) return;
            const type=this._typeFrom(full,'',e.initiatorType || '');
            if(type !== 'other') this._push(items,seen,full,type,null,'','network');
        }); } catch (_) {}
        for (const r of this.pendingResources.values()) this._push(items,seen,r.url,r.type,null,r.mime,r.source);
    }

    async collectAllImages(imageSignatureMap) {
        this._installNetworkSniffer();
        this.startLiveObserver();
        const now=Date.now();
        // 避免 mutation 高频重入，但手动/滚动检测始终允许。
        this.lastScanAt=now;
        const items=[]; const seen=new Set();
        this._scanDOM(items,seen);
        this._consumeNetwork(items,seen);
        await this._scanStylesheets(items,seen);
        return Deduplication.checkAndRemoveDuplicates(items,imageSignatureMap);
    }

    destroy() {
        try { this.performanceObserver?.disconnect(); } catch (_) {}
        try { this.mutationObserver?.disconnect(); } catch (_) {}
        this.performanceObserver=null; this.mutationObserver=null;
    }

    static getFileExtension(url) {
        try { const m=new URL(url,location.href).pathname.match(/\.([a-z0-9]{1,10})$/i); return m ? m[1].toLowerCase() : ''; } catch (_) { return ''; }
    }
    static truncateTo4Bytes(str,maxLength=CONFIG.image.infoTruncateLength) {
        if(!str) return ''; let r='',n=0;
        for(const ch of String(str)){ const b=ch.codePointAt(0)<=0x7f?1:ch.codePointAt(0)<=0x7ff?2:3; if(n+b>maxLength)return r+'...'; r+=ch;n+=b; }
        return r;
    }
    static getImageName(url,alt) { if(alt && alt.trim()) return alt; try { const p=new URL(url,location.href).pathname.split('/').filter(Boolean); return p.length ? decodeURIComponent(p[p.length-1]).replace(/\.[^.]+$/,'') : '未命名资源'; } catch (_) { return '未命名资源'; } }
}

export const ImageCollector = new ImageCollectorService();
