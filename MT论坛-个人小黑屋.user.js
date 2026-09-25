// ==UserScript==
// @name         MT论坛 - 个人小黑屋（侧边栏 + 全局屏蔽）
// @namespace    https://bbs.binmt.cc/
// @version      1.1.0
// @description  在 MT论坛 注入「个人小黑屋」：①右侧侧边栏管理黑名单（个人+论坛「我的屏蔽」+Discuz服务端三源合并，支持移出/清空/刷新）②按 UID 全局屏蔽黑名单用户发布的帖子/楼层。
// @author       Operit
// @match        *://bbs.binmt.cc/*
// @grant        none
// @run-at       document-end
// @noframes
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';
  if (window.__mtbh) return;
  var BASE = 'https://bbs.binmt.cc/';
  var KEY = 'personalBlackList';
  var NKEY = 'shieldList';
  var TKEY = 'mtThreadOwner';
  var SKEY = 'mtServerBlackList';
  var TSKEY = 'mtServerBlackListTs';

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '"').replace(/'/g, '&#39;'); }
  function fmtTime(ts) { if (!ts) return ''; var d = new Date(Number(ts)); if (isNaN(d.getTime())) return String(ts); function p(n) { return (n < 10 ? '0' : '') + n; } return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }

  function readList() {
    var raw = null; try { raw = localStorage.getItem(KEY); } catch (e) {}
    if (!raw) return [];
    var arr = null; try { arr = JSON.parse(raw); } catch (e2) { return []; }
    if (!arr) return [];
    if (!Array.isArray(arr)) {
      if (typeof arr === 'object') {
        if (arr.uid || arr.user) arr = [arr];
        else arr = Object.keys(arr).map(function (k) { var v = arr[k]; if (v && typeof v === 'object') { v.uid = v.uid || k; return v; } return { uid: k, user: '' }; });
      } else return [];
    }
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var it = arr[i]; if (it == null) continue;
      if (typeof it === 'string' || typeof it === 'number') out.push({ uid: String(it), user: '', time: 0 });
      else if (typeof it === 'object') {
        var uid = it.uid != null ? it.uid : (it.id != null ? it.id : (it.userid != null ? it.userid : ''));
        var user = it.user != null ? it.user : (it.username != null ? it.username : (it.name != null ? it.name : ''));
        var time = it.time != null ? it.time : (it.ts != null ? it.ts : 0);
        out.push({ uid: String(uid == null ? '' : uid), user: String(user == null ? '' : user), time: time });
      }
    }
    return out;
  }
  function writeList(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }

  function readNativeRaw() { var raw = null; try { raw = localStorage.getItem(NKEY); } catch (e) {} if (!raw) return []; var arr = null; try { arr = JSON.parse(raw); } catch (e2) { return []; } if (!arr) return []; if (!Array.isArray(arr)) arr = [arr]; return arr; }
  function readNativeUid() {
    var arr = readNativeRaw(); var out = [];
    for (var i = 0; i < arr.length; i++) {
      var it = arr[i]; if (!it || typeof it !== 'object') continue;
      var opt = String(it.option || '').trim();
      var t = String(it.text == null ? '' : it.text).replace(/\s+/g, '');
      if (!t) continue;
      if (opt === 'uid') { if (!/^[0-9]+$/.test(t)) continue; out.push({ uid: t, user: '', time: 0, _native: true, _opt: 'uid' }); }
      else if (opt === 'user') { out.push({ uid: '', user: t, time: 0, _native: true, _opt: 'user' }); }
    }
    return out;
  }
  function removeNativeUid(want) {
    var arr = readNativeRaw(); var before = arr.length;
    var w = String(want == null ? '' : want).replace(/\s+/g, '');
    arr = arr.filter(function (it) { if (!it || typeof it !== 'object') return true; var opt = String(it.option || '').trim(); var t = String(it.text == null ? '' : it.text).replace(/\s+/g, ''); if ((opt === 'uid' || opt === 'user') && t === w) return false; return true; });
    try { localStorage.setItem(NKEY, JSON.stringify(arr)); } catch (e) { return false; }
    return arr.length !== before;
  }
  function clearNativeUid() {
    var arr = readNativeRaw();
    arr = arr.filter(function (it) { if (!it || typeof it !== 'object') return true; var opt = String(it.option || '').trim(); return !(opt === 'uid' || opt === 'user'); });
    try { localStorage.setItem(NKEY, JSON.stringify(arr)); } catch (e) { return false; }
    return true;
  }

  var SLIST_URL = 'home.php?mod=space&do=friend&view=blacklist&mobile=2';
  var SERVER = { list: [], myUid: '', formhash: '', loaded: false, error: '' };
  function getFormhash() { var fh = ''; try { var el = document.querySelector('input[name=formhash]'); if (el) fh = el.value || ''; } catch (e) {} if (!fh) { try { var m = (document.documentElement.innerHTML || '').match(/formhash=([0-9a-zA-Z]{6,})/); if (m) fh = m[1]; } catch (e2) {} } if (!fh) { try { fh = window.formhash || ''; } catch (e3) {} } return fh; }
  function parseServerHtml(t) {
    var list = [], seen = {}; if (!t) return list;
    var reBlock = /<li[^>]*class=["']?[^"'>]*\bb_t\b[^"'>]*["']?[^>]*>([\s\S]*?)<\/li>/gi;
    var bm;
    while ((bm = reBlock.exec(t))) {
      var block = bm[1] || ''; var uid = '', name = '';
      var mTit = block.match(/<p[^>]*class=["']?[^"'>]*\btit\b[^"'>]*["']?[^>]*>[\s\S]*?<a[^>]*href=["'][^"']*\buid=(\d+)[^"']*\bdo=profile[^"']*["'][^>]*>([\s\S]*?)<\/a>/i) || block.match(/<p[^>]*class=["']?[^"'>]*\btit\b[^"'>]*["']?[^>]*>[\s\S]*?<a[^>]*href=["'][^"']*\bdo=profile[^"']*\buid=(\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
      if (mTit) { uid = mTit[1]; name = String(mTit[2] || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim(); }
      if (!uid) {
        var mDel = block.match(/href=["'][^"']*subop=delete[^"']*\buid=(\d+)[^"']*["']/i) || block.match(/href=["'][^"']*\buid=(\d+)[^"']*subop=delete[^"']*["']/i);
        if (mDel) uid = mDel[1];
        if (!uid) { var mProf = block.match(/href=["'][^"']*\buid=(\d+)[^"']*\bdo=profile[^"']*["']/i); if (mProf) uid = mProf[1]; }
      }
      if (uid && !seen[uid]) { seen[uid] = 1; list.push({ uid: uid, user: name, _server: true }); }
    }
    if (!list.length) {
      var reTit = /<p[^>]*class=["']?[^"'>]*\btit\b[^"'>]*["']?[^>]*>[\s\S]*?<a[^>]*href=["'][^"']*\buid=(\d+)[^"']*\bdo=profile[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
      var m2;
      while ((m2 = reTit.exec(t))) { var u2 = m2[1]; if (!seen[u2]) { seen[u2] = 1; list.push({ uid: u2, user: String(m2[2] || '').replace(/<[^>]*>/g, '').trim(), _server: true }); } }
    }
    if (!SERVER.formhash) { var mfh = t.match(/name=["']?formhash["']?[^>]*value=["']([0-9a-zA-Z]+)["']/i) || t.match(/formhash=([0-9a-zA-Z]{6,})/); if (mfh) SERVER.formhash = mfh[1]; }
    if (!SERVER.myUid) { var mm = t.match(/home\.php\?mod=space&(?:amp;)?uid=(\d+)&(?:amp;)?do=friend/i); if (mm) SERVER.myUid = mm[1]; }
    return list;
  }
  function syncServerCache() {
    var ids = [];
    for (var si = 0; si < SERVER.list.length; si++) { if (SERVER.list[si] && SERVER.list[si].uid) ids.push(String(SERVER.list[si].uid)); }
    try { localStorage.setItem(SKEY, JSON.stringify(ids)); localStorage.setItem(TSKEY, String(Date.now())); } catch (e) {}
  }
  function fetchServer(cb) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', BASE + SLIST_URL, true);
      xhr.withCredentials = true;
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        var t = xhr.responseText || '';
        try { SERVER.list = parseServerHtml(t); SERVER.loaded = true; SERVER.error = ''; if (!SERVER.formhash) SERVER.formhash = getFormhash(); syncServerCache(); } catch (e) { SERVER.error = '解析失败:' + e; }
        if (cb) cb(SERVER);
        if (window.__mtbh && window.__mtbh.scan) { try { window.__mtbh.scan(); } catch (e) {} }
      };
      xhr.onerror = function () { SERVER.error = '网络错误'; if (cb) cb(SERVER); };
      xhr.send();
    } catch (e) { SERVER.error = '请求异常:' + e; if (cb) cb(SERVER); }
  }
  function removeServer(uid, cb) {
    var fh = SERVER.formhash || getFormhash();
    try {
      var url = BASE + 'home.php?mod=spacecp&ac=friend&op=blacklist&subop=delete&uid=' + encodeURIComponent(uid) + '&start=&inajax=1&formhash=' + encodeURIComponent(fh);
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.withCredentials = true;
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        var t = xhr.responseText || '';
        var ok = /操作成功/.test(t);
        if (ok) { SERVER.list = SERVER.list.filter(function (x) { return String(x.uid) !== String(uid); }); syncServerCache(); }
        if (cb) cb(ok, t.slice(0, 200));
      };
      xhr.onerror = function () { if (cb) cb(false, '网络错误'); };
      xhr.send();
    } catch (e) { if (cb) cb(false, '请求异常:' + e); }
  }
  function avatarUrl(uid) { if (uid && /^[0-9]+$/.test(String(uid))) return BASE + 'uc_server/avatar.php?uid=' + encodeURIComponent(uid) + '&size=middle'; return ''; }

  var __mtFetching = 0;
  function readOwners() { try { var v = localStorage.getItem(TKEY); if (!v) return {}; var o = JSON.parse(v); if (!o || typeof o !== 'object' || Object.prototype.toString.call(o) === '[object Array]') return {}; return o; } catch (e) { return {}; } }
  function writeOwners(o) { try { localStorage.setItem(TKEY, JSON.stringify(o)); } catch (e) {} }
  function uidOf(a) { if (!a) return null; var h = a.getAttribute && a.getAttribute('href') ? a.getAttribute('href') : ''; var m = h.match(/uid=(\d+)/); if (m) return m[1]; var t = a.getAttribute ? a.getAttribute('data-uid') : null; if (t) return String(t); return null; }
  function threadIdOf(it) { var as = it.querySelectorAll('a[href*="thread-"]'); for (var i = 0; i < as.length; i++) { var h = as[i].getAttribute('href') || ''; var m = h.match(/thread-(\d+)/); if (m) return m[1]; } return null; }
  function threadIdsIn(it) { var out = [], as = it.querySelectorAll('a[href*="thread-"]'); for (var i = 0; i < as.length; i++) { var h = as[i].getAttribute('href') || ''; var m = h.match(/thread-(\d+)/); if (m && out.indexOf(m[1]) < 0) out.push(m[1]); } return out; }
  function authorAnchor(item) {
    var u = item.querySelector('a.top_user'); if (u && uidOf(u)) return u;
    var ls = item.querySelectorAll('a[href*="uid="],a[href*="mod=space"]');
    var fb = null;
    for (var i = 0; i < ls.length; i++) { var a = ls[i]; if (!uidOf(a)) continue; var t = (a.textContent || '').trim(); if (t) return a; if (!fb) fb = a; }
    return fb;
  }
  function recordOwners() {
    var items = document.querySelectorAll('li.forumlist_li, li.comiis_postli, li.normalthread_, .comiis_forumlist li');
    var o = null;
    for (var i = 0; i < items.length; i++) {
      var it = items[i]; var tid = threadIdOf(it); if (!tid) continue;
      var a = authorAnchor(it); if (!a) continue;
      var uid = uidOf(a); if (!uid || uid === '0') continue;
      if (o === null) o = readOwners();
      if (o[tid] !== uid) o[tid] = uid;
    }
    if (o !== null) writeOwners(o);
  }
  function nativeUidSet() {
    var s = {};
    try {
      var v = localStorage.getItem(NKEY); if (!v) return s;
      var a = JSON.parse(v); if (!a) return s;
      if (Object.prototype.toString.call(a) !== '[object Array]') a = [a];
      for (var i = 0; i < a.length; i++) { var e = a[i]; if (!e || typeof e !== 'object') continue; if (String(e.option || '') !== 'uid') continue; var t = String(e.text == null ? '' : e.text).replace(/\s+/g, ''); if (/^\d+$/.test(t)) s[t] = 1; }
    } catch (e) {}
    return s;
  }
  function serverUidSet() {
    var s = {};
    try {
      var v = localStorage.getItem(SKEY);
      if (v) { var a = JSON.parse(v); if (a && Object.prototype.toString.call(a) === '[object Array]') { for (var i = 0; i < a.length; i++) { var u = String(a[i] || '').replace(/\s+/g, ''); if (/^\d+$/.test(u)) s[u] = 1; } } }
    } catch (e) {}
    return s;
  }
  function uidSet() {
    var s = nativeUidSet();
    var l = readList(); for (var i = 0; i < l.length; i++) { if (l[i].uid) s[l[i].uid] = 1; }
    var sb = serverUidSet(); for (var u in sb) { s[u] = 1; }
    return s;
  }
  var LIST_SELECTOR = '.comiis_forumlist .forumlist_li, .comiis_postlist .comiis_postli, #threadlist .forumlist_li, li.normalthread_, li.forumlist_li, li.comiis_postli';
  function applyFilter() {
    var set = uidSet();
    var owners = readOwners();
    var hasBlack = Object.keys(set).length > 0;
    var items = document.querySelectorAll(LIST_SELECTOR);
    for (var i = 0; i < items.length; i++) {
      var it = items[i]; var hit = false;
      if (hasBlack) {
        var as = it.querySelectorAll('a[href*="uid="]');
        for (var k = 0; k < as.length; k++) { var u = uidOf(as[k]); if (u && set[u]) { hit = true; break; } }
        if (!hit) { var tids = threadIdsIn(it); for (var t = 0; t < tids.length; t++) { var tk = '' + tids[t]; var ow = owners[tk]; if (ow && set[ow]) { hit = true; break; } } }
      }
      if (hit) { it.style.display = 'none'; it.setAttribute('data-mt-black-filtered', '1'); }
      else if (it.getAttribute('data-mt-black-filtered')) { it.style.display = ''; it.removeAttribute('data-mt-black-filtered'); }
    }
  }
  function ensureServerList() {
    try {
      var _ts = localStorage.getItem(TSKEY);
      var _has = localStorage.getItem(SKEY);
      if (!_has || !_ts || (Date.now() - Number(_ts)) > 604800000) {
        if (!__mtFetching) { __mtFetching = 1; fetchServer(function () { __mtFetching = 0; }); }
      }
    } catch (e) {}
  }
  function scan() { applyFilter(); recordOwners(); ensureServerList(); }

  var CSS = '.mtbh-fab{position:fixed;right:0;top:42%;width:44px;height:48px;background:#3f8cff;color:#fff;border-radius:10px 0 0 10px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:-2px 2px 8px rgba(0,0,0,.25);font-size:13px;z-index:2147483001;line-height:1.2;user-select:none;}.mtbh-panel{position:fixed;right:-360px;top:0;width:340px;max-width:90vw;height:100vh;background:#fff;color:#222;box-shadow:-4px 0 18px rgba(0,0,0,.28);transition:right .25s ease;z-index:2147483002;display:flex;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}.mtbh-panel.open{right:0;}.mtbh-head{display:flex;align-items:center;gap:8px;padding:14px 14px 10px;border-bottom:1px solid #ececec;flex:0 0 auto;}.mtbh-head .t{font-size:16px;font-weight:700;flex:1 1 auto;}.mtbh-head .x{cursor:pointer;font-size:18px;color:#999;padding:0 6px;}.mtbh-count{font-size:12px;color:#888;padding:2px 14px 8px;border-bottom:1px solid #f0f0f0;flex:0 0 auto;}.mtbh-toolbar{display:flex;gap:8px;padding:8px 14px;border-bottom:1px solid #f0f0f0;flex:0 0 auto;}.mtbh-toolbar button{border:1px solid #e0e0e0;background:#fafafa;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;color:#333;}.mtbh-toolbar button.b1{background:#3f8cff;border-color:#3f8cff;color:#fff;}.mtbh-toolbar button.b2{background:#ff4d4f;border-color:#ff4d4f;color:#fff;}.mtbh-list{flex:1 1 auto;overflow-y:auto;padding:8px 0 60px;-webkit-overflow-scrolling:touch;}.mtbh-card{display:flex;align-items:center;gap:10px;padding:10px 14px;margin:2px 0;cursor:pointer;}.mtbh-card:hover{background:#f7f7f7;}.mtbh-av{width:38px;height:38px;border-radius:50%;overflow:hidden;flex:0 0 38px;background:#eee;}.mtbh-av img{width:100%;height:100%;object-fit:cover;display:block;}.mtbh-info{flex:1 1 auto;min-width:0;}.mtbh-name{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.mtbh-meta{font-size:11px;color:#999;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.mtbh-tag{font-size:10px;color:#3f8cff;font-weight:400;}.mtbh-del{flex:0 0 auto;border:none;background:transparent;color:#ff4d4f;font-size:12px;padding:6px 8px;cursor:pointer;}.mtbh-empty{text-align:center;color:#aaa;font-size:13px;padding:50px 20px;}.mtbh-toast{position:fixed;left:50%;bottom:70px;transform:translateX(-50%);background:rgba(0,0,0,.82);color:#fff;font-size:13px;padding:9px 16px;border-radius:20px;opacity:0;transition:opacity .25s;pointer-events:none;z-index:2147483003;max-width:80%;text-align:center;}.mtbh-toast.on{opacity:1;}@media (prefers-color-scheme:dark){.mtbh-panel{background:#1e1e1e;color:#eaeaea;}.mtbh-head{border-color:#2c2c2c;}.mtbh-count,.mtbh-toolbar{border-color:#2c2c2c;}.mtbh-toolbar button{background:#2a2a2a;border-color:#3a3a3a;color:#ddd;}.mtbh-card:hover{background:#2a2a2a;}.mtbh-av{background:#333;}.mtbh-meta{color:#888;}.mtbh-empty{color:#777;}}';
  var style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  var fab = document.createElement('div'); fab.className = 'mtbh-fab'; fab.innerHTML = '<span>小<br>黑<br>屋</span>';
  var panel = document.createElement('div'); panel.className = 'mtbh-panel';
  panel.innerHTML = '<div class="mtbh-head"><span class="t">🕳️ 个人小黑屋</span><span class="x" data-x>✕</span></div><div class="mtbh-count" data-count>读取中…</div><div class="mtbh-toolbar"><button class="b1" data-refresh>刷新</button><button class="b2" data-clear>清空</button></div><div class="mtbh-list" data-list></div>';
  var toastEl = document.createElement('div'); toastEl.className = 'mtbh-toast';
  document.body.appendChild(fab); document.body.appendChild(panel); document.body.appendChild(toastEl);
  var listEl = panel.querySelector('[data-list]'); var countEl = panel.querySelector('[data-count]'); var toastTimer = null;
  function toast(m) { toastEl.textContent = m; toastEl.classList.add('on'); if (toastTimer) clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 1800); }

  function render() {
    var list = readList(); var nat = readNativeUid(); var sv = (SERVER && SERVER.list) ? SERVER.list : [];
    function keyOf(it) { return it.uid ? ('uid:' + it.uid) : ('user:' + (it.user || '')); }
    var mine = {}; for (var z = 0; z < list.length; z++) { mine[keyOf(list[z])] = 1; mine['uid:' + list[z].uid] = 1; }
    var natFiltered = []; for (var n = 0; n < nat.length; n++) { if (!mine[keyOf(nat[n])] && !mine['uid:' + nat[n].uid]) natFiltered.push(nat[n]); }
    var svFiltered = []; for (var q = 0; q < sv.length; q++) { if (!mine['uid:' + sv[q].uid]) svFiltered.push(sv[q]); }
    var total = list.length + natFiltered.length + svFiltered.length;
    var svPart = SERVER.loaded ? ('服务端 ' + svFiltered.length) : (SERVER.error ? '服务端 读取失败' : '服务端 读取中…');
    countEl.textContent = '共 ' + total + ' 人（个人 ' + list.length + ' · 系统 ' + natFiltered.length + ' · ' + svPart + '）';
    if (!total) { listEl.innerHTML = '<div class="mtbh-empty">黑名单是空的</div>'; return; }
    function cardHtml(it, idx, group) {
      var av = avatarUrl(it.uid);
      var avHtml = av ? '<img src="' + av + '" onerror="this.style.display=\'none\'">' : '';
      var name = it.user ? esc(it.user) : (it.uid ? ('UID: ' + esc(it.uid)) : '未知用户');
      var meta = []; if (it.uid) meta.push('UID ' + esc(it.uid));
      if (group === 'native') { meta.push('论坛「我的屏蔽」'); meta.push(it._opt === 'user' ? '按用户名' : '按 UID'); }
      else if (it.time) meta.push('拉黑于 ' + esc(fmtTime(it.time)));
      var tag = (group === 'native') ? ' <span class="mtbh-tag">[系统]</span>' : (group === 'server' ? ' <span class="mtbh-tag">[服务端]</span>' : '');
      var delKey = (group === 'native') ? esc(it.uid ? ('uid:' + it.uid) : ('user:' + it.user)) : esc(it.uid);
      return '<div class="mtbh-card" data-uid="' + esc(it.uid) + '" data-delkey="' + delKey + '" data-group="' + group + '" data-idx="' + idx + '"><div class="mtbh-av">' + avHtml + '</div><div class="mtbh-info"><div class="mtbh-name">' + name + tag + '</div><div class="mtbh-meta">' + (meta.join(' · ') || '&nbsp;') + '</div></div><button class="mtbh-del" data-del>移出</button></div>';
    }
    var html = '';
    for (var i = 0; i < list.length; i++) html += cardHtml(list[i], i, 'mine');
    for (var j = 0; j < natFiltered.length; j++) html += cardHtml(natFiltered[j], j, 'native');
    for (var w = 0; w < svFiltered.length; w++) html += cardHtml(svFiltered[w], w, 'server');
    listEl.innerHTML = html;
  }

  fab.addEventListener('click', function () { panel.classList.toggle('open'); render(); if (!SERVER.loaded) fetchServer(function () { render(); }); });
  panel.querySelector('[data-x]').addEventListener('click', function () { panel.classList.remove('open'); });
  panel.querySelector('[data-refresh]').addEventListener('click', function () { toast('正在刷新…'); fetchServer(function () { render(); toast('已刷新'); }); });
  panel.querySelector('[data-clear]').addEventListener('click', function () {
    var list = readList(); var natN = readNativeUid().length; var svN = (SERVER.list || []).length;
    var total = list.length + natN + svN;
    if (!total) { toast('黑名单已经是空的'); return; }
    if (window.confirm('确定清空全部黑名单？\n个人 ' + list.length + ' 条 · 系统 ' + natN + ' 条 · 服务端 ' + svN + ' 条')) {
      writeList([]); clearNativeUid();
      if (svN > 0) { toast('正在清空服务端黑名单…'); var uids = (SERVER.list || []).map(function (x) { return x.uid; }); var k = 0; function step() { if (k >= uids.length) { SERVER.list = []; syncServerCache(); render(); toast('已清空'); applyFilter(); return; } removeServer(uids[k++], function () { setTimeout(step, 300); }); } step(); }
      else { toast('已清空'); render(); applyFilter(); }
    }
  });
  listEl.addEventListener('click', function (e) {
    var delBtn = e.target.closest ? e.target.closest('[data-del]') : null;
    if (delBtn) {
      e.stopPropagation();
      var card = delBtn.closest('.mtbh-card'); var group = card.getAttribute('data-group'); var uid = card.getAttribute('data-uid'); var delKey = card.getAttribute('data-delkey') || ''; var idx = parseInt(card.getAttribute('data-idx'), 10);
      if (group === 'native') { var want = delKey.replace(/^(uid|user):/, ''); if (removeNativeUid(want)) { toast('已移出系统黑名单'); render(); applyFilter(); } else toast('移除失败'); return; }
      if (group === 'server') { if (!uid) { toast('缺少 UID'); return; } toast('正在解除服务端黑名单…'); removeServer(uid, function (ok, info) { if (ok) { toast('已解除服务端黑名单'); render(); applyFilter(); fetchServer(function () { render(); }); } else { toast('解除失败：' + (info || '')); fetchServer(function () { render(); }); } }); return; }
      var list = readList(); if (idx >= 0 && idx < list.length) { var who = list[idx].user || ('UID ' + list[idx].uid); list.splice(idx, 1); if (writeList(list)) { toast('已移出：' + who); render(); applyFilter(); } else toast('写入失败'); }
      return;
    }
    var c2 = e.target.closest ? e.target.closest('.mtbh-card') : null;
    if (c2) { var u = c2.getAttribute('data-uid'); if (u && /^[0-9]+$/.test(u)) location.href = BASE + 'home.php?mod=space&uid=' + encodeURIComponent(u) + '&do=profile'; }
  });

  function boot() {
    scan();
    setTimeout(scan, 400); setTimeout(scan, 1200); setTimeout(scan, 2500);
    if (!window.__mtBlackTimer) { window.__mtBlackTimer = setInterval(function () { try { scan(); } catch (e) {} }, 1500); }
    if (!window.__mtBlackObs) { window.__mtBlackObs = new MutationObserver(function () { scan(); }); try { window.__mtBlackObs.observe(document.documentElement || document.body, { childList: true, subtree: true }); } catch (e) {} }
    render();
    if (!SERVER.loaded) fetchServer(function () { render(); });
  }

  window.__mtbh = { render: render, scan: scan, applyFilter: applyFilter, fetch: fetchServer, list: readList, native: readNativeUid, server: SERVER, open: function () { panel.classList.add('open'); render(); }, close: function () { panel.classList.remove('open'); } };
  boot();
  console.log('[小黑屋] 侧边栏 + 全局屏蔽已注入');
})();
