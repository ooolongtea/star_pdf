"""
客户端包初始化文件
"""
from api.client.client_core import PatentAPIClient
from api.client.process_client import ProcessPatentClient
from api.client.upload_client import UploadPatentClient

class PatentClient(ProcessPatentClient, UploadPatentClient):
    """
    完整的专利处理客户端
    整合了所有处理和上传功能
    """
    pass

# 导出类
__all__ = ['PatentClient', 'PatentAPIClient', 'ProcessPatentClient', 'UploadPatentClient']