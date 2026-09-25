// ==UserScript==
// @name         MT论坛 - 导读页帖子列表自动下一页（拼接）
// @namespace    https://bbs.binmt.cc/
// @version      1.0.0
// @description  在 MT论坛 导读页（forum.php?mod=guide）滚动到底部时自动加载下一页帖子，并拼接（追加）到当前列表末尾，无需手动翻页。仅对新主题/最新回复等列表页生效。
// @author       Operit
// @match        *://bbs.binmt.cc/forum.php?mod=guide*
// @grant        none
// @run-at       document-end
// @noframes
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';
  if (window.__mtGuideAutoNext) return;
  window.__mtGuideAutoNext = true;

  var LIST_SELECTOR = '.comiis_forumlist';
  var ITEM_SELECTOR = 'li.forumlist_li';
  var TRIGGER_DIST = 900; // 距底部多少像素时触发加载

  var state = {
    page: 1,
    loading: false,
    ended: false
  };

  function currentList() {
    return document.querySelector(LIST_SELECTOR);
  }

  function currentView() {
    var q = new URLSearchParams(location.search);
    return q.get('view') || 'newthread';
  }

  function pageUrl(page) {
    return 'https://bbs.binmt.cc/forum.php?mod=guide&index=1&view=' + currentView() + '&page=' + page;
  }

  function loadNext() {
    if (state.loading || state.ended) return;
    if (!currentList()) return;
    state.loading = true;
    fetch(pageUrl(state.page + 1), { credentials: 'include' })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.text(); })
      .then(function (html) {
        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        var srcList = tmp.querySelector(LIST_SELECTOR);
        var items = srcList ? srcList.querySelectorAll(ITEM_SELECTOR) : [];
        var dst = currentList();
        if (!dst || !items.length) {
          state.ended = true;
          return;
        }
        // 去重：跳过已经出现过的主题（按 li 内主帖链接去重）
        var seen = {};
        var existing = dst.querySelectorAll(ITEM_SELECTOR);
        for (var i = 0; i < existing.length; i++) {
          var ea = existing[i].querySelector('a[href*="thread-"], a[href*="tid="]');
          if (ea) seen[ea.getAttribute('href')] = 1;
        }
        var appended = 0;
        for (var j = 0; j < items.length; j++) {
          var a = items[j].querySelector('a[href*="thread-"], a[href*="tid="]');
          var key = a ? a.getAttribute('href') : ('item-' + j);
          if (key && seen[key]) continue;
          if (key) seen[key] = 1;
          dst.appendChild(items[j]);
          appended++;
        }
        state.page++;
        if (appended === 0) state.ended = true;
      })
      .catch(function () { /* 网络异常时静默，滚动会再次触发重试 */ })
      .then(function () { state.loading = false; });
  }

  var raf = null;
  function checkScroll() {
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = null;
      var doc = document.documentElement;
      var nearBottom = (doc.scrollHeight - doc.scrollTop - doc.clientHeight) < TRIGGER_DIST;
      if (nearBottom) loadNext();
    });
  }

  window.addEventListener('scroll', checkScroll, { passive: true });
  window.addEventListener('resize', checkScroll, { passive: true });

  // 若内容不足一屏，主动尝试补一页
  setTimeout(function () {
    var doc = document.documentElement;
    var list = currentList();
    if (list && doc.scrollHeight <= doc.clientHeight + TRIGGER_DIST) loadNext();
  }, 1200);

  console.log('[导读自动下一页] 已注入，监听滚动拼接');
})();
