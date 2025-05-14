<template>
  <div class="pdf-processor">
    <div
      class="max-w-7xl mx-auto bg-white p-0 rounded-xl shadow-lg overflow-hidden"
    >
      <!-- 顶部导航栏 -->
      <div
        class="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 px-6 py-4 border-b border-blue-100/50 flex items-center justify-between"
      >
        <div class="flex items-center">
          <div
            class="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center text-white shadow-md transform transition-transform hover:scale-105"
          >
            <svg
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              ></path>
            </svg>
          </div>
          <div class="ml-4">
            <h1 class="text-xl font-semibold text-gray-800 tracking-tight">
              专利文档处理
            </h1>
            <p
              v-if="fileInfo"
              class="text-sm text-gray-500 mt-0.5 flex items-center"
            >
              <span
                class="inline-block w-2 h-2 rounded-full bg-green-400 mr-2"
              ></span>
              {{ fileInfo.originalFilename }}
            </p>
          </div>
        </div>
        <div class="flex space-x-3">
          <button
            @click="goBack"
            class="px-3 py-1.5 text-sm bg-white text-gray-600 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all flex items-center border border-gray-200 shadow-sm"
          >
            <svg
              class="w-4 h-4 mr-1.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              ></path>
            </svg>
            返回
          </button>
        </div>
      </div>

      <!-- 主要内容区域 -->
      <div class="p-6">
        <!-- 加载中状态 -->
        <div v-if="isLoading" class="flex justify-center py-12">
          <div class="flex flex-col items-center">
            <div class="relative">
              <div
                class="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"
              ></div>
              <div class="absolute inset-0 flex items-center justify-center">
                <div
                  class="h-8 w-8 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full opacity-70"
                ></div>
              </div>
            </div>
            <p class="mt-4 text-gray-600 font-medium">加载内容中...</p>
          </div>
        </div>

        <div v-else>
          <!-- 错误提示 -->
          <div
            v-if="error"
            class="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg shadow-sm mb-6"
          >
            <div class="flex items-center">
              <svg
                class="w-6 h-6 text-red-500 mr-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
              <p class="font-medium">加载失败</p>
            </div>
            <p class="text-sm mt-2 ml-9">{{ error }}</p>
          </div>

          <!-- 处理选项卡 -->
          <div class="mb-6 space-y-6">
            <!-- AI总结卡片 -->
            <div
              class="bg-white rounded-xl border border-purple-100 shadow-sm overflow-hidden transition-all hover:shadow-md"
            >
              <div
                class="bg-gradient-to-r from-purple-50 to-indigo-50 px-5 py-3 border-b border-purple-100 flex items-center justify-between"
              >
                <h3 class="font-medium text-purple-700 flex items-center">
                  <svg
                    class="w-4 h-4 mr-2 text-purple-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    ></path>
                  </svg>
                  专利信息总结
                </h3>
                <span
                  class="text-xs px-2 py-1 bg-purple-100 text-purple-600 rounded-full"
                  >AI总结内容</span
                >
              </div>
              <div class="p-5">
                <PdfSummary :fileId="fileId" />
              </div>
            </div>

            <!-- AI优化卡片 -->
            <div
              class="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden transition-all hover:shadow-md"
            >
              <div
                class="bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-3 border-b border-blue-100 flex items-center justify-between"
              >
                <h3 class="font-medium text-blue-700 flex items-center">
                  <svg
                    class="w-4 h-4 mr-2 text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    ></path>
                  </svg>
                  内容优化
                </h3>
                <span
                  class="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded-full"
                  >AI优化内容</span
                >
              </div>
              <div class="p-5">
                <div v-if="!isOptimizing" class="mb-6">
                  <OptimizationPrompt
                    v-model="optimizationPrompt"
                    v-model:modelName="selectedModel"
                    :disabled="isOptimizing"
                    @optimize="optimizeContent"
                  />
                </div>

                <!-- 优化处理中状态 - 在优化过程中显示 -->
                <div v-if="isOptimizing" class="mb-6">
                  <div
                    class="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden"
                  >
                    <div
                      class="bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-3 border-b border-blue-100"
                    >
                      <h3 class="font-medium text-blue-700 flex items-center">
                        <svg
                          class="w-4 h-4 mr-2 text-blue-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          ></path>
                        </svg>
                        AI优化处理中
                      </h3>
                    </div>
                    <div class="p-5">
                      <div class="mb-4">
                        <div class="flex justify-between mb-1">
                          <span class="text-sm font-medium text-blue-600">
                            {{
                              optimizationProgress.status ===
                              "replacing_placeholders"
                                ? "正在处理图片和公式..."
                                : optimizationProgress.status === "starting"
                                ? "准备处理..."
                                : `处理段落 ${
                                    optimizationProgress.completed_segments || 0
                                  }/${
                                    optimizationProgress.total_segments || "?"
                                  }`
                            }}
                          </span>
                          <span class="text-sm font-medium text-blue-600"
                            >{{
                              Math.round(optimizationProgress.progress || 0)
                            }}%</span
                          >
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            class="bg-gradient-to-r from-blue-400 to-indigo-500 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                            :style="{
                              width: `${optimizationProgress.progress || 0}%`,
                            }"
                          ></div>
                        </div>
                      </div>
                      <p class="text-sm text-gray-600 mb-2">
                        {{
                          optimizationProgress.status === "starting"
                            ? "正在准备优化..."
                            : optimizationProgress.status === "processing"
                            ? "正在优化内容..."
                            : optimizationProgress.status ===
                              "replacing_placeholders"
                            ? "正在处理图片和公式..."
                            : "优化即将完成"
                        }}
                      </p>
                      <p class="text-xs text-gray-500">
                        优化过程可能需要几分钟，请耐心等待。
                      </p>
                    </div>
                  </div>
                </div>

                <!-- 内容对比视图 -->
                <div
                  v-if="originalContent"
                  class="grid grid-cols-1 lg:grid-cols-2 gap-8"
                >
                  <!-- 原始内容 -->
                  <div
                    class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all hover:shadow-md"
                  >
                    <div
                      class="bg-gradient-to-r from-gray-50 to-gray-100 px-5 py-3 border-b border-gray-200 flex items-center justify-between"
                    >
                      <h3 class="font-medium text-gray-700 flex items-center">
                        <svg
                          class="w-4 h-4 mr-2 text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          ></path>
                        </svg>
                        原始内容
                      </h3>
                      <span
                        class="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded-full"
                        >OCR提取结果</span
                      >
                    </div>
                    <div
                      class="p-5 max-h-[70vh] overflow-auto custom-scrollbar"
                    >
                      <v-md-editor
                        v-model="originalContent"
                        mode="preview"
                        class="markdown-preview"
                        :preview-theme="'github'"
                        :default-show-toc="false"
                        :include-level="[1, 2, 3]"
                        @image-click="handleImageClick"
                      ></v-md-editor>
                    </div>
                  </div>

                  <!-- 优化后内容 -->
                  <div
                    class="bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden transition-all hover:shadow-md"
                  >
                    <div
                      class="bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-3 border-b border-blue-100 flex items-center justify-between"
                    >
                      <h3 class="font-medium text-blue-700 flex items-center">
                        <svg
                          class="w-4 h-4 mr-2 text-blue-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                          ></path>
                        </svg>
                        优化结果
                      </h3>
                      <div class="flex items-center space-x-2">
                        <span
                          class="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded-full"
                          >AI优化内容</span
                        >
                        <button
                          @click="downloadOptimizedResult"
                          class="text-xs px-2 py-1 bg-blue-500 text-white rounded-full hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all flex items-center"
                          :disabled="!optimizedContent || isOptimizing"
                          :class="{
                            'opacity-60 cursor-not-allowed':
                              !optimizedContent || isOptimizing,
                          }"
                        >
                          <svg
                            class="w-3 h-3 mr-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            ></path>
                          </svg>
                          下载
                        </button>
                      </div>
                    </div>
                    <div
                      class="p-5 max-h-[70vh] overflow-auto custom-scrollbar"
                    >
                      <div
                        v-if="!optimizedContent && !isOptimizing"
                        class="flex flex-col items-center justify-center h-64 bg-gradient-to-r from-blue-50/30 to-indigo-50/30 rounded-lg border border-dashed border-blue-200"
                      >
                        <svg
                          class="w-16 h-16 text-blue-300 mb-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="1.5"
                            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                          ></path>
                        </svg>
                        <p class="text-gray-500 text-center font-medium">
                          点击"开始优化"按钮
                        </p>
                        <p class="text-gray-400 text-center text-sm mt-1">
                          使用AI智能优化OCR内容
                        </p>
                      </div>
                      <v-md-editor
                        v-else-if="optimizedContent"
                        v-model="optimizedContent"
                        mode="preview"
                        class="markdown-preview"
                        :preview-theme="'github'"
                        :default-show-toc="false"
                        :include-level="[1, 2, 3]"
                        @image-click="handleImageClick"
                      ></v-md-editor>
                    </div>
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
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useStore } from "vuex";
import axios from "../plugins/axios"; // 使用配置好的axios实例
import OptimizationPrompt from "@/components/OptimizationPrompt.vue";
import PdfSummary from "@/components/PdfSummary.vue";

