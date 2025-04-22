import os
import time
from pathlib import Path
from PIL import Image, ImageEnhance
import cv2
import numpy as np

from result_manager import ResultManager
from molcoref_processor import MolCorefProcessor
from patent_processor import PatentProcessor, FolderProcessor

def process_single_patent():
    """处理单个专利目录"""
    patent_dir = "/home/zhangxiaohong/zhouxingyu/zxy_extractor/data/temp_output/CN105330720"  
    # 创建结果管理器
    result_manager = ResultManager(output_config={
        "json_results": True,
        "excel_results": True, 
        "visualization": True,
        "intermediate_files": False
    })
    
    # 创建处理器
    processor = MolCorefProcessor(
        result_manager=result_manager,
        device="cuda:0"
    )
    
    # 创建专利处理器
    patent_processor = PatentProcessor(
        patent_dir=patent_dir,
        result_manager=result_manager,
        device="cuda:0",
        processor=processor  # 传递已创建的处理器
    )
    
    # 处理专利
    success = patent_processor.process()
    
    if success:
        print(f"成功处理专利：{patent_dir}")
        
        # 保存结果
        # 创建输出目录
        output_dir = Path(f"{patent_dir}")
        output_dir.mkdir(parents=True, exist_ok=True)
        result_manager.save_results(output_dir)
        
        # 保存Excel
        excel_file = output_dir / f"{Path(patent_dir).name}_chemicals.xlsx"
        patent_processor.write_to_excel(excel_file)
        print(f"结果已保存到：{output_dir}")
    else:
        print(f"处理失败：{patent_dir}")


def process_multiple_patents():
    """处理多个专利目录"""
    input_root = "/home/zhangxiaohong/zhouxingyu/retro_extractor/data/drug_CN_100_test"  
    output_root = "/home/zhangxiaohong/zhouxingyu/retro_extractor/data/drug_CN_100_test"  
    
    # 创建文件夹处理器
    folder_processor = FolderProcessor(
        input_root=input_root,
        output_root=output_root,
        devices=["cuda:0", "cuda:1","cuda:2", "cuda:3"],
        output_config={
            "json_results": True,
            "excel_results": True, 
            "visualization": True,
            "intermediate_files": False
        },
        processes_per_gpu=3  # 进程数
    )
    
    # 处理所有专利
    start_time = time.time()
    folder_processor.process()
    elapsed_time = time.time() - start_time
    print(f"总处理时间：{elapsed_time:.2f}秒")


def process_single_image():
    """处理单个图像文件"""
    image_path = "/home/zhangxiaohong/zhouxingyu/zxy_extractor/data/temp_output/CN102690252/image_visualizations/86df13c39a51dde86f396d24a1eda369abdafc5bf717ce138c1235fbe3ddec18_visualization.png" 
    image_path = "/home/zhangxiaohong/zhouxingyu/zxy_extractor/data/temp_output/CN102731395/image_visualizations/4b5885fcb72f5fc37b740dbde3beda58312293f1d7e4850f67d846041841ff1e_visualization.png"
    # 创建结果管理器
    result_manager = ResultManager(output_config={
        "json_results": True,
        "excel_results": True, 
        "visualization": True,
        "intermediate_files": False
    })
    
    # 创建处理器
    processor = MolCorefProcessor(
        result_manager=result_manager,
        device="cuda:0"  # 使用GPU，或"cpu"使用CPU
    )
    
    # 处理图像
    image_id = processor.process_image(
        image_path=image_path,
        need_mol=True,  # 是否需要分子预测
        need_rxn=True   # 是否需要反应预测
    )
    
    if image_id:
        print(f"成功处理图像：{image_path}")
        
        # 保存结果
        output_dir = Path(f"{Path(image_path).parent}/{Path(image_path).stem}_output")
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # 获取分子和反应数据
        molecules = result_manager.get_molecule_results(image_id)
        reactions = result_manager.get_reaction_results(image_id)
        
        print(f"检测到{len(molecules)}个分子")
        print(f"检测到{len(reactions)}个反应")
        
        # 可视化写入
        if result_manager.output_config.get("visualization", True):
            output_dir = output_dir / "visualizations"
            output_dir.mkdir(parents=True, exist_ok=True)
            result_manager._save_visualizations(output_dir)
        print(f"可视化结果已保存到：{output_dir}")

        # 写入Excel
        excel_file = output_dir / f"{Path(image_path).stem}_results.xlsx"
        processor.write_to_excel(excel_file, molecules, reactions)
        print(f"结果已保存到：{excel_file}")
        
    else:
        print(f"处理失败：{image_path}")




def preprocess_image_for_ocr(image_path, resize_factor=None, 
                            denoise=True, threshold=True,
                            sharpen=True, contrast_enhance=True):
    """
    预处理图像
    
    参数:
        image_path (str): 输入图像文件路径
        output_path (str): 输出图像保存路径，如不指定则不保存
        resize_factor (float): 放大因子，如不指定则不调整大小
        denoise (bool): 是否进行降噪处理
        threshold (bool): 是否进行二值化处理
        sharpen (bool): 是否锐化图像
        contrast_enhance (bool): 是否增强对比度
    
    返回:
        处理后的图像数组
    """
    # 读取图像
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"无法读取图像: {image_path}")
    
    # 转换为灰度图
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 调整大小（可选）
    if resize_factor is not None and resize_factor > 0:
        height, width = gray.shape
        gray = cv2.resize(gray, (int(width * resize_factor), int(height * resize_factor)), 
                          interpolation=cv2.INTER_CUBIC)
    
    # 降噪处理（可选）
    if denoise:
        gray = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
    
    # 增强对比度（可选）
    if contrast_enhance:
        # 转为PIL图像进行处理
        pil_img = Image.fromarray(gray)
        enhancer = ImageEnhance.Contrast(pil_img)
        pil_img = enhancer.enhance(2.0)  # 增强系数，可调整
        gray = np.array(pil_img)
    
    # 锐化处理（可选）
    if sharpen:
        kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
        gray = cv2.filter2D(gray, -1, kernel)
    
    # 二值化处理（可选）
    if threshold:
        gray = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                     cv2.THRESH_BINARY, 11, 2)
    
    
    processed_dir = Path(image_path).parent / "processed2"
    processed_dir.mkdir(exist_ok=True)

    processed_path = processed_dir / Path(image_path).name
    cv2.imwrite(str(processed_path), gray)    

    return gray

if __name__ == "__main__":
    # 取消注释要运行的功能
    # process_single_patent()
    process_multiple_patents()
    # process_single_image()

    # 预处理图像（效果一般）
    # image_path = "/home/zhangxiaohong/zhouxingyu/zxy_extractor/data/temp_output/2/CN101418032/image/99c50a88ce82e6eb3a88f9a3ca1502a0fd74b7a93686e5a3e5e3913c26ceee09.jpg"
    # processed_image_path = preprocess_image_for_ocr(image_path, resize_factor=None, 
    #                         denoise=True, threshold=False, deskew=False, 
    #                         sharpen=True, contrast_enhance=False)
    
    # print(f"预处理后的图片保存为：{processed_image_path}")
    print("over")