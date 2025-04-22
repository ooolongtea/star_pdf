"""
处理路由模块
包含专利处理和批量处理的API接口
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Form, UploadFile, File
from fastapi.responses import JSONResponse
import logging
import os
import time
import json
from typing import Dict, List, Any, Optional
from pydantic import BaseModel
import asyncio

logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()
# 服务器核心实例，将在注册路由时设置
server_core = None

# 定义响应模型
class ProcessResponse(BaseModel):
    """处理响应模型"""
    success: bool
    patent_id: str
    message: str
    results_path: Optional[str] = None
    processing_time: float
    details: Optional[Dict[str, Any]] = None

class BatchProcessResponse(BaseModel):
    """批量处理响应模型"""
    success: bool
    total: int
    processed: int
    failed: int
    message: str
    results_path: Optional[str] = None
    processing_time: float
    failed_patents: Optional[List[Dict[str, Any]]] = None

class ProcessRequest(BaseModel):
    """处理请求模型"""
    patent_id: str
    patent_path: str
    output_dir: Optional[str] = None
    options: Optional[Dict[str, Any]] = None

class BatchProcessRequest(BaseModel):
    """批量处理请求模型"""
    patent_dir: str
    output_dir: Optional[str] = None
    options: Optional[Dict[str, Any]] = None
    file_pattern: Optional[str] = "*.pdf"

# 后台任务
async def _process_patent_task(patent_id: str, patent_path: str, output_dir: Optional[str] = None, options: Optional[Dict[str, Any]] = None):
    """
    后台处理专利任务

    参数:
        patent_id: 专利ID
        patent_path: 专利文件路径
        output_dir: 输出目录
        options: 处理选项

    返回:
        Dict: 处理结果
    """
    try:
        if not server_core:
            return {
                "success": False,
                "patent_id": patent_id,
                "message": "服务器核心未初始化",
                "processing_time": 0
            }

        # 记录开始时间
        start_time = time.time()

        # 调用服务器核心处理专利
        result = server_core.process_patent(
            patent_file=patent_path,
            options=options or {}
        )

        # 计算处理时间
        processing_time = time.time() - start_time

        # 构造返回结果
        return {
            "success": result.get("success", False),
            "patent_id": patent_id,
            "message": result.get("message", "处理完成"),
            "results_path": result.get("output_dir"),
            "processing_time": processing_time,
            "details": result
        }
    except Exception as e:
        logger.error(f"处理专利 {patent_id} 失败: {str(e)}")
        return {
            "success": False,
            "patent_id": patent_id,
            "message": f"处理失败: {str(e)}",
            "processing_time": time.time() - start_time if 'start_time' in locals() else 0
        }

@router.post("/process_patent", response_model=ProcessResponse)
async def process_patent(request: ProcessRequest, background_tasks: BackgroundTasks):
    """
    处理单个专利

    参数:
        request: 处理请求
        background_tasks: 后台任务

    返回:
        ProcessResponse: 处理响应
    """
    if not server_core:
        raise HTTPException(status_code=500, detail="服务器核心未初始化")

    try:
        # 验证专利路径（如果不是远程模式）
        remote_mode = request.options.get("remote_mode", False) if request.options else False

        if not remote_mode and not os.path.exists(request.patent_path):
            raise HTTPException(status_code=404, detail=f"专利文件不存在: {request.patent_path}")

        # 处理专利
        result = await _process_patent_task(
            patent_id=request.patent_id,
            patent_path=request.patent_path,
            output_dir=request.output_dir,
            options=request.options
        )

        return ProcessResponse(**result)

    except Exception as e:
        logger.error(f"处理专利请求失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"处理专利请求失败: {str(e)}")

@router.post("/process_batch", response_model=BatchProcessResponse)
async def process_batch(request: BatchProcessRequest):
    """
    批量处理专利

    参数:
        request: 批量处理请求

    返回:
        BatchProcessResponse: 批量处理响应
    """
    if not server_core:
        raise HTTPException(status_code=500, detail="服务器核心未初始化")

    try:
        # 验证目录路径（如果不是远程模式）
        remote_mode = request.options.get("remote_mode", False) if request.options else False

        if not remote_mode and (not os.path.exists(request.patent_dir) or not os.path.isdir(request.patent_dir)):
            raise HTTPException(status_code=404, detail=f"专利目录不存在: {request.patent_dir}")

        # 记录开始时间
        start_time = time.time()

        # 获取目录中的所有PDF文件
        import glob
        patent_files = glob.glob(os.path.join(request.patent_dir, request.file_pattern))

        if not patent_files:
            return BatchProcessResponse(
                success=False,
                total=0,
                processed=0,
                failed=0,
                message=f"在目录 {request.patent_dir} 中未找到匹配 {request.file_pattern} 的文件",
                processing_time=time.time() - start_time
            )

        # 处理所有专利
        total = len(patent_files)
        processed = 0
        failed = 0
        failed_patents = []

        # 创建任务列表
        tasks = []
        for file_path in patent_files:
            patent_id = os.path.splitext(os.path.basename(file_path))[0]
            task = _process_patent_task(
                patent_id=patent_id,
                patent_path=file_path,
                output_dir=request.output_dir,
                options=request.options
            )
            tasks.append(task)

        # 并行执行所有任务
        results = await asyncio.gather(*tasks)

        # 处理结果
        for result in results:
            if result.get("success", False):
                processed += 1
            else:
                failed += 1
                failed_patents.append({
                    "patent_id": result.get("patent_id", "未知"),
                    "message": result.get("message", "处理失败，未知原因")
                })

        # 计算处理时间
        processing_time = time.time() - start_time

        # 获取输出目录路径
        results_path = request.output_dir if request.output_dir else os.path.join(request.patent_dir, "results")

        # 构造返回结果
        return BatchProcessResponse(
            success=processed > 0,
            total=total,
            processed=processed,
            failed=failed,
            message=f"批量处理完成，成功: {processed}，失败: {failed}",
            results_path=results_path,
            processing_time=processing_time,
            failed_patents=failed_patents if failed > 0 else None
        )

    except Exception as e:
        logger.error(f"批量处理请求失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"批量处理请求失败: {str(e)}")

@router.post("/upload_and_process")
async def upload_and_process(
    background_tasks: BackgroundTasks,
    patent_id: str = Form(...),
    file: UploadFile = File(...),
    output_dir: Optional[str] = Form(None),
    options: Optional[str] = Form(None)
):
    """
    上传并处理专利文件

    参数:
        background_tasks: 后台任务
        patent_id: 专利ID
        file: 上传的文件
        output_dir: 输出目录
        options: 处理选项（JSON字符串）

    返回:
        Dict: 处理结果
    """
    if not server_core:
        raise HTTPException(status_code=500, detail="服务器核心未初始化")

    try:
        # 创建临时目录用于存储上传的文件
        upload_dir = os.path.join(os.getcwd(), "uploads")
        os.makedirs(upload_dir, exist_ok=True)

        # 保存上传的文件
        file_path = os.path.join(upload_dir, f"{patent_id}.pdf")
        with open(file_path, "wb") as f:
            contents = await file.read()
            f.write(contents)

        # 解析处理选项
        process_options = {}
        if options:
            try:
                process_options = json.loads(options)
            except json.JSONDecodeError:
                logger.warning(f"无法解析处理选项: {options}")

        # 处理专利
        result = await _process_patent_task(
            patent_id=patent_id,
            patent_path=file_path,
            output_dir=output_dir,
            options=process_options
        )

        return ProcessResponse(**result)

    except Exception as e:
        logger.error(f"上传并处理专利失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"上传并处理专利失败: {str(e)}")

@router.post("/upload_batch_and_process")
async def upload_batch_and_process(
    files: List[UploadFile] = File(...),
    output_dir: Optional[str] = Form(None),
    options: Optional[str] = Form(None)
):
    """
    批量上传并处理专利文件

    参数:
        files: 上传的文件列表
        output_dir: 输出目录
        options: 处理选项（JSON字符串）

    返回:
        BatchProcessResponse: 批量处理响应
    """
    if not server_core:
        raise HTTPException(status_code=500, detail="服务器核心未初始化")

    try:
        # 创建临时目录用于存储上传的文件
        upload_dir = os.path.join(os.getcwd(), "uploads", f"batch_{int(time.time())}")
        os.makedirs(upload_dir, exist_ok=True)

        # 记录开始时间
        start_time = time.time()

        # 解析处理选项
        process_options = {}
        if options:
            try:
                process_options = json.loads(options)
            except json.JSONDecodeError:
                logger.warning(f"无法解析处理选项: {options}")

        # 保存所有上传的文件
        patent_files = []
        for file in files:
            # 从文件名获取专利ID
            patent_id = os.path.splitext(file.filename)[0]
            file_path = os.path.join(upload_dir, f"{patent_id}.pdf")

            # 保存文件
            with open(file_path, "wb") as f:
                contents = await file.read()
                f.write(contents)

            patent_files.append((patent_id, file_path))

        if not patent_files:
            return BatchProcessResponse(
                success=False,
                total=0,
                processed=0,
                failed=0,
                message="未上传任何文件",
                processing_time=time.time() - start_time
            )

        # 处理所有专利
        total = len(patent_files)
        processed = 0
        failed = 0
        failed_patents = []

        # 创建任务列表
        tasks = []
        for patent_id, file_path in patent_files:
            task = _process_patent_task(
                patent_id=patent_id,
                patent_path=file_path,
                output_dir=output_dir,
                options=process_options
            )
            tasks.append(task)

        # 并行执行所有任务
        results = await asyncio.gather(*tasks)

        # 处理结果
        for result in results:
            if result.get("success", False):
                processed += 1
            else:
                failed += 1
                failed_patents.append({
                    "patent_id": result.get("patent_id", "未知"),
                    "message": result.get("message", "处理失败，未知原因")
                })

        # 计算处理时间
        processing_time = time.time() - start_time

        # 获取输出目录路径
        results_path = output_dir if output_dir else os.path.join(upload_dir, "results")

        # 构造返回结果
        return BatchProcessResponse(
            success=processed > 0,
            total=total,
            processed=processed,
            failed=failed,
            message=f"批量处理完成，成功: {processed}，失败: {failed}",
            results_path=results_path,
            processing_time=processing_time,
            failed_patents=failed_patents if failed > 0 else None
        )

    except Exception as e:
        logger.error(f"批量上传并处理专利失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"批量上传并处理专利失败: {str(e)}")

def setup_routes(app, _server_core):
    """
    设置路由

    参数:
        app: FastAPI应用
        _server_core: 服务器核心
    """
    global server_core
    server_core = _server_core

# 为了兼容旧代码，提供别名
setup_process_routes = setup_routes