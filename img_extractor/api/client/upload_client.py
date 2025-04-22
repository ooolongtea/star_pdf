"""
客户端上传模块
定义上传和批处理专利的方法
"""
import os
import requests
from pathlib import Path

from api.client.client_core import PatentAPIClient

class UploadPatentClient(PatentAPIClient):
    """专利上传客户端扩展类，定义上传专利的方法"""

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
                response = requests.post(f"{self.server_url}/api/upload_and_process", json=data, auth=self.auth)
                response.raise_for_status()
                return response.json()

            # 本地模式：将目录压缩成zip文件并上传
            zip_path = self._compress_directory(patent_dir)

            # 上传并处理
            with open(zip_path, 'rb') as f:
                files = {'patent_folder': (os.path.basename(patent_dir) + ".zip", f)}
                response = requests.post(f"{self.server_url}/api/upload_and_process", files=files, auth=self.auth)

            # 删除临时zip文件
            os.remove(zip_path)

            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return self._handle_request_exception(e, f"上传并处理专利失败 {patent_dir}")
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
                response = requests.post(f"{self.server_url}/api/upload_and_process", json=data, auth=self.auth)
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
                response = requests.post(f"{self.server_url}/api/upload_and_process", files=files, data=data, auth=self.auth)

            # 如果我们创建了临时zip文件，删除它
            if os.path.isdir(path) and zip_path != path:
                os.remove(zip_path)

            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return self._handle_request_exception(e, f"上传并批处理失败 {path}")
        except Exception as e:
            return {"success": False, "error": str(e)}