/**
 * 通用资源下载模块：图片 / SVG / 视频 / 音频。
 * 对 m3u8/mpd 只下载清单文件，不伪装成已经完成的视频文件。
 */
import { CONFIG } from "../config.js";
import { Utils } from "../utils/index.js";
import { Notification } from "../services/Notification.js";

class DownloaderService {
    constructor(){this._cancelFlag=false;}
    _saveAs(blob,filename){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=filename;a.style.display='none';document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(u);},500);}
    _extension(item){
        const e=String(item?.originalFormat||item?.format||'').toLowerCase().replace(/^\./,'');
        if(e) return e;
        if(item?.mediaType==='video')return 'mp4';
        if(item?.mediaType==='audio')return 'mp3';
        return 'bin';
    }
    _filename(item){
        let base=String(item?.originalName||item?.name||'resource').trim()||'resource';
        base=Utils.sanitizeFilename(base);
        const ext=this._extension(item);
        if(!/\.[a-z0-9]{1,10}$/i.test(base))base+='.'+ext;
        return base;
    }
    _mime(item){
        if(item?.mime)return item.mime;
        const ext=this._extension(item);
        const map={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp',avif:'image/avif',svg:'image/svg+xml',mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime',m3u8:'application/vnd.apple.mpegurl',mpd:'application/dash+xml',mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac',wav:'audio/wav',ogg:'audio/ogg',opus:'audio/ogg',flac:'audio/flac'};
        return map[ext]||'application/octet-stream';
    }
    _fetchBlob(url){return new Promise((resolve,reject)=>{
        if(typeof GM_xmlhttpRequest==='function'&&!/^blob:|^data:/i.test(url)){
            GM_xmlhttpRequest({method:'GET',url,responseType:'blob',timeout:30000,onload:r=>r.status>=200&&r.status<300?resolve(r.response instanceof Blob?r.response:new Blob([r.response])):reject(new Error('HTTP '+r.status)),onerror:()=>reject(new Error('网络错误')),ontimeout:()=>reject(new Error('请求超时'))});
        }else fetch(url,{credentials:'include'}).then(r=>r.ok?r.blob():Promise.reject(new Error('HTTP '+r.status))).then(resolve).catch(reject);
    });}
    async _fetchRetry(url){let err;for(let i=0;i<=Number(CONFIG.batchDownload.retryCount||2);i++){try{return await this._fetchBlob(url);}catch(e){err=e;if(i<Number(CONFIG.batchDownload.retryCount||2))await new Promise(r=>setTimeout(r,Number(CONFIG.batchDownload.retryDelay||500)*(i+1)));}}throw err;}
    async downloadImage(item,originalName,originalFormat){
        const filename=this._filename({...item,originalName:originalName||item.originalName,originalFormat:originalFormat||item.originalFormat});
        if(item.svgContent&&this._extension(item)==='svg'){this._saveAs(new Blob([Utils.ensureSvgNamespace(item.svgContent)],{type:'image/svg+xml'}),filename);if(CONFIG.features.enableNotifications)Notification.show('下载成功: '+filename,'success');return;}
        try{
            if(typeof GM_download==='function'&&!/^blob:|^data:/i.test(item.url)){
                await new Promise((resolve,reject)=>GM_download({url:item.url,name:filename,mimetype:this._mime(item),saveAs:false,onload:resolve,onerror:e=>reject(e),ontimeout:()=>reject(new Error('timeout'))}));
            }else this._saveAs(await this._fetchRetry(item.url),filename);
            if(CONFIG.features.enableNotifications)Notification.show('下载成功: '+filename,'success');
        }catch(e){
            try{this._saveAs(await this._fetchRetry(item.url),filename);if(CONFIG.features.enableNotifications)Notification.show('下载成功: '+filename,'success');}
            catch(err){console.error('资源下载失败',item.url,err);if(CONFIG.features.enableNotifications)Notification.show('下载失败: '+filename,'error');throw err;}
        }
    }
    _unique(set,name){if(!set.has(name)){set.add(name);return name;}const p=name.lastIndexOf('.'),stem=p>0?name.slice(0,p):name,ext=p>0?name.slice(p):'';let n=1,c;do{c=stem+'_'+n++ +ext;}while(set.has(c));set.add(c);return c;}
    async downloadMultipleImages(items){
        if(!items?.length)return;this._cancelFlag=false;
        const zipMode=CONFIG.batchDownload.useZip&&typeof JSZip!=='undefined';
        if(zipMode){const zip=new JSZip(),used=new Set();let ok=0,fail=0;for(const item of items){if(this._cancelFlag)break;try{const blob=item.svgContent&&this._extension(item)==='svg'?new Blob([Utils.ensureSvgNamespace(item.svgContent)],{type:'image/svg+xml'}):await this._fetchRetry(item.url);zip.file(this._unique(used,this._filename(item)),blob);ok++;}catch(e){fail++;console.warn('批量下载失败',item.url,e);}}if(!this._cancelFlag&&ok) this._saveAs(await zip.generateAsync({type:'blob'}),`${CONFIG.batchDownload.zipFilenamePrefix||'resources'}_${Date.now()}.zip`);if(CONFIG.features.enableNotifications)Notification.show(`批量下载完成：成功 ${ok}，失败 ${fail}`,'success');return;}
        let ok=0,fail=0;for(const item of items){if(this._cancelFlag)break;try{await this.downloadImage(item);ok++;}catch(_){fail++;}await new Promise(r=>setTimeout(r,60));}if(CONFIG.features.enableNotifications)Notification.show(`批量下载完成：成功 ${ok}，失败 ${fail}`,'success');
    }
    cancelBatch(){this._cancelFlag=true;if(CONFIG.features.enableNotifications)Notification.show('批量下载已取消','warning');}
}
export const Downloader=new DownloaderService();
