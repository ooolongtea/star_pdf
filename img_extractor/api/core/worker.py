"""
工作进程模块
提供专利处理任务的工作进程实现
"""
import os
import sys
import time
import logging
import traceback
import torch
from pathlib import Path
from typing import Dict, Any, Optional, List
import random

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("Worker")

# 全局缓存
_processor_cache = {}

def init_worker_process(device: str):
    """
    初始化工作进程

    参数:
        device: 使用的设备 (如 'cuda:0', 'cpu')
    """
    try:
        logger.info(f"初始化进程 {os.getpid()} 在设备 {device} 上")

        # 设置工作进程的设备
        # 注意：不再设置 CUDA_VISIBLE_DEVICES 环境变量，因为这可能会影响其他进程
        # 而是直接使用 PyTorch 的设备管理

        # 检查CUDA是否可用
        if torch.cuda.is_available():
            logger.info(f"CUDA可用，设备数量: {torch.cuda.device_count()}")
            for i in range(torch.cuda.device_count()):
                logger.info(f"CUDA设备 {i}: {torch.cuda.get_device_name(i)}")
                props = torch.cuda.get_device_properties(i)
                logger.info(f"  显存: {props.total_memory / (1024**3):.2f} GB")
                logger.info(f"  计算能力: {props.multi_processor_count} 个流处理器")

            # 如果设备是 CUDA 设备，设置当前设备
            if 'cuda' in device:
                device_id = int(device.split(':')[1]) if ':' in device else 0
                if device_id < torch.cuda.device_count():
                    logger.info(f"将使用 CUDA 设备 {device_id}: {torch.cuda.get_device_name(device_id)}")
                    # 设置当前设备
                    torch.cuda.set_device(device_id)
                else:
                    logger.warning(f"设备 ID {device_id} 超出范围，将使用设备 0")
                    device = "cuda:0"
                    torch.cuda.set_device(0)
            else:
                logger.info("将使用 CPU 设备")
        else:
            logger.warning("CUDA不可用，将使用CPU")
            device = "cpu"

        # 设置随机种子，保证可复现性
        import numpy as np
        import random
        import torch

        seed = 42
        np.random.seed(seed)
        random.seed(seed)
        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(seed)

        # 初始化专利处理器（延迟加载）
        # 这里不立即加载，而是在第一次使用时加载
        logger.info(f"进程 {os.getpid()} 初始化完成")
        return True
    except Exception as e:
        logger.error(f"工作进程初始化失败: {str(e)}")
        traceback.print_exc()
        return False

def get_processor_for_process(device: str):
    """
    获取当前进程的分子共指处理器实例

    参数:
        device: 使用的设备

    返回:
        分子共指处理器实例
    """
    global _processor_cache

    if device not in _processor_cache:
        logger.info(f"为进程 {os.getpid()} 创建专利处理器，设备: {device}")

        # 导入分子共指处理器
        from api.processors import MolCorefProcessor

        # 创建处理器实例
        processor = MolCorefProcessor(result_manager=None, device=device)

        # 缓存处理器实例
        _processor_cache[device] = processor
        logger.info(f"进程 {os.getpid()} 的分子共指处理器创建完成")

    return _processor_cache[device]

