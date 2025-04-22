"""
文件处理工具模块
定义文件处理相关函数，包括解压缩、路径处理等
"""
import os
import shutil
import tempfile
import mimetypes
from pathlib import Path

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

def get_file_size(file_path):
    """
    获取文件大小

    参数:
        file_path: 文件路径

    返回:
        文件大小（字节）
    """
    return os.path.getsize(file_path)

def get_file_type(file_path):
    """
    获取文件MIME类型

    参数:
        file_path: 文件路径

    返回:
        文件MIME类型
    """
    mime_type = mimetypes.guess_type(file_path)[0]
    return mime_type or 'application/octet-stream'

def find_patent_dirs(root_dir):
    """
    在根目录中查找专利目录

    参数:
        root_dir: 根目录路径

    返回:
        专利目录路径列表
    """
    root_path = Path(root_dir)
    if not root_path.exists():
        return []

    # 查找所有包含image子目录的目录（可能是专利目录）
    patent_dirs = []

    # 检查直接子目录
    for dir_path in root_path.iterdir():
        if not dir_path.is_dir() or dir_path.name.startswith('.'):
            continue

        # 检查是否有image子目录
        if (dir_path / 'image').exists():
            patent_dirs.append(str(dir_path))

    return patent_dirs