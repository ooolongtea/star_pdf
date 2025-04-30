"""
服务器主程序
启动和配置API服务器
"""
import os
import gc
import sys
import time
import json
import uvicorn
import argparse
import logging
import multiprocessing
from pathlib import Path
from typing import List, Dict, Any, Optional

import torch
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# 导入核心组件
from api.core.server_core import ServerCore, ProcessorManager
from api.core.worker import init_worker_process
from api.routes import register_routes

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ServerMain")

# 创建FastAPI应用
app = FastAPI(
    title="专利图像提取API",
    description="提供专利图像和表格提取的RESTful API",
    version="1.0.0"
)

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],  # 暴露Content-Disposition头，必须为下载提供
)

# 全局服务器核心实例
server_core: Optional[ServerCore] = None

@app.on_event("startup")
async def startup_event():
    """服务器启动事件处理函数"""
    global server_core

    # 初始化服务器核心
    if server_core is None:
        logger.error("服务器核心未初始化，无法启动服务")
        sys.exit(1)

    # 显示启动信息
    logger.info("=" * 60)
    logger.info("服务器已成功启动")
    logger.info("=" * 60)

    logger.info("服务器启动完成")

@app.on_event("shutdown")
async def shutdown_event():
    """服务器关闭事件处理函数"""
    global server_core

    if server_core:
        server_core.shutdown()

    logger.info("服务器已关闭")

def init_server(data_dir: str = None,
                connection_limit: int = 500,
                gpu_devices: List[str] = None,
                num_processes: int = 8) -> ServerCore:
    """
    初始化服务器

    参数:
        data_dir: 数据目录
        connection_limit: 最大连接数
        gpu_devices: GPU设备列表
        num_processes: 每个设备的进程数

    返回:
        服务器核心实例
    """
    # 设置多进程启动方法
    # 对于CUDA应用，必须使用'spawn'方法，而不是'fork'
    # 因为PyTorch的CUDA功能在fork的子进程中无法正确初始化
    try:
        multiprocessing.set_start_method('spawn', force=True)
    except RuntimeError as e:
        logger.warning(f"设置多进程启动方法时出错: {e}")

    # 创建服务器核心
    server = ServerCore(data_dir=data_dir, connection_limit=connection_limit)

    # 确定可用的GPU设备
    if not gpu_devices:
        if torch.cuda.is_available():
            gpu_devices = [f"cuda:{i}" for i in range(torch.cuda.device_count())]
            if not gpu_devices:
                gpu_devices = ["cpu"]
        else:
            gpu_devices = ["cpu"]
    else:
        # 确保gpu_devices列表中的每个设备都有正确的"cuda:"前缀
        gpu_devices = [f"cuda:{device}" if not device.startswith("cuda:") else device
                     for device in gpu_devices]

    logger.info(f"使用设备: {gpu_devices}")

    # 为每个设备创建进程池
    process_pools = []
    pool_device_map = {}

    # 根据设备类型分配进程数
    device_processes = {}

    # 如果有多个CUDA设备，根据显存大小分配进程数
    cuda_devices = [d for d in gpu_devices if d.startswith('cuda:')]
    if len(cuda_devices) > 1:
        # 获取每个设备的显存大小
        device_memory = {}
        total_memory = 0

        for device in cuda_devices:
            try:
                device_id = int(device.split(':')[1])
                props = torch.cuda.get_device_properties(device_id)
                memory_gb = props.total_memory / (1024**3)  # 转换为GB
                device_memory[device] = memory_gb
                total_memory += memory_gb
                # logger.info(f"设备 {device} 的显存大小: {memory_gb:.2f} GB")
            except Exception as e:
                logger.warning(f"获取设备 {device} 的显存信息时出错: {e}")
                device_memory[device] = 1.0  # 默认值
                total_memory += 1.0

        # 根据显存比例分配进程数
        for device, memory in device_memory.items():
            # 按显存比例分配进程数，但至少保证每个设备有1个进程
            device_processes[device] = max(1, int(num_processes * (memory / total_memory)))
            logger.info(f"设备 {device} 分配的进程数: {device_processes[device]}")
    else:
        # 如果只有一个设备或者只有CPU，则均匀分配
        for device in gpu_devices:
            device_processes[device] = num_processes
            logger.info(f"设备 {device} 分配的进程数: {device_processes[device]}")

    # 为每个设备创建进程池
    for device in gpu_devices:
        # 获取该设备的进程数
        device_num_processes = device_processes.get(device, num_processes)

        # 为每个设备创建指定数量的进程
        # 当一个任务完成后，进程不会被销毁，而是返回到池中等待下一个任务
        pool = multiprocessing.Pool(
            processes=device_num_processes,
            initializer=init_worker_process,
            initargs=(device,)
        )
        process_pools.append(pool)
        pool_device_map[pool] = device
        logger.info(f"为设备 {device} 创建了 {device_num_processes} 个进程")

    # 创建并注册处理器管理器
    processor_manager = ProcessorManager(process_pools, pool_device_map)
    server.register_processor_manager(processor_manager)

    return server

def main():
    """
    主函数
    解析命令行参数并启动服务器
    """
    parser = argparse.ArgumentParser(description="启动专利图像提取API服务器")
    parser.add_argument('--host', type=str, default='0.0.0.0', help='服务器主机名')
    parser.add_argument('--port', type=int, default=8011, help='服务器端口')
    parser.add_argument('--data-dir', type=str, default=None, help='数据目录路径')
    parser.add_argument('--gpu-devices', type=str, default=None, help='GPU设备列表，以逗号分隔，例如 "cuda:0,cuda:1" 或 "0,1"')
    parser.add_argument('--connection-limit', type=int, default=500, help='最大连接数')
    parser.add_argument('--processes', type=int, default=8, help='每个设备使用的进程数')
    parser.add_argument('--debug', action='store_true', help='启用调试模式')

    args = parser.parse_args()

    # 处理GPU设备参数
    gpu_devices = None
    if args.gpu_devices:
        gpu_devices = args.gpu_devices.split(',')
        # 检查并修复设备格式
        gpu_devices = [device.strip() for device in gpu_devices]
        # logger.info(f"命令行指定的GPU设备: {gpu_devices}")

    # 初始化服务器核心
    global server_core
    server_core = init_server(
        data_dir=args.data_dir,
        connection_limit=args.connection_limit,
        gpu_devices=gpu_devices,
        num_processes=args.processes
    )

    # 注册路由
    register_routes(app, server_core)

    # 获取本机IP地址
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip_address = s.getsockname()[0]
        s.close()
    except:
        ip_address = "无法获取IP地址"

    # 显示服务器连接信息
    connection_url = f"http://{ip_address}:{args.port}"
    logger.info("=" * 60)
    logger.info(f"服务器连接信息: {connection_url}")
    logger.info("=" * 60)

    # 启动服务器
    logger.info(f"启动服务器: http://{args.host}:{args.port}")
    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        log_level="debug" if args.debug else "info"
    )

if __name__ == "__main__":
    main()