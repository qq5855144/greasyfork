// ==UserScript==
// @name         MT论坛移动端网页版增强【img图床优先测试版】
// @namespace    https://bbs.binmt.cc/
// @version 1.3.0-imgtest
// @description  在侧边栏注入功能项独立开关
// @match        https://bbs.binmt.cc/*
// @match        http://bbs.binmt.cc/*
// @connect      img.binmt.cc
// @connect      https://img.binmt.cc
// @connect      https://img.binmt.cc/*
// @connect      http://img.binmt.cc
// @connect      http://img.binmt.cc/*
// @connect      icdn.binmt.cc
// @connect      https://icdn.binmt.cc
// @connect      bbs.binmt.cc
// @connect      https://bbs.binmt.cc
// @connect      https://bbs.binmt.cc/*
// @connect      att.binmt.cc
// @connect      www.binmt.cc
// @connect      *.binmt.cc
// @connect      https://*.binmt.cc/*
// @connect      binmt.cc
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
   {key:'autoExpand',name:'帖子自动展开',desc:'自动展开帖子完整内容',hide:true},
    {key:'smallWindow',name:'小窗浏览帖子',desc:'点击帖子/媒体链接小窗打开'},
    {key:'autoOpenRebox',name:'小窗自动展开回复框',desc:'小窗打开后自动展开底部回复框(已废弃)',def:false,hide:true},
    {key:'replyRedirect',name:'回复跳独立页',desc:'点击回复直接进入独立回复页(非源脚本功能,默认关)',def:false,hide:true}
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
    if(f.hide)return; // hide 标记项不渲染开关行（按钮已移除）
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
  try{ if(typeof GM_xmlhttpRequest==='function'){ GM_xmlhttpRequest({method:'GET',url:u,timeout:15000,anonymous:false,
    onload:function(r){cb(r.status,r.responseText);},onerror:function(){cb(0,'');},ontimeout:function(){cb(0,'');}}); return; } }catch(e){}
  fetch(u,{credentials:'include'}).then(function(r){ return r.text().then(function(t){cb(r.status,t);}); }).catch(function(){cb(0,'');});
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
// 轻量提示浮条（无框架依赖）
function signToast(msg){
  try{
    var old=document.getElementById('mt-sign-toast');
    if(old&&old.parentNode)old.parentNode.removeChild(old);
    var el=document.createElement('div'); el.id='mt-sign-toast'; el.textContent=msg;
    el.style.cssText='position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:2147483647;'+
      'background:rgba(0,0,0,.75);color:#fff;font-size:13px;line-height:1.5;padding:8px 16px;border-radius:18px;'+
      'max-width:80vw;box-shadow:0 2px 12px rgba(0,0,0,.25);transition:opacity .4s;pointer-events:none;';
    (document.body||document.documentElement).appendChild(el);
    setTimeout(function(){ el.style.opacity='0';
      setTimeout(function(){ if(el.parentNode)el.parentNode.removeChild(el); },450); },2600);
  }catch(e){}
}
function autoSign(){ if(!on('autoSign'))return; if(window.__mtAutoSign)return; window.__mtAutoSign=true;
  var t=new Date(); var day=t.getFullYear()+'-'+(t.getMonth()+1)+'-'+t.getDate();
  // 状态检查：本地记忆已记今天，则不再请求
  if(S.get('signDate','')===day)return;
  var fh=getFormhash(); if(!fh)return;
  function finish(ok){ if(ok){ S.set('signDate',day); } }
  function handle(code,body,isRetry){
    if(code!==200){ if(isRetry)signToast('自动签到：网络异常，稍后重试'); else retryText(); return; }
    var text=''; var m=(body||'').match(/\[CDATA\[([\s\S]*?)\]\]/); text=m?m[1]:(body||'');
    var plain=text.replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
    // 失败分支：不写记录 → 当天再次进入页面会重试（对齐优化版 clearSignInfo 行为）
    if(/需要先登录|请先登录/.test(plain)){ signToast('自动签到：请先登录'); return; }
    if(/请稍后再试|黑名单|绑定手机号|不允许使用|非法字符/.test(plain)){ signToast('自动签到：'+plain.slice(0,20)); return; }
    // 幂等分支：今天已签过（跨设备/重复请求），静默记录
    if(/今日已签|今日已经签到/.test(plain)){ finish(true); return; }
    // 成功分支：纯文本「已签到/签到成功」，或 button 格式返回的 HTML（含 .con 金币 / .line 排名）
    if(/已签到|签到成功/.test(plain)||/class=["']con["']/.test(text)){
      finish(true);
      var coin='',rank='';
      var cm=text.match(/class=["']con["'][^>]*>([\s\S]*?)<\/[a-z0-9]+>/i);
      if(cm){ var nm=cm[1].replace(/<[^>]*>/g,'').match(/(\d+)/); if(nm)coin=nm[1]; }
      var rm=text.match(/class=["']line["'][^>]*>([\s\S]*?)<\/[a-z0-9]+>/i);
      if(rm){ var nm2=rm[1].replace(/<[^>]*>/g,'').match(/(\d+)/); if(nm2)rank=nm2[1]; }
      signToast('自动签到成功'+(rank?'，排名 '+rank:'')+(coin?'，奖励 '+coin+' 金币':''));
      return;
    }
    // 未知内容：改用 format=text 再确认一次，仍未知则不写记录（当日可重试）
    if(!isRetry)retryText();
  }
  function retryText(){
    var u2='https://bbs.binmt.cc/plugin.php?id=k_misign:sign&operation=qiandao&format=text&formhash='+fh;
    GET(u2,function(c,b){ handle(c,b,true); });
  }
  // 主请求：format=button（对齐 MT论坛移动端优化 脚本，成功时返回金币/排名 HTML）。
  // 同源 fetch 必带登录 cookie；Via 的 GM_xmlhttpRequest 仅作回退。
  var u='https://bbs.binmt.cc/k_misign-sign.html?operation=qiandao&format=button&formhash='+fh+'&inajax=1&ajaxtarget=midaben_sign';
  try{
    fetch(u,{credentials:'include'}).then(function(r){ return r.text().then(function(t){ handle(r.status,t,false); }); })
      .catch(function(){ retryText(); });
  }catch(e){ retryText(); }
}

// ========== 图片修复：Comiis懒加载 + icdn防盗链Referer + WAF挑战兜底 ==========
function mtImgFix(){
  try{
    //WAF(acw_sc__v2)挑战兜底：挑战页无body，浏览器未自动通过时手动执行挑战脚本并重载
    if(!document.body){
      if(document.cookie.indexOf('acw_sc__v2')<0){
        var ss=document.getElementsByTagName('script');
        for(var i=0;i<ss.length;i++){
          var t=ss[i].textContent||'';
          if(t.indexOf('arg1')>=0){ try{eval(t);}catch(e2){} break; }
        }
      }
      var wn=parseInt(sessionStorage.getItem('mt_waf_retry')||'0',10); if(!isFinite(wn)||wn<0)wn=0;
      if(wn<2){ try{sessionStorage.setItem('mt_waf_retry',String(wn+1));}catch(e5){} setTimeout(function(){try{location.reload();}catch(e3){}},1500); }
      else{ try{sessionStorage.removeItem('mt_waf_retry');}catch(e6){} }
      return;
    }
    //Comiis列表懒加载图片：真实地址在comiis_loadimages属性，直接写入src
    function fixList(root){
      root=root||document;
      try{
        if(root.querySelectorAll){
          var imgs=root.querySelectorAll('img.comiis_loadimages[comiis_loadimages]');
          for(var i=0;i<imgs.length;i++){
            var im=imgs[i];
            var s=im.getAttribute('comiis_loadimages')||'';
            if(s&&/^https?:\/\//i.test(s)){
              im.setAttribute('referrerpolicy','origin');
              im.setAttribute('src',s);
              im.removeAttribute('comiis_loadimages');
            }
          }
        }
      }catch(e){}
    }
    //正文图片防盗链：icdn.binmt.cc无Referer返回307，需referrerpolicy并重设src重新请求
    function fixRef(root){
      root=root||document;
      try{
        if(root.querySelectorAll){
          var imgs2=root.querySelectorAll('img');
          for(var j=0;j<imgs2.length;j++){
            var im2=imgs2[j];
            var s2=im2.getAttribute('src')||'';
            if(/icdn\.binmt\.cc/i.test(s2)){
              if(im2.getAttribute('referrerpolicy')!=='origin')im2.setAttribute('referrerpolicy','origin');
              if(!im2.getAttribute('data-mt-ref')){
                im2.setAttribute('data-mt-ref','1');
                var k2=s2; im2.removeAttribute('src'); im2.setAttribute('src',k2);
              }
            }
          }
        }
      }catch(e){}
    }
    function scan(root){ fixList(root); fixRef(root); }
    scan(document);
    setTimeout(function(){scan(document);},1200);
    setTimeout(function(){scan(document);},3500);
    if(!window.__mtImgFix){
      window.__mtImgFix=true;
      window.addEventListener('scroll',function(){scan(document);},{passive:true});
      //MutationObserver：导读自动下一页等动态追加的新列表项立即处理
      var mo=new MutationObserver(function(muts){
        try{
          for(var i=0;i<muts.length;i++){
            var adds=muts[i].addedNodes||[];
            for(var j=0;j<adds.length;j++){
              if(adds[j]&&adds[j].nodeType===1)scan(adds[j]);
            }
          }
        }catch(e){}
      });
      try{mo.observe(document.body||document.documentElement,{childList:true,subtree:true});}catch(e){}
    }
  }catch(e){}
}

// ========== 隐藏帖自动回复 ==========
function autoReply(){ if(!on('autoReply'))return; if(window.__autoReply)return; window.__autoReply=true;
  if(!/thread-\d+/.test(location.pathname)&&!/mod=viewthread/i.test(location.search))return;
  var TEXTS=['看看隐藏','感谢分享','论坛有你更精彩','看看是什么','谢谢分享'];
  var RIK='mtar_reply_index',DP='mtar_done_v11_',LRK='mtar_last_reply',FM=20000,PK='mtar_pending',FUK='mtar_flood_until_',RP='mtar_retry_',QK='mtar_latest_tid'; // FM：两次回帖固定最小间隔20秒。论坛实际限制大于16秒（16秒后提交会被拒导致二次冷却），取20秒一次到位（冷却核心，不读服务器倒计时）
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

  // 冷却倒计时提示条：冷却读秒期间在页面底部显示剩余秒数
  var cdTimer=null;
  function showCd(sec){ try{
    var bar=document.getElementById('mt-cd-bar');
    if(!bar){ bar=document.createElement('div'); bar.id='mt-cd-bar';
      bar.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#ff9800;color:#fff;font-size:13px;text-align:center;padding:6px;line-height:1.2;';
      document.body.appendChild(bar); }
    var due=Date.now()+sec*1000; if(cdTimer)clearInterval(cdTimer);
    var tick=function(){ var l=Math.ceil((due-Date.now())/1000);
      if(l>0){ bar.style.display=''; bar.textContent='自动回复冷却中：约 '+l+'秒后自动回复当前隐藏贴'; }
      else{ bar.style.display='none'; if(cdTimer){clearInterval(cdTimer);cdTimer=null;} } };
    tick(); cdTimer=setInterval(tick,1000);
  }catch(e){} }
  function hideCd(){ try{ var bar=document.getElementById('mt-cd-bar'); if(bar)bar.style.display='none';
    if(cdTimer){clearInterval(cdTimer);cdTimer=null;} }catch(e){} }
  // 重试计数持久化 + 最新帖队列（多帖读秒不变，只取最新打开的帖子）
  function getRc(t){ try{var n=parseInt(localStorage.getItem(RP+t)||'0',10);return (isNaN(n)||n<0)?0:n;}catch(e){return0;} }
  function setRc(t,n){ try{localStorage.setItem(RP+t,String(n));}catch(e){} }
  function clearRc(t){ try{localStorage.removeItem(RP+t);}catch(e){} }
  function latestSet(t){ try{localStorage.setItem(QK,JSON.stringify({tid:t,at:Date.now()}));}catch(e){} }
  function latestIs(t){ try{var q=JSON.parse(localStorage.getItem(QK)||''); if(q&&q.tid&&q.tid!==t)return false; return true;}catch(e){return true;} }
  function submit(cb){ var f=document.getElementById('fastpostform'),mb=document.getElementById('needmessage');
    if(!f||!mb){cb({ok:false,fl:false});return;}
    var act=(f.getAttribute('action')||'').replace(/&amp;/g,'&'); if(!act){cb({ok:false,fl:false});return;}
    var url=act+(act.indexOf('?')>=0?'&':'?')+'handlekey=fastpost&loc=1&inajax=1';
    var fd=new URLSearchParams(); fd.set('formhash',f.elements.formhash?f.elements.formhash.value:'');
    if(f.elements.noticeauthor)fd.set('noticeauthor',f.elements.noticeauthor.value||'');
    fd.set('message',rt()); fd.set('replysubmit','回复');
    var x=new XMLHttpRequest(),ended=false;
    function finish(v){if(ended)return;ended=true;cb(v);}
    try{x.open('POST',url,true);x.withCredentials=true;x.setRequestHeader('Content-Type','application/x-www-form-urlencoded');x.setRequestHeader('X-Requested-With','XMLHttpRequest');
      x.onreadystatechange=function(){if(x.readyState!==4)return;var txt=x.responseText||'',isFlood=/两次发表间隔少于|间隔少于\s*\d+\s*秒|请稍候再发表|请稍后再发表|灌水/i.test(txt);
        var ok=x.status===200&&/succeedhandle_fastpost|回复发布成功/.test(txt)&&!/errorhandle_fastpost/.test(txt)&&!isFlood;
        finish({ok:ok,fl:isFlood});};
      x.onerror=function(){finish({ok:false,fl:false});}; x.ontimeout=function(){finish({ok:false,fl:false});}; x.timeout=20000;
      // 冷却核心：发起提交即为一次回复尝试，无论成败都以此刻作为16秒冷却起点
      try{localStorage.setItem(LRK,String(Date.now()));}catch(e){}
      x.send(fd.toString());
    }catch(e){finish({ok:false,fl:false});}}
  function viewpidHtml(t,p,cb){ var x=new XMLHttpRequest(),doneX=false;
    function finish(v){if(doneX)return;doneX=true;cb(v);}
    try{x.open('POST','forum.php?mod=viewthread&tid='+encodeURIComponent(t)+'&viewpid='+encodeURIComponent(p)+'&mobile=2',true);x.withCredentials=true;
      x.setRequestHeader('Content-Type','application/x-www-form-urlencoded');x.setRequestHeader('X-Requested-With','XMLHttpRequest');
      x.onreadystatechange=function(){if(x.readyState!==4)return;if(x.status!==200){finish('');return;}var raw=x.responseText||'',m=raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);finish(m?m[1]:raw);};
      x.onerror=function(){finish('');};x.ontimeout=function(){finish('');};x.timeout=15000;x.send('');
    }catch(e){finish('');}}
  function reinitImgs(root){ function isPh(s){ return !s||/(^|\/)none\.gif$/i.test(s)||/grey\.gif$/i.test(s)||/images\/none/i.test(s)||/static\/image\/common\/none/i.test(s); }
    function fixAll(c){ try{
      if(!c||!c.querySelectorAll)return;
      var imgs=c.querySelectorAll('img');
      for(var i=0;i<imgs.length;i++){(function(im){ try{
        var src=im.getAttribute('src')||'',real='';
        var cands=['file','zoomfile','data-zoomfile','data-src','data-original','data-lazy-src','data-lazyload'];
        for(var k=0;k<cands.length;k++){ var v=im.getAttribute(cands[k]);
          if(v){ v=v.replace(/&amp;/g,'&'); if(/^https?:\/\//i.test(v)){ real=v; break; } } }
        if(real&&(isPh(src)||src!==real)){ im.setAttribute('referrerpolicy','origin'); im.setAttribute('src',real);
          for(var r=0;r<cands.length;r++)im.removeAttribute(cands[r]);
          im.removeAttribute('lazyload'); im.removeAttribute('lazyloaded'); }
        else if(isPh(src)){ try{ if(typeof lazyimg==='function'){ lazyimg(); } }catch(e){} }
        else{ var hasLazy=im.hasAttribute&&(im.hasAttribute('lazyload')||im.hasAttribute('data-lazyload'));
          if(hasLazy){ im.removeAttribute('lazyload'); im.removeAttribute('data-lazyload');
            var keep=src; im.setAttribute('referrerpolicy','origin'); im.removeAttribute('src'); im.setAttribute('src',keep); } }
      }catch(e){}})(imgs[i]);}
    }catch(e){}
    try{ if(typeof lazyimg==='function'){ lazyimg(); } }catch(e){} }
    fixAll(root);
    // 论坛异步脚本可能在替换后再次改动 DOM，延迟二次扫描兜底
    setTimeout(function(){fixAll(root);},800);
    setTimeout(function(){fixAll(root);},2500);
  }
  function replaceFloor(t,p,cb){ viewpidHtml(t,p,function(html){ if(!html||html.indexOf('id="pid'+p)<0){cb(false);return;}
      var tg=document.getElementById('pid'+p)||document.getElementById('post_'+p); if(!tg){cb(false);return;}
      var par=tg.parentNode;
      try{var fr=document.createElement('div');fr.innerHTML=html;var n=fr.querySelector('#pid'+p)||fr.querySelector('#post_'+p)||fr.firstElementChild;if(!n){cb(false);return;}tg.outerHTML=n.outerHTML;
      // 修复：动态替换楼层后新图片需手动触发加载（按id回找失败时退回父容器扫描）
      reinitImgs(document.getElementById('pid'+p)||document.getElementById('post_'+p)||par||document.body);cb(true);}catch(e){cb(false);}});
  }
  function unlock(t,ps,cb){ if(!ps||!ps.length){cb(true);return;} var arr=ps.slice(),idx=0,okn=0;
    function one(){ if(idx>=arr.length){cb(okn===arr.length);return;} var p=arr[idx++];
      replaceFloor(t,p,function(ok){if(ok)okn++; setTimeout(one,1200+Math.floor(Math.random()*1800));}); }
    one(); }
  function scheduleRun(t,ms){ var target=Date.now()+Math.max(1000,ms);
    // 多个隐藏帖连续打开时：冷却读秒不变（全局 LRK），只取最新打开的帖子。
    // 已调度的旧帖若被新帖取代，到期后自动作废，由新帖的调度接管。
    if(window.__mtarRunAt && window.__mtarRunAt<=target)return;
    window.__mtarRunAt=target;
    clearTimeout(window.__mtarTimer);
    window.__mtarTimer=setTimeout(function(){ window.__mtarRunAt=0; setPend(t,false); if(!latestIs(t))return; run(); },Math.max(1000,ms)); }
  function scheduleUnlock(t,ps,attempt){ clearTimeout(window.__mtarUnlockTimer);
    window.__mtarUnlockTimer=setTimeout(function(){if(!hasLocked())return;unlock(t,ps,function(ok){if(ok&&!hasLocked())return;
      if(attempt<5){scheduleUnlock(t,lockedPids(),attempt+1);}else{setTimeout(function(){if(hasLocked())location.reload();},1500);}});},attempt===0?300:Math.min(8000,1500*attempt));}
  function run(){ var t=tid(); if(!t||!isMobile()||!hasLocked())return; var u=uid(); if(!u||u==='0')return;
    var ps=lockedPids();
    // 记录最新打开的隐藏贴：多帖时冷却读秒不变，只取最新帖
    latestSet(t);
    if(done(t)){hideCd();unlock(t,ps,function(ok){if(!ok||hasLocked())scheduleUnlock(t,lockedPids(),1);});return;}
    if(pend(t))return;
    var fu=floodUntil(t),now=Date.now(); if(fu>now){scheduleRun(t,fu-now+500);return;}
    var f=document.getElementById('fastpostform'); if(f&&(f.querySelector('[name="seccodeverify"]')||f.querySelector('[name="secqaa"]'))){hideCd();return;}
    if(hasMine(u)){markDone(t);hideCd();unlock(t,ps,function(ok){if(!ok||hasLocked())scheduleUnlock(t,lockedPids(),1);});return;}
    setPend(t,true);
    setTimeout(function(){try{
      if(!hasLocked()){setPend(t,false);hideCd();return;}
      var mb=document.getElementById('needmessage'); if(mb&&mb.value&&mb.value.trim()&&mb.value.trim()!==rt()){setPend(t,false);hideCd();return;}
      var lr=parseInt(localStorage.getItem(LRK)||'0',10),since=Date.now()-lr;
      if(since<FM){var w=FM-since;setPend(t,false);showCd(Math.max(1,w/1000));scheduleRun(t,w+500);return;}
      submit(function(res){setPend(t,false);
        if(res.ok){markDone(t);adv();setFlood(t,0);clearRc(t);hideCd();
          unlock(t,lockedPids(),function(ok){if(!ok||hasLocked())scheduleUnlock(t,lockedPids(),1);});return;}
        if(res.fl){var rc=getRc(t); if(rc<3){setRc(t,rc+1);
          // 冷却核心：被服务器限频时同样按固定20秒间隔重试，不读服务器返回的倒计时
          setFlood(t,FM);showCd(FM/1000);scheduleRun(t,FM+500);return;} clearRc(t);}
        var failWait=FM; setFlood(t,failWait); showCd(failWait/1000); scheduleRun(t,failWait+500); // 提交失败：同样按固定20秒冷却间隔重试
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
  // 拉黑按钮样式独立注入：不依赖顶层 injectPanelStyle，
  // 保证小窗 iframe 内（注入方案 X）按钮同样有完整边框/配色。
  if(!document.getElementById('mt-black-btn-style')){
    try{
      var st0=document.createElement('style'); st0.id='mt-black-btn-style';
      st0.textContent=
        '.mt-black-btn{flex:none;margin-left:6px;font-size:11px;padding:2px 6px;border-radius:3px;cursor:pointer;white-space:nowrap;vertical-align:middle;}'+
        '.mt-black-add{color:#e53935;border:1px solid #e53935;background:transparent;}'+
        '.mt-black-ok{color:#999;border:1px solid #ccc;background:transparent;}';
      (document.head||document.documentElement).appendChild(st0);
    }catch(e){}
  }
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
      if(ok&&res){
        var parts=String(res).split('|IMGFAIL|');
        url.value=parts[0];
        if(parts[1]){ msg.textContent='上传成功（img图床失败已改用bbs：'+parts[1]+'）点击「插入」写入输入框'; }
        else{ msg.textContent='上传成功，点击「插入」写入输入框'; }
      }
      else{ msg.textContent=res||'上传失败，请重试'; }
    });
  });
}
// ========== 图片上传（测试版：img.binmt.cc 图床优先；失败降级论坛附件 bbs）==========
// 主入口：先走 img.binmt.cc 图床（GM跨域），失败再降级到论坛同源附件上传
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
    mtImageUploadBed(f,function(ok2,res2){
      if(ok2){ finish(true,res2); return; }
      // img 图床失败 -> 降级到论坛附件上传（bbs 同源）
      mtImageUploadForum(f,function(ok,res){
        if(ok){ finish(true,res+'|IMGFAIL|'+res2); return; }
        // 两条路径都失败：合并提示便于定位
        finish(false,res2+'（bbs附件上传也失败：'+(res||'未知')+'）');
      });
    });
  }).catch(function(){ finish(false,'图片处理失败'); });
}

// 路径一：论坛同源附件上传（Discuz misc.php?mod=swfupload），无跨域限制，Via 环境 100% 可用
function mtImageUploadForum(file,cb){
  var done=false;
  function finish(ok,res){ if(done)return; done=true; cb(ok,res); }
  // 从当前页面 DOM 提取 uid + hash（附件上传 token）与真实 upload_url（含 fid 参数，SWFUpload 配置）
  function extractUploadCred(){
    var html=document.documentElement.innerHTML;
    var uid=null,hash=null,uploadUrl=null;
    // 1) SWFUpload 配置形式：post_params: {"uid":"161028","hash":"32位hex"}，upload_url:"misc.php?...&fid=42"
    var mu=html.match(/post_params\s*:\s*\{[^}]*["']?uid["']?\s*:\s*["']?(\d+)["']?/i);
    var mh=html.match(/post_params\s*:\s*\{[^}]*["']?hash["']?\s*:\s*["']([0-9a-f]{32})["']/i);
    if(mu)uid=mu[1];
    if(mh)hash=mh[1];
    // 2) uploadformdata 形式（Discuz 编辑器变量）
    if(!uid){ var mu2=html.match(/uploadformdata\s*[:=]\s*\{[^}]*uid\s*[:=]\s*["']?(\d+)["']?/i); if(mu2)uid=mu2[1]; }
    if(!hash){ var mh2=html.match(/uploadformdata\s*[:=]\s*\{[^}]*hash\s*[:=]\s*["']([^"']+)["']/i); if(mh2)hash=mh2[1]; }
    // 3) 兜底：全局变量与任意 hash 字段
    if(!uid && typeof window.discuz_uid!=='undefined'&&window.discuz_uid)uid=String(window.discuz_uid);
    if(!hash){ var mh3=html.match(/hash\s*[:=]\s*["']([0-9a-f]{32})["']/i); if(mh3)hash=mh3[1]; }
    // 4) 真实上传地址（含 fid，权限校验必需）
    var murl=html.match(/upload_url\s*:\s*["']([^"']+)["']/i);
    if(murl)uploadUrl=murl[1].replace(/&amp;/g,'&');
    return {uid:uid,hash:hash,uploadUrl:uploadUrl};
  }
  var cred=extractUploadCred();
  if(!cred.uid||!cred.hash){ finish(false,'不在回帖/发帖页面，无法使用论坛图床'); return; }
  var fd=new FormData();
  fd.append('uid',cred.uid);
  fd.append('hash',cred.hash);
  fd.append('Filedata',file,file.name||'image.png');
  // 优先使用页面配置的 upload_url（含 fid）；缺失时回退到通用构造
  var url=cred.uploadUrl||'misc.php?mod=swfupload&operation=upload&type=image&inajax=yes&infloat=yes&simple=2';
  if(/^https?:\/\//i.test(url) && url.indexOf(location.origin)!==0){ finish(false,'上传接口地址异常'); return; }
  // 30 秒超时保护（弱网/Via 环境下避免长时间无反馈）
  var ctrl=(typeof AbortController!=='undefined')?new AbortController():null;
  var to=null;
  if(ctrl){ to=setTimeout(function(){ try{ctrl.abort();}catch(e){} },30000); }
  fetch(url,{method:'POST',credentials:'include',body:fd,signal:ctrl?ctrl.signal:undefined})
    .then(function(r){ return r.text(); })
    .then(function(txt){
      if(to)clearTimeout(to);
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
        // 非标准响应（如被安全验证拦截）：附上响应摘要便于定位
        if(!/DISCUZUPLOAD/i.test(raw))reason='响应异常：'+raw.replace(/\s+/g,' ').slice(0,80);
        finish(false,'论坛不支持该图片：'+reason);
      }
    })
    .catch(function(err){
      if(to)clearTimeout(to);
      finish(false,'论坛图床上传请求失败'+(err&&err.name==='AbortError'?'（超时）':''));
    });
}

// 路径二：降级 - 原 img.binmt.cc 图床两步上传（GET 首页取 csrf-token + cookie 会话 -> POST /upload）
function mtImageUploadBed(file,cb){
  var BASE='https://img.binmt.cc';
  var hasGM=(typeof GM_xmlhttpRequest==='function');
  function failWhy(){ return hasGM ? '图床上传失败（请检查脚本跨域授权 @connect）' : '图床上传失败（当前环境缺少 GM_xmlhttpRequest，跨域受限，请尝试手动输入链接）'; }
  // 从图床首页 HTML 提取存储策略 id（#strategies 里第一个 data-id，当前为 2「默认存储」）
  function extractStrategyId(txt){
    var m=(txt||'').match(/id="strategies"[\s\S]*?data-id="(\d+)"/i);
    return m?m[1]:'';
  }
  // 构造上传 FormData：兰空图床(jquery.fileupload paramName)字段名为 file，需带存储策略 strategy_id
  function buildFd(sid){
    var fd=new FormData();
    fd.append('file',file,file.name||'image.png');
    fd.append('strategy_id',sid||'2');
    return fd;
  }
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
  // 上传结果解析（两种请求方式共用，宽松兼容多种返回结构）
  function parseUploadResp(txt,ok,fail){
    try{
      var j;
      if(typeof txt==='object') j=txt;
      else { try{ j=JSON.parse(txt); }catch(e){ j=null; } }
      var u=null;
      if(j){
        if(j.data&&j.data.links&&j.data.links.url)u=j.data.links.url;
        else if(j.data&&typeof j.data.url==='string')u=j.data.url;
        else if(j.data&&typeof j.data==='string'&&/^https?:\/\//i.test(j.data))u=j.data;
        else if(typeof j.url==='string'&&/^https?:\/\//i.test(j.url))u=j.url;
      }
      if(u){ ok(u); }
      else{ fail((j&&j.message)||('图床返回异常：'+String(txt).slice(0,60))); }
    }catch(e){ fail('上传响应解析失败'); }
  }
  // 失败路径记录：每级降级都记录原因，最终错误信息里带上完整链路，便于定位 Via 问题
  var trail=[];
  function note(s){ if(trail.length<6)trail.push(s); }
  // 探测：GM 的 POST 通道 + 字符串 data 是否可用（Via 桥接可能丢失 FormData，字符串可 JSON 序列化）
  function probe(cb){
    var called=false;
    function done(res){ if(called)return; called=true; cb(res); }
    try{
      GM_xmlhttpRequest({ method:'POST', url:BASE+'/upload',
        headers:{'Content-Type':'application/json'}, data:'{"probe":1}', timeout:15000,
        onload:function(r){ done('字符串POST有响应(HTTP '+r.status+')'); },
        onerror:function(){ done('字符串POST网络错误'); },
        ontimeout:function(){ done('字符串POST超时'); } });
    }catch(e){ done('字符串POST异常:'+e); }
  }
  // 方式C：页面 fetch 直连（依赖 img.binmt.cc 的 CORS 放行，作为 GM 失败后的最后手段）
  function uploadWithFetch(token,sid){
    fetch(BASE+'/upload',{method:'POST',credentials:'include',headers:{'Referer':BASE+'/','x-csrf-token':token},body:buildFd(sid)})
      .then(function(r){ return r.json(); })
      .then(function(j){ var u=j&&j.data&&j.data.links&&j.data.links.url; if(u)cb(true,u); else cb(false,(j&&j.message)||'上传失败'); })
      .catch(function(){ note('fetch直连跨域失败'); cb(false,trail.join(' > ')); });
  }
  // 方式B2：GM 手动 Cookie 兜底（部分管理器不支持 anonymous 时使用）
  function uploadWithGM2(token,sid,jar){
    var hdr={ 'Referer':BASE+'/', 'X-CSRF-TOKEN':token };
    var ck=cookieHeader(jar); if(ck) hdr['Cookie']=ck;
    var called=false;
    function fallback(err){ if(called)return; called=true; note('GM手动Cookie:'+(err||'失败')); uploadWithFetch(token,sid); }
    try{
      GM_xmlhttpRequest({ method:'POST', url:BASE+'/upload',
        headers:hdr, data:buildFd(sid), timeout:30000,
        onload:function(r){
          if(called)return; called=true;
          parseUploadResp(r.responseText||r.response||'', function(u){ cb(true,u); }, function(m){ cb(false,'服务器返回：'+m); });
        },
        onerror:function(){ fallback('网络错误'); },
        ontimeout:function(){ fallback('超时'); } });
    }catch(e){ fallback(String(e)); }
  }
  // 方式B1（首选）：GM anonymous:false —— 会话 cookie（lsky_pro_session / XSRF-TOKEN）
  // 由脚本管理器/浏览器自动存取，POST 只需带页面 meta 的明文 X-CSRF-TOKEN，
  // 规避 Via 等环境对自定义 Cookie 头 / responseHeaders 支持不一导致的会话断裂
  function uploadWithGM1(token,sid,jar){
    var hdr={ 'Referer':BASE+'/', 'X-CSRF-TOKEN':token };
    var called=false;
    function fallback(err){ if(called)return; called=true; note('GM匿名:'+(err||'失败')); uploadWithGM2(token,sid,jar); }
    try{
      GM_xmlhttpRequest({ method:'POST', url:BASE+'/upload',
        anonymous:false, headers:hdr, data:buildFd(sid), timeout:30000,
        onload:function(r){
          if(called)return; called=true;
          parseUploadResp(r.responseText||r.response||'', function(u){ cb(true,u); }, function(m){ cb(false,'服务器返回：'+m); });
        },
        onerror:function(){ fallback('网络错误'); },
        ontimeout:function(){ fallback('超时'); } });
    }catch(e){ fallback(String(e)); }
  }
  function onPage(txt,headersStr){
    var t=extractCsrf(txt);
    var sid=extractStrategyId(txt);
    var jar=headersStr?parseCookies(headersStr):{};
    if(!t){ cb(false,'获取图床会话失败'); return; }
    // 先探测 GM 的 POST 通道是否可用，结果记入失败链路，便于诊断 Via
    probe(function(p){
      note('探测:'+p);
      uploadWithGM1(t,sid,jar);
    });
  }
  function getToken(){
    if(hasGM){
      // anonymous:false 让 GET 的 Set-Cookie（会话）进入浏览器 cookie jar；responseHeaders 抓 cookie 作为手动兜底
      GM_xmlhttpRequest({ method:'GET', url:BASE+'/', timeout:20000,
        anonymous:false, responseHeaders:true,
        onload:function(r){ onPage(r.responseText, r.responseHeaders); },
        onerror:function(){
          // Via 等环境下 GM 直连图床可能被拦：降级用页面 fetch（跨域，依赖 CORS）
          fetch(BASE+'/',{credentials:'include'}).then(function(r){return r.text();}).then(function(t){onPage(t,'');}).catch(function(){ cb(false,'无法访问图床'); });
        },
        ontimeout:function(){ cb(false,'无法访问图床（超时）'); } });
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
  // 防御：清理上次构建残留的 UBB 独立行（防重复排列）
  var oldRow=document.querySelector('.mt-ubb-row');
  if(oldRow&&oldRow.parentNode)oldRow.parentNode.removeChild(oldRow);
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
    // 防御：删除全部旧 UBB 按钮（含残留），避免重复构建时按钮堆积
    var olds=wrap.querySelectorAll('span.ub');
    for(var q=olds.length-1;q>=0;q--){ if(olds[q].parentNode)olds[q].parentNode.removeChild(olds[q]); }
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
// 父页侧：向小窗 iframe 主动注入「自包含启动脚本」。
// 背景（决定性根因）：Via 浏览器只往顶层页面注入用户脚本、不往同源 iframe 注入，
// 所以 iframe 内运行的仍是原始论坛页（无 UBB 栏、无自动回复）。旧的「触发型」方案
// （调用 iframe.contentWindow.__mtUbbRetry() / postMessage 通知）全部无效——因为 iframe 里
// 根本没有脚本可以响应这些触发。
//
// 方案 X：父页在 iframe load 后，把 autoReply + 整套 UBB 函数链的源码（经
// Function.prototype.toString() 提取）+ 极简运行时头（S/FEATS/defOf/on）拼接成一份
// 自包含脚本，作为 <script> 注入 iframe 执行。iframe 原生加载 thread 页，故其内的
// location/formhash/楼中楼/懒加载全部天然正确，功能完整。
//
// 注入函数清单（按依赖顺序，全部为本 IIFE 顶层的 function 声明）：
//   运行时头：S、FEATS(仅 autoReply/ubbBar/urlLink 三项)、defOf、on —— 手写
//   工具链：matchesSel → pushRoot → collectMutationRoots → collectScoped
//   URL 链：cleanUrl → urlInjectStyle → makeClickable → urlLink
//   UBB 链：ubbList → ubbInsertText → ubbSelText → ubbChangeText → mtImageInsert →
//           mtImageInsertLink → mtImageInsertLink2 → mtImageStyle → mtRainbowApply →
//           mtColorStyle → mtColorDialog → mtDialogStyle → mtDialogShell → mtDlgField →
//           mtLinkDialog → mtSizeDialog → mtAlignMenu → mtMediaDialog → mtImageDialog →
//           mtImageNormalize → mtImageUpload → mtImageUploadForum → mtImageUploadBed →
//           ubbInjectStyle → ubbBuildBar → ubbBar
//   以及顶层 var MT_IMG_MAX_SIZE、autoReply。
function buildInjectionScript(){
  // 极简运行时头：功能开关表（def 与顶层 FEATS 保持一致，保证开关行为一致）。
  var head = '' +
    'var S={get:function(k,d){try{var v=(typeof GM_getValue==="function")?GM_getValue(k,null):null;if(v==null)v=localStorage.getItem("mt_"+k);return (v==null)?d:v;}catch(e){return d;}},' +
    'set:function(k,v){try{if(typeof GM_setValue==="function")GM_setValue(k,v);}catch(e){} try{localStorage.setItem("mt_"+k,v);}catch(e){}}};\n' +
    'var FEATS=[{key:"autoReply",name:"隐藏帖自动回复"},{key:"ubbBar",name:"UBB快捷输入栏"},{key:"urlLink",name:"URL超链接"},{key:"personalBlack",name:"个人小黑屋",def:false},{key:"hideOnly",name:"只看隐藏贴",def:false},{key:"copyCode",name:"代码复制按钮"},{key:"autoPage",name:"评论自动上下页"},{key:"guideNext",name:"导读自动下一页"}];\n' +
    'function defOf(k){for(var i=0;i<FEATS.length;i++){if(FEATS[i].key===k)return FEATS[i].def===false?false:true;}return true;}\n' +
    'function on(k){var d=defOf(k)?"true":"false";return S.get("feat_"+k,d)!=="false";}\n';

  // 依赖顺序拼接函数源码（全部为 IIFE 顶层 function 声明，自包含无遗漏）。
  var fns = [
    'var MT_IMG_MAX_SIZE=0;',
    // urlLink 工具链与函数链（Via 不注入 iframe，小窗内需父页注入才能生效）
    matchesSel, pushRoot, collectMutationRoots, collectScoped,
    cleanUrl, urlInjectStyle, makeClickable, urlLink, mtMediaBridge,
    ubbList, ubbInsertText, ubbSelText, ubbChangeText,
    mtImageInsert, mtImageInsertLink, mtImageInsertLink2,
    mtImageStyle, mtRainbowApply, mtColorStyle, mtColorDialog,
    mtDialogStyle, mtDialogShell, mtDlgField, mtLinkDialog,
    mtSizeDialog, mtAlignMenu, mtMediaDialog, mtImageDialog,
    mtImageNormalize, mtImageUpload, mtImageUploadForum, mtImageUploadBed,
    ubbInjectStyle, ubbBuildBar, ubbBar,
    autoReply,
    // 小窗内同样生效的论坛功能（与顶层行为一致）：
    copyInjectStyle, copyText, getCodeText, collectBlocks, makeButtonFor, addCopyButtons, copyCode,
    guideNext,                 // 导读自动下一页
    hideOnly,                  // 只看隐藏贴
    personalBlack,             // 个人小黑屋（过滤 + 拉黑按钮）
    autoExpandContent,         // 帖子自动展开
    autoPage                   // 评论自动上下页
  ];
  var body = fns.map(function(f){
    if(typeof f === 'string'){ return f; } // 字符串条目（如 var MT_IMG_MAX_SIZE=0;）原样输出
    if(typeof f !== 'function'){ return '/* [inject] missing: ' + (f && f.name) + ' */'; }
    return f.toString();
  }).join('\n');

  // 启动：在 iframe 内运行注入的全部功能（自包含脚本，无 IS_IFRAME 判断，直接启动）。
  // 整体幂等：无论注入脚本被执行几次，只有第一次生效，杜绝 UBB 栏等重复构建。
  var boot = '' +
    'if(window.__mtInjectedBoot){/* skip */}else{window.__mtInjectedBoot=true;\n' +
    'try{mtImgFix();}catch(e){}\n' +
    'try{autoReply();}catch(e){}\n' +
    'try{ubbBar();}catch(e){}\n' +
    'try{urlLink();}catch(e){}\n' +
    'try{mtMediaBridge();}catch(e){}\n' +
    'try{personalBlack();}catch(e){}\n' +
    'try{hideOnly();}catch(e){}\n' +
    'try{copyCode();}catch(e){}\n' +
    'try{guideNext();}catch(e){}\n' +
    'try{autoExpandContent();}catch(e){}\n' +
    'try{autoPage();}catch(e){}\n' +
    '}\n';

  return head + body + '\n' + boot;
}

function injectIntoSmallWindowIframe(ifr){
  try{
    var idoc = ifr.contentDocument; if(!idoc) return;
    var iwin = ifr.contentWindow; if(!iwin) return;
    // 幂等守卫：避免重复注入（iframe 内 load 可能触发多次；窗口标志覆盖 script 标记丢失的场景）
    if(idoc.getElementById('mt-injected-boot') || iwin.__mtInjectedBoot) return;
    var src = buildInjectionScript();
    var mark = idoc.createElement('script');
    mark.id = 'mt-injected-boot';
    mark.textContent = src;
    (idoc.head || idoc.documentElement).appendChild(mark);
  }catch(e){}
  // 兜底重试：编辑器工具栏可能懒渲染，注入后延时再尝试（自包含脚本自身已带
  // MutationObserver 与 load/focus 重试，这里仅为覆盖注入脚本未及生效的极早场景）。
  var poke = function(){
    try{
      var idoc2 = ifr.contentDocument; if(!idoc2) return;
      var iwin2 = ifr.contentWindow;
      if(!idoc2.getElementById('mt-injected-boot') && !(iwin2 && iwin2.__mtInjectedBoot)){
        var src2 = buildInjectionScript();
        var s2 = idoc2.createElement('script');
        s2.id = 'mt-injected-boot';
        s2.textContent = src2;
        (idoc2.head || idoc2.documentElement).appendChild(s2);
      }
    }catch(e){}
  };
  setTimeout(poke, 300);
  setTimeout(poke, 1000);
}

// ========== 小窗图片修复：防盗链 / Referrer / 懒加载兜底 ==========
// 小窗 iframe 内帖子图片无法加载的常见根因与对策：
// 1) 页面存在 <meta name="referrer" content="no-referrer">（或部分 WebView 对 iframe
//    默认不发送 Referer）→ 图床 img.binmt.cc 防盗链校验 Referer 失败返回 403。
//    对策：改写/注入 referrer meta + iframe referrerpolicy 属性，强制带 Referer。
// 2) 懒加载未触发：img.src 仍是占位图，真实地址在 data-src / data-original。
//    对策：把真实地址直接写入 src 触发加载。
// 3) 前两步仍救不回的图片（防盗链严格）：父页 GM_xmlhttpRequest 代抓
//    （带正确 Referer 请求头），转 data URL 直接喂给 img，彻底绕过防盗链。
function smallWindowImageFixer(ifr){
  if(!ifr) return;
  var doc=null;
  try{ doc=ifr.contentDocument; }catch(e){}
  // 文档级幂等：iframe 内翻页/刷新会替换整个文档，新文档需重新初始化修复器；
  // 元素级标记会导致新文档图片无人处理。
  if(!doc || doc.__mtImgFix) return;
  doc.__mtImgFix=true;
  var IF=ifr, DOC=doc;
  var PLACEHOLDER=/none\.gif|loading|grey\.gif|spacer|blank\.gif|static\/image\/common/i;
  var BINMT=/\.binmt\.cc$/i;
  var scanTimer=0;

  // 改写 iframe 文档中的 referrer meta：把 no-referrer/never/origin 统一为
  // no-referrer-when-downgrade，保证同 https 的图床请求会带上帖子页 Referer。
  function fixReferrerMeta(){
    try{
      var d=IF.contentDocument; if(!d||d!==DOC)return;
      var metas=d.querySelectorAll('meta[name="referrer"],meta[name="Referrer"]');
      for(var i=0;i<metas.length;i++){
        var c=String(metas[i].getAttribute('content')||'').toLowerCase();
        if(c==='no-referrer'||c==='never'||c==='origin'){
          metas[i].setAttribute('content','no-referrer-when-downgrade');
        }
      }
      if(!metas.length){
        var m=d.createElement('meta');
        m.setAttribute('name','referrer');
        m.setAttribute('content','no-referrer-when-downgrade');
        (d.head||d.documentElement).appendChild(m);
      }
    }catch(e){}
  }

  // 解析图片真实地址：懒加载属性优先（src 是占位图时），否则用 src
  function realTarget(img){
    try{
      var lazy=(img.getAttribute('data-src')||img.getAttribute('data-original')||img.getAttribute('data-lazy-src')||img.getAttribute('data-lazyload')||'').replace(/&amp;/g,'&');
      var src=(img.getAttribute('src')||'').replace(/&amp;/g,'&');
      var target='';
      if(lazy && /^https?:\/\//i.test(lazy) && !PLACEHOLDER.test(lazy)) target=lazy;
      else if(src && /^https?:\/\//i.test(src) && !PLACEHOLDER.test(src)) target=src;
      if(!target)return '';
      try{
        var d=IF.contentDocument;
        var base=(d&&d.baseURI)||IF.src||location.href;
        return new URL(target,base).href;
      }catch(e){ return target; }
    }catch(e){ return ''; }
  }

  function mimeOf(headers,url){
    var m=/content-type\s*:\s*([^\r\n;]+)/i.exec(String(headers||''));
    if(m&&m[1])return m[1].trim();
    var ext=String(url).split('?')[0].split('#')[0].toLowerCase().match(/\.(jpe?g|png|gif|webp|bmp|avif|svg|ico)$/);
    var map={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp',bmp:'image/bmp',avif:'image/avif',svg:'image/svg+xml',ico:'image/x-icon'};
    return (ext&&map[ext[1]])||'image/jpeg';
  }
  function bufToDataUrl(buf,mime){
    var bytes=new Uint8Array(buf),bin='',CH=0x8000;
    for(var i=0;i<bytes.length;i+=CH){
      bin+=String.fromCharCode.apply(null,bytes.subarray(i,Math.min(i+CH,bytes.length)));
    }
    return 'data:'+mime+';base64,'+btoa(bin);
  }

  // GM_xmlhttpRequest 代抓图片：带 Referer 请求头，转 data URL 写入 img
  function fetchViaGM(img,target){
    if(img.__mtData===target)return;
    if(img.__mtFetching===target)return;
    var now=Date.now();
    if(img.__mtLastTry && (now-img.__mtLastTry)<6000)return; // 失败冷却 6s，防刷
    // 仅代抓本论坛域名（@connect 白名单内）；外链图床不代抓，保留自然加载
    var host='';
    try{ host=new URL(target).hostname; }catch(e){}
    if(!BINMT.test(host))return;
    img.__mtFetching=target; img.__mtLastTry=now;
    var ended=false;
    function finish(){ if(ended)return; ended=true; img.__mtFetching=''; }
    function apply(buf,headers){
      try{
        var dataUrl=bufToDataUrl(buf,mimeOf(headers||'',target));
        if(img.__mtData===target)return;
        img.__mtData=target;
        // 清掉懒加载属性，防止论坛懒加载脚本后续用旧地址再次覆盖 src
        img.removeAttribute('data-src'); img.removeAttribute('data-original');
        img.removeAttribute('data-lazy-src'); img.removeAttribute('data-lazyload');
        img.setAttribute('src',dataUrl);
      }catch(e){}
    }
    try{
      if(typeof GM_xmlhttpRequest!=='function'){ finish(); return; }
      var ref='https://bbs.binmt.cc/';
      try{ var loc=IF.contentWindow&&IF.contentWindow.location; if(loc)ref=loc.href; }catch(e){}
      GM_xmlhttpRequest({
        method:'GET', url:target, timeout:20000, anonymous:false,
        responseType:'arraybuffer',
        headers:{'Referer':ref,'User-Agent':(navigator.userAgent||'')},
        onload:function(r){
          var buf=null;
          if(r&&r.response instanceof ArrayBuffer)buf=r.response;
          else if(r&&r.response&&r.response.byteLength)buf=r.response;
          else if(r&&r.responseBytes)buf=r.responseBytes;
          if(buf&&buf.byteLength)apply(buf,r&&(r.responseHeaders||r.headers));
          finish();
        },
        onerror:finish, ontimeout:finish
      });
    }catch(e){ finish(); }
  }

  function handle(img){
    try{
      var target=realTarget(img);
      if(!target)return;
      if(img.__mtSrc===target){
        // 已处理过该地址：若仍加载失败且未修复，周期性用 GM 代抓重试
        if(img.complete && img.naturalWidth===0 &&
           (img.currentSrc||img.src||'')===target &&
           !/^data:/i.test(img.getAttribute('src')||'')){
          fetchViaGM(img,target);
        }
        return;
      }
      img.__mtSrc=target;
      // 已自然加载成功，无需处理
      if(img.complete && img.naturalWidth>0 && (img.currentSrc||img.src||'')===target)return;
      // 懒加载兜底：把真实地址写入 src 让浏览器自然加载（Referer 已被修正）
      if((img.currentSrc||img.src||'')!==target){
        if(!img.__mtErrBound){
          img.__mtErrBound=true;
          img.addEventListener('error',function(){ fetchViaGM(img,target); });
        }
        img.setAttribute('src',target);
        return;
      }
      // src 已指向目标但加载失败 → 防盗链拦截，立即 GM 代抓
      if(!img.__mtErrBound){
        img.__mtErrBound=true;
        img.addEventListener('error',function(){ fetchViaGM(img,target); });
      }
      if(img.complete && img.naturalWidth===0) fetchViaGM(img,target);
    }catch(e){}
  }

  function scan(){
    try{
      var d=IF.contentDocument; if(!d||d!==DOC)return;
      var imgs=d.querySelectorAll('img');
      for(var i=0;i<imgs.length;i++) handle(imgs[i]);
    }catch(e){}
  }
  function throttle(){
    clearTimeout(scanTimer);
    scanTimer=setTimeout(scan,250);
  }

  // 监听 iframe 文档内的 DOM / 属性变化（懒加载写入、图片动态插入）
  try{
    if(DOC){
      var mo=new MutationObserver(function(muts){
        for(var i=0;i<muts.length;i++){
          var m=muts[i];
          if(m.type==='childList'){
            var adds=m.addedNodes||[];
            for(var j=0;j<adds.length;j++){
              var n=adds[j];
              if(!n||n.nodeType!==1)continue;
              if(n.nodeName==='IMG')handle(n);
              if(n.querySelectorAll){
                var sub=n.querySelectorAll('img');
                for(var k=0;k<sub.length;k++)handle(sub[k]);
              }
            }
          }else if(m.type==='attributes'&&m.target&&m.target.nodeName==='IMG'){
            handle(m.target);
          }
        }
      });
      mo.observe(DOC,{childList:true,subtree:true,attributes:true,attributeFilter:['src','data-src','data-original','data-lazy-src','data-lazyload']});
    }
  }catch(e){}
  // iframe 内滚动可能触发懒加载写入新图片 → 节流扫描
  try{
    var w0=IF.contentWindow;
    if(w0)w0.addEventListener('scroll',throttle,{passive:true});
  }catch(e){}

  fixReferrerMeta();
  scan();
  [400,1200,2500,5000,9000].forEach(function(t){ setTimeout(function(){
    try{ if(IF.contentDocument!==DOC)return; }catch(e){ return; }
    fixReferrerMeta(); scan();
  },t); });
}

// ========== 回复跳转：点击「回复」时直接进入独立回复页（有完整工具栏与 UBB 注入） ==========

function ubbBar(){ if(!on('ubbBar'))return; if(window.__ubbDone)return; window.__ubbDone=true;
  function tryBuild(){ var ta=document.getElementById('needmessage'); if(ta&&!window.__mtUbbDone)ubbBuildBar(); }
  tryBuild();
  var mo=new MutationObserver(function(){ clearTimeout(window.__ubbT); window.__ubbT=setTimeout(tryBuild,300); });
  mo.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('focus',function(){setTimeout(tryBuild,100);},true);
  // 兜底：iframe（小窗）内脚本运行时机可能晚于 needmessage 的首次渲染，
  // 或快速回复框由异步脚本在 load 后才补齐；这里在 load 后及延时时再重试一次，确保注入。
  if(document.readyState==='complete'){ setTimeout(tryBuild,200); }
  else { window.addEventListener('load',function(){ setTimeout(tryBuild,200); setTimeout(tryBuild,800); }); }
  // 暴露给父页：小窗 iframe 内脚本运行后，父页可调用它强制完整重建 UBB 栏（同源复用完整逻辑）。
  // 同时监听父页 postMessage 的「重试」通知，解决 iframe 内脚本运行时机晚于工具栏渲染的问题。
  window.__mtUbbRetry=function(){ try{ window.__mtUbbDone=false; window.__ubbDone=false; tryBuild(); }catch(e){} };
  window.addEventListener('message',function(e){
    try{ if(e.data&&e.data.__mtUbbRetry){ window.__mtUbbRetry(); } }catch(err){}
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
function autoExpandContent(){ if(window.__autoExpand)return; window.__autoExpand=true; // 固定开启：开关按钮已移除
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

// ========== 小窗浏览帖子（从底部滑入打开，多标签版） ==========
// 参考「全站链接小窗」升级：多标签、历史导航、拖拽高度记忆、媒体预览、返回键关闭。
// 与全站小窗的关键差异（刻意为之）：
// 1) 不在 iframe 内做「全量链接拦截 + postMessage 转发」。全站小窗的该机制会把
//    Discuz 的「编辑自己的回复」链接（mod=post&action=edit&pid=..）拖进全新标签页，
//    导致编辑丢失原评论上下文、无法编辑原内容。本脚本 iframe 内除「媒体文件链接」
//    外的一切链接（编辑/回复/分页/帖子/附件）一律原生导航，编辑流程与直接打开
//    浏览器完全一致。
// 2) 保留方案 X：父页向小窗 iframe 注入 autoReply + UBB 快捷输入栏 + urlLink，
//    小窗内回复编辑器仍然有完整 UBB 按钮（全站小窗不支持）。
// 3) 保留 smallWindowImageFixer 图片防盗链修复（iframe 内帖子图片）。
var SW = {
  opened:false, root:null, mask:null, panel:null, head:null, titleEl:null, tabbar:null, content:null,
  tabs:[], active:-1, tabSeq:0, drag:null, historyMarker:false, closingByHistory:false
};

function smallWindow(){ if(!on('smallWindow'))return; if(window.__smallW)return; window.__smallW=true;
  if(!/mod=guide|mod=forum|mod=viewthread|thread-/.test(location.href))return;
  injectSmallWindowStyle();
  installSwMessageBridge();
  bindSmallWindow();
  // 返回键（Android）关闭小窗：打开小窗时压入一条带标记的历史记录，
  // popstate 回到「无标记」状态即视为用户按了返回键 → 关闭小窗。
  window.addEventListener('popstate',function(e){
    if(!SW.opened||!SW.historyMarker)return;
    if(!(e.state&&e.state.__mtfSw)){
      SW.historyMarker=false;
      finishCloseSw();
    }
  });
}

function swIcon(name){
  var map={
    back:'<path d="M10.5 3.5 5 8l5.5 4.5"/><path d="M5.5 8H14"/>',
    forward:'<path d="m5.5 3.5 5.5 4.5-5.5 4.5"/><path d="M10.5 8H2"/>',
    reload:'<path d="M13 5V2.5L15 4.5"/><path d="M13.8 4.2A6 6 0 1 0 14 9"/>',
    external:'<path d="M6 3H3v10h10V9"/><path d="M9.5 3H13v3.5"/><path d="M7.5 8.5 13 3"/>',
    close:'<path d="m3 3 10 10M13 3 3 13"/>'
  };
  return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+map[name]+'</svg>';
}

function swMediaType(url){
  var p='';
  try{ p=new URL(url).pathname.toLowerCase(); }catch(e){ return ''; }
  if(/\.(png|jpe?g|gif|webp|bmp|avif|svg|ico)(?:$|\?)/i.test(p))return 'image';
  if(/\.(mp4|webm|m4v|mov|ogv)(?:$|\?)/i.test(p))return 'video';
  if(/\.(mp3|m4a|aac|ogg|wav|flac)(?:$|\?)/i.test(p))return 'audio';
  if(/\.pdf(?:$|\?)/i.test(p))return 'pdf';
  return '';
}

// ========== 小窗手势：屏蔽浏览器横滑 + 滑动切换标签 + 屏蔽论坛侧边栏 ==========
// 循环切换标签（delta=1 下一个 / -1 上一个，到边界回绕）
function swSwipeTab(delta){
  if(SW.tabs.length<2)return;
  var n=SW.active+delta;
  if(n<0)n=SW.tabs.length-1;
  if(n>=SW.tabs.length)n=0;
  activateSwTab(n);
}
// 通用横向滑动手势：绑定到任意 DOM 根节点（标题栏 / iframe 文档）。
// 触发条件：横向位移 ≥ 90px，且纵向位移 ≤ 横向 35%（接近水平），防误触。
// skipSelector 内的元素（如顶栏按钮、输入框）不触发手势。
function attachSwSwipe(root,onSwipe,skipSelector){
  var sx=null,sy=null,fired=false;
  root.addEventListener('pointerdown',function(e){
    if(skipSelector&&e.target&&e.target.closest&&e.target.closest(skipSelector))return;
    sx=e.clientX; sy=e.clientY; fired=false;
  },true);
  root.addEventListener('pointermove',function(e){
    if(sx==null||fired)return;
    var dx=e.clientX-sx, dy=e.clientY-sy;
    var adx=Math.abs(dx), ady=Math.abs(dy);
    if(adx<90 || ady>adx*0.35)return;
    fired=true;
    onSwipe(dx<0?1:-1);
  },true);
  function reset(){ sx=null; sy=null; }
  root.addEventListener('pointerup',reset,true);
  root.addEventListener('pointercancel',reset,true);
}
// iframe 内容区手势三件套（每次 iframe load 后调用，文档级幂等）：
// ① documentElement touch-action:pan-y → 屏蔽浏览器横滑手势（Via 全屏前进/后退、
//    边缘手势等），只保留页面垂直滚动；
// ② 内容区横滑 → 循环切换标签；
// ③ 屏蔽论坛（comiis 模板）右滑打开侧边栏。
function swGestureIntoFrame(ifr){
  try{
    var gd=ifr.contentDocument; if(!gd)return;
    // ① 屏蔽浏览器横滑手势
    try{ gd.documentElement.style.touchAction='pan-y'; }catch(e){}
    // ② 内容区横滑切换标签（文档级幂等；回调实时作用于当前激活标签）
    if(!gd.__mtfSwGesture){
      gd.__mtfSwGesture=true;
      attachSwSwipe(gd,function(dir){ swSwipeTab(dir); },'input,textarea');
    }
    // ③ 屏蔽论坛右滑侧边栏（延时重试对抗页面懒加载脚本反覆盖）
    blockComiisSidebar(gd);
    setTimeout(function(){ try{ blockComiisSidebar(gd); }catch(e){} },700);
    setTimeout(function(){ try{ blockComiisSidebar(gd); }catch(e){} },2500);
  }catch(e){}
}
// 屏蔽论坛 comiis 模板「右滑打开侧边栏」（comiis_leftnv()）：
// 1) CSS !important 强制隐藏侧边栏容器与遮罩，解除 body 滚动锁定；
// 2) 覆盖打开函数为空操作，defineProperty 防页面脚本反覆盖；
// 3) MutationObserver 兜底复位 comiis_showleftnv 类/overflow/display；
// 4) 可重复调用；全部注入在小窗 iframe 文档内，关闭小窗即消失。
function blockComiisSidebar(doc){
  try{
    if(!doc||!doc.defaultView)return;
    var w=doc.defaultView;
    if(!doc.__mtfSideBlock){
      doc.__mtfSideBlock=true;
      try{
        var st=doc.createElement('style');
        st.setAttribute('data-mtf-sideblock','1');
        st.textContent='.comiis_sidenv_box,.comiis_leftmenubg{display:none!important;} body{overflow:visible!important;height:auto!important;width:auto!important;}';
        (doc.head||doc.documentElement).appendChild(st);
      }catch(e){}
    }
    try{
      var noop=function(){};
      w.comiis_leftnv=noop;
      try{
        Object.defineProperty(w,'comiis_leftnv',{configurable:true,enumerable:true,get:function(){return noop;},set:function(v){}});
      }catch(e){}
    }catch(e){}
    if(!doc.__mtfSideMo){
      doc.__mtfSideMo=true;
      try{
        var mo=new w.MutationObserver(function(){
          try{
            var body=doc.querySelector('.comiis_body');
            if(body&&body.classList.contains('comiis_showleftnv')){
              body.classList.remove('comiis_showleftnv');
              body.classList.add('comiis_hideleftnv');
            }
            if(body&&body.style.overflow==='hidden')body.style.overflow='';
            if(doc.body&&doc.body.style.overflow==='hidden')doc.body.style.overflow='';
            var box=doc.querySelector('.comiis_sidenv_box'),bg=doc.querySelector('.comiis_leftmenubg');
            if(box&&box.style.display==='block')box.style.display='none';
            if(bg&&bg.style.display==='block')bg.style.display='none';
          }catch(e){}
        });
        mo.observe(doc.documentElement,{attributes:true,subtree:true,attributeFilter:['class','style']});
      }catch(e){}
    }
    // 若此刻侧边栏已处于打开状态，立即复位
    try{
      var b2=doc.querySelector('.comiis_body');
      if(b2&&b2.classList.contains('comiis_showleftnv')){ b2.classList.remove('comiis_showleftnv'); b2.classList.add('comiis_hideleftnv'); }
      if(doc.body&&doc.body.style.overflow==='hidden')doc.body.style.overflow='';
      var bx=doc.querySelector('.comiis_sidenv_box'),bg2=doc.querySelector('.comiis_leftmenubg');
      if(bx&&bx.style.display==='block')bx.style.display='none';
      if(bg2&&bg2.style.display==='block')bg2.style.display='none';
    }catch(e){}
  }catch(e){}
}

// 父页预览图防盗链兜底：GM_xmlhttpRequest 带正确 Referer 代抓，转 data URL
function swFetchImageViaGM(url,cb){
  try{
    if(typeof GM_xmlhttpRequest!=='function'){ cb(''); return; }
    var done=false;
    function ok(v){ if(done)return; done=true; cb(v||''); }
    GM_xmlhttpRequest({method:'GET',url:url,timeout:20000,anonymous:false,responseType:'arraybuffer',
      headers:{'Referer':'https://bbs.binmt.cc/','User-Agent':(navigator.userAgent||'')},
      onload:function(r){
        var buf=null;
        if(r&&r.response instanceof ArrayBuffer)buf=r.response;
        else if(r&&r.response&&r.response.byteLength)buf=r.response;
        else if(r&&r.responseBytes)buf=r.responseBytes;
        if(!buf||!buf.byteLength){ ok(''); return; }
        try{
          var ext=String(url).split('?')[0].split('#')[0].toLowerCase().match(/\.(png|jpe?g|gif|webp|bmp|avif|svg|ico)$/);
          var map={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',bmp:'image/bmp',avif:'image/avif',svg:'image/svg+xml',ico:'image/x-icon'};
          var mime=(ext&&map[ext[1]])||'image/jpeg';
          var bytes=new Uint8Array(buf),bin='',CH=0x8000;
          for(var i=0;i<bytes.length;i+=CH){
            bin+=String.fromCharCode.apply(null,bytes.subarray(i,Math.min(i+CH,bytes.length)));
          }
          ok('data:'+mime+';base64,'+btoa(bin));
        }catch(e2){ ok(''); }
      },
      onerror:function(){ok('');},ontimeout:function(){ok('');}
    });
  }catch(e){ cb(''); }
}

// 父页消息桥：接收 iframe 内消息（仅认来源为当前标签 iframe 的消息）
// - MTF_SW_MEDIA：媒体链接 → 小窗内预览
// - MTF_SW_OPEN：论坛导航/版块/首页等页面链接 → 小窗新开标签
// - MTF_SW_EXTERNAL：外链 → 新窗口打开（保持「全站链接小窗」的外链打开体验）
function installSwMessageBridge(){
  if(window.__mtfSwBridge)return; window.__mtfSwBridge=true;
  window.addEventListener('message',function(e){
    var d=e.data;
    if(!d||!SW.opened)return;
    if(d.type!=='MTF_SW_MEDIA'&&d.type!=='MTF_SW_EXTERNAL'&&d.type!=='MTF_SW_OPEN')return;
    var url=String(d.url||'');
    if(!/^https?:\/\//i.test(url))return;
    var tab=null;
    for(var i=0;i<SW.tabs.length;i++){
      var t=SW.tabs[i];
      if(t.frame&&t.frame.contentWindow===e.source){ tab=t; break; }
    }
    if(!tab)return;
    if(d.type==='MTF_SW_MEDIA')openSwMedia(tab,url);
    else if(d.type==='MTF_SW_OPEN')openSmallWindow(url,String(d.title||'').replace(/\s+/g,' ').trim().slice(0,80),false);
    else window.open(url,'_blank');
  });
}

// ========== iframe 内链接桥（会被 buildInjectionScript 注入小窗） ==========
// 三类链接三种处理，绝不越界：
// ① 媒体文件链接（图片/视频/音频/PDF）→ 转发父页在小窗内预览，不离开小窗；
// ② 论坛域内链接（编辑/回复/分页/帖子/附件等）→ 放行，保持 iframe 内原生导航
//    —— 这是吸取全站小窗的教训：全量拦截会破坏「编辑自己的回复」流程；
// ③ 外链（非 binmt.cc 域名）→ 转发父页新窗口打开，避免外站在 iframe 内被
//    X-Frame-Options 拦截白屏，同时保持「全站链接小窗」处理外链的体验。
function mtMediaBridge(){
  if(window.__mtMediaBridge)return; window.__mtMediaBridge=true;
  document.addEventListener('click',function(e){
    if(e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
    var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;
    if(!a||!a.href)return;
    if(a.hasAttribute&&a.hasAttribute('download'))return;
    var u=a.href;
    if(!/^https?:\/\//i.test(u))return;
    // ① 媒体文件 → 父页预览
    if(/\.(png|jpe?g|gif|webp|bmp|avif|svg|ico|mp4|webm|m4v|mov|ogv|mp3|m4a|aac|ogg|wav|flac|pdf)(?:$|\?)/i.test(u)){
      e.preventDefault(); e.stopPropagation();
      try{
        window.parent.postMessage({type:'MTF_SW_MEDIA',url:u,title:((a.getAttribute('title')||a.textContent||'')+'').replace(/\s+/g,' ').trim().slice(0,80)},'*');
      }catch(err){}
      return;
    }
    // ② 论坛域内链接分类处理
    var host='';
    try{ host=new URL(u,location.href).hostname; }catch(err){}
    if(/\.binmt\.cc$/i.test(host)){
      var lower=u.toLowerCase();
      // 功能链接：发帖/编辑/回复/登录/退出 → 放行原生导航
      //（编辑自己的回复必须原生导航，避免重蹈全站小窗的覆辙）
      if(/mod=post|mod=logging/.test(lower))return;
      // 帖子链接：在列表页（导读/版块/社区/首页）中点击 → 仅卡片右半区（≥50%）
      // 转发父页新开标签；左半区（头像区）/非卡片内 → 放行原生。
      // 在帖子页中点击（引用其他帖/翻页）→ 放行原生导航，保持帖子上下文与翻页体验。
      if(/thread-\d+|mod=viewthread/.test(lower)){
        var curIsPost=/thread-\d+|mod=viewthread/i.test(location.href);
        if(curIsPost)return;
        var card=a.closest('li.forumlist_li')||a.closest('[class*="forumlist_li"]')||a.closest('.comiis_forumlist li');
        if(card){
          try{
            var r1=card.getBoundingClientRect();
            if(r1.width<=0 || (e.clientX-r1.left)/r1.width<0.5)return;
          }catch(err1){ return; }
        }else{
          return;
        }
        e.preventDefault(); e.stopPropagation();
        try{
          window.parent.postMessage({type:'MTF_SW_OPEN',url:u,title:((a.getAttribute('title')||a.textContent||'')+'').replace(/\s+/g,' ').trim().slice(0,80)},'*');
        }catch(err){}
        return;
      }
      // 仅「导读」链接转发父页开新标签；其余论坛链接（首页/社区/我的/版块等）
      // 在 iframe 内保持原生导航。
      if(/mod=guide/.test(lower)){
        e.preventDefault(); e.stopPropagation();
        try{
          window.parent.postMessage({type:'MTF_SW_OPEN',url:u,title:((a.getAttribute('title')||a.textContent||'')+'').replace(/\s+/g,' ').trim().slice(0,80)},'*');
        }catch(err){}
        return;
      }
      return;
    }
    // ③ 外链 → 父页新窗口打开
    e.preventDefault(); e.stopPropagation();
    try{
      window.parent.postMessage({type:'MTF_SW_EXTERNAL',url:u},'*');
    }catch(err){}
  },true);
}

function injectSmallWindowStyle(){ if(document.getElementById('mtf-sw-style'))return;
  var st=document.createElement('style'); st.id='mtf-sw-style';
  st.textContent=
    '.mtf-sw-root{position:fixed;inset:0;z-index:999997;pointer-events:none;}'+
    '.mtf-sw-mask{position:absolute;inset:0;background:rgba(0,0,0,.45);opacity:0;transition:opacity .25s ease;pointer-events:auto;}'+
    '.mtf-sw-panel{position:absolute;left:0;right:0;bottom:0;height:var(--mtf-sw-height,92%);max-height:98%;min-height:45%;background:#fff;border-radius:18px 18px 0 0;'+
      'transform:translateY(100%);transition:transform .28s cubic-bezier(.32,.72,.36,1);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -4px 24px rgba(0,0,0,.2);pointer-events:auto;}'+
    '.mtf-sw-show .mtf-sw-mask{opacity:1;}'+
    '.mtf-sw-show .mtf-sw-panel{transform:translateY(0);}'+
    '.mtf-sw-resize{height:7px;flex:none;cursor:ns-resize;touch-action:none;position:relative;background:transparent;}'+
    '.mtf-sw-resize:after{content:"";position:absolute;left:50%;top:3px;width:42px;height:4px;border-radius:4px;transform:translateX(-50%);background:rgba(0,0,0,.18);}'+
    '.mtf-sw-head{display:flex;align-items:center;gap:5px;padding:4px 8px;background:#53BCF5;color:#fff;flex:none;}'+
    '.mtf-sw-nav{display:flex;gap:4px;flex:none;}'+
    '.mtf-sw-btn{width:32px;height:32px;border:0;border-radius:50%;padding:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.2);color:#fff;cursor:pointer;user-select:none;}'+
    '.mtf-sw-btn:active{transform:scale(.94);}'+
    '.mtf-sw-title{min-width:0;flex:1;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 4px;}'+
    '.mtf-sw-tabbar{display:flex;align-items:center;gap:4px;padding:4px 7px;background:#53BCF5;border-bottom:1px solid rgba(255,255,255,.24);overflow-x:auto;scrollbar-width:none;flex:none;}'+
    '.mtf-sw-tabbar::-webkit-scrollbar{display:none;}'+
    '.mtf-sw-tab{height:30px;min-width:64px;max-width:76px;display:flex;align-items:center;gap:3px;padding:0 7px;border:0;border-radius:8px;background:rgba(255,255,255,.18);font-size:12px;color:#fff;flex:none;cursor:pointer;}'+
    '.mtf-sw-tab.active{background:rgba(255,255,255,.92);color:#222;}'+
    '.mtf-sw-tab span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;text-align:center;}'+
    '.mtf-sw-tab b{font-weight:400;font-size:15px;line-height:1;opacity:.72;}'+
    '.mtf-sw-content{position:relative;flex:1;min-height:0;background:#fff;}'+
    '.mtf-sw-tabview{position:absolute;inset:0;display:none;}'+
    '.mtf-sw-tabview.active{display:block;}'+
    '.mtf-sw-iframe{width:100%;height:100%;border:0;background:#fff;display:block;}'+
    '.mtf-sw-media{position:absolute;inset:0;z-index:5;background:#111;display:none;flex-direction:column;}'+
    '.mtf-sw-media.show{display:flex;}'+
    '.mtf-sw-media-bar{display:flex;justify-content:flex-end;gap:8px;padding:8px;flex:none;background:rgba(0,0,0,.45);}'+
    '.mtf-sw-media-bar button{border:0;border-radius:9px;padding:6px 12px;background:rgba(255,255,255,.25);color:#fff;font-size:12px;cursor:pointer;}'+
    '.mtf-sw-media-body{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:8px;box-sizing:border-box;}'+
    '.mtf-sw-media-body img{max-width:100%;max-height:100%;object-fit:contain;}'+
    '.mtf-sw-media-body video{max-width:100%;max-height:100%;}'+
    '.mtf-sw-media-body audio{width:86%;}'+
    '.mtf-sw-media-body iframe{width:100%;height:100%;border:0;background:#fff;}'+
    '.mtf-sw-media-err{color:#ccc;font-size:13px;text-align:center;padding:20px;line-height:1.8;}';
  (document.head||document.documentElement).appendChild(st);
}

function setSwHeight(percent){
  percent=Math.max(45,Math.min(98,Number(percent)||92));
  if(SW.panel)SW.panel.style.setProperty('--mtf-sw-height',percent+'%');
  try{ localStorage.setItem('mtf_sw_height',String(Math.round(percent))); }catch(e){}
}
function loadSwHeight(){
  var v=92;
  try{ v=parseFloat(localStorage.getItem('mtf_sw_height'))||92; }catch(e){}
  return Math.max(45,Math.min(98,v));
}

function openSwPanel(){
  if(SW.opened)return;
  SW.opened=true; SW.tabs=[]; SW.active=-1;
  var root=document.createElement('div'); root.className='mtf-sw-root';
  var mask=document.createElement('div'); mask.className='mtf-sw-mask';
  var panel=document.createElement('div'); panel.className='mtf-sw-panel';
  var resize=document.createElement('div'); resize.className='mtf-sw-resize'; resize.title='拖动调整小窗高度';
  var head=document.createElement('div'); head.className='mtf-sw-head';
  var nav=document.createElement('div'); nav.className='mtf-sw-nav';
  function btn(title,ic){ var b=document.createElement('button'); b.className='mtf-sw-btn'; b.title=title; b.innerHTML=swIcon(ic); return b; }
  var back=btn('后退','back'),forward=btn('前进','forward'),reload=btn('刷新','reload');
  nav.appendChild(back); nav.appendChild(forward); nav.appendChild(reload);
  var titleEl=document.createElement('div'); titleEl.className='mtf-sw-title'; titleEl.textContent='帖子小窗';
  var acts=document.createElement('div'); acts.className='mtf-sw-nav';
  var openNew=btn('新窗口打开','external'),close=btn('关闭','close');
  acts.appendChild(openNew); acts.appendChild(close);
  head.appendChild(nav); head.appendChild(titleEl); head.appendChild(acts);
  var tabbar=document.createElement('div'); tabbar.className='mtf-sw-tabbar';
  var content=document.createElement('div'); content.className='mtf-sw-content';
  panel.appendChild(resize); panel.appendChild(head); panel.appendChild(tabbar); panel.appendChild(content);
  root.appendChild(mask); root.appendChild(panel);
  document.body.appendChild(root);
  SW.root=root; SW.mask=mask; SW.panel=panel; SW.head=head; SW.titleEl=titleEl; SW.tabbar=tabbar; SW.content=content;
  setSwHeight(loadSwHeight());
  // 标题栏手势：横滑循环切换标签（排除按钮区域，按钮仍正常点击）
  head.style.touchAction='none';
  attachSwSwipe(head,function(dir){ swSwipeTab(dir); },'.mtf-sw-btn');
  // 历史导航：直接操作 iframe 自身的 history（同源），iframe 内翻页/回复/编辑的
  // 状态完整保留，后退/前进与浏览器行为一致。
  back.onclick=function(){ var t=activeSwTab(); if(t&&t.frame){ try{ t.frame.contentWindow.history.back(); }catch(e){} } };
  forward.onclick=function(){ var t=activeSwTab(); if(t&&t.frame){ try{ t.frame.contentWindow.history.forward(); }catch(e){} } };
  reload.onclick=function(){ var t=activeSwTab(); if(t&&t.frame){ try{ t.frame.contentWindow.location.reload(); }catch(e){} } };
  openNew.onclick=function(){
    var t=activeSwTab(); if(!t)return;
    var u=t.url;
    try{ if(t.frame&&t.frame.contentWindow&&t.frame.contentWindow.location)u=t.frame.contentWindow.location.href; }catch(e){}
    window.open(u,'_blank');
  };
  close.onclick=function(e){ e.stopPropagation(); closeSwPanel(true); };
  mask.onclick=function(){ closeSwPanel(true); };
  // 拖拽调整高度（pointer 事件，兼容触屏）
  resize.addEventListener('pointerdown',function(e){
    e.preventDefault();
    SW.drag={startY:e.clientY,startH:panel.getBoundingClientRect().height};
    try{ if(resize.setPointerCapture)resize.setPointerCapture(e.pointerId); }catch(err){}
  });
  resize.addEventListener('pointermove',function(e){
    if(!SW.drag)return;
    var h=SW.drag.startH+(SW.drag.startY-e.clientY);
    var pct=h/window.innerHeight*100;
    if(SW.panel)SW.panel.style.setProperty('--mtf-sw-height',Math.max(45,Math.min(98,pct))+'%');
  });
  resize.addEventListener('pointerup',function(){
    if(!SW.drag)return;
    var cur=parseFloat(String(SW.panel.style.getPropertyValue('--mtf-sw-height')||'').replace('%',''))||92;
    setSwHeight(cur);
    SW.drag=null;
  });
  // 返回键关闭标记：压入一条带标记的历史，popstate 检测到回到「无标记」状态时关闭
  if(!SW.historyMarker){
    try{ history.pushState({__mtfSw:true},'',location.href); SW.historyMarker=true; }catch(e){}
  }
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ root.classList.add('mtf-sw-show'); }); });
  window.__mtSwClose=function(){ closeSwPanel(true); };
}

function createSwTab(url,title,activate){
  var view=document.createElement('div'); view.className='mtf-sw-tabview';
  var isMedia=swMediaType(url)!=='';
  var iframe=null;
  if(!isMedia){
    iframe=document.createElement('iframe'); iframe.className='mtf-sw-iframe';
    iframe.setAttribute('src',url); iframe.setAttribute('scrolling','auto');
    // 强制 iframe 内子资源请求携带 Referer（图片防盗链兜底之一，配合 smallWindowImageFixer）
    iframe.setAttribute('referrerpolicy','no-referrer-when-downgrade');
    view.appendChild(iframe);
  }
  SW.content.appendChild(view);
  var t={id:++SW.tabSeq,url:url,title:String(title||'帖子').replace(/\s+/g,' ').trim().slice(0,80),view:view,frame:iframe,media:null,loading:!isMedia,scrollY:0,scrollX:0};
  if(iframe){
    iframe.addEventListener('load',function(){
      t.loading=false;
      // 保留方案 X：注入 autoReply + UBB 快捷输入栏 + urlLink + 链接桥
      injectIntoSmallWindowIframe(iframe);
      // 保留：帖子内图片防盗链修复
      smallWindowImageFixer(iframe);
      // 手势三件套：屏蔽浏览器横滑手势 + 内容区横滑切换标签 + 屏蔽论坛侧边栏
      swGestureIntoFrame(iframe);
      try{
        var dt=iframe.contentDocument&&iframe.contentDocument.title;
        if(dt){ dt=String(dt).replace(/\s+/g,' ').trim().slice(0,80); if(dt)t.title=dt; }
      }catch(e){}
      updateSwUI();
    });
  }
  SW.tabs.push(t);
  // 注意：此处不修改 SW.active，激活统一由调用方 activateSwTab 完成，
  // 否则 activateSwTab 的「切走前保存旧标签滚动位置」会因 prev 已指向新标签而失效，
  // 导致上一个标签的滚动位置丢失（切回时回到顶部）。
  updateSwUI();
  return t;
}

function activeSwTab(){ return SW.tabs[SW.active]||null; }

// ---- 滚动位置保存/恢复（切换标签不丢进度） ----
function saveSwScroll(t){
  if(!t||!t.frame)return;
  try{
    var d=t.frame.contentDocument;
    if(d&&d.scrollingElement){
      t.scrollY=d.scrollingElement.scrollTop;
      t.scrollX=d.scrollingElement.scrollLeft;
    }
  }catch(e){}
}
function restoreSwScroll(t){
  if(!t||!t.frame||(!t.scrollY&&!t.scrollX))return;
  try{
    var d=t.frame.contentDocument;
    if(d&&d.scrollingElement){
      d.scrollingElement.scrollTop=t.scrollY;
      d.scrollingElement.scrollLeft=t.scrollX;
    }
  }catch(e){}
}

// 激活标签：切走前保存旧标签滚动位置，切到后恢复新标签滚动位置
// （延迟再恢复一次，等 iframe 布局稳定）；savePrev=false 时不保存旧标签
// （关闭标签场景，旧标签已被移除）。
function activateSwTab(i,savePrev){
  if(i<0||i>=SW.tabs.length)return;
  var prev=SW.active;
  if(savePrev!==false && prev>=0 && prev!==i && SW.tabs[prev])saveSwScroll(SW.tabs[prev]);
  SW.active=i;
  SW.tabs.forEach(function(x,n){ if(x.view)x.view.classList[n===i?'add':'remove']('active'); });
  var t=SW.tabs[i];
  if(t){
    restoreSwScroll(t);
    [50,250].forEach(function(d){
      setTimeout(function(){ if(SW.opened && SW.tabs[SW.active]===t)restoreSwScroll(t); },d);
    });
  }
  updateSwUI();
}

function closeSwTab(i){
  var t=SW.tabs[i]; if(!t)return;
  if(t.view&&t.view.parentNode)t.view.parentNode.removeChild(t.view);
  SW.tabs.splice(i,1);
  if(!SW.tabs.length){ closeSwPanel(true); return; }
  if(SW.active>i)SW.active--;
  else if(SW.active>=SW.tabs.length)SW.active=SW.tabs.length-1;
  activateSwTab(SW.active,false);
}

function swTabLabel(title){
  var chars=Array.prototype.slice.call(String(title||'帖子'));
  return chars.length>4?chars.slice(0,4).join('')+'…':chars.join('');
}

function updateSwUI(){
  if(!SW.tabbar)return;
  SW.tabbar.innerHTML='';
  SW.tabs.forEach(function(t,i){
    var b=document.createElement('button');
    b.className='mtf-sw-tab'+(i===SW.active?' active':'');
    b.title=t.title||'帖子';
    b.innerHTML='<span></span><b>×</b>';
    b.firstChild.textContent=swTabLabel(t.title);
    b.onclick=function(e){
      if(e.target===b.querySelector('b')){ e.stopPropagation(); closeSwTab(i); }
      else activateSwTab(i);
    };
    SW.tabbar.appendChild(b);
  });
  var t=activeSwTab();
  if(SW.titleEl)SW.titleEl.textContent=t?(t.loading?'加载中…':(t.title||'帖子')):'帖子小窗';
}

// 媒体预览：图片/视频/音频/PDF 在对应标签内以预览层显示，不离开小窗
function openSwMedia(tab,url){
  var type=swMediaType(url);
  if(!type)return;
  if(!tab.media){
    tab.media=document.createElement('div'); tab.media.className='mtf-sw-media';
    var bar=document.createElement('div'); bar.className='mtf-sw-media-bar';
    // 有 iframe（帖子内点媒体链接）：返回帖子；纯媒体标签：关闭标签
    var btnBack=document.createElement('button'); btnBack.textContent=tab.frame?'返回帖子':'关闭标签';
    var btnOpen=document.createElement('button'); btnOpen.textContent='新窗口打开';
    bar.appendChild(btnBack); bar.appendChild(btnOpen);
    var body=document.createElement('div'); body.className='mtf-sw-media-body';
    tab.media.appendChild(bar); tab.media.appendChild(body);
    tab.view.appendChild(tab.media);
    btnBack.onclick=function(e){ e.stopPropagation();
      if(tab.frame){ closeSwMedia(tab); return; }
      var i=SW.tabs.indexOf(tab);
      if(i>=0)closeSwTab(i);
    };
    btnOpen.onclick=function(e){ e.stopPropagation(); window.open(url,'_blank'); };
  }
  tab.mediaUrl=url;
  var body=tab.media.querySelector('.mtf-sw-media-body');
  body.innerHTML='';
  var el;
  if(type==='image'){
    el=document.createElement('img');
    el.onerror=function(){
      // 图床防盗链导致加载失败 → GM 代抓（带正确 Referer）转 data URL 兜底
      if(el.__mtProxyTried)return;
      el.__mtProxyTried=true;
      swFetchImageViaGM(url,function(dataUrl){
        if(!dataUrl){
          body.innerHTML='<div class="mtf-sw-media-err">图片加载失败（可能被防盗链拦截）<br>请点右上角「新窗口打开」查看</div>';
          return;
        }
        el.src=dataUrl;
      });
    };
  }else if(type==='video'){ el=document.createElement('video'); el.controls=true; el.playsInline=true; }
  else if(type==='audio'){ el=document.createElement('audio'); el.controls=true; }
  else { el=document.createElement('iframe'); }
  el.src=url;
  body.appendChild(el);
  tab.media.classList.add('show');
  if(tab.frame)tab.frame.style.display='none';
}
function closeSwMedia(tab){
  if(!tab.media)return;
  tab.media.classList.remove('show');
  var v=tab.media.querySelector('video,audio');
  if(v){ try{ v.pause(); }catch(e){} }
  if(tab.frame)tab.frame.style.display='';
}

function closeSwPanel(useHistory){
  if(!SW.opened)return;
  // 先立即关闭面板（同步），再异步清理返回键历史标记。
  // 原实现依赖 history.back()→popstate 回调完成关闭，Via 等 WebView 中
  // popstate 触发不可靠，导致关闭按钮第一次点击无响应、需要点两次。
  finishCloseSw();
  if(useHistory){
    try{ history.back(); }catch(e){}
  }
}
function finishCloseSw(){
  SW.opened=false;
  if(SW.root&&SW.root.parentNode)SW.root.parentNode.removeChild(SW.root);
  SW.root=SW.mask=SW.panel=SW.head=SW.titleEl=SW.tabbar=SW.content=null;
  SW.tabs=[]; SW.active=-1;
  SW.historyMarker=false; SW.closingByHistory=false;
  window.__mtSwClose=null;
}

function openSmallWindow(url,title,asMedia){
  // 同 URL 已开标签 → 直接激活，不重复打开
  for(var i=0;i<SW.tabs.length;i++){
    if(SW.tabs[i].url===url){
      activateSwTab(i);
      if(asMedia && SW.tabs[i].media && !SW.tabs[i].media.classList.contains('show'))openSwMedia(SW.tabs[i],url);
      return;
    }
  }
  if(!SW.opened)openSwPanel();
  var t=createSwTab(url,title,true);
  activateSwTab(SW.tabs.length-1);
  // 媒体链接：直接在标签内预览（不加载 iframe）
  if(asMedia)openSwMedia(t,url);
}

function removeSmallWindow(){ closeSwPanel(true); }

// 全局事件委托：挂在 window 捕获阶段统一拦截「论坛域内链接」点击。
// 挂在 window 上（而非 document）是为了先于「全站链接小窗」的 document 捕获监听器执行：
// 两个脚本共存时，MT 论坛内的链接优先由本脚本的小窗打开（含 UBB 注入/图片修复），
// 全站链接小窗则继续处理其余链接（外链等），互不抢占。
// 拦截范围（论坛全域小窗，对齐「全站链接小窗」的全站打开设定）：
//   - 论坛域内所有页面链接：首页 / 社区 / 导读 / 版块（我的逆向交流、玩机交流、
//     编程开发、求助问答、综合交流、休闲灌水…）/ 帖子 / 消息 / 个人中心等；
//   - 媒体文件链接（图片/视频/音频/PDF）：小窗内直接预览。
// 放行项：小窗面板内链接、编辑/回复链接、退出登录、下载链接、同页锚点、非 http(s) 链接。
function bindSmallWindow(){
  if(window.__mtSwDelegated)return; window.__mtSwDelegated=true;
  window.addEventListener('click', function(e){
    if(e.__mtSwHandled)return;
    // 已被其他脚本（如全站链接小窗）提前处理 → 让路，避免双小窗同时弹出
    if(e.defaultPrevented)return;
    var t=e.target;
    if(!t || !t.closest)return;
    var a=t.closest('a[href]');
    if(!a)return;
    // 排除小窗自身面板内的链接；同时排除「全站链接小窗」(.mt-sw-root) 面板内的链接，
    // 两个脚本共存时互不嵌套、互不抢夺。
    if(a.closest('.mtf-sw-root') || a.closest('.mt-sw-root'))return;
    if(a.hasAttribute&&a.hasAttribute('download'))return;
    var url=a.href;
    if(!url || !/^https?:\/\//i.test(url))return;
    // 编辑/回复链接放行原生导航——避免重蹈全站小窗「编辑自己的回复」
    // 被拖进新编辑器页、无法编辑原评论的覆辙。
    if(/mod=post/i.test(url) && /action=(edit|reply)/i.test(url))return;
    // 退出登录放行原生（避免 iframe 内清 cookie 后页面状态混乱）
    if(/mod=logging/i.test(url) && /action=logout/i.test(url))return;
    // 媒体文件链接 → 小窗内直接预览
    var isMedia=swMediaType(url)!=='';
    if(isMedia){
      var mt=(a.getAttribute('title')||a.textContent||'').replace(/\s+/g,' ').trim().slice(0,80);
      e.preventDefault(); e.stopPropagation();
      e.__mtSwHandled=true;
      openSmallWindow(url, mt, true);
      return;
    }
    // 同页锚点跳转放行（不打断页面内定位）
    try{
      var u0=new URL(url), c0=new URL(location.href);
      if(u0.origin===c0.origin && u0.pathname===c0.pathname && u0.search===c0.search && u0.hash && u0.hash!==c0.hash)return;
    }catch(e0){}
    // 论坛域内链接分类收窄（限制触发小窗场景）：
    // ① 帖子列表卡片：仅点击卡片右半区（≥50%，标题/摘要区）触发小窗，
    //    左半区（头像区）不触发，保持原生行为；
    // ② 「导读」链接（mod=guide）触发小窗（打开导读页）；
    // ③ 其余论坛链接（首页/社区/我的/版块/个人中心等）一律不触发，保持原生。
    var host='';
    try{ host=new URL(url).hostname; }catch(e0){ return; }
    if(!/\.binmt\.cc$/i.test(host))return; // 外链交给全站链接小窗处理
    var isThread=/thread-\d+|mod=viewthread/i.test(url);
    var isGuide=/mod=guide/i.test(url);
    if(isThread){
      var card=a.closest('li.forumlist_li')||a.closest('[class*="forumlist_li"]')||a.closest('.comiis_forumlist li');
      if(card){
        try{
          var r0=card.getBoundingClientRect();
          if(r0.width<=0 || (e.clientX-r0.left)/r0.width<0.5)return;
        }catch(err0){ return; }
      }else{
        return; // 非列表卡片内的帖子链接（如帖子页引用）不触发
      }
    }else if(!isGuide){
      return; // 首页/社区/我的/版块等非导读链接不触发
    }
    var title=(a.getAttribute('title')||a.textContent||'').replace(/\s+/g,' ').trim().slice(0,80);
    e.preventDefault(); e.stopPropagation();
    e.__mtSwHandled=true;
    openSmallWindow(url, title, false);
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
  mtImgFix();
  autoSign();
  urlLink();
  copyCode();
  autoPage();
  guideNext();
  autoReply();
  hideOnly();
  personalBlack();
  ubbBar();             // UBB 快捷输入栏：iframe 内也需要（小窗里回复）
  replyRedirect();
  autoExpandContent();
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