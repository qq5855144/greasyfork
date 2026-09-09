/**
 * 多媒体资源采集器
 * 重点：视频/音频经常通过 fetch/XHR + MSE + blob 播放，不能只看 video.src。
 * 捕获 DOM、Resource Timing、fetch、XHR、媒体事件以及 HLS/DASH 清单中的地址。
 * 不修改响应内容，只观察请求；不会绕过 DRM/加密授权。
 */
import { Utils } from "../utils/index.js";

class MediaCollectorService {
    constructor() {
        this.items = new Map();
        this.installed = false;
        this.manifestSeen = new Set();
        this.pendingNotify = null;
        this.onResource = null;
        this.mime = new Map([
            ['video/mp4','video'], ['video/webm','video'], ['video/ogg','video'], ['video/quicktime','video'],
            ['video/x-m4v','video'], ['video/x-msvideo','video'], ['video/mpeg','video'], ['video/mp2t','video'],
            ['audio/mpeg','audio'], ['audio/mp3','audio'], ['audio/mp4','audio'], ['audio/aac','audio'],
            ['audio/ogg','audio'], ['audio/wav','audio'], ['audio/x-wav','audio'], ['audio/flac','audio'],
            ['audio/webm','audio'], ['application/vnd.apple.mpegurl','video'], ['application/x-mpegurl','video'],
            ['application/dash+xml','video']
        ]);
    }

    init(onResource) {
        if (this.installed) return;
        this.installed = true;
        this.onResource = onResource;
        this._scanDom();
        this._installPerformanceObserver();
        this._hookFetch();
        this._hookXHR();
        document.addEventListener('loadedmetadata', e => this._mediaElement(e.target), true);
        document.addEventListener('play', e => this._mediaElement(e.target), true);
        document.addEventListener('canplay', e => this._mediaElement(e.target), true);
        try {
            new MutationObserver(() => this._scheduleScan()).observe(document.documentElement, {
                subtree: true, childList: true, attributes: true,
                attributeFilter: ['src','srcset','poster','preload','data-src','data-url','data-video','data-audio']
            });
        } catch (_) {}
        setInterval(() => this._scanPerformance(), 2000);
    }

    _scheduleScan() {
        clearTimeout(this.pendingNotify);
        this.pendingNotify = setTimeout(() => this._scanDom(), 180);
    }

    _scanDom() {
        try {
            document.querySelectorAll('video,audio,video source,audio source').forEach(el => {
                ['src','data-src','data-url','data-video','data-audio'].forEach(a => {
                    const u = el.getAttribute(a);
                    if (u) this._add(u, null, el.tagName.toLowerCase() === 'audio' ? 'audio' : 'video', 'dom');
                });
                if (el.currentSrc) this._add(el.currentSrc, null, el.tagName.toLowerCase() === 'audio' ? 'audio' : 'video', 'dom');
                if (el.src) this._add(el.src, null, el.tagName.toLowerCase() === 'audio' ? 'audio' : 'video', 'dom');
            });
            document.querySelectorAll('video[poster]').forEach(v => this._add(v.poster, 'image/*', 'image', 'poster'));
            document.querySelectorAll('link[rel="preload"][as="video"],link[rel="preload"][as="audio"]').forEach(l => this._add(l.href, null, l.getAttribute('as'), 'preload'));
        } catch (_) {}
    }

    _installPerformanceObserver() {
        try {
            performance.getEntriesByType('resource').forEach(e => this._performanceEntry(e));
            const po = new PerformanceObserver(list => list.getEntries().forEach(e => this._performanceEntry(e)));
            po.observe({ type: 'resource', buffered: true });
        } catch (_) {}
    }

    _scanPerformance() {
        try { performance.getEntriesByType('resource').forEach(e => this._performanceEntry(e)); } catch (_) {}
    }

    _performanceEntry(e) {
        if (!e || !e.name || e.name.startsWith('blob:') || e.name.startsWith('data:')) return;
        const i = String(e.initiatorType || '').toLowerCase();
        if (i === 'video' || i === 'audio' || i === 'media') this._add(e.name, null, i === 'audio' ? 'audio' : 'video', 'performance');
        else if (this._looksMedia(e.name)) this._add(e.name, null, this._guessType(e.name), 'performance');
    }

    _hookFetch() {
        const original = window.fetch;
        if (typeof original !== 'function' || original.__resourceSnifferWrapped) return;
        const self = this;
        const wrapped = function(input, init) {
            let url = '';
            try { url = typeof input === 'string' ? input : input?.url || ''; } catch (_) {}
            const p = original.apply(this, arguments);
            return p.then(response => {
                try {
                    const full = new URL(url || response.url, location.href).href;
                    const ct = response.headers.get('content-type') || '';
                    const type = self._mimeType(ct) || self._guessType(full);
                    if (type) self._add(full, ct, type, 'fetch');
                    if (type === 'video' && self._isManifest(ct, full)) self._parseManifestResponse(response.clone(), full);
                } catch (_) {}
                return response;
            });
        };
        wrapped.__resourceSnifferWrapped = true;
        wrapped.__resourceSnifferOriginal = original;
        try { window.fetch = wrapped; } catch (_) {}
    }

