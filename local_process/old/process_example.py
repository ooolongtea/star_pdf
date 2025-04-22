#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
专利处理示例脚本
用于演示如何使用客户端API处理专利目录
"""

import os
import sys
import json
import time
import shutil
from pathlib import Path
from client import PatentAPIClient

def process_single_patent(input_path, output_path=None, server_url="http://localhost:7878"):
    """
    处理单个专利目录
    
    参数:
        input_path: 输入专利目录
        output_path: 输出目录（如果为None，则使用输入目录）
        server_url: 服务器URL
    """
    input_path = Path(input_path).resolve()
    
    # 如果未指定输出路径，使用输入路径
    if output_path is None:
        output_path = input_path
    else:
        output_path = Path(output_path).resolve()
        
        # 如果输出路径不存在，创建它
        if not output_path.exists():
            output_path.mkdir(parents=True, exist_ok=True)
            
        # 如果需要复制输入专利到输出目录
        patent_name = input_path.name
        patent_output_path = output_path / patent_name
        
        if not patent_output_path.exists():
            print(f"复制专利 {patent_name} 到输出目录...")
            shutil.copytree(input_path, patent_output_path)
        
        # 更新处理路径
        input_path = patent_output_path
    
    # 创建客户端
    client = PatentAPIClient(server_url=server_url)
    
    # 处理专利
    print(f"处理专利: {input_path}")
    start_time = time.time()
    result = client.process_patent(str(input_path))
    elapsed_time = time.time() - start_time
    
    # 打印结果
    if result.get("success", False):
        print(f"处理成功! 用时: {elapsed_time:.2f}秒")
        print(f"输出目录: {result.get('output_dir')}")
        print(f"Excel文件: {result.get('excel_file')}")
        return True
    else:
        print(f"处理失败: {result.get('error', '未知错误')}")
        return False

def process_batch(input_root, output_root=None, server_url="http://localhost:7878"):
    """
    批量处理专利目录
    
    参数:
        input_root: 输入根目录
        output_root: 输出根目录（如果为None，则使用输入根目录）
        server_url: 服务器URL
    """
    input_root = Path(input_root).resolve()
    
    # 如果未指定输出根目录，使用输入根目录
    if output_root is None:
        output_root = input_root
    else:
        output_root = Path(output_root).resolve()
        
        # 创建输出根目录
        output_root.mkdir(parents=True, exist_ok=True)
    
    # 创建客户端
    client = PatentAPIClient(server_url=server_url)
    
    # 批量处理
    print(f"批量处理专利: {input_root}")
    print(f"输出到: {output_root}")
    
    start_time = time.time()
    result = client.process_batch(str(input_root), str(output_root))
    elapsed_time = time.time() - start_time
    
    # 打印处理摘要
    print(f"\n处理完成! 用时: {elapsed_time:.2f}秒")
    print(f"成功: {result['processed']} 个专利")
    print(f"失败: {result['failed']} 个专利")
    
    # 如果有失败的专利，打印失败信息
    if result['failed'] > 0:
        print("\n失败的专利:")
        for failure in result['failures']:
            print(f" - {failure['patent_dir']}: {failure['error']}")
    
    # 保存详细结果到文件
    results_file = output_root / "batch_results.json"
    with open(results_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"\n详细结果已保存到: {results_file}")
    
    return result['failed'] == 0

def main():
    """主函数"""
    import argparse
    
    # 创建命令行参数解析器
    parser = argparse.ArgumentParser(description="专利处理示例脚本")
    parser.add_argument("--server", default="http://localhost:7878", help="服务器URL")
    parser.add_argument("--mode", choices=["single", "batch"], default="single", help="处理模式")
    parser.add_argument("--input", required=True, help="输入路径")
    parser.add_argument("--output", help="输出路径")
    
    # 解析命令行参数
    args = parser.parse_args()
    
    # 根据模式执行相应的处理
    if args.mode == "single":
        success = process_single_patent(args.input, args.output, args.server)
    else:  # batch
        success = process_batch(args.input, args.output, args.server)
    
    # 返回退出码
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main()) 