# 聚合搜索引擎切换导航 + GitHub增强

> 一个 Tampermonkey 油猴脚本，在任何网页底部注入搜索引擎快捷栏，支持 46+ 引擎一键切换、拖拽排序、智能排序、快捷搜索、自定义引擎管理，并在 GitHub 搜索结果页自动标注部署网站和发布版本。

## 功能概览

### 搜索引擎快捷栏

在所有网页底部注入一个浮动引擎栏，默认显示 9 个引擎（Bing、Google、百度、密塔、Yandex、哔哩哔哩、APKPure、夸克、知乎）。点击任意引擎即可用当前页面的搜索关键词在新标签页打开对应搜索引擎。如果当前页面没有搜索关键词，点击引擎会弹出快捷搜索面板。

- **46 个内置引擎**：覆盖综合搜索（Google、Bing、百度、DuckDuckGo 等）、学术科研（PubMed、谷歌学术、CNKI）、开发技术（GitHub、StackOverflow、MDN）、视频影视（B站、YouTube）、购物（淘宝、京东、Amazon）、社交社区（知乎、微博、小红书）等类别
- **自动识别**：打开任意搜索引擎页面时，脚本会自动识别并提示添加到引擎列表
- **关键词智能提取**：从 URL 参数、当前输入框、localStorage/sessionStorage 多级回退提取搜索关键词

### 拖拽排序

- **容器级坐标计算**：拖拽时通过鼠标 X 坐标与各按钮中心点比较，实时计算插入位置，拖到任意引擎上方即可触发，无需精确瞄准按钮间隙
- **拖拽指示器**：蓝色脉冲竖条实时显示插入位置，目标引擎同步高亮放大
- **振动反馈**：拖拽开始时短振动（10ms），放置成功时稍长振动（15ms），支持移动端
- **数据持久化**：拖拽结束后自动保存顺序，未显示的引擎 mark 保留在末尾不丢失

### 两种排序模式

通过左下角汉堡菜单 → 引擎排序设置切换：

| 模式 | 行为 |
|------|------|
| **默认模式** | 保持用户拖拽排序的顺序，引擎可自由拖拽 |
| **智能排序** | 按使用频率自动排列，频率相同时按原顺序，禁用拖拽 |

智能排序下，每次点击引擎搜索都会记录使用次数，常用引擎自动浮到前面。

### 快捷搜索面板

按 `Alt+S` 或点击引擎栏中的搜索框打开全屏搜索面板：

- **搜索输入框**：输入关键词用第一个启用引擎搜索，输入有效 URL 则直接打开
- **快捷引擎按钮**：前 8 个启用引擎的快速搜索入口
- **16 类常用网站导航**：共 170+ 个网站快捷链接，涵盖逆向论坛、软件资源、AI 工具、影视、开发工具、设计资源、数据资源等

### 引擎管理中心

按 `Alt+E` 或通过汉堡菜单打开：

- **自动添加**：一键识别当前页面的搜索引擎，自动填充名称、URL、关键词参数
- **手动添加**：支持 4 种图标类型（SVG 代码、图片 URL、文字、Emoji），含实时预览
- **引擎列表**：网格卡片展示，勾选框启用/禁用引擎，支持删除自定义引擎
- **排序保留**：保存设置时保留用户已有的拖拽排序顺序，新启用的引擎追加到末尾

### GitHub 搜索增强

在 `github.com/search` 页面自动激活，为每个仓库结果添加两个标签，显示在仓库描述下方：

- **访问网站**：自动检测仓库的部署 URL，检测来源依次为 GitHub Pages、README 中的部署链接、package.json 的 homepage 字段
- **查看版本**：检测仓库是否有 Releases 或 Tags，API 限流时默认显示

