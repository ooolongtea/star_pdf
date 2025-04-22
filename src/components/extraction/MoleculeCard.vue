<template>
  <div class="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
    <div class="p-4">
      <div class="flex justify-between items-start mb-2">
        <h3 class="text-sm font-medium text-gray-900">ID: {{ molecule.id }}</h3>
        <span v-if="molecule.coref" class="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
          {{ molecule.coref }}
        </span>
      </div>
      
      <div class="mb-3 h-32 flex items-center justify-center bg-gray-100 rounded">
        <img 
          v-if="molecule.visualization_path" 
          :src="getImageUrl(molecule.visualization_path)" 
          alt="分子结构" 
          class="max-h-full max-w-full object-contain"
          @click="showFullImage"
        />
        <div v-else class="text-gray-400 text-sm">无可视化图像</div>
      </div>
      
      <div class="text-xs text-gray-700 mb-2">
        <div class="font-medium">SMILES:</div>
        <div class="overflow-x-auto whitespace-nowrap pb-1">
          {{ molecule.compound_smiles || '无' }}
        </div>
      </div>
      
      <div v-if="molecule.inchi" class="text-xs text-gray-700 mb-2">
        <div class="font-medium">InChI:</div>
        <div class="overflow-x-auto whitespace-nowrap pb-1">
          {{ molecule.inchi }}
        </div>
      </div>
      
      <div v-if="molecule.inchi_key" class="text-xs text-gray-700">
        <div class="font-medium">InChI Key:</div>
        <div>{{ molecule.inchi_key }}</div>
      </div>
      
      <div class="mt-3 flex justify-end">
        <button 
          @click="copySmiles" 
          class="text-xs text-blue-600 hover:text-blue-800 flex items-center"
        >
          <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
          </svg>
          复制SMILES
        </button>
      </div>
    </div>
    
    <!-- 全屏图像模态框 -->
    <div 
      v-if="showModal && molecule.visualization_path" 
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-75"
      @click="showModal = false"
    >
      <div class="max-w-4xl max-h-full bg-white rounded-lg overflow-hidden" @click.stop>
        <div class="flex justify-between items-center p-4 border-b">
          <h3 class="text-lg font-medium text-gray-900">分子结构</h3>
          <button @click="showModal = false" class="text-gray-400 hover:text-gray-500">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div class="p-4 flex items-center justify-center">
          <img 
            :src="getImageUrl(molecule.visualization_path)" 
            alt="分子结构" 
            class="max-w-full max-h-[70vh] object-contain"
          />
        </div>
        <div class="p-4 border-t">
          <div class="text-sm text-gray-700">
            <div class="font-medium">SMILES:</div>
            <div class="break-all">{{ molecule.compound_smiles || '无' }}</div>
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
  name: 'MoleculeCard',
  props: {
    molecule: {
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
      if (props.molecule.visualization_path) {
        showModal.value = true;
      }
    };
    
    // 复制SMILES
    const copySmiles = () => {
      if (!props.molecule.compound_smiles) return;
      
      // 复制到剪贴板
      navigator.clipboard.writeText(props.molecule.compound_smiles)
        .then(() => {
          store.dispatch('setNotification', {
            type: 'success',
            message: 'SMILES已复制到剪贴板'
          });
        })
        .catch(err => {
          console.error('复制失败:', err);
          store.dispatch('setError', '复制SMILES失败');
        });
    };
    
    return {
      showModal,
      getImageUrl,
      showFullImage,
      copySmiles
    };
  }
};
</script>
