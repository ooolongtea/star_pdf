import os
import time
import json
import shutil
import logging
from flask import Flask, request, jsonify
from pathlib import Path
import tempfile
import torch
import multiprocessing
from functools import partial
from typing import Dict, List
import threading
import socket
from waitress import serve
import argparse

from result_manager import ResultManager
from molcoref_processor import MolCorefProcessor
from patent_processor import PatentProcessor

# 关闭无关的日志
logging.getLogger('werkzeug').setLevel(logging.ERROR)

app = Flask(__name__)

# 全局变量，存储设备信息和处理器实例
DEVICES = []
PROCESSORS = {}
PROCESS_LOCK = threading.Lock()
# 添加任务计数器
DEVICE_TASK_COUNT = {}
POOL_TASK_COUNT = {}

# 进程特定的处理器缓存 - 每个进程维护自己的缓存
_PROCESS_PROCESSORS = {}

def initialize_devices():
    """初始化可用设备列表"""
    global DEVICES
    if torch.cuda.is_available():
        DEVICES = [f"cuda:{i}" for i in range(torch.cuda.device_count())]
        print(f"找到{len(DEVICES)}个GPU设备")
    else:
        DEVICES = ["cpu"]
        print("未找到GPU，使用CPU")

def init_worker_process(device):
    """初始化工作进程"""
    global _PROCESS_PROCESSORS
    
    # 设置环境变量
    if device.startswith('cuda'):
        gpu_id = device.split(':')[1]
        os.environ["CUDA_VISIBLE_DEVICES"] = str(gpu_id)
        # 注意: 在此进程中，它会变为第一个可见的GPU
        process_device = "cuda:0"
    else:
        process_device = device
    
    # 为此进程初始化一个处理器
    try:
        print(f"进程 {os.getpid()} 正在为设备 {device} (进程内为 {process_device}) 初始化处理器...")
        processor = MolCorefProcessor(
            result_manager=None,  # 每个请求会使用独立的ResultManager
            device=process_device
        )
        _PROCESS_PROCESSORS[device] = processor
        print(f"进程 {os.getpid()} 的设备 {device} 处理器初始化完成")
    except Exception as e:
        print(f"进程 {os.getpid()} 的处理器初始化失败: {str(e)}")
        import traceback
        traceback.print_exc()

