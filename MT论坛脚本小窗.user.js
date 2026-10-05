// ==UserScript==
// @name         MT论坛移动端网页版增强
// @namespace    https://bbs.binmt.cc/
// @version 1.0.29
// @description  在侧边栏注入 12项功能独立开关
// @match        https://bbs.binmt.cc/*
// @match        http://bbs.binmt.cc/*
// @connect      img.binmt.cc
// @connect      https://img.binmt.cc
// @connect      icdn.binmt.cc
// @connect      https://icdn.binmt.cc
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==

(function () {
'use strict';
var S = {
  get: function(k,d){ try{var v=(typeof GM_getValue==='function')?GM_getValue(k,null):null; if(v==null)v=localStorage.getItem('mt_'+k); return (v==null)?d:v;}catch(e){return d;} },
  set: function(k,v){ try{if(typeof GM_setValue==='function')GM_setValue(k,v);}catch(e){} try{localStorage.setItem('mt_'+k,v);}catch(e){} }
};
// 活动文档上下文：UBB 相关函数全部通过 MTDOC/MTWIN 定位元素，
// 默认等于本脚本所在 window（顶层页或 iframe 自身）。父页向小窗 iframe 注入时，
// 会临时把这些切换到 iframe 的 document/window，从而复用同一套完整逻辑（弹窗/上传/重写按钮）。
var MTDOC=document, MTWIN=window;
var FEATS=[
 {key:'autoSign',name:'自动签到',desc:'打开网页自动签到'},
 {key:'urlLink',name:'URL超链接',desc:'链接自动转超链接'},
 {key:'copyCode',name:'代码复制按钮',desc:'代码块一键复制'},
 {key:'autoPage',name:'评论自动上下页',desc:'自动加载上下页评论'},
 {key:'guideNext',name:'导读自动下一页',desc:'滚动到底自动加载'},
 {key:'autoReply',name:'隐藏帖自动回复',desc:'自动回复并解锁'},
 {key:'hideOnly',name:'只看隐藏贴',desc:'仅显示含隐藏内容帖',def:false},
 {key:'personalBlack',name:'个人小黑屋',desc:'按uid隐藏帖子',def:false},
 {key:'ubbBar',name:'UBB快捷输入栏',desc:'论坛输入时显示UBB代码按钮'},
  {key:'autoExpand',name:'帖子自动展开',desc:'自动展开帖子完整内容'},
   {key:'latestPost',name:'导读最新帖子',desc:'导读顶部显示最新发布帖子'},
   {key:'smallWindow',name:'小窗浏览帖子',desc:'点击帖子从底部滑入打开'},
   {key:'autoOpenRebox',name:'小窗自动展开回复框',desc:'小窗打开后自动展开底部回复框(默认关)',def:false},
   {key:'replyRedirect',name:'回复跳独立页',desc:'点击回复直接进入独立回复页(非源脚本功能,默认关)',def:false}
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
    '.mt-black-mgr{flex:none;margin-left:8px;font-size:12px;color:#3a76f0;padding:2px 8px;border:1px solid #3a76f0;border-radius:4px;cursor:pointer;white-space:nowrap;}'+
    '.mt-black-btn{flex:none;margin-left:6px;font-size:11px;padding:2px 6px;border-radius:3px;cursor:pointer;white-space:nowrap;vertical-align:middle;}'+
    '.mt-black-add{color:#e53935;border:1px solid #e53935;background:transparent;}'+
    '.mt-black-ok{color:#999;border:1px solid #ccc;background:transparent;}';
  (document.head||document.documentElement).appendChild(st);
}
function buildPanel(){
  var box=document.querySelector('.comiis_sidenv_box'); if(!box)return;
  var ul=box.querySelector('UL.comiis_left_Touch.bdew');
  // 收集原有的导航项（首页/社区/导读/休闲灌水/签到/排行/标签/搜索/访问推广等），
  // 保留它们，但后面会把它们整体移动到功能开关面板之后。
  var navLis=[];
  if(ul){ var lis=ul.querySelectorAll('li.comiis_left_Touch');
    for(var i=0;i<lis.length;i++){ navLis.push(lis[i]); } }
  // UL 原先有固定高度，清掉它，让「面板 + 导航项」自然撑开
  if(ul){ ul.style.height='auto'; ul.style.flex='none'; }
  // 让侧边栏列表容器可滚动，避免面板被 overflow:hidden 裁剪
  try{ var sl=ul?ul.parentNode:null; if(sl){ var cs=getComputedStyle(sl);
      if(cs.overflowY==='hidden'||cs.overflowY==='visible'){ sl.style.overflowY='auto'; }
      sl.style.webkitOverflowScrolling='touch'; } }catch(e){}
  if(document.getElementById('mt-feat-panel'))return;
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
    row.appendChild(nm);
    // 个人小黑屋：在「个人小黑屋」文字后面追加「管理」按钮，打开本地黑名单列表
    if(f.key==='personalBlack'){
      var mgr=document.createElement('span'); mgr.textContent='管理'; mgr.className='mt-black-mgr';
      mgr.addEventListener('click',function(ev){ if(ev&&ev.stopPropagation)ev.stopPropagation(); openBlackManager(); });
      nm.appendChild(mgr);
    }
    row.appendChild(sw); p.appendChild(row);
  });
  if(ul){ ul.parentNode.insertBefore(p,ul); } else { box.appendChild(p); }
  // 把原有导航项整体移动到功能开关面板之后（append 回 UL 末尾）
  if(ul){
    for(var k=0;k<navLis.length;k++){ if(navLis[k] && navLis[k].parentNode) ul.appendChild(navLis[k]); }
  }
}

