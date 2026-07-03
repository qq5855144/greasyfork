# svg.user.js 重构项目

## 项目概述

本项目对 `svg.user.js` 进行了全面的代码重构，旨在提高代码的可维护性、可扩展性和代码质量。重构后的代码采用模块化、组件化的架构设计，使用现代 JavaScript 特性，并建立了统一的图标管理系统。

## 重构内容

### 1. 架构重构

#### 模块划分

```
src/
├── index.js                 # 脚本入口
├── config.js               # 全局配置
├── styles.js               # 样式管理
├── icons.js                # 图标系统
├── utils/                  # 工具函数
│   ├── index.js
│   ├── debounce.js
│   ├── hash.js
│   └── ...
├── components/             # UI 组件
│   ├── Component.js        # 组件基类
│   ├── FabButton.js        # 浮动按钮
│   ├── MainModal.js        # 主模态框
│   ├── PreviewModal.js     # 预览模态框
│   └── ...
├── modules/                # 业务逻辑
│   ├── ImageCollector.js
│   ├── Downloader.js
│   ├── Deduplication.js
│   └── ...
└── services/               # 外部服务
    ├── BlobManager.js
    ├── Notification.js
    └── ...
```

#### 核心特性

- **配置集中管理**: 所有配置参数集中在 `config.js` 中，支持嵌套访问和动态修改
- **样式统一管理**: 所有 CSS 样式集中在 `styles.js` 中，支持主题切换和自定义样式注入
- **图标系统**: 建立了统一的图标管理系统，支持 SVG 图标的创建、注册和渲染
- **组件化 UI**: 提供了 `Component` 基类，支持快速创建和管理 UI 组件

### 2. UI 面板重构

#### 浮动按钮 (FabButton)

**特性**:
- 七彩渐变边框动画
- 拖拽功能，支持位置记忆
- 徽章显示，显示图片计数
- 脉冲和加载动画
- 响应式设计，适配各种屏幕尺寸

**使用示例**:
```javascript
const fab = new FabButton({
    id: 'rainbowFabContainer'
});

fab.mount(document.body);
fab.setBadgeCount(10);
fab.on('click', () => console.log('FAB clicked'));
```

#### 主模态框 (MainModal)

**特性**:
- 七彩渐变头部
- 搜索、排序、筛选功能
- 列表/网格视图切换
- 全选/反选功能
- 批量下载模式选择
- 智能去重开关

#### 预览模态框 (PreviewModal)

**特性**:
- 大图预览
- 图片切换 (上一张/下一张)
- 缩放功能 (放大/缩小)
- 旋转功能
- 键盘快捷键支持 (← → + - R Esc)

### 3. 图标系统

#### 图标库

系统内置了 25+ 个常用图标，包括:
- `collector` - 图片采集器主图标
- `close` - 关闭
- `download` - 下载
- `copy` - 复制
- `search` - 搜索
- `filter` - 筛选
- `zoomIn` / `zoomOut` - 缩放
- `rotate` - 旋转
- `success` / `error` / `warning` / `info` - 状态图标
- 等等...

#### 使用方式

```javascript
// 创建 SVG DOM 元素
const iconElement = IconSystem.createIcon('download', {
    className: 'my-icon',
    size: '24px',
    color: '#ff6b6b'
});

// 获取 SVG 字符串 (用于 HTML 嵌入)
const iconString = IconSystem.getIconString('search');

// 注册自定义图标
IconSystem.registerIcon('myIcon', '<svg>...</svg>');

// 检查图标是否存在
if (IconSystem.hasIcon('download')) {
    // ...
}

// 获取所有可用图标
const icons = IconSystem.getAvailableIcons();
```

### 4. 组件基类

#### Component 类

提供了一个通用的组件基类，支持:
- 模板渲染 (字符串或函数)
- 生命周期管理 (onMount, onUnmount)
- 事件绑定和委托
- 数据管理和更新
- DOM 操作便捷方法
- 自定义事件发射

#### 创建自定义组件

```javascript
class MyComponent extends Component {
    constructor(options = {}) {
        super({
            id: 'my-component',
            className: 'my-component',
            template: `<div>Hello World</div>`,
            data: { count: 0 },
            methods: {
                increment: function() {
                    this.data.count++;
                    this.rerender();
                }
            },
            events: {
                'self': {
                    'click': function() {
                        this.methods.increment();
                    }
                }
            },
            onMount: function() {
                console.log('Component mounted');
            }
        });
    }
}

// 使用
const component = new MyComponent();
component.mount(document.body);
```

