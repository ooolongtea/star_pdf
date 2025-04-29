from abc import ABC, abstractmethod
from pathlib import Path
import re

# 🔹 抽象策略：定义解析器接口
class DocumentParser(ABC):
    """Abstract base class for document parsers"""
    def __init__(self):
        self.model_manager = None
    
    @abstractmethod
    def parse(self, file_bytes: bytes, filename: str, output_dir: Path, opts: dict):
        pass
    
    def _sanitize_filename(self, filename: str) -> str:
        return re.sub(r'[^\w\-_\. ]', '_', filename)
    
    def set_model_manager(self, model_manager):
        self.model_manager = model_manager