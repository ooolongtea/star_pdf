<template>
  <div 
    :class="[
      'mb-4 flex', 
      message.role === 'user' ? 'justify-end' : 'justify-start',
      message.isError ? 'opacity-70' : ''
    ]"
  >
    <div 
      :class="[
        'max-w-3/4 rounded-lg px-4 py-2 shadow-sm',
        message.role === 'user' 
          ? 'bg-blue-600 text-white' 
          : 'bg-white text-gray-800 border border-gray-200',
        message.isLoading ? 'animate-pulse' : ''
      ]"
      style="max-width: 85%;"
    >
      <div v-if="message.isLoading" class="flex items-center space-x-1">
        <div class="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
        <div class="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
        <div class="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
      </div>
      <div v-else>
        <div v-if="message.isError" class="text-red-500">
          <svg class="inline-block h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
          {{ message.content }}
        </div>
        <div v-else class="whitespace-pre-wrap" v-html="formattedContent"></div>
      </div>
      <div 
        v-if="!message.isLoading" 
        class="text-xs mt-1 opacity-70"
        :class="message.role === 'user' ? 'text-blue-100' : 'text-gray-500'"
      >
        {{ formatTime(message.created_at) }}
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

export default {
  name: 'MessageItem',
  props: {
    message: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    // 格式化消息内容，支持Markdown
    const formattedContent = computed(() => {
      if (!props.message.content) return '';
      
      // 使用marked解析Markdown
      const rawHtml = marked(props.message.content);
      
      // 使用DOMPurify清理HTML，防止XSS攻击
      return DOMPurify.sanitize(rawHtml);
    });
    
    // 格式化时间
    const formatTime = (timestamp) => {
      if (!timestamp) return '';
      
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    
    return {
      formattedContent,
      formatTime
    };
  }
};
</script>

<style scoped>
/* 添加样式以支持Markdown渲染 */
:deep(pre) {
  @apply bg-gray-100 p-2 rounded my-2 overflow-x-auto;
}

:deep(code) {
  @apply bg-gray-100 px-1 py-0.5 rounded text-sm;
}

:deep(pre code) {
  @apply bg-transparent p-0;
}

:deep(a) {
  @apply text-blue-600 hover:underline;
}

:deep(ul), :deep(ol) {
  @apply pl-5 my-2;
}

:deep(ul) {
  @apply list-disc;
}

:deep(ol) {
  @apply list-decimal;
}

:deep(blockquote) {
  @apply border-l-4 border-gray-300 pl-4 italic my-2;
}

:deep(table) {
  @apply border-collapse border border-gray-300 my-2;
}

:deep(th), :deep(td) {
  @apply border border-gray-300 px-2 py-1;
}

:deep(th) {
  @apply bg-gray-100;
}
</style>
