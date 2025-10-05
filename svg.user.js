// ==UserScript==
// @name         SVG嗅探器
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  嗅探页面中的SVG资源
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

    // 配置参数
    const CONFIG = {
        buttonSize: 30,
        activeColor: '#3498db',
        hoverColor: '#2980b9',
        zIndex: 99999,
        positionOffset: 25,
        touchDelay: 300
    };

    // 添加主样式
    GM_addStyle(`
        /* 按钮容器 */
        .radar-container {
            position: fixed;
            z-index: ${CONFIG.zIndex};
            cursor: move;
            transition: transform 0.2s;
            touch-action: none;
        }
        
        /* 按钮 */
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
        
        /* 图标 */
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
            0% {
                transform: rotate(0deg);
            }
            100% {
                transform: rotate(360deg);
            }
        }
        
        @keyframes pulse {
            0% {
                box-shadow: 0 0 0 0 rgba(52, 152, 219, 0.6);
            }
            70% {
                box-shadow: 0 0 0 12px rgba(52, 152, 219, 0);
            }
            100% {
                box-shadow: 0 0 0 0 rgba(52, 152, 219, 0);
            }
        }
    `);

    // 创建按钮容器
    const radarContainer = document.createElement('div');
    radarContainer.className = 'radar-container';
    radarContainer.id = 'radarContainer';
    
    // 创建按钮
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

    // 创建SVG嗅探模态框
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
                <button class="action-btn download-btn">下载选中</button>
                <button class="action-btn copy-btn">复制SVG</button>
            </div>
        </div>
        <div class="modal-content" id="svgList">
            <div class="loading">正在扫描页面SVG资源...</div>
        </div>
    `;
    document.body.appendChild(svgModal);

    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    document.body.appendChild(overlay);

    // 创建复制通知
    const copyNotification = document.createElement('div');
    copyNotification.className = 'copy-notification';
    document.body.appendChild(copyNotification);

    // 全局变量
    let globalSvgItems = [];
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    let dragStartTime = 0;
    let touchTimer = null;

    // 初始化按钮
    function initRadarButton() {
        const domain = location.hostname.replace(/\./g, '-');
        const positionKey = `radarPosition_${domain}`;
        
        // 设置初始位置
        const savedPosition = GM_getValue(positionKey);
        if (savedPosition) {
            radarContainer.style.left = `${savedPosition.x}px`;
            radarContainer.style.top = `${savedPosition.y}px`;
        } else {
            radarContainer.style.right = `${CONFIG.positionOffset}px`;
            radarContainer.style.bottom = `${CONFIG.positionOffset}px`;
        }
        
        // 设置拖拽事件
        radarContainer.addEventListener('mousedown', startDrag);
        radarContainer.addEventListener('touchstart', startDrag, { passive: false });
        
        radarButton.addEventListener('click', (e) => {
            if (!isDragging && Date.now() - dragStartTime > CONFIG.touchDelay) {
                showSVGList();
            }
        });
    }

    // 开始拖拽
    function startDrag(e) {
        e.preventDefault();
        
        // 获取初始位置
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        
        // 获取当前计算位置
        const computedStyle = window.getComputedStyle(radarContainer);
        startLeft = parseInt(computedStyle.left) || 0;
        startTop = parseInt(computedStyle.top) || 0;
        
        // 如果使用right定位，转换为left定位
        if (computedStyle.right !== 'auto') {
            const rightPos = parseInt(computedStyle.right);
            startLeft = window.innerWidth - rightPos - CONFIG.buttonSize;
            radarContainer.style.right = 'auto';
            radarContainer.style.left = `${startLeft}px`;
        }
        
        startX = clientX;
        startY = clientY;
        dragStartTime = Date.now();
        
        // 对于触摸设备，延迟判定是否为拖动
        if (e.type === 'touchstart') {
            touchTimer = setTimeout(() => {
                isDragging = true;
                radarContainer.style.transition = 'none';
            }, CONFIG.touchDelay);
        } else {
            isDragging = true;
        }
        
        // 添加事件监听
        document.addEventListener('mousemove', drag);
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchend', endDrag);
    }

    // 拖拽中
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

    // 结束拖拽
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
        
        // 移除事件监听
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('touchmove', drag);
        document.removeEventListener('mouseup', endDrag);
        document.removeEventListener('touchend', endDrag);
        
        // 保存位置
        const domain = location.hostname.replace(/\./g, '-');
        const positionKey = `radarPosition_${domain}`;
        const rect = radarContainer.getBoundingClientRect();
        GM_setValue(positionKey, {
            x: rect.left,
            y: rect.top
        });
    }

    // 收集SVG函数
    function collectSVGs() {
        const svgItems = [];
        
        // 收集页面中的SVG元素
        const svgElements = document.querySelectorAll('svg');
        
        svgElements.forEach((svg, index) => {
            // 尝试获取有意义的名称
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
            
            // 克隆SVG元素以避免修改原始元素
            const clonedSvg = svg.cloneNode(true);
            
            // 移除干扰属性
            clonedSvg.removeAttribute('onclick');
            clonedSvg.removeAttribute('onmouseover');
            clonedSvg.removeAttribute('onmouseout');
            
            svgItems.push({
                name: name,
                svg: clonedSvg.outerHTML,
                id: `svg-${index}-${Date.now()}`
            });
        });
        
        return svgItems;
    }

    // 显示SVG列表
    function showSVGList() {
        const modal = document.getElementById('svgSnifferModal');
        const svgList = document.getElementById('svgList');
        
        svgList.innerHTML = '<div class="loading">正在扫描页面SVG资源...</div>';
        modal.style.display = 'block';
        overlay.style.display = 'block';
        
        // 使用setTimeout让UI有机会更新
        setTimeout(() => {
            try {
                const svgItems = collectSVGs();
                globalSvgItems = svgItems; // 存储到全局变量
                
                if (svgItems.length === 0) {
                    svgList.innerHTML = '<div class="loading">没有找到SVG资源</div>';
                    return;
                }
                
                svgList.innerHTML = '';
                
                svgItems.forEach(item => {
                    const itemElement = document.createElement('div');
                    itemElement.className = 'svg-item';
                    itemElement.innerHTML = `
                        <input type="checkbox" class="svg-checkbox" data-id="${item.id}" checked>
                        <div class="svg-preview">${item.svg}</div>
                        <div class="svg-name" title="${item.name}">${item.name}</div>
                    `;
                    svgList.appendChild(itemElement);
                });
            } catch (error) {
                console.error('SVG扫描错误:', error);
                svgList.innerHTML = `<div class="loading">错误: ${error.message}</div>`;
            }
        }, 300);
    }

    // 增强的下载函数 - 支持多种下载方式
    function downloadSelected() {
        const checkboxes = document.querySelectorAll('.svg-checkbox:checked');
        if (checkboxes.length === 0) {
            showNotification('请至少选择一个SVG！', 'warning');
            return;
        }
        
        const selectedItems = [];
        checkboxes.forEach(checkbox => {
            const id = checkbox.dataset.id;
            const item = globalSvgItems.find(i => i.id === id);
            if (item) {
                selectedItems.push(item);
            }
        });
        
        if (selectedItems.length === 0) {
            showNotification('没有找到选中的SVG项目！', 'warning');
            return;
        }
        
        // 根据数量选择下载方式
        if (selectedItems.length === 1) {
            downloadSingleSVG(selectedItems[0]);
        } else {
            downloadMultipleSVGs(selectedItems);
        }
    }

    // 下载单个SVG文件
    function downloadSingleSVG(item) {
        const cleanName = sanitizeFileName(item.name);
        const blob = new Blob([item.svg], { type: 'image/svg+xml' });
        
        // 尝试多种下载方式
        try {
            // 方式1: 使用GM_download (如果可用)
            if (typeof GM_download !== 'undefined') {
                const url = URL.createObjectURL(blob);
                GM_download({
                    url: url,
                    name: `${cleanName}.svg`,
                    onload: () => URL.revokeObjectURL(url),
                    onerror: (error) => {
                        console.error('GM_download failed:', error);
                        fallbackDownload(blob, `${cleanName}.svg`);
                    }
                });
                return;
            }
            
            // 方式2: 使用FileSaver.js
            saveAs(blob, `${cleanName}.svg`);
            
        } catch (error) {
            console.error('Download failed:', error);
            // 方式3: 回退方案 - 创建下载链接
            fallbackDownload(blob, `${cleanName}.svg`);
        }
    }

    // 下载多个SVG文件（ZIP压缩包）
    function downloadMultipleSVGs(items) {
        const zip = new JSZip();
        
        items.forEach(item => {
            const cleanName = sanitizeFileName(item.name);
            zip.file(`${cleanName}.svg`, item.svg);
        });
        
        zip.generateAsync({ type: 'blob' }).then(content => {
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
            const zipName = `svg_collection_${timestamp}.zip`;
            
            try {
                // 方式1: 使用FileSaver.js
                saveAs(content, zipName);
            } catch (error) {
                console.error('ZIP download failed:', error);
                // 方式2: 回退方案
                fallbackDownload(content, zipName);
            }
        }).catch(error => {
            console.error('ZIP creation failed:', error);
            showNotification('创建压缩包失败，请尝试逐个下载', 'error');
        });
    }

    // 回退下载方案
    function fallbackDownload(blob, fileName) {
        try {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // 清理URL
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            
        } catch (error) {
            console.error('Fallback download failed:', error);
            showNotification('下载失败，请检查浏览器设置', 'error');
        }
    }

    // 文件名清理函数
    function sanitizeFileName(name) {
        return name
            .replace(/[^\\w\\u4e00-\\u9fa5\\-\\s]/g, '_')
            .replace(/\\s+/g, '_')
            .substring(0, 50)
            .trim() || 'unnamed_svg';
    }

    // 增强的通知函数
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

    // 复制选中的SVG代码
    function copySelected() {
        const checkboxes = document.querySelectorAll('.svg-checkbox:checked');
        if (checkboxes.length === 0) {
            showNotification('请至少选择一个SVG！', 'warning');
            return;
        }
        
        // 构建SVG代码字符串
        let combinedCode = '';
        
        checkboxes.forEach(checkbox => {
            const id = checkbox.dataset.id;
            const item = globalSvgItems.find(i => i.id === id);
            if (item) {
                combinedCode += `${item.svg}\n\n`;
            }
        });
        
        // 尝试复制到剪贴板
        try {
            GM_setClipboard(combinedCode, 'text');
            showNotification(`已复制 ${checkboxes.length} 个SVG代码`, 'success');
        } catch (e) {
            // 回退方案
            const textArea = document.createElement('textarea');
            textArea.value = combinedCode;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showNotification(`已复制 ${checkboxes.length} 个SVG代码 (使用回退方法)`, 'success');
        }
    }

    // 设置事件监听器
    function setupEventListeners() {
        // 关闭模态框
        document.querySelector('.close-btn').addEventListener('click', () => {
            document.getElementById('svgSnifferModal').style.display = 'none';
            overlay.style.display = 'none';
        });
        
        // 点击遮罩层关闭模态框
        overlay.addEventListener('click', () => {
            document.getElementById('svgSnifferModal').style.display = 'none';
            overlay.style.display = 'none';
        });
        
        // 下载按钮
        document.querySelector('.download-btn').addEventListener('click', downloadSelected);
        
        // 复制按钮
        document.querySelector('.copy-btn').addEventListener('click', copySelected);
        
        // 全选/取消全选
        document.getElementById('selectAll').addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.svg-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
            });
        });
    }

    // 初始化脚本
    function init() {
        initRadarButton();
        setupEventListeners();
        
        // 确保元素已正确添加到DOM
        setTimeout(() => {
            radarButton.style.display = 'flex';
        }, 100);
    }

    // 启动脚本
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();