// ========== 工具 ==========
function GET(u,cb){
  try{ if(typeof GM_xmlhttpRequest==='function'){ GM_xmlhttpRequest({method:'GET',url:u,onload:function(r){cb(r.status,r.responseText);},onerror:function(){cb(0,'');}}); return; } }catch(e){}
  fetch(u,{credentials:'include'}).then(function(r){return r.text();}).then(function(t){cb(200,t);}).catch(function(){cb(0,'');});
}
function matchesSel(el,sel){
  if(!el||el.nodeType!==1)return false;
  var fn=el.matches||el.webkitMatchesSelector||el.msMatchesSelector;
  if(!fn)return false;
  try{ return !!fn.call(el,sel); }catch(e){ return false; }
}
function pushRoot(list,node){
  if(!node)return;
  if(node===document)node=document.body||document.documentElement;
  if(node&&node.nodeType===3)node=node.parentNode;
  if(!node||node.nodeType!==1)return;
  for(var i=list.length-1;i>=0;i--){
    var cur=list[i];
    if(cur===node||(cur.contains&&cur.contains(node)))return;
    if(node.contains&&node.contains(cur))list.splice(i,1);
  }
  list.push(node);
}
function collectMutationRoots(muts){
  var out=[];
  for(var i=0;i<muts.length;i++){
    var mt=muts[i];
    if(mt.target)pushRoot(out,mt.target);
    var adds=mt.addedNodes||[];
    for(var j=0;j<adds.length;j++)pushRoot(out,adds[j]);
  }
  if(!out.length)pushRoot(out,document.body||document.documentElement);
  return out;
}
function collectScoped(root,selector){
  var out=[],base=root===document?(document.body||document.documentElement):root;
  if(base&&base.nodeType===3)base=base.parentNode;
  if(!base||base.nodeType!==1)return out;
  if(matchesSel(base,selector))pushRoot(out,base);
  var nodes=[];
  try{ nodes=base.querySelectorAll(selector); }catch(e){ nodes=[]; }
  for(var i=0;i<nodes.length;i++)pushRoot(out,nodes[i]);
  return out;
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
    var list=collectScoped(box,sel);
    if(!list.length&&document.body)list=[document.body];
    var re=/(^|[^a-z0-9])(h[\s\S]{0,3}?t[\s\S]{0,3}?t[\s\S]{0,3}?p[\s\S]{0,3}?s?[\s\S]{0,3}?[：:]\/\/[^\s"'<>()（）【】\[\]]+)/gi;
    for(var k=0;k<list.length;k++){ var c=list[k]; if(!c)continue;
      if(c.nodeName==='SCRIPT'||c.nodeName==='STYLE')continue;
      var it=document.createTreeWalker(c,4,null); var texts=[],node;
      while((node=it.nextNode())){ var p=node.parentNode; if(!p)continue;
        if(p.nodeName==='SCRIPT'||p.nodeName==='STYLE'||p.nodeName==='TEXTAREA')continue;
        if(p.closest&&p.closest('a'))continue;
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
  var pend=[];
  function flush(){ window.__urlT=0; var roots=pend.slice(); pend.length=0; for(var i=0;i<roots.length;i++)makeClickable(roots[i]); }
  function queue(root){ pushRoot(pend,root); clearTimeout(window.__urlT); window.__urlT=setTimeout(flush,180); }
  var mo=new MutationObserver(function(muts){ var roots=collectMutationRoots(muts); for(var i=0;i<roots.length;i++)queue(roots[i]); });
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
function collectBlocks(root){ var picked=[];
  function push(b){ if(!b||!b.nodeName)return; if(b.nodeName==='SCRIPT'||b.nodeName==='STYLE')return;
    if(b.getAttribute&&b.getAttribute('data-mt-copy')==='1')return;
    if(b.nodeName==='BLOCKQUOTE'||(b.closest&&b.closest('blockquote')))return;
    for(var k=0;k<picked.length;k++){ if(picked[k]!==b&&(picked[k].contains(b)||b.contains(picked[k])))return; } picked.push(b); }
  var sel='pre,.blockcode,.comiis_blockcode,.comiis_code,.codeblock';
  var blocks=collectScoped(root||document,sel);
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
function addCopyButtons(root){ try{ var p=collectBlocks(root); for(var n=0;n<p.length;n++)makeButtonFor(p[n]); }catch(e){} }
function copyCode(){ if(!on('copyCode'))return; if(window.__copyDone)return; window.__copyDone=true;
  copyInjectStyle(); addCopyButtons(document);
  var pend=[];
  function flush(){ window.__copyT=0; var roots=pend.slice(); pend.length=0; for(var i=0;i<roots.length;i++)addCopyButtons(roots[i]); }
  function queue(root){ pushRoot(pend,root); clearTimeout(window.__copyT); window.__copyT=setTimeout(flush,180); }
  var mo=new MutationObserver(function(muts){ var roots=collectMutationRoots(muts); for(var i=0;i<roots.length;i++)queue(roots[i]); });
  mo.observe(document.documentElement,{childList:true,subtree:true}); }

// ========== 自动上下页 ==========
function autoPage(){ if(!on('autoPage'))return; if(window.__autoPage)return;
  // 兼容两种 URL 格式：伪静态 /thread-{tid}-{page}-1.html 与动态 /forum.php?mod=viewthread&tid={tid}&page={page}
  if(!/thread-\d+/.test(location.pathname) && !/mod=viewthread/i.test(location.search))return; window.__autoPage=true;
  var isStatic=/thread-\d+/.test(location.pathname);
  var ITEM_SEL='.comiis_postli.comiis_list_readimgs.nfqsqi';
  var TARGET_SEL='.comiis_postlist.kqide';
  var MULTI_SEL='.comiis_multi_box.bg_f.b_t.b_b.mb10';
  var busy=false, lastLoadAt=0, PAGE_COOL=5000;
  // 页面状态：已加载的页码范围（闭区间）。初始只有当前页。
  var st={min:curPage(),max:curPage(),total:totalPage(),tid:tid()};

  // ---- 从 URL 解析帖子 id 与当前页 ----
  function tid(){ var m=location.pathname.match(/thread-(\d+)/); if(m)return m[1];
    try{var q=new URLSearchParams(location.search); if(q.get('tid'))return q.get('tid');}catch(e){} return ''; }
  function curPage(){ if(isStatic){ var m=location.pathname.match(/thread-\d+-(\d+)-\d/); if(m){var p=parseInt(m[1],10); if(isFinite(p)&&p>0)return p;} }
    else { try{var q=new URLSearchParams(location.search); var pg=q.get('page'); pg=parseInt(pg||'1',10); if(isFinite(pg)&&pg>0)return pg;}catch(e){} }
    var sel=document.querySelector('#dumppage'); if(sel&&sel.selectedIndex>=0)return sel.selectedIndex+1; return 1; }
  function totalPage(){ var sel=document.querySelector('#dumppage'); if(sel&&sel.options){return Math.max(1,sel.options.length);}
    var as=document.querySelectorAll('.comiis_page a'); return 1; }

  // ---- 构造指定页 URL（主用手段，稳定可靠） ----
  // 与原页 URL 格式保持一致：伪静态用 thread-{tid}-{p}-1.html，动态用 forum.php?mod=viewthread&tid={tid}&page={p}
  function pageUrl(p){
    if(isStatic) return 'https://bbs.binmt.cc/thread-'+st.tid+'-'+p+'-1.html';
    var q=new URLSearchParams(location.search); var extra=[];
    // 保留 mobile / from / 等其它参数，避免与原页不一致
    for(var key of ['mobile','from','mobile2']){ if(q.get(key)) extra.push(key+'='+encodeURIComponent(q.get(key))); }
    var s='forum.php?mod=viewthread&tid='+encodeURIComponent(st.tid)+'&page='+p;
    if(extra.length)s+='&'+extra.join('&');
    return new URL(s,location.origin).href;
  }

  // ---- 分页条里所有 <a>（按顺序：上一页 / 页码select / 下一页），仅作兜底 ----
  function pagerLinks(){ var box=document.querySelector(MULTI_SEL); if(!box)return [];
    var as=box.querySelectorAll('a.bg_f.b_ok'); var out=[];
    for(var i=0;i<as.length;i++){ var h=(as[i].getAttribute('href')||'');
      if(/javascript/i.test(h)||!h){ out.push(''); continue; }
      // 仅保留可解析出「上一页/下一页」页码的链接
      var pm=h.match(/thread-(\d+)-(\d+)-\d/);
      if(pm)out.push({url:(/^https?:\/\//i.test(h)?h:new URL(h,location.origin).href),page:parseInt(pm[2],10)});
      else out.push(null); }
    return out; }

  // 上一页 URL：优先 pageUrl 构造；若构造结果无效，回退到分页条中页码 = st.min-1 的链接
  function prevUrl(){ var need=st.min-1; if(need<1){ return ''; }
    var links=pagerLinks();
    for(var i=0;i<links.length;i++){ if(links[i]&&links[i].page===need)return links[i].url; }
    return pageUrl(need); }

  // 下一页 URL：优先 pageUrl 构造；若构造结果无效，回退到分页条中页码 = st.max+1 的链接
  function nextUrl(){ var need=st.max+1; if(need>st.total)return '';
    var links=pagerLinks();
    for(var i=0;i<links.length;i++){ if(links[i]&&links[i].page===need)return links[i].url; }
    return pageUrl(need); }

  // ---- 从抓取的 HTML 中提取评论项与分页条 ----
  function parseHtml(html){ var tmp=document.createElement('div'); tmp.innerHTML=html;
    var items=tmp.querySelectorAll(ITEM_SEL);
    return {items:items}; }

  // 获取当前列表容器
  function target(){ return document.querySelector(TARGET_SEL); }

  // 收集当前已存在的 pid 集合
  // 提取评论项的去重键：优先真实 pid（id 尾随数字），否则退化为「楼层号 + 内容指纹」兜底
  function itemKey(it){
    var id=it.id||''; var m=id.match(/(\d+)$/); if(m)return 'pid:'+m[1];
    // 兜底：用内容文本 hash，避免 id 无数字尾导致 key 为空、去重完全失效
    var txt=(it.textContent||'').replace(/\s+/g,' ');
    if(txt.length>200)txt=txt.slice(0,200);
    return 'hash:'+txt;
  }
  function existingPids(){ var o={}; var t=target(); if(!t)return o;
    var ns=t.querySelectorAll(ITEM_SEL);
    for(var i=0;i<ns.length;i++){ var k=itemKey(ns[i]); if(k)o[k]=1; }
    return o; }

  // 去重后插入：prepend=true 插到最前，否则追加到末尾
  function insertItems(items,prepend){ var t=target(); if(!t)return 0;
    var seen=existingPids(); var n=0;
    var arr=Array.prototype.slice.call(items);
    if(prepend)arr.reverse();
    // 批量插入：用 DocumentFragment 一次性挂载，避免逐条 insertBefore 造成的多次重排/顿挫
    var frag=document.createDocumentFragment();
    for(var i=0;i<arr.length;i++){ var it=arr[i]; var key=itemKey(it);
      if(key&&seen[key])continue; if(key)seen[key]=1; n++;
      frag.appendChild(it); }
    if(prepend)t.insertBefore(frag,t.firstChild); else t.appendChild(frag);
    return n; }

  // ---- 向下加载（下一页，追加到末尾） ----
  var loadedPages={}; // 已成功抓取过的页号集合，防「分页错位导致同一页被抓两次」
  function loadNext(){ if(busy)return; if(st.max>=st.total)return; if(Date.now()-lastLoadAt<PAGE_COOL)return;
    var need=st.max+1;
    if(loadedPages[need]){ st.max=need; return; } // 该页已加载过，直接跳过不重复抓
    busy=true; lastLoadAt=Date.now();
    var u=nextUrl()||pageUrl(need);
    fetch(u,{credentials:'include'}).then(function(r){return r.text();}).then(function(html){ busy=false;
      var p=parseHtml(html);
      if(!p.items.length)return;
      loadedPages[need]=1;
      st.max++;
      insertItems(p.items,false);
    }).catch(function(){busy=false;}); }

  // ---- 向上加载（上一页，前插到开头） ----
  var prevCool=0; // 向上加载后的冷却时间戳，防止前插后立即再次触发 atTop
  function loadPrev(){ if(busy)return; if(st.min<=1)return; if(Date.now()-lastLoadAt<PAGE_COOL)return;
    var need=st.min-1;
    if(loadedPages['p'+need]){ st.min=need; return; } // 该页已加载过，跳过
    busy=true; lastLoadAt=Date.now();
    var u=prevUrl(); if(!u)u=pageUrl(need);
    fetch(u,{credentials:'include'}).then(function(r){return r.text();}).then(function(html){ busy=false;
      var p=parseHtml(html);
      if(!p.items.length)return;
      loadedPages['p'+need]=1;
      var t=target();
      var anchor=t?t.firstElementChild:null;
      // 前插前：记录锚点（原第一条，如131#）相对视口顶部的偏移量，
      // 以及文档当前滚动位置，用于插入后把它恢复到完全相同的位置，做到「原地无缝」
      var offset=anchor?anchor.getBoundingClientRect().top:0;
      var oldScroll=window.pageYOffset||document.documentElement.scrollTop||0;
      st.min--;
      var inserted=insertItems(p.items,true);
      // 前插会让锚点下移 inserted 条的高度；
      // 用「锚点当前绝对位置 - 前插前它相对视口的偏移」直接锁定回原视觉位置。
      // 用带小数的一次性 scrollTo 保持亚像素精度，避免多次补正造成的抖动。
      if(inserted>0 && anchor){
        var newTop=anchor.getBoundingClientRect().top+(window.pageYOffset||document.documentElement.scrollTop||0)-offset;
        window.scrollTo(0, newTop);
      } else if(inserted>0){
        // 无锚点时兜底：保持原滚动位置不变（不额外跳动）
        window.scrollTo(0, oldScroll);
      }
      prevCool=Date.now(); // 仅成功前插后才进入冷却，避免「未加载成功却锁死」
    }).catch(function(){busy=false;}); }

  // ---- 滚动触发 ----
  var raf=null;
  function schedule(){ if(raf)return;
    raf=requestAnimationFrame(function(){ raf=null;
      var d=document.documentElement;
      var atBottom=(d.scrollHeight-d.scrollTop-d.clientHeight)<500;
      // 放宽顶部阈值：锚点可能把 scrollTop 停在中部，但只要列表顶距视口足够近就算「靠近顶部」
      var listTopAt=(function(){ var t=target(); return t?t.getBoundingClientRect().top:Infinity; })();
      var atTop=(d.scrollTop<200) || (listTopAt>-300 && listTopAt<300);
      var cooled=(Date.now()-prevCool)<400; // 前插后 400ms 内抑制向上加载，防止连环翻页又不过度锁死
      // 独立判断（不再用 else if 互斥）：靠近底部加载下一页，靠近顶部加载上一页，
      // 避免「锚点居中时 atBottom 吞掉向上加载」的问题
      if(atBottom)loadNext();
      if(atTop && !cooled)loadPrev();
    }); }
  window.addEventListener('scroll',schedule,{passive:true});
  // 补充触发点：手指/滚动停止（touchend、scroll 静止）后再判断一次，
  // 修复「快速滑动在顶部停留过短而错过 rAF 触发窗口」的问题
  function settle(){
    clearTimeout(window.__mtSettle);
    window.__mtSettle=setTimeout(function(){ schedule(); },120);
  }
  window.addEventListener('touchend',settle,{passive:true});
  window.addEventListener('scroll',settle,{passive:true});

  // 初始：若内容不足以撑满一屏，主动向下加载
  setTimeout(function(){ var d=document.documentElement;
    if(target()&&d.scrollHeight<=d.clientHeight+500 && st.max<st.total)loadNext(); },800);
}

// ========== 导读自动上下页 ==========
function guideNext(){ if(!on('guideNext'))return; if(!/mod=guide/.test(location.href))return; if(window.__guideNext)return; window.__guideNext=1;
  var LIST='.comiis_forumlist',ITEM='li.forumlist_li',DIST=900,busy=false,lastLoadAt=0,PAGE_COOL=5000;
  // 页面状态：已加载的页码范围（闭区间）。初始只有当前页。
  var st={min:curPage(),max:curPage(),total:totalPage()};

  // ---- 解析当前页 / 总页数 ----
  function curPage(){ var sel=document.querySelector('#dumppage');
    if(sel&&sel.selectedIndex>=0)return sel.selectedIndex+1;
    try{ var cp=new URLSearchParams(location.search).get('page'); cp=parseInt(cp||'1',10); if(isFinite(cp)&&cp>0)return cp; }catch(e){}
    return 1; }
  function totalPage(){ var sel=document.querySelector('#dumppage');
    if(sel&&sel.options)return Math.max(1,sel.options.length);
    return 1; }
  // 从 URL 解析 view 与 index 参数，用于构造分页 URL
  function param(k,d){ try{var v=new URLSearchParams(location.search).get(k); return v||d;}catch(e){return d;} }
  function qs(p){ var q=new URLSearchParams(); q.set('mod','guide');
    var idx=param('index',''); if(idx)q.set('index',idx);
    q.set('view',param('view','newthread')); q.set('page',String(p));
    return 'https://bbs.binmt.cc/forum.php?'+q.toString(); }

  function curList(){return document.querySelector(LIST);}

  // 收集当前已存在的帖子链接集合（去重键）
  function existingKeys(){ var o={}; var d=curList(); if(!d)return o;
    var ex=d.querySelectorAll(ITEM);
    for(var i=0;i<ex.length;i++){ var key=itemKey(ex[i]); if(key)o[key]=1; }
    return o; }
  function itemKey(it){ var a=it.querySelector('a[href*="thread-"],a[href*="tid="]'); return a?a.href:''; }

  // 去重后插入：prepend=true 插到最前，否则追加到末尾
  function insertItems(items,prepend){ var d=curList(); if(!d)return 0;
    var seen=existingKeys(); var n=0;
    var arr=Array.prototype.slice.call(items);
    if(prepend)arr.reverse();
    var frag=document.createDocumentFragment();
    for(var i=0;i<arr.length;i++){ var it=arr[i]; var key=itemKey(it);
      if(key&&seen[key])continue; if(key)seen[key]=1; n++;
      frag.appendChild(it); }
    if(prepend)d.insertBefore(frag,d.firstChild); else d.appendChild(frag);
    return n; }

  // 从抓取 HTML 中提取列表项
  function parseItems(html){ var tmp=document.createElement('div'); tmp.innerHTML=html;
    var src=tmp.querySelector(LIST);
    return src?src.querySelectorAll(ITEM):[]; }

  // ---- 向下加载（下一页，追加到末尾） ----
  function loadNext(){ if(busy)return; if(st.max>=st.total)return; if(Date.now()-lastLoadAt<PAGE_COOL)return; busy=true; lastLoadAt=Date.now();
    var need=st.max+1;
    fetch(qs(need),{credentials:'include'}).then(function(r){return r.text();}).then(function(html){ busy=false;
      var items=parseItems(html);
      if(!items.length)return;
      st.max++;
      insertItems(items,false);
    }).catch(function(){busy=false;}); }

  // ---- 滚动触发 ----
  var raf=null; function check(){ if(raf)return; raf=requestAnimationFrame(function(){ raf=null;
    var d=document.documentElement;
    var atBottom=(d.scrollHeight-d.scrollTop-d.clientHeight)<DIST;
    if(atBottom)loadNext(); }); }
  window.addEventListener('scroll',check,{passive:true});
  // 初始：若内容不足以撑满一屏，主动向下加载
  setTimeout(function(){ var d=document.documentElement;
    if(curList()&&d.scrollHeight<=d.clientHeight+DIST && st.max<st.total)loadNext(); },1200);
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
  var RIK='mtar_reply_index',DP='mtar_done_v11_',LRK='mtar_last_reply',FM=90000,PK='mtar_pending',FUK='mtar_flood_until_',RCM={};
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
  function lockedPids(){ var o={}; var ns=document.querySelectorAll('.comiis_quote,.locked,div.locked,.t_f,.postmessage,.comiis_postli');
    for(var i=0;i<ns.length;i++){ var t=ns[i].textContent||''; if(!/查看本帖隐藏内容请回复|回复本帖即可查看/.test(t))continue;
      var el=ns[i]; for(var j=0;j<12&&el;j++){ var id=el.id||''; if(/^(pid|post_)\d+$/.test(id)){ var p=id.replace(/\D/g,''); if(p)o[p]=1; break; } el=el.parentElement; }
    }
    return Object.keys(o); }
  function hasMine(u){ if(!u)return false; var cs=document.querySelectorAll('div[id^="pid"],div[id^="post_"],div.comiis_postli');
    for(var i=0;i<cs.length;i++){ var c=cs[i]; if(!c.querySelector)continue; var aa=c.querySelector('a[href*="space-uid-"],a[href*="uid="]');
      if(!aa)continue; var h=aa.getAttribute('href')||''; var m=h.match(/space-uid-(\d+)/)||h.match(/[?&]uid=(\d+)/); if(m&&m[1]===u)return true; } return false; }
  function isMobile(){ return !!document.getElementById('needmessage')&&!!document.getElementById('fastpostform'); }
  function done(t){ try{return !!localStorage.getItem(DP+ts()+'_'+t);}catch(e){return false;} }
  function markDone(t){ try{localStorage.setItem(DP+ts()+'_'+t,'1');}catch(e){} }
  function pend(t){ try{var v=parseInt(sessionStorage.getItem(PK+'_'+t)||'0',10); if(!v||Date.now()-v>60000){sessionStorage.removeItem(PK+'_'+t);return false;} return true;}catch(e){return false;} }
  function setPend(t,o){ try{if(o)sessionStorage.setItem(PK+'_'+t,String(Date.now()));else sessionStorage.removeItem(PK+'_'+t);}catch(e){} }
  function floodUntil(t){ try{var v=parseInt(localStorage.getItem(FUK+t)||'0',10);return isFinite(v)?v:0;}catch(e){return 0;} }
  function setFlood(t,ms){ try{if(ms>0)localStorage.setItem(FUK+t,String(Date.now()+ms));else localStorage.removeItem(FUK+t);}catch(e){} }
  function parseFloodWait(txt){
    var s=String(txt||''); var m=s.match(/(?:少于|间隔|等待|剩余|请(?:稍候|稍后))[^\d]{0,30}(\d+)\s*秒/i);
    if(!m)m=s.match(/(\d+)\s*秒/i);
    var n=m?parseInt(m[1],10):30; if(!isFinite(n)||n<1)n=30; if(n>3600)n=3600; return n;
  }
  function submit(cb){ var f=document.getElementById('fastpostform'),mb=document.getElementById('needmessage');
    if(!f||!mb){cb({ok:false,fl:false,fs:0});return;}
    var act=(f.getAttribute('action')||'').replace(/&amp;/g,'&'); if(!act){cb({ok:false,fl:false,fs:0});return;}
    var url=act+(act.indexOf('?')>=0?'&':'?')+'handlekey=fastpost&loc=1&inajax=1';
    var fd=new URLSearchParams(); fd.set('formhash',f.elements.formhash?f.elements.formhash.value:'');
    if(f.elements.noticeauthor)fd.set('noticeauthor',f.elements.noticeauthor.value||'');
    fd.set('message',rt()); fd.set('replysubmit','回复');
    var x=new XMLHttpRequest(),ended=false;
    function finish(v){if(ended)return;ended=true;cb(v);}
    try{x.open('POST',url,true);x.withCredentials=true;x.setRequestHeader('Content-Type','application/x-www-form-urlencoded');x.setRequestHeader('X-Requested-With','XMLHttpRequest');
      x.onreadystatechange=function(){if(x.readyState!==4)return;var txt=x.responseText||'',isFlood=/两次发表间隔少于|间隔少于\s*\d+\s*秒|请稍候再发表|请稍后再发表|灌水/i.test(txt);
        var ok=x.status===200&&/succeedhandle_fastpost|回复发布成功/.test(txt)&&!/errorhandle_fastpost/.test(txt)&&!isFlood;
        finish({ok:ok,fl:isFlood,fs:isFlood?parseFloodWait(txt):0});};
      x.onerror=function(){finish({ok:false,fl:false,fs:0});}; x.ontimeout=function(){finish({ok:false,fl:false,fs:0});}; x.timeout=20000; x.send(fd.toString());
    }catch(e){finish({ok:false,fl:false,fs:0});}}
  function viewpidHtml(t,p,cb){ var x=new XMLHttpRequest(),doneX=false;
    function finish(v){if(doneX)return;doneX=true;cb(v);}
    try{x.open('POST','forum.php?mod=viewthread&tid='+encodeURIComponent(t)+'&viewpid='+encodeURIComponent(p)+'&mobile=2',true);x.withCredentials=true;
      x.setRequestHeader('Content-Type','application/x-www-form-urlencoded');x.setRequestHeader('X-Requested-With','XMLHttpRequest');
      x.onreadystatechange=function(){if(x.readyState!==4)return;if(x.status!==200){finish('');return;}var raw=x.responseText||'',m=raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);finish(m?m[1]:raw);};
      x.onerror=function(){finish('');};x.ontimeout=function(){finish('');};x.timeout=15000;x.send('');
    }catch(e){finish('');}}
  function replaceFloor(t,p,cb){ viewpidHtml(t,p,function(html){ if(!html||html.indexOf('id="pid'+p)<0){cb(false);return;}
      var tg=document.getElementById('pid'+p)||document.getElementById('post_'+p); if(!tg){cb(false);return;}
      try{var fr=document.createElement('div');fr.innerHTML=html;var n=fr.querySelector('#pid'+p)||fr.querySelector('#post_'+p)||fr.firstElementChild;if(!n){cb(false);return;}tg.outerHTML=n.outerHTML;cb(true);}catch(e){cb(false);}});
  }
  function unlock(t,ps,cb){ if(!ps||!ps.length){cb(true);return;} var arr=ps.slice(),idx=0,okn=0;
    function one(){ if(idx>=arr.length){cb(okn===arr.length);return;} var p=arr[idx++];
      replaceFloor(t,p,function(ok){if(ok)okn++; setTimeout(one,1200+Math.floor(Math.random()*1800));}); }
    one(); }
  function scheduleRun(t,ms){ clearTimeout(window.__mtarTimer); window.__mtarTimer=setTimeout(function(){setPend(t,false);run();},Math.max(1000,ms)); }
  function scheduleUnlock(t,ps,attempt){ clearTimeout(window.__mtarUnlockTimer);
    window.__mtarUnlockTimer=setTimeout(function(){if(!hasLocked())return;unlock(t,ps,function(ok){if(ok&&!hasLocked())return;
      if(attempt<5){scheduleUnlock(t,lockedPids(),attempt+1);}else{setTimeout(function(){if(hasLocked())location.reload();},1500);}});},attempt===0?300:Math.min(8000,1500*attempt));}
  function run(){ var t=tid(); if(!t||!isMobile()||!hasLocked())return; var u=uid(); if(!u||u==='0')return;
    var ps=lockedPids();
    if(done(t)){unlock(t,ps,function(ok){if(!ok||hasLocked())scheduleUnlock(t,lockedPids(),1);});return;}
    if(pend(t))return;
    var fu=floodUntil(t),now=Date.now(); if(fu>now){scheduleRun(t,fu-now+500+Math.floor(Math.random()*1000));return;}
    var f=document.getElementById('fastpostform'); if(f&&(f.querySelector('[name="seccodeverify"]')||f.querySelector('[name="secqaa"]')))return;
    if(hasMine(u)){markDone(t);unlock(t,ps,function(ok){if(!ok||hasLocked())scheduleUnlock(t,lockedPids(),1);});return;}
    setPend(t,true);
    setTimeout(function(){try{
      if(!hasLocked()){setPend(t,false);return;}
      var mb=document.getElementById('needmessage'); if(mb&&mb.value&&mb.value.trim()&&mb.value.trim()!==rt()){setPend(t,false);return;}
      var lr=parseInt(localStorage.getItem(LRK)||'0',10),since=Date.now()-lr;
      if(since<FM){setPend(t,false);scheduleRun(t,FM-since+Math.floor(Math.random()*1000));return;}
      submit(function(res){setPend(t,false);
        if(res.ok){markDone(t);adv();setFlood(t,0);try{localStorage.setItem(LRK,String(Date.now()));}catch(e){}
          unlock(t,lockedPids(),function(ok){if(!ok||hasLocked())scheduleUnlock(t,lockedPids(),1);});return;}
        if(res.fl){var wait=res.fs*1000+10000+Math.floor(Math.random()*10000);setFlood(t,wait);scheduleRun(t,wait+500);return;}
        var failWait=300000+Math.floor(Math.random()*120000); setFlood(t,failWait); scheduleRun(t,failWait+1000);
      });
    }catch(e){setPend(t,false);scheduleRun(t,5000);}},0);}
  function start(){if(!/thread-\d+/.test(location.pathname)&&!/mod=viewthread/i.test(location.search))return;run();}
  if(document.readyState==='complete'||document.readyState==='interactive')start();else window.addEventListener('DOMContentLoaded',start);
  window.addEventListener('pageshow',function(){setTimeout(run,300);});
  window.addEventListener('focus',function(){setTimeout(run,300);});
  document.addEventListener('visibilitychange',function(){if(!document.hidden)setTimeout(run,300);});
}
// ========== 只看隐藏贴 ==========
function hideOnly(){ if(!on('hideOnly'))return; if(window.__hideOnly)return;
  if(/\/thread-[^\/]+\.html/i.test(location.pathname))return; window.__hideOnly=true;
  var Q=[],active=0,MAX=1;
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
  function scan(root){ var links=collectScoped(root||document,'a[href*="thread-"],a[href*="mod=viewthread"]');
    for(var i=0;i<links.length;i++){ var n=links[i],c=itemOf(n);
      if(!c||c===document.body||c===document.documentElement||c.getAttribute('data-mt-hide-filtered'))continue;
      var u=n.href; if(!u)continue; c.setAttribute('data-mt-hide-filtered','checking'); c.style.display=''; mark(c,'检测中'); Q.push({c:c,u:u}); } pump(); }
  var pend=[];
  function flush(){ window.__hoT=0; var roots=pend.slice(); pend.length=0; for(var i=0;i<roots.length;i++)scan(roots[i]); }
  function queue(root){ pushRoot(pend,root); clearTimeout(window.__hoT); window.__hoT=setTimeout(flush,180); }
  window.__hideScan=function(root){ queue(root||document.body||document.documentElement); };
  scan(document);
  setTimeout(function(){ queue(document.body||document.documentElement); },500);
  setTimeout(function(){ queue(document.body||document.documentElement); },1500);
  if(!window.__hoObs){ window.__hoObs=new MutationObserver(function(muts){ var roots=collectMutationRoots(muts); for(var i=0;i<roots.length;i++)queue(roots[i]); }); window.__hoObs.observe(document.documentElement,{childList:true,subtree:true}); }
}

// ========== 个人小黑屋 ==========
function personalBlack(){ if(!on('personalBlack'))return; if(window.__pBlack)return; window.__pBlack=true;
  var KEY='personalBlackList',TKEY='mtThreadOwner';
  var ITEM_SEL='.comiis_forumlist .forumlist_li, .comiis_postlist .comiis_postli, #threadlist .forumlist_li, li.normalthread_, li.forumlist_li, li.comiis_postli';
  // 仅「帖子列表」项（导读/版块列表），用于注入拉黑按钮——不在帖子内评论列表里加按钮
  var LIST_ITEM_SEL='.comiis_forumlist .forumlist_li, #threadlist .forumlist_li, li.normalthread_, li.forumlist_li';
  function readOwners(){ try{var v=localStorage.getItem(TKEY);if(!v)return{};var o=JSON.parse(v);if(!o||typeof o!=='object'||Object.prototype.toString.call(o)==='[object Array]')return{};return o;}catch(e){return{};} }
  function writeOwners(o){ try{localStorage.setItem(TKEY,JSON.stringify(o));}catch(e){} }
  function itemOf(n){ var p=n&&n.nodeType===1?n:(n&&n.parentNode); while(p&&p!==document.body){ if(matchesSel(p,ITEM_SEL))return p; p=p.parentElement; } return null; }
  function collectItems(root){
    var out=[],base=root===document?(document.body||document.documentElement):root;
    if(base&&base.nodeType===3)base=base.parentNode;
    if(!base||base.nodeType!==1)return out;
    var cur=itemOf(base); if(cur)pushRoot(out,cur);
    var nodes=collectScoped(base,ITEM_SEL);
    for(var i=0;i<nodes.length;i++)pushRoot(out,nodes[i]);
    return out;
  }
  function threadIdOf(it){ var as=it.querySelectorAll('a[href*="thread-"]'); for(var i=0;i<as.length;i++){var h=as[i].getAttribute('href')||'';var m=h.match(/thread-(\d+)/);if(m)return m[1];}return null; }
  function threadIdsIn(it){ var out=[],as=it.querySelectorAll('a[href*="thread-"]'); for(var i=0;i<as.length;i++){var h=as[i].getAttribute('href')||'';var m=h.match(/thread-(\d+)/);if(m&&out.indexOf(m[1])<0)out.push(m[1]);}return out; }
  function uidOf(a){ if(!a)return null; var h=a.getAttribute('href')||''; var m=h.match(/uid=(\d+)/)||h.match(/space-uid-(\d+)/); if(m)return m[1]; var t=a.getAttribute('data-uid'); if(t)return String(t); return null; }
  function authorAnchor(item){ var u=item.querySelector('a.top_user'); if(u&&uidOf(u))return u;
    var ls=item.querySelectorAll('a[href*="uid="],a[href*="mod=space"]'); var fb=null;
    for(var i=0;i<ls.length;i++){ var a=ls[i]; if(!uidOf(a))continue; var t=(a.textContent||'').trim(); if(t)return a; if(!fb)fb=a; } return fb; }
  function recordOwners(root){ var items=collectItems(root||document),o=null,dirty=false;
    for(var i=0;i<items.length;i++){ var it=items[i]; var tid=threadIdOf(it); if(!tid)continue;
      var a=authorAnchor(it); if(!a)continue; var u=uidOf(a); if(!u||u==='0')continue;
      if(o===null)o=readOwners(); if(o[tid]!==u){o[tid]=u; dirty=true;} }
    if(o!==null&&dirty)writeOwners(o); }
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
      if(typeof e==='string'||typeof e==='number'){out.push({uid:String(e),user:'',avatar:''});}
      else if(typeof e==='object'){ var u=e.uid!=null?e.uid:(e.id!=null?e.id:(e.userid!=null?e.userid:'')); if(u==null||String(u)==='')continue;
        out.push({uid:String(u),user:(e.user||e.username||e.name||''),avatar:(e.avatar||e.avatarUrl||e.face||'')}); } }
    return out; }
  function nativeUidSet(){ var s={}; try{var v=localStorage.getItem('shieldList');if(!v)return s;var a=JSON.parse(v);if(!a)return s;
    if(Object.prototype.toString.call(a)!=='[object Array]')a=[a];
    for(var i=0;i<a.length;i++){var e=a[i];if(!e||typeof e!=='object')continue;if(String(e.option||'')!=='uid')continue;var t=String(e.text==null?'':e.text).replace(/\s+/g,'');if(/^\d+$/.test(t))s[t]=1;}}catch(e){}return s; }
  // 写回本地黑名单（纯本地，不再从服务端拉取）
  function writeList(arr){ try{ var clean=[]; for(var i=0;i<arr.length;i++){ var e=arr[i]; if(!e)continue;
      var u=(typeof e==='object')?(e.uid!=null?String(e.uid):''):String(e);
      if(!/^\d+$/.test(u)||u==='0')continue;
      var user=(typeof e==='object')?(e.user||''):'';
      var avatar=(typeof e==='object')?(e.avatar||''):'';
      var dup=false; for(var j=0;j<clean.length;j++){ if(clean[j].uid===u){ if(user)clean[j].user=user; if(avatar)clean[j].avatar=avatar; dup=true; break; } }
      if(!dup)clean.push({uid:u,user:user,avatar:avatar}); }
    localStorage.setItem(KEY,JSON.stringify(clean)); }catch(e){} }
  // 拉黑某用户（本地黑名单）。user 为可选的显示名，avatar 为可选头像地址。
  function addBlack(uid,user,avatar){ if(!/^\d+$/.test(String(uid))||String(uid)==='0')return; var l=readList();
    var i=l.length; while(i--){ if(l[i].uid===String(uid)){ if(user)l[i].user=user; if(avatar)l[i].avatar=avatar; } }
    if(!l.some(function(e){return e.uid===String(uid);})){ l.push({uid:String(uid),user:user||'',avatar:avatar||''}); }
    writeList(l); }
  // 从本地黑名单中移除某用户
  function removeBlack(uid){ var l=readList(); var out=[]; for(var i=0;i<l.length;i++){ if(String(l[i].uid)!==String(uid))out.push(l[i]); } writeList(out); }
  function uidSet(){ var s=nativeUidSet(); var l=readList(); for(var i=0;i<l.length;i++)s[l[i].uid]=1; return s; }
  function applyFilter(root){ var set=uidSet(); var owners=readOwners(); var items=collectItems(root||document);
    for(var i=0;i<items.length;i++){ var it=items[i]; var hit=false;
      var as=it.querySelectorAll('a[href*="uid="],a[href*="space-uid-"],a[href*="mod=space"]'); for(var k=0;k<as.length;k++){var u=uidOf(as[k]);if(u&&set[u]){hit=true;break;}}
      if(!hit){ var tids=threadIdsIn(it); for(var t=0;t<tids.length;t++){var ow=owners[''+tids[t]]; if(ow&&set[ow]){hit=true;break;}} }
      if(hit){ it.style.display='none'; it.setAttribute('data-mt-black-filtered','1'); }
      else if(it.getAttribute('data-mt-black-filtered')){ it.style.display=''; it.removeAttribute('data-mt-black-filtered'); } }
    addBlockButtons(root); }
  // 在帖子列表每个条目的作者侧注入「拉黑」按钮（纯本地写入黑名单）
  // 仅「帖子列表」项（导读/版块列表）；帖子内评论列表不注入
  function collectListItems(root){ var out=[],base=root===document?(document.body||document.documentElement):root;
    if(base&&base.nodeType===3)base=base.parentNode;
    if(!base||base.nodeType!==1)return out;
    if(matchesSel(base,LIST_ITEM_SEL))pushRoot(out,base);
    var nodes=collectScoped(base,LIST_ITEM_SEL);
    for(var i=0;i<nodes.length;i++)pushRoot(out,nodes[i]);
    return out; }
  // 从帖子列表项中提取用户头像地址（优先真实 img src，回退按 uid 推导 Discuz 头像）
  function avatarOf(item,uid){ var imgs=item.querySelectorAll('img'); var best='';
    for(var i=0;i<imgs.length;i++){ var s=imgs[i].getAttribute('src')||imgs[i].getAttribute('data-src')||imgs[i].getAttribute('data-original')||'';
      if(!s)continue; if(/avatar|face|uc_server|data\/avatar/i.test(s)){ best=s; break; } if(!best)best=s; }
    if(!best&&uid)best='https://bbs.binmt.cc/uc_server/avatar.php?uid='+uid+'&size=middle';
    return best; }
  function addBlockButtons(root){ var items=collectListItems(root||document); var set=uidSet();
    for(var i=0;i<items.length;i++){ (function(it){
      if(it.getAttribute('data-mt-black-btn')==='1')return;
      var a=authorAnchor(it); if(!a||!a.parentNode)return;
      var u=uidOf(a); if(!u||u==='0'||String(u)==='1'){ it.setAttribute('data-mt-black-btn','1'); return; }
      var userName=(a.textContent||'').replace(/\s+/g,'').trim();
      var avatar=avatarOf(it,u);
      var btn=document.createElement('span'); btn.className='mt-black-btn '+(set[u]?'mt-black-ok':'mt-black-add');
      btn.textContent=set[u]?'已拉黑':'拉黑';
      btn.setAttribute('data-mt-uid',String(u));
      btn.addEventListener('click',function(ev){ if(ev){ ev.preventDefault(); ev.stopPropagation(); }
        var uid=this.getAttribute('data-mt-uid'); var cur=uidSet();
        if(cur[uid]){ removeBlack(uid); this.textContent='拉黑'; this.className='mt-black-btn mt-black-add';
          clearTimeout(window.__mtBlackT); window.__mtBlackT=setTimeout(function(){ schedule(document.body||document.documentElement); },50); }
        else { addBlack(uid, userName, avatar); this.textContent='已拉黑'; this.className='mt-black-btn mt-black-ok';
          clearTimeout(window.__mtBlackT); window.__mtBlackT=setTimeout(function(){ schedule(document.body||document.documentElement); },50); } });
      a.parentNode.insertBefore(btn, a.nextSibling);
      it.setAttribute('data-mt-black-btn','1');
    })(items[i]); } }
  function run(root){ applyFilter(root); recordOwners(root); }
  var pend=[];
  function flush(){ window.__pbT=0; var roots=pend.slice(); pend.length=0; for(var i=0;i<roots.length;i++){ try{ run(roots[i]); }catch(e){} } }
  function schedule(root){ pushRoot(pend,root); clearTimeout(window.__pbT); window.__pbT=setTimeout(flush,180); }
  run(document);
  setTimeout(function(){ schedule(document.body||document.documentElement); },400);
  setTimeout(function(){ schedule(document.body||document.documentElement); },1500);
  window.addEventListener('focus',function(){ schedule(document.body||document.documentElement); },true);
  document.addEventListener('visibilitychange',function(){if(!document.hidden){schedule(document.body||document.documentElement);}},true);
  if(!window.__pbObs){ window.__pbObs=new MutationObserver(function(muts){ var roots=collectMutationRoots(muts); for(var i=0;i<roots.length;i++)schedule(roots[i]); }); window.__pbObs.observe(document.documentElement,{childList:true,subtree:true}); }

  // ===== 黑名单管理独立页面（纯本地）=====
  // ===== 黑名单管理独立页面（纯本地）=====
  function buildManagerStyle(){
    if(document.getElementById('mt-blackmgr-style'))return;
    var st=document.createElement('style'); st.id='mt-blackmgr-style';
    st.textContent=
      '.mt-blackmgr-page{position:fixed;inset:0;background:#f3f5f8;z-index:99990;display:flex;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;}'+
      '.mt-blackmgr-nav{display:flex;align-items:center;min-height:92px;padding:12px 16px 14px;background:#53BCF5;color:#fff;box-sizing:border-box;flex:none;box-shadow:0 2px 8px rgba(45,94,180,.18);}'+
      '.mt-blackmgr-back{width:40px;height:40px;display:flex;align-items:center;justify-content:flex-start;flex:none;font-size:34px;line-height:40px;font-weight:300;color:#fff;cursor:pointer;-webkit-tap-highlight-color:transparent;}'+
      '.mt-blackmgr-navtit{min-width:0;display:flex;flex-direction:column;justify-content:center;flex:1;font-size:19px;line-height:1.35;font-weight:700;color:#fff;}'+
      '.mt-blackmgr-navtit:after{content:"本地管理你的黑名单列表";display:block;margin-top:3px;font-size:12px;line-height:1.4;font-weight:400;color:rgba(255,255,255,.82);}'+
      '.mt-blackmgr-navright{display:none;}'+
      '.mt-blackmgr-hero,.mt-blackmgr-addrow{display:none;}'+
      '.mt-blackmgr-list{overflow-y:auto;flex:1;padding:14px 14px 28px;-webkit-overflow-scrolling:touch;box-sizing:border-box;}'+
      '.mt-blackmgr-item{display:flex;align-items:center;width:100%;min-height:78px;margin:0 0 12px;padding:14px 15px;background:#fff;border-radius:14px;box-sizing:border-box;box-shadow:0 3px 12px rgba(34,52,84,.08);}'+
      '.mt-blackmgr-avatar{width:48px;height:48px;border-radius:50%;background:#e9edf3;flex:none;margin-right:13px;object-fit:cover;cursor:pointer;}'+
      '.mt-blackmgr-info{display:flex;flex-direction:column;justify-content:center;gap:4px;min-width:0;flex:1;}'+
      '.mt-blackmgr-name{font-size:16px;line-height:22px;color:#222;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'+
      '.mt-blackmgr-uid{font-size:12px;line-height:17px;color:#9aa1ad;}'+
      '.mt-blackmgr-del{flex:none;margin-left:12px;color:#f05b76;font-size:14px;line-height:22px;font-weight:600;padding:4px 3px;cursor:pointer;-webkit-tap-highlight-color:transparent;}'+
      '.mt-blackmgr-empty{padding:70px 16px;text-align:center;color:#9aa1ad;font-size:14px;}';
    (document.head||document.documentElement).appendChild(st);
  }
  function openBlackManager(){
    buildManagerStyle();
    var old=document.getElementById('mt-blackmgr-page');
    if(old)old.parentNode&&old.parentNode.removeChild(old);

    var page=document.createElement('div');
    page.className='mt-blackmgr-page';
    page.id='mt-blackmgr-page';

    var nav=document.createElement('div');
    nav.className='mt-blackmgr-nav';

    var back=document.createElement('span');
    back.className='mt-blackmgr-back';
    back.textContent='‹';
    back.setAttribute('aria-label','返回');
    back.addEventListener('click',function(){
      page.parentNode&&page.parentNode.removeChild(page);
    });

    var navtit=document.createElement('div');
    navtit.className='mt-blackmgr-navtit';
    navtit.textContent='个人小黑屋';

    nav.appendChild(back);
    nav.appendChild(navtit);
    page.appendChild(nav);

    var list=document.createElement('div');
    list.className='mt-blackmgr-list';

    function renderList(){
      list.innerHTML='';
      var l=readList();
      if(!l.length){
        var e=document.createElement('div');
        e.className='mt-blackmgr-empty';
        e.textContent='暂未拉黑任何用户';
        list.appendChild(e);
        return;
      }
      for(var i=0;i<l.length;i++){ (function(entry){
        var item=document.createElement('div');
        item.className='mt-blackmgr-item';

        var av=document.createElement('img');
        av.className='mt-blackmgr-avatar';
        var avsrc=entry.avatar||('https://bbs.binmt.cc/uc_server/avatar.php?uid='+entry.uid+'&size=middle');
        av.src=avsrc;
        av.setAttribute('referrerpolicy','no-referrer');
        av.addEventListener('error',function(){ this.style.display='none'; });
        av.addEventListener('click',function(){
          var u=entry.uid;
          window.open('/home.php?mod=space&uid='+u,'_blank');
        });

        var info=document.createElement('div');
        info.className='mt-blackmgr-info';

        var nm=document.createElement('div');
        nm.className='mt-blackmgr-name';
        var nmt=(entry.user||'').trim();
        nm.textContent=nmt||('用户 '+entry.uid);

        var uidsp=document.createElement('div');
        uidsp.className='mt-blackmgr-uid';
        uidsp.textContent='UID '+entry.uid;

        info.appendChild(nm);
        info.appendChild(uidsp);

        var del=document.createElement('span');
        del.className='mt-blackmgr-del';
        del.textContent='移出';
        del.addEventListener('click',function(){
          removeBlack(entry.uid);
          renderList();
          schedule(document.body||document.documentElement);
        });

        item.appendChild(av);
        item.appendChild(info);
        item.appendChild(del);
        list.appendChild(item);
      })(l[i]); }
    }

    page.appendChild(list);
    renderList();
    document.body.appendChild(page);
  }
  window.openBlackManager=openBlackManager;
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
function mtImageInsertLink2(imgUrl,linkUrl){ try{
  var ta=document.getElementById('needmessage'); if(!ta)return;
  var tag='[url='+linkUrl+'][img]'+imgUrl+'[/img][/url]\n';
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
    '#mt-img-link{width:100%;box-sizing:border-box;padding:10px 2px;border:none;border-bottom:1.5px solid #e0e2e6;border-radius:0;font-size:14px;color:#16181d;background:transparent;outline:none;transition:border-color .18s;margin-top:10px;}'+
    '#mt-img-link::placeholder{color:#b0b5bc;font-size:13px;}'+
    '#mt-img-link:hover{border-bottom-color:#cdd1d6;}'+
    '#mt-img-link:focus{border-bottom-color:#3a76f0;}'+
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
     '#mt-dlg-actions .mb:hover{background:#f3f5f9;}'+
     '.mt-align-wrap{display:flex;gap:8px;padding:0 18px;margin:4px 0 6px;}'+
     '.mt-align-wrap .mt-align-opt{flex:1;padding:11px 0;border:1px solid #e0e2e6;border-radius:10px;font-size:15px;font-weight:500;text-align:center;cursor:pointer;color:#3a76f0;background:#f7f9fc;transition:background .15s;}'+
     '.mt-align-wrap .mt-align-opt:active{background:#eef1f6;}'+
     '.mt-align-wrap .mt-align-opt:hover{background:#eef1f6;}';
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
  var wrap=document.createElement('div'); wrap.className='mt-align-wrap';
  function apply(v){ try{
    var sel=ubbSelText();
    if(sel){ ubbChangeText('needmessage','[align='+v+']','[/align]'); }
    else { var ta=document.getElementById('needmessage'); ubbInsertText(ta,'[align='+v+'][/align]'); }
  }catch(e){} sh.close(); }
  opts.forEach(function(o){
    var b=document.createElement('div'); b.className='mt-align-opt'; b.textContent=o[1];
    b.addEventListener('click',function(){ apply(o[0]); });
    wrap.appendChild(b);
  });
  sh.body.appendChild(wrap);
  var actions=document.createElement('div'); actions.id='mt-dlg-actions';
  var cb=document.createElement('div'); cb.className='mb'; cb.textContent='取消';
  cb.addEventListener('click',function(){ sh.close(); });
  actions.appendChild(cb);
  sh.body.appendChild(actions);
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
  // 自定义点击跳转链接（可选）
  var link=document.createElement('input'); link.id='mt-img-link'; link.type='text'; link.placeholder='点击图片打开链接（可选，留空不添加）';
  var ibtn=document.createElement('div'); ibtn.className='mb primary'; ibtn.textContent='插入';
  var cbtn=document.createElement('div'); cbtn.className='mb'; cbtn.textContent='取消';
  actions.appendChild(fbtn); actions.appendChild(ibtn); actions.appendChild(cbtn);
  body.appendChild(url);
  body.appendChild(link);
  box.appendChild(title); box.appendChild(sub); box.appendChild(body); box.appendChild(msg); box.appendChild(actions);
  mask.appendChild(box);
  document.body.appendChild(mask);
  function close(){ try{ mask.parentNode.removeChild(mask); }catch(e){} }
  mask.addEventListener('click',function(e){ if(e.target===mask)close(); });
  cbtn.addEventListener('click',close);
  ibtn.addEventListener('click',function(){
    var v=(url.value||'').trim();
    if(v){
      var linkUrl=(link.value||'').trim();
      if(linkUrl){ mtImageInsertLink2(v,linkUrl); }
      else{ mtImageInsert(v); }
      close();
    }
    else{ msg.textContent='请先上传图片或输入链接'; }
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
// ========== 图片上传（优先：论坛同源 swfupload；降级：MT论坛图床 img.binmt.cc）==========
// 主入口：先走论坛同源上传（无跨域，Via 可用），失败再降级到 img.binmt.cc 图床
// 图片大小上限（字节）。0 表示不限制。论坛附件一般建议 ≤ 2MB。
var MT_IMG_MAX_SIZE = 0;

// 对图片做归一化：webp 等论坛 swfupload 不支持的格式，用 Canvas 转成 png 再上传。
// 返回 Promise<File>（可原样返回或用转换后的 File 替换）。
function mtImageNormalize(file){
  return new Promise(function(resolve){
    var ext = (file.name||'').split('.').pop().toLowerCase();
    // 论坛 swfupload 图片白名单（Discuz 默认）：jpg/jpeg/gif/png/bmp
    var okExt = {jpg:1, jpeg:1, gif:1, png:1, bmp:1};
    if(okExt[ext]){ resolve(file); return; }   // 支持格式：原样直传
    // 不支持格式（webp/heic/avif 等）：尝试用 Canvas 转 png
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function(){
      try{
        var c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        var ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        c.toBlob(function(blob){
          if(blob){
            var newName = (file.name||'image').replace(/\.[^.]+$/,'') + '.png';
            var f = new File([blob], newName, {type:'image/png'});
            resolve(f);
          } else { resolve(file); }  // 转失败：原样返回，让后续逻辑提示
        }, 'image/png');
      }catch(e){ URL.revokeObjectURL(url); resolve(file); }
    };
    img.onerror = function(){ URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

function mtImageUpload(file,cb){
  var done=false;
  function finish(ok,res){ if(done)return; done=true; cb(ok,res); }
  mtImageNormalize(file).then(function(f){
    // 大小限制（默认关闭 MT_IMG_MAX_SIZE=0；如需开启设 >0 字节）
    if(MT_IMG_MAX_SIZE && f && f.size && f.size > MT_IMG_MAX_SIZE){
      finish(false,'图片超过 ' + Math.round(MT_IMG_MAX_SIZE/1024/1024) + 'MB，请压缩后重试');
      return;
    }
    mtImageUploadForum(f,function(ok,res){
      if(ok){ finish(true,res); return; }
      // 论坛同源上传失败 -> 降级到 img.binmt.cc 图床
      mtImageUploadBed(f,finish);
    });
  }).catch(function(){ finish(false,'图片处理失败'); });
}

// 路径一：论坛同源附件上传（Discuz misc.php?mod=swfupload），无跨域限制，Via 环境 100% 可用
function mtImageUploadForum(file,cb){
  var done=false;
  function finish(ok,res){ if(done)return; done=true; cb(ok,res); }
  var credCache=null;
  // 从当前页面 DOM 提取 uid + hash（附件上传 token，内联在编辑器 uploadformdata 里）
  function extractUploadCred(){
    if(credCache&&credCache.uid&&credCache.hash)return credCache;
    var html=document.documentElement.innerHTML;
    var uid=null,hash=null;
    var mu=html.match(/uploadformdata:\s*\{[^}]*uid:\s*["']?(\d+)["']?/i);
    var mh=html.match(/hash:\s*["']([0-9a-f]{32})["']/i);
    if(mu)uid=mu[1];
    if(mh)hash=mh[1];
    // 兜底：也尝试从独立字段 / 变量读取
    if(!uid && typeof window.discuz_uid!=='undefined'&&window.discuz_uid)uid=window.discuz_uid;
    if(!hash){ var m2=html.match(/uploadformdata\s*[:=]\s*\{[^}]*hash\s*[:=]\s*["']([^"']+)["']/i); if(m2)hash=m2[1]; }
    credCache={uid:uid,hash:hash};
    return credCache;
  }
  var cred=extractUploadCred();
  if(!cred.uid||!cred.hash){ finish(false,'不在回帖/发帖页面，无法使用论坛图床'); return; }
  var fd=new FormData();
  fd.append('uid',cred.uid);
  fd.append('hash',cred.hash);
  fd.append('Filedata',file,file.name||'image.png');
  var url='misc.php?mod=swfupload&operation=upload&type=image&inajax=yes&infloat=yes&simple=2';
  fetch(url,{method:'POST',credentials:'include',body:fd})
    .then(function(r){ return r.text(); })
    .then(function(txt){
      var raw=String(txt);
      var a=raw.split('|');
      if(a[0]==='DISCUZUPLOAD' && a[2]==='0'){
        var relPath=a[5];
        if(relPath){ finish(true,(location.origin||'https://bbs.binmt.cc').replace(/\/$/,'')+'/data/attachment/forum/'+String(relPath).replace(/^\/+/,'')); }
        else{ finish(false,'上传成功但未获取到图片路径'); }
      } else {
        var code=a[2];
        var STATUSMSG={'1':'不支持该扩展名','2':'服务器限制无法上传那么大的附件','3':'用户组限制无法上传那么大的附件','5':'文件类型限制无法上传该格式','6':'今日已无法上传更多文件','7':'请选择图片文件','8':'附件文件无法保存','9':'没有合法的文件被上传','10':'非法操作','11':'今日已无法上传更大的附件','-1':'内部服务器错误'};
        var reason=STATUSMSG[code]||('错误码 '+code);
        finish(false,'论坛不支持该图片：'+reason);
      }
    })
    .catch(function(){ finish(false,'论坛图床上传请求失败'); });
}

// 路径二：降级 - 原 img.binmt.cc 图床两步上传（GET 首页取 csrf-token + cookie 会话 -> POST /upload）
function mtImageUploadBed(file,cb){
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
  st.textContent=
    // 工具栏容器：改为可横向滚动（触屏原生滚动），解除 swiper 对 transform 的锁定
    '#comiis_mh_sub{overflow-x:auto!important;overflow-y:hidden!important;touch-action:pan-x!important;-webkit-overflow-scrolling:touch;scrollbar-width:none;}'+
    '#comiis_mh_sub::-webkit-scrollbar{display:none;}'+
    '.swiper-wrapper.comiis_post_ico{display:flex!important;flex-wrap:nowrap!important;align-items:center;gap:6px;padding:6px 10px;width:max-content!important;transform:none!important;transition:none!important;}'+
    // 快速回复框工具栏（无 swiper，直接是 flex 容器），同样设为可横向滚动
    '.comiis_post_ico.comiis_minipost_icot{display:flex!important;flex-wrap:nowrap!important;align-items:center;gap:6px;padding:6px 10px;overflow-x:auto!important;overflow-y:hidden!important;touch-action:pan-x!important;-webkit-overflow-scrolling:touch;scrollbar-width:none;}'+
    '.comiis_post_ico.comiis_minipost_icot::-webkit-scrollbar{display:none;}'+
    // 胶囊按钮（原生按钮统一外观），覆盖 swiper 版与快速回复框版两种容器
    '.swiper-wrapper.comiis_post_ico a,'+
    '.comiis_post_ico.comiis_minipost_icot a{display:inline-flex!important;align-items:center;justify-content:center;height:28px;padding:0 11px!important;border:1px solid #e0e4e8;border-radius:14px;background:#fff;color:#444;font-size:12.5px;flex:none!important;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;box-sizing:border-box!important;margin:0!important;line-height:1;white-space:nowrap!important;}'+
    // 隐藏原生按钮里的 comiis_font 图标字体（只保留文字）
    '.swiper-wrapper.comiis_post_ico a i.comiis_font::before,.comiis_post_ico.comiis_minipost_icot a i.comiis_font::before{display:none!important;}'+
    // 原生按钮文字颜色/字体统一
    '.swiper-wrapper.comiis_post_ico a i.comiis_font,.swiper-wrapper.comiis_post_ico a em,'+
    '.comiis_post_ico.comiis_minipost_icot a i.comiis_font,.comiis_post_ico.comiis_minipost_icot a em{color:#444!important;font-style:normal!important;font-size:inherit!important;font-weight:400!important;}'+
    '.swiper-wrapper.comiis_post_ico a:active,'+
    '.comiis_post_ico.comiis_minipost_icot a:active{background:#3a76f0;color:#fff;border-color:#3a76f0;}'+
    // UBB 快捷输入栏：独立成一行，横排在原生工具栏下方，可横向滚动
    '.mt-ubb-row{display:flex!important;flex-wrap:nowrap!important;align-items:center;gap:6px;padding:6px 10px;overflow-x:auto!important;overflow-y:hidden!important;touch-action:pan-x!important;-webkit-overflow-scrolling:touch;scrollbar-width:none;background:#fff;border-bottom:1px solid #eef1f4;overscroll-behavior-x:contain!important;overscroll-behavior-y:contain!important;}'+
    '.mt-ubb-row::-webkit-scrollbar{display:none;}'+
    '.mt-ubb-row .ub{display:inline-flex!important;align-items:center;justify-content:center;height:28px;padding:0 11px!important;border:1px solid #e0e4e8;border-radius:14px;background:#fff;color:#444;font-size:12.5px;flex:none!important;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;box-sizing:border-box!important;margin:0!important;line-height:1;white-space:nowrap!important;}'+
    '.mt-ubb-row .ub:active{background:#3a76f0;color:#fff;border-color:#3a76f0;}'+
    // 快速回复框（非 swiper）里 UBB 按钮是 span.ub（非 a），需单独补胶囊样式
    '.comiis_post_ico.comiis_minipost_icot .ub{display:inline-flex!important;align-items:center;justify-content:center;height:28px;padding:0 11px!important;border:1px solid #e0e4e8;border-radius:14px;background:#fff;color:#444;font-size:12.5px;flex:none!important;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;box-sizing:border-box!important;margin:0!important;line-height:1;white-space:nowrap!important;}'+
    '.comiis_post_ico.comiis_minipost_icot .ub:active{background:#3a76f0;color:#fff;border-color:#3a76f0;}'+
    // 快速回复框「回复」按钮：摘出后独立一行，重写为通栏主按钮
    '.mt-reply-submit-row{display:block!important;float:none!important;margin:8px 10px 4px!important;}'+
    '.mt-reply-submit-row input#fastpostsubmit{display:block!important;width:100%!important;height:38px!important;line-height:38px!important;border:none!important;border-radius:19px!important;background:#3a76f0!important;color:#fff!important;font-size:15px!important;font-weight:600!important;cursor:pointer;-webkit-tap-highlight-color:transparent;}'+
    '.mt-reply-submit-row input#fastpostsubmit:active{background:#2f63cf!important;}';
  (document.head||document.documentElement).appendChild(st); }
function ubbBuildBar(){ var ta=document.getElementById('needmessage'); if(!ta)return null;
  if(window.__mtUbbDone)return window.__mtUbbWrap||null;
  // 优先 swiper 结构（发帖页/独立回复页），否则快速回复框的普通工具栏
  var wrap=document.querySelector('.swiper-wrapper.comiis_post_ico');
  var isSwiper=!!wrap;
  if(!wrap){ wrap=document.querySelector('.comiis_post_ico.comiis_minipost_icot'); }
  if(!wrap)return null;
  ubbInjectStyle();
  var as=wrap.querySelectorAll('a');
  // 去掉原生按钮里的 comiis_font 图标字体（只删 PUA 图标字符文本节点，保留 i/em 结构，点击行为不受影响）
  for(var k=0;k<as.length;k++){ (function(a){
    if(a.id==='fastpostsubmit')return;
    var ics=a.querySelectorAll('i.comiis_font');
    for(var x=0;x<ics.length;x++){ (function(ic){
      var nodes=ic.childNodes;
      for(var n=nodes.length-1;n>=0;n--){
        var node=nodes[n];
        if(node.nodeType===3){
          var txt=node.nodeValue||'';
          var clean=txt.replace(/[\ue000-\uf8ff]/g,'').trim();
          if(clean){ node.nodeValue=clean; } else { ic.removeChild(node); }
        }
      }
    })(ics[x]); }
  })(as[k]); }
  // 阻止 swiper 库接管横向手势（仅 swiper 结构存在 comiis_mh_sub）
  if(isSwiper){
    var sub=document.getElementById('comiis_mh_sub');
    if(sub && !sub.__mtTouchStop){ sub.__mtTouchStop=true;
      ['touchstart','touchmove','touchend'].forEach(function(ev){
        sub.addEventListener(ev,function(e){ e.stopPropagation(); },true);
      });
    }
  }
  // 快速回复框：把「回复」提交按钮从横向滚动工具栏中摘出，独立成一行，重写 UI
  if(!isSwiper){
    var submitLine=document.getElementById('fastpostsubmitline');
    if(submitLine && submitLine.parentNode===wrap){
      wrap.after(submitLine);          // 移到工具栏容器之后，成为独立一行
      submitLine.className+=' mt-reply-submit-row';
    }
  }
  // UBB 快捷输入栏：
  // - swiper 结构（发帖页/独立回复页）：独立成一行，不混入原生工具栏，避免污染 $(this).index()。
  // - 快速回复框（非 swiper，原生是「表情/图片/...」）：保持一栏设计，UBB 插在同一栏；并移除原生「图片」按钮
  //   （UBB 栏里的「网络图片」功能更好，原生图片按钮多余）。
  var bar=document.createElement('div');
  bar.className='mt-ubb-row';
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
  // 移除原生「图片」按钮（快速回复框独有；UBB 的「网络图片」已替代它）
  if(!isSwiper){
    for(var p=0;p<as.length;p++){ (function(a){
      if((a.textContent||'').indexOf('图片')>=0){ a.parentNode.removeChild(a); }
    })(as[p]); }
  }
  if(isSwiper){
    // swiper：UBB 独立成一行，挂到最外层工具栏容器之后
    var outer=wrap.closest('.comiis_post_ico.comiis_minipost_icot')||wrap.parentNode;
    if(outer && outer.parentNode){ outer.parentNode.insertBefore(bar, outer.nextSibling); }
    else { wrap.after(bar); }
  } else {
    // 快速回复框：保持一栏，把 UBB 按钮逐个插到原工具栏末尾
    var tip=wrap.querySelector('span.ub');
    if(tip){ tip.parentNode.removeChild(tip); } // 防御：避免重复
    while(bar.children.length){ wrap.appendChild(bar.children[0]); } // 依次移入，避免动态长度问题
    bar=wrap; // 之后的手势拦截/返回值都指向 wrap（实际容器）
  }
  // 阻止 UBB 栏横向滑动时把 touch 手势冒泡到页面，误触网站「打开侧边栏设定」逻辑。
  // 只阻止冒泡（stopPropagation），不影响容器自身的原生横向滚动。
  var touchTarget=bar;
  if(!touchTarget.__mtTouchStop){ touchTarget.__mtTouchStop=true;
    ['touchstart','touchmove','touchend'].forEach(function(ev){
      touchTarget.addEventListener(ev,function(e){ e.stopPropagation(); },true);
    });
  }
  window.__mtUbbDone=true;
  window.__mtUbbWrap=touchTarget;
  return touchTarget; }
// 小窗（iframe）里帖子详情页的快速回复框默认折叠（.comiis_fastpostbox 高度 0），
// UBB 快捷输入栏虽已注入但随之隐藏。这里在 iframe 内把折叠的回复框展开，
// 让输入框与 UBB 栏直接可见（复用论坛自身 .comiis_openrebox 的展开逻辑）。
function autoOpenReplyBox(){
  if(!on('autoOpenRebox'))return; // 默认关闭：小窗打开后不自动展开回复框
  if(window.__mtOpenRebox)return; window.__mtOpenRebox=true;
  function tryOpen(){
    var box=document.querySelector('.comiis_fastpostbox');
    if(!box)return;
    // 已展开（含 comiis_showrebox）则无需处理
    if(String(box.className||'').indexOf('comiis_showrebox')>=0)return;
    var link=box.querySelector('.comiis_openrebox')||document.querySelector('.comiis_openrebox');
    if(link){ try{link.click();}catch(e){} }
  }
  if(document.readyState==='complete'){ setTimeout(tryOpen,200); }
  else { window.addEventListener('load',function(){ setTimeout(tryOpen,200); setTimeout(tryOpen,800); }); }
}
// 父页侧：向小窗 iframe 触发 UBB 快捷输入栏注入。
// 关键：iframe 与父页同源，脚本会在 iframe 内独立运行完整 ubbBar()→ubbBuildBar()（含弹窗、
// 移除图片按钮、重写提交按钮）。父页这里不再亲自造半成品按钮，而是复用 iframe 内脚本的完整逻辑：
//   1) 直接调用 iframe.contentWindow.__mtUbbRetry()（脚本暴露的重试入口，强制重建完整 UBB 栏）；
//   2) 同时 postMessage 兜底（脚本监听该消息也会触发重试）；
//   3) 定时重试多次，覆盖 iframe 内快速回复框工具栏懒渲染/折叠后才出现的场景。
// 这样小窗内的 UBB 栏与正常回复/发帖编辑器完全一致，且不会与 iframe 内脚本冲突。
function injectUbbIntoIframe(ifr){
  // 小窗 iframe 有些环境（尤其移动端用户脚本管理器）不会为动态创建的
  // iframe 单独执行 userscript。先优先调用 iframe 内完整 UBB 生命周期；
  // 如果入口不存在，则由父页直接对同源 iframe 的回复编辑器做兜底注入。
  var fallbackTimer=0,observer=null;

  function getDoc(){
    try{return ifr.contentDocument||ifr.contentWindow.document||null;}catch(e){return null;}
  }

  function insertText(doc,ta,str,wrapEnd){
    try{
      var st=typeof ta.selectionStart==='number'?ta.selectionStart:ta.value.length;
      var en=typeof ta.selectionEnd==='number'?ta.selectionEnd:ta.value.length;
      if(st>en){var z=st;st=en;en=z;}
      var all=ta.value||'',sel=all.substring(st,en);
      var text=str+(wrapEnd?sel+wrapEnd:'');
      ta.value=all.substring(0,st)+text+all.substring(en);
      var pos=st+text.length;
      ta.selectionStart=ta.selectionEnd=pos;
      ta.focus();
      try{ta.dispatchEvent(new Event('input',{bubbles:true}));}catch(e){}
    }catch(e){}
  }

  function changeText(doc,ta,a,b){
    try{
      var st=typeof ta.selectionStart==='number'?ta.selectionStart:ta.value.length;
      var en=typeof ta.selectionEnd==='number'?ta.selectionEnd:ta.value.length;
      if(st>en){var z=st;st=en;en=z;}
      var all=ta.value||'',sel=all.substring(st,en);
      ta.value=all.substring(0,st)+a+sel+(b||'')+all.substring(en);
      var pos=st+a.length+sel.length+(b?b.length:0);
      ta.selectionStart=ta.selectionEnd=pos;
      ta.focus();
      try{ta.dispatchEvent(new Event('input',{bubbles:true}));}catch(e){}
    }catch(e){}
  }

  function simpleDialog(doc,title,placeholder,apply){
    try{
      var old=doc.getElementById('mt-sw-ubb-dialog');
      if(old)old.parentNode.removeChild(old);
      var mask=doc.createElement('div');
      mask.id='mt-sw-ubb-dialog';
      mask.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;';
      var box=doc.createElement('div');
      box.style.cssText='width:100%;max-width:320px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.22);';
      var h=doc.createElement('div'); h.textContent=title;
      h.style.cssText='font-size:17px;font-weight:600;color:#1a1a1a;padding:22px 22px 8px;';
      var inp=doc.createElement('input'); inp.type='text'; inp.placeholder=placeholder||'';
      inp.style.cssText='display:block;width:calc(100% - 44px);height:40px;margin:8px 22px 12px;padding:0 2px;border:none;border-bottom:1.5px solid #e0e2e6;box-sizing:border-box;font-size:16px;outline:none;';
      var acts=doc.createElement('div'); acts.style.cssText='display:flex;justify-content:flex-end;gap:6px;padding:4px 14px 14px;';
      var cancel=doc.createElement('button'); cancel.textContent='取消';
      var ok=doc.createElement('button'); ok.textContent='确定';
      [cancel,ok].forEach(function(x){x.style.cssText='min-width:56px;padding:10px 14px;border:0;background:none;font-size:15px;border-radius:8px;';});
      ok.style.color='#3a76f0';
      cancel.onclick=function(){try{mask.remove();}catch(e){}};
      ok.onclick=function(){apply(inp.value||'');try{mask.remove();}catch(e){}};
      inp.onkeydown=function(e){if(e.key==='Enter')ok.click();};
      acts.appendChild(cancel);acts.appendChild(ok);
      box.appendChild(h);box.appendChild(inp);box.appendChild(acts);mask.appendChild(box);
      mask.onclick=function(e){if(e.target===mask)cancel.click();};
      (doc.body||doc.documentElement).appendChild(mask);
      inp.focus();
    }catch(e){}
  }

  function buildFallback(){
    var doc=getDoc(); if(!doc)return false;
    var ta=doc.getElementById('needmessage');
    if(!ta)return false;
    var wrap=doc.querySelector('.swiper-wrapper.comiis_post_ico') ||
      doc.querySelector('.comiis_post_ico.comiis_minipost_icot') ||
      doc.querySelector('.comiis_post_ico');
    if(!wrap)return false;

    // 如果 iframe 内脚本已经接管，直接交给原版逻辑，绝不生成第二套工具栏。
    try{
      if(ifr.contentWindow && typeof ifr.contentWindow.__mtUbbRetry==='function'){
        ifr.contentWindow.__mtUbbRetry();
        return true;
      }
    }catch(e){}

    var old=doc.querySelector('.mt-ubb-row[data-mt-ubb-fallback="1"]');
    if(old && old.parentNode){
      // 编辑器被论坛重新创建时，旧 fallback 可能还挂在旧 DOM 上。
      if(!doc.documentElement.contains(wrap)||!wrap.contains(old)&&old.parentNode!==wrap.parentNode){
        try{old.parentNode.removeChild(old);}catch(e){}
        old=null;
      }
    }
    if(old)return true;

    // 与正常回复页保持相同的按钮顺序和文字。
    var list=[
      ['隐藏文本','[hide]','[/hide]'],
      ['URL超连','url','',''],
      ['网络图片','image','',''],
      ['代码文本','[code]','[/code]'],
      ['彩色文字','rainbow','',''],
      ['字号文字','size','',''],
      ['加粗','[b]','[/b]'],
      ['斜体','[i]','[/i]'],
      ['下划线','[u]','[/u]'],
      ['删除线','[s]','[/s]'],
      ['颜色文字','color','',''],
      ['Email超','email','',''],
      ['水平线','[hr]\\n','',''],
      ['对齐文本','align','',''],
      ['引用文本','[quote]','[/quote]'],
      ['网络视频','media','',''],
      ['表格','[table][tr][td]文本[/td][/tr][/table]\\n','',''],
      ['列表','[list=A]\\n[*] list可以是字母或者数字。\\n[*] 他将会自动依次排列。\\n[/list]\\n','','']
    ];

    var style=doc.getElementById('mt-sw-ubb-fallback-style');
    if(!style){
      style=doc.createElement('style');style.id='mt-sw-ubb-fallback-style';
      style.textContent='.mt-sw-ubb-fallback{display:flex!important;flex-wrap:nowrap!important;align-items:center;gap:6px;padding:6px 10px;overflow-x:auto!important;overflow-y:hidden!important;touch-action:pan-x!important;-webkit-overflow-scrolling:touch;scrollbar-width:none;background:#fff;border-bottom:1px solid #eef1f4;box-sizing:border-box;}.mt-sw-ubb-fallback::-webkit-scrollbar{display:none}.mt-sw-ubb-fallback .ub{display:inline-flex!important;align-items:center;justify-content:center;height:28px;padding:0 11px!important;border:1px solid #e0e4e8;border-radius:14px;background:#fff;color:#444;font-size:12.5px;flex:none!important;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;box-sizing:border-box!important;line-height:1;white-space:nowrap!important}.mt-sw-ubb-fallback .ub:active{background:#3a76f0;color:#fff;border-color:#3a76f0;}';
      (doc.head||doc.documentElement).appendChild(style);
    }

    var bar=doc.createElement('div');
    bar.className='mt-sw-ubb-fallback';
    bar.setAttribute('data-mt-ubb-fallback','1');

    function action(item){
      var ta2=doc.getElementById('needmessage');if(!ta2)return;
      if(item[1]==='url'){
        simpleDialog(doc,'插入链接','https://example.com',function(v){
          if(v)changeText(doc,ta2,'[url='+v+']','[/url]');
        });return;
      }
      if(item[1]==='email'){
        simpleDialog(doc,'插入邮箱链接','name@example.com',function(v){
          if(v)changeText(doc,ta2,'[email='+v+']','[/email]');
        });return;
      }
      if(item[1]==='image'){
        simpleDialog(doc,'网络图片','图片链接',function(v){
          if(v)changeText(doc,ta2,'[img]'+v+'[/img]',''); 
        });return;
      }
      if(item[1]==='rainbow'){
        var sel=(ta2.selectionStart!=null&&ta2.selectionEnd!=null)?ta2.value.substring(ta2.selectionStart,ta2.selectionEnd):'';
        if(!sel){try{ifr.contentWindow.alert('请选中一段文字');}catch(e){}return;}
        var r=255,g=0,b=0,i=1,step=40,out='';
        function hx(v){var q=parseInt(v).toString(16);return q.length===1?'0'+q:q;}
        for(var k=0;k<sel.length;k++){
          var ch=sel.charAt(k);
          if(ch.charCodeAt(0)!==32){
            if(g+step<256){if(i===1)g+=step;}else if(i===1){i=2;g=255;}
            if(r-step>-1){if(i===2)r-=step;}else if(i===2){i=3;r=0;}
            if(b+step<256){if(i===3)b+=step;}else if(i===3){i=4;b=255;}
            if(g-step>-1){if(i===4)g-=step;}else if(i===4){i=5;g=0;}
            if(r+step<256){if(i===5)r+=step;}else if(i===5){i=6;r=255;}
            if(b-step>-1){if(i===6)b-=step;}else if(i===6){i=1;b=0;}
            out+='[color=#'+(hx(r)+hx(g)+hx(b)).toUpperCase()+']'+ch+'[/color]';
          }else out+=ch;
        }
        changeText(doc,ta2,out,'');return;
      }
      if(item[1]==='size'){
        simpleDialog(doc,'文字大小','1~7',function(v){
          var n=parseInt(v,10);if(!n||n<1||n>7)return;
          changeText(doc,ta2,'[size='+n+']','[/size]');
        });return;
      }
      if(item[1]==='color'){
        simpleDialog(doc,'颜色文字','#RRGGBB',function(v){
          v=(v||'').trim();if(!/^#?[0-9a-f]{6}$/i.test(v))return;
          if(v.charAt(0)!=='#')v='#'+v;
          changeText(doc,ta2,'[color='+v.toUpperCase()+']','[/color]');
        });return;
      }
      if(item[1]==='align'){
        simpleDialog(doc,'对齐文本','left / center / right',function(v){
          v=(v||'left').trim().toLowerCase();if(['left','center','right'].indexOf(v)<0)v='left';
          changeText(doc,ta2,'[align='+v+']','[/align]');
        });return;
      }
      if(item[1]==='media'){
        simpleDialog(doc,'网络视频','视频地址',function(v){
          if(v)changeText(doc,ta2,'[media=x,500,375]'+v+'[/media]','');
        });return;
      }
      changeText(doc,ta2,item[1],item[2]);
    }

    for(var i=0;i<list.length;i++){
      (function(item){
        var btn=doc.createElement('span');btn.className='ub';btn.textContent=item[0];
        btn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();action(item);},true);
        bar.appendChild(btn);
      })(list[i]);
    }

    // 正常 UBB 的快速回复形态：放在原生工具栏之后；如果是 swiper/独立回复页，
    // 同样放在工具栏外侧的下一行。
    var outer=wrap.closest('.comiis_post_ico.comiis_minipost_icot')||wrap;
    if(outer&&outer.parentNode)outer.parentNode.insertBefore(bar,outer.nextSibling);
    else if(wrap.parentNode)wrap.parentNode.appendChild(bar);
    return true;
  }

  function poke(){
    try{
      var iwin=ifr.contentWindow;if(!iwin)return;
      var idoc=getDoc();if(!idoc)return;
      var ta=idoc.getElementById('needmessage');
      if(!ta)return;
      if(typeof iwin.__mtUbbRetry==='function'){
        iwin.__mtUbbRetry();return;
      }
      buildFallback();
    }catch(e){}
  }

  function observe(){
    var doc=getDoc();if(!doc||!doc.documentElement)return;
    try{
      if(observer)observer.disconnect();
      observer=new MutationObserver(function(){
        clearTimeout(fallbackTimer);
        fallbackTimer=setTimeout(poke,80);
      });
      observer.observe(doc.documentElement,{childList:true,subtree:true});
    }catch(e){}
  }

  function retry(){
    poke();observe();
    [100,300,700,1200,2000,3500].forEach(function(ms){
      setTimeout(function(){poke();},ms);
    });
  }

  retry();
  if(!ifr.__mtUbbFrameLoadBound){
    ifr.__mtUbbFrameLoadBound=true;
    ifr.addEventListener('load',function(){retry();});
  }
}

// ========== 回复跳转：点击「回复」时直接进入独立回复页（有完整工具栏与 UBB 注入） ==========

function ubbBar(){
  if(!on('ubbBar'))return;
  // UBB 监听器只安装一次；编辑器本身可以被 Discuz/AJAX/PJAX 重新创建，
  // 因此不能用「曾经注入过」作为永久状态。
  if(window.__ubbLifecycleInstalled)return;
  window.__ubbLifecycleInstalled=true;

  var lastTa=null,lastWrap=null,lastUrl='';
  function currentWrap(){
    return document.querySelector('.swiper-wrapper.comiis_post_ico') ||
      document.querySelector('.comiis_post_ico.comiis_minipost_icot');
  }
  function tryBuild(force){
    try{
      var ta=document.getElementById('needmessage');
      var wrap=currentWrap();
      var href=String(location.href||'');
      if(!ta||!wrap)return;

      // 小窗进入「回复编辑页」后，论坛可能复用当前 iframe/document，
      // 只替换 textarea 与工具栏；此时必须重新允许 ubbBuildBar() 注入。
      if(force || ta!==lastTa || wrap!==lastWrap || href!==lastUrl){
        window.__mtUbbDone=false;
        window.__mtUbbWrap=null;
        lastTa=ta;
        lastWrap=wrap;
        lastUrl=href;
      }
      if(!window.__mtUbbDone) ubbBuildBar();
    }catch(e){}
  }

  tryBuild(true);

  var mo=new MutationObserver(function(){
    clearTimeout(window.__ubbT);
    window.__ubbT=setTimeout(function(){tryBuild(false);},120);
  });
  mo.observe(document.documentElement,{childList:true,subtree:true});

  function retrySoon(){
    tryBuild(true);
    setTimeout(function(){tryBuild(false);},100);
    setTimeout(function(){tryBuild(false);},300);
    setTimeout(function(){tryBuild(false);},700);
    setTimeout(function(){tryBuild(false);},1200);
    setTimeout(function(){tryBuild(false);},2000);
  }

  window.addEventListener('focus',function(){
    setTimeout(function(){tryBuild(false);},100);
  },true);
  window.addEventListener('pageshow',retrySoon,true);
  window.addEventListener('load',retrySoon,true);
  window.addEventListener('popstate',retrySoon,true);
  window.addEventListener('hashchange',retrySoon,true);

  // 部分论坛模板通过 history.pushState/replaceState 切换回复编辑器，
  // 没有真正刷新 iframe，因此补充 URL 变化后的重建。
  try{
    ['pushState','replaceState'].forEach(function(name){
      var fn=window.history&&window.history[name];
      if(typeof fn==='function'&&!fn.__mtUbbWrapped){
        var wrapped=function(){
          var r=fn.apply(this,arguments);
          setTimeout(retrySoon,0);
          return r;
        };
        wrapped.__mtUbbWrapped=true;
        window.history[name]=wrapped;
      }
    });
  }catch(e){}

  // 覆盖小窗/异步编辑器比 iframe load 更晚出现的情况。
  var endAt=Date.now()+12000;
  var timer=setInterval(function(){
    try{
      tryBuild(false);
      if(Date.now()>endAt)clearInterval(timer);
    }catch(e){clearInterval(timer);}
  },350);

  // 父页可以通知当前 iframe 重新检查；同源小窗继续复用同一套完整 UBB UI。
  window.__mtUbbRetry=function(){
    try{
      window.__mtUbbDone=false;
      retrySoon();
    }catch(e){}
  };
  window.addEventListener('message',function(e){
    try{
      if(e.data&&e.data.__mtUbbRetry)window.__mtUbbRetry();
    }catch(err){}
  });
}

// ========== 回复跳转：点击「回复」时直接进入独立回复页（有完整工具栏与 UBB 注入） ==========
function replyRedirect(){
  if(!on('replyRedirect'))return; // 非源脚本功能，默认关闭；需手动在面板开启
  if(window.__mtReplyRedirect)return; window.__mtReplyRedirect=true;
  // 仅顶层页处理「回复」跳转；小窗（iframe）内不应触发跳转到独立回复编辑器，
  // 否则小窗内的返回/UI 会被打乱（iframe 里应保持帖子详情 + 快速回复框的原生形态）。
  if(IS_IFRAME)return;
  // 捕获阶段拦截，抢先于论坛自身的 dialog 弹窗逻辑
  document.addEventListener('click',function(e){
    var t=e.target; if(!t||!t.closest)return;
    var a=t.closest('a'); if(!a)return;
    var h=(a.getAttribute('href')||'').replace(/&amp;/g,'&');
    // 命中「回复」链接（指向 action=reply 且带 fid/tid）
    var m=h.match(/action=reply(?:&|$)/);
    if(!m)return;
    // 提取 fid / tid
    var fid=(h.match(/[?&]fid=(\d+)/)||[])[1];
    var tid=(h.match(/[?&]tid=(\d+)/)||[])[1];
    if(!fid||!tid)return;
    // 目标：独立回复页 URL。必须保留「回复指定楼层/用户」所需的参数，
    // 否则点击某条评论的「回复」会退化成回复楼主，无法给指定人回复。
    // 保留 repquote(引用楼层)/reppost(回复楼层)/extra/page/quotemsg 等关键参数。
    var keep=['repquote','reppost','extra','page','quotemsg','noticetrimstr','noticeauthormsg','pid'];
    var extra=[];
    try{
      var u=new URL(h,location.href);
      for(var i=0;i<keep.length;i++){
        var v=u.searchParams.get(keep[i]);
        if(v!=null) extra.push(keep[i]+'='+encodeURIComponent(v));
      }
    }catch(err){}
    var target='https://bbs.binmt.cc/forum.php?mod=post&action=reply&fid='+fid+'&tid='+tid;
    if(extra.length) target+='&'+extra.join('&');
    // 已经是目标 URL 时（点右上角按钮本身）不重复处理
    if(h===target)return;
    e.preventDefault(); e.stopPropagation();
    location.href=target;
  },true);
}

// ========== 帖子自动展开内容 ==========
function autoExpandContent(){ if(!on('autoExpand'))return; if(window.__autoExpand)return; window.__autoExpand=true;
  if(!/thread-\d+/.test(location.pathname)&&!/mod=viewthread/i.test(location.search))return;
  if(document.getElementById('mt-autoexpand-style'))return;
  var st=document.createElement('style'); st.id='mt-autoexpand-style';
  // 当前线上 MT 论坛帖子正文容器为 .t_f（默认已完整展开，max-height:none / overflow:visible）。
  // 为兼容可能出现的「查看全文/展开全文」折叠遮罩（类名可能随模板变化），仅针对帖子正文容器，
  // 不触碰回复/发帖编辑器（编辑器类名为 .comiis_postbox / .needmessage 等，与 .t_f 无交集）。
  st.textContent=
    'td.plc>div.pct>.t_f{max-height:none!important;overflow:visible!important;position:static!important;height:auto!important;}'+
    '.comiis_lookfulltext_bg,.comiis_lookfulltext_key,[class*=lookfulltext_bg],[class*=lookfulltext_key]{display:none!important;}';
  (document.head||document.documentElement).appendChild(st);
}

// ========== 导读显示最新帖子 ==========
function showLatestPost(){ if(!on('latestPost'))return; if(!/mod=guide/.test(location.href))return; if(window.__latestPost)return; window.__latestPost=true;
  // 抓取「最新发表」列表页，取其最新发布的帖子，在导读页最上方渲染为卡片。
  // 由于抓取的 view=newthread 与当前导读页列表是同一数据集，必须排除「已经出现在
  // 当前导读页帖子列表中的帖子」，只展示「最新发表、且当前列表还没显示的帖子」。
  function currentPageTids(){
    var o={};
    var links=document.querySelectorAll('li.forumlist_li h2 > a[href*="thread-"]');
    for(var i=0;i<links.length;i++){
      var m=(links[i].getAttribute('href')||'').match(/thread-(\d+)/);
      if(m)o[m[1]]=1;
    }
    return o;
  }
  function getLatestPostForum(){
    var exist=currentPageTids(); // 当前导读页列表已显示的 tid，用于排除重复
    var result=[];
    var seen={};
    var pending=2; // 抓取 page=1、page=2 两页
    function done(){
      if(--pending>0)return;
      render(result);
    }
    function parse(html){
      if(!html)return;
      if(html.indexOf('/_guard/auto.js')!==-1)return;
      var tmp=document.createElement('div'); tmp.innerHTML=html;
      // 移动版 DOM：导读帖子列表为 li.forumlist_li 卡片，标题链接为 h2 下直系 <a href="thread-{tid}-1-1.html">。
      // 注意：div.list_body 下的直系 <a> 是「摘要」，必须排除，否则会误抓摘要文本当标题。
      var as=tmp.querySelectorAll('li.forumlist_li h2 > a[href*="thread-"]');
      for(var i=0;i<as.length;i++){
        var a=as[i];
        var title=(a.getAttribute('title')||a.textContent||'').replace(/\s+/g,' ').trim();
        var href=a.getAttribute('href')||'';
        if(!title||!href)continue;
        // 转为绝对 URL（抓取的 href 是相对路径，如 thread-174047-1-1.html）
        var abs=href;
        if(!/^https?:\/\//i.test(abs)){ abs=new URL(abs,'https://bbs.binmt.cc/').href; }
        // 排除已经出现在当前导读页帖子列表中的帖子（按 tid 去重）
        var tm=abs.match(/thread-(\d+)/);
        if(tm && exist[tm[1]])continue;
        if(seen[abs])continue; seen[abs]=1;
        result.push({href:abs, title:title});
      }
    }
    GET('https://bbs.binmt.cc/forum.php?mod=guide&view=newthread',function(code,html){
      if(code===200)parse(html);
      done();
    });
    GET('https://bbs.binmt.cc/forum.php?mod=guide&view=newthread&page=2',function(code,html){
      if(code===200)parse(html);
      done();
    });
  }
  function render(postInfoList){
    if(document.getElementById('mt-latest-post-wrap'))return;
    if(!postInfoList||!postInfoList.length)return;
    if(!document.getElementById('mt-latest-post-style')){
      var st=document.createElement('style'); st.id='mt-latest-post-style';
      st.textContent=
        '#mt-latest-post-wrap{margin:10px 0;background:#fff;border:1px solid #e5e5e5;border-radius:4px;}'+
        '#mt-latest-post-wrap .mt-lp-hd{padding:8px 12px;font-size:14px;font-weight:700;border-bottom:1px solid #eee;color:#333;}'+
        '#mt-latest-post-wrap ul{margin:0;padding:0;list-style:none;}'+
        '#mt-latest-post-wrap li{height:32px;line-height:32px;display:flex;align-items:center;padding:0 12px;border-bottom:1px solid #f5f5f5;}'+
        '#mt-latest-post-wrap li:last-child{border-bottom:none;}'+
        '#mt-latest-post-wrap li .mt-lp-tag{background:#FF705E;color:#fff;font-size:12px;padding:0 6px;border-radius:2px;margin-right:8px;flex:none;}'+
        '#mt-latest-post-wrap li a{display:block;font-size:14px;height:22px;line-height:22px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;color:#333;text-decoration:none;}'+
        '#mt-latest-post-wrap li a:hover{color:#f60;}';
      (document.head||document.documentElement).appendChild(st);
    }
    // 按 tid 数字降序（新帖在前）
    postInfoList.sort(function(a,b){
      var ma=(a.href||'').match(/thread-(\d+)/i);
      var mb=(b.href||'').match(/thread-(\d+)/i);
      var ta=ma?parseInt(ma[1],10):-1;
      var tb=mb?parseInt(mb[1],10):-1;
      return tb-ta;
    });
    var items='';
    for(var j=0;j<postInfoList.length;j++){
      var it=postInfoList[j];
      items+='<li><span class="mt-lp-tag">新帖</span><a href="'+it.href+'" title="'+it.title+'" target="_blank">'+it.title+'</a></li>';
    }
    // 移动版 DOM：导读列表容器为 .comiis_forumlist（内部是 ul > li.forumlist_li）。
    // 卡片插到列表容器最前（即首个 li.forumlist_li 所在的 UL 之前），让「最新发表」置顶显示。
    var box=document.createElement('div');
    box.id='mt-latest-post-wrap';
    box.innerHTML='<div class="mt-lp-hd">最新发表</div><ul>'+items+'</ul>';
    var listBox=document.querySelector('.comiis_forumlist');
    var firstLi=listBox?listBox.querySelector('li.forumlist_li'):null;
    // firstLi 的直接父级是无 class 的 UL（不是 .comiis_forumlist 本身），
    // 所以要把卡片插到该 UL 之前（或 listBox 的最前面），不能直接对 listBox insertBefore(firstLi)。
    var ul=firstLi?firstLi.parentElement:null;
    var anchor=document.querySelector('.bm.cl, .bm, #threadlist, .fl_tb');
    var tables=document.querySelectorAll('table');
    if(ul && ul.parentNode){ ul.parentNode.insertBefore(box, ul); }
    else if(listBox){ listBox.insertBefore(box, listBox.firstChild); }
    else if(tables.length>=1){ tables[0].parentNode.insertBefore(box, tables[0]); }
    else if(anchor&&anchor.parentNode){ anchor.parentNode.insertBefore(box, anchor.nextSibling); }
    else { (listBox||document.getElementById('ct')||document.body).appendChild(box); }
  }
  getLatestPostForum();
}

// ========== 小窗浏览帖子（从底部滑入打开） ==========
function smallWindow(){ if(!on('smallWindow'))return; if(window.__smallW)return; window.__smallW=true;
  if(!/mod=guide|mod=forum|mod=viewthread|thread-/.test(location.href))return;
  injectSmallWindowStyle();
  bindSmallWindow();
}

function injectSmallWindowStyle(){ if(document.getElementById('mt-sw-style'))return;
  var st=document.createElement('style'); st.id='mt-sw-style';
  st.textContent=
    '.mt-sw-mask{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:999998;opacity:0;transition:opacity .25s ease;}'+
    '.mt-sw-mask.mt-sw-show{opacity:1;}'+
    '.mt-sw-panel{position:fixed;left:0;right:0;bottom:0;z-index:999999;height:92%;background:#fff;border-radius:18px 18px 0 0;'+
      'transform:translateY(100%);transition:transform .28s cubic-bezier(.32,.72,.36,1);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -4px 24px rgba(0,0,0,.2);}'+
    '.mt-sw-panel.mt-sw-show{transform:translateY(0);}'+
    '.mt-sw-head{display:flex;align-items:center;padding:12px 14px;border-bottom:1px solid #eee;flex:none;background:#fff;}'+
    '.mt-sw-title{flex:1;font-size:15px;font-weight:600;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'+
    '.mt-sw-acts{flex:none;display:flex;align-items:center;gap:14px;}'+
    '.mt-sw-btn{cursor:pointer;font-size:13px;color:#666;padding:4px;line-height:1;user-select:none;}'+
    '.mt-sw-btn:hover{color:#f60;}'+
    '.mt-sw-iframe{flex:1;width:100%;border:0;background:#fff;}';
  (document.head||document.documentElement).appendChild(st);
}

function openSmallWindow(url,title){
  removeSmallWindow();
  var mask=document.createElement('div'); mask.className='mt-sw-mask';
  var panel=document.createElement('div'); panel.className='mt-sw-panel';
  var head=document.createElement('div'); head.className='mt-sw-head';
  var t=document.createElement('div'); t.className='mt-sw-title'; t.textContent=title||'帖子详情';
  var acts=document.createElement('div'); acts.className='mt-sw-acts';
  var openNew=document.createElement('span'); openNew.className='mt-sw-btn'; openNew.textContent='新窗口';
  var close=document.createElement('span'); close.className='mt-sw-btn'; close.textContent='关闭';
  acts.appendChild(openNew); acts.appendChild(close);
  head.appendChild(t); head.appendChild(acts);
  var iframe=document.createElement('iframe'); iframe.className='mt-sw-iframe'; iframe.setAttribute('src',url); iframe.setAttribute('scrolling','auto');
  panel.appendChild(head); panel.appendChild(iframe);
  // 小窗 iframe 与父页同源：脚本会在 iframe 内独立运行完整 ubbBar()→ubbBuildBar()（含弹窗、
  // 移除图片按钮、重写提交按钮）。父页这里仅负责「触发」iframe 内脚本的重试注入，
  // 用于覆盖 iframe 内快速回复框工具栏懒渲染/折叠后才出现、脚本运行时机偏晚的场景。
  iframe.addEventListener('load',function(){ injectUbbIntoIframe(iframe); });
  document.body.appendChild(mask); document.body.appendChild(panel);
  // 触发滑入动画
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ mask.classList.add('mt-sw-show'); panel.classList.add('mt-sw-show'); }); });
  function closeFn(){ removeSmallWindow(); }
  close.addEventListener('click',function(e){ e.stopPropagation(); closeFn(); });
  openNew.addEventListener('click',function(e){ e.stopPropagation(); window.open(url,'_blank'); });
  mask.addEventListener('click',function(){ closeFn(); });
  // 返回键（手机）关闭：监听 hashchange 不做处理，仅提供关闭
  window.__mtSwClose=closeFn;
}

function removeSmallWindow(){
  try{ if(window.__mtSwClose){ /* noop */ } }catch(e){}
  window.__mtSwClose=null;
  var m=document.querySelector('.mt-sw-mask'); if(m&&m.parentNode)m.parentNode.removeChild(m);
  var p=document.querySelector('.mt-sw-panel'); if(p&&p.parentNode)p.parentNode.removeChild(p);
}

// 全局事件委托：在 document 上于捕获阶段统一拦截「帖子链接」点击，
// 无需逐链接绑定，也无需 MutationObserver，天然覆盖动态加载/任意位置的帖子链接。
function bindSmallWindow(){
  if(window.__mtSwDelegated)return; window.__mtSwDelegated=true;
  document.addEventListener('click', function(e){
    // 点击小窗自身的关闭/新窗口按钮时，其内部元素可能也是 <a>，直接放行
    if(e.__mtSwHandled)return;
    var t=e.target;
    if(!t || !t.closest)return;
    // 向上找到最近的帖子链接（href 含 thread- 后缀，如 thread-174047-1-1.html）
    var a=t.closest('a[href*="thread-"]');
    if(!a)return;
    // 只拦截「标题链接」。MT 论坛移动版导读列表有两种标题位置：
    //   1) 标题在 <h2> 内（大多数卡片）；
    //   2) 极少数「无标题/长文」卡片没有 h2，标题直接是 div.list_body 下的直系 <a>。
    // 两种情况都需要放行小窗；其余（摘要文字、回复数/浏览数数字、封面空链接、分区等）排除。
    var isH2Title = !!a.closest('h2');
    var isListBodyDir=false;
    var p=a.parentElement;
    if(p && String(p.className||'').indexOf('list_body')>=0){
      // list_body 直系子 <a>。只有当该卡片「没有 h2 标题链接」时，它才是标题；
      // 若卡片已有 h2 标题，则 list_body 下的 <a> 是摘要，跳过。
      var card=a.closest('li.forumlist_li');
      var hasH2Title = card ? !!card.querySelector('h2 a[href*="thread-"]') : false;
      if(!hasH2Title) isListBodyDir=true;
    }
    if(!isH2Title && !isListBodyDir)return;
    // 排除小窗面板内部的链接（避免在小窗里再嵌套打开）
    if(a.closest('.mt-sw-panel') || a.closest('.mt-sw-mask'))return;
    var url=a.href;
    if(!url || !/thread-/.test(url))return;
    var title=(a.getAttribute('title')||a.textContent||'').replace(/\s+/g,' ').trim().slice(0,80);
    e.preventDefault(); e.stopPropagation();
    e.__mtSwHandled=true;
    openSmallWindow(url, title);
  }, true);
}

// ========== 启动 ==========
// 是否运行在 iframe 内（如「小窗浏览帖子」的 <iframe>）。iframe 同源，
// 脚本会在其中再次运行；此时应只做「内容增强」，不注入侧边栏面板、不重绑小窗。
var IS_IFRAME=false;
try{ IS_IFRAME=(window.top!==window.self); }catch(e){ IS_IFRAME=true; }

function init(){
  if(!IS_IFRAME){
    buildPanel();       // 侧边栏开关面板：仅顶层页注入一次
  }
  autoSign();
  urlLink();
  copyCode();
  autoPage();
  guideNext();
  autoReply();
  hideOnly();
  personalBlack();
  ubbBar();             // UBB 快捷输入栏：iframe 内也需要（小窗里回复）
  if(IS_IFRAME){
    autoOpenReplyBox(); // 小窗内自动展开折叠的回复框，让 UBB 栏直接可见
  }
  replyRedirect();
  autoExpandContent();
  showLatestPost();
  if(!IS_IFRAME){
    smallWindow();      // 小窗点击绑定：仅顶层页，避免 iframe 内嵌套小窗
  }
}
if(document.readyState==='complete'||document.readyState==='interactive'){ init(); }
else { window.addEventListener('DOMContentLoaded', init); }
window.addEventListener('load', function(){
  // 侧边栏可能是动态渲染的，稍后重试确保面板注入成功
  if(!IS_IFRAME){ setTimeout(buildPanel, 400); }
});
})();