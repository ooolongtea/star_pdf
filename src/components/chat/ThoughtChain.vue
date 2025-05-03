<template>
  <div class="thought-chain">
    <div class="mb-1 flex items-center">
      <button
        @click="toggleThoughtChain"
        class="flex items-center text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-0.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        <svg
          :class="[
            'h-4 w-4 mr-1 transition-transform duration-200',
            isExpanded ? 'rotate-90' : '',
          ]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5l7 7-7 7"
          ></path>
        </svg>
        <span class="flex items-center">
          <svg
            class="w-3.5 h-3.5 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            ></path>
          </svg>
          {{ isExpanded ? "隐藏思考过程" : "查看思考过程" }}
        </span>
      </button>
    </div>

    <transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 max-h-0"
      enter-to-class="opacity-100 max-h-[500px]"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 max-h-[500px]"
      leave-to-class="opacity-0 max-h-0"
    >
      <div
        v-if="isExpanded"
        class="thought-chain-content bg-blue-50 border border-blue-100 rounded-md p-2 mb-1 text-sm text-gray-700 overflow-auto"
      >
        <div
          class="thought-chain-header mb-1 pb-0.5 border-b border-blue-100 text-blue-700 font-medium flex items-center"
        >
          <svg
            class="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            ></path>
          </svg>
          思考过程
        </div>
        <div v-html="formattedThoughtChain" class="thought-chain-body"></div>
      </div>
    </transition>
  </div>
</template>

<script>
import { ref, computed } from "vue";
import { marked } from "marked";
import DOMPurify from "dompurify";

export default {
  name: "ThoughtChain",
  props: {
    thoughtChain: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const isExpanded = ref(false);

    // 切换思维链显示状态
    const toggleThoughtChain = () => {
      isExpanded.value = !isExpanded.value;
    };

    // 格式化思维链内容（支持Markdown）
    const formattedThoughtChain = computed(() => {
      if (!props.thoughtChain) return "";

      // 使用marked解析Markdown
      const rawHtml = marked(props.thoughtChain);

      // 使用DOMPurify清理HTML，防止XSS攻击
      return DOMPurify.sanitize(rawHtml);
    });

    return {
      isExpanded,
      toggleThoughtChain,
      formattedThoughtChain,
    };
  },
};
</script>

<style scoped>
.thought-chain-content {
  max-height: 500px;
  overflow-y: auto;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.thought-chain-body {
  line-height: 1.5;
}

/* 思考链内部的Markdown样式 */
.thought-chain-body :deep(p) {
  margin-bottom: 0.5rem;
}

.thought-chain-body :deep(ul),
.thought-chain-body :deep(ol) {
  padding-left: 1.5rem;
  margin-bottom: 0.5rem;
}

.thought-chain-body :deep(ul) {
  list-style-type: disc;
}

.thought-chain-body :deep(ol) {
  list-style-type: decimal;
}

.thought-chain-body :deep(li) {
  margin-bottom: 0.25rem;
}

.thought-chain-body :deep(pre) {
  background-color: rgba(255, 255, 255, 0.7);
  border-radius: 0.25rem;
  padding: 0.5rem;
  margin: 0.5rem 0;
  overflow-x: auto;
}

.thought-chain-body :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  font-size: 0.875rem;
  background-color: rgba(255, 255, 255, 0.7);
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
}

.thought-chain-body :deep(pre code) {
  background-color: transparent;
  padding: 0;
}
</style>
