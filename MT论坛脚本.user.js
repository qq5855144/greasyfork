// ==UserScript==
// @name         MT论坛手机版网页端增强
// @namespace    https://bbs.binmt.cc/
// @version      1.0.5
// @description   侧边栏注入 9项功能独立开关 
// @match        https://bbs.binmt.cc/*
// @match        http://bbs.binmt.cc/*
// @connect      img.binmt.cc
// @connect      https://img.binmt.cc
// @connect      icdn.binmt.cc
// @connect      https://icdn.binmt.cc
// @connect      *
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
'use strict';
var S = {
  get: function(k,d){ try{var v=(typeof GM_getValue==='function')?GM_getValue(k,null):null; if(v==null)v=localStorage.getItem('mt_'+k); return (v==null)?d:v;}catch(e){return d;} },
  set: function(k,v){ try{if(typeof GM_setValue==='function')GM_setValue(k,v);}catch(e){} try{localStorage.setItem('mt_'+k,v);}catch(e){} }
};
var FEATS=[
 {key:'autoSign',name:'自动签到',desc:'打开网页自动签到'},
 {key:'urlLink',name:'URL超链接',desc:'链接自动转超链接'},
 {key:'copyCode',name:'代码复制按钮',desc:'代码块一键复制'},
 {key:'autoPage',name:'评论自动上下页',desc:'自动加载上下页评论'},
 {key:'guideNext',name:'导读自动下一页',desc:'滚动到底自动加载'},
 {key:'autoReply',name:'隐藏帖自动回复',desc:'自动回复并解锁'},
 {key:'hideOnly',name:'只看隐藏贴',desc:'仅显示含隐藏内容帖',def:false},
 {key:'personalBlack',name:'个人小黑屋屏蔽',desc:'按uid隐藏帖子',def:false},
 {key:'ubbBar',name:'UBB快捷输入栏',desc:'论坛输入时显示UBB代码按钮'}
];
function defOf(k){ for(var i=0;i<FEATS.length;i++){ if(FEATS[i].key===k)return FEATS[i].def===false?false:true; } return true; }
function on(k){ var d=defOf(k)?'true':'false'; return S.get('feat_'+k,d)!=='false'; }

// ========== 侧边栏面板 + 移除导航 ==========
function injectPanelStyle(){
  if(document.getElementById('mt-feat-style'))return;
  var st=document.createElement('style'); st.id='mt-feat-style';
  st.textContent='#mt-feat-panel{padding:14px 18px 16px;border-top:1px solid #eee;}'+
    '.mt-feat-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;line-height:1.5;}'+
    '.mt-feat-row .nm{font-size:14px;color:#333;font-weight:600;}'+
    '.mt-switch{position:relative;display:inline-block;width:44px;height:24px;flex:none;margin-left:12px;}'+
    '.mt-switch input{opacity:0;width:0;height:0;}'+
    '.mt-slider{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:#ccc;border-radius:24px;transition:.2s;}'+
    '.mt-slider:before{content:"";position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.2s;}'+
    '.mt-switch input:checked + .mt-slider{background:#3a76f0;}'+
    '.mt-switch input:checked + .mt-slider:before{transform:translateX(20px);}'+
    '.mt-nav-icon{color:#5a5a5a;display:block;flex:none;}'+
    '.comiis_left_Touch a .styli_tit{display:flex;align-items:center;justify-content:center;width:20px;height:20px;margin-right:8px;color:#5a5a5a;}'+
    '.comiis_left_Touch a .flex{font-size:14px;color:#333;line-height:20px;}';
  (document.head||document.documentElement).appendChild(st);
}
function buildPanel(){
  var box=document.querySelector('.comiis_sidenv_box'); if(!box)return;
  var ul=box.querySelector('UL.comiis_left_Touch.bdew');
  // 注意：不要改动 UL 的 flex / height 等布局属性。
  // 移动版模板依赖这些属性排列原生导航项，擅自覆盖会使其塌陷/不可见。
  // 只需把功能面板插入到 UL 之前即可，导航项顺序交给 reorderNav()。
  // 侧边栏内容变多后需要可滚动：只给容器补 overflow-y，不碰 flex。
  ensureScroll(box);
  // 注入功能开关面板（仅一次）
  if(!document.getElementById('mt-feat-panel')){
    injectPanelStyle();
    var p=document.createElement('div'); p.id='mt-feat-panel';
    FEATS.forEach(function(f){
      var row=document.createElement('div'); row.className='mt-feat-row';
      var nm=document.createElement('span'); nm.className='nm'; nm.textContent=f.name;
      var sw=document.createElement('label'); sw.className='mt-switch';
      var inp=document.createElement('input'); inp.type='checkbox'; inp.checked=on(f.key); inp.setAttribute('data-key',f.key);
      var sl2=document.createElement('span'); sl2.className='mt-slider';
      sw.appendChild(inp); sw.appendChild(sl2);
      inp.addEventListener('change',function(){ S.set('feat_'+this.getAttribute('data-key'), this.checked?'true':'false'); location.reload(); });
      row.appendChild(nm); row.appendChild(sw); p.appendChild(row);
    });
    if(ul){ ul.parentNode.insertBefore(p,ul); } else { box.appendChild(p); }
  }
  // 把原有导航项整体移动到功能开关面板之后（可重复执行，幂等）
  reorderNav();
}

// 让侧边栏可滚动：只补 overflow-y，不改 flex。
// 侧边栏是 fixed 抽屉，滚动容器通常是 .comiis_sidenv_box 自身。
// 诊断发现：box 的 clientHeight=0（height:100% 百分比高度依赖父级，但它是 fixed 直接挂 body，
// 父级无确定高度 → 塌成 0），导致 ov:auto 也无内容可滚。需给它一个确定视口高度。
function ensureScroll(box){
  if(!box)return;
  var vh = window.innerHeight || document.documentElement.clientHeight || 0;
  if(!vh)vh=660; // 兜底视口高度
  var dvh = (window.innerHeight) ? (window.innerHeight) : vh;
  function patch(el){
    if(!el)return;
    var cs=getComputedStyle(el);
    var fixed=(cs.position==='fixed'||cs.position==='absolute');
    // 1) 抽屉根节点：强制一个确定视口高度 + 可滚动
    if(el===box){
      // 用 dvh 兜底，规避移动端地址栏的 100vh 偏差
      el.style.height = '100dvh';
      el.style.minHeight = '100dvh';
      el.style.maxHeight = '100dvh';
      el.style.overflowY = 'auto';
      el.style.webkitOverflowScrolling = 'touch';
      el.style.touchAction = 'pan-y';
      return;
    }
    // 2) 沿父链：凡是 fixed/absolute 或“有确定高度却 overflow 受限”的层，一律放开纵向滚动
    var hasH = (cs.height && cs.height!=='auto' && cs.height!=='');
    if(fixed || hasH){
      if(cs.overflowY==='hidden' || cs.overflowY==='clip' || cs.overflowY==='visible'){
        el.style.overflowY='auto';
        el.style.webkitOverflowScrolling='touch';
      }
    }
  }
  // 先处理 box 自身
  patch(box);
  // 再遍历父链（body/html 之前），把中间被 overflow:hidden 卡住的层都放开
  var p=box.parentElement;
  var guard=0;
  while(p && p!==document.body && p!==document.documentElement && guard<12){
    patch(p);
    p=p.parentElement; guard++;
  }
  // 兜底：确保 UL 自身不被裁剪
  var ul=box.querySelector('UL.comiis_left_Touch.bdew, UL.bdew');
  if(ul){
    ul.style.overflowY='visible';
    ul.style.maxHeight='none';
  }
}
// 将侧边栏原导航项移动到功能开关面板之后；若某些基础导航项缺失（标准浏览器下可能未渲染），
// 则按已知 URL 重建它们，插到功能开关面板之后。可重复、幂等。
function reorderNav(){
  if(window.__mtReorderBusy)return; window.__mtReorderBusy=true;
  try{
    var box=document.querySelector('.comiis_sidenv_box'); if(!box)return;
    var pnl=document.getElementById('mt-feat-panel'); if(!pnl)return;
    var ul=box.querySelector('UL.comiis_left_Touch.bdew'); if(!ul)return;
    // 面板必须与 UL 同级；确保面板紧邻于 UL 之前（幂等，只在顺序不对时移动一次）
    if(pnl.parentNode===ul.parentNode && pnl.nextElementSibling!==ul){
      ul.parentNode.insertBefore(ul, pnl.nextSibling);
    }
    // 重建缺失的基础导航项
    ensureNavItems(ul);
  }finally{ window.__mtReorderBusy=false; }
}

// 预期的基础导航项（文字 + 兜底 URL + 图标 SVG path）。文字用于去重匹配。
var NAV_ITEMS=[
  {t:'首页', u:'forum.php?mod=guide&view=hot&mobile=2', i:'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z'},
  {t:'社区', u:'forum.php?forumlist=1', i:'M4 4h16v2H4V4zm0 6h16v2H4v-2zm0 6h10v2H4v-2z'},
  {t:'导读', u:'forum.php?mod=guide&view=newthread&index=1', i:'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z'},
  {t:'休闲灌水', u:'forum.php?mod=forumdisplay&fid=50&mobile=2', i:'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 5c1.38 0 2.5 1.12 2.5 2.5S13.38 12 12 12s-2.5-1.12-2.5-2.5S10.62 7 12 7zm5 9.5c0 1.1-4.48 2-5 2s-5-.9-5-2c0-1.66 2.24-3 5-3s5 1.34 5 3z'},
  {t:'签到', u:'plugin.php?id=k_misign:sign&mobile=2', i:'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'},
  {t:'排行', u:'misc.php?mod=ranklist&type=member&view=credit&mobile=2', i:'M3 17h6v-6H3v6zm4-4v2H5v-2h2zM11 21h6v-10h-6v10zm2-8v6h-2v-6h2zM19 13h2v8h-2v-8z'},
  {t:'标签', u:'misc.php?mod=tag&mobile=2', i:'M21.41 11.58l-9-9A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 .59 1.42l9 9A2 2 0 0 0 13 22a2 2 0 0 0 1.41-.59l7-7A2 2 0 0 0 22 13a2 2 0 0 0-.59-1.42zM6.5 8A1.5 1.5 0 1 1 8 6.5 1.5 1.5 0 0 1 6.5 8z'},
  {t:'搜索', u:'search.php?mobile=2', i:'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.49 4.49 0 0 1 9.5 14z'},
  {t:'访问推广', u:'home.php?mod=spacecp&ac=promotion', i:'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z'}
];
function navIcon(path){
  var s=document.createElementNS('http://www.w3.org/2000/svg','svg');
  s.setAttribute('viewBox','0 0 24 24'); s.setAttribute('class','mt-nav-icon');
  s.setAttribute('width','20'); s.setAttribute('height','20');
  var p=document.createElementNS('http://www.w3.org/2000/svg','path');
  p.setAttribute('d',path); p.setAttribute('fill','currentColor');
  s.appendChild(p); return s;
}
function ensureNavItems(ul){
  if(!ul)return;
  var box=ul.closest('.comiis_sidenv_box')||document;
  // 收集侧边栏当前所有导航项的文字（含其它容器里的），用于去重
  var existing=[];
  var allAs=box.querySelectorAll('.comiis_sidenv_box a, .comiis_left_Touch a, .sidenv_li a');
  for(var i=0;i<allAs.length;i++){ existing.push((allAs[i].textContent||'').trim()); }
  function has(t){ for(var i=0;i<existing.length;i++){ if(existing[i]===t||existing[i].indexOf(t)>=0)return true; } return false; }
  for(var k=0;k<NAV_ITEMS.length;k++){
    var it=NAV_ITEMS[k];
    if(has(it.t))continue; // 已存在，跳过
    var li=document.createElement('li'); li.className='comiis_left_Touch';
    var a=document.createElement('a'); a.href=it.u;
    var icon=document.createElement('div'); icon.className='styli_tit f_c';
    if(it.i){ icon.appendChild(navIcon(it.i)); } else { var ii=document.createElement('i'); ii.className='comiis_font'; icon.appendChild(ii); }
    var flex=document.createElement('div'); flex.className='flex'; flex.textContent=it.t;
    a.appendChild(icon); a.appendChild(flex); li.appendChild(a);
    ul.appendChild(li);
    existing.push(it.t);
  }
}

