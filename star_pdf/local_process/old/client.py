import os
import sys
import json
import time
import requests
import argparse
import shutil
import tempfile
from pathlib import Path
from typing import Dict, List, Optional, Union, Any
from tqdm import tqdm

class PatentAPIClient:
    """专利处理API客户端"""
    
    def __init__(self, server_url="http://localhost:7878", remote_mode=True, username=None, password=None):
        """
        初始化API客户端
        
        参数:
            server_url: API服务器的URL
            remote_mode: 是否为远程模式，True表示文件路径在服务器上，不需要检查本地路径存在
            username: 服务器认证用户名
            password: 服务器认证密码
        """
        self.server_url = server_url
        self.remote_mode = remote_mode
        self.auth = None
        if username and password:
            self.auth = (username, password)
        # 检查服务器是否可用
        self._check_server()
    
    def _check_server(self):
        """检查服务器是否可用"""
        try:
            response = requests.get(f"{self.server_url}/status", auth=self.auth)
            response.raise_for_status()  # 如果状态码不是200，引发异常
            print(f"服务器状态: {response.json().get('status', 'unknown')}")
            print(f"可用设备: {response.json().get('devices', [])}")
            print(f"已预加载处理器: {response.json().get('preloaded_processors', [])}")
            print(f"进程数量: {len(response.json().get('processes', {}))}")
        except requests.exceptions.RequestException as e:
            print(f"无法连接到服务器 {self.server_url}: {str(e)}")
            sys.exit(1)
    
    def process_patent(self, patent_dir: str, device_id: int = None) -> dict:
        """
        处理单个专利目录
        
        参数:
            patent_dir: 专利目录路径
            device_id: 设备ID（用于选择GPU），如果为None，则服务器自动选择
            
        返回:
            API响应字典
        """
        # 确保专利目录存在 (仅在非远程模式下检查)
        if not self.remote_mode and not os.path.exists(patent_dir):
            raise FileNotFoundError(f"专利目录不存在: {patent_dir}")
        
        # 构建请求数据
        data = {
            "patent_dir": patent_dir,
            "remote_mode": self.remote_mode
        }
        
        # 只有在指定了设备ID时才添加到请求
        if device_id is not None:
            data["device_id"] = device_id
        
        try:
            response = requests.post(f"{self.server_url}/process_patent", json=data, auth=self.auth)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"处理专利失败 {patent_dir}: {str(e)}")
            if hasattr(e, 'response') and e.response:
                print(f"服务器响应: {e.response.text}")
            return {"success": False, "error": str(e)}
    
    def process_batch(self, input_root: str, output_root: Optional[str] = None) -> dict:
        """
        处理多个专利目录
        
        参数:
            input_root: 包含专利目录的根目录
            output_root: 输出根目录（可选，默认与输入相同）
            
        返回:
            API响应字典
        """
        # 确保输入目录存在 (仅在非远程模式下检查)
        if not self.remote_mode:
            input_root = Path(input_root)
            if not input_root.exists():
                raise FileNotFoundError(f"输入目录不存在: {input_root}")
            
            # 查找所有专利目录
            patent_dirs = [str(d) for d in input_root.iterdir() if d.is_dir() and not d.name.startswith(".")]
            
            if not patent_dirs:
                raise ValueError(f"在{input_root}中未找到专利目录")
            
            # 打印找到的专利目录
            print(f"找到{len(patent_dirs)}个专利目录。")
        else:
            # 远程模式下，直接使用路径字符串，不检查本地是否存在
            input_root = str(input_root)
            # 在远程模式下，发送根目录路径，服务器会自动查找专利子目录
            print(f"正在远程模式下处理目录: {input_root}")
            patent_dirs = [input_root]  # 发送根目录，服务器会查找里面的专利子目录
        
        # 构建请求数据 - 直接发送所有目录路径，让服务器处理批量
        data = {
            "input_dirs": patent_dirs,
            "remote_mode": self.remote_mode
        }
        if output_root:
            data["output_root"] = str(output_root)
        
        try:
            print(f"正在发送批量处理请求...")
            response = requests.post(f"{self.server_url}/process_batch", json=data, auth=self.auth)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"批量处理请求失败: {str(e)}")
            if hasattr(e, 'response') and e.response:
                print(f"服务器响应: {e.response.text}")
            
            # 如果批量处理失败，则逐个处理
            print("批量处理失败，尝试单个处理每个专利...")
            return self._process_patents_individually(patent_dirs)
    
    def _process_patents_individually(self, patent_dirs: List[str]) -> dict:
        """
        单个处理每个专利目录
        
        参数:
            patent_dirs: 专利目录路径列表
            
        返回:
            结果摘要字典
        """
        results = []
        failures = []
        
        for patent_dir in tqdm(patent_dirs, desc="处理专利", unit="个"):
            result = self.process_patent(patent_dir)
            if result.get("success", False):
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
        
        # 返回结果摘要
        return {
            "success": len(failures) == 0,
            "processed": len(results),
            "failed": len(failures),
            "results": results,
            "failures": failures
        }
    
    def upload_and_process(self, patent_dir: str) -> dict:
        """
        上传并处理专利目录
        
        参数:
            patent_dir: 专利目录路径
            
        返回:
            API响应字典
        """
        # 确保专利目录存在（仅在非远程模式下检查）
        if not self.remote_mode and not os.path.exists(patent_dir):
            raise FileNotFoundError(f"专利目录不存在: {patent_dir}")
        
        try:
            # 在远程模式下，不需要压缩和上传，直接发送路径
            if self.remote_mode:
                data = {"patent_dir": patent_dir, "remote_mode": True}
                response = requests.post(f"{self.server_url}/upload_and_process", json=data, auth=self.auth)
                response.raise_for_status()
                return response.json()
            
            # 本地模式：将目录压缩成zip文件并上传
            zip_path = self._compress_directory(patent_dir)
            
            # 上传并处理
            with open(zip_path, 'rb') as f:
                files = {'patent_folder': (os.path.basename(patent_dir) + ".zip", f)}
                response = requests.post(f"{self.server_url}/upload_and_process", files=files, auth=self.auth)
            
            # 删除临时zip文件
            os.remove(zip_path)
            
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"上传并处理专利失败 {patent_dir}: {str(e)}")
            if hasattr(e, 'response') and e.response:
                print(f"服务器响应: {e.response.text}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def upload_and_batch_process(self, path: str) -> dict:
        """
        上传并批处理专利目录或压缩包
        
        参数:
            path: 专利目录或压缩包路径
            
        返回:
            API响应字典
        """
        # 确保路径存在（仅在非远程模式下检查）
        if not self.remote_mode and not os.path.exists(path):
            raise FileNotFoundError(f"路径不存在: {path}")
        
        try:
            # 在远程模式下，直接发送路径
            if self.remote_mode:
                data = {
                    "path": path, 
                    "remote_mode": True,
                    "batch_mode": True
                }
                response = requests.post(f"{self.server_url}/upload_and_process", json=data, auth=self.auth)
                response.raise_for_status()
                return response.json()
            
            # 检查是文件夹还是压缩包
            is_archive = False
            for ext in ['.zip', '.rar', '.tar', '.gz', '.7z']:
                if path.lower().endswith(ext):
                    is_archive = True
                    break
            
            # 如果是目录，压缩后上传
            if os.path.isdir(path):
                zip_path = self._compress_directory(path)
                filename = os.path.basename(path) + ".zip"
            # 如果是压缩包，直接上传
            elif is_archive:
                zip_path = path
                filename = os.path.basename(path)
            else:
                return {"success": False, "error": "不支持的文件类型，请提供目录或压缩包"}
            
            # 上传并处理
            with open(zip_path, 'rb') as f:
                files = {'patent_folder': (filename, f)}
                data = {'batch_mode': 'true'}  # 标记为批处理模式
                response = requests.post(f"{self.server_url}/upload_and_process", files=files, data=data, auth=self.auth)
            
            # 如果我们创建了临时zip文件，删除它
            if os.path.isdir(path) and zip_path != path:
                os.remove(zip_path)
            
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"上传并批处理失败 {path}: {str(e)}")
            if hasattr(e, 'response') and e.response:
                print(f"服务器响应: {e.response.text}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _compress_directory(self, directory_path: str) -> str:
        """
        将目录压缩成zip文件
        
        参数:
            directory_path: 要压缩的目录路径
            
        返回:
            压缩文件路径
        """
        import zipfile
        
        # 创建临时zip文件名
        zip_path = os.path.join(tempfile.gettempdir(), f"{os.path.basename(directory_path)}.zip")
        
        print(f"正在压缩目录 {directory_path} 为 {zip_path}...")
        
        # 压缩目录
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(directory_path):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, os.path.dirname(directory_path))
                    zipf.write(file_path, arcname)
        
        return zip_path

