"""
文件路由模块
包含文件列表和下载的API接口
"""
from fastapi import APIRouter, HTTPException, Query, Response, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
import logging
import os
import shutil
import zipfile
import io
from typing import Dict, List, Any, Optional
from pydantic import BaseModel
import mimetypes
from pathlib import Path
import asyncio
import time
from api.utils.file_utils import get_file_size, get_file_type, find_patent_dirs
from api.utils.logger import get_logger

logger = get_logger(__name__)

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

class DownloadResponse(BaseModel):
    """下载响应模型"""
    success: bool
    message: str
    download_url: Optional[str] = None
    file_count: Optional[int] = None
    total_size: Optional[int] = None

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

        # 获取目录中的所有文件
        files = []
        for item in os.listdir(dir_path):
            item_path = os.path.join(dir_path, item)
            is_dir = os.path.isdir(item_path)

            try:
                # 获取文件信息
                size = None
                mime_type = None
                modified_time = None

                if not is_dir:
                    size = get_file_size(item_path)
                    mime_type = get_file_type(item_path)

                    # 获取修改时间
                    stat = os.stat(item_path)
                    modified_time = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(stat.st_mtime))

                files.append(FileInfo(
                    name=item,
                    path=item_path,
                    is_dir=is_dir,
                    size=size,
                    mime_type=mime_type,
                    modified_time=modified_time
                ))
            except Exception as e:
                logger.warning(f"获取文件 {item_path} 信息失败: {str(e)}")
                # 如果获取详细信息失败，仍添加基本信息
                files.append(FileInfo(
                    name=item,
                    path=item_path,
                    is_dir=is_dir
                ))

        # 按文件夹在前、文件在后的顺序排序，每类内部按名称排序
        files.sort(key=lambda x: (not x.is_dir, x.name))

        return DirectoryListResponse(
            success=True,
            directory=dir_path,
            files=files,
            message=f"共 {len(files)} 个文件/文件夹"
        )
    except Exception as e:
        logger.error(f"列出目录文件失败: {str(e)}")
        return DirectoryListResponse(
            success=False,
            directory=dir_path,
            files=[],
            message=f"列出目录文件失败: {str(e)}"
        )

async def create_zip_from_directory(directory_path: str) -> bytes:
    """
    将目录打包成zip文件

    参数:
        directory_path: 目录路径

    返回:
        bytes: zip文件的字节数据
    """
    if not os.path.exists(directory_path) or not os.path.isdir(directory_path):
        raise ValueError(f"目录不存在: {directory_path}")

    # 创建内存中的zip文件
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # 在根目录下添加所有文件和子目录
        for root, dirs, files in os.walk(directory_path):
            # 避免压缩隐藏文件和目录
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            files = [f for f in files if not f.startswith('.')]

            for file in files:
                file_path = os.path.join(root, file)
                # 计算相对路径
                rel_path = os.path.relpath(file_path, directory_path)
                try:
                    zipf.write(file_path, rel_path)
                except Exception as e:
                    logger.warning(f"压缩文件 {file_path} 失败: {str(e)}")

    # 返回zip文件的字节数据
    zip_buffer.seek(0)
    return zip_buffer.getvalue()