// ========== 工具 ==========
function GET(u,cb){
  try{ if(typeof GM_xmlhttpRequest==='function'){ GM_xmlhttpRequest({method:'GET',url:u,onload:function(r){cb(r.status,r.responseText);},onerror:function(){cb(0,'');}}); return; } }catch(e){}
  fetch(u,{credentials:'include'}).then(function(r){return r.text();}).then(function(t){cb(200,t);}).catch(function(){cb(0,'');});
}

// ========== URL 超链接 ==========
function cleanUrl(raw){ if(!raw)return null; var s=String(raw)
  .replace(/\uff1a/g,':').replace(/\uff0f/g,'/')
  .replace(/[\u2e80-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\ufeff-\uffef\s]+/g,'');
  if(!/^https?:\/\//i.test(s))return null;
  if(!/^https?:\/\/[a-z0-9\-]+(\.[a-z0-9\-]+)+/i.test(s))return null; return s; }
function urlInjectStyle(){ if(document.getElementById('mt-url-style'))return;
  var st=document.createElement('style'); st.id='mt-url-style';
  st.textContent='a.mt-url-local{color:#1e88e5 !important;text-decoration:underline !important;word-break:break-all;}';
  (document.head||document.documentElement).appendChild(st); }
function makeClickable(root){
  try{ var box=root||document;
    var sel='a[href],.blockcode,pre,code,.postmessage,.comiis_postmessage,.message,.t_f,.plc,#postlist,.comiis_pcontent,.comiis_box,.article,.content,body';
    var nodes=box.querySelectorAll(sel); var list=[]; for(var i=0;i<nodes.length;i++)list.push(nodes[i]);
    if(!list.length&&document.body)list=[document.body];
    var re=/(^|[^a-z0-9])(h[\s\S]{0,3}?t[\s\S]{0,3}?t[\s\S]{0,3}?p[\s\S]{0,3}?s?[\s\S]{0,3}?[：:]\/\/[^\s"'<>()（）【】\[\]]+)/gi;
    for(var k=0;k<list.length;k++){ var c=list[k]; if(!c)continue;
      if(c.nodeName==='SCRIPT'||c.nodeName==='STYLE')continue;
      var it=document.createTreeWalker(c,4,null); var texts=[],node;
      while((node=it.nextNode())){ var p=node.parentNode; if(!p)continue;
        if(p.nodeName==='SCRIPT'||p.nodeName==='STYLE'||p.nodeName==='TEXTAREA')continue;
        if(p.getAttribute&&p.getAttribute('data-mt-url')==='1')continue;
        if(p.classList&&p.classList.contains('mt-url-local'))continue;
        var nv=node.nodeValue||''; if(nv.indexOf('http')<0&&nv.indexOf('ht')<0)continue;
        re.lastIndex=0; if(!re.test(nv))continue; texts.push(node); }
      for(var t=0;t<texts.length;t++){ var tn=texts[t]; var txt=tn.nodeValue||'';
        re.lastIndex=0; if(!re.test(txt))continue; re.lastIndex=0;
        var frag=document.createDocumentFragment(); var last=0,m;
        while((m=re.exec(txt))!==null){ var pre=m[1]||''; var url=cleanUrl(m[2]);
          if(!url){ var e0=m.index+m[0].length; if(e0>last)frag.appendChild(document.createTextNode(txt.slice(last,e0))); last=e0; if(m.index===re.lastIndex)re.lastIndex++; continue; }
          var at=m.index+pre.length; if(at>last)frag.appendChild(document.createTextNode(txt.slice(last,at)));
          var a=document.createElement('a'); a.setAttribute('href',url); a.setAttribute('target','_blank'); a.setAttribute('data-mt-url','1');
          a.textContent=url; a.className='mt-url-local'; frag.appendChild(a); last=m.index+m[0].length; if(m.index===re.lastIndex)re.lastIndex++; }
        if(last<txt.length)frag.appendChild(document.createTextNode(txt.slice(last)));
        if(tn.parentNode)tn.parentNode.replaceChild(frag,tn); } } }catch(e){}
}
function urlLink(){ if(!on('urlLink'))return; if(window.__urlDone)return; window.__urlDone=true;
  urlInjectStyle(); makeClickable(document);
  var mo=new MutationObserver(function(){ clearTimeout(window.__urlT); window.__urlT=setTimeout(function(){makeClickable(document);},500); });
  mo.observe(document.documentElement,{childList:true,subtree:true}); }

// ========== 代码复制按钮 ==========
function copyInjectStyle(){ if(document.getElementById('mt-copy-style'))return;
  var st=document.createElement('style'); st.id='mt-copy-style';
  st.textContent='.mt-copy-bar{display:block !important;text-align:right !important;margin:4px 0 2px 0 !important;}'+
    '.mt-copy-btn{display:inline-block;padding:3px 12px;border-radius:4px;background:#1e88e5;color:#fff;font-size:12px;line-height:18px;cursor:pointer;white-space:nowrap;}';
  (document.head||document.documentElement).appendChild(st); }
function copyText(t){ var ok=false;
  try{ var ta=document.createElement('textarea'); ta.value=t; ta.setAttribute('readonly','1');
    ta.style.cssText='position:fixed;left:-9999px;top:0;opacity:0;'; document.body.appendChild(ta);
    ta.select(); ta.setSelectionRange(0,t.length); ok=document.execCommand('copy'); document.body.removeChild(ta); }catch(e){ok=false;}
  try{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(t); ok=true; } }catch(e){}
  return ok; }
function getCodeText(el){ var clone=el.cloneNode(true);
  var j=clone.querySelectorAll('.mt-copy-bar,.mt-copy-btn'); for(var i=j.length-1;i>=0;i--){if(j[i].parentNode)j[i].parentNode.removeChild(j[i]);}
  var s=''; try{s=clone.textContent||'';}catch(e){}
  s=s.replace(/\u00a0/g,' ');
  return s.split('\n').filter(function(L){var x=L.replace(/\s/g,'');return !/^(本帖隐藏的内容|隐藏的内容|回复可见|回复后可见|登录后可见|登录可见|购买后可见|以下内容需要回复才能看到)[:：]?$/.test(x);}).join('\n'); }
function collectBlocks(){ var picked=[];
  function push(b){ if(!b||!b.nodeName)return; if(b.nodeName==='SCRIPT'||b.nodeName==='STYLE')return;
    if(b.getAttribute&&b.getAttribute('data-mt-copy')==='1')return;
    if(b.nodeName==='BLOCKQUOTE'||(b.closest&&b.closest('blockquote')))return;
    for(var k=0;k<picked.length;k++){ if(picked[k]!==b&&(picked[k].contains(b)||b.contains(picked[k])))return; } picked.push(b); }
  var sel='pre,.blockcode,.comiis_blockcode,.comiis_code,.codeblock';
  var blocks=document.querySelectorAll(sel);
  for(var i=0;i<blocks.length;i++){ var b=blocks[i];
    if(b.nodeName==='CODE'){ var pp=b.parentNode,hp=false; while(pp&&pp!==document.body){if(pp.nodeName==='PRE'){hp=true;break;}pp=pp.parentNode;} if(hp)continue; } push(b); }
  var inner=[]; for(var a=0;a<picked.length;a++){ var o=picked[a],hi=false;
    for(var b2=0;b2<picked.length;b2++){ if(a===b2)continue; if(o.contains(picked[b2])){hi=true;break;} } if(!hi)inner.push(o); }
  return inner; }
function makeButtonFor(block){ if(block.getAttribute('data-mt-copy')==='1')return; block.setAttribute('data-mt-copy','1');
  var bar=document.createElement('div'); bar.className='mt-copy-bar'; bar.style.cssText='text-align:right;margin:4px 0 2px 0;line-height:1;';
  var btn=document.createElement('span'); btn.textContent='复制'; btn.className='mt-copy-btn';
  btn.onclick=function(ev){ if(ev&&ev.preventDefault)ev.preventDefault(); if(ev&&ev.stopPropagation)ev.stopPropagation();
    var ok=copyText(getCodeText(block)); btn.textContent=ok?'已复制':'复制失败'; btn.style.background=ok?'#43a047':'#e53935';
    setTimeout(function(){btn.textContent='复制';btn.style.background='#1e88e5';},1500); };
  bar.appendChild(btn); if(block.parentNode)block.parentNode.insertBefore(bar,block); }
function addCopyButtons(){ try{ var p=collectBlocks(); for(var n=0;n<p.length;n++)makeButtonFor(p[n]); }catch(e){} }
function copyCode(){ if(!on('copyCode'))return; if(window.__copyDone)return; window.__copyDone=true;
  copyInjectStyle(); addCopyButtons();
  var mo=new MutationObserver(function(){ clearTimeout(window.__copyT); window.__copyT=setTimeout(addCopyButtons,500); });
  mo.observe(document.documentElement,{childList:true,subtree:true}); }

// ========== 评论自动上下页 ==========
function autoPage(){ if(!on('autoPage'))return; if(window.__autoPage)return;
  if(!/thread-/.test(location.pathname))return; window.__autoPage=true;
  var req=false;
  function nextUrl(){ var ns=document.querySelectorAll('a.bg_f.b_ok'); var n=ns[ns.length-1]; return n?n.getAttribute('href')||'':''; }
  function loadNext(){ if(req)return; var u=nextUrl(); if(!u||u.indexOf('javascript')>=0)return; req=true;
    fetch(u,{credentials:'include'}).then(function(r){return r.text();}).then(function(html){ req=false;
      var tmp=document.createElement('div'); tmp.innerHTML=html;
      var items=tmp.querySelectorAll('.comiis_postli.comiis_list_readimgs.nfqsqi');
      var target=document.querySelector('.comiis_postlist.kqide');
      var bs=tmp.querySelector('.comiis_multi_box.bg_f.b_t.b_b.mb10');
      if(bs){ var bd=document.querySelector('.comiis_multi_box.bg_f.b_t.b_b.mb10'); if(bd)bd.replaceWith(bs); }
      if(target&&items.length){ for(var i=0;i<items.length;i++)target.appendChild(items[i]); }
    }).catch(function(){req=false;}); }
  window.addEventListener('scroll',function(){ var d=document.documentElement; if(d.scrollHeight-d.scrollTop-d.clientHeight<500)loadNext(); },{passive:true});
}

// ========== 导读自动下一页 ==========
function guideNext(){ if(!on('guideNext'))return; if(!/mod=guide/.test(location.href))return; if(window.__guideNext)return; window.__guideNext=1;
  var LIST='.comiis_forumlist',ITEM='li.forumlist_li',DIST=900,st={page:1,loading:false,ended:false};
  function curList(){return document.querySelector(LIST);}
  function curView(){try{return new URLSearchParams(location.search).get('view')||'newthread';}catch(e){return 'newthread';}}
  function nextPageUrl(){ return 'https://bbs.binmt.cc/forum.php?mod=guide&view='+curView()+'&page='+(st.page+1); }
  function loadNext(){ if(st.loading||st.ended)return; var d=curList(); if(!d)return; st.loading=true;
    fetch(nextPageUrl(),{credentials:'include'}).then(function(r){return r.text();}).then(function(html){ st.loading=false;
      var tmp=document.createElement('div'); tmp.innerHTML=html; var src=tmp.querySelector(LIST);
      var items=src?src.querySelectorAll(ITEM):[]; var d2=curList(); if(!d2||!items.length){st.ended=true;return;}
      var seen={}; var ex=d2.querySelectorAll(ITEM); for(var i=0;i<ex.length;i++){var a=ex[i].querySelector('a[href*="thread-"],a[href*="tid="]'); if(a)seen[a.href]=1;}
      var appended=0; for(var j=0;j<items.length;j++){ var a=items[j].querySelector('a[href*="thread-"],a[href*="tid="]'); var key=a?a.href:('i'+j);
        if(key&&seen[key])continue; if(key)seen[key]=1; d2.appendChild(items[j]); appended++; }
      st.page++; if(appended===0)st.ended=true;
    }).catch(function(){st.loading=false;st.ended=true;}); }
  var raf=null; function check(){ if(raf)return; raf=requestAnimationFrame(function(){ raf=null;
    var d=document.documentElement; if((d.scrollHeight-d.scrollTop-d.clientHeight)<DIST)loadNext(); }); }
  window.addEventListener('scroll',check,{passive:true});
  setTimeout(function(){ var d=document.documentElement; if(curList()&&d.scrollHeight<=d.clientHeight+DIST)loadNext(); },1200);
}

// ========== 自动签到 ==========
function getFormhash(){ try{
  var inp=document.querySelector('input[name="formhash"]'); if(inp&&inp.value)return inp.value;
  var m=document.body.innerHTML.match(/formhash["']?\s*[:=]\s*["']?([a-f0-9]{8})/i); if(m)return m[1];
}catch(e){} return null; }
function autoSign(){ if(!on('autoSign'))return;
  var t=new Date(); var day=t.getFullYear()+'-'+(t.getMonth()+1)+'-'+t.getDate();
  if(S.get('signDate','')===day)return;
  var fh=getFormhash(); if(!fh)return;
  var u='https://bbs.binmt.cc/plugin.php?id=k_misign:sign&operation=qiandao&format=text&formhash='+fh;
  GET(u,function(code,body){ var text=''; var m=(body||'').match(/\[CDATA\[([\s\S]*?)\]\]/); text=m?m[1]:(body||'');
    if(code===200&&/今日已签|已签到/.test(text)){ S.set('signDate',day); } }); }

// ========== 隐藏帖自动回复 ==========
function autoReply(){ if(!on('autoReply'))return; if(window.__autoReply)return; window.__autoReply=true;
  if(!/thread-\d+/.test(location.pathname)&&!/mod=viewthread/i.test(location.search))return;
  var TEXTS=['看看隐藏','感谢分享','论坛有你更精彩','看看是什么','谢谢分享'];
  var RIK='mtar_reply_index', DP='mtar_done_v10_', LRK='mtar_last_reply', FM=16000, PK='mtar_pending', RCM={};
  function ts(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function ri(){ var i=parseInt(localStorage.getItem(RIK)||'0',10); if(isNaN(i)||i<0)i=0; return i%TEXTS.length; }
  function rt(){ return TEXTS[ri()]; }
  function adv(){ localStorage.setItem(RIK,String((ri()+1)%TEXTS.length)); }
  function uid(){ try{if(typeof discuz_uid!=='undefined'&&discuz_uid)return String(discuz_uid);}catch(e){}
    var m=document.documentElement.innerHTML.match(/discuz_uid\s*=\s*'(\d+)'/); return m?m[1]:''; }
  function tid(){ var m=location.pathname.match(/thread-(\d+)-/); if(m)return m[1];
    try{var q=new URLSearchParams(location.search); if(q.get('tid'))return q.get('tid');}catch(e){} return ''; }
  function hasLocked(){ var s=document.querySelectorAll('.comiis_quote,.locked,div.locked,.t_f,.postmessage,.comiis_postli');
    for(var i=0;i<s.length;i++){ var t=s[i].textContent||''; if(/查看本帖隐藏内容请回复|回复本帖即可查看/.test(t))return true; } return false; }
  function lockedPids(){ var o={}; var ns=document.querySelectorAll('.comiis_quote');
    for(var i=0;i<ns.length;i++){ var t=ns[i].textContent||''; if(!/查看本帖隐藏内容请回复|回复本帖即可查看/.test(t))continue;
      var el=ns[i]; for(var j=0;j<12&&el;j++){ var id=el.id||''; if(/^(pid|post_)\d+$/.test(id)){ var p=id.replace(/\D/g,''); if(p)o[p]=1; break; } el=el.parentElement; } }
    return Object.keys(o); }
  function hasMine(u){ if(!u)return false; var cs=document.querySelectorAll('div[id^="pid"],div[id^="post_"],div.comiis_postli');
    for(var i=0;i<cs.length;i++){ var c=cs[i]; if(!c.querySelector)continue; var a=c.querySelector('a[href*="space-uid-"],a[href*="uid="]');
      if(!a)continue; var h=a.getAttribute('href')||''; var m=h.match(/space-uid-(\d+)/)||h.match(/[?&]uid=(\d+)/); if(m&&m[1]===u)return true; } return false; }
  function isMobile(){ return !!document.getElementById('needmessage')&&!!document.getElementById('fastpostform'); }
  function done(t){ return !!localStorage.getItem(DP+ts()+'_'+t); }
  function markDone(t){ localStorage.setItem(DP+ts()+'_'+t,'1'); }
  function pend(t){ return sessionStorage.getItem(PK+'_'+t)==='1'; }
  function setPend(t,o){ if(o)sessionStorage.setItem(PK+'_'+t,'1'); else sessionStorage.removeItem(PK+'_'+t); }
  function submit(){ var f=document.getElementById('fastpostform'),mb=document.getElementById('needmessage');
    if(!f||!mb)return{ok:false};
    var act=(f.getAttribute('action')||'').replace(/&amp;/g,'&'); var url=act+'&handlekey=fastpost&loc=1&inajax=1';
    var fd=new URLSearchParams(); fd.set('formhash',f.elements.formhash?f.elements.formhash.value:'');
    if(f.elements.noticeauthor)fd.set('noticeauthor',f.elements.noticeauthor.value||'');
    fd.set('message',rt()); fd.set('replysubmit','回复');
    var x=new XMLHttpRequest(); x.open('POST',url,false);
    x.setRequestHeader('Content-Type','application/x-www-form-urlencoded'); x.setRequestHeader('X-Requested-With','XMLHttpRequest');
    x.send(fd.toString()); var txt=x.responseText||'';
    var ok=x.status===200&&/succeedhandle_fastpost|回复发布成功|pid/.test(txt)&&!/errorhandle_fastpost/.test(txt);
    var em=txt.match(/少于\s*(\d+)\s*秒/); var fl=!ok&&/两次发表间隔少于\s*\d+\s*秒/.test(txt);
    var fs=em?parseInt(em[1],10):15; if(!isFinite(fs)||fs<1)fs=15;
    try{if(ok)localStorage.setItem(LRK,String(Date.now()));}catch(e){}
    return{ok:ok,fl:fl,fs:fs}; }
  function viewpidHtml(t,p){ var x=new XMLHttpRequest();
    x.open('POST','forum.php?mod=viewthread&tid='+t+'&viewpid='+p+'&mobile=2',false);
    x.setRequestHeader('Content-Type','application/x-www-form-urlencoded'); x.setRequestHeader('X-Requested-With','XMLHttpRequest');
    x.send(''); if(x.status!==200)return ''; var raw=x.responseText||''; var m=raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/); return m?m[1]:raw; }
  function replaceFloor(t,p){ var html=viewpidHtml(t,p); if(!html||html.indexOf('id="pid'+p)<0)return false;
    var tg=document.getElementById('pid'+p)||document.getElementById('post_'+p); if(!tg)return false;
    var fr=document.createElement('div'); fr.innerHTML=html; var n=fr.querySelector('#pid'+p)||fr.querySelector('#post_'+p)||fr.firstElementChild;
    if(!n)return false; tg.outerHTML=n.outerHTML; return true; }
  function unlock(t,ps){ var d=0; for(var i=0;i<ps.length;i++){if(replaceFloor(t,ps[i]))d++;} return d>0; }
  function run(){ var t=tid(); if(!t)return; if(!isMobile())return; if(!hasLocked())return;
    var u=uid(); if(!u||u==='0')return; if(done(t))return; if(pend(t))return; if(hasMine(u)){markDone(t);return;}
    var f=document.getElementById('fastpostform'); if(f&&(f.querySelector('[name="seccodeverify"]')||f.querySelector('[name="secqaa"]')))return;
    var ps=lockedPids(); setPend(t,true);
    setTimeout(function(){ try{
      if(done(t)){setPend(t,false);return;} if(!hasLocked()){setPend(t,false);return;}
      var mb=document.getElementById('needmessage');
      if(mb&&mb.value&&mb.value.trim()&&mb.value.trim()!==rt()){setPend(t,false);return;}
      var lr=parseInt(localStorage.getItem(LRK)||'0',10); var since=Date.now()-lr;
      if(since<FM){ var w=FM-since+Math.floor(Math.random()*1000); setTimeout(function(){run();},w); return; }
      var res=submit();
      if(res.ok){ markDone(t); adv(); setPend(t,false); if(ps.length){unlock(t,ps);} if(!hasLocked()){} else{setTimeout(function(){location.reload();},800);} }
      else{ setPend(t,false); var rc=RCM[t]||0;
        if(res.fl&&rc<3){ RCM[t]=rc+1; var rd=res.fs*1000+1500+Math.random()*1500; setTimeout(function(){run();},rd); }
        else{ if(res.fl&&rc>=3){delete RCM[t];} } }
    }catch(e){setPend(t,false);} },0); }
  function start(){ if(!/thread-\d+/.test(location.pathname)&&!/mod=viewthread/i.test(location.search))return; run(); }
  if(document.readyState==='complete'||document.readyState==='interactive')start();
  else window.addEventListener('DOMContentLoaded',start);
}

// ========== 只看隐藏贴 ==========
function hideOnly(){ if(!on('hideOnly'))return; if(window.__hideOnly)return;
  if(/\/thread-[^\/]+\.html/i.test(location.pathname))return; window.__hideOnly=true;
  var Q=[],active=0,MAX=3;
  function mark(c,t){ var b=c.querySelector('[data-mt-hide-status]');
    if(!b){ b=document.createElement('span'); b.setAttribute('data-mt-hide-status','1');
      b.style.cssText='font-size:11px;color:#999;margin-left:6px;';
      var a=c.querySelector('a[href*="thread-"],a[href*="mod=viewthread"]'); if(a&&a.parentNode)a.parentNode.appendChild(b); }
    if(b){ b.textContent=t||''; b.style.display=t?'':'none'; } }
  function hiddenHtml(h){ return /\[hide(?:=|\])|class=["'][^"']*(?:showhide|locked)[^"']*["']|id=["']showhide|回复(?:后)?可见|隐藏内容|本帖隐藏/i.test(h||''); }
  function done(x,keep){ x.c.setAttribute('data-mt-hide-filtered',keep?'hidden':'normal'); x.c.style.display=keep?'':'none'; mark(x.c,''); }
  function pump(){ while(active<MAX&&Q.length){ (function(x){ active++;
    var r=new XMLHttpRequest(),end=false;
    function fin(ok,html){ if(end)return; end=true; active--; if(ok){done(x,hiddenHtml(html));}else{x.c.setAttribute('data-mt-hide-filtered','error');x.c.style.display='';mark(x.c,'检测失败，已保留');} pump(); }
    try{ r.open('GET',x.u,true); r.withCredentials=true; r.timeout=10000;
      r.onreadystatechange=function(){ if(r.readyState===4)fin(r.status>=200&&r.status<400,r.responseText); };
      r.onerror=function(){fin(false,'');}; r.ontimeout=function(){fin(false,'');}; r.send(null); }catch(e){fin(false,'');} })(Q.shift()); } }
  function itemOf(n){ var p=n,fb=null,d=0;
    while(p&&p!==document.body&&d++<10){ var tag=p.tagName||'',c=typeof p.className==='string'?p.className:'',id=p.id||'';
      if(/^(LI|TR|TBODY|ARTICLE)$/.test(tag)&&(/(?:^|[ _-])(?:forumlist_li|thread|topic|post)(?:[ _-]|$)/i.test(c)||/^normalthread_/i.test(id)))return p;
      if(!fb&&/^(LI|TR|ARTICLE)$/.test(tag))fb=p; p=p.parentElement; } return fb||n.parentElement; }
  function scan(){ var links=document.querySelectorAll('a[href*="thread-"],a[href*="mod=viewthread"]');
    for(var i=0;i<links.length;i++){ var n=links[i],c=itemOf(n);
      if(!c||c===document.body||c===document.documentElement||c.getAttribute('data-mt-hide-filtered'))continue;
      var u=n.href; if(!u)continue; c.setAttribute('data-mt-hide-filtered','checking'); c.style.display=''; mark(c,'检测中'); Q.push({c:c,u:u}); } pump(); }
  window.__hideScan=scan; scan();
  setTimeout(scan,500); setTimeout(scan,1500);
  if(!window.__hoObs){ window.__hoObs=new MutationObserver(function(){scan();}); window.__hoObs.observe(document.documentElement,{childList:true,subtree:true}); }
}

// ========== 个人小黑屋屏蔽 ==========
function personalBlack(){ if(!on('personalBlack'))return; if(window.__pBlack)return; window.__pBlack=true;
  var KEY='personalBlackList',TKEY='mtThreadOwner';
  function readOwners(){ try{var v=localStorage.getItem(TKEY);if(!v)return{};var o=JSON.parse(v);if(!o||typeof o!=='object'||Object.prototype.toString.call(o)==='[object Array]')return{};return o;}catch(e){return{};} }
  function writeOwners(o){ try{localStorage.setItem(TKEY,JSON.stringify(o));}catch(e){} }
  function threadIdOf(it){ var as=it.querySelectorAll('a[href*="thread-"]'); for(var i=0;i<as.length;i++){var h=as[i].getAttribute('href')||'';var m=h.match(/thread-(\d+)/);if(m)return m[1];}return null; }
  function threadIdsIn(it){ var out=[],as=it.querySelectorAll('a[href*="thread-"]'); for(var i=0;i<as.length;i++){var h=as[i].getAttribute('href')||'';var m=h.match(/thread-(\d+)/);if(m&&out.indexOf(m[1])<0)out.push(m[1]);}return out; }
  function uidOf(a){ if(!a)return null; var h=a.getAttribute('href')||''; var m=h.match(/uid=(\d+)/); if(m)return m[1]; var t=a.getAttribute('data-uid'); if(t)return String(t); return null; }
  function authorAnchor(item){ var u=item.querySelector('a.top_user'); if(u&&uidOf(u))return u;
    var ls=item.querySelectorAll('a[href*="uid="],a[href*="mod=space"]'); var fb=null;
    for(var i=0;i<ls.length;i++){ var a=ls[i]; if(!uidOf(a))continue; var t=(a.textContent||'').trim(); if(t)return a; if(!fb)fb=a; } return fb; }
  function recordOwners(){ var items=document.querySelectorAll('li.forumlist_li, li.comiis_postli, li.normalthread_, .comiis_forumlist li');
    var o=null; for(var i=0;i<items.length;i++){ var it=items[i]; var tid=threadIdOf(it); if(!tid)continue;
      var a=authorAnchor(it); if(!a)continue; var u=uidOf(a); if(!u||u==='0')continue;
      if(o===null)o=readOwners(); if(o[tid]!==u){o[tid]=u;} } if(o!==null)writeOwners(o); }
  function readList(){ var raw=null; try{ raw=localStorage.getItem(KEY); }catch(e){}
    if(!raw) return [];
    var arr=null; try{ arr=JSON.parse(raw); }catch(e2){ return []; }
    if(!arr) return [];
    if(Object.prototype.toString.call(arr)!=='[object Array]'){
      if(typeof arr==='object'&&arr!==null){
        if(arr.uid||arr.user) arr=[arr];
        else { var m=[]; for(var kk in arr){ var vv=arr[kk]; if(vv&&typeof vv==='object'){ vv.uid=vv.uid||kk; m.push(vv); } else m.push({uid:kk,user:''}); } arr=m; }
      } else return [];
    }
    var out=[];
    for(var i=0;i<arr.length;i++){ var e=arr[i]; if(e==null)continue;
      if(typeof e==='string'||typeof e==='number'){out.push({uid:String(e)});}
      else if(typeof e==='object'){ var u=e.uid!=null?e.uid:(e.id!=null?e.id:(e.userid!=null?e.userid:'')); if(u==null||String(u)==='')continue; out.push({uid:String(u)}); } }
    return out; }
  function nativeUidSet(){ var s={}; try{var v=localStorage.getItem('shieldList');if(!v)return s;var a=JSON.parse(v);if(!a)return s;
    if(Object.prototype.toString.call(a)!=='[object Array]')a=[a];
    for(var i=0;i<a.length;i++){var e=a[i];if(!e||typeof e!=='object')continue;if(String(e.option||'')!=='uid')continue;var t=String(e.text==null?'':e.text).replace(/\s+/g,'');if(/^\d+$/.test(t))s[t]=1;}}catch(e){}return s; }
  var SKEY='mtServerBlackList',TSKEY='mtServerBlackListTs',SRV={list:[],myUid:'',formhash:'',loaded:false,error:''};
  var SLIST_URL='home.php?mod=space&do=friend&view=blacklist&mobile=2';
  function getFormhash(){ var fh=''; try{var el=document.querySelector('input[name=formhash]'); if(el)fh=el.value||'';}catch(e){}
    if(!fh){ try{var m=(document.documentElement.innerHTML||'').match(/formhash=([0-9a-zA-Z]{6,})/); if(m)fh=m[1];}catch(e2){} }
    if(!fh){ try{fh=window.formhash||'';}catch(e3){} } return fh; }
  function parseServerHtml(t){ var list=[],seen={}; if(!t)return list;
    var reBlock=/<li[^>]*class=["']?[^"'>]*\bb_t\b[^"'>]*["']?[^>]*>([\s\S]*?)<\/li>/gi; var bm;
    while((bm=reBlock.exec(t))){ var block=bm[1]||'',uid='',name='';
      var mTit=block.match(/<p[^>]*class=["']?[^"'>]*\btit\b[^"'>]*["']?[^>]*>[\s\S]*?<a[^>]*href=["'][^"']*\buid=(\d+)[^"']*\bdo=profile[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)||block.match(/<p[^>]*class=["']?[^"'>]*\btit\b[^"'>]*["']?[^>]*>[\s\S]*?<a[^>]*href=["'][^"']*\bdo=profile[^"']*\buid=(\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
      if(mTit){ uid=mTit[1]; name=String(mTit[2]||'').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').trim(); }
      if(!uid){ var mDel=block.match(/href=["'][^"']*subop=delete[^"']*\buid=(\d+)[^"']*["']/i)||block.match(/href=["'][^"']*\buid=(\d+)[^"']*subop=delete[^"']*["']/i);
        if(mDel)uid=mDel[1]; if(!uid){ var mProf=block.match(/href=["'][^"']*\buid=(\d+)[^"']*\bdo=profile[^"']*["']/i); if(mProf)uid=mProf[1]; } }
      if(uid&&!seen[uid]){ seen[uid]=1; list.push({uid:uid,user:name,_server:true}); } }
    if(!list.length){ var reTit=/<p[^>]*class=["']?[^"'>]*\btit\b[^"'>]*["']?[^>]*>[\s\S]*?<a[^>]*href=["'][^"']*\buid=(\d+)[^"']*\bdo=profile[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi; var m2;
      while((m2=reTit.exec(t))){ var u2=m2[1]; if(!seen[u2]){ seen[u2]=1; list.push({uid:u2,user:String(m2[2]||'').replace(/<[^>]*>/g,'').trim(),_server:true}); } } }
    if(!SRV.formhash){ var mfh=t.match(/name=["']?formhash["']?[^>]*value=["']([0-9a-zA-Z]+)["']/i)||t.match(/formhash=([0-9a-zA-Z]{6,})/); if(mfh)SRV.formhash=mfh[1]; }
    if(!SRV.myUid){ var mm=t.match(/home\.php\?mod=space&(?:amp;)?uid=(\d+)&(?:amp;)?do=friend/i); if(mm)SRV.myUid=mm[1]; }
    return list; }
  function syncServerCache(){ var ids=[]; for(var si=0;si<SRV.list.length;si++){ if(SRV.list[si]&&SRV.list[si].uid)ids.push(String(SRV.list[si].uid)); }
    try{ localStorage.setItem(SKEY,JSON.stringify(ids)); localStorage.setItem(TSKEY,String(Date.now())); }catch(e){} }
  function fetchServer(cb){ try{ var xhr=new XMLHttpRequest(); xhr.open('GET','https://bbs.binmt.cc/'+SLIST_URL,true); xhr.withCredentials=true;
    xhr.onreadystatechange=function(){ if(xhr.readyState!==4)return; var t=xhr.responseText||'';
      try{ SRV.list=parseServerHtml(t); SRV.loaded=true; SRV.error=''; if(!SRV.formhash)SRV.formhash=getFormhash(); syncServerCache(); }catch(e){ SRV.error='解析失败:'+e; }
      if(cb)cb(SRV); };
    xhr.onerror=function(){ SRV.error='网络错误'; if(cb)cb(SRV); }; xhr.send(); }catch(e){ SRV.error='请求异常:'+e; if(cb)cb(SRV); } }
  function ensureServerList(){ try{ var _ts=localStorage.getItem(TSKEY), _has=localStorage.getItem(SKEY);
      if(!_has||!_ts||(Date.now()-Number(_ts))>604800000){ if(!window.__mtFetching){ window.__mtFetching=1; fetchServer(function(){ window.__mtFetching=0; }); } } }catch(e){} }
  function serverUidSet(){ var s={}; try{var v=localStorage.getItem(SKEY);
    if(v){var a=JSON.parse(v); if(a&&Object.prototype.toString.call(a)==='[object Array]'){for(var i=0;i<a.length;i++){var u=String(a[i]||'').replace(/\s+/g,'');if(/^\d+$/.test(u))s[u]=1;}}}}catch(e){}return s; }
  function uidSet(){ var s=nativeUidSet(); var l=readList(); for(var i=0;i<l.length;i++)s[l[i].uid]=1;
    var sb=serverUidSet(); for(var u in sb)s[u]=1; return s; }
  function applyFilter(){ var set=uidSet(); var owners=readOwners(); if(Object.keys(set).length===0)return;
    var items=document.querySelectorAll('.comiis_forumlist .forumlist_li, .comiis_postlist .comiis_postli, #threadlist .forumlist_li, li.normalthread_, li.forumlist_li, li.comiis_postli');
    for(var i=0;i<items.length;i++){ var it=items[i]; var hit=false;
      var as=it.querySelectorAll('a[href*="uid="]'); for(var k=0;k<as.length;k++){var u=uidOf(as[k]);if(u&&set[u]){hit=true;break;}}
      if(!hit){ var tids=threadIdsIn(it); for(var t=0;t<tids.length;t++){var ow=owners[''+tids[t]]; if(ow&&set[ow]){hit=true;break;}} }
      if(hit){ it.style.display='none'; it.setAttribute('data-mt-black-filtered','1'); }
      else if(it.getAttribute('data-mt-black-filtered')){ it.style.display=''; it.removeAttribute('data-mt-black-filtered'); } } }
  function run(){ applyFilter(); recordOwners(); ensureServerList(); }
  run(); setTimeout(run,400); setTimeout(run,1200); setTimeout(run,2500);
  if(!window.__pbTimer){ window.__pbTimer=setInterval(function(){try{run();}catch(e){}},1500); }
  if(!window.__pbObs){ window.__pbObs=new MutationObserver(function(){run();}); window.__pbObs.observe(document.documentElement,{childList:true,subtree:true}); }
}

// ========== UBB 快捷输入栏 ==========
function ubbList(){ return [
  {name:'隐藏文本', ins:function(){return ['[hide]','[/hide]'];}},
  {name:'URL超连', type:'url', ins:function(){return ['[url=]','[/url]'];}},
  {name:'网络图片', type:'image', ins:function(){return ['[img]','[/img]'];}},
  {name:'代码文本', ins:function(){return ['[code]','[/code]'];}},
  {name:'彩色文字', type:'rainbow', ins:function(){return ['[color=#1e88e5]','[/color]'];}},
  {name:'字号文字', type:'size', ins:function(){return ['[size=1~7]','[/size]'];}},
  {name:'加粗', ins:function(){return ['[b]','[/b]'];}},
  {name:'斜体', ins:function(){return ['[i]','[/i]'];}},
  {name:'下划线', ins:function(){return ['[u]','[/u]'];}},
  {name:'删除线', ins:function(){return ['[s]','[/s]'];}},
  {name:'颜色文字', type:'color', ins:function(){return ['[color=#]','[/color]'];}},
  {name:'Email超', type:'email', ins:function(){return ['[email=]','[/email]'];}},
  {name:'水平线', ins:function(){return ['[hr]\n',''];}},
  {name:'对齐文本', type:'align', ins:function(){return ['[align=left]','[/align]'];}},
  {name:'引用文本', ins:function(){return ['[quote]','[/quote]'];}},
  {name:'网络视频', type:'media', ins:function(){return ['[media=x,500,375]','[/media]'];}},
  {name:'表格', ins:function(){return ['[table][tr][td]文本[/td][/tr][/table]\n',''];}},
  {name:'列表', ins:function(){return ['[list=A]\n[*] list可以是字母或者数字。\n[*] 他将会自动依次排列。\n[/list]\n',''];}}
]; }
function ubbInsertText(obj,str){ try{
  if(document.selection){ var sel=document.selection.createRange(); sel.text=str; return; }
  if(typeof obj.selectionStart==='number'&&typeof obj.selectionEnd==='number'){
    var sp=obj.selectionStart,ep=obj.selectionEnd,tmp=obj.value,cp=sp;
    obj.value=tmp.substring(0,sp)+str+tmp.substring(ep,tmp.length);
    cp+=str.length; obj.selectionStart=obj.selectionEnd=cp;
    try{obj.focus();}catch(e){} return;
  } obj.value+=str;
}catch(e){} }
// 取输入框内真实选中的文字：优先 #needmessage(textarea) 的 selectionStart/End，回退 window.getSelection
function ubbSelText(){ try{
  var ta=document.getElementById('needmessage');
  if(ta && typeof ta.selectionStart==='number' && typeof ta.selectionEnd==='number'){
    var a=ta.selectionStart,b=ta.selectionEnd;
    if(b>a){ var s=ta.value.substring(a,b); if(s)return s; }
  }
  var w=window.getSelection&&window.getSelection();
  if(w&&w.toString)return w.toString();
  return '';
}catch(e){ return ''; } }
function ubbChangeText(id,a,b){ try{
  var ta=document.getElementById(id); if(!ta)return;
  var st=(typeof ta.selectionStart==='number')?ta.selectionStart:ta.value.length;
  var fn=(typeof ta.selectionEnd==='number')?ta.selectionEnd:ta.value.length;
  if(st>fn){var t=st;st=fn;fn=t;}
  var all=ta.value,sel=all.substring(st,fn);
  var nt; if(b)nt=all.substring(0,st)+a+sel+b+all.substring(fn,all.length);
  else nt=all.substring(0,st)+a+all.substring(fn,all.length);
  ta.value=nt; var cur=st+a.length+sel.length+(b?b.length:0);
  try{ta.selectionStart=ta.selectionEnd=cur;ta.focus();}catch(e){}
}catch(e){} }

// ========== 图片上传（MT论坛图床 img.binmt.cc）==========
function mtImageInsert(url){ try{
  var ta=document.getElementById('needmessage'); if(!ta)return;
  var tag='[img]'+url+'[/img]';
  var sel=ubbSelText();
  if(sel){ ubbChangeText('needmessage',tag,''); }
  else{ ubbInsertText(ta,tag); }
}catch(e){} }
function mtImageInsertLink(url){ try{
  var ta=document.getElementById('needmessage'); if(!ta)return;
  var tag='[url='+url+'][img]'+url+'[/img][/url]\n';
  var sel=ubbSelText();
  if(sel){ ubbChangeText('needmessage',tag,''); }
  else{ ubbInsertText(ta,tag); }
}catch(e){} }
function mtImageStyle(){ if(document.getElementById('mt-img-style'))return;
  var st=document.createElement('style'); st.id='mt-img-style';
  st.textContent='@keyframes mtfade{from{opacity:0}to{opacity:1}}@keyframes mtscale{from{transform:scale(.92);opacity:0}to{transform:scale(1);opacity:1}}'+
    '#mt-img-mask{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.45);z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;animation:mtfade .18s ease;}'+
    '#mt-img-box{width:100%;max-width:320px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.22),0 2px 8px rgba(0,0,0,.08);animation:mtscale .18s ease;}'+
    '#mt-img-title{font-size:17px;font-weight:600;color:#1a1a1a;padding:22px 22px 0;}'+
    '#mt-img-sub{font-size:12px;color:#999;padding:4px 22px 12px;word-break:break-all;}'+
    '#mt-img-body{padding:0 22px 10px;}'+
    '#mt-img-url{width:100%;box-sizing:border-box;padding:10px 2px;border:none;border-bottom:1.5px solid #e0e2e6;border-radius:0;font-size:16px;color:#16181d;background:transparent;outline:none;transition:border-color .18s;}'+
    '#mt-img-url::placeholder{color:#b0b5bc;font-size:15px;}'+
    '#mt-img-url:hover{border-bottom-color:#cdd1d6;}'+
    '#mt-img-url:focus{border-bottom-color:#3a76f0;}'+
    '#mt-img-actions{display:flex;justify-content:flex-end;align-items:center;padding:4px 14px 14px;gap:6px;}'+
    '#mt-img-actions .mb{min-width:56px;padding:10px 14px;border:none;background:none;font-size:15px;font-weight:500;letter-spacing:.2px;text-align:center;cursor:pointer;color:#6b7280;border-radius:8px;transition:background .15s;}'+
    '#mt-img-actions .mb.primary{color:#3a76f0;font-weight:600;}'+
    '#mt-img-actions .mb:active{background:#eef1f6;}'+
    '#mt-img-actions .mb:hover{background:#f3f5f9;}'+
    '#mt-img-file{display:none;}'+
    '#mt-img-msg{font-size:12px;color:#f0433f;padding:0 22px 4px;min-height:16px;}';
  (document.head||document.documentElement).appendChild(st); }
function mtRainbowApply(){ try{
  var t=ubbSelText();
  if(!t){ alert('请选中一段文字'); return; }
  // 精确移植 APP 原生 set_rainbow 彩虹渐变算法（红→黄→绿→青→蓝→品红 循环，步长40，空格跳过）
  var r=255,g=0,b=0,i=1,j=0,istep=40,out='';
  function hex(v){ var s=parseInt(v).toString(16); return s.length===1?'0'+s:s; }
  var n=t.length;
  for(var k=0;k<n;k++){
    var ch=t.charAt(k);
    if(ch.charCodeAt(0)!==32){
      if(g+istep<256){ if(i===1)g+=istep; } else if(i===1){ i=2; g=255; }
      if(r-istep>-1){ if(i===2)r-=istep; } else if(i===2){ i=3; r=0; }
      if(b+istep<256){ if(i===3)b+=istep; } else if(i===3){ i=4; b=255; }
      if(g-istep>-1){ if(i===4)g-=istep; } else if(i===4){ i=5; g=0; }
      if(r+istep<256){ if(i===5)r+=istep; } else if(i===5){ i=6; r=255; }
      if(b-istep>-1){ if(i===6)b-=istep; } else if(i===6){ i=1; b=0; }
      out+='[color=#'+(hex(r)+hex(g)+hex(b)).toUpperCase()+']'+ch+'[/color]';
    } else { out+=ch; }
  }
  ubbChangeText('needmessage',out,'');
}catch(e){} }
function mtColorStyle(){ if(document.getElementById('mt-color-style'))return;
  var st=document.createElement('style'); st.id='mt-color-style';
  st.textContent='@keyframes mtfade{from{opacity:0}to{opacity:1}}@keyframes mtscale{from{transform:scale(.92);opacity:0}to{transform:scale(1);opacity:1}}'+
    '#mt-color-mask{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.45);z-index:2147483001;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;animation:mtfade .18s ease;}'+
    '#mt-color-box{width:100%;max-width:320px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.22),0 2px 8px rgba(0,0,0,.08);animation:mtscale .18s ease;}'+
    '#mt-color-title{font-size:17px;font-weight:600;color:#1a1a1a;padding:22px 22px 0;}'+
    '#mt-color-prev{display:flex;align-items:center;gap:12px;padding:14px 22px 12px;}'+
    '#mt-color-prev .sw{width:42px;height:42px;border-radius:10px;border:1px solid rgba(0,0,0,.12);background:#000;box-shadow:inset 0 1px 2px rgba(0,0,0,.08);}'+
    '#mt-color-prev .hex{font-size:16px;font-family:monospace;color:#1a1a1a;letter-spacing:.5px;}'+
    '.mt-color-row{display:flex;align-items:center;gap:10px;padding:5px 22px;}'+
    '.mt-color-row .lb{width:14px;font-size:13px;font-weight:600;color:#555;}'+
    '.mt-color-row .vx{width:30px;font-size:12px;color:#999;font-family:monospace;text-align:right;}'+
    '.mt-color-row input[type=range]{flex:1;height:24px;accent-color:#3a76f0;}'+
    '#mt-color-actions{display:flex;justify-content:flex-end;align-items:center;padding:14px 14px;gap:6px;}'+
    '#mt-color-actions .mb{min-width:56px;padding:10px 14px;border:none;background:none;font-size:15px;font-weight:500;letter-spacing:.2px;text-align:center;cursor:pointer;color:#6b7280;border-radius:8px;transition:background .15s;}'+
    '#mt-color-actions .mb.primary{color:#3a76f0;font-weight:600;}'+
    '#mt-color-actions .mb:active{background:#eef1f6;}'+
    '#mt-color-actions .mb:hover{background:#f3f5f9;}';
  (document.head||document.documentElement).appendChild(st); }
function mtColorDialog(){ try{
  mtColorStyle();
  if(document.getElementById('mt-color-mask'))return;
  var r=0,g=0,b=0; // 初始黑 #000000（同 APP 原生 progress=1）
  function hex(v){ var s=parseInt(v).toString(16); return s.length===1?'0'+s:s; }
  function rgb(){ return '#'+(hex(r)+hex(g)+hex(b)).toUpperCase(); }
  var mask=document.createElement('div'); mask.id='mt-color-mask';
  var box=document.createElement('div'); box.id='mt-color-box';
  var title=document.createElement('div'); title.id='mt-color-title'; title.textContent='选色器';
  // 预览
  var prev=document.createElement('div'); prev.id='mt-color-prev';
  var sw=document.createElement('div'); sw.className='sw';
  var hexEl=document.createElement('span'); hexEl.className='hex'; hexEl.textContent='#000000';
  prev.appendChild(sw); prev.appendChild(hexEl);
  // 三个 RGB 滑条
  function mkRow(lb){ var row=document.createElement('div'); row.className='mt-color-row';
    var l=document.createElement('span'); l.className='lb'; l.textContent=lb;
    var s=document.createElement('input'); s.type='range'; s.min='0'; s.max='255'; s.value='0';
    var v=document.createElement('span'); v.className='vx'; v.textContent='00';
    row.appendChild(l); row.appendChild(s); row.appendChild(v); return {row:row,s:s,v:v}; }
  var R=mkRow('R'),G=mkRow('G'),B=mkRow('B');
  function refresh(){ sw.style.background=rgb(); hexEl.textContent=rgb(); }
  function bind(X){ X.s.addEventListener('input',function(){ var val=parseInt(X.s.value)||0;
    if(X===R)r=val;else if(X===G)g=val;else b=val;
    X.v.textContent=hex(val).toUpperCase(); refresh(); }); }
  bind(R);bind(G);bind(B);
  // 快捷取色 input color
  var cbtn=document.createElement('input'); cbtn.type='color'; cbtn.value='#000000'; cbtn.style.cssText='margin:0 16px 8px;width:56px;height:32px;border:none;background:none;cursor:pointer;padding:0;';
  cbtn.addEventListener('input',function(){ var c=cbtn.value.replace('#','');
    r=parseInt(c.substr(0,2),16)||0; g=parseInt(c.substr(2,2),16)||0; b=parseInt(c.substr(4,2),16)||0;
    R.s.value=r;G.s.value=g;B.s.value=b; R.v.textContent=hex(r).toUpperCase();G.v.textContent=hex(g).toUpperCase();B.v.textContent=hex(b).toUpperCase();
    refresh(); });
  // 按钮
  var actions=document.createElement('div'); actions.id='mt-color-actions';
  var cb=document.createElement('div'); cb.className='mb'; cb.textContent='取消';
  var ob=document.createElement('div'); ob.className='mb primary'; ob.textContent='确定';
  function apply(){ try{
    var col=rgb();
    var sel=ubbSelText();
    if(sel){ ubbChangeText('needmessage','[color='+col+']','[/color]'); }
    else { var ta=document.getElementById('needmessage'); ubbInsertText(ta,'[color='+col+'][/color]'); }
  }catch(e){} finally{ try{mask.remove();}catch(e){} } }
  ob.addEventListener('click',apply);
  cb.addEventListener('click',function(){ try{mask.remove();}catch(e){} });
  actions.appendChild(cb); actions.appendChild(ob);
  box.appendChild(title); box.appendChild(prev);
  box.appendChild(R.row); box.appendChild(G.row); box.appendChild(B.row);
  box.appendChild(cbtn); box.appendChild(actions);
  mask.appendChild(box);
  mask.addEventListener('click',function(e){ if(e.target===mask){ try{mask.remove();}catch(err){} } });
  (document.body||document.documentElement).appendChild(mask);
}catch(e){} }
function mtDialogStyle(){ if(document.getElementById('mt-dlg-style'))return;
  var st=document.createElement('style'); st.id='mt-dlg-style';
  st.textContent='#mt-dlg-mask{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.45);z-index:2147483002;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;animation:mtfade .18s ease;}'+
    '@keyframes mtfade{from{opacity:0}to{opacity:1}}'+
    '#mt-dlg-box{width:100%;max-width:320px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.22),0 2px 8px rgba(0,0,0,.08);animation:mtscale .18s ease;}'+
    '@keyframes mtscale{from{transform:scale(.92);opacity:0}to{transform:scale(1);opacity:1}}'+
    '#mt-dlg-title{font-size:19px;font-weight:600;line-height:1.4;color:#16181d;padding:28px 28px 0;letter-spacing:.2px;}'+
    '#mt-dlg-body{padding:22px 28px 0;}'+
    '.mt-dlg-field{margin-bottom:22px;}'+
    '.mt-dlg-field .lb{display:block;font-size:14px;font-weight:500;color:#3a3f47;margin-bottom:10px;letter-spacing:.2px;}'+
    '.mt-dlg-field .lb .st{color:#f0433f;margin-right:3px;font-weight:600;}'+
    '.mt-dlg-field input{width:100%;height:40px;padding:0 2px;border:none;border-bottom:1.5px solid #e0e2e6;border-radius:0;font-size:16px;color:#16181d;background:transparent;box-sizing:border-box;outline:none;transition:border-color .18s;}'+
    '.mt-dlg-field input::placeholder{color:#b0b5bc;font-size:15px;}'+
    '.mt-dlg-field input:hover{border-bottom-color:#cdd1d6;}'+
    '.mt-dlg-field input:focus{border-bottom-color:#3a76f0;}'+
'#mt-dlg-msg{font-size:13px;color:#f0433f;padding:0 28px 0;min-height:20px;margin-top:-12px;margin-bottom:10px;}'+
    '#mt-dlg-actions{display:flex;justify-content:flex-end;align-items:center;padding:6px 18px 18px;gap:8px;}'+
    '#mt-dlg-actions .mb{min-width:60px;padding:11px 16px;border:none;background:none;font-size:15px;font-weight:500;letter-spacing:.3px;text-align:center;cursor:pointer;color:#6b7280;border-radius:10px;transition:background .15s;}'+
    '#mt-dlg-actions .mb.primary{color:#3a76f0;font-weight:600;}'+
    '#mt-dlg-actions .mb:active{background:#eef1f6;}'+
    '#mt-dlg-actions .mb:hover{background:#f3f5f9;}';
  (document.head||document.documentElement).appendChild(st); }
function mtDialogShell(title){ try{
  mtDialogStyle();
  var mask=document.createElement('div'); mask.id='mt-dlg-mask';
  var box=document.createElement('div'); box.id='mt-dlg-box';
  var t=document.createElement('div'); t.id='mt-dlg-title'; t.textContent=title;
  var body=document.createElement('div'); body.id='mt-dlg-body';
  var msg=document.createElement('div'); msg.id='mt-dlg-msg';
  box.appendChild(t); box.appendChild(body); box.appendChild(msg);
  mask.appendChild(box);
  mask.addEventListener('click',function(e){ if(e.target===mask){ try{mask.remove();}catch(err){} } });
  (document.body||document.documentElement).appendChild(mask);
  return {mask:mask,body:body,msg:msg,close:function(){try{mask.remove();}catch(e){}}};
}catch(e){ return null; } }
function mtDlgField(body,label,required,placeholder){ try{
  var f=document.createElement('div'); f.className='mt-dlg-field';
  var l=document.createElement('label'); l.className='lb';
  if(required){ var st=document.createElement('span'); st.className='st'; st.textContent='*'; l.appendChild(st); }
  l.appendChild(document.createTextNode(label));
  var inp=document.createElement('input'); inp.type='text'; if(placeholder)inp.placeholder=placeholder;
  f.appendChild(l); f.appendChild(inp);
  body.appendChild(f);
  return inp;
}catch(e){ return null; } }
// URL / Email 超链接：双输入弹窗（地址必填，名称选填，空则沿用地址）
function mtLinkDialog(kind){ try{
  var isUrl=(kind==='URL');
  var sh=mtDialogShell(isUrl?'插入链接':'插入邮箱链接'); if(!sh)return;
  var url=mtDlgField(sh.body,isUrl?'链接地址':'邮箱地址',true,isUrl?'https://example.com':'name@example.com');
  var name=mtDlgField(sh.body,'显示文本',false,'留空则显示地址本身');
  var actions=document.createElement('div'); actions.id='mt-dlg-actions';
  var cb=document.createElement('div'); cb.className='mb'; cb.textContent='取消';
  var ob=document.createElement('div'); ob.className='mb primary'; ob.textContent='确定';
  function ok(){ try{
    var u=(url.value||'').trim();
    if(!u){ sh.msg.textContent=(isUrl?'链接地址':'邮箱地址')+'不能为空'; try{url.focus();}catch(e){} return; }
    var nm=(name.value||'').trim(); if(!nm)nm=u;
    var tag=(isUrl?'[url=':'[email=')+u+']'+nm+(isUrl?'[/url]':'[/email]')+'\n';
    var ta=document.getElementById('needmessage'); ubbInsertText(ta,tag);
    sh.close();
  }catch(e){} }
  ob.addEventListener('click',ok);
  url.addEventListener('keydown',function(e){ if(e.key==='Enter')ok(); });
  name.addEventListener('keydown',function(e){ if(e.key==='Enter')ok(); });
  cb.addEventListener('click',function(){ sh.close(); });
  actions.appendChild(cb); actions.appendChild(ob);
sh.body.appendChild(actions);
}catch(e){} }
// 字号文字：1~9 弹窗
function mtSizeDialog(){ try{
  var sh=mtDialogShell('文字大小'); if(!sh)return;
  var f=document.createElement('div'); f.className='mt-dlg-field';
  var l=document.createElement('span'); l.className='lb'; l.textContent='大小';
  var inp=document.createElement('input'); inp.type='number'; inp.min='1'; inp.max='9'; inp.value='3'; inp.placeholder='1~9';
  f.appendChild(l); f.appendChild(inp); sh.body.appendChild(f);
  var hint=document.createElement('div'); hint.style.cssText='font-size:12px;color:#999;padding:2px 0;'; hint.textContent='文字大小可选 1~9';
  sh.body.appendChild(hint);
  var actions=document.createElement('div'); actions.id='mt-dlg-actions';
  var cb=document.createElement('div'); cb.className='mb'; cb.textContent='取消';
  var ob=document.createElement('div'); ob.className='mb primary'; ob.textContent='确定';
  function apply(v){ try{
    var s=String(v);
    var sel=ubbSelText();
    if(sel){ ubbChangeText('needmessage','[size='+s+']','[/size]'); }
    else { var ta=document.getElementById('needmessage'); ubbInsertText(ta,'[size='+s+'][/size]'); }
  }catch(e){} sh.close(); }
  function ok(){ var v=parseInt(inp.value); if(!v||v<1||v>9){ sh.msg.textContent='请输入 1~9 之间的数字'; return; } apply(v); }
  ob.addEventListener('click',ok);
  inp.addEventListener('keydown',function(e){ if(e.key==='Enter')ok(); });
  cb.addEventListener('click',function(){ sh.close(); });
  actions.appendChild(cb); actions.appendChild(ob);
  sh.body.appendChild(actions);
}catch(e){} }
// 对齐文本：居左/居中/居右 三选项
function mtAlignMenu(){ try{
  var sh=mtDialogShell('对齐文本'); if(!sh)return;
  var opts=[['left','居左'],['center','居中'],['right','居右']];
  var wrap=document.createElement('div'); wrap.id='mt-dlg-actions'; wrap.style.cssText='margin:4px 0 8px;';
  function apply(v){ try{
    var sel=ubbSelText();
    if(sel){ ubbChangeText('needmessage','[align='+v+']','[/align]'); }
    else { var ta=document.getElementById('needmessage'); ubbInsertText(ta,'[align='+v+'][/align]'); }
  }catch(e){} sh.close(); }
  opts.forEach(function(o){
    var b=document.createElement('div'); b.className='mb primary'; b.textContent=o[1];
    b.addEventListener('click',function(){ apply(o[0]); });
    wrap.appendChild(b);
  });
  var cb=document.createElement('div'); cb.className='mb'; cb.textContent='取消';
  cb.addEventListener('click',function(){ sh.close(); });
  wrap.appendChild(cb);
  sh.body.appendChild(wrap);
}catch(e){} }
// 网络视频：视频地址弹窗
function mtMediaDialog(){ try{
  var sh=mtDialogShell('网络视频'); if(!sh)return;
  var url=mtDlgField(sh.body,'视频地址',true,'视频链接或地址');
  var actions=document.createElement('div'); actions.id='mt-dlg-actions';
  var cb=document.createElement('div'); cb.className='mb'; cb.textContent='取消';
  var ob=document.createElement('div'); ob.className='mb primary'; ob.textContent='确定';
  function ok(){ try{
    var u=(url.value||'').trim();
    if(!u){ sh.msg.textContent='视频地址不可为空'; return; }
    var sel=ubbSelText();
    if(sel){ ubbChangeText('needmessage','[media=x,500,375]'+u+'[/media]',''); }
    else { var ta=document.getElementById('needmessage'); ubbInsertText(ta,'[media=x,500,375]'+u+'[/media]'); }
    sh.close();
  }catch(e){} }
  ob.addEventListener('click',ok);
  url.addEventListener('keydown',function(e){ if(e.key==='Enter')ok(); });
  cb.addEventListener('click',function(){ sh.close(); });
  actions.appendChild(cb); actions.appendChild(ob);
  sh.body.appendChild(actions);
}catch(e){} }
function mtImageDialog(){
  mtImageStyle();
  if(document.getElementById('mt-img-mask')){ return; }
  var mask=document.createElement('div'); mask.id='mt-img-mask';
  var box=document.createElement('div'); box.id='mt-img-box';
  var title=document.createElement('div'); title.id='mt-img-title'; title.textContent='网络图片';
  var sub=document.createElement('div'); sub.id='mt-img-sub'; sub.textContent='上传到MT论坛图床 或 手动输入链接';
  var body=document.createElement('div'); body.id='mt-img-body';
  var url=document.createElement('input'); url.id='mt-img-url'; url.type='text'; url.placeholder='也可直接粘贴图片链接';
  var msg=document.createElement('div'); msg.id='mt-img-msg';
  var actions=document.createElement('div'); actions.id='mt-img-actions';
  var fbtn=document.createElement('label'); fbtn.className='mb'; fbtn.textContent='上传图片';
  var finp=document.createElement('input'); finp.id='mt-img-file'; finp.type='file'; finp.accept='image/*';
  fbtn.appendChild(finp);
  // 复选：点击图片打开图片链接（对应 APP 原生）
  var ckRow=document.createElement('label'); ckRow.style.cssText='display:flex;align-items:center;gap:6px;padding:4px 0;font-size:13px;color:#666;';
  var ck=document.createElement('input'); ck.type='checkbox';
  ckRow.appendChild(ck); ckRow.appendChild(document.createTextNode('点击图片，打开图片链接'));
  body.appendChild(ckRow);
  var ibtn=document.createElement('div'); ibtn.className='mb primary'; ibtn.textContent='插入';
  var cbtn=document.createElement('div'); cbtn.className='mb'; cbtn.textContent='取消';
  actions.appendChild(fbtn); actions.appendChild(ibtn); actions.appendChild(cbtn);
  body.appendChild(url);
  box.appendChild(title); box.appendChild(sub); box.appendChild(body); box.appendChild(msg); box.appendChild(actions);
  mask.appendChild(box);
  document.body.appendChild(mask);
  function close(){ try{ mask.parentNode.removeChild(mask); }catch(e){} }
  mask.addEventListener('click',function(e){ if(e.target===mask)close(); });
  cbtn.addEventListener('click',close);
  ibtn.addEventListener('click',function(){
    var v=(url.value||'').trim();
    if(v){
      if(ck.checked){ mtImageInsertLink(v); }
      else{ mtImageInsert(v); }
      close();
    }
    else{ msg.textContent='请先上传图片或输入链接'; }
  });
  url.addEventListener('click',function(){
    try{ finp.click(); }catch(e){}
  });
  finp.addEventListener('change',function(){
    var f=finp.files&&finp.files[0]; if(!f)return;
    msg.textContent='上传中...';
    if(!/^image\//i.test(f.type)){ msg.textContent='请选择图片文件'; return; }
    mtImageUpload(f,function(ok,res){
      if(ok&&res){ url.value=res; msg.textContent='上传成功，点击「插入」写入输入框'; }
      else{ msg.textContent=res||'上传失败，请重试'; }
    });
  });
}
// 两步上传：GET 首页取 csrf-token + cookie 会话 -> POST /upload
function mtImageUpload(file,cb){
  var BASE='https://img.binmt.cc';
  var useGM=(typeof GM_xmlhttpRequest==='function');
  function failWhy(){ return useGM ? '图床上传失败（请检查脚本跨域授权 @connect）' : '图床上传失败（当前环境缺少 GM_xmlhttpRequest，跨域受限，请尝试手动输入链接）'; }
  // 从 set-cookie 响应头解析 cookie 键值，提取关键会话字段
  // 兼容多种 responseHeaders 格式：字符串(换行分隔) / 对象{header:value} / 数组
  function addCookie(jar, line){
    var seg=String(line).replace(/^set-cookie\s*:\s*/i,'').split(';')[0];
    var idx=seg.indexOf('=');
    if(idx>0){ var k=seg.slice(0,idx).trim(); var v=seg.slice(idx+1).trim();
      if(k&&v) jar[k]=v; }
  }
  function parseCookies(headersStr){
    var jar={};
    if(!headersStr)return jar;
    if(typeof headersStr==='string'){
      var lines=headersStr.split(/[\r\n]+/);
      lines.forEach(function(ln){
        if(/^set-cookie\s*:/i.test(ln.trim())) addCookie(jar, ln);
      });
    } else if(typeof headersStr==='object'){
      // 对象形式：可能是 {header:value} 或数组
      var arr=(Array.isArray(headersStr))?headersStr:[headersStr];
      arr.forEach(function(o){
        for(var k in o){
          if(o.hasOwnProperty(k) && /set-cookie/i.test(String(k))) addCookie(jar, String(k)+': '+o[k]);
        }
      });
    }
    return jar;
  }
  function cookieHeader(jar){
    var parts=[];
    for(var k in jar){ if(jar.hasOwnProperty(k)&&jar[k]) parts.push(k+'='+jar[k]); }
    return parts.join('; ');
  }
  function extractCsrf(txt){
    var m=(txt||'').match(/csrf-token"\s*content="([^"]+)"/i)||(txt||'').match(/name="csrf-token"\s*content="([^"]+)"/i);
    return m?m[1]:'';
  }
  function doUpload(token,cookieJar){
    var done=false;
    function finish(ok,res){ if(done)return; done=true; cb(ok,res); }
    if(useGM){
      var fd=new FormData(); fd.append('file',file,file.name||'image.png');
      var hdr={ 'Referer':BASE+'/', 'x-csrf-token':token };
      var ck=cookieHeader(cookieJar);
      if(ck) hdr['Cookie']=ck;
      // 注意：不要手动设置 Content-Type，GM/浏览器会为 FormData 自动补 boundary
      GM_xmlhttpRequest({ method:'POST', url:BASE+'/upload',
        headers:hdr, data:fd, timeout:30000,
        onload:function(r){ try{
          var txt=r.responseText||r.response||'';
          var j;
          if(typeof txt==='object') j=txt;
          else { try{ j=JSON.parse(txt); }catch(e){ j=null; } }
          if(j&&j.status&&j.data&&j.data.links&&j.data.links.url){ finish(true,j.data.links.url); }
          else{ finish(false,(j&&j.message)||('图床返回异常：'+String(txt).slice(0,60))); }
        }catch(e){ finish(false,'上传响应解析失败'); } },
        onerror:function(){ finish(false,failWhy()); },
        ontimeout:function(){ finish(false,'上传超时'); } });
      return;
    }
    // 降级：页面 fetch（可能因 CORS 失败）
    var fd2=new FormData(); fd2.append('file',file,file.name||'image.png');
    fetch(BASE+'/upload',{method:'POST',credentials:'include',headers:{'Referer':BASE+'/','x-csrf-token':token},body:fd2})
      .then(function(r){ return r.json(); })
      .then(function(j){ if(j&&j.status&&j.data&&j.data.links&&j.data.links.url)finish(true,j.data.links.url); else finish(false,(j&&j.message)||'上传失败'); })
      .catch(function(){ finish(false,failWhy()); });
  }
  function getToken(){
    function onPage(txt,headersStr){
      var t=extractCsrf(txt);
      var jar=headersStr?parseCookies(headersStr):{};
      if(t){ doUpload(t,jar); } else { cb(false,'获取图床会话失败'); }
    }
    if(useGM){
      // 关键：用 responseHeaders 抓 set-cookie，实现手动会话管理
      GM_xmlhttpRequest({ method:'GET', url:BASE+'/', timeout:20000,
        responseHeaders:true,
        onload:function(r){ onPage(r.responseText, r.responseHeaders); },
        onerror:function(){ cb(false,'无法访问图床'); } });
    } else {
      fetch(BASE+'/',{credentials:'include'}).then(function(r){return r.text();}).then(function(t){onPage(t,'');}).catch(function(){ cb(false,'无法访问图床'); });
    }
  }
  getToken();
}
function ubbInjectStyle(){ if(document.getElementById('mt-ubb-style'))return;
  var st=document.createElement('style'); st.id='mt-ubb-style';
  st.textContent='#mt-ubb-bar{display:flex;flex-wrap:wrap;gap:4px;padding:6px 10px;background:#f5f7fa;border:1px solid #e5e5e5;border-bottom:none;}'+
    '#mt-ubb-bar .ub{display:inline-block;padding:3px 8px;border:1px solid #d0d0d0;border-radius:3px;background:#fff;color:#333;font-size:12px;line-height:16px;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;}'+
    '#mt-ubb-bar .ub:active{background:#1e88e5;color:#fff;border-color:#1e88e5;}';
  (document.head||document.documentElement).appendChild(st); }
function ubbBuildBar(){ var ta=document.getElementById('needmessage'); if(!ta)return null;
  if(document.getElementById('mt-ubb-bar'))return document.getElementById('mt-ubb-bar');
  ubbInjectStyle();
  var bar=document.createElement('div'); bar.id='mt-ubb-bar';
  var list=ubbList();
  for(var i=0;i<list.length;i++){ (function(item){
    var b=document.createElement('span'); b.className='ub'; b.textContent=item.name;
    b.addEventListener('click',function(){
      if(item.type==='image'){ mtImageDialog(); return; }
      if(item.type==='color'){ mtColorDialog(); return; }
      if(item.type==='rainbow'){ mtRainbowApply(); return; }
      if(item.type==='url'){ mtLinkDialog('URL'); return; }
      if(item.type==='email'){ mtLinkDialog('Email'); return; }
      if(item.type==='size'){ mtSizeDialog(); return; }
      if(item.type==='align'){ mtAlignMenu(); return; }
      if(item.type==='media'){ mtMediaDialog(); return; }
      var seg=item.ins(); if(!seg||!seg.length)return;
      var sel=ubbSelText();
      if(sel){ ubbChangeText('needmessage',seg[0],seg[1]); }
      else { var ta2=document.getElementById('needmessage'); ubbInsertText(ta2,seg[0]+seg[1]); }
    });
    bar.appendChild(b);
  })(list[i]); }
  if(ta.parentNode)ta.parentNode.insertBefore(bar,ta); else ta.insertAdjacentElement('beforebegin',bar);
  return bar; }
function ubbBar(){ if(!on('ubbBar'))return; if(window.__ubbDone)return; window.__ubbDone=true;
  function tryBuild(){ var ta=document.getElementById('needmessage'); if(ta&&!document.getElementById('mt-ubb-bar'))ubbBuildBar(); }
  tryBuild();
  var mo=new MutationObserver(function(){ clearTimeout(window.__ubbT); window.__ubbT=setTimeout(tryBuild,300); });
  mo.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('focus',function(){setTimeout(tryBuild,100);},true); }

// ========== 启动 ==========
function init(){
  buildPanel();
  autoSign();
  urlLink();
  copyCode();
  autoPage();
  guideNext();
  autoReply();
  hideOnly();
  personalBlack();
  ubbBar();
}
if(document.readyState==='complete'||document.readyState==='interactive'){ init(); }
else { window.addEventListener('DOMContentLoaded', init); }
window.addEventListener('load', function(){
  // 侧边栏可能是动态渲染的，稍后重试确保面板注入成功
  setTimeout(buildPanel, 400);
  setTimeout(buildPanel, 1500);
  setTimeout(buildPanel, 3500);
  // DOM 变化兜底：导航项异步渲染时也能及时重排到面板之后
  // 关键：加防抖 + 用 requestAnimationFrame 合并，避免 reorderNav 改 DOM 又与自身互相触发导致死循环
  try{
    var _moT=null;
    var _mo=new MutationObserver(function(){
      if(_moT)return; // 已有待处理任务，合并
      _moT=setTimeout(function(){ _moT=null; reorderNav(); }, 200);
    });
    _mo.observe(document.documentElement,{childList:true,subtree:true});
  }catch(e){}
  // ===== 临时诊断浮窗（排查侧边栏滚动，确认后删除）=====
  setTimeout(mtScrollDiag2, 3500);
});
function mtScrollDiag2(){
  try{
    var box=document.querySelector('.comiis_sidenv_box');
    var ul=document.querySelector('.comiis_left_Touch.bdew');
    var lines=[];
    function fmt(el,nm,extra){
      if(!el){ lines.push(nm+': NULL'); return; }
      var cs=getComputedStyle(el);
      lines.push(nm+': '+el.tagName+'.'+(el.className||'').toString().split(' ').join('.')+
        ' pos='+cs.position+' h='+cs.height+' clientH='+el.clientHeight+' scrollH='+el.scrollHeight+' ov='+cs.overflowY+
        (extra?(' '+extra):''));
    }
    if(box){
      var p=box;
      var chain=[];
      while(p && p!==document.documentElement){ chain.push(p); p=p.parentElement; }
      for(var i=chain.length-1;i>=0;i--){ fmt(chain[i], 'L'+(chain.length-1-i)); }
    } else { lines.push('NO .comiis_sidenv_box'); }
    lines.push('---');
    fmt(ul,'UL.bdew');
    fmt(box,'box');
    var d=document.createElement('div');
    d.style.cssText='position:fixed;right:8px;bottom:8px;z-index:2147483647;background:rgba(0,0,0,.85);color:#0f0;font:11px/1.5 monospace;padding:10px;max-width:95vw;max-height:80vh;overflow:auto;white-space:pre;border-radius:6px;';
    d.textContent='【滚动诊断v2】\n'+lines.join('\n');
    document.body.appendChild(d);
  }catch(e){}
}
})();
