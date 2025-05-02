"""
批量处理路由模块
包含批量处理相关的API接口
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Form, UploadFile, File, Query
from fastapi.responses import JSONResponse, StreamingResponse
import logging
import os
import time
import json
import shutil
import tempfile
import asyncio
import io
import zipfile
from typing import Dict, List, Any, Optional
from pydantic import BaseModel

from api.utils.file_utils import extract_archive, find_patent_dirs
from api.utils.logger import get_logger

logger = get_logger(__name__)

# 创建路由器
router = APIRouter()
# 服务器核心实例，将在注册路由时设置
server_core = None

class BatchProcessResponse(BaseModel):
    """批量处理响应模型"""
    success: bool
    batch_id: str
    total_files: int
    processed_files: int
    failed_files: int
    message: str
    results_path: Optional[str] = None
    download_url: Optional[str] = None
    processing_time: float
    results: List[Dict[str, Any]] = []
    failures: List[Dict[str, Any]] = []

@router.post("/batch_process", response_model=BatchProcessResponse)
async def batch_process(
    files: List[UploadFile] = File(...),
    output_dir: Optional[str] = Form(None),
    options: Optional[str] = Form(None)
):
    """
    批量处理上传的文件
    
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
        # 生成批处理ID
        batch_id = f"batch_{int(time.time())}"
        
        # 创建临时目录用于存储上传的文件
        upload_dir = os.path.join(os.getcwd(), "uploads", batch_id)
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
            file_path = os.path.join(upload_dir, file.filename)
            
            # 保存文件
            with open(file_path, "wb") as f:
                contents = await file.read()
                f.write(contents)
            
            patent_files.append((patent_id, file_path))
        
        if not patent_files:
            return BatchProcessResponse(
                success=False,
                batch_id=batch_id,
                total_files=0,
                processed_files=0,
                failed_files=0,
                message="未上传任何文件",
                processing_time=time.time() - start_time,
                results=[],
                failures=[]
            )
        
        # 处理所有专利
        total = len(patent_files)
        processed = 0
        failed = 0
        results = []
        failures = []
        
        # 创建任务列表
        tasks = []
        for patent_id, file_path in patent_files:
            # 检查文件类型
            file_ext = os.path.splitext(file_path)[1].lower()
            
            # 如果是PDF文件，直接处理
            if file_ext == '.pdf':
                task = process_patent_file(
                    patent_id=patent_id,
                    file_path=file_path,
                    output_dir=output_dir,
                    options=process_options
                )
                tasks.append(task)
            # 如果是压缩文件，解压后处理
            elif file_ext in ['.zip', '.rar', '.tar', '.gz', '.7z']:
                # 解压文件
                extract_dir = extract_archive(file_path)
                if extract_dir:
                    # 查找所有专利子目录
                    patent_dirs = find_patent_dirs(extract_dir)
                    
                    if patent_dirs:
                        for patent_dir in patent_dirs:
                            sub_patent_id = os.path.basename(patent_dir)
                            task = process_patent_dir(
                                patent_id=sub_patent_id,
                                dir_path=patent_dir,
                                output_dir=output_dir,
                                options=process_options
                            )
                            tasks.append(task)
                    else:
                        # 如果没有找到专利子目录，将整个解压目录作为一个专利处理
                        task = process_patent_dir(
                            patent_id=patent_id,
                            dir_path=extract_dir,
                            output_dir=output_dir,
                            options=process_options
                        )
                        tasks.append(task)
                else:
                    # 解压失败
                    failures.append({
                        "patent_id": patent_id,
                        "file_path": file_path,
                        "message": "解压文件失败"
                    })
                    failed += 1
            # 其他文件类型
            else:
                # 尝试作为文档处理
                task = process_patent_file(
                    patent_id=patent_id,
                    file_path=file_path,
                    output_dir=output_dir,
                    options=process_options
                )
                tasks.append(task)
        
        # 并行执行所有任务
        if tasks:
            task_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # 处理结果
            for result in task_results:
                if isinstance(result, Exception):
                    # 处理异常
                    logger.error(f"处理任务时出错: {str(result)}")
                    failed += 1
                    failures.append({
                        "patent_id": "未知",
                        "message": f"处理失败: {str(result)}"
                    })
                elif result.get("success", False):
                    processed += 1
                    results.append(result)
                else:
                    failed += 1
                    failures.append({
                        "patent_id": result.get("patent_id", "未知"),
                        "message": result.get("message", "处理失败，未知原因")
                    })
        
        # 计算处理时间
        processing_time = time.time() - start_time
        
        # 获取输出目录路径
        results_path = output_dir if output_dir else os.path.join(upload_dir, "results")
        
        # 构造下载链接
        download_url = f"/api/download_batch_results?result_dir={results_path}"
        
        # 构造返回结果
        return BatchProcessResponse(
            success=processed > 0,
            batch_id=batch_id,
            total_files=total,
            processed_files=processed,
            failed_files=failed,
            message=f"批量处理完成，成功: {processed}，失败: {failed}",
            results_path=results_path,
            download_url=download_url,
            processing_time=processing_time,
            results=results,
            failures=failures
        )
    
    except Exception as e:
        logger.error(f"批量处理请求失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"批量处理请求失败: {str(e)}")

async def process_patent_file(patent_id: str, file_path: str, output_dir: Optional[str] = None, options: Optional[Dict[str, Any]] = None):
    """
    处理单个专利文件
    
    参数:
        patent_id: 专利ID
        file_path: 文件路径
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
                "task_id": f"task_{patent_id}_{int(time.time())}"
            }
        
        # 记录开始时间
        start_time = time.time()
        
        # 调用服务器核心处理专利
        result = server_core.process_patent(
            patent_file=file_path,
            options=options or {}
        )
        
        # 计算处理时间
        processing_time = time.time() - start_time
        
        # 构造下载链接
        download_url = None
        if result.get("success", False) and result.get("output_dir"):
            output_dir = result.get("output_dir")
            download_url = f"/api/download_results?patent_id={output_dir}"
        
        # 构造返回结果
        return {
            "success": result.get("success", False),
            "patent_id": patent_id,
            "file_path": file_path,
            "message": result.get("message", "处理完成"),
            "results_path": result.get("output_dir"),
            "download_url": download_url,
            "processing_time": processing_time,
            "task_id": f"task_{patent_id}_{int(time.time())}"
        }
    except Exception as e:
        logger.error(f"处理专利文件 {patent_id} 失败: {str(e)}")
        return {
            "success": False,
            "patent_id": patent_id,
            "file_path": file_path,
            "message": f"处理失败: {str(e)}",
            "processing_time": time.time() - start_time if 'start_time' in locals() else 0,
            "task_id": f"task_{patent_id}_{int(time.time())}"
        }

async def process_patent_dir(patent_id: str, dir_path: str, output_dir: Optional[str] = None, options: Optional[Dict[str, Any]] = None):
    """
    处理专利目录
    
    参数:
        patent_id: 专利ID
        dir_path: 目录路径
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
                "task_id": f"task_{patent_id}_{int(time.time())}"
            }
        
        # 记录开始时间
        start_time = time.time()
        
        # 调用服务器核心处理专利
        result = server_core.process_patent(
            patent_dir=dir_path,
            options=options or {}
        )
        
        # 计算处理时间
        processing_time = time.time() - start_time
        
        # 构造下载链接
        download_url = None
        if result.get("success", False) and result.get("output_dir"):
            output_dir = result.get("output_dir")
            download_url = f"/api/download_results?patent_id={output_dir}"
        
        # 构造返回结果
        return {
            "success": result.get("success", False),
            "patent_id": patent_id,
            "dir_path": dir_path,
            "message": result.get("message", "处理完成"),
            "results_path": result.get("output_dir"),
            "download_url": download_url,
            "processing_time": processing_time,
            "task_id": f"task_{patent_id}_{int(time.time())}"
        }
    except Exception as e:
        logger.error(f"处理专利目录 {patent_id} 失败: {str(e)}")
        return {
            "success": False,
            "patent_id": patent_id,
            "dir_path": dir_path,
            "message": f"处理失败: {str(e)}",
            "processing_time": time.time() - start_time if 'start_time' in locals() else 0,
            "task_id": f"task_{patent_id}_{int(time.time())}"
        }

