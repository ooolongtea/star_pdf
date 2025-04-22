"""
任务路由模块
包含任务管理和监控的API接口
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
import logging
import os
import time
from typing import Dict, List, Any, Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()
# 服务器核心实例，将在注册路由时设置
server_core = None

# 定义响应模型
class TaskInfo(BaseModel):
    """任务信息模型"""
    task_id: str
    status: str
    progress: float
    start_time: float
    end_time: Optional[float] = None
    patent_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

class TaskListResponse(BaseModel):
    """任务列表响应"""
    success: bool
    tasks: List[TaskInfo]
    total: int
    active: int
    completed: int
    failed: int
    message: Optional[str] = None

class TaskStatusResponse(BaseModel):
    """任务状态响应"""
    success: bool
    task_id: str
    status: str
    progress: float
    start_time: float
    end_time: Optional[float] = None
    patent_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    message: Optional[str] = None

@router.get("/tasks", response_model=TaskListResponse)
async def list_tasks():
    """
    获取所有任务列表

    返回:
        TaskListResponse: 任务列表响应
    """
    if not server_core:
        raise HTTPException(status_code=500, detail="服务器核心未初始化")

    try:
        # 这里应该从服务器核心获取任务列表
        # 由于目前没有实现任务管理系统，返回空列表
        return TaskListResponse(
            success=True,
            tasks=[],
            total=0,
            active=0,
            completed=0,
            failed=0,
            message="任务管理系统尚未实现"
        )

    except Exception as e:
        logger.error(f"获取任务列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取任务列表失败: {str(e)}")

@router.get("/task/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(task_id: str):
    """
    获取任务状态

    参数:
        task_id: 任务ID

    返回:
        TaskStatusResponse: 任务状态响应
    """
    if not server_core:
        raise HTTPException(status_code=500, detail="服务器核心未初始化")

    try:
        # 这里应该从服务器核心获取任务状态
        # 由于目前没有实现任务管理系统，返回错误
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取任务状态失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取任务状态失败: {str(e)}")

@router.delete("/task/{task_id}")
async def cancel_task(task_id: str):
    """
    取消任务

    参数:
        task_id: 任务ID

    返回:
        Dict: 取消结果
    """
    if not server_core:
        raise HTTPException(status_code=500, detail="服务器核心未初始化")

    try:
        # 这里应该从服务器核心取消任务
        # 由于目前没有实现任务管理系统，返回错误
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"取消任务失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"取消任务失败: {str(e)}")

def setup_routes(app, _server_core):
    """
    设置路由

    参数:
        app: FastAPI应用
        _server_core: 服务器核心
    """
    global server_core
    server_core = _server_core
