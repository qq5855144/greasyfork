#!/usr/bin/env node

/**
 * 打包脚本
 * 将模块化的源代码打包成一个单一的 svg.user.js 文件
 */

const fs = require("fs");
const path = require("path");

// 定义源文件的加载顺序（依赖关系）
const sourceFiles = [
    // 配置和样式
    "src/config.js",
    "src/styles.js",
    "src/icons.js",

    // 工具函数
    "src/utils/debounce.js",
    "src/utils/hash.js",
    "src/utils/url.js",
    "src/utils/index.js",

    // 服务
    "src/services/Notification.js",
    "src/services/BlobManager.js",

    // 模块（按依赖顺序）
    "src/modules/Deduplication.js",
    "src/modules/Downloader.js",
    "src/modules/ImageCollector.js",
    "src/modules/DynamicListener.js",
    "src/modules/Draggable.js",
    "src/modules/PreviewModal.js",
    "src/modules/UIRenderer.js",
    "src/modules/Clipboard.js",
    "src/modules/DOMBuilder.js",
    "src/modules/App.js",
];

/**
 * 读取并处理源文件
 * @param {string} filePath - 文件路径
 * @returns {string} 处理后的文件内容
 */
function readAndProcessFile(filePath) {
    let content = fs.readFileSync(filePath, "utf-8");

    // 移除 ES6 import 语句（在打包后不需要）
    content = content.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, "");

    // 移除 export 关键字，保留导出的对象/类
    content = content.replace(/^export\s+(const|class|function|async function)\s+/gm, "$1 ");

    return content;
}

/**
 * 生成最终的 UserScript
 */
function buildUserScript() {
    const header = `// ==UserScript==
// @name         网页图片采集器 Pro
// @namespace    http://tampermonkey.net/
// @version      v4.0
// @description  支持动态加载、智能去重、大图预览、批量打包下载的网页图片下载工具 | 七彩毛玻璃UI
// @author       YourName
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @connect      *
// @require      https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
// @icon         data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%23ff6b6b%22%2F%3E%3Cstop%20offset%3D%220.5%22%20stop-color%3D%22%23feca57%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%231dd1a1%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20x%3D%223%22%20y%3D%223%22%20width%3D%2218%22%20height%3D%2218%22%20rx%3D%223%22%20fill%3D%22url(%23g)%22%2F%3E%3Ccircle%20cx%3D%228.5%22%20cy%3D%228.5%22%20r%3D%221.6%22%20fill%3D%22%23fff%22%2F%3E%3Cpath%20d%3D%22M21%2015l-5-5L7%2019%22%20stroke%3D%22%23fff%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3Cpath%20d%3D%22M12%2017v-4%22%20stroke%3D%22%23fff%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%2F%3E%3Cpath%20d%3D%22M9.5%2013L12%2010.5L14.5%2013%22%20stroke%3D%22%23fff%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

`;

    const footer = `
    // 初始化应用
    window.addEventListener('load', function() {
        App.init();
    });

    // 如果页面已加载，立即初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            App.init();
        });
    } else {
        App.init();
    }
})();
`;

    // 读取所有源文件
    let allCode = "";
    for (const file of sourceFiles) {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            console.log(`📦 打包: ${file}`);
            const code = readAndProcessFile(filePath);
            allCode += "\n    // ==================== " + file + " ====================\n";
            allCode += code.split("\n").map(line => "    " + line).join("\n");
        } else {
            console.warn(`⚠️  文件不存在: ${file}`);
        }
    }

    // 组合最终代码
    const finalCode = header + allCode + footer;

    // 写入输出文件
    const outputPath = path.join(__dirname, "svg.user.js");
    fs.writeFileSync(outputPath, finalCode, "utf-8");
    console.log(`\n✅ 打包完成！输出文件: ${outputPath}`);
    console.log(`📊 文件大小: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
}

// 执行打包
try {
    buildUserScript();
} catch (error) {
    console.error("❌ 打包失败:", error);
    process.exit(1);
}
