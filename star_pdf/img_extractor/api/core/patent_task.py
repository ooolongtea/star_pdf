"""
专利处理任务模块
定义专利处理的核心任务函数和批处理逻辑
"""
import os
import gc
import time
import torch
import random
import multiprocessing
import traceback
from pathlib import Path

from api.core.worker import get_processor_for_process, cleanup_patent_resources
from api.core.server_core import PROCESS_LOCK, DEVICE_TASK_COUNT, POOL_TASK_COUNT
from api.processors.patent_processor import PatentProcessor
from api.utils.result_manager import ResultManager

# 全局进度跟踪字典
TASK_PROGRESS = {}
TASK_PROGRESS_LOCK = multiprocessing.Lock()

def update_task_progress(task_id, status, progress=None, message=None, error=None):
    """
    更新任务进度信息

    参数:
        task_id: 任务ID
        status: 任务状态（'pending', 'running', 'completed', 'failed'）
        progress: 进度百分比（0-100）
        message: 进度消息
        error: 错误信息
    """
    with TASK_PROGRESS_LOCK:
        if task_id not in TASK_PROGRESS:
            TASK_PROGRESS[task_id] = {
                'status': 'pending',
                'progress': 0,
                'start_time': time.time(),
                'update_time': time.time(),
                'message': '等待处理'
            }

        if status:
            TASK_PROGRESS[task_id]['status'] = status

        if progress is not None:
            TASK_PROGRESS[task_id]['progress'] = progress

        if message:
            TASK_PROGRESS[task_id]['message'] = message

        if error:
            TASK_PROGRESS[task_id]['error'] = error

        TASK_PROGRESS[task_id]['update_time'] = time.time()

def get_task_progress(task_id):
    """
    获取任务进度信息

    参数:
        task_id: 任务ID

    返回:
        进度信息字典，如果不存在则返回None
    """
    with TASK_PROGRESS_LOCK:
        return TASK_PROGRESS.get(task_id, None)

def cleanup_old_tasks(max_age=3600):
    """
    清理旧任务的进度记录

    参数:
        max_age: 最大保留时间（秒）
    """
    current_time = time.time()
    with TASK_PROGRESS_LOCK:
        to_remove = []
        for task_id, info in TASK_PROGRESS.items():
            # 查找已完成或失败且超过保留时间的任务
            if info['status'] in ('completed', 'failed'):
                if current_time - info['update_time'] > max_age:
                    to_remove.append(task_id)

        # 删除旧任务
        for task_id in to_remove:
            del TASK_PROGRESS[task_id]

