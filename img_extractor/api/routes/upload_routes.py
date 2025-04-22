"""
上传和批处理路由模块
包含与上传和批处理相关的路由
"""
import os
import shutil
import tempfile
from pathlib import Path
from flask import request, jsonify

from api.core.server_core import app, get_next_device, get_or_create_process_pool
from api.core.worker import init_worker_process
from api.core.patent_task import process_patent_task, process_batch_patents
from api.utils.file_utils import extract_archive, find_patent_dirs

@app.route('/upload_and_process', methods=['POST'])
def upload_and_process():
    """上传并处理专利文件夹或压缩包"""
    # 检查是否是远程模式请求（JSON数据）
    if request.is_json:
        data = request.json
        if data.get('remote_mode', False):
            # 远程模式处理
            if 'patent_dir' in data:
                # 单个专利处理
                patent_dir = data['patent_dir']

                # 检查路径是否存在
                if not os.path.exists(patent_dir):
                    return jsonify({"success": False, "error": f"服务器上找不到路径: {patent_dir}"}), 404

                # 选择设备
                device = get_next_device()

                # 获取进程池
                pool = get_or_create_process_pool(
                    device,
                    pool_initializer=init_worker_process,
                    pool_initargs=(device,)
                )

                # 使用进程池处理专利
                result = pool.apply(process_patent_task, args=(patent_dir, device))

                return jsonify(result)

            elif 'path' in data and data.get('batch_mode', False):
                # 批处理模式
                path = data['path']

                # 检查路径是否存在
                if not os.path.exists(path):
                    return jsonify({"success": False, "error": f"服务器上找不到路径: {path}"}), 404

                # 判断是目录还是压缩包
                if os.path.isdir(path):
                    # 目录 - 查找所有专利子目录
                    patent_dirs = find_patent_dirs(path)

                    if not patent_dirs:
                        return jsonify({"success": False, "error": f"在目录 {path} 中未找到专利子目录"}), 400

                    # 处理所有专利
                    result = process_batch_patents(
                        patent_dirs,
                        get_next_device_func=get_next_device,
                        get_pool_func=lambda device: get_or_create_process_pool(
                            device,
                            pool_initializer=init_worker_process,
                            pool_initargs=(device,)
                        )
                    )

                    return jsonify(result)
                else:
                    # 压缩包 - 需要解压
                    temp_dir = extract_archive(path)
                    if not temp_dir:
                        return jsonify({"success": False, "error": f"无法解压文件: {path}"}), 400

                    try:
                        # 查找所有专利子目录
                        patent_dirs = find_patent_dirs(temp_dir)

                        if not patent_dirs:
                            return jsonify({"success": False, "error": f"在解压后的目录中未找到专利子目录"}), 400

                        # 处理所有专利
                        result = process_batch_patents(
                            patent_dirs,
                            get_next_device_func=get_next_device,
                            get_pool_func=lambda device: get_or_create_process_pool(
                                device,
                                pool_initializer=init_worker_process,
                                pool_initargs=(device,)
                            )
                        )

                        # 清理临时目录
                        shutil.rmtree(temp_dir, ignore_errors=True)

                        return jsonify(result)
                    except Exception as e:
                        # 清理临时目录
                        shutil.rmtree(temp_dir, ignore_errors=True)
                        return jsonify({"success": False, "error": f"处理压缩包时出错: {str(e)}"}), 500

    # 标准文件上传模式
    if 'patent_folder' not in request.files:
        return jsonify({"error": "缺少专利文件夹"}), 400

    patent_folder = request.files['patent_folder']

    # 创建临时目录
    temp_dir = tempfile.mkdtemp()
    try:
        # 保存上传的文件到临时目录
        patent_folder_path = os.path.join(temp_dir, patent_folder.filename)
        patent_folder.save(patent_folder_path)

        # 检查是否为批处理模式
        batch_mode = request.form.get('batch_mode', 'false').lower() == 'true'

        if batch_mode:
            # 批处理模式 - 判断是否为压缩包
            is_archive = any(patent_folder_path.lower().endswith(ext)
                            for ext in ['.zip', '.rar', '.tar', '.gz', '.7z'])

            if is_archive:
                # 解压压缩包
                extract_dir = extract_archive(patent_folder_path)
                if not extract_dir:
                    return jsonify({"success": False, "error": "无法解压文件"}), 400

                try:
                    # 查找所有专利子目录
                    patent_dirs = find_patent_dirs(extract_dir)

                    if not patent_dirs:
                        return jsonify({"success": False, "error": "在解压后的目录中未找到专利子目录"}), 400

                    # 处理所有专利
                    result = process_batch_patents(
                        patent_dirs,
                        get_next_device_func=get_next_device,
                        get_pool_func=lambda device: get_or_create_process_pool(
                            device,
                            pool_initializer=init_worker_process,
                            pool_initargs=(device,)
                        )
                    )

                    # 清理临时目录
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    if extract_dir and extract_dir != temp_dir:
                        shutil.rmtree(extract_dir, ignore_errors=True)

                    return jsonify(result)
                except Exception as e:
                    # 清理临时目录
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    if extract_dir and extract_dir != temp_dir:
                        shutil.rmtree(extract_dir, ignore_errors=True)
                    return jsonify({"success": False, "error": f"处理压缩包时出错: {str(e)}"}), 500
            else:
                # 非压缩包，假设它是一个目录结构
                # 查找所有专利子目录
                patent_dirs = find_patent_dirs(temp_dir)

                if not patent_dirs:
                    return jsonify({"success": False, "error": "在上传的目录中未找到专利子目录"}), 400

                # 处理所有专利
                result = process_batch_patents(
                    patent_dirs,
                    get_next_device_func=get_next_device,
                    get_pool_func=lambda device: get_or_create_process_pool(
                        device,
                        pool_initializer=init_worker_process,
                        pool_initargs=(device,)
                    )
                )

                # 清理临时目录
                shutil.rmtree(temp_dir, ignore_errors=True)

                return jsonify(result)
        else:
            # 单个专利处理模式
            # 选择设备
            device = get_next_device()

            # 获取进程池
            pool = get_or_create_process_pool(
                device,
                pool_initializer=init_worker_process,
                pool_initargs=(device,)
            )

            # 使用进程池处理专利
            result = pool.apply(process_patent_task, args=(patent_folder_path, device))

            # 清理临时目录
            if not result.get("success", False):
                # 如果处理失败，清理临时目录
                shutil.rmtree(temp_dir, ignore_errors=True)

            # 添加临时目录到响应
            result['temp_dir'] = temp_dir

            return jsonify(result)

    except Exception as e:
        # 清理临时目录
        shutil.rmtree(temp_dir, ignore_errors=True)

        import traceback
        traceback.print_exc()

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500