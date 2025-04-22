#!/usr/bin/env python3
"""
专利上传批处理示例脚本
该脚本演示如何使用PatentAPIClient上传并批处理专利文件夹或压缩包
"""

import os
import sys
import json
import argparse
from pathlib import Path
from client import PatentAPIClient

def main():
    """主函数"""
    # 命令行参数解析
    parser = argparse.ArgumentParser(description="专利上传批处理示例")
    parser.add_argument("--server", default="http://172.19.1.81:7890", help="API服务器URL")
    parser.add_argument("--username", default="zhouxingyu", help="服务器认证用户名")
    parser.add_argument("--password", default="zxy123456", help="服务器认证密码")
    parser.add_argument("--local", action="store_true", help="本地模式，文件路径在本地而非服务器上")
    parser.add_argument("--path", required=True, help="专利目录或压缩包路径")
    parser.add_argument("--single", action="store_true", help="单个专利处理模式")
    
    args = parser.parse_args()
    
    # 创建客户端
    client = PatentAPIClient(
        server_url=args.server,
        remote_mode=not args.local,
        username=args.username,
        password=args.password
    )
    
    # 检查服务器状态
    print(f"连接到服务器: {args.server}")
    print(f"模式: {'本地' if args.local else '远程'}")
    
    # 处理专利
    if args.single:
        print(f"上传并处理单个专利: {args.path}")
        result = client.upload_and_process(args.path)
    else:
        print(f"上传并批处理: {args.path}")
        result = client.upload_and_batch_process(args.path)
    
    # 打印结果
    if isinstance(result, dict) and 'processed' in result:
        print(f"\n处理完成: {result['processed']} 成功, {result['failed']} 失败")
        
        # 保存详细结果到文件
        output_dir = Path("logs")
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = output_dir / "upload_results.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"详细结果已保存到: {output_file}")
        
        # 如果有失败，打印失败的专利
        if result['failed'] > 0:
            print("\n失败的专利:")
            for failure in result['failures']:
                print(f" - {failure['patent_dir']}: {failure['error']}")
    else:
        print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main() 