def process_patent_task_with_retry(patent_dir, device, task_id=None, max_retries=3):
    """
    使用指数退避重试机制处理专利

    参数:
        patent_dir: 专利目录路径
        device: 设备
        task_id: 任务ID，为None时自动生成
        max_retries: 最大重试次数

    返回:
        处理结果字典
    """
    # 如果未提供任务ID，使用目录名作为ID
    if task_id is None:
        task_id = f"{Path(patent_dir).name}_{int(time.time())}"

    # 初始化进度
    update_task_progress(task_id, 'pending')

    retry_count = 0
    last_error = None

    while retry_count <= max_retries:
        try:
            # 更新进度状态
            retry_message = f"(重试 {retry_count}/{max_retries})" if retry_count > 0 else ""
            update_task_progress(
                task_id,
                'running',
                progress=0,
                message=f"开始处理专利 {Path(patent_dir).name} {retry_message}"
            )

            # 执行实际处理
            result = process_patent_task_internal(patent_dir, device, task_id)

            # 处理成功，更新进度并返回结果
            if result.get("success", False):
                update_task_progress(
                    task_id,
                    'completed',
                    progress=100,
                    message=f"专利 {Path(patent_dir).name} 处理完成"
                )
            else:
                update_task_progress(
                    task_id,
                    'failed',
                    message=f"专利 {Path(patent_dir).name} 处理失败",
                    error=result.get("error", "未知错误")
                )

            return result

        except (torch.cuda.OutOfMemoryError, RuntimeError) as e:
            # 处理OOM和常见运行时错误
            error_str = str(e)
            last_error = error_str

            # 检查是否是OOM错误
            is_oom = isinstance(e, torch.cuda.OutOfMemoryError) or "CUDA out of memory" in error_str

            # 清理GPU内存
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

            # 执行垃圾回收
            gc.collect()

            # 更新进度
            retry_count += 1
            if retry_count <= max_retries:
                # 计算退避时间（指数增长）
                backoff_time = min(2 ** retry_count + random.uniform(0, 1), 30)

                update_task_progress(
                    task_id,
                    'running',
                    progress=0,
                    message=f"遇到{'内存不足' if is_oom else '运行时'}错误，{backoff_time:.1f}秒后重试 ({retry_count}/{max_retries})",
                    error=error_str
                )

                # 等待退避时间
                time.sleep(backoff_time)
            else:
                # 超过最大重试次数
                update_task_progress(
                    task_id,
                    'failed',
                    message=f"专利 {Path(patent_dir).name} 处理失败，超过最大重试次数",
                    error=error_str
                )

                return {
                    "success": False,
                    "patent_dir": patent_dir,
                    "error": f"处理失败，原因: {error_str}，已重试 {max_retries} 次"
                }

        except Exception as e:
            # 处理其他所有异常
            error_str = str(e)
            last_error = error_str
            traceback.print_exc()

            update_task_progress(
                task_id,
                'failed',
                message=f"专利 {Path(patent_dir).name} 处理失败，发生异常",
                error=error_str
            )

            return {
                "success": False,
                "patent_dir": patent_dir,
                "error": f"处理失败，原因: {error_str}"
            }

    # 不应该到达这里，但以防万一
    return {
        "success": False,
        "patent_dir": patent_dir,
        "error": f"处理失败，原因: {last_error if last_error else '未知错误'}"
    }

