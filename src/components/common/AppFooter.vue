<template>
  <footer class="bg-white mt-12">
    <div class="container mx-auto px-4 py-8">
      <div class="border-t border-gray-200 pt-8">
        <div class="flex flex-col md:flex-row justify-between items-center">
          <div class="mb-4 md:mb-0">
            <p class="text-sm text-gray-500">
              &copy; {{ currentYear }} 专利化学式提取系统. 保留所有权利.
            </p>
          </div>
          <div class="flex space-x-6">
            <a href="#" class="text-gray-400 hover:text-gray-500">
              <span class="sr-only">关于我们</span>
              <span class="text-sm">关于我们</span>
            </a>
            <a href="#" class="text-gray-400 hover:text-gray-500">
              <span class="sr-only">隐私政策</span>
              <span class="text-sm">隐私政策</span>
            </a>
            <a href="#" class="text-gray-400 hover:text-gray-500">
              <span class="sr-only">使用条款</span>
              <span class="text-sm">使用条款</span>
            </a>
            <a href="#" class="text-gray-400 hover:text-gray-500">
              <span class="sr-only">联系我们</span>
              <span class="text-sm">联系我们</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>

<script>
import { computed } from 'vue';

export default {
  name: 'AppFooter',
  setup() {
    const currentYear = computed(() => new Date().getFullYear());
    
    return {
      currentYear
    };
  }
};
</script>
