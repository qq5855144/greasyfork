/** 统一资源预览：图片 / SVG / 视频 / 音频 */
import { CONFIG } from "../config.js";
import { Utils } from "../utils/index.js";
import { Downloader } from "./Downloader.js";
import { Notification } from "../services/Notification.js";

class PreviewModalService {
 constructor(){this.currentItem=null;this.currentIndex=-1;this.imageList=[];this.modal=null;this.escapeHandler=null;this.transform={scale:1,rotate:0,x:0,y:0};this.wheelTimer=null;}
 init(){
  this.modal=document.getElementById('imagePreviewModal');if(!this.modal)return;
  this.modal.querySelector('#previewClose')?.addEventListener('click',()=>this.hide());
  this.modal.addEventListener('click',e=>{if(e.target===this.modal)this.hide()});
  document.getElementById('previewDownload')?.addEventListener('click',()=>this.currentItem&&Downloader.downloadImage(this.currentItem));
  document.getElementById('previewCopy')?.addEventListener('click',()=>{if(this.currentItem)navigator.clipboard?.writeText(this.currentItem.url).then(()=>Notification.show('链接已复制','success')).catch(()=>Notification.show('复制失败','error'));});
  document.getElementById('previewPrev')?.addEventListener('click',e=>{e.stopPropagation();this.navigate(-1)});
  document.getElementById('previewNext')?.addEventListener('click',e=>{e.stopPropagation();this.navigate(1)});
  document.getElementById('previewZoomIn')?.addEventListener('click',e=>{e.stopPropagation();this.zoom(1.25)});
  document.getElementById('previewZoomOut')?.addEventListener('click',e=>{e.stopPropagation();this.zoom(1/1.25)});
  document.getElementById('previewRotate')?.addEventListener('click',e=>{e.stopPropagation();this.rotate(90)});
  document.getElementById('previewReset')?.addEventListener('click',e=>{e.stopPropagation();this.resetTransform()});
  document.getElementById('previewStage')?.addEventListener('wheel',e=>{e.preventDefault();this.zoom(e.deltaY<0?1.12:1/1.12)},{passive:false});
  this.modal.addEventListener('keydown',e=>{if(e.key==='Escape')this.hide()});
 }
 zoom(f){this.transform.scale=Math.min(8,Math.max(.2,this.transform.scale*f));this._applyTransform();this._indicator()}
 rotate(d){this.transform.rotate=(this.transform.rotate+d)%360;this._applyTransform();this._indicator()}
 resetTransform(){this.transform={scale:1,rotate:0,x:0,y:0};this._applyTransform();}
 _applyTransform(){const w=document.getElementById('previewImgWrapper');if(w){const t=this.transform;w.style.transform=`translate(${t.x}px,${t.y}px) rotate(${t.rotate}deg) scale(${t.scale})`;}}
 _indicator(){const i=document.getElementById('previewZoomIndicator');if(!i)return;i.textContent=`${Math.round(this.transform.scale*100)}% · ${this.transform.rotate}°`;i.classList.add('show');clearTimeout(this.wheelTimer);this.wheelTimer=setTimeout(()=>i.classList.remove('show'),1000)}
 navigate(d){if(!this.imageList.length)return;const n=this.currentIndex+d;if(n<0||n>=this.imageList.length)return;this.show(this.imageList[n],this.imageList,n)}
 _updateNav(){const p=document.getElementById('previewPrev'),n=document.getElementById('previewNext'),c=document.getElementById('previewCounter');if(!p||!n||!c)return;p.classList.toggle('disabled',this.currentIndex<=0);n.classList.toggle('disabled',this.currentIndex>=this.imageList.length-1);c.style.display=this.imageList.length>1?'block':'none';c.textContent=`${this.currentIndex+1} / ${this.imageList.length}`}
 _updateInfo(item){const f=document.getElementById('previewInfoFormat'),s=document.getElementById('previewInfoSize'),z=document.getElementById('previewInfoFilesize');if(f)f.textContent=String(item.originalFormat||item.format||'-').toUpperCase();if(s)s.textContent=item.width&&item.height&&item.width!=='未知'?`${item.width} × ${item.height}`:'-';if(z)z.textContent=item.fileSize&&item.fileSize!=='未知'?Utils.formatFileSize(item.fileSize):'-';}
 show(item,list,index){
  if(!this.modal)return;this.currentItem=item;this.imageList=list||[item];this.currentIndex=index??0;
  const title=document.getElementById('previewTitle');if(title)title.textContent=`${item.originalName||item.name||'resource'}.${item.originalFormat||item.format||'bin'}`;
  const sub=document.getElementById('previewSubtitle');if(sub)sub.textContent=`${item.mediaType||item.type||'resource'} · ${item.url||''}`;
  const w=document.getElementById('previewImgWrapper');if(!w)return;w.innerHTML='';this.resetTransform();this.modal.style.display='flex';this._updateNav();this._updateInfo(item);
  const src=item.preview||item.url;
  if(item.svgContent){const box=document.createElement('div');box.className='preview-svg';box.innerHTML=Utils.ensureSvgNamespace(item.svgContent);w.appendChild(box);}
  else if(item.mediaType==='video'){
   const v=document.createElement('video');v.className='preview-image';v.src=src;v.controls=true;v.autoplay=false;v.loop=false;v.playsInline=true;v.preload='metadata';v.style.maxWidth='100%';v.style.maxHeight='78vh';w.appendChild(v);
   v.onloadedmetadata=()=>{const s=document.getElementById('previewInfoSize');if(s)s.textContent=`${v.videoWidth} × ${v.videoHeight}`};
  } else if(item.mediaType==='audio'){
   const box=document.createElement('div');box.style.cssText='width:min(90vw,640px);padding:40px;text-align:center;font-size:56px';box.innerHTML='🎵';const a=document.createElement('audio');a.src=src;a.controls=true;a.preload='metadata';a.style.cssText='width:100%;margin-top:24px';box.appendChild(a);w.appendChild(box);
  } else {
   const img=document.createElement('img');img.className='preview-image';img.alt=item.originalName||item.name||'';img.referrerPolicy='no-referrer';img.src=src;img.onerror=()=>{img.removeAttribute('referrerpolicy');img.src=src};w.appendChild(img);
   img.onload=()=>{if(item.width==='未知'){const s=document.getElementById('previewInfoSize');if(s)s.textContent=`${img.naturalWidth} × ${img.naturalHeight}`}};
  }
  this.escapeHandler=e=>{if(e.key==='Escape')this.hide();else if(e.key==='ArrowLeft')this.navigate(-1);else if(e.key==='ArrowRight')this.navigate(1);};document.addEventListener('keydown',this.escapeHandler);
 }
 hide(){if(this.modal)this.modal.style.display='none';this.currentItem=null;this.imageList=[];this.currentIndex=-1;if(this.escapeHandler){document.removeEventListener('keydown',this.escapeHandler);this.escapeHandler=null;}}
}
export const PreviewModal=new PreviewModalService();