def process_patent_task_internal(patent_dir, device, task_id):
    """
    处理单个专利的内部函数，支持进度更新

    参数:
        patent_dir: 专利目录路径
        device: 设备
        task_id: 任务ID
    返回:
        处理结果字典
    """
    try:
        print(f"进程 {os.getpid()} 开始处理专利 {patent_dir} 在设备 {device}")
        update_task_progress(task_id, 'running', progress=5, message="检查专利目录")

        # 初始化patent_processor为None，便于后续检查
        patent_processor = None
        result_manager = None

        # 检查路径是否存在
        patent_path = Path(patent_dir)
        if not patent_path.exists():
            update_task_progress(task_id, 'failed', message="专利路径不存在", error=f"路径不存在: {patent_dir}")
            return {
                "success": False,
                "patent_dir": patent_dir,
                "error": f"专利路径不存在: {patent_dir}"
            }

        # 检查是否是压缩文件
        is_archive = any(patent_dir.lower().endswith(ext) for ext in ['.zip', '.rar', '.tar', '.gz', '.7z'])
        if is_archive:
            update_task_progress(task_id, 'running', progress=10, message="检测到压缩文件，正在解压")
            print(f"检测到压缩文件: {patent_dir}，正在解压")

            # 解压文件
            from api.utils.file_utils import extract_archive
            extract_dir = extract_archive(patent_dir)
            if not extract_dir:
                update_task_progress(task_id, 'failed', message="无法解压文件", error=f"无法解压文件: {patent_dir}")
                return {
                    "success": False,
                    "patent_dir": patent_dir,
                    "error": f"无法解压文件: {patent_dir}"
                }

            # 更新专利路径为解压后的目录
            patent_path = Path(extract_dir)
            update_task_progress(task_id, 'running', progress=15, message=f"文件已解压到: {extract_dir}")
            print(f"文件已解压到: {extract_dir}")

            # 查找专利目录
            potential_patent_dirs = [d for d in patent_path.iterdir() if d.is_dir() and (d / 'image').exists()]
            if potential_patent_dirs:
                # 使用第一个找到的专利目录
                patent_path = potential_patent_dirs[0]
                update_task_progress(task_id, 'running', progress=20,
                                   message=f"在解压目录中找到专利目录: {patent_path.name}")
                print(f"在解压目录中找到专利目录: {patent_path}")
            else:
                # 如果没有找到专利目录，继续使用解压目录
                update_task_progress(task_id, 'running', progress=20,
                                   message="在解压目录中未找到专利子目录，尝试使用解压目录")
                print(f"在解压目录中未找到专利子目录，尝试使用解压目录: {patent_path}")

        # 检查是否有image子目录（专利目录的特征）
        image_dir = patent_path / 'image'
        if not image_dir.exists():
            # 尝试查找是否有其他子目录可能是专利目录
            potential_patent_dirs = [d for d in patent_path.iterdir()
                                     if d.is_dir() and (d / 'image').exists()]

            if potential_patent_dirs:
                # 如果发现潜在专利目录，记录日志但继续处理原目录
                print(f"警告: {patent_dir} 没有image子目录，但发现 {len(potential_patent_dirs)} 个潜在专利子目录")
                print(f"这可能不是专利目录，但仍将尝试处理")
                update_task_progress(task_id, 'running', progress=10,
                                   message=f"发现 {len(potential_patent_dirs)} 个潜在专利子目录")
            else:
                print(f"警告: {patent_dir} 不是有效的专利目录（没有image子目录）")
                update_task_progress(task_id, 'running', progress=10, message="目录结构异常，尝试继续处理")

        update_task_progress(task_id, 'running', progress=15, message="初始化处理器")
        # 获取当前进程的处理器
        processor = get_processor_for_process(device)
        if processor is None:
            update_task_progress(task_id, 'failed', message="无法获取处理器",
                               error=f"无法获取设备 {device} 的处理器")
            return {
                "success": False,
                "patent_dir": patent_dir,
                "error": f"无法获取设备 {device} 的处理器"
            }

        # 为此专利创建单独的结果管理器
        result_manager = ResultManager(output_config={
            "json_results": True,
            "excel_results": True,
            "visualization": True,
            "intermediate_files": False
        })

        # 更新处理器的结果管理器
        processor.result_manager = result_manager

        update_task_progress(task_id, 'running', progress=20, message="创建专利处理器")
        # 创建专利处理器
        try:
            # 使用更新后的专利路径
            patent_processor = PatentProcessor(
                patent_dir=str(patent_path),  # 使用可能已更新的专利路径
                result_manager=result_manager,
                device="cuda:0" if device.startswith("cuda") else device,  # 在工作进程中使用正确的设备名称
                processor=processor
            )
        except Exception as e:
            print(f"创建专利处理器失败: {str(e)}")
            update_task_progress(task_id, 'failed', message="创建专利处理器失败", error=str(e))
            return {
                "success": False,
                "patent_dir": patent_dir,
                "error": f"创建专利处理器失败: {str(e)}"
            }

        # 检查patent_processor是否成功创建
        if patent_processor is None:
            print("专利处理器创建失败，返回None")
            update_task_progress(task_id, 'failed', message="专利处理器创建失败",
                              error="专利处理器对象为空")
            return {
                "success": False,
                "patent_dir": patent_dir,
                "error": "专利处理器对象为空"
            }

        # 处理专利
        update_task_progress(task_id, 'running', progress=25, message="开始专利处理")
        start_time = time.time()

        # 在这里我们可以捕获patent_processor.process的进度更新事件
        # 假设这个方法现在支持进度回调
        success = False
        try:
            success = patent_processor.process(
                progress_callback=lambda prog, msg: update_task_progress(
                    task_id, 'running', progress=25 + int(prog * 0.5), message=msg
                )
            )
        except Exception as e:
            print(f"专利处理过程出错: {str(e)}")
            update_task_progress(task_id, 'failed', message=f"专利处理过程出错: {str(e)}",
                               error=str(e))
            # 清理资源但保留处理器
            if result_manager is not None and patent_processor is not None:
                cleanup_patent_resources(result_manager, patent_processor)
            return {
                "success": False,
                "patent_dir": patent_dir,
                "error": f"专利处理过程出错: {str(e)}",
                "task_id": task_id
            }

        elapsed_time = time.time() - start_time

        if success and patent_processor is not None:
            # 保存结果
            update_task_progress(task_id, 'running', progress=80, message="保存处理结果")
            output_dir = patent_path  # 使用更新后的专利路径
            result_manager.save_results(output_dir)

            # 保存Excel
            update_task_progress(task_id, 'running', progress=90, message="生成Excel报告")
            try:
                excel_file = output_dir / f"{patent_path.name}_chemicals.xlsx"
                patent_processor.write_to_excel(excel_file)
            except Exception as e:
                print(f"生成Excel报告失败: {str(e)}")
                update_task_progress(task_id, 'failed', message=f"生成Excel报告失败: {str(e)}",
                                  error=str(e))
                # 清理资源但保留处理器
                cleanup_patent_resources(result_manager, patent_processor)
                return {
                    "success": False,
                    "patent_dir": patent_dir,
                    "error": f"生成Excel报告失败: {str(e)}",
                    "task_id": task_id
                }

            result = {
                "success": True,
                "patent_dir": str(patent_path),  # 使用更新后的专利路径
                "original_path": patent_dir,     # 保留原始路径
                "processing_time": elapsed_time,
                "output_dir": str(output_dir),
                "excel_file": str(excel_file),
                "task_id": task_id
            }

            # 清理资源但保留处理器
            update_task_progress(task_id, 'running', progress=95, message="清理资源")
            cleanup_patent_resources(result_manager, patent_processor)

            update_task_progress(task_id, 'completed', progress=100, message="处理完成")
            return result
        else:
            # 清理资源但保留处理器
            update_task_progress(task_id, 'running', progress=90, message="清理资源")
            if result_manager is not None and patent_processor is not None:
                cleanup_patent_resources(result_manager, patent_processor)

            error_message = "处理失败"
            if not success:
                error_message += "，可能没有找到可处理的图像"
            if patent_processor is None:
                error_message += "，专利处理器对象为空"

            update_task_progress(task_id, 'failed', message=error_message, error=error_message)
            return {
                "success": False,
                "patent_dir": patent_dir,
                "error": error_message,
                "task_id": task_id
            }

    except Exception as e:
        print(f"处理专利时发生错误：{str(e)}")
        traceback.print_exc()
        update_task_progress(task_id, 'failed', message=f"处理发生错误: {str(e)}", error=str(e))
        return {
            "success": False,
            "patent_dir": patent_dir,
            "error": str(e),
            "task_id": task_id
        }

