"""
命令行客户端
提供命令行界面与服务器交互
"""
import os
import sys
import argparse
import time
import requests
from pathlib import Path
from tqdm import tqdm

from api.client.client_core import PatentAPIClient
from api.client.process_client import ProcessPatentClient
from api.client.upload_client import UploadPatentClient

def progress_callback(progress, message, status=None):
    """进度条回调函数"""
    sys.stdout.write(f"\r进度: [{progress:3.0f}%] {message}")
    sys.stdout.flush()

def batch_progress_callback(progress, message, total):
    """批处理进度条回调函数"""
    sys.stdout.write(f"\r总进度: [{progress:3.1f}%] {message}")
    sys.stdout.flush()

def process_command(args):
    """处理专利"""
    try:
        # 创建客户端
        client = ProcessPatentClient(
            server_url=args.server,
            remote_mode=args.remote,
            username=args.username,
            password=args.password
        )

        # 显示操作模式信息
        if args.remote:
            print(f"远程模式下处理专利：{args.patent_dir}")
            print(f"注意：远程模式下，专利目录路径应该是服务器上的路径")
        else:
            print(f"本地模式下处理专利：{args.patent_dir}")

            # 在本地模式下检查专利目录是否存在
            if not os.path.exists(args.patent_dir):
                print(f"错误：本地专利目录不存在：{args.patent_dir}")
                return 1

        # 处理专利
        start_time = time.time()
        result = client.process_patent(
            args.patent_dir,
            args.device,
            wait_for_complete=args.wait,
            progress_callback=progress_callback,
            save_local=not args.no_save,
            local_output_dir=args.output_dir,
            download_dir=args.download_dir
        )
        elapsed_time = time.time() - start_time

        # 打印结果
        print()  # 换行
        if result.get("success", False):
            print(f"处理成功！耗时: {elapsed_time:.2f}秒")
            if "output_dir" in result:
                print(f"输出目录: {result['output_dir']}")
            if "excel_file" in result:
                print(f"Excel文件: {result['excel_file']}")

            # 如果有本地保存的文件
            if "local_files" in result:
                local_dir = result["local_files"].get("output_dir")
                local_files = result["local_files"].get("files", [])
                if local_dir:
                    print(f"本地保存目录: {local_dir}")
                    print(f"已保存 {len(local_files)} 个文件")
        else:
            print(f"处理失败: {result.get('error', '未知错误')}")
            if args.remote and "专利目录不存在" in result.get('error', ''):
                print(f"提示：请确认 {args.patent_dir} 在服务器上存在，或使用正确的服务器路径")

        return 0 if result.get("success", False) else 1
    except FileNotFoundError as e:
        print(f"文件不存在错误: {str(e)}")
        return 1
    except requests.exceptions.ConnectionError:
        print(f"连接服务器失败: {args.server}")
        print(f"请确认服务器地址正确并且服务器已启动")
        return 1
    except Exception as e:
        print(f"执行过程中出错: {str(e)}")
        return 1

def batch_command(args):
    """批量处理专利"""
    try:
        # 创建客户端
        client = ProcessPatentClient(
            server_url=args.server,
            remote_mode=args.remote,
            username=args.username,
            password=args.password
        )

        # 显示操作模式信息
        if args.remote:
            print(f"远程模式下批量处理专利：{args.input_dir}")
            print(f"注意：远程模式下，输入目录路径应该是服务器上的路径")
        else:
            print(f"本地模式下批量处理专利：{args.input_dir}")

            # 在本地模式下检查目录是否存在
            if not os.path.exists(args.input_dir):
                print(f"错误：本地输入目录不存在：{args.input_dir}")
                return 1

        # 批量处理专利
        start_time = time.time()
        result = client.process_batch(
            args.input_dir,
            args.output_dir,
            wait_for_complete=args.wait,
            progress_callback=batch_progress_callback,
            save_local=not args.no_save,
            local_output_dir=args.local_output_dir,
            download_dir=args.download_dir
        )
        elapsed_time = time.time() - start_time

        # 打印结果
        print()  # 换行
        print(f"批处理完成！耗时: {elapsed_time:.2f}秒")
        print(f"处理成功: {result.get('processed', 0)} 个专利")
        print(f"处理失败: {result.get('failed', 0)} 个专利")

        # 如果有本地保存的结果
        if "local_results" in result:
            local_results = result.get("local_results", [])
            if local_results:
                print(f"已保存 {len(local_results)} 个专利结果到本地")

                # 如果指定了输出目录，显示它
                if args.local_output_dir:
                    print(f"本地保存目录: {args.local_output_dir}")

                # 如果指定了下载目录，显示它
                if args.download_dir:
                    print(f"远程文件下载目录: {args.download_dir}")

        if result.get("failed", 0) > 0:
            print("\n失败的专利:")
            for failure in result.get("failures", []):
                print(f"  - {failure.get('patent_dir')}: {failure.get('error', '未知错误')}")

            if args.remote:
                print("\n提示：请确认上述路径在服务器上存在，或使用正确的服务器路径")

        return 0 if result.get("failed", 0) == 0 else 1
    except FileNotFoundError as e:
        print(f"文件不存在错误: {str(e)}")
        return 1
    except ValueError as e:
        print(f"输入错误: {str(e)}")
        return 1
    except requests.exceptions.ConnectionError:
        print(f"连接服务器失败: {args.server}")
        print(f"请确认服务器地址正确并且服务器已启动")
        return 1
    except Exception as e:
        print(f"执行过程中出错: {str(e)}")
        return 1

