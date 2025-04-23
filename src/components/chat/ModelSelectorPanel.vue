<template>
  <div class="model-selector-panel">
    <!-- 面板标题 -->
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-lg font-medium text-gray-900">选择模型</h3>
      <button
        @click="$emit('close')"
        class="text-gray-400 hover:text-gray-500 focus:outline-none"
      >
        <svg
          class="h-5 w-5"
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

    <!-- 搜索框 -->
    <div class="mb-4">
      <div class="relative rounded-md shadow-sm">
        <div
          class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
        >
          <svg
            class="h-5 w-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            ></path>
          </svg>
        </div>
        <input
          type="text"
          v-model="searchQuery"
          class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out"
          placeholder="搜索模型..."
        />
      </div>
    </div>

    <!-- 模型分组列表 -->
    <div class="overflow-y-auto max-h-96 pr-1">
      <!-- 已配置API密钥的厂商 -->
      <div v-if="configuredProviders.length > 0" class="mb-6">
        <h4
          class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2"
        >
          已配置密钥
        </h4>

        <div class="space-y-2">
          <div
            v-for="provider in configuredProviders"
            :key="provider.id"
            class="p-3 rounded-lg border transition-all duration-200 cursor-pointer hover:shadow-md border-gray-200 hover:border-blue-200"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center">
                <span class="w-3 h-3 rounded-full bg-green-500 mr-2"></span>
                <h5 class="text-sm font-medium text-gray-900">
                  {{ provider.name }}
                </h5>
              </div>
              <button
                @click.stop="toggleProviderModels(provider.id)"
                class="text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                <svg
                  class="h-5 w-5 transform transition-transform duration-200"
                  :class="{
                    'rotate-180': expandedProviders.includes(provider.id),
                  }"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                  ></path>
                </svg>
              </button>
            </div>

            <!-- 厂商的模型列表 -->
            <div
              v-if="expandedProviders.includes(provider.id)"
              class="mt-2 space-y-2 pl-5 border-l-2 border-gray-100"
            >
              <div
                v-for="model in provider.models"
                :key="model.id"
                @click="selectModel(`${provider.id}:${model.id}`)"
                class="p-2 rounded-md transition-all duration-200 cursor-pointer hover:bg-gray-50"
                :class="[
                  selectedModel === `${provider.id}:${model.id}`
                    ? 'bg-blue-50 border border-blue-200'
                    : '',
                ]"
              >
                <div class="flex items-center justify-between">
                  <h6 class="text-sm font-medium text-gray-800">
                    {{ model.name }}
                  </h6>
                  <span
                    v-if="selectedModel === `${provider.id}:${model.id}`"
                    class="text-blue-500"
                  >
                    <svg
                      class="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clip-rule="evenodd"
                      ></path>
                    </svg>
                  </span>
                </div>
                <p class="mt-1 text-xs text-gray-500">
                  {{ model.description }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 未配置API密钥的厂商 -->
      <div v-if="unconfiguredProviders.length > 0" class="mb-6">
        <h4
          class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2"
        >
          未配置密钥
        </h4>

        <div class="space-y-2">
          <div
            v-for="provider in unconfiguredProviders"
            :key="provider.id"
            class="p-3 rounded-lg border transition-all duration-200 cursor-pointer hover:shadow-md border-gray-200 hover:border-blue-200"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center">
                <span class="w-3 h-3 rounded-full bg-gray-300 mr-2"></span>
                <h5 class="text-sm font-medium text-gray-900">
                  {{ provider.name }}
                </h5>
              </div>
              <button
                @click.stop="toggleProviderModels(provider.id)"
                class="text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                <svg
                  class="h-5 w-5 transform transition-transform duration-200"
                  :class="{
                    'rotate-180': expandedProviders.includes(provider.id),
                  }"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                  ></path>
                </svg>
              </button>
            </div>

            <!-- 厂商的模型列表 -->
            <div
              v-if="expandedProviders.includes(provider.id)"
              class="mt-2 space-y-2 pl-5 border-l-2 border-gray-100"
            >
              <div
                v-for="model in provider.models"
                :key="model.id"
                @click="selectModel(`${provider.id}:${model.id}`)"
                class="p-2 rounded-md transition-all duration-200 cursor-pointer hover:bg-gray-50"
                :class="[
                  selectedModel === `${provider.id}:${model.id}`
                    ? 'bg-blue-50 border border-blue-200'
                    : '',
                ]"
              >
                <div class="flex items-center justify-between">
                  <h6 class="text-sm font-medium text-gray-800">
                    {{ model.name }}
                  </h6>
                  <span
                    v-if="selectedModel === `${provider.id}:${model.id}`"
                    class="text-blue-500"
                  >
                    <svg
                      class="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clip-rule="evenodd"
                      ></path>
                    </svg>
                  </span>
                </div>
                <p class="mt-1 text-xs text-gray-500">
                  {{ model.description }}
                </p>
              </div>
            </div>

            <div class="mt-2 flex items-center justify-between">
              <span class="text-xs text-gray-500">未配置API密钥</span>
              <a
                href="/api-keys"
                class="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                @click.stop
              >
                前往配置
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from "vue";
import { useStore } from "vuex";
import { modelProviders } from "../../config/modelConfig";

