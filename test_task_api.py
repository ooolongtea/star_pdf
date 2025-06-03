#!/usr/bin/env python3
"""
任务API测试脚本
测试化学式提取服务器的任务状态API
"""

import requests
import json
import sys

# 配置
CHEMICAL_SERVER_URL = "http://localhost:8011"  # 化学式提取服务器地址

def test_health_check():
    """测试健康检查"""
    print("测试健康检查...")
    try:
        response = requests.get(f"{CHEMICAL_SERVER_URL}/api/health")
        print(f"健康检查状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"健康检查响应: {json.dumps(data, indent=2, ensure_ascii=False)}")
            return True
        else:
            print(f"健康检查失败: {response.text}")
            return False
    except Exception as e:
        print(f"健康检查异常: {e}")
        return False

def test_server_status():
    """测试服务器状态"""
    print("\n测试服务器状态...")
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
        print(f"服务器状态测试异常: {e}")
        return False

def test_task_list():
    """测试任务列表"""
    print("\n测试任务列表...")
    try:
        response = requests.get(f"{CHEMICAL_SERVER_URL}/api/tasks")
        print(f"任务列表状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"任务列表响应: {json.dumps(data, indent=2, ensure_ascii=False)}")
            return True
        else:
            print(f"获取任务列表失败: {response.text}")
            return False
    except Exception as e:
        print(f"任务列表测试异常: {e}")
        return False

def test_nonexistent_task():
    """测试不存在的任务"""
    print("\n测试不存在的任务...")
    try:
        fake_task_id = "nonexistent_task_12345"
        response = requests.get(f"{CHEMICAL_SERVER_URL}/api/task/{fake_task_id}")
        print(f"不存在任务状态码: {response.status_code}")
        if response.status_code == 404:
            print("✅ 正确返回404状态码")
            return True
        else:
            print(f"❌ 期望404，实际返回: {response.status_code}")
            print(f"响应内容: {response.text}")
            return False
    except Exception as e:
        print(f"测试不存在任务异常: {e}")
        return False

def main():
    """主函数"""
    print("=" * 60)
    print("任务API测试开始")
    print("=" * 60)
    
    tests = [
        ("健康检查", test_health_check),
        ("服务器状态", test_server_status),
        ("任务列表", test_task_list),
        ("不存在的任务", test_nonexistent_task),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n{'='*20} {test_name} {'='*20}")
        try:
            if test_func():
                print(f"✅ {test_name} 测试通过")
                passed += 1
            else:
                print(f"❌ {test_name} 测试失败")
        except Exception as e:
            print(f"❌ {test_name} 测试异常: {e}")
    
    print("\n" + "=" * 60)
    print(f"测试结果: {passed}/{total} 通过")
    print("=" * 60)
    
    if passed == total:
        print("🎉 所有测试通过!")
        return 0
    else:
        print("❌ 部分测试失败!")
        return 1

if __name__ == "__main__":
    sys.exit(main())
