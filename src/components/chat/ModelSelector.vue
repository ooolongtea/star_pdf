<template>
  <div class="relative">
    <div
      @click="toggleDropdown"
      class="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md shadow-sm transition-colors duration-200 ease-in-out bg-white text-gray-700 cursor-pointer flex items-center justify-between"
    >
      <span>{{ selectedModelLabel }}</span>
      <svg
        class="h-5 w-5 text-gray-400"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
          clip-rule="evenodd"
        />
      </svg>
    </div>

    <!-- 下拉菜单 -->
    <div
      v-if="isOpen"
      class="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm max-h-60"
      style="max-height: 300px; overflow-y: auto"
    >
      <!-- 厂商列表 -->
      <div
        v-for="provider in providers"
        :key="provider.id"
        class="provider-group"
      >
        <!-- 厂商标题 -->
        <div
          class="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-gray-100"
          :class="{ 'bg-gray-50': expandedProvider === provider.id }"
          @click="toggleProvider(provider.id)"
        >
          <div class="flex items-center">
            <!-- 厂商图标 -->
            <span
              class="w-2 h-2 rounded-full mr-2"
              :class="hasApiKey(provider.id) ? 'bg-green-500' : 'bg-gray-300'"
              :title="
                hasApiKey(provider.id) ? '已配置API密钥' : '未配置API密钥'
              "
            ></span>
            <span class="font-medium">{{ provider.name }}</span>
          </div>
          <svg
            class="h-4 w-4 text-gray-400 transform transition-transform duration-200"
            :class="{ 'rotate-180': expandedProvider === provider.id }"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clip-rule="evenodd"
            />
          </svg>
        </div>

        <!-- 模型列表 -->
        <div v-if="expandedProvider === provider.id" class="pl-6 pr-3 py-1">
          <div
            v-for="model in provider.models"
            :key="model.id"
            class="py-1 px-2 cursor-pointer rounded hover:bg-blue-50 flex items-center"
            :class="{ 'bg-blue-100': isModelSelected(provider.id, model.id) }"
            @click="selectModel(provider.id, model.id)"
          >
            <span class="text-sm">{{ model.name }}</span>
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
  name: "ModelSelector",
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
  emits: ["update:modelValue", "change"],
  setup(props, { emit }) {
    const store = useStore();
    const selectedModel = ref(props.modelValue);
    const isOpen = ref(false);
    const expandedProvider = ref(null);
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

    // 计算所有厂商
    const providers = computed(() => {
      return modelProviders.sort((a, b) => {
        // 已配置API密钥的厂商排在前面
        const aHasKey = hasApiKey(a.id);
        const bHasKey = hasApiKey(b.id);

        if (aHasKey && !bHasKey) return -1;
        if (!aHasKey && bHasKey) return 1;
        return 0;
      });
    });

    // 计算选中的模型标签
    const selectedModelLabel = computed(() => {
      if (!selectedModel.value) return "选择模型";

      const [providerId, modelId] = selectedModel.value.split(":");
      const provider = modelProviders.find((p) => p.id === providerId);
      if (!provider) return selectedModel.value;

      const model = provider.models.find((m) => m.id === modelId);
      if (!model) return provider.name;

      return `${provider.name} - ${model.name}`;
    });

    // 切换下拉菜单
    const toggleDropdown = () => {
      isOpen.value = !isOpen.value;

      // 如果打开下拉菜单，展开当前选中的厂商
      if (isOpen.value && selectedModel.value) {
        const [providerId] = selectedModel.value.split(":");
        expandedProvider.value = providerId;
      }
    };

    // 切换厂商展开状态
    const toggleProvider = (providerId) => {
      expandedProvider.value =
        expandedProvider.value === providerId ? null : providerId;
    };

    // 选择模型
    const selectModel = (providerId, modelId) => {
      const newValue = `${providerId}:${modelId}`;
      console.log("在ModelSelector中选择模型:", newValue);
      selectedModel.value = newValue;
      emit("update:modelValue", newValue);
      emit("change", newValue);
      isOpen.value = false;
    };

    // 检查模型是否被选中
    const isModelSelected = (providerId, modelId) => {
      return selectedModel.value === `${providerId}:${modelId}`;
    };

    // 监听props变化
    watch(
      () => props.modelValue,
      (newValue) => {
        selectedModel.value = newValue;
      }
    );

    // 点击外部关闭下拉菜单
    const handleClickOutside = (event) => {
      if (isOpen.value && !event.target.closest(".relative")) {
        isOpen.value = false;
      }
    };

    onMounted(() => {
      fetchApiKeys();
      document.addEventListener("click", handleClickOutside);

      // 如果当前选中的是旧格式，转换为新格式
      if (selectedModel.value && !selectedModel.value.includes(":")) {
        const providerId = selectedModel.value;
        const provider = modelProviders.find((p) => p.id === providerId);
        if (provider && provider.models.length > 0) {
          const modelId = provider.models[0].id;
          selectedModel.value = `${providerId}:${modelId}`;
          emit("update:modelValue", selectedModel.value);
        }
      }
    });

    return {
      selectedModel,
      selectedModelLabel,
      isOpen,
      providers,
      expandedProvider,
      toggleDropdown,
      toggleProvider,
      selectModel,
      isModelSelected,
      hasApiKey,
    };
  },
};
</script>

<style scoped>
/* 自定义下拉菜单样式 */
.provider-group {
  border-bottom: 1px solid #f3f4f6;
}

.provider-group:last-child {
  border-bottom: none;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 4px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #ccc;
}

/* 添加过渡效果 */
.rotate-180 {
  transform: rotate(180deg);
}
</style>