def main():
    # 命令行参数解析
    parser = argparse.ArgumentParser(description="专利处理客户端")
    parser.add_argument("--server", default="http://172.19.1.81:7890", help="API服务器URL")
    parser.add_argument("--local", action="store_true", help="本地模式，文件路径在本地而非服务器上")
    parser.add_argument("--username", default="zhouxingyu", help="服务器认证用户名")
    parser.add_argument("--password", default="zxy123456", help="服务器认证密码")
    
    # 子命令
    subparsers = parser.add_subparsers(dest="command", help="子命令")
    
    # 处理单个专利命令
    patent_parser = subparsers.add_parser("patent", help="处理单个专利")
    patent_parser.add_argument("--dir", required=True, help="专利目录路径")
    patent_parser.add_argument("--device", type=int, help="设备ID")
    
    # 处理多个专利命令
    batch_parser = subparsers.add_parser("batch", help="处理多个专利")
    batch_parser.add_argument("--input", required=True, help="输入根目录")
    batch_parser.add_argument("--output", help="输出根目录(可选)")
    
    # 上传并处理命令
    upload_parser = subparsers.add_parser("upload", help="上传并处理单个专利目录")
    upload_parser.add_argument("--dir", required=True, help="专利目录路径")
    
    # 上传并批处理命令
    upload_batch_parser = subparsers.add_parser("upload-batch", help="上传并批处理专利目录或压缩包")
    upload_batch_parser.add_argument("--path", required=True, help="专利目录或压缩包路径")
    
    # 解析参数
    args = parser.parse_args()
    
    # 创建客户端
    client = PatentAPIClient(server_url=args.server, remote_mode=not args.local, 
                            username=args.username, password=args.password)
    
    # 执行命令
    if args.command == "patent":
        print(f"处理专利: {args.dir}")
        result = client.process_patent(args.dir, args.device)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
    elif args.command == "batch":
        print(f"批量处理专利: {args.input}")
        result = client.process_batch(args.input, args.output)
        
        # 打印摘要
        print(f"处理完成: {result['processed']} 成功, {result['failed']} 失败")
        
        # 保存详细结果到文件
        output_dir = Path("logs")
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = output_dir/"batch_results.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"详细结果已保存到: {output_file}")
        
        # 如果有失败，打印失败的专利
        if result['failed'] > 0:
            print("\n失败的专利:")
            for failure in result['failures']:
                print(f" - {failure['patent_dir']}: {failure['error']}")
    
    elif args.command == "upload":
        print(f"上传并处理专利: {args.dir}")
        result = client.upload_and_process(args.dir)
        print(json.dumps(result, indent=2, ensure_ascii=False))
    
    elif args.command == "upload-batch":
        print(f"上传并批处理: {args.path}")
        result = client.upload_and_batch_process(args.path)
        
        # 打印摘要
        if isinstance(result, dict) and 'processed' in result:
            print(f"处理完成: {result['processed']} 成功, {result['failed']} 失败")
            
            # 保存详细结果到文件
            output_dir = Path("logs")
            output_dir.mkdir(parents=True, exist_ok=True)
            output_file = output_dir/"upload_batch_results.json"
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            print(f"详细结果已保存到: {output_file}")
            
            # 如果有失败，打印失败的专利
            if result['failed'] > 0:
                print("\n失败的专利:")
                for failure in result['failures']:
                    print(f" - {failure['patent_dir']}: {failure['error']}")
        else:
            print(json.dumps(result, indent=2, ensure_ascii=False))
    
    else:
        parser.print_help()

if __name__ == "__main__":
    main() 
    # 服务器网址为：http://172.19.1.81:7890
    # 默认用户名：zhouxingyu，默认密码：zxy123456，默认为远程模式（服务器上的文件路径）
    
    # 单个专利处理示例（使用默认配置）:
    # python client.py patent --dir /home/zhangxiaohong/zhouxingyu/zxy_extractor/data/temp_output/CN106256824 --device 0
    
    # 使用本地模式处理本地专利:
    # python client.py --local patent --dir E:/patents/CN106256824
    
    # 批量处理示例:
    # python client.py batch --input /home/zhangxiaohong/zhouxingyu/zxy_extractor/data/temp_output --output /home/zhangxiaohong/zhouxingyu/zxy_extractor/data/temp_output
    
    # 使用自定义服务器地址:
    # python client.py --server http://custom.server:8080 patent --dir /path/to/patent
    
    # 上传并处理文件示例:
    # python client.py --local upload --dir E:/patents/CN106256824
    
    # 上传并批处理示例:
    # python client.py --local upload-batch --path E:/patents/batch
    # python client.py --local upload-batch --path E:/patents/batch.zip