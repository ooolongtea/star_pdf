<template>
  <div
    class="fixed inset-0 z-20 overflow-y-auto"
    aria-labelledby="model-selection-modal-title"
    role="dialog"
    aria-modal="true"
  >
    <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
      <div
        class="fixed inset-0 bg-gray-600 bg-opacity-50 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
        @click="$emit('cancel')"
      ></div>

      <div
        class="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
      >
        <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div class="sm:flex sm:items-start">
            <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
              <h3
                class="text-lg leading-6 font-medium text-gray-900"
                id="model-selection-modal-title"
              >
                选择模型创建新对话
              </h3>
              <div class="mt-4">
                <ModelSelectorPanel
                  v-model="selectedModel"
                  :options="modelOptions"
                  @change="onModelChange"
                  @close="onConfirm"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
          <button
            type="button"
            @click="onConfirm"
            class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
          >
            创建对话
          </button>
          <button
            type="button"
            @click="$emit('cancel')"
            class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from "vue";
import { useStore } from "vuex";
import ModelSelectorPanel from "./ModelSelectorPanel.vue";

export default {
  name: "ModelSelectionModal",
  components: {
    ModelSelectorPanel,
  },
  emits: ["select", "cancel"],
  setup(props, { emit }) {
    const store = useStore();
    const selectedModel = ref("qwen:qwen-max");

    // 从Vuex获取模型选项
    const modelOptions = computed(() => {
      return store.getters["chat/getModelOptions"];
    });

    // 模型变更
    const onModelChange = (model) => {
      console.log("在ModelSelectionModal中选择模型:", model);
      selectedModel.value = model;
    };

    // 确认选择
    const onConfirm = () => {
      console.log("确认选择模型:", selectedModel.value);
      emit("select", selectedModel.value);
    };

    return {
      selectedModel,
      modelOptions,
      onModelChange,
      onConfirm,
    };
  },
};
</script>

<style scoped>
/* 添加动画效果 */
.fixed.inset-0 {
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.transform {
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
