"""
客户端核心模块
定义API客户端的核心功能
"""
import os
import sys
import json
import requests
import tempfile
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
            # 不打印状态和设备信息，只检查连接是否成功
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