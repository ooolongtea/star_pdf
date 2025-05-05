<template>
  <div class="optimization-prompt">
    <div
      class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md"
    >
      <!-- 卡片头部 -->
      <div
        class="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 px-5 py-3 border-b border-blue-100/50"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-base font-medium text-gray-800 flex items-center">
            <svg
              class="w-5 h-5 mr-2 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              ></path>
            </svg>
            <span>AI优化设置</span>
          </h3>
          <div class="flex items-center">
            <div
              class="flex items-center bg-white/80 rounded-md px-2 py-1 border border-blue-100 shadow-sm"
            >
              <span class="text-xs text-gray-500 mr-2">模型:</span>
              <div class="relative">
                <select
                  v-model="selectedModel"
                  class="appearance-none bg-transparent text-blue-600 text-xs font-medium pr-6 focus:outline-none cursor-pointer border-0"
                  :disabled="disabled"
                  style="
                    box-shadow: none;
                    appearance: none;
                    -webkit-appearance: none;
                    -moz-appearance: none;
                  "
                >
                  <option value="qwen-turbo-latest">Qwen-Turbo</option>
                  <option value="qwen3-235b-a22b">Qwen3-235B-A22B</option>
                  <option value="qwen-max">Qwen-Max</option>
                  <option value="qwq-plus">QwQ-Plus</option>
                </select>
                <div
                  class="pointer-events-none absolute inset-y-0 right-0 flex items-center"
                >
                  <svg
                    class="fill-current h-3 w-3 text-blue-500"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                  >
                    <path
                      d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 卡片内容 -->
      <div class="p-5">
        <!-- 自定义提示词按钮 -->
        <div
          v-if="!showCustomPrompt"
          class="flex justify-between items-center mb-4"
        >
          <div class="flex items-center">
            <div
              class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white shadow-sm"
            >
              <svg
                class="w-4 h-4"
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
            </div>
            <div class="ml-3">
              <p class="text-sm font-medium text-gray-700">准备就绪</p>
              <p class="text-xs text-gray-500">使用默认优化提示词</p>
            </div>
          </div>
          <button
            @click="toggleCustomPrompt"
            class="px-3 py-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all shadow-sm"
            :disabled="disabled"
          >
            <span class="flex items-center">
              <svg
                class="w-3 h-3 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                ></path>
              </svg>
              自定义提示词
            </span>
          </button>
        </div>

        <!-- 自定义提示词内容 -->
        <div v-if="showCustomPrompt" class="mb-4">
          <div class="flex justify-between items-center mb-2">
            <span class="text-sm font-medium text-gray-700 flex items-center">
              <svg
                class="w-4 h-4 mr-1.5 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                ></path>
              </svg>
              自定义优化提示词
            </span>
            <button
              @click="toggleCustomPrompt"
              class="p-1 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100"
              :disabled="disabled"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
            </button>
          </div>
          <div class="relative">
            <textarea
              v-model="localPrompt"
              class="w-full h-28 px-4 py-3 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent resize-none transition-all"
              placeholder="输入优化提示词..."
              :disabled="disabled"
            ></textarea>
            <div class="absolute bottom-3 right-3">
              <button
                @click="resetPrompt"
                class="px-2 py-1 text-xs text-gray-500 bg-white border border-gray-200 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-gray-300 shadow-sm transition-all"
                :disabled="disabled"
              >
                重置默认
              </button>
            </div>
          </div>
        </div>

        <!-- 优化按钮 -->
        <div class="flex justify-end">
          <button
            @click="$emit('optimize')"
            class="px-5 py-2 text-sm text-white bg-gradient-to-r from-blue-500 to-indigo-500 rounded-md hover:from-blue-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-blue-300 shadow-md transition-all flex items-center"
            :disabled="disabled"
            :class="{ 'opacity-70 cursor-not-allowed': disabled }"
          >
            <svg
              class="w-4 h-4 mr-2"
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
    modelName: {
      type: String,
      default: "qwen3-235b-a22b",
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["update:modelValue", "update:modelName", "optimize"],
  setup(props, { emit }) {
    const localPrompt = ref(props.modelValue);
    const selectedModel = ref(props.modelName || "qwen3-235b-a22b");
    const showCustomPrompt = ref(false);

    // 默认提示词 - 使用提示词.txt中的内容
    const defaultPrompt = `请根据以下指南修正OCR引起的错误，确保文本连贯并符合原始内容：

1. 修正OCR引起的拼写错误和错误：
   - 修正常见的OCR错误（例如，'rn' 被误读为 'm'）
   - 使用上下文和常识进行修正
   - 只修正明显的错误，不要不必要的修改内容
   - 不要添加额外的句号或其他不必要的标点符号

2. 保持原始结构：
   - 保留所有标题和子标题

3. 保留原始内容：
   - 保留原始文本中的所有重要信息
   - 不要添加任何原始文本中没有的新信息
   - 保留段落之间的换行符

4. 保持连贯性：
   - 确保内容与前文顺畅连接
   - 适当处理在句子中间开始或结束的文本

5. 修正行内公式：
   - 去除行内公式前后多余的空格
   - 修正公式中的OCR错误
   - 确保公式能够通过KaTeX渲染

6. 修正全角字符
    - 修正全角标点符号为半角标点符号
    - 修正全角字母为半角字母
    - 修正全角数字为半角数字

请仅返回修正后的文本，保留所有原始格式，包括换行符。不要包含任何介绍、解释或元数据。`;

    // 监听props变化
    watch(
      () => props.modelValue,
      (newValue) => {
        localPrompt.value = newValue;
      }
    );

    // 监听模型名称props变化
    watch(
      () => props.modelName,
      (newValue) => {
        if (newValue) {
          selectedModel.value = newValue;
        }
      }
    );

    // 监听本地值变化
    watch(localPrompt, (newValue) => {
      emit("update:modelValue", newValue);
    });

    // 监听选择的模型变化
    watch(selectedModel, (newValue) => {
      emit("update:modelName", newValue);
      console.log("模型已更改为:", newValue);
    });

    // 切换显示自定义提示词
    const toggleCustomPrompt = () => {
      showCustomPrompt.value = !showCustomPrompt.value;
    };

    // 重置为默认提示词
    const resetPrompt = () => {
      localPrompt.value = defaultPrompt;
    };

    return {
      localPrompt,
      selectedModel,
      showCustomPrompt,
      toggleCustomPrompt,
      resetPrompt,
    };
  },
};
</script>

