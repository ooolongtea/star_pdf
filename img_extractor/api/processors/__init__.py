"""
处理器模块
包含专利处理和分子共指解析的处理器
"""

from api.processors.patent_processor import PatentProcessor
from api.processors.molcoref_processor import MolCorefProcessor

__all__ = [
    'PatentProcessor',
    'MolCorefProcessor'
]