import logging
import os
import sys
import cv2
import numpy as np
from paddleocr import PaddleOCR

# 图像预处理
def preprocess_image(image_path):
    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    # 转为灰度图
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # 增强文本对比度
    binary = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
    denoised = cv2.fastNlMeansDenoising(binary, h=10)
    # 锐化图像
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    sharpened = cv2.filter2D(denoised, -1, kernel)

    processed_path = "/tmp/processed_image.png"
    cv2.imwrite(processed_path, sharpened)
    return processed_path

def run_ocr(image_path):
    try:
        processed_image = preprocess_image(image_path)

        # 初始化 PaddleOCR
        ocr = PaddleOCR(
            use_angle_cls=True,
            lang='en',
            show_log=False,
            use_gpu=True,
            gpu_id=0,
            det_db_unclip_ratio=2.0,  
            enable_mkldnn=True,        # 启用Intel MKL-DNN加速（CPU后备）
            use_mp=True                # 多进程推理加速
        )
                
        # 执行 OCR
        result = ocr.ocr(processed_image, cls=True)
        
        # 检查结果是否为空
        if result and result[0]:  
            texts = [line[1][0] for line in result[0]]  # 提取识别的文本
        else:
            texts = []  
        
        return texts
    
    except Exception as e:
        # 捕获异常并返回空列表
        print(f"Error during OCR processing: {e}", file=sys.stderr)
        return []

if __name__ == "__main__":
    os.environ['CUDA_VISIBLE_DEVICES'] = '3'  
    os.environ['FLAGS_call_stack_level'] = '2'  # 抑制Paddle内部警告
    os.environ['NCCL_DEBUG'] = 'WARN'  # 抑制NCCL通信警告（多卡时）
    logging.disable(logging.CRITICAL)  # 全局禁用所有日志

    # 重定向标准错误输出到/dev/null
    sys.stderr = open(os.devnull, 'w')

    # 获取命令行参数
    image_path = sys.argv[1]
    
    # 执行 OCR
    texts = run_ocr(image_path)

    print(f"paddleocr--------------:{texts}") 