<template>
  <div class="model-selector-panel">
    <!-- 面板标题 -->
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-lg font-medium text-gray-900">选择模型</h3>
      <button 
        @click="$emit('close')" 
        class="text-gray-400 hover:text-gray-500 focus:outline-none"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>

    <!-- 搜索框 -->
    <div class="mb-4">
      <div class="relative rounded-md shadow-sm">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
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
      <div v-for="(group, provider) in groupedModels" :key="provider" class="mb-6">
        <h4 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">{{ provider }}</h4>
        
        <div class="space-y-2">
          <div 
            v-for="model in group" 
            :key="model.value" 
            @click="selectModel(model.value)"
            class="p-3 rounded-lg border transition-all duration-200 cursor-pointer hover:shadow-md"
            :class="[
              selectedModel === model.value 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-blue-200'
            ]"
          >
            <div class="flex items-start">
              <!-- 模型图标 -->
              <div class="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-md bg-blue-100 text-blue-600">
                <svg v-if="provider === '通义千问'" class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                </svg>
                <svg v-else-if="provider === 'DeepSeek'" class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9h10v2H7z" />
                </svg>
                <svg v-else-if="provider === '百川'" class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
                </svg>
                <svg v-else class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
                </svg>
              </div>
              
              <!-- 模型信息 -->
              <div class="ml-3 flex-1">
                <div class="flex items-center justify-between">
                  <h5 class="text-sm font-medium text-gray-900">{{ model.label }}</h5>
                  <button 
                    @click.stop="toggleFavorite(model.value)" 
                    class="text-gray-400 hover:text-yellow-500 focus:outline-none"
                    :class="{ 'text-yellow-500': isFavorite(model.value) }"
                  >
                    <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path v-if="isFavorite(model.value)" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      <path v-else fill-rule="evenodd" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" clip-rule="evenodd" stroke="currentColor" stroke-width="1" />
                    </svg>
                  </button>
                </div>
                <p class="mt-1 text-xs text-gray-500">{{ getModelDescription(model.value) }}</p>
                <div class="mt-1 flex items-center">
                  <span class="text-xs font-medium text-gray-500">{{ getModelSize(model.value) }}</span>
                  <span class="mx-1 text-gray-300">•</span>
                  <span class="text-xs text-gray-500">{{ getModelVersion(model.value) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue';

export default {
  name: 'ModelSelectorPanel',
  props: {
    modelValue: {
      type: String,
      default: 'qwen'
    },
    options: {
      type: Array,
      required: true
    }
  },
  emits: ['update:modelValue', 'change', 'close'],
  setup(props, { emit }) {
    const selectedModel = ref(props.modelValue);
    const searchQuery = ref('');
    const favorites = ref(JSON.parse(localStorage.getItem('favoriteModels') || '[]'));
    
    // 监听props变化
    watch(() => props.modelValue, (newValue) => {
      selectedModel.value = newValue;
    });
    
    // 按提供商分组模型
    const groupedModels = computed(() => {
      const filtered = props.options.filter(option => 
        option.label.toLowerCase().includes(searchQuery.value.toLowerCase())
      );
      
      // 首先显示收藏的模型
      const favoriteModels = filtered.filter(model => favorites.value.includes(model.value));
      
      // 按提供商分组其他模型
      const groups = {};
      
      if (favoriteModels.length > 0) {
        groups['收藏'] = favoriteModels;
      }
      
      filtered.forEach(model => {
        // 根据模型值确定提供商
        let provider;
        if (model.value.includes('qwen')) {
          provider = '通义千问';
        } else if (model.value.includes('deepseek')) {
          provider = 'DeepSeek';
        } else if (model.value.includes('baichuan')) {
          provider = '百川';
        } else if (model.value.includes('chatglm')) {
          provider = '智谱';
        } else {
          provider = '其他';
        }
        
        // 如果模型已经在收藏中，不要重复显示
        if (favorites.value.includes(model.value) && groups['收藏']) {
          return;
        }
        
        if (!groups[provider]) {
          groups[provider] = [];
        }
        groups[provider].push(model);
      });
      
      return groups;
    });
    
    // 选择模型
    const selectModel = (value) => {
      selectedModel.value = value;
      emit('update:modelValue', value);
      emit('change', value);
      emit('close');
    };
    
    // 切换收藏状态
    const toggleFavorite = (value) => {
      const index = favorites.value.indexOf(value);
      if (index === -1) {
        favorites.value.push(value);
      } else {
        favorites.value.splice(index, 1);
      }
      localStorage.setItem('favoriteModels', JSON.stringify(favorites.value));
    };
    
    // 检查是否收藏
    const isFavorite = (value) => {
      return favorites.value.includes(value);
    };
    
    // 获取模型描述
    const getModelDescription = (value) => {
      const descriptions = {
        'qwen': '阿里云开发的大型语言模型，擅长中文理解和生成',
        'deepseek': '专注于深度学习和代码生成的大型语言模型',
        'baichuan': '国产开源大模型，在中文语境下表现优异',
        'chatglm': '清华开发的对话式大模型，轻量高效'
      };
      
      return descriptions[value] || '通用大型语言模型';
    };
    
    // 获取模型大小
    const getModelSize = (value) => {
      const sizes = {
        'qwen': '7B/14B/72B',
        'deepseek': '7B/67B',
        'baichuan': '7B/13B',
        'chatglm': '6B'
      };
      
      return sizes[value] || '未知';
    };
    
    // 获取模型版本
    const getModelVersion = (value) => {
      const versions = {
        'qwen': 'v1.5',
        'deepseek': 'v1.0',
        'baichuan': 'v2',
        'chatglm': 'v3'
      };
      
      return versions[value] || '最新版';
    };
    
    return {
      selectedModel,
      searchQuery,
      groupedModels,
      selectModel,
      toggleFavorite,
      isFavorite,
      getModelDescription,
      getModelSize,
      getModelVersion
    };
  }
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