def get_processor_for_process(device):
    """
    获取当前进程的处理器实例，如果不存在则创建
    这个函数在每个工作进程中运行
    """
    global _PROCESS_PROCESSORS
    
    # 根据环境变量确定实际的设备名称
    if device.startswith('cuda'):
        process_device = "cuda:0"  # 在工作进程中变为第一个可见的GPU
    else:
        process_device = device
    
    # 检查处理器是否已经在此进程中初始化
    if device not in _PROCESS_PROCESSORS:
        print(f"进程 {os.getpid()} 正在为设备 {device} (进程内为 {process_device}) 创建处理器...")
        try:
            # 创建处理器
            start_time = time.time()
            processor = MolCorefProcessor(
                result_manager=None,  # 每个请求会使用独立的ResultManager
                device=process_device
            )
            elapsed_time = time.time() - start_time
            _PROCESS_PROCESSORS[device] = processor
            print(f"进程 {os.getpid()} 的设备 {device} 处理器创建完成，耗时 {elapsed_time:.2f} 秒")
        except Exception as e:
            print(f"进程 {os.getpid()} 的处理器创建失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return None
    
    return _PROCESS_PROCESSORS[device]

def cleanup_patent_resources(result_manager=None, patent_processor=None):
    """
    释放单个专利处理后的资源，包括result_manager和其他缓存，但保留预加载的处理器
    
    参数:
        result_manager: 要清理的ResultManager实例
        patent_processor: 要清理的PatentProcessor实例
    """
    try:
        # 清理结果管理器
        if result_manager is not None:
            result_manager.clear_results()
            # 显式设为None有助于垃圾回收
            result_manager = None
        
        # 清理专利处理器
        if patent_processor is not None:
            # 将处理器中的result_manager设为None
            patent_processor.result_manager = None
            # 清理可能的缓存数据
            if hasattr(patent_processor, 'clear_cache') and callable(patent_processor.clear_cache):
                patent_processor.clear_cache()
            # 显式设为None有助于垃圾回收
            patent_processor = None
        
        # 强制清理内存中未被引用的对象
        import gc
        gc.collect()
        
        print(f"进程 {os.getpid()} 已释放专利处理资源")
    except Exception as e:
        print(f"释放资源时出错: {str(e)}")

def process_patent_task(patent_dir, device):
    """
    处理单个专利的任务函数，在工作进程中运行
    
    参数:
        patent_dir: 专利目录路径
        device: 设备
    返回:
        处理结果字典
    """
    try:
        print(f"进程 {os.getpid()} 开始处理专利 {patent_dir} 在设备 {device}")
        
        # 检查目录是否存在
        patent_path = Path(patent_dir)
        if not patent_path.exists():
            return {
                "success": False,
                "patent_dir": patent_dir,
                "error": f"专利目录不存在: {patent_dir}"
            }
        
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
            else:
                print(f"警告: {patent_dir} 不是有效的专利目录（没有image子目录）")
        
        # 获取当前进程的处理器
        processor = get_processor_for_process(device)
        if processor is None:
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
        
        # 创建专利处理器
        patent_processor = PatentProcessor(
            patent_dir=patent_dir,
            result_manager=result_manager,
            device="cuda:0" if device.startswith("cuda") else device,  # 在工作进程中使用正确的设备名称
            processor=processor
        )
        
        # 处理专利
        start_time = time.time()
        success = patent_processor.process()
        elapsed_time = time.time() - start_time
        
        if success:
            # 保存结果
            output_dir = Path(patent_dir)
            result_manager.save_results(output_dir)
            
            # 保存Excel
            excel_file = output_dir / f"{Path(patent_dir).name}_chemicals.xlsx"
            patent_processor.write_to_excel(excel_file)
            
            result = {
                "success": True,
                "patent_dir": patent_dir,
                "processing_time": elapsed_time,
                "output_dir": str(output_dir),
                "excel_file": str(excel_file)
            }
            
            # 清理资源但保留处理器
            cleanup_patent_resources(result_manager, patent_processor)
            
            return result
        else:
            # 清理资源但保留处理器
            cleanup_patent_resources(result_manager, patent_processor)
            
            return {
                "success": False,
                "patent_dir": patent_dir,
                "error": "处理失败，可能没有找到可处理的图像"
            }
            
    except Exception as e:
        print(f"处理专利时发生错误：{str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "patent_dir": patent_dir,
            "error": str(e)
        }

def get_next_device():
    """获取下一个可用设备，基于已分配任务数量进行负载均衡"""
    global DEVICES, PROCESSORS, DEVICE_TASK_COUNT
    
    with PROCESS_LOCK:
        # 确保所有设备都在任务计数中
        for device in DEVICES:
            if device not in DEVICE_TASK_COUNT:
                DEVICE_TASK_COUNT[device] = 0
        
        # 选择任务数最少的设备
        selected_device = min(DEVICE_TASK_COUNT.items(), key=lambda x: x[1])[0]
        
        # 增加选定设备的任务计数
        DEVICE_TASK_COUNT[selected_device] += 1
        
        print(f"选择设备 {selected_device}，当前设备任务计数: {DEVICE_TASK_COUNT}")
        return selected_device

def create_process_pool(device, process_index, initializer=None, initargs=None):
    """
    创建一个进程池，并为每个进程预加载设备处理器
    
    参数:
        device: 设备
        process_index: 进程索引
        initializer: 初始化函数
        initargs: 初始化参数
    """
    ctx = multiprocessing.get_context('spawn')
    
    # 如果没有指定初始化函数，使用默认的
    if initializer is None:
        initializer = init_worker_process
        initargs = (device,)
    
    # 创建进程池，注意只有一个进程
    pool = ctx.Pool(processes=1, initializer=initializer, initargs=initargs)
    
    return pool

def get_or_create_process_pool(device, processes_per_device=2):
    """
    获取或创建进程池，基于任务数量进行负载均衡
    
    参数:
        device: 设备
        processes_per_device: 每个设备的进程数
    """
    global PROCESSORS, PROCESS_LOCK, POOL_TASK_COUNT
    
    with PROCESS_LOCK:
        # 创建多个进程池，每个设备多个进程
        pools = []
        
        # 确保设备有足够的进程池
        for i in range(processes_per_device):
            pool_key = f"{device}_{i}"
            if pool_key not in PROCESSORS:
                # 创建进程池，每个设备一个进程
                pool = create_process_pool(device, i)
                PROCESSORS[pool_key] = pool
                print(f"为设备 {device} 创建进程池 {i}")
            
            pools.append(pool_key)
            
            # 初始化任务计数
            if pool_key not in POOL_TASK_COUNT:
                POOL_TASK_COUNT[pool_key] = 0
        
        if not pools:
            # 确保至少有一个进程池
            pool_key = f"{device}_0"
            pool = create_process_pool(device, 0)
            PROCESSORS[pool_key] = pool
            POOL_TASK_COUNT[pool_key] = 0
            print(f"为设备 {device} 创建默认进程池")
            return PROCESSORS[pool_key]
        
        # 返回任务最少的池
        min_load_key = min([(key, POOL_TASK_COUNT[key]) for key in pools], key=lambda x: x[1])[0]
        
        # 增加任务计数
        POOL_TASK_COUNT[min_load_key] += 1
        
        print(f"分配任务到进程池 {min_load_key}，当前任务计数: {POOL_TASK_COUNT}")
        return PROCESSORS[min_load_key]

@app.route('/status', methods=['GET'])
def status():
    """检查服务器状态"""
    # 收集GPU内存统计信息
    gpu_stats = {}
    if torch.cuda.is_available():
        for i in range(torch.cuda.device_count()):
            allocated = torch.cuda.memory_allocated(i) / (1024 ** 3)
            reserved = torch.cuda.memory_reserved(i) / (1024 ** 3)
            gpu_stats[f"gpu_{i}"] = {
                "allocated_gb": f"{allocated:.2f}",
                "reserved_gb": f"{reserved:.2f}"
            }
    
    return jsonify({
        "status": "running",
        "devices": DEVICES,
        "process_pools": list(PROCESSORS.keys()),
        "processes": {key: "active" for key in PROCESSORS.keys()},
        "task_counts": DEVICE_TASK_COUNT,
        "gpu_memory": gpu_stats,
        "server_pid": os.getpid()
    })

@app.route('/process_patent', methods=['POST'])
def process_patent():
    """处理单个专利目录"""
    global DEVICE_TASK_COUNT, POOL_TASK_COUNT
    
    # 获取请求数据
    data = request.json
    
    # 验证请求
    if not data or 'patent_dir' not in data:
        return jsonify({"error": "缺少必要参数: patent_dir"}), 400
    
    patent_dir = data['patent_dir']
    requested_device = data.get('device_id', None)
    remote_mode = data.get('remote_mode', False)
    
    # 检查目录是否存在（只在非远程模式或路径明确在服务器上时检查）
    # 如果是远程模式且路径明确在服务器上，则检查；否则不检查
    if not remote_mode and not os.path.exists(patent_dir):
        return jsonify({"error": f"专利目录不存在: {patent_dir}"}), 404
    
    try:
        # 记录开始时间
        start_time = time.time()
        
        # 选择设备
        if requested_device is not None and requested_device < len(DEVICES):
            device = DEVICES[requested_device]
            # 增加计数
            with PROCESS_LOCK:
                if device not in DEVICE_TASK_COUNT:
                    DEVICE_TASK_COUNT[device] = 0
                DEVICE_TASK_COUNT[device] += 1
        else:
            device = get_next_device()
        
        # 获取进程池
        pool = get_or_create_process_pool(device)
        
        # 使用进程池异步处理专利
        task = pool.apply_async(process_patent_task, args=(patent_dir, device))
        
        # 设置合理的超时时间等待结果
        try:
            result = task.get(timeout=1800)  # 30分钟超时
            
            # 任务完成后减少计数
            with PROCESS_LOCK:
                if device in DEVICE_TASK_COUNT:
                    DEVICE_TASK_COUNT[device] = max(0, DEVICE_TASK_COUNT[device] - 1)
                
                # 找到并减少相应进程池的计数
                for pool_key in POOL_TASK_COUNT:
                    if pool_key.startswith(f"{device}_"):
                        POOL_TASK_COUNT[pool_key] = max(0, POOL_TASK_COUNT[pool_key] - 1)
                        break
            
            # 计算处理时间
            elapsed_time = time.time() - start_time
            
            # 如果任务处理时间超过阈值，执行额外的缓存清理
            if elapsed_time > 300:  # 5分钟
                print(f"任务处理时间较长 ({elapsed_time:.2f}秒)，执行额外缓存清理")
                # 强制垃圾回收
                import gc
                gc.collect()
                # 清理GPU缓存
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            
            # 返回结果
            if result["success"]:
                return jsonify(result)
            else:
                return jsonify(result), 500
        except multiprocessing.TimeoutError:
            return jsonify({
                "success": False,
                "patent_dir": patent_dir,
                "error": "处理超时(30分钟)"
            }), 500
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "patent_dir": patent_dir,
            "error": str(e)
        }), 500

