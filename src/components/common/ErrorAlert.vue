<template>
  <transition
    enter-active-class="transform ease-out duration-300 transition"
    enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
    enter-to-class="translate-y-0 opacity-100 sm:translate-x-0"
    leave-active-class="transition ease-in duration-100"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="error"
      class="fixed inset-0 flex items-end justify-center px-4 py-6 pointer-events-none sm:p-6 sm:items-start sm:justify-end z-50"
    >
      <div
        class="max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-red-500 ring-opacity-5 overflow-hidden"
      >
        <div class="p-4">
          <div class="flex items-start">
            <div class="flex-shrink-0">
              <!-- 错误图标 -->
              <svg
                class="h-6 w-6 text-red-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div class="ml-3 w-0 flex-1 pt-0.5">
              <p class="text-sm font-medium text-gray-900">错误</p>
              <div
                v-if="isHTML"
                class="mt-1 text-sm text-gray-500"
                v-html="errorMessage"
              ></div>
              <p v-else class="mt-1 text-sm text-gray-500">
                {{ errorMessage }}
              </p>
            </div>
            <div class="ml-4 flex-shrink-0 flex">
              <button
                @click="close"
                class="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <span class="sr-only">关闭</span>
                <svg
                  class="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fill-rule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script>
import { computed } from "vue";
import { useStore } from "vuex";

export default {
  name: "ErrorAlert",
  setup() {
    const store = useStore();
    const error = computed(() => store.getters.getError);

    // 检查错误消息是否包含HTML
    const isHTML = computed(() => {
      if (typeof error.value === "object" && error.value !== null) {
        return error.value.isHTML === true;
      }
      return typeof error.value === "string" && error.value.includes("<");
    });

    // 获取错误消息文本
    const errorMessage = computed(() => {
      if (typeof error.value === "object" && error.value !== null) {
        return error.value.message || error.value;
      }
      return error.value;
    });

    // 关闭错误提示
    const close = () => {
      store.dispatch("clearError");
    };

    return {
      error,
      isHTML,
      errorMessage,
      close,
    };
  },
};
</script>