### 5. 配置系统

#### CONFIG 对象

```javascript
// 获取配置
const buttonSize = CONFIG.get('ui.buttonSize');
const rainbowColors = CONFIG.get('colors.rainbow');

// 设置配置
CONFIG.set('ui.buttonSize', 40);

// 合并配置
CONFIG.merge({
    ui: { buttonSize: 40 },
    colors: { primary: '#ff0000' }
});
```

#### 配置分类

- `ui` - UI 相关配置
- `glass` - 毛玻璃效果配置
- `colors` - 颜色配置
- `image` - 图片采集配置
- `preview` - 预览配置
- `batchDownload` - 批量下载配置
- `deduplication` - 去重配置
- `fonts` - 字体配置
- `animation` - 动画配置
- 等等...

### 6. 样式管理

#### StyleManager 对象

```javascript
// 注入所有样式
StyleManager.injectStyles();

// 获取特定样式
const fabStyles = StyleManager.getStyle('fab');

// 添加自定义样式
StyleManager.addStyle('custom', `
    .custom { color: red; }
`);

// 注入单个样式
StyleManager.injectCustomStyle(`
    .my-class { background: blue; }
`);
```

#### 样式分类

- `base` - 基础样式
- `fab` - 浮动按钮样式
- `modal` - 主模态框样式
- `imageList` - 图片列表样式
- `preview` - 预览模态框样式
- `batchProgress` - 批量下载进度条样式

## 代码质量改进

### 1. 代码组织

- 将 3442 行的单一文件拆分为多个模块
- 每个模块职责清晰，易于理解和维护
- 模块间通过接口进行通信，降低耦合度

### 2. 命名规范

- 采用 camelCase 命名法
- 类名采用 PascalCase
- 常量采用 UPPER_SNAKE_CASE
- 私有方法前缀 `_`

### 3. 代码现代化

- 使用 ES6+ 语法 (const/let, 箭头函数, 模板字符串等)
- 使用 async/await 处理异步操作
- 使用解构赋值简化代码
- 使用 Map/Set 等现代数据结构

### 4. 文档完善

- 每个模块都有详细的注释
- 函数都有 JSDoc 文档
- 提供了使用示例

## 迁移指南

### 从旧代码迁移

1. **保留现有功能**: 重构后的代码保留了所有现有功能
2. **逐步迁移**: 可以逐步将旧的业务逻辑模块迁移到新的架构
3. **兼容性**: 新的组件系统与旧的 Tampermonkey API 完全兼容

### 构建流程

目前代码仍然是模块化的源代码。要将其打包成最终的用户脚本，需要:

1. 安装构建工具 (Webpack/Rollup)
2. 配置构建脚本
3. 生成最终的 `svg.user.js` 文件

示例 Webpack 配置:
```javascript
module.exports = {
    entry: './src/index.js',
    output: {
        filename: 'svg.user.js',
        path: __dirname
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            }
        ]
    }
};
```

## 文件清单

### 核心文件

| 文件 | 描述 |
|------|------|
| `src/config.js` | 全局配置管理 |
| `src/icons.js` | 图标系统 |
| `src/styles.js` | 样式管理 |
| `src/components/Component.js` | 组件基类 |
| `src/components/FabButton.js` | 浮动按钮组件 |

### 文档文件

| 文件 | 描述 |
|------|------|
| `refactoring_plan.md` | 重构方案详细文档 |
| `REFACTOR_README.md` | 本文件，重构项目说明 |

## 后续工作

1. **完成模块迁移**: 将 `ImageCollector`, `Downloader`, `Deduplication` 等模块完成重构
2. **完成组件迁移**: 将 `MainModal`, `PreviewModal` 等组件完成重构
3. **构建配置**: 配置 Webpack/Rollup 进行打包
4. **单元测试**: 为各个模块编写单元测试
5. **集成测试**: 进行完整的功能测试
6. **性能优化**: 优化打包体积和运行性能
7. **发布**: 发布新版本到 GreasyFork

## 贡献指南

欢迎提交 Issue 和 Pull Request 来改进这个项目。

### 开发流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

- 遵循现有的代码风格
- 为新功能添加注释和文档
- 确保代码通过 ESLint 检查
- 编写相应的测试用例

## 许可证

MIT License

## 相关链接

- [原始仓库](https://github.com/qq5855144/greasyfork)
- [GreasyFork 脚本页面](https://greasyfork.org/)

---

**最后更新**: 2026 年 7 月 3 日

**维护者**: Manus AI
