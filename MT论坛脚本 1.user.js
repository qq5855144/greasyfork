// ==UserScript==
// @name         MT论坛网页版增强
// @namespace    https://bbs.binmt.cc/
// @version      1.0.6 
// @description  9项功能独立开关 + 注入侧边栏 + 移除原导航按钮 + UBB快捷输入栏(含图床上传)
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
    '.mt-switch input:checked + .mt-slider:before{transform:translateX(20px);}';
  (document.head||document.documentElement).appendChild(st);
}
function buildPanel(){
  var box=document.querySelector('.comiis_sidenv_box');
  if(!box){ console.log('[MT] buildPanel 跳过: 未找到 .comiis_sidenv_box'); return; }
  var ul=box.querySelector('UL.comiis_left_Touch.bdew');
  console.log('[MT] buildPanel: box=',box.tagName, 'boxH=',box.offsetHeight, 'ul=',!!ul);
  // 【关键约束】不得覆盖 UL.comiis_left_Touch.bdew 的 flex/height 布局属性，
  // 否则原生导航项会塌陷不可见（记忆库已多次确认此根因）。
  // 因此：不 insertBefore(ul)、不移动原生 li、不改 UL 布局，
  // 仅把「脚本开关面板」作为独立节点追加到抽屉末尾，与原生导航项互不干扰。
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
    row.appendChild(nm); row.appendChild(sw); p.appendChild(row);
  });
  // 面板追加到抽屉容器末尾（原生导航项保持原样、原布局）
  box.appendChild(p);
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

// ========== 自动上下页 ==========
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
  var Q=[],active=0,MAX=2; // 并发上限降到 2，避免列表页一次性打爆服务器
  var _rIdle=true,_scanBusy=false; // 请求间隔控制：避免频繁突发请求触发论坛风控
  function mark(c,t){ var b=c.querySelector('[data-mt-hide-status]');
    if(!b){ b=document.createElement('span'); b.setAttribute('data-mt-hide-status','1');
      b.style.cssText='font-size:11px;color:#999;margin-left:6px;';
      var a=c.querySelector('a[href*="thread-"],a[href*="mod=viewthread"]'); if(a&&a.parentNode)a.parentNode.appendChild(b); }
    if(b){ b.textContent=t||''; b.style.display=t?'':'none'; } }
  function hiddenHtml(h){ return /\[hide(?:=|\])|class=["'][^"']*(?:showhide|locked)[^"']*["']|id=["']showhide|回复(?:后)?可见|隐藏内容|本帖隐藏/i.test(h||''); }
  function done(x,keep){ x.c.setAttribute('data-mt-hide-filtered',keep?'hidden':'normal'); x.c.style.display=keep?'':'none'; mark(x.c,''); }
  function pump(){ while(active<MAX&&Q.length&&_rIdle){ (function(x){ active++;
    _rIdle=false; // 发一个请求后暂时置忙，由 fin 里恢复，形成串行间隔
    var r=new XMLHttpRequest(),end=false;
    function fin(ok,html){ if(end)return; end=true; active--;
      if(ok){done(x,hiddenHtml(html));}else{x.c.setAttribute('data-mt-hide-filtered','error');x.c.style.display='';mark(x.c,'检测失败，已保留');}
      // 请求间隔：串行 + 每个请求后间隔 600ms，避免列表页突发高频请求触发风控
      setTimeout(function(){ _rIdle=true; pump(); }, 600); }
    try{ r.open('GET',x.u,true); r.withCredentials=true; r.timeout=10000;
      r.onreadystatechange=function(){ if(r.readyState===4)fin(r.status>=200&&r.status<400,r.responseText); };
      r.onerror=function(){fin(false,'');}; r.ontimeout=function(){fin(false,'');}; r.send(null); }catch(e){fin(false,'');} })(Q.shift()); } }
  function itemOf(n){ var p=n,fb=null,d=0;
    while(p&&p!==document.body&&d++<10){ var tag=p.tagName||'',c=typeof p.className==='string'?p.className:'',id=p.id||'';
      if(/^(LI|TR|TBODY|ARTICLE)$/.test(tag)&&(/(?:^|[ _-])(?:forumlist_li|thread|topic|post)(?:[ _-]|$)/i.test(c)||/^normalthread_/i.test(id)))return p;
      if(!fb&&/^(LI|TR|ARTICLE)$/.test(tag))fb=p; p=p.parentElement; } return fb||n.parentElement; }
  function scan(){ if(_scanBusy)return; _scanBusy=true; // 防重入：MutationObserver 高频触发时不重复扫描
    try{
    var links=document.querySelectorAll('a[href*="thread-"],a[href*="mod=viewthread"]');
    for(var i=0;i<links.length;i++){ var n=links[i],c=itemOf(n);
      if(!c||c===document.body||c===document.documentElement||c.getAttribute('data-mt-hide-filtered'))continue;
      var u=n.href; if(!u)continue; c.setAttribute('data-mt-hide-filtered','checking'); c.style.display=''; mark(c,'检测中'); Q.push({c:c,u:u}); } pump();
    }finally{ _scanBusy=false; } }
  window.__hideScan=scan; scan();
  var _scanT=null;
  // 用防抖替代原先的裸 setTimeout + MutationObserver 立刻 scan，
  // 避免页面频繁变动时连续打请求。列表加载完成后再扫描一次即可。
  setTimeout(scan,800); setTimeout(scan,2000);
  if(!window.__hoObs){ window.__hoObs=new MutationObserver(function(){
      clearTimeout(_scanT); _scanT=setTimeout(scan, 800); });
    window.__hoObs.observe(document.documentElement,{childList:true,subtree:true}); }
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
  // 侧边栏可能是异步动态渲染的，用多轮定时重试 + MutationObserver 兜底，
  // 确保无论渲染快慢，只要 .comiis_sidenv_box 出现就补注入面板（不依赖固定 400ms）。
  var retries=[200,400,800,1500,3000,5000,8000];
  retries.forEach(function(ms){ setTimeout(buildPanel, ms); });
  try{
    var _panelMo=new MutationObserver(function(){
      if(document.getElementById('mt-feat-panel'))return; // 已注入，无需再跑
      if(document.querySelector('.comiis_sidenv_box')){ buildPanel(); }
    });
    // 关键：同时监听 childList（元素增删）和 attributes（侧边栏通过切换
    // comiis_showleftnv 类实现展开/收起，属于属性变化而非节点增删）。
    _panelMo.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    // 用户点击展开侧边栏时也会触发，加一个「点击任意处」兜底
    document.addEventListener('click', function(){
      setTimeout(function(){
        if(!document.getElementById('mt-feat-panel') && document.querySelector('.comiis_sidenv_box')){ buildPanel(); }
      }, 300);
    }, true);
  }catch(e){}
});
})();