@router.get("/files/list")
async def list_files(path: str = Query(..., description="要列出文件的目录路径")):
    """
    列出目录中的文件
    
    参数:
        path: 目录路径
        
    返回:
        Dict: 包含文件列表的字典
    """
    try:
        # 检查目录是否存在
        if not os.path.exists(path) or not os.path.isdir(path):
            return {
                "success": False,
                "message": f"目录不存在: {path}",
                "files": []
            }
        
        # 获取目录中的所有文件
        files = []
        for item in os.listdir(path):
            item_path = os.path.join(path, item)
            is_dir = os.path.isdir(item_path)
            
            # 获取文件信息
            file_info = {
                "name": item,
                "path": item_path,
                "is_dir": is_dir
            }
            
            # 如果是文件，获取文件大小
            if not is_dir:
                try:
                    file_info["size"] = os.path.getsize(item_path)
                except:
                    pass
            
            files.append(file_info)
        
        # 按文件夹在前、文件在后的顺序排序，每类内部按名称排序
        files.sort(key=lambda x: (not x["is_dir"], x["name"]))
        
        return {
            "success": True,
            "message": f"共 {len(files)} 个文件/文件夹",
            "files": files
        }
    except Exception as e:
        logger.error(f"列出目录文件失败: {str(e)}")
        return {
            "success": False,
            "message": f"列出目录文件失败: {str(e)}",
            "files": []
        }

@router.get("/files/download_file")
async def download_file(file_path: str = Query(..., description="要下载的文件路径")):
    """
    下载单个文件
    
    参数:
        file_path: 文件路径
        
    返回:
        StreamingResponse: 文件流
    """
    try:
        # 检查文件是否存在
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"文件不存在: {file_path}")
        
        # 如果是目录，返回特定错误消息
        if os.path.isdir(file_path):
            raise HTTPException(status_code=422, detail=f"无法下载目录: {file_path}")
        
        # 获取文件名
        filename = os.path.basename(file_path)
        
        # 读取文件内容
        with open(file_path, "rb") as f:
            file_content = f.read()
        
        # 返回文件流
        return StreamingResponse(
            io.BytesIO(file_content),
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"下载文件失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"下载文件失败: {str(e)}")

def setup_routes(app, _server_core):
    """
    设置路由
    
    参数:
        app: FastAPI应用
        _server_core: 服务器核心
    """
    global server_core
    server_core = _server_core
    app.include_router(router, tags=["batch"])

# 为了兼容旧代码，提供别名
setup_batch_routes = setup_routes
