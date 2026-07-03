#!/usr/bin/env node
/**
 * 打包脚本 — 将 src/ 下的模块合并为可运行的 svg.user.js
 *
 * 用法: node build.js
 * 输出: svg.user.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ========== 1. 工具函数 ==========

const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

/** 剥离末尾 CommonJS 导出语句 */
function stripExports(code) {
    return code.replace(
        /\n\s*\/\/\s*导出[^\n]*\n\s*if\s*\(typeof\s+module\s*!==\s*['"]undefined['"]\s*&&\s+module\.exports\)\s*\{[\s\S]*?\}\s*$/m,
        ''
    );
}

/** 提取 svg.user.js 中两个标记字符串之间的代码 */
function extractBetween(code, startStr, endStr) {
    const startIdx = code.indexOf(startStr);
    const endIdx = code.indexOf(endStr, startIdx + startStr.length);
    if (startIdx === -1 || endIdx === -1) return '';
    return code.slice(startIdx, endIdx + endStr.length);
}

// ========== 2. 读取源文件 ==========

const oldScript = read('svg.user.js');

// 提取 Userscript 头部
const headerEnd = oldScript.indexOf('// ==/UserScript==') + '// ==/UserScript=='.length;
const header = oldScript.slice(0, headerEnd).trim();

// 提取旧脚本中 IIFE 体（从 (function() { 到 })();）
const iifeStart = oldScript.indexOf("(function() {");
const iifeEnd   = oldScript.lastIndexOf("})();");
const oldBody   = oldScript.slice(iifeStart + "(function() {".length, iifeEnd).trim();

// 读取 src 模块
const configSrc    = stripExports(read('src/config.js'));
const iconsSrc     = stripExports(read('src/icons.js'));
const stylesSrc    = stripExports(read('src/styles.js'));
const componentSrc = stripExports(read('src/components/Component.js'));
const fabSrc       = stripExports(read('src/components/FabButton.js'));

// ========== 3. 从旧脚本中提取尚未迁移的模块 ==========

// 旧脚本的模块划分（按 "// ==== 模块名 ====" 注释定位）
// 我们需要排除已被 src/ 替代的部分：
//   - CONFIG 定义 (已被 src/config.js 替代)
//   - GM_addStyle 样式注入 (已被 src/styles.js 替代)
// 保留：Utils, SVGProcessor, Deduplication, BlobManager, Notification,
//        DOMBuilder, DynamicListener, ImageCollector, UIRenderer, App

// 从 Utils 模块开始提取（这是 src/ 尚未覆盖的第一个模块）
const utilsStart    = oldBody.indexOf("// ==================== 工具函数模块 ====================");
const appEnd        = oldBody.lastIndexOf("App.init();");
let legacyCode = '';

if (utilsStart !== -1 && appEnd !== -1) {
    legacyCode = oldBody.slice(utilsStart, appEnd + "App.init();".length);
}

// ========== 4. 生成 CONFIG 兼容层 ==========
// 新的 src/config.js 使用嵌套结构（CONFIG.ui.buttonSize），
// 但旧的业务代码使用扁平结构（CONFIG.buttonSize）。
// 生成兼容层，将常用属性平铺到 CONFIG 上。

const compatLayer = `
    // ==================== 兼容层（自动生成） ====================
    // 将嵌套 CONFIG 属性平铺，兼容旧代码的扁平访问
    (function buildCompat() {
        const addFlat = (prefix, obj, target) => {
            for (const [key, val] of Object.entries(obj)) {
                if (val && typeof val === 'object' && !Array.isArray(val) && key !== 'get' && key !== 'set' && key !== 'merge') {
                    // 跳过纯嵌套对象，但将叶子属性平铺
                    if (['ui','glass','colors','image','preview','batchDownload',
                         'deduplication','blob','clickDetection','fonts',
                         'animation','spacing','radius','shadow','notification',
                         'storage','features'].includes(key)) {
                        addFlat(key, val, target);
                    }
                } else if (!['get','set','merge'].includes(key)) {
                    // 叶子属性，直接平铺
                    if (!(key in target) || typeof target[key] !== 'object') {
                        target[key] = val;
                    }
                }
            }
        };
        addFlat('', CONFIG, CONFIG);
        // 特殊映射：常用属性的快捷访问
        CONFIG.buttonSize = CONFIG.ui.buttonSize;
        CONFIG.zIndex = CONFIG.ui.zIndex;
        CONFIG.positionOffset = CONFIG.ui.positionOffset;
        CONFIG.touchDelay = CONFIG.ui.touchDelay;
        CONFIG.panelSafeMargin = CONFIG.ui.panelSafeMargin;
        CONFIG.panelMinSize = CONFIG.ui.panelMinSize;
        CONFIG.fixedFontSize = CONFIG.ui.fixedFontSize;
        CONFIG.scrollCheckInterval = CONFIG.ui.scrollCheckInterval;
        CONFIG.clickDetectDelay = CONFIG.ui.clickDetectDelay;
        CONFIG.supportFormats = CONFIG.image.supportFormats;
        CONFIG.maxPreviewSize = CONFIG.image.maxPreviewSize;
        CONFIG.loadTimeout = CONFIG.image.loadTimeout;
        CONFIG.infoTruncateLength = CONFIG.image.infoTruncateLength;
        CONFIG.defaultImageFormat = CONFIG.image.defaultImageFormat;
        CONFIG.maxBlobUrlCount = CONFIG.blob.maxBlobUrlCount;
        CONFIG.blobCleanupNotification = CONFIG.blob.cleanupNotification;
        CONFIG.clickLoadSelectors = CONFIG.clickDetection.selectors;
    })();
`;

// ========== 5. 组装输出 ==========

const output = `${header}

(function() {
    'use strict';

${configSrc}

${compatLayer}

${iconsSrc}

${stylesSrc}

${componentCode}

${fabCode}

    // ==================== 注入样式 ====================
    StyleManager.inject();

${legacyCode ? `
    // ========== 以下为原有业务逻辑（待逐步迁移至 src/）==========
${legacyCode}` : ''}

})();
`;

// ========== 6. 写入输出文件 ==========

fs.writeFileSync(path.join(__dirname, 'svg.user.js'), output, 'utf8');

const sizeKB = (output.length / 1024).toFixed(1);
console.log('✅ 打包完成 → svg.user.js');
console.log(`   文件大小: ${sizeKB} KB`);
console.log('   包含模块: config, icons, styles, Component, FabButton');
if (legacyCode) {
    console.log('   保留模块: Utils, SVGProcessor, Deduplication, BlobManager, Notification, DOMBuilder 等');
}