def upload_command(args):
    """上传并处理专利"""
    # 确保专利目录存在
    if not args.remote and not os.path.exists(args.patent_dir):
        print(f"错误：专利目录不存在：{args.patent_dir}")
        return 1

    # 创建客户端
    client = UploadPatentClient(
        server_url=args.server,
        remote_mode=args.remote,
        username=args.username,
        password=args.password
    )

    print(f"{'远程' if args.remote else '本地'}模式下上传并处理专利：{args.patent_dir}")

    try:
        # 上传并处理专利
        start_time = time.time()
        result = client.upload_and_process(args.patent_dir)
        elapsed_time = time.time() - start_time

        # 打印结果
        if result.get("success", False):
            print(f"处理成功！耗时: {elapsed_time:.2f}秒")
            if "output_dir" in result:
                print(f"输出目录: {result['output_dir']}")
            if "excel_file" in result:
                print(f"Excel文件: {result['excel_file']}")
        else:
            print(f"处理失败: {result.get('error', '未知错误')}")

        return 0 if result.get("success", False) else 1
    except Exception as e:
        print(f"执行过程中出错: {str(e)}")
        return 1

def upload_batch_command(args):
    """上传并批量处理专利"""
    # 确保目录或文件存在
    if not args.remote and not os.path.exists(args.path):
        print(f"错误：目录或文件不存在：{args.path}")
        return 1

    # 创建客户端
    client = UploadPatentClient(
        server_url=args.server,
        remote_mode=args.remote,
        username=args.username,
        password=args.password
    )

    print(f"{'远程' if args.remote else '本地'}模式下上传并批量处理：{args.path}")

    try:
        # 上传并批量处理
        start_time = time.time()
        result = client.upload_and_batch_process(args.path)
        elapsed_time = time.time() - start_time

        # 打印结果
        print(f"批处理完成！耗时: {elapsed_time:.2f}秒")
        print(f"处理成功: {result.get('processed', 0)} 个专利")
        print(f"处理失败: {result.get('failed', 0)} 个专利")

        if result.get("failed", 0) > 0:
            print("\n失败的专利:")
            for failure in result.get("failures", []):
                print(f"  - {failure.get('patent_dir')}: {failure.get('error', '未知错误')}")

        return 0 if result.get("failed", 0) == 0 else 1
    except Exception as e:
        print(f"执行过程中出错: {str(e)}")
        return 1

