/**
 * UI 组件基类
 * 提供组件创建、生命周期管理和事件处理的基础框架
 */

class Component {
    /**
     * 创建组件实例
     * @param {Object} options - 组件配置选项
     * @param {string} options.id - 组件唯一标识符
     * @param {string} options.className - 组件 CSS 类名
     * @param {string|Function} options.template - HTML 模板字符串或返回 HTML 的函数
     * @param {Object} options.data - 组件数据
     * @param {Object} options.methods - 组件方法
     * @param {Object} options.events - 事件绑定配置 {selector: {eventType: handler}}
     * @param {Function} options.onMount - 组件挂载后的回调
     * @param {Function} options.onUnmount - 组件卸载前的回调
     */
    constructor(options = {}) {
        this.id = options.id || `component-${Date.now()}-${Math.random()}`;
        this.className = options.className || '';
        this.template = options.template || '';
        this.data = options.data || {};
        this.methods = options.methods || {};
        this.events = options.events || {};
        this.onMount = options.onMount;
        this.onUnmount = options.onUnmount;

        // 内部状态
        this.element = null;
        this.isMounted = false;
        this._eventListeners = [];

        // 绑定方法上下文
        this._bindMethods();
    }

    /**
     * 绑定所有方法的上下文到组件实例
     * @private
     */
    _bindMethods() {
        for (const [key, method] of Object.entries(this.methods)) {
            if (typeof method === 'function') {
                this.methods[key] = method.bind(this);
            }
        }
    }

    /**
     * 渲染组件 HTML
     * @returns {string} HTML 字符串
     */
    render() {
        if (typeof this.template === 'function') {
            return this.template(this.data);
        }
        return this.template;
    }

    /**
     * 创建 DOM 元素
     * @returns {HTMLElement} 组件 DOM 元素
     */
    createElement() {
        const html = this.render();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html.trim();
        const element = tempDiv.firstChild;

        // 设置组件属性
        if (this.id) {
            element.id = this.id;
        }
        if (this.className) {
            element.classList.add(...this.className.split(' '));
        }

        return element;
    }

    /**
     * 挂载组件到 DOM
     * @param {HTMLElement} parentElement - 父元素
     * @returns {HTMLElement} 挂载后的组件元素
     */
    mount(parentElement) {
        if (this.isMounted) {
            console.warn(`Component ${this.id} is already mounted`);
            return this.element;
        }

        this.element = this.createElement();
        parentElement.appendChild(this.element);
        this._attachEventListeners();
        this.isMounted = true;

        // 调用挂载回调
        if (typeof this.onMount === 'function') {
            this.onMount.call(this);
        }

        return this.element;
    }

    /**
     * 卸载组件
     */
    unmount() {
        if (!this.isMounted) {
            console.warn(`Component ${this.id} is not mounted`);
            return;
        }

        // 调用卸载回调
        if (typeof this.onUnmount === 'function') {
            this.onUnmount.call(this);
        }

        this._detachEventListeners();
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
        this.isMounted = false;
    }

    /**
     * 附加事件监听器
     * @private
     */
    _attachEventListeners() {
        for (const [selector, events] of Object.entries(this.events)) {
            const elements = selector === 'self'
                ? [this.element]
                : this.element.querySelectorAll(selector);

            for (const element of elements) {
                for (const [eventType, handler] of Object.entries(events)) {
                    const boundHandler = handler.bind(this);
                    element.addEventListener(eventType, boundHandler);
                    this._eventListeners.push({ element, eventType, handler: boundHandler });
                }
            }
        }
    }

    /**
     * 移除事件监听器
     * @private
     */
    _detachEventListeners() {
        for (const { element, eventType, handler } of this._eventListeners) {
            element.removeEventListener(eventType, handler);
        }
        this._eventListeners = [];
    }

    /**
     * 更新组件数据并重新渲染
     * @param {Object} newData - 新数据
     * @param {boolean} rerender - 是否重新渲染 DOM (默认为 true)
     */
    updateData(newData, rerender = true) {
        this.data = { ...this.data, ...newData };
        if (rerender && this.isMounted) {
            this.rerender();
        }
    }

    /**
     * 重新渲染组件
     */
    rerender() {
        if (!this.isMounted) {
            console.warn(`Component ${this.id} is not mounted`);
            return;
        }

        this._detachEventListeners();
        const newElement = this.createElement();
        this.element.parentNode.replaceChild(newElement, this.element);
        this.element = newElement;
        this._attachEventListeners();
    }

    /**
     * 获取组件内的元素
     * @param {string} selector - CSS 选择器
     * @returns {HTMLElement|null}
     */
    querySelector(selector) {
        if (!this.element) return null;
        return this.element.querySelector(selector);
    }

    /**
     * 获取组件内的多个元素
     * @param {string} selector - CSS 选择器
     * @returns {NodeList}
     */
    querySelectorAll(selector) {
        if (!this.element) return [];
        return this.element.querySelectorAll(selector);
    }

    /**
     * 显示组件
     */
    show() {
        if (this.element) {
            this.element.style.display = '';
        }
    }

    /**
     * 隐藏组件
     */
    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }

    /**
     * 切换组件显示/隐藏
     */
    toggle() {
        if (this.element) {
            this.element.style.display = this.element.style.display === 'none' ? '' : 'none';
        }
    }

    /**
     * 添加 CSS 类
     * @param {string} className - 类名
     */
    addClass(className) {
        if (this.element) {
            this.element.classList.add(...className.split(' '));
        }
    }

    /**
     * 移除 CSS 类
     * @param {string} className - 类名
     */
    removeClass(className) {
        if (this.element) {
            this.element.classList.remove(...className.split(' '));
        }
    }

    /**
     * 切换 CSS 类
     * @param {string} className - 类名
     */
    toggleClass(className) {
        if (this.element) {
            this.element.classList.toggle(className);
        }
    }

    /**
     * 设置元素属性
     * @param {string} name - 属性名
     * @param {*} value - 属性值
     */
    setAttribute(name, value) {
        if (this.element) {
            this.element.setAttribute(name, value);
        }
    }

    /**
     * 获取元素属性
     * @param {string} name - 属性名
     * @returns {string|null}
     */
    getAttribute(name) {
        if (this.element) {
            return this.element.getAttribute(name);
        }
        return null;
    }

    /**
     * 设置元素样式
     * @param {Object} styles - 样式对象 {property: value}
     */
    setStyle(styles) {
        if (this.element) {
            Object.assign(this.element.style, styles);
        }
    }

    /**
     * 触发自定义事件
     * @param {string} eventName - 事件名称
     * @param {*} detail - 事件详情
     */
    emit(eventName, detail) {
        if (this.element) {
            const event = new CustomEvent(eventName, { detail });
            this.element.dispatchEvent(event);
        }
    }

    /**
     * 监听自定义事件
     * @param {string} eventName - 事件名称
     * @param {Function} handler - 事件处理函数
     */
    on(eventName, handler) {
        if (this.element) {
            this.element.addEventListener(eventName, handler);
        }
    }

    /**
     * 移除自定义事件监听
     * @param {string} eventName - 事件名称
     * @param {Function} handler - 事件处理函数
     */
    off(eventName, handler) {
        if (this.element) {
            this.element.removeEventListener(eventName, handler);
        }
    }

    /**
     * 销毁组件
     */
    destroy() {
        this.unmount();
        this.data = null;
        this.methods = null;
        this.events = null;
    }
}

// 导出 (兼容 CommonJS 和 ES Module)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Component;
}
