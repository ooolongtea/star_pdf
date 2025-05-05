import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';
import axios from './plugins/axios';
import './assets/styles/main.css';

// 导入 v-md-editor 相关库
import VueMarkdownEditor from '@kangc/v-md-editor';
import '@kangc/v-md-editor/lib/style/base-editor.css';
// 导入主题
import vuepressTheme from '@kangc/v-md-editor/lib/theme/vuepress.js';
import '@kangc/v-md-editor/lib/theme/style/vuepress.css';
// 代码高亮
import Prism from 'prismjs';
// 导入代码高亮样式
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-csharp';
// 导入 github-markdown-css
import 'github-markdown-css';

// 配置 v-md-editor
VueMarkdownEditor.use(vuepressTheme, {
    Prism,
    // 可以在此处添加自定义配置
    codeHighlightExtensionMap: {
        vue: 'html',
        typescript: 'js'
    },
    // 减少ResizeObserver错误的配置
    config: {
        // 禁用自动调整高度
        autoHeightEnabled: false,
        // 禁用自动滚动
        autoScrollEnabled: false,
        // 禁用自动聚焦
        autofocus: false,
        // 禁用拖拽调整大小
        enableResizeObserver: false
    }
});

// 全局处理 ResizeObserver 错误
const originalResizeObserver = window.ResizeObserver;
window.ResizeObserver = class ResizeObserver extends originalResizeObserver {
    constructor(callback) {
        super((entries, observer) => {
            // 防止 ResizeObserver 循环错误
            window.requestAnimationFrame(() => {
                try {
                    if (!Array.isArray(entries)) return;
                    callback(entries, observer);
                } catch (e) {
                    if (e.message && e.message.includes('ResizeObserver')) {
                        console.log('已忽略ResizeObserver回调错误');
                    } else {
                        throw e;
                    }
                }
            });
        });
    }
};

// 添加全局错误处理器
window.addEventListener('error', (event) => {
    if (event.message && event.message.includes('ResizeObserver')) {
        event.stopImmediatePropagation();
        event.preventDefault();
        console.log('已忽略ResizeObserver错误');
        return false;
    }
}, true);

// 处理未捕获的Promise错误
window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && typeof event.reason.message === 'string' &&
        event.reason.message.includes('ResizeObserver')) {
        event.preventDefault();
        console.log('已忽略ResizeObserver Promise错误');
    }
});

// 定期检查并移除错误覆盖层
const removeErrorOverlay = () => {
    const overlay = document.getElementById('webpack-dev-server-client-overlay');
    if (overlay) {
        overlay.remove();
    }
};

// 每秒检查一次错误覆盖层
setInterval(removeErrorOverlay, 1000);

// 创建Vue应用
const app = createApp(App);

// 注册全局属性
app.config.globalProperties.$axios = axios;

// 使用插件
app.use(router);
app.use(store);
app.use(VueMarkdownEditor);

// 挂载应用
app.mount('#app');