@router.get("/download_directory")
async def download_directory(dir_path: str = Query(..., description="要下载的目录路径")):
    """
    下载整个目录

    参数:
        dir_path: 目录路径

    返回:
        StreamingResponse: 流式响应包含zip文件
    """
    try:
        # 检查目录是否存在
        if not os.path.exists(dir_path) or not os.path.isdir(dir_path):
            raise HTTPException(status_code=404, detail=f"目录不存在: {dir_path}")

        # 创建zip文件
        zip_data = await create_zip_from_directory(dir_path)

        # 设置文件名为目录名+时间戳
        dir_name = os.path.basename(dir_path)
        timestamp = int(time.time())
        filename = f"{dir_name}_{timestamp}.zip"

        # 返回zip文件
        return StreamingResponse(
            io.BytesIO(zip_data),
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"打包目录失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"打包目录失败: {str(e)}")

@router.get("/download_result")
async def download_result(patent_id: str = Query(..., description="专利ID")):
    """
    下载专利处理结果

    参数:
        patent_id: 专利ID

    返回:
        StreamingResponse: 流式响应包含结果文件
    """
    try:
        if not server_core:
            raise HTTPException(status_code=500, detail="服务器核心未初始化")

        logger.info(f"开始查找专利 {patent_id} 的处理结果")

        # 初始化可能的路径列表
        potential_paths = []

        # 1. 首先检查标准结果目录
        result_path = server_core.get_result_path(patent_id)
        if os.path.exists(result_path) and os.path.isdir(result_path):
            potential_paths.append(result_path)
            logger.info(f"在标准结果目录找到专利: {result_path}")

        # 2. 检查数据目录下的各个子目录
        if hasattr(server_core, 'data_dir') and server_core.data_dir.exists():
            # 在服务器数据目录中查找
            for data_subdir in ['data', 'patents', 'uploads', 'temp_output']:
                potential_dir = server_core.data_dir / data_subdir
                if potential_dir.exists():
                    # 直接匹配专利ID
                    direct_match = potential_dir / patent_id
                    if direct_match.exists() and direct_match.is_dir():
                        potential_paths.append(direct_match)
                        logger.info(f"在 {data_subdir} 目录下找到专利: {direct_match}")

                    # 查找子目录
                    try:
                        for subdir in potential_dir.iterdir():
                            if subdir.is_dir() and subdir.name == patent_id:
                                potential_paths.append(subdir)
                                logger.info(f"在 {data_subdir} 的子目录中找到专利: {subdir}")
                    except Exception as e:
                        logger.warning(f"遍历 {potential_dir} 目录时出错: {str(e)}")

        # 3. 检查绝对路径
        # 如果专利ID是一个完整路径，直接检查该路径
        if os.path.sep in patent_id and os.path.exists(patent_id) and os.path.isdir(patent_id):
            potential_paths.append(Path(patent_id))
            logger.info(f"使用绝对路径找到专利: {patent_id}")

        # 4. 检查当前工作目录
        cwd_path = Path(os.getcwd()) / patent_id
        if cwd_path.exists() and cwd_path.is_dir():
            potential_paths.append(cwd_path)
            logger.info(f"在当前工作目录找到专利: {cwd_path}")

        # 如果没有找到任何目录，返回404错误
        if not potential_paths:
            logger.error(f"未找到专利 {patent_id} 的处理结果，已搜索所有可能的位置")
            raise HTTPException(status_code=404, detail=f"未找到专利 {patent_id} 的处理结果")

        # 使用找到的第一个目录
        result_path = potential_paths[0]
        logger.info(f"将使用专利目录: {result_path}")

        # 创建zip文件
        zip_data = await create_zip_from_directory(str(result_path))

        # 设置文件名
        filename = f"{patent_id}_results.zip"

        # 返回zip文件
        return StreamingResponse(
            io.BytesIO(zip_data),
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"下载专利结果失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"下载专利结果失败: {str(e)}")

# 添加别名路由，处理/api/download_result请求
@router.get("/download_results")
async def download_results_alias(patent_id: str = Query(..., description="专利ID")):
    """
    /api/download_result的别名路由，用于向后兼容

    参数:
        patent_id: 专利ID

    返回:
        StreamingResponse: 流式响应包含结果文件
    """
    return await download_result(patent_id=patent_id)

@router.get("/download_batch_results")
async def download_batch_results(result_dir: str = Query(..., description="批处理结果目录路径")):
    """
    下载批处理的所有结果

    参数:
        result_dir: 批处理结果目录路径

    返回:
        StreamingResponse: 流式响应包含结果文件
    """
    try:
        logger.info(f"尝试下载批处理结果，路径: {result_dir}")

        # 尝试处理可能的路径问题
        potential_paths = []

        # 1. 首先检查原始路径
        if os.path.exists(result_dir) and os.path.isdir(result_dir):
            potential_paths.append(result_dir)
            logger.info(f"原始路径存在: {result_dir}")

        # 1.1 检查原始路径下的results目录
        results_dir = os.path.join(result_dir, "results")
        if os.path.exists(results_dir) and os.path.isdir(results_dir):
            potential_paths.append(results_dir)
            logger.info(f"原始路径下的results目录存在: {results_dir}")

        # 2. 如果是远程路径，尝试在服务器数据目录中查找相应的目录
        if server_core and hasattr(server_core, 'data_dir'):
            # 提取目录名称
            dir_name = os.path.basename(result_dir)
            parent_dir = os.path.dirname(result_dir)
            parent_name = os.path.basename(parent_dir)

            # 在服务器数据目录中查找相应的目录
            for data_subdir in ['data', 'patents', 'uploads', 'temp_output', 'results']:
                # 检查数据目录下的子目录
                potential_dir = server_core.data_dir / data_subdir
                if potential_dir.exists():
                    # 检查是否有相同名称的目录
                    if (potential_dir / dir_name).exists() and (potential_dir / dir_name).is_dir():
                        potential_paths.append(potential_dir / dir_name)
                        logger.info(f"在数据目录中找到目录: {potential_dir / dir_name}")

                    # 检查是否有相同父目录名称的目录
                    if (potential_dir / parent_name).exists() and (potential_dir / parent_name).is_dir():
                        if (potential_dir / parent_name / dir_name).exists() and (potential_dir / parent_name / dir_name).is_dir():
                            potential_paths.append(potential_dir / parent_name / dir_name)
                            logger.info(f"在数据目录中找到目录: {potential_dir / parent_name / dir_name}")

        # 3. 如果是远程路径，尝试在当前工作目录中查找相应的目录
        dir_name = os.path.basename(result_dir)
        cwd_path = Path(os.getcwd()) / dir_name
        if cwd_path.exists() and cwd_path.is_dir():
            potential_paths.append(cwd_path)
            logger.info(f"在当前工作目录中找到目录: {cwd_path}")

        # 4. 如果是远程路径，尝试在当前工作目录的results子目录中查找
        results_path = Path(os.getcwd()) / "results"
        if results_path.exists() and results_path.is_dir():
            potential_paths.append(results_path)
            logger.info(f"在当前工作目录的results子目录中找到目录: {results_path}")

        # 如果没有找到任何目录，返回404错误
        if not potential_paths:
            logger.error(f"未找到批处理结果目录: {result_dir}")
            raise HTTPException(status_code=404, detail=f"批处理结果目录不存在: {result_dir}")

        # 使用找到的第一个目录
        actual_dir = str(potential_paths[0])
        logger.info(f"使用目录: {actual_dir}")

        # 创建zip文件
        zip_data = await create_zip_from_directory(actual_dir)

        # 设置文件名
        dir_name = os.path.basename(actual_dir)
        timestamp = int(time.time())
        filename = f"batch_results_{dir_name}_{timestamp}.zip"

        # 返回zip文件
        return StreamingResponse(
            io.BytesIO(zip_data),
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"下载批处理结果失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"下载批处理结果失败: {str(e)}")

@router.get("/download_file")
async def download_file(file_path: str = Query(..., description="要下载的文件路径")):
    """
    下载单个文件

    参数:
        file_path: 文件路径

    返回:
        FileResponse: 文件响应
    """
    try:
        # 检查文件是否存在
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"文件不存在: {file_path}")

        # 如果是目录，返回特定错误消息
        if os.path.isdir(file_path):
            logger.error(f"下载请求的路径是目录，不是文件: {file_path}")
            # 使用422状态码表示无法处理的实体
            raise HTTPException(
                status_code=422,
                detail=f"无法下载目录，请求的路径是目录而非文件: {file_path}"
            )

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
                    file_info["size"] = get_file_size(file_path)
                    file_info["mime_type"] = get_file_type(file_path)

                    # 获取修改时间
                    stat = os.stat(file_path)
                    file_info["modified_time"] = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(stat.st_mtime))
                except Exception as e:
                    logger.warning(f"获取文件 {file_path} 信息失败: {str(e)}")

            file_list.append(FileInfo(**file_info))

        # 按文件夹在前、文件在后的顺序排序，每类内部按名称排序
        file_list.sort(key=lambda x: (not x.is_dir, x.name))

        return DirectoryListResponse(
            success=True,
            directory=dir_path,
            files=file_list,
            message=f"共找到 {len(file_list)} 个匹配项"
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
        Dict: 包含文件内容的字典
    """
    try:
        # 检查文件是否存在
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"文件不存在: {file_path}")

        # 如果是目录，返回特定错误消息
        if os.path.isdir(file_path):
            raise HTTPException(status_code=422, detail=f"无法读取目录内容: {file_path}")

        # 获取文件大小
        file_size = os.path.getsize(file_path)
        if file_size > max_size:
            truncated = True
            content = f"文件太大，只显示前 {max_size} 字节。完整大小: {file_size} 字节"
        else:
            truncated = False
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read(max_size)
            except UnicodeDecodeError:
                # 如果不是文本文件，返回特定消息
                return {
                    "success": False,
                    "file_path": file_path,
                    "content": "此文件不是文本文件，无法显示内容",
                    "truncated": False,
                    "file_size": file_size,
                    "mime_type": mimetypes.guess_type(file_path)[0] or "unknown"
                }

        return {
            "success": True,
            "file_path": file_path,
            "content": content,
            "truncated": truncated,
            "file_size": file_size,
            "mime_type": mimetypes.guess_type(file_path)[0] or "text/plain"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"读取文件内容失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"读取文件内容失败: {str(e)}")

def setup_routes(app, _server_core):
    """
    设置路由

    参数:
        app: FastAPI应用实例
        _server_core: 服务器核心实例
    """
    global server_core
    server_core = _server_core
    app.include_router(router, prefix="/api", tags=["files"])

# 为了兼容旧代码，提供别名
setup_file_routes = setup_routes