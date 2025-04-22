"""
客户端上传模块
定义上传和批处理专利的方法
"""
import os
import requests
from pathlib import Path
from typing import Optional, Dict

from api.client.client_core import PatentAPIClient

class UploadPatentClient(PatentAPIClient):
    """专利上传客户端扩展类，定义上传专利的方法"""

    def upload_and_process(self, patent_dir: str, download_dir: Optional[str] = None, save_local: bool = True) -> dict:
        """
        上传并处理专利目录

        参数:
            patent_dir: 专利目录路径
            download_dir: 下载目录路径，如果为None则使用默认的downloads目录
            save_local: 是否保存结果到本地

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
                result = response.json()
            else:
                # 本地模式：将目录压缩成zip文件并上传
                zip_path = self._compress_directory(patent_dir)

                # 上传并处理
                with open(zip_path, 'rb') as f:
                    files = {'patent_folder': (os.path.basename(patent_dir) + ".zip", f)}
                    response = requests.post(f"{self.server_url}/api/upload_and_process", files=files, auth=self.auth)

                # 删除临时zip文件
                os.remove(zip_path)

                response.raise_for_status()
                result = response.json()

            # 处理下载
            if result.get("success", False) and save_local and self.remote_mode:
                # 检查是否有下载链接
                if "download_url" in result:
                    print("处理成功，正在下载结果...")
                    
                    # 创建下载目录
                    if download_dir:
                        base_download_dir = Path(download_dir)
                    else:
                        base_download_dir = Path(os.getcwd()) / "downloads"
                        
                    # 从路径中提取专利ID
                    patent_id = Path(patent_dir).name
                    local_dir = base_download_dir / patent_id
                    local_dir.mkdir(parents=True, exist_ok=True)
                    
                    # 构建下载URL
                    download_url = result["download_url"]
                    if not download_url.startswith("http"):
                        download_url = f"{self.server_url}{download_url}"
                        
                    # 下载结果
                    try:
                        response = requests.get(download_url, auth=self.auth, stream=True)
                        response.raise_for_status()
                        
                        # 处理ZIP文件
                        import io
                        import zipfile
                        zip_data = io.BytesIO(response.content)
                        
                        # 创建下载文件记录
                        downloaded_files = {
                            "output_dir": str(local_dir),
                            "files": []
                        }
                        
                        # 解压文件
                        with zipfile.ZipFile(zip_data) as zipf:
                            total_files = len(zipf.namelist())
                            print(f"解压{total_files}个文件到 {local_dir}")
                            
                            for file_name in zipf.namelist():
                                zipf.extract(file_name, local_dir)
                                file_path = local_dir / file_name
                                
                                # 确定文件类型
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
                        
                        # 添加下载记录到结果
                        result["local_files"] = downloaded_files
                        print(f"成功下载处理结果到: {local_dir}")
                    except Exception as e:
                        print(f"下载处理结果时出错: {str(e)}")
                else:
                    print("处理成功但没有下载链接，无法获取结果文件")

            return result
        except requests.exceptions.RequestException as e:
            return self._handle_request_exception(e, f"上传并处理专利失败 {patent_dir}")
        except Exception as e:
            return {"success": False, "error": str(e)}

    def upload_and_batch_process(self, path: str, download_dir: Optional[str] = None, save_local: bool = True) -> dict:
        """
        上传并批处理专利目录或压缩包

        参数:
            path: 专利目录或压缩包路径
            download_dir: 下载目录路径，如果为None则使用默认的downloads目录
            save_local: 是否保存结果到本地

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
                result = response.json()
            else:
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
                result = response.json()

            # 处理下载
            if result.get("success", False) and save_local and self.remote_mode:
                # 检查是否有下载链接
                if "download_url" in result:
                    print("批处理成功，正在下载结果...")
                    
                    # 创建下载目录
                    if download_dir:
                        base_download_dir = Path(download_dir)
                    else:
                        base_download_dir = Path(os.getcwd()) / "downloads"
                        
                    # 为批处理结果创建目录
                    import time
                    batch_dir_name = f"batch_results_{int(time.time())}"
                    local_dir = base_download_dir / batch_dir_name
                    local_dir.mkdir(parents=True, exist_ok=True)
                    
                    # 构建下载URL
                    download_url = result["download_url"]
                    if not download_url.startswith("http"):
                        download_url = f"{self.server_url}{download_url}"
                        
                    # 下载结果
                    try:
                        response = requests.get(download_url, auth=self.auth, stream=True)
                        response.raise_for_status()
                        
                        # 处理ZIP文件
                        import io
                        import zipfile
                        zip_data = io.BytesIO(response.content)
                        
                        # 创建下载文件记录
                        downloaded_files = {
                            "output_dir": str(local_dir),
                            "files": []
                        }
                        
                        # 解压文件
                        with zipfile.ZipFile(zip_data) as zipf:
                            total_files = len(zipf.namelist())
                            print(f"解压{total_files}个文件到 {local_dir}")
                            
                            for file_name in zipf.namelist():
                                zipf.extract(file_name, local_dir)
                                file_path = local_dir / file_name
                                
                                # 确定文件类型
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
                        
                        # 添加下载记录到结果
                        result["local_files"] = downloaded_files
                        print(f"成功下载批处理结果到: {local_dir}")
                    except Exception as e:
                        print(f"下载批处理结果时出错: {str(e)}")
                else:
                    print("批处理成功但没有下载链接，无法获取结果文件")

            return result
        except requests.exceptions.RequestException as e:
            return self._handle_request_exception(e, f"上传并批处理失败 {path}")
        except Exception as e:
            return {"success": False, "error": str(e)}