@app.route('/process_batch', methods=['POST'])
def process_batch():
    """处理多个专利目录"""
    global DEVICE_TASK_COUNT, POOL_TASK_COUNT
    
    # 获取请求数据
    data = request.json
    
    # 验证请求
    if not data or 'input_dirs' not in data:
        return jsonify({"error": "缺少必要参数: input_dirs"}), 400
    
    input_dirs = data['input_dirs']
    output_root = data.get('output_root')
    remote_mode = data.get('remote_mode', False)
    
    # 检查输入目录列表是否为空
    if not input_dirs:
        return jsonify({"error": "输入目录列表为空"}), 400
    
    # 在远程模式下，如果只有一个目录，则检查它是否是根目录并包含专利子目录
    if remote_mode and len(input_dirs) == 1:
        root_dir = Path(input_dirs[0])
        if root_dir.exists() and root_dir.is_dir():
            # 查找所有专利目录（非隐藏目录）
            patent_subdirs = [str(d) for d in root_dir.iterdir() 
                              if d.is_dir() and not d.name.startswith(".") and d.name != "image"]
            
            if patent_subdirs:
                print(f"在根目录 {root_dir} 中找到 {len(patent_subdirs)} 个专利子目录")
                # 使用找到的专利子目录替换原来的单个根目录
                input_dirs = patent_subdirs
            else:
                print(f"在根目录 {root_dir} 中未找到专利子目录，尝试直接处理")
    
    # 如果不是远程模式，检查目录是否存在
    if not remote_mode:
        for dir_path in input_dirs:
            if not os.path.exists(dir_path):
                return jsonify({"error": f"目录不存在: {dir_path}"}), 404
    
    # 重置任务计数
    with PROCESS_LOCK:
        for device in DEVICES:
            DEVICE_TASK_COUNT[device] = 0
        for pool_key in POOL_TASK_COUNT:
            POOL_TASK_COUNT[pool_key] = 0
    
    # 通过多线程处理不同设备的任务
    tasks = []
    patent_device_map = {}  # 跟踪每个专利使用的设备
    
    # 为每个专利分配任务到不同进程池
    for patent_dir in input_dirs:
        try:
            # 选择设备
            device = get_next_device()
            patent_device_map[patent_dir] = device
            
            # 获取进程池
            pool = get_or_create_process_pool(device)
            
            # 使用apply_async进行异步处理，不阻塞
            task = pool.apply_async(process_patent_task, args=(patent_dir, device))
            tasks.append((patent_dir, task))
                
        except Exception as e:
            print(f"提交任务失败: {patent_dir} - {str(e)}")
    
    # 收集结果
    results = []
    failures = []
    
    # 设置超时警告但不中断执行
    import time
    start_time = time.time()
    timeout_warning_shown = False
    
    # 等待所有任务完成
    for patent_dir, task in tasks:
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
                    "excel_file": result.get("excel_file")
                })
            else:
                failures.append({
                    "patent_dir": patent_dir,
                    "error": result.get("error", "未知错误")
                })
        except multiprocessing.TimeoutError:
            failures.append({
                "patent_dir": patent_dir,
                "error": "处理超时(30分钟)"
            })
        except Exception as e:
            failures.append({
                "patent_dir": patent_dir,
                "error": str(e)
            })
        
        # 显示长时间运行的警告
        current_time = time.time()
        if current_time - start_time > 600 and not timeout_warning_shown:  # 10分钟
            print("警告: 批处理任务运行时间较长，可能存在性能问题")
            timeout_warning_shown = True
    
    # 批处理完成后强制进行一次垃圾回收
    import gc
    gc.collect()
    # 清理GPU缓存
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        
    return jsonify({
        "success": len(failures) == 0,
        "processed": len(results),
        "failed": len(failures),
        "results": results,
        "failures": failures
    })

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
                pool = get_or_create_process_pool(device)
                
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
                    patent_dirs = [str(d) for d in Path(path).iterdir() 
                                 if d.is_dir() and not d.name.startswith(".") and d.name != "image"]
                    
                    if not patent_dirs:
                        return jsonify({"success": False, "error": f"在目录 {path} 中未找到专利子目录"}), 400
                    
                    return process_batch_patents(patent_dirs)
                else:
                    # 压缩包 - 需要解压
                    temp_dir = extract_archive(path)
                    if not temp_dir:
                        return jsonify({"success": False, "error": f"无法解压文件: {path}"}), 400
                    
                    try:
                        # 查找所有专利子目录
                        patent_dirs = [str(d) for d in Path(temp_dir).iterdir() 
                                     if d.is_dir() and not d.name.startswith(".") and d.name != "image"]
                        
                        if not patent_dirs:
                            return jsonify({"success": False, "error": "在解压后的目录中未找到专利子目录"}), 400
                        
                        # 处理所有专利
                        result = process_batch_patents(patent_dirs)
                        
                        # 清理临时目录
                        shutil.rmtree(temp_dir, ignore_errors=True)
                        
                        return result
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
                    patent_dirs = [str(d) for d in Path(extract_dir).iterdir() 
                                 if d.is_dir() and not d.name.startswith(".") and d.name != "image"]
                    
                    if not patent_dirs:
                        return jsonify({"success": False, "error": "在解压后的目录中未找到专利子目录"}), 400
                    
                    # 处理所有专利
                    result = process_batch_patents(patent_dirs)
                    
                    # 清理临时目录
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    shutil.rmtree(extract_dir, ignore_errors=True)
                    
                    return result
                except Exception as e:
                    # 清理临时目录
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    if extract_dir and extract_dir != temp_dir:
                        shutil.rmtree(extract_dir, ignore_errors=True)
                    return jsonify({"success": False, "error": f"处理压缩包时出错: {str(e)}"}), 500
            else:
                # 非压缩包，假设它是一个目录结构
                # 查找所有专利子目录
                patent_dirs = [str(d) for d in Path(temp_dir).iterdir() 
                             if d.is_dir() and not d.name.startswith(".") and d.name != "image"]
                
                if not patent_dirs:
                    return jsonify({"success": False, "error": "在上传的目录中未找到专利子目录"}), 400
                
                # 处理所有专利
                result = process_batch_patents(patent_dirs)
                
                # 清理临时目录
                shutil.rmtree(temp_dir, ignore_errors=True)
                
                return result
        else:
            # 单个专利处理模式
            # 选择设备
            device = get_next_device()
            
            # 获取进程池
            pool = get_or_create_process_pool(device)
            
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
        
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

