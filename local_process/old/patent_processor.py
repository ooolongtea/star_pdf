import os
import time
import json
import gc
from tqdm import tqdm
import torch
import multiprocessing
from functools import partial
from pathlib import Path
from typing import Dict, List, Optional, Union, Tuple

from result_manager import ResultManager
from molcoref_processor import MolCorefProcessor

# Global variable to store processors per process
# This will allow each process to reuse its processor instance
_PROCESS_PROCESSORS = {}

class PatentProcessor:
    """处理单个专利目录"""
    
    def __init__(self, 
                 patent_dir: Union[str, Path],
                 result_manager: ResultManager,
                 device: str = "cpu",
                 processor: MolCorefProcessor = None,
                 preprocessed: bool = False):
        """
        初始化专利处理器
        
        参数:
            patent_dir: 专利目录的路径
            result_manager: 结果管理器实例
            device: 计算设备
            processor: 如果提供，使用已存在的MolCorefProcessor
            preprocessed: 是否预处理图像
        """
        self.patent_dir = Path(patent_dir)
        self.result_manager = result_manager
        self.device = device
        # 是否预处理
        self.preprocessed = preprocessed
        
        # 支持传入已加载的处理器
        self.processor = processor or MolCorefProcessor(
            result_manager=result_manager,
            device=device
        )
        
        # 读取图像列表文件
        self.reaction_images = self._read_image_list("reaction_img.txt")
        self.formula_images = self._read_image_list("formula_img.txt")
    
    def _read_image_list(self, filename: str) -> set:
        """
        读取图像列表文件
        
        参数:
            filename: 文件名
            
        返回:
            图像ID集合
        """
        try:
            file_path = self.patent_dir / filename
            if file_path.exists():
                with open(file_path, 'r') as f:
                    return {line.strip() for line in f if line.strip()}
            return set()
        except Exception as e:
            print(f"读取{filename}失败：{str(e)}")
            return set()
    
    def process(self) -> bool:
        """
        处理专利目录中的所有图像
        
        返回:
            处理成功返回True，否则返回False
        """
        try:
            # 验证图像目录
            image_dir = self.patent_dir / 'image'
            if not self._validate_image_dir(image_dir):
                return False
            
            # 查找图像文件
            image_files = list(self._find_images(image_dir))
            if not image_files:
                print(f"在{image_dir}中未找到图像")
                return False
            
            # 处理每个图像
            processed_image_ids = []
            for img_path in image_files:
                try:
                    # 从文件名判断是否需要分子或反应预测
                    img_name = img_path.name

                    if self.preprocessed:
                        # 按照txt处理图片
                        need_mol = img_name in self.formula_images 
                        need_rxn = img_name in self.reaction_images 
                    else:
                        # 未预处理没有txt文件
                        need_mol = img_name in self.formula_images or not self.formula_images
                        need_rxn = img_name in self.reaction_images or not self.reaction_images
                        
                    # 如果文件在列表中，则处理
                    if need_mol or need_rxn:
                        image_id = self.processor.process_image(img_path, need_mol=need_mol, need_rxn=need_rxn)
                        # 只有当处理成功（返回非None值）时才添加到处理列表
                        if image_id is not None:
                            processed_image_ids.append(image_id)
                        else:
                            print(f"警告：图像处理返回None: {img_path.name}")
                except Exception as e:
                    print(f"处理失败：{img_path.name} - {str(e)}")
            
            # 收集此专利的所有结果
            if processed_image_ids:
                # 收集所有分子结果
                all_molecules = []
                for image_id in processed_image_ids:
                    molecules = self.result_manager.get_molecule_results(image_id)
                    all_molecules.extend(molecules)
                
                # 存储专利级结果
                patent_result = {
                    "patent_id": self.patent_dir.name,
                    "total_images": len(processed_image_ids),
                    "processed_images": processed_image_ids,
                    "results": all_molecules
                }
                self.result_manager.store_patent_result(self.patent_dir.name, patent_result)
            
            return len(processed_image_ids) > 0
            
        except Exception as e:
            print(f"专利处理失败 {self.patent_dir.name}：{str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    def _validate_image_dir(self, image_dir: Path) -> bool:
        """验证图像目录"""
        if not image_dir.exists():
            print(f"跳过缺失的图像目录：{image_dir}")
            return False
        return True
    
    def _find_images(self, directory: Path):
        """查找支持的图像文件"""
        return sorted([p for ext in MolCorefProcessor.SUPPORTED_EXTENSIONS 
                      for p in directory.glob(f"*{ext.lower()}")])
    
    def write_to_excel(self, output_file: Path):
        """
        将结果写入Excel
        
        参数:
            output_file: Excel文件路径
        """
        # 获取所有分子和反应数据
        molecules_data = []
        for image_id in self.result_manager.molecule_results:
            molecules_data.extend(self.result_manager.get_molecule_results(image_id))
            
        reactions_data = []
        for image_id in self.result_manager.reaction_results:
            reactions_data.extend(self.result_manager.get_reaction_results(image_id))
        
        # 调用处理器的Excel写入方法
        self.processor.write_to_excel(output_file, molecules_data, reactions_data)
        
        return output_file
        
    def clear_cache(self):
        """
        清理处理过程中产生的缓存，释放内存
        
        注意:不会释放预加载的处理器，只清理临时缓存和临时变量
        """
        try:
            # 重置处理器的ResultManager引用
            if hasattr(self.processor, 'result_manager'):
                self.processor.result_manager = None
            
            # 清空临时存储数据
            self.reaction_images = set()
            self.formula_images = set()
            
            # 强制垃圾回收
            gc.collect()
            
            # 如果系统支持，也可以尝试释放更多GPU内存
            if torch.cuda.is_available() and hasattr(self, 'device') and self.device.startswith('cuda'):
                # 释放所有未使用的缓存
                torch.cuda.empty_cache()
                
            return True
        except Exception as e:
            print(f"清理缓存失败: {str(e)}")
            return False


class FolderProcessor:
    """并行处理多个专利"""
    
    def __init__(self, 
                 input_root: str,
                 output_root: str = None,
                 devices: list = ["cpu"], 
                 output_config: Dict[str, bool] = None,
                 processes_per_gpu: int = 2):
        """
        初始化文件夹处理器
        
        参数:
            input_root: 包含专利文件夹的根目录
            output_root: 输出的根目录
            devices: 要使用的设备列表
            output_config: 输出生成的配置
            processes_per_gpu: 每个GPU的进程数
        """
        self.input_root = Path(input_root).resolve()
        self.output_root = Path(output_root) if output_root else self.input_root.parent / "molcoref_output"
        self.devices = devices
        self.output_config = output_config or {
            "json_results": True,
            "excel_results": True, 
            "visualization": True,
            "intermediate_files": False
        }
        self.processes_per_gpu = processes_per_gpu
        
        if not self.input_root.exists():
            raise FileNotFoundError(f"输入目录不存在：{self.input_root}")
        
        self.output_root.mkdir(parents=True, exist_ok=True)
        
        # 存储为每个进程创建的处理器
        self.processors = {}
    
    def process(self):
        """使用进程池处理所有专利"""
        # 查找所有专利目录
        patent_dirs = [d for d in self.input_root.iterdir() 
                      if d.is_dir() and not d.name.startswith(".")]
        
        if not patent_dirs:
            print(f"在{self.input_root}中未找到专利目录")
            return
        
        # 创建进程池
        num_processes = len(self.devices) * self.processes_per_gpu
        
        # 为进程分配设备
        device_assignments = []
        process_ids = []
        
        # 为每个专利分配一个设备和进程ID
        for i in range(len(patent_dirs)):
            # 决定使用哪个设备
            device_idx = i % len(self.devices)
            device = self.devices[device_idx]
            
            # 决定进程ID (每个设备有多个进程)
            process_id = (i // len(self.devices)) % self.processes_per_gpu
            
            device_assignments.append(device)
            process_ids.append(process_id)
        
        # 创建多进程上下文
        ctx = multiprocessing.get_context('spawn')
        pool = ctx.Pool(processes=num_processes)
        
        # 创建任务参数
        task = partial(process_patent_wrapper, 
                      output_root=self.output_root,
                      output_config=self.output_config,
                      model_paths=None)
        
        # 使用imap_unordered进行进度跟踪
        with tqdm(total=len(patent_dirs), desc="总进度") as pbar:
            for _ in pool.imap_unordered(task, zip(patent_dirs, device_assignments, process_ids)):
                pbar.update()
        
        pool.close()
        pool.join()
        
        # 清理全局处理器缓存
        global _PROCESS_PROCESSORS
        for key in list(_PROCESS_PROCESSORS.keys()):
            if _PROCESS_PROCESSORS[key] is not None:
                # 清理处理器中的模型
                processor = _PROCESS_PROCESSORS[key]
                if hasattr(processor, 'model'):
                    del processor.model
                if hasattr(processor, 'molscribe'):
                    del processor.molscribe
                if hasattr(processor, 'rxnmodel'):
                    del processor.rxnmodel
                del _PROCESS_PROCESSORS[key]
        _PROCESS_PROCESSORS.clear()
        
        # 强制垃圾回收
        gc.collect()
        
        # 清理GPU缓存
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            print("已清理全局GPU缓存")
        
        print("已清理全局处理器缓存")

    def process_single_patent(self, patent_dir: Union[str, Path]):
        """
        处理单个专利（单进程使用）
        
        参数:
            patent_dir: 专利目录路径
        
        返回:
            处理成功返回True，否则返回False
        """
        patent_dir = Path(patent_dir)
        
        # 创建结果管理器
        result_manager = ResultManager(output_config=self.output_config)
        
        # 使用默认设备
        device = self.devices[0] if self.devices else "cpu"
        
        # 创建处理器（如果不存在）
        processor_key = f"proc_{device}"
        if processor_key not in self.processors:
            self.processors[processor_key] = MolCorefProcessor(
                result_manager=result_manager,
                device=device
            )
        
        # 创建并运行处理器
        processor = PatentProcessor(
            patent_dir=patent_dir,
            result_manager=result_manager,
            device=device,
            processor=self.processors[processor_key]  # 使用已加载的模型
        )
        success = processor.process()
        
        # 如果处理成功，保存结果
        if success:
            # 创建特定于专利的输出目录
            patent_output_dir = Path(self.output_root) / f"{patent_dir.name}"
            patent_output_dir.mkdir(parents=True, exist_ok=True)
            
            # 保存所有结果
            result_manager.save_results(patent_output_dir)
            
            # 如果配置了，保存Excel
            if self.output_config.get("excel_results", True):
                excel_file = patent_output_dir / f"{patent_dir.name}_chemicals.xlsx"
                processor.write_to_excel(excel_file)
        
        return success


def get_or_create_processor(device, process_id, output_config, model_paths=None):
    """
    获取或创建进程特定的处理器（确保每个进程只加载一次模型）
    
    参数:
        device: 计算设备
        process_id: 进程ID
        output_config: 输出配置
        model_paths: 模型路径
    
    返回:
        处理器实例
    """
    global _PROCESS_PROCESSORS
    
    # 创建唯一的处理器键
    processor_key = f"{device}_{process_id}"
    
    # 如果处理器已存在，直接返回（但不使用其result_manager）
    if processor_key in _PROCESS_PROCESSORS:
        return _PROCESS_PROCESSORS[processor_key]
    
    # 创建临时结果管理器，只用于初始化
    temp_result_manager = ResultManager(output_config=output_config)
    
    # 创建并保存处理器
    processor = MolCorefProcessor(
        result_manager=temp_result_manager,
        device=device,
        model_paths=model_paths
    )
    
    # 存储处理器以供重用
    _PROCESS_PROCESSORS[processor_key] = processor
    
    print(f"为进程 {os.getpid()} 创建了新的处理器实例 ({device}, {process_id})")
    return processor


def process_patent_wrapper(args, output_root, output_config, model_paths=None):
    """用于多进程的包装函数"""
    try:
        patent_dir, device, process_id = args
        
        # 设置环境变量
        if device.startswith('cuda'):
            gpu_id = device.split(':')[1]
            os.environ["CUDA_VISIBLE_DEVICES"] = str(gpu_id)
            # 重置设备为cuda:0（在此进程中是第一个可见的GPU）
            device = "cuda:0"
        
        # 创建结果管理器（每个专利一个新的管理器）
        result_manager = ResultManager(output_config=output_config)
        
        # 获取或创建处理器（进程共享）
        processor = get_or_create_processor(device, process_id, output_config, model_paths)
        
        # 更新处理器的结果管理器为新的
        processor.result_manager = result_manager
        
        # 创建并运行专利处理器
        patent_processor = PatentProcessor(
            patent_dir=patent_dir,
            result_manager=result_manager,  # 使用专利特定的结果管理器
            device=device,
            processor=processor  # 使用共享处理器（已更新结果管理器）
        )
        success = patent_processor.process()
        
        # 如果处理成功，保存结果
        if success:
            # 创建特定于专利的输出目录
            patent_output_dir = Path(output_root) / f"{patent_dir.name}"
            patent_output_dir.mkdir(parents=True, exist_ok=True)
            
            # 保存所有结果
            result_manager.save_results(patent_output_dir)
            
            # 如果配置了，保存Excel
            if output_config.get("excel_results", True):
                excel_file = patent_output_dir / f"{patent_dir.name}_chemicals.xlsx"
                patent_processor.write_to_excel(excel_file)
        
        # 清理资源管理器的内存
        if result_manager is not None:
            result_manager.patent_results.clear()
            result_manager.image_results.clear()
            result_manager.molecule_results.clear()
            result_manager.reaction_results.clear()
            result_manager.experiment_results.clear()
            result_manager.visualization_data.clear()
            result_manager.molscribe_results.clear()
        
        # 强制进行垃圾回收
        gc.collect()
        
        # 清理GPU缓存
        if device.startswith('cuda') and torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        return success
    except Exception as e:
        print(f"专利处理失败：{patent_dir.name} - {str(e)}")
        return False

if __name__ == "__main__":
    # 使用示例
    input_dir = "/home/zhangxiaohong/zhouxingyu/zxy_extractor/data/Patent_CN/parse_res"
    output_dir = "/home/zhangxiaohong/zhouxingyu/zxy_extractor/data/output"
    devices = ["cuda:0", "cuda:1", "cuda:2", "cuda:3"]
    output_config = {
        "json_results": True,
        "excel_results": True,
        "visualization": True,
        "intermediate_files": False
    }
    processes_per_gpu = 3
    processor = FolderProcessor(
        input_root=input_dir,
        output_root=output_dir,
        devices=devices,
        output_config=output_config,
        processes_per_gpu=processes_per_gpu
    )
    # 处理所有专利
    start_time = time.time()    
    processor.process()
    elapsed_time = time.time() - start_time
    print(f"总处理时间：{elapsed_time:.2f}秒")