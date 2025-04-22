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

# 全局锁，用于多进程同步
PROCESS_LOCK = multiprocessing.Lock()

# 全局任务计数器，跟踪每个设备上的任务数
DEVICE_TASK_COUNT = {}

# 全局进程池任务计数器
POOL_TASK_COUNT = {}

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
        
        # 为每个设备和进程池初始化任务计数
        for device in set(pool_device_map.values()):
            DEVICE_TASK_COUNT[device] = 0
        
        for i, pool in enumerate(process_pools):
            device = pool_device_map[pool]
            POOL_TASK_COUNT[f"{device}_{i}"] = 0
        
        # 记录每个进程池的状态
        self.pool_status = {pool: "ready" for pool in process_pools}
        self.pool_last_used = {pool: 0 for pool in process_pools}
        
        # 启动监控线程
        self.monitor_thread = threading.Thread(target=self._monitor_pools, daemon=True)
        self.monitor_thread.start()
        
        logger.info(f"处理器管理器初始化完成，管理 {len(process_pools)} 个进程池")

    def get_next_pool(self) -> tuple:
        """
        获取下一个可用的进程池和对应设备
        使用负载均衡策略分配

        返回:
            (进程池, 设备名称)
        """
        with self.pool_lock:
            # 找出负载最低的进程池
            min_tasks = float('inf')
            selected_pool = None
            selected_index = 0
            
            for i, pool in enumerate(self.process_pools):
                device = self.pool_device_map[pool]
                pool_key = f"{device}_{i}"
                
                # 获取当前任务数
                task_count = POOL_TASK_COUNT.get(pool_key, 0)
                
                # 如果找到更空闲的进程池，选择它
                if task_count < min_tasks:
                    min_tasks = task_count
                    selected_pool = pool
                    selected_index = i
            
            # 如果所有进程池都很忙，回退到轮询方式
            if selected_pool is None:
                selected_pool = self.process_pools[self.current_pool_index]
                selected_index = self.current_pool_index
                self.current_pool_index = (self.current_pool_index + 1) % len(self.process_pools)
            
            # 更新所选进程池的状态
            device = self.pool_device_map[selected_pool]
            pool_key = f"{device}_{selected_index}"
            
            # 增加任务计数
            DEVICE_TASK_COUNT[device] = DEVICE_TASK_COUNT.get(device, 0) + 1
            POOL_TASK_COUNT[pool_key] = POOL_TASK_COUNT.get(pool_key, 0) + 1
            
            # 更新使用时间
            self.pool_last_used[selected_pool] = time.time()
            self.pool_status[selected_pool] = "busy"
            
            logger.info(f"分配任务到进程池 {selected_index} (设备: {device})，当前负载: {POOL_TASK_COUNT[pool_key]}")
            
            return selected_pool, device

    def get_all_devices(self) -> List[str]:
        """
        获取所有可用设备列表

        返回:
            设备名称列表
        """
        return list(set(self.pool_device_map.values()))
    
    def get_pool_status(self) -> Dict[str, Any]:
        """
        获取所有进程池的状态信息
        
        返回:
            包含进程池状态的字典
        """
        status = {}
        for i, pool in enumerate(self.process_pools):
            device = self.pool_device_map[pool]
            pool_key = f"{device}_{i}"
            
            status[pool_key] = {
                "device": device,
                "status": self.pool_status.get(pool, "unknown"),
                "tasks": POOL_TASK_COUNT.get(pool_key, 0),
                "last_used": self.pool_last_used.get(pool, 0)
            }
        
        return status
    
    def _monitor_pools(self):
        """监控进程池状态的后台线程"""
        while True:
            try:
                # 每10秒更新一次状态
                time.sleep(10)
                
                with self.pool_lock:
                    current_time = time.time()
                    
                    # 检查每个进程池
                    for i, pool in enumerate(self.process_pools):
                        device = self.pool_device_map[pool]
                        pool_key = f"{device}_{i}"
                        
                        # 获取当前任务数
                        task_count = POOL_TASK_COUNT.get(pool_key, 0)
                        
                        # 如果没有任务且上次使用时间超过60秒，标记为idle
                        if task_count == 0 and (current_time - self.pool_last_used.get(pool, 0)) > 60:
                            self.pool_status[pool] = "idle"
                        elif task_count > 0:
                            self.pool_status[pool] = "busy"
                        else:
                            self.pool_status[pool] = "ready"
                
                # 周期性清理缓存
                gc.collect()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                
            except Exception as e:
                logger.error(f"进程池监控线程出错: {e}")

    def shutdown(self):
        """关闭所有进程池"""
        for pool in self.process_pools:
            try:
                pool.close()
                pool.join()
            except Exception as e:
                logger.error(f"关闭进程池时出错: {e}")
        
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
        
        # 获取进程池状态
        pool_status = {}
        if self.processor_manager:
            pool_status = self.processor_manager.get_pool_status()
        
        # 计算每个设备的负载
        device_loads = {}
        if self.processor_manager:
            for device in self.processor_manager.get_all_devices():
                device_loads[device] = DEVICE_TASK_COUNT.get(device, 0)

        return {
            "status": "running",
            "uptime": uptime,
            "uptime_formatted": self._format_uptime(uptime),
            "data_directory": str(self.data_dir),
            "devices": self.processor_manager.get_all_devices() if self.processor_manager else ["未初始化"],
            "device_loads": device_loads,
            "active_connections": self.active_connections,
            "connection_limit": self.connection_limit,
            "pool_status": pool_status,
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
        
        # 设置设备选项
        if 'device_id' not in options and device.startswith('cuda:'):
            try:
                device_id = int(device.split(':')[1])
                options['device_id'] = device_id
                logger.info(f"将任务分配到设备 {device}，设备ID: {device_id}")
            except Exception as e:
                logger.warning(f"解析设备ID出错: {e}")

        # 准备任务参数
        task_args = {
            "patent_file": patent_file,
            "options": options,
            "output_dir": str(self.results_dir)
        }

        # 使用进程池异步执行任务
        from api.core.worker import process_patent_task
        logger.info(f"使用进程池执行专利处理任务: {patent_file}")
        result = pool.apply_async(process_patent_task, kwds=task_args)

        # 等待结果
        try:
            return result.get(timeout=600)  # 10分钟超时
        except Exception as e:
            logger.error(f"处理专利时发生错误: {str(e)}")
            
            # 减少任务计数
            with PROCESS_LOCK:
                # 更新设备任务计数
                DEVICE_TASK_COUNT[device] = max(0, DEVICE_TASK_COUNT.get(device, 0) - 1)
                
                # 更新进程池任务计数
                for i, p in enumerate(self.processor_manager.process_pools):
                    if p == pool:
                        pool_key = f"{device}_{i}"
                        POOL_TASK_COUNT[pool_key] = max(0, POOL_TASK_COUNT.get(pool_key, 0) - 1)
                        break
            
            return {
                "success": False,
                "error": str(e),
                "patent_file": patent_file
            }

    def shutdown(self):
        """关闭服务器核心"""
        logger.info("正在关闭服务器核心...")
        
        if self.processor_manager:
            self.processor_manager.shutdown()
        
        if self.executor:
            self.executor.shutdown()
        
        logger.info("服务器核心已关闭")

    def _format_uptime(self, seconds: float) -> str:
        """
        格式化运行时间

        参数:
            seconds: 运行秒数

        返回:
            格式化的运行时间字符串
        """
        days, remainder = divmod(seconds, 86400)
        hours, remainder = divmod(remainder, 3600)
        minutes, seconds = divmod(remainder, 60)
        
        parts = []
        if days > 0:
            parts.append(f"{int(days)}天")
        if hours > 0:
            parts.append(f"{int(hours)}小时")
        if minutes > 0:
            parts.append(f"{int(minutes)}分钟")
        if seconds > 0 or not parts:
            parts.append(f"{int(seconds)}秒")
        
        return " ".join(parts)