    _hookXHR() {
        const open = XMLHttpRequest.prototype.open;
        const send = XMLHttpRequest.prototype.send;
        if (open.__resourceSnifferWrapped) return;
        const self = this;
        XMLHttpRequest.prototype.open = function(method, url) {
            this.__rsUrl = url;
            return open.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function() {
            this.addEventListener('readystatechange', function() {
                if (this.readyState !== 4) return;
                try {
                    const full = new URL(this.responseURL || this.__rsUrl || '', location.href).href;
                    const ct = this.getResponseHeader('content-type') || '';
                    const type = self._mimeType(ct) || self._guessType(full);
                    if (type) self._add(full, ct, type, 'xhr');
                    if (type === 'video' && self._isManifest(ct, full) && typeof this.responseText === 'string') self._parseManifestText(this.responseText, full);
                } catch (_) {}
            }, { once: true });
            return send.apply(this, arguments);
        };
        XMLHttpRequest.prototype.open.__resourceSnifferWrapped = true;
    }

    async _parseManifestResponse(response, baseUrl) {
        try { this._parseManifestText(await response.text(), baseUrl); } catch (_) {}
    }

    _parseManifestText(text, baseUrl) {
        if (!text || this.manifestSeen.has(baseUrl)) return;
        this.manifestSeen.add(baseUrl);
        const isHls = /#EXTM3U|#EXTINF|#EXT-X-STREAM-INF/i.test(text);
        const isDash = /<MPD[\s>]/i.test(text);
        if (!isHls && !isDash) return;
        if (isHls) {
            text.split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#')).forEach(u => {
                try { this._add(new URL(u, baseUrl).href, null, 'video', 'hls'); } catch (_) {}
            });
        }
        if (isDash) {
            const re = /(?:media|initialization|BaseURL)\s*=\s*["']([^"']+)["']|<BaseURL[^>]*>([^<]+)<\/BaseURL>/gi;
            let m;
            while ((m = re.exec(text))) {
                try { this._add(new URL(m[1] || m[2], baseUrl).href, null, 'video', 'dash'); } catch (_) {}
            }
        }
    }

    _isManifest(ct, url) { return /mpegurl|dash\+xml/i.test(ct || '') || /\.(m3u8|mpd)(?:[?#]|$)/i.test(url); }
    _mimeType(ct) {
        const key = String(ct || '').split(';')[0].trim().toLowerCase();
        return this.mime.get(key) || (key.startsWith('video/') ? 'video' : key.startsWith('audio/') ? 'audio' : '');
    }
    _guessType(url) {
        if (/\.(mp4|webm|mkv|mov|m4v|avi|flv|ts|m3u8|mpd)(?:[?#]|$)/i.test(url) || /videoplayback|video/i.test(url)) return 'video';
        if (/\.(mp3|m4a|aac|ogg|opus|wav|flac|wma)(?:[?#]|$)/i.test(url) || /audio/i.test(url)) return 'audio';
        return '';
    }
    _looksMedia(url) { return !!this._guessType(url); }

    _mediaElement(el) {
        if (!el || !['VIDEO','AUDIO'].includes(el.tagName)) return;
        const type = el.tagName === 'AUDIO' ? 'audio' : 'video';
        if (el.currentSrc) this._add(el.currentSrc, null, type, 'element');
        if (el.src) this._add(el.src, null, type, 'element');
        el.querySelectorAll('source').forEach(s => { if (s.src) this._add(s.src, null, type, 'element'); });
    }

    _add(url, mime, type, source) {
        if (!url || type === 'image') return;
        try {
            const full = new URL(url, location.href).href;
            if (full.startsWith('blob:') || full.startsWith('data:')) return;
            const key = `${type}|${full}`;
            if (this.items.has(key)) return;
            const ext = this._extension(full, mime, type);
            const item = {
                id: Utils.generateUniqueId(), url: full, preview: full,
                originalName: this._name(full, type), name: this._name(full, type),
                originalFormat: ext, format: ext || (type === 'video' ? 'video' : 'audio'),
                originalType: source || type, type: type === 'video' ? '视频' : '音频',
                width: '媒体', height: '媒体', fileSize: '未知', mime: mime || '', source
            };
            this.items.set(key, item);
            if (this.onResource) this.onResource(item);
        } catch (_) {}
    }

    _extension(url, mime, type) {
        const m = String(mime || '').match(/(?:video|audio)\/([a-z0-9.+-]+)/i);
        if (m) return m[1].replace('mpeg','mp3').replace('x-m4a','m4a');
        const q = url.match(/\.([a-z0-9]{1,8})(?:[?#]|$)/i);
        if (q) return q[1].toLowerCase();
        if (/m3u8/i.test(url)) return 'm3u8';
        if (/mpd/i.test(url)) return 'mpd';
        return type;
    }
    _name(url, type) {
        try {
            const u = new URL(url);
            const p = u.pathname.split('/').filter(Boolean).pop();
            return (p || `${type}-${Date.now()}`).replace(/\.[^.]+$/, '') || `${type}-${Date.now()}`;
        } catch (_) { return `${type}-${Date.now()}`; }
    }
}

export const MediaCollector = new MediaCollectorService();