<style scoped>
/* 自定义样式 */
.optimization-prompt {
  transition: all 0.3s ease;
  margin-bottom: 1.5rem;
}

/* 卡片悬浮效果 */
.optimization-prompt > div {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.optimization-prompt > div:hover {
  box-shadow: 0 8px 20px -4px rgba(59, 130, 246, 0.15);
  transform: translateY(-1px);
}

/* 按钮微交互 */
button {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  overflow: hidden;
}

button:not(:disabled):active {
  transform: scale(0.98);
}

button:not(:disabled)::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 5px;
  height: 5px;
  background: rgba(255, 255, 255, 0.4);
  opacity: 0;
  border-radius: 100%;
  transform: scale(1, 1) translate(-50%, -50%);
  transform-origin: 50% 50%;
}

button:not(:disabled):focus::after {
  animation: ripple 0.6s ease-out;
}

/* 禁用状态样式 */
textarea:disabled,
select:disabled,
button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* 文本区域样式增强 */
textarea {
  transition: all 0.3s ease;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
}

textarea:focus {
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05),
    0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* 模型选择器样式增强 */
select {
  transition: all 0.2s ease;
  border: none;
  outline: none;
  box-shadow: none;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-color: transparent;
}

/* 修复Firefox中select的黑框问题 */
select::-moz-focus-inner {
  border: 0;
}

/* 修复IE中select的黑框问题 */
select:focus::-ms-value {
  background-color: transparent;
  color: inherit;
}

/* 修复Chrome中select的黑框问题 */
select:focus {
  outline: none;
  box-shadow: none;
}

/* 动画效果 */
@keyframes ripple {
  0% {
    opacity: 0.4;
    transform: scale(0.01, 0.01) translate(-50%, -50%);
  }
  50% {
    opacity: 0.2;
    transform: scale(20, 20) translate(-50%, -50%);
  }
  100% {
    opacity: 0;
    transform: scale(40, 40) translate(-50%, -50%);
  }
}

/* 渐入动画 */
.mb-4,
.mb-3,
.mb-2 {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