技术细节：支持 301 重定向跟随（处理重命名仓库如 facebook/react）、API 结果缓存、5 级 DOM 定位策略适配 GitHub CSS Modules 哈希类名。

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Alt + S` | 打开快捷搜索面板 |
| `Alt + E` | 打开引擎管理中心 |
| `Alt + M` | 切换汉堡菜单 |
| `Escape` | 关闭当前浮层 |
| `Tab` / `Shift + Tab` | 在浮层内循环聚焦 |

## 安装

### 前置条件

安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展（支持 Chrome、Firefox、Edge、Safari）。

### 安装步骤

1. 安装 Tampermonkey 并启用
2. 点击 [Greasy Fork 安装链接](https://greasyfork.org/zh-CN/scripts/529069) 或从 [GitHub 仓库](https://github.com/qq5855144/greasyfork) 获取 `sousuo.user.js`
3. Tampermonkey 会弹出安装确认页，点击"安装"
4. 打开任意搜索引擎页面，底部即可看到引擎栏

### 所需权限

| 权限 | 用途 |
|------|------|
| `GM_setValue` / `GM_getValue` | 存储引擎配置、排序顺序、使用次数 |
| `GM_addStyle` | 注入样式 |
| `GM_xmlhttpRequest` | GitHub API 调用、README/package.json 抓取 |
| `unsafeWindow` | 访问页面上下文 |
| `@connect github.com` | GitHub API 请求 |
| `@connect raw.githubusercontent.com` | README/package.json 抓取 |
| `@connect api.github.com` | Releases/Tags API 查询 |

## 配置

脚本的所有配置通过 GM 存储自动管理，无需手动编辑。以下是关键存储项：

| 存储键 | 默认值 | 说明 |
|--------|--------|------|
| `punk_setup_search` | `Bing-Google-Baidu-MetaSo-YandexSearch-Bilibili-ApkPure-Quark-Zhihu` | 启用的引擎 mark 列表（`-` 分隔），顺序即显示顺序 |
| `userSearchEngines` | `[]` | 用户自定义引擎列表 |
| `engine_sort_mode` | `default` | 排序模式：`default` 或 `smart` |
| `engine_usage_counts` | `{}` | 各引擎使用次数（智能排序用） |
| `engineBarOffset` | `0` | 引擎栏底部偏移值（输入法弹出时调整） |

恢复默认：在引擎管理中心点击"恢复默认"按钮，清空所有自定义引擎和配置。

## 响应式与移动端

- 响应式断点：768px（平板）、600px（大手机）、480px（小手机）
- 触摸手势：上下滑动控制引擎栏显示/隐藏，引擎栏内触摸阻止冒泡防误触
- 输入法适配：输入框聚焦时自动调整引擎栏位置避免遮挡
- 暗色模式：自动跟随系统 `prefers-color-scheme` 偏好
- 毛玻璃效果：`backdrop-filter: blur()` 应用于所有浮层
- 性能优化：所有触摸/滚动监听使用 `passive: true`

## 无障碍

- 全键盘导航，所有功能可通过键盘操作
- ARIA 标签：引擎按钮 `role="button"` + `aria-label`，浮层 `aria-modal`
- 焦点陷阱：浮层打开时 Tab 循环聚焦，关闭后焦点返回触发元素
- MutationObserver 动态监测 DOM 变化并更新 ARIA 标签

## 特殊站点处理

**百度**：延迟 500ms 同步 `input#kw` 的值，确保搜索关键词正确提取。

**自动添加引擎**：5 级识别策略依次尝试表单分析、搜索输入框检测、Meta 标签识别、URL 参数匹配、已知域名模式映射。

**CSS 隔离**：管理面板内所有 `input`、`select` 元素使用 `!important` 声明，防止宿主页面（如百度）的全局 CSS 重置导致复选框不可见。

## 技术架构

```
githubEnhancer      GitHub 搜索结果增强（部署检测 + 版本检测）
accessibility       无障碍（键盘导航 + ARIA + 焦点陷阱）
utils               工具函数库（关键词提取 + 排序持久化 + SVG 图标）
domHandler          DOM 操作（引擎栏注入 + 拖拽排序 + 滚动监听）
searchOverlay       快捷搜索面板（搜索 + 网站导航）
hamburgerMenu       汉堡菜单（排序设置 + 偏移设置）
managementPanel     引擎管理中心（增删改查 + 自动识别）
appInitializer      应用初始化（作用域检测 + 页面事件监听）
```

9 个模块均为独立对象，通过共享的 `appState`、`CLASS_NAMES`、`STORAGE_KEYS`、`DEFAULT_CONFIG` 常量协调。

## 许可

[MIT License](LICENSE)

## 作者

晚风知我意
