"""
客户端核心模块
定义API客户端的核心功能
"""
import os
import sys
import json
import requests
import tempfile
import io
from pathlib import Path
from typing import Dict, Optional, List, Any
from pydantic import BaseModel

# 定义请求模型
class ProcessRequest(BaseModel):
    """处理请求模型"""
    patent_id: str
    patent_path: str
    output_dir: Optional[str] = None
    options: Optional[Dict[str, Any]] = None

class PatentAPIClient:
    """专利处理API客户端"""

    def __init__(self, server_url="http://172.19.1.81:8080", remote_mode=True, username="zhouxingyu", password="zxy123456"):
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
            response = requests.get(f"{self.server_url}/api/status", auth=self.auth)
            response.raise_for_status()  # 如果状态码不是200，引发异常

            # 检查服务器状态
            status_data = response.json()
            if not status_data.get("success", False):
                print(f"服务器状态异常: {status_data.get('message', '未知错误')}")
                if "服务器核心未初始化" in status_data.get("message", ""):
                    print("警告: 服务器核心未初始化，某些功能可能不可用")
                else:
                    sys.exit(1)

            # 不打印详细的设备信息，只显示简要状态
            print(f"已连接到服务器: {self.server_url}")
            print(f"服务器状态: {status_data.get('status', 'unknown')}")

            # 显示可用设备数量而不是详细信息
            devices = status_data.get("devices", [])
            if devices:
                print(f"可用设备: {len(devices)} 个")

        except requests.exceptions.RequestException as e:
            print(f"无法连接到服务器 {self.server_url}: {str(e)}")
            sys.exit(1)

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
            for root, _, files in os.walk(directory_path):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, os.path.dirname(directory_path))
                    zipf.write(file_path, arcname)

        return zip_path

    def _handle_request_exception(self, e, context="API请求"):
        """处理请求异常"""
        print(f"{context}失败: {str(e)}")
        if hasattr(e, 'response') and e.response:
            print(f"服务器响应: {e.response.text}")
        return {"success": False, "error": str(e)}

    def download_file(self, remote_path: str, local_path: str) -> bool:
        """
        下载单个文件

        参数:
            remote_path: 远程文件路径
            local_path: 本地保存路径

        返回:
            下载是否成功
        """
        try:
            from urllib.parse import quote
            encoded_path = quote(remote_path)
            download_url = f"{self.server_url}/api/download_file?file_path={encoded_path}"

            response = requests.get(download_url, auth=self.auth, stream=True)
            response.raise_for_status()

            # 保存文件
            with open(local_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            return True
        except Exception as e:
            print(f"下载文件失败: {str(e)}")
            return False

    def download_directory(self, remote_dir: str, local_dir: str) -> Dict:
        """
        下载整个目录

        参数:
            remote_dir: 远程目录路径
            local_dir: 本地保存目录

        返回:
            包含下载信息的字典
        """
        try:
            # 创建本地目录
            local_path = Path(local_dir)
            local_path.mkdir(parents=True, exist_ok=True)

            # 使用新的API下载目录
            from urllib.parse import quote
            encoded_dir = quote(remote_dir)
            download_url = f"{self.server_url}/api/download_directory?dir_path={encoded_dir}"

            print(f"正在下载目录: {remote_dir}")
            response = requests.get(download_url, auth=self.auth, stream=True)
            response.raise_for_status()

            # 检查是否是ZIP文件
            if response.headers.get('Content-Type') == 'application/zip':
                # 解压到本地目录
                import zipfile
                zip_data = io.BytesIO(response.content)

                # 创建下载结果字典
                downloaded_files = {
                    "output_dir": str(local_path),
                    "files": []
                }

                # 解压文件
                with zipfile.ZipFile(zip_data) as zipf:
                    total_files = len(zipf.namelist())
                    print(f"解压{total_files}个文件到 {local_path}")
                    zipf.extractall(local_path)

                    # 记录已下载文件
                    for file_name in zipf.namelist():
                        file_path = local_path / file_name

                        # 记录文件类型
                        file_type = "unknown"
                        if file_path.suffix.lower() in ['.xlsx', '.xls']:
                            file_type = "excel"
                        elif file_path.suffix.lower() == '.json':
                            file_type = "json"
                        elif file_path.suffix.lower() in ['.png', '.jpg', '.jpeg']:
                            file_type = "image"

                        downloaded_files["files"].append({
                            "type": file_type,
                            "path": str(file_path)
                        })

                print(f"成功下载目录到: {local_path}")
                return downloaded_files
            else:
                print(f"服务器返回错误，不是ZIP文件: {response.headers.get('Content-Type')}")
                return {"success": False, "error": "服务器没有返回ZIP文件"}
        except Exception as e:
            print(f"下载目录失败: {str(e)}")
            return {"success": False, "error": str(e)}