def status_command(args):
    """查询服务器状态"""
    # 创建客户端
    client = PatentAPIClient(
        server_url=args.server,
        remote_mode=args.remote,
        username=args.username,
        password=args.password
    )

    try:
        # 查询状态
        response = requests.get(f"{client.server_url}/api/status", auth=client.auth)
        response.raise_for_status()
        status = response.json()

        # 获取系统信息
        system_info = status.get('system', {})
        uptime = status.get('uptime', 0)
        uptime_str = f"{uptime:.2f}秒" if uptime < 60 else \
                    f"{uptime/60:.2f}分钟" if uptime < 3600 else \
                    f"{uptime/3600:.2f}小时"

        # 打印服务器状态
        print("\n服务器状态:")
        print(f"  状态: 正常运行")  # 固定显示“正常运行”
        print(f"  运行时间: {uptime_str}")
        print(f"  主机名: {system_info.get('hostname', 'unknown')}")
        print(f"  平台: {system_info.get('platform', 'unknown')}")
        print(f"  Python版本: {system_info.get('python_version', 'unknown')}")

        # 处理CPU和内存信息
        cpu_count = system_info.get('cpu_count', 0)
        cpu_usage = system_info.get('cpu_usage', 0)
        memory_total = system_info.get('memory_total', 0)
        memory_used = system_info.get('memory_used', 0)
        memory_percent = (memory_used / memory_total * 100) if memory_total > 0 else 0

        print("\n系统资源:")
        print(f"  CPU: {cpu_count}核心, 使用率 {cpu_usage:.1f}%")
        print(f"  内存: {memory_used/(1024**3):.2f}GB/{memory_total/(1024**3):.2f}GB ({memory_percent:.1f}%)")

        # 处理设备列表
        devices = status.get('devices', [])
        print("\n可用GPU设备:")
        if devices and isinstance(devices, list):
            if devices and isinstance(devices[0], dict):
                for i, device in enumerate(devices):
                    name = device.get('name', 'unknown')
                    memory_total = device.get('memory_total', 0) / (1024**2)  # 转换为MB
                    memory_used = device.get('memory_used', 0) / (1024**2)    # 转换为MB
                    memory_percent = (memory_used / memory_total * 100) if memory_total > 0 else 0
                    cuda_version = device.get('cuda_version', 'unknown')

                    print(f"  GPU {device.get('id', i)}: {name}")
                    print(f"    显存: {memory_used:.0f}MB/{memory_total:.0f}MB ({memory_percent:.1f}%)")
                    print(f"    CUDA版本: {cuda_version}")
            else:
                # 如果是字符串列表，直接显示
                for i, device in enumerate(devices):
                    print(f"  GPU {i}: {device}")
        else:
            print("  无可用GPU设备")

        if "gpu_info" in status:
            print("\nGPU信息:")
            for gpu in status["gpu_info"]:
                print(f"  {gpu.get('name', 'unknown')}:")
                print(f"    温度: {gpu.get('temperature', 'unknown')}°C")
                print(f"    显存: {gpu.get('memory_used', 0)}/{gpu.get('memory_total', 0)} MB" +
                      f" ({gpu.get('memory_percent', 0):.1f}%)")
                print(f"    利用率: {gpu.get('utilization', 0)}%")

        if "task_summary" in status:
            summary = status["task_summary"]
            print("\n任务摘要:")
            print(f"  运行中: {summary.get('running', 0)}")
            print(f"  排队中: {summary.get('pending', 0)}")
            print(f"  已完成: {summary.get('completed', 0)}")
            print(f"  失败: {summary.get('failed', 0)}")

        return 0
    except Exception as e:
        print(f"查询状态时出错: {str(e)}")
        return 1

def main():
    """主函数"""
    # 全局参数解析器
    parser = argparse.ArgumentParser(description="专利处理客户端")
    parser.add_argument("--server", default="http://172.19.1.81:8080", help="服务器URL，默认http://172.19.1.81:8080")
    parser.add_argument("--remote", action="store_true", help="远程模式，路径指向服务器上的位置")
    parser.add_argument("--username", default="zhouxingyu", help="服务器认证用户名，默认zhouxingyu")
    parser.add_argument("--password", default="zxy123456", help="服务器认证密码，默认zxy123456")

    # 命令子解析器
    subparsers = parser.add_subparsers(dest="command", help="要执行的命令", required=True)

    # 处理专利命令
    process_parser = subparsers.add_parser("process", help="处理单个专利")
    process_parser.add_argument("patent_dir", help="专利目录路径")
    process_parser.add_argument("--device", type=int, help="设备ID (可选)")
    process_parser.add_argument("--wait", action="store_true", help="等待处理完成")
    process_parser.add_argument("--no-save", action="store_true", help="不保存结果到本地")
    process_parser.add_argument("--output-dir", help="本地输出目录 (可选)")
    process_parser.add_argument("--download-dir", help="远程结果下载目录，默认为工作目录下的downloads文件夹")
    process_parser.set_defaults(func=process_command)

    # 批量处理命令
    batch_parser = subparsers.add_parser("batch", help="批量处理专利")
    batch_parser.add_argument("input_dir", help="输入目录，包含多个专利目录")
    batch_parser.add_argument("--output-dir", help="输出目录 (可选)")
    batch_parser.add_argument("--wait", action="store_true", help="等待所有处理完成")
    batch_parser.add_argument("--no-save", action="store_true", help="不保存结果到本地")
    batch_parser.add_argument("--local-output-dir", help="本地输出目录 (可选)")
    batch_parser.add_argument("--download-dir", help="远程结果下载目录，默认为工作目录下的downloads文件夹")
    batch_parser.set_defaults(func=batch_command)

    # 上传并处理命令
    upload_parser = subparsers.add_parser("upload", help="上传并处理专利")
    upload_parser.add_argument("patent_dir", help="专利目录路径")
    upload_parser.set_defaults(func=upload_command)

    # 上传并批量处理命令
    upload_batch_parser = subparsers.add_parser("upload-batch", help="上传并批量处理专利")
    upload_batch_parser.add_argument("path", help="专利目录或压缩包路径")
    upload_batch_parser.set_defaults(func=upload_batch_command)

    # 状态查询命令
    status_parser = subparsers.add_parser("status", help="查询服务器状态")
    status_parser.set_defaults(func=status_command)

    # 解析参数
    args = parser.parse_args()

    # 执行对应的命令
    if hasattr(args, "func"):
        try:
            return args.func(args)
        except KeyboardInterrupt:
            print("\n操作已取消")
            return 130
    else:
        parser.print_help()
        return 1

if __name__ == "__main__":
    sys.exit(main())