<template>
  <div class="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
    <div class="p-4">
      <h3 class="text-sm font-medium text-gray-900 mb-2">反应 ID: {{ reaction.id }}</h3>
      
      <div class="mb-3 h-40 flex items-center justify-center bg-gray-100 rounded">
        <img 
          v-if="reaction.image_path" 
          :src="getImageUrl(reaction.image_path)" 
          alt="反应结构" 
          class="max-h-full max-w-full object-contain"
          @click="showFullImage"
        />
        <div v-else class="text-gray-400 text-sm">无图像</div>
      </div>
      
      <div class="text-xs text-gray-700 mb-2">
        <div class="font-medium">反应物 SMILES:</div>
        <div class="overflow-x-auto whitespace-nowrap pb-1">
          {{ reaction.reactants_smiles || '无' }}
        </div>
      </div>
      
      <div class="text-xs text-gray-700 mb-2">
        <div class="font-medium">产物 SMILES:</div>
        <div class="overflow-x-auto whitespace-nowrap pb-1">
          {{ reaction.product_smiles || '无' }}
        </div>
      </div>
      
      <div v-if="reaction.conditions" class="text-xs text-gray-700">
        <div class="font-medium">反应条件:</div>
        <div>{{ reaction.conditions }}</div>
      </div>
      
      <div class="mt-3 flex justify-end space-x-2">
        <button 
          @click="copyReactants" 
          class="text-xs text-blue-600 hover:text-blue-800 flex items-center"
        >
          <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
          </svg>
          复制反应物
        </button>
        <button 
          @click="copyProduct" 
          class="text-xs text-blue-600 hover:text-blue-800 flex items-center"
        >
          <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
          </svg>
          复制产物
        </button>
      </div>
    </div>
    
    <!-- 全屏图像模态框 -->
    <div 
      v-if="showModal && reaction.image_path" 
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-75"
      @click="showModal = false"
    >
      <div class="max-w-4xl max-h-full bg-white rounded-lg overflow-hidden" @click.stop>
        <div class="flex justify-between items-center p-4 border-b">
          <h3 class="text-lg font-medium text-gray-900">反应结构</h3>
          <button @click="showModal = false" class="text-gray-400 hover:text-gray-500">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div class="p-4 flex items-center justify-center">
          <img 
            :src="getImageUrl(reaction.image_path)" 
            alt="反应结构" 
            class="max-w-full max-h-[70vh] object-contain"
          />
        </div>
        <div class="p-4 border-t">
          <div class="text-sm text-gray-700 mb-2">
            <div class="font-medium">反应物 SMILES:</div>
            <div class="break-all">{{ reaction.reactants_smiles || '无' }}</div>
          </div>
          <div class="text-sm text-gray-700">
            <div class="font-medium">产物 SMILES:</div>
            <div class="break-all">{{ reaction.product_smiles || '无' }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue';
import { useStore } from 'vuex';

export default {
  name: 'ReactionCard',
  props: {
    reaction: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    const store = useStore();
    const showModal = ref(false);
    
    // 获取图像URL
    const getImageUrl = (path) => {
      // 这里应该根据实际情况处理图像URL
      // 如果是相对路径，可能需要添加API基础URL
      return path;
    };
    
    // 显示全屏图像
    const showFullImage = () => {
      if (props.reaction.image_path) {
        showModal.value = true;
      }
    };
    
    // 复制反应物SMILES
    const copyReactants = () => {
      if (!props.reaction.reactants_smiles) return;
      
      // 复制到剪贴板
      navigator.clipboard.writeText(props.reaction.reactants_smiles)
        .then(() => {
          store.dispatch('setNotification', {
            type: 'success',
            message: '反应物SMILES已复制到剪贴板'
          });
        })
        .catch(err => {
          console.error('复制失败:', err);
          store.dispatch('setError', '复制反应物SMILES失败');
        });
    };
    
    // 复制产物SMILES
    const copyProduct = () => {
      if (!props.reaction.product_smiles) return;
      
      // 复制到剪贴板
      navigator.clipboard.writeText(props.reaction.product_smiles)
        .then(() => {
          store.dispatch('setNotification', {
            type: 'success',
            message: '产物SMILES已复制到剪贴板'
          });
        })
        .catch(err => {
          console.error('复制失败:', err);
          store.dispatch('setError', '复制产物SMILES失败');
        });
    };
    
    return {
      showModal,
      getImageUrl,
      showFullImage,
      copyReactants,
      copyProduct
    };
  }
};
</script>
