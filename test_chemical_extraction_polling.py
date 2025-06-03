#!/usr/bin/env python3
"""
化学式提取轮询测试脚本
测试远程服务器的化学式提取任务状态轮询功能
"""

import requests
import time
import json
import sys
from pathlib import Path

# 配置
CHEMICAL_SERVER_URL = "http://localhost:8011"  # 化学式提取服务器地址
TEST_PATENT_PATH = "test_patent"  # 测试专利路径

def test_task_status_api():
    """测试任务状态API是否可用"""
    print("=" * 60)
    print("测试任务状态API")
    print("=" * 60)
    
    try:
        # 测试获取任务列表
        response = requests.get(f"{CHEMICAL_SERVER_URL}/api/tasks")
        print(f"获取任务列表状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"任务列表响应: {json.dumps(data, indent=2, ensure_ascii=False)}")
            return True
        else:
            print(f"获取任务列表失败: {response.text}")
            return False
            
    except Exception as e:
        print(f"测试任务状态API失败: {e}")
        return False

def test_server_status():
    """测试服务器状态"""
    print("=" * 60)
    print("测试服务器状态")
    print("=" * 60)
    
    try:
        response = requests.get(f"{CHEMICAL_SERVER_URL}/api/status")
        print(f"服务器状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"服务器状态: {data.get('status', 'unknown')}")
            print(f"可用设备数: {len(data.get('devices', []))}")
            return True
        else:
            print(f"获取服务器状态失败: {response.text}")
            return False
            
    except Exception as e:
        print(f"测试服务器状态失败: {e}")
        return False

def simulate_chemical_extraction_task():
    """模拟化学式提取任务"""
    print("=" * 60)
    print("模拟化学式提取任务")
    print("=" * 60)
    
    try:
        # 准备请求数据
        request_data = {
            "patent_id": "test_patent_001",
            "patent_path": TEST_PATENT_PATH,
            "options": {
                "remote_mode": True,
                "extract_chemicals": True,
                "extract_tables": True
            }
        }
        
        print(f"发送处理请求: {json.dumps(request_data, indent=2, ensure_ascii=False)}")
        
        # 发送处理请求
        response = requests.post(
            f"{CHEMICAL_SERVER_URL}/api/process_patent",
            json=request_data,
            timeout=30
        )
        
        print(f"处理请求状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"处理响应: {json.dumps(data, indent=2, ensure_ascii=False)}")
            
            # 获取任务ID
            task_id = data.get('task_id')
            if task_id:
                print(f"获得任务ID: {task_id}")
                return task_id
            else:
                print("响应中没有任务ID")
                return None
        else:
            print(f"处理请求失败: {response.text}")
            return None
            
    except Exception as e:
        print(f"模拟化学式提取任务失败: {e}")
        return None

def poll_task_status(task_id, max_attempts=30, poll_interval=2):
    """轮询任务状态"""
    print("=" * 60)
    print(f"开始轮询任务状态: {task_id}")
    print("=" * 60)
    
    attempts = 0
    start_time = time.time()
    
    while attempts < max_attempts:
        try:
            print(f"\n第 {attempts + 1} 次轮询...")
            
            # 查询任务状态
            response = requests.get(f"{CHEMICAL_SERVER_URL}/api/task/{task_id}")
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('success'):
                    task_info = data
                    status = task_info.get('status', 'unknown')
                    progress = task_info.get('progress', 0)
                    message = task_info.get('message', '')
                    
                    print(f"状态: {status}")
                    print(f"进度: {progress}%")
                    print(f"消息: {message}")
                    
                    # 检查推荐轮询间隔
                    details = task_info.get('details', {})
                    recommended_interval = details.get('recommended_poll_interval', poll_interval)
                    print(f"推荐轮询间隔: {recommended_interval}秒")
                    
                    # 检查任务是否完成
                    if status == 'completed':
                        elapsed_time = time.time() - start_time
                        print(f"\n✅ 任务完成! 总耗时: {elapsed_time:.2f}秒")
                        return True
                    elif status == 'failed':
                        error = task_info.get('details', {}).get('error', '未知错误')
                        print(f"\n❌ 任务失败: {error}")
                        return False
                    
                    # 使用推荐的轮询间隔
                    time.sleep(recommended_interval)
                    
                else:
                    print(f"查询失败: {data.get('message', '未知错误')}")
                    time.sleep(poll_interval)
                    
            elif response.status_code == 404:
                print(f"任务不存在: {task_id}")
                return False
            else:
                print(f"查询状态失败 (状态码: {response.status_code}): {response.text}")
                time.sleep(poll_interval)
                
            attempts += 1
            
        except Exception as e:
            print(f"轮询错误: {e}")
            attempts += 1
            time.sleep(poll_interval)
    
    print(f"\n⏰ 轮询超时 (最大尝试次数: {max_attempts})")
    return False

def main():
    """主函数"""
    print("化学式提取轮询测试开始")
    print("=" * 60)
    
    # 1. 测试服务器状态
    if not test_server_status():
        print("❌ 服务器状态测试失败，退出")
        sys.exit(1)
    
    # 2. 测试任务状态API
    if not test_task_status_api():
        print("❌ 任务状态API测试失败，退出")
        sys.exit(1)
    
    # 3. 模拟化学式提取任务
    task_id = simulate_chemical_extraction_task()
    if not task_id:
        print("❌ 模拟化学式提取任务失败，退出")
        sys.exit(1)
    
    # 4. 轮询任务状态
    success = poll_task_status(task_id)
    
    if success:
        print("\n🎉 化学式提取轮询测试成功!")
    else:
        print("\n❌ 化学式提取轮询测试失败!")
        sys.exit(1)

if __name__ == "__main__":
    main()
