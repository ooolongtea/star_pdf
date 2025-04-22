"""
服务器核心模块
提供服务器核心功能和进程管理
"""
import os
import gc
import time
import torch
import logging
import threading
import multiprocessing
from typing import Dict, List, Optional, Any
from pathlib import Path
from multiprocessing import Pool
from concurrent.futures import ThreadPoolExecutor
from threading import Lock

from api.core.worker import init_worker_process, get_processor_for_process
from api.utils.system_utils import get_local_ip, periodic_cache_cleanup

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ServerCore")

class ProcessorManager:
    """
    处理器管理器
    管理多个进程池和设备分配
    """

    def __init__(self, process_pools: List[Any], pool_device_map: Dict[Any, str]):
        """
        初始化处理器管理器

        参数:
            process_pools: 进程池列表
            pool_device_map: 进程池到设备的映射字典
        """
        self.process_pools = process_pools
        self.pool_device_map = pool_device_map
        self.current_pool_index = 0
        self.pool_lock = Lock()

    def get_next_pool(self) -> tuple:
        """
        获取下一个可用的进程池和对应设备
        使用轮询方式分配

        返回:
            (进程池, 设备名称)
        """
        with self.pool_lock:
            pool = self.process_pools[self.current_pool_index]
            device = self.pool_device_map[pool]
            self.current_pool_index = (self.current_pool_index + 1) % len(self.process_pools)
            return pool, device

    def get_all_devices(self) -> List[str]:
        """
        获取所有可用设备列表

        返回:
            设备名称列表
        """
        return list(self.pool_device_map.values())

    def shutdown(self):
        """关闭所有进程池"""
        for pool in self.process_pools:
            pool.close()
            pool.join()
        logger.info("所有处理器进程池已关闭")

class ServerCore:
    """
    服务器核心类
    管理服务器的核心功能和资源
    """

    def __init__(self, data_dir: Optional[str] = None, connection_limit: int = 500):
        """
        初始化服务器核心

        参数:
            data_dir: 数据目录，如果为None则使用默认目录
            connection_limit: 最大连接数限制
        """
        # 设置数据目录
        if data_dir is None:
            # 使用默认路径
            self.data_dir = Path(os.path.expanduser("~/patent_data"))
        else:
            self.data_dir = Path(data_dir)

        # 创建数据目录(如果不存在)
        self.data_dir.mkdir(parents=True, exist_ok=True)

        # 创建子目录
        self.uploads_dir = self.data_dir / "uploads"
        self.results_dir = self.data_dir / "results"
        self.uploads_dir.mkdir(exist_ok=True)
        self.results_dir.mkdir(exist_ok=True)

        # 设置线程池用于并发操作
        self.executor = ThreadPoolExecutor(max_workers=32)

        # 设置连接限制
        self.connection_limit = connection_limit
        self.active_connections = 0
        self.connection_lock = Lock()

        # 处理器管理器
        self.processor_manager = None

        # 服务器启动时间
        self.start_time = time.time()

        logger.info(f"服务器核心初始化完成，数据目录: {self.data_dir}")

    def register_processor_manager(self, processor_manager: ProcessorManager):
        """
        注册处理器管理器

        参数:
            processor_manager: 处理器管理器实例
        """
        self.processor_manager = processor_manager
        logger.info("处理器管理器已注册")

    def get_status(self) -> Dict[str, Any]:
        """
        获取服务器状态信息

        返回:
            包含服务器状态的字典
        """
        uptime = time.time() - self.start_time

        return {
            "status": "running",
            "uptime": uptime,
            "uptime_formatted": self._format_uptime(uptime),
            "data_directory": str(self.data_dir),
            "devices": self.processor_manager.get_all_devices() if self.processor_manager else ["未初始化"],
            "active_connections": self.active_connections,
            "connection_limit": self.connection_limit,
            "version": "1.0.0"
        }

    def get_active_connections(self) -> int:
        """获取当前活跃连接数
        
        返回:
            当前活跃连接数
        """
        return self.active_connections

    def acquire_connection(self) -> bool:
        """
        获取一个连接

        返回:
            如果成功获取连接返回True，否则返回False
        """
        with self.connection_lock:
            if self.active_connections < self.connection_limit:
                self.active_connections += 1
                return True
            return False

    def release_connection(self):
        """释放一个连接"""
        with self.connection_lock:
            if self.active_connections > 0:
                self.active_connections -= 1

    def get_upload_path(self, filename: str) -> Path:
        """
        获取上传文件的路径

        参数:
            filename: 文件名

        返回:
            上传文件的完整路径
        """
        return self.uploads_dir / filename

    def get_result_path(self, result_name: str) -> Path:
        """
        获取结果文件的路径

        参数:
            result_name: 结果名称

        返回:
            结果文件的完整路径
        """
        return self.results_dir / result_name

    def process_patent(self, patent_file: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        处理单个专利

        参数:
            patent_file: 专利文件路径
            options: 处理选项

        返回:
            处理结果字典
        """
        if self.processor_manager is None:
            raise RuntimeError("处理器管理器未初始化")

        # 获取下一个可用的进程池和设备
        pool, device = self.processor_manager.get_next_pool()

        # 默认选项
        if options is None:
            options = {}

        # 准备任务参数
        task_args = {
            "patent_file": patent_file,
            "options": options,
            "output_dir": str(self.results_dir)
        }

        # 使用进程池异步执行任务
        from api.core.worker import process_patent_task
        result = pool.apply_async(process_patent_task, kwds=task_args)

        # 等待结果
        try:
            return result.get(timeout=600)  # 10分钟超时
        except Exception as e:
            logger.error(f"处理专利时发生错误: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "patent_file": patent_file
            }

    def shutdown(self):
        """关闭服务器核心"""
        logger.info("正在关闭服务器核心...")

        # 关闭线程池
        self.executor.shutdown(wait=False)

        # 关闭处理器管理器
        if self.processor_manager:
            self.processor_manager.shutdown()

        logger.info("服务器核心已关闭")

    def _format_uptime(self, seconds: float) -> str:
        """
        格式化运行时间

        参数:
            seconds: 运行秒数

        返回:
            格式化的运行时间字符串
        """
        days = int(seconds // 86400)
        seconds %= 86400
        hours = int(seconds // 3600)
        seconds %= 3600
        minutes = int(seconds // 60)
        seconds = int(seconds % 60)

        if days > 0:
            return f"{days}天 {hours}小时 {minutes}分钟 {seconds}秒"
        elif hours > 0:
            return f"{hours}小时 {minutes}分钟 {seconds}秒"
        elif minutes > 0:
            return f"{minutes}分钟 {seconds}秒"
        else:
            return f"{seconds}秒"

# 进程特定的处理器缓存 - 每个进程维护自己的缓存
_PROCESS_PROCESSORS = {}