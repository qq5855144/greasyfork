#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const sourceFiles=[
 'src/config.js','src/styles.js','src/icons.js','src/utils/debounce.js','src/utils/hash.js','src/utils/url.js','src/utils/index.js',
 'src/services/Notification.js','src/services/BlobManager.js','src/modules/Deduplication.js','src/modules/Downloader.js','src/modules/MediaDownloader.js',
 'src/modules/ImageCollector.js','src/modules/MediaPageHook.js','src/modules/MediaCollector.js','src/modules/DynamicListener.js','src/modules/Draggable.js','src/modules/PreviewModal.js',
 'src/modules/UIRenderer.js','src/modules/MediaPreview.js','src/modules/Clipboard.js','src/modules/DOMBuilder.js','src/modules/App.js','src/modules/MediaIntegration.js'
];
function readAndProcessFile(filePath){let content=fs.readFileSync(filePath,'utf8');content=content.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm,'');content=content.replace(/^export\s+(const|class|function|async function)\s+/gm,'$1 ');content=content.replace(/^export\s*\{[^}]+\};?\s*$/gm,'');return content;}
function buildUserScript(){const header=`// ==UserScript==
// @name         资源嗅探 Pro
// @namespace    http://tampermonkey.net/
// @version      v5.1.0
// @description  图片/视频/音频/SVG 全资源持续嗅探；支持懒加载、fetch/XHR、MSE、HLS/DASH、无限滚动与原生媒体预览。
// @author       增强版
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @connect      *
// @require      https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
// @license      MIT
// ==/UserScript==

(function(){'use strict';\n`;
const footer=`\nwindow.addEventListener('load',function(){App.init()});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){App.init()});else App.init();\n})();\n`;
let allCode='';for(const file of sourceFiles){const filePath=path.join(__dirname,file);if(!fs.existsSync(filePath))throw new Error('源文件不存在: '+file);allCode+='\n    // ===== '+file+' =====\n';allCode+=readAndProcessFile(file).split('\n').map(line=>'    '+line).join('\n');}const outputPath=path.join(__dirname,'svg.user.js');fs.writeFileSync(outputPath,header+allCode+footer,'utf8');console.log(`Built ${outputPath} ${(fs.statSync(outputPath).size/1024).toFixed(2)} KB`)}
try{buildUserScript()}catch(error){console.error('Build failed:',error);process.exit(1)}
