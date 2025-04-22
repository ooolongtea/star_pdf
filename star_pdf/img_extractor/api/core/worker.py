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
import gc

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("Worker")

# 全局缓存
_processor_cache = {}

def select_least_loaded_device():
    """
    选择负载最低的CUDA设备

    返回:
        负载最低的设备名称（如 'cuda:0', 'cuda:1' 等），如果没有CUDA设备则返回 'cpu'
    """
    try:
        # 导入必要的模块
        from api.core.server_core import DEVICE_TASK_COUNT

        # 检查是否有可用的CUDA设备
        if not torch.cuda.is_available():
            logger.info("无CUDA设备，使用CPU")
            return "cpu"

        # 获取可用的CUDA设备数量
        device_count = torch.cuda.device_count()
        if device_count == 0:
            logger.info("无CUDA设备，使用CPU")
            return "cpu"

        # 如果只有一个设备，直接返回
        if device_count == 1:
            return "cuda:0"

        # 查找负载最低的设备
        min_load = float('inf')
        selected_device = "cuda:0"  # 默认使用第一个设备

        # 检查每个设备的负载
        for i in range(device_count):
            device_name = f"cuda:{i}"
            # 获取设备的当前任务数
            device_load = DEVICE_TASK_COUNT.get(device_name, 0)

            # 获取设备的显存使用情况
            try:
                # 获取设备属性
                props = torch.cuda.get_device_properties(i)
                # 获取当前显存使用情况
                reserved = torch.cuda.memory_reserved(i) / 1024**2  # MB
                allocated = torch.cuda.memory_allocated(i) / 1024**2  # MB
                free = props.total_memory / 1024**2 - reserved  # MB

                # 计算综合负载分数（考虑任务数和显存使用情况）
                # 负载分数 = 任务数 * 10 + 显存使用率 * 100
                memory_usage_ratio = reserved / props.total_memory
                load_score = device_load * 10 + memory_usage_ratio * 100

                logger.info(f"设备{device_name}: 任务={device_load}, 显存={memory_usage_ratio:.2f}, 负载={load_score:.2f}")

                # 如果这个设备的负载更低，选择它
                if load_score < min_load:
                    min_load = load_score
                    selected_device = device_name
            except Exception as e:
                logger.warning(f"获取设备 {device_name} 的显存信息时出错: {e}")
                # 如果无法获取显存信息，只考虑任务数
                if device_load < min_load:
                    min_load = device_load
                    selected_device = device_name

        logger.info(f"选择设备: {selected_device}, 负载: {min_load:.2f}")
        return selected_device

    except Exception as e:
        logger.error(f"选择设备时出错: {e}")
        # 出错时默认使用第一个设备或CPU
        if torch.cuda.is_available() and torch.cuda.device_count() > 0:
            return "cuda:0"
        else:
            return "cpu"

def init_worker_process(device: str):
    """
    初始化工作进程

    参数:
        device: 使用的设备 (如 'cuda:0', 'cpu')
    """
    try:
        logger.info(f"初始化进程{os.getpid()}@{device}")

        # 设置工作进程的设备
        # 注意：不再设置 CUDA_VISIBLE_DEVICES 环境变量，因为这可能会影响其他进程
        # 而是直接使用 PyTorch 的设备管理

        # 导入必要的库
        import numpy as np
        import random
        import torch

        # 检查CUDA是否可用
        try:
            if torch.cuda.is_available():
                device_count = torch.cuda.device_count()

                # 如果设备是 CUDA 设备，设置当前设备
                if 'cuda' in device:
                    device_id = int(device.split(':')[1]) if ':' in device else 0
                    if device_id < device_count:
                        # 先设置当前设备，再获取设备名称
                        torch.cuda.set_device(device_id)
                        device_name = torch.cuda.get_device_name(device_id)
                        logger.info(f"使用CUDA{device_id}")
                    else:
                        logger.warning(f"设备 ID {device_id} 超出范围，将使用设备 0")
                        device = "cuda:0"
                        torch.cuda.set_device(0)
                else:
                    logger.info("使用CPU")
            else:
                logger.warning("无CUDA，使用CPU")
                device = "cpu"
        except Exception as e:
            logger.warning(f"CUDA初始化时出错: {e}")
            logger.warning("使用CPU")
            device = "cpu"

        # 设置随机种子，保证可复现性
        seed = 42
        np.random.seed(seed)
        random.seed(seed)
        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(seed)

        # 初始化专利处理器（延迟加载）
        # 这里不立即加载，而是在第一次使用时加载
        logger.info("初始化完成")
        return True
    except Exception as e:
        logger.error(f"工作进程初始化失败: {str(e)}")
        traceback.print_exc()
        return False

def get_processor_for_process(device: str):
    """
    获取当前进程的分子共指处理器实例
    此函数确保每个进程只创建一个处理器实例，实现进程内缓存和复用

    参数:
        device: 使用的设备

    返回:
        分子共指处理器实例
    """
    global _processor_cache

    if device not in _processor_cache:
        logger.info(f"创建处理器@{device}")

        # 导入分子共指处理器
        from api.processors import MolCorefProcessor

        # 创建处理器实例
        processor = MolCorefProcessor(result_manager=None, device=device)

        # 缓存处理器实例
        _processor_cache[device] = processor
        logger.info("处理器创建完成")
    else:
        logger.info(f"复用处理器@{device}")

    return _processor_cache[device]

