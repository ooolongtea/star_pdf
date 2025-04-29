#!/usr/bin/env python3
"""
MinerU客户端测试脚本 (修复版)

用于测试远程服务器上的mineru_server.py处理Word和Excel文件的功能
"""

import os
import sys
import uuid
import base64
import json
import time
import argparse
import requests
from pathlib import Path
from typing import Dict, Any, Optional, List, Union

# 配置日志
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("mineru_client_test.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("mineru_client_test")

class MinerUClient:
    """MinerU客户端，用于测试远程服务器"""
    
    def __init__(self, server_url: str = "http://127.0.0.1:8010", server_output_dir: str = "/home/zhangxiaohong/zhouxingyu/zxy_extractor/data/tmp/mineru"):
        """
        初始化MinerU客户端
        
        Args:
            server_url: 远程服务器URL
            server_output_dir: 远程服务器输出目录
        """
        self.server_url = server_url
        self.predict_url = f"{server_url}/predict"
        self.files_url = f"{server_url}/files"
        self.files_list_url = f"{server_url}/files/list"
        self.server_output_dir = server_output_dir
        
        # 创建输出目录
        self.output_dir = Path("mineru_test_results")
        self.output_dir.mkdir(exist_ok=True)
        
        logger.info(f"初始化MinerU客户端，服务器URL: {server_url}")
        logger.info(f"服务器输出目录: {server_output_dir}")
    
    def to_base64(self, file_path: Union[str, Path]) -> str:
        """
        将文件转换为Base64编码
        
        Args:
            file_path: 文件路径
            
        Returns:
            str: Base64编码的文件内容
        """
        try:
            with open(file_path, 'rb') as f:
                return base64.b64encode(f.read()).decode('utf-8')
        except Exception as e:
            logger.error(f"文件转换为Base64失败: {str(e)}")
            raise
    
    def process_file(self, file_path: Union[str, Path], options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        处理文件
        
        Args:
            file_path: 文件路径
            options: 处理选项
            
        Returns:
            Dict[str, Any]: 处理结果
        """
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        # 默认选项
        if options is None:
            options = {}
        
        # 生成请求ID
        request_id = options.get('request_id', str(uuid.uuid4()))
        
        # 构建请求数据
        payload = {
            'file': self.to_base64(file_path),
            'request_id': request_id,
            'kwargs': options
        }
        
        logger.info(f"处理文件: {file_path.name}, 请求ID: {request_id}")
        
        try:
            # 发送请求
            response = requests.post(self.predict_url, json=payload)
            response.raise_for_status()
            
            result = response.json()
            logger.info(f"处理成功: {result}")
            
            # 保存结果信息
            result_info = {
                'request_id': request_id,
                'file_name': file_path.name,
                'file_type': file_path.suffix.lower().lstrip('.'),
                'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
                'server_response': result
            }
            
            result_info_path = self.output_dir / f"{request_id}_info.json"
            with open(result_info_path, 'w', encoding='utf-8') as f:
                json.dump(result_info, f, indent=2, ensure_ascii=False)
            
            logger.info(f"结果信息已保存到: {result_info_path}")
            
            return result
        except Exception as e:
            logger.error(f"处理文件失败: {str(e)}")
            raise
    
    def get_file(self, file_path: str) -> Optional[bytes]:
        """
        获取处理结果文件
        
        Args:
            file_path: 文件路径
            
        Returns:
            Optional[bytes]: 文件内容
        """
        try:
            # 构建URL
            url = f"{self.files_url}?path={file_path}"
            logger.info(f"获取文件: {file_path}")
            
            # 发送请求
            response = requests.get(url)
            response.raise_for_status()
            
            return response.content
        except Exception as e:
            logger.error(f"获取文件失败: {str(e)}")
            return None
    
    def list_files(self, dir_path: str) -> Optional[Dict[str, Any]]:
        """
        列出处理结果目录
        
        Args:
            dir_path: 目录路径
            
        Returns:
            Optional[Dict[str, Any]]: 目录内容
        """
        try:
            # 构建URL
            url = f"{self.files_list_url}?path={dir_path}"
            logger.info(f"列出目录: {dir_path}")
            
            # 发送请求
            response = requests.get(url)
            response.raise_for_status()
            
            return response.json()
        except Exception as e:
            logger.error(f"列出目录失败: {str(e)}")
            return None
    
    def download_results(self, request_id: str) -> bool:
        """
        下载处理结果
        
        Args:
            request_id: 请求ID
            
        Returns:
            bool: 是否成功
        """
        try:
            # 构建服务器上的结果目录路径
            result_dir = f"{self.server_output_dir}/{request_id}/auto"
            
            # 列出目录内容
            files_result = self.list_files(result_dir)
            if not files_result:
                logger.error(f"无法获取目录内容: {result_dir}")
                return False
            
            # 创建输出目录
            output_dir = self.output_dir / request_id
            output_dir.mkdir(exist_ok=True)
            
            # 下载文件
            success_count = 0
            for file_info in files_result.get('files', []):
                file_name = file_info.get('name')
                if not file_name:
                    continue
                
                # 获取文件内容
                file_path = f"{result_dir}/{file_name}"
                file_content = self.get_file(file_path)
                if file_content:
                    # 保存文件
                    output_path = output_dir / file_name
                    with open(output_path, 'wb') as f:
                        f.write(file_content)
                    
                    logger.info(f"已下载文件: {output_path}")
                    success_count += 1
            
            logger.info(f"下载完成，共 {success_count} 个文件")
            return success_count > 0
        except Exception as e:
            logger.error(f"下载结果失败: {str(e)}")
            return False

def test_file(client: MinerUClient, file_path: str, options: Dict[str, Any] = None) -> bool:
    """
    测试处理文件
    
    Args:
        client: MinerU客户端
        file_path: 文件路径
        options: 处理选项
        
    Returns:
        bool: 是否成功
    """
    try:
        # 处理文件
        result = client.process_file(file_path, options)
        request_id = result.get('request_id')
        
        if not request_id:
            logger.error("处理结果中没有请求ID")
            return False
        
        # 等待处理完成
        logger.info("等待处理完成...")
        time.sleep(5)  # 增加等待时间，确保处理完成
        
        # 下载结果
        return client.download_results(request_id)
    except Exception as e:
        logger.error(f"测试失败: {str(e)}")
        return False

def main():
    parser = argparse.ArgumentParser(description="MinerU客户端测试脚本")
    parser.add_argument("file_path", help="要处理的文件路径")
    parser.add_argument("--server", default="http://127.0.0.1:8010", help="远程服务器URL")
    parser.add_argument("--output-dir", default="/home/zhangxiaohong/zhouxingyu/zxy_extractor/data/tmp/mineru", 
                        help="远程服务器输出目录")
    parser.add_argument("--wait", type=int, default=5, help="等待处理完成的时间(秒)")
    
    args = parser.parse_args()
    
    # 创建客户端
    client = MinerUClient(args.server, args.output_dir)
    
    # 测试文件
    logger.info(f"测试文件: {args.file_path}")
    success = test_file(client, args.file_path)
    
    if success:
        logger.info("测试成功!")
        return 0
    else:
        logger.error("测试失败!")
        return 1

if __name__ == "__main__":
    sys.exit(main())
