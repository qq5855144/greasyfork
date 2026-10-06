// ==UserScript==
// @name         全站链接小窗
// @namespace    https://bbs.binmt.cc/
// @version      1.0.0
// @description  将网页中的普通链接改为底部滑入式小窗打开，搜索引擎域名自动排除
// @match        *://*/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /*
   * 从「MT论坛脚本小窗.user.js」提取并独立化的小窗功能。
   *
   * 行为：
   * 1. 默认拦截当前页面中的普通 HTTP/HTTPS 链接，在底部小窗中打开。
   * 2. 搜索引擎域名完全放行，不进入小窗。
   * 3. mailto/tel/javascript/blob/data 等非网页链接放行。
   * 4. 小窗内部的链接不再次套小窗，避免无限嵌套。
   * 5. 新窗口按钮可直接使用浏览器正常打开方式。
   */

  var CONFIG = {
    panelHeight: '92%',
    animationMs: 280,

    // 搜索引擎及其常见国家/地区域名。可按需继续扩展。
    searchEngineDomains: [
      'google.com', 'google.ad', 'google.ae', 'google.am', 'google.at',
      'google.az', 'google.ba', 'google.be', 'google.bg', 'google.ca',
      'google.ch', 'google.cl', 'google.co.id', 'google.co.il',
      'google.co.in', 'google.co.jp', 'google.co.kr', 'google.co.nz',
      'google.pl', 'google.pt', 'google.ro', 'google.ru', 'google.sa',
      'google.se', 'google.sg', 'google.th', 'google.tr', 'google.tw',
      'google.ua', 'google.co.uk', 'google.com.au', 'google.com.br',
      'google.com.hk', 'google.com.sg', 'google.com.tw', 'google.com.vn',
      'bing.com', 'bing.cn',
      'baidu.com', 'baidu.cn',
      'sogou.com', 'sogou.cn',
      'so.com', '360.cn', 'haosou.com',
      'sm.cn', 'shenma.com',
      'duckduckgo.com',
      'search.yahoo.com', 'yahoo.com',
      'yandex.com', 'yandex.ru', 'yandex.eu',
      'naver.com',
      'search.brave.com', 'brave.com',
      'startpage.com',
      'ecosia.org',
      'qwant.com',
      'kagi.com',
      'searx.be',
      'searxng.org',
      'perplexity.ai'
    ]
  };

  var state = {
    opened: false,
    url: '',
    title: ''
  };

  function getHost(url) {
    try {
      return new URL(url, location.href).hostname.toLowerCase().replace(/^www\./, '');
    } catch (e) {
      return '';
    }
  }

  function isDomainOrSubdomain(host, domain) {
    return host === domain || host.endsWith('.' + domain);
  }

  function isSearchEngine(url) {
    var host = getHost(url);
    if (!host) return false;

    for (var i = 0; i < CONFIG.searchEngineDomains.length; i++) {
      if (isDomainOrSubdomain(host, CONFIG.searchEngineDomains[i])) {
        return true;
      }
    }
    return false;
  }

  function isWebLink(url) {
    try {
      var u = new URL(url, location.href);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  function shouldIntercept(anchor) {
    if (!anchor || !anchor.href) return false;

    // 小窗自身及其遮罩中的链接全部放行。
    if (anchor.closest && anchor.closest('.mt-sw-panel, .mt-sw-mask')) {
      return false;
    }

    // 明确标记为下载/新窗口的链接尊重原页面行为。
    if (anchor.hasAttribute('download')) return false;
    if ((anchor.getAttribute('rel') || '').toLowerCase().split(/\s+/).indexOf('external') !== -1) {
      return false;
    }

    var url = anchor.href;
    if (!isWebLink(url)) return false;
    if (isSearchEngine(url)) return false;

    // 当前页锚点不需要小窗。
    try {
      var u = new URL(url, location.href);
      var current = new URL(location.href);
      if (u.origin === current.origin &&
          u.pathname === current.pathname &&
          u.search === current.search &&
          u.hash && u.hash !== current.hash) {
        return false;
      }
    } catch (e) {}

    return true;
  }

  function injectStyle() {
    if (document.getElementById('mt-sw-style')) return;

    var st = document.createElement('style');
    st.id = 'mt-sw-style';
    st.textContent =
      '.mt-sw-mask{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:999998;opacity:0;transition:opacity .25s ease;}' +
      '.mt-sw-mask.mt-sw-show{opacity:1;}' +
      '.mt-sw-panel{position:fixed;left:0;right:0;bottom:0;z-index:999999;height:' + CONFIG.panelHeight + ';background:#fff;border-radius:18px 18px 0 0;' +
        'transform:translateY(100%);transition:transform ' + CONFIG.animationMs + 'ms cubic-bezier(.32,.72,.36,1);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -4px 24px rgba(0,0,0,.2);}' +
      '.mt-sw-panel.mt-sw-show{transform:translateY(0);}' +
      '.mt-sw-head{display:flex;align-items:center;justify-content:flex-end;padding:8px 12px;border-bottom:1px solid #53BCF5;flex:none;background:#53BCF5;}' +
      '.mt-sw-acts{flex:none;display:flex;align-items:center;gap:12px;}' +
      '.mt-sw-btn{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
        'background:rgba(255,255,255,.22);color:#fff;cursor:pointer;user-select:none;transition:background .15s ease,transform .1s ease;}' +
      '.mt-sw-btn:hover,.mt-sw-btn:active{background:rgba(255,255,255,.45);}' +
      '.mt-sw-btn:active{transform:scale(.94);}' +
      '.mt-sw-iframe{flex:1;width:100%;height:100%;border:0;background:#fff;display:block;}';

    (document.head || document.documentElement).appendChild(st);
  }

  function removeSmallWindow() {
    state.opened = false;
    state.url = '';
    state.title = '';

    var mask = document.querySelector('.mt-sw-mask');
    var panel = document.querySelector('.mt-sw-panel');

    if (mask) mask.remove();
    if (panel) panel.remove();
  }

  function openSmallWindow(url, title) {
    removeSmallWindow();

    state.opened = true;
    state.url = url;
    state.title = title || '';

    var mask = document.createElement('div');
    mask.className = 'mt-sw-mask';

    var panel = document.createElement('div');
    panel.className = 'mt-sw-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', state.title || '网页小窗');

    var head = document.createElement('div');
    head.className = 'mt-sw-head';

    var acts = document.createElement('div');
    acts.className = 'mt-sw-acts';

    var openNew = document.createElement('span');
    openNew.className = 'mt-sw-btn';
    openNew.title = '新窗口打开';
    openNew.setAttribute('role', 'button');
    openNew.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M6 3H3v10h10V9"/><path d="M9.5 3H13v3.5"/><path d="M7.5 8.5L13 3"/>' +
      '</svg>';

    var close = document.createElement('span');
    close.className = 'mt-sw-btn';
    close.title = '关闭';
    close.setAttribute('role', 'button');
    close.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">' +
        '<path d="M3 3l10 10"/><path d="M13 3L3 13"/>' +
      '</svg>';

    acts.appendChild(openNew);
    acts.appendChild(close);
    head.appendChild(acts);

    var iframe = document.createElement('iframe');
    iframe.className = 'mt-sw-iframe';
    iframe.src = url;
    iframe.setAttribute('scrolling', 'auto');
    iframe.setAttribute('loading', 'eager');

    panel.appendChild(head);
    panel.appendChild(iframe);

    document.body.appendChild(mask);
    document.body.appendChild(panel);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        mask.classList.add('mt-sw-show');
        panel.classList.add('mt-sw-show');
      });
    });

    close.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      removeSmallWindow();
    });

    openNew.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      window.open(url, '_blank');
    });

    mask.addEventListener('click', function () {
      removeSmallWindow();
    });
  }

  function bindLinks() {
    // 捕获阶段统一拦截，覆盖动态加载出来的链接，无需给每个 a 单独绑定事件。
    document.addEventListener('click', function (event) {
      if (event.defaultPrevented) return;
      if (event.button !== undefined && event.button !== 0) return;

      // Ctrl/Cmd/Shift/Alt 点击保留浏览器/用户脚本管理器的常规打开行为。
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

      var target = event.target;
      if (!target || !target.closest) return;

      var anchor = target.closest('a[href]');
      if (!shouldIntercept(anchor)) return;

      var url = anchor.href;
      var title = (
        anchor.getAttribute('title') ||
        anchor.getAttribute('aria-label') ||
        anchor.textContent ||
        ''
      ).replace(/\s+/g, ' ').trim().slice(0, 120);

      event.preventDefault();
      event.stopPropagation();

      openSmallWindow(url, title);
    }, true);
  }

  function init() {
    // iframe 中不再套小窗，防止第三方页面内部链接无限递归。
    try {
      if (window.top !== window.self) return;
    } catch (e) {
      return;
    }

    injectStyle();
    bindLinks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
