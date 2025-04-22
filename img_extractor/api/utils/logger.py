"""
日志工具模块
提供统一的日志记录功能
"""
import logging
from typing import Optional

def get_logger(name: str, level: Optional[str] = None) -> logging.Logger:
    """
    获取指定名称的日志记录器
    
    参数:
        name: 日志记录器名称
        level: 日志级别 (DEBUG, INFO, WARNING, ERROR, CRITICAL)，如果为None则使用默认级别
        
    返回:
        日志记录器实例
    """
    logger = logging.getLogger(name)
    
    # 如果指定了级别，则设置
    if level:
        numeric_level = getattr(logging, level.upper(), None)
        if isinstance(numeric_level, int):
            logger.setLevel(numeric_level)
    
    # 确保至少有一个处理器，避免日志不显示
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    
    return logger
