<template>
  <div class="optimization-prompt">
    <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100 p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-medium text-gray-800 flex items-center">
          <svg
            class="w-5 h-5 mr-2 text-blue-600"
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
          OCR优化提示词
        </h3>
        <div class="flex items-center">
          <span class="text-sm text-gray-600 mr-2">使用模型:</span>
          <div class="relative">
            <select
              v-model="selectedModel"
              class="appearance-none bg-white border border-gray-300 rounded-md py-1 px-3 pr-8 text-sm leading-tight focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              :disabled="disabled"
            >
              <option value="qwen3-235b-a22b">Qwen3-235B-A22B</option>
              <option value="qwen-max">Qwen-Max</option>
              <option value="qwq-plus">QwQ-Plus</option>
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div class="mb-3">
        <textarea
          v-model="localPrompt"
          class="w-full h-24 px-3 py-2 text-sm text-gray-700 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          placeholder="输入优化提示词..."
          :disabled="disabled"
        ></textarea>
      </div>
      <div class="flex justify-between items-center">
        <button
          @click="resetPrompt"
          class="px-3 py-1 text-sm text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
          :disabled="disabled"
        >
          重置为默认
        </button>
        <button
          @click="$emit('optimize')"
          class="px-4 py-2 text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-md hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm flex items-center"
          :disabled="disabled"
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
              d="M13 10V3L4 14h7v7l9-11h-7z"
            ></path>
          </svg>
          开始优化
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch } from "vue";

export default {
  name: "OptimizationPrompt",
  props: {
    modelValue: {
      type: String,
      required: true,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["update:modelValue", "optimize"],
  setup(props, { emit }) {
    const localPrompt = ref(props.modelValue);
    const selectedModel = ref("qwen3-235b-a22b");

    // 默认提示词
    const defaultPrompt =
      "请优化以下从PDF提取的文本内容，修复OCR错误，调整格式，使其更易阅读。保留原始信息的完整性，但提高文本的清晰度和结构性。特别注意修复化学式、数学公式和专业术语。";

    // 监听props变化
    watch(
      () => props.modelValue,
      (newValue) => {
        localPrompt.value = newValue;
      }
    );

    // 监听本地值变化
    watch(localPrompt, (newValue) => {
      emit("update:modelValue", newValue);
    });

    // 重置为默认提示词
    const resetPrompt = () => {
      localPrompt.value = defaultPrompt;
    };

    return {
      localPrompt,
      selectedModel,
      resetPrompt,
    };
  },
};
</script>

<style scoped>
/* 自定义样式 */
.optimization-prompt {
  transition: all 0.3s ease;
}

/* 禁用状态样式 */
textarea:disabled,
select:disabled,
button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