# 替换原来的process_patent_task函数为新的重试版本
process_patent_task = process_patent_task_with_retry

def process_batch_patents(patent_dirs, get_next_device_func, get_pool_func):
    """
    处理多个专利目录

    参数:
        patent_dirs: 专利目录路径列表
        get_next_device_func: 获取下一个设备的函数
        get_pool_func: 获取或创建进程池的函数

    返回:
        处理结果的字典
    """
    # 生成批处理任务ID
    batch_id = f"batch_{int(time.time())}"

    # 为每个专利创建任务ID
    task_ids = {}
    for patent_dir in patent_dirs:
        task_id = f"{Path(patent_dir).name}_{int(time.time())}_{random.randint(1000, 9999)}"
        task_ids[patent_dir] = task_id
        # 初始化任务进度
        update_task_progress(task_id, 'pending', message=f"等待处理专利 {Path(patent_dir).name}")

    # 重置任务计数
    with PROCESS_LOCK:
        for device in DEVICE_TASK_COUNT.keys():
            DEVICE_TASK_COUNT[device] = 0
        for pool_key in POOL_TASK_COUNT.keys():
            POOL_TASK_COUNT[pool_key] = 0

    # 通过多线程处理不同设备的任务
    tasks = []
    patent_device_map = {}  # 跟踪每个专利使用的设备

    # 为每个专利分配任务到不同进程池
    for patent_dir in patent_dirs:
        try:
            # 选择设备
            device = get_next_device_func()
            patent_device_map[patent_dir] = device

            # 获取进程池
            pool = get_pool_func(device)

            # 获取任务ID
            task_id = task_ids[patent_dir]

            # 更新进度状态
            update_task_progress(task_id, 'pending', message=f"已分配到设备 {device}")

            # 使用apply_async进行异步处理，不阻塞
            task = pool.apply_async(
                process_patent_task_with_retry,
                args=(patent_dir, device, task_id, 3)  # 设置最大重试次数为3
            )
            tasks.append((patent_dir, task, task_id))

        except Exception as e:
            error_msg = f"提交任务失败: {patent_dir} - {str(e)}"
            print(error_msg)
            task_id = task_ids.get(patent_dir)
            if task_id:
                update_task_progress(task_id, 'failed', message="提交任务失败", error=str(e))

    # 收集结果
    results = []
    failures = []

    # 设置超时警告但不中断执行
    start_time = time.time()
    timeout_warning_shown = False

    # 等待所有任务完成
    for patent_dir, task, task_id in tasks:
        try:
            # 设置合理的超时时间
            result = task.get(timeout=1800)  # 30分钟超时

            # 任务完成后减少计数
            with PROCESS_LOCK:
                device = patent_device_map.get(patent_dir)
                if device and device in DEVICE_TASK_COUNT:
                    DEVICE_TASK_COUNT[device] = max(0, DEVICE_TASK_COUNT[device] - 1)

                # 找到并减少相应进程池的计数
                for pool_key in POOL_TASK_COUNT:
                    if pool_key.startswith(f"{device}_"):
                        POOL_TASK_COUNT[pool_key] = max(0, POOL_TASK_COUNT[pool_key] - 1)
                        break

            if result["success"]:
                results.append({
                    "patent_dir": patent_dir,
                    "output_dir": result.get("output_dir"),
                    "excel_file": result.get("excel_file"),
                    "task_id": task_id
                })
            else:
                failures.append({
                    "patent_dir": patent_dir,
                    "error": result.get("error", "未知错误"),
                    "task_id": task_id
                })
        except multiprocessing.TimeoutError:
            error_msg = "处理超时(30分钟)"
            failures.append({
                "patent_dir": patent_dir,
                "error": error_msg,
                "task_id": task_id
            })
            update_task_progress(task_id, 'failed', message="处理超时", error=error_msg)
        except Exception as e:
            error_msg = str(e)
            failures.append({
                "patent_dir": patent_dir,
                "error": error_msg,
                "task_id": task_id
            })
            update_task_progress(task_id, 'failed', message="处理发生异常", error=error_msg)

        # 显示长时间运行的警告
        current_time = time.time()
        if current_time - start_time > 600 and not timeout_warning_shown:  # 10分钟
            print("警告: 批处理任务运行时间较长，可能存在性能问题")
            timeout_warning_shown = True

    # 批处理完成后强制进行一次垃圾回收
    gc.collect()
    # 清理GPU缓存
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    # 定期清理旧任务记录
    cleanup_old_tasks()

    return {
        "success": len(failures) == 0,
        "processed": len(results),
        "failed": len(failures),
        "results": results,
        "failures": failures,
        "batch_id": batch_id
    }