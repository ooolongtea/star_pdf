"""
配置管理模块
提供配置文件加载和日志设置功能
"""

import json
import logging
import yaml
import os
from pathlib import Path
from typing import Dict, Any, Union


def setup_logging(log_level: str = "INFO") -> None:
    """
    设置全局日志配置
    
    参数:
        log_level: 日志级别 (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    """
    # 获取日志级别
    numeric_level = getattr(logging, log_level.upper(), None)
    if not isinstance(numeric_level, int):
        raise ValueError(f"无效的日志级别: {log_level}")
    
    # 配置根日志记录器
    logging.basicConfig(
        level=numeric_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # 设置一些第三方库的日志级别为更高级别，减少过多的日志输出
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("fastapi").setLevel(logging.WARNING)


def load_config(config_path: Union[str, Path]) -> Dict[str, Any]:
    """
    从文件加载配置
    
    参数:
        config_path: 配置文件路径
        
    返回:
        配置字典
    """
    config_path = Path(config_path)
    
    if not config_path.exists():
        raise FileNotFoundError(f"配置文件不存在: {config_path}")
    
    # 根据文件扩展名选择解析器
    if config_path.suffix.lower() in ['.yml', '.yaml']:
        with open(config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    elif config_path.suffix.lower() == '.json':
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    else:
        raise ValueError(f"不支持的配置文件格式: {config_path.suffix}")


def get_default_config() -> Dict[str, Any]:
    """
    获取默认配置
    
    返回:
        默认配置字典
    """
    return {
        "host": "0.0.0.0",
        "port": 8000,
        "devices": ["cpu"],
        "connection_limit": 500,
        "thread_workers": 16,
        "process_count": 4,
        "data_dir": "data",
        "log_level": "INFO",
        "timeout": 600,  # 10分钟处理超时
        "max_batch_size": 50  # 最大批处理大小
    }


def save_config(config: Dict[str, Any], config_path: Union[str, Path], format: str = "yaml") -> None:
    """
    保存配置到文件
    
    参数:
        config: 配置字典
        config_path: 配置文件路径
        format: 文件格式 ('yaml' 或 'json')
    """
    config_path = Path(config_path)
    
    # 确保目录存在
    os.makedirs(config_path.parent, exist_ok=True)
    
    # 根据格式保存配置
    if format.lower() == 'yaml':
        with open(config_path, 'w', encoding='utf-8') as f:
            yaml.dump(config, f, default_flow_style=False, allow_unicode=True)
    elif format.lower() == 'json':
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
    else:
        raise ValueError(f"不支持的配置文件格式: {format}") 