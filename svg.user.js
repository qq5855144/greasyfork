// ==UserScript==
// @name         SVG嗅探器
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  下载网页中的SVG图片
// @author       YourName
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_setClipboard
// @grant        GM_notification
// @grant        GM_download
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
// @icon         https://cdn-icons-png.flaticon.com/512/149/149071.png
// @license      MIT
// @downloadURL https://update.greasyfork.org/scripts/544921/SVG%E5%97%85%E6%8E%A2%E5%99%A8.user.js
// @updateURL https://update.greasyfork.org/scripts/544921/SVG%E5%97%85%E6%8E%A2%E5%99%A8.meta.js
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        buttonSize: 30,
        activeColor: '#3498db',
        hoverColor: '#2980b9',
        zIndex: 99999,
        positionOffset: 25,
        touchDelay: 300
    };

    GM_addStyle(`
        .radar-container {
            position: fixed;
            z-index: ${CONFIG.zIndex};
            cursor: move;
            transition: transform 0.2s;
            touch-action: none;
        }
        
        .radar-button {
            width: ${CONFIG.buttonSize}px;
            height: ${CONFIG.buttonSize}px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #3498db, #2c3e50);
            box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3), 
                        0 0 0 4px rgba(255, 255, 255, 0.15),
                        inset 0 0 12px rgba(0, 0, 0, 0.3);
            cursor: pointer;
            border: none;
            outline: none;
            position: relative;
            overflow: hidden;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
            animation: pulse 2s infinite;
            transition: transform 0.3s, box-shadow 0.3s;
        }
        
        .radar-button:hover {
            transform: scale(1.05);
            box-shadow: 0 8px 22px rgba(0, 0, 0, 0.4), 
                        0 0 0 4px rgba(255, 255, 255, 0.25),
                        inset 0 0 15px rgba(0, 0, 0, 0.4);
        }
        
        .radar-button:active {
            transform: scale(0.95);
        }
        
        .radar-icon {
            width: 24px;
            height: 24px;
            position: relative;
            display: flex;
            justify-content: center;
            align-items: center;
            filter: drop-shadow(0 0 2px rgba(255,255,255,0.5));
            animation: radar-scan 4s linear infinite;
        }
        
        .radar-icon svg {
            width: 100%;
            height: 100%;
        }
        
        #svgSnifferModal {
            display: none;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 90%;
            max-width: 800px;
            max-height: 80vh;
            background: white;
            z-index: 10000;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            overflow: hidden;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .modal-header {
            background: linear-gradient(135deg, #3498db, #2980b9);
            color: white;
            padding: 18px 25px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .modal-header h2 {
            margin: 0;
            font-size: 1.4rem;
            font-weight: 600;
        }
        
        .close-btn {
            background: none;
            border: none;
            color: white;
            font-size: 1.8rem;
            cursor: pointer;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }
        
        .close-btn:hover {
            background: rgba(255, 255, 255, 0.2);
        }
        
        .action-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 25px;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
        }
        
        .select-all-control {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 1rem;
        }
        
        .action-buttons {
            display: flex;
            gap: 12px;
        }
        
        .action-btn {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.95rem;
            transition: all 0.2s;
        }
        
        .download-btn {
            background: #27ae60;
            color: white;
        }
        
        .download-btn:hover {
            background: #219653;
            transform: translateY(-2px);
        }
        
        .copy-btn {
            background: #2980b9;
            color: white;
        }
        
        .copy-btn:hover {
            background: #2573a7;
            transform: translateY(-2px);
        }
        
        .item-download-btn {
            padding: 6px 12px;
            background: #3498db;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.85rem;
            transition: background 0.2s;
        }
        
        .item-download-btn:hover {
            background: #2980b9;
        }
        
        .modal-content {
            padding: 20px;
            overflow-y: auto;
            max-height: 60vh;
        }
        
        .svg-item {
            display: flex;
            align-items: center;
            padding: 15px;
            border-bottom: 1px solid #eee;
            transition: background 0.2s;
            justify-content: space-between;
        }
        
        .svg-item:hover {
            background-color: #f8fafc;
        }
        
        .svg-checkbox {
            margin-right: 20px;
            width: 20px;
            height: 20px;
            cursor: pointer;
        }
        
        .svg-preview {
            width: 50px;
            height: 50px;
            margin-right: 20px;
            border: 1px solid #e0e0e0;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            background: white;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
        }
        
        .svg-preview svg {
            max-width: 100%;
            max-height: 100%;
        }
        
        .svg-name {
            flex-grow: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 1.05rem;
            color: #2c3e50;
            margin-right: 15px;
        }
        
        .overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 9999;
            display: none;
        }
        
        .loading {
            text-align: center;
            padding: 30px;
            font-size: 1.2rem;
            color: #666;
        }
        
        .copy-notification {
            position: fixed;
            top: 30px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #27ae60;
            color: white;
            padding: 12px 25px;
            border-radius: 6px;
            z-index: 100000;
            opacity: 0;
            transition: opacity 0.5s;
            pointer-events: none;
            white-space: nowrap;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        @keyframes radar-scan {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(52, 152, 219, 0.6); }
            70% { box-shadow: 0 0 0 12px rgba(52, 152, 219, 0); }
            100% { box-shadow: 0 0 0 0 rgba(52, 152, 219, 0); }
        }
    `);

    const radarContainer = document.createElement('div');
    radarContainer.className = 'radar-container';
    radarContainer.id = 'radarContainer';
    
    const radarButton = document.createElement('div');
    radarButton.className = 'radar-button';
    radarButton.id = 'radarButton';
    radarButton.innerHTML = `
        <div class="radar-icon">
            <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" fill="white">
                <path d="M512 625.8c-63 0-113.8-51-113.8-113.8s51-113.8 113.8-113.8 113.8 51 113.8 113.8-50.8 113.8-113.8 113.8z m0-165.6c-28.6 0-51.8 23.2-51.8 51.8 0 28.6 23.2 51.8 51.8 51.8 28.6 0 51.8-23.2 51.8-51.8 0-28.6-23.2-51.8-51.8-51.8zM843.2 791.4c-6.6 0-12.8-2-18.6-6.2-13.6-10.4-16.6-29.8-6.2-43.4 50-66.6 76.6-146.2 76.6-229.8s-26.4-163-76.6-229.8c-10.4-13.6-7.4-33.2 6.2-43.4 13.6-10.4 33.2-7.4 43.4 6.2 58.4 77.4 89 169.8 89 267s-30.6 189.6-89 267c-6.2 8.2-15.4 12.4-24.8 12.4zM180.8 791.4c-9.6 0-18.6-4.2-24.8-12.4-58.4-77.4-89-169.8-89-267S97.6 322.4 156 245c10.4-13.6 29.8-16.6 43.4-6.2 13.6 10.4 16.6 29.8 6.2 43.4-50 66.6-76.6 146.2-76.6 229.8s26.4 163 76.6 229.8c10.4 13.6 7.4 33.2-6.2 43.4-5.4 4.2-12 6.2-18.6 6.2zM710.8 692c-6.6 0-12.8-2-18.6-6.2-13.6-10.4-16.6-29.8-6.2-43.4 28.6-37.6 43.4-82.8 43.4-130.4s-15-92.8-43.4-130.4c-10.4-13.6-7.4-33.2 6.2-43.4 13.6-10.4 33.2-7.4 43.4 6.2 36.4 48.8 55.8 106.8 55.8 167.6s-19.4 119.2-55.8 167.6c-6.2 8.4-15.4 12.4-24.8 12.4zM313.4 692c-9.6 0-18.6-4.2-24.8-12.4-36.4-48.8-55.8-106.8-55.8-167.6s19.4-119.2 55.8-167.6c10.4-13.6 29.8-16.6 43.4-6.2 13.6 10.4 16.6 29.8 6.2 43.4-28.6 37.6-43.4 82.8-43.4 130.4s15 92.8 43.4 130.4c10.4 13.6 7.4 33.2-6.2 43.4-5.4 4.2-12 6.2-18.6 6.2z"></path>
            </svg>
        </div>
    `;
    
    radarContainer.appendChild(radarButton);
    document.body.appendChild(radarContainer);

    const svgModal = document.createElement('div');
    svgModal.id = 'svgSnifferModal';
    svgModal.innerHTML = `
        <div class="modal-header">
            <h2>SVG资源列表</h2>
            <button class="close-btn">&times;</button>
        </div>
        <div class="action-bar">
            <div class="select-all-control">
                <input type="checkbox" id="selectAll">
                <label for="selectAll">全选</label>
            </div>
            <div class="action-buttons">
                <button class="action-btn download-btn" id="batchDownloadBtn">批量下载选中</button>
                <button class="action-btn copy-btn">复制SVG</button>
            </div>
        </div>
        <div class="modal-content" id="svgList">
            <div class="loading">正在扫描页面SVG资源...</div>
        </div>
    `;
    document.body.appendChild(svgModal);

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    document.body.appendChild(overlay);

    const copyNotification = document.createElement('div');
    copyNotification.className = 'copy-notification';
    document.body.appendChild(copyNotification);

    let globalSvgItems = [];
    let svgItemCache = new Map();
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    let dragStartTime = 0;
    let touchTimer = null;
    let blobUrls = [];

    function initRadarButton() {
        const domain = location.hostname.replace(/\./g, '-');
        const positionKey = `radarPosition_${domain}`;
        
        const savedPosition = GM_getValue(positionKey);
        if (savedPosition) {
            radarContainer.style.left = `${savedPosition.x}px`;
            radarContainer.style.top = `${savedPosition.y}px`;
        } else {
            radarContainer.style.right = `${CONFIG.positionOffset}px`;
            radarContainer.style.bottom = `${CONFIG.positionOffset}px`;
        }
        
        radarContainer.addEventListener('mousedown', startDrag);
        radarContainer.addEventListener('touchstart', startDrag, { passive: false });
        
        radarButton.addEventListener('click', (e) => {
            if (!isDragging && Date.now() - dragStartTime > CONFIG.touchDelay) {
                showSVGList();
            }
        });
    }

    function startDrag(e) {
        e.preventDefault();
        
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        
        const computedStyle = window.getComputedStyle(radarContainer);
        startLeft = parseInt(computedStyle.left) || 0;
        startTop = parseInt(computedStyle.top) || 0;
        
        if (computedStyle.right !== 'auto') {
            const rightPos = parseInt(computedStyle.right);
            startLeft = window.innerWidth - rightPos - CONFIG.buttonSize;
            radarContainer.style.right = 'auto';
            radarContainer.style.left = `${startLeft}px`;
        }
        
        startX = clientX;
        startY = clientY;
        dragStartTime = Date.now();
        
        if (e.type === 'touchstart') {
            touchTimer = setTimeout(() => {
                isDragging = true;
                radarContainer.style.transition = 'none';
            }, CONFIG.touchDelay);
        } else {
            isDragging = true;
        }
        
        document.addEventListener('mousemove', drag);
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchend', endDrag);
    }

    function drag(e) {
        if (!isDragging) return;
        e.preventDefault();
        
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        
        const dx = clientX - startX;
        const dy = clientY - startY;
        radarContainer.style.left = `${startLeft + dx}px`;
        radarContainer.style.top = `${startTop + dy}px`;
        radarContainer.style.right = 'auto';
    }

    function endDrag(e) {
        if (touchTimer) {
            clearTimeout(touchTimer);
            touchTimer = null;
        }
        
        if (!isDragging) {
            if (Date.now() - dragStartTime < CONFIG.touchDelay) {
                showSVGList();
            }
            return;
        }
        
        isDragging = false;
        radarContainer.style.transition = '';
        
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('touchmove', drag);
        document.removeEventListener('mouseup', endDrag);
        document.removeEventListener('touchend', endDrag);
        
        const domain = location.hostname.replace(/\./g, '-');
        const positionKey = `radarPosition_${domain}`;
        const rect = radarContainer.getBoundingClientRect();
        GM_setValue(positionKey, {
            x: rect.left,
            y: rect.top
        });
    }

    function inlineExternalResources(svg) {
        const linkElements = svg.querySelectorAll('link[rel="stylesheet"]');
        linkElements.forEach(link => {
            try {
                const href = link.getAttribute('href');
                if (href) {
                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', href, false);
                    xhr.onload = function() {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
                            style.textContent = xhr.responseText;
                            link.parentNode.replaceChild(style, link);
                        }
                    };
                    xhr.send();
                }
            } catch (e) {
                link.parentNode.removeChild(link);
            }
        });
        
        const imageElements = svg.querySelectorAll('image');
        imageElements.forEach(img => {
            try {
                const href = img.getAttribute('href') || img.getAttribute('xlink:href');
                if (href && !href.startsWith('data:')) {
                    const imgObj = new Image();
                    imgObj.crossOrigin = 'anonymous';
                    imgObj.onload = function() {
                        const canvas = document.createElement('canvas');
                        canvas.width = imgObj.width;
                        canvas.height = imgObj.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(imgObj, 0, 0);
                        const dataUrl = canvas.toDataURL('image/png');
                        img.setAttribute('href', dataUrl);
                        img.removeAttribute('xlink:href');
                    };
                    imgObj.src = href;
                }
            } catch (e) {
                console.warn('处理SVG图片失败:', e);
            }
        });
    }

    function collectSVGs() {
        const svgItems = [];
        const svgElements = document.querySelectorAll('svg');
        
        svgElements.forEach((svg, index) => {
            let name = `SVG ${index + 1}`;
            let parent = svg.parentElement;
            while (parent) {
                if (parent.querySelector('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="name"]')) {
                    const nameElement = parent.querySelector('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="name"]');
                    if (nameElement) {
                        name = nameElement.textContent.trim() || name;
                        break;
                    }
                }
                parent = parent.parentElement;
            }
            
            const clonedSvg = svg.cloneNode(true);
            inlineExternalResources(clonedSvg);
            
            clonedSvg.removeAttribute('onclick');
            clonedSvg.removeAttribute('onmouseover');
            clonedSvg.removeAttribute('onmouseout');
            
            const svgId = `svg-${index}-${Date.now()}`;
            svgItems.push({
                name: name,
                svg: clonedSvg.outerHTML,
                id: svgId
            });
        });
        
        return svgItems;
    }

    function showSVGList() {
        const modal = document.getElementById('svgSnifferModal');
        const svgList = document.getElementById('svgList');
        
        svgList.innerHTML = '<div class="loading">正在扫描页面SVG资源...</div>';
        modal.style.display = 'block';
        overlay.style.display = 'block';
        
        setTimeout(() => {
            try {
                const svgItems = collectSVGs();
                globalSvgItems = svgItems;
                svgItemCache.clear();
                
                svgItems.forEach(item => {
                    svgItemCache.set(item.id, item);
                });
                
                if (svgItems.length === 0) {
                    svgList.innerHTML = '<div class="loading">没有找到SVG资源</div>';
                    return;
                }
                
                svgList.innerHTML = '';
                svgItems.forEach(item => {
                    const itemElement = document.createElement('div');
                    itemElement.className = 'svg-item';
                    itemElement.innerHTML = `
                        <div style="display: flex; align-items: center;">
                            <input type="checkbox" class="svg-checkbox" data-id="${item.id}" checked>
                            <div class="svg-preview">${item.svg}</div>
                            <div class="svg-name" title="${item.name}">${item.name}</div>
                        </div>
                        <button class="item-download-btn" data-svg-id="${item.id}">单独下载</button>
                    `;
                    svgList.appendChild(itemElement);
                    
                    const itemDownloadBtn = itemElement.querySelector('.item-download-btn');
                    itemDownloadBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const svgId = e.currentTarget.dataset.svgId;
                        const svgItem = svgItemCache.get(svgId);
                        if (svgItem) {
                            console.log('触发单个SVG下载:', svgItem.name, svgItem.id);
                            downloadSingleSVG(svgItem, true);
                        } else {
                            showNotification('未找到该SVG资源，请刷新重试', 'error');
                            console.error('单个下载失败：SVG项未找到，ID=', svgId);
                        }
                    });
                });
            } catch (error) {
                console.error('SVG扫描错误:', error);
                svgList.innerHTML = `<div class="loading">错误: ${error.message}</div>`;
            }
        }, 300);
    }

    function downloadSingleSVG(svgItem, isSingleDownload = false) {
        console.log('进入单个下载函数:', {
            name: svgItem.name,
            id: svgItem.id,
            isSingle: isSingleDownload,
            gmDownloadExists: typeof GM_download !== 'undefined',
            fileSaverExists: typeof saveAs !== 'undefined'
        });
        
        const cleanName = sanitizeFileName(svgItem.name);
        const svgContent = `<?xml version="1.0" encoding="UTF-8"?>${svgItem.svg}`;
        const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
        
        if (isSingleDownload) {
            try {
                const url = URL.createObjectURL(blob);
                blobUrls.push(url);
                
                const link = document.createElement('a');
                link.href = url;
                link.download = `${cleanName}.svg`;
                link.style.display = 'none';
                
                document.body.appendChild(link);
                link.dispatchEvent(new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    button: 0
                }));
                
                setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    blobUrls = blobUrls.filter(u => u !== url);
                }, 100);
                
                showNotification(`单独下载成功: ${cleanName}.svg`, 'success');
                return;
            } catch (nativeError) {
                console.warn('原生下载失败，尝试FileSaver:', nativeError);
            }
            
            try {
                if (typeof saveAs !== 'undefined') {
                    saveAs(blob, `${cleanName}.svg`);
                    showNotification(`单独下载成功: ${cleanName}.svg`, 'success');
                    return;
                }
            } catch (fsError) {
                console.warn('FileSaver下载失败，尝试GM_download:', fsError);
            }
            
            try {
                if (typeof GM_download !== 'undefined') {
                    const url = URL.createObjectURL(blob);
                    blobUrls.push(url);
                    
                    GM_download({
                        url: url,
                        name: `${cleanName}.svg`,
                        mimetype: 'image/svg+xml',
                        onload: () => {
                            showNotification(`单独下载成功: ${cleanName}.svg`, 'success');
                            URL.revokeObjectURL(url);
                            blobUrls = blobUrls.filter(u => u !== url);
                        },
                        onerror: (gmError) => {
                            showNotification('单独下载失败，请检查浏览器权限', 'error');
                            console.error('GM_download单独下载失败:', gmError);
                            URL.revokeObjectURL(url);
                            blobUrls = blobUrls.filter(u => u !== url);
                        }
                    });
                    return;
                }
            } catch (gmFinalError) {
                console.error('所有单独下载方案失败:', gmFinalError);
                showNotification('单独下载失败，建议复制SVG手动保存', 'error');
            }
        }
        
        if (typeof GM_download !== 'undefined') {
            const url = URL.createObjectURL(blob);
            blobUrls.push(url);
            
            GM_download({
                url: url,
                name: `${cleanName}.svg`,
                mimetype: 'image/svg+xml',
                onload: () => {
                    if (!isSingleDownload) showNotification(`下载成功: ${cleanName}.svg`, 'success');
                    URL.revokeObjectURL(url);
                    blobUrls = blobUrls.filter(u => u !== url);
                },
                onerror: (error) => {
                    console.error('GM_download失败:', error);
                    if (!isSingleDownload) showNotification('GM_download失败，尝试备用方案', 'warning');
                    fallbackDownload(blob, `${cleanName}.svg`, isSingleDownload);
                }
            });
            return;
        }
        
        try {
            saveAs(blob, `${cleanName}.svg`);
            if (!isSingleDownload) showNotification(`下载成功: ${cleanName}.svg`, 'success');
        } catch (error) {
            console.error('下载失败:', error);
            fallbackDownload(blob, `${cleanName}.svg`, isSingleDownload);
        }
    }

    function downloadMultipleSVGs(items) {
        const zip = new JSZip();
        items.forEach(item => {
            const cleanName = sanitizeFileName(item.name);
            const svgContent = `<?xml version="1.0" encoding="UTF-8"?>${item.svg}`;
            zip.file(`${cleanName}.svg`, svgContent);
        });
        
        zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        }).then(content => {
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
            const zipName = `svg_collection_${timestamp}.zip`;
            
            try {
                saveAs(content, zipName);
                showNotification(`批量下载成功: ${zipName}`, 'success');
            } catch (error) {
                console.error('ZIP下载失败:', error);
                fallbackDownload(content, zipName);
            }
        }).catch(error => {
            console.error('ZIP创建失败:', error);
            showNotification('创建压缩包失败，建议单个下载', 'error');
            items.slice(0, 3).forEach(item => downloadSingleSVG(item, true));
        });
    }

    function downloadSelected() {
        const checkboxes = document.querySelectorAll('.svg-checkbox:checked');
        if (checkboxes.length === 0) {
            showNotification('请至少选择一个SVG！', 'warning');
            return;
        }
        
        const selectedItems = [];
        checkboxes.forEach(checkbox => {
            const id = checkbox.dataset.id;
            const item = svgItemCache.get(id) || globalSvgItems.find(i => i.id === id);
            if (item) {
                selectedItems.push(item);
            }
        });
        
        if (selectedItems.length === 0) {
            showNotification('没有找到选中的SVG项目！', 'warning');
            return;
        }
        
        clearBlobUrls();
        if (selectedItems.length === 1) {
            downloadSingleSVG(selectedItems[0], false);
        } else {
            downloadMultipleSVGs(selectedItems);
        }
    }

    function fallbackDownload(blob, fileName, isSingleDownload = false) {
        try {
            const url = URL.createObjectURL(blob);
            blobUrls.push(url);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            const event = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
                button: 0
            });
            link.dispatchEvent(event);
            
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                blobUrls = blobUrls.filter(u => u !== url);
            }, 100);
            
            const msg = isSingleDownload ? 
                `单独下载成功(备用): ${fileName}` : 
                `下载成功(备用): ${fileName}`;
            showNotification(msg, 'success');
            
        } catch (error) {
            console.error('备用下载失败:', error);
            const msg = isSingleDownload ? 
                '单独下载失败，请检查浏览器下载权限' : 
                '下载失败，请检查浏览器下载权限';
            showNotification(msg, 'error');
            clearBlobUrls();
        }
    }

    function sanitizeFileName(name) {
        return name
            .replace(/[^\\w\\u4e00-\\u9fa5\\-\\s]/g, '_')
            .replace(/\\s+/g, '_')
            .substring(0, 50)
            .trim() || 'unnamed_svg';
    }

    function showNotification(message, type = 'info') {
        const colors = {
            info: '#3498db',
            success: '#27ae60',
            warning: '#f39c12',
            error: '#e74c3c'
        };
        
        copyNotification.textContent = message;
        copyNotification.style.backgroundColor = colors[type] || colors.info;
        copyNotification.style.opacity = '1';
        
        setTimeout(() => {
            copyNotification.style.opacity = '0';
        }, 3000);
    }

    function copySelected() {
        const checkboxes = document.querySelectorAll('.svg-checkbox:checked');
        if (checkboxes.length === 0) {
            showNotification('请至少选择一个SVG！', 'warning');
            return;
        }
        
        let combinedCode = '';
        checkboxes.forEach(checkbox => {
            const id = checkbox.dataset.id;
            const item = svgItemCache.get(id) || globalSvgItems.find(i => i.id === id);
            if (item) {
                combinedCode += `${item.svg}\n\n`;
            }
        });
        
        try {
            GM_setClipboard(combinedCode, 'text');
            showNotification(`已复制 ${checkboxes.length} 个SVG代码`, 'success');
        } catch (e) {
            const textArea = document.createElement('textarea');
            textArea.value = combinedCode;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showNotification(`已复制 ${checkboxes.length} 个SVG代码 (备用方法)`, 'success');
        }
    }

    function setupEventListeners() {
        document.querySelector('.close-btn').addEventListener('click', () => {
            document.getElementById('svgSnifferModal').style.display = 'none';
            overlay.style.display = 'none';
            clearBlobUrls();
            svgItemCache.clear();
        });
        
        overlay.addEventListener('click', () => {
            document.getElementById('svgSnifferModal').style.display = 'none';
            overlay.style.display = 'none';
            clearBlobUrls();
            svgItemCache.clear();
        });
        
        document.getElementById('batchDownloadBtn').addEventListener('click', downloadSelected);
        
        document.querySelector('.copy-btn').addEventListener('click', copySelected);
        
        document.getElementById('selectAll').addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.svg-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
            });
        });
        
        window.addEventListener('beforeunload', () => {
            clearBlobUrls();
            svgItemCache.clear();
        });
    }

    function clearBlobUrls() {
        blobUrls.forEach(url => {
            try {
                URL.revokeObjectURL(url);
            } catch (e) {
                console.warn('清理Blob URL失败:', e);
            }
        });
        blobUrls = [];
    }

    function init() {
        initRadarButton();
        setupEventListeners();
        
        setTimeout(() => {
            radarButton.style.display = 'flex';
        }, 100);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