def process_patent_task(patent_file: str, output_dir: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    处理单个专利文件的任务函数
    该函数在进程池中执行，每个进程可以处理多个连续任务而不会被销毁

    参数:
        patent_file: 专利文件路径
        output_dir: 输出目录路径
        options: 处理选项

    返回:
        处理结果字典
    """
    try:
        start_time = time.time()
        logger.info(f"处理专利: {Path(patent_file).name}")

        from api.core.server_core import PROCESS_LOCK, DEVICE_TASK_COUNT, POOL_TASK_COUNT
        # 导入必要的类
        from api.utils.result_manager import ResultManager
        from api.processors.patent_processor import PatentProcessor

        # 确保输出目录存在
        Path(output_dir).mkdir(parents=True, exist_ok=True)

        # 获取当前进程的设备
        # 优先使用选项中指定的设备
        if options and 'device_id' in options:
            device_id = options['device_id']
            if isinstance(device_id, int) and torch.cuda.is_available() and device_id < torch.cuda.device_count():
                device = f"cuda:{device_id}"
                logger.info(f"使用指定设备: {device}")
            else:
                logger.warning(f"选项指定的设备ID {device_id} 无效，将选择负载最低的设备")
                # 如果指定的设备无效，选择负载最低的设备
                device = select_least_loaded_device()
        else:
            # 如果没有指定设备，选择负载最低的设备
            device = select_least_loaded_device()
            logger.info(f"选择设备: {device}")


        # 提取基本文件名（不含扩展名）作为专利ID
        patent_id = Path(patent_file).stem

        # 设置输出子目录 - 重要：在专利目录内部创建结果，而不是在全局结果目录
        # 使用专利目录本身作为输出目录，这样processed_images.txt和其他输出文件都在同一个地方
        patent_output_dir = Path(patent_file)

        # 创建结果管理器，配置开启JSON和Excel输出
        result_manager = ResultManager(output_config={
            "json_results": True,
            "excel_results": True,
            "visualization": True,
            "intermediate_files": False
        })

        # 获取处理器(用于共享已加载的模型)，注意这里会复用已有的处理器实例
        processor = get_processor_for_process(device)
        # 为此任务分配一个新的结果管理器
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
            progress_callback=lambda progress, message: logger.info(f"{progress*100:.1f}%: {message}")
        )

        # 保存JSON结果
        logger.info("保存结果")
        result_manager.save_results(patent_output_dir)

        # 生成Excel报告
        excel_file = None
        if success:
            try:
                excel_file = patent_output_dir / f"{patent_id}_chemicals.xlsx"
                patent_processor.write_to_excel(excel_file)
                logger.info(f"Excel已生成")
            except Exception as e:
                logger.error(f"生成Excel报告失败: {str(e)}")
                traceback.print_exc()

        # 清理当前任务的资源，但保留处理器实例
        cleanup_patent_resources(result_manager, patent_processor)

        # 减少任务计数
        try:
            with PROCESS_LOCK:
                # 减少设备任务计数
                if device in DEVICE_TASK_COUNT:
                    DEVICE_TASK_COUNT[device] = max(0, DEVICE_TASK_COUNT[device] - 1)

                # 找到进程池并减少其任务计数
                pid = os.getpid()
                for pool_key in list(POOL_TASK_COUNT.keys()):
                    if pool_key.startswith(f"{device}_"):
                        POOL_TASK_COUNT[pool_key] = max(0, POOL_TASK_COUNT[pool_key] - 1)
                        break
        except Exception as e:
            logger.warning(f"更新任务计数时出错: {e}")

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

        logger.info(f"专利{patent_id}完成，耗时: {elapsed_time:.2f}秒")
        return result

    except Exception as e:
        logger.error(f"处理专利时出错: {str(e)}")
        traceback.print_exc()

        # 减少任务计数
        try:
            from api.core.server_core import PROCESS_LOCK, DEVICE_TASK_COUNT, POOL_TASK_COUNT
            with PROCESS_LOCK:
                if 'device' in locals() and device in DEVICE_TASK_COUNT:
                    DEVICE_TASK_COUNT[device] = max(0, DEVICE_TASK_COUNT[device] - 1)

                # 找到进程池并减少其任务计数
                pid = os.getpid()
                if 'device' in locals():
                    for pool_key in list(POOL_TASK_COUNT.keys()):
                        if pool_key.startswith(f"{device}_"):
                            POOL_TASK_COUNT[pool_key] = max(0, POOL_TASK_COUNT[pool_key] - 1)
                            break
        except Exception as err:
            logger.warning(f"错误处理时更新任务计数出错: {err}")

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

    logger.info(f"批处理{len(patent_files)}个文件")

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
            logger.info(f"处理: {Path(patent_file).name}")

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

    logger.info("清理资源")

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
    gc.collect()

    # 清空CUDA缓存
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    logger.info("资源清理完成")

def cleanup_patent_resources(result_manager=None, patent_processor=None):
    """
    清理专利处理相关资源

    参数:
        result_manager: 结果管理器实例
        patent_processor: 专利处理器实例
    """
    try:
        logger.info("清理资源")

        # 清理结果管理器
        if result_manager is not None:
            result_manager.clear_results()

        # 清理专利处理器（但不清理其中的processor属性，因为需要复用）
        if patent_processor is not None:
            # 只清理专利处理器自身的资源，不清理内部共享的处理器
            patent_processor.processor = None  # 断开对共享处理器的引用，但不删除它
            patent_processor.result_manager = None

        # 执行垃圾回收以释放内存
        gc.collect()

        # 如果有CUDA
        if torch.cuda.is_available():
            # 释放CUDA缓存
            torch.cuda.empty_cache()

        logger.info("资源清理完成")
    except Exception as e:
        logger.error(f"清理资源时出错: {str(e)}")
        traceback.print_exc()