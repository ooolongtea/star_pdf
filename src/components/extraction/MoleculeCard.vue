<template>
  <div
    class="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
  >
    <div class="p-4">
      <div class="flex justify-between items-start mb-2">
        <h3 class="text-sm font-medium text-gray-900">ID: {{ molecule.id }}</h3>
        <span
          v-if="molecule.coref"
          class="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800"
        >
          {{ molecule.coref }}
        </span>
      </div>

      <div
        class="mb-3 h-32 flex items-center justify-center bg-gray-100 rounded"
      >
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
          {{ molecule.compound_smiles || "无" }}
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
          <svg
            class="h-4 w-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
            ></path>
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
      <div
        class="max-w-4xl max-h-full bg-white rounded-lg overflow-hidden"
        @click.stop
      >
        <div class="flex justify-between items-center p-4 border-b">
          <h3 class="text-lg font-medium text-gray-900">分子结构</h3>
          <button
            @click="showModal = false"
            class="text-gray-400 hover:text-gray-500"
          >
            <svg
              class="h-6 w-6"
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
            <div class="break-all">{{ molecule.compound_smiles || "无" }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from "vue";
import { useStore } from "vuex";

export default {
  name: "MoleculeCard",
  props: {
    molecule: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const store = useStore();
    const showModal = ref(false);

    // 获取图像URL
    const getImageUrl = (path) => {
      console.log("MoleculeCard - 原始路径:", path);

      // 如果有visualization_path属性，优先使用
      if (props.molecule && props.molecule.visualization_path) {
        const visPath = props.molecule.visualization_path;
        console.log("MoleculeCard - 使用visualization_path:", visPath);

        // 如果是完整URL，直接返回
        if (visPath.startsWith("http://") || visPath.startsWith("https://")) {
          return visPath;
        }

        // 从路径中提取专利ID
        let patentId = props.molecule.patent_id;
        if (!patentId && visPath.includes("CN")) {
          patentId = visPath.split("/").find((part) => part.startsWith("CN"));
        }

        if (patentId) {
          // 从路径中提取文件名
          const pathParts = visPath.split("/");
          const fileName = pathParts[pathParts.length - 1];
          console.log("MoleculeCard - 提取的原始文件名:", fileName);

          // 修复错误的后缀组合
          let fixedFileName = fileName;
          if (fileName.includes(".jpg_visualization")) {
            // 移除错误的.jpg部分
            fixedFileName = fileName.replace(
              ".jpg_visualization",
              "_visualization"
            );
            console.log("MoleculeCard - 修复后的文件名:", fixedFileName);
          }

          // 构建本地URL
          const url = `/uploads/patents/${patentId}/image_visualizations/${fixedFileName}`;
          console.log("MoleculeCard - 从visualization_path构建URL:", url);
          return url;
        }
      }

      // 如果没有visualization_path或无法处理，回退到使用image_path

      // 如果路径为空，返回空
      if (!path) {
        console.log("MoleculeCard - 路径为空，返回空字符串");
        return "";
      }

      // 如果是完整URL，直接返回
      if (path.startsWith("http://") || path.startsWith("https://")) {
        console.log("MoleculeCard - 完整URL，直接返回:", path);
        return path;
      }

      // 尝试从路径中提取专利ID
      let patentId = "";
      if (path.includes("CN")) {
        patentId = path.split("/").find((part) => part.startsWith("CN"));
        console.log("MoleculeCard - 从路径提取专利ID:", patentId);
      } else if (props.molecule.patent_id) {
        patentId = props.molecule.patent_id;
        console.log("MoleculeCard - 从props提取专利ID:", patentId);
      }

      console.log("MoleculeCard - 使用的专利ID:", patentId);

      // 如果有专利ID，使用本地服务器路径
      if (patentId) {
        // 从路径中提取文件名
        const pathParts = path.split("/");
        const fileName = pathParts[pathParts.length - 1];
        console.log("MoleculeCard - 提取的文件名:", fileName);

        // 提取基本文件名（不含扩展名）
        // 移除所有文件扩展名（.jpg, .png等）
        const baseFileName = fileName.replace(/\.[^/.]+$/, "");
        console.log("MoleculeCard - 基本文件名(无扩展名):", baseFileName);

        // 检查是否已经包含_visualization后缀
        if (baseFileName.includes("_visualization")) {
          // 已经有后缀，直接使用
          const url = `/uploads/patents/${patentId}/image_visualizations/${baseFileName}.png`;
          console.log("MoleculeCard - 已有后缀，返回URL:", url);
          return url;
        } else {
          // 添加可视化后缀，始终使用_visualization_0.png格式
          const url = `/uploads/patents/${patentId}/image_visualizations/${baseFileName}_visualization_0.png`;
          console.log("MoleculeCard - 添加后缀，返回URL:", url);
          return url;
        }
      } else {
        // 如果没有专利ID，回退到使用远程服务器
        const settings = store.getters["extraction/getSettings"];
        const serverUrl =
          settings.chemicalExtractionServerUrl || "http://172.19.1.81:8011";

        // 如果路径以/开头，直接拼接
        if (path.startsWith("/")) {
          return `${serverUrl}${path}`;
        }

        // 否则，添加/api/static/
        return `${serverUrl}/api/static/${path}`;
      }
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
      navigator.clipboard
        .writeText(props.molecule.compound_smiles)
        .then(() => {
          store.dispatch("setNotification", {
            type: "success",
            message: "SMILES已复制到剪贴板",
          });
        })
        .catch((err) => {
          console.error("复制失败:", err);
          store.dispatch("setError", "复制SMILES失败");
        });
    };

    return {
      showModal,
      getImageUrl,
      showFullImage,
      copySmiles,
    };
  },
};
</script>
