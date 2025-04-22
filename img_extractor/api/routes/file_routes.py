"""
文件路由模块
包含文件列表和下载的API接口
"""
from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import FileResponse, JSONResponse
import logging
import os
from typing import Dict, List, Any, Optional
from pydantic import BaseModel
import mimetypes
from pathlib import Path

logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()
# 服务器核心实例，将在注册路由时设置
server_core = None

class FileInfo(BaseModel):
    """文件信息模型"""
    name: str
    path: str
    is_dir: bool
    size: Optional[int] = None
    mime_type: Optional[str] = None
    modified_time: Optional[str] = None

class DirectoryListResponse(BaseModel):
    """目录列表响应"""
    success: bool
    directory: str
    files: List[FileInfo]
    message: Optional[str] = None

@router.get("/list_files", response_model=DirectoryListResponse)
async def list_directory_files(dir_path: str = Query(..., description="要列出文件的目录路径")):
    """
    列出目录中的文件

    参数:
        dir_path: 目录路径

    返回:
        DirectoryListResponse: 目录列表响应
    """
    try:
        # 检查目录是否存在
        if not os.path.exists(dir_path) or not os.path.isdir(dir_path):
            return DirectoryListResponse(
                success=False,
                directory=dir_path,
                files=[],
                message=f"目录不存在: {dir_path}"
            )

        # 获取目录中的所有文件和文件夹
        file_list = []
        for item in os.listdir(dir_path):
            item_path = os.path.join(dir_path, item)
            is_dir = os.path.isdir(item_path)

            # 获取文件信息
            file_info = {
                "name": item,
                "path": item_path,
                "is_dir": is_dir
            }

            # 如果是文件，获取额外信息
            if not is_dir:
                try:
                    file_stat = os.stat(item_path)
                    file_info["size"] = file_stat.st_size
                    file_info["modified_time"] = str(file_stat.st_mtime)
                    file_info["mime_type"] = mimetypes.guess_type(item_path)[0] or "application/octet-stream"
                except Exception as e:
                    logger.warning(f"获取文件信息失败: {item_path}, 错误: {str(e)}")

            file_list.append(FileInfo(**file_info))

        # 按照文件夹在前，文件在后，然后按名称排序
        file_list.sort(key=lambda x: (not x.is_dir, x.name.lower()))

        return DirectoryListResponse(
            success=True,
            directory=dir_path,
            files=file_list
        )

    except Exception as e:
        logger.error(f"列出目录文件失败: {str(e)}")
        return DirectoryListResponse(
            success=False,
            directory=dir_path,
            files=[],
            message=f"列出目录文件失败: {str(e)}"
        )

@router.get("/download")
async def download_file(file_path: str = Query(..., description="要下载的文件路径")):
    """
    下载文件

    参数:
        file_path: 文件路径

    返回:
        FileResponse: 文件响应
    """
    try:
        # 检查文件是否存在
        if not os.path.exists(file_path) or os.path.isdir(file_path):
            raise HTTPException(status_code=404, detail=f"文件不存在或是一个目录: {file_path}")

        # 获取文件名
        filename = os.path.basename(file_path)

        # 返回文件
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type=mimetypes.guess_type(file_path)[0] or "application/octet-stream"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"下载文件失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"下载文件失败: {str(e)}")

@router.get("/search_files")
async def search_files(
    dir_path: str = Query(..., description="要搜索的目录路径"),
    pattern: str = Query(..., description="搜索模式，支持通配符"),
    recursive: bool = Query(False, description="是否递归搜索子目录")
):
    """
    搜索文件

    参数:
        dir_path: 目录路径
        pattern: 搜索模式，支持通配符
        recursive: 是否递归搜索子目录

    返回:
        DirectoryListResponse: 搜索结果
    """
    try:
        # 检查目录是否存在
        if not os.path.exists(dir_path) or not os.path.isdir(dir_path):
            return DirectoryListResponse(
                success=False,
                directory=dir_path,
                files=[],
                message=f"目录不存在: {dir_path}"
            )

        # 使用glob搜索文件
        import glob
        if recursive:
            search_pattern = os.path.join(dir_path, "**", pattern)
            files = glob.glob(search_pattern, recursive=True)
        else:
            search_pattern = os.path.join(dir_path, pattern)
            files = glob.glob(search_pattern)

        # 创建文件信息列表
        file_list = []
        for file_path in files:
            is_dir = os.path.isdir(file_path)

            # 获取文件信息
            file_info = {
                "name": os.path.basename(file_path),
                "path": file_path,
                "is_dir": is_dir
            }

            # 如果是文件，获取额外信息
            if not is_dir:
                try:
                    file_stat = os.stat(file_path)
                    file_info["size"] = file_stat.st_size
                    file_info["modified_time"] = str(file_stat.st_mtime)
                    file_info["mime_type"] = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
                except Exception as e:
                    logger.warning(f"获取文件信息失败: {file_path}, 错误: {str(e)}")

            file_list.append(FileInfo(**file_info))

        # 排序
        file_list.sort(key=lambda x: (not x.is_dir, x.name.lower()))

        return DirectoryListResponse(
            success=True,
            directory=dir_path,
            files=file_list,
            message=f"找到 {len(file_list)} 个匹配项"
        )

    except Exception as e:
        logger.error(f"搜索文件失败: {str(e)}")
        return DirectoryListResponse(
            success=False,
            directory=dir_path,
            files=[],
            message=f"搜索文件失败: {str(e)}"
        )

@router.get("/file_content")
async def get_file_content(
    file_path: str = Query(..., description="文件路径"),
    max_size: int = Query(1024 * 1024, description="最大读取字节数，默认1MB")
):
    """
    获取文件内容

    参数:
        file_path: 文件路径
        max_size: 最大读取字节数

    返回:
        Response: 文件内容响应
    """
    try:
        # 检查文件是否存在
        if not os.path.exists(file_path) or os.path.isdir(file_path):
            raise HTTPException(status_code=404, detail=f"文件不存在或是一个目录: {file_path}")

        # 检查文件大小
        file_size = os.path.getsize(file_path)
        if file_size > max_size:
            raise HTTPException(status_code=413, detail=f"文件过大，无法读取。文件大小: {file_size}字节，最大支持: {max_size}字节")

        # 猜测MIME类型
        mime_type = mimetypes.guess_type(file_path)[0]

        # 读取文件内容
        with open(file_path, "rb") as f:
            content = f.read()

        # 返回文件内容
        return Response(
            content=content,
            media_type=mime_type or "application/octet-stream"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"读取文件内容失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"读取文件内容失败: {str(e)}")

def setup_routes(app, _server_core):
    """
    设置路由

    参数:
        app: FastAPI应用
        _server_core: 服务器核心
    """
    global server_core
    server_core = _server_core