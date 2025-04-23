<template>
  <div class="relative">
    <select
      v-model="selectedModel"
      class="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
      @change="onChange"
    >
      <option v-for="option in modelOptions" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
      <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </div>
  </div>
</template>

<script>
import { ref, watch } from 'vue';

export default {
  name: 'ModelSelector',
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
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    const selectedModel = ref(props.modelValue);
    
    // 监听props变化
    watch(() => props.modelValue, (newValue) => {
      selectedModel.value = newValue;
    });
    
    // 监听内部值变化
    watch(selectedModel, (newValue) => {
      emit('update:modelValue', newValue);
    });
    
    // 处理变更事件
    const onChange = () => {
      emit('change', selectedModel.value);
    };
    
    return {
      selectedModel,
      modelOptions: props.options,
      onChange
    };
  }
};
</script>
