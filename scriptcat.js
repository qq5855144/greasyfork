// ==UserScript==
// @name         脚本查找大师（四大脚本库合一显数版）
// @namespace    doveboy_js
// @version     1.0.0
// @description  聚合 GreasyFork、SleazyFork、ScriptCat、GitHub Gist。支持自动链路检测：翻墙绿球默认GF，不翻墙橙球默认SC，无脚本黑球。支持记忆悬浮球位置，新增自动淡化隐身功能。
// @author       AI优化
// @icon         https://scriptcat.org/favicon.ico?favicon.12.kxvew6xulu.ico
// @license      Zlib/Libpng License
// @match        *://*/*
// @exclude      https://github.com/new
// @exclude      https://github.com/settings/*
// @exclude      https://gist.github.com/mine
// @grant        GM_xmlhttpRequest
// @connect      greasyfork.org
// @connect      sleazyfork.org
// @connect      scriptcat.org
// @connect      gist.github.com
// @run-at       document-end
// ==/UserScript==
 
(function() {
    'use strict';
 
    const host = window.location.hostname;
    const domain = host.split('.').slice(-2).join('.');
 
    // 屏蔽逻辑判断
    const isAtGreasyFork = host.includes('greasyfork.org') || host.includes('sleazyfork.org');
    const isAtGitHub = host.includes('github.com') || host.includes('gist.github.com');
    const isAtGoogle = host.includes('google.'); 
    const disableGitHubSearch = isAtGreasyFork || isAtGitHub || isAtGoogle;
 
    let currentSource = 'gf'; 
    let isWallAccessible = false; // 是否能科学上网
    let gfData = [], scData = [], ghData = [];
    let gfLoaded = false, scLoaded = false, ghLoaded = false;
    let ghPage = 1, ghLoading = false, ghHasMore = true, ghTotal = 0;
    let hideTimer = null; // 隐身计时器
 
    // --- 通用日期格式化 ---
    function formatToDate(str) {
        if (!str) return "未知";
        const cleanStr = str.replace(/(发布于：|更新于：|发布于|更新于)/g, '').trim();
        try {
            const d = new Date(cleanStr);
            if (isNaN(d.getTime())) return cleanStr;
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch(e) { return cleanStr; }
    }
 
    // --- UI 样式 ---
    const style = document.createElement('style');
    style.innerHTML = `
        #ag-ball {
            position: fixed; bottom: 150px; right: 20px;
            width: 48px; height: 48px;
            background: #666; color: #fff;
            border-radius: 50%; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            z-index: 2147483647; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            font-family: sans-serif; font-size: 13px; font-weight: bold; 
            border: 2px solid #fff; user-select: none;
            transition: opacity 0.5s, transform 0.3s, filter 0.5s;
            opacity: 1;
        }
        /* 隐身态：极高透明度，且稍微缩小 */
        #ag-ball.ag-faded {
            opacity: 0.15;
            transform: scale(0.8);
            filter: grayscale(1);
        }
        #ag-ball.ag-faded:hover {
            opacity: 1;
            transform: scale(1);
            filter: grayscale(0);
        }
        #ag-panel {
            position: fixed; bottom: 210px; right: 20px;
            width: 530px; max-height: 600px;
            background: #fff; border-radius: 12px;
            box-shadow: 0 12px 50px rgba(0,0,0,0.25);
            z-index: 2147483646; display: none;
            flex-direction: column; border: 1px solid #ddd; overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        #ag-head { padding: 10px 16px; background: #fff; border-bottom: 1px solid #eee; display: flex; align-items: center; }
        #ag-switcher { display: flex; gap: 6px; flex: 1; overflow-x: auto; scrollbar-width: none; }
        .switch-btn { padding: 5px 10px; border-radius: 4px; font-size: 12px; cursor: pointer; border: 1px solid #eee; background: #fcfcfc; color: #666; white-space: nowrap; transition: 0.2s; }
        .switch-btn.active[data-type="gf"] { background: #007aff; color: #fff; border-color: #007aff; }
        .switch-btn.active[data-type="gh"] { background: #24292f; color: #fff; border-color: #24292f; }
        .switch-btn.active[data-type="sc"] { background: #1677ff; color: #fff; border-color: #1677ff; }
 
        #ag-body { overflow-y: auto; flex: 1; background: #fff; }
        .ag-item { padding: 16px; border: none; transition: background 0.2s; }
        .ag-item:nth-child(even) { background-color: #f2f2f2; } 
        .ag-item:nth-child(odd) { background-color: #ffffff; }
        .ag-item:hover { background: #e8f4ff !important; }
        .ag-item-title-row { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .ag-name { text-decoration: none; font-size: 15px; font-weight: 700; line-height: 1.4; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .gf-color { color: #007aff; }
        .gh-color { color: #24292f; }
        .sc-color { color: #1677ff; }
        .ag-install-btn { 
            background: #28a745; color: white; border: none; 
            padding: 4px 12px; border-radius: 4px; cursor: pointer; 
            font-size: 11px; font-weight: bold; white-space: nowrap;
            height: 26px; display: flex; align-items: center; justify-content: center;
        }
        .ag-install-btn:hover { background: #218838; }
        .ag-desc { font-size: 13px; color: #555; line-height: 1.5; margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-all; }
        .ag-meta-row { display: flex; flex-wrap: nowrap; align-items: center; gap: 6px; font-size: 11px; color: #777; white-space: nowrap; }
        .ag-dot { color: #ccc; }
        .ag-score { color: #e09015; font-weight: bold; }
        .ag-installs { color: #28a745; font-weight: 600; }
        .ag-installs-total { color: #007aff; font-weight: 600; }
        #gh-load-status { padding: 15px; text-align: center; color: #999; font-size: 12px; }
    `;
    document.head.appendChild(style);
 
    const ball = document.createElement('div');
    ball.id = 'ag-ball'; ball.innerHTML = '...';
    document.body.appendChild(ball);
 
    const panel = document.createElement('div');
    panel.id = 'ag-panel';
    panel.innerHTML = `
        <div id="ag-head">
            <div id="ag-switcher"></div>
            <div id="ag-close" style="cursor:pointer; font-size:22px; color:#ccc; margin-left:10px;">×</div>
        </div>
        <div id="ag-body">
            <div id="ag-list"></div>
            <div id="gh-load-status" style="display:none;">载入中...</div>
        </div>
    `;
    document.body.appendChild(panel);
 
    const listContainer = panel.querySelector('#ag-list');
    const statusText = panel.querySelector('#gh-load-status');
    const bodyPanel = panel.querySelector('#ag-body');
    const switcher = panel.querySelector('#ag-switcher');
 
    // --- 隐身控制逻辑 ---
    function startFadeTimer() {
        clearTimeout(hideTimer);
        // 如果面板开着，不执行隐身
        if (panel.style.display === 'flex') return;
        hideTimer = setTimeout(() => {
            ball.classList.add('ag-faded');
        }, 5000); // 5秒后淡化
    }
 
    function wakeBall() {
        clearTimeout(hideTimer);
        ball.classList.remove('ag-faded');
    }
 
    ball.addEventListener('mouseenter', wakeBall);
    ball.addEventListener('mouseleave', startFadeTimer);
 
    function saveBallPosition(left, top) { localStorage.setItem('ag-ball-pos', JSON.stringify({ left, top })); }
    function loadBallPosition() {
        const posStr = localStorage.getItem('ag-ball-pos');
        if (posStr) {
            try {
                const pos = JSON.parse(posStr);
                ball.style.left = pos.left + 'px'; ball.style.top = pos.top + 'px';
                ball.style.bottom = 'auto'; ball.style.right = 'auto';
            } catch (e) {}
        }
    }
 
    function fetchGreasyFork() {
        const urls = [
            `https://greasyfork.org/scripts/by-site/${domain}?filter_locale=0&sort=updated&_t=${Date.now()}`,
            `https://sleazyfork.org/scripts/by-site/${domain}?filter_locale=0&sort=updated&_t=${Date.now()}`
        ];
        let results = [];
        let completed = 0;
        return new Promise((resolve) => {
            urls.forEach(url => {
                GM_xmlhttpRequest({
                    method: 'GET', url: url, timeout: 5000,
                    onload: (r) => {
                        try {
                            const doc = new DOMParser().parseFromString(r.responseText, "text/html");
                            const nodes = doc.querySelectorAll('li[data-script-id]');
                            const data = Array.from(nodes).map(node => ({
                                id: node.getAttribute('data-script-id'),
                                name: node.querySelector('.script-link')?.innerText.trim(),
                                url: (url.includes('sleazy') ? 'https://sleazyfork.org' : 'https://greasyfork.org') + node.querySelector('.script-link')?.getAttribute('href'),
                                desc: node.querySelector('.script-description')?.innerText.split('Ver.')[0].trim() || "暂无描述",
                                updatedRaw: node.getAttribute('data-script-updated-date'), 
                                created: formatToDate(node.getAttribute('data-script-created-date')),
                                score: node.getAttribute('data-script-rating-score') || "0.0",
                                daily: parseInt(node.getAttribute('data-script-daily-installs') || "0").toLocaleString(),
                                total: parseInt(node.getAttribute('data-script-total-installs') || "0").toLocaleString(),
                                installUrl: node.querySelector('.install-link')?.getAttribute('href') || (url.includes('sleazy') ? `https://sleazyfork.org/scripts/${node.getAttribute('data-script-id')}/code/script.user.js` : `https://greasyfork.org/scripts/${node.getAttribute('data-script-id')}/code/script.user.js`)
                            })).filter(i => i.name);
                            results = results.concat(data);
                        } catch(e) {}
                        if (++completed === urls.length) {
                            const uniqueMap = new Map();
                            results.forEach(item => uniqueMap.set(item.id, item));
                            gfData = Array.from(uniqueMap.values()).sort((a, b) => new Date(b.updatedRaw) - new Date(a.updatedRaw));
                            gfLoaded = true; resolve(results.length > 0);
                        }
                    },
                    onerror: () => { if (++completed === urls.length) { gfLoaded = true; resolve(results.length > 0); } },
                    ontimeout: () => { if (++completed === urls.length) { gfLoaded = true; resolve(results.length > 0); } }
                });
            });
        });
    }
 
    function fetchScriptCat() {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET', url: `https://scriptcat.org/zh-CN/search?domain=${domain}&sort=createtime`,
                onload: (r) => {
                    const doc = new DOMParser().parseFromString(r.responseText, "text/html");
                    scData = Array.from(doc.querySelectorAll('.ant-card-body')).map(card => {
                        const titleLink = card.querySelector('a[href*="/script-show-page/"]');
                        if (!titleLink) return null;
                        const scriptId = titleLink.getAttribute('href').match(/\d+/)[0];
                        const scriptName = (titleLink.getAttribute('title') || titleLink.innerText).trim();
                        const rawDate = card.querySelector('.anticon-calendar')?.closest('.flex')?.innerText || "";
                        return {
                            name: scriptName, url: 'https://scriptcat.org' + titleLink.getAttribute('href'),
                            installUrl: `https://scriptcat.org/scripts/code/${scriptId}/${encodeURIComponent(scriptName)}.user.js`,
                            desc: card.querySelector('.line-clamp-2')?.getAttribute('title') || "暂无描述",
                            date: formatToDate(rawDate),
                            downloads: card.querySelector('.anticon-download')?.closest('.flex')?.innerText.trim() || "0"
                        };
                    }).filter(i => i);
                    scLoaded = true; resolve(true);
                }
            });
        });
    }
 
    function fetchGist(page = 1) {
        if (disableGitHubSearch) { ghLoaded = true; ghHasMore = false; updateUI(); return; }
        if (ghLoading || !ghHasMore) return;
        ghLoading = true;
        GM_xmlhttpRequest({
            method: 'GET', url: `https://gist.github.com/search?o=desc&p=${page}&q="%3D%3DUserScript%3D%3D"+${domain}&s=updated`,
            onload: (res) => {
                const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
                const h3 = Array.from(doc.querySelectorAll('h3')).find(el => el.innerText.includes('gist results'));
                if (h3) {
                    const match = h3.innerText.match(/(\d[\d,]*)/);
                    if (match) ghTotal = parseInt(match[1].replace(/,/g, '')) || 0;
                }
                const snippets = doc.querySelectorAll('.gist-snippet');
                if (snippets.length === 0) { ghHasMore = false; } else {
                    snippets.forEach(snippet => {
                        const fileStrong = snippet.querySelector('strong.css-truncate-target');
                        const fileName = fileStrong ? fileStrong.innerText.trim() : 'script.user.js';
                        const gistPath = fileStrong ? fileStrong.closest('a').getAttribute('href') : '';
                        let description = '暂无描述', installUrl = '';
                        snippet.querySelectorAll('.blob-code-inner').forEach(line => {
                            const text = line.innerText;
                            if (text.includes('@description')) description = text.split('@description')[1].trim();
                        });
                        if (!installUrl && gistPath) installUrl = `https://gist.github.com${gistPath}/raw/${encodeURIComponent(fileName)}`;
                        const timeEl = snippet.querySelector('relative-time');
                        ghData.push({ 
                            name: fileName, url: `https://gist.github.com${gistPath}`, installUrl, desc: description,
                            stars: snippet.querySelector('a[href$="/stargazers"]')?.innerText.trim() || '0',
                            updated: formatToDate(timeEl ? timeEl.getAttribute('datetime') : null) 
                        });
                    });
                    ghHasMore = !!doc.querySelector('.next_page'); ghPage++;
                }
                ghLoaded = true; ghLoading = false;
                if (currentSource === 'gh') render(); else updateUI();
            }
        });
    }
 
    function updateUI() {
        const total = gfData.length + scData.length + (disableGitHubSearch ? 0 : ghTotal);
        ball.innerHTML = (gfLoaded || scLoaded || (disableGitHubSearch || ghLoaded)) ? total : '...';
        
        if ((gfLoaded && scLoaded) && total === 0) {
            ball.style.backgroundColor = '#000000'; // 无脚本黑球
        } else if (isWallAccessible) {
            ball.style.backgroundColor = '#28a745'; // 翻墙绿球
        } else {
            ball.style.backgroundColor = '#ff8c00'; // 不翻墙橙球
        }
 
        let order = disableGitHubSearch 
            ? (isWallAccessible ? ['gf', 'sc'] : ['sc', 'gf']) 
            : (isWallAccessible ? ['gf', 'gh', 'sc'] : ['sc', 'gf', 'gh']);
            
        const labels = { 
            gf: `GreasyFork (${gfData.length})`, 
            gh: `GitHub Gist (${ghTotal})`, 
            sc: `ScriptCat (${scData.length})` 
        };
        switcher.innerHTML = order.map(type => `<div class="switch-btn ${currentSource === type ? 'active' : ''}" data-type="${type}">${labels[type]}</div>`).join('');
        switcher.querySelectorAll('.switch-btn').forEach(btn => {
            btn.onclick = (e) => { e.stopPropagation(); currentSource = btn.getAttribute('data-type'); render(); };
        });
        
        // 数据更新后启动/重置隐身计时
        startFadeTimer();
    }
 
    function render() {
        updateUI();
        const data = currentSource === 'gf' ? gfData : (currentSource === 'sc' ? scData : ghData);
        statusText.style.display = (currentSource === 'gh' && (ghHasMore || ghLoading)) ? 'block' : 'none';
        if (data.length === 0) {
            listContainer.innerHTML = `<div style="padding:60px;text-align:center;color:#999;font-size:13px;">该平台暂未发现脚本</div>`;
            return;
        }
        listContainer.innerHTML = data.map(s => {
            const theme = currentSource;
            let metaHtml = '';
            if (theme === 'gf') {
                metaHtml = `<span>🔄 更新: ${formatToDate(s.updatedRaw)}</span><span class="ag-dot">|</span><span>📅 发布: ${s.created}</span><span class="ag-dot">|</span><span class="ag-score">⭐ ${s.score}</span><span class="ag-dot">|</span><span class="ag-installs">📥 今日: ${s.daily}</span><span class="ag-dot">|</span><span class="ag-installs-total">📊 总计: ${s.total}</span>`;
            } else if (theme === 'sc') {
                metaHtml = `<span>📅 发布: ${s.date}</span><span class="ag-dot">|</span><span class="ag-installs">📥 下载: ${s.downloads}</span>`;
            } else {
                metaHtml = `<span class="ag-score">★ ${s.stars}</span><span class="ag-dot">|</span><span>🕒 更新: ${s.updated}</span>`;
            }
            return `
                <div class="ag-item">
                    <div class="ag-item-title-row">
                        <button class="ag-install-btn" onclick="window.open('${s.installUrl}')">立即安装</button>
                        <a class="ag-name ${theme}-color" href="${s.url}" target="_blank" title="${esc(s.name)}">${esc(s.name)}</a>
                    </div>
                    <span class="ag-desc">${esc(s.desc)}</span>
                    <div class="ag-meta-row">${metaHtml}</div>
                </div>`;
        }).join('');
    }
 
    function esc(s) { return String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m])); }
 
    let isMoving = false, startX, startY, ballX, ballY;
    ball.onmousedown = (e) => {
        isMoving = false; startX = e.clientX; startY = e.clientY;
        ballX = ball.offsetLeft; ballY = ball.offsetTop;
        const onMouseMove = (ev) => {
            if (Math.sqrt(Math.pow(ev.clientX - startX, 2) + Math.pow(ev.clientY - startY, 2)) > 10) {
                isMoving = true; 
                wakeBall(); // 移动时强制唤醒
                ball.style.left = (ballX + ev.clientX - startX) + 'px';
                ball.style.top = (ballY + ev.clientY - startY) + 'px';
                ball.style.bottom = 'auto'; ball.style.right = 'auto';
            }
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (isMoving) { 
                saveBallPosition(ball.offsetLeft, ball.offsetTop); 
                startFadeTimer();
            }
            else {
                const show = panel.style.display !== 'flex';
                panel.style.display = show ? 'flex' : 'none';
                if (show) {
                    wakeBall(); // 打开面板时保持清醒
                    const rect = ball.getBoundingClientRect();
                    panel.style.left = Math.min(window.innerWidth - 550, Math.max(20, rect.left - 480)) + 'px';
                    panel.style.top = Math.max(20, rect.top - 610) + 'px';
                    render();
                } else {
                    startFadeTimer();
                }
            }
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };
 
    bodyPanel.onscroll = () => { 
        if (currentSource === 'gh' && !disableGitHubSearch && bodyPanel.scrollTop + bodyPanel.clientHeight >= bodyPanel.scrollHeight - 50) {
            fetchGist(ghPage); 
        }
    };
    document.getElementById('ag-close').onclick = () => {
        panel.style.display = 'none';
        startFadeTimer();
    };
 
    async function init() {
        loadBallPosition();
        const gfPromise = fetchGreasyFork();
        const scPromise = fetchScriptCat();
        const ghPromise = disableGitHubSearch ? Promise.resolve() : fetchGist(1);
        
        scPromise.then(() => {
            if (!gfLoaded && scData.length > 0) { currentSource = 'sc'; }
            updateUI();
        });
        
        gfPromise.then(ok => {
            isWallAccessible = ok;
            if (panel.style.display !== 'flex') { currentSource = isWallAccessible ? 'gf' : 'sc'; }
            updateUI();
            if (panel.style.display === 'flex') render();
        });
        if (!disableGitHubSearch) ghPromise.then(() => updateUI());
        
        setTimeout(() => {
            if (!gfLoaded || !scLoaded) { gfLoaded = true; scLoaded = true; updateUI(); }
        }, 5500);
    }
    init();
})();

