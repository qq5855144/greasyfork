/** 页面上下文媒体请求桥：让 userscript 能观察页面自己的 fetch/XHR。 */
class MediaPageHookService {
    constructor(){this.installed=false;this.listener=null;}
    init(listener){
        if(this.installed)return;this.installed=true;this.listener=listener;
        window.addEventListener('message',e=>{const d=e&&e.data;if(d&&d.__RS_PAGE_MEDIA__&&this.listener)this.listener(d)});
        try{
            const s=document.createElement('script');
            s.textContent=`(()=>{if(window.__RS_PAGE_MEDIA_HOOK__)return;window.__RS_PAGE_MEDIA_HOOK__=1;const emit=(url,mime,source)=>{try{if(url)window.postMessage({__RS_PAGE_MEDIA__:1,url:String(url),mime:String(mime||''),source:String(source||'page')},'*')}catch(e){}};const f=window.fetch;if(f){window.fetch=function(){let u='';try{const x=arguments[0];u=typeof x==='string'?x:x&&x.url||''}catch(e){}return f.apply(this,arguments).then(r=>{try{emit(r.url||u,r.headers.get('content-type')||'','fetch')}catch(e){emit(u,'','fetch')}return r})}};const o=XMLHttpRequest.prototype.open,x=XMLHttpRequest.prototype.send;XMLHttpRequest.prototype.open=function(m,u){this.__rsPageUrl=u;return o.apply(this,arguments)};XMLHttpRequest.prototype.send=function(){this.addEventListener('loadend',()=>{try{emit(this.responseURL||this.__rsPageUrl,this.getResponseHeader('content-type')||'','xhr')}catch(e){}},{once:true});return x.apply(this,arguments)};})();`;
            (document.documentElement||document.head||document.body).appendChild(s);s.remove();
        }catch(_){}
    }
}
export const MediaPageHook=new MediaPageHookService();