export default {
  name: "PdfProcessor",
  components: {
    OptimizationPrompt,
    PdfSummary,
  },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const store = useStore();

    // 获取文件ID
    const fileId = computed(() => route.params.id);

    // 状态变量
    const fileInfo = ref(null);
    const originalContent = ref("");
    const optimizedContent = ref("");
    const isLoading = ref(true);
    const isOptimizing = ref(false);
    const error = ref(null);
    const selectedModel = ref("qwen-turbo-latest"); // 默认使用qwen-turbo-latest模型

    // 优化进度状态
    const optimizationProgress = ref({
      status: "starting",
      total_segments: 0,
      completed_segments: 0,
      completed_content: "",
      progress: 0,
    });
    // 默认提示词 - 使用提示词.txt中的内容
    const optimizationPrompt =
      ref(`请根据以下指南修正OCR引起的错误，确保文本连贯并符合原始内容：

1. 修正OCR引起的拼写错误和错误：
   - 修正常见的OCR错误（例如，'rn' 被误读为 'm'）
   - 使用上下文和常识进行修正
   - 只修正明显的错误，不要不必要的修改内容
   - 不要添加额外的句号或其他不必要的标点符号

2. 保持原始结构：
   - 保留所有标题和子标题

3. 保留原始内容：
   - 保留原始文本中的所有重要信息
   - 不要添加任何原始文本中没有的新信息
   - 保留段落之间的换行符

4. 保持连贯性：
   - 确保内容与前文顺畅连接
   - 适当处理在句子中间开始或结束的文本

5. 修正行内公式：
   - 去除行内公式前后多余的空格
   - 修正公式中的OCR错误
   - 确保公式能够通过KaTeX渲染

6. 修正全角字符
    - 修正全角标点符号为半角标点符号
    - 修正全角字母为半角字母
    - 修正全角数字为半角数字

请仅返回修正后的文本，保留所有原始格式，包括换行符。不要包含任何介绍、解释或元数据。`);

    // 加载文件信息和原始内容
    const loadFileContent = async () => {
      isLoading.value = true;
      error.value = null;

      try {
        // 获取文件详情
        const detailsResponse = await axios.get(
          `/api/pdf/files/${fileId.value}/results`,
          {
            headers: {
              Authorization: `Bearer ${store.getters["auth/getToken"]}`,
            },
          }
        );

        if (detailsResponse.data.success) {
          fileInfo.value = detailsResponse.data.data;

          // 获取Markdown内容
          if (fileInfo.value.markdownUrl) {
            const markdownResponse = await axios.get(
              fileInfo.value.markdownUrl
            );
            originalContent.value = markdownResponse.data;

            // 处理Markdown内容中的图片路径
            processMarkdownContent();
          }

          // 检查是否有优化过的内容
          await checkOptimizedContent();
        } else {
          error.value = detailsResponse.data.message || "加载失败";
        }
      } catch (err) {
        console.error("加载文件内容错误:", err);
        error.value = err.response?.data?.message || "加载失败，请稍后重试";
      } finally {
        isLoading.value = false;
      }
    };

    // 检查是否有优化过的内容
    const checkOptimizedContent = async () => {
      try {
        const response = await axios.get(
          `/api/pdf/files/${fileId.value}/optimized`,
          {
            headers: {
              Authorization: `Bearer ${store.getters["auth/getToken"]}`,
            },
          }
        );

        if (response.data.success && response.data.data) {
          optimizedContent.value = response.data.data;
        }
      } catch (err) {
        // 如果没有优化过的内容，不显示错误
        console.log("没有找到优化过的内容");
      }
    };

    // 处理Markdown内容中的图片路径
    const processMarkdownContent = () => {
      if (!originalContent.value || !fileInfo.value) return;

      try {
        // 修复图片路径
        let content = originalContent.value;

        // 替换Markdown格式的图片引用 - 处理images/路径
        content = content.replace(
          /!\[([^\]]*)\]\(images\/([^)]+)\)/g,
          (_, alt, imgPath) => {
            // 确保不截断图片文件名，并使用正确的服务器地址
            const apiBaseUrl =
              process.env.VUE_APP_API_URL || "http://localhost:3000";
            return `![${alt || "图片"}](${apiBaseUrl}/api/pdf/files/${
              fileInfo.value.id
            }/images/${imgPath})`;
          }
        );

        // 替换Markdown格式的图片引用 - 处理相对路径
        content = content.replace(
          /!\[([^\]]*)\]\((?!http|\/|images\/)([^)]+)\)/g,
          (_, alt, imgPath) => {
            // 确保不截断图片文件名，并使用正确的服务器地址
            const apiBaseUrl =
              process.env.VUE_APP_API_URL || "http://localhost:3000";
            return `![${alt || "图片"}](${apiBaseUrl}/api/pdf/files/${
              fileInfo.value.id
            }/images/${imgPath})`;
          }
        );

        // 替换HTML格式的图片引用 - 处理images/路径
        content = content.replace(
          /<img([^>]*)src=["']images\/([^"']+)["']([^>]*)>/g,
          (_, before, imgPath, after) => {
            // 确保不截断图片文件名，并使用正确的服务器地址
            const apiBaseUrl =
              process.env.VUE_APP_API_URL || "http://localhost:3000";
            return `<img${before}src="${apiBaseUrl}/api/pdf/files/${fileInfo.value.id}/images/${imgPath}"${after}>`;
          }
        );

        // 替换HTML格式的图片引用 - 处理相对路径
        content = content.replace(
          /<img([^>]*)src=["'](?!http|\/|images\/)([^"']+)["']([^>]*)>/g,
          (_, before, imgPath, after) => {
            // 确保不截断图片文件名，并使用正确的服务器地址
            const apiBaseUrl =
              process.env.VUE_APP_API_URL || "http://localhost:3000";
            return `<img${before}src="${apiBaseUrl}/api/pdf/files/${fileInfo.value.id}/images/${imgPath}"${after}>`;
          }
        );

        // 处理可能的绝对路径图片引用（以/开头）
        content = content.replace(
          /!\[([^\]]*)\]\(\/([^)]+)\)/g,
          (match, alt, imgPath) => {
            // 如果路径中包含 /images/ 并且不是已经处理过的API路径
            if (
              imgPath.includes("/images/") &&
              !imgPath.includes("/api/pdf/files/")
            ) {
              const imgName = imgPath.split("/").pop();
              const apiBaseUrl =
                process.env.VUE_APP_API_URL || "http://localhost:3000";
              return `![${alt || "图片"}](${apiBaseUrl}/api/pdf/files/${
                fileInfo.value.id
              }/images/${imgName})`;
            }
            return match; // 不修改其他绝对路径
          }
        );

        // 处理可能的绝对路径HTML图片引用
        content = content.replace(
          /<img([^>]*)src=["']\/([^"']+)["']([^>]*)>/g,
          (match, before, imgPath, after) => {
            // 如果路径中包含 /images/ 并且不是已经处理过的API路径
            if (
              imgPath.includes("/images/") &&
              !imgPath.includes("/api/pdf/files/")
            ) {
              const imgName = imgPath.split("/").pop();
              const apiBaseUrl =
                process.env.VUE_APP_API_URL || "http://localhost:3000";
              return `<img${before}src="${apiBaseUrl}/api/pdf/files/${fileInfo.value.id}/images/${imgName}"${after}>`;
            }
            return match; // 不修改其他绝对路径
          }
        );

        // 更新Markdown内容
        originalContent.value = content;
      } catch (err) {
        console.error("处理Markdown内容错误:", err);
      }
    };

    // 优化内容
    const optimizeContent = async () => {
      if (!originalContent.value || isOptimizing.value) return;

      isOptimizing.value = true;
      error.value = null;
      optimizedContent.value = ""; // 清空之前的优化内容

      // 重置进度状态
      optimizationProgress.value = {
        status: "starting",
        total_segments: 0,
        completed_segments: 0,
        completed_content: "",
        progress: 0,
      };

      // 轮询进度的定时器
      let progressTimer = null;

      try {
        console.log(`使用模型 ${selectedModel.value} 进行优化`);

        // 发送优化请求
        const response = await axios.post(
          `/api/pdf/files/${fileId.value}/optimize`,
          {
            prompt: optimizationPrompt.value,
            model: selectedModel.value, // 传递选择的模型
          },
          {
            headers: {
              Authorization: `Bearer ${store.getters["auth/getToken"]}`,
            },
          }
        );

        if (response.data.success) {
          // 开始轮询进度
          progressTimer = setInterval(async () => {
            try {
              const progressResponse = await axios.get(
                `/api/pdf/files/${fileId.value}/optimize/progress`,
                {
                  headers: {
                    Authorization: `Bearer ${store.getters["auth/getToken"]}`,
                  },
                }
              );

              if (progressResponse.data.success) {
                const progressData = progressResponse.data.data;
                optimizationProgress.value = progressData;

                // 计算进度百分比
                if (progressData.total_segments > 0) {
                  optimizationProgress.value.progress =
                    (progressData.completed_segments /
                      progressData.total_segments) *
                    100;
                }

                // 显示已完成的段落内容
                if (progressData.completed_content) {
                  optimizedContent.value = progressData.completed_content;
                }

                // 如果处理完成或者正在替换占位符，尝试获取最新内容
                if (
                  progressData.status === "completed" ||
                  progressData.status === "replacing_placeholders"
                ) {
                  try {
                    // 获取完整的优化结果
                    const finalResponse = await axios.get(
                      `/api/pdf/files/${fileId.value}/optimized`,
                      {
                        headers: {
                          Authorization: `Bearer ${store.getters["auth/getToken"]}`,
                        },
                      }
                    );

                    if (finalResponse.data.success) {
                      optimizedContent.value = finalResponse.data.data;
                    }
                  } catch (err) {
                    // 如果获取失败，可能是因为优化还没有完全完成，继续使用进度中的内容
                    console.log("获取完整优化结果失败，使用进度中的内容");
                  }
                }

                // 如果处理完成，停止轮询
                if (progressData.status === "completed") {
                  clearInterval(progressTimer);
                  progressTimer = null;

                  // 显示成功通知
                  store.dispatch("setNotification", {
                    type: "success",
                    message: "内容优化成功！",
                  });

                  isOptimizing.value = false;
                }
              }
            } catch (progressErr) {
              console.error("获取优化进度错误:", progressErr);
            }
          }, 3000); // 每3秒轮询一次
        } else {
          error.value = response.data.message || "优化失败";
          isOptimizing.value = false;
        }
      } catch (err) {
        console.error("优化内容错误:", err);
        error.value = err.response?.data?.message || "优化失败，请稍后重试";
        isOptimizing.value = false;

        // 清理定时器
        if (progressTimer) {
          clearInterval(progressTimer);
          progressTimer = null;
        }
      }
    };

    // 下载优化后的结果
    const downloadOptimizedResult = async () => {
      if (!optimizedContent.value) return;

      try {
        const response = await axios.get(
          `/api/pdf/files/${fileId.value}/download-optimized`,
          {
            headers: {
              Authorization: `Bearer ${store.getters["auth/getToken"]}`,
            },
            responseType: "blob",
          }
        );

        // 创建下载链接
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute(
          "download",
          `${fileInfo.value.originalFilename.replace(
            /\.[^/.]+$/,
            ""
          )}_优化结果.md`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.error("下载优化结果错误:", err);
        store.dispatch("setError", "下载优化结果失败，请稍后重试");
      }
    };

    // 返回上一页
    const goBack = () => {
      router.back();
    };

    // 处理图片点击事件
    const handleImageClick = (image) => {
      window.open(image.src, "_blank");
    };

    // 组件挂载时加载内容
    onMounted(() => {
      loadFileContent();
    });

    return {
      fileId,
      fileInfo,
      originalContent,
      optimizedContent,
      isLoading,
      isOptimizing,
      error,
      optimizationPrompt,
      selectedModel,
      optimizationProgress,
      loadFileContent,
      optimizeContent,
      downloadOptimizedResult,
      goBack,
      handleImageClick,
    };
  },
};
</script>

