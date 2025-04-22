#!/usr/bin/env python3
"""
API服务器启动脚本（放在API目录外）
"""
import os
import sys

# 添加项目根目录到Python路径
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

# 导入服务器主模块
from api.server_main import main

if __name__ == "__main__":
    main() 