<template>
  <div class="image-uploader">
    <!-- 图片上传按钮 -->
    <button
      type="button"
      class="inline-flex items-center px-2 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      @click="triggerFileInput"
      :disabled="disabled"
      :title="disabled ? '当前模型不支持图片输入' : '上传图片'"
    >
      <svg
        class="h-5 w-5 text-gray-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        ></path>
      </svg>
    </button>

    <!-- 隐藏的文件输入 -->
    <input
      type="file"
      ref="fileInput"
      class="hidden"
      accept="image/*"
      @change="onFileSelected"
      :disabled="disabled"
    />

    <!-- 预览区域 -->
    <div v-if="selectedImage" class="mt-2 relative">
      <div class="relative border rounded-md p-1 inline-block">
        <img
          :src="selectedImage"
          alt="预览图片"
          class="h-20 w-auto object-contain rounded"
        />
        <button
          @click="removeImage"
          class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600 focus:outline-none"
          title="移除图片"
        >
          <svg
            class="h-3 w-3"
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
    </div>
  </div>
</template>

<script>
import { ref } from "vue";

export default {
  name: "ImageUploader",
  props: {
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["image-selected", "image-removed"],
  setup(props, { emit }) {
    const fileInput = ref(null);
    const selectedImage = ref(null);
    const imageFile = ref(null);

    // 触发文件选择
    const triggerFileInput = () => {
      if (!props.disabled) {
        fileInput.value.click();
      }
    };

    // 处理文件选择
    const onFileSelected = (event) => {
      const file = event.target.files[0];
      if (file) {
        // 检查文件类型
        if (!file.type.startsWith("image/")) {
          alert("请选择图片文件");
          return;
        }

        // 检查文件大小（限制为5MB）
        if (file.size > 5 * 1024 * 1024) {
          alert("图片大小不能超过5MB");
          return;
        }

        // 创建预览
        const reader = new FileReader();
        reader.onload = (e) => {
          selectedImage.value = e.target.result;
          imageFile.value = file;
          emit("image-selected", {
            file: file,
            dataUrl: e.target.result,
          });
        };
        reader.readAsDataURL(file);
      }
    };

    // 移除图片
    const removeImage = () => {
      selectedImage.value = null;
      imageFile.value = null;
      fileInput.value.value = ""; // 清空文件输入
      emit("image-removed");
    };

    return {
      fileInput,
      selectedImage,
      triggerFileInput,
      onFileSelected,
      removeImage,
    };
  },
};
</script>

<style scoped>
.image-uploader {
  display: inline-block;
}
</style>
