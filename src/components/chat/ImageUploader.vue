<template>
  <div class="image-uploader">
    <!-- 图片上传按钮 - ChatGPT风格 -->
    <button
      type="button"
      class="flex items-center justify-center w-8 h-8 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors duration-200 focus:outline-none"
      @click="triggerFileInput"
      :disabled="disabled"
      :title="disabled ? '当前模型不支持图片输入' : '上传图片'"
      :class="{
        'opacity-50 cursor-not-allowed': disabled,
        'cursor-pointer': !disabled,
      }"
    >
      <svg
        class="h-5 w-5"
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
  </div>
</template>

<script>
import { ref, watch } from "vue";

// 图片压缩函数
const compressImage = (file, maxWidth, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        // 计算新的尺寸
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = width;
        canvas.height = height;

        // 绘制图片
        ctx.drawImage(img, 0, 0, width, height);

        // 转换为base64
        let compressedDataUrl = canvas.toDataURL("image/jpeg", quality);

        // 检查压缩后的大小
        let base64Size = compressedDataUrl.length * 0.75; // 估算大小
        console.log(
          `原始图片大小: ${(file.size / 1024 / 1024).toFixed(2)} MB, 压缩后: ${(
            base64Size /
            1024 /
            1024
          ).toFixed(2)} MB`
        );

        // 如果压缩后仍然太大，继续压缩
        if (base64Size > 9.5 * 1024 * 1024) {
          // 9.5MB，留出一些余量
          console.log("图片仍然太大，进一步压缩...");

          // 计算需要的压缩比例
          const targetSize = 9 * 1024 * 1024; // 目标9MB
          const currentRatio = targetSize / base64Size;
          const newQuality = Math.min(quality * currentRatio, 0.5); // 不低于0.5的质量

          // 重新压缩
          compressedDataUrl = canvas.toDataURL("image/jpeg", newQuality);
          base64Size = compressedDataUrl.length * 0.75;

          console.log(
            `进一步压缩后: ${(base64Size / 1024 / 1024).toFixed(
              2
            )} MB, 质量: ${newQuality.toFixed(2)}`
          );

          // 如果仍然太大，尝试减小尺寸
          if (base64Size > 9.5 * 1024 * 1024) {
            console.log("图片仍然太大，减小尺寸...");

            // 减小尺寸到原来的一半
            width = Math.floor(width * 0.7);
            height = Math.floor(height * 0.7);

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            compressedDataUrl = canvas.toDataURL("image/jpeg", newQuality);
            base64Size = compressedDataUrl.length * 0.75;

            console.log(
              `减小尺寸后: ${(base64Size / 1024 / 1024).toFixed(
                2
              )} MB, 尺寸: ${width}x${height}`
            );
          }
        }

        // 如果经过所有压缩后仍然太大，提示用户
        if (base64Size > 10 * 1024 * 1024) {
          alert("图片太大，即使压缩后仍超过10MB限制。请选择更小的图片。");
          reject(new Error("图片太大，无法压缩到10MB以下"));
          return;
        }

        resolve(compressedDataUrl);
      };
      img.onerror = (error) => {
        reject(error);
      };
    };
    reader.onerror = (error) => {
      reject(error);
    };
  });
};

export default {
  name: "ImageUploader",
  props: {
    disabled: {
      type: Boolean,
      default: false,
    },
    // 添加一个重置标志，用于在父组件中触发重置
    reset: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["image-selected", "image-removed"],
  setup(props, { emit, expose }) {
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

        // 检查文件大小（限制为7MB，因为Base64编码会增加约33%的大小，所以7MB的原始图片大约是9.3MB的Base64数据）
        if (file.size > 7 * 1024 * 1024) {
          alert("图片大小不能超过7MB（API限制Base64编码后需小于10MB）");
          return;
        }

        // 压缩并创建预览
        compressImage(file, 800, 0.7)
          .then((compressedDataUrl) => {
            selectedImage.value = compressedDataUrl;
            imageFile.value = file;
            emit("image-selected", {
              file: file,
              dataUrl: compressedDataUrl,
            });
          })
          .catch((error) => {
            console.error("图片压缩失败:", error);
            // 如果压缩失败，使用原始图片
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
          });
      }
    };

    // 移除图片
    const removeImage = () => {
      selectedImage.value = null;
      imageFile.value = null;
      fileInput.value.value = ""; // 清空文件输入
      emit("image-removed");
    };

    // 重置方法，可以从父组件调用
    const resetImage = () => {
      removeImage();
    };

    // 监听reset属性变化
    watch(
      () => props.reset,
      (newVal) => {
        if (newVal === true) {
          resetImage();
        }
      }
    );

    // 暴露方法给父组件
    expose({
      reset: resetImage,
    });

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
