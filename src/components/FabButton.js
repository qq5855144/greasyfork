/**
 * 浮动按钮组件 (FAB - Floating Action Button)
 * 支持拖拽、位置记忆、徽章显示等功能
 */

class FabButton extends Component {
    constructor(options = {}) {
        const config = {
            id: 'rainbowFabContainer',
            className: 'rainbow-fab-container',
            template: function() {
                return `
                    <div class="rainbow-fab" id="rainbowFab">
                        <div class="rainbow-fab-inner">
                            <div class="rainbow-fab-icon">
                                ${IconSystem.getIconString('collector')}
                            </div>
                        </div>
                        <div class="rainbow-fab-badge" id="fabBadge">0</div>
                    </div>
                `;
            },
            data: {
                badgeCount: 0,
                isDragging: false,
                startX: 0,
                startY: 0,
                startLeft: 0,
                startTop: 0,
                hasMoved: false,
                dragStartTime: 0,
                touchTimer: null
            },
            methods: {
                // 初始化拖拽功能
                initDrag: function() {
                    const fab = this.querySelector('#rainbowFab');
                    if (!fab) return;

                    fab.addEventListener('mousedown', this._handleDragStart.bind(this));
                    fab.addEventListener('touchstart', this._handleDragStart.bind(this));
                },

                // 处理拖拽开始
                _handleDragStart: function(e) {
                    this.data.isDragging = true;
                    this.data.dragStartTime = Date.now();
                    this.data.startX = e.clientX || e.touches[0].clientX;
                    this.data.startY = e.clientY || e.touches[0].clientY;

                    const rect = this.element.getBoundingClientRect();
                    this.data.startLeft = rect.left;
                    this.data.startTop = rect.top;
                    this.data.hasMoved = false;

                    // 长按检测
                    this.data.touchTimer = setTimeout(() => {
                        if (!this.data.hasMoved) {
                            this.data.isDragging = true;
                        }
                    }, CONFIG.ui.touchDelay);

                    document.addEventListener('mousemove', this._handleDragMove.bind(this));
                    document.addEventListener('touchmove', this._handleDragMove.bind(this), { passive: false });
                    document.addEventListener('mouseup', this._handleDragEnd.bind(this));
                    document.addEventListener('touchend', this._handleDragEnd.bind(this));

                    e.preventDefault();
                },

                // 处理拖拽移动
                _handleDragMove: function(e) {
                    if (!this.data.isDragging) return;

                    this.data.hasMoved = true;
                    e.preventDefault();

                    const clientX = e.clientX || e.touches[0].clientX;
                    const clientY = e.clientY || e.touches[0].clientY;

                    const newLeft = this.data.startLeft + clientX - this.data.startX;
                    const newTop = this.data.startTop + clientY - this.data.startY;

                    this.element.style.left = `${newLeft}px`;
                    this.element.style.top = `${newTop}px`;
                    this.element.style.right = 'auto';
                    this.element.style.bottom = 'auto';
                },

                // 处理拖拽结束
                _handleDragEnd: function(e) {
                    if (this.data.touchTimer) {
                        clearTimeout(this.data.touchTimer);
                        this.data.touchTimer = null;
                    }

                    if (!this.data.isDragging) {
                        if (Date.now() - this.data.dragStartTime < CONFIG.ui.touchDelay) {
                            this.emit('click');
                        }
                        return;
                    }

                    // 如果没有移动，视为点击
                    if (!this.data.hasMoved) {
                        this.emit('click');
                    } else {
                        // 保存位置
                        this._savePosition();
                    }

                    this.data.isDragging = false;
                    this.element.style.transition = '';

                    document.removeEventListener('mousemove', this._handleDragMove.bind(this));
                    document.removeEventListener('touchmove', this._handleDragMove.bind(this));
                    document.removeEventListener('mouseup', this._handleDragEnd.bind(this));
                    document.removeEventListener('touchend', this._handleDragEnd.bind(this));
                },

                // 保存按钮位置到本地存储
                _savePosition: function() {
                    const domain = location.hostname.replace(/\\./g, '-');
                    const positionKey = `${CONFIG.storage.prefix}${CONFIG.storage.positionKey}_${domain}`;
                    const rect = this.element.getBoundingClientRect();
                    GM_setValue(positionKey, { x: rect.left, y: rect.top });
                },

                // 恢复保存的位置
                restorePosition: function() {
                    const domain = location.hostname.replace(/\\./g, '-');
                    const positionKey = `${CONFIG.storage.prefix}${CONFIG.storage.positionKey}_${domain}`;
                    const savedPosition = GM_getValue(positionKey);

                    if (savedPosition) {
                        this.element.style.left = `${savedPosition.x}px`;
                        this.element.style.top = `${savedPosition.y}px`;
                    } else {
                        // 默认位置：右下角
                        this.element.style.right = `${CONFIG.ui.positionOffset}px`;
                        this.element.style.bottom = `${CONFIG.ui.positionOffset}px`;
                    }
                },

                // 设置徽章数字
                setBadgeCount: function(count) {
                    this.data.badgeCount = count;
                    const badge = this.querySelector('#fabBadge');
                    if (badge) {
                        badge.textContent = count;
                        badge.style.display = count > 0 ? 'flex' : 'none';
                    }
                },

                // 获取徽章数字
                getBadgeCount: function() {
                    return this.data.badgeCount;
                },

                // 增加徽章数字
                incrementBadge: function(amount = 1) {
                    this.setBadgeCount(this.data.badgeCount + amount);
                },

                // 减少徽章数字
                decrementBadge: function(amount = 1) {
                    this.setBadgeCount(Math.max(0, this.data.badgeCount - amount));
                },

                // 显示脉冲动画
                showPulse: function() {
                    this.addClass('pulse');
                    setTimeout(() => this.removeClass('pulse'), 600);
                },

                // 显示加载状态
                setLoading: function(isLoading) {
                    const fab = this.querySelector('#rainbowFab');
                    if (fab) {
                        if (isLoading) {
                            fab.classList.add('loading');
                        } else {
                            fab.classList.remove('loading');
                        }
                    }
                }
            },
            onMount: function() {
                this.methods.initDrag.call(this);
                this.methods.restorePosition.call(this);
            }
        };

        // 合并用户配置
        super({ ...config, ...options });
    }
}

// 导出 (兼容 CommonJS 和 ES Module)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FabButton;
}
