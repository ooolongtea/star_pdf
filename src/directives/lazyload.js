/**
 * 图片懒加载指令
 * 使用方法：v-lazyload="图片URL"
 */

// 加载中的占位图片（蓝色加载动画）
const LOADING_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNDUiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzNiODJmNiIgc3Ryb2tlLXdpZHRoPSI1Ij4KICAgIDxhbmltYXRlVHJhbnNmb3JtCiAgICAgIGF0dHJpYnV0ZU5hbWU9InRyYW5zZm9ybSIKICAgICAgdHlwZT0icm90YXRlIgogICAgICBmcm9tPSIwIDUwIDUwIgogICAgICB0bz0iMzYwIDUwIDUwIgogICAgICBkdXI9IjFzIgogICAgICByZXBlYXRDb3VudD0iaW5kZWZpbml0ZSIvPgogIDwvY2lyY2xlPgo8L3N2Zz4K';

// 加载失败的占位图片（红色错误图标）
const ERROR_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iODAiIGhlaWdodD0iODAiIHJ4PSI1IiByeT0iNSIgZmlsbD0iI2YzZjRmNiIgLz4KICA8cGF0aCBkPSJNMzUgNDVMNjUgNzVNNjUgNDVMMzUgNzUiIHN0cm9rZT0iI2VmNDQ0NCIgc3Ryb2tlLXdpZHRoPSI1IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPC9zdmc+Cg==';

// 设置图片的src属性
const setSrc = (el, binding) => {
  // 保存原始图片URL
  el.setAttribute('data-src', binding.value);
  
  // 设置加载中的占位图片
  el.setAttribute('src', LOADING_IMAGE);
};

// 处理图片加载错误
const onError = (el) => {
  // 设置加载失败的占位图片
  el.setAttribute('src', ERROR_IMAGE);
  el.classList.add('lazy-error');
};

// 处理图片加载成功
const onLoad = (el) => {
  el.classList.add('lazy-loaded');
};

// 创建观察者实例
const createObserver = (el) => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      // 当图片进入视口
      if (entry.isIntersecting) {
        // 获取原始图片URL
        const dataSrc = el.getAttribute('data-src');
        if (dataSrc) {
          // 创建一个新的图片对象来预加载
          const img = new Image();
          img.src = dataSrc;
          
          // 图片加载成功时
          img.onload = () => {
            el.setAttribute('src', dataSrc);
            onLoad(el);
          };
          
          // 图片加载失败时
          img.onerror = () => onError(el);
          
          // 停止观察该元素
          observer.unobserve(el);
        }
      }
    });
  }, {
    // 配置选项
    rootMargin: '0px 0px 50px 0px', // 提前50px加载
    threshold: 0.1 // 当10%的元素可见时触发
  });
  
  // 开始观察元素
  observer.observe(el);
  
  // 将观察者实例保存到元素上，以便后续清理
  el._observer = observer;
};

// 导出指令
export default {
  // 在绑定元素的父组件挂载时调用
  mounted(el, binding) {
    // 设置初始src
    setSrc(el, binding);
    
    // 创建观察者
    createObserver(el);
  },
  
  // 在包含组件的VNode更新时调用
  updated(el, binding) {
    // 如果值发生变化，更新src
    if (binding.oldValue !== binding.value) {
      setSrc(el, binding);
      
      // 如果已经有观察者，先停止观察
      if (el._observer) {
        el._observer.unobserve(el);
      }
      
      // 重新创建观察者
      createObserver(el);
    }
  },
  
  // 在绑定元素的父组件卸载时调用
  unmounted(el) {
    // 清理观察者
    if (el._observer) {
      el._observer.unobserve(el);
      el._observer = null;
    }
  }
};
