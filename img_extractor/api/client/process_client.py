"""
客户端处理请求模块
定义处理专利的方法
"""
import os
import json
import time
import requests
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Union, Callable
from tqdm import tqdm
import sys

from api.client.client_core import PatentAPIClient, ProcessRequest

class ProcessPatentClient(PatentAPIClient):
    """专利处理客户端扩展类，定义处理专利的方法"""

    def process_patent(self, patent_dir: str, device_id: int = None,
                      wait_for_complete: bool = False, progress_callback: Callable = None,
                      save_local: bool = True, local_output_dir: Optional[str] = None,
                      download_dir: Optional[str] = None) -> dict:
        """
        处理单个专利目录

        参数:
            patent_dir: 专利目录路径
            device_id: 设备ID（用于选择GPU），如果为None，则服务器自动选择
            wait_for_complete: 是否等待处理完成
            progress_callback: 进度回调函数，接收(progress, message, status)三个参数
            save_local: 是否保存结果到本地
            local_output_dir: 本地保存目录，如果为None则保存到patent_dir所在目录
            download_dir: 指定下载目录路径，如果为None则使用默认的downloads目录

        返回:
            API响应字典
        """
        # 在本地模式下检查专利目录是否存在，在远程模式下由服务器负责检查
        if not self.remote_mode and not os.path.exists(patent_dir):
            print(f"警告：本地模式下专利目录不存在: {patent_dir}")
            raise FileNotFoundError(f"专利目录不存在: {patent_dir}")

        # 构建请求数据，适应服务器端的ProcessRequest模型
        # 从路径中提取专利ID
        patent_id = os.path.basename(patent_dir)

        data = {
            "patent_id": patent_id,
            "patent_path": patent_dir,
            "output_dir": None,
            "options": {
                "remote_mode": self.remote_mode
            }
        }

        # 只有在指定了设备ID时才添加到请求选项
        if device_id is not None:
            data["options"]["device_id"] = device_id

        try:
            if progress_callback:
                progress_callback(0, "正在发送处理请求...", "sending")
            else:
                print("正在发送处理请求...")

            response = requests.post(f"{self.server_url}/api/process_patent", json=data, auth=self.auth)
            response.raise_for_status()
            result = response.json()

            # 如果需要等待完成
            if wait_for_complete and result.get("success") and "task_id" in result:
                task_id = result.get("task_id")

                # 等待任务完成，并获取进度更新
                final_result = self.wait_for_task_completion(task_id, progress_callback)

                # 合并任务结果到处理结果
                result.update(final_result)

            # 如果处理成功并且需要保存到本地
            if save_local and result.get("success"):
                if self.remote_mode:
                    # 在远程模式下，需要从服务器下载结果
                    if progress_callback:
                        progress_callback(95, "正在从服务器下载结果", "downloading")
                    else:
                        print("正在从服务器下载结果...")

                    # 下载并保存处理结果
                    downloaded_files = self._download_remote_results(result, download_dir)
                    if downloaded_files:
                        result["local_files"] = downloaded_files

                    if progress_callback:
                        progress_callback(100, "远程结果已下载到本地", "completed")
                    else:
                        print("远程结果已下载到本地")
                else:
                    # 本地模式下，只需复制处理结果到指定目录
                    if progress_callback:
                        progress_callback(95, "正在将结果保存到本地", "saving")
                    else:
                        print("正在将结果保存到本地...")

                    # 下载并保存处理结果
                    local_files = self._download_and_save_results(result, patent_dir, local_output_dir)
                    if local_files:
                        result["local_files"] = local_files

                    if progress_callback:
                        progress_callback(100, "结果已保存到本地", "completed")
                    else:
                        print("结果已保存到本地")

            return result
        except requests.exceptions.RequestException as e:
            return self._handle_request_exception(e, f"处理专利失败 {patent_dir}")

    def process_batch(self, input_root: str, output_root: Optional[str] = None,
                      wait_for_complete: bool = False, progress_callback: Callable = None,
                      save_local: bool = True, local_output_dir: Optional[str] = None,
                      download_dir: Optional[str] = None) -> dict:
        """
        处理多个专利目录

        参数:
            input_root: 包含专利目录的根目录
            output_root: 输出根目录（可选，默认与输入相同）
            wait_for_complete: 是否等待所有处理完成
            progress_callback: 进度回调函数，接收(overall_progress, current_task, total_tasks)三个参数
            save_local: 是否保存结果到本地
            local_output_dir: 本地保存目录，如果为None则保存到input_root所在目录
            download_dir: 指定下载目录路径，如果为None则使用默认的downloads目录

        返回:
            API响应字典
        """
        # 确定专利目录列表
        patent_dirs = []

        if self.remote_mode:
            # 远程模式下，直接使用路径字符串，不检查本地是否存在
            # 由服务器端负责检查路径是否存在
            input_root = str(input_root)
            print(f"正在远程模式下处理目录: {input_root}")
            patent_dirs = [input_root]  # 发送根目录，服务器会查找里面的专利子目录
        else:
            # 本地模式下检查输入目录是否存在
            input_root = Path(input_root)
            if not input_root.exists():
                print(f"错误：输入目录不存在: {input_root}")
                raise FileNotFoundError(f"输入目录不存在: {input_root}")

            # 查找所有专利目录
            patent_dirs = [str(d) for d in input_root.iterdir() if d.is_dir() and not d.name.startswith(".")]

            if not patent_dirs:
                print(f"错误：在{input_root}中未找到专利目录")
                raise ValueError(f"在{input_root}中未找到专利目录")

            # 打印找到的专利目录
            print(f"找到{len(patent_dirs)}个专利目录。")

        # 构建请求数据，适应服务器端的BatchProcessRequest模型
        # 使用第一个目录作为批处理的根目录
        patent_dir = patent_dirs[0] if patent_dirs else ""

        data = {
            "patent_dir": patent_dir,
            "output_dir": str(output_root) if output_root else None,
            "options": {
                "remote_mode": self.remote_mode,
                "patent_dirs": patent_dirs  # 在选项中传递所有目录
            },
            "file_pattern": "*.*"  # 匹配所有文件
        }

        try:
            if progress_callback:
                progress_callback(0, "正在发送批量处理请求...", len(patent_dirs))
            else:
                print(f"正在发送批量处理请求...")

            response = requests.post(f"{self.server_url}/api/process_batch", json=data, auth=self.auth)
            response.raise_for_status()
            result = response.json()

            # 如果需要等待完成并且有批处理ID
            if wait_for_complete and "batch_id" in result:
                batch_id = result.get("batch_id")

                # 获取所有任务ID
                task_ids = [item.get("task_id") for item in result.get("results", [])]
                task_ids.extend([item.get("task_id") for item in result.get("failures", [])])

                # 过滤None值
                task_ids = [task_id for task_id in task_ids if task_id]

                if task_ids:
                    # 等待所有任务完成
                    final_result = self.wait_for_batch_completion(task_ids, progress_callback)
                    # 合并最终结果
                    result.update(final_result)

            # 如果处理成功并且需要保存到本地
            if save_local and result.get("results", []):
                if self.remote_mode:
                    # 在远程模式下，需要从服务器下载批处理结果
                    if progress_callback:
                        progress_callback(95, "正在从服务器下载批处理结果", len(patent_dirs))
                    else:
                        print("正在从服务器下载批处理结果...")

                    # 为每个成功处理的专利下载结果
                    local_results = []
                    for patent_result in result.get("results", []):
                        # 下载远程结果
                        downloaded_files = self._download_remote_results(patent_result, download_dir)
                        if downloaded_files:
                            patent_result["local_files"] = downloaded_files
                            local_results.append(patent_result)

                    result["local_results"] = local_results
                    if progress_callback:
                        progress_callback(100, f"已下载 {len(local_results)} 个专利远程结果到本地", len(patent_dirs))
                    else:
                        print(f"已下载 {len(local_results)} 个专利远程结果到本地")
                else:
                    # 本地模式下，直接保存处理结果到本地
                    if progress_callback:
                        progress_callback(95, "正在将批处理结果保存到本地", len(patent_dirs))
                    else:
                        print("正在将批处理结果保存到本地...")

                    # 为每个成功处理的专利保存结果
                    local_results = []
                    for patent_result in result.get("results", []):
                        patent_dir = patent_result.get("patent_dir")
                        if patent_dir:
                            # 下载并保存处理结果
                            local_files = self._download_and_save_results(patent_result, patent_dir, local_output_dir)
                            if local_files:
                                patent_result["local_files"] = local_files
                                local_results.append(patent_result)

                    result["local_results"] = local_results
                    if progress_callback:
                        progress_callback(100, f"已保存 {len(local_results)} 个专利结果到本地", len(patent_dirs))
                    else:
                        print(f"已保存 {len(local_results)} 个专利结果到本地")

            return result
        except requests.exceptions.RequestException as e:
            print(f"批量处理请求失败: {str(e)}")
            if hasattr(e, 'response') and e.response:
                print(f"服务器响应: {e.response.text}")

            # 如果批量处理失败，则逐个处理
            print("批量处理失败，尝试单个处理每个专利...")
            return self._process_patents_individually(patent_dirs, wait_for_complete, progress_callback, save_local, local_output_dir, download_dir)

    def _process_patents_individually(self, patent_dirs: List[str],
                                     wait_for_complete: bool = False,
                                     progress_callback: Callable = None,
                                     save_local: bool = False,
                                     local_output_dir: Optional[str] = None,
                                     download_dir: Optional[str] = None) -> dict:
        """
        单个处理每个专利目录

        参数:
            patent_dirs: 专利目录路径列表
            wait_for_complete: 是否等待每个处理完成
            progress_callback: 进度回调函数
            save_local: 是否保存结果到本地
            local_output_dir: 本地保存目录
            download_dir: 指定下载目录路径，如果为None则使用默认的downloads目录

        返回:
            结果摘要字典
        """
        results = []
        failures = []
        total = len(patent_dirs)

        for i, patent_dir in enumerate(tqdm(patent_dirs, desc="处理专利", unit="个")):
            result = self.process_patent(
                patent_dir,
                wait_for_complete=wait_for_complete,
                progress_callback=lambda prog, msg, status:
                    progress_callback(i/total + prog/total, f"{Path(patent_dir).name}: {msg}", total)
                    if progress_callback else None,
                save_local=save_local,
                local_output_dir=local_output_dir,
                download_dir=download_dir
            )

            if result.get("success", False):
                results.append({
                    "patent_dir": patent_dir,
                    "output_dir": result.get("output_dir"),
                    "excel_file": result.get("excel_file"),
                    "task_id": result.get("task_id"),
                    "local_files": result.get("local_files", [])
                })
            else:
                failures.append({
                    "patent_dir": patent_dir,
                    "error": result.get("error", "未知错误"),
                    "task_id": result.get("task_id")
                })

        # 返回结果摘要
        return {
            "success": len(failures) == 0,
            "processed": len(results),
            "failed": len(failures),
            "results": results,
            "failures": failures
        }

    def _download_and_save_results(self, result: Dict, patent_dir: str, local_output_dir: Optional[str] = None) -> Dict:
        """
        下载并保存处理结果到本地

        参数:
            result: 处理结果字典
            patent_dir: 专利目录路径
            local_output_dir: 本地保存目录，如果为None则使用专利目录

        返回:
            保存的文件路径字典
        """
        try:
            # 确定保存目录
            if local_output_dir:
                # 使用Path处理跨平台路径问题
                save_dir = Path(local_output_dir) / Path(patent_dir).name
            else:
                # 默认保存在专利目录本地
                save_dir = Path(patent_dir)

            # 确保目录存在
            save_dir.mkdir(parents=True, exist_ok=True)

            # 创建保存的文件路径字典
            saved_files = {
                "output_dir": str(save_dir),
                "files": []
            }

            # 复制Excel文件
            excel_file = result.get("excel_file")
            if excel_file and os.path.exists(excel_file):
                # 目标Excel文件路径
                dest_excel = save_dir / f"{Path(patent_dir).name}_chemicals.xlsx"
                # 复制文件
                shutil.copy2(excel_file, dest_excel)
                saved_files["files"].append({
                    "type": "excel",
                    "path": str(dest_excel)
                })

            # 复制输出目录中的其他文件（如JSON、图像等）
            output_dir = result.get("output_dir")
            if output_dir and os.path.exists(output_dir):
                # 复制JSON文件
                json_files = list(Path(output_dir).glob("*.json"))
                for json_file in json_files:
                    # 目标JSON文件路径
                    dest_json = save_dir / json_file.name
                    # 复制文件
                    shutil.copy2(json_file, dest_json)
                    saved_files["files"].append({
                        "type": "json",
                        "path": str(dest_json)
                    })

                # 复制图像文件
                image_files = []
                for ext in ["*.png", "*.jpg", "*.jpeg"]:
                    image_files.extend(list(Path(output_dir).glob(ext)))

                for image_file in image_files:
                    # 目标图像文件路径
                    dest_image = save_dir / image_file.name
                    # 复制文件
                    shutil.copy2(image_file, dest_image)
                    saved_files["files"].append({
                        "type": "image",
                        "path": str(dest_image)
                    })

            return saved_files
        except Exception as e:
            print(f"保存结果到本地时出错: {str(e)}")
            return {}

    def _download_remote_results(self, result: Dict, download_dir: Optional[str] = None) -> Dict:
        """
        从远程服务器下载处理结果，包括所有子目录和文件

        参数:
            result: 处理结果字典
            download_dir: 指定下载目录路径，如果为None则使用默认的downloads目录

        返回:
            下载的文件路径字典
        """
        if not self.remote_mode:
            return {}

        try:
            # 获取专利名称，避免使用完整路径以防路径分隔符问题
            patent_name = Path(result.get("patent_dir", "unknown")).name

            # 创建下载目录（使用Path处理跨平台路径问题）
            # 如果提供了下载目录，则使用它，否则使用默认的downloads文件夹
            if download_dir:
                base_download_dir = Path(download_dir)
            else:
                base_download_dir = Path(os.getcwd()) / "downloads"

            download_dir = base_download_dir / patent_name
            download_dir.mkdir(parents=True, exist_ok=True)

            # 创建下载的文件路径字典
            downloaded_files = {
                "output_dir": str(download_dir),
                "files": []
            }

            # 下载Excel文件
            excel_file = result.get("excel_file")
            if excel_file:
                try:
                    # 从路径中提取文件名，避免路径分隔符问题
                    excel_filename = Path(excel_file).name
                    # 构建下载URL，需要使用原始路径，因为服务器是Linux
                    download_url = f"{self.server_url}/api/download?file={excel_file}"
                    # 目标路径使用Path处理，确保在Windows上正确
                    dest_excel = download_dir / excel_filename

                    # 下载文件
                    response = requests.get(download_url, auth=self.auth, stream=True)
                    if response.status_code == 200:
                        with open(dest_excel, 'wb') as f:
                            for chunk in response.iter_content(chunk_size=8192):
                                f.write(chunk)

                        downloaded_files["files"].append({
                            "type": "excel",
                            "path": str(dest_excel)
                        })
                        print(f"成功下载文件到: {dest_excel}")
                except Exception as e:
                    print(f"下载Excel文件时出错: {str(e)}")

            # 下载主目录中的额外文件（例如.md、.txt、.pdf等）
            patent_dir = result.get("patent_dir", "")
            if patent_dir:
                try:
                    # 构建列表URL，使用URL编码处理路径中的特殊字符
                    from urllib.parse import quote
                    encoded_dir = quote(patent_dir)
                    list_url = f"{self.server_url}/api/list_files?dir={encoded_dir}"

                    response = requests.get(list_url, auth=self.auth)
                    if response.status_code == 200:
                        files_info = response.json().get("files", [])

                        # 下载根目录中的每个文件
                        for file_info in files_info:
                            file_path = file_info.get("path")
                            file_type = file_info.get("type", "unknown")

                            # 跳过已下载的Excel文件
                            if excel_file and file_path == excel_file:
                                continue

                            # 只下载根目录中的文件，不包括子目录
                            if file_path:
                                try:
                                    # 获取文件名
                                    filename = Path(file_path).name

                                    # 目标路径
                                    dest_file = download_dir / filename

                                    # 构建下载URL
                                    encoded_file = quote(file_path)
                                    download_url = f"{self.server_url}/api/download?file={encoded_file}"

                                    # 下载文件
                                    response = requests.get(download_url, auth=self.auth, stream=True)
                                    if response.status_code == 200:
                                        with open(dest_file, 'wb') as f:
                                            for chunk in response.iter_content(chunk_size=8192):
                                                f.write(chunk)

                                    downloaded_files["files"].append({
                                        "type": file_type,
                                        "path": str(dest_file)
                                    })
                                    print(f"成功下载文件到: {dest_file}")
                                except Exception as e:
                                    print(f"下载文件 {file_path} 时出错: {str(e)}")
                except Exception as e:
                    print(f"获取主目录文件列表时出错: {str(e)}")

            # 下载目录及其所有内容（包括子目录）
            output_dir = result.get("output_dir")
            if output_dir:
                try:
                    # 构建列表URL，使用URL编码处理路径中的特殊字符
                    from urllib.parse import quote
                    encoded_dir = quote(output_dir)

                    # 递归下载所有文件和子目录
                    self._download_directory_recursive(output_dir, download_dir, downloaded_files)

                except Exception as e:
                    print(f"获取输出目录文件列表时出错: {str(e)}")

            return downloaded_files
        except Exception as e:
            print(f"从远程服务器下载结果时出错: {str(e)}")
            return {}

    def _download_directory_recursive(self, remote_dir: str, local_dir: Path, downloaded_files: Dict):
        """
        递归下载目录中的所有文件和子目录

        参数:
            remote_dir: 远程目录路径
            local_dir: 本地目录路径
            downloaded_files: 已下载文件信息的字典，将被修改
        """
        from urllib.parse import quote

        # 确保本地目录存在
        local_dir.mkdir(parents=True, exist_ok=True)

        # 列出远程目录中的所有文件（包括子目录中的文件）
        encoded_dir = quote(remote_dir)
        # 使用recursive=true参数来一次性获取所有文件
        list_url = f"{self.server_url}/list_files?dir={encoded_dir}&recursive=true"
        response = requests.get(list_url, auth=self.auth)

        if response.status_code == 200:
            files_info = response.json().get("files", [])

            # 创建文件路径映射，用于创建目录结构
            for file_info in files_info:
                file_path = file_info.get("path")
                file_type = file_info.get("type", "unknown")

                if file_path:
                    try:
                        # 获取远程文件相对于remote_dir的相对路径
                        # 将路径转换为字符串以防止错误
                        remote_path_str = str(file_path)
                        remote_dir_str = str(remote_dir)

                        # 确保路径格式一致，统一使用正斜杠
                        remote_path_str = remote_path_str.replace('\\', '/')
                        remote_dir_str = remote_dir_str.replace('\\', '/')

                        # 构建相对路径
                        if remote_path_str.startswith(remote_dir_str):
                            # 去掉前缀，得到相对路径
                            rel_path_str = remote_path_str[len(remote_dir_str):]
                            # 删除开头的斜杠
                            if rel_path_str.startswith('/'):
                                rel_path_str = rel_path_str[1:]
                        else:
                            # 如果不是子路径，直接使用文件名
                            rel_path_str = os.path.basename(remote_path_str)

                        # 创建目标文件的目录结构
                        rel_path = Path(rel_path_str)
                        if len(rel_path.parts) > 1:  # 有子目录
                            dest_dir = local_dir / rel_path.parent
                            dest_dir.mkdir(parents=True, exist_ok=True)

                        # 目标文件路径
                        dest_file = local_dir / rel_path

                        # 构建下载URL
                        encoded_file = quote(file_path)
                        download_url = f"{self.server_url}/download?file={encoded_file}"

                        # 下载文件
                        response = requests.get(download_url, auth=self.auth, stream=True)
                        if response.status_code == 200:
                            with open(dest_file, 'wb') as f:
                                for chunk in response.iter_content(chunk_size=8192):
                                    f.write(chunk)

                            downloaded_files["files"].append({
                                "type": file_type,
                                "path": str(dest_file)
                            })
                            print(f"成功下载文件到: {dest_file}")
                    except Exception as e:
                        print(f"下载文件 {file_path} 时出错: {str(e)}")

            # 如果没有成功获取到文件或发生了错误，尝试使用备用方法
            if not downloaded_files["files"]:
                print(f"通过递归方式未能获取任何文件，尝试使用备用方法下载目录 {remote_dir}")
                self._download_directory_fallback(remote_dir, local_dir, downloaded_files)
        else:
            print(f"获取目录 {remote_dir} 的文件列表失败: {response.status_code}")
            # 如果递归获取失败，回退到旧方法获取当前目录文件和子目录
            self._download_directory_fallback(remote_dir, local_dir, downloaded_files)

    def _download_directory_fallback(self, remote_dir: str, local_dir: Path, downloaded_files: Dict):
        """
        在递归下载失败时的备选方法，手动处理每个子目录

        参数:
            remote_dir: 远程目录路径
            local_dir: 本地目录路径
            downloaded_files: 已下载文件信息的字典，将被修改
        """
        from urllib.parse import quote

        # 确保本地目录存在
        local_dir.mkdir(parents=True, exist_ok=True)

        # 列出当前目录中的文件
        encoded_dir = quote(remote_dir)
        list_url = f"{self.server_url}/list_files?dir={encoded_dir}"
        response = requests.get(list_url, auth=self.auth)

        if response.status_code == 200:
            files_info = response.json().get("files", [])

            # 下载当前目录中的每个文件
            for file_info in files_info:
                file_path = file_info.get("path")
                file_type = file_info.get("type", "unknown")

                if file_path:
                    try:
                        # 获取文件名
                        filename = os.path.basename(file_path)

                        # 目标路径在本地目录中
                        dest_file = local_dir / filename

                        # 构建下载URL
                        encoded_file = quote(file_path)
                        download_url = f"{self.server_url}/download?file={encoded_file}"

                        # 下载文件
                        response = requests.get(download_url, auth=self.auth, stream=True)
                        if response.status_code == 200:
                            with open(dest_file, 'wb') as f:
                                for chunk in response.iter_content(chunk_size=8192):
                                    f.write(chunk)

                            downloaded_files["files"].append({
                                "type": file_type,
                                "path": str(dest_file)
                            })
                            print(f"成功下载文件到: {dest_file}")
                    except Exception as e:
                        print(f"下载文件 {filename} 时出错: {str(e)}")

        # 获取并处理子目录
        subdirs_url = f"{self.server_url}/list_subdirs?dir={encoded_dir}"
        subdirs_response = requests.get(subdirs_url, auth=self.auth)

        if subdirs_response.status_code == 200:
            subdirs = subdirs_response.json().get("subdirs", [])

            # 递归下载每个子目录
            for subdir in subdirs:
                remote_subdir = subdir.get("path")
                if remote_subdir:
                    # 安全地获取子目录名称
                    subdir_name = os.path.basename(remote_subdir.rstrip('/').rstrip('\\'))
                    local_subdir = local_dir / subdir_name

                    # 递归调用下载子目录
                    self._download_directory_fallback(remote_subdir, local_subdir, downloaded_files)

    def get_task_progress(self, task_id: str) -> dict:
        """
        获取任务进度

        参数:
            task_id: 任务ID

        返回:
            任务进度信息字典
        """
        try:
            response = requests.get(
                f"{self.server_url}/task/progress",
                params={"task_id": task_id},
                auth=self.auth
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {
                "error": f"获取任务进度失败: {str(e)}",
                "status": "error",
                "progress": 0
            }

    def get_all_tasks_progress(self) -> dict:
        """
        获取所有任务的进度

        返回:
            所有任务进度信息字典
        """
        try:
            response = requests.get(f"{self.server_url}/task/progress/all", auth=self.auth)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {
                "error": f"获取所有任务进度失败: {str(e)}",
                "summary": {"total": 0}
            }

    def wait_for_task_completion(self, task_id: str, progress_callback: Callable = None,
                               check_interval: float = 1.0, timeout: float = 3600) -> dict:
        """
        等待任务完成

        参数:
            task_id: 任务ID
            progress_callback: 进度回调函数，接收(progress, message, status)三个参数
            check_interval: 检查间隔（秒）
            timeout: 超时时间（秒）

        返回:
            任务最终结果字典
        """
        start_time = time.time()
        last_progress = -1
        last_message = ""
        last_status = ""

        while time.time() - start_time < timeout:
            try:
                # 获取任务进度
                progress_info = self.get_task_progress(task_id)

                # 提取进度信息
                status = progress_info.get("status", "unknown")
                progress = progress_info.get("progress", 0)
                message = progress_info.get("message", "")

                # 显示进度条
                if progress != last_progress or message != last_message or status != last_status:
                    if progress_callback:
                        progress_callback(progress, message, status)
                    else:
                        # 如果没有回调函数，则使用标准输出
                        sys.stdout.write(f"\r进度: [{progress:3d}%] {message} ({status})")
                        sys.stdout.flush()

                    last_progress = progress
                    last_message = message
                    last_status = status

                # 检查任务是否已完成
                if status in ["completed", "failed"]:
                    if progress_callback:
                        # 最后一次回调
                        progress_callback(progress, message, status)

                    # 返回任务结果
                    return {
                        "status": status,
                        "message": message,
                        "progress": progress,
                        "error": progress_info.get("error")
                    }

                # 等待下一次检查
                time.sleep(check_interval)

            except Exception as e:
                print(f"\n检查任务进度时出错: {str(e)}")
                # 短暂暂停后重试
                time.sleep(check_interval * 2)

        # 超时
        return {
            "status": "timeout",
            "message": f"等待任务完成超时 (超过 {timeout} 秒)",
            "progress": last_progress,
            "error": "操作超时"
        }

    def wait_for_batch_completion(self, task_ids: List[str], progress_callback: Callable = None,
                                check_interval: float = 2.0, timeout: float = 7200) -> dict:
        """
        等待批量任务完成

        参数:
            task_ids: 任务ID列表
            progress_callback: 进度回调函数，接收(overall_progress, current_task, total_tasks)三个参数
            check_interval: 检查间隔（秒）
            timeout: 超时时间（秒）

        返回:
            批处理最终结果字典
        """
        if not task_ids:
            return {"status": "completed", "message": "没有任务需要等待"}

        start_time = time.time()
        total_tasks = len(task_ids)
        completed_tasks = set()
        task_status = {task_id: {"status": "pending", "progress": 0} for task_id in task_ids}

        while time.time() - start_time < timeout:
            try:
                # 检查每个任务的状态
                for task_id in task_ids:
                    if task_id in completed_tasks:
                        continue

                    progress_info = self.get_task_progress(task_id)
                    status = progress_info.get("status", "unknown")
                    progress = progress_info.get("progress", 0)

                    # 更新任务状态
                    task_status[task_id] = {
                        "status": status,
                        "progress": progress,
                        "message": progress_info.get("message", ""),
                        "error": progress_info.get("error")
                    }

                    # 检查是否完成
                    if status in ["completed", "failed"]:
                        completed_tasks.add(task_id)

                # 计算总体进度
                overall_progress = 0
                running_tasks = 0
                for info in task_status.values():
                    overall_progress += info.get("progress", 0)
                    if info.get("status") == "running":
                        running_tasks += 1

                overall_progress = overall_progress / (total_tasks * 100) * 100

                # 回调或显示进度
                if progress_callback:
                    progress_callback(
                        overall_progress,
                        f"完成: {len(completed_tasks)}/{total_tasks}, 运行中: {running_tasks}",
                        total_tasks
                    )
                else:
                    sys.stdout.write(f"\r总进度: [{overall_progress:.1f}%] 完成: {len(completed_tasks)}/{total_tasks}, 运行中: {running_tasks}")
                    sys.stdout.flush()

                # 检查是否所有任务都已完成
                if len(completed_tasks) == total_tasks:
                    if progress_callback:
                        progress_callback(100, f"所有 {total_tasks} 个任务已完成", total_tasks)

                    # 统计结果
                    success_count = sum(1 for info in task_status.values() if info.get("status") == "completed")
                    failed_count = sum(1 for info in task_status.values() if info.get("status") == "failed")

                    return {
                        "status": "completed",
                        "message": f"所有 {total_tasks} 个任务已完成",
                        "progress": 100,
                        "task_results": task_status,
                        "success_count": success_count,
                        "failed_count": failed_count
                    }

                # 等待下一次检查
                time.sleep(check_interval)

            except Exception as e:
                print(f"\n检查批处理任务进度时出错: {str(e)}")
                # 短暂暂停后重试
                time.sleep(check_interval * 2)

        # 超时
        completed_count = len(completed_tasks)
        return {
            "status": "timeout",
            "message": f"等待批处理完成超时 (已完成 {completed_count}/{total_tasks})",
            "progress": (completed_count / total_tasks) * 100,
            "error": "批处理操作超时",
            "task_results": task_status
        }