"""
上传和批处理路由模块
包含与上传和批处理相关的路由
"""
import os
import shutil
import time
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse

from api.core.server_core import ServerCore
from api.core.worker import init_worker_process
from api.core.patent_task import process_patent_task, process_batch_patents
from api.utils.file_utils import extract_archive, find_patent_dirs
from api.utils.logger import get_logger

logger = get_logger(__name__)

# 创建路由器
router = APIRouter()
# 服务器核心实例，将在注册路由时设置
server_core = None

@router.post("/upload_and_process")
async def upload_and_process(
    patent_folder: UploadFile = File(...),
    batch_mode: Optional[str] = Form(None, description="批处理模式，true或false")
):
    """上传并处理专利文件夹或压缩包"""
    # 添加调试日志
    logger.info(f"接收到上传请求: 文件名={patent_folder.filename}, batch_mode={batch_mode}")

    # 使用指定的上传目录
    upload_dir = "/home/zhangxiaohong/zhouxingyu/zxy_extractor/data/tmp/patent_data/uploads"

    # 确保目录存在
    os.makedirs(upload_dir, exist_ok=True)

    # 创建带时间戳的子目录，避免文件名冲突
    timestamp = int(time.time())
    temp_dir = os.path.join(upload_dir, f"upload_{timestamp}")
    os.makedirs(temp_dir, exist_ok=True)

    logger.info(f"使用上传目录: {temp_dir}")

    try:
        # 保存上传的文件到临时目录
        patent_folder_path = os.path.join(temp_dir, patent_folder.filename)
        logger.info(f"保存上传文件到: {patent_folder_path}")

        with open(patent_folder_path, "wb") as buffer:
            shutil.copyfileobj(patent_folder.file, buffer)

        # 检查是否为批处理模式
        is_batch_mode = False
        if batch_mode is not None:
            # 处理字符串形式的布尔值
            if isinstance(batch_mode, str):
                is_batch_mode = batch_mode.lower() in ('true', 't', 'yes', 'y', '1')
            else:
                is_batch_mode = bool(batch_mode)

        if is_batch_mode:
            # 批处理模式 - 判断是否为压缩包
            is_archive = any(patent_folder_path.lower().endswith(ext)
                            for ext in ['.zip', '.rar', '.tar', '.gz', '.7z'])

            if is_archive:
                # 解压压缩包到指定目录
                extract_subdir = os.path.join(temp_dir, "extracted")
                os.makedirs(extract_subdir, exist_ok=True)
                extract_dir = extract_archive(patent_folder_path, extract_subdir)
                if not extract_dir:
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    raise HTTPException(status_code=400, detail="无法解压文件")

                try:
                    # 查找所有专利子目录
                    patent_dirs = find_patent_dirs(extract_dir)

                    if not patent_dirs:
                        shutil.rmtree(temp_dir, ignore_errors=True)
                        if extract_dir and extract_dir != temp_dir:
                            shutil.rmtree(extract_dir, ignore_errors=True)
                        raise HTTPException(status_code=400, detail="在解压后的目录中未找到专利子目录")

                    # 处理所有专利
                    result = process_batch_patents(
                        patent_dirs,
                        get_next_device_func=server_core.processor_manager.get_next_pool,
                        get_pool_func=lambda device: server_core.processor_manager.get_pool_for_device(device)
                    )

                    # 处理临时目录
                    if not result.get("success", False):
                        # 如果处理失败，清理临时目录
                        shutil.rmtree(temp_dir, ignore_errors=True)
                        if extract_dir and extract_dir != temp_dir:
                            shutil.rmtree(extract_dir, ignore_errors=True)
                        logger.info(f"批处理失败，清理临时目录: {temp_dir}")
                    else:
                        # 处理成功，保留目录
                        logger.info(f"批处理成功，保留目录: {temp_dir}")

                    # 添加下载链接
                    if result.get('success', False) and result.get('output_dir'):
                        # 使用输出目录作为下载路径
                        result['download_url'] = f"/api/download_batch_results?result_dir={result['output_dir']}"
                        logger.info(f"添加批处理下载链接: {result['download_url']}")

                    return result
                except Exception as e:
                    # 清理临时目录
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    if extract_dir and extract_dir != temp_dir:
                        shutil.rmtree(extract_dir, ignore_errors=True)
                    logger.error(f"处理压缩包时出错: {str(e)}")
                    raise HTTPException(status_code=500, detail=f"处理压缩包时出错: {str(e)}")
            else:
                # 非压缩包，假设它是一个目录结构
                # 查找所有专利子目录
                patent_dirs = find_patent_dirs(temp_dir)

                if not patent_dirs:
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    raise HTTPException(status_code=400, detail="在上传的目录中未找到专利子目录")

                # 处理所有专利
                result = process_batch_patents(
                    patent_dirs,
                    get_next_device_func=server_core.processor_manager.get_next_pool,
                    get_pool_func=lambda device: server_core.processor_manager.get_pool_for_device(device)
                )

                # 处理临时目录
                if not result.get("success", False):
                    # 如果处理失败，清理临时目录
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    logger.info(f"批处理失败，清理临时目录: {temp_dir}")
                else:
                    # 处理成功，保留目录
                    logger.info(f"批处理成功，保留目录: {temp_dir}")

                # 添加下载链接
                if result.get('success', False) and result.get('output_dir'):
                    # 使用输出目录作为下载路径
                    result['download_url'] = f"/api/download_batch_results?result_dir={result['output_dir']}"
                    logger.info(f"添加批处理下载链接: {result['download_url']}")

                return result
        else:
            # 单个专利处理模式
            # 选择设备
            pool, device = server_core.processor_manager.get_next_pool()

            # 检查是否是压缩文件
            is_archive = any(patent_folder_path.lower().endswith(ext)
                           for ext in ['.zip', '.rar', '.tar', '.gz', '.7z'])

            if is_archive:
                # 解压压缩包到指定目录
                extract_subdir = os.path.join(temp_dir, "extracted")
                os.makedirs(extract_subdir, exist_ok=True)
                extract_dir = extract_archive(patent_folder_path, extract_subdir)

                if not extract_dir:
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    raise HTTPException(status_code=400, detail="无法解压文件")

                # 查找解压目录中的专利子目录
                from api.utils.file_utils import find_patent_dirs
                patent_dirs = find_patent_dirs(extract_dir)

                if patent_dirs:
                    # 使用找到的第一个专利目录
                    patent_dir_to_process = patent_dirs[0]
                    logger.info(f"在解压目录中找到专利目录: {patent_dir_to_process}")
                    # 使用进程池处理找到的专利目录
                    result = pool.apply(process_patent_task, args=(patent_dir_to_process, device))
                else:
                    # 如果没有找到专利子目录，尝试直接使用解压目录
                    logger.warning(f"在解压目录中未找到专利子目录，尝试使用解压目录: {extract_dir}")
                    result = pool.apply(process_patent_task, args=(extract_dir, device))
            else:
                # 使用进程池处理专利
                result = pool.apply(process_patent_task, args=(patent_folder_path, device))

            # 处理临时目录
            if not result.get("success", False):
                # 如果处理失败，清理临时目录
                shutil.rmtree(temp_dir, ignore_errors=True)
                logger.info(f"处理失败，清理临时目录: {temp_dir}")
            else:
                # 处理成功，保留目录
                logger.info(f"处理成功，保留目录: {temp_dir}")

            # 添加临时目录到响应
            result['temp_dir'] = temp_dir

            # 添加下载链接
            if result.get('success', False):
                # 直接使用输出目录作为下载路径
                output_dir = result.get('output_dir')
                if output_dir and os.path.exists(output_dir):
                    # 使用目录下载路由
                    result['download_url'] = f"/api/download_directory?dir_path={output_dir}"
                    logger.info(f"添加输出目录下载链接: {result['download_url']}")
                else:
                    # 如果没有输出目录，使用临时目录
                    result['download_url'] = f"/api/download_directory?dir_path={temp_dir}"
                    logger.info(f"使用临时目录添加下载链接: {result['download_url']}")

            return result

    except HTTPException:
        raise
    except Exception as e:
        # 清理临时目录
        shutil.rmtree(temp_dir, ignore_errors=True)

        import traceback
        traceback.print_exc()
        logger.error(f"上传处理时出错: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# 添加一个备用路由，使用不同的参数格式
@router.post("/upload_and_process_alt")
async def upload_and_process_alt(
    patent_folder: UploadFile = File(...),
    batch_mode: Optional[bool] = Form(False, description="批处理模式")
):
    """上传并处理专利文件夹或压缩包（备用路由）"""
    # 调用主路由处理函数
    batch_mode_str = "true" if batch_mode else "false"
    return await upload_and_process(patent_folder, batch_mode_str)

def setup_routes(app, _server_core):
    """
    设置路由

    参数:
        app: FastAPI应用
        _server_core: 服务器核心
    """
    global server_core
    server_core = _server_core
    app.include_router(router, tags=["upload"])

# 为了兼容旧代码，提供别名
setup_upload_routes = setup_routes
