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
    }
});

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
