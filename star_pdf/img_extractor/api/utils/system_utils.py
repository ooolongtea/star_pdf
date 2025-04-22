"""
系统工具模块
定义系统相关的工具函数，如获取IP地址、清理内存等
"""
import socket
import gc
import time
import torch

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

def periodic_cache_cleanup(cleanup_interval=1800):
    """
    周期性清理缓存和释放系统资源的函数
    该函数每隔一段时间清理未使用的资源
    
    参数:
        cleanup_interval: 清理间隔时间（秒）
    """
    print("启动周期性缓存清理线程")
    
    while True:
        try:
            # 等待指定时间
            time.sleep(cleanup_interval)
            
            print(f"执行周期性缓存清理...")
            
            # 强制垃圾回收
            gc.collect()
            
            # 清理GPU缓存，但不重置模型
            if torch.cuda.is_available():
                # 仅释放不再使用的内存，不影响已加载的模型
                torch.cuda.empty_cache()
                
            # 输出GPU内存使用情况
            if torch.cuda.is_available():
                for i in range(torch.cuda.device_count()):
                    allocated = torch.cuda.memory_allocated(i) / (1024 ** 3)
                    reserved = torch.cuda.memory_reserved(i) / (1024 ** 3)
                    print(f"GPU {i}: 已分配 {allocated:.2f} GB, 已保留 {reserved:.2f} GB")
            
            print("周期性缓存清理完成")
        except Exception as e:
            print(f"周期性缓存清理出错: {str(e)}") 