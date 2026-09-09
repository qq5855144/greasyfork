/** 全局配置 v5.0：图片 + 视频 + 音频持续嗅探 */
const CONFIG = {
    ui:{buttonSize:36,zIndex:99999,positionOffset:20,panelSafeMargin:'16px',panelMinSize:'380px',fixedFontSize:'11px',touchDelay:300,clickDetectDelay:900,scrollCheckInterval:350},
    glass:{opacity:.75,blur:'20px',border:'rgba(255,255,255,0.25)',panelBg:'rgba(255,255,255,0.72)',panelBgDark:'rgba(30,30,40,0.88)'},
    colors:{rainbow:['#ff6b6b','#ff9f43','#feca57','#54a0ff','#5f27cd','#ff6fb7','#00d2d3','#1dd1a1'],primary:'#ff6b6b',success:'#1dd1a1',warning:'#feca57',error:'#ff6b6b',info:'#54a0ff',textPrimary:'#333333',textSecondary:'#666666',textLight:'#ffffff',bgLight:'#f8f9fa',bgDark:'#1e1e28'},
    image:{supportFormats:['jpg','jpeg','png','gif','webp','svg','bmp','tiff','ico','avif','jxl','heic','heif'],maxPreviewSize:48,loadTimeout:5000,infoTruncateLength:4,defaultImageFormat:'png'},
    media:{supportFormats:['mp4','webm','mov','mkv','avi','flv','wmv','mpeg','mpg','m2ts','ts','3gp','ogv','m3u8','mpd','mp3','m4a','aac','wav','ogg','oga','opus','flac','wma','aiff'],sniffNetwork:true,hookFetch:true,hookXHR:true,scanCss:true,scanBlob:true,continuousScanInterval:2000},
    preview:{maxWidth:'94vw',maxHeight:'88vh',background:'rgba(0,0,0,0.88)',closeButtonSize:'40px',headerHeight:'52px',footerHeight:'60px',sidePadding:'64px'},
    batchDownload:{useZip:true,zipFilenamePrefix:'resources',concurrentDownloads:6,retryCount:2,retryDelay:800},
    deduplication:{enabled:true,similarityThreshold:.95,checkContent:true,maxFileSizeForCheck:5*1024*1024,urlNormalization:true},
    blob:{maxBlobUrlCount:100,cleanupNotification:true},
    clickDetection:{selectors:['.load-more','.load-btn','.next-page','.load-more-btn','[data-action="load-more"]','[class*="load"]','[class*="more"]','.pagination-next','.next-btn','.load-additional']},
    fonts:{family:"'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif",sizes:{xs:'10px',sm:'11px',base:'12px',lg:'13px',xl:'14px'}},
    animation:{duration:{'fast':'.15s','normal':'.25s','slow':'.35s'},easing:{'ease':'ease','easeIn':'ease-in','easeOut':'ease-out','easeInOut':'ease-in-out','spring':'cubic-bezier(.34,1.56,.64,1)'}},
    spacing:{xs:'4px',sm:'8px',md:'12px',lg:'16px',xl:'20px',xxl:'24px'},
    radius:{sm:'4px',md:'8px',lg:'12px',xl:'16px',full:'50%'},
    shadow:{sm:'0 2px 4px rgba(0,0,0,.1)',md:'0 4px 8px rgba(0,0,0,.15)',lg:'0 8px 16px rgba(0,0,0,.2)',xl:'0 12px 24px rgba(0,0,0,.25)',inner:'inset 0 0 20px rgba(255,255,255,.08)'},
    notification:{duration:3000,colors:{info:'rgba(52,152,219,.8)',success:'rgba(39,174,96,.8)',warning:'rgba(243,156,18,.8)',error:'rgba(231,76,60,.8)'}},
    storage:{prefix:'imgCollector_',positionKey:'radarPosition',settingsKey:'settings',historyKey:'downloadHistory'},
    features:{enableDragFab:true,enablePreview:true,enableBatchDownload:true,enableDeduplication:true,enableDynamicLoading:true,enableNotifications:true,enableMediaSniffing:true},
    get:function(path,defaultValue){
        if(defaultValue===undefined)defaultValue=undefined;
        var keys=path.split('.'),value=this;
        for(var i=0;i<keys.length;i++){value=value&&value[keys[i]];if(value===undefined)return defaultValue;}
        return value;
    },
    set:function(path,value){
        var keys=path.split('.'),lastKey=keys.pop(),obj=this;
        for(var i=0;i<keys.length;i++){if(!(keys[i] in obj))obj[keys[i]]={};obj=obj[keys[i]];}
        obj[lastKey]=value;
    },
    merge:function(newConfig){Object.assign(this,newConfig)}
};
if(typeof module!=='undefined'&&module.exports)module.exports=CONFIG;
export { CONFIG };