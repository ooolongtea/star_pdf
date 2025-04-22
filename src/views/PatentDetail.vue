<template>
  <div class="container mx-auto px-4 py-8">
    <!-- 加载状态 -->
    <div v-if="loading" class="flex justify-center items-center py-12">
      <svg class="animate-spin h-10 w-10 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>
    
    <div v-else-if="!patent" class="text-center py-12">
      <p class="text-gray-500">专利不存在或无权访问</p>
      <router-link to="/extraction" class="mt-4 inline-block text-blue-600 hover:text-blue-800">
        返回提取页面
      </router-link>
    </div>
    
    <div v-else>
      <!-- 专利信息 -->
      <div class="bg-white shadow-md rounded-lg overflow-hidden mb-8">
        <div class="p-6">
          <div class="flex justify-between items-start">
            <div>
              <h1 class="text-2xl font-bold text-gray-900">{{ patent.title }}</h1>
              <p v-if="patent.patent_number" class="mt-1 text-sm text-gray-600">
                专利号: {{ patent.patent_number }}
              </p>
              <p class="mt-1 text-sm text-gray-600">
                上传时间: {{ formatDate(patent.created_at) }}
              </p>
              <div class="mt-2">
                <span 
                  class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full"
                  :class="{
                    'bg-yellow-100 text-yellow-800': patent.status === 'pending',
                    'bg-blue-100 text-blue-800': patent.status === 'processing',
                    'bg-green-100 text-green-800': patent.status === 'completed',
                    'bg-red-100 text-red-800': patent.status === 'failed'
                  }"
                >
                  {{ getStatusText(patent.status) }}
                </span>
              </div>
            </div>
            <div class="flex space-x-2">
              <button 
                v-if="patent.status === 'pending' || patent.status === 'failed'"
                @click="processPatent"
                class="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                处理
              </button>
              <button 
                @click="deletePatent"
                class="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                删除
              </button>
            </div>
          </div>
          
          <div v-if="patent.description" class="mt-4 text-sm text-gray-700">
            <h3 class="font-medium text-gray-900">描述</h3>
            <p class="mt-1">{{ patent.description }}</p>
          </div>
          
          <!-- 处理进度 -->
          <div v-if="currentTask && (currentTask.status === 'pending' || currentTask.status === 'running')" class="mt-6">
            <h3 class="text-sm font-medium text-gray-900">处理进度</h3>
            <div class="mt-2">
              <div class="relative pt-1">
                <div class="flex mb-2 items-center justify-between">
                  <div>
                    <span class="text-xs font-semibold inline-block text-blue-600">
                      {{ Math.round(currentTask.progress) }}%
                    </span>
                  </div>
                  <div class="text-right">
                    <span class="text-xs font-semibold inline-block text-blue-600">
                      {{ currentTask.message }}
                    </span>
                  </div>
                </div>
                <div class="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
                  <div 
                    :style="{ width: `${currentTask.progress}%` }" 
                    class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 提取结果标签页 -->
      <div class="bg-white shadow-md rounded-lg overflow-hidden">
        <div class="border-b border-gray-200">
          <nav class="-mb-px flex">
            <button
              @click="activeTab = 'molecules'"
              class="py-4 px-6 text-center border-b-2 font-medium text-sm"
              :class="activeTab === 'molecules' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
            >
              分子 ({{ moleculesTotal }})
            </button>
            <button
              @click="activeTab = 'reactions'"
              class="py-4 px-6 text-center border-b-2 font-medium text-sm"
              :class="activeTab === 'reactions' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
            >
              反应 ({{ reactionsTotal }})
            </button>
          </nav>
        </div>
        
        <div class="p-6">
          <!-- 分子标签页内容 -->
          <div v-if="activeTab === 'molecules'">
            <div v-if="molecules.length === 0" class="text-center py-8 text-gray-500">
              {{ patent.status === 'completed' ? '未找到分子结构' : '尚未处理或处理中' }}
            </div>
            <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div 
                v-for="molecule in molecules" 
                :key="molecule.id"
                class="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
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
                </div>
              </div>
            </div>
          </div>
          
          <!-- 反应标签页内容 -->
          <div v-if="activeTab === 'reactions'">
            <div v-if="reactions.length === 0" class="text-center py-8 text-gray-500">
              {{ patent.status === 'completed' ? '未找到反应结构' : '尚未处理或处理中' }}
            </div>
            <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div 
                v-for="reaction in reactions" 
                :key="reaction.id"
                class="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <div class="p-4">
                  <h3 class="text-sm font-medium text-gray-900 mb-2">反应 ID: {{ reaction.id }}</h3>
                  
                  <div class="mb-3 h-40 flex items-center justify-center bg-gray-100 rounded">
                    <img 
                      v-if="reaction.image_path" 
                      :src="getImageUrl(reaction.image_path)" 
                      alt="反应结构" 
                      class="max-h-full max-w-full object-contain"
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
import { ref, computed, onMounted, watch } from 'vue';
import { useStore } from 'vuex';
import { useRouter, useRoute } from 'vue-router';

export default {
  name: 'PatentDetail',
  setup() {
    const store = useStore();
    const router = useRouter();
    const route = useRoute();
    
    const loading = computed(() => store.getters.isLoading);
    const patent = computed(() => store.getters['patents/getCurrentPatent']);
    const molecules = computed(() => store.getters['patents/getMolecules']);
    const reactions = computed(() => store.getters['patents/getReactions']);
    const moleculesTotal = computed(() => store.getters['patents/getMoleculesTotal']);
    const reactionsTotal = computed(() => store.getters['patents/getReactionsTotal']);
    const currentTask = computed(() => store.getters['extraction/getCurrentTask']);
    
    const activeTab = ref('molecules');
    
    // 获取专利详情
    const fetchPatentDetails = async () => {
      try {
        const patentId = route.params.id;
        await store.dispatch('patents/fetchPatentDetails', patentId);
      } catch (error) {
        console.error('获取专利详情失败:', error);
      }
    };
    
    // 监听路由参数变化
    watch(() => route.params.id, () => {
      fetchPatentDetails();
    });
    
    // 组件挂载时获取专利详情
    onMounted(() => {
      fetchPatentDetails();
    });
    
    // 格式化日期
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleString();
    };
    
    // 获取状态文本
    const getStatusText = (status) => {
      const statusMap = {
        pending: '待处理',
        processing: '处理中',
        completed: '已完成',
        failed: '失败'
      };
      return statusMap[status] || status;
    };
    
    // 获取图像URL
    const getImageUrl = (path) => {
      // 这里应该根据实际情况处理图像URL
      // 如果是相对路径，可能需要添加API基础URL
      return path;
    };
    
    // 处理专利
    const processPatent = async () => {
      try {
        if (!patent.value) return;
        
        await store.dispatch('extraction/processPatent', patent.value.id);
      } catch (error) {
        console.error('处理专利失败:', error);
      }
    };
    
    // 删除专利
    const deletePatent = async () => {
      if (!patent.value) return;
      
      if (!confirm('确定要删除此专利吗？此操作不可撤销。')) {
        return;
      }
      
      try {
        const result = await store.dispatch('patents/deletePatent', patent.value.id);
        if (result.success) {
          router.push('/extraction');
        }
      } catch (error) {
        console.error('删除专利失败:', error);
      }
    };
    
    return {
      loading,
      patent,
      molecules,
      reactions,
      moleculesTotal,
      reactionsTotal,
      currentTask,
      activeTab,
      formatDate,
      getStatusText,
      getImageUrl,
      processPatent,
      deletePatent
    };
  }
};
</script>