def extract_archive(archive_path):
    """
    解压压缩包到临时目录
    
    参数:
        archive_path: 压缩包路径
        
    返回:
        解压后的目录路径，失败返回None
    """
    try:
        # 创建临时目录
        extract_dir = tempfile.mkdtemp()
        
        # 根据文件扩展名选择解压方法
        archive_lower = archive_path.lower()
        
        if archive_lower.endswith('.zip'):
            import zipfile
            with zipfile.ZipFile(archive_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
            
        elif archive_lower.endswith('.tar') or archive_lower.endswith('.tar.gz') or archive_lower.endswith('.tgz'):
            import tarfile
            with tarfile.open(archive_path) as tar_ref:
                tar_ref.extractall(extract_dir)
        
        elif archive_lower.endswith('.rar'):
            # 需要安装 rarfile 库
            try:
                import rarfile
                with rarfile.RarFile(archive_path) as rar_ref:
                    rar_ref.extractall(extract_dir)
            except ImportError:
                # 尝试使用外部命令
                import subprocess
                result = subprocess.run(['unrar', 'x', archive_path, extract_dir], 
                                      stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                if result.returncode != 0:
                    raise Exception(f"解压RAR文件失败: {result.stderr.decode('utf-8')}")
        
        elif archive_lower.endswith('.7z'):
            # 需要安装 py7zr 库或使用外部命令
            try:
                import py7zr
                with py7zr.SevenZipFile(archive_path, mode='r') as z:
                    z.extractall(extract_dir)
            except ImportError:
                # 尝试使用外部命令
                import subprocess
                result = subprocess.run(['7z', 'x', archive_path, '-o' + extract_dir], 
                                      stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                if result.returncode != 0:
                    raise Exception(f"解压7z文件失败: {result.stderr.decode('utf-8')}")
        
        else:
            raise ValueError(f"不支持的压缩文件格式: {archive_path}")
        
        return extract_dir
    
    except Exception as e:
        print(f"解压失败: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # 清理临时目录
        if 'extract_dir' in locals() and os.path.exists(extract_dir):
            shutil.rmtree(extract_dir, ignore_errors=True)
        
        return None

def process_batch_patents(patent_dirs):
    """
    处理多个专利目录
    
    参数:
        patent_dirs: 专利目录路径列表
        
    返回:
        处理结果的JSON响应
    """
    # 重置任务计数
    with PROCESS_LOCK:
        for device in DEVICES:
            DEVICE_TASK_COUNT[device] = 0
        for pool_key in POOL_TASK_COUNT:
            POOL_TASK_COUNT[pool_key] = 0
    
    # 通过多线程处理不同设备的任务
    tasks = []
    patent_device_map = {}  # 跟踪每个专利使用的设备
    
    # 为每个专利分配任务到不同进程池
    for patent_dir in patent_dirs:
        try:
            # 选择设备
            device = get_next_device()
            patent_device_map[patent_dir] = device
            
            # 获取进程池
            pool = get_or_create_process_pool(device)
            
            # 使用apply_async进行异步处理，不阻塞
            task = pool.apply_async(process_patent_task, args=(patent_dir, device))
            tasks.append((patent_dir, task))
                
        except Exception as e:
            print(f"提交任务失败: {patent_dir} - {str(e)}")
    
    # 收集结果
    results = []
    failures = []
    
    # 设置超时警告但不中断执行
    import time
    start_time = time.time()
    timeout_warning_shown = False
    
    # 等待所有任务完成
    for patent_dir, task in tasks:
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
                    "excel_file": result.get("excel_file")
                })
            else:
                failures.append({
                    "patent_dir": patent_dir,
                    "error": result.get("error", "未知错误")
                })
        except multiprocessing.TimeoutError:
            failures.append({
                "patent_dir": patent_dir,
                "error": "处理超时(30分钟)"
            })
        except Exception as e:
            failures.append({
                "patent_dir": patent_dir,
                "error": str(e)
            })
        
        # 显示长时间运行的警告
        current_time = time.time()
        if current_time - start_time > 600 and not timeout_warning_shown:  # 10分钟
            print("警告: 批处理任务运行时间较长，可能存在性能问题")
            timeout_warning_shown = True
    
    # 批处理完成后强制进行一次垃圾回收
    import gc
    gc.collect()
    # 清理GPU缓存
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        
    return jsonify({
        "success": len(failures) == 0,
        "processed": len(results),
        "failed": len(failures),
        "results": results,
        "failures": failures
    })

def cleanup_pools():
    """在应用退出时清理进程池"""
    global PROCESSORS
    for pool in PROCESSORS.values():
        try:
            pool.close()
            pool.join()
        except:
            pass
    print("所有进程池已关闭")

def get_local_ip():
    """获取本地IP地址"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # 不需要真正连接
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

def periodic_cache_cleanup():
    """
    周期性清理缓存和释放系统资源的函数
    该函数每隔一段时间清理未使用的资源
    """
    cleanup_interval = 1800  # 30分钟
    
    print("启动周期性缓存清理线程")
    
    while True:
        try:
            # 等待指定时间
            time.sleep(cleanup_interval)
            
            print(f"执行周期性缓存清理...")
            
            # 强制垃圾回收
            import gc
            gc.collect()
            
            # 清理GPU缓存
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                
            # 输出内存使用情况
            if torch.cuda.is_available():
                for i in range(torch.cuda.device_count()):
                    allocated = torch.cuda.memory_allocated(i) / (1024 ** 3)
                    reserved = torch.cuda.memory_reserved(i) / (1024 ** 3)
                    print(f"GPU {i}: 已分配 {allocated:.2f} GB, 已保留 {reserved:.2f} GB")
            
            # 输出进程池状态
            print(f"当前进程池状态: {len(PROCESSORS)} 个活跃池")
            print(f"当前设备任务计数: {DEVICE_TASK_COUNT}")
            print(f"当前池任务计数: {POOL_TASK_COUNT}")
            
            print("周期性缓存清理完成")
        except Exception as e:
            print(f"周期性缓存清理出错: {str(e)}")

if __name__ == '__main__':
    import argparse
    
    # 命令行参数解析
    parser = argparse.ArgumentParser(description="专利处理服务器")
    parser.add_argument("--devices", nargs='+', help="指定GPU设备ID，如 0 1 2，不指定则使用所有可用设备")
    parser.add_argument("--port", type=int, default=7878, help="服务器端口号，默认7878")
    parser.add_argument("--procs", type=int, default=2, help="每个设备的进程数，默认2")
    
    args = parser.parse_args()
    
    # 进程数量
    processes_per_device = args.procs
    
    # 服务器端口
    port = args.port
    
    # 自定义设备列表
    if args.devices:
        if torch.cuda.is_available():
            custom_devices = []
            for device_id in args.devices:
                try:
                    device_id = int(device_id)
                    if 0 <= device_id < torch.cuda.device_count():
                        custom_devices.append(f"cuda:{device_id}")
                    else:
                        print(f"警告: GPU设备ID {device_id} 超出范围 (0-{torch.cuda.device_count()-1})，将被忽略")
                except ValueError:
                    print(f"警告: 无效的设备ID '{device_id}'，将被忽略")
            
            if not custom_devices:
                print("警告: 所有指定的设备ID无效，将使用所有可用设备")
                DEVICES = [f"cuda:{i}" for i in range(torch.cuda.device_count())]
            else:
                DEVICES = custom_devices
                print(f"使用指定的GPU设备: {DEVICES}")
        else:
            print("警告: 系统未检测到GPU，将使用CPU")
            DEVICES = ["cpu"]
    else:
        # 初始化所有可用设备
        initialize_devices()
    
    # 初始化任务计数器
    for device in DEVICES:
        DEVICE_TASK_COUNT[device] = 0
    
    # 创建每个设备的进程池
    start_time = time.time()
    print(f"开始创建进程池...")
    
    for device in DEVICES:
        for i in range(processes_per_device):
            pool_key = f"{device}_{i}"
            # 创建进程池，同时初始化工作进程的处理器
            pool = create_process_pool(device, i)
            PROCESSORS[pool_key] = pool
            POOL_TASK_COUNT[pool_key] = 0
            print(f"为设备 {device} 创建进程池 {i}")
    
    pool_creation_time = time.time() - start_time
    print(f"进程池创建完成，耗时 {pool_creation_time:.2f} 秒")
    
    # 启动周期性缓存清理线程
    cleanup_thread = threading.Thread(target=periodic_cache_cleanup, daemon=True)
    cleanup_thread.start()
    print("周期性缓存清理线程已启动")
    
    try:
        # 获取本地IP
        local_ip = get_local_ip()
        
        print(f"服务器正在启动，地址: http://{local_ip}:{port}")
        print(f"当前GPU设备: {DEVICES}")
        print(f"每个设备的进程数: {processes_per_device}")
        print(f"总进程数: {len(DEVICES) * processes_per_device}")
        print("这是一个生产服务器。按CTRL+C退出。")
        
        # 使用Waitress作为生产WSGI服务器
        serve(app, host='0.0.0.0', port=port)
    finally:
        # 清理
        cleanup_pools()