def process_patent_task(patent_file: str, output_dir: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    处理单个专利文件的任务函数

    参数:
        patent_file: 专利文件路径
        output_dir: 输出目录路径
        options: 处理选项

    返回:
        处理结果字典
    """
    try:
        start_time = time.time()
        logger.info(f"开始处理专利: {patent_file}")

        # 确保输出目录存在
        Path(output_dir).mkdir(parents=True, exist_ok=True)

        # 获取当前进程的设备
        # 优先使用选项中指定的设备
        if options and 'device_id' in options:
            device_id = options['device_id']
            if isinstance(device_id, int) and torch.cuda.is_available() and device_id < torch.cuda.device_count():
                device = f"cuda:{device_id}"
                logger.info(f"使用选项指定的CUDA设备: {device}")
            else:
                logger.warning(f"选项指定的设备ID {device_id} 无效，将使用默认设备")
                device = "cuda:0" if torch.cuda.is_available() else "cpu"
        else:
            # 检查是否有可用的CUDA设备
            if torch.cuda.is_available():
                # 直接使用第一个可用的CUDA设备
                device = "cuda:0"
                logger.info(f"使用CUDA设备: {device}")
            else:
                device = "cpu"
                logger.info("未找到可用的CUDA设备，使用CPU")

        # 打印设备信息
        if device.startswith("cuda"):
            device_id = int(device.split(":")[1])
            if device_id < torch.cuda.device_count():
                logger.info(f"使用CUDA设备 {device_id}: {torch.cuda.get_device_name(device_id)}")
                logger.info(f"设备显存: {torch.cuda.get_device_properties(device_id).total_memory / (1024**3):.2f} GB")
            else:
                logger.warning(f"设备ID {device_id} 超出范围，将使用CPU")
                device = "cpu"

        # 提取基本文件名（不含扩展名）作为专利ID
        patent_id = Path(patent_file).stem
        
        # 设置输出子目录
        patent_output_dir = Path(output_dir) / patent_id
        patent_output_dir.mkdir(exist_ok=True)
        
        # 使用封装好的方法处理专利
        from api.utils.result_manager import ResultManager
        from api.processors.patent_processor import PatentProcessor
        
        # 创建结果管理器，配置开启JSON和Excel输出
        result_manager = ResultManager(output_config={
            "json_results": True,
            "excel_results": True,
            "visualization": True,
            "intermediate_files": False
        })
        
        # 获取处理器(用于共享已加载的模型)
        processor = get_processor_for_process(device)
        processor.result_manager = result_manager
        
        # 创建专利处理器并处理
        patent_processor = PatentProcessor(
            patent_dir=patent_file,
            result_manager=result_manager,
            device=device,
            processor=processor
        )
        
        # 处理专利，使用封装好的方法
        success = patent_processor.process(
            progress_callback=lambda progress, message: logger.info(f"进度 {progress*100:.1f}%: {message}")
        )
        
        # 保存JSON结果
        logger.info("保存处理结果...")
        result_manager.save_results(patent_output_dir)
        
        # 生成Excel报告
        excel_file = None
        if success:
            try:
                logger.info("生成Excel报告...")
                excel_file = patent_output_dir / f"{patent_id}_chemicals.xlsx"
                patent_processor.write_to_excel(excel_file)
                logger.info(f"Excel报告已生成: {excel_file}")
            except Exception as e:
                logger.error(f"生成Excel报告失败: {str(e)}")
                traceback.print_exc()
        
        # 清理资源
        cleanup_patent_resources(result_manager, patent_processor)
        
        # 构造结果字典
        elapsed_time = time.time() - start_time
        result = {
            "success": success,
            "patent_id": patent_id,
            "processing_time": elapsed_time,
            "device": device,
            "output_dir": str(patent_output_dir),
            "message": "处理成功" if success else "处理失败"
        }
        
        # 添加Excel文件信息
        if excel_file and excel_file.exists():
            result["excel_file"] = str(excel_file)

        logger.info(f"专利 {patent_id} 处理完成，耗时: {elapsed_time:.2f}秒")
        return result

    except Exception as e:
        logger.error(f"处理专利时出错: {str(e)}")
        traceback.print_exc()
        
        return {
            "success": False,
            "patent_id": Path(patent_file).stem if patent_file else "unknown",
            "error": str(e),
            "message": f"处理失败: {str(e)}"
        }

def process_batch_task(patent_files: List[str], output_dir: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    批处理多个专利文件的任务函数

    参数:
        patent_files: 专利文件路径列表
        output_dir: 输出目录路径
        options: 处理选项

    返回:
        包含批处理结果的字典
    """
    start_time = time.time()
    
    logger.info(f"开始批处理 {len(patent_files)} 个专利文件")
    
    try:
        # 使用封装好的批处理方法
        from api.core.patent_task import process_batch_patents
        
        # 确保输出目录存在
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        # 获取设备信息
        device = "cuda:0" if torch.cuda.is_available() else "cpu"
        if options and 'device_id' in options:
            device_id = options['device_id']
            if isinstance(device_id, int) and torch.cuda.is_available() and device_id < torch.cuda.device_count():
                device = f"cuda:{device_id}"
        
        # 定义获取下一个设备的函数（简单返回固定设备）
        def get_next_device():
            return device
        
        # 定义获取进程池的函数（返回None表示在当前进程中处理）
        def get_pool():
            return None
        
        # 调用封装好的批处理方法（这里不使用进程池，而是在当前进程中处理每个专利）
        batch_results = []
        
        # 为每个专利创建一个任务ID
        task_ids = {}
        for patent_file in patent_files:
            patent_id = Path(patent_file).stem
            task_id = f"{patent_id}_{int(time.time())}_{random.randint(1000, 9999)}"
            task_ids[patent_file] = task_id
            
        # 直接在当前进程中处理每个专利
        for patent_file in patent_files:
            task_id = task_ids[patent_file]
            logger.info(f"处理专利: {patent_file}, 任务ID: {task_id}")
            
            # 处理单个专利
            result = process_patent_task(patent_file, output_dir, options)
            batch_results.append(result)
            
        # 统计成功和失败数量
        success_count = sum(1 for r in batch_results if r.get("success", False))
        failed_count = len(patent_files) - success_count
        
        # 计算总处理时间
        total_time = time.time() - start_time
        
        # 返回批处理结果
        return {
            "batch_size": len(patent_files),
            "success_count": success_count,
            "failed_count": failed_count,
            "processing_time": total_time,
            "results": batch_results,
            "output_dir": output_dir,
            "batch_id": f"batch_{int(time.time())}"
        }
    
    except Exception as e:
        logger.error(f"批处理任务失败: {str(e)}")
        traceback.print_exc()
        
        # 返回错误信息
        return {
            "batch_size": len(patent_files),
            "success_count": 0,
            "failed_count": len(patent_files),
            "error": str(e),
            "processing_time": time.time() - start_time,
            "results": [],
            "output_dir": output_dir,
            "batch_id": f"batch_{int(time.time())}"
        }

def cleanup_worker_resources():
    """清理工作进程的资源"""
    global _processor_cache

    logger.info(f"清理进程 {os.getpid()} 的资源")

    # 释放处理器资源
    for device, processor in _processor_cache.items():
        try:
            # 释放处理器资源
            del processor
        except:
            pass

    # 清空缓存
    _processor_cache.clear()

    # 强制垃圾回收
    import gc
    gc.collect()

    # 清空CUDA缓存
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    logger.info(f"进程 {os.getpid()} 资源清理完成")

def cleanup_patent_resources(result_manager=None, patent_processor=None):
    """
    清理专利处理的资源，供 patent_task.py 调用
    
    参数:
        result_manager: 结果管理器实例，如果为None则忽略
        patent_processor: 专利处理器实例，如果为None则忽略
    """
    logger.info(f"清理专利处理资源")
    
    # 清理结果管理器
    if result_manager is not None:
        try:
            # 释放结果管理器资源
            result_manager.cleanup()
        except:
            pass
    
    # 清理专利处理器（不删除实际的处理器对象，因为它可能被缓存和重用）
    if patent_processor is not None:
        try:
            # 释放专利处理器资源
            patent_processor.clear_cache()
        except:
            pass
    
    # 调用一般的资源清理
    cleanup_worker_resources()