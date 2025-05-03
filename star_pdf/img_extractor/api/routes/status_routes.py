"""
状态路由模块
包含服务器状态查询的API接口
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
import logging
import os
import platform
from typing import Dict, List, Any, Optional
from pydantic import BaseModel
import psutil
import torch
import time

logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()
# 服务器核心实例，将在注册路由时设置
server_core = None

class DeviceInfo(BaseModel):
    """设备信息模型"""
    id: int
    name: str
    available: bool
    memory_total: int
    memory_used: int
    cuda_version: Optional[str] = None
    driver_version: Optional[str] = None

class SystemInfo(BaseModel):
    """系统信息模型"""
    cpu_count: int
    cpu_usage: float
    memory_total: int
    memory_used: int
    platform: str
    python_version: str
    hostname: str
    uptime: float

class StatusResponse(BaseModel):
    """状态响应模型"""
    success: bool
    version: str = "1.0.0"
    status: str = "正常运行"  # 添加默认状态字段
    system: SystemInfo
    devices: List[DeviceInfo]
    active_connections: int
    max_connections: int
    started_time: float
    uptime: float
    message: Optional[str] = None

@router.get("/status", response_model=StatusResponse)
async def get_server_status():
    """
    获取服务器状态信息

    返回:
        StatusResponse: 服务器状态信息
    """
    if not server_core:
        logger.error("服务器核心未初始化")
        raise HTTPException(status_code=500, detail="服务器核心未初始化")

    try:
        # 输出调试信息
        logger.info(f"开始获取服务器状态，服务器核心：{server_core}")

        # 获取系统信息
        cpu_count = psutil.cpu_count()
        cpu_usage = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()

        system_info = SystemInfo(
            cpu_count=cpu_count,
            cpu_usage=cpu_usage,
            memory_total=memory.total,
            memory_used=memory.used,
            platform=platform.platform(),
            python_version=platform.python_version(),
            hostname=platform.node(),
            uptime=time.time() - psutil.boot_time()
        )

        # 获取GPU设备信息
        devices = []
        logger.info("开始获取GPU设备信息")
        if torch.cuda.is_available():
            cuda_version = torch.version.cuda
            for i in range(torch.cuda.device_count()):
                logger.info(f"处理GPU {i}")
                props = torch.cuda.get_device_properties(i)
                memory_total = props.total_memory
                memory_used = memory_total - torch.cuda.memory_reserved(i)

                # 获取驱动版本（如果可用）
                driver_version = getattr(torch.version, 'driver', None)
                if driver_version is None:
                    try:
                        # 尝试使用其他方式获取驱动版本
                        driver_version = torch.cuda.get_device_properties(i).driver_version
                    except:
                        driver_version = "未知"

                devices.append(DeviceInfo(
                    id=i,
                    name=props.name,
                    available=True,
                    memory_total=memory_total,
                    memory_used=memory_used,
                    cuda_version=cuda_version,
                    driver_version=driver_version
                ))
        else:
            logger.info("GPU不可用")

        # 获取连接信息
        logger.info("开始获取连接信息")
        started_time = server_core.start_time
        active_connections = server_core.get_active_connections()
        max_connections = server_core.connection_limit

        logger.info("构建响应数据")
        response = StatusResponse(
            success=True,
            system=system_info,
            devices=devices,
            active_connections=active_connections,
            max_connections=max_connections,
            started_time=started_time,
            uptime=time.time() - started_time
        )

        logger.info("状态查询成功完成")
        return response

    except Exception as e:
        logger.error(f"获取服务器状态失败: {str(e)}", exc_info=True)
        return StatusResponse(
            success=False,
            system=SystemInfo(
                cpu_count=0,
                cpu_usage=0,
                memory_total=0,
                memory_used=0,
                platform="",
                python_version="",
                hostname="",
                uptime=0
            ),
            devices=[],
            active_connections=0,
            max_connections=0,
            started_time=0,
            uptime=0,
            message=f"获取服务器状态失败: {str(e)}"
        )

@router.get("/ping")
async def ping():
    """
    简单的ping接口，用于测试服务器连接

    返回:
        Dict: 包含状态信息的字典
    """
    return {
        "status": "ok",
        "message": "化学式提取服务器正在运行",
        "timestamp": time.time()
    }

@router.get("/health")
async def health_check():
    """
    健康检查接口

    返回:
        JSONResponse: 健康状态
    """
    if not server_core:
        return JSONResponse(
            status_code=503,
            content={"status": "error", "message": "服务器核心未初始化"}
        )

    try:
        # 简单健康检查
        return JSONResponse(
            content={
                "status": "ok",
                "version": "1.0.0",
                "timestamp": time.time()
            }
        )
    except Exception as e:
        logger.error(f"健康检查失败: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"健康检查失败: {str(e)}"}
        )

def setup_routes(app, _server_core):
    """
    设置路由

    参数:
        app: FastAPI应用
        _server_core: 服务器核心
    """
    global server_core
    server_core = _server_core