<template>
  <div class="thought-chain">
    <div class="mb-2 flex items-center">
      <button
        @click="toggleThoughtChain"
        class="flex items-center text-xs text-blue-600 hover:text-blue-800 focus:outline-none"
      >
        <svg
          :class="['h-4 w-4 mr-1 transition-transform', isExpanded ? 'rotate-90' : '']"
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
        {{ isExpanded ? "隐藏思维链" : "查看思维链" }}
      </button>
    </div>

    <div
      v-if="isExpanded"
      class="thought-chain-content bg-gray-50 border border-gray-200 rounded-md p-3 mb-2 text-sm text-gray-700 overflow-auto"
      :class="{ 'animate-fade-in': isExpanded }"
    >
      <div v-html="formattedThoughtChain"></div>
    </div>
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
  max-height: 300px;
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