<style scoped>
/* 自定义滚动条 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 10px;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* 优化Markdown预览样式 */
:deep(.markdown-preview) {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
    Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
}

:deep(.markdown-preview p) {
  margin-bottom: 0.75rem;
  line-height: 1.6;
}

:deep(.markdown-preview h1),
:deep(.markdown-preview h2),
:deep(.markdown-preview h3),
:deep(.markdown-preview h4),
:deep(.markdown-preview h5),
:deep(.markdown-preview h6) {
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  font-weight: 600;
}

:deep(.markdown-preview img) {
  max-width: 100%;
  border-radius: 4px;
  margin: 0.5rem 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

:deep(.markdown-preview pre) {
  margin: 0.75rem 0;
  padding: 1rem;
  border-radius: 4px;
  background-color: #f8f9fa;
  overflow-x: auto;
}

:deep(.markdown-preview code) {
  font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.9em;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  background-color: rgba(27, 31, 35, 0.05);
}

:deep(.markdown-preview pre code) {
  padding: 0;
  background-color: transparent;
}

:deep(.markdown-preview table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.75rem 0;
}

:deep(.markdown-preview th),
:deep(.markdown-preview td) {
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
}

:deep(.markdown-preview th) {
  background-color: #f8fafc;
  font-weight: 600;
}

:deep(.markdown-preview tr:nth-child(even)) {
  background-color: #f8fafc;
}

/* 全局样式 */
.pdf-processor {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica,
    Arial, sans-serif;
  color: #333;
  background-color: #f9fafb;
  min-height: 100vh;
  padding: 2rem 1rem;
}

/* 自定义滚动条 */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* 卡片悬浮效果 */
.hover\:shadow-md {
  transition: all 0.3s ease;
}

/* 按钮微交互 */
button {
  transition: all 0.2s ease;
}

button:active:not(:disabled) {
  transform: scale(0.98);
}
</style>
