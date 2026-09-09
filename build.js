#!/usr/bin/env node
const fs=require('fs');
const path=require('path');

const sourceFiles=[
 'src/config.js','src/styles.js','src/icons.js','src/utils/debounce.js','src/utils/hash.js','src/utils/url.js','src/utils/index.js',
 'src/services/Notification.js','src/services/BlobManager.js','src/modules/Deduplication.js','src/modules/Downloader.js','src/modules/MediaDownloader.js',
 'src/modules/ImageCollector.js','src/modules/MediaPageHook.js','src/modules/MediaCollector.js','src/modules/DynamicListener.js','src/modules/Draggable.js','src/modules/PreviewModal.js',
 'src/modules/UIRenderer.js','src/modules/MediaPreview.js','src/modules/Clipboard.js','src/modules/DOMBuilder.js','src/modules/App.js','src/modules/MediaIntegration.js'
];

function stripModuleSyntax(content){
    return content.split('\n').filter(function(line){
        if(/^\s*import\s/.test(line))return false;
        if(/^\s*export\s*\{/.test(line))return false;
        return true;
    }).map(function(line){
        return line.replace(/^\s*export\s+(const|class|function|async function)\s+/,'$1 ');
    }).join('\n');
}

function assertSyntax(label,content){
    try{
        new Function(content);
    }catch(error){
        throw new Error(`语法检查失败: ${label}: ${error.message}`);
    }
}

function readAndProcessFile(filePath){
    const original=fs.readFileSync(filePath,'utf8');
    const content=stripModuleSyntax(original);
    assertSyntax(filePath,content);
    return content;
}

function buildUserScript(){
    const header=`// ==UserScript==
// @name         资源嗅探 Pro
// @namespace    http://tampermonkey.net/
// @version      v5.1.1
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

    const footer=`
(function __rsBoot(){
    if(window.__RS_APP_BOOTED__)return;
    window.__RS_APP_BOOTED__=true;
    try{
        const result=App.init();
        if(result&&typeof result.catch==='function')result.catch(function(error){
            console.error('[资源嗅探 Pro] 初始化失败:',error);
            window.__RS_APP_BOOTED__=false;
        });
    }catch(error){
        console.error('[资源嗅探 Pro] 初始化异常:',error);
        window.__RS_APP_BOOTED__=false;
    }
})();
})();
`;

    let allCode='';
    for(const file of sourceFiles){
        const filePath=path.join(__dirname,file);
        if(!fs.existsSync(filePath))throw new Error('源文件不存在: '+file);
        allCode+='\n    // ===== '+file+' =====\n';
        allCode+=readAndProcessFile(file).split('\n').map(line=>'    '+line).join('\n');
    }

    if(/(^|\n)\s*(?:import|export)\b/m.test(allCode)){
        throw new Error('构建产物仍包含未处理的 import/export 语句');
    }

    const output=header+allCode+footer;
    assertSyntax('svg.user.js',output);

    const outputPath=path.join(__dirname,'svg.user.js');
    fs.writeFileSync(outputPath,output,'utf8');
    console.log(`Built ${outputPath} ${(fs.statSync(outputPath).size/1024).toFixed(2)} KB`);
    console.log('Syntax validation: PASS');
}

try{buildUserScript()}catch(error){console.error('Build failed:',error);process.exit(1)}