export default {
  name: "ModelSelectorPanel",
  props: {
    modelValue: {
      type: String,
      default: "qwen:qwen-max",
    },
    options: {
      type: Array,
      required: true,
    },
  },
  emits: ["update:modelValue", "change", "close"],
  setup(props, { emit }) {
    const store = useStore();
    const selectedModel = ref(props.modelValue);
    const searchQuery = ref("");
    const expandedProviders = ref([]);
    const apiKeys = ref([]);

    // 获取用户的API密钥
    const fetchApiKeys = async () => {
      try {
        const response = await fetch("/api/users/api-keys", {
          headers: {
            Authorization: `Bearer ${store.getters["auth/getToken"]}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            apiKeys.value = data.data.apiKeys;
          }
        }
      } catch (error) {
        console.error("获取API密钥失败:", error);
      }
    };

    // 检查是否有特定厂商的API密钥
    const hasApiKey = (providerId) => {
      return apiKeys.value.some(
        (key) => key.model_name === providerId && key.is_active
      );
    };

    // 监听props变化
    watch(
      () => props.modelValue,
      (newValue) => {
        selectedModel.value = newValue;
      }
    );

    // 过滤厂商和模型
    const filteredProviders = computed(() => {
      return modelProviders.filter((provider) => {
        // 如果没有搜索查询，返回所有厂商
        if (!searchQuery.value) return true;

        const query = searchQuery.value.toLowerCase();

        // 检查厂商名称是否匹配
        if (provider.name.toLowerCase().includes(query)) return true;

        // 检查厂商的模型是否匹配
        return provider.models.some(
          (model) =>
            model.name.toLowerCase().includes(query) ||
            (model.description &&
              model.description.toLowerCase().includes(query))
        );
      });
    });

    // 已配置API密钥的厂商
    const configuredProviders = computed(() => {
      return filteredProviders.value
        .filter((provider) => hasApiKey(provider.id))
        .sort((a, b) => a.name.localeCompare(b.name));
    });

    // 未配置API密钥的厂商
    const unconfiguredProviders = computed(() => {
      return filteredProviders.value
        .filter((provider) => !hasApiKey(provider.id))
        .sort((a, b) => a.name.localeCompare(b.name));
    });

    // 切换厂商模型展开状态
    const toggleProviderModels = (providerId) => {
      const index = expandedProviders.value.indexOf(providerId);
      if (index === -1) {
        expandedProviders.value.push(providerId);
      } else {
        expandedProviders.value.splice(index, 1);
      }
    };

    // 选择模型
    const selectModel = (value) => {
      console.log("在ModelSelectorPanel中选择模型:", value);
      selectedModel.value = value;

      // 先触发模型变更事件
      emit("change", value);

      // 然后更新模型值
      emit("update:modelValue", value);

      // 最后关闭面板
      setTimeout(() => {
        emit("close");
      }, 100);
    };

    onMounted(() => {
      fetchApiKeys();

      // 如果当前选中的是旧格式，转换为新格式
      if (selectedModel.value && !selectedModel.value.includes(":")) {
        const providerId = selectedModel.value;
        const provider = modelProviders.find((p) => p.id === providerId);
        if (provider && provider.models.length > 0) {
          const modelId = provider.models[0].id;
          selectedModel.value = `${providerId}:${modelId}`;
        }
      }

      // 展开当前选中模型的厂商
      if (selectedModel.value && selectedModel.value.includes(":")) {
        const [providerId] = selectedModel.value.split(":");
        expandedProviders.value.push(providerId);
      }
    });

    return {
      selectedModel,
      searchQuery,
      expandedProviders,
      configuredProviders,
      unconfiguredProviders,
      selectModel,
      toggleProviderModels,
      hasApiKey,
    };
  },
};
</script>

<style scoped>
.model-selector-panel {
  @apply bg-white rounded-lg shadow-xl p-4 w-full max-w-md;
}

/* 自定义滚动条 */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  @apply bg-gray-100 rounded;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  @apply bg-gray-300 rounded;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  @apply bg-gray-400;
}

/* 添加动画效果 */
.model-selector-panel {
  animation: fadeIn 0.2s ease